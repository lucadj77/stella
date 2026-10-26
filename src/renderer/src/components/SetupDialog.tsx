import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import NumInput from './NumInput'
import { useUndo } from './useUndo'
import type { LoadedSet } from '../../../shared/project'
import type { Template } from '../../../shared/model/template'
import {
  SETUP_IMAGE_W,
  SETUP_TEXT_W,
  alignSetupItems,
  canReorderSetupItem,
  distributeSetupItems,
  moveSetupItem,
  reorderSetupItem,
  setupLine,
  setupSource,
  type Setup,
  type SetupAlign,
  type SetupItem,
  type SetupKind,
  type SetupOrder
} from '../../../shared/model/setup'
import { Dialog } from '../editor/dialogs'
import { AlignIcon, DistributeIcon } from '../editor/AlignSection'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import SetupDiagram from '../render/SetupDiagram'
import { itemBox, setupView, setupWithText, type Box } from '../render/setupGeometry'
import AssetPicker from './AssetPicker'
import InsertCardDialog from './InsertCardDialog'
import FormattedField from './TextFormatBar'

// Editor dello schema della preparazione del tavolo (```setup, model/setup.ts): si aggiungono
// zone, carte, mazzi, testi, frecce e immagini e si spostano con il mouse sul disegno, che è lo
// stesso del documento. Il disegno occupa quasi tutta la finestra (o tutta, a schermo intero),
// si ingrandisce e si scorre; si scelgono più elementi per spostarli e allinearli insieme. Al
// salvataggio scrive il blocco nel testo.

const BLUE = '#0a84ff'
/** Pixel liberi attorno al disegno adattato alla finestra */
const FIT_PAD = 24
const MIN_ZOOM = 0.25
const MAX_ZOOM = 12
const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2, 3, 4, 6, 8, 12]
const ALIGN: SetupAlign[] = ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom']
const FULL_KEY = 'setupFullScreen'

/** Elementi copiati con ⌘C / Ctrl+C: restano anche chiudendo la finestra, per un altro schema */
const clipboard: { items: SetupItem[]; pasted: number } = { items: [], pasted: 0 }
function copyItems(list: SetupItem[]): void {
  clipboard.items = list
  clipboard.pasted = 0
}
/** Gli elementi da incollare, ogni volta 5 mm più in basso a destra */
function pasteItems(): SetupItem[] {
  if (!clipboard.items.length) return []
  const d = 5 * ++clipboard.pasted
  return clipboard.items.map((it) => moveSetupItem(it, d, d))
}

type Item = SetupItem
const KINDS = {
  zone: 'documents.setupZone',
  card: 'documents.setupCard',
  deck: 'documents.setupDeck',
  text: 'documents.setupTextItem',
  arrow: 'documents.setupArrow',
  image: 'documents.setupImage'
} as const
type Drag =
  | {
      mode: 'item'
      index: number
      handle: string | null
      x: number
      y: number
      orig: Item[]
      /** Clic su un elemento già scelto con altri: se non si trascina resta scelto solo lui */
      only?: boolean
    }
  | { mode: 'marquee'; x: number; y: number; add: number[] }
  | { mode: 'pan'; cx: number; cy: number; left: number; top: number }

const snap = (n: number): number => Math.round(n)
/** L'area con un margine attorno, per poter portare gli elementi anche fuori */
const grow = (b: Box, m: number): Box => ({
  x: b.x - m,
  y: b.y - m,
  w: b.w + 2 * m,
  h: b.h + 2 * m
})
const clampZoom = (z: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
/** Il passo di zoom successivo (dir 1) o precedente (dir -1) */
function stepZoom(z: number, dir: 1 | -1): number {
  const next =
    dir > 0
      ? ZOOM_STEPS.find((s) => s > z + 0.001)
      : [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001)
  return next ?? z
}
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
/** Dentro un campo di testo le scorciatoie restano del campo */
const typing = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

function loadFull(): boolean {
  try {
    return localStorage.getItem(FULL_KEY) === '1'
  } catch {
    return false
  }
}

export default function SetupDialog({
  initial,
  sets,
  templates,
  project,
  maxWidth,
  font,
  display,
  onSave,
  onClose
}: {
  /** Lo schema da modificare; senza, uno nuovo */
  initial?: Setup
  sets: LoadedSet[]
  templates: Template[]
  project: string
  /** Larghezza del testo della pagina e corpo delle didascalie, in mm, come nel documento */
  maxWidth: number
  font: number
  /** Il testo come si vede nel documento, con le variabili risolte */
  display(text: string): string
  /** Il blocco ```setup */
  onSave(text: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [items, setItems] = useState<Item[]>(initial?.items ?? [])
  const [size, setSize] = useState(initial?.size ?? null)
  /** Larghezza massima nel documento e corpo delle didascalie, in frazione (width: e font:) */
  const [blockWidth, setBlockWidth] = useState(initial?.width ?? 1)
  const [blockFont, setBlockFont] = useState(initial?.font ?? 1)
  /** Elementi scelti, per indice; il primo è quello cliccato per primo */
  const [selection, setSelection] = useState<number[]>([])
  /** Scelta della carta: per un elemento nuovo o per quello con questo indice */
  const [pickingCard, setPickingCard] = useState<{ kind: 'card' | 'deck'; index?: number } | null>(
    null
  )
  const [pickingImage, setPickingImage] = useState<{ index?: number } | null>(null)
  /** Area ferma mentre si trascina: senza misura scritta crescerebbe sotto il mouse */
  const [frozen, setFrozen] = useState<Box | null>(null)
  /** Ingrandimento rispetto al disegno adattato alla finestra */
  const [zoom, setZoom] = useState(1)
  const [full, setFullState] = useState(loadFull)
  /** Riquadro di selezione trascinato sul vuoto, in mm */
  const [marquee, setMarquee] = useState<Box | null>(null)
  /** Barra spaziatrice premuta: trascinare sposta la vista */
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  /** Misure in pixel dello spazio del disegno */
  const [room, setRoom] = useState({ w: 720, h: 440 })
  const drag = useRef<Drag | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  /** Punto in mm da tenere sotto il mouse dopo uno zoom, e dove sta sullo schermo */
  const anchor = useRef<{ mm: { x: number; y: number }; cx: number; cy: number } | null>(null)
  const zoomRef = useRef(zoom)
  const busy = !!pickingCard || !!pickingImage
  useUndo(
    [items, size, blockWidth, blockFont],
    ([i, s, w, f]) => {
      setItems(i)
      setSize(s)
      setBlockWidth(w)
      setBlockFont(f)
      setSelection((sel) => sel.filter((k) => k < i.length))
    },
    !busy
  )

  const setFull = (on: boolean): void => {
    setFullState(on)
    try {
      localStorage.setItem(FULL_KEY, on ? '1' : '0')
    } catch {
      // preferenza non essenziale
    }
  }

  const setup: Setup = { size, items, bad: [] }
  const view = setupView(setup, sets, templates, maxWidth * blockWidth, font * blockFont)
  const area = frozen ?? grow(view.area, size ? 10 : 25)
  const fit = Math.max(
    0.1,
    Math.min((room.w - FIT_PAD * 2) / area.w, (room.h - FIT_PAD * 2) / area.h)
  )
  const scale = fit * zoom
  const chosen = selection.filter((k) => k < items.length)
  const single = chosen.length === 1 ? chosen[0] : null
  const sel = single !== null ? items[single] : null

  // lo spazio del disegno segue la finestra
  useLayoutEffect(() => {
    const vp = viewport.current
    if (!vp) return undefined
    const measure = (): void => setRoom({ w: vp.clientWidth, h: vp.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(vp)
    return () => ro.disconnect()
  }, [])

  /** Punto del disegno in mm in un punto dello schermo */
  const toMm = (cx: number, cy: number): { x: number; y: number } | null => {
    const m = svg.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  /** Cambia lo zoom tenendo fermo il punto dello schermo cx, cy (di base il centro della vista) */
  const zoomTo = (z: number, cx?: number, cy?: number): void => {
    const vp = viewport.current
    if (!vp) return
    const r = vp.getBoundingClientRect()
    const x = cx ?? r.left + r.width / 2
    const y = cy ?? r.top + r.height / 2
    const mm = toMm(x, y)
    if (mm) anchor.current = { mm, cx: x, cy: y }
    setZoom(clampZoom(z))
  }
  const zoomToRef = useRef(zoomTo)
  useEffect(() => {
    zoomRef.current = zoom
    zoomToRef.current = zoomTo
  })
  // dopo lo zoom si scorre la vista perché il punto resti sotto il mouse
  useLayoutEffect(() => {
    const a = anchor.current
    const vp = viewport.current
    const m = svg.current?.getScreenCTM()
    if (!a || !vp || !m) return
    anchor.current = null
    const p = new DOMPoint(a.mm.x, a.mm.y).matrixTransform(m)
    vp.scrollLeft += p.x - a.cx
    vp.scrollTop += p.y - a.cy
  }, [zoom])
  // ⌘/Ctrl + rotella (o pizzico del trackpad) ingrandisce; la rotella da sola scorre
  useEffect(() => {
    const vp = viewport.current
    if (!vp) return undefined
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const d = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 50)
      zoomToRef.current(zoomRef.current * Math.exp(-d * 0.004), e.clientX, e.clientY)
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [])
  // ⌘/Ctrl + e − e 0 ingrandiscono, riducono e adattano; la barra spaziatrice sposta la vista
  useEffect(() => {
    if (busy) return undefined
    const onKey = (e: KeyboardEvent): void => {
      if (typing(e.target)) return
      if (e.key === ' ' && !e.repeat) {
        setSpaceDown(true)
        e.preventDefault()
        return
      }
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      const z = zoomRef.current
      if (e.key === '+' || e.key === '=') zoomToRef.current(stepZoom(z, 1))
      else if (e.key === '-') zoomToRef.current(stepZoom(z, -1))
      else if (e.key === '0') setZoom(1)
      else return
      e.preventDefault()
    }
    const onUp = (e: KeyboardEvent): void => {
      if (e.key === ' ') setSpaceDown(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
    }
  }, [busy])

  const center = (): { x: number; y: number } => ({
    x: snap(view.area.x + view.area.w / 2),
    y: snap(view.area.y + view.area.h / 2)
  })
  const add = (it: Item): void => {
    setItems([...items, it])
    setSelection([items.length])
  }
  const change = (patch: Partial<Item>, index = single): void => {
    if (index === null) return
    setItems(items.map((it, k) => (k === index ? ({ ...it, ...patch } as Item) : it)))
  }
  /**
   * Ruota l'elemento attorno al suo centro: il riquadro dritto che lo contiene cambia misura, e
   * x e y (il suo angolo) si spostano perché il centro resti fermo
   */
  const rotateTo = (deg: number, index = single, from: Item | null = null): void => {
    if (index === null) return
    const o = from ?? items[index]
    if (o.kind !== 'card' && o.kind !== 'deck' && o.kind !== 'image') return
    const rotate = ((Math.round(deg) % 360) + 360) % 360
    if (o.kind === 'image') return change({ rotate }, index)
    const before = itemBox(o, sets, templates)
    const after = itemBox({ ...o, rotate }, sets, templates)
    const tenth = (n: number): number => Math.round(n * 10) / 10
    change(
      {
        rotate,
        x: tenth(before.x + (before.w - after.w) / 2),
        y: tenth(before.y + (before.h - after.h) / 2)
      },
      index
    )
  }
  const remove = (): void => {
    if (!chosen.length) return
    setItems(items.filter((_, k) => !chosen.includes(k)))
    setSelection([])
  }
  const duplicate = (): void => {
    if (!chosen.length) return
    const copies = chosen.map((k) => moveSetupItem(items[k], 5, 5))
    setItems([...items, ...copies])
    setSelection(copies.map((_, n) => items.length + n))
  }
  /** Copia gli elementi scelti, anche come righe dello schema per incollarle nel testo */
  const copy = (): void => {
    const list = chosen.map((k) => items[k])
    copyItems(list)
    navigator.clipboard?.writeText(list.map(setupLine).join('\n')).catch(() => {})
  }
  const paste = (): void => {
    const copies = pasteItems()
    if (!copies.length) return
    setItems([...items, ...copies])
    setSelection(copies.map((_, n) => items.length + n))
  }
  const reorder = (to: SetupOrder): void => {
    if (single === null) return
    const r = reorderSetupItem(items, single, to)
    setItems(r.items)
    setSelection([r.index])
  }
  const align = (mode: SetupAlign): void =>
    setItems(alignSetupItems(items, view.boxes, chosen, mode))
  const distribute = (axis: 'h' | 'v'): void =>
    setItems(distributeSetupItems(items, view.boxes, chosen, axis))

  const addKind = (kind: SetupKind): void => {
    const c = center()
    const at = { from: 0, to: 0 }
    switch (kind) {
      case 'card':
      case 'deck':
        setPickingCard({ kind })
        return
      case 'image':
        setPickingImage({})
        return
      case 'zone':
        add({ kind, x: c.x - 40, y: c.y - 25, w: 80, h: 50, label: '', ...at })
        return
      case 'text':
        add({
          kind,
          x: c.x - SETUP_TEXT_W / 2,
          y: c.y,
          w: SETUP_TEXT_W,
          text: t('documents.setupNewText'),
          ...at
        })
        return
      case 'arrow':
        add({ kind, x: c.x - 15, y: c.y, x2: c.x + 15, y2: c.y, label: '', ...at })
        return
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const vp = e.currentTarget
    // un clic sulle barre di scorrimento non sceglie e non deseleziona
    const r = vp.getBoundingClientRect()
    if (e.clientX - r.left >= vp.clientWidth || e.clientY - r.top >= vp.clientHeight) return
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault()
      drag.current = {
        mode: 'pan',
        cx: e.clientX,
        cy: e.clientY,
        left: vp.scrollLeft,
        top: vp.scrollTop
      }
      setPanning(true)
      vp.setPointerCapture(e.pointerId)
      return
    }
    const target = e.target as Element
    const p = toMm(e.clientX, e.clientY)
    if (!p || e.button !== 0) return
    vp.focus()
    const handle = target.closest('[data-handle]')?.getAttribute('data-handle') ?? null
    const hit = target.closest('[data-item]')?.getAttribute('data-item')
    const toggle = e.shiftKey || e.metaKey || e.ctrlKey
    if (handle !== null && single !== null) {
      drag.current = { mode: 'item', index: single, handle, ...p, orig: items }
    } else if (hit != null) {
      const index = Number(hit)
      if (toggle) {
        // Maiuscolo o ⌘/Ctrl + clic aggiunge o toglie l'elemento dalla scelta
        if (chosen.includes(index)) {
          setSelection(chosen.filter((k) => k !== index))
          return
        }
        setSelection([...chosen, index])
      } else if (!chosen.includes(index)) setSelection([index])
      drag.current = {
        mode: 'item',
        index,
        handle: null,
        ...p,
        orig: items,
        only: !toggle && chosen.length > 1 && chosen.includes(index)
      }
    } else {
      // sul vuoto: un riquadro sceglie gli elementi che tocca
      if (!toggle) setSelection([])
      drag.current = { mode: 'marquee', ...p, add: toggle ? chosen : [] }
    }
    setFrozen(area)
    vp.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (!d) return
    if (d.mode === 'pan') {
      e.currentTarget.scrollLeft = d.left - (e.clientX - d.cx)
      e.currentTarget.scrollTop = d.top - (e.clientY - d.cy)
      return
    }
    const p = toMm(e.clientX, e.clientY)
    if (!p) return
    if (d.mode === 'marquee') {
      const box = {
        x: Math.min(d.x, p.x),
        y: Math.min(d.y, p.y),
        w: Math.abs(p.x - d.x),
        h: Math.abs(p.y - d.y)
      }
      setMarquee(box)
      const inside = view.boxes.flatMap((b, k) => (overlaps(b, box) ? [k] : []))
      setSelection([...new Set([...d.add, ...inside])])
      return
    }
    const dx = p.x - d.x
    const dy = p.y - d.y
    const o = d.orig[d.index]
    if (d.handle === 'rotate') {
      const b = itemBox(o, sets, templates)
      const deg = (Math.atan2(p.y - (b.y + b.h / 2), p.x - (b.x + b.w / 2)) * 180) / Math.PI + 90
      // con Maiuscolo a scatti di 15°, come nell'editor
      rotateTo(e.shiftKey ? Math.round(deg / 15) * 15 : deg, d.index, o)
      return
    }
    let patch: Partial<Item> | null = null
    if (d.handle === 'start') patch = { x: snap(o.x + dx), y: snap(o.y + dy) }
    else if (d.handle === 'end' && o.kind === 'arrow')
      patch = { x2: snap(o.x2 + dx), y2: snap(o.y2 + dy) }
    else if (d.handle === 'size' && o.kind === 'zone')
      patch = { w: Math.max(5, snap(o.w + dx)), h: Math.max(5, snap(o.h + dy)) }
    else if (d.handle === 'size' && (o.kind === 'image' || o.kind === 'text'))
      patch = { w: Math.max(o.kind === 'text' ? 10 : 3, snap(o.w + dx)) }
    if (patch) {
      change(patch, d.index)
      return
    }
    // si spostano insieme tutti gli elementi scelti, a passi di 1 mm rispetto al primo
    const mx = snap(o.x + dx) - o.x
    const my = snap(o.y + dy) - o.y
    if (mx || my) d.only = false
    const moving = chosen.includes(d.index) ? chosen : [d.index]
    setItems(d.orig.map((it, k) => (moving.includes(k) ? moveSetupItem(it, mx, my) : it)))
  }
  const onPointerUp = (): void => {
    const d = drag.current
    if (d?.mode === 'item' && d.only) setSelection([d.index])
    drag.current = null
    setFrozen(null)
    setMarquee(null)
    setPanning(false)
  }
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.target !== e.currentTarget) return
    const mod = (e.metaKey || e.ctrlKey) && !e.altKey
    const key = e.key.toLowerCase()
    if (mod && key === 'a') {
      e.preventDefault()
      setSelection(items.map((_, k) => k))
      return
    }
    if (mod && key === 'v') {
      e.preventDefault()
      paste()
      return
    }
    if (!chosen.length) return
    if (mod && (key === 'c' || key === 'x')) {
      e.preventDefault()
      copy()
      if (key === 'x') remove()
      return
    }
    if (mod && key === 'd') {
      e.preventDefault()
      duplicate()
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      remove()
      return
    }
    const step = e.shiftKey ? 5 : 1
    const move: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    }
    const m = move[e.key]
    if (!m) return
    e.preventDefault()
    setItems(items.map((it, k) => (chosen.includes(k) ? moveSetupItem(it, m[0], m[1]) : it)))
  }

  // contorno e maniglie degli elementi scelti, nelle misure del disegno
  const handle = (name: string, x: number, y: number): React.JSX.Element => {
    const s = 9 / scale
    return (
      <rect
        key={name}
        data-handle={name}
        x={x - s / 2}
        y={y - s / 2}
        width={s}
        height={s}
        fill="#fff"
        stroke={BLUE}
        strokeWidth={1.5 / scale}
        style={{ cursor: name === 'size' ? 'nwse-resize' : 'move' }}
      />
    )
  }
  /** Maniglia tonda sopra il riquadro, per ruotare carte, mazzi e immagini */
  const rotateHandle = (b: Box): React.JSX.Element => {
    const r = 5 / scale
    const cx = b.x + b.w / 2
    // sopra il riquadro; sotto, se sopra uscirebbe dal disegno
    const above = b.y - 1 - 18 / scale - r > area.y
    const top = above ? b.y - 1 : b.y + b.h + 1
    const cy = above ? top - 18 / scale : top + 18 / scale
    return (
      <g key="rotate">
        <line
          x1={cx}
          y1={top}
          x2={cx}
          y2={above ? cy + r : cy - r}
          stroke={BLUE}
          strokeWidth={1.5 / scale}
          pointerEvents="none"
        />
        <circle
          data-handle="rotate"
          cx={cx}
          cy={cy}
          r={r}
          fill="#fff"
          stroke={BLUE}
          strokeWidth={1.5 / scale}
          style={{ cursor: 'grab' }}
        >
          <title>{t('documents.setupRotateHandle')}</title>
        </circle>
      </g>
    )
  }
  const box = single !== null ? view.boxes[single] : null
  const overlay = (
    <g>
      {!size && items.length > 0 && (
        <rect
          x={view.area.x}
          y={view.area.y}
          width={view.area.w}
          height={view.area.h}
          fill="none"
          stroke="#c8c8c2"
          strokeWidth={1 / scale}
          strokeDasharray={`${4 / scale} ${3 / scale}`}
          pointerEvents="none"
        />
      )}
      {chosen.map((k) => {
        const b = view.boxes[k]
        return (
          b && (
            <rect
              key={`sel${k}`}
              x={b.x - 1}
              y={b.y - 1}
              width={b.w + 2}
              height={b.h + 2}
              fill="none"
              stroke={BLUE}
              strokeWidth={1.5 / scale}
              strokeDasharray={chosen.length > 1 ? `${4 / scale} ${2 / scale}` : undefined}
              pointerEvents="none"
            />
          )
        )
      })}
      {sel && box && (
        <>
          {sel.kind === 'arrow'
            ? [handle('start', sel.x, sel.y), handle('end', sel.x2, sel.y2)]
            : sel.kind === 'zone' || sel.kind === 'image' || sel.kind === 'text'
              ? handle('size', box.x + box.w, box.y + box.h)
              : null}
          {(sel.kind === 'card' || sel.kind === 'deck' || sel.kind === 'image') &&
            rotateHandle(box)}
        </>
      )}
      {marquee && (
        <rect
          x={marquee.x}
          y={marquee.y}
          width={marquee.w}
          height={marquee.h}
          fill={BLUE}
          fillOpacity={0.08}
          stroke={BLUE}
          strokeWidth={1 / scale}
          pointerEvents="none"
        />
      )}
    </g>
  )

  const num = (
    label: string,
    value: number,
    onChange: (n: number) => void,
    min?: number
  ): React.JSX.Element => (
    <label>
      {label}
      <NumInput
        className="num"
        min={min}
        value={Math.round(value * 10) / 10}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (e.target.value !== '' && Number.isFinite(n))
            onChange(min !== undefined ? Math.max(min, n) : n)
        }}
      />
    </label>
  )

  return (
    <Dialog title={t(initial ? 'documents.editSetup' : 'documents.insertSetup')} onClose={onClose}>
      <div className={full ? 'dialog-form setup-dialog setup-full' : 'dialog-form setup-dialog'}>
        <div className="setup-toolbar">
          <span className="muted small">{t('documents.setupAdd')}</span>
          {(Object.keys(KINDS) as SetupKind[]).map((k) => (
            <button key={k} onClick={() => addKind(k)}>
              {t(KINDS[k])}
            </button>
          ))}
          <span className="setup-toolbar-gap" />
          <button onClick={() => zoomTo(stepZoom(zoom, -1))} title={t('editor.zoomOut')}>
            −
          </button>
          <button
            className={zoom === 1 ? 'active' : ''}
            onClick={() => setZoom(1)}
            title={t('documents.setupZoomFitHint')}
          >
            {t('editor.zoomFit')}
          </button>
          <button onClick={() => zoomTo(stepZoom(zoom, 1))} title={t('editor.zoomIn')}>
            +
          </button>
          <span className="muted small setup-zoom" title={t('documents.setupZoomHint')}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            className={full ? 'active' : ''}
            aria-pressed={full}
            onClick={() => setFull(!full)}
            title={t('documents.setupFullHint')}
          >
            {t(full ? 'documents.setupFullExit' : 'documents.setupFull')}
          </button>
        </div>
        <div className="setup-body">
          <div
            ref={viewport}
            className={
              panning ? 'setup-canvas panning' : spaceDown ? 'setup-canvas pan' : 'setup-canvas'
            }
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          >
            <div className="setup-stage" style={{ padding: FIT_PAD }}>
              <SetupDiagram
                setup={setupWithText(setup, display)}
                view={{ ...view, area }}
                sets={sets}
                templates={templates}
                project={project}
                unit={1}
                maxWidth={maxWidth * blockWidth}
                width={area.w * scale}
                svgRef={svg}
              >
                {overlay}
              </SetupDiagram>
            </div>
            {!items.length && <p className="setup-empty muted">{t('documents.setupEmpty')}</p>}
          </div>
          <div className="setup-props">
            {chosen.length > 1 ? (
              <>
                <h3>{t('documents.setupChosen', { n: chosen.length })}</h3>
                <div className="setup-arrange">
                  {ALIGN.map((mode) => (
                    <button
                      key={mode}
                      className="tool"
                      title={t(`arrange.${mode}` as MessageKey)}
                      aria-label={t(`arrange.${mode}` as MessageKey)}
                      onClick={() => align(mode)}
                    >
                      <AlignIcon mode={mode} />
                    </button>
                  ))}
                  <button
                    className="tool"
                    disabled={chosen.length < 3}
                    title={t('arrange.distributeH')}
                    aria-label={t('arrange.distributeH')}
                    onClick={() => distribute('h')}
                  >
                    <DistributeIcon axis="h" />
                  </button>
                  <button
                    className="tool"
                    disabled={chosen.length < 3}
                    title={t('arrange.distributeV')}
                    aria-label={t('arrange.distributeV')}
                    onClick={() => distribute('v')}
                  >
                    <DistributeIcon axis="v" />
                  </button>
                </div>
                <p className="muted small">{t('documents.setupAlignHint')}</p>
                <div className="dialog-row">
                  <button onClick={duplicate}>{t('documents.setupDuplicate')}</button>
                  <button className="danger" onClick={remove}>
                    {t('documents.setupDelete')}
                  </button>
                </div>
              </>
            ) : sel ? (
              <>
                <h3>{t(KINDS[sel.kind])}</h3>
                {(sel.kind === 'card' || sel.kind === 'deck') && (
                  <>
                    <code className="setup-ref">{sel.card}</code>
                    <button onClick={() => setPickingCard({ kind: sel.kind, index: single! })}>
                      {t('documents.setupChangeCard')}
                    </button>
                  </>
                )}
                {sel.kind === 'image' && (
                  <>
                    <code className="setup-ref">{sel.src}</code>
                    <button onClick={() => setPickingImage({ index: single! })}>
                      {t('documents.setupChangeImage')}
                    </button>
                  </>
                )}
                <div className="dialog-row">
                  {num('x', sel.x, (x) => change({ x }))}
                  {num('y', sel.y, (y) => change({ y }))}
                </div>
                {sel.kind === 'arrow' && (
                  <div className="dialog-row">
                    {num('x2', sel.x2, (x2) => change({ x2 }))}
                    {num('y2', sel.y2, (y2) => change({ y2 }))}
                  </div>
                )}
                {sel.kind === 'zone' && (
                  <div className="dialog-row">
                    {num(t('documents.setupW'), sel.w, (w) => change({ w }), 5)}
                    {num(t('documents.setupH'), sel.h, (h) => change({ h }), 5)}
                  </div>
                )}
                {(sel.kind === 'text' || sel.kind === 'image') &&
                  num(t('documents.setupW'), sel.w, (w) => change({ w }), 3)}
                {sel.kind === 'deck' &&
                  num(t('documents.setupCount'), sel.count, (count) => change({ count }), 1)}
                {(sel.kind === 'card' || sel.kind === 'deck' || sel.kind === 'image') && (
                  <div className="dialog-row">
                    {num(t('documents.setupRotation'), sel.rotate, (n) => rotateTo(n))}
                    <button onClick={() => rotateTo(sel.rotate + 90)}>
                      {t('documents.setupRotate90')}
                    </button>
                  </div>
                )}
                {sel.kind === 'text' ? (
                  <div className="setup-text">
                    <span>{t('documents.setupText')}</span>
                    <FormattedField
                      key={single}
                      bar
                      singleLine
                      rows={3}
                      value={sel.text}
                      onChange={(text) => change({ text })}
                    />
                  </div>
                ) : sel.kind !== 'image' ? (
                  <div className="setup-text">
                    <span>{t('documents.anatomyLabel')}</span>
                    <FormattedField
                      key={single}
                      bar
                      singleLine
                      value={sel.label}
                      onChange={(label) => change({ label })}
                    />
                  </div>
                ) : null}
                <div className="setup-order">
                  <span>{t('documents.setupOrder')}</span>
                  <div className="setup-order-grid">
                    {(['top', 'up', 'down', 'bottom'] as SetupOrder[]).map((to) => (
                      <button
                        key={to}
                        disabled={!canReorderSetupItem(items, single!, to === 'top' || to === 'up')}
                        title={t(`documents.setupOrder.${to}Hint` as MessageKey)}
                        onClick={() => reorder(to)}
                      >
                        {t(`documents.setupOrder.${to}` as MessageKey)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="dialog-row">
                  <button onClick={duplicate}>{t('documents.setupDuplicate')}</button>
                  <button className="danger" onClick={remove}>
                    {t('documents.setupDelete')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>{t('documents.setupTable')}</h3>
                <label className="setup-check">
                  <input
                    type="checkbox"
                    checked={size !== null}
                    onChange={(e) =>
                      setSize(
                        e.target.checked
                          ? {
                              w: Math.ceil(Math.max(50, view.area.x + view.area.w)),
                              h: Math.ceil(Math.max(30, view.area.y + view.area.h))
                            }
                          : null
                      )
                    }
                  />
                  {t('documents.setupFixedSize')}
                </label>
                {size && (
                  <div className="dialog-row">
                    {num(t('documents.setupW'), size.w, (w) => setSize({ ...size, w }), 20)}
                    {num(t('documents.setupH'), size.h, (h) => setSize({ ...size, h }), 20)}
                  </div>
                )}
                <div className="dialog-row">
                  {num(
                    t('documents.blockWidth'),
                    blockWidth * 100,
                    (n) => setBlockWidth(Math.min(100, Math.max(10, n)) / 100),
                    10
                  )}
                  {num(
                    t('documents.blockFont'),
                    blockFont * 100,
                    (n) => setBlockFont(Math.min(300, Math.max(30, n)) / 100),
                    30
                  )}
                </div>
                <p className="muted small">{t('documents.blockSizeHint')}</p>
                <p className="muted small">{t('documents.setupHint')}</p>
              </>
            )}
          </div>
        </div>
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button
            className="primary"
            disabled={!items.length}
            onClick={() => onSave(setupSource({ size, items, width: blockWidth, font: blockFont }))}
          >
            {t(initial ? 'documents.saveAnatomy' : 'documents.insert')}
          </button>
        </div>
      </div>
      {pickingCard && (
        <InsertCardDialog
          pick={
            pickingCard.index !== undefined
              ? (items[pickingCard.index] as { card: string }).card
              : ''
          }
          sets={sets}
          templates={templates}
          project={project}
          onInsert={(card) => {
            const p = pickingCard
            setPickingCard(null)
            if (p.index !== undefined) {
              change({ card }, p.index)
              return
            }
            const c = center()
            const at = { from: 0, to: 0, x: c.x - 30, y: c.y - 40, rotate: 0, label: '' }
            add(
              p.kind === 'deck'
                ? { kind: 'deck', card, count: 10, ...at }
                : { kind: 'card', card, ...at }
            )
          }}
          onClose={() => setPickingCard(null)}
        />
      )}
      {pickingImage && (
        <AssetPicker
          extras="variables"
          value={
            pickingImage.index !== undefined
              ? (items[pickingImage.index] as { src: string }).src
              : ''
          }
          onPick={(src) => {
            const p = pickingImage
            setPickingImage(null)
            if (p.index !== undefined) {
              change({ src }, p.index)
              return
            }
            const c = center()
            const w = SETUP_IMAGE_W
            add({
              kind: 'image',
              src,
              x: c.x - w / 2,
              y: c.y - w / 2,
              w,
              rotate: 0,
              from: 0,
              to: 0
            })
          }}
          onClose={() => setPickingImage(null)}
        />
      )}
    </Dialog>
  )
}
