import { useEffect, useRef, useState } from 'react'
import { isValidNoteName } from '../../../shared/project'
import { noteParts, type TableBlock } from '../../../shared/model/noteParts'
import MarkupText from '../render/MarkupText'
import { useI18n } from '../i18n/context'
import { DetachIcon, DockIcon, TrashIcon } from './icons'
import Resizer from './Resizer'
import Segmented from './Segmented'
import { usePanelWidth } from './usePanelWidth'

// Una nota del progetto (notes/<nome>.md), accanto a qualsiasi schermata: si scrive in Markdown e
// si salva da sola mentre si scrive. Il pannello si allarga trascinandone il bordo, oppure si
// stacca e diventa una finestra mobile sopra l'app, da spostare e ridimensionare.

interface Floating {
  x: number
  y: number
  w: number
  h: number
}

const FLOAT_KEY = 'notePanel.floating'

function loadFloating(): Floating | null {
  try {
    const f = JSON.parse(localStorage.getItem(FLOAT_KEY) ?? 'null') as Floating | null
    return f && [f.x, f.y, f.w, f.h].every((n) => typeof n === 'number') ? f : null
  } catch {
    return null
  }
}

function saveFloating(f: Floating | null): void {
  try {
    if (f) localStorage.setItem(FLOAT_KEY, JSON.stringify(f))
    else localStorage.removeItem(FLOAT_KEY)
  } catch {
    // preferenza non essenziale
  }
}

/** La finestra mobile resta dentro quella dell'app, almeno con la sua barra */
function clampFloating(f: Floating): Floating {
  const w = Math.min(Math.max(f.w, 260), window.innerWidth)
  const h = Math.min(Math.max(f.h, 220), window.innerHeight)
  return {
    w,
    h,
    x: Math.min(Math.max(f.x, 0), Math.max(0, window.innerWidth - w)),
    y: Math.min(Math.max(f.y, 0), Math.max(0, window.innerHeight - 40))
  }
}

interface Props {
  name: string
  text: string
  /** Nomi delle altre note, per non rinominarla come una di loro */
  others: string[]
  onChange(text: string): void
  onRename(name: string): void
  onDelete(): void
  onClose(): void
}

export default function NotePanel({
  name,
  text,
  others,
  onChange,
  onRename,
  onDelete,
  onClose
}: Props): React.JSX.Element {
  const { t } = useI18n()
  // una nota già scritta si apre in anteprima, una nuova (vuota) per scriverla
  const [mode, setMode] = useState<'edit' | 'preview'>(text.trim() ? 'preview' : 'edit')
  // il pannello si ricrea con un'altra nota o un nome nuovo (key), quindi basta lo stato iniziale
  const [draftName, setDraftName] = useState(name)
  const [width, setWidth] = usePanelWidth('note', 380)
  const [floating, setFloatingState] = useState<Floating | null>(() => {
    const f = loadFloating()
    return f && clampFloating(f)
  })
  const setFloating = (f: Floating | null): void => {
    setFloatingState(f)
    saveFloating(f)
  }
  const panel = useRef<HTMLElement>(null)
  const drag = useRef<{ x: number; y: number; from: Floating } | null>(null)

  // la finestra mobile si ridimensiona dall'angolo (resize del CSS): si ricorda la misura
  useEffect(() => {
    const el = panel.current
    if (!floating || !el) return
    const obs = new ResizeObserver(() => {
      const w = Math.round(el.offsetWidth)
      const h = Math.round(el.offsetHeight)
      setFloatingState((f) => {
        if (!f || (f.w === w && f.h === h)) return f
        const next = { ...f, w, h }
        saveFloating(next)
        return next
      })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [floating !== null]) // eslint-disable-line react-hooks/exhaustive-deps

  const detach = (): void => {
    const r = panel.current?.getBoundingClientRect()
    setFloating(
      clampFloating({
        x: (r?.left ?? 200) - 40,
        y: (r?.top ?? 80) + 20,
        w: r?.width ?? width,
        h: Math.min(r?.height ?? 500, 560)
      })
    )
  }

  const nameError = !isValidNoteName(draftName)
    ? t('note.invalidName', { name: draftName })
    : draftName !== name && others.includes(draftName)
      ? t('note.exists', { name: draftName })
      : null
  const commitName = (): void => {
    if (draftName === name) return
    if (nameError) setDraftName(name)
    else onRename(draftName)
  }

  // la finestra mobile si sposta trascinando la maniglia in alto o i punti vuoti della barra
  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>): void => {
      if (!floating || (e.target as HTMLElement).closest('input, button')) return
      drag.current = { x: e.clientX, y: e.clientY, from: floating }
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>): void => {
      const d = drag.current
      if (!d) return
      setFloatingState(
        clampFloating({ ...d.from, x: d.from.x + e.clientX - d.x, y: d.from.y + e.clientY - d.y })
      )
    },
    onPointerUp: (): void => {
      if (!drag.current) return
      drag.current = null
      setFloatingState((f) => {
        saveFloating(f)
        return f
      })
    }
  }

  const aside = (
    <aside
      ref={panel}
      className={floating ? 'note-panel floating' : 'note-panel'}
      aria-label={t('notes.panel')}
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
      <div className="note-panel-head" {...dragHandlers}>
        <input
          className={nameError ? 'note-name invalid' : 'note-name'}
          value={draftName}
          title={nameError ?? t('notes.nameHint')}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setDraftName(name)
          }}
        />
        <button
          className="icon-btn"
          title={floating ? t('notes.dock') : t('notes.detach')}
          aria-label={floating ? t('notes.dock') : t('notes.detach')}
          onClick={() => (floating ? setFloating(null) : detach())}
        >
          {floating ? <DockIcon /> : <DetachIcon />}
        </button>
        <button className="icon-btn danger" title={t('notes.delete')} onClick={onDelete}>
          <TrashIcon />
        </button>
        <button className="icon-btn note-close" title={t('notes.close')} onClick={onClose}>
          ×
        </button>
      </div>
      <Segmented<'edit' | 'preview'>
        value={mode}
        onChange={setMode}
        options={[
          ['edit', t('notes.edit')],
          ['preview', t('notes.preview')]
        ]}
      />
      {mode === 'edit' ? (
        <textarea
          className="note-text"
          value={text}
          placeholder={t('notes.placeholder')}
          spellCheck
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="note-preview">
          {text.trim() ? (
            noteParts(text).map((p, k) =>
              p.kind === 'text' ? (
                <MarkupText key={k} text={p.text} unit={3.8} ratio={1} paragraphSpacing={1.5} />
              ) : (
                <NoteTable key={k} table={p.table} />
              )
            )
          ) : (
            <p className="muted">{t('notes.empty')}</p>
          )}
        </div>
      )}
      <p className="muted small">{t('notes.hint', { file: `notes/${name}.md` })}</p>
    </aside>
  )

  if (floating) return aside
  return (
    <>
      <Resizer width={width} onChange={setWidth} edge="right" min={260} max={900} />
      {aside}
    </>
  )
}

/** Tabella Markdown della nota, con il testo delle celle nel markup delle carte */
function NoteTable({ table }: { table: TableBlock }): React.JSX.Element {
  const cell = (text: string): React.JSX.Element => (
    <MarkupText text={text} unit={3.8} ratio={1} paragraphSpacing={0} />
  )
  return (
    <div className="note-table">
      <table>
        <thead>
          <tr>
            {table.header.map((h, k) => (
              <th key={k} style={{ textAlign: table.align[k] ?? undefined }}>
                {cell(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, k) => (
                <td key={k} style={{ textAlign: table.align[k] ?? undefined }}>
                  {cell(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
