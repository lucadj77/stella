import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoundCard } from '../../../shared/model/bind'
import {
  COMFORT_DEG,
  confusedPairs,
  colorIsOnlySignal,
  contrastRatio,
  iconVerdict,
  minContrast,
  parseColor,
  readableUpToCm,
  readingOf,
  textVerdict,
  upsideDownReading,
  xHeightMm
} from '../../../shared/model/legibility'
import { walkLayers } from '../../../shared/model/normalize'
import type { Layer, Side, TextLayer } from '../../../shared/model/template'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import CardSvg from '../render/CardSvg'
import { loadCatalog } from './fontCatalog'
import { xRatio } from '../legibility/xRatio'

/** Un'immagine più piccola di così (il lato più lungo, in mm) si controlla come un'icona */
const ICON_MAX_MM = 15
/** Un testo più lungo di così è testo da leggere, non un titolo */
const LONG_TEXT = 80

interface Place {
  row: number
  side: Side
}

interface Measured extends Place {
  /** Testi che non stanno nel riquadro, e quelli fra loro con il corpo fisso */
  overflow: string[]
  fixed: string[]
  /** Testi con il corpo usato davvero (dopo la riduzione) e l'altezza della x in mm */
  texts: { name: string; pt: number; mm: number; content: string }[]
  /** Icone nel testo e immagini piccole: altezza in mm */
  icons: { name: string; mm: number }[]
}

/** Un problema di un livello, con i componenti in cui c'è */
interface Group {
  key: string
  side: Side
  name: string
  detail?: string
  /** Il problema è grave: il nome in rosso */
  bad: boolean
  rows: number[]
}

/** Raccoglie i problemi per faccia, livello e dettaglio, nell'ordine in cui arrivano */
class Groups {
  private map = new Map<string, Group>()
  add(p: Place, name: string, bad: boolean, extra: { detail?: string } = {}): void {
    const key = `${p.side}|${name}|${extra.detail ?? ''}`
    const g = this.map.get(key)
    if (g) {
      if (!g.rows.includes(p.row)) g.rows.push(p.row)
      g.bad ||= bad
    } else this.map.set(key, { key, side: p.side, name, bad, rows: [p.row], ...extra })
  }
  list(): Group[] {
    return [...this.map.values()]
  }
}

/** Il primo riempimento pieno sotto il testo che ne contiene il centro; null se è un'immagine */
function backgroundOf(layers: Layer[], i: number): string | null {
  const text = layers[i]
  const cx = text.x + text.w / 2
  const cy = text.y + text.h / 2
  for (const l of layers.slice(i + 1)) {
    if (!l.visible || l.opacity < 0.9) continue
    if (cx < l.x || cx > l.x + l.w || cy < l.y || cy > l.y + l.h) continue
    if (l.type === 'image' && l.src) return null
    if (l.type === 'grid') return null
    if (l.type === 'shape' && l.fill) {
      const c = parseColor(l.fill)
      if (!c) return null
      if (c.a > 0.9) return l.fill
    }
  }
  // sotto non c'è niente: la carta, bianca in stampa
  return '#ffffff'
}

function layersOf(c: BoundCard, side: Side): Layer[] {
  return walkLayers(c.template[side])
}

/**
 * Controllo della leggibilità di tutte le carte del set, fronte e retro: le disegna fuori dalla
 * vista, aspetta i font e misura testi e icone; contrasto, colori e numeri capovolti vengono dal
 * template già legato ai dati. Sono solo avvisi: l'esportazione non si blocca mai.
 */
export default function LegibilityDialog({
  cards,
  onPick,
  onClose
}: {
  cards: BoundCard[]
  onPick(row: number): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const stage = useRef<HTMLDivElement>(null)
  const [measured, setMeasured] = useState<Measured[] | null>(null)
  const [reduced, setReduced] = useState(false)
  const [fontKinds, setFontKinds] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    let alive = true
    loadCatalog()
      .then((cat) => {
        if (alive) setFontKinds(new Map(cat.families.map((f) => [f[0], f[1]])))
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    const collect = (): void => {
      const el = stage.current
      if (!alive || !el) return
      const out: Measured[] = []
      for (const c of el.querySelectorAll<HTMLElement>('[data-row]')) {
        const row = Number(c.dataset.row)
        const side = c.dataset.side as Side
        const card = cards[row]
        const svg = c.querySelector('svg')
        if (!card || !svg) continue
        const box = svg.viewBox.baseVal
        const rect = svg.getBoundingClientRect()
        const mmPerPx = box && rect.width > 0 ? box.width / rect.width : 0
        const layers = layersOf(card, side)
        const byName = new Map(layers.map((l) => [l.name, l]))
        const marked = [...c.querySelectorAll('[data-overflow]')]
        const name = (g: Element): string => g.getAttribute('data-overflow') ?? ''
        const texts: Measured['texts'] = []
        const icons: Measured['icons'] = []
        for (const g of c.querySelectorAll('[data-text]')) {
          const n = g.getAttribute('data-text') ?? ''
          const pt = Number(g.getAttribute('data-pt'))
          const l = byName.get(n) as TextLayer | undefined
          const content = (g.textContent ?? '').trim()
          // un testo fatto solo di icone non ha lettere da misurare
          if (l && content && pt > 0)
            texts.push({
              name: n,
              pt,
              mm: xHeightMm(pt, xRatio(l.font, l.weight, l.italic)),
              content
            })
          if (mmPerPx > 0)
            for (const img of g.querySelectorAll('[data-gc-icon]')) {
              const h = img.getBoundingClientRect().height * mmPerPx
              if (h > 0) icons.push({ name: n, mm: h })
            }
        }
        for (const l of layers)
          if (l.type === 'image' && l.visible && l.src && Math.max(l.w, l.h) <= ICON_MAX_MM)
            icons.push({ name: l.name, mm: Math.min(l.w, l.h) })
        out.push({
          row,
          side,
          overflow: [...new Set(marked.map(name))],
          fixed: [
            ...new Set(marked.filter((g) => g.hasAttribute('data-overflow-fixed')).map(name))
          ],
          texts,
          icons
        })
      }
      setMeasured(out)
    }
    // i font si caricano dopo il primo disegno; i testi da ridurre scendono in più passaggi
    void document.fonts.ready.then(() => setTimeout(collect, 600))
    return () => {
      alive = false
    }
  }, [cards])

  // controlli che non hanno bisogno del disegno: contrasto, colori, numeri capovolti
  const model = useMemo(() => {
    const contrast = new Groups()
    const upside = new Groups()
    // colore di ogni livello, carta per carta, e i valori degli altri livelli
    const colors = new Map<string, (string | null)[]>()
    const values = new Map<string, (string | null)[]>()
    cards.forEach((c, row) => {
      const reading = readingOf(c.template)
      for (const side of ['front', 'back'] as const) {
        const layers = layersOf(c, side)
        layers.forEach((l, i) => {
          if (!l.visible) return
          const key = `${side}:${l.name}`
          const color = l.type === 'text' ? l.color : l.type === 'shape' ? l.fill : null
          if (color !== null) {
            const list = colors.get(key) ?? Array<string | null>(cards.length).fill(null)
            list[row] = color.toLowerCase()
            colors.set(key, list)
          }
          const value = l.type === 'text' ? l.text : l.type === 'image' ? l.src : null
          if (value !== null) {
            const list = values.get(key) ?? Array<string | null>(cards.length).fill(null)
            list[row] = value
            values.set(key, list)
          }
          if (l.type !== 'text' || !l.text.trim()) return
          if (!l.stroke) {
            const fg = parseColor(l.color)
            const bgColor = backgroundOf(layers, i)
            const bg = parseColor(bgColor)
            if (fg && bg && fg.a > 0.9) {
              const ratio = contrastRatio(fg, bg)
              const min = minContrast(l.size, l.weight)
              if (ratio < min)
                contrast.add({ row, side }, l.name, ratio < 3, {
                  detail: t('legibility.contrastItem', { ratio: ratio.toFixed(1), min })
                })
            }
          }
          if (reading.upsideDown) {
            const plain = l.text.replace(/[*_~`[\]{}]/g, '')
            const flipped = upsideDownReading(plain)
            if (flipped)
              upside.add({ row, side }, l.name, false, {
                detail: t('legibility.upsideItem', { a: plain.trim(), b: flipped })
              })
          }
        })
      }
    })
    // le stesse coppie di colori in più livelli (il riquadro e la fascia) stanno su una riga
    const pairs = new Map<string, { names: string[] } & ReturnType<typeof confusedPairs>[number]>()
    const onlySignal: string[] = []
    for (const [key, list] of colors) {
      const distinct = [...new Set(list.filter((c): c is string => c !== null))]
      if (distinct.length < 2) continue
      const name = key.slice(key.indexOf(':') + 1)
      for (const p of confusedPairs(distinct)) {
        const id = [p.a, p.b].sort().join('|')
        const known = pairs.get(id)
        if (!known) pairs.set(id, { names: [name], ...p })
        else if (!known.names.includes(name)) known.names.push(name)
      }
      // anche il testo dello stesso livello conta: un testo rosso che dice «Fuoco» non è solo rosso
      if (colorIsOnlySignal(list, Object.fromEntries(values)) && !onlySignal.includes(name))
        onlySignal.push(name)
    }
    return {
      contrast: contrast.list(),
      upside: upside.list(),
      pairs: [...pairs.values()],
      onlySignal
    }
  }, [cards, t])

  const label = (row: number): string => {
    const s = cards[row]?.label || String(row + 1)
    return s.length > 40 ? `${s.slice(0, 40)}…` : s
  }
  const sideName = (side: Side): string => t(side === 'front' ? 'preview.front' : 'preview.back')

  // le distanze dei template del set, per l'intestazione
  const readings = useMemo(() => {
    const seen = new Map<string, number>()
    for (const c of cards) seen.set(c.template.name, readingOf(c.template).cm)
    return [...seen]
  }, [cards])

  const sized = useMemo(() => {
    if (!measured) return null
    const small = new Groups()
    const icons = new Groups()
    const fonts = new Map<string, Set<string>>()
    for (const m of measured) {
      const card = cards[m.row]
      const { cm } = readingOf(card.template)
      const byName = new Map(layersOf(card, m.side).map((l) => [l.name, l]))
      for (const x of m.texts) {
        const verdict = textVerdict(x.mm, cm, reduced)
        const l = byName.get(x.name) as TextLayer | undefined
        if (verdict !== 'ok')
          small.add(m, x.name, verdict === 'tooSmall', {
            detail: t('legibility.textItem', {
              pt: x.pt,
              mm: x.mm.toFixed(1),
              cm: Math.floor(readableUpToCm(x.mm, COMFORT_DEG, reduced))
            })
          })
        if (!l) continue
        const kind = fontKinds.get(l.font)
        const reasons = fonts.get(l.font) ?? new Set<string>()
        if ((kind === 'display' || kind === 'handwriting') && x.content.length > LONG_TEXT)
          reasons.add(t('legibility.fontDisplay', { name: x.name }))
        if (l.weight <= 300 && verdict !== 'ok')
          reasons.add(t('legibility.fontThin', { name: x.name }))
        if (reasons.size) fonts.set(l.font, reasons)
      }
      // per ogni livello l'icona più piccola della faccia
      const smallest = new Map<string, number>()
      for (const i of m.icons) smallest.set(i.name, Math.min(i.mm, smallest.get(i.name) ?? i.mm))
      for (const [name, mm] of smallest) {
        const verdict = iconVerdict(mm, cm, reduced)
        if (verdict !== 'ok')
          icons.add(m, name, verdict === 'tooSmall', {
            detail: t('legibility.iconItem', { mm: mm.toFixed(1) })
          })
      }
    }
    return { small: small.list(), icons: icons.list(), fonts: [...fonts] }
  }, [measured, cards, reduced, fontKinds, t])

  const overflow = measured?.filter((m) => m.overflow.length > 0) ?? []
  const nothing =
    sized &&
    overflow.length === 0 &&
    sized.small.length === 0 &&
    sized.icons.length === 0 &&
    sized.fonts.length === 0 &&
    model.contrast.length === 0 &&
    model.pairs.length === 0 &&
    model.onlySignal.length === 0 &&
    model.upside.length === 0

  const pick = (p: Place, content: React.ReactNode): React.JSX.Element => (
    <li key={`${p.row}-${p.side}`}>
      <button onClick={() => onPick(p.row)} title={t('textCheck.pick')}>
        <strong>
          {p.row + 1}. {label(p.row)}
        </strong>{' '}
        <span className="muted">{sideName(p.side)}:</span> {content}
      </button>
    </li>
  )

  /** Un livello con lo stesso problema su più componenti: una riga sola, un clic va al primo */
  const group = (g: Group): React.JSX.Element => {
    const names = g.rows.slice(0, 4).map((r) => `${r + 1}. ${label(r)}`)
    if (g.rows.length > 4) names.push('…')
    return (
      <li key={g.key}>
        <button onClick={() => onPick(g.rows[0])} title={t('textCheck.pick')}>
          <strong className={g.bad ? 'legibility-bad' : undefined}>{g.name}</strong>
          {g.detail && <span className="muted"> ({g.detail})</span>} · {sideName(g.side)} ·{' '}
          {g.rows.length === cards.length
            ? t('legibility.allComponents', { n: cards.length })
            : names.join(', ')}
        </button>
      </li>
    )
  }

  return (
    <Dialog title={t('legibility.title')} onClose={onClose}>
      <div className="dialog-form text-check">
        <p className="muted small">
          {readings
            .map(([name, cm]) =>
              readings.length > 1
                ? t('legibility.readFromNamed', { name, cm })
                : t('legibility.readFrom', { cm })
            )
            .join(' ')}{' '}
          {t('legibility.readFromHint')}
        </p>
        <label className="legibility-reduced">
          <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />{' '}
          {t('legibility.reduced')}
        </label>
        {sized === null ? (
          <p className="muted">{t('textCheck.running', { n: cards.length })}</p>
        ) : nothing ? (
          <p>{t('legibility.none', { n: cards.length })}</p>
        ) : (
          <div className="legibility-sections">
            {overflow.length > 0 && (
              <section>
                <h4>{t('textCheck.title')}</h4>
                <p className="muted small">{t('textCheck.found', { n: overflow.length })}</p>
                {overflow.some((f) => f.fixed.length > 0) && (
                  <p className="muted small">{t('textCheck.fixed')}</p>
                )}
                <ul className="text-check-list">
                  {overflow.map((f) =>
                    pick(
                      f,
                      f.overflow
                        .map((n) => (f.fixed.includes(n) ? `${n} (${t('textCheck.fixedTag')})` : n))
                        .join(', ')
                    )
                  )}
                </ul>
              </section>
            )}
            {sized.small.length > 0 && (
              <section>
                <h4>{t('legibility.small')}</h4>
                <p className="muted small">{t('legibility.smallHint')}</p>
                <ul className="text-check-list">{sized.small.map(group)}</ul>
              </section>
            )}
            {sized.icons.length > 0 && (
              <section>
                <h4>{t('legibility.icons')}</h4>
                <p className="muted small">{t('legibility.iconsHint')}</p>
                <ul className="text-check-list">{sized.icons.map(group)}</ul>
              </section>
            )}
            {model.contrast.length > 0 && (
              <section>
                <h4>{t('legibility.contrast')}</h4>
                <p className="muted small">{t('legibility.contrastHint')}</p>
                <ul className="text-check-list">{model.contrast.map(group)}</ul>
              </section>
            )}
            {model.pairs.length > 0 && (
              <section>
                <h4>{t('legibility.pairs')}</h4>
                <p className="muted small">{t('legibility.pairsHint')}</p>
                <ul className="legibility-plain">
                  {model.pairs.map((p) => (
                    <li key={`${p.a}-${p.b}`}>
                      <strong>{p.names.join(', ')}</strong>: <Swatch color={p.a} /> {p.a} ·{' '}
                      <Swatch color={p.b} /> {p.b}{' '}
                      <span className="muted">({t(`vision.${p.vision}`)})</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {model.onlySignal.length > 0 && (
              <section>
                <h4>{t('legibility.onlySignal')}</h4>
                <p className="muted small">{t('legibility.onlySignalHint')}</p>
                <ul className="legibility-plain">
                  {model.onlySignal.map((n) => (
                    <li key={n}>
                      <strong>{n}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {model.upside.length > 0 && (
              <section>
                <h4>{t('legibility.upside')}</h4>
                <p className="muted small">{t('legibility.upsideHint')}</p>
                <ul className="text-check-list">{model.upside.map(group)}</ul>
              </section>
            )}
            {sized.fonts.length > 0 && (
              <section>
                <h4>{t('legibility.fonts')}</h4>
                <ul className="legibility-plain">
                  {sized.fonts.map(([font, reasons]) => (
                    <li key={font}>
                      <strong>{font}</strong>: {[...reasons].join('; ')}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
        <p className="muted small">{t('legibility.onlyWarnings')}</p>
        <div className="dialog-buttons">
          <button className="primary" onClick={onClose}>
            {t('dialog.close')}
          </button>
        </div>
      </div>
      <div ref={stage} className="text-check-stage" aria-hidden>
        {cards.map((c, i) =>
          (['front', 'back'] as const)
            .filter((side) => c.template[side].length > 0)
            .map((side) => (
              <div key={`${i}-${side}`} data-row={i} data-side={side}>
                <CardSvg template={c.template} side={side} scale={2} />
              </div>
            ))
        )}
      </div>
    </Dialog>
  )
}

function Swatch({ color }: { color: string }): React.JSX.Element {
  return <span className="legibility-swatch" style={{ background: color }} />
}
