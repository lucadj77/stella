import type { LoadedProject } from '../../../shared/project'
import type { Side } from '../../../shared/model/template'
import { walkLayers } from '../../../shared/model/normalize'
import { resolveAsset } from '../../../shared/model/assets'
import { isGenericFont, markupFonts } from '../../../shared/model/fonts'
import { cardFingerprints } from '../../../shared/model/compare'
import { buildSets } from '../../../shared/exportJob'
import { projectLanguages } from '../../../shared/model/language'
import {
  DEFAULT_IMAGE,
  DEFAULT_PDF,
  DEFAULT_TTS,
  sidesOf,
  type ExportJob,
  type ExportKind,
  type ExportProfiles,
  type ExportResult,
  type ExportSet,
  type ImageOptions,
  type PdfOptions,
  type TtsOptions
} from '../../../shared/export'
import type { FontCheck } from '../render/fonts'

// Esportazione delle carte, uguale dalla finestra Esporta e dal menu «Ripeti l'ultima
// esportazione»: il lavoro per ogni lingua, gli avvisi su immagini e font mancanti e le impronte
// delle carte esportate per il confronto con «l'ultima esportazione».

export type KindOptions =
  | { kind: 'images'; options: ImageOptions }
  | { kind: 'pdf'; options: PdfOptions }
  | { kind: 'tts'; options: TtsOptions }

/** Le opzioni di un tipo come le ricorda il progetto, completate con quelle predefinite */
export function savedOptions(kind: ExportKind, saved: ExportProfiles = {}): KindOptions {
  if (kind === 'images') return { kind, options: { ...DEFAULT_IMAGE, ...saved.images } }
  if (kind === 'pdf') return { kind, options: { ...DEFAULT_PDF, ...saved.pdf } }
  return { kind, options: { ...DEFAULT_TTS, ...saved.tts } }
}

/** I set scelti nelle opzioni: nessuno vuol dire tutti; un set rinominato o eliminato si ignora */
export function selectedSets(project: LoadedProject, sets: string[]): string[] {
  const names = project.sets.map((s) => s.name)
  const chosen = sets.filter((s) => names.includes(s))
  return chosen.length ? chosen : names
}

/** Le lingue da esportare: un codice, o * per tutte (le altre nelle loro sottocartelle) */
export function jobLanguages(project: LoadedProject, language: string): string[] {
  const languages = projectLanguages(project.file)
  return language === '*' ? languages : [language || languages[0] || ''].filter(Boolean)
}

/**
 * Il lavoro con le opzioni date, per una lingua: lo stesso per l'anteprima e per l'esportazione.
 * `changed` limita ogni set alle righe nuove o cambiate del confronto.
 */
export function buildJob(
  project: LoadedProject,
  { kind, options }: KindOptions,
  lang: string | null,
  changed?: Record<string, number[]> | null
): ExportJob {
  const languages = projectLanguages(project.file)
  // la lingua principale resta nella cartella di sempre
  const other = lang && lang !== languages[0] ? lang : undefined
  const all = buildSets(project, selectedSets(project, options.sets), other)
  // solo le carte cambiate dal confronto: i set senza carte cambiate non escono
  const sets = changed
    ? all
        .map((s) => {
          const rows = new Set(changed[s.name] ?? [])
          return { ...s, cards: s.cards.filter((c) => rows.has(c.n - 1)) }
        })
        .filter((s) => s.cards.length)
    : all
  const base = { project: project.file.name, sets, ...(other ? { language: other } : {}) }
  return kind === 'images'
    ? { ...base, kind, options }
    : kind === 'pdf'
      ? { ...base, kind, options }
      : { ...base, kind, options }
}

/** Esporta lingua per lingua, ognuna nella sua cartella, e aggiunge gli avvisi */
export async function runExport(
  project: LoadedProject,
  what: KindOptions,
  language: string,
  hasFont: FontCheck,
  changed?: Record<string, number[]> | null
): Promise<ExportResult> {
  const langs = jobLanguages(project, language)
  const jobs = langs.length
    ? langs.map((l) => buildJob(project, what, l, changed))
    : [buildJob(project, what, null, changed)]
  const sets = jobs[0].sets
  const r: ExportResult = { files: 0, folders: [], warnings: [], cancelled: false }
  for (const job of jobs) {
    const one = await window.api.runExport(job, {
      assets: project.assets,
      fonts: project.fonts,
      styles: project.file.styles ?? {},
      variables: project.file.variables ?? {}
    })
    r.files += one.files
    r.folders.push(...one.folders.filter((f) => !r.folders.includes(f)))
    r.paths = [...(r.paths ?? []), ...(one.paths ?? [])]
    r.warnings.push(...one.warnings)
    if (one.cancelled) {
      r.cancelled = true
      break
    }
  }
  const sides: Side[] =
    what.kind === 'images'
      ? sidesOf(what.options.sides)
      : what.kind === 'pdf' && what.options.duplex === 'none'
        ? sidesOf(what.options.sides)
        : ['front', 'back']
  const missing = missingImages(project, sets, sides)
  if (missing.length)
    r.warnings.push({ key: 'export.missingImages', params: { cards: missing.join('; ') } })
  const fonts = missingFonts(project, sets, hasFont)
  if (fonts.length)
    r.warnings.push({ key: 'export.missingFonts', params: { fonts: fonts.join(', ') } })
  if (!r.cancelled) await recordPrinted(project, sets).catch(() => undefined)
  return r
}

/**
 * Impronte delle carte esportate, per confrontare più avanti con "l'ultima esportazione": un set
 * esportato per intero si sostituisce, le carte di un'esportazione parziale si aggiungono
 */
async function recordPrinted(project: LoadedProject, sets: ExportJob['sets']): Promise<void> {
  const prints = cardFingerprints(project, project.assets)
  const old = await window.api.readPrinted()
  const out = { ...old?.sets }
  for (const s of sets) {
    const now = prints[s.name] ?? []
    out[s.name] =
      s.cards.length === now.length
        ? now
        : [...(out[s.name] ?? []), ...s.cards.map((c) => now[c.n - 1]).filter(Boolean)]
  }
  await window.api.savePrinted({ date: Date.now(), sets: out })
}

/**
 * Immagini che mancano in assets/ nei lati esportati, ognuna con le carte che la usano:
 * nell'esportazione restano i segnaposto
 */
function missingImages(project: LoadedProject, sets: ExportSet[], sides: Side[]): string[] {
  const byImage = new Map<string, string[]>()
  for (const set of sets)
    for (const c of set.cards) {
      const layers = walkLayers(sides.flatMap((side) => c.template[side]))
      const names = new Set(
        layers
          .filter(
            (l) =>
              l.type === 'image' &&
              l.visible &&
              l.missing !== 'hide' &&
              l.src.trim() !== '' &&
              !resolveAsset(l.src, project.assets).ok
          )
          .map((l) => (l.type === 'image' ? l.src.trim() : ''))
      )
      const card = `${set.name} ${c.n}${c.label ? ` (${c.label})` : ''}`
      for (const name of names) byImage.set(name, [...(byImage.get(name) ?? []), card])
    }
  return [...byImage].map(([name, cards]) => `"${name}": ${cards.join(', ')}`)
}

/** Font usati dalle carte esportate che non sono né nel progetto né installati */
function missingFonts(project: LoadedProject, sets: ExportSet[], hasFont: FontCheck): string[] {
  const out = new Set<string>()
  for (const set of sets)
    for (const c of set.cards)
      for (const l of walkLayers([...c.template.front, ...c.template.back])) {
        if (l.type !== 'text' || !l.visible) continue
        for (const f of [
          l.font,
          ...markupFonts(l.text, project.file.styles, project.file.variables)
        ])
          if (f.trim() && !isGenericFont(f) && !hasFont(f)) out.add(f)
      }
  return [...out].sort()
}
