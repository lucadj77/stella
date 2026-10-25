import { useState } from 'react'

/** Larghezza di un pannello (o altra misura) ricordata tra una sessione e l'altra */
export function usePanelWidth(key: string, initial: number): [number, (w: number) => void] {
  const [width, setWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(`panel.${key}`))
      return saved > 0 ? saved : initial
    } catch {
      return initial
    }
  })
  const update = (w: number): void => {
    setWidth(w)
    try {
      localStorage.setItem(`panel.${key}`, String(Math.round(w * 100) / 100))
    } catch {
      // preferenza non essenziale
    }
  }
  return [width, update]
}

export type PanelSide = 'left' | 'right'

/** Lato della finestra su cui sta un pannello, ricordato tra una sessione e l'altra */
export function usePanelSide(key: string, initial: PanelSide): [PanelSide, () => void] {
  const [side, setSide] = useState<PanelSide>(() => {
    try {
      const saved = localStorage.getItem(`panelSide.${key}`)
      return saved === 'left' || saved === 'right' ? saved : initial
    } catch {
      return initial
    }
  })
  const toggle = (): void => {
    const next = side === 'left' ? 'right' : 'left'
    setSide(next)
    try {
      localStorage.setItem(`panelSide.${key}`, next)
    } catch {
      // preferenza non essenziale
    }
  }
  return [side, toggle]
}

/** Pannello ridotto a una colonna di icone, ricordato tra una sessione e l'altra */
export function usePanelCompact(key: string): [boolean, (compact: boolean) => void] {
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem(`panelCompact.${key}`) === '1'
    } catch {
      return false
    }
  })
  const update = (c: boolean): void => {
    setCompact(c)
    try {
      localStorage.setItem(`panelCompact.${key}`, c ? '1' : '0')
    } catch {
      // preferenza non essenziale
    }
  }
  return [compact, update]
}

/** Sezioni chiuse di un pannello, ricordate tra una sessione e l'altra */
export function useClosedSections(
  key: string
): [Set<string>, (section: string, closed: boolean) => void] {
  const [closed, setClosed] = useState<Set<string>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(`panelClosed.${key}`) ?? '[]')
      return new Set(Array.isArray(saved) ? saved.filter((s) => typeof s === 'string') : [])
    } catch {
      return new Set()
    }
  })
  const update = (section: string, close: boolean): void => {
    setClosed((prev) => {
      const next = new Set(prev)
      if (close) next.add(section)
      else next.delete(section)
      try {
        localStorage.setItem(`panelClosed.${key}`, JSON.stringify([...next]))
      } catch {
        // preferenza non essenziale
      }
      return next
    })
  }
  return [closed, update]
}

/** Elenchi della barra laterale che oltre questo numero di voci partono chiusi */
export const LONG_LIST = 6

/**
 * Sezioni aperte o chiuse a mano in un progetto, ricordate per cartella.
 * Una sezione mai toccata usa la regola data da chi chiama (per esempio: chiusa se l'elenco è lungo).
 */
export function useProjectSections(
  folder: string | null
): [(section: string, fallback: boolean) => boolean, (section: string, open: boolean) => void] {
  const [, setRev] = useState(0)
  const storageKey = `projectSections.${folder ?? ''}`
  const read = (): Record<string, boolean> => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      return saved && typeof saved === 'object' ? (saved as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  }
  const isOpen = (section: string, fallback: boolean): boolean => {
    const v = read()[section]
    return typeof v === 'boolean' ? v : fallback
  }
  const update = (section: string, open: boolean): void => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...read(), [section]: open }))
    } catch {
      // preferenza non essenziale
    }
    setRev((r) => r + 1)
  }
  return [isOpen, update]
}
