import { useContext, useRef } from 'react'
import { BUILTIN_STYLES } from '../../../shared/model/markup'
import { applyStyle, toggleWrap, type WrapMark } from '../../../shared/model/docEdit'
import { useI18n } from '../i18n/context'
import { StylesContext } from '../render/assets'
import { OPEN_FORMAT_EVENT, runEdit } from './editRun'
import MarkupTextarea, { type FormatControl } from './MarkupTextarea'
import Menu from './Menu'

// Pulsanti di formattazione del testo: grassetto, corsivo, sottolineato, barrato e il menu Stile.
// Li usano la barra dei documenti e i testi brevi delle finestre (anatomia, schema del tavolo).

type Editor = React.RefObject<HTMLTextAreaElement | null>

/** Pulsante della barra: il clic non toglie la selezione al campo */
export function ToolButton({
  title,
  onClick,
  children
}: {
  title: string
  onClick(): void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="doc-tool"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** Grassetto, corsivo, sottolineato e barrato sul testo selezionato */
export function WrapTools({ editor }: { editor: Editor }): React.JSX.Element {
  const { t } = useI18n()
  const wrap = (mark: WrapMark) => () =>
    runEdit(editor.current, (s, a, b) => toggleWrap(s, a, b, mark))
  return (
    <>
      <ToolButton title={t('docTools.bold')} onClick={wrap('**')}>
        <b>B</b>
      </ToolButton>
      <ToolButton title={t('docTools.italic')} onClick={wrap('*')}>
        <i>I</i>
      </ToolButton>
      <ToolButton title={t('docTools.underline')} onClick={wrap('++')}>
        <u>U</u>
      </ToolButton>
      <ToolButton title={t('docTools.strike')} onClick={wrap('~~')}>
        <s>S</s>
      </ToolButton>
    </>
  )
}

/** Menu Stile: gli stili del progetto e, in fondo, la formattazione avanzata se c'è */
export function StyleMenu({
  editor,
  format
}: {
  editor: Editor
  format?: FormatControl
}): React.JSX.Element {
  const { t } = useI18n()
  const styles = useContext(StylesContext)
  const names = [...new Set([...Object.keys(styles), ...Object.keys(BUILTIN_STYLES)])].sort()
  return (
    <Menu
      className="doc-tool"
      label={t('docTools.style')}
      title={t('docTools.styleHint')}
      items={[
        ...names.map((name) => ({
          label: name,
          onClick: () =>
            runEdit(editor.current, (s, a, b) => applyStyle(s, a, b, name, t('docTools.sample')))
        })),
        'sep' as const,
        // senza il controllo del campo (barra comune a più campi) lo si chiede al campo stesso
        format
          ? {
              label: t('format.button'),
              title: t('format.buttonHint'),
              disabled: !format.enabled,
              onClick: format.open
            }
          : {
              label: t('format.button'),
              title: t('format.buttonHint'),
              onClick: () => editor.current?.dispatchEvent(new Event(OPEN_FORMAT_EVENT))
            }
      ]}
    />
  )
}

/** Barra di formattazione per un campo di testo breve */
export function TextFormatBar({
  editor,
  format
}: {
  editor: Editor
  format?: FormatControl
}): React.JSX.Element {
  return (
    <div className="document-toolbar text-format-bar" role="toolbar">
      <WrapTools editor={editor} />
      <span className="sep" />
      <StyleMenu editor={editor} format={format} />
    </div>
  )
}

/**
 * Testo breve con il markup. Con `bar` ha sopra la sua barra di formattazione; senza, `onFocus`
 * passa il campo a chi tiene una barra comune a più campi. Con `singleLine` il testo sta su una riga: Maiusc+Invio o Alt+Invio scrivono <br>, che va a capo.
 */
export default function FormattedField({
  value,
  onChange,
  bar = false,
  singleLine = false,
  rows,
  placeholder,
  onFocus,
  onPaste
}: {
  value: string
  onChange(v: string): void
  bar?: boolean
  singleLine?: boolean
  rows?: number
  placeholder?: string
  onFocus?(el: HTMLTextAreaElement): void
  onPaste?(e: React.ClipboardEvent<HTMLTextAreaElement>): void
}): React.JSX.Element {
  const editor = useRef<HTMLTextAreaElement | null>(null)
  return (
    <MarkupTextarea
      ref={editor}
      className="formatted-field"
      fields={[]}
      value={value}
      rows={rows ?? (singleLine ? 1 : 3)}
      placeholder={placeholder}
      showProblems={bar}
      // la scheda si apre anche senza selezione, su tutto il testo: vedi OPEN_FORMAT_EVENT
      toolbar={bar ? () => <TextFormatBar editor={editor} /> : undefined}
      onFocus={(e) => onFocus?.(e.currentTarget)}
      onPaste={onPaste}
      onKeyDown={(e) => {
        if (!singleLine || e.key !== 'Enter') return
        e.preventDefault()
        // Maiusc+Invio o Alt+Invio scrivono un a capo, <br>, come Alt+Invio nella tabella dei set
        if (e.shiftKey || e.altKey) document.execCommand('insertText', false, '<br>')
      }}
      onChange={(e) =>
        onChange(singleLine ? e.target.value.replace(/\n/g, '<br>') : e.target.value)
      }
    />
  )
}
