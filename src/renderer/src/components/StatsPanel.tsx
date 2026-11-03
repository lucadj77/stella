import { useCallback, useMemo, useState } from 'react'
import type { LoadedSet, Sheet } from '../../../shared/project'
import type { ColumnInfo } from '../../../shared/model/sheet'
import type { BoundCard } from '../../../shared/model/bind'
import type { NumberFormatting } from '../../../shared/model/numberFormat'
import type { Template } from '../../../shared/model/template'
import type { Variables } from '../../../shared/model/variables'
import { fieldValues, isNumeric, rowAmounts, toMarkdown, toTsv } from '../../../shared/model/stats'
import { useI18n } from '../i18n/context'
import { DetachIcon, DockIcon } from './icons'
import Resizer from './Resizer'
import { usePanelWidth } from './usePanelWidth'
import { useFloatingPanel } from './useFloatingPanel'
import Menu from './Menu'
import {
  DiceTab,
  DrawTab,
  OverviewTab,
  PivotTab,
  ScatterTab,
  TextsTab,
  ValuesTab,
  type StatsContext,
  type StatsField
} from './statsTabs'

// Statistiche del set in un pannello accanto alla tabella o alla griglia: non copre le carte, e
// un clic su un valore filtra le carte del set. Si stacca come il pannello delle note.

/** Filtro delle carte scelto con un clic nelle statistiche */
export interface StatsFilter {
  label: string
  rows: number[]
}

export type StatsTabId = 'values' | 'pivot' | 'scatter' | 'draw' | 'dice' | 'texts' | 'overview'

interface Props {
  set: LoadedSet
  sheet: Sheet
  /** Tutti i set del progetto: per un mazzo fatto di più set mescolati insieme */
  sets: LoadedSet[]
  /** Righe da contare: quelle del set, o quelle che passano il filtro della ricerca */
  rows: number[]
  /** C'è un filtro della ricerca */
  searched: boolean
  columns: ColumnInfo[]
  template: Template | null
  templates: Template[]
  variables?: Variables
  numbers?: NumberFormatting
  /** Le carte del set, per le miniature */
  cards: BoundCard[]
  /** Una carta di un altro set, per la mano di prova */
  bindOther(set: LoadedSet, row: number): BoundCard | null
  isDie: boolean
  filter: StatsFilter | null
  onFilter(f: StatsFilter | null): void
  /** Mostra una carta (accanto, nell'anteprima) */
  onShowCard(row: number): void
  onClose(): void
}

const TAB_KEY = 'stats.tab'

function loadTab(): StatsTabId {
  try {
    return (localStorage.getItem(TAB_KEY) as StatsTabId | null) ?? 'values'
  } catch {
    return 'values'
  }
}

export default function StatsPanel(props: Props): React.JSX.Element {
  const { t, lang } = useI18n()
  const { sheet, rows, columns, template, templates, variables, numbers, isDie } = props
  const [width, setWidth] = usePanelWidth('stats', 460)
  const { floating, panel, toggle, dragHandlers } = useFloatingPanel('statsPanel.floating', width)
  const [tab, setTabState] = useState<StatsTabId>(loadTab)
  const setTab = (id: StatsTabId): void => {
    setTabState(id)
    try {
      localStorage.setItem(TAB_KEY, id)
    } catch {
      // preferenza non essenziale
    }
  }
  const hasAmount = sheet.headers.includes('amount')
  const [copies, setCopies] = useState(true)
  /** La tabella della scheda aperta, per Copia */
  const [table, setTable] = useState<string[][]>([])
  const [copied, setCopied] = useState(false)
  /** Il campo scelto nella scheda Valori, anche dalla Panoramica */
  const [valuesField, setValuesField] = useState<string | null>(null)

  const fields = useMemo<StatsField[]>(() => {
    const out: StatsField[] = []
    for (const c of columns) {
      const h = c.header
      if (!h || h === 'amount' || h.includes('.') || out.some((f) => f.name === h)) continue
      out.push({ name: h, computed: c.computed, numeric: false })
    }
    return out
  }, [columns])

  const ctx = useMemo<StatsContext>(() => {
    const cache = new Map<string, ReturnType<typeof fieldValues>>()
    const values = (name: string): ReturnType<typeof fieldValues> => {
      let v = cache.get(name)
      if (!v) {
        v = fieldValues(sheet, name, rows, template, templates, variables, numbers)
        cache.set(name, v)
      }
      return v
    }
    const amounts = hasAmount && copies ? rowAmounts(sheet, rows) : rows.map(() => 1)
    const withNumeric = fields.map((f) => ({ ...f, numeric: isNumeric(values(f.name).values) }))
    const comma = lang === 'it'
    const num = (n: number): string => {
      const r = Math.round(n * 100) / 100
      const s = String(r)
      return comma ? s.replace('.', ',') : s
    }
    const pct = (p: number): string => `${Math.round(p * 100)}%`
    return {
      sheet,
      rows,
      amounts,
      copies: hasAmount && copies,
      fields: withNumeric,
      values,
      template,
      templates,
      variables,
      numbers,
      num,
      pct,
      comma
    }
  }, [sheet, rows, template, templates, variables, numbers, hasAmount, copies, fields, lang])

  // la tabella cambia scheda per scheda: Copia prende quella che si vede
  const onTable = useCallback((rows: string[][]): void => {
    setTable(rows)
    setCopied(false)
  }, [])

  const copy = async (as: 'tsv' | 'md'): Promise<void> => {
    if (!table.length) return
    await navigator.clipboard.writeText(as === 'tsv' ? toTsv(table) : toMarkdown(table))
    setCopied(true)
  }

  const tabs: [StatsTabId, string, string][] = [
    ['values', t('stats.tab.values'), t('stats.tip.values')],
    ['pivot', t('stats.tab.pivot'), t('stats.tip.pivot')],
    ['scatter', t('stats.tab.scatter'), t('stats.tip.scatter')],
    isDie
      ? ['dice', t('stats.tab.dice'), t('stats.tip.dice')]
      : ['draw', t('stats.tab.draw'), t('stats.tip.draw')],
    ['texts', t('stats.tab.texts'), t('stats.tip.texts')],
    ['overview', t('stats.tab.overview'), t('stats.tip.overview')]
  ]
  // un set di dadi non ha la pesca, uno di carte non ha i dadi
  const shown: StatsTabId =
    tab === 'draw' && isDie ? 'dice' : tab === 'dice' && !isDie ? 'draw' : tab

  const common = { ctx, onTable, filter: props.filter, onFilter: props.onFilter }

  const aside = (
    <aside
      ref={panel}
      className={floating ? 'stats-panel floating' : 'stats-panel'}
      aria-label={t('stats.title')}
      style={
        floating
          ? { left: floating.x, top: floating.y, width: floating.w, height: floating.h }
          : { width }
      }
    >
      {floating && (
        <div
          className="note-grip"
          title={t('notes.move')}
          aria-label={t('notes.move')}
          {...dragHandlers}
        />
      )}
      <div className="stats-head" {...dragHandlers}>
        <h2>{t('stats.title')}</h2>
        <span className="spacer" />
        <Menu
          label={copied ? t('stats.copied') : t('stats.copy')}
          title={t('stats.copyHint')}
          alignRight
          items={[
            { label: t('stats.copyTsv'), disabled: !table.length, onClick: () => void copy('tsv') },
            { label: t('stats.copyMd'), disabled: !table.length, onClick: () => void copy('md') }
          ]}
        />
        <button
          className="icon-btn"
          title={floating ? t('notes.dock') : t('notes.detach')}
          aria-label={floating ? t('notes.dock') : t('notes.detach')}
          onClick={toggle}
        >
          {floating ? <DockIcon /> : <DetachIcon />}
        </button>
        <button className="icon-btn note-close" title={t('stats.close')} onClick={props.onClose}>
          ×
        </button>
      </div>
      <div className="stats-tabs" role="tablist">
        {tabs.map(([id, label, tip]) => (
          <button
            key={id}
            role="tab"
            aria-selected={shown === id}
            className={shown === id ? 'on' : undefined}
            title={tip}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="stats-scope muted small">
        <span>
          {t(props.searched ? 'stats.scopeSearched' : 'stats.scope', {
            rows: rows.length,
            cards: ctx.amounts.reduce((s, n) => s + n, 0)
          })}
        </span>
        {hasAmount && shown !== 'draw' && shown !== 'dice' && (
          <label className="check" title={t('stats.copiesHint')}>
            <input type="checkbox" checked={copies} onChange={(e) => setCopies(e.target.checked)} />
            {t('stats.copies')}
          </label>
        )}
      </div>
      <div className="stats-body">
        {!fields.length ? (
          <p className="muted">{t('stats.noFields')}</p>
        ) : shown === 'values' ? (
          <ValuesTab {...common} field={valuesField} onField={setValuesField} />
        ) : shown === 'pivot' ? (
          <PivotTab {...common} />
        ) : shown === 'scatter' ? (
          <ScatterTab {...common} cards={props.cards} onShowCard={props.onShowCard} />
        ) : shown === 'draw' ? (
          <DrawTab
            {...common}
            set={props.set}
            sets={props.sets}
            cards={props.cards}
            bindOther={props.bindOther}
          />
        ) : shown === 'dice' ? (
          <DiceTab {...common} />
        ) : shown === 'texts' ? (
          <TextsTab {...common} />
        ) : (
          <OverviewTab
            {...common}
            onOpen={(f) => {
              setValuesField(f)
              setTab('values')
            }}
          />
        )}
      </div>
    </aside>
  )

  if (floating) return aside
  return (
    <>
      <Resizer width={width} onChange={setWidth} edge="right" min={340} max={900} />
      {aside}
    </>
  )
}
