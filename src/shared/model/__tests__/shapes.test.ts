import { describe, expect, it } from 'vitest'
import { backdropInner, imageBackdrop, shapePath, BACKDROP_PAD } from '../shapes'
import { renameInDefinitions } from '../rename'
import type { Variables } from '../variables'

describe('sfondo delle variabili immagine', () => {
  const vars: Variables = {
    goccia: { type: 'image', src: 'icons/goccia', bg: 'circle', bgColor: 'rosso' },
    scudo: { type: 'image', src: 'icons/scudo', tint: 'blue' },
    protetto: { type: 'image', src: 'icons/goccia', bg: '{scudo}', bgPad: 0.3 },
    file: { type: 'image', src: 'icons/goccia', bg: 'sfondi/carta' },
    rosso: { type: 'color', color: '#d00' }
  }

  it('riconosce forme, altre variabili e file', () => {
    expect(imageBackdrop(vars.goccia as never, vars)).toEqual({
      shape: 'circle',
      color: 'rosso',
      pad: BACKDROP_PAD
    })
    // un'altra variabile porta il suo file e la sua tinta
    expect(imageBackdrop(vars.protetto as never, vars)).toEqual({
      src: 'icons/scudo',
      color: 'blue',
      pad: 0.3
    })
    expect(imageBackdrop(vars.file as never, vars)).toEqual({
      src: 'sfondi/carta',
      color: null,
      pad: BACKDROP_PAD
    })
    expect(imageBackdrop(vars.scudo as never, vars)).toBeNull()
    expect(shapePath('toString')).toBeUndefined()
  })

  it("mette l'immagine nel quadrato interno", () => {
    expect(backdropInner({ x: 0, y: 0, w: 20, h: 10 }, { pad: 0.2 })).toEqual({
      x: 7,
      y: 2,
      w: 6,
      h: 6
    })
  })

  it('la rinomina aggiorna sfondo e colori', () => {
    const r = renameInDefinitions(vars, {}, 'variable', 'scudo', 'difesa')
    expect(r.variables.protetto).toMatchObject({ bg: '{difesa}' })
    const c = renameInDefinitions(vars, {}, 'variable', 'rosso', 'red')
    expect(c.variables.goccia).toMatchObject({ bgColor: 'red' })
  })
})
