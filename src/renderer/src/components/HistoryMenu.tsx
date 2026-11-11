import { useEffect, useRef, useState } from 'react'
import type { LoadedProject } from '../../../shared/project'
import {
  describeStep,
  futureAfter,
  futureBefore,
  stateAfter,
  type HistoryEntry,
  type HistoryState,
  type Place,
  type StepText
} from '../history'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import { HistoryIcon } from './icons'

interface Props {
  past: HistoryEntry[]
  future: HistoryEntry[]
  current: LoadedProject
  /** Nome della schermata (set, template o documento) */
  placeName(where: Place): string
  /** Annulla (redo false) o ripristina `steps` passi */
  onTravel(redo: boolean, steps: number): void
}

interface Row {
  id: string
  text: StepText
  where?: Place
  time?: number
  /** Passi da annullare (negativo) o ripristinare per arrivare qui */
  steps: number
}

/**
 * Il tasto accanto ad annulla e ripristina: l'elenco delle modifiche del progetto, le più recenti
 * in alto. Sopra lo stato attuale quelle annullate, che si possono ripristinare; sotto quelle
 * fatte. Un clic su una voce annulla o ripristina fino a quella, in un colpo solo.
 */
export default function HistoryMenu({
  past,
  future,
  current,
  placeName,
  onTravel
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const now: HistoryState = {
    sets: current.sets,
    file: current.file,
    templates: current.templates
  }
  // i passi si descrivono solo con il menu aperto: confrontare i template ha un costo
  const redoRows: Row[] = open
    ? future.map((e, k) => ({
        id: `f${k}`,
        text: describeStep(futureBefore(future, k, now), futureAfter(e, now)),
        where: e.where,
        time: e.time,
        steps: future.length - k
      }))
    : []
  const undoRows: Row[] = open
    ? past
        .map((e, i) => ({
          id: `p${i}`,
          text: describeStep(e, stateAfter(past, i, now)),
          where: e.where,
          time: e.time,
          steps: -(past.length - i)
        }))
        .reverse()
    : []

  const describe = (s: StepText): string => {
    const params = { ...s.params }
    if (typeof params.props === 'string')
      params.props = params.props
        .split(',')
        .map((k) => {
          const label = t(`prop.${k}` as MessageKey)
          return label === `prop.${k}` ? k : label
        })
        .join(', ')
    return t(s.key as MessageKey, params)
  }
  const clock = (ms?: number): string =>
    ms === undefined
      ? ''
      : new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const place = (w?: Place): string => {
    if (!w) return ''
    const name = placeName(w)
    return t(`history.place.${w.kind}` as MessageKey, { name })
  }

  const row = (r: Row, undone: boolean): React.JSX.Element => (
    <li key={r.id}>
      <button
        className={undone ? 'history-step undone' : 'history-step'}
        title={t(undone ? 'history.redoTo' : 'history.undoTo', { n: Math.abs(r.steps) })}
        onClick={() => {
          onTravel(r.steps > 0, Math.abs(r.steps))
          setOpen(false)
        }}
      >
        <span className="history-text">{describe(r.text)}</span>
        <span className="history-meta muted small">
          {place(r.where)}
          {r.time !== undefined && ` · ${clock(r.time)}`}
        </span>
      </button>
    </li>
  )

  return (
    <div className="columns-menu history-menu" ref={boxRef}>
      <button
        className={open ? 'tool active' : 'tool'}
        title={t('history.button')}
        aria-label={t('history.button')}
        aria-expanded={open}
        disabled={!past.length && !future.length}
        onClick={() => setOpen((o) => !o)}
      >
        <HistoryIcon />
      </button>
      {open && (
        <div className="columns-menu-panel history-panel" role="dialog">
          <p className="colors-menu-title">{t('history.title')}</p>
          <p className="muted small">{t('history.hint')}</p>
          <ul className="history-list">
            {redoRows.map((r) => row(r, true))}
            <li className="history-now">{t('history.now')}</li>
            {undoRows.map((r) => row(r, false))}
            {!undoRows.length && <li className="muted small">{t('history.empty')}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
