import { useEffect, useMemo, useRef, useState } from 'react'
import { findMatches, replaceMatches, type FindOptions } from '../../../shared/model/findReplace'
import { useI18n } from '../i18n/context'
import { runEdit } from './editRun'

// Barra di ricerca sopra il testo di un documento: ⌘F cerca, ⌥⌘F / Ctrl+H anche sostituisce.
// Le sostituzioni passano dal campo come se le si scrivesse: ⌘Z le annulla in un passo.

interface Props {
  editor: React.RefObject<HTMLTextAreaElement | null>
  text: string
  replace: boolean
  /** Cambia ogni volta che la si richiama con la scorciatoia: il campo torna al fuoco */
  focusKey: number
  onReplaceChange(on: boolean): void
  onClose(): void
}

export default function FindBar({
  editor,
  text,
  replace,
  focusKey,
  onReplaceChange,
  onClose
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const [query, setQuery] = useState(() => selectedText(editor.current))
  const [replacement, setReplacement] = useState('')
  const [opts, setOpts] = useState<FindOptions>({})
  const [current, setCurrent] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => findMatches(text, query, opts), [text, query, opts])
  const index = matches.length ? Math.min(current, matches.length - 1) : -1

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [focusKey])

  /** Seleziona l'occorrenza nel testo e la porta in vista, lasciando il fuoco dov'è */
  const show = (
    i: number,
    keep: HTMLElement | null = document.activeElement as HTMLElement
  ): void => {
    const el = editor.current
    const m = matches[i]
    if (!el || !m) return
    setCurrent(i)
    el.focus()
    el.setSelectionRange(m.from, m.to)
    // il campo scorre fino alla selezione quando riprende il fuoco
    el.blur()
    el.focus()
    keep?.focus({ preventScroll: true })
  }

  // il testo cambia scrivendo la ricerca: si mostra la prima occorrenza dal cursore in poi
  useEffect(() => {
    if (!matches.length) return
    const at = editor.current?.selectionStart ?? 0
    const next = matches.findIndex((m) => m.from >= at)
    show(next < 0 ? 0 : next, input.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, opts])

  const step = (dir: 1 | -1): void => {
    if (!matches.length) return
    show((index + dir + matches.length) % matches.length)
  }

  const write = (next: string, at: number): void => {
    const keep = document.activeElement as HTMLElement | null
    runEdit(editor.current, () => ({ text: next, from: at, to: at }))
    keep?.focus({ preventScroll: true })
  }

  const replaceOne = (): void => {
    const m = matches[index]
    if (!m) return
    // la prima volta si va sull'occorrenza; se è già selezionata la si sostituisce
    const el = editor.current
    if (!el || el.selectionStart !== m.from || el.selectionEnd !== m.to) {
      show(index)
      return
    }
    write(replaceMatches(text, [m], replacement), m.from + replacement.length)
  }

  const replaceEvery = (): void => {
    if (!matches.length) return
    write(replaceMatches(text, matches, replacement), matches[0].from)
  }

  const keys = (e: React.KeyboardEvent, enter: () => void): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      editor.current?.focus()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) step(-1)
      else enter()
    }
  }

  const toggle = (key: keyof FindOptions): void => setOpts((o) => ({ ...o, [key]: !o[key] }))

  return (
    <div className="find-bar" role="search">
      <div className="find-row">
        <button
          className="find-expand"
          onClick={() => onReplaceChange(!replace)}
          title={t('find.toggleReplace')}
          aria-expanded={replace}
        >
          {replace ? '▾' : '▸'}
        </button>
        <input
          ref={input}
          value={query}
          placeholder={t('find.placeholder')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => keys(e, () => step(1))}
        />
        <span className="find-count muted small">
          {query
            ? matches.length
              ? t('find.count', { i: index + 1, n: matches.length })
              : t('find.none')
            : ''}
        </span>
        <button onClick={() => step(-1)} disabled={!matches.length} title={t('find.previous')}>
          ↑
        </button>
        <button onClick={() => step(1)} disabled={!matches.length} title={t('find.next')}>
          ↓
        </button>
        <label className="find-option" title={t('find.matchCaseHint')}>
          <input type="checkbox" checked={!!opts.matchCase} onChange={() => toggle('matchCase')} />
          {t('find.matchCase')}
        </label>
        <label className="find-option" title={t('find.wholeWordHint')}>
          <input type="checkbox" checked={!!opts.wholeWord} onChange={() => toggle('wholeWord')} />
          {t('find.wholeWord')}
        </label>
        <button onClick={onClose} title={t('find.close')}>
          ✕
        </button>
      </div>
      {replace && (
        <div className="find-row">
          <span className="find-expand" />
          <input
            value={replacement}
            placeholder={t('find.replacePlaceholder')}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => keys(e, replaceOne)}
          />
          <button onClick={replaceOne} disabled={!matches.length}>
            {t('find.replace')}
          </button>
          <button onClick={replaceEvery} disabled={!matches.length}>
            {t('find.replaceAll')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Il testo selezionato nel campo, se è su una riga sola: diventa la ricerca */
function selectedText(el: HTMLTextAreaElement | null): string {
  if (!el) return ''
  const s = el.value.slice(el.selectionStart, el.selectionEnd)
  return s.includes('\n') ? '' : s
}
