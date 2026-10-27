import { useMemo, useState } from 'react'
import type { FindOptions, TextMatch } from '../../../shared/model/findReplace'
import {
  findInProject,
  type FindHit,
  type FindPlace,
  type FindScope
} from '../../../shared/model/projectFind'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'

// Cerca e sostituisci in tutto il progetto (⇧⌘F / Ctrl+Shift+F): documenti, note, celle, testi e
// formule dei template, variabili. Si sceglie dove sostituire; prima Stella fa un backup.

const GROUPS: { kind: FindPlace['kind']; title: MessageKey }[] = [
  { kind: 'document', title: 'findAll.documents' },
  { kind: 'note', title: 'findAll.notes' },
  { kind: 'cell', title: 'findAll.cells' },
  { kind: 'layer', title: 'findAll.layers' },
  { kind: 'variable', title: 'findAll.variables' }
]

export default function ProjectFindDialog({
  scope,
  onReplace,
  onOpen,
  onClose
}: {
  scope: FindScope
  /** Sostituisce nei risultati scelti, dopo il backup; restituisce le occorrenze sostituite */
  onReplace(hits: FindHit[], query: string, replacement: string): Promise<number>
  onOpen(place: FindPlace): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [opts, setOpts] = useState<FindOptions>({})
  /** Risultati tolti dalla sostituzione: tutti gli altri sono scelti */
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Message | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const hits = useMemo(() => findInProject(scope, query, opts), [scope, query, opts])
  const chosen = hits.filter((h) => !skipped.has(h.key))
  const total = hits.reduce((n, h) => n + h.matches.length, 0)

  const toggle = (key: string): void =>
    setSkipped((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const replace = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const n = await onReplace(chosen, query, replacement)
      setDone({ key: 'findAll.done', params: { n, label: t('findAll.backupLabel', { query }) } })
      setSkipped(new Set())
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setBusy(false)
    }
  }

  const place = (p: FindPlace): string => {
    switch (p.kind) {
      case 'document':
      case 'note':
        return t('findAll.line', { name: p.name, n: p.line + 1 })
      case 'cell':
        return t('findAll.cell', { set: p.setName, n: p.row + 1, column: p.column })
      case 'layer':
        return t('findAll.layer', {
          template: p.template,
          layer: p.layer,
          prop: t(`findAll.prop.${p.prop}` as MessageKey)
        })
      case 'variable':
        return p.name
    }
  }

  return (
    <Dialog title={t('findAll.title')} onClose={onClose} className="find-all-dialog">
      <div className="find-all">
        <div className="find-row">
          <input
            autoFocus
            value={query}
            placeholder={t('find.placeholder')}
            onChange={(e) => {
              setQuery(e.target.value)
              setSkipped(new Set())
              setDone(null)
            }}
          />
          <label className="find-option" title={t('find.matchCaseHint')}>
            <input
              type="checkbox"
              checked={!!opts.matchCase}
              onChange={() => setOpts((o) => ({ ...o, matchCase: !o.matchCase }))}
            />
            {t('find.matchCase')}
          </label>
          <label className="find-option" title={t('find.wholeWordHint')}>
            <input
              type="checkbox"
              checked={!!opts.wholeWord}
              onChange={() => setOpts((o) => ({ ...o, wholeWord: !o.wholeWord }))}
            />
            {t('find.wholeWord')}
          </label>
        </div>
        <div className="find-row">
          <input
            value={replacement}
            placeholder={t('find.replacePlaceholder')}
            onChange={(e) => setReplacement(e.target.value)}
          />
        </div>
        <p className="muted small">{t('findAll.hint')}</p>
        {error && <div className="banner error">{t(error)}</div>}
        {done && <div className="banner info">{t(done)}</div>}
        <div className="find-results">
          {query && !hits.length && <p className="muted">{t('find.none')}</p>}
          {GROUPS.map(({ kind, title }) => {
            const list = hits.filter((h) => h.place.kind === kind)
            if (!list.length) return null
            return (
              <section key={kind}>
                <h4>
                  {t(title)} <span className="muted small">({list.length})</span>
                </h4>
                {list.map((h) => (
                  <div key={h.key} className="find-hit">
                    <input
                      type="checkbox"
                      checked={!skipped.has(h.key)}
                      onChange={() => toggle(h.key)}
                      title={t('findAll.choose')}
                    />
                    <button className="link find-place" onClick={() => onOpen(h.place)}>
                      {place(h.place)}
                    </button>
                    <span className="find-snippet">
                      <Snippet text={h.text} matches={h.matches} />
                    </span>
                  </div>
                ))}
              </section>
            )
          })}
        </div>
        <div className="dialog-buttons">
          {hits.length > 0 && (
            <>
              <button onClick={() => setSkipped(new Set())}>{t('findAll.all')}</button>
              <button onClick={() => setSkipped(new Set(hits.map((h) => h.key)))}>
                {t('findAll.nothing')}
              </button>
              <span className="muted small">
                {t('findAll.count', { n: total, places: hits.length })}
              </span>
            </>
          )}
          <span className="spacer" />
          <button
            className="primary"
            disabled={busy || !chosen.length}
            onClick={replace}
            title={t('findAll.replaceHint')}
          >
            {t('findAll.replace', { n: chosen.length })}
          </button>
          <button onClick={onClose}>{t('dialog.close')}</button>
        </div>
      </div>
    </Dialog>
  )
}

/** Il testo attorno alle occorrenze, con le occorrenze evidenziate */
function Snippet({ text, matches }: { text: string; matches: TextMatch[] }): React.JSX.Element {
  const start = Math.max(0, matches[0].from - 30)
  const end = Math.min(text.length, Math.max(matches[0].to + 60, start + 90))
  const parts: React.ReactNode[] = []
  let at = start
  for (const m of matches) {
    if (m.from < at || m.to > end) continue
    parts.push(text.slice(at, m.from), <mark key={m.from}>{text.slice(m.from, m.to)}</mark>)
    at = m.to
  }
  parts.push(text.slice(at, end))
  return (
    <>
      {start > 0 && '…'}
      {parts}
      {end < text.length && '…'}
    </>
  )
}
