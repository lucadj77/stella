import { createHash } from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { exists, writeFileSafe } from '../fs'
import { join } from 'path'
import { app } from 'electron'
import { projectFilePath } from './projectFile'
import type { RecentProject } from '../../shared/api'
import type { ExportContext, Scene } from '../../shared/export'
import type { Template } from '../../shared/model/template'
import { ExportWindow } from '../export/window'

// Progetti aperti di recente, per la schermata di ingresso. L'elenco e le miniature stanno nei
// dati dell'app, non nei progetti: aprire un progetto non scrive nulla nella sua cartella.

const MAX_RECENT = 24
/** Lato maggiore della miniatura in pixel: abbastanza per uno schermo ad alta densità */
const THUMB_SIZE = 360

interface Entry {
  folder: string
  name: string
  openedAt: number
}

const dataDir = (): string => app.getPath('userData')
const listFile = (): string => join(dataDir(), 'recent-projects.json')
const thumbFile = (folder: string): string =>
  join(dataDir(), 'thumbnails', createHash('sha1').update(folder).digest('hex') + '.png')

async function readEntries(): Promise<Entry[]> {
  try {
    const list = JSON.parse(await readFile(listFile(), 'utf8'))
    return Array.isArray(list) ? list.filter((e) => typeof e?.folder === 'string') : []
  } catch {
    return []
  }
}

async function writeEntries(list: Entry[]): Promise<void> {
  await mkdir(dataDir(), { recursive: true })
  await writeFileSafe(listFile(), JSON.stringify(list, null, 2) + '\n')
}

/** Elenco dal più recente, con miniature e progetti spostati o cancellati segnati come mancanti */
export async function listRecent(): Promise<RecentProject[]> {
  const list = await readEntries()
  return Promise.all(
    list.map(async (e) => {
      const missing = !(await exists(await projectFilePath(e.folder)))
      let thumbnail: string | undefined
      try {
        thumbnail =
          'data:image/png;base64,' + (await readFile(thumbFile(e.folder))).toString('base64')
      } catch {
        // nessuna miniatura: progetto senza template o mai disegnato
      }
      return { ...e, missing, thumbnail }
    })
  )
}

/** Nome con cui il progetto compare nei recenti, se c'è: serve quando il suo file non si legge */
export async function recentName(folder: string): Promise<string | undefined> {
  return (await readEntries()).find((e) => e.folder === folder)?.name
}

export async function addRecent(folder: string, name: string): Promise<void> {
  const list = (await readEntries()).filter((e) => e.folder !== folder)
  list.unshift({ folder, name, openedAt: Date.now() })
  const removed = list.splice(MAX_RECENT)
  await writeEntries(list)
  await Promise.all(removed.map((e) => rm(thumbFile(e.folder), { force: true })))
}

export async function removeRecent(folder: string): Promise<void> {
  await writeEntries((await readEntries()).filter((e) => e.folder !== folder))
  await rm(thumbFile(folder), { force: true })
}

export async function hasThumbnail(folder: string): Promise<boolean> {
  return exists(thumbFile(folder))
}

/** Disegna la carta con la finestra nascosta dell'esportazione e la salva come miniatura */
export async function saveThumbnail(
  folder: string,
  template: Template,
  context: ExportContext
): Promise<void> {
  const scale = THUMB_SIZE / Math.max(template.width, template.height)
  const w = Math.max(1, Math.round(template.width * scale))
  const h = Math.max(1, Math.round(template.height * scale))
  const scene: Scene = {
    pages: [
      {
        width: template.width,
        height: template.height,
        items: [{ x: 0, y: 0, template, side: 'front', mode: 'trim' }],
        lines: []
      }
    ],
    scale: w / template.width,
    background: null,
    lineColor: '#000',
    lineWidth: 0,
    linesOver: false
  }
  const win = await ExportWindow.open(context)
  try {
    await win.show(scene, w, h)
    const img = await win.capture(w, h)
    await mkdir(join(dataDir(), 'thumbnails'), { recursive: true })
    await writeFile(thumbFile(folder), img.toPNG())
  } finally {
    win.close()
  }
}
