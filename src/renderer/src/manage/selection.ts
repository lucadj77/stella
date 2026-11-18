import { useState } from 'react'

// Selezione multipla delle schede di «Gestisci il progetto»: clic, ⌘/Ctrl+clic, ⇧+clic.

export interface Selection {
  selected: Set<string>
  /** Le voci selezionate nell'ordine in cui si vedono */
  chosen: string[]
  click(e: React.MouseEvent, key: string): void
  only(key: string): void
  set(keys: string[]): void
}

export function useSelection(order: string[], initial?: string): Selection {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial ? [initial] : []))
  const [anchor, setAnchor] = useState<string | null>(initial ?? null)
  return {
    selected,
    chosen: order.filter((k) => selected.has(k)),
    click(e, key) {
      if (e.shiftKey && anchor && order.includes(anchor)) {
        const [a, b] = [order.indexOf(anchor), order.indexOf(key)].sort((x, y) => x - y)
        const range = order.slice(a, b + 1)
        setSelected((s) => new Set(e.metaKey || e.ctrlKey ? [...s, ...range] : range))
        return
      }
      if (e.metaKey || e.ctrlKey)
        setSelected((s) => {
          const n = new Set(s)
          if (n.has(key)) n.delete(key)
          else n.add(key)
          return n
        })
      else setSelected(new Set([key]))
      setAnchor(key)
    },
    only(key) {
      setSelected(new Set([key]))
      setAnchor(key)
    },
    set(keys) {
      setSelected(new Set(keys))
    }
  }
}
