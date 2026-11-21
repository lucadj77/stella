import { useMemo, useState } from 'react'
import type { LoadedProject, LoadedSet } from '../../../shared/project'
import { fuzzyFilter } from '../../../shared/model/fuzzy'
import { derivedOf } from '../../../shared/model/inherit'
import { countCards, firstLine, usesOf, type UsesIndex } from '../../../shared/model/overview'
import { kindOf, type ComponentKind, type Template } from '../../../shared/model/template'
import { toUnit } from '../../../shared/model/units'
import { askConfirm } from '../components/confirm'
import type { MenuItem } from '../components/Menu'
import ThumbBackgroundSwitch from '../components/ThumbBackgroundSwitch'
import { thumbClass, useThumbBackground } from '../components/thumbBackground'
import { useContextMenu } from '../components/useContextMenu'
import { KindIcon } from '../export/exportIcons'
import { useI18n } from '../i18n/context'
import { delLabel } from './summary'
import { useLengthUnit } from '../units'
import { setFor, useCards } from './cards'
import { Thumb } from './Thumb'
import ListPane, { DetailList, Filters, Link, LinkList } from './ListPane'
import { useSelection } from './selection'
import { useManageNav, type ManageActions } from './manageTypes'
import { UsesLinks } from './UsagesLinks'

// Schede Set, Template, Documenti e Note di «Gestisci il progetto». Le azioni sono quelle dei
// menu della barra laterale; un doppio clic apre l'elemento (la griglia, l'editor, il documento).

/** I comandi di un menu come pulsanti del pannello laterale */
function MenuButtons({ items }: { items: MenuItem[] }): React.JSX.Element {
  return (
    <>
      {items.map((it, i) =>
        it === 'sep' ? null : (
          <button
            key={i}
            className={it.danger ? 'danger' : undefined}
            title={it.title}
            disabled={it.disabled}
            onClick={it.onClick}
          >
            {it.label}
          </button>
        )
      )}
    </>
  )
}

const ROW_THUMB = 40

export function TemplatesPane({
  project,
  names,
  uses,
  focus,
  actions
}: {
  project: LoadedProject
  names: string[]
  uses: UsesIndex
  focus?: string
  actions: ManageActions
}): React.JSX.Element {
  const { t } = useI18n()
  const { go } = useManageNav()
  const menu = useContextMenu()
  const unit = useLengthUnit()
  const cards = useCards(project)
  const [bg, setBg] = useThumbBackground()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const tpl = (n: string): Template => project.templates.find((x) => x.name === n)!
  const setsOf = (n: string): string[] =>
    project.sets.filter((s) => s.template === n).map((s) => s.name)
  const matches = (n: string, f: string): boolean =>
    f === 'all' ||
    (f === 'derived'
      ? !!tpl(n).extends
      : f === 'base'
        ? !tpl(n).extends
        : f === 'unused'
          ? !setsOf(n).length && !derivedOf(project.templates, n).length
          : kindOf(tpl(n)) === f)
  const shown = useMemo(
    () =>
      fuzzyFilter(
        names.filter((n) => matches(n, filter)),
        query,
        (n) => n
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [names, filter, query, project]
  )
  const sel = useSelection(shown, focus)
  const single = sel.chosen.length === 1 ? sel.chosen[0] : null
  // i template eliminati escono da sel.chosen da soli: non sono più nella lista
  const remove = (list: string[]): Promise<void> => actions.deleteTemplates(list)
  const kinds = [...new Set(names.map((n) => kindOf(tpl(n))))]
  const filters = ['all', ...(kinds.length > 1 ? kinds : []), 'base', 'derived', 'unused'].map(
    (f) => ({
      id: f,
      label: ['all', 'base', 'derived', 'unused'].includes(f)
        ? t(`manage.filter.${f as 'all' | 'base' | 'derived' | 'unused'}`)
        : t(`kind.${f as ComponentKind}`),
      count: names.filter((n) => matches(n, f)).length,
      hint: f === 'unused' ? t('manage.templates.unusedHint') : undefined
    })
  )
  const size = (n: string): string =>
    `${toUnit(tpl(n).width, unit)}×${toUnit(tpl(n).height, unit)} ${unit}`
  const front = (n: string): Template => cards(tpl(n), setFor(project, n), 1)[0]

  return (
    <>
      <ListPane
        filters={<Filters filters={filters} value={filter} onChange={setFilter} />}
        tools={
          <>
            <ThumbBackgroundSwitch value={bg} onChange={setBg} />
            <button className="primary" onClick={actions.newTemplate}>
              {t('manage.templates.new')}
            </button>
          </>
        }
        tableClass={'with-thumbs' + thumbClass(bg)}
        query={query}
        onQuery={setQuery}
        columns={[
          { label: '', className: 'manage-thumb-cell' },
          { label: t('manage.col.name') },
          { label: t('manage.col.kind') },
          { label: t('manage.col.size') },
          { label: t('manage.col.base') },
          { label: t('manage.col.sets') }
        ]}
        rows={shown.map((n) => {
          const sets = setsOf(n)
          return {
            key: n,
            cells: [
              <Thumb key="t" card={front(n)} height={ROW_THUMB} />,
              <strong key="n">{n}</strong>,
              <span key="k" className="manage-kind">
                <KindIcon kind={kindOf(tpl(n))} size={16} />
                {t(`kind.${kindOf(tpl(n))}`)}
              </span>,
              size(n),
              tpl(n).extends ? (
                <Link key="b" onClick={() => go('templates', tpl(n).extends!)}>
                  {tpl(n).extends}
                </Link>
              ) : (
                ''
              ),
              sets.length ? (
                <LinkList key="s" items={sets} onClick={(s) => go('sets', s)} />
              ) : (
                <span key="s" className="muted">
                  {t('manage.noSets')}
                </span>
              )
            ]
          }
        })}
        total={names.length}
        sel={sel}
        onOpen={actions.openTemplate}
        onDelete={(list) => void remove(list)}
        onMenu={(e, list) =>
          menu.open(
            e,
            list.length === 1
              ? [
                  { label: t('manage.openEditor'), onClick: () => actions.openTemplate(list[0]) },
                  'sep',
                  ...actions.templateMenu(list[0])
                ]
              : [
                  {
                    label: delLabel(t, list.length),
                    danger: true,
                    onClick: () => void remove(list)
                  }
                ]
          )
        }
        empty={t('manage.templates.empty')}
        side={
          sel.chosen.length > 1 ? (
            <div className="images-actions">
              <p>
                <strong>{t('manage.selected', { n: sel.chosen.length })}</strong>
              </p>
              <button className="danger" onClick={() => void remove(sel.chosen)}>
                {delLabel(t, sel.chosen.length)}
              </button>
            </div>
          ) : !single ? (
            <p className="muted small">{t('manage.selectHint')}</p>
          ) : (
            <div className="images-details">
              <h3 className="manage-title">{single}</h3>
              <div className={'manage-preview manage-cards' + thumbClass(bg)}>
                <Thumb card={front(single)} height={130} width={110} />
                <Thumb card={front(single)} height={130} width={110} side="back" />
              </div>
              <p className="muted small">
                {t(`kind.${kindOf(tpl(single))}`)} · {size(single)}
              </p>
              <DetailList
                rows={[
                  [
                    t('manage.col.base'),
                    <Link key="b" onClick={() => go('templates', tpl(single).extends!)}>
                      {tpl(single).extends}
                    </Link>,
                    !!tpl(single).extends
                  ],
                  [
                    t('manage.derived'),
                    <LinkList
                      key="d"
                      items={derivedOf(project.templates, single).map((x) => x.name)}
                      onClick={(n) => go('templates', n)}
                    />,
                    derivedOf(project.templates, single).length > 0
                  ],
                  [
                    t('manage.col.sets'),
                    setsOf(single).length ? (
                      <LinkList key="s" items={setsOf(single)} onClick={(s) => go('sets', s)} />
                    ) : (
                      <span className="muted">{t('manage.noSets')}</span>
                    ),
                    true
                  ]
                ]}
              />
              <UsesLinks uses={usesOf(uses.templates, single)} />
              <div className="images-actions">
                <button className="primary" onClick={() => actions.openTemplate(single)}>
                  {t('manage.openEditor')}
                </button>
                <MenuButtons items={actions.templateMenu(single)} />
              </div>
            </div>
          )
        }
      />
      {menu.node}
    </>
  )
}

export function SetsPane({
  project,
  uses,
  focus,
  actions
}: {
  project: LoadedProject
  uses: UsesIndex
  focus?: string
  actions: ManageActions
}): React.JSX.Element {
  const { t } = useI18n()
  const { go } = useManageNav()
  const menu = useContextMenu()
  const cards = useCards(project)
  const [bg, setBg] = useThumbBackground()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const names = project.sets.map((s) => s.name)
  const index = (n: string): number => project.sets.findIndex((s) => s.name === n)
  const set = (n: string): LoadedSet => project.sets[index(n)]
  const templates = [...new Set(project.sets.map((s) => s.template))].sort()
  const matches = (n: string, f: string): boolean =>
    f === 'all' || (f === 'empty' ? !set(n).data?.rows.length : set(n).template === f)
  const shown = useMemo(
    () =>
      fuzzyFilter(
        names.filter((n) => matches(n, filter)),
        query,
        (n) => `${n} ${set(n).template}`
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, filter, query]
  )
  const sel = useSelection(shown, focus)
  const single = sel.chosen.length === 1 ? sel.chosen[0] : null
  const tplOf = (n: string): Template | undefined =>
    project.templates.find((x) => x.name === set(n).template)
  const filters = [
    { id: 'all', label: t('manage.filter.all'), count: names.length },
    ...(templates.length > 1
      ? templates.map((x) => ({
          id: x,
          label: x,
          count: names.filter((n) => matches(n, x)).length,
          hint: t('manage.sets.byTemplate', { name: x })
        }))
      : []),
    {
      id: 'empty',
      label: t('manage.filter.empty'),
      count: names.filter((n) => matches(n, 'empty')).length
    }
  ]

  return (
    <>
      <ListPane
        filters={<Filters filters={filters} value={filter} onChange={setFilter} />}
        tools={
          <>
            <ThumbBackgroundSwitch value={bg} onChange={setBg} />
            <button className="primary" onClick={actions.newSet}>
              {t('manage.sets.new')}
            </button>
          </>
        }
        tableClass={'with-thumbs' + thumbClass(bg)}
        query={query}
        onQuery={setQuery}
        columns={[
          { label: '', className: 'manage-thumb-cell' },
          { label: t('manage.col.name') },
          { label: t('manage.col.template') },
          { label: t('manage.col.rows'), className: 'num' },
          { label: t('manage.col.cards'), className: 'num' }
        ]}
        rows={shown.map((n) => {
          const s = set(n)
          const tpl = tplOf(n)
          return {
            key: n,
            cells: [
              tpl ? <Thumb key="t" card={cards(tpl, s, 1)[0]} height={ROW_THUMB} /> : null,
              <strong key="n">{n}</strong>,
              <Link key="tp" onClick={() => go('templates', s.template)}>
                {s.template}
              </Link>,
              s.data?.rows.length ?? '–',
              s.data ? countCards(s.data) : '–'
            ]
          }
        })}
        total={names.length}
        sel={sel}
        onOpen={(n) => actions.openSet(index(n))}
        onMenu={(e, list) =>
          list.length === 1 &&
          menu.open(e, [
            { label: t('manage.openGrid'), onClick: () => actions.openSet(index(list[0])) },
            'sep',
            ...actions.setMenu(index(list[0]))
          ])
        }
        empty={t('manage.sets.empty')}
        side={
          !single ? (
            <p className="muted small">
              {sel.chosen.length > 1 ? t('manage.oneAtATime') : t('manage.selectHint')}
            </p>
          ) : (
            <div className="images-details">
              <h3 className="manage-title">{single}</h3>
              {tplOf(single) && (
                <div className={'manage-preview manage-cards' + thumbClass(bg)}>
                  {cards(tplOf(single)!, set(single), 3).map((c, i) => (
                    <Thumb key={i} card={c} height={110} width={70} />
                  ))}
                </div>
              )}
              <DetailList
                rows={[
                  [
                    t('manage.col.template'),
                    <Link key="t" onClick={() => go('templates', set(single).template)}>
                      {set(single).template}
                    </Link>,
                    true
                  ],
                  [
                    t('manage.col.cards'),
                    t('manage.sets.count', {
                      rows: set(single).data?.rows.length ?? 0,
                      cards: set(single).data ? countCards(set(single).data!) : 0
                    }),
                    true
                  ]
                ]}
              />
              <UsesLinks uses={usesOf(uses.sets, single)} />
              <div className="images-actions">
                <button className="primary" onClick={() => actions.openSet(index(single))}>
                  {t('manage.openGrid')}
                </button>
                <MenuButtons items={actions.setMenu(index(single))} />
              </div>
            </div>
          )
        }
      />
      {menu.node}
    </>
  )
}

const words = (text: string): number => (text.match(/[\p{L}\p{N}]+/gu) ?? []).length

export function DocumentsPane({
  project,
  uses,
  focus,
  actions
}: {
  project: LoadedProject
  uses: UsesIndex
  focus?: string
  actions: ManageActions
}): React.JSX.Element {
  const { t } = useI18n()
  const menu = useContextMenu()
  const [query, setQuery] = useState('')
  const docs = project.documents ?? []
  const text = (n: string): string => docs.find((d) => d.name === n)?.text ?? ''
  const shown = useMemo(
    () =>
      fuzzyFilter(
        docs.map((d) => d.name),
        query,
        (n) => n
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.documents, query]
  )
  const sel = useSelection(shown, focus)
  const single = sel.chosen.length === 1 ? sel.chosen[0] : null
  return (
    <>
      <ListPane
        tools={
          <button className="primary" onClick={actions.newDocument}>
            {t('manage.documents.new')}
          </button>
        }
        query={query}
        onQuery={setQuery}
        columns={[
          { label: t('manage.col.name') },
          { label: t('manage.col.start'), className: 'manage-value' },
          { label: t('manage.col.words'), className: 'num' }
        ]}
        rows={shown.map((n) => ({
          key: n,
          cells: [
            <strong key="n">{n}</strong>,
            <span key="s" className="manage-ellipsis muted">
              {firstLine(text(n))}
            </span>,
            words(text(n))
          ]
        }))}
        total={docs.length}
        sel={sel}
        onOpen={actions.openDocument}
        onMenu={(e, list) =>
          list.length === 1 &&
          menu.open(e, [
            { label: t('manage.open'), onClick: () => actions.openDocument(list[0]) },
            'sep',
            ...actions.documentMenu(list[0])
          ])
        }
        empty={t('manage.documents.empty')}
        side={
          !single ? (
            <p className="muted small">
              {sel.chosen.length > 1 ? t('manage.oneAtATime') : t('manage.selectHint')}
            </p>
          ) : (
            <div className="images-details">
              <h3 className="manage-title">{single}</h3>
              <p className="manage-excerpt">{firstLine(text(single), 400)}</p>
              <p className="muted small">{t('manage.words', { n: words(text(single)) })}</p>
              <UsesLinks uses={usesOf(uses.documents, single)} />
              <div className="images-actions">
                <button className="primary" onClick={() => actions.openDocument(single)}>
                  {t('manage.open')}
                </button>
                <MenuButtons items={actions.documentMenu(single)} />
              </div>
            </div>
          )
        }
      />
      {menu.node}
    </>
  )
}

export function NotesPane({
  project,
  focus,
  actions
}: {
  project: LoadedProject
  focus?: string
  actions: ManageActions
}): React.JSX.Element {
  const { t } = useI18n()
  const menu = useContextMenu()
  const [query, setQuery] = useState('')
  const notes = project.notes ?? []
  const text = (n: string): string => notes.find((d) => d.name === n)?.text ?? ''
  const shown = useMemo(
    () =>
      fuzzyFilter(
        notes.map((d) => d.name),
        query,
        (n) => `${n} ${text(n)}`
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.notes, query]
  )
  const sel = useSelection(shown, focus)
  const single = sel.chosen.length === 1 ? sel.chosen[0] : null
  const remove = async (list: string[]): Promise<void> => {
    const ok = await askConfirm({
      title:
        list.length === 1
          ? t('manage.notes.deleteOne', { name: list[0] })
          : t('manage.notes.deleteMany', { n: list.length }),
      ok: delLabel(t, list.length),
      danger: true
    })
    if (!ok) return
    list.forEach(actions.deleteNote)
    sel.set([])
  }
  return (
    <>
      <ListPane
        hint={t('manage.notes.hint')}
        tools={
          <button className="primary" onClick={actions.newNote}>
            {t('manage.notes.new')}
          </button>
        }
        query={query}
        onQuery={setQuery}
        columns={[
          { label: t('manage.col.name') },
          { label: t('manage.col.start'), className: 'manage-value' }
        ]}
        rows={shown.map((n) => ({
          key: n,
          cells: [
            <strong key="n">{n}</strong>,
            <span key="s" className="manage-ellipsis muted">
              {firstLine(text(n))}
            </span>
          ]
        }))}
        total={notes.length}
        sel={sel}
        onOpen={actions.openNote}
        onDelete={(list) => void remove(list)}
        onMenu={(e, list) =>
          menu.open(e, [
            ...(list.length === 1
              ? [
                  { label: t('manage.open'), onClick: () => actions.openNote(list[0]) },
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
        empty={t('manage.notes.empty')}
        side={
          sel.chosen.length === 0 ? (
            <p className="muted small">{t('manage.selectHint')}</p>
          ) : single ? (
            <div className="images-details">
              <h3 className="manage-title">{single}</h3>
              <p className="manage-excerpt">{text(single).slice(0, 600)}</p>
              <div className="images-actions">
                <button className="primary" onClick={() => actions.openNote(single)}>
                  {t('manage.open')}
                </button>
                <button className="danger" onClick={() => void remove([single])}>
                  {delLabel(t, 1)}
                </button>
              </div>
            </div>
          ) : (
            <div className="images-actions">
              <p>
                <strong>{t('manage.selected', { n: sel.chosen.length })}</strong>
              </p>
              <button className="danger" onClick={() => void remove(sel.chosen)}>
                {delLabel(t, sel.chosen.length)}
              </button>
            </div>
          )
        }
      />
      {menu.node}
    </>
  )
}
