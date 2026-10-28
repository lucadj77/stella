import { describe, expect, it } from 'vitest'
import { DEFAULT_IMAGE, DEFAULT_PDF, DEFAULT_TTS, type ExportCard, type ExportJob } from '../export'
import { exportSummary } from '../exportPreview'
import { normalizeTemplate } from '../model/normalize'

const tpl = normalizeTemplate({ name: 't', width: 63, height: 88, bleed: 3, front: [], back: [] })
const card = (n: number, amount = 1): ExportCard => ({
  n,
  amount,
  label: `c${n}`,
  fields: {},
  template: tpl
})
const sets = [
  { name: 'a', cards: Array.from({ length: 10 }, (_, i) => card(i + 1, i === 0 ? 3 : 1)) },
  { name: 'vuoto', cards: [] }
]
const base = { project: 'gioco', sets }

describe('riassunto della finestra Esporta', () => {
  it('PDF: pagine e fogli, con il fronte-retro un foglio ogni due pagine', () => {
    const job: ExportJob = {
      ...base,
      kind: 'pdf',
      options: { ...DEFAULT_PDF, copies: true, duplex: 'long' }
    }
    const s = exportSummary(job)
    // 12 carte con le copie, 9 per pagina: 2 pagine di fronti e 2 di retri
    expect([s.components, s.sets, s.files, s.pages, s.sheets]).toEqual([12, 1, 1, 4, 2])
    const apart = exportSummary({ ...job, options: { ...job.options, duplex: 'none' } })
    expect(apart.sheets).toBe(apart.pages)
  })

  it('immagini: un file per carta e lato', () => {
    const s = exportSummary({
      ...base,
      kind: 'images',
      options: { ...DEFAULT_IMAGE, sides: 'front', copies: false }
    })
    expect([s.components, s.files]).toEqual([10, 10])
  })

  it('Tabletop Simulator: oggetti, immagini dei fogli e file .json', () => {
    const s = exportSummary({ ...base, kind: 'tts', options: DEFAULT_TTS })
    expect(s.objects).toBe(1)
    expect(s.files).toBe(s.images + s.objects)
  })
})
