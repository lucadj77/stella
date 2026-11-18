import { useState } from 'react'

// Sfondo delle miniature nelle scelte di immagini e icone: nessuno (a scacchi, per vedere la
// trasparenza), chiaro o scuro (per le icone bianche). Una sola scelta, ricordata, per tutte.

export type ThumbBackground = 'none' | 'light' | 'dark'

const KEY = 'thumbBackground'
/** La scelta di prima, solo scuro sì o no */
const OLD_KEY = 'assetPickerDark'

function load(): ThumbBackground {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'none' || v === 'light' || v === 'dark') return v
    return localStorage.getItem(OLD_KEY) === '1' ? 'dark' : 'none'
  } catch {
    return 'none'
  }
}

export function useThumbBackground(): [ThumbBackground, (v: ThumbBackground) => void] {
  const [value, setValue] = useState(load)
  return [
    value,
    (v) => {
      setValue(v)
      try {
        localStorage.setItem(KEY, v)
      } catch {
        // preferenza non essenziale
      }
    }
  ]
}

/** Classe da aggiungere alla griglia delle miniature */
export const thumbClass = (v: ThumbBackground): string => (v === 'none' ? '' : ` bg-${v}`)
