import { describe, expect, it } from 'vitest'
import { isQrImage, qrSvg, qrText } from '../model/qr'
import { resolveAsset } from '../model/assets'

describe('codici QR', () => {
  it('riconosce qr: e toglie il prefisso', () => {
    expect(isQrImage('qr:https://example.com')).toBe(true)
    expect(isQrImage(' QR: ciao ')).toBe(true)
    expect(isQrImage('qrcode.png')).toBe(false)
    expect(qrText(' qr: ciao mondo ')).toBe('ciao mondo')
  })
  it('un QR vale come immagine, senza cercare un file', () => {
    expect(resolveAsset('qr:https://example.com', [])).toEqual({
      ok: true,
      path: 'qr:https://example.com'
    })
    expect(resolveAsset('qr:', []).ok).toBe(false)
    // nel template il campo non è ancora sostituito: si mostra il segnaposto
    expect(resolveAsset('qr:{link}', [])).toMatchObject({ ok: false, reason: 'missing' })
  })
  it('disegna un SVG quadrato, con lettere accentate', () => {
    const svg = qrSvg('Città, perché: https://example.com/regole')!
    const size = Number(/viewBox="0 0 (\d+)/.exec(svg)![1])
    // versione 1 = 21 moduli, più due di margine per lato
    expect(size).toBeGreaterThanOrEqual(25)
    expect((size - 4 - 17) % 4).toBe(0)
    expect(svg).toContain('<path d="M')
  })
  it('un testo troppo lungo non fa un QR', () => {
    expect(qrSvg('x'.repeat(5000))).toBeNull()
  })
})
