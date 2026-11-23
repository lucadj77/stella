import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ensureLauncher, inspectDropped, launcherFromArgs } from '../launcher'

const temp = (): string => mkdtempSync(join(tmpdir(), 'stella-launcher-'))

describe('file .stella e cartelle trascinate', () => {
  it('scrive il .stella con il nome del progetto, una volta sola', async () => {
    const dir = temp()
    try {
      writeFileSync(join(dir, 'stella.json'), '{}')
      await ensureLauncher(dir, 'Last Bounty')
      expect(readdirSync(dir).sort()).toEqual(['Last_Bounty.stella', 'stella.json'])
      // un altro nome (progetto rinominato) non aggiunge un secondo file
      await ensureLauncher(dir, 'Altro nome')
      expect(readdirSync(dir).filter((n) => n.endsWith('.stella'))).toEqual(['Last_Bounty.stella'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('riconosce progetti Stella, Tabletop Creator e il resto', async () => {
    const dir = temp()
    try {
      const stella = join(dir, 'gioco')
      mkdirSync(stella)
      writeFileSync(join(stella, 'stella.json'), '{}')
      writeFileSync(join(stella, 'gioco.stella'), '{}')
      const ttc = join(dir, 'ttc')
      mkdirSync(join(ttc, 'data', 'blueprints'), { recursive: true })
      const other = join(dir, 'altro')
      mkdirSync(other)
      expect(await inspectDropped(stella)).toEqual({ folder: stella, kind: 'stella' })
      // il file dentro la cartella vale per la cartella
      expect(await inspectDropped(join(stella, 'gioco.stella'))).toEqual({
        folder: stella,
        kind: 'stella'
      })
      expect(await inspectDropped(join(stella, 'stella.json'))).toEqual({
        folder: stella,
        kind: 'stella'
      })
      expect(await inspectDropped(ttc)).toEqual({ folder: ttc, kind: 'ttc' })
      expect((await inspectDropped(other)).kind).toBeNull()
      expect((await inspectDropped(join(dir, 'manca'))).kind).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('trova il progetto tra gli argomenti di avvio', () => {
    expect(launcherFromArgs(['/opt/Stella/stella-gc', '/home/a/x/x.stella'])).toBe('/home/a/x')
    expect(launcherFromArgs(['stella.exe', '--some-flag', 'C:/x/y.stella'])).toBe('C:/x')
    expect(launcherFromArgs(['stella.exe', '--some-flag'])).toBeNull()
    expect(launcherFromArgs(['stella-gc', 'file:///home/a/My%20game/x.stella'])).toBe(
      '/home/a/My game'
    )
    expect(launcherFromArgs(['electron', '.'])).toBeNull()
  })
})
