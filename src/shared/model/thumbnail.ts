import type { LoadedProject, LoadedSet, ProjectCover } from '../project'
import type { Side, Template } from './template'
import { resolveAsset } from './assets'
import { backIsFront } from './template'
import { CARD_PREFIX, findCard, isMessage, parseCardRef } from './document'
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
  const image = cover && 'image' in cover ? resolveAsset(cover.image, project.assets) : null
  if (image?.ok) return imageTemplate(image.path, imageRatio ?? 1)
  const picked = cover && !('image' in cover) ? coverCard(cover, project) : null
  if (picked) {
    const { set: s, row: i, side } = picked
    const tpl = project.templates.find((x) => x.name === s.template)
    if (s.data && tpl) {
      const bound = bindRow(s.data.headers, s.data.rows[i], tpl, project.templates, {
        ...ctx,
        system: { ...systemOfSet(project.file, s), number: i + 1 }
      }).template
      // la miniatura disegna il fronte: per il retro si scambiano le facce
      return side === 'back' && bound.back.length && !backIsFront(bound)
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

/** Il componente scelto come copertina, se c'è ancora */
export function coverCard(
  cover: Exclude<ProjectCover, { image: string }>,
  project: Pick<LoadedProject, 'sets'>
): { set: LoadedSet; row: number; side: Side } | null {
  if ('card' in cover) {
    const ref = parseCardRef(CARD_PREFIX + cover.card)
    if (isMessage(ref)) return null
    const found = findCard(ref, project.sets)
    return isMessage(found) || !found.set.data?.rows[found.row]
      ? null
      : { ...found, side: ref.side }
  }
  const set = project.sets.find((x) => x.name === cover.set)
  const rows = set?.data?.rows.length ?? 0
  if (!set || !rows) return null
  const row = Math.min(Math.max(1, Math.round(cover.row)), rows) - 1
  return { set, row, side: cover.side ?? 'front' }
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
