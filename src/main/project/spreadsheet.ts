import { readFile, rename, writeFile } from 'fs/promises'
import { exists } from '../fs'
import { basename, extname } from 'path'
import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import Papa from 'papaparse'
import { addLocale, format, isDateFormat, isPercentFormat, isTextFormat } from 'numfmt'
import type { DataFileLoss, Sheet } from '../../shared/project'
import { odsTableNames, odsWithOnly, readOds, writeOds } from './ods'
import { MessageError, msg } from '../../shared/messages'
import { deletedPath } from './deleted'
import { placeRows } from './rowSlots'
import { readNumber } from '../../shared/model/number'
import { patchXlsx, type CellEdit } from './xlsxPatch'

export async function readSpreadsheet(path: string): Promise<Sheet[]> {
  const ext = extname(path).toLowerCase()
  if (ext === '.xlsx') return readXlsx(path)
  if (ext === '.csv') return [await readCsv(path)]
  if (ext === '.ods')
    return (await readOds(await readFile(path))).map((t) => toSheet(t.name, t.rows))
  throw new MessageError(msg('load.unsupportedDataFile', { ext }))
}

/** Fogli di un .xlsx, da un file o dai suoi dati */
export async function readXlsx(source: string | Buffer): Promise<Sheet[]> {
  const workbook = await readWorkbook(source)
  return workbook.worksheets.map((ws) => {
    const width = ws.columnCount
    const table: string[][] = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c)))
      table.push(cells)
    })
    return toSheet(ws.name, table)
  })
}

/**
 * Testo di una cella come lo vede chi la legge: un numero con il suo formato (50%, 1 234.50 €),
 * una data come AAAA-MM-GG (con l'ora se non è mezzanotte), non la stringa JavaScript che
 * darebbe `text`
 */
export function cellText(cell: ExcelJS.Cell): string {
  // di una formula conta il risultato salvato nel file (da cell.result: cell.value perde FALSO)
  const r = cell.type === ExcelJS.ValueType.Formula ? cell.result : cell.value
  if (r instanceof Date) return isoDate(r)
  // un errore (#DIV/0!, #N/A) si legge com'è scritto, VERO e FALSO come true e false
  if (r && typeof r === 'object' && 'error' in r) return String(r.error)
  if (typeof r === 'boolean') return String(r)
  if (typeof r === 'number') return formatNumber(r, cell.numFmt) ?? cell.text ?? ''
  return cell.text ?? ''
}

// Il formato si applica con il punto per i decimali, come i numeri senza formato, e lo spazio
// unificatore per le migliaia: 1 234.5 si rilegge come numero, 1,234 sarebbe 1,234
addLocale({ group: '\u00a0', decimal: '.' }, 'zz')

/** Formato di un numero da applicare: non quello generale, né di testo, né di data */
function numberFormat(numFmt: string | undefined): string | null {
  if (!numFmt || /^general$/i.test(numFmt.trim())) return null
  try {
    return isTextFormat(numFmt) || isDateFormat(numFmt) ? null : numFmt
  } catch {
    return null
  }
}

/** Il numero come lo mostra il foglio con il formato della cella; null senza formato */
function formatNumber(n: number, numFmt: string | undefined): string | null {
  const f = numberFormat(numFmt)
  if (!f) return null
  try {
    // i riempimenti e gli spazi di allineamento (_- e * nei formati contabili) non servono
    return format(f, n, { locale: 'zz' }).trim() || null
  } catch {
    return null
  }
}

function isoDate(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  // le date dell'xlsx sono in UTC
  const day = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
  const time = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
  return time === '00:00' ? day : `${day} ${time}`
}

async function readCsv(path: string): Promise<Sheet> {
  const text = await readFile(path, 'utf8')
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: true })
  return toSheet(csvSheetName(path), parsed.data)
}

/** La prima riga contiene le intestazioni; colonne senza intestazione e righe vuote sono scartate */
function toSheet(name: string, table: string[][]): Sheet {
  const [head = [], ...body] = table
  const keep = head.map((h, i) => (h.trim() ? i : -1)).filter((i) => i >= 0)
  return {
    name,
    headers: keep.map((i) => head[i].trim()),
    rows: body
      .map((r) => keep.map((i) => (r[i] ?? '').toString()))
      .filter((r) => r.some((v) => v.trim() !== ''))
  }
}

/**
 * Una carta senza alcun dato (appena aggiunta, con il template che non legge niente) sarebbe
 * una riga vuota, che in lettura si salta: la carta sparirebbe riaprendo il progetto. Si salva
 * con amount 1, che è il valore che ha già.
 */
export function keepEmptyCards(sheet: Sheet): Sheet {
  const col = sheet.headers.indexOf('amount')
  if (col < 0 || !sheet.rows.some(isEmptyRow)) return sheet
  return {
    ...sheet,
    rows: sheet.rows.map((r) => {
      if (!isEmptyRow(r)) return r
      const next = sheet.headers.map((_, i) => r[i] ?? '')
      next[col] = '1'
      return next
    })
  }
}

const isEmptyRow = (r: string[]): boolean => r.every((v) => (v ?? '').trim() === '')

export interface WriteOptions {
  /**
   * Se l'xlsx si può salvare solo riscrivendolo tutto e così perderebbe grafici o altro (vedi
   * xlsxLosses), invece di scrivere si rifiuta con l'errore save.needsRewrite
   */
  keepParts?: boolean
}

/**
 * Scrive i fogli modificati nel file dati. Nell'xlsx si riscrivono solo le celle delle colonne
 * con intestazione: formattazione, altri fogli e colonne senza intestazione restano. Una cella
 * con formula resta formula se il suo risultato non è cambiato. Restituisce true se l'xlsx è
 * stato riscritto tutto con exceljs, e ha quindi perso ciò che exceljs non conosce.
 */
export async function writeSpreadsheet(
  path: string,
  sheets: Sheet[],
  removed: string[] = [],
  options: WriteOptions = {}
): Promise<boolean> {
  const ext = extname(path).toLowerCase()
  sheets = sheets.map(keepEmptyCards)
  if (ext === '.xlsx') return writeXlsx(path, sheets, removed, options)
  // un csv ha un solo foglio: eliminando il set il file resta
  if (ext === '.csv') {
    if (sheets.length) await writeCsv(path, sheets)
    return false
  }
  if (ext === '.ods') {
    await writeOdsFile(path, sheets, removed)
    return false
  }
  throw new MessageError(msg('load.unsupportedDataFile', { ext }))
}

/**
 * Copia in deleted/ i fogli che stanno per uscire dal file dati, uno per file con la sua
 * formattazione: da lì si recuperano copiandoli di nuovo nel file dati. Restituisce i file scritti.
 */
export async function keepDeletedSheets(
  folder: string,
  path: string,
  names: string[]
): Promise<string[]> {
  const ext = extname(path).toLowerCase()
  if (!names.length || ext === '.csv' || !(await exists(path))) return []
  const out: string[] = []
  if (ext === '.xlsx') {
    const data = await readFile(path)
    const probe = await readWorkbook(data)
    for (const name of names.filter((n) => probe.getWorksheet(n))) {
      const copy = await readWorkbook(data)
      for (const ws of [...copy.worksheets]) if (ws.name !== name) copy.removeWorksheet(ws.id)
      const target = await deletedPath(folder, name, ext)
      await writeFile(target, await workbookBuffer(copy))
      out.push(target)
    }
  } else if (ext === '.ods') {
    const data = await readFile(path)
    const present = await odsTableNames(data)
    for (const name of names.filter((n) => present.includes(n))) {
      const target = await deletedPath(folder, name, ext)
      await writeFile(target, await odsWithOnly(data, name))
      out.push(target)
    }
  }
  return out
}

async function writeXlsx(
  path: string,
  sheets: Sheet[],
  removed: string[],
  options: WriteOptions
): Promise<boolean> {
  const data = (await exists(path)) ? await readFile(path) : null
  const workbook = data ? await readWorkbook(data) : new ExcelJS.Workbook()
  // se cambiano solo celle di fogli che ci sono già si scrivono quelle, direttamente nell'xml,
  // e il resto del file resta com'era; fogli nuovi, rinominati o tolti richiedono exceljs
  if (data && !removed.length && sheets.every((s) => !s.origin && workbook.getWorksheet(s.name))) {
    const edits = new Map(
      sheets.map((s) => [s.name, planWorksheet(workbook.getWorksheet(s.name)!, s)])
    )
    const patched = await patchXlsx(data, edits)
    if (patched) {
      if (patched !== data) await writeAtomic(path, patched)
      return false
    }
  }
  if (data && options.keepParts && (await xlsxLosses(data)).length)
    throw new MessageError(msg('save.needsRewrite'))
  // prima si tolgono i fogli dei set eliminati: un set può prenderne il nome
  for (const name of removed) {
    const ws = workbook.getWorksheet(name)
    if (ws) workbook.removeWorksheet(ws.id)
  }
  for (const s of sheets) {
    let ws = workbook.getWorksheet(s.name)
    // un set rinominato si porta dietro il suo foglio, con formattazione e colonne in più
    const renamed = !ws && s.origin ? workbook.getWorksheet(s.origin) : undefined
    if (renamed) renamed.name = s.name
    ws ??= renamed ?? workbook.addWorksheet(s.name)
    writeWorksheet(ws, s)
  }
  // un file senza fogli non si apre
  if (!workbook.worksheets.length) workbook.addWorksheet('Sheet1')
  // come nella scrittura diretta: Excel ricalcola le formule che dipendono dalle celle cambiate
  workbook.calcProperties.fullCalcOnLoad = true
  await writeAtomic(path, await workbookBuffer(workbook))
  return true
}

/** Scrittura in un file temporaneo e rinomina: un errore a metà non rovina il file */
async function writeAtomic(path: string, data: Buffer): Promise<void> {
  const tmp = path + '.tmp'
  await writeFile(tmp, data)
  await rename(tmp, path)
}

/** Parti di un .xlsx che exceljs non riscrive, per tipo */
const LOST_PARTS: [DataFileLoss, RegExp][] = [
  ['charts', /^xl\/(charts|chartsheets)\//],
  ['pivotTables', /^xl\/(pivotTables|pivotCache)\//],
  ['slicers', /^xl\/(slicers|slicerCaches|timelines|timelineCaches)\//],
  ['macros', /^xl\/vbaProject\.bin$/],
  ['externalLinks', /^xl\/externalLinks\//]
]

/**
 * Cosa si perderebbe riscrivendo il file dati .xlsx: grafici, tabelle pivot e altro che exceljs
 * non conosce e che al salvataggio sparisce da tutto il file, non solo dai fogli dei set.
 */
export async function xlsxLosses(source: string | Buffer): Promise<DataFileLoss[]> {
  const data = typeof source === 'string' ? await readFile(source) : source
  const zip = await JSZip.loadAsync(data)
  const present = LOST_PARTS.filter(([, re]) => Object.keys(zip.files).some((f) => re.test(f)))
  if (!present.length) return []
  const after = await JSZip.loadAsync(await workbookBuffer(await readWorkbook(data)))
  const kept = Object.keys(after.files)
  return present.filter(([, re]) => !kept.some((f) => re.test(f))).map(([kind]) => kind)
}

/**
 * Si legge e si scrive l'xlsx come dati, non con readFile/writeFile di exceljs: così lo stesso
 * codice funziona anche nella versione web, dove i file passano dal browser
 */
async function readWorkbook(source: string | Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const data = typeof source === 'string' ? await readFile(source) : source
  await workbook.xlsx.load(data as unknown as ArrayBuffer)
  return workbook
}

async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

function writeWorksheet(ws: ExcelJS.Worksheet, s: Sheet): void {
  for (const e of planWorksheet(ws, s)) ws.getRow(e.row).getCell(e.col).value = e.value
}

/**
 * Celle da cambiare perché il foglio abbia i dati del set: solo quelle il cui testo cambia. Le
 * stesse modifiche valgono per exceljs e per la scrittura diretta nell'xml (xlsxPatch.ts).
 */
function planWorksheet(ws: ExcelJS.Worksheet, s: Sheet): CellEdit[] {
  const edits: CellEdit[] = []
  const set = (row: number, col: number, value: CellEdit['value']): void => {
    edits.push({ row, col, value })
  }
  // una cella già vuota non si tocca
  const clearCell = (row: number, col: number): void => {
    const v = ws.getRow(row).getCell(col).value
    if (v !== null && v !== undefined) set(row, col, null)
  }
  // le intestazioni sono nella prima riga con dati, come in lettura
  let headRow = 0
  ws.eachRow({ includeEmpty: false }, (_, n) => {
    if (!headRow) headRow = n
  })
  headRow ||= 1
  const head = ws.getRow(headRow)
  const existing = new Map<string, number>()
  for (let c = 1; c <= ws.columnCount; c++) {
    const h = head.getCell(c).text?.trim()
    if (h) existing.set(h, c)
  }
  // righe che in lettura sono diventate carte: quelle con dati in una colonna con intestazione
  const headed = [...existing.values()]
  const used: number[] = []
  for (let r = headRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    if (headed.some((c) => cellText(row.getCell(c)).trim() !== '')) used.push(r)
  }
  let next = ws.columnCount + 1
  const columns = s.headers.map((h) => {
    const c = existing.get(h) ?? next++
    if (cellText(head.getCell(c)) !== h) set(headRow, c, h)
    existing.delete(h)
    return c
  })
  // colonne tolte dal set: si svuotano, intestazione compresa
  const removed = [...existing.values()]
  const { at, clear } = placeRows(used, s.rows.length, headRow)
  at.forEach((r, k) => {
    const row = ws.getRow(r)
    columns.forEach((c, i) => {
      const cell = row.getCell(c)
      const v = s.rows[k][i] ?? ''
      // una cella con lo stesso testo resta com'è: formula, data, testo formattato, collegamento
      if (cellText(cell) === v) return
      set(r, c, toCellValue(v, cell.numFmt))
    })
  })
  for (const r of clear) for (const c of columns) clearCell(r, c)
  for (let r = headRow; r <= ws.rowCount; r++) for (const c of removed) clearCell(r, c)
  return edits
}

/**
 * I numeri scritti come tali restano numeri nel foglio; "007" e simili restano testo. In una
 * cella con un formato numerico vale anche il numero scritto come lo mostra: 60% o 3,50 €. In
 * una cella in percentuale 60 vale 60%, come quando lo si scrive in Excel.
 */
function toCellValue(v: string, numFmt?: string): string | number | null {
  if (v === '') return null
  const f = numberFormat(numFmt)
  const n = f ? readNumber(v) : null
  if (f && n !== null) return isPercentFormat(f) && !v.trim().endsWith('%') ? n / 100 : n
  // solo se il numero si rilegge uguale: "1.50" e i numeri oltre le 15 cifre restano testo
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v) && String(Number(v)) === v) return Number(v)
  return v
}

async function writeOdsFile(path: string, sheets: Sheet[], removed: string[]): Promise<void> {
  const data = (await exists(path)) ? await readFile(path) : null
  const tmp = path + '.tmp'
  await writeFile(tmp, await writeOds(data, sheets, removed))
  await rename(tmp, path)
}

/** Un file .csv ha un solo foglio, con il nome del file */
function csvSheetName(path: string): string {
  return basename(path).replace(/\.csv$/i, '')
}

async function writeCsv(path: string, sheets: Sheet[]): Promise<void> {
  if (sheets.length !== 1 || sheets[0].name !== csvSheetName(path))
    throw new MessageError(msg('save.csvOneSheet'))
  const s = sheets[0]
  const tmp = path + '.tmp'
  await writeFile(tmp, Papa.unparse([s.headers, ...s.rows]) + '\r\n', 'utf8')
  await rename(tmp, path)
}
