import { useMemo, useState } from 'react'
import type { LoadedProject } from '../../../shared/project'
import { fuzzyFilter } from '../../../shared/model/fuzzy'
import { BUILTIN_STYLES } from '../../../shared/model/markup'
import { groupOf } from '../../../shared/model/order'
import type { RefKind } from '../../../shared/model/rename'
import { isUnused, type Usages } from '../../../shared/model/usages'
import { VARIABLE_TYPES, type Variable, type VariableType } from '../../../shared/model/variables'
import { askConfirm } from '../components/confirm'
import { VariableBody } from '../components/SidebarPreview'
import { VariableSwatch } from '../components/VariableDialog'
import { useContextMenu } from '../components/useContextMenu'
import { useI18n } from '../i18n/context'
import { delLabel } from './summary'
import { VariablesContext } from '../render/assets'
import MarkupText from '../render/MarkupText'
import ListPane, { Filters } from './ListPane'
import { useSelection } from './selection'
import type { ManageActions } from './manageTypes'
import { usageSummary } from './summary'
import { UsagesLinks } from './UsagesLinks'

// Schede Variabili e Stili di «Gestisci il progetto»: dove sono usati, filtri, selezione
// multipla; si creano, si modificano (nella loro finestra), si duplicano e si eliminano.

type T = ReturnType<typeof useI18n>['t']

/** Chiede conferma prima di eliminare, avvisando se qualcuno è ancora usato */
async function confirmDelete(
  t: T,
  kind: RefKind,
  names: string[],
  usages: Map<string, Usages>
): Promise<boolean> {
  const label = (n: string): string => (kind === 'variable' ? `{${n}}` : `.${n}`)
  const used = names.filter((n) => {
    const u = usages.get(n)
    return u && !isUnused(u)
  })
  return askConfirm({
    title:
      names.length === 1
        ? t(`manage.${kind}.deleteOne`, { name: label(names[0]) })
        : t(`manage.${kind}.deleteMany`, { n: names.length }),
    message: used.length
      ? t('manage.deleteUsed', {
          n: used.length,
          names: used.slice(0, 6).map(label).join(', ') + (used.length > 6 ? '…' : '')
        })
      : t('manage.deleteUnused'),
    ok: delLabel(t, names.length),
    danger: true
  })
}

function variableValue(v: Variable): string {
  if (v.type === 'color') return v.color
  if (v.type === 'image') return v.src
  if (v.type === 'text') return v.text
  return v.value
}

export function VariablesPane({
  project,
  names,
  usages,
  focus,
  actions
}: {
  project: LoadedProject
  /** Nell'ordine della barra laterale */
  names: string[]
  usages: Map<string, Usages>
  focus?: string
  actions: ManageActions
}): React.JSX.Element {
  const { t } = useI18n()
  const menu = useContextMenu()
  const variables = project.file.variables ?? {}
  const order = project.file.order
  const [filter, setFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const matches = (n: string, f: string): boolean =>
    f === 'all' || (f === 'unused' ? isUnused(usages.get(n)!) : variables[n]?.type === f)
  const shown = useMemo(
    () =>
      fuzzyFilter(
        names.filter((n) => matches(n, filter)),
        query,
        (n) => `${n} ${variableValue(variables[n])}`
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [names, filter, query, usages, variables]
  )
  const sel = useSelection(shown, focus)
  const remove = async (list: string[]): Promise<void> => {
    if (!list.length || !(await confirmDelete(t, 'variable', list, usages))) return
    actions.deleteDefinitions('variable', list)
    sel.set([])
  }
  const duplicate = (n: string): void => {
    const copy = actions.duplicateDefinition('variable', n)
    if (copy) sel.only(copy)
  }
  const single = sel.chosen.length === 1 ? sel.chosen[0] : null
  const filters = ['all', ...VARIABLE_TYPES, 'unused'].map((f) => ({
    id: f,
    label:
      f === 'all' || f === 'unused'
        ? t(`manage.filter.${f as 'all' | 'unused'}`)
        : t(`variable.type.${f as VariableType}`),
    count: names.filter((n) => matches(n, f)).length
  }))

  return (
    <>
      <ListPane
        hint={t('manage.variables.hint')}
        filters={<Filters filters={filters} value={filter} onChange={setFilter} />}
        tools={
          <button className="primary" onClick={() => actions.editVariable('')}>
            {t('manage.variables.new')}
          </button>
        }
        query={query}
        onQuery={setQuery}
        columns={[
          { label: '', className: 'manage-swatch' },
          { label: t('manage.col.name') },
          { label: t('manage.col.type') },
          { label: t('manage.col.value'), className: 'manage-value' },
          { label: t('manage.col.group') },
          { label: t('manage.col.used') }
        ]}
        rows={shown.map((n) => {
          const v = variables[n]
          const u = usages.get(n)!
          return {
            key: n,
            className: isUnused(u) ? 'unused' : undefined,
            cells: [
              v.type === 'color' || v.type === 'image' ? (
                <VariableSwatch key="s" v={v} variables={variables} />
              ) : null,
              <code key="n">{`{${n}}`}</code>,
              t(`variable.type.${v.type}`),
              <span key="v" className="manage-ellipsis" title={variableValue(v)}>
                {variableValue(v)}
              </span>,
              groupOf(order, 'variables', n),
              <span key="u" className="manage-used">
                {usageSummary(u, t) || t('manage.unused')}
              </span>
            ]
          }
        })}
        total={names.length}
        sel={sel}
        onOpen={(n) => actions.editVariable(n)}
        onDelete={(list) => void remove(list)}
        onMenu={(e, list) =>
          menu.open(e, [
            ...(list.length === 1
              ? [
                  { label: t('manage.edit'), onClick: () => actions.editVariable(list[0]) },
                  { label: t('sidebar.duplicate'), onClick: () => duplicate(list[0]) },
                  'sep' as const
                ]
              : []),
            {
              label: delLabel(t, list.length),
              danger: true,
              onClick: () => void remove(list)
            }
          ])
        }
        empty={t('manage.variables.empty')}
        side={
          sel.chosen.length === 0 ? (
            <p className="muted small">{t('manage.selectHint')}</p>
          ) : single ? (
            <div className="images-details">
              <h3 className="manage-title">{`{${single}}`}</h3>
              <div className="manage-preview">
                <VariableBody name={single} variables={variables} />
              </div>
              <p className="muted small">
                {t(`variable.type.${variables[single].type}`)}
                {groupOf(order, 'variables', single) &&
                  ` · ${t('manage.col.group')}: ${groupOf(order, 'variables', single)}`}
              </p>
              <UsagesLinks usages={usages.get(single)!} />
              <div className="images-actions">
                <button className="primary" onClick={() => actions.editVariable(single)}>
                  {t('manage.edit')}
                </button>
                <button onClick={() => duplicate(single)}>{t('sidebar.duplicate')}</button>
                <button className="danger" onClick={() => void remove([single])}>
                  {delLabel(t, 1)}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p>
                <strong>{t('manage.selected', { n: sel.chosen.length })}</strong>
              </p>
              <div className="images-actions">
                <button className="danger" onClick={() => void remove(sel.chosen)}>
                  {delLabel(t, sel.chosen.length)}
                </button>
              </div>
            </>
          )
        }
      />
      {menu.node}
    </>
  )
}

export function StylesPane({
  project,
  names,
  styles,
  usages,
  focus,
  actions
}: {
  project: LoadedProject
  names: string[]
  /** Stili del progetto con quelli predefiniti */
  styles: Record<string, string>
  usages: Map<string, Usages>
  focus?: string
  actions: ManageActions
}): React.JSX.Element {
  const { t } = useI18n()
  const menu = useContextMenu()
  const own = project.file.styles ?? {}
  const order = project.file.order
  const [filter, setFilter] = useState<string>('all')
  const [query, setQuery] = useState('')
  const builtin = (n: string): boolean => !(n in own)
  const matches = (n: string, f: string): boolean =>
    f === 'all' ||
    (f === 'unused' ? isUnused(usages.get(n)!) : f === 'builtin' ? builtin(n) : !builtin(n))
  const shown = useMemo(
    () =>
      fuzzyFilter(
        names.filter((n) => matches(n, filter)),
        query,
        (n) => `${n} ${styles[n] ?? ''}`
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [names, filter, query, usages, styles]
  )
  const sel = useSelection(shown, focus)
  /** Gli stili predefiniti non si eliminano: si toglie solo la versione del progetto */
  const deletable = (list: string[]): string[] => list.filter((n) => !builtin(n))
  const remove = async (list: string[]): Promise<void> => {
    const ok = deletable(list)
    if (!ok.length || !(await confirmDelete(t, 'style', ok, usages))) return
    actions.deleteDefinitions('style', ok)
    sel.set(ok.filter((n) => n in BUILTIN_STYLES))
  }
  const duplicate = (n: string): void => {
    const copy = actions.duplicateDefinition('style', n)
    if (copy) sel.only(copy)
  }
  const single = sel.chosen.length === 1 ? sel.chosen[0] : null
  const filters = ['all', 'project', 'builtin', 'unused'].map((f) => ({
    id: f,
    label: t(`manage.filter.${f as 'all' | 'project' | 'builtin' | 'unused'}`),
    count: names.filter((n) => matches(n, f)).length
  }))
  const sample = (n: string, big = false): React.JSX.Element => (
    <span className={big ? 'manage-style-sample big' : 'manage-style-sample'}>
      <VariablesContext.Provider value={project.file.variables ?? {}}>
        <MarkupText
          text={`[${t('sidebarPreview.sample')}]{.${n}}`}
          unit={big ? 4 : 3}
          ratio={1}
          paragraphSpacing={0}
        />
      </VariablesContext.Provider>
    </span>
  )
  const deleteLabel = (n: string): string =>
    n in BUILTIN_STYLES ? t('manage.style.restoreBuiltin') : delLabel(t, 1)

  return (
    <>
      <ListPane
        hint={t('manage.styles.hint')}
        filters={<Filters filters={filters} value={filter} onChange={setFilter} />}
        tools={
          <button className="primary" onClick={() => actions.editStyle('')}>
            {t('manage.styles.new')}
          </button>
        }
        query={query}
        onQuery={setQuery}
        columns={[
          { label: t('manage.col.sample'), className: 'manage-sample' },
          { label: t('manage.col.name') },
          { label: t('manage.col.definition'), className: 'manage-value' },
          { label: t('manage.col.group') },
          { label: t('manage.col.used') }
        ]}
        rows={shown.map((n) => {
          const u = usages.get(n)!
          return {
            key: n,
            className: isUnused(u) ? 'unused' : undefined,
            cells: [
              sample(n),
              <span key="n">
                <code>.{n}</code>
                {builtin(n) && <span className="muted small"> {t('sidebar.builtinStyle')}</span>}
              </span>,
              <code key="d" className="manage-ellipsis" title={styles[n]}>
                {styles[n]}
              </code>,
              groupOf(order, 'styles', n),
              <span key="u" className="manage-used">
                {usageSummary(u, t) || t('manage.unused')}
              </span>
            ]
          }
        })}
        total={names.length}
        sel={sel}
        onOpen={(n) => actions.editStyle(n)}
        onDelete={(list) => void remove(list)}
        onMenu={(e, list) =>
          menu.open(e, [
            ...(list.length === 1
              ? [
                  { label: t('manage.edit'), onClick: () => actions.editStyle(list[0]) },
                  { label: t('sidebar.duplicate'), onClick: () => duplicate(list[0]) },
                  'sep' as const
                ]
              : []),
            {
              label: list.length === 1 ? deleteLabel(list[0]) : delLabel(t, list.length),
              danger: true,
              disabled: !deletable(list).length,
              onClick: () => void remove(list)
            }
          ])
        }
        empty={t('manage.styles.empty')}
        side={
          sel.chosen.length === 0 ? (
            <p className="muted small">{t('manage.selectHint')}</p>
          ) : single ? (
            <div className="images-details">
              <h3 className="manage-title">.{single}</h3>
              <div className="manage-preview">{sample(single, true)}</div>
              <code>{styles[single]}</code>
              {builtin(single) && <p className="muted small">{t('manage.style.builtinHint')}</p>}
              <UsagesLinks usages={usages.get(single)!} />
              <div className="images-actions">
                <button className="primary" onClick={() => actions.editStyle(single)}>
                  {t('manage.edit')}
                </button>
                <button onClick={() => duplicate(single)}>{t('sidebar.duplicate')}</button>
                {!builtin(single) && (
                  <button className="danger" onClick={() => void remove([single])}>
                    {deleteLabel(single)}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <p>
                <strong>{t('manage.selected', { n: sel.chosen.length })}</strong>
              </p>
              <div className="images-actions">
                <button
                  className="danger"
                  disabled={!deletable(sel.chosen).length}
                  onClick={() => void remove(sel.chosen)}
                >
                  {delLabel(t, deletable(sel.chosen).length)}
                </button>
              </div>
            </>
          )
        }
      />
      {menu.node}
    </>
  )
}
