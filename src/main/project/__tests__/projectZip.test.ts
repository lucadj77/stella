import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { buildProjectZip, extractProjectZip, inspectProjectZip } from '../projectZip'

const temp = (): string => mkdtempSync(join(tmpdir(), 'stella-pzip-'))

function makeProject(dir: string): void {
  mkdirSync(join(dir, 'templates'), { recursive: true })
  mkdirSync(join(dir, 'assets', 'fonts'), { recursive: true })
  mkdirSync(join(dir, 'data'))
  mkdirSync(join(dir, 'export'))
  mkdirSync(join(dir, 'deleted'))
  mkdirSync(join(dir, 'docs'))
  writeFileSync(
    join(dir, 'stella.json'),
    JSON.stringify({ name: 'Last Bounty', dataFile: 'data/cards.xlsx', sets: [{ name: 'carte' }] })
  )
  writeFileSync(join(dir, 'templates', 'carte.json'), '{}')
  writeFileSync(join(dir, 'data', 'cards.xlsx'), 'x')
  writeFileSync(join(dir, 'assets', 'a.png'), 'png')
  writeFileSync(join(dir, 'assets', 'fonts', 'f.ttf'), 'ttf')
  writeFileSync(join(dir, 'docs', 'Regole.md'), '# Regole')
  writeFileSync(join(dir, 'export', 'out.pdf'), 'pdf')
  writeFileSync(join(dir, 'deleted', 'old.json'), '{}')
  writeFileSync(join(dir, '.hidden'), 'h')
}

describe('progetto intero in uno ZIP', () => {
  it('esporta, descrive ed estrae il progetto, senza export/, deleted/ e file nascosti', async () => {
    const dir = temp()
    try {
      const project = join(dir, 'p')
      makeProject(project)
      const data = await buildProjectZip(project, 'Last Bounty')
      const names = Object.keys((await JSZip.loadAsync(data)).files).filter((n) => !n.endsWith('/'))
      expect(names.every((n) => n.startsWith('Last_Bounty/'))).toBe(true)
      expect(names.some((n) => n.includes('export/') || n.includes('deleted/'))).toBe(false)
      expect(names.some((n) => n.includes('.hidden'))).toBe(false)

      const summary = await inspectProjectZip(data)
      expect(summary).toEqual({
        name: 'Last Bounty',
        folderName: 'Last_Bounty',
        sets: ['carte'],
        templates: 1,
        documents: 1,
        notes: 0,
        images: 1,
        fonts: 1,
        dataFile: 'data/cards.xlsx',
        files: 6
      })

      const folder = await extractProjectZip(data, join(dir, 'out'), 'Copia')
      expect(folder).toBe(join(dir, 'out', 'Copia'))
      expect(readFileSync(join(folder, 'stella.json'), 'utf8')).toContain('Last Bounty')
      expect(existsSync(join(folder, 'assets', 'fonts', 'f.ttf'))).toBe(true)
      // una cartella che c'è già e non è vuota non si tocca
      await expect(extractProjectZip(data, join(dir, 'out'), 'Copia')).rejects.toThrow(
        'projectZip.targetExists'
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('accetta stella.json alla radice e rifiuta pacchetti e percorsi che escono', async () => {
    const dir = temp()
    try {
      const zip = new JSZip()
      zip.file('stella.json', JSON.stringify({ name: 'Radice', sets: [] }))
      zip.file('../fuori.txt', 'x')
      zip.file('__MACOSX/._stella.json', 'x')
      const data = await zip.generateAsync({ type: 'uint8array' })
      const summary = await inspectProjectZip(data)
      expect(summary?.folderName).toBe('Radice')
      const folder = await extractProjectZip(data, dir, 'Radice')
      expect(existsSync(join(folder, 'stella.json'))).toBe(true)
      expect(existsSync(join(dir, 'fuori.txt'))).toBe(false)
      expect(existsSync(join(folder, '__MACOSX'))).toBe(false)

      const pkg = new JSZip()
      pkg.file('stella-package.json', '{}')
      expect(await inspectProjectZip(await pkg.generateAsync({ type: 'uint8array' }))).toBeNull()
      expect(await inspectProjectZip(new Uint8Array([1, 2, 3]))).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
