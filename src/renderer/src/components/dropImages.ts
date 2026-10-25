import { assetRefName, IMAGE_EXTENSIONS } from '../../../shared/model/assets'
import { publishAssetsUpdate } from '../render/assets'

// Immagini trascinate dal computer nella finestra: si copiano in assets/images/ e si usano subito.

const isImage = (f: File): boolean =>
  IMAGE_EXTENSIONS.some((ext) => f.name.toLowerCase().endsWith(ext))

/** Il trascinamento porta dei file (non un testo o un elemento della pagina) */
export const dragHasFiles = (e: React.DragEvent): boolean =>
  Array.from(e.dataTransfer.types).includes('Files')

/**
 * Copia nel progetto le immagini lasciate cadere e restituisce i nomi con cui richiamarle,
 * nell'ordine dei file; [] se nessun file è un'immagine
 */
export async function importDropped(e: React.DragEvent): Promise<string[]> {
  const files = Array.from(e.dataTransfer.files).filter(isImage)
  if (!files.length) return []
  const data = await Promise.all(
    files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))
  )
  const { update, paths } = await window.api.dropImages(data)
  publishAssetsUpdate(update)
  return paths.map((p) => assetRefName(p, update.assets))
}
