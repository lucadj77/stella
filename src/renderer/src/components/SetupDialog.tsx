import type { ProjectMeta } from '../../../shared/model/system'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import NumInput from './NumInput'
import { useUndo } from './useUndo'
import WrapField, { type WrapSide } from './WrapField'
import CaptionField from './CaptionField'
import BlockCodeField from './BlockCodeField'
import { parseDocument } from '../../../shared/model/document'
import type { LoadedSet } from '../../../shared/project'
import type { Template } from '../../../shared/model/template'
import {
  SETUP_HAND_SPREAD,
  SETUP_IMAGE_W,
  SETUP_MAX_CARDS,
  SETUP_ROW_GAP,
  SETUP_TEXT_OUTLINE,
  SETUP_SHAPES,
  SETUP_TEXT_W,
  alignSetupItems,
  cardListSource,
  parseCardList,
  layerOrdered,
  sortByLayer,
  arrowCurve,
  bendTowards,
  canReorderSetupItem,
  distributeSetupItems,
  moveSetupItem,
  reorderSetupItem,
  setupLine,
  setupSource,
  WRAP_WIDTH,
  type ArrowHeads,
  type Setup,
  type SetupAlign,
  type SetupItem,
  type SetupKind,
  type SetupLabelAt,
  type SetupLineStyle,
  type SetupOrder,
  type SetupShape
} from '../../../shared/model/setup'
import { linesOf, snapBox } from '../../../shared/model/snap'
import { ColorField } from '../editor/fields'
import { moveItem, useDragReorder } from './useDragReorder'
import { Dialog } from '../editor/dialogs'
import { AlignIcon, DistributeIcon } from '../editor/AlignSection'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import SetupDiagram from '../render/SetupDiagram'
import {
  SETUP_MARGIN,
  boardCells,
  cellAt,
  itemBox,
  namedItem,
  setupView,
  setupWithText,
  type Box
} from '../render/setupGeometry'
import AssetPicker from './AssetPicker'
import InsertCardDialog from './InsertCardDialog'
import FormattedField from './TextFormatBar'
import Segmented from './Segmented'
import { HeadsIcon, LabelIcon, LineIcon, ShapeIcon } from './SetupIcons'

// Editor dello schema della preparazione del tavolo (```setup, model/setup.ts): si aggiungono
// zone, carte, mazzi, testi, frecce e immagini e si spostano con il mouse sul disegno, che è lo
// stesso del documento. Il disegno occupa quasi tutta la finestra (o tutta, a schermo intero),
// si ingrandisce e si scorre; si scelgono più elementi per spostarli e allinearli insieme. Al
// salvataggio scrive il blocco nel testo.

const BLUE = '#0a84ff'
/** Linee guida dell'aggancio */
const GUIDE = '#ff2d78'
/** L'angolo in basso a destra di una zona o di una forma, ruotato con lei */
function corner(it: {
  x: number
  y: number
  w: number
  h: number
  rotate?: number
}): [number, number] {
  const a = ((it.rotate ?? 0) * Math.PI) / 180
  const hx = it.w / 2
  const hy = it.h / 2
  const cx = it.x + hx
  const cy = it.y + hy
  return [cx + hx * Math.cos(a) - hy * Math.sin(a), cy + hx * Math.sin(a) + hy * Math.cos(a)]
}
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
/** Il simbolo di ogni tipo nel pannello dei livelli, come in quello dei template */
const ICONS: Record<string, string> = {
  zone: '▭',
  rect: '■',
  ellipse: '●',
  polygon: '⬢',
  star: '★',
  card: '🂠',
  deck: '▥',
  row: '▤',
  hand: '✋',
  text: 'T',
  arrow: '➝',
  image: '▣'
}
const SHAPE_NAMES: Record<SetupShape, MessageKey> = {
  rect: 'documents.setupShape.rect',
  ellipse: 'documents.setupShape.ellipse',
  polygon: 'documents.setupShape.polygon',
  star: 'documents.setupShape.star'
}
/** Elementi con le carte, quelli che hanno zoom e posto dell'etichetta */
const CARDISH = ['card', 'deck', 'row', 'hand']
/** Soglia dell'aggancio agli altri elementi, in pixel dello schermo */
const SNAP_PX = 6

const KINDS = {
  zone: 'documents.setupZone',
  shape: 'documents.setupShape',
  card: 'documents.setupCard',
  deck: 'documents.setupDeck',
  row: 'documents.setupRow',
  hand: 'documents.setupHand',
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
      /** Gli elementi con le posizioni calcolate (frecce agganciate, segnalini) e i riquadri */
      resolved: Item[]
      boxes: Box[]
      /** Clic su un elemento già scelto con altri: se non si trascina resta scelto solo lui */
      only?: boolean
      /** Maiuscolo o ⌘/Ctrl su un elemento già scelto: se non si trascina esce dalla scelta */
      drop?: boolean
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
  fontFamily,
  display,
  onSave,
  onClose
}: {
  /** Lo schema da modificare; senza, uno nuovo */
  initial?: Setup
  sets: LoadedSet[]
  templates: Template[]
  project: string | ProjectMeta
  /** Larghezza del testo della pagina e corpo delle didascalie, in mm, come nel documento */
  maxWidth: number
  font: number
  /** Famiglia di caratteri del documento: i testi vanno a capo come nella pagina */
  fontFamily?: string
  /** Il testo come si vede nel documento, con le variabili risolte */
  display(text: string): string
  /** Il blocco ```setup */
  onSave(text: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  // senza `order: free` le righe si mettono nell'ordine degli strati: il disegno resta lo stesso
  const [items, setItems] = useState<Item[]>(() =>
    initial ? (initial.free ? initial.items : sortByLayer(initial.items)) : []
  )
  /** Linee a cui si è agganciato l'elemento trascinato, in mm */
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null
  })
  /** La casella di una plancia su cui cadrebbe l'elemento trascinato */
  const [cellHint, setCellHint] = useState<{
    item: number
    board: number
    row: number
    col: number
    x: number
    y: number
    size: number
  } | null>(null)
  /** Scelta di una carta da aggiungere alla fila o alla mano con questo indice */
  const [addingCard, setAddingCard] = useState<number | null>(null)
  const [size, setSize] = useState(initial?.size ?? null)
  /** Margine intorno all'area automatica, in mm; null = quello di base */
  const [margin, setMargin] = useState<number | null>(initial?.margin ?? null)
  /** Larghezza massima nel documento e corpo delle didascalie, in frazione (width: e font:) */
  // come nel documento: uno schema con il testo accanto e senza larghezza ne prende metà
  const [blockWidth, setBlockWidth] = useState(initial?.width ?? (initial?.wrap ? WRAP_WIDTH : 1))
  const [blockFont, setBlockFont] = useState(initial?.font ?? 1)
  const [caption, setCaption] = useState(initial?.caption ?? '')
  const [captionTop, setCaptionTop] = useState(initial?.captionTop ?? false)
  /** Testo che scorre accanto, con lo schema a sinistra o a destra */
  const [wrap, setWrapSide] = useState<WrapSide>(initial?.wrap ?? null)
  // uno schema a tutta riga non lascia posto al testo: si parte da metà
  const setWrap = (w: WrapSide): void => {
    setWrapSide(w)
    if (w && blockWidth >= 1) setBlockWidth(0.5)
  }
  /** Elementi scelti, per indice; il primo è quello cliccato per primo */
  const [selection, setSelection] = useState<number[]>([])
  /** Scelta della carta: per un elemento nuovo o per quello con questo indice */
  const [pickingCard, setPickingCard] = useState<{
    kind: 'card' | 'deck' | 'row' | 'hand'
    index?: number
  } | null>(null)
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
  const busy = !!pickingCard || !!pickingImage || addingCard !== null
  /** Il blocco ```setup come lo scrive la finestra */
  const source = setupSource({
    size,
    margin,
    items,
    width: blockWidth,
    font: blockFont,
    caption,
    captionTop,
    wrap,
    // l'ordine libero serve solo se qualcosa sta fuori dal suo strato
    free: !layerOrdered(items)
  })
  /** Il codice scritto a mano: rimette lo schema come dice; false se non si capisce */
  const applyCode = (code: string): boolean => {
    const b = parseDocument(code.trim())[0]
    if (b?.kind !== 'setup' || b.bad.length) return false
    setItems(b.free ? b.items : sortByLayer(b.items))
    setSize(b.size)
    setMargin(b.margin ?? null)
    setBlockWidth(b.width ?? 1)
    setBlockFont(b.font ?? 1)
    setCaption(b.caption ?? '')
    setCaptionTop(b.captionTop ?? false)
    setWrapSide(b.wrap ?? null)
    setSelection([])
    return true
  }
  useUndo(
    [items, size, blockWidth, blockFont, caption, captionTop, margin],
    ([i, s, w, f, c, ct, m]) => {
      setItems(i)
      setSize(s)
      setMargin(m)
      setBlockWidth(w)
      setBlockFont(f)
      setCaption(c)
      setCaptionTop(ct)
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

  // nella finestra vale sempre l'ordine delle righe: quelle vecchie sono già in ordine di strato
  const setup: Setup = { size, margin, items, bad: [], free: true }
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
  /** Gli elementi come si disegnano: frecce agganciate e segnalini al loro posto */
  const placed = view.items ?? items
  const placedSel = single !== null ? placed[single] : null
  /** Le plance con una griglia: gli elementi che possono stare sulle loro caselle */
  const boards = placed.flatMap((it, k) =>
    (it.kind === 'card' || it.kind === 'deck') &&
    !it.on &&
    view.boxes[k] &&
    boardCells(it, view.boxes[k], sets, templates)
      ? [k]
      : []
  )

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
  // il pannello dei livelli mostra in cima l'elemento più in alto, cioè l'ultima riga
  const layerDrag = useDragReorder((from, to) => {
    const last = items.length - 1
    setItems(moveItem(items, last - from, last - to))
    setSelection([last - to])
  })
  const cardDrag = useDragReorder((from, to) => {
    const it = selection.length === 1 ? items[selection[0]] : null
    if (it?.kind === 'row' || it?.kind === 'hand')
      change({ cards: moveItem(it.cards, from, to) }, selection[0])
  })
  /**
   * Ruota l'elemento attorno al suo centro: il riquadro dritto che lo contiene cambia misura, e
   * x e y (il suo angolo) si spostano perché il centro resti fermo
   */
  const rotateTo = (deg: number, index = single, from: Item | null = null): void => {
    if (index === null) return
    const o = from ?? items[index]
    if (o.kind === 'arrow' || o.kind === 'row' || o.kind === 'hand') return
    const rotate = ((Math.round(deg) % 360) + 360) % 360
    // zone, forme e testi ruotano attorno al centro del loro rettangolo, che resta fermo
    if (o.kind !== 'card' && o.kind !== 'deck') return change({ rotate }, index)
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
  /**
   * Dà un nome all'elemento, se non ce l'ha, perché frecce e segnalini possano richiamarlo;
   * restituisce gli elementi e il nome
   */
  const named = (list: Item[], k: number): { items: Item[]; name: string } => {
    const it = list[k]
    if (it.name) return { items: list, name: it.name }
    let n = 1
    while (namedItem(list, `${it.kind}${n}`) >= 0) n++
    const name = `${it.kind}${n}`
    return { items: list.map((x, j) => (j === k ? { ...x, name } : x)), name }
  }
  /** Un elemento spostato a mano lascia la casella e resta dov'è disegnato */
  const detach = (it: Item, k: number, from: Item[] = placed): Item =>
    it.kind !== 'arrow' && it.on
      ? ({ ...it, x: from[k].x, y: from[k].y, on: undefined } as Item)
      : it
  /**
   * L'elemento sotto il punto dello schermo, dall'alto: quelli bloccati e nascosti solo con
   * ⌥ / Alt; `skip` è un elemento da saltare (la freccia di cui si sposta un estremo)
   */
  const itemAt = (
    cx: number,
    cy: number,
    alt: boolean,
    skip?: number,
    noArrows = false
  ): number | null => {
    for (const el of document.elementsFromPoint(cx, cy)) {
      const h = el.closest('[data-item]')?.getAttribute('data-item')
      if (h == null) continue
      const k = Number(h)
      const it = items[k]
      if (!it || k === skip || it.hidden) continue
      // agganciando una freccia, quelle già agganciate non coprono l'elemento sotto
      if (noArrows && it.kind === 'arrow') continue
      if (it.lock && !alt) continue
      return k
    }
    return null
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
      case 'row':
      case 'hand':
        setPickingCard({ kind })
        return
      case 'zone':
        add({ kind, x: c.x - 40, y: c.y - 25, w: 80, h: 50, label: '', ...at })
        return
      case 'shape':
        add({ kind, shape: 'rect', x: c.x - 15, y: c.y - 15, w: 30, h: 30, label: '', ...at })
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
        // le frecce nuove nascono spesse 1 mm; quelle già scritte tengono il loro spessore di base
        add({ kind, x: c.x - 15, y: c.y, x2: c.x + 15, y2: c.y, thickness: 1, label: '', ...at })
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
    // gli elementi bloccati si scelgono solo con ⌥ / Alt + clic: il clic va a quelli sotto
    const hit = handle === null ? itemAt(e.clientX, e.clientY, e.altKey) : null
    const toggle = e.shiftKey || e.metaKey || e.ctrlKey
    const start = { ...p, orig: items, resolved: placed, boxes: view.boxes }
    if (handle !== null && single !== null) {
      drag.current = { mode: 'item', index: single, handle, ...start }
    } else if (hit !== null) {
      const index = hit
      // Maiuscolo o ⌘/Ctrl + clic aggiunge l'elemento alla scelta; se era già scelto lo toglie
      // al rilascio, ma solo se non lo si è trascinato
      if (toggle && !chosen.includes(index)) setSelection([...chosen, index])
      else if (!toggle && !chosen.includes(index)) setSelection([index])
      drag.current = {
        mode: 'item',
        index,
        handle: null,
        ...start,
        only: !toggle && chosen.length > 1 && chosen.includes(index),
        drop: toggle && chosen.includes(index)
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
      // i bloccati e i nascosti restano fuori
      const inside = view.boxes.flatMap((b, k) =>
        overlaps(b, box) && !items[k]?.lock && !items[k]?.hidden ? [k] : []
      )
      setSelection([...new Set([...d.add, ...inside])])
      return
    }
    const dx = p.x - d.x
    const dy = p.y - d.y
    const o = d.orig[d.index]
    // le posizioni come sono disegnate: una freccia agganciata parte dal bordo dell'elemento
    const ro = d.resolved[d.index] ?? o
    if (d.handle === 'rotate') {
      const b = d.boxes[d.index] ?? itemBox(ro, sets, templates)
      const deg = (Math.atan2(p.y - (b.y + b.h / 2), p.x - (b.x + b.w / 2)) * 180) / Math.PI + 90
      // con Maiuscolo a scatti di 15°, come nell'editor
      rotateTo(e.shiftKey ? Math.round(deg / 15) * 15 : deg, d.index, o)
      return
    }
    let patch: Partial<Item> | null = null
    if (d.handle === 'start' && ro.kind === 'arrow')
      patch = { x: snap(ro.x + dx), y: snap(ro.y + dy), fromItem: undefined }
    else if (d.handle === 'end' && ro.kind === 'arrow')
      patch = { x2: snap(ro.x2 + dx), y2: snap(ro.y2 + dy), toItem: undefined }
    else if (d.handle === 'bend' && ro.kind === 'arrow') {
      // la maniglia va dove si vuole: lontano dalla retta curva, lungo la freccia sposta il centro;
      // vicino alla retta torna dritta
      const { bend, shift } = bendTowards(ro, p)
      const straight = Math.abs(bend) < 1
      patch = {
        bend: straight ? undefined : bend,
        shift: straight || Math.abs(shift) < 1 ? undefined : shift
      }
    } else if (d.handle === 'size' && (o.kind === 'zone' || o.kind === 'shape')) {
      // con la zona ruotata lo spostamento si misura lungo i suoi lati; il centro si sposta di
      // metà, perché l'angolo in alto a sinistra resti fermo
      const a = ((o.rotate ?? 0) * Math.PI) / 180
      const du = dx * Math.cos(a) + dy * Math.sin(a)
      const dv = -dx * Math.sin(a) + dy * Math.cos(a)
      let w = Math.max(3, snap(o.w + du))
      let h = Math.max(3, snap(o.h + dv))
      // con Maiuscolo le proporzioni restano quelle di prima: cerchi e quadrati restano tali
      if (e.shiftKey && o.w > 0 && o.h > 0) {
        const k = Math.max(w / o.w, h / o.h)
        w = Math.round(o.w * k * 10) / 10
        h = Math.round(o.h * k * 10) / 10
      }
      // il centro dopo: l'angolo in alto a sinistra del rettangolo ruotato non si muove
      const ox = o.x + o.w / 2 - (o.w / 2) * Math.cos(a) + (o.h / 2) * Math.sin(a)
      const oy = o.y + o.h / 2 - (o.w / 2) * Math.sin(a) - (o.h / 2) * Math.cos(a)
      const cx = ox + (w / 2) * Math.cos(a) - (h / 2) * Math.sin(a)
      const cy = oy + (w / 2) * Math.sin(a) + (h / 2) * Math.cos(a)
      const tenth = (n: number): number => Math.round(n * 10) / 10
      patch = a ? { w, h, x: tenth(cx - w / 2), y: tenth(cy - h / 2) } : { w, h }
    } else if (d.handle === 'size' && (o.kind === 'image' || o.kind === 'text'))
      patch = { w: Math.max(o.kind === 'text' ? 10 : 3, snap(o.w + dx)) }
    if (patch) {
      change(patch, d.index)
      return
    }
    // si spostano insieme tutti gli elementi scelti, a passi di 1 mm rispetto al primo; quelli
    // bloccati restano fermi
    const moving = (chosen.includes(d.index) ? chosen : [d.index]).filter((k) => !d.orig[k]?.lock)
    if (!moving.length) return
    let mx = snap(ro.x + dx) - ro.x
    let my = snap(ro.y + dy) - ro.y
    // i lati e i centri si agganciano a quelli degli altri elementi (⌥ / Alt per non agganciare)
    const others = d.boxes.filter((_, k) => !moving.includes(k) && !d.orig[k]?.hidden)
    const own = moving.map((k) => d.boxes[k]).filter(Boolean)
    let hit: { x: number | null; y: number | null } = { x: null, y: null }
    if (!e.altKey && own.length && others.length) {
      const x1 = Math.min(...own.map((b) => b.x)) + mx
      const y1 = Math.min(...own.map((b) => b.y)) + my
      const x2 = Math.max(...own.map((b) => b.x + b.w)) + mx
      const y2 = Math.max(...own.map((b) => b.y + b.h)) + my
      const lines = linesOf(size ? [...others, { x: 0, y: 0, w: size.w, h: size.h }] : others)
      const snapped = snapBox({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, lines, SNAP_PX / scale)
      const tenth = (n: number): number => Math.round(n * 10) / 10
      if (snapped.x) mx = tenth(mx + snapped.x.delta)
      if (snapped.y) my = tenth(my + snapped.y.delta)
      hit = { x: snapped.x?.line ?? null, y: snapped.y?.line ?? null }
    }
    if (hit.x !== guides.x || hit.y !== guides.y) setGuides(hit)
    // un solo elemento trascinato sopra una plancia con la griglia: la casella sotto il suo centro
    let cell: typeof cellHint = null
    const one = moving.length === 1 ? moving[0] : -1
    if (one >= 0 && d.orig[one].kind !== 'arrow' && !e.altKey && d.boxes[one]) {
      const b = d.boxes[one]
      const cx = b.x + b.w / 2 + mx
      const cy = b.y + b.h / 2 + my
      for (let k = d.orig.length - 1; k >= 0; k--) {
        const board = d.resolved[k]
        const bb = d.boxes[k]
        if (k === one || !bb || board.hidden || (board.kind !== 'card' && board.kind !== 'deck'))
          continue
        if (board.on || cx < bb.x || cy < bb.y || cx > bb.x + bb.w || cy > bb.y + bb.h) continue
        const c = cellAt(board, bb, cx, cy, sets, templates)
        if (c) {
          cell = { item: one, board: k, ...c }
          break
        }
      }
    }
    if (
      cell?.board !== cellHint?.board ||
      cell?.row !== cellHint?.row ||
      cell?.col !== cellHint?.col
    )
      setCellHint(cell)
    if (mx || my) d.only = d.drop = false
    setItems(
      d.orig.map((it, k) =>
        moving.includes(k) && (mx || my) ? moveSetupItem(detach(it, k, d.resolved), mx, my) : it
      )
    )
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (d?.mode === 'item' && d.only) setSelection([d.index])
    if (d?.mode === 'item' && d.drop) setSelection(chosen.filter((k) => k !== d.index))
    // l'estremo di una freccia lasciato su un elemento si aggancia a lui
    if (d?.mode === 'item' && (d.handle === 'start' || d.handle === 'end')) {
      const k = itemAt(e.clientX, e.clientY, false, d.index, true)
      if (k !== null) {
        const n = named(items, k)
        const key = d.handle === 'start' ? 'fromItem' : 'toItem'
        setItems(n.items.map((it, j) => (j === d.index ? ({ ...it, [key]: n.name } as Item) : it)))
      }
    }
    // lasciato sopra una casella: ci si aggancia, e la segue
    if (d?.mode === 'item' && cellHint && !d.only) {
      const n = named(items, cellHint.board)
      setItems(
        n.items.map((it, j) =>
          j === cellHint.item && it.kind !== 'arrow'
            ? ({ ...it, on: { item: n.name, row: cellHint.row, col: cellHint.col } } as Item)
            : it
        )
      )
    }
    setCellHint(null)
    drag.current = null
    setFrozen(null)
    setMarquee(null)
    setPanning(false)
    setGuides({ x: null, y: null })
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
    setItems(
      items.map((it, k) =>
        chosen.includes(k) && !it.lock ? moveSetupItem(detach(it, k), m[0], m[1]) : it
      )
    )
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
  /** Maniglia tonda al centro di una freccia: trascinata di lato la curva */
  const bendHandle = (m: { x: number; y: number }): React.JSX.Element => (
    <circle
      key="bend"
      data-handle="bend"
      cx={m.x}
      cy={m.y}
      r={5 / scale}
      fill={BLUE}
      stroke="#fff"
      strokeWidth={1.5 / scale}
      style={{ cursor: 'move' }}
    >
      <title>{t('documents.setupBendHint')}</title>
    </circle>
  )
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
      {/* un lucchetto sugli elementi bloccati */}
      {items.map((it, k) =>
        it.lock && !it.hidden && view.boxes[k] ? (
          <text
            key={`lock${k}`}
            x={view.boxes[k].x + 1 / scale}
            y={view.boxes[k].y + 12 / scale}
            fontSize={11 / scale}
            pointerEvents="none"
          >
            🔒
          </text>
        ) : null
      )}
      {cellHint && (
        <rect
          x={cellHint.x - cellHint.size / 2}
          y={cellHint.y - cellHint.size / 2}
          width={cellHint.size}
          height={cellHint.size}
          rx={cellHint.size / 6}
          fill="rgba(230, 0, 126, 0.15)"
          stroke={GUIDE}
          strokeWidth={2 / scale}
          pointerEvents="none"
        />
      )}
      {guides.x !== null && (
        <line
          x1={guides.x}
          x2={guides.x}
          y1={area.y}
          y2={area.y + area.h}
          stroke={GUIDE}
          strokeWidth={1 / scale}
          pointerEvents="none"
        />
      )}
      {guides.y !== null && (
        <line
          x1={area.x}
          x2={area.x + area.w}
          y1={guides.y}
          y2={guides.y}
          stroke={GUIDE}
          strokeWidth={1 / scale}
          pointerEvents="none"
        />
      )}
      {sel && placedSel && box && !sel.lock && (
        <>
          {placedSel.kind === 'arrow'
            ? [
                handle('start', placedSel.x, placedSel.y),
                handle('end', placedSel.x2, placedSel.y2),
                bendHandle(arrowCurve(placedSel).mid)
              ]
            : sel.kind === 'zone' || sel.kind === 'shape'
              ? handle('size', ...corner(sel))
              : sel.kind === 'image' || sel.kind === 'text'
                ? handle('size', box.x + box.w, box.y + box.h)
                : null}
          {sel.kind !== 'arrow' && sel.kind !== 'row' && sel.kind !== 'hand' && rotateHandle(box)}
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

  /** Come si chiama l'elemento nel pannello dei livelli e negli elenchi */
  const describe = (it: Item): string => {
    const plain = (x: string): string => x.replace(/[*_~]/g, '').trim()
    const short = (x: string): string => (x.length > 40 ? `${x.slice(0, 39)}…` : x)
    const what =
      'label' in it && it.label
        ? plain(it.label)
        : it.kind === 'text'
          ? plain(it.text)
          : it.kind === 'card' || it.kind === 'deck'
            ? it.card
            : it.kind === 'row' || it.kind === 'hand'
              ? cardListSource(it.cards)
              : it.kind === 'image'
                ? it.src
                : it.kind === 'shape'
                  ? t(SHAPE_NAMES[it.shape])
                  : t(KINDS[it.kind])
    // il contenuto si riconosce, il nome dato agganciando no: il nome va tra parentesi
    return it.name
      ? `${short(what.replace(/\s+/g, ' '))} (${it.name})`
      : short(what.replace(/\s+/g, ' '))
  }
  /** Cambia il nome e i richiami di frecce e segnalini che lo usavano */
  const rename = (k: number, value: string): void => {
    const v = value.trim()
    if (v && !/^[\p{L}\p{N}_-]+$/u.test(v)) return
    const old = items[k].name
    const same = (n: string | undefined): boolean =>
      !!old && !!n && n.toLowerCase() === old.toLowerCase()
    setItems(
      items.map((it, j) => {
        let x = j === k ? ({ ...it, name: v || undefined } as Item) : it
        if (!old || !v) return x
        if (x.kind === 'arrow' && (same(x.fromItem) || same(x.toItem)))
          x = {
            ...x,
            ...(same(x.fromItem) ? { fromItem: v } : {}),
            ...(same(x.toItem) ? { toItem: v } : {})
          }
        if (x.kind !== 'arrow' && x.on && same(x.on.item))
          x = { ...x, on: { ...x.on, item: v } } as Item
        return x
      })
    )
  }
  /** Aggancia un estremo della freccia all'elemento k, o lo lascia libero dov'è (k = -1) */
  const attach = (end: 'fromItem' | 'toItem', k: number): void => {
    if (single === null || placedSel?.kind !== 'arrow') return
    if (k < 0) {
      const free =
        end === 'fromItem'
          ? { x: placedSel.x, y: placedSel.y, fromItem: undefined }
          : { x2: placedSel.x2, y2: placedSel.y2, toItem: undefined }
      change(free)
      return
    }
    const n = named(items, k)
    setItems(n.items.map((it, j) => (j === single ? ({ ...it, [end]: n.name } as Item) : it)))
  }
  /** Mette il segnalino sulla casella della plancia k, o lo toglie (k = -1) */
  const putOn = (k: number): void => {
    if (single === null || !sel || sel.kind === 'arrow') return
    if (k < 0) {
      setItems(items.map((it, j) => (j === single ? detach(it, j) : it)))
      return
    }
    const n = named(items, k)
    setItems(
      n.items.map((it, j) =>
        j === single && it.kind !== 'arrow'
          ? ({ ...it, on: { item: n.name, row: it.on?.row ?? 1, col: it.on?.col ?? 1 } } as Item)
          : it
      )
    )
  }
  /** Sceglie dal pannello dei livelli, come sul disegno */
  const pickLayer = (k: number, e: React.MouseEvent): void => {
    const toggle = e.shiftKey || e.metaKey || e.ctrlKey
    if (!toggle) setSelection([k])
    else setSelection(chosen.includes(k) ? chosen.filter((x) => x !== k) : [...chosen, k])
  }
  /** Colore di zone e forme: spento è `none`; uguale a quello di base non si scrive */
  const paintField = (
    label: string,
    key: 'fill' | 'stroke',
    value: string | undefined,
    base: string
  ): React.JSX.Element => (
    <ColorField
      label={label}
      nullable
      fallback={base === 'none' ? '#3a3a3c' : base}
      value={value === 'none' ? null : (value ?? (base === 'none' ? null : base))}
      onChange={(v) =>
        change({
          [key]: v === null ? (base === 'none' ? undefined : 'none') : v === base ? undefined : v
        } as Partial<Item>)
      }
    />
  )
  const lineField = (
    value: SetupLineStyle | undefined,
    base: SetupLineStyle
  ): React.JSX.Element => (
    <div className="setup-text">
      <span>{t('documents.setupLine')}</span>
      <Segmented<SetupLineStyle>
        value={value ?? base}
        onChange={(l) => change({ line: l === base ? undefined : l } as Partial<Item>)}
        options={[
          ['solid', <LineIcon key="solid" line="solid" />, t('documents.setupLine.solid')],
          ['dash', <LineIcon key="dash" line="dash" />, t('documents.setupLine.dash')],
          ['dot', <LineIcon key="dot" line="dot" />, t('documents.setupLine.dot')]
        ]}
      />
    </div>
  )
  /** Gli elementi a cui agganciare una freccia o un segnalino, con quello scelto */
  const targetSelect = (
    label: string,
    value: string | undefined,
    can: (it: Item, k: number) => boolean,
    onPick: (k: number) => void
  ): React.JSX.Element => {
    const at = value ? namedItem(items, value) : -1
    return (
      <label className="setup-select">
        {label}
        <select value={at} onChange={(e) => onPick(Number(e.target.value))}>
          <option value={-1}>{t('documents.setupNoTarget')}</option>
          {items.map((it, k) =>
            can(it, k) ? (
              <option key={k} value={k}>
                {`${t(KINDS[it.kind])}: ${describe(it)}`}
              </option>
            ) : null
          )}
        </select>
      </label>
    )
  }

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
          <div className="setup-layers">
            <span className="muted small">{t('documents.setupLayers')}</span>
            <ul>
              {items
                .map((it, k) => ({ it, k }))
                .reverse()
                .map(({ it, k }, p) => {
                  const dragProps = layerDrag.itemProps(p)
                  return (
                    <li
                      key={k}
                      {...dragProps}
                      className={[
                        'layer-row',
                        chosen.includes(k) && 'selected',
                        it.hidden && 'hidden',
                        dragProps.className
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={t('documents.setupLayersHint')}
                      onClick={(e) => pickLayer(k, e)}
                    >
                      <span className="layer-icon">
                        {ICONS[it.kind === 'shape' ? it.shape : it.kind]}
                      </span>
                      <span className="layer-name">{describe(it)}</span>
                      <button
                        className={`icon-btn${it.lock ? ' on' : ''}`}
                        title={it.lock ? t('layers.unlock') : t('layers.lock')}
                        onClick={(e) => {
                          e.stopPropagation()
                          change({ lock: it.lock ? undefined : true }, k)
                        }}
                      >
                        {it.lock ? '🔒' : '🔓'}
                      </button>
                      <button
                        className={`icon-btn${it.hidden ? ' on' : ''}`}
                        title={t(it.hidden ? 'layers.show' : 'documents.setupHideHint')}
                        onClick={(e) => {
                          e.stopPropagation()
                          change({ hidden: it.hidden ? undefined : true }, k)
                        }}
                      >
                        {it.hidden ? '–' : '👁'}
                      </button>
                    </li>
                  )
                })}
            </ul>
          </div>
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
            <div className="setup-stage" style={{ padding: FIT_PAD, fontFamily }}>
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
            ) : sel && single !== null ? (
              <>
                <h3>{t(KINDS[sel.kind])}</h3>
                {(sel.kind === 'card' || sel.kind === 'deck') && (
                  <>
                    <code className="setup-ref">{sel.card}</code>
                    <button onClick={() => setPickingCard({ kind: sel.kind, index: single })}>
                      {t('documents.setupChangeCard')}
                    </button>
                  </>
                )}
                {(sel.kind === 'row' || sel.kind === 'hand') && (
                  <div className="setup-text">
                    <span>{t('documents.setupCards')}</span>
                    <ul className="setup-cards">
                      {sel.cards.map((c, n) => (
                        <li key={n} {...cardDrag.itemProps(n)}>
                          <code>{c}</code>
                          <button
                            className="icon-btn"
                            disabled={sel.cards.length < 2}
                            title={t('documents.setupRemoveCard')}
                            onClick={() => change({ cards: sel.cards.filter((_, j) => j !== n) })}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button disabled={sel.cards.length >= 60} onClick={() => setAddingCard(single)}>
                      {t('documents.setupAddCard')}
                    </button>
                  </div>
                )}
                {sel.kind === 'image' && (
                  <>
                    <code className="setup-ref">{sel.src}</code>
                    <button onClick={() => setPickingImage({ index: single })}>
                      {t('documents.setupChangeImage')}
                    </button>
                  </>
                )}
                {sel.kind === 'shape' && (
                  <div className="setup-text">
                    <span>{t('documents.setupShapeKind')}</span>
                    <Segmented<SetupShape>
                      value={sel.shape}
                      onChange={(shape) => change({ shape })}
                      options={SETUP_SHAPES.map((k) => [
                        k,
                        <ShapeIcon key={k} shape={k} />,
                        t(SHAPE_NAMES[k])
                      ])}
                    />
                  </div>
                )}
                {sel.kind !== 'arrow' && (
                  <>
                    {sel.on || boards.some((k) => k !== single)
                      ? targetSelect(
                          t('documents.setupOnBoard'),
                          sel.on?.item,
                          (it, k) =>
                            k !== single &&
                            (boards.includes(k) || (!!it.name && it.name === sel.on?.item)),
                          putOn
                        )
                      : placed.some(
                          (it, k) => k !== single && (it.kind === 'card' || it.kind === 'deck')
                        ) && <p className="muted small">{t('documents.setupNoGrid')}</p>}
                    {sel.on && (
                      <div className="dialog-row">
                        {num(
                          t('documents.setupCellRow'),
                          sel.on.row,
                          (row) =>
                            change({ on: { ...sel.on!, row: Math.max(1, Math.round(row)) } }),
                          1
                        )}
                        {num(
                          t('documents.setupCellCol'),
                          sel.on.col,
                          (col) =>
                            change({ on: { ...sel.on!, col: Math.max(1, Math.round(col)) } }),
                          1
                        )}
                      </div>
                    )}
                  </>
                )}
                {!sel.on && sel.kind !== 'arrow' && (
                  <div className="dialog-row">
                    {num('x', sel.x, (x) => change({ x }))}
                    {num('y', sel.y, (y) => change({ y }))}
                  </div>
                )}
                {sel.kind === 'arrow' && placedSel?.kind === 'arrow' && (
                  <>
                    {targetSelect(
                      t('documents.setupFrom'),
                      sel.fromItem,
                      (it, k) => k !== single && it.kind !== 'arrow',
                      (k) => attach('fromItem', k)
                    )}
                    {!sel.fromItem && (
                      <div className="dialog-row">
                        {num('x', sel.x, (x) => change({ x }))}
                        {num('y', sel.y, (y) => change({ y }))}
                      </div>
                    )}
                    {targetSelect(
                      t('documents.setupTo'),
                      sel.toItem,
                      (it, k) => k !== single && it.kind !== 'arrow',
                      (k) => attach('toItem', k)
                    )}
                    {!sel.toItem && (
                      <div className="dialog-row">
                        {num('x2', sel.x2, (x2) => change({ x2 }))}
                        {num('y2', sel.y2, (y2) => change({ y2 }))}
                      </div>
                    )}
                    <p className="muted small">{t('documents.setupAttachHint')}</p>
                    <div className="dialog-row">
                      {num(t('documents.setupBend'), sel.bend ?? 0, (n) =>
                        change({ bend: n ? n : undefined, ...(n ? {} : { shift: undefined }) })
                      )}
                      {sel.bend
                        ? num(t('documents.setupShift'), sel.shift ?? 0, (n) =>
                            change({ shift: n ? n : undefined })
                          )
                        : null}
                    </div>
                    {num(
                      t('documents.setupArrowSize'),
                      (sel.size ?? 1) * 100,
                      (n) => change({ size: n > 0 && n !== 100 ? n / 100 : undefined }),
                      20
                    )}
                    {num(
                      t('documents.setupThickness'),
                      sel.thickness ?? 0.5 * (sel.size ?? 1),
                      (n) => change({ thickness: n > 0 ? n : undefined }),
                      0.1
                    )}
                    <ColorField
                      label={t('documents.setupColor')}
                      value={sel.color ?? '#3a3a3c'}
                      onChange={(v) => change({ color: !v || v === '#3a3a3c' ? undefined : v })}
                    />
                    {lineField(sel.line, 'solid')}
                    <div className="setup-text">
                      <span>{t('documents.setupHeads')}</span>
                      <Segmented<ArrowHeads>
                        value={sel.heads ?? 'end'}
                        onChange={(h) => change({ heads: h === 'end' ? undefined : h })}
                        options={[
                          ['end', <HeadsIcon key="e" heads="end" />, t('documents.setupHeadsEnd')],
                          [
                            'start',
                            <HeadsIcon key="s" heads="start" />,
                            t('documents.setupHeadsStart')
                          ],
                          [
                            'both',
                            <HeadsIcon key="b" heads="both" />,
                            t('documents.setupHeadsBoth')
                          ],
                          [
                            'none',
                            <HeadsIcon key="n" heads="none" />,
                            t('documents.setupHeadsNone')
                          ]
                        ]}
                      />
                    </div>
                  </>
                )}
                {(sel.kind === 'zone' || sel.kind === 'shape') && (
                  <>
                    <div className="dialog-row">
                      {num(t('documents.setupW'), sel.w, (w) => change({ w }), 3)}
                      {num(t('documents.setupH'), sel.h, (h) => change({ h }), 3)}
                    </div>
                    {sel.kind === 'shape' && (sel.shape === 'polygon' || sel.shape === 'star') && (
                      <div className="dialog-row">
                        {num(
                          t(
                            sel.shape === 'star' ? 'documents.setupPoints' : 'documents.setupSides'
                          ),
                          sel.sides ?? (sel.shape === 'star' ? 5 : 6),
                          (n) => change({ sides: Math.max(3, Math.min(40, Math.round(n))) }),
                          3
                        )}
                        {sel.shape === 'star' &&
                          num(
                            t('documents.setupInner'),
                            (sel.inner ?? 0.5) * 100,
                            (n) => change({ inner: Math.max(5, Math.min(100, n)) / 100 }),
                            5
                          )}
                      </div>
                    )}
                    {paintField(
                      t('documents.setupFill'),
                      'fill',
                      sel.fill,
                      sel.kind === 'zone' ? '#f6f6f6' : 'none'
                    )}
                    {paintField(
                      t('documents.setupStroke'),
                      'stroke',
                      sel.stroke,
                      sel.kind === 'zone' ? '#8e8e93' : '#3a3a3c'
                    )}
                    <div className="dialog-row">
                      {num(
                        t('documents.setupThickness'),
                        sel.thickness ?? (sel.kind === 'zone' ? 0.3 : 0.5),
                        (n) => change({ thickness: Math.max(0, n) }),
                        0
                      )}
                      {num(
                        t('documents.setupRadius'),
                        sel.radius ?? (sel.kind === 'zone' ? 3 : 0),
                        (n) => change({ radius: Math.max(0, n) }),
                        0
                      )}
                    </div>
                    {lineField(sel.line, sel.kind === 'zone' ? 'dash' : 'solid')}
                    {num(
                      t('documents.setupOpacity'),
                      (sel.opacity ?? 1) * 100,
                      (n) => {
                        const o = Math.max(0, Math.min(100, n)) / 100
                        change({ opacity: o < 1 ? o : undefined })
                      },
                      0
                    )}
                  </>
                )}
                {(sel.kind === 'text' || sel.kind === 'image') &&
                  num(t('documents.setupW'), sel.w, (w) => change({ w }), 3)}
                {sel.kind === 'text' && (
                  <>
                    <ColorField
                      label={t('documents.setupColor')}
                      value={sel.color ?? '#3a3a3c'}
                      onChange={(v) => change({ color: !v || v === '#3a3a3c' ? undefined : v })}
                    />
                    <ColorField
                      label={t('documents.setupOutline')}
                      nullable
                      fallback="#ffffff"
                      value={sel.stroke ?? null}
                      onChange={(v) =>
                        change({ stroke: v ?? undefined, ...(v ? {} : { thickness: undefined }) })
                      }
                    />
                    {sel.stroke &&
                      num(
                        t('documents.setupOutlineWidth'),
                        sel.thickness ?? SETUP_TEXT_OUTLINE,
                        (n) =>
                          change({
                            thickness: n > 0 && n !== SETUP_TEXT_OUTLINE ? n : undefined
                          }),
                        0.1
                      )}
                  </>
                )}
                {sel.kind === 'deck' &&
                  num(t('documents.setupCount'), sel.count, (count) => change({ count }), 1)}
                {sel.kind === 'row' && (
                  <>
                    {num(t('documents.setupGap'), sel.gap ?? SETUP_ROW_GAP, (n) =>
                      change({ gap: n === SETUP_ROW_GAP ? undefined : n })
                    )}
                    <div className="setup-text">
                      <span>{t('documents.setupDirection')}</span>
                      <Segmented<'right' | 'down'>
                        value={sel.direction ?? 'right'}
                        onChange={(d) => change({ direction: d === 'down' ? 'down' : undefined })}
                        options={[
                          ['right', t('documents.setupDirection.right')],
                          ['down', t('documents.setupDirection.down')]
                        ]}
                      />
                    </div>
                  </>
                )}
                {sel.kind === 'hand' &&
                  num(
                    t('documents.setupSpread'),
                    sel.spread ?? SETUP_HAND_SPREAD,
                    (n) => {
                      const v = Math.max(0, Math.min(180, n))
                      change({ spread: v === SETUP_HAND_SPREAD ? undefined : v })
                    },
                    0
                  )}
                {CARDISH.includes(sel.kind) &&
                  (sel.kind === 'card' ||
                    sel.kind === 'deck' ||
                    sel.kind === 'row' ||
                    sel.kind === 'hand') && (
                    <>
                      {num(
                        t('documents.setupZoom'),
                        (sel.scale ?? 1) * 100,
                        (n) => {
                          const v = Math.max(10, Math.min(1000, n)) / 100
                          change({ scale: v === 1 ? undefined : v })
                        },
                        10
                      )}
                      <div className="setup-text">
                        <span>{t('documents.setupLabelAt')}</span>
                        <Segmented<SetupLabelAt>
                          value={sel.labelAt ?? 'bottom'}
                          onChange={(a) => change({ labelAt: a === 'bottom' ? undefined : a })}
                          options={[
                            [
                              'bottom',
                              <LabelIcon key="bottom" at="bottom" />,
                              t('documents.setupLabelAt.bottom')
                            ],
                            [
                              'top',
                              <LabelIcon key="top" at="top" />,
                              t('documents.setupLabelAt.top')
                            ],
                            [
                              'left',
                              <LabelIcon key="left" at="left" />,
                              t('documents.setupLabelAt.left')
                            ],
                            [
                              'right',
                              <LabelIcon key="right" at="right" />,
                              t('documents.setupLabelAt.right')
                            ]
                          ]}
                        />
                      </div>
                    </>
                  )}
                {sel.kind !== 'arrow' && sel.kind !== 'row' && sel.kind !== 'hand' && (
                  <div className="dialog-row">
                    {num(t('documents.setupRotation'), sel.rotate ?? 0, (n) => rotateTo(n))}
                    <button onClick={() => rotateTo((sel.rotate ?? 0) + 90)}>
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
                    <Segmented<'left' | 'center' | 'right'>
                      value={sel.align ?? 'center'}
                      onChange={(a) => change({ align: a === 'center' ? undefined : a })}
                      options={[
                        ['left', t('align.left')],
                        ['center', t('align.center')],
                        ['right', t('align.right')]
                      ]}
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
                {sel.kind !== 'arrow' && (
                  <label className="setup-select" title={t('documents.setupNameHint')}>
                    {t('documents.setupName')}
                    <input
                      key={`name${single}`}
                      defaultValue={sel.name ?? ''}
                      onBlur={(e) => rename(single, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') rename(single, e.currentTarget.value)
                      }}
                    />
                  </label>
                )}
                <label className="setup-check" title={t('documents.setupLockHint')}>
                  <input
                    type="checkbox"
                    checked={!!sel.lock}
                    onChange={(e) => change({ lock: e.target.checked ? true : undefined })}
                  />
                  {t('documents.setupLock')}
                </label>
                <div className="setup-order">
                  <span>{t('documents.setupOrder')}</span>
                  <div className="setup-order-grid">
                    {(['top', 'up', 'down', 'bottom'] as SetupOrder[]).map((to) => (
                      <button
                        key={to}
                        disabled={!canReorderSetupItem(items, single, to === 'top' || to === 'up')}
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
                {!size && (
                  <div className="dialog-row">
                    {num(
                      t('documents.setupMargin'),
                      margin ?? SETUP_MARGIN,
                      (n) => setMargin(n === SETUP_MARGIN ? null : n),
                      0
                    )}
                  </div>
                )}
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
                <div className="dialog-row">
                  <WrapField value={wrap} onChange={setWrap} />
                </div>
                <p className="muted small">{t('documents.blockSizeHint')}</p>
                <CaptionField
                  value={caption}
                  top={captionTop}
                  onChange={setCaption}
                  onTop={setCaptionTop}
                />
                <p className="muted small">{t('documents.setupHint')}</p>
              </>
            )}
          </div>
        </div>
        <BlockCodeField className="setup-code" value={source} onApply={applyCode} />
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button className="primary" disabled={!items.length} onClick={() => onSave(source)}>
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
            if (p.kind === 'row' || p.kind === 'hand') {
              add({ kind: p.kind, cards: [card], from: 0, to: 0, x: at.x, y: at.y, label: '' })
              return
            }
            add(
              p.kind === 'deck'
                ? { kind: 'deck', card, count: 10, ...at }
                : { kind: 'card', card, ...at }
            )
          }}
          onClose={() => setPickingCard(null)}
        />
      )}
      {addingCard !== null && (
        <InsertCardDialog
          pick=""
          multiple
          sets={sets}
          templates={templates}
          project={project}
          onInsert={(list) => {
            const k = addingCard
            setAddingCard(null)
            const it = items[k]
            const added = parseCardList(list) ?? []
            if (it?.kind === 'row' || it?.kind === 'hand')
              change({ cards: [...it.cards, ...added].slice(0, SETUP_MAX_CARDS) }, k)
          }}
          onClose={() => setAddingCard(null)}
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
