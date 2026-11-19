import JSZip from 'jszip'
import type { LoadedProject } from '../../../shared/project'
import { MessageError, msg } from '../../../shared/messages'
import {
  collectPackage,
  findConflicts,
  parseManifest,
  PACKAGE_MANIFEST,
  type PackageConflict,
  type PackageManifest
} from '../../../shared/model/package'

// Lo ZIP dei pacchetti di template e set: stella-package.json e i file sotto assets/. Vedi
// shared/model/package.ts e docs/specifica.md, sezione 8.4.

/** Crea il pacchetto di un template o di un set e lo fa salvare; restituisce dove, o null */
export async function exportPackage(
  project: LoadedProject,
  what: { kind: 'template' | 'set'; name: string }
): Promise<{ path: string; manifest: PackageManifest } | null> {
  const manifest = collectPackage(
    {
      templates: project.templates,
      sets: project.sets,
      assets: project.assets,
      fonts: project.fonts,
      sources: project.sources,
      variables: project.file.variables ?? {},
      styles: project.file.styles ?? {}
    },
    what
  )
  const zip = new JSZip()
  zip.file(PACKAGE_MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  for (const f of await window.api.readAssetFiles(manifest.assets))
    zip.file(`assets/${f.path}`, f.data)
  const data = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  const path = await window.api.savePackage(what.name, data)
  return path ? { path, manifest } : null
}

export interface OpenedPackage {
  file: string
  manifest: PackageManifest
  files: Map<string, Uint8Array>
  conflicts: PackageConflict[]
}

const equal = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i])

/** Sceglie e legge un pacchetto, con quello che c'è già nel progetto; null se annullato */
export async function openPackage(project: LoadedProject): Promise<OpenedPackage | null> {
  const picked = await window.api.openPackage()
  return picked ? readPackage(project, picked) : null
}

/**
 * Legge un pacchetto già in memoria (scelto o lasciato cadere sulla finestra), con quello che c'è
 * già nel progetto. Si riconosce dal manifest, non dal nome: va bene ogni .zip che lo contiene
 */
export async function readPackage(
  project: LoadedProject,
  picked: { name: string; data: Uint8Array }
): Promise<OpenedPackage> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(picked.data)
  } catch {
    throw new MessageError(msg('package.notZip', { file: picked.name }))
  }
  const entry = zip.file(PACKAGE_MANIFEST)
  const manifest = entry ? parseManifest(JSON.parse(await entry.async('string'))) : null
  if (!manifest) throw new MessageError(msg('package.notPackage', { file: picked.name }))
  const files = new Map<string, Uint8Array>()
  for (const a of manifest.assets) {
    const f = zip.file(`assets/${a}`)
    if (f) files.set(a, await f.async('uint8array'))
  }
  manifest.assets = manifest.assets.filter((a) => files.has(a))
  const scope = {
    templates: project.templates,
    sets: project.sets,
    assets: project.assets,
    variables: project.file.variables ?? {},
    styles: project.file.styles ?? {}
  }
  // prima tutti i file con lo stesso nome, poi si leggono quelli del progetto per confrontarli
  const candidates = findConflicts(manifest, scope, () => false).filter((c) => c.existing)
  const mine = new Map(
    (await window.api.readAssetFiles([...new Set(candidates.map((c) => c.existing!))])).map(
      (f) => [f.path, f.data] as const
    )
  )
  const conflicts = findConflicts(manifest, scope, (pkg, own) => {
    const a = files.get(pkg)
    const b = mine.get(own)
    return !!a && !!b && equal(a, b)
  })
  return { file: picked.name, manifest, files, conflicts }
}
