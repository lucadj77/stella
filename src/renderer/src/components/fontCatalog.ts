import type { FontCatalog } from '../../../shared/library'

let catalogPromise: Promise<FontCatalog> | null = null

/** Il catalogo dei font Google, letto una volta sola (lo usano la scelta del font e i controlli) */
export function loadCatalog(reload = false): Promise<FontCatalog> {
  if (reload) catalogPromise = null
  catalogPromise ??= window.api.fontCatalog()
  catalogPromise.catch(() => (catalogPromise = null))
  return catalogPromise
}
