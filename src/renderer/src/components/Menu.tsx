import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Una voce del menu; 'sep' è una linea che separa i gruppi */
export type MenuItem =
  | {
      label: string
      onClick(): void
      disabled?: boolean
      /** Azione che toglie qualcosa: in rosso, in fondo al menu */
      danger?: boolean
      /** Suggerimento al passaggio del mouse */
      title?: string
      /** Scorciatoia da tastiera, solo da mostrare */
      shortcut?: string
    }
  | 'sep'

interface PanelProps {
  /** Punto di partenza in coordinate della finestra */
  x: number
  y: number
  /** Il pannello finisce a x invece di cominciarci (menu sul bordo destro) */
  alignRight?: boolean
  items?: MenuItem[]
  children?: React.ReactNode
  /** Elementi che non chiudono il menu quando li si preme (il pulsante che lo apre) */
  keep?: React.RefObject<HTMLElement | null>
  onClose(): void
}

/**
 * Pannello di un menu, in posizione fissa: non viene tagliato da barre laterali che scorrono
 * e resta dentro la finestra. Si chiude con Esc, con un clic fuori o scegliendo una voce.
 */
export function MenuPanel({
  x,
  y,
  alignRight,
  items,
  children,
  keep,
  onClose
}: PanelProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const left = Math.max(4, Math.min(alignRight ? x - w : x, window.innerWidth - w - 4))
    // sotto il punto se c'è spazio, altrimenti sopra
    const top = y + h + 4 > window.innerHeight ? Math.max(4, y - h - 4) : y
    setPos({ left, top })
  }, [x, y, alignRight])

  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      const target = e.target as Node
      if (ref.current?.contains(target) || keep?.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      // chiude solo il menu, non la finestra sotto
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose, keep])

  return (
    <div
      ref={ref}
      className="menu-panel"
      role="menu"
      style={pos ? pos : { left: x, top: y, visibility: 'hidden' }}
    >
      {items?.map((item, i) =>
        item === 'sep' ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={item.danger ? 'menu-item danger' : 'menu-item'}
            disabled={item.disabled}
            title={item.title}
            onClick={() => {
              onClose()
              item.onClick()
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
          </button>
        )
      )}
      {children}
    </div>
  )
}

interface Props {
  /** Contenuto del pulsante */
  label: React.ReactNode
  title?: string
  className?: string
  /** Il pannello si apre verso sinistra, per i menu vicini al bordo destro */
  alignRight?: boolean
  items?: MenuItem[]
  /** Contenuto libero al posto delle voci (per esempio le impostazioni); riceve come chiudere */
  children?: (close: () => void) => React.ReactNode
}

/** Pulsante che apre un menu a discesa */
export default function Menu({
  label,
  title,
  className,
  alignRight,
  items,
  children
}: Props): React.JSX.Element {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setAt(null), [])
  return (
    <>
      <button
        ref={button}
        className={[className, 'menu-button', at ? 'active' : ''].filter(Boolean).join(' ')}
        aria-haspopup="menu"
        aria-expanded={!!at}
        title={title}
        onClick={() => {
          if (at) return setAt(null)
          const r = button.current!.getBoundingClientRect()
          setAt({ x: alignRight ? r.right : r.left, y: r.bottom + 4 })
        }}
      >
        {label}
      </button>
      {at && (
        <MenuPanel
          x={at.x}
          y={at.y}
          alignRight={alignRight}
          items={items}
          keep={button}
          onClose={close}
        >
          {children?.(close)}
        </MenuPanel>
      )}
    </>
  )
}
