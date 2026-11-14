import { memo, useEffect, useMemo, useState } from 'react'
import type { ExportCard } from '../../../shared/export'
import { buildSets } from '../../../shared/exportJob'
import { messageFromError, type Message } from '../../../shared/messages'
import { cardFingerprints, changedCards } from '../../../shared/model/compare'
import type { Side } from '../../../shared/model/template'
import type { LoadedProject } from '../../../shared/project'
import {
  pairBefore,
  readCompareBase,
  readCompareSources,
  type CompareBase,
  type CompareSources
} from '../components/compareBase'
import Segmented from '../components/Segmented'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import CardSvg from '../render/CardSvg'

// Scelta dei singoli componenti da esportare, dentro i set scelti: tutti, nessuno, uno per uno o
// quelli nuovi o cambiati rispetto all'ultima esportazione o a un backup. Con un backup si vede
// anche com'era ogni componente cambiato, accanto a com'è adesso.

/** Righe scelte (da 0) per set; un set che manca esce per intero */
export type PickedRows = Record<string, number[]>

const Thumb = memo(CardSvg)

/** Pixel per millimetro delle miniature */
const SCALE = 1.4

export default function ComponentPicker({
  project,
  sets,
  language,
  picked,
  changed,
  onApply,
  onClose
}: {
  project: LoadedProject
  /** Set scelti nell'esportazione */
  sets: string[]
  language: string | null
  /** Scelta di prima; null: tutti */
  picked: PickedRows | null
  /** Confronto già attivo nell'app, se c'è */
  changed?: Record<string, number[]> | null
  onApply(picked: PickedRows | null): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const groups = useMemo(() => buildSets(project, sets, language), [project, sets, language])
  const all = (): Record<string, Set<number>> =>
    Object.fromEntries(groups.map((g) => [g.name, new Set(g.cards.map((c) => c.n - 1))]))
  const [chosen, setChosen] = useState<Record<string, Set<number>>>(() =>
    picked
      ? Object.fromEntries(
          groups.map((g) => [g.name, new Set(g.name in picked ? picked[g.name] : all()[g.name])])
        )
      : all()
  )
  const [side, setSide] = useState<Side>('front')
  const [sources, setSources] = useState<CompareSources | null>(null)
  const [choice, setChoice] = useState('')
  const [base, setBase] = useState<CompareBase | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Message | null>(null)
  const [showBefore, setShowBefore] = useState(true)

  useEffect(() => {
    void readCompareSources().then((s) => {
      setSources(s)
      setChoice(changed ? 'app' : s.printed ? 'printed' : (s.backups[0]?.file ?? ''))
    })
  }, [changed])

  const when = (ms: number): string =>
    new Date(ms).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })

  /** Righe nuove o cambiate rispetto alla versione scelta */
  const marked = useMemo(
    () =>
      base
        ? changedCards(cardFingerprints(project, project.assets), base.before)
        : (changed ?? null),
    [base, changed, project]
  )
  /** I componenti di prima, per set: solo confrontando con un backup */
  const before = useMemo(() => {
    if (!base?.version) return null
    const old = buildSets(
      {
        ...project,
        file: base.version.file,
        sets: base.version.sets,
        templates: base.version.templates
      },
      sets,
      language
    )
    return Object.fromEntries(
      groups.map((g) => [
        g.name,
        pairBefore(g.cards, old.find((o) => o.name === g.name)?.cards ?? [])
      ])
    )
  }, [base, project, sets, language, groups])

  const selectChanged = async (): Promise<void> => {
    setError(null)
    let rows = changed ?? null
    if (choice !== 'app' && sources) {
      setBusy(true)
      try {
        const b = await readCompareBase(choice, sources, project, t, when)
        setBase(b)
        rows = b ? changedCards(cardFingerprints(project, project.assets), b.before) : null
      } catch (e) {
        setError(messageFromError(e))
        return
      } finally {
        setBusy(false)
      }
    } else setBase(null)
    if (rows)
      setChosen(Object.fromEntries(groups.map((g) => [g.name, new Set(rows![g.name] ?? [])])))
  }

  const toggle = (set: string, row: number): void =>
    setChosen((c) => {
      const next = new Set(c[set])
      if (next.has(row)) next.delete(row)
      else next.add(row)
      return { ...c, [set]: next }
    })
  const setGroup = (set: string, on: boolean): void =>
    setChosen((c) => ({ ...c, [set]: on ? all()[set] : new Set() }))

  const total = groups.reduce((n, g) => n + g.cards.length, 0)
  const count = groups.reduce((n, g) => n + (chosen[g.name]?.size ?? 0), 0)
  const changedTotal = marked ? groups.reduce((n, g) => n + (marked[g.name]?.length ?? 0), 0) : 0

  const apply = (): void => {
    if (count === total) return onApply(null)
    onApply(
      Object.fromEntries(
        groups.map((g) => [g.name, [...(chosen[g.name] ?? [])].sort((a, b) => a - b)])
      )
    )
  }

  const thumb = (c: ExportCard): React.JSX.Element => (
    <Thumb template={c.template} side={side} scale={SCALE} />
  )

  return (
    <Dialog title={t('pick.title')} onClose={onClose} guide="pick">
      <div className="component-picker">
        <div className="pick-toolbar">
          <button onClick={() => setChosen(all())}>{t('pick.all')}</button>
          <button
            onClick={() =>
              setChosen(Object.fromEntries(groups.map((g) => [g.name, new Set<number>()])))
            }
          >
            {t('pick.none')}
          </button>
          <Segmented<Side>
            value={side}
            options={[
              ['front', t('export.front')],
              ['back', t('export.back')]
            ]}
            onChange={setSide}
          />
        </div>
        <div className="pick-toolbar">
          <label className="export-inline">
            {t('pick.changedSince')}
            <select value={choice} onChange={(e) => setChoice(e.target.value)} disabled={!sources}>
              {changed && <option value="app">{t('pick.currentCompare')}</option>}
              {sources?.printed && (
                <option value="printed">
                  {t('compare.printed', { date: when(sources.printed.date) })}
                </option>
              )}
              {sources?.backups.map((b) => (
                <option key={b.file} value={b.file}>
                  {t(b.auto ? 'compare.autoBackup' : 'compare.backup', { date: when(b.date) })}
                  {b.label ? ` · ${b.label}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!choice || busy}
            title={t('pick.selectChangedHint')}
            onClick={() => void selectChanged()}
          >
            {busy ? t('compare.running') : t('pick.selectChanged')}
          </button>
          {base?.version && (
            <label className="check">
              <input
                type="checkbox"
                checked={showBefore}
                onChange={(e) => setShowBefore(e.target.checked)}
              />
              {t('pick.beforeAfter')}
            </label>
          )}
        </div>
        {sources && !changed && !sources.printed && !sources.backups.length && (
          <p className="muted small">{t('pick.noVersions')}</p>
        )}
        {error && <p className="field-error">{t(error)}</p>}
        {marked && (
          <p className="muted small">
            {t('pick.changedCount', { n: changedTotal })}
            {base && !base.version ? ' ' + t('pick.noBefore') : ''}
          </p>
        )}
        <div className="pick-sets">
          {groups.map((g) => {
            const on = chosen[g.name] ?? new Set<number>()
            const changedRows = new Set(marked?.[g.name] ?? [])
            const pairs = before?.[g.name]
            return (
              <section key={g.name} className="pick-set">
                <h3>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={on.size === g.cards.length && g.cards.length > 0}
                      ref={(el) => {
                        if (el) el.indeterminate = on.size > 0 && on.size < g.cards.length
                      }}
                      onChange={(e) => setGroup(g.name, e.target.checked)}
                    />
                    {g.name}
                  </label>
                  <span className="muted">
                    {t('pick.setCount', { n: on.size, of: g.cards.length })}
                  </span>
                </h3>
                <div className="pick-grid">
                  {g.cards.map((c) => {
                    const row = c.n - 1
                    const isChanged = changedRows.has(row)
                    const old = isChanged && pairs && showBefore ? pairs.get(c.n) : undefined
                    const compareView = isChanged && pairs && showBefore
                    return (
                      <label
                        key={c.n}
                        className={
                          'pick-card' +
                          (on.has(row) ? ' active' : '') +
                          (isChanged ? ' changed' : '')
                        }
                        title={c.label || String(c.n)}
                      >
                        {compareView ? (
                          <span className="pick-pair">
                            <span className="pick-side">
                              {old ? thumb(old) : <span className="pick-new">{t('pick.new')}</span>}
                              <span className="muted small">{t('pick.before')}</span>
                            </span>
                            <span className="pick-side">
                              {thumb(c)}
                              <span className="muted small">{t('pick.after')}</span>
                            </span>
                          </span>
                        ) : (
                          thumb(c)
                        )}
                        <span className="card-caption">
                          <input
                            type="checkbox"
                            checked={on.has(row)}
                            onChange={() => toggle(g.name, row)}
                          />
                          {isChanged && (
                            <span className="compare-dot" title={t('compare.changedCard')} />
                          )}
                          <span className="card-label">{c.label || c.n}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
        <div className="dialog-buttons">
          <span className="muted">{t('pick.count', { n: count, of: total })}</span>
          <span className="spacer" />
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button className="primary" disabled={!count} onClick={apply}>
            {t('pick.apply')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
