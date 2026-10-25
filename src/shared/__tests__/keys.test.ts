import { describe, expect, it } from 'vitest'
import { platformKeys } from '../keys'

describe('platformKeys', () => {
  it('leaves the Mac form on the Mac', () => {
    expect(platformKeys('Save (⌘S)', true)).toBe('Save (⌘S)')
    expect(platformKeys('Zoom with ⌘/Ctrl + wheel', true)).toBe('Zoom with ⌘ + wheel')
    expect(platformKeys('Fit (⌘0 / Ctrl+0)', true)).toBe('Fit (⌘0)')
  })
  it('uses Ctrl elsewhere', () => {
    expect(platformKeys('Save (⌘S)', false)).toBe('Save (Ctrl+S)')
    expect(platformKeys('Redo (⇧⌘Z)', false)).toBe('Redo (Ctrl+Shift+Z)')
    expect(platformKeys('Ripeti (⇧⌘Z)', false, 'it')).toBe('Ripeti (Ctrl+Maiusc+Z)')
    expect(platformKeys('Delete (⌫)', false)).toBe('Delete (Del)')
    expect(platformKeys('⇧ and ⌘ add, ⌘A selects all', false)).toBe(
      'Shift and Ctrl add, Ctrl+A selects all'
    )
    expect(platformKeys('Shift- or ⌘-click', false)).toBe('Shift- or Ctrl-click')
    expect(platformKeys('Zoom with ⌘/Ctrl + wheel', false)).toBe('Zoom with Ctrl + wheel')
  })
  it('keeps one side of the written pairs', () => {
    const s = '⌘C, ⌘X e ⌘V / Ctrl+C, Ctrl+X e Ctrl+V copiano'
    expect(platformKeys(s, true)).toBe('⌘C, ⌘X e ⌘V copiano')
    expect(platformKeys(s, false)).toBe('Ctrl+C, Ctrl+X e Ctrl+V copiano')
    const z = 'con ⌘+ e ⌘− / Ctrl++ e Ctrl+−. La vista'
    expect(platformKeys(z, true)).toBe('con ⌘+ e ⌘−. La vista')
    expect(platformKeys(z, false)).toBe('con Ctrl++ e Ctrl+−. La vista')
  })
})
