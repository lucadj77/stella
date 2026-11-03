import { useEffect, useRef, useState } from 'react'

// Un pannello affiancato che si può staccare e diventare una finestra mobile sopra l'app, da
// spostare trascinandone la barra e da ridimensionare dall'angolo. Posizione e misura si
// ricordano tra una volta e l'altra.

export interface Floating {
  x: number
  y: number
  w: number
  h: number
}

function load(key: string): Floating | null {
  try {
    const f = JSON.parse(localStorage.getItem(key) ?? 'null') as Floating | null
    return f && [f.x, f.y, f.w, f.h].every((n) => typeof n === 'number') ? f : null
  } catch {
    return null
  }
}

function save(key: string, f: Floating | null): void {
  try {
    if (f) localStorage.setItem(key, JSON.stringify(f))
    else localStorage.removeItem(key)
  } catch {
    // preferenza non essenziale
  }
}

/** La finestra mobile resta dentro quella dell'app, almeno con la sua barra */
export function clampFloating(f: Floating): Floating {
  const w = Math.min(Math.max(f.w, 300), window.innerWidth)
  const h = Math.min(Math.max(f.h, 240), window.innerHeight)
  return {
    w,
    h,
    x: Math.min(Math.max(f.x, 0), Math.max(0, window.innerWidth - w)),
    y: Math.min(Math.max(f.y, 0), Math.max(0, window.innerHeight - 40))
  }
}

export interface FloatingPanel {
  floating: Floating | null
  panel: React.RefObject<HTMLElement | null>
  /** Stacca il pannello dove si trova, o lo riattacca */
  toggle(): void
  /** Da mettere sulla barra: trascinandola si sposta la finestra mobile */
  dragHandlers: {
    onPointerDown(e: React.PointerEvent<HTMLElement>): void
    onPointerMove(e: React.PointerEvent<HTMLElement>): void
    onPointerUp(): void
  }
}

export function useFloatingPanel(key: string, width: number): FloatingPanel {
  const [floating, setFloatingState] = useState<Floating | null>(() => {
    const f = load(key)
    return f && clampFloating(f)
  })
  const setFloating = (f: Floating | null): void => {
    setFloatingState(f)
    save(key, f)
  }
  const panel = useRef<HTMLElement | null>(null)
  const drag = useRef<{ x: number; y: number; from: Floating } | null>(null)

  // ridimensionata dall'angolo (resize del CSS): si ricorda la misura
  useEffect(() => {
    const el = panel.current
    if (!floating || !el) return
    const obs = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth)
      const h = Math.round(el.offsetHeight)
      setFloatingState((f) => {
        if (!f || (f.w === w && f.h === h)) return f
        const next = { ...f, w, h }
        save(key, next)
        return next
      })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [floating !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (): void => {
    if (floating) {
      setFloating(null)
      return
    }
    const r = panel.current?.getBoundingClientRect()
    setFloating(
      clampFloating({
        x: (r?.left ?? 200) - 40,
        y: (r?.top ?? 80) + 20,
        w: r?.width ?? width,
        h: Math.min(r?.height ?? 600, 680)
      })
    )
  }

  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>): void => {
      if (!floating || (e.target as HTMLElement).closest('input, button, select')) return
      drag.current = { x: e.clientX, y: e.clientY, from: floating }
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>): void => {
      const d = drag.current
      if (!d) return
      setFloatingState(
        clampFloating({ ...d.from, x: d.from.x + e.clientX - d.x, y: d.from.y + e.clientY - d.y })
      )
    },
    onPointerUp: (): void => {
      if (!drag.current) return
      drag.current = null
      setFloatingState((f) => {
        save(key, f)
        return f
      })
    }
  }

  return { floating, panel, toggle, dragHandlers }
}
