import { useEffect, useRef, useState } from 'react'
import { findParent, isNameTaken, moveLayerTo, patchLayer } from '../../../shared/model/edit'
import { switchSource } from '../../../shared/model/bind'
import type { Layer, Template, ValueSource } from '../../../shared/model/template'
import { layerStatus, revertLayer } from '../../../shared/model/inherit'
import { useI18n } from '../i18n/context'
import HelpTip from '../components/HelpTip'
import {
  ColumnIcon,
  FixedIcon,
  GridIcon,
  ImageIcon,
  LinkIcon,
  RevertIcon
} from '../components/icons'
import type { Commands } from './commands'
import type { EditorAction, EditorState } from './useEditor'
import PanelSideButton from '../components/PanelSideButton'
import type { PanelSide } from '../components/usePanelWidth'

interface Props {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
  cmd: Commands
  width: number
  side: PanelSide
  onToggleSide(): void
  /** Template base già risolto, se il template è derivato */
  base?: Template | null
}

type DropWhere = 'before' | 'after' | 'inside'

const ICONS: Record<string, React.ReactNode> = {
  text: 'T',
  image: <ImageIcon />,
  group: '▤',
  rect: '■',
  ellipse: '●',
  polygon: '⬢',
  star: '★',
  line: '╱',
  path: '✎',
  grid: <GridIcon />,
  value: '#'
}

const SOURCE_KINDS: ValueSource['kind'][] = ['column', 'fixed', 'formula']

function SourceIcon({ kind }: { kind: ValueSource['kind'] }): React.ReactNode {
  return kind === 'column' ? <ColumnIcon /> : kind === 'formula' ? 'ƒx' : <FixedIcon />
}

export default function LayersPanel({
  state,
  dispatch,
  cmd,
  width,
  side: panelSide,
  onToggleSide,
  base = null
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ id: string; where: DropWhere } | null>(null)
  const [sourceMenu, setSourceMenu] = useState<string | null>(null)
  const { template: tpl, side, selection } = state
  const layers = tpl[side]

  // il menu della fonte si chiude con un clic altrove o con Esc
  useEffect(() => {
    if (!sourceMenu) return
    const close = (e: Event): void => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e.target instanceof Element && e.target.closest('.source-menu')) return
      setSourceMenu(null)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [sourceMenu])

  // si seleziona il livello, così il pannello proprietà mostra la colonna o la formula
  const changeSource = (l: Layer, kind: ValueSource['kind']): void => {
    setSourceMenu(null)
    const source = switchSource(l, kind)
    const parent = findParent(layers, l.id)?.id ?? null
    if (source === l.source) dispatch({ type: 'select', ids: [l.id], scope: parent })
    else
      dispatch({
        type: 'change',
        template: patchLayer(tpl, side, l.id, { source }),
        selection: [l.id]
      })
  }

  /** Ultimo livello scelto senza Maiuscolo: un estremo dell'intervallo */
  const anchor = useRef<string | null>(null)
  // ⌘ (Ctrl) aggiunge o toglie un livello; Maiuscolo seleziona l'intervallo tra l'ultimo
  // livello scelto e quello cliccato, nello stesso gruppo
  const select = (l: Layer, e: React.MouseEvent): void => {
    const parentLayer = findParent(layers, l.id)
    const parent = parentLayer?.id ?? null
    const siblings = parentLayer ? parentLayer.children : layers
    const sameParent = selection.every((id) => (findParent(layers, id)?.id ?? null) === parent)
    let ids = [l.id]
    // l'estremo vale finché è selezionato (la selezione può cambiare anche dalla carta)
    const start =
      anchor.current && selection.includes(anchor.current) ? anchor.current : selection[0]
    const from = siblings.findIndex((x) => x.id === start)
    if (e.shiftKey && sameParent && from >= 0) {
      const to = siblings.findIndex((x) => x.id === l.id)
      const [a, b] = from < to ? [from, to] : [to, from]
      ids = siblings.slice(a, b + 1).map((x) => x.id)
    } else {
      if ((e.metaKey || e.ctrlKey) && sameParent)
        ids = selection.includes(l.id)
          ? selection.filter((id) => id !== l.id)
          : [...selection, l.id]
      anchor.current = l.id
    }
    dispatch({ type: 'select', ids, scope: parent })
  }

  const rename = (l: Layer, name: string): void => {
    setRenaming(null)
    const clean = name.trim()
    if (!clean || clean === l.name || /[.{}[\]]/.test(clean) || isNameTaken(tpl, clean, l.id))
      return
    dispatch({ type: 'change', template: patchLayer(tpl, side, l.id, { name: clean }) })
  }

  const rows = (list: Layer[], depth: number): React.ReactNode =>
    list.map((l) => {
      const open = l.type === 'group' && !collapsed.has(l.id)
      // in un derivato: livello del base, cambiato, o solo di questo template
      const status = base ? layerStatus(base, l).status : null
      const own = status === null || status === 'added'
      return (
        <li key={l.id}>
          <div
            className={[
              'layer-row',
              selection.includes(l.id) && 'selected',
              !l.visible && 'hidden',
              dragging === l.id && 'dragging',
              drop?.id === l.id && `drop-${drop.where}`
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ paddingLeft: 6 + depth * 14 }}
            onClick={(e) => select(l, e)}
            onDoubleClick={() => own && setRenaming(l.id)}
            draggable={renaming !== l.id && own}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', l.name)
              setDragging(l.id)
            }}
            onDragEnd={() => {
              setDragging(null)
              setDrop(null)
            }}
            onDragOver={(e) => {
              if (!dragging || dragging === l.id) return
              e.preventDefault()
              const r = e.currentTarget.getBoundingClientRect()
              const f = (e.clientY - r.top) / r.height
              // al centro di un gruppo si entra nel gruppo, ai bordi si va sopra o sotto
              const where: DropWhere =
                l.type === 'group' && f > 0.25 && f < 0.75 ? 'inside' : f < 0.5 ? 'before' : 'after'
              if (drop?.id !== l.id || drop.where !== where) setDrop({ id: l.id, where })
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragging && drop) {
                const moved = moveLayerTo(tpl, side, dragging, drop.id, drop.where)
                if (moved !== tpl)
                  dispatch({ type: 'change', template: moved, selection: [dragging] })
              }
              setDragging(null)
              setDrop(null)
            }}
          >
            <span
              className="layer-twisty"
              onClick={(e) => {
                if (l.type !== 'group') return
                e.stopPropagation()
                const next = new Set(collapsed)
                if (open) next.add(l.id)
                else next.delete(l.id)
                setCollapsed(next)
              }}
            >
              {l.type === 'group' ? (open ? '▾' : '▸') : ''}
            </span>
            <span className="layer-icon">{ICONS[l.type === 'shape' ? l.shape : l.type]}</span>
            {renaming === l.id ? (
              <input
                className="layer-rename"
                autoFocus
                defaultValue={l.name}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => rename(l, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') rename(l, e.currentTarget.value)
                  if (e.key === 'Escape') setRenaming(null)
                }}
              />
            ) : (
              <span className="layer-name">{l.name}</span>
            )}
            {status === 'inherited' && (
              <span className="layer-inherit" title={t('inherit.layerFromBase')}>
                <LinkIcon />
              </span>
            )}
            {status === 'changed' && (
              <button
                className="layer-inherit changed"
                title={`${t('inherit.layerChanged')}\n${t('inherit.revertLayer')}`}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'change', template: revertLayer(base!, tpl, l.id) })
                }}
              >
                <RevertIcon />
              </button>
            )}
            {status === 'added' && (
              <span className="layer-inherit added" title={t('inherit.layerAdded')}>
                +
              </span>
            )}
            {l.type !== 'group' && (
              <span className="layer-source-wrap">
                <button
                  className={`layer-source ${l.source.kind}${sourceMenu === l.id ? ' open' : ''}`}
                  title={`${
                    l.source.kind === 'column'
                      ? t('layers.sourceColumn', { column: l.source.column ?? l.name })
                      : l.source.kind === 'formula'
                        ? t('layers.sourceFormula', { expr: l.source.expr })
                        : t('layers.sourceFixed')
                  }\n${t('layers.sourceChange')}`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSourceMenu(sourceMenu === l.id ? null : l.id)
                  }}
                >
                  <SourceIcon kind={l.source.kind} />
                </button>
                {sourceMenu === l.id && (
                  <div className="source-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                    {SOURCE_KINDS.map((kind) => (
                      <button
                        key={kind}
                        role="menuitemradio"
                        aria-checked={l.source.kind === kind}
                        className={l.source.kind === kind ? 'on' : undefined}
                        onClick={() => changeSource(l, kind)}
                      >
                        <span className={`layer-source ${kind}`}>
                          <SourceIcon kind={kind} />
                        </span>
                        {t(`source.kind.${kind}`)}
                      </button>
                    ))}
                  </div>
                )}
              </span>
            )}
            <button
              className={`icon-btn${l.locked ? ' on' : ''}`}
              title={l.locked ? t('layers.unlock') : t('layers.lock')}
              onClick={(e) => {
                e.stopPropagation()
                cmd.toggle(l.id, 'locked')
              }}
            >
              {l.locked ? '🔒' : '🔓'}
            </button>
            <button
              className={`icon-btn${l.visible ? '' : ' on'}`}
              title={l.visible ? t('layers.hide') : t('layers.show')}
              onClick={(e) => {
                e.stopPropagation()
                cmd.toggle(l.id, 'visible')
              }}
            >
              {l.visible ? '👁' : '–'}
            </button>
          </div>
          {open && l.type === 'group' && <ul>{rows(l.children, depth + 1)}</ul>}
        </li>
      )
    })

  const none = selection.length === 0
  return (
    <aside className="layers" data-side={panelSide} style={{ width }}>
      <h2 className="with-action">
        {t('layers.title')}
        <HelpTip text={t('layers.hint')} />
        <PanelSideButton side={panelSide} onToggle={onToggleSide} />
      </h2>
      <div className="layers-list">
        {layers.length ? (
          <ul>{rows(layers, 0)}</ul>
        ) : (
          <p className="muted small">{t('layers.empty')}</p>
        )}
      </div>
      <div className="layers-actions">
        <button disabled={!cmd.canMove} title={t('layers.up')} onClick={() => cmd.move('up')}>
          ↑
        </button>
        <button disabled={!cmd.canMove} title={t('layers.down')} onClick={() => cmd.move('down')}>
          ↓
        </button>
        <button disabled={!cmd.canGroup} title={t('layers.group')} onClick={cmd.group}>
          ⊞
        </button>
        <button disabled={!cmd.canUngroup} title={t('layers.ungroup')} onClick={cmd.ungroup}>
          ⊟
        </button>
        <button disabled={none} title={t('layers.duplicate')} onClick={cmd.duplicate}>
          ⧉
        </button>
        <button disabled={none} title={t('layers.delete')} onClick={cmd.remove}>
          🗑
        </button>
      </div>
    </aside>
  )
}
