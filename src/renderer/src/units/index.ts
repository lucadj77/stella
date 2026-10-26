import { useSyncExternalStore } from 'react'
import { isLengthUnit, type LengthUnit } from '../../../shared/model/units'

// Unità delle misure scelta nelle impostazioni (⚙): vale per tutte le finestre e i progetti

const KEY = 'lengthUnit'

function read(): LengthUnit {
  try {
    const v = localStorage.getItem(KEY)
    return isLengthUnit(v) ? v : 'mm'
  } catch {
    return 'mm'
  }
}

let current = read()
const listeners = new Set<() => void>()

// un'altra finestra (l'esportazione) ha cambiato l'unità
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    current = read()
    listeners.forEach((l) => l())
  })

export function setLengthUnit(unit: LengthUnit): void {
  current = unit
  try {
    localStorage.setItem(KEY, unit)
  } catch {
    // senza memoria del browser l'unità vale fino alla chiusura
  }
  listeners.forEach((l) => l())
}

export function useLengthUnit(): LengthUnit {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current
  )
}
