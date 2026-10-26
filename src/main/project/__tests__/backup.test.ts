import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  autoBackup,
  backupsSize,
  createBackup,
  labelBackup,
  listBackups,
  projectBackupDir,
  pruneBackups,
  restoreBackup
} from '../backup'

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'stella-backup-'))
  const folder = join(root, 'Assedio')
  await mkdir(join(folder, 'assets', 'icons'), { recursive: true })
  await mkdir(join(folder, 'export'), { recursive: true })
  await writeFile(join(folder, 'stella.json'), '{"name":"Assedio"}')
  await writeFile(join(folder, 'assets', 'icons', 'spada.svg'), '<svg/>')
  await writeFile(join(folder, 'export', 'carte.pdf'), 'pdf')
  await writeFile(join(folder, '.DS_Store'), 'x')
  return folder
}

describe('backup', () => {
  it('salva il progetto senza export e file nascosti, e lo ripristina accanto', async () => {
    const folder = await project()
    const dir = join(folder, '..', 'backup')
    const item = await createBackup(folder, 'Assedio', dir, false, new Date(2026, 9, 19, 15, 30, 5))
    expect(item.name).toBe('Assedio 2026-10-19 15.30.05.zip')
    const list = await listBackups(dir)
    expect(list.map((b) => [b.name, b.auto])).toEqual([[item.name, false]])

    const restored = await restoreBackup(item.file, join(folder, '..'))
    expect(restored.endsWith('Assedio 2026-10-19 15.30.05')).toBe(true)
    expect((await readdir(restored)).sort()).toEqual(['assets', 'stella.json'])
    expect(await readFile(join(restored, 'assets', 'icons', 'spada.svg'), 'utf8')).toBe('<svg/>')
    // un secondo ripristino non sovrascrive il primo
    expect(await restoreBackup(item.file, join(folder, '..'))).toBe(restored + ' 2')
  })

  it('dà un nome ai backup, lo cambia e lo toglie', async () => {
    const folder = await project()
    const dir = join(folder, '..', 'backup')
    const at = new Date(2026, 9, 19, 15, 30, 5)
    const item = await createBackup(folder, 'Assedio', dir, false, at, ' prima: delle/nuove regole ')
    expect(item.name).toBe('Assedio 2026-10-19 15.30.05 - prima delle nuove regole.zip')
    expect(item.label).toBe('prima delle nuove regole')
    const [listed] = await listBackups(dir)
    expect([listed.label, listed.auto, listed.date]).toEqual([item.label, false, at.getTime()])

    const renamed = await labelBackup(item.file, 'versione 2')
    expect(renamed.name).toBe('Assedio 2026-10-19 15.30.05 - versione 2.zip')
    const restored = await restoreBackup(renamed.file, join(folder, '..'))
    expect(restored.endsWith('Assedio 2026-10-19 15.30.05 - versione 2')).toBe(true)
    const plain = await labelBackup(renamed.file, '  ')
    expect(plain.name).toBe('Assedio 2026-10-19 15.30.05.zip')
    expect(plain.label).toBeUndefined()

    const auto = await createBackup(folder, 'Assedio', dir, true, new Date(2026, 9, 19, 16, 0))
    const named = await labelBackup(auto.file, 'buono')
    expect([named.name, named.auto]).toEqual(['Assedio 2026-10-19 16.00.00 auto - buono.zip', true])
  })

  it('salva ogni immagine una volta sola e ripristina quella del momento del backup', async () => {
    const folder = await project()
    const dir = join(folder, '..', 'backup')
    const icon = join(folder, 'assets', 'icons', 'spada.svg')
    const first = await createBackup(folder, 'Assedio', dir, true, new Date(2026, 9, 19, 9, 0))
    await createBackup(folder, 'Assedio', dir, true, new Date(2026, 9, 19, 10, 0))
    expect((await readdir(join(dir, 'assets'))).length).toBe(1)
    await writeFile(icon, '<svg id="2"/>')
    const third = await createBackup(folder, 'Assedio', dir, true, new Date(2026, 9, 19, 11, 0))
    expect((await readdir(join(dir, 'assets'))).length).toBe(2)
    expect(await backupsSize(dir)).toBeGreaterThan(0)

    const out = await mkdtemp(join(tmpdir(), 'stella-r-'))
    const old = await restoreBackup(first.file, out)
    expect(await readFile(join(old, 'assets', 'icons', 'spada.svg'), 'utf8')).toBe('<svg/>')
    const recent = await restoreBackup(third.file, out)
    expect(await readFile(join(recent, 'assets', 'icons', 'spada.svg'), 'utf8')).toBe(
      '<svg id="2"/>'
    )
    expect(await readdir(recent)).not.toContain('stella-backup.json')

    // tenendo solo l'ultimo, la versione vecchia dell'immagine non serve più
    await pruneBackups(dir, 1)
    expect((await readdir(join(dir, 'assets'))).length).toBe(1)
  })

  it('non include la cartella dei backup se sta dentro il progetto', async () => {
    const folder = await project()
    const dir = join(folder, 'backup')
    await createBackup(folder, 'Assedio', dir, false, new Date(2026, 9, 19, 10, 0, 0))
    const second = await createBackup(folder, 'Assedio', dir, false, new Date(2026, 9, 19, 11, 0))
    const restored = await restoreBackup(second.file, await mkdtemp(join(tmpdir(), 'stella-r-')))
    expect((await readdir(restored)).sort()).toEqual(['assets', 'stella.json'])
  })

  it("automatico: non più di uno all'ora, e tiene solo gli ultimi", async () => {
    const folder = await project()
    const dir = join(folder, '..', 'backup')
    const settings = { folder: '', auto: true, keep: 2 }
    const at = (h: number, m = 0): Date => new Date(2026, 9, 19, h, m)
    expect(await autoBackup(folder, 'Assedio', dir, settings, at(9))).not.toBeNull()
    expect(await autoBackup(folder, 'Assedio', dir, settings, at(9, 30))).toBeNull()
    await createBackup(folder, 'Assedio', dir, false, at(9, 45))
    expect(await autoBackup(folder, 'Assedio', dir, settings, at(11))).not.toBeNull()
    expect(await autoBackup(folder, 'Assedio', dir, settings, at(13))).not.toBeNull()
    const names = (await listBackups(dir)).map((b) => b.name)
    // il manuale resta, degli automatici solo gli ultimi due
    expect(names).toEqual([
      'Assedio 2026-10-19 13.00.00 auto.zip',
      'Assedio 2026-10-19 11.00.00 auto.zip',
      'Assedio 2026-10-19 09.45.00.zip'
    ])
    expect(
      await autoBackup(folder, 'Assedio', dir, { ...settings, auto: false }, at(20))
    ).toBeNull()
    await pruneBackups(dir, 1)
    expect((await listBackups(dir)).length).toBe(2)
  })

  it('due progetti con lo stesso nome hanno cartelle di backup distinte', async () => {
    const a = await project()
    const b = await project()
    const root = await mkdtemp(join(tmpdir(), 'stella-backup-root-'))
    // elencare non crea cartelle
    expect(await projectBackupDir(root, 'Assedio', a)).toBe(join(root, 'Assedio'))
    expect(await readdir(root)).toEqual([])
    const dirA = (await createBackup(a, 'Assedio', join(root, 'Assedio'), true)).file
    expect(dirA.startsWith(join(root, 'Assedio'))).toBe(true)
    expect(await projectBackupDir(root, 'Assedio', a)).toBe(join(root, 'Assedio'))
    expect(await projectBackupDir(root, 'Assedio', b)).toBe(join(root, 'Assedio 2'))
    await mkdir(join(root, 'Assedio 2'))
    expect(await projectBackupDir(root, 'Assedio', b)).toBe(join(root, 'Assedio 2'))
    // la cartella ora ha un proprietario: a non la prende
    expect(await projectBackupDir(root, 'Assedio', a)).toBe(join(root, 'Assedio'))
  })
})
