import { setHeading, toggleLines, toggleWrap } from '../../../shared/model/docEdit'
import { useI18n } from '../i18n/context'
import { runEdit as run } from './editRun'
import type { FormatControl } from './MarkupTextarea'
import { StyleMenu, ToolButton, WrapTools } from './TextFormatBar'
import { ImageIcon } from './icons'

// Barra sopra il testo di un documento: grassetto, corsivo, titoli, elenchi, stili e gli
// inserimenti (immagine, tabella, riquadro, carta, anatomia, tavolo). Scrive nel campo come si scriverebbe
// a mano, così ⌘Z annulla anche questi cambiamenti.

interface Props {
  editor: React.RefObject<HTMLTextAreaElement | null>
  format: FormatControl
  /** Livello del titolo dove sta il cursore, 0 per un paragrafo */
  level: number
  onImage(): void
  onTable(): void
  onBox(): void
  onCard(): void
  onAnatomy(): void
  onSetup(): void
}

export default function DocumentToolbar({
  editor,
  format,
  level,
  onImage,
  onTable,
  onBox,
  onCard,
  onAnatomy,
  onSetup
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const button = (
    label: React.ReactNode,
    title: string,
    onClick: () => void
  ): React.JSX.Element => (
    <ToolButton title={title} onClick={onClick}>
      {label}
    </ToolButton>
  )

  return (
    <div className="document-toolbar" role="toolbar">
      <select
        className="doc-heading"
        value={level > 3 ? 3 : level}
        title={t('docTools.headingHint')}
        onChange={(e) =>
          run(editor.current, (s, a, b) => setHeading(s, a, b, Number(e.target.value)))
        }
      >
        <option value={0}>{t('docTools.paragraph')}</option>
        <option value={1}>{t('docTools.heading', { n: 1 })}</option>
        <option value={2}>{t('docTools.heading', { n: 2 })}</option>
        <option value={3}>{t('docTools.heading', { n: 3 })}</option>
      </select>
      <span className="sep" />
      <WrapTools editor={editor} />
      <span className="sep" />
      {button('•≡', t('docTools.bullets'), () =>
        run(editor.current, (s, a, b) => toggleLines(s, a, b, 'bullet'))
      )}
      {button('1≡', t('docTools.numbers'), () =>
        run(editor.current, (s, a, b) => toggleLines(s, a, b, 'number'))
      )}
      {button('❝', t('docTools.quote'), () =>
        run(editor.current, (s, a, b) => toggleLines(s, a, b, 'quote'))
      )}
      {button('%%', t('docTools.comment'), () =>
        run(editor.current, (s, a, b) => toggleWrap(s, a, b, '%%'))
      )}
      <span className="sep" />
      <StyleMenu editor={editor} format={format} />
      <span className="sep" />
      {button(
        <>
          <ImageIcon /> {t('docTools.image')}
        </>,
        t('docTools.imageHint'),
        onImage
      )}
      {button(t('documents.table'), t('documents.tableButtonHint'), onTable)}
      {button(t('documents.box'), t('documents.boxButtonHint'), onBox)}
      {button(t('documents.insertCard'), t('documents.insertCardHint'), onCard)}
      {button(t('documents.anatomy'), t('documents.anatomyButtonHint'), onAnatomy)}
      {button(t('documents.setup'), t('documents.setupButtonHint'), onSetup)}
    </div>
  )
}
