import { fetchGoogleSheet } from './project/googleSheets'
import { matchTabs } from '../shared/model/googleSheets'
import { app } from 'electron'
import { readFile } from 'fs/promises'
import { join, resolve } from 'path'
import Papa from 'papaparse'
import { messageFromError } from '../shared/messages'
import type { LoadedProject, Sheet } from '../shared/project'
import {
  CliError,
  messageText,
  parseArgs,
  parseCardList,
  parseRowsFile,
  type Parsed
} from './cliParse'
import { bindRow, rowToCard } from '../shared/model/bind'
import { systemOfSet } from '../shared/model/system'
import { documentLocalization, documentProblems } from '../shared/model/document'
import { isGenericFont } from '../shared/model/fonts'
import { resolveAsset } from '../shared/model/assets'
import type { Layer, Template } from '../shared/model/template'
import {
  DEFAULT_IMAGE,
  DEFAULT_PDF,
  DEFAULT_TTS,
  type ExportJob,
  type ExportSet,
  type SidesChoice
} from '../shared/export'
import { buildSets } from '../shared/exportJob'
import { localizationOf, missingTranslations, projectLanguages } from '../shared/model/language'
import { runExport } from './export/run'
import { renderDocument } from './export/docWindow'
import { writeDocumentExport } from './project/docExport'
import { ExportWindow } from './export/window'
import { toCmyk } from './export/cmyk'
import { loadProject } from './project/load'
import { createProject } from './project/create'
import { saveData } from './project/save'
import { inspectDataFile } from './project/inspect'
import { checkDataFile } from '../shared/model/dataCheck'
import { saveTemplate } from './project/templates'
import { sharingSets } from '../shared/model/sharedSheets'
import { renameSet } from '../shared/model/renameSet'
import { renameTemplate } from '../shared/model/renameTemplate'
import { followInDocuments } from '../shared/model/docRefs'
import { saveDocument } from './project/notes'
import { isValidSheetName, setColumns } from '../shared/model/sheet'
import { columnStats, columnValues, rowAmounts } from '../shared/model/stats'
import { isValidTemplateName, walkLayers } from '../shared/model/normalize'
import { setProjectFolder } from './protocol'
import { systemFonts } from './library/systemFonts'
import { createBackup, pruneBackups } from './project/backup'
import { backupDirFor } from './project/backupPaths'
import {
  beginAgent,
  endAgent,
  readAgentLock,
  readAppState,
  UnsavedChangesError
} from './project/agentLock'

// Il comando stella: lo stesso programma dell'app, avviato con --cli, senza finestre. Serve a chi
// lavora su un progetto da terminale, in particolare a un'IA: legge, controlla, scrive i dati e
// disegna le carte. Vedi docs/cli.md. Testi in inglese, come gli identificatori dei file.

const HELP = `Usage: stella <command> [options]

Commands:
  info <project>                       Summary: sets, templates, variables, styles, assets
  check <project> [--set S] [--lang L] Problems on every card (missing images, fonts, markup,
                                       formulas); exit code 1 if there are any. Also lists texts
                                       not translated (warnings only): in L, or without --lang in
                                       every language besides the main one; --lang L also checks
                                       the cards drawn in L
  check-data <project>                 How the data file is read: for each sheet the sets that
                                       use it, the columns their templates read and the sheet
                                       lacks, and problems (title above the headings, empty rows,
                                       merged cells, errors, formulas without a result)
  template <project> <name>            Layers of a template, with their data source
  rows <project> <set> [--csv|--json]  Rows of a set's sheet (default: tab-separated)
  set-rows <project> <set> <file>      Replace a set's rows with a .csv or .json file
                                       (a backup of the project is made first)
  pull-sheets <project> [<link>]       Replace the data of the sets with the tabs of the same
                                       name in a Google sheet shared by link (default: the link
                                       saved in the project; a new link is saved; backup first)
  rename-set <project> <set> <name>    Rename a set, its sheet in the data file and the export
                                       profiles that pick it (backup first)
  rename-template <project> <template> <name>
                                       Rename a template and its file; sets, derived templates
                                       and the cards' template column follow (backup first)
  render <project> [--set S] [--card N[,M,A-B]] [--side front|back|both]
         [--dpi 150] [--out folder] [--lang L]
                                       Draw cards as PNG files (default folder: export/stella-render)
  export <project> --profile NAME [--lang L|all]
                                       Run a named export profile saved in the project
  new <name> <parent folder>           Create an empty project
  stats <project> <set> [--column C]  How many cards have each value of every column (or one),
                                       with sum, average, min and max of numeric columns
  notes <project> [<name>]             The project notes (notes/*.md), all or one: the user's
                                       reminders, also for you; write them as Markdown files there
  docs <project> [<name>]              The project documents (docs/*.md: rules, sell sheet,
                                       appendix), all or one, with their problems (cards or
                                       images not found); write them as Markdown files there
  export-doc <project> [<name>] [--format pdf|html|docx|md] [--out folder] [--lang L]
                                       Export the documents, all or one, as in the app: PDF
                                       (default), standalone HTML, Word (docx), or Markdown with
                                       the cards as PNG files (default folder: export/docs);
                                       --lang draws the cards in that language instead of the
                                       document's 'language' setting
  begin <project> [--note TEXT]        Start working: fails (exit code 3) if the Stella app has
                                       unsaved changes in the project, otherwise the app locks
                                       itself until 'end'
  end <project>                        Finish working: the app unlocks and reloads the project
  version                              The version of this stella command (also --version)
  help                                 This text

<project> is the project folder (the one with stella.json).
Add --json to info, check, check-data, template, stats, notes and docs for machine-readable output.`

const print = (s = ''): void => {
  process.stdout.write(s + '\n')
}

async function open(folder: string | undefined): Promise<LoadedProject> {
  if (!folder) throw new CliError('missing project folder')
  const project = await loadProject(resolve(folder))
  setProjectFolder(project.folder)
  return project
}

function findSet(project: LoadedProject, name: string | undefined): LoadedProject['sets'][number] {
  if (!name) throw new CliError('missing set name')
  const set = project.sets.find((s) => s.name === name)
  if (!set) {
    const names = project.sets.map((s) => s.name).join(', ')
    throw new CliError(`no set "${name}" (sets: ${names || 'none'})`)
  }
  return set
}

function cardCount(rows: string[][], headers: string[]): number {
  return rows.reduce((sum, r) => sum + rowToCard(headers, r).amount, 0)
}

function layerSummary(l: Layer): string {
  const src = l.source
  const from =
    src.kind === 'fixed'
      ? 'fixed'
      : src.kind === 'formula'
        ? `formula ${src.expr}`
        : `column ${src.column || l.name}`
  const main =
    l.type === 'text'
      ? ` text=${JSON.stringify(l.text)}`
      : l.type === 'image'
        ? ` src=${JSON.stringify(l.src)}`
        : l.type === 'shape'
          ? ` ${l.shape} fill=${l.fill ?? 'none'}`
          : l.type === 'grid'
            ? ` ${l.rows}×${l.columns} ${l.cell} fill=${l.fill ?? 'none'}`
            : l.type === 'value'
              ? ` value=${JSON.stringify(l.value)}`
              : ''
  const snap = l.snap
    ? ` · TTS snap point${l.snap.rotated ? ` rotated ${l.snap.angle ?? 'as layer'}` : ''}${l.snap.tags.trim() ? ` tags ${JSON.stringify(l.snap.tags)}` : ''}`
    : ''
  const box = l.type === 'value' ? '' : ` at ${l.x},${l.y} size ${l.w}×${l.h} mm`
  const tr = l.type === 'text' ? l.texts : l.type === 'value' ? l.values : undefined
  const langs = Object.entries(tr ?? {})
    .map(([k, v]) => ` ${k}=${JSON.stringify(v)}`)
    .join('')
  return `${l.name} (${l.type})${box}${main}${langs} · value from ${from}${snap}${l.visible ? '' : ' · hidden'}`
}

function templateOutline(t: Template): string[] {
  const out = [
    `${t.name}: ${t.width}×${t.height} mm, bleed ${t.bleed} mm, corner radius ${t.cornerRadius} mm${t.shape ? `, shape ${t.shape}` : ''}`
  ]
  if (t.extends)
    out.push(
      `extends ${t.extends}; changes: ${JSON.stringify({ ...t.changes, added: t.changes?.added?.map((a) => a.layer.name) })}`
    )
  const walk = (layers: Layer[], depth: number): void => {
    for (const l of layers) {
      out.push(`${'  '.repeat(depth)}- ${layerSummary(l)}`)
      if (l.type === 'group') walk(l.children, depth + 1)
    }
  }
  for (const side of ['front', 'back'] as const) {
    out.push(`${side} (top layer first):`)
    if (!t[side].length) out.push('  (empty)')
    walk(t[side], 1)
  }
  return out
}

async function info(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const f = project.file
  const data = {
    name: f.name,
    folder: project.folder,
    dataFile: f.dataFile,
    dataReadOnly: !!f.dataReadOnly,
    languages: projectLanguages(f),
    ...(f.names ? { names: f.names } : {}),
    sets: project.sets.map((s) => ({
      name: s.name,
      ...(s.names ? { names: s.names } : {}),
      template: s.template,
      sheet: s.sheet ?? s.name,
      rows: s.data?.rows.length ?? 0,
      cards: s.data ? cardCount(s.data.rows, s.data.headers) : 0,
      columns: s.data?.headers ?? []
    })),
    templates: project.templates.map((t) => ({
      name: t.name,
      ...(t.extends ? { extends: t.extends } : {}),
      width: t.width,
      height: t.height,
      front: walkLayers(t.front).map((l) => `${l.name}:${l.type}`),
      back: walkLayers(t.back).map((l) => `${l.name}:${l.type}`)
    })),
    variables: Object.entries(f.variables ?? {}).map(([name, v]) => ({ name, ...v })),
    styles: f.styles ?? {},
    exportProfiles: (f.export?.named ?? []).map((n) => `${n.name} (${n.kind})`),
    assets: project.assets,
    fonts: [...new Set(project.fonts.map((x) => x.family))],
    notes: (project.notes ?? []).map((n) => n.name),
    documents: (project.documents ?? []).map((n) => n.name),
    unusedSheets: project.unusedSheets,
    warnings: project.warnings.map(messageText)
  }
  if (p.flags.json) {
    print(JSON.stringify(data, null, 2))
    return 0
  }
  print(`Project: ${data.name}  (${data.folder})`)
  print(`Data file: ${data.dataFile}${data.dataReadOnly ? ' (read-only)' : ''}`)
  if (data.languages.length)
    print(`Languages: ${data.languages.join(', ')} (main: ${data.languages[0]})`)
  print('Sets:')
  for (const s of data.sets)
    print(
      `  ${s.name}: template ${s.template}, sheet ${s.sheet}, ${s.rows} rows, ${s.cards} cards; columns: ${s.columns.join(', ') || '(none)'}`
    )
  print('Templates:')
  for (const t of data.templates)
    print(
      `  ${t.name}${t.extends ? ` (extends ${t.extends})` : ''}: ${t.width}×${t.height} mm; front: ${t.front.join(', ') || '(empty)'}; back: ${t.back.join(', ') || '(empty)'}`
    )
  print('Variables:')
  for (const v of data.variables) {
    const { name, ...rest } = v
    print(`  {${name}} ${JSON.stringify(rest)}`)
  }
  print('Styles:')
  for (const [k, v] of Object.entries(data.styles)) print(`  .${k}: ${v}`)
  if (data.exportProfiles.length) print(`Export profiles: ${data.exportProfiles.join(', ')}`)
  print(
    `Assets: ${data.assets.length} files (${project.assets.filter((a) => /\.(svg|png|jpe?g|webp)$/i.test(a)).length} images); fonts: ${data.fonts.join(', ') || 'none'}`
  )
  if (data.notes.length) print(`Notes (notes/*.md): ${data.notes.join(', ')}`)
  if (data.documents.length) print(`Documents (docs/*.md): ${data.documents.join(', ')}`)
  if (data.unusedSheets.length) print(`Sheets not linked to a set: ${data.unusedSheets.join(', ')}`)
  for (const w of data.warnings) print(`Warning: ${w}`)
  return 0
}

async function fontCheck(project: LoadedProject): Promise<(family: string) => boolean> {
  const own = new Set(['nunito', ...project.fonts.map((f) => f.family.toLowerCase())])
  const installed = new Set(
    (await systemFonts().catch(() => [])).map((f) => f.family.toLowerCase())
  )
  return (family) => {
    const f = family.trim().toLowerCase()
    return !f || isGenericFont(f) || own.has(f) || installed.has(f)
  }
}

async function check(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const only = typeof p.flags.set === 'string' ? p.flags.set : null
  if (only) findSet(project, only)
  const ctx = {
    assets: project.assets,
    styles: project.file.styles,
    variables: project.file.variables,
    hasFont: await fontCheck(project)
  }
  // --lang L: le carte si controllano in quella lingua; le traduzioni mancanti si cercano in L,
  // o senza --lang in tutte le lingue oltre la principale
  const langs = projectLanguages(project.file)
  const [language] = cliLanguages(project, p)
  const localization = localizationOf(project.file, project.sets, language)
  const report: { set: string; card: number; label: string; problems: string[] }[] = []
  const general = project.warnings.map(messageText)
  for (const s of project.sets) {
    if (only && s.name !== only) continue
    const tpl = project.templates.find((t) => t.name === s.template)
    if (!tpl || !s.data) continue
    const info = systemOfSet(project.file.name, s)
    s.data.rows.forEach((row, i) => {
      const bound = bindRow(s.data!.headers, row, tpl, project.templates, {
        ...ctx,
        system: { ...info, number: i + 1 },
        localization
      })
      const problems = bound.problems.map(messageText)
      // le immagini dei livelli: l'app le segnala solo all'esportazione
      for (const side of ['front', 'back'] as const)
        for (const l of walkLayers(bound.template[side]))
          if (l.type === 'image' && l.visible && l.missing !== 'hide' && l.src.trim()) {
            const r = resolveAsset(l.src, project.assets)
            if (!r.ok)
              problems.push(
                `Layer ${l.name} (${side}): image "${l.src.trim()}" ${r.reason === 'ambiguous' ? `is ambiguous (${r.candidates.join(', ')})` : 'not found in assets'}`
              )
          }
      if (problems.length)
        report.push({
          set: s.name,
          card: i + 1,
          label: bound.label,
          problems: [...new Set(problems)]
        })
    })
  }
  // i documenti richiamano le carte di tutti i set: si controllano solo senza --set
  const documents = only ? [] : documentReport(project)
  // traduzioni mancanti: solo avvisi, non cambiano il codice di uscita
  const translations = (
    p.flags.lang === undefined ? langs.slice(1) : language ? [language] : []
  ).flatMap((l) =>
    missingTranslations(
      {
        templates: project.templates,
        variables: project.file.variables,
        sets: only ? project.sets.filter((s) => s.name === only) : project.sets
      },
      l
    ).map((m) => ({ language: l, ...m }))
  )
  const total = general.length + report.length + documents.length
  if (p.flags.json)
    print(
      JSON.stringify(
        { warnings: general, cards: report, documents, missingTranslations: translations },
        null,
        2
      )
    )
  else {
    for (const w of general) print(`Warning: ${w}`)
    for (const r of report)
      for (const pr of r.problems) print(`${r.set} #${r.card} (${r.label}): ${pr}`)
    for (const d of documents) print(`docs/${d.document}.md line ${d.line}: ${d.problem}`)
    for (const m of translations)
      print(`Missing translation (${m.language}): ${m.where}: "${short(m.text)}"`)
    print(
      total
        ? `${report.length} cards and ${documents.length} document lines with problems`
        : 'No problems found'
    )
    if (translations.length) print(`${translations.length} texts not translated (warnings only)`)
  }
  return total ? 1 : 0
}

/** Un testo lungo accorciato per una riga di avviso */
function short(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > 60 ? one.slice(0, 57) + '...' : one
}

async function template(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const name = p.positional[1]
  const t = project.templates.find((x) => x.name === name)
  if (!t) {
    const names = project.templates.map((x) => x.name).join(', ')
    throw new CliError(`no template "${name ?? ''}" (templates: ${names || 'none'})`)
  }
  if (p.flags.json) print(JSON.stringify(t, null, 2))
  else templateOutline(t).forEach((l) => print(l))
  return 0
}

async function rows(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const set = findSet(project, p.positional[1])
  const sheet = set.data ?? { name: set.sheet ?? set.name, headers: [], rows: [] }
  if (p.flags.json)
    print(
      JSON.stringify(
        sheet.rows.map((r) => Object.fromEntries(sheet.headers.map((h, i) => [h, r[i] ?? '']))),
        null,
        2
      )
    )
  else if (p.flags.csv) print(Papa.unparse([sheet.headers, ...sheet.rows]))
  else {
    print(['#', ...sheet.headers].join('\t'))
    sheet.rows.forEach((r, i) =>
      print([i + 1, ...r.map((c) => c.replace(/\n/g, '\\n'))].join('\t'))
    )
  }
  return 0
}

const UNSAVED =
  'the Stella app has unsaved changes in this project: ask the user to save (or reload) in the app, then try again'
const NOT_BEGUN =
  'the Stella app is open on this project: run "begin" first, so that the app locks itself and reloads the project at "end"'

/**
 * Prima di scrivere nel progetto: con modifiche non salvate nell'app si rifiuta; con l'app
 * aperta serve `begin`, altrimenti il prossimo salvataggio dell'app cancellerebbe le modifiche
 */
async function checkWritable(folder: string): Promise<void> {
  const app = await readAppState(folder)
  if (app?.dirty) throw new CliError(UNSAVED)
  if (app && !(await readAgentLock(folder))) throw new CliError(NOT_BEGUN)
}

/** Con il file dati in sola lettura (dataReadOnly in stella.json) i dati si cambiano solo fuori */
function checkDataWritable(project: LoadedProject): void {
  if (project.file.dataReadOnly)
    throw new CliError(
      `the data file ${project.file.dataFile} is read-only (dataReadOnly in stella.json): change the data in the file itself`
    )
}

async function setRows(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  await checkWritable(project.folder)
  checkDataWritable(project)
  const set = findSet(project, p.positional[1])
  const file = p.positional[2]
  if (!file) throw new CliError('missing .csv or .json file')
  const { headers, rows: data } = parseRowsFile(
    await readFile(resolve(file), 'utf8'),
    file.toLowerCase().endsWith('.json')
  )
  if (!headers.length) throw new CliError('the file has no columns')
  const done = await backup(project)
  await saveData(project.folder, {
    sheets: [{ name: set.sheet ?? set.name, headers, rows: data }]
  })
  print(`${set.name}: wrote ${data.length} rows, columns ${headers.join(', ')}`)
  done()
  return 0
}

/**
 * Copia del progetto prima di cambiarlo, nella stessa cartella dei backup dell'app e con le
 * sue regole di pulizia (conta come backup automatico); la funzione restituita dice dove è finita
 */
async function backup(project: LoadedProject): Promise<() => void> {
  const made = await (async () => {
    const { dir, settings } = await backupDirFor(project.folder, project.file.name)
    const item = await createBackup(project.folder, project.file.name, dir, true)
    await pruneBackups(dir, settings.keep)
    return item
  })().catch(() => null)
  return () => {
    if (made) print(`Backup of the previous state: ${made.file}`)
  }
}

async function pullSheets(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  await checkWritable(project.folder)
  checkDataWritable(project)
  const link = p.positional[1]?.trim() || project.file.googleSheet
  if (!link) throw new CliError('no Google Sheets link: pass one, it is then saved in the project')
  const tabs = await fetchGoogleSheet(link)
  const targets = matchTabs(
    tabs.map((t) => t.name),
    project.sets
  )
  const sheets: Sheet[] = []
  for (const tab of tabs) {
    const set = project.sets.find((s) => s.name === targets[tab.name])
    if (!set) {
      print(`${tab.name}: no set with this name, skipped`)
      continue
    }
    const name = set.data?.name ?? set.sheet ?? set.name
    // due set con lo stesso foglio: vale la prima scheda
    if (sheets.some((x) => x.name === name)) {
      print(`${tab.name}: sheet "${name}" already filled by another tab, skipped`)
      continue
    }
    sheets.push({ ...tab, name })
    print(`${tab.name} → ${set.name}: ${tab.rows.length} rows, columns ${tab.headers.join(', ')}`)
  }
  const file =
    link === project.file.googleSheet ? undefined : { ...project.file, googleSheet: link }
  if (!sheets.length && !file) return 0
  const done = await backup(project)
  await saveData(project.folder, { file, sheets })
  done()
  return 0
}

async function renameSetCommand(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  await checkWritable(project.folder)
  const set = findSet(project, p.positional[1])
  const to = p.positional[2]?.trim()
  if (!to) throw new CliError('missing new name')
  if (to === set.name) throw new CliError(`the set is already called "${to}"`)
  if (!isValidSheetName(to))
    throw new CliError('invalid name: at most 31 characters, none of : \\ / ? * [ ]')
  const taken = [
    ...project.sets.filter((s) => s !== set).flatMap((s) => [s.name, s.data?.name ?? s.name]),
    ...project.unusedSheets
  ]
  if (taken.includes(to)) throw new CliError(`a set or sheet called "${to}" already exists`)
  const index = project.sets.indexOf(set)
  const csv = project.file.dataFile.toLowerCase().endsWith('.csv')
  // un foglio usato anche da altri set tiene il suo nome
  const r = renameSet(
    project.file,
    project.sets,
    index,
    to,
    csv,
    sharingSets(project.sets, index).length > 0 || !!project.file.dataReadOnly
  )
  const done = await backup(project)
  const sheet = r.sets[index].data
  await saveData(project.folder, { file: r.file, sheets: sheet?.origin ? [sheet] : [] })
  // le carte richiamate nei documenti seguono il nome nuovo
  const docs = followInDocuments(
    project.documents ?? [],
    { sets: project.sets, templates: project.templates },
    { sets: r.sets, templates: project.templates }
  )
  for (const d of docs.changed) await saveDocument(project.folder, d.name, d.text)
  print(
    `Renamed set "${set.name}" to "${to}"` +
      (sheet?.origin ? ', with its sheet' : `; its sheet is still "${r.file.sets[index].sheet}"`) +
      (docs.count
        ? `; ${docs.count} reference(s) updated in ${docs.changed.map((d) => d.name).join(', ')}`
        : '')
  )
  done()
  return 0
}

async function renameTemplateCommand(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  await checkWritable(project.folder)
  const from = p.positional[1]
  const tpl = project.templates.find((t) => t.name === from)
  if (!tpl) {
    const names = project.templates.map((t) => t.name).join(', ')
    throw new CliError(`no template "${from ?? ''}" (templates: ${names || 'none'})`)
  }
  const to = p.positional[2]?.trim()
  if (!to) throw new CliError('missing new name')
  if (to === tpl.name) throw new CliError(`the template is already called "${to}"`)
  if (!isValidTemplateName(to)) throw new CliError('invalid name: no / \\ : * ? " < > |')
  const taken = project.templates
    .filter((t) => t !== tpl)
    .flatMap((t) => [t.name, t.file ?? t.name])
  if (taken.includes(to)) throw new CliError(`a template called "${to}" already exists`)
  const r = renameTemplate(project, tpl.name, to)
  const done = await backup(project)
  // prima i template, così i set nuovi trovano già il file con il nome nuovo
  const changed = r.templates.filter((t, i) => t !== project.templates[i])
  for (const t of changed) await saveTemplate(project.folder, t)
  const sheets = r.sets.flatMap((s, i) =>
    s.data && s.data !== project.sets[i].data ? [s.data] : []
  )
  await saveData(project.folder, { file: r.file, sheets })
  const derived = changed.length - 1
  print(
    `Renamed template "${tpl.name}" to "${to}"` +
      (derived ? `; ${derived} derived template(s) updated` : '') +
      (sheets.length ? `; template column updated in ${sheets.map((s) => s.name).join(', ')}` : '')
  )
  done()
  return 0
}

function selectCards(sets: ExportSet[], spec: string | true | undefined): ExportSet[] {
  if (typeof spec !== 'string') return sets
  const wanted = new Set(parseCardList(spec))
  return sets.map((s) => ({ ...s, cards: s.cards.filter((c) => wanted.has(c.n)) }))
}

async function exportJob(project: LoadedProject, job: ExportJob): Promise<number> {
  const r = await runExport(job, {
    openWindow: (context) => ExportWindow.open(context),
    toCmyk,
    projectFolder: project.folder,
    platform: process.platform,
    home: app.getPath('home'),
    documents: app.getPath('documents'),
    context: {
      assets: project.assets,
      fonts: project.fonts,
      styles: project.file.styles ?? {},
      variables: project.file.variables ?? {}
    },
    onProgress: () => undefined,
    isCancelled: () => false
  })
  print(`${r.files} files in ${r.folders.join(', ') || '(nothing exported)'}`)
  for (const w of r.warnings) print(`Warning: ${messageText(w)}`)
  return 0
}

/**
 * Lingue scelte con --lang: un codice del progetto, o all per tutte. Senza --lang la principale;
 * null vale la principale, che resta nella cartella di sempre
 */
function cliLanguages(project: LoadedProject, p: Parsed, all = false): (string | undefined)[] {
  const flag = p.flags.lang
  if (flag === undefined) return [undefined]
  const langs = projectLanguages(project.file)
  if (!langs.length)
    throw new CliError('--lang: the project has only one language (languages in stella.json)')
  if (all && flag === 'all') return langs.map((l, i) => (i === 0 ? undefined : l))
  if (typeof flag !== 'string' || !langs.includes(flag))
    throw new CliError(`--lang: one of ${langs.join(', ')}${all ? ' or all' : ''}`)
  return [flag === langs[0] ? undefined : flag]
}

async function render(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const setName = typeof p.flags.set === 'string' ? p.flags.set : null
  if (setName) findSet(project, setName)
  const [language] = cliLanguages(project, p)
  const sets = selectCards(buildSets(project, setName ? [setName] : [], language), p.flags.card)
  if (!sets.some((s) => s.cards.length)) throw new CliError('no cards to draw')
  const side = (typeof p.flags.side === 'string' ? p.flags.side : 'front') as SidesChoice
  if (!['front', 'back', 'both'].includes(side)) throw new CliError('--side: front, back or both')
  const dpi = Number(p.flags.dpi ?? 150)
  if (!(dpi >= 30 && dpi <= 1200)) throw new CliError('--dpi: a number between 30 and 1200')
  const out =
    typeof p.flags.out === 'string'
      ? resolve(p.flags.out)
      : join(project.folder, 'export', 'stella-render')
  return exportJob(project, {
    kind: 'images',
    project: project.file.name,
    sets,
    ...(language ? { language } : {}),
    options: {
      ...DEFAULT_IMAGE,
      folder: out,
      dpi,
      sides: side,
      pattern: side === 'both' ? '%set/%n_%side' : '%set/%n'
    }
  })
}

async function exportProfile(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const name = p.flags.profile
  const named = project.file.export?.named ?? []
  const profile = named.find((n) => n.name === name)
  if (!profile)
    throw new CliError(
      `no export profile "${typeof name === 'string' ? name : ''}" (profiles: ${named.map((n) => n.name).join(', ') || 'none'})`
    )
  for (const language of cliLanguages(project, p, true)) {
    const sets = buildSets(project, profile.options.sets ?? [], language)
    const base = { project: project.file.name, sets, ...(language ? { language } : {}) }
    const job: ExportJob =
      profile.kind === 'images'
        ? { ...base, kind: 'images', options: { ...DEFAULT_IMAGE, ...profile.options } }
        : profile.kind === 'pdf'
          ? { ...base, kind: 'pdf', options: { ...DEFAULT_PDF, ...profile.options } }
          : {
              ...base,
              kind: 'tts',
              options: { ...DEFAULT_TTS, nickname: project.file.name, ...profile.options }
            }
    const code = await exportJob(project, job)
    if (code) return code
  }
  return 0
}

async function create(p: Parsed): Promise<number> {
  const [name, parent] = p.positional
  if (!name || !parent) throw new CliError('usage: stella new <name> <parent folder>')
  const folder = await createProject(name, resolve(parent))
  print(`Created ${folder}`)
  return 0
}

async function begin(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const note = typeof p.flags.note === 'string' ? p.flags.note : undefined
  try {
    await beginAgent(project.folder, note)
  } catch (e) {
    if (!(e instanceof UnsavedChangesError)) throw e
    process.stderr.write(`stella: ${UNSAVED}\n`)
    return 3
  }
  const app = await readAppState(project.folder)
  print(
    app
      ? 'The Stella app is now locked on this project. Run "end" when you have finished.'
      : 'Ready. Run "end" when you have finished.'
  )
  return 0
}

/** Controlla file dati: il file dati com'è scritto e cosa ne fanno i set (come nell'app) */
async function checkData(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const check = checkDataFile(
    project,
    await inspectDataFile(join(project.folder, project.file.dataFile))
  )
  if (p.flags.json) {
    print(JSON.stringify(check, null, 2))
    return 0
  }
  print(`Data file: ${project.file.dataFile}${project.file.dataReadOnly ? ' (read-only)' : ''}`)
  const losses = project.dataFileLosses ?? []
  if (losses.length)
    print(
      messageText({
        key: 'check.losses',
        params: { what: losses.map((x) => messageText({ key: `dataLoss.${x}` })).join(', ') }
      })
    )
  for (const m of check.missingSheets) print(messageText({ key: 'check.missingSheet', params: m }))
  for (const { sheet, sets, notes } of check.sheets) {
    const used = sets.length
      ? `used by ${sets.map((s) => s.name).join(', ')}`
      : 'not linked to a set'
    print(`\n=== ${sheet.name}: ${used}; ${sheet.dataRows} rows ===`)
    for (const s of sets.filter((x) => x.missing.length))
      print(
        `- ${messageText({ key: 'check.missingColumns', params: { set: s.name, template: s.template, columns: s.missing.join(', ') } })}`
      )
    for (const n of notes)
      print(`- ${n.level === 'warning' ? '[!] ' : ''}${messageText(n.message)}`)
    if (!notes.length && !sets.some((x) => x.missing.length)) print('- No problems found.')
  }
  return 0
}

/** Statistiche delle colonne di un set: carte per valore, somma e media dei numeri */
async function stats(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const set = findSet(project, p.positional[1])
  const sheet = set.data ?? { name: set.sheet ?? set.name, headers: [], rows: [] }
  const tpl = project.templates.find((t) => t.name === set.template) ?? null
  const all = setColumns(sheet, tpl)
    .map((c) => c.header)
    .filter((h) => h && h !== 'amount' && !h.includes('.'))
  const only = typeof p.flags.column === 'string' ? p.flags.column : null
  if (only && !all.includes(only))
    throw new CliError(`no column "${only}" (columns: ${all.join(', ') || 'none'})`)
  const rows = sheet.rows.map((_, i) => i)
  const amounts = rowAmounts(sheet, rows)
  const list = (only ? [only] : all).map((c) =>
    columnStats(
      c,
      columnValues(sheet, c, rows, tpl, project.templates, project.file.variables),
      amounts
    )
  )
  if (p.flags.json) {
    print(JSON.stringify(list, null, 2))
    return 0
  }
  for (const s of list) {
    print(`=== ${s.column}: ${s.groups.length} values, ${s.cards} cards ===`)
    if (s.numeric)
      print(
        `sum ${s.numeric.sum}  average ${+s.numeric.mean.toFixed(2)}  min ${s.numeric.min}  max ${s.numeric.max}`
      )
    for (const g of s.groups) print(`${g.cards}\t${g.value === '' ? '(empty)' : g.value}`)
    print()
  }
  return 0
}

/** Problemi dei documenti (docs/*.md), con la riga in cui si trovano */
function documentReport(
  project: LoadedProject,
  only?: string
): { document: string; line: number; problem: string }[] {
  const ctx = {
    project: project.file.name,
    sets: project.sets,
    assets: project.assets,
    styles: project.file.styles,
    variables: project.file.variables,
    templates: project.templates,
    languages: projectLanguages(project.file)
  }
  return (project.documents ?? [])
    .filter((d) => !only || d.name === only)
    .flatMap((d) =>
      documentProblems(d.text, ctx).map((pr) => ({
        document: d.name,
        line: d.text.slice(0, pr.from).split('\n').length,
        problem: messageText(pr.message)
      }))
    )
}

/** Documenti del progetto (docs/*.md), tutti o uno, con i loro problemi */
async function docs(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const name = p.positional[1]
  const list = (project.documents ?? []).filter((n) => !name || n.name === name)
  if (name && !list.length) throw new CliError(`no document named "${name}"`)
  const problems = documentReport(project, name)
  if (p.flags.json) {
    print(
      JSON.stringify(
        list.map((d) => ({
          ...d,
          problems: problems
            .filter((x) => x.document === d.name)
            .map(({ line, problem }) => ({ line, problem }))
        })),
        null,
        2
      )
    )
    return 0
  }
  if (!list.length) print('No documents. Write them as Markdown files in docs/ (docs/<name>.md).')
  for (const d of list) {
    print(`=== ${d.name} (docs/${d.name}.md) ===`)
    print(d.text.trimEnd())
    print()
    for (const x of problems.filter((x) => x.document === d.name))
      print(`Problem, line ${x.line}: ${x.problem}`)
  }
  return 0
}

/** Esporta i documenti, tutti o uno, come il tasto Esporta documento dell'app */
async function exportDoc(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const name = p.positional[1]
  const list = (project.documents ?? []).filter((d) => !name || d.name === name)
  if (name && !list.length) throw new CliError(`no document named "${name}"`)
  if (!list.length) throw new CliError('no documents in docs/')
  const kind = typeof p.flags.format === 'string' ? p.flags.format : 'pdf'
  if (kind !== 'pdf' && kind !== 'html' && kind !== 'md' && kind !== 'docx')
    throw new CliError('--format: pdf, html, docx or md')
  const out = typeof p.flags.out === 'string' ? resolve(p.flags.out) : undefined
  // --lang vale al posto della lingua scritta nel documento (anche la principale)
  cliLanguages(project, p)
  const lang = typeof p.flags.lang === 'string' ? p.flags.lang : undefined
  const problems = documentReport(project, name)
  for (const d of list) {
    const localization = documentLocalization(project.file, project.sets, d.text, lang)
    const files = await renderDocument({
      project: localization?.project ?? project.file.name,
      ...(localization ? { localization } : {}),
      name: d.name,
      text: d.text,
      kind,
      sets: project.sets,
      templates: project.templates,
      assets: project.assets,
      fonts: project.fonts,
      styles: project.file.styles ?? {},
      variables: project.file.variables ?? {}
    })
    const dir = await writeDocumentExport(project.folder, files, out)
    print(`${d.name}: ${files.length} files in ${dir}`)
    for (const x of problems.filter((x) => x.document === d.name))
      print(`Warning, line ${x.line}: ${x.problem}`)
  }
  return 0
}

/** Note del progetto (notes/*.md), tutte o una sola */
async function notes(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  const name = p.positional[1]
  const list = (project.notes ?? []).filter((n) => !name || n.name === name)
  if (name && !list.length) throw new CliError(`no note named "${name}"`)
  if (p.flags.json) {
    print(JSON.stringify(list, null, 2))
    return 0
  }
  if (!list.length) print('No notes. Write them as Markdown files in notes/ (notes/<name>.md).')
  for (const n of list) {
    print(`=== ${n.name} (notes/${n.name}.md) ===`)
    print(n.text.trimEnd())
    print()
  }
  return 0
}

async function end(p: Parsed): Promise<number> {
  const project = await open(p.positional[0])
  await endAgent(project.folder)
  print('Done: the Stella app, if open, reloads the project.')
  return 0
}

const COMMANDS: Record<string, (p: Parsed) => Promise<number>> = {
  info,
  check,
  template,
  rows,
  'set-rows': setRows,
  'pull-sheets': pullSheets,
  'rename-set': renameSetCommand,
  'rename-template': renameTemplateCommand,
  render,
  export: exportProfile,
  new: create,
  notes,
  docs,
  'export-doc': exportDoc,
  stats,
  'check-data': checkData,
  begin,
  end
}

/** Esegue il comando e restituisce il codice di uscita */
export async function runCli(args: string[]): Promise<number> {
  const [command, ...rest] = args
  if (!command || command === 'help' || command === '--help') {
    print(HELP)
    return command ? 0 : 2
  }
  if (command === 'version' || command === '--version') {
    print(app.getVersion())
    return 0
  }
  const fn = COMMANDS[command]
  if (!fn) {
    process.stderr.write(`stella: unknown command "${command}"\n\n${HELP}\n`)
    return 2
  }
  try {
    return await fn(parseArgs(rest))
  } catch (e) {
    const m = messageFromError(e)
    const text = m.key === 'error.generic' ? String(m.params?.text ?? '') : messageText(m)
    process.stderr.write(`stella: ${text}\n`)
    return 2
  }
}
