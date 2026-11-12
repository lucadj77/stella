import { readFile } from 'fs/promises'
import { extname } from 'path'
import Papa from 'papaparse'
import { inspectTable, type SheetInspection } from '../../shared/dataCheck'
import { MessageError, msg } from '../../shared/messages'
import { readOds } from './ods'
import { cellText, FORMULA_CELL, loadExcel } from './spreadsheet'

// Controlla file dati: il file letto così com'è, con le righe vuote, i titoli sopra le
// intestazioni e, per l'xlsx, celle unite, errori e formule senza risultato

/** Al massimo tante celle elencate per tipo di anomalia: il resto si conta soltanto */
const LIST = 20

export async function inspectDataFile(path: string): Promise<SheetInspection[]> {
  const ext = extname(path).toLowerCase()
  const data = await readFile(path)
  if (ext === '.xlsx') return inspectXlsx(data)
  if (ext === '.ods')
    return (await readOds(data)).map((t) => ({
      ...inspectTable(
        t.name,
        t.rows.map((cells, i) => ({ n: i + 1, cells }))
      ),
      ...noCellChecks
    }))
  if (ext === '.csv') {
    const text = data.toString('utf8').replace(/^\uFEFF/, '')
    const rows = Papa.parse<string[]>(text, { skipEmptyLines: false }).data
    const name = path.replace(/^.*[\\/]/, '').replace(/\.csv$/i, '')
    return [
      {
        ...inspectTable(
          name,
          rows.map((cells, i) => ({ n: i + 1, cells }))
        ),
        ...noCellChecks
      }
    ]
  }
  throw new MessageError(msg('load.unsupportedDataFile', { ext }))
}

const noCellChecks = { merged: [], errors: [], noResult: [] }

async function inspectXlsx(data: Buffer): Promise<SheetInspection[]> {
  const workbook = new (await loadExcel()).Workbook()
  await workbook.xlsx.load(data as unknown as ArrayBuffer)
  return workbook.worksheets.map((ws) => {
    const width = ws.columnCount
    const rows: { n: number; cells: string[] }[] = []
    const errors: string[] = []
    const noResult: string[] = []
    let errorCount = 0
    let noResultCount = 0
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      for (let c = 1; c <= width; c++) {
        const cell = row.getCell(c)
        cells.push(cellText(cell))
        const formula = cell.type === FORMULA_CELL
        const r = formula ? cell.result : cell.value
        if (r && typeof r === 'object' && 'error' in r) {
          if (errorCount++ < LIST) errors.push(`${cell.address} ${r.error}`)
        } else if (formula && (r === undefined || r === null)) {
          if (noResultCount++ < LIST) noResult.push(cell.address)
        }
      }
      rows.push({ n: row.number, cells })
    })
    // oltre LIST si aggiunge quante altre ce ne sono
    if (errorCount > LIST) errors.push(`+${errorCount - LIST}`)
    if (noResultCount > LIST) noResult.push(`+${noResultCount - LIST}`)
    const merges: string[] = (ws.model as { merges?: string[] }).merges ?? []
    return {
      ...inspectTable(ws.name, rows),
      merged:
        merges.length > LIST ? [...merges.slice(0, LIST), `+${merges.length - LIST}`] : merges,
      errors,
      noResult
    }
  })
}
