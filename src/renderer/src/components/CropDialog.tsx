import { useState } from 'react'
import NumInput from './NumInput'
import { MIN_CROP, cropRect } from '../../../shared/model/crop'
import type { Crop } from '../../../shared/model/template'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { useImageSize } from '../render/imageSize'

// Ritaglio di un'immagine: l'immagine intera con il rettangolo da trascinare e ridimensionare,
// proporzioni libere o quelle del riquadro del livello, e i campi in percentuale.

const BOX_W = 640
const BOX_H = 440

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES: Handle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

/** Il rettangolo più grande con le proporzioni date (larghezza/altezza in frazioni), al centro */
function centered(k: number): Crop {
  const w = k >= 1 ? 1 : k
  const h = k >= 1 ? 1 / k : 1
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

export default function CropDialog({
  url,
  value,
  frame,
  onApply,
  onClose
}: {
  /** Indirizzo dell'immagine */
  url: string
  value: Crop | null
  /** Larghezza e altezza del riquadro del livello in mm, per le proporzioni bloccate */
  frame: { w: number; h: number }
  onApply(crop: Crop | null): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const size = useImageSize(url)
  const [drag, setDrag] = useState<{ handle: Handle; x: number; y: number; start: Crop } | null>(
    null
  )
  // proporzioni del riquadro espresse nelle frazioni dell'immagine: w/h del ritaglio
  const ratio = size ? (frame.w / frame.h) * (size.h / size.w) : 1
  const [lock, setLock] = useState<boolean | null>(null)
  const [crop, setCrop] = useState<Crop | null>(value)
  const locked =
    lock ?? (value ? Math.abs(value.w / value.h / ratio - 1) < 0.01 : frame.w > 0 && frame.h > 0)
  const current = crop ?? (locked && size ? centered(ratio) : { x: 0, y: 0, w: 1, h: 1 })

  const scale = size ? Math.min(BOX_W / size.w, BOX_H / size.h) : 1
  const dw = size ? size.w * scale : BOX_W
  const dh = size ? size.h * scale : BOX_H

  /** Applica le proporzioni bloccate tenendo fermo il lato o l'angolo opposto alla maniglia */
  const constrain = (c: Crop, handle: Handle): Crop => {
    if (!locked || handle === 'move') return c
    const vertical = handle === 'n' || handle === 's'
    const horizontal = handle === 'e' || handle === 'w'
    let w = vertical ? c.h * ratio : c.w
    let h = vertical ? c.h : c.w / ratio
    const right = c.x + c.w
    const bottom = c.y + c.h
    const cx = c.x + c.w / 2
    const cy = c.y + c.h / 2
    // il ritaglio non esce dall'immagine: si riduce mantenendo le proporzioni
    const maxW = handle.includes('w') ? right : vertical ? 2 * Math.min(cx, 1 - cx) : 1 - c.x
    const maxH = handle.includes('n') ? bottom : horizontal ? 2 * Math.min(cy, 1 - cy) : 1 - c.y
    const k = Math.min(1, maxW / w, maxH / h)
    w *= k
    h *= k
    return {
      x: handle.includes('w') ? right - w : vertical ? cx - w / 2 : c.x,
      y: handle.includes('n') ? bottom - h : horizontal ? cy - h / 2 : c.y,
      w,
      h
    }
  }

  const onMove = (e: React.PointerEvent): void => {
    const d = drag
    if (!d) return
    const dx = (e.clientX - d.x) / dw
    const dy = (e.clientY - d.y) / dh
    const s = d.start
    let { x, y, w, h } = s
    if (d.handle === 'move') {
      x = Math.min(Math.max(0, s.x + dx), 1 - s.w)
      y = Math.min(Math.max(0, s.y + dy), 1 - s.h)
    } else {
      if (d.handle.includes('e')) w = Math.min(1 - s.x, Math.max(MIN_CROP, s.w + dx))
      if (d.handle.includes('s')) h = Math.min(1 - s.y, Math.max(MIN_CROP, s.h + dy))
      if (d.handle.includes('w')) {
        x = Math.min(s.x + s.w - MIN_CROP, Math.max(0, s.x + dx))
        w = s.x + s.w - x
      }
      if (d.handle.includes('n')) {
        y = Math.min(s.y + s.h - MIN_CROP, Math.max(0, s.y + dy))
        h = s.y + s.h - y
      }
    }
    setCrop(constrain({ x, y, w, h }, d.handle))
  }

  const start = (handle: Handle) => (e: React.PointerEvent) => {
    e.stopPropagation()
    // la cattura resta all'elemento premuto; i movimenti risalgono fino all'area
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ handle, x: e.clientX, y: e.clientY, start: current })
  }

  const setLocked = (v: boolean): void => {
    setLock(v)
    if (v && size) {
      // dentro il ritaglio attuale, il rettangolo più grande con le proporzioni del riquadro
      const c = current
      const w = Math.min(c.w, c.h * ratio)
      const h = w / ratio
      setCrop({ x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h })
    }
  }

  const field = (key: keyof Crop, label: string): React.JSX.Element => (
    <label className="crop-num">
      <span>{label}</span>
      <NumInput
        step={1}
        min={0}
        max={100}
        value={Math.round(current[key] * 1000) / 10}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          const next = { ...current, [key]: n / 100 }
          const fixed = cropRect(next) ?? { x: 0, y: 0, w: 1, h: 1 }
          setCrop(constrain(fixed, key === 'h' ? 's' : key === 'w' ? 'e' : 'move'))
        }}
      />
      <span className="unit">%</span>
    </label>
  )

  return (
    <Dialog title={t('crop.title')} onClose={onClose}>
      <div className="crop-dialog">
        <div
          className="crop-area"
          style={{ width: dw, height: dh }}
          onPointerMove={onMove}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
        >
          <img src={url} alt="" width={dw} height={dh} draggable={false} />
          {size && (
            <div
              className="crop-rect"
              style={{
                left: current.x * dw,
                top: current.y * dh,
                width: current.w * dw,
                height: current.h * dh
              }}
              onPointerDown={start('move')}
            >
              {HANDLES.map((h) => (
                <span key={h} className={`crop-handle crop-${h}`} onPointerDown={start(h)} />
              ))}
            </div>
          )}
        </div>
        <div className="crop-fields">
          {field('x', 'X')}
          {field('y', 'Y')}
          {field('w', t('crop.width'))}
          {field('h', t('crop.height'))}
          <label className="crop-lock">
            <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} />
            {t('crop.lock')}
          </label>
        </div>
        <p className="muted small">{t('crop.hint')}</p>
        <div className="dialog-buttons">
          <button className="spacer-right" onClick={() => onApply(null)} disabled={!value}>
            {t('crop.remove')}
          </button>
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button className="primary" disabled={!size} onClick={() => onApply(cropRect(current))}>
            {t('crop.apply')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
