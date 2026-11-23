import { useMemo, useState } from 'react'
import { isValidTemplateName, walkLayers } from '../../../shared/model/normalize'
import { patchLayer } from '../../../shared/model/edit'
import {
  PRIMARY_PROPERTY,
  type Layer,
  type Side,
  type Template
} from '../../../shared/model/template'
import CardSvg from '../render/CardSvg'
import { Dialog } from '../editor/dialogs'
import { OptionThumb } from '../editor/ListOptions'
import AssetPicker from './AssetPicker'
import { ColorSwatch } from './ColorPicker'
import { useI18n } from '../i18n/context'
import { useContextMenu } from './useContextMenu'
import { moveItem, useDragReorder } from './useDragReorder'

/** Una colonna della tabella: il valore principale di un livello del base */
interface Column {
  id: string
  side: Side
  name: string
  type: Layer['type']
  key: string
}

/** Altezza delle miniature, in pixel */
const THUMB = 84

const valueOf = (l: Layer | undefined, key: string): unknown =>
  l ? (l as unknown as Record<string, unknown>)[key] : undefined

const layerIn = (t: Template, c: Column): Layer | undefined =>
  walkLayers(t[c.side]).find((l) => l.id === c.id)

/**
 * Le varianti di un template: una riga per variante, con la miniatura, e una colonna per ogni
 * livello che le varianti cambiano. Qui si cambia il valore principale (immagine, colore, testo,
 * visibilità); per il resto si apre la variante nell'editor.
 */
export default function VariantsDialog({
  base,
  variants,
  names,
  onAdd,
  onChange,
  onOpen,
  onDelete,
  onDetach,
  onReorder,
  onClose
}: {
  base: Template
  variants: Template[]
  /** Nomi dei template già presi */
  names: string[]
  onAdd(name: string): void
  /** Variante modificata, già risolta: va riallineata al base prima di salvarla */
  onChange(t: Template, key: string): void
  onOpen(name: string): void
  onDelete(name: string): void
  /** La variante diventa un template normale, con l'aspetto di adesso */
  onDetach(name: string): void
  /** Nuovo ordine delle varianti, per nome */
  onReorder(names: string[]): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [extra, setExtra] = useState<string[]>([])
  const [picking, setPicking] = useState<{ variant: string; column: Column } | null>(null)
  // la variante selezionata: Canc la elimina
  const [selected, setSelected] = useState<string | null>(null)
  const menu = useContextMenu()
  const order = variants.map((v) => v.name)
  const move = (from: number, to: number): void => {
    if (to < 0 || to >= order.length || to === from) return
    onReorder(moveItem(order, from, to))
  }
  const drag = useDragReorder(move)
  const rowMenu = (v: Template, i: number): Parameters<typeof menu.open>[1] => [
    { label: t('variants.open'), title: t('variants.openHint'), onClick: () => onOpen(v.name) },
    'sep',
    { label: t('variants.up'), disabled: i === 0, onClick: () => move(i, i - 1) },
    {
      label: t('variants.down'),
      disabled: i === variants.length - 1,
      onClick: () => move(i, i + 1)
    },
    'sep',
    {
      label: t('inherit.detach'),
      title: t('variants.detachHint'),
      onClick: () => onDetach(v.name)
    },
    { label: t('variants.delete'), danger: true, onClick: () => onDelete(v.name) }
  ]

  // i livelli del base che si possono cambiare da qui, nei due lati
  const all = useMemo<Column[]>(
    () =>
      (['front', 'back'] as const).flatMap((side) =>
        walkLayers(base[side]).map((l) => ({
          id: l.id,
          side,
          name: l.name,
          type: l.type,
          key: PRIMARY_PROPERTY[l.type]
        }))
      ),
    [base]
  )
  // colonne: i livelli che almeno una variante cambia, più quelli aggiunti qui
  const columns = all.filter(
    (c) =>
      extra.includes(c.id) ||
      variants.some(
        (v) =>
          JSON.stringify(valueOf(layerIn(v, c), c.key)) !==
          JSON.stringify(valueOf(layerIn(base, c), c.key))
      )
  )
  const addable = all.filter((c) => !columns.includes(c))

  const error = !name.trim()
    ? null
    : !isValidTemplateName(name.trim())
      ? t('newTemplate.invalidName')
      : names.includes(name.trim())
        ? t('newTemplate.exists')
        : null

  const set = (v: Template, c: Column, value: unknown): void => {
    onChange(
      patchLayer(v, c.side, c.id, { [c.key]: value } as Partial<Layer>),
      `variant:${v.name}:${c.id}`
    )
  }

  const cell = (v: Template, c: Column): React.JSX.Element => {
    const l = layerIn(v, c)
    if (!l)
      return (
        <td key={c.id} className="muted">
          —
        </td>
      )
    const value = valueOf(l, c.key)
    const fromBase = JSON.stringify(value) === JSON.stringify(valueOf(layerIn(base, c), c.key))
    const revert = !fromBase && (
      <button
        type="button"
        className="icon-btn"
        title={t('variants.revert')}
        onClick={() => set(v, c, valueOf(layerIn(base, c), c.key))}
      >
        ↺
      </button>
    )
    let control: React.ReactNode
    if (c.key === 'visible')
      control = (
        <input
          type="checkbox"
          checked={value !== false}
          aria-label={t('variants.visible')}
          onChange={(e) => set(v, c, e.target.checked)}
        />
      )
    else if (c.type === 'image')
      control = (
        <button
          type="button"
          className="option-pick"
          title={String(value ?? '')}
          onClick={() => setPicking({ variant: v.name, column: c })}
        >
          <OptionThumb name={String(value ?? '')} />
        </button>
      )
    else
      control = (
        <>
          {(c.type === 'shape' || c.type === 'grid') && (
            <ColorSwatch value={String(value ?? '')} onChange={(x) => set(v, c, x)} />
          )}
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => set(v, c, e.target.value)}
          />
        </>
      )
    return (
      <td key={c.id} className={fromBase ? 'from-base' : 'changed'}>
        <span className="variant-cell">
          {control}
          {revert}
        </span>
      </td>
    )
  }

  const thumb = (tpl: Template): React.JSX.Element => (
    <span className="variant-thumb">
      <CardSvg template={tpl} scale={THUMB / Math.max(tpl.height, 1)} guides={false} />
    </span>
  )

  return (
    <Dialog title={t('variants.title', { name: base.name })} onClose={onClose} guide="variants">
      <div className="variants-dialog">
        <p className="small muted">{t('variants.intro')}</p>
        <div
          className="variants-scroll"
          tabIndex={-1}
          onKeyDown={(e) => {
            const field = (e.target as HTMLElement).closest('input, select, textarea')
            if (field || !selected || !variants.some((v) => v.name === selected)) return
            if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault()
              onDelete(selected)
            }
          }}
        >
          <table className="variants-table">
            <thead>
              <tr>
                <th>{t('variants.variant')}</th>
                {columns.map((c) => (
                  <th key={c.id}>
                    {c.name}
                    {c.key === 'visible' && (
                      <span className="muted"> ({t('variants.visible')})</span>
                    )}
                  </th>
                ))}
                <th>
                  {addable.length > 0 && (
                    <select
                      value=""
                      title={t('variants.addColumnHint')}
                      onChange={(e) => e.target.value && setExtra([...extra, e.target.value])}
                    >
                      <option value="">{t('variants.addColumn')}</option>
                      {addable.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="variant-base">
                <th>
                  <span className="variant-head">
                    {thumb(base)}
                    <span className="variant-name">{base.name}</span>
                    <span className="list-base">{t('list.base')}</span>
                  </span>
                </th>
                {columns.map((c) => {
                  const value = valueOf(layerIn(base, c), c.key)
                  return (
                    <td key={c.id} className="from-base">
                      {c.key === 'visible' ? (
                        value === false ? (
                          '✕'
                        ) : (
                          '✓'
                        )
                      ) : c.type === 'image' ? (
                        <OptionThumb name={String(value ?? '')} />
                      ) : (
                        String(value ?? '')
                      )}
                    </td>
                  )
                })}
                <td>
                  <button type="button" className="small-btn" onClick={() => onOpen(base.name)}>
                    {t('variants.open')}
                  </button>
                </td>
              </tr>
              {variants.map((v, i) => (
                <tr
                  key={v.name}
                  {...drag.itemProps(i)}
                  className={[
                    selected === v.name ? 'selected' : '',
                    drag.itemProps(i).className ?? ''
                  ]
                    .join(' ')
                    .trim()}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input, select, button')) return
                    setSelected(v.name)
                    ;(e.currentTarget.closest('.variants-scroll') as HTMLElement | null)?.focus()
                  }}
                  onContextMenu={(e) => {
                    setSelected(v.name)
                    menu.open(e, rowMenu(v, i))
                  }}
                >
                  <th>
                    <span className="variant-head">
                      <span className="drag-handle" title={t('variants.drag')} aria-hidden="true">
                        ⠿
                      </span>
                      {thumb(v)}
                      <span className="variant-name">{v.name}</span>
                    </span>
                  </th>
                  {columns.map((c) => cell(v, c))}
                  <td className="variant-tools">
                    <button
                      type="button"
                      className="icon-btn"
                      title={t('variants.up')}
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title={t('variants.down')}
                      disabled={i === variants.length - 1}
                      onClick={() => move(i, i + 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="small-btn"
                      title={t('variants.openHint')}
                      onClick={() => onOpen(v.name)}
                    >
                      {t('variants.open')}
                    </button>
                    <button
                      type="button"
                      className="small-btn"
                      title={t('variants.detachHint')}
                      onClick={() => onDetach(v.name)}
                    >
                      {t('inherit.detach')}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title={t('variants.delete')}
                      onClick={() => onDelete(v.name)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!variants.length && <p className="small muted">{t('variants.empty')}</p>}
        <form
          className="variants-add"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim() || error) return
            onAdd(name.trim())
            setName('')
          }}
        >
          <input
            value={name}
            placeholder={t('variants.newName')}
            aria-label={t('variants.newName')}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="primary" disabled={!name.trim() || !!error}>
            {t('variants.add')}
          </button>
          {error && <span className="field-error">{error}</span>}
        </form>
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.close')}
          </button>
        </div>
      </div>
      {menu.node}
      {picking && (
        <AssetPicker
          value={String(
            valueOf(
              layerIn(
                variants.find((v) => v.name === picking.variant)!,
                picking.column
              ),
              'src'
            ) ?? ''
          )}
          onPick={(src) => {
            const v = variants.find((x) => x.name === picking.variant)
            if (v) set(v, picking.column, src)
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </Dialog>
  )
}
