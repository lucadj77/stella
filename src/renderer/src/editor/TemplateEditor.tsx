import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useBindContext } from '../render/assets'
import { bindCard, rowToCard } from '../../../shared/model/bind'
import { systemOfSet } from '../../../shared/model/system'
import { findLayer, findParent, resizeTemplate } from '../../../shared/model/edit'
import type { LoadedSet } from '../../../shared/project'
import type { ShapeKind, Side, Template } from '../../../shared/model/template'
import { rebase, resolveTemplate } from '../../../shared/model/inherit'
import { walkLayers } from '../../../shared/model/normalize'
import { useI18n } from '../i18n/context'
import Segmented from '../components/Segmented'
import Resizer from '../components/Resizer'
import { usePanelSide, usePanelWidth } from '../components/usePanelWidth'
import { GridIcon, ImageIcon } from '../components/icons'
import Menu, { type MenuItem } from '../components/Menu'
import AssetPicker from '../components/AssetPicker'
import { dragHasFiles, importDropped } from '../components/dropImages'
import Canvas from './Canvas'
import LayersPanel from './LayersPanel'
import PropertiesPanel from './PropertiesPanel'
import { commands } from './commands'
import { ResizeDialog } from './dialogs'
import { useEditor } from './useEditor'
import { DisplayContext } from './displayContext'

interface Props {
  template: Template
  /** Set che usano questo template: servono per l'anteprima con i dati */
  sets: LoadedSet[]
  /** Nome del progetto, per {project.name} */
  projectName?: string
  onChange(template: Template): void
  /** Template base già risolto, se questo è derivato; null se il base manca */
  base?: Template | null
  /** Apre un altro template nell'editor */
  onOpen?(name: string): void
  /** Rende il derivato un template normale */
  onDetach?(): void
  /** Rinomina, duplica, deriva, elimina: il menu ⋯ accanto al nome */
  menu?: MenuItem[]
  /** Dice se ci sono passi da annullare o ripetere: i pulsanti stanno nella barra dell'app */
  onHistory?(h: { undo: boolean; redo: boolean }): void
  /** Set (indice in `sets`) e riga da mostrare all'apertura, invece di nessun dato */
  initialPreview?: { set: number; row: number } | null
}

/** Evento della barra dell'app per annullare o ripetere nell'editor */
export const EDITOR_UNDO = 'stella-editor-undo'

const NUDGE = 0.5

export default function TemplateEditor({
  template,
  sets,
  projectName = '',
  onChange,
  base = null,
  onOpen,
  onDetach,
  menu,
  onHistory,
  initialPreview = null
}: Props): React.JSX.Element {
  const { t } = useI18n()
  // in un derivato ogni modifica passa per le sue regole: si salvano solo le differenze
  const normalize = useMemo(() => (base ? (x: Template) => rebase(base, x) : undefined), [base])
  const [state, dispatch] = useEditor(template, normalize)
  const [resizing, setResizing] = useState<[number, number] | null>(null)
  // un livello immagine nuovo nasce dalla scelta dell'immagine
  const [pickingImage, setPickingImage] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [preview, setPreview] = useState<{ set: number; row: number } | null>(initialPreview)
  const inheritedIds = useMemo(
    () => (base ? new Set(walkLayers([...base.front, ...base.back]).map((l) => l.id)) : null),
    [base]
  )
  const layerNames = useMemo(
    () => ({
      text: t('layerName.text'),
      image: t('layerName.image'),
      value: t('layerName.value'),
      grid: t('layerName.grid'),
      shape: t('layerName.shape'),
      sample: t('layerName.sample'),
      shapes: {
        rect: t('layerName.rect'),
        ellipse: t('layerName.ellipse'),
        polygon: t('layerName.polygon'),
        star: t('layerName.star'),
        line: t('layerName.line'),
        path: t('layerName.path')
      }
    }),
    [t]
  )
  const cmd = commands(state, dispatch, (id) => !!inheritedIds?.has(id), layerNames)
  const inheritProblems = useMemo(
    () => (base ? resolveTemplate(base, state.template).problems : []),
    [base, state.template]
  )
  const [layersWidth, setLayersWidth] = usePanelWidth('layers.v2', 270)
  const [propsWidth, setPropsWidth] = usePanelWidth('properties.v2', 380)
  const [layersSide, toggleLayersSide] = usePanelSide('layers', 'left')
  const [propsSide, togglePropsSide] = usePanelSide('properties', 'right')

  // le modifiche risalgono subito all'app: le anteprime dei set le mostrano prima del salvataggio.
  // Si confronta con l'ultimo template mandato, non con quello iniziale: annullando fino al
  // punto di partenza l'app deve ricevere anche quello, altrimenti salverebbe la versione modificata
  const sent = useRef(template)
  useEffect(() => {
    if (state.template === sent.current) return
    sent.current = state.template
    onChange(state.template)
  }, [state.template, onChange])

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0
  useEffect(() => {
    onHistory?.({ undo: canUndo, redo: canRedo })
  }, [canUndo, canRedo, onHistory])
  useEffect(() => {
    const run = (e: Event): void =>
      dispatch({ type: (e as CustomEvent<{ redo: boolean }>).detail.redo ? 'redo' : 'undo' })
    window.addEventListener(EDITOR_UNDO, run)
    return () => window.removeEventListener(EDITOR_UNDO, run)
  }, [dispatch])

  // la tastiera: le scorciatoie usano Cmd su macOS e Ctrl altrove
  const onKey = (e: KeyboardEvent): void => {
    const mod = e.metaKey || e.ctrlKey
    const k = e.key.toLowerCase()
    // ⌘S lo gestisce l'app: salva tutto
    if (mod && k === 's') return
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select, [role="dialog"]')) return
    const layers = state.template[state.side]
    if (mod && k === 'z') dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
    else if (mod && k === 'y') dispatch({ type: 'redo' })
    else if (mod && k === 'd') cmd.duplicate()
    else if (mod && k === 'g') {
      if (e.shiftKey) cmd.ungroup()
      else cmd.group()
    } else if (mod && k === 'a') {
      const scope = state.scope ? findLayer(layers, state.scope) : null
      const list = scope?.type === 'group' ? scope.children : layers
      dispatch({ type: 'select', ids: list.map((l) => l.id) })
    } else if (k === 'delete' || k === 'backspace') cmd.remove()
    else if (k === 'escape') {
      if (state.scope) {
        const parent = findParent(layers, state.scope)?.id ?? null
        dispatch({ type: 'select', ids: [state.scope], scope: parent })
      } else dispatch({ type: 'select', ids: [] })
    } else if (k.startsWith('arrow')) {
      const d = e.shiftKey ? NUDGE * 10 : NUDGE
      const [dx, dy] = {
        arrowleft: [-d, 0],
        arrowright: [d, 0],
        arrowup: [0, -d],
        arrowdown: [0, d]
      }[k] ?? [0, 0]
      cmd.nudge(dx, dy)
    } else if (!mod && k === 't') cmd.add('text')
    else if (!mod && k === 'r') cmd.add('shape', 'rect')
    else if (!mod && k === 'e') cmd.add('shape', 'ellipse')
    else return
    e.preventDefault()
  }
  // copia, taglia e incolla passano dagli appunti del sistema: i livelli si incollano anche in un
  // altro template o in un'altra finestra. Gli eventi arrivano sia dalla tastiera sia dal menu Modifica
  const onClipboard = (e: ClipboardEvent): void => {
    const target = e.target as HTMLElement
    if (target.closest?.('input, textarea, select, [role="dialog"]')) return
    if (e.type === 'paste') {
      if (cmd.paste(e.clipboardData?.getData('text/plain') ?? '')) e.preventDefault()
      return
    }
    // con del testo selezionato nella pagina vale la copia normale
    if (window.getSelection()?.toString()) return
    const text = cmd.copy()
    if (!text) return
    e.clipboardData?.setData('text/plain', text)
    e.preventDefault()
    if (e.type === 'cut') cmd.remove()
  }
  // si riregistrano a ogni render per leggere lo stato corrente
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    document.addEventListener('copy', onClipboard)
    document.addEventListener('cut', onClipboard)
    document.addEventListener('paste', onClipboard)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('copy', onClipboard)
      document.removeEventListener('cut', onClipboard)
      document.removeEventListener('paste', onClipboard)
    }
  })

  const previewSet = preview ? sets[preview.set] : null
  const bindCtx = useBindContext()
  const display = useMemo(() => {
    const data = previewSet?.data
    const row = data?.rows[preview?.row ?? -1]
    // senza riga si applicano i soli valori del template: le formule mostrano il risultato
    const card = data && row ? rowToCard(data.headers, row) : { fields: {}, amount: 1 }
    const system = previewSet
      ? {
          ...systemOfSet(projectName, previewSet),
          ...(row ? { number: (preview?.row ?? 0) + 1 } : {})
        }
      : { project: projectName }
    return bindCard(state.template, card, { ...bindCtx, system })
  }, [state.template, previewSet, preview?.row, projectName, bindCtx])

  const displayInfo = useMemo(
    () => ({
      template: display.template,
      sheets: sets.flatMap((s) => (s.data ? [s.data] : []))
    }),
    [display, sets]
  )

  // ogni strumento ha l'icona e il nome; le forme stanno in un menu
  const tool = (
    icon: React.ReactNode,
    label: string,
    title: string,
    run: () => void
  ): React.JSX.Element => (
    <button key={label} className="tool labelled" title={title} onClick={run}>
      <span className="tool-icon">{icon}</span>
      <span className="tool-label">{label}</span>
    </button>
  )
  const shapeItems: MenuItem[] = (
    ['rect', 'ellipse', 'polygon', 'star', 'line'] as ShapeKind[]
  ).map((s) => ({
    label: t(`tool.${s}` as Parameters<typeof t>[0]),
    onClick: () => cmd.add('shape', s)
  }))
  const toolButtons = (
    <>
      {tool('T', t('tool.short.text'), t('tool.text'), () => cmd.add('text'))}
      {tool(<ImageIcon />, t('tool.short.image'), t('tool.image'), () => setPickingImage(true))}
      <Menu
        className="tool labelled"
        title={t('tool.shapes')}
        label={
          <>
            <span className="tool-icon">{SHAPE_ICONS.rect}</span>
            <span className="tool-label">{t('tool.short.shapes')} ▾</span>
          </>
        }
        items={shapeItems}
      />
      {tool(<GridIcon />, t('tool.short.grid'), t('tool.grid'), () => cmd.add('grid'))}
      {tool('#', t('tool.short.value'), t('tool.value'), () => cmd.add('value'))}
    </>
  )

  // i pannelli stanno a sinistra o a destra della tela, anche entrambi sullo stesso lato
  const layersPanel = (
    <LayersPanel
      state={state}
      dispatch={dispatch}
      cmd={cmd}
      width={layersWidth}
      side={layersSide}
      onToggleSide={toggleLayersSide}
      base={base}
    />
  )
  const propsPanel = (
    <DisplayContext.Provider value={displayInfo}>
      <PropertiesPanel
        width={propsWidth}
        state={state}
        dispatch={dispatch}
        cmd={cmd}
        sheets={sets.flatMap((s) =>
          s.data ? [{ set: s.name, headers: s.data.headers, rows: s.data.rows }] : []
        )}
        onResize={(w, h) => setResizing([w, h])}
        side={propsSide}
        onToggleSide={togglePropsSide}
        base={base}
      />
    </DisplayContext.Provider>
  )
  const panels = [
    {
      key: 'layers',
      side: layersSide,
      el: layersPanel,
      width: layersWidth,
      setWidth: setLayersWidth,
      min: 160
    },
    {
      key: 'properties',
      side: propsSide,
      el: propsPanel,
      width: propsWidth,
      setWidth: setPropsWidth,
      min: 260
    }
  ]
  const withResizer = (p: (typeof panels)[number]): React.JSX.Element[] => {
    const resizer = (
      <Resizer
        key={`${p.key}-resizer`}
        width={p.width}
        onChange={p.setWidth}
        edge={p.side}
        min={p.min}
      />
    )
    const panel = <Fragment key={p.key}>{p.el}</Fragment>
    return p.side === 'left' ? [panel, resizer] : [resizer, panel]
  }
  const left = panels.filter((p) => p.side === 'left').flatMap(withResizer)
  const right = panels.filter((p) => p.side === 'right').flatMap(withResizer)

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <h1>{state.template.name}</h1>
        {menu && <Menu className="more-button" label="⋯" title={t('app.more')} items={menu} />}
        {state.template.extends && (
          <span className="derived-from">
            {t('inherit.derivedFrom')}{' '}
            <button
              className="link"
              title={t('inherit.openBase')}
              onClick={() => onOpen?.(state.template.extends!)}
            >
              {state.template.extends}
            </button>
            <button className="small-btn" title={t('inherit.detachHint')} onClick={onDetach}>
              {t('inherit.detach')}
            </button>
          </span>
        )}
        <div className="tool-group">{toolButtons}</div>
        <Segmented<Side>
          value={state.side}
          options={[
            ['front', t('preview.front'), t('tip.front')],
            ['back', t('preview.back'), t('tip.back')]
          ]}
          onChange={(side) => dispatch({ type: 'side', side })}
        />
        <span className="spacer" />
        <label className="muted preview-data">
          {t('editor.previewData')}{' '}
          <select
            value={preview ? String(preview.set) : ''}
            onChange={(e) =>
              setPreview(e.target.value === '' ? null : { set: Number(e.target.value), row: 0 })
            }
          >
            <option value="">{t('editor.previewNone')}</option>
            {sets.map((s, i) => (
              <option key={s.name} value={i} disabled={!s.data?.rows.length}>
                {s.name}
              </option>
            ))}
          </select>
          {preview && previewSet?.data && (
            <select
              value={preview.row}
              onChange={(e) => setPreview({ ...preview, row: Number(e.target.value) })}
            >
              {previewSet.data.rows.map((r, i) => (
                <option key={i} value={i}>
                  {rowLabel(previewSet.data!.headers, r, i)}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>
      <div className="editor-body">
        {left}
        <div
          className={'editor-center' + (dropping ? ' dropping' : '')}
          onDragOver={(e) => {
            if (!dragHasFiles(e)) return
            e.preventDefault()
            setDropping(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false)
          }}
          onDrop={async (e) => {
            if (!dragHasFiles(e)) return
            e.preventDefault()
            setDropping(false)
            // ogni immagine lasciata cadere diventa un livello immagine
            cmd.addImages(await importDropped(e))
          }}
        >
          <Canvas state={state} display={display.template} dispatch={dispatch} />
          {(display.problems.length > 0 ||
            inheritProblems.length > 0 ||
            (state.template.extends && !base)) && (
            <div className="canvas-problems">
              {state.template.extends && !base && (
                <div>{t('inherit.baseMissing', { base: state.template.extends })}</div>
              )}
              {[...inheritProblems, ...display.problems].map((p, i) => (
                <div key={i}>{t(p)}</div>
              ))}
            </div>
          )}
        </div>
        {right}
      </div>
      {pickingImage && (
        <AssetPicker
          value=""
          onPick={(src) => cmd.add('image', undefined, { src })}
          onSkip={() => {
            setPickingImage(false)
            cmd.add('image')
          }}
          onClose={() => setPickingImage(false)}
        />
      )}
      {resizing && (
        <ResizeDialog
          from={[state.template.width, state.template.height]}
          to={resizing}
          onClose={() => setResizing(null)}
          onChoose={(mode) => {
            dispatch({
              type: 'change',
              template: resizeTemplate(state.template, resizing[0], resizing[1], mode)
            })
            setResizing(null)
          }}
        />
      )}
    </div>
  )
}

const SHAPE_ICONS: Record<string, string> = {
  rect: '■',
  ellipse: '●',
  polygon: '⬢',
  star: '★',
  line: '╱'
}

/** Etichetta di una riga: il primo campo non vuoto oltre a amount */
function rowLabel(headers: string[], row: string[], i: number): string {
  const idx = headers.findIndex((h, j) => h !== 'amount' && !h.includes('.') && row[j]?.trim())
  return `${i + 1}. ${idx >= 0 ? row[idx].slice(0, 30) : ''}`
}
