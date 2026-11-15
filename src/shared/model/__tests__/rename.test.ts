import { describe, expect, it } from 'vitest'
import { normalizeTemplate } from '../normalize'
import { renameInDefinitions, renameInSheet, renameInTemplate, renameInText } from '../rename'

describe('rinomina nei testi', () => {
  it('variabili: richiami, ripetizioni, attributi e immagini con attributi', () => {
    const src =
      'Bonus {spada} {spada*3} {spada*forza tint=rosso stroke=rosso/8%} [x]{color=rosso border=rosso/0.3}'
    expect(renameInText(src, 'variable', 'spada', 'lama')).toBe(
      'Bonus {lama} {lama*3} {lama*forza tint=rosso stroke=rosso/8%} [x]{color=rosso border=rosso/0.3}'
    )
    expect(renameInText(src, 'variable', 'rosso', 'red')).toBe(
      'Bonus {spada} {spada*3} {spada*forza tint=red stroke=red/8%} [x]{color=red border=red/0.3}'
    )
  })
  it('lascia stare i nomi simili, le graffe con la barra e gli stili', () => {
    expect(renameInText('{spadone} \\{spada} {.spada}', 'variable', 'spada', 'lama')).toBe(
      '{spadone} \\{spada} {.spada}'
    )
  })
  it('stili: a inizio paragrafo e in una porzione', () => {
    expect(renameInText('{.flavor center} *a* [b]{.flavor bold}', 'style', 'flavor', 'nota')).toBe(
      '{.nota center} *a* [b]{.nota bold}'
    )
  })
})

const tpl = normalizeTemplate({
  name: 't',
  width: 63,
  height: 88,
  front: [
    { type: 'text', name: 'titolo', text: 'Forza {spada}', color: 'rosso', style: 'flavor' },
    { type: 'image', name: 'icona', src: 'spada' },
    { type: 'shape', name: 'fondo', fill: '{rosso}' }
  ],
  back: []
})

describe('rinomina nei template e nei fogli', () => {
  it('nelle proprietà colore e immagine vale anche il nome senza graffe', () => {
    const t = renameInTemplate(
      renameInTemplate(tpl, 'variable', 'spada', 'lama'),
      'variable',
      'rosso',
      'red'
    )
    const [titolo, icona, fondo] = t.front as unknown as Array<Record<string, unknown>>
    expect(titolo.text).toBe('Forza {lama}')
    expect(titolo.color).toBe('red')
    expect(icona.src).toBe('lama')
    expect(fondo.fill).toBe('{red}')
  })
  it('lo stile di un livello', () => {
    const t = renameInTemplate(tpl, 'style', 'flavor', 'nota')
    expect((t.front[0] as { style: string }).style).toBe('nota')
  })
  it('un campo con lo stesso nome prevale: il template non cambia', () => {
    expect(renameInTemplate(tpl, 'variable', 'titolo', 'x')).toBe(tpl)
  })
  it('nelle celle, senza graffe solo nelle colonne di immagini e colori', () => {
    const s = {
      name: 's',
      headers: ['titolo', 'icona', 'titolo.color'],
      rows: [['spada {spada}', 'spada', 'spada']]
    }
    expect(renameInSheet(s, tpl, 'variable', 'spada', 'lama').rows[0]).toEqual([
      'spada {lama}',
      'lama',
      'lama'
    ])
  })
  it('nelle altre variabili e negli stili', () => {
    const d = renameInDefinitions(
      {
        frase: { type: 'text', text: 'con {spada}' },
        spada: { type: 'image', src: 'spada', stroke: { color: 'rosso', width: 0.3 } },
        scuro: { type: 'color', color: 'rosso' }
      },
      { keyword: 'color=rosso bold' },
      'variable',
      'rosso',
      'red'
    )
    expect(d.variables.scuro).toEqual({ type: 'color', color: 'red' })
    expect(d.variables.spada).toMatchObject({ stroke: { color: 'red', width: 0.3 } })
    expect(d.styles.keyword).toBe('color=red bold')
    const v = renameInDefinitions(
      { spada: { type: 'image', src: 'spada' } },
      {},
      'variable',
      'spada',
      'lama'
    )
    expect(v.variables.spada).toEqual({ type: 'image', src: 'spada' })
  })

  it('i font scritti come variabile, nei livelli, nel markup e negli stili', () => {
    const d = renameInDefinitions(
      {},
      { titolo: 'font={titoli} size=150%', altro: 'font=titoli' },
      'variable',
      'titoli',
      'intestazioni'
    )
    expect(d.styles.titolo).toBe('font={intestazioni} size=150%')
    // senza graffe è il nome di una famiglia
    expect(d.styles.altro).toBe('font=titoli')
    expect(renameInText('[x]{font={titoli}}', 'variable', 'titoli', 'intestazioni')).toBe(
      '[x]{font={intestazioni}}'
    )
  })
})
