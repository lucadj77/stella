import { useCallback, useReducer } from 'react'
import { findLayer } from '../../../shared/model/edit'
import type { Side, Template } from '../../../shared/model/template'

// Stato dell'editor. Annulla e ripristina non stanno qui: ogni modifica risale all'app, che la
// mette nella cronologia unica del progetto (history.ts) e, annullando, rimanda il template.

interface Snapshot {
  template: Template
  selection: string[]
}

export interface EditorState {
  template: Template
  side: Side
  selection: string[]
  /** Gruppo in cui si è entrati con il doppio clic: la tela seleziona i suoi figli */
  scope: string | null
  /** Chiave dell'ultima modifica: l'app unisce in un passo quelle ravvicinate con la stessa */
  lastKey: string | null
  /** Stato all'inizio di un trascinamento, finché il gesto non finisce */
  gesture: Snapshot | null
  /** Numero del trascinamento in corso: tutto il gesto è un solo passo */
  gestureId: number
  /** Lato e selezione prima dell'ultima modifica: annullandola si torna lì */
  before: { side: Side; selection: string[] }
  /**
   * Forma di cui si modificano i punti sulla tela (con il doppio clic o "Modifica punti"): resta
   * finché è l'unica selezionata
   */
  points: string | null
  /** Il punto scelto della forma in modifica: l'indice del suo segmento (model/pathEdit.ts) */
  point: number | null
}

export type EditorAction =
  | { type: 'change'; template: Template; selection?: string[]; key?: string }
  | { type: 'gestureStart' }
  | { type: 'gestureUpdate'; template: Template }
  | { type: 'gestureEnd' }
  | { type: 'select'; ids: string[]; scope?: string | null }
  | { type: 'side'; side: Side }
  | { type: 'points'; id: string | null; point?: number | null }
  /** Template cambiato fuori dall'editor (annulla, ripristina): nessun passo nuovo */
  | { type: 'load'; template: Template; side?: Side; selection?: string[] }

function snapshot(s: EditorState): Snapshot {
  return { template: s.template, selection: s.selection }
}

/** Tiene solo gli id ancora presenti sul lato visibile */
function existing(t: Template, side: Side, ids: string[]): string[] {
  return ids.filter((id) => findLayer(t[side], id))
}

/** La modifica dei punti resta solo se la forma è ancora l'unica selezionata */
const keepPoints = (s: EditorState): EditorState =>
  s.points && (s.selection.length !== 1 || s.selection[0] !== s.points)
    ? { ...s, points: null, point: null }
    : !s.points && s.point !== null
      ? { ...s, point: null }
      : s

function reducer(s: EditorState, a: EditorAction): EditorState {
  return keepPoints(step(s, a))
}

function step(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case 'points':
      return {
        ...s,
        points: a.id,
        point: a.id === s.points && a.point === undefined ? s.point : (a.point ?? null),
        selection: a.id ? [a.id] : s.selection
      }
    case 'change':
      return {
        ...s,
        template: a.template,
        selection: existing(a.template, s.side, a.selection ?? s.selection),
        lastKey: a.key ?? null,
        before: { side: s.side, selection: s.selection }
      }
    case 'gestureStart':
      return {
        ...s,
        gesture: snapshot(s),
        gestureId: s.gestureId + 1,
        lastKey: null,
        before: { side: s.side, selection: s.selection }
      }
    case 'gestureUpdate':
      return { ...s, template: a.template }
    case 'gestureEnd':
      return s.gesture ? { ...s, gesture: null } : s
    case 'select':
      return {
        ...s,
        selection: a.ids,
        scope: a.scope === undefined ? s.scope : a.scope,
        lastKey: null
      }
    case 'side':
      return { ...s, side: a.side, selection: [], scope: null, points: null }
    case 'load': {
      const side = a.side ?? s.side
      return {
        ...s,
        template: a.template,
        side,
        scope: side === s.side ? s.scope : null,
        selection: existing(a.template, side, a.selection ?? s.selection),
        lastKey: null
      }
    }
  }
}

/**
 * `normalize` passa ogni modifica per le regole del template, per esempio quelle di un derivato
 * (vedi rebase): l'editor mostra e annulla sempre il template come si salverà.
 */
export function useEditor(
  initial: Template,
  normalize?: (t: Template) => Template,
  /** Lato e selezione all'apertura: dopo un annulla che ha riaperto l'editor */
  start?: { side?: Side; selection?: string[] } | null
): [EditorState, React.Dispatch<EditorAction>] {
  const run = useCallback(
    (s: EditorState, a: EditorAction): EditorState =>
      normalize && (a.type === 'change' || a.type === 'gestureUpdate')
        ? reducer(s, { ...a, template: normalize(a.template) })
        : reducer(s, a),
    [normalize]
  )
  return useReducer(run, initial, (template) => {
    const side: Side = start?.side ?? 'front'
    return {
      template,
      side,
      selection: existing(template, side, start?.selection ?? []),
      scope: null,
      lastKey: null,
      gesture: null,
      gestureId: 0,
      before: { side, selection: [] },
      points: null,
      point: null
    }
  })
}
