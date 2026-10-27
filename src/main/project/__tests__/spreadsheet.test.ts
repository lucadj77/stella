import { mkdtemp, readdir, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { saveData } from '../save'
import { readSpreadsheet, writeSpreadsheet, xlsxLosses } from '../spreadsheet'

async function workbook(path: string): Promise<void> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Personaggi')
  ws.addRow(['amount', 'nome', 'forza', 'energia', '', 'vecchia'])
  ws.addRow([1, 'Cavaliere', 4, null, 'nota', 'x'])
  ws.addRow([2, 'Arciere', 2, null, '', 'y'])
  ws.getCell('D2').value = { formula: 'C2+2', result: 6 }
  ws.getCell('D3').value = { formula: 'C3+2', result: 4 }
  ws.getCell('B1').font = { bold: true }
  wb.addWorksheet('Altro').addRow(['a'])
  await wb.xlsx.writeFile(path)
}

describe('writeSpreadsheet', () => {
  it('una carta senza dati resta riaprendo il progetto (nuovo foglio, xlsx e csv)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    const sheet = {
      name: 'Prova',
      headers: ['amount', 'titolo'],
      rows: [
        ['', ''],
        ['', 'a']
      ]
    }
    for (const file of ['dati.xlsx', 'Prova.csv']) {
      const path = join(dir, file)
      if (file.endsWith('.xlsx')) await workbook(path)
      await writeSpreadsheet(path, [sheet])
      const back = (await readSpreadsheet(path)).find((s) => s.headers.includes('titolo'))
      expect(back?.rows).toEqual([
        ['1', ''],
        ['', 'a']
      ])
    }
  })

  it('in sola lettura saveData rifiuta i fogli e salva solo stella.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    await workbook(join(dir, 'dati.xlsx'))
    const before = await readFile(join(dir, 'dati.xlsx'))
    const file = { formatVersion: 1, name: 'p', dataFile: 'dati.xlsx', sets: [] }
    await writeFile(join(dir, 'stella.json'), JSON.stringify({ ...file, dataReadOnly: true }))
    const sheet = { name: 'Personaggi', headers: ['a'], rows: [['b']] }
    await expect(saveData(dir, { sheets: [sheet] })).rejects.toThrow('data.readOnly')
    await expect(saveData(dir, { sheets: [], removed: ['Altro'] })).rejects.toThrow('data.readOnly')
    // togliere la sola lettura nello stesso salvataggio lascia scrivere
    await saveData(dir, { file: { ...file, name: 'q' }, sheets: [] })
    expect(JSON.parse(await readFile(join(dir, 'stella.json'), 'utf8')).name).toBe('q')
    expect(await readFile(join(dir, 'dati.xlsx'))).toEqual(before)
  })

  it('rinomina il foglio di un set rinominato, con formule e formattazione', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    const path = join(dir, 'dati.xlsx')
    await workbook(path)
    await writeSpreadsheet(path, [
      {
        name: 'Eroi',
        origin: 'Personaggi',
        headers: ['amount', 'nome', 'forza', 'energia'],
        rows: [
          ['1', 'Cavaliere', '4', '6'],
          ['2', 'Arciere', '2', '4']
        ]
      }
    ])
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(path)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Eroi', 'Altro'])
    const ws = wb.getWorksheet('Eroi')!
    expect(ws.getCell('D2').formula).toBe('C2+2')
    expect(ws.getCell('B1').font?.bold).toBe(true)
    expect(ws.getCell('E2').text).toBe('nota')
  })

  it('sposta in deleted/ il foglio di un set eliminato e ne libera il nome', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    await workbook(join(dir, 'dati.xlsx'))
    const file = { version: 1, dataFile: 'dati.xlsx', sets: [] }
    await writeFile(join(dir, 'stella.json'), JSON.stringify(file))
    await saveData(dir, {
      sheets: [{ name: 'Personaggi', origin: 'Altro', headers: ['a'], rows: [['b']] }],
      removed: ['Personaggi']
    })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(join(dir, 'dati.xlsx'))
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Personaggi'])
    expect(wb.getWorksheet('Personaggi')!.getCell('A2').text).toBe('b')
    const kept = await readdir(join(dir, 'deleted'))
    expect(kept).toHaveLength(1)
    expect(kept[0]).toMatch(/^Personaggi \d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.xlsx$/)
    const copy = new ExcelJS.Workbook()
    await copy.xlsx.readFile(join(dir, 'deleted', kept[0]))
    expect(copy.worksheets.map((w) => w.name)).toEqual(['Personaggi'])
    expect(copy.getWorksheet('Personaggi')!.getCell('D2').formula).toBe('C2+2')
    expect(copy.getWorksheet('Personaggi')!.getCell('B1').font?.bold).toBe(true)
  })

  it('riscrive le celle tenendo formule, formattazione e altri fogli', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    const path = join(dir, 'dati.xlsx')
    await workbook(path)
    await writeSpreadsheet(path, [
      {
        name: 'Personaggi',
        headers: ['amount', 'nome', 'forza', 'energia', 'testo'],
        rows: [
          ['1', 'Cavaliere', '4', '6', 'Attacca'],
          ['2', 'Arciere', '3', '5', ''],
          ['', 'Drago', '007', '', '']
        ]
      },
      { name: 'Nuovo', headers: ['amount', 'nome'], rows: [['', 'Uno']] }
    ])
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(path)
    const ws = wb.getWorksheet('Personaggi')!
    // formula invariata dove il risultato coincide, valore dove è cambiato
    expect(ws.getCell('D2').formula).toBe('C2+2')
    expect(ws.getCell('D3').value).toBe(5)
    expect(ws.getCell('C3').value).toBe(3)
    expect(ws.getCell('C4').value).toBe('007')
    expect(ws.getCell('B1').font?.bold).toBe(true)
    // colonna senza intestazione intatta, colonna tolta svuotata, colonna nuova in fondo
    expect(ws.getCell('E2').value).toBe('nota')
    expect(ws.getCell('F1').value).toBeNull()
    expect(ws.getCell('G1').value).toBe('testo')
    const sheets = await readSpreadsheet(path)
    expect(sheets.map((s) => s.name)).toEqual(['Personaggi', 'Altro', 'Nuovo'])
    expect(sheets[0].rows[2]).toEqual(['', 'Drago', '007', '', 'Attacca'.slice(0, 0)])
    expect(sheets[2].rows).toEqual([['', 'Uno']])
  })

  it('riscrive un csv', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    const path = join(dir, 'carte.csv')
    await writeSpreadsheet(path, [
      { name: 'carte', headers: ['nome', 'testo'], rows: [['A', 'x, y']] }
    ])
    expect(await readFile(path, 'utf8')).toBe('nome,testo\r\nA,"x, y"\r\n')
  })
})

describe('celle che non cambiano', () => {
  it('date, testo formattato e numeri lunghi restano come erano', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    const path = join(dir, 'dati.xlsx')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Set')
    ws.addRow(['nome', 'quando', 'codice', 'prezzo'])
    const row = ws.addRow(['a', new Date(Date.UTC(2024, 0, 15)), '12345678901234567890', '1.50'])
    row.getCell(1).value = { richText: [{ text: 'a', font: { bold: true } }, { text: 'b' }] }
    await wb.xlsx.writeFile(path)
    const [sheet] = await readSpreadsheet(path)
    expect(sheet.rows).toEqual([['ab', '2024-01-15', '12345678901234567890', '1.50']])
    await writeSpreadsheet(path, [{ ...sheet, rows: [[...sheet.rows[0]]] }])
    const wb2 = new ExcelJS.Workbook()
    await wb2.xlsx.readFile(path)
    const r = wb2.getWorksheet('Set')!.getRow(2)
    expect(r.getCell(1).value).toEqual({
      richText: [{ text: 'a', font: { bold: true } }, { text: 'b' }]
    })
    expect(r.getCell(2).value).toBeInstanceOf(Date)
    expect(r.getCell(3).value).toBe('12345678901234567890')
    expect(r.getCell(4).value).toBe('1.50')
    // una cella cambiata si scrive: numero esatto come numero, il resto come testo
    await writeSpreadsheet(path, [
      { ...sheet, rows: [['ab', '2024-02-01 10:30', '12345678901234567890', '2.5']] }
    ])
    const wb3 = new ExcelJS.Workbook()
    await wb3.xlsx.readFile(path)
    const r3 = wb3.getWorksheet('Set')!.getRow(2)
    expect(r3.getCell(2).value).toBe('2024-02-01 10:30')
    expect(r3.getCell(4).value).toBe(2.5)
    expect((await readSpreadsheet(path))[0].rows).toEqual([
      ['ab', '2024-02-01 10:30', '12345678901234567890', '2.5']
    ])
  })

  it('lascia al loro posto le righe vuote in mezzo ai dati', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    const path = join(dir, 'dati.xlsx')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Set')
    // intestazioni nella riga 2, una riga vuota tra a e b, una nota senza intestazione
    ws.getRow(2).values = ['nome', 'valore', null, null]
    ws.getRow(3).values = ['a', 1, null, 'nota a']
    ws.getRow(5).values = ['b', 2, null, 'nota b']
    ws.getRow(6).values = ['c', 3, null, 'nota c']
    ws.getCell('C5').value = { formula: 'B5*2', result: 4 }
    await wb.xlsx.writeFile(path)
    const [sheet] = await readSpreadsheet(path)
    expect(sheet.headers).toEqual(['nome', 'valore'])
    expect(sheet.rows).toEqual([
      ['a', '1'],
      ['b', '2'],
      ['c', '3']
    ])
    // si cambia un valore e si toglie l'ultima carta
    await writeSpreadsheet(path, [
      {
        ...sheet,
        rows: [
          ['a', '1'],
          ['b', '20']
        ]
      }
    ])
    const out = new ExcelJS.Workbook()
    await out.xlsx.readFile(path)
    const o = out.getWorksheet('Set')!
    expect(o.getCell('A1').value).toBeNull()
    expect(o.getCell('A2').value).toBe('nome')
    expect(o.getCell('A4').value).toBeNull()
    expect(o.getCell('A5').value).toBe('b')
    expect(o.getCell('B5').value).toBe(20)
    expect(o.getCell('C5').formula).toBe('B5*2')
    expect(o.getCell('D5').value).toBe('nota b')
    expect(o.getCell('A6').value).toBeNull()
    expect(o.getCell('D6').value).toBe('nota c')
    // una carta nuova va dopo l'ultima riga con dati
    await writeSpreadsheet(path, [
      {
        ...sheet,
        rows: [
          ['a', '1'],
          ['b', '20'],
          ['d', '4']
        ]
      }
    ])
    expect((await readSpreadsheet(path))[0].rows).toEqual([
      ['a', '1'],
      ['b', '20'],
      ['d', '4']
    ])
    const again = new ExcelJS.Workbook()
    await again.xlsx.readFile(path)
    expect(again.getWorksheet('Set')!.getCell('A6').value).toBe('d')
  })

  it('legge errori e valori logici come li scrive il foglio; sa che i grafici si perderebbero', async () => {
    const chart = join(__dirname, 'fixtures', 'chart.xlsx')
    const [sheet] = await readSpreadsheet(chart)
    expect(sheet.rows).toEqual([
      ['a', '1', '#DIV/0!', 'true'],
      ['b', '2', '#N/A', 'false']
    ])
    expect(await xlsxLosses(chart)).toEqual(['charts'])
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    await workbook(join(dir, 'dati.xlsx'))
    expect(await xlsxLosses(join(dir, 'dati.xlsx'))).toEqual([])
  })

  it('legge i numeri con il formato della cella e riscrive come numeri quelli modificati', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gc-'))
    const path = join(dir, 'dati.xlsx')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Carte')
    ws.addRow(['nome', 'prob', 'costo', 'peso', 'forza', 'quota'])
    ws.addRow(['Drago', 0.5, 1234.5, 1.5, 4, 0.125])
    ws.addRow(['Fante', 0.25, 3, 2, 1, { formula: 'B3/2', result: 0.125 }])
    ws.getColumn(2).numFmt = '0%'
    ws.getColumn(3).numFmt = '#,##0.00 "€"'
    ws.getColumn(4).numFmt = '0.00'
    // contabile: riempimenti e spazi di allineamento non entrano nel testo
    ws.getColumn(6).numFmt = '_-* 0.0%_-'
    await wb.xlsx.writeFile(path)

    const [sheet] = await readSpreadsheet(path)
    expect(sheet.rows).toEqual([
      ['Drago', '50%', '1 234.50 €', '1.50', '4', '12.5%'],
      ['Fante', '25%', '3.00 €', '2.00', '1', '12.5%']
    ])

    sheet.rows[0][1] = '60%'
    sheet.rows[0][2] = '2 000,5 €'
    sheet.rows[1][1] = '75'
    sheet.rows[1][3] = 'tanto'
    await writeSpreadsheet(path, [sheet])
    const again = new ExcelJS.Workbook()
    await again.xlsx.readFile(path)
    const out = again.getWorksheet('Carte')!
    expect(out.getCell('B2').value).toBe(0.6)
    expect(out.getCell('C2').value).toBe(2000.5)
    // in una cella in percentuale 75 vale 75%, come in Excel
    expect(out.getCell('B3').value).toBe(0.75)
    expect(out.getCell('D3').value).toBe('tanto')
    // il formato resta, e le celle non toccate pure
    expect(out.getCell('B2').numFmt).toBe('0%')
    expect(out.getCell('F3').value).toEqual({ formula: 'B3/2', result: 0.125 })
    expect((await readSpreadsheet(path))[0].rows[0].slice(1, 3)).toEqual(['60%', '2 000.50 €'])
  })
})
