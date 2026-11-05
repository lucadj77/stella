import { describe, expect, it } from 'vitest'
import { denormalizeTemplate, normalizeTemplate } from '../normalize'
import { backIsFront } from '../template'

describe('retro uguale al fronte', () => {
  it('si salva solo se acceso e non vale per pedine e dadi', () => {
    const t = normalizeTemplate({
      name: 's',
      kind: 'token',
      backFromFront: true,
      front: [],
      back: []
    })
    expect(backIsFront(t)).toBe(true)
    expect(denormalizeTemplate(t).backFromFront).toBe(true)
    expect(denormalizeTemplate({ ...t, backFromFront: undefined }).backFromFront).toBeUndefined()
    expect(backIsFront({ ...t, kind: 'standee' })).toBe(false)
    expect(backIsFront({ ...t, kind: 'die' })).toBe(false)
  })
})
