import type { RecentProject } from '../shared/api'
import type { ExportContext, Scene } from '../shared/export'
import type { Template } from '../shared/model/template'
import { RECENT, del, get, getAll, put } from './fs/idb'
import { FrameWindow } from './exportFrame'

// Progetti recenti della versione web, nel database del browser (vedi main/project/recent.ts)

const MAX_RECENT = 24
const THUMB_SIZE = 360

interface Entry {
  name: string
  openedAt: number
  thumbnail?: string
}

export async function listRecent(): Promise<RecentProject[]> {
  const all = await getAll<Entry>(RECENT)
  // il permesso sulle cartelle si chiede all'apertura: qui non si sa se ci sono ancora
  return all
    .map(({ key, value }) => ({ folder: key, ...value, missing: false }))
    .sort((a, b) => b.openedAt - a.openedAt)
}

export async function addRecent(folder: string, name: string): Promise<void> {
  const old = await get<Entry>(RECENT, folder)
  await put(RECENT, folder, { ...old, name, openedAt: Date.now() })
  const list = await listRecent()
  for (const e of list.slice(MAX_RECENT)) await del(RECENT, e.folder)
}

/** Nome con cui il progetto compare nei recenti, se c'è */
export async function recentName(folder: string): Promise<string | undefined> {
  return (await get<Entry>(RECENT, folder))?.name
}

export async function removeRecent(folder: string): Promise<void> {
  await del(RECENT, folder)
}

export async function hasThumbnail(folder: string): Promise<boolean> {
  return !!(await get<Entry>(RECENT, folder))?.thumbnail
}

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
  const win = await FrameWindow.open(context)
  try {
    await win.show(scene, w, h)
    const png = (await win.capture(w, h)).toPNG()
    const entry = await get<Entry>(RECENT, folder)
    if (entry)
      await put(RECENT, folder, {
        ...entry,
        thumbnail: 'data:image/png;base64,' + png.toString('base64')
      })
  } finally {
    win.close()
  }
}
