import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { exists } from '../fs'
import { basename, dirname, join } from 'path'
import { MessageError, msg, type Message } from '../../shared/messages'
import { normalizeTemplate } from '../../shared/model/normalize'
import { convertNandeck, type ScriptReport } from '../../shared/import/nandeck/convert'
import { NandeckScript, type NandeckEnv } from '../../shared/import/nandeck/interp'
import { decodeScript, scriptLines, statement } from '../../shared/import/nandeck/script'
import { FORMAT_VERSION, PROJECT_FILE, type ProjectFile, type Sheet } from '../../shared/project'
import type { NandeckImportOptions, NandeckImportResult, NandeckScriptInfo } from '../../shared/api'
import { NANDECK_SKILL_PAGE } from '../../shared/skill'
import { en } from '../../renderer/src/i18n/en'
import { it } from '../../renderer/src/i18n/it'
import { PROJECT_FOLDERS } from '../project/create'
import { readSpreadsheet, writeSpreadsheet } from '../project/spreadsheet'
import { saveTemplate } from '../project/templates'

// Importazione di un gioco nanDECK (una cartella con uno o più script .nde) in un progetto nuovo:
// la cartella di origine si legge soltanto. Gli script si interpretano e convertono in
// src/shared/import/nandeck; qui si leggono i file, si copiano le immagini e si scrive la nota
// "Import nanDECK" con ciò che non è stato convertito, che la skill nanDECK usa per finire il
// lavoro.

/** Profondità massima delle sottocartelle lette */
const MAX_DEPTH = 4
/** File letti al massimo, per non perdersi in una cartella enorme */
const MAX_FILES = 20000
const TEXT_EXT = /\.(nde|txt|inc|csv)$/i
const DATA_EXT = /\.(xlsx|ods|csv)$/i
/** Script che di solito sono copie o versioni vecchie */
const COPY_NAME = /(copia|copy|\(\d+\)|\bold\b|_old\b|^old|backup|\bbak\b|vecchi)/i
/** Script che di solito servono solo a stampare carte già fatte */
const PRINT_NAME = /(stampa|print|pnp|\bpdf\b)/i

/** Nome della nota scritta nel progetto */
export const NANDECK_NOTE = 'Import nanDECK'

/** File della cartella, relativi con /, saltando i nascosti */
async function listFiles(root: string): Promise<string[]> {
  const out: string[] = []
  const walk = async (dir: string, rel: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || out.length > MAX_FILES) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) await walk(join(dir, e.name), r, depth + 1)
      else out.push(r)
    }
  }
  await walk(root, '', 0)
  return out.sort((a, b) => a.localeCompare(b))
}

/** File INCLUDE di uno script, relativi alla cartella del gioco */
function includes(text: string): string[] {
  const out: string[] = []
  for (const l of scriptLines(text, '')) {
    const st = statement(l.text)
    if (st.kind === 'command' && st.name === 'INCLUDE')
      out.push(st.value.replace(/^"|"$/g, '').replace(/\\/g, '/').toLowerCase())
  }
  return out
}

/**
 * Script .nde della cartella con la scelta proposta: le copie, le versioni vecchie, gli script di
 * stampa e quelli usati solo come INCLUDE da altri script non sono scelti.
 */
export async function scanNandeck(source: string): Promise<NandeckScriptInfo[]> {
  const files = await listFiles(source)
  const scripts = files.filter((f) => /\.nde$/i.test(f))
  if (!scripts.length) throw new MessageError(msg('nandeck.noScripts', { folder: source }))
  const included = new Set<string>()
  const texts = new Map<string, string>()
  for (const s of scripts) {
    const text = decodeScript(await readFile(join(source, ...s.split('/'))))
    texts.set(s, text)
    for (const inc of includes(text)) included.add(inc)
  }
  return scripts.map((path) => {
    const name = basename(path)
    const text = texts.get(path) ?? ''
    const kind: NandeckScriptInfo['kind'] = included.has(path.toLowerCase())
      ? 'include'
      : COPY_NAME.test(name)
        ? 'copy'
        : PRINT_NAME.test(name)
          ? 'print'
          : 'deck'
    return {
      path,
      kind,
      selected: kind === 'deck',
      lines: text.split(/\r\n?|\n/).length
    }
  })
}

/** Nome proposto per la cartella del progetto convertito: accanto all'originale */
export function defaultNandeckTarget(source: string): string {
  return join(dirname(source), `${basename(source)} Stella`)
}

/** Fogli dei file di dati della cartella, letti una volta sola, per i LINK degli script */
async function readSheets(source: string, files: string[]): Promise<Map<string, Sheet[]>> {
  const out = new Map<string, Sheet[]>()
  for (const f of files.filter((x) => DATA_EXT.test(x))) {
    try {
      out.set(f.toLowerCase(), await readSpreadsheet(join(source, ...f.split('/'))))
    } catch {
      // un file che non si legge: il LINK che lo usa finisce tra le righe non convertite
    }
  }
  return out
}

/** Testi della cartella (script, INCLUDE, sequenze): l'interprete li legge in modo sincrono */
async function readTexts(source: string, files: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const f of files.filter((x) => TEXT_EXT.test(x))) {
    const path = join(source, ...f.split('/'))
    if ((await stat(path)).size > 4 * 1024 * 1024) continue
    out.set(f.toLowerCase(), decodeScript(await readFile(path)))
  }
  return out
}

export async function importNandeck(opts: NandeckImportOptions): Promise<NandeckImportResult> {
  const { source, target } = opts
  if (!opts.scripts.length) throw new MessageError(msg('nandeck.noneSelected'))
  if (await exists(target)) {
    const entries = (await readdir(target)).filter((n) => !n.startsWith('.'))
    if (entries.length) throw new MessageError(msg('ttc.targetNotEmpty', { folder: target }))
  }
  const files = await listFiles(source)
  const lower = new Map(files.map((f) => [f.toLowerCase(), f]))
  const texts = await readTexts(source, files)
  const sheets = await readSheets(source, files)
  const env: NandeckEnv = {
    files,
    readText: (p) => texts.get(p.toLowerCase()) ?? null,
    sheet: (file, name) => {
      const list = sheets.get(file.toLowerCase())
      if (!list) return null
      return name
        ? (list.find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? null)
        : list[0]
    }
  }

  const inputs = opts.scripts.map((path) => {
    const script = new NandeckScript(env, path)
    script.run(texts.get(path.toLowerCase()) ?? '')
    return { name: basename(path).replace(/\.nde$/i, ''), script }
  })
  const project = convertNandeck(inputs)

  // le immagini si copiano con le stesse cartelle dello script; Windows non distingue maiuscole
  // e minuscole, quindi il file si cerca senza badarci e si copia con il nome scritto nello script
  await mkdir(target, { recursive: true })
  for (const sub of PROJECT_FOLDERS) await mkdir(join(target, sub), { recursive: true })
  const missingImages: string[] = []
  let copied = 0
  for (const img of project.images) {
    const found = lower.get(img.toLowerCase())
    if (!found || /^([a-z]:)?\//i.test(img)) {
      missingImages.push(img)
      continue
    }
    const to = join(target, 'assets', ...img.split('/'))
    await mkdir(dirname(to), { recursive: true })
    await copyFile(join(source, ...found.split('/')), to)
    copied++
  }

  for (const raw of project.templates) await saveTemplate(target, normalizeTemplate(raw))
  const file: ProjectFile = {
    formatVersion: FORMAT_VERSION,
    name: opts.name?.trim() || basename(source),
    dataFile: 'data/cards.xlsx',
    sets: project.sets,
    ...(Object.keys(project.variables).length ? { variables: project.variables } : {})
  }
  await writeSpreadsheet(join(target, file.dataFile), project.sheets)
  await writeFile(join(target, PROJECT_FILE), JSON.stringify(file, null, 2) + '\n', 'utf8')

  const result: NandeckImportResult = {
    folder: target,
    templates: project.templates.length,
    sets: project.sets.length,
    cards: project.sheets.reduce((n, s) => n + s.rows.length, 0),
    images: copied,
    missingImages,
    // stesso carattere scritto con maiuscole diverse negli script: uno solo
    fonts: [...new Map(project.fonts.map((f) => [f.toLowerCase(), f])).values()]
      .filter((f) => f !== 'Nunito')
      .sort(),
    skipped: project.reports.reduce((n, r) => n + r.skipped.length, 0),
    notes: project.reports.flatMap((r) => r.notes),
    note: NANDECK_NOTE
  }
  await writeFile(
    join(target, 'notes', `${NANDECK_NOTE}.md`),
    importNote(project.reports, result, source, opts.language === 'it' ? 'it' : 'en'),
    'utf8'
  )
  return result
}

// ——— nota "Import nanDECK" ———

type Dict = Record<string, string>

function translate(dict: Dict, m: Message): string {
  const text = dict[m.key] ?? (en as Dict)[m.key] ?? m.key
  return text.replace(/\{(\w+)\}/g, (s, name: string) => {
    const p = m.params?.[name]
    return p === undefined ? s : typeof p === 'object' ? translate(dict, p) : String(p)
  })
}

/** Una cella di tabella Markdown: niente | né a capo */
const cell = (s: string): string =>
  s
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
    .trim()

/**
 * Testo della nota: riepilogo, righe non convertite script per script (file, riga, testo,
 * motivo), conversioni approssimate, immagini mancanti, caratteri e come finire il lavoro con la
 * skill nanDECK. La skill legge questa nota: le tabelle tengono sempre le stesse colonne.
 */
export function importNote(
  reports: ScriptReport[],
  result: NandeckImportResult,
  source: string,
  language: 'it' | 'en'
): string {
  const dict = (language === 'it' ? it : en) as Dict
  const t = (key: string, params?: Message['params']): string => translate(dict, msg(key, params))
  const out: string[] = [
    `# ${NANDECK_NOTE}`,
    '',
    t('nandeck.noteIntro'),
    '',
    t('nandeck.noteSource', { folder: source }),
    ''
  ]
  out.push(
    `## ${t('nandeck.noteSkillTitle')}`,
    '',
    t('nandeck.noteSkill', { url: NANDECK_SKILL_PAGE }),
    ''
  )
  for (const r of reports) {
    out.push(`## ${r.script}`, '')
    out.push(
      r.templates.length
        ? t('nandeck.noteScript', {
            templates: r.templates.join(', '),
            cards: r.cards,
            layers: r.layers
          })
        : t('nandeck.noteNoCards'),
      ''
    )
    if (r.printLines) out.push(t('nandeck.notePrint', { count: r.printLines }), '')
    if (r.skipped.length) {
      out.push(`### ${t('nandeck.noteSkipped')}`, '')
      out.push(
        `| ${t('nandeck.noteFile')} | ${t('nandeck.noteLine')} | ${t('nandeck.noteText')} | ${t('nandeck.noteReason')} |`
      )
      out.push('| --- | ---: | --- | --- |')
      for (const s of r.skipped)
        out.push(
          `| ${cell(s.file)} | ${s.line} | \`${cell(s.text).replace(/`/g, "'")}\` | ${t(`nandeck.reason.${s.reason}`)} |`
        )
      out.push('')
    }
    if (r.notes.length) {
      out.push(`### ${t('nandeck.noteApprox')}`, '')
      for (const n of r.notes) out.push(`- ${translate(dict, n)}`)
      out.push('')
    }
  }
  if (result.missingImages.length) {
    out.push(`## ${t('nandeck.noteMissing')}`, '')
    for (const m of result.missingImages) out.push(`- ${m}`)
    out.push('')
  }
  if (result.fonts.length) {
    out.push(`## ${t('nandeck.noteFonts')}`, '', result.fonts.join(', '), '')
  }
  return out.join('\n')
}
