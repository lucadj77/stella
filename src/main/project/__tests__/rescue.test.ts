import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { createBackup, findBackupDir, isBackupZip, projectBackupDir } from '../backup'
import { projectFileCopyPath, writeProjectFile } from '../projectFile'
import { projectRescue, restoreProjectBackup, restoreProjectFileCopy } from '../rescue'
import { loadProject } from '../load'
import { inspectProjectZip } from '../projectZip'

const json = (name: string): string =>
  JSON.stringify({ formatVersion: 1, name, dataFile: 'dati.xlsx', sets: [] }, null, 2) + '\n'

async function project(): Promise<{ root: string; folder: string; backups: string }> {
  const root = await mkdtemp(join(tmpdir(), 'stella-rescue-'))
  const folder = join(root, 'Assedio')
  await mkdir(join(folder, 'templates'), { recursive: true })
  await writeFile(join(folder, 'stella.json'), json('Assedio'))
  return { root, folder, backups: join(root, 'Backup') }
}

describe('salvataggio del file di progetto', () => {
  it('tiene la copia della versione di prima, solo se era leggibile', async () => {
    const { folder } = await project()
    const target = join(folder, 'stella.json')
    await writeProjectFile(target, json('Assedio 2'))
    expect(await readFile(target, 'utf8')).toBe(json('Assedio 2'))
    expect(await readFile(projectFileCopyPath(target), 'utf8')).toBe(json('Assedio'))
    // un file rovinato non prende il posto della copia buona
    await writeFile(target, '\0\0\0\0')
    await writeProjectFile(target, json('Assedio 3'))
    expect(await readFile(projectFileCopyPath(target), 'utf8')).toBe(json('Assedio'))
    expect((await readdir(folder)).filter((n) => n.endsWith('.tmp'))).toEqual([])
  })
})

describe('progetto che non si apre', () => {
  it('un file pieno di zeri dà un errore chiaro', async () => {
    const { folder } = await project()
    await writeFile(join(folder, 'stella.json'), Buffer.alloc(4475))
    await expect(loadProject(folder)).rejects.toThrow('load.emptyProjectFile')
  })

  it('rimette la copia e tiene il file rovinato da parte', async () => {
    const { folder, backups } = await project()
    const target = join(folder, 'stella.json')
    await writeProjectFile(target, json('Assedio 2'))
    await writeFile(target, Buffer.alloc(100))
    const found = await projectRescue(folder, backups)
    expect(found.copy).not.toBeNull()
    expect(found.backups).toEqual([])
    await restoreProjectFileCopy(folder)
    expect(JSON.parse(await readFile(target, 'utf8')).name).toBe('Assedio')
    expect((await readFile(target + '.damaged')).length).toBe(100)
  })

  it('trova i backup dalla cartella del progetto, senza leggerne il nome', async () => {
    const { root, folder, backups } = await project()
    const dir = await projectBackupDir(backups, 'Assedio', folder)
    const item = await createBackup(folder, 'Assedio', dir, true, new Date(2026, 10, 25, 18, 30))
    // il progetto ha cambiato nome dopo il backup e ora il file è rovinato
    await writeFile(join(folder, 'stella.json'), Buffer.alloc(50))
    expect(await findBackupDir(backups, folder)).toBe(dir)
    const found = await projectRescue(folder, backups)
    expect(found.copy).toBeNull()
    expect(found.backups.map((b) => b.name)).toEqual([item.name])
    const restored = await restoreProjectBackup(folder, item.file, backups)
    expect(restored).toBe(join(root, 'Assedio 2026-11-25 18.30.00'))
    expect(JSON.parse(await readFile(join(restored, 'stella.json'), 'utf8')).name).toBe('Assedio')
    // solo i backup di quel progetto
    const other = join(root, 'Altro')
    await mkdir(other)
    await expect(restoreProjectBackup(other, item.file, backups)).rejects.toThrow()
  })

  it('riconosce lo zip di un backup', async () => {
    const { folder, backups } = await project()
    const dir = await projectBackupDir(backups, 'Assedio', folder)
    const item = await createBackup(folder, 'Assedio', dir)
    expect(await isBackupZip(item.file)).toBe(true)
    expect(await isBackupZip(join(folder, 'stella.json'))).toBe(false)
    const summary = await inspectProjectZip(await readFile(item.file))
    expect(summary?.backup).toBe(true)
  })
})
