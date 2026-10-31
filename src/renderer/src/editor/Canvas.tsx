import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  findLayer,
  transformInto,
  translateLayer,
  updateLayers,
  type Bounds
} from '../../../shared/model/edit'
import {
  HANDLES,
  ancestorsOf,
  anchorPoint,
  angleFrom,
  constrainAxis,
  handlePosition,
  hitTest,
  lineEnds,
  lineFromEnds,
  normalizeAngle,
  resizeWithHandle,
  snap,
  toFrame,
  toLocal,
  worldBounds,
  type Handle,
  type Point
} from '../../../shared/model/geometry'
import { cardArea, unionBounds } from '../../../shared/model/align'
import { linesOf, nearest, snapBox, type SnapLines } from '../../../shared/model/snap'
import { snapPoints } from '../../../shared/model/ttsSnap'
import { walkLayers } from '../../../shared/model/normalize'
import {
  innerLayers,
  isDrawn,
  type GridLayer,
  type Layer,
  type Template
} from '../../../shared/model/template'
import { gridGeometry } from '../../../shared/model/grid'
import { ruleAnchor } from '../../../shared/model/cells'
import CardSvg, { CardOutline } from '../render/CardSvg'
import { ShowEmptyContext } from '../render/assets'
import { useI18n } from '../i18n/context'
import { useLengthUnit } from '../units'
import { UNIT_LABEL, fromUnit, toUnit } from '../../../shared/model/units'
import type { EditorAction, EditorState } from './useEditor'
import { isRatioLocked } from './ratioLock'

/** Passo minimo in mm quando la griglia non è magnetica; Alt disattiva ogni aggancio */
const SNAP = 0.5
/** Distanza in pixel entro cui un lato si aggancia a un altro oggetto */
const SNAP_PX = 6
/** Distanza minima in pixel tra le linee della griglia disegnata */
const GRID_MIN_PX = 6
const HANDLE_PX = 8
/** Distanza in pixel entro cui si prende un livello sottile, come una linea */
const HIT_PX = 5
const ROTATE_PX = 22
const ZOOMS = [2, 3, 4, 6, 8, 12, 16]
const MIN_SCALE = 1
const MAX_SCALE = 60
/** Margine in mm intorno alla carta; si allarga per contenere i livelli usciti */
const PASTEBOARD = 10

type Gesture =
  | {
      kind: 'move'
      start: Template
      ids: string[]
      frame: Layer[]
      p0: Point
      ref: Layer
      /**
       * Livello in cima nel punto del clic, se non è quello trascinato: un clic senza trascinare
       * lo seleziona
       */
      top: string | null
      /**
       * Livello già selezionato premuto con Maiuscolo: un clic senza trascinare lo toglie dalla
       * selezione, un trascinamento sposta tutta la selezione
       */
      deselect: string | null
      /** Punto del clic sulla carta, in mm */
      down: Point
      /** Ingombro dei livelli spostati all'inizio del gesto */
      box: Bounds
      lines: SnapLines
    }
  | {
      kind: 'resize'
      start: Template
      layer: Layer
      frame: Layer[]
      handle: Handle
      lines: SnapLines
    }
  | { kind: 'rotate'; start: Template; layer: Layer; frame: Layer[]; a0: number }
  | { kind: 'guide'; start: Template; axis: 'x' | 'y'; index: number; frame: Layer[] }
  | {
      kind: 'end'
      start: Template
      layer: Layer
      end: 0 | 1
      frame: Layer[]
      lines: SnapLines
    }

interface Props {
  state: EditorState
  /** Template da disegnare: quello in modifica, o con i dati di una riga applicati */
  display: Template
  dispatch: React.Dispatch<EditorAction>
}

export default function Canvas({ state, display, dispatch }: Props): React.JSX.Element {
  const { t } = useI18n()
  const lengthUnit = useLengthUnit()
  const { template: tpl, side, selection, scope } = state
  const viewportRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<SVGSVGElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const marqueeStart = useRef<{ p0: Point; base: string[] } | null>(null)
  const [marquee, setMarquee] = useState<Bounds | null>(null)
  const [fitScale, setFitScale] = useState(4)
  const [zoom, setZoom] = useState<number | null>(null)
  const [guides, setGuides] = useState(loadGuides)
  // durante un gesto l'area intorno alla carta resta ferma, altrimenti la carta scivolerebbe
  const [frozen, setFrozen] = useState<Bounds | null>(null)
  // linee a cui si è agganciato il gesto in corso
  const [snapped, setSnapped] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null
  })
  const [stepText, setStepText] = useState(String(toUnit(guides.gridStep, lengthUnit)))
  // cambiata l'unità nelle impostazioni, il passo si riscrive nella nuova
  const [stepUnit, setStepUnit] = useState(lengthUnit)
  if (stepUnit !== lengthUnit) {
    setStepUnit(lengthUnit)
    setStepText(String(toUnit(guides.gridStep, lengthUnit)))
  }
  const setGuide = <K extends keyof Guides>(key: K, value: Guides[K]): void => {
    const next = { ...guides, [key]: value }
    setGuides(next)
    try {
      localStorage.setItem(GUIDES_KEY, JSON.stringify(next))
    } catch {
      // preferenza non essenziale
    }
  }

  // senza abbondanza la tela mostra la carta rifilata, con gli angoli arrotondati
  const b = guides.bleed ? tpl.bleed : 0
  const vw = tpl.width + 2 * b
  const vh = tpl.height + 2 * b
  const scale = zoom ?? fitScale
  const layers = tpl[side]
  const card = { x: -b, y: -b, w: vw, h: vh }
  // l'abbondanza fa parte della carta anche quando la guida è nascosta
  const bleedBox = {
    x: -tpl.bleed - 0.01,
    y: -tpl.bleed - 0.01,
    w: tpl.width + 2 * tpl.bleed + 0.02,
    h: tpl.height + 2 * tpl.bleed + 0.02
  }
  const stage = frozen ?? stageBounds(card, layers)

  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const update = (): void =>
      setFitScale(
        Math.max(1, Math.min((el.clientWidth - 32) / stage.w, (el.clientHeight - 32) / stage.h))
      )
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [stage.w, stage.h])

  // zoom con Cmd/Ctrl + rotella o con il pizzico sul trackpad, tenendo fermo il punto sotto il puntatore
  const scaleRef = useRef(scale)
  const anchor = useRef<{ mm: Point; cx: number; cy: number } | null>(null)
  useLayoutEffect(() => {
    scaleRef.current = scale
    const a = anchor.current
    const vp = viewportRef.current
    const ov = overlayRef.current
    if (!a || !vp || !ov) return
    anchor.current = null
    const r = ov.getBoundingClientRect()
    vp.scrollLeft += r.left + (a.mm.x - stage.x) * scale - a.cx
    vp.scrollTop += r.top + (a.mm.y - stage.y) * scale - a.cy
  }, [scale, stage.x, stage.y])
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const ov = overlayRef.current
      if (!ov) return
      const s = scaleRef.current
      const r = ov.getBoundingClientRect()
      anchor.current = {
        mm: { x: (e.clientX - r.left) / s + stage.x, y: (e.clientY - r.top) / s + stage.y },
        cx: e.clientX,
        cy: e.clientY
      }
      // uno scatto della rotella vale circa il 20%; i delta piccoli del trackpad danno uno zoom fluido
      const d = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 50)
      setZoom(Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * Math.exp(-d * 0.004))))
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [stage.x, stage.y])

  /** Punto della carta in mm sotto il puntatore */
  const cardPoint = (e: React.PointerEvent | React.MouseEvent): Point => {
    const r = overlayRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale + stage.x, y: (e.clientY - r.top) / scale + stage.y }
  }

  /** Tolleranza per le linee sottili: qualche pixel, a ogni ingrandimento */
  const hitPad = Math.max(0.6, HIT_PX / scale)

  /**
   * Livello colpito, prima nel gruppo in cui si è entrati e poi al primo livello. Con `below`
   * (Alt+clic) si prende il livello sotto quello selezionato nello stesso punto, e si ricomincia
   * dall'alto dopo l'ultimo. Con `keep` vale il livello già selezionato anche se è coperto da un
   * altro: così si trascina quello scelto con Alt+clic o nel pannello livelli.
   */
  const pick = (
    p: Point,
    below = false,
    keep = false
  ): { hit: Layer | null; scope: string | null } => {
    const choose = (list: Layer[], q: Point): Layer | null => {
      const hits = list.filter((l) => !l.locked && hitTest(l, q, hitPad))
      if (keep && !below) {
        const kept = hits.find((l) => selection.includes(l.id))
        if (kept) return kept
      }
      if (!below || hits.length < 2) return hits[0] ?? null
      const at = hits.findIndex((l) => selection.includes(l.id))
      return hits[(at + 1) % hits.length]
    }
    const group = scope ? findLayer(layers, scope) : null
    if (group && group.type === 'group') {
      const q = toFrame(p, [...ancestorsOf(layers, group.id), group])
      const hit = choose(group.children, q)
      if (hit) return { hit, scope }
    }
    return { hit: choose(layers, p), scope: null }
  }

  const frameOf = (id: string): Layer[] => ancestorsOf(layers, id)

  /** Lati e centri degli altri livelli dello stesso contenitore, della carta e dell'area sicura */
  const snapLines = (exclude: string[], frame: Layer[]): SnapLines => {
    const container = frame.length ? (innerLayers(frame[frame.length - 1]) ?? layers) : layers
    const boxes = container
      .filter((l) => isDrawn(l) && l.visible && !exclude.includes(l.id))
      .map((l) => worldBounds(l))
    const areas = [cardArea(tpl, 'card')]
    if (guides.safe) areas.push(cardArea(tpl, 'safe'))
    if (guides.bleed && tpl.bleed > 0) areas.push({ x: -tpl.bleed, y: -tpl.bleed, w: vw, h: vh })
    const lines = linesOf([...boxes, ...areas])
    return { x: [...lines.x, ...(tpl.guides?.x ?? [])], y: [...lines.y, ...(tpl.guides?.y ?? [])] }
  }

  const begin = (e: React.PointerEvent, g: Gesture): void => {
    gesture.current = g
    setFrozen(stage)
    overlayRef.current!.setPointerCapture(e.pointerId)
    dispatch({ type: 'gestureStart' })
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    const p = cardPoint(e)
    const { hit, scope: hitScope } = pick(p, e.altKey, !e.shiftKey)
    const top = e.altKey || e.shiftKey ? null : pick(p).hit
    if (!hit) {
      // sul vuoto si trascina un rettangolo di selezione
      if (!e.shiftKey) dispatch({ type: 'select', ids: [], scope })
      marqueeStart.current = { p0: p, base: e.shiftKey ? selection : [] }
      setFrozen(stage)
      overlayRef.current!.setPointerCapture(e.pointerId)
      return
    }
    const sameContainer = hitScope === scope
    const selected = selection.includes(hit.id) && sameContainer
    // Maiuscolo su un livello già selezionato: si decide al rilascio se toglierlo o trascinare
    const deselect = e.shiftKey && selected ? hit.id : null
    let ids: string[]
    if (e.shiftKey && sameContainer) ids = selected ? selection : [...selection, hit.id]
    else ids = selected ? selection : [hit.id]
    dispatch({ type: 'select', ids, scope: hitScope })
    const movable = ids.filter((id) => !findLayer(layers, id)?.locked)
    const frame = frameOf(hit.id)
    const boxes = movable
      .map((id) => findLayer(layers, id))
      .filter((l): l is Layer => !!l && isDrawn(l))
      .map((l) => worldBounds(l))
    begin(e, {
      kind: 'move',
      start: tpl,
      ids: movable,
      frame,
      p0: toFrame(p, frame),
      ref: hit,
      top: top && top.id !== hit.id ? top.id : null,
      deselect,
      down: p,
      box: boxes.length ? unionBounds(boxes) : worldBounds(hit),
      lines: snapLines(movable, frame)
    })
  }

  const onHandleDown = (e: React.PointerEvent, layer: Layer, handle: Handle | 'rotate'): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    const frame = frameOf(layer.id)
    if (handle === 'rotate') {
      const q = toFrame(cardPoint(e), frame)
      begin(e, { kind: 'rotate', start: tpl, layer, frame, a0: angleFrom(anchorPoint(layer), q) })
    } else
      begin(e, {
        kind: 'resize',
        start: tpl,
        layer,
        frame,
        handle,
        lines: snapLines([layer.id], frame)
      })
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    const m = marqueeStart.current
    if (m) {
      const p = cardPoint(e)
      const box = {
        x: Math.min(m.p0.x, p.x),
        y: Math.min(m.p0.y, p.y),
        w: Math.abs(p.x - m.p0.x),
        h: Math.abs(p.y - m.p0.y)
      }
      setMarquee(box)
      const group = scope ? findLayer(layers, scope) : null
      const list = group?.type === 'group' ? group.children : layers
      const chain = group?.type === 'group' ? [...frameOf(group.id), group] : []
      const inside = list
        .filter(
          (l) => isDrawn(l) && l.visible && !l.locked && intersects(worldBounds(l, chain), box)
        )
        .map((l) => l.id)
      dispatch({ type: 'select', ids: [...new Set([...m.base, ...inside])] })
      return
    }
    const g = gesture.current
    if (!g) return
    const q = toFrame(cardPoint(e), g.frame)
    const step = e.altKey ? 0 : guides.snapGrid ? guides.gridStep : SNAP
    const magnet = !e.altKey && guides.snapObjects
    const threshold = SNAP_PX / scale
    let next: Template
    if (g.kind === 'end') {
      // l'estremo di una linea: si aggancia a oggetti e griglia, Maiuscolo tiene l'angolo a 15°
      const ends = lineEnds(g.layer)
      const fixed = ends[1 - g.end]
      let p: Point
      if (e.shiftKey) {
        const len = Math.hypot(q.x - fixed.x, q.y - fixed.y)
        const a =
          (snap((Math.atan2(q.y - fixed.y, q.x - fixed.x) * 180) / Math.PI, 15) * Math.PI) / 180
        p = { x: fixed.x + len * Math.cos(a), y: fixed.y + len * Math.sin(a) }
        setSnapped({ x: null, y: null })
      } else {
        const hx = magnet ? nearest([q.x], g.lines.x, threshold) : null
        const hy = magnet ? nearest([q.y], g.lines.y, threshold) : null
        p = { x: hx ? hx.line : snap(q.x, step), y: hy ? hy.line : snap(q.y, step) }
        setSnapped({ x: hx?.line ?? null, y: hy?.line ?? null })
      }
      const [a, b] = g.end === 0 ? [p, fixed] : [fixed, p]
      next = replace(g.start, side, g.layer.id, {
        ...g.layer,
        ...lineFromEnds(g.layer, a, b)
      } as Layer)
    } else if (g.kind === 'guide') {
      // una guida si aggancia ai lati e al centro della carta e dell'area sicura
      const v = g.axis === 'x' ? q.x : q.y
      const card = linesOf([cardArea(tpl, 'card'), cardArea(tpl, 'safe')])[g.axis]
      const hit = magnet ? nearest([v], card, threshold) : null
      const value = hit ? hit.line : snap(v, step)
      setSnapped(g.axis === 'x' ? { x: value, y: null } : { x: null, y: value })
      const list = [...(g.start.guides?.[g.axis] ?? [])]
      list[g.index] = value
      const all = g.start.guides ?? { x: [], y: [] }
      next = { ...g.start, guides: { ...all, [g.axis]: list } }
    } else if (g.kind === 'move') {
      let rx = q.x - g.p0.x
      let ry = q.y - g.p0.y
      // Maiuscolo: solo in orizzontale, in verticale o a 45°, nella direzione più vicina
      const axis = e.shiftKey ? constrainAxis(rx, ry) : null
      if (axis === 'x') ry = 0
      else if (axis === 'y') rx = 0
      else if (axis === 'diagonal') {
        // la distanza sulla diagonale va a passi della griglia
        const d = snap((Math.abs(rx) + Math.abs(ry)) / 2, step)
        rx = Math.sign(rx) * d
        ry = Math.sign(ry) * d
      }
      // un lato o il centro vicino a un altro oggetto ha la precedenza sulla griglia
      const hit = magnet
        ? snapBox({ ...g.box, x: g.box.x + rx, y: g.box.y + ry }, g.lines, threshold)
        : { x: null, y: null }
      // l'asse bloccato non si aggancia; in diagonale nessun aggancio, per restare a 45°
      if (axis === 'y' || axis === 'diagonal') hit.x = null
      if (axis === 'x' || axis === 'diagonal') hit.y = null
      const free = axis === 'diagonal'
      // sulla griglia si aggancia l'angolo del livello preso, gli altri lo seguono
      const dx = hit.x
        ? rx + hit.x.delta
        : axis === 'y' || free
          ? rx
          : snap(g.ref.x + rx, step) - g.ref.x
      const dy = hit.y
        ? ry + hit.y.delta
        : axis === 'x' || free
          ? ry
          : snap(g.ref.y + ry, step) - g.ref.y
      setSnapped({ x: hit.x?.line ?? null, y: hit.y?.line ?? null })
      next = updateLayers(g.start, side, (l) =>
        g.ids.includes(l.id) ? translateLayer(l, dx, dy) : l
      )
    } else if (g.kind === 'resize') {
      let local = toLocal(g.layer, q)
      let resizeStep = step
      // il lato trascinato si aggancia agli oggetti solo se il livello non è ruotato
      if (magnet && !g.layer.rotation) {
        const h = g.handle
        const hx =
          h.includes('e') || h.includes('w') ? nearest([local.x], g.lines.x, threshold) : null
        const hy =
          h.includes('n') || h.includes('s') ? nearest([local.y], g.lines.y, threshold) : null
        local = {
          x: hx ? hx.line : snap(local.x, step),
          y: hy ? hy.line : snap(local.y, step)
        }
        resizeStep = 0
        setSnapped({ x: hx?.line ?? null, y: hy?.line ?? null })
      }
      const box = resizeWithHandle(g.layer, g.handle, local, {
        // Maiuscolo inverte il blocco delle proporzioni; Cmd (Ctrl su Windows) dal centro
        keepRatio: e.shiftKey !== isRatioLocked(g.layer.type),
        step: resizeStep,
        fromCenter: e.metaKey || e.ctrlKey
      })
      next = replace(g.start, side, g.layer.id, applyBounds(g.layer, box))
    } else {
      const raw = g.layer.rotation + angleFrom(anchorPoint(g.layer), q) - g.a0
      const rotation = normalizeAngle(e.shiftKey ? snap(raw, 15) : Math.round(raw * 10) / 10)
      next = replace(g.start, side, g.layer.id, { ...g.layer, rotation } as Layer)
    }
    dispatch({ type: 'gestureUpdate', template: next })
  }

  const onPointerUp = (e: React.PointerEvent): void => {
    if (marqueeStart.current) {
      marqueeStart.current = null
      setMarquee(null)
      setFrozen(null)
      overlayRef.current?.releasePointerCapture(e.pointerId)
      return
    }
    if (!gesture.current) return
    const ended = gesture.current
    gesture.current = null
    // una guida trascinata fuori dalla carta si toglie
    if (ended.kind === 'guide') {
      const list = tpl.guides?.[ended.axis] ?? []
      const v = list[ended.index]
      const size = ended.axis === 'x' ? tpl.width : tpl.height
      if (v !== undefined && (v < -tpl.bleed || v > size + tpl.bleed)) {
        const guides = tpl.guides ?? { x: [], y: [] }
        dispatch({
          type: 'gestureUpdate',
          template: {
            ...tpl,
            guides: { ...guides, [ended.axis]: list.filter((_, i) => i !== ended.index) }
          }
        })
      }
    }
    setFrozen(null)
    setSnapped({ x: null, y: null })
    overlayRef.current?.releasePointerCapture(e.pointerId)
    dispatch({ type: 'gestureEnd' })
    if (ended.kind === 'move') {
      const p = cardPoint(e)
      const click = Math.hypot(p.x - ended.down.x, p.y - ended.down.y) * scale < 3
      if (click && ended.deselect)
        // Maiuscolo + clic senza trascinare su un livello selezionato lo toglie dalla selezione
        dispatch({ type: 'select', ids: selection.filter((id) => id !== ended.deselect) })
      else if (click && ended.top) {
        // un clic senza trascinare sopra il livello selezionato ma coperto sceglie quello in cima
        const { hit, scope: hitScope } = pick(p)
        if (hit) dispatch({ type: 'select', ids: [hit.id], scope: hitScope })
      }
    }
  }

  /**
   * Doppio clic su una griglia: si entra nel gruppo della casella cliccata (quello del contenuto
   * o di una regola) e si seleziona il livello sotto il puntatore, che sta nella prima casella
   */
  const enterGrid = (grid: GridLayer, p: Point): void => {
    const q = toLocal(grid, toFrame(p, frameOf(grid.id)))
    const { centers } = gridGeometry(grid)
    if (!centers.length) return
    const local = { x: q.x - grid.x, y: q.y - grid.y }
    let k = 0
    centers.forEach((c, i) => {
      if (
        Math.hypot(c.x - local.x, c.y - local.y) <
        Math.hypot(centers[k].x - local.x, centers[k].y - local.y)
      )
        k = i
    })
    // il gruppo che la casella disegna: quello della regola, se una regola lo cambia
    const drawn = walkLayers(display[side]).find((l) => l.id === grid.id)
    const name = (drawn?.type === 'grid' && drawn.cells?.[k]?.name) || grid.content.trim()
    const group = grid.groups.find((g) => g.name === name)
    if (!group) return
    // il gruppo sta nella prima casella, o in quella di riferimento della sua regola
    const rule =
      grid.content.trim() === name
        ? -1
        : grid.cellRules.findIndex((r) => r.content?.trim() === name)
    const home = centers[rule >= 0 ? ruleAnchor(grid, rule) : 0] ?? centers[0]
    const at = { x: q.x + home.x - centers[k].x, y: q.y + home.y - centers[k].y }
    const child = group.children.find((l) => !l.locked && hitTest(l, at, hitPad))
    dispatch({ type: 'select', ids: [child?.id ?? group.id], scope: child ? group.id : grid.id })
  }

  /** Doppio clic su un gruppo: si entra nel gruppo e si seleziona il figlio sotto il puntatore */
  const onDoubleClick = (e: React.MouseEvent): void => {
    const p = cardPoint(e)
    const { hit } = pick(p)
    if (hit?.type === 'grid') return enterGrid(hit, p)
    if (!hit || hit.type !== 'group') return
    const q = toFrame(p, [...frameOf(hit.id), hit])
    const child = hit.children.find((l) => !l.locked && hitTest(l, q, hitPad))
    dispatch({ type: 'select', ids: child ? [child.id] : [], scope: hit.id })
  }

  const px = 1 / scale
  const selected = selection
    .map((id) => findLayer(layers, id))
    .filter((l): l is Layer => l !== null && isDrawn(l))
  const scopeGroup = scope ? findLayer(layers, scope) : null

  return (
    <>
      <div
        className="canvas-viewport"
        ref={viewportRef}
        onPointerDown={(e) => {
          // anche fuori dalla carta si può iniziare un rettangolo di selezione
          if (e.target !== e.currentTarget || e.button !== 0) return
          // un clic sulle barre di scorrimento (su Windows occupano spazio) non deseleziona
          const el = e.currentTarget
          const r = el.getBoundingClientRect()
          if (e.clientX - r.left >= el.clientWidth || e.clientY - r.top >= el.clientHeight) return
          if (!e.shiftKey) dispatch({ type: 'select', ids: [], scope: null })
          marqueeStart.current = { p0: cardPoint(e), base: e.shiftKey ? selection : [] }
          setFrozen(stage)
          overlayRef.current?.setPointerCapture(e.pointerId)
        }}
      >
        <div className="canvas-stage" style={{ width: stage.w * scale, height: stage.h * scale }}>
          <ShowEmptyContext.Provider value={true}>
            <CardSvg
              template={display}
              side={side}
              scale={scale}
              mode={guides.bleed ? 'bleed' : 'trim'}
              pasteboard={stage}
            />
          </ShowEmptyContext.Provider>
          <svg
            ref={overlayRef}
            className="canvas-overlay"
            width={stage.w * scale}
            height={stage.h * scale}
            viewBox={`${stage.x} ${stage.y} ${stage.w} ${stage.h}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={onDoubleClick}
          >
            {guides.grid && <GridLines stage={stage} step={guides.gridStep} scale={scale} />}
            {guides.safe && (
              <CardOutline
                template={tpl}
                inset={tpl.safeMargin}
                className="safe-area"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {(['x', 'y'] as const).map((axis) =>
              (tpl.guides?.[axis] ?? []).map((v, index) => {
                const line =
                  axis === 'x'
                    ? { x1: v, x2: v, y1: stage.y, y2: stage.y + stage.h }
                    : { x1: stage.x, x2: stage.x + stage.w, y1: v, y2: v }
                return (
                  <g key={`${axis}${index}`} className={`manual-guide ${axis}`}>
                    <line {...line} vectorEffect="non-scaling-stroke" />
                    {/* linea larga e invisibile: si prende facilmente col mouse */}
                    <line
                      {...line}
                      className="manual-guide-hit"
                      style={{ strokeWidth: 8 * px }}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return
                        e.stopPropagation()
                        begin(e, { kind: 'guide', start: tpl, axis, index, frame: [] })
                      }}
                    >
                      <title>{t('editor.guideDragHint')}</title>
                    </line>
                  </g>
                )
              })
            )}
            {/* i livelli che escono dalla carta hanno un contorno: si ritrovano anche se chiari */}
            {layers
              .filter((l) => isDrawn(l) && l.visible && !inside(worldBounds(l, []), bleedBox))
              .map((l) => (
                <Framed key={l.id} chain={[]} layer={l}>
                  <Outline b={l} className="outside-outline" />
                </Framed>
              ))}
            {/* snap point di Tabletop Simulator: non si stampano, si vedono solo qui */}
            {(guides.ttsSnaps ? snapPoints(display[side]) : []).map((p, i) => (
              <g key={`snap${i}`} className="tts-snap" transform={`translate(${p.x} ${p.y})`}>
                <circle r={6 * px} vectorEffect="non-scaling-stroke" />
                <path
                  d={`M${-9 * px} 0H${9 * px}M0 ${-9 * px}V${9 * px}`}
                  vectorEffect="non-scaling-stroke"
                />
                {/* come in TTS: la freccia punta dove andrà il lato alto dell'oggetto */}
                {p.angle !== null && (
                  <path
                    className="tts-snap-dir"
                    d={`M0 0V${-16 * px}M${-4 * px} ${-12 * px}L0 ${-16 * px}L${4 * px} ${-12 * px}`}
                    transform={`rotate(${p.angle})`}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {p.tags.length > 0 && <title>{p.tags.join(', ')}</title>}
              </g>
            ))}
            {snapped.x !== null && (
              <line
                x1={snapped.x}
                x2={snapped.x}
                y1={stage.y}
                y2={stage.y + stage.h}
                className="snap-guide"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {snapped.y !== null && (
              <line
                x1={stage.x}
                x2={stage.x + stage.w}
                y1={snapped.y}
                y2={snapped.y}
                className="snap-guide"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {marquee && (
              <rect
                x={marquee.x}
                y={marquee.y}
                width={marquee.w}
                height={marquee.h}
                className="marquee"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {scopeGroup && (
              <Framed chain={frameOf(scopeGroup.id)} layer={scopeGroup}>
                <Outline b={scopeGroup} className="scope-outline" />
              </Framed>
            )}
            {selected.map((l) => (
              <Framed key={l.id} chain={frameOf(l.id)} layer={l}>
                <Outline b={l} className={l.locked ? 'sel-outline locked' : 'sel-outline'} />
                {selected.length === 1 && !l.locked && l.type === 'shape' && l.shape === 'line' && (
                  <>
                    {[l.x, l.x + l.w].map((x, i) => (
                      <circle
                        key={i}
                        cx={x}
                        cy={l.y + l.h / 2}
                        r={(HANDLE_PX / 2) * px}
                        className="handle line-end"
                        vectorEffect="non-scaling-stroke"
                        onPointerDown={(e) => {
                          if (e.button !== 0) return
                          e.stopPropagation()
                          begin(e, {
                            kind: 'end',
                            start: tpl,
                            layer: l,
                            end: i as 0 | 1,
                            frame: frameOf(l.id),
                            lines: snapLines([l.id], frameOf(l.id))
                          })
                        }}
                      />
                    ))}
                  </>
                )}
                {selected.length === 1 &&
                  !l.locked &&
                  !(l.type === 'shape' && l.shape === 'line') && (
                    <>
                      <line
                        x1={l.x + l.w / 2}
                        y1={l.y}
                        x2={l.x + l.w / 2}
                        y2={l.y - ROTATE_PX * px}
                        className="sel-outline"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        cx={l.x + l.w / 2}
                        cy={l.y - ROTATE_PX * px}
                        r={(HANDLE_PX / 2) * px}
                        className="handle rotate"
                        vectorEffect="non-scaling-stroke"
                        onPointerDown={(e) => onHandleDown(e, l, 'rotate')}
                      >
                        <title>{t('editor.rotateHint')}</title>
                      </circle>
                      {/* una griglia con la casella fissa prende la misura dalle caselle */}
                      {!(l.type === 'grid' && l.cellSize) &&
                        HANDLES.map((h) => {
                          const pos = handlePosition(l, h)
                          return (
                            <rect
                              key={h}
                              x={pos.x - (HANDLE_PX / 2) * px}
                              y={pos.y - (HANDLE_PX / 2) * px}
                              width={HANDLE_PX * px}
                              height={HANDLE_PX * px}
                              className={`handle h-${h}`}
                              vectorEffect="non-scaling-stroke"
                              onPointerDown={(e) => onHandleDown(e, l, h)}
                            />
                          )
                        })}
                    </>
                  )}
              </Framed>
            ))}
          </svg>
        </div>
      </div>
      <div className="zoom-controls">
        <button
          className={guides.bleed ? 'active' : ''}
          aria-pressed={guides.bleed}
          onClick={() => setGuide('bleed', !guides.bleed)}
          title={t('tip.showBleed')}
        >
          {t('editor.showBleed')}
        </button>
        <button
          className={guides.safe ? 'active' : ''}
          aria-pressed={guides.safe}
          onClick={() => setGuide('safe', !guides.safe)}
          title={t('tip.showSafe')}
        >
          {t('editor.showSafe')}
        </button>
        {walkLayers(layers).some((l) => l.snap) && (
          <button
            className={guides.ttsSnaps ? 'active' : ''}
            aria-pressed={guides.ttsSnaps}
            onClick={() => setGuide('ttsSnaps', !guides.ttsSnaps)}
            title={t('tip.showSnaps')}
          >
            {t('editor.showSnaps')}
          </button>
        )}
        <span className="zoom-sep" />
        <button
          className={guides.grid ? 'active' : ''}
          aria-pressed={guides.grid}
          onClick={() => setGuide('grid', !guides.grid)}
          title={t('tip.showGrid')}
        >
          {t('editor.showGrid')}
        </button>
        <input
          className="num grid-step"
          title={t('editor.gridStep')}
          value={stepText}
          onChange={(e) => {
            setStepText(e.target.value)
            const n = fromUnit(Number(e.target.value.replace(',', '.')), lengthUnit)
            if (Number.isFinite(n) && n >= 0.1 && n <= 50) setGuide('gridStep', n)
          }}
          onBlur={() => setStepText(String(toUnit(guides.gridStep, lengthUnit)))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        <span className="muted small">{UNIT_LABEL[lengthUnit]}</span>
        <span className="zoom-sep" />
        <span className="muted small" title={t('editor.snapHint')}>
          {t('editor.snap')}
        </span>
        <button
          className={guides.snapGrid ? 'active' : ''}
          aria-pressed={guides.snapGrid}
          title={t('editor.snapHint')}
          onClick={() => setGuide('snapGrid', !guides.snapGrid)}
        >
          {t('editor.snapGrid')}
        </button>
        <button
          className={guides.snapObjects ? 'active' : ''}
          aria-pressed={guides.snapObjects}
          title={t('editor.snapHint')}
          onClick={() => setGuide('snapObjects', !guides.snapObjects)}
        >
          {t('editor.snapObjects')}
        </button>
        <span className="zoom-sep" />
        <button onClick={() => setZoom(stepZoom(scale, -1))} title={t('editor.zoomOut')}>
          −
        </button>
        <button
          className={zoom === null ? 'active' : ''}
          onClick={() => setZoom(null)}
          title={t('tip.zoomFit')}
        >
          {t('editor.zoomFit')}
        </button>
        <button onClick={() => setZoom(stepZoom(scale, 1))} title={t('editor.zoomIn')}>
          +
        </button>
        <span className="muted small" title={t('editor.zoomHint')}>
          {Math.round((scale / 3.78) * 100)}%
        </span>
      </div>
    </>
  )
}

interface Guides {
  bleed: boolean
  safe: boolean
  /** Griglia disegnata sulla tela e suo passo in mm */
  grid: boolean
  gridStep: number
  /** Spostamenti e ridimensionamenti si agganciano alla griglia */
  snapGrid: boolean
  /** Lati e centri si agganciano a quelli degli altri oggetti e della carta */
  snapObjects: boolean
  /** Mirini degli snap point di Tabletop Simulator: nasconderli non li toglie dall'esportazione */
  ttsSnaps: boolean
}

const GUIDES_KEY = 'editorGuides'

const DEFAULT_GUIDES: Guides = {
  bleed: true,
  safe: true,
  grid: false,
  gridStep: 5,
  snapGrid: false,
  snapObjects: true,
  ttsSnaps: true
}

function loadGuides(): Guides {
  try {
    return { ...DEFAULT_GUIDES, ...JSON.parse(localStorage.getItem(GUIDES_KEY) ?? '{}') }
  } catch {
    return DEFAULT_GUIDES
  }
}

/** Griglia con origine nell'angolo della carta; se è troppo fitta si disegna una linea ogni tanto */
function GridLines({
  stage,
  step,
  scale
}: {
  stage: Bounds
  step: number
  scale: number
}): React.JSX.Element {
  const every = Math.max(1, Math.ceil(GRID_MIN_PX / (step * scale)))
  const s = step * every
  const xs: number[] = []
  const ys: number[] = []
  for (let x = Math.ceil(stage.x / s) * s; x <= stage.x + stage.w; x += s) xs.push(x)
  for (let y = Math.ceil(stage.y / s) * s; y <= stage.y + stage.h; y += s) ys.push(y)
  return (
    <g className="grid-lines">
      {xs.map((x) => (
        <line
          key={`x${x}`}
          x1={x}
          x2={x}
          y1={stage.y}
          y2={stage.y + stage.h}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {ys.map((y) => (
        <line
          key={`y${y}`}
          x1={stage.x}
          x2={stage.x + stage.w}
          y1={y}
          y2={y}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  )
}

/** Disegna i figli nel sistema del livello: rotazioni dei gruppi che lo contengono e la sua */
function Framed({
  chain,
  layer,
  children
}: {
  chain: Layer[]
  layer: Layer
  children: React.ReactNode
}): React.JSX.Element {
  return [...chain, layer].reduceRight<React.JSX.Element>(
    (inner, l) => {
      const a = anchorPoint(l)
      return (
        <g transform={l.rotation ? `rotate(${l.rotation} ${a.x} ${a.y})` : undefined}>{inner}</g>
      )
    },
    <>{children}</>
  )
}

function Outline({ b, className }: { b: Bounds; className: string }): React.JSX.Element {
  return (
    <rect
      x={b.x}
      y={b.y}
      width={b.w}
      height={b.h}
      className={className}
      vectorEffect="non-scaling-stroke"
    />
  )
}

/** Carta con un margine, allargata ai livelli che ne escono */
function stageBounds(card: Bounds, layers: Layer[]): Bounds {
  let x1 = card.x - PASTEBOARD
  let y1 = card.y - PASTEBOARD
  let x2 = card.x + card.w + PASTEBOARD
  let y2 = card.y + card.h + PASTEBOARD
  for (const l of layers) {
    if (!isDrawn(l) || !l.visible) continue
    const w = worldBounds(l, [])
    x1 = Math.min(x1, w.x - 2)
    y1 = Math.min(y1, w.y - 2)
    x2 = Math.max(x2, w.x + w.w + 2)
    y2 = Math.max(y2, w.y + w.h + 2)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

function inside(a: Bounds, b: Bounds): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
}

function intersects(a: Bounds, b: Bounds): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

function applyBounds(l: Layer, b: Bounds): Layer {
  return l.type === 'group' || l.type === 'grid' ? transformInto(l, b) : ({ ...l, ...b } as Layer)
}

function replace(t: Template, side: 'front' | 'back', id: string, layer: Layer): Template {
  return updateLayers(t, side, (l) => (l.id === id ? layer : l))
}

/** 3.78 px/mm è il 100% a 96 dpi */
function stepZoom(current: number, dir: 1 | -1): number {
  const levels = ZOOMS.map((z) => z * 3.78 * 0.25)
  if (dir > 0) return levels.find((z) => z > current + 0.01) ?? levels[levels.length - 1]
  return [...levels].reverse().find((z) => z < current - 0.01) ?? levels[0]
}
