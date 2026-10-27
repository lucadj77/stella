import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { copyProject, moveProject } from '../relocate'
import { APP_STATE_FILE } from '../agentLock'

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'stella-relocate-'))
  const folder = join(root, 'Gioco')
  await mkdir(join(folder, 'templates'), { recursive: true })
  await writeFile(join(folder, 'stella.json'), '{}')
  await writeFile(join(folder, 'templates', 'carta.json'), '{"name":"carta"}')
  await writeFile(join(folder, APP_STATE_FILE), '{}')
  return folder
}

describe('copia e spostamento del progetto', () => {
  it('la copia ha tutti i file tranne lo stato dell app, e l originale resta', async () => {
    const from = await project()
    const to = join(from, '..', 'Gioco copia')
    await copyProject(from, to)
    expect(await readFile(join(to, 'templates', 'carta.json'), 'utf8')).toBe('{"name":"carta"}')
    expect(existsSync(join(to, APP_STATE_FILE))).toBe(false)
    expect(existsSync(join(from, 'stella.json'))).toBe(true)
  })

  it('non copia dentro il progetto né in una cartella piena', async () => {
    const from = await project()
    await expect(copyProject(from, join(from, 'dentro'))).rejects.toThrow()
    await expect(copyProject(from, from)).rejects.toThrow()
    const full = join(from, '..', 'piena')
    await mkdir(full)
    await writeFile(join(full, 'x.txt'), 'x')
    await expect(copyProject(from, full)).rejects.toThrow()
  })

  it('lo spostamento usa anche una cartella vuota già creata', async () => {
    const from = await project()
    const to = join(from, '..', 'Altrove')
    await mkdir(to)
    await moveProject(from, to)
    expect(existsSync(join(to, 'stella.json'))).toBe(true)
    expect(existsSync(from)).toBe(false)
  })
})
