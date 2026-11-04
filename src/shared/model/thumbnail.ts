import type { LoadedProject } from '../project'
import type { Template } from './template'
import { bindCard, bindRow, rowToCard } from './bind'
import { normalizeLayer, normalizeTemplate } from './normalize'
import { projectSystem, systemOfSet } from './system'

/** Lato maggiore della copertina fatta da un'immagine, in mm: conta solo la proporzione */
const IMAGE_COVER_SIZE = 100

/**
 * Template da disegnare come miniatura, secondo la copertina scelta in Informazioni progetto:
 * un componente del progetto, o un'immagine (`imageSize` ne dà la proporzione, larghezza su
 * altezza). Senza copertina, o se quella scelta non c'è più: la prima carta del primo set che ne
 * ha, altrimenti il primo template con i suoi valori predefiniti. null se non c'è nulla da
 * disegnare.
 */
export function thumbnailTemplate(project: LoadedProject, imageRatio?: number): Template | null {
  const ctx = {
    assets: project.assets,
    styles: project.file.styles,
    variables: project.file.variables
  }
  const cover = project.file.cover
  if (cover && 'image' in cover && project.assets.includes(cover.image))
    return imageTemplate(cover.image, imageRatio ?? 1)
  if (cover && 'set' in cover) {
    const s = project.sets.find((x) => x.name === cover.set)
    const tpl = s && project.templates.find((x) => x.name === s.template)
    const rows = s?.data?.rows ?? []
    if (s?.data && tpl && rows.length) {
      const i = Math.min(Math.max(1, Math.round(cover.row)), rows.length) - 1
      const bound = bindRow(s.data.headers, rows[i], tpl, project.templates, {
        ...ctx,
        system: { ...systemOfSet(project.file, s), number: i + 1 }
      }).template
      // la miniatura disegna il fronte: per il retro si scambiano le facce
      return cover.side === 'back' && bound.back.length
        ? { ...bound, front: bound.back, back: bound.front }
        : bound
    }
  }
  for (const s of project.sets) {
    const tpl = project.templates.find((x) => x.name === s.template)
    if (tpl && s.data?.rows.length)
      return bindRow(s.data.headers, s.data.rows[0], tpl, project.templates, {
        ...ctx,
        system: { ...systemOfSet(project.file, s), number: 1 }
      }).template
  }
  const first = project.templates[0]
  return first
    ? bindCard(first, rowToCard([], []), { ...ctx, system: projectSystem(project.file) }).template
    : null
}

/** Un componente fatto solo dell'immagine, con la sua proporzione */
function imageTemplate(src: string, ratio: number): Template {
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 1
  const width = r >= 1 ? IMAGE_COVER_SIZE : IMAGE_COVER_SIZE * r
  const height = r >= 1 ? IMAGE_COVER_SIZE / r : IMAGE_COVER_SIZE
  return {
    ...normalizeTemplate({ name: 'cover', width, height }),
    cornerRadius: 0,
    front: [
      normalizeLayer(
        { type: 'image', name: 'cover', src, x: 0, y: 0, w: width, h: height, fit: 'contain' },
        0
      )
    ],
    back: []
  }
}
