import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  isValidNoteName,
  type LoadedSet,
  type ProjectFile,
  type ProjectFont
} from '../../../shared/project'
import { projectLanguages } from '../../../shared/model/language'
import type { Template } from '../../../shared/model/template'
import {
  DOC_PAGES,
  DOCUMENTS_DIR,
  documentBoxes,
  documentLocalization,
  documentProblems,
  documentText,
  documentSettings,
  isCardSource,
  parseDocument,
  withDocumentSettings,
  type Anatomy
} from '../../../shared/model/document'
import { useI18n } from '../i18n/context'
import {
  AssetsContext,
  LocalizationContext,
  StylesContext,
  VariablesContext
} from '../render/assets'
import DocumentPreview, { DOC_UNIT } from '../render/DocumentPreview'
import DocumentSettingsPanel from './DocumentSettingsPanel'
import DocumentExportDialog, { type DocExportKind } from './DocumentExportDialog'
import { documentHtml, documentMarkdown } from '../export/documentExport'
import { documentDocx } from '../export/documentDocx'
import { printHtml } from '../export/printHtml'
import InsertCardDialog from './InsertCardDialog'
import TableDialog, { type TableValue } from './TableDialog'
import SetupDialog from './SetupDialog'
import type { Setup } from '../../../shared/model/setup'
import MarkupTextarea from './MarkupTextarea'
import DocumentToolbar from './DocumentToolbar'
import ImageDialog, { type DocImageValue } from './ImageDialog'
import BoxDialog from './BoxDialog'
import { boxStartLine, unwrapBox, wrapInBox, type DocBox } from '../../../shared/model/docBox'
import DocumentProperties from './DocumentProperties'
import { headingAt, toggleWrap } from '../../../shared/model/docEdit'
import Menu from './Menu'
import { runEdit } from './editRun'
import FindBar from './FindBar'
import Resizer from './Resizer'
import { usePanelWidth } from './usePanelWidth'
import { plainText } from '../../../shared/model/markup'

/** I passi dello zoom dell'anteprima, in percento */
const ZOOM_STEPS = [25, 33, 50, 67, 75, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400]

/** Il passo di zoom dopo (o prima di) quello di ora; agli estremi resta dov'è */
function zoomStep(zoom: number, dir: 1 | -1): number {
  const now = Math.round(zoom * 100)
  const next =
    dir > 0 ? ZOOM_STEPS.find((z) => z > now) : [...ZOOM_STEPS].reverse().find((z) => z < now)
  return next ?? now
}

// Un documento del progetto (docs/<nome>.md: regolamento, sell sheet, appendice): a sinistra il
// testo in Markdown con il markup di Stella, a destra l'anteprima sempre visibile, con le carte
// disegnate dal progetto. Si salva da solo mentre si scrive, come le note.

interface Props {
  name: string
  text: string
  /** Nomi degli altri documenti, per non rinominarlo come uno di loro */
  others: string[]
  project: string
  /** Lingue del progetto e nomi tradotti, per la lingua del documento */
  file: Pick<ProjectFile, 'languages' | 'names' | 'author' | 'version'>
  sets: LoadedSet[]
  templates: Template[]
  fonts: ProjectFont[]
  onChange(text: string): void
  onRename(name: string): void
  onDelete(): void
  onDuplicate(): void
}

/**
 * Altezza nel campo dove inizia il carattere `at`, a capo automatico compreso: la misura una
 * copia nascosta del campo che contiene solo il testo prima
 */
function textTop(el: HTMLTextAreaElement, at: number): number {
  const cs = getComputedStyle(el)
  const copy = document.createElement('textarea')
  for (const k of [
    'width',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'padding',
    'border',
    'boxSizing',
    'whiteSpace',
    'overflowWrap',
    'wordBreak',
    'tabSize'
  ] as const)
    copy.style[k] = cs[k]
  Object.assign(copy.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    height: '0',
    overflowY: 'scroll',
    visibility: 'hidden'
  })
  copy.value = el.value.slice(0, at)
  document.body.appendChild(copy)
  const top = copy.scrollHeight - parseFloat(cs.paddingBottom)
  copy.remove()
  // il testo copiato finisce con l'a capo prima del titolo: l'ultima riga è quella del titolo
  return at > 0 ? top - (parseFloat(cs.lineHeight) || 0) : 0
}

export default function DocumentView({
  name,
  text,
  others,
  project,
  file,
  sets,
  templates,
  fonts,
  onChange,
  onRename,
  onDelete,
  onDuplicate
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const styles = useContext(StylesContext)
  const variables = useContext(VariablesContext)
  const [draftName, setDraftName] = useState(name)
  const [inserting, setInserting] = useState(false)
  /** Anatomia aperta: nuova, o quella del testo tra from e to */
  const [anatomyEdit, setAnatomyEdit] = useState<{
    value?: Anatomy
    from?: number
    to?: number
  } | null>(null)
  /** Schema del tavolo aperto: nuovo, o quello del testo tra from e to */
  const [setupEdit, setSetupEdit] = useState<{ value?: Setup; from?: number; to?: number } | null>(
    null
  )
  /** Immagine degli asset aperta: nuova, o quella del testo tra from e to */
  const [imageEdit, setImageEdit] = useState<{
    value?: DocImageValue
    from?: number
    to?: number
  } | null>(null)
  const [pageOpen, setPageOpen] = useState(false)
  /** Barra di ricerca aperta, con o senza sostituzione; `key` la rimette al fuoco */
  const [find, setFind] = useState<{ replace: boolean; key: number } | null>(null)
  /** Livello del titolo dove sta il cursore, per la barra */
  const [level, setLevel] = useState(0)
  /** Posizione del cursore, per segnare nell'indice il capitolo dove si sta scrivendo */
  const [caretAt, setCaretAt] = useState(0)
  /** Indice dei titoli aperto a sinistra del testo; si ricorda tra un'apertura e l'altra */
  const [outlinePref, setOutlinePref] = usePanelWidth('document.outline', 0)
  const outlineOpen = outlinePref > 0
  const [exporting, setExporting] = useState(false)
  /** La tabella aperta nello strumento: nuova, o quella del testo tra from e to */
  const [boxEdit, setBoxEdit] = useState<{
    box?: DocBox
    /** Selezione quando si è aperto: le righe da mettere nel riquadro */
    from: number
    to: number
  } | null>(null)
  const [tableEdit, setTableEdit] = useState<{
    value?: TableValue
    from?: number
    to?: number
  } | null>(null)
  const editor = useRef<HTMLTextAreaElement | null>(null)
  const preview = useRef<HTMLDivElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  /** Dove rimettere il cursore dopo un inserimento, quando il testo nuovo è arrivato */
  const caret = useRef<number | null>(null)
  /** Ultima posizione del cursore nel testo; prima di scrivere si inserisce in fondo */
  const lastCaret = useRef<number | null>(null)

  const nameError = !isValidNoteName(draftName)
    ? t('document.invalidName', { name: draftName })
    : draftName !== name && others.includes(draftName)
      ? t('document.exists', { name: draftName })
      : null
  const commitName = (): void => {
    if (draftName === name) return
    if (nameError) setDraftName(name)
    else onRename(draftName)
  }

  /** Autore e versione, per {project.author} e {project.version} */
  const docInfo = useMemo(
    () => ({
      ...(file.author ? { author: file.author } : {}),
      ...(file.version ? { version: file.version } : {})
    }),
    [file.author, file.version]
  )
  const meta = useMemo(() => ({ name: project, ...docInfo }), [project, docInfo])
  // gli errori del markup li elenca già il campo; qui carte, immagini e nomi che non si trovano
  const problems = useMemo(
    () =>
      documentProblems(text, {
        project,
        ...docInfo,
        sets,
        assets,
        styles,
        variables,
        templates,
        languages: projectLanguages(file)
      }).filter((p) => p.message.key.startsWith('doc.')),
    [text, project, docInfo, sets, assets, styles, variables, templates, file]
  )
  const localization = useMemo(() => documentLocalization(file, sets, text), [file, sets, text])
  /** Il nome del progetto nella lingua del documento, per {project.name} */
  const shownProject = localization?.project ?? project

  const settings = useMemo(() => documentSettings(text).settings, [text])
  /** I titoli del documento, per l'indice: livello, testo senza markup e posizione */
  const headings = useMemo(
    () =>
      parseDocument(text).flatMap((b) =>
        b.kind === 'heading'
          ? [{ level: b.level, text: plainText(b.text).trim() || '…', from: b.from }]
          : []
      ),
    [text]
  )
  /** Il titolo del capitolo dove sta il cursore */
  const currentHeading = headings.filter((h) => h.from <= caretAt).pop()?.from ?? -1
  // la pagina si vede intera: se non ci sta in larghezza si riduce
  const [room, setRoom] = useState(0)
  useEffect(() => {
    const box = preview.current
    if (!box) return undefined
    const observer = new ResizeObserver(() => setRoom(box.clientWidth))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const pageWidth = DOC_PAGES[settings.page][0] * DOC_UNIT
  const fit = room ? Math.min(1, (room - 26) / pageWidth) : 1
  // lo zoom scelto, in percento; 0 è la pagina intera, che segue la larghezza dell'anteprima
  const [zoomPct, setZoomPct] = usePanelWidth('document.zoom', 0)
  const zoom = zoomPct ? zoomPct / 100 : fit
  const zoomBy = (dir: 1 | -1): void => setZoomPct(zoomStep(zoom, dir))
  // ⌘ o Ctrl con la rotella ingrandisce l'anteprima; serve un ascoltatore non passivo
  useEffect(() => {
    const box = preview.current
    if (!box) return undefined
    const onWheel = (e: WheelEvent): void => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()
      setZoomPct(zoomStep(zoom, e.deltaY < 0 ? 1 : -1))
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [zoom, setZoomPct])

  // la larghezza del testo, trascinando il bordo con l'anteprima; 0 è metà e metà
  const body = useRef<HTMLDivElement>(null)
  const [bodyWidth, setBodyWidth] = useState(0)
  useEffect(() => {
    const box = body.current
    if (!box) return undefined
    const observer = new ResizeObserver(() => setBodyWidth(box.clientWidth))
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  const [editorWidth, setEditorWidth] = usePanelWidth('document.editor', 0)
  // senza una larghezza scelta il testo prende metà dello spazio che resta alle due colonne
  const settingsWidth = (pageOpen ? 266 : 0) + (outlineOpen ? 206 : 0)
  const halfWidth = Math.max(260, (bodyWidth - settingsWidth - 17) / 2)
  const columns = [
    ...(outlineOpen ? ['200px'] : []),
    editorWidth ? `${editorWidth}px` : 'minmax(0, 1fr)',
    'auto',
    'minmax(0, 1fr)',
    ...(pageOpen ? ['260px'] : [])
  ].join(' ')

  useEffect(() => {
    const el = editor.current
    if (el && caret.current !== null) {
      el.focus()
      el.setSelectionRange(caret.current, caret.current)
      caret.current = null
    }
  }, [text])

  /** Apre lo strumento tabella: sulla tabella dove sta il cursore, se c'è */
  const openTable = (): void => {
    // il campo ricorda il cursore anche dopo aver perso il fuoco
    const at = lastCaret.current === null ? null : (editor.current?.selectionStart ?? null)
    const found =
      at === null
        ? undefined
        : parseDocument(text).find((b) => b.kind === 'table' && b.from <= at && at <= b.to)
    if (found?.kind === 'table')
      setTableEdit({
        value: { header: found.header, align: found.align, rows: found.rows, style: found.style },
        from: found.from,
        to: found.to
      })
    else setTableEdit({})
  }

  /** Apre il riquadro: quello dove sta il cursore, o uno nuovo attorno alle righe selezionate */
  const openBox = (): void => {
    const el = editor.current
    const from = lastCaret.current === null ? text.length : (el?.selectionStart ?? text.length)
    const to = lastCaret.current === null ? from : (el?.selectionEnd ?? from)
    const box = documentBoxes(text).find((b) => b.from <= from && from <= b.to)
    setBoxEdit({ box, from, to })
  }

  /** Apre l'anatomia della carta: quella dove sta il cursore, se c'è */
  const openAnatomy = (): void => {
    const at = lastCaret.current === null ? null : (editor.current?.selectionStart ?? null)
    const found =
      at === null
        ? undefined
        : parseDocument(text).find((b) => b.kind === 'anatomy' && b.from <= at && at <= b.to)
    if (found?.kind === 'anatomy') setAnatomyEdit({ value: found, from: found.from, to: found.to })
    else setAnatomyEdit({})
  }

  /** Apre l'immagine: quella degli asset dove sta il cursore, se c'è */
  const openImage = (): void => {
    const at = lastCaret.current === null ? null : (editor.current?.selectionStart ?? null)
    const img =
      at === null
        ? undefined
        : parseDocument(text)
            .flatMap((b) => (b.kind === 'figure' ? b.images : []))
            .find((i) => i.from <= at && at <= i.to && !isCardSource(i.src))
    if (img) setImageEdit({ value: { alt: img.alt, src: img.src }, from: img.from, to: img.to })
    else setImageEdit({})
  }

  /** Apre lo schema del tavolo: quello dove sta il cursore, se c'è */
  const openSetup = (): void => {
    const at = lastCaret.current === null ? null : (editor.current?.selectionStart ?? null)
    const found =
      at === null
        ? undefined
        : parseDocument(text).find((b) => b.kind === 'setup' && b.from <= at && at <= b.to)
    if (found?.kind === 'setup') setSetupEdit({ value: found, from: found.from, to: found.to })
    else setSetupEdit({})
  }

  /** Cambia il testo come se lo si scrivesse nel campo: ⌘Z nel testo lo annulla */
  const rewrite = (next: string, at: number): void => {
    const el = editor.current
    if (el) runEdit(el, () => ({ text: next, from: at, to: at }))
    else {
      caret.current = at
      onChange(next)
    }
  }

  /** Riscrive il testo tra from e to, o inserisce un blocco al cursore */
  const putBlock = (md: string, from?: number, to?: number): void => {
    if (from === undefined || to === undefined) insertBlock(md)
    else {
      rewrite(text.slice(0, from) + md + text.slice(to), from + md.length)
    }
  }

  /** Esporta dall'anteprima, mostrata per un momento senza riduzione: le carte si misurano così */
  const exportAs = async (kind: DocExportKind): Promise<string> => {
    const page = preview.current?.querySelector<HTMLElement>('.doc-page')
    if (!page) throw new Error('no preview')
    const zoomed = page.style.zoom
    page.style.zoom = '1'
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    try {
      if (kind === 'md') {
        const ctx = {
          project: shownProject,
          ...docInfo,
          language: localization?.language,
          sets,
          assets,
          styles,
          variables
        }
        return await window.api.exportDocumentFiles(
          await documentMarkdown(page, name, text, ctx, fonts)
        )
      }
      if (kind === 'docx') {
        const ctx = {
          project: shownProject,
          ...docInfo,
          language: localization?.language,
          sets,
          assets,
          styles,
          variables
        }
        return await window.api.exportDocumentFiles(
          await documentDocx(page, name, text, ctx, settings, fonts)
        )
      }
      const html = await documentHtml(page, name, settings, fonts)
      // nel browser il PDF passa dalla finestra di stampa: il file lo salva chi stampa
      if (kind === 'pdf' && window.api.isWeb) {
        await printHtml(html, name)
        return ''
      }
      const data = kind === 'pdf' ? await window.api.documentPdf(html) : html
      return await window.api.exportDocumentFiles([{ path: `${name}.${kind}`, data }])
    } finally {
      page.style.zoom = zoomed
    }
  }

  /** L'anteprima segue il cursore: mostra il blocco che si sta scrivendo */
  const followCaret = (): void => {
    const el = editor.current
    const box = preview.current
    if (el) {
      lastCaret.current = el.selectionEnd
      setLevel(headingAt(el.value, el.selectionStart))
      setCaretAt(el.selectionStart)
    }
    if (!el || !box || document.activeElement !== el) return
    const at = el.selectionStart
    let target: HTMLElement | null = null
    for (const b of box.querySelectorAll<HTMLElement>('.doc-block'))
      if (Number(b.dataset.from) <= at) target = b
    if (!target) return
    scrollPreviewTo(target)
  }

  /**
   * Porta il blocco dell'anteprima in vista. La pagina è ingrandita con `zoom`: offsetTop dà le
   * misure senza zoom, quindi si misura sullo schermo, che tiene conto dello zoom.
   */
  const scrollPreviewTo = (target: HTMLElement, always = false): void => {
    const box = preview.current
    if (!box) return
    const r = target.getBoundingClientRect()
    const top = r.top - box.getBoundingClientRect().top + box.scrollTop
    if (
      always ||
      top < box.scrollTop ||
      top + Math.min(r.height, 80) > box.scrollTop + box.clientHeight
    )
      box.scrollTo({ top: Math.max(0, top - 40) })
  }

  /** Dall'indice: porta il testo e l'anteprima al titolo, con il titolo in cima */
  const goToHeading = (from: number): void => {
    const el = editor.current
    if (el) {
      el.focus()
      el.setSelectionRange(from, from)
      el.scrollTop = Math.max(0, textTop(el, from) - 8)
      lastCaret.current = from
      setCaretAt(from)
      setLevel(headingAt(el.value, from))
    }
    const target = preview.current?.querySelector<HTMLElement>(`.doc-block[data-from="${from}"]`)
    if (target) scrollPreviewTo(target, true)
  }

  /** Inserisce un blocco al posto del cursore, su righe sue */
  const insertBlock = (block: string): void => {
    const at = Math.min(lastCaret.current ?? text.length, text.length)
    const before = text.slice(0, at)
    const after = text.slice(at)
    const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const tail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    rewrite(before + lead + block + tail + after, before.length + lead.length + block.length)
  }

  return (
    // anche le finestre (carta, anatomia, schema) mostrano le carte nella lingua del documento
    <LocalizationContext.Provider value={localization}>
      <section
        className="content document-view"
        onKeyDown={(e) => {
          const mod = e.metaKey || e.ctrlKey
          // ⌘/ mette o toglie il commento sulla selezione
          if (mod && e.key === '/' && e.target === editor.current) {
            e.preventDefault()
            runEdit(editor.current, (s, a, b) => toggleWrap(s, a, b, '%%'))
            return
          }
          // ⌘F cerca; ⌥⌘F sul Mac e Ctrl+H altrove anche sostituiscono
          const replace =
            (e.code === 'KeyF' && e.metaKey && e.altKey && !e.shiftKey) ||
            (e.code === 'KeyH' && e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey)
          const search = e.code === 'KeyF' && mod && !e.altKey && !e.shiftKey
          if (!replace && !search) return
          e.preventDefault()
          setFind((f) => ({ replace: replace || (!!f?.replace && search), key: (f?.key ?? 0) + 1 }))
        }}
      >
        <div className="document-head">
          <input
            ref={nameInput}
            className={nameError ? 'document-name invalid' : 'document-name'}
            value={draftName}
            title={nameError ?? t('documents.nameHint')}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') setDraftName(name)
            }}
          />
          <Menu
            className="more-button"
            label="⋯"
            title={t('app.more')}
            items={[
              {
                label: t('documents.rename'),
                title: t('documents.nameHint'),
                onClick: () => {
                  nameInput.current?.focus()
                  nameInput.current?.select()
                }
              },
              {
                label: t('sidebar.duplicate'),
                title: t('documents.duplicateHint'),
                onClick: onDuplicate
              },
              'sep',
              {
                label: t('documents.deleteShort'),
                title: t('documents.delete'),
                danger: true,
                onClick: onDelete
              }
            ]}
          />
          <button
            className={outlineOpen ? 'active' : ''}
            onClick={() => setOutlinePref(outlineOpen ? -1 : 1)}
            title={t('documents.outlineHint')}
          >
            {t('documents.outline')}
          </button>
          <button
            className={pageOpen ? 'active' : ''}
            onClick={() => setPageOpen((o) => !o)}
            title={t('documents.pageButtonHint')}
          >
            {t('documents.page')}
          </button>
          <button onClick={() => setExporting(true)} title={t('documents.exportHint')}>
            {t('documents.exportButton')}
          </button>
        </div>
        <div className="document-body" ref={body} style={{ gridTemplateColumns: columns }}>
          {outlineOpen && (
            <nav className="document-outline" aria-label={t('documents.outline')}>
              <div className="document-settings-head">
                <h3>{t('documents.outline')}</h3>
                <button
                  className="icon-btn"
                  title={t('dialog.close')}
                  onClick={() => setOutlinePref(-1)}
                >
                  ×
                </button>
              </div>
              {headings.length === 0 ? (
                <p className="muted small">{t('documents.outlineEmpty')}</p>
              ) : (
                <ul>
                  {headings.map((h) => (
                    <li key={h.from} className={`level-${h.level}`}>
                      <button
                        className={h.from === currentHeading ? 'active' : ''}
                        title={h.text}
                        onClick={() => goToHeading(h.from)}
                      >
                        {h.text}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </nav>
          )}
          <div className="document-editor">
            <DocumentProperties
              text={text}
              shown={settings.showProperties}
              onChange={onChange}
              onShow={(show) => onChange(withDocumentSettings(text, { showProperties: show }))}
            />
            {find && (
              <FindBar
                editor={editor}
                text={text}
                replace={find.replace}
                focusKey={find.key}
                onReplaceChange={(replace) => setFind((f) => f && { ...f, replace })}
                onClose={() => setFind(null)}
              />
            )}
            <MarkupTextarea
              ref={editor}
              fields={[]}
              comments
              value={text}
              placeholder={t('documents.placeholder')}
              toolbar={(format) => (
                <DocumentToolbar
                  editor={editor}
                  format={format}
                  level={level}
                  onImage={openImage}
                  onTable={openTable}
                  onBox={openBox}
                  onCard={() => setInserting(true)}
                  onAnatomy={openAnatomy}
                  onSetup={openSetup}
                />
              )}
              onChange={(e) => {
                lastCaret.current = e.target.selectionEnd
                onChange(e.target.value)
              }}
              onKeyUp={followCaret}
              onSelect={followCaret}
              onClick={followCaret}
            />
            {problems.length > 0 && (
              <ul className="document-problems">
                {problems.map((p, i) => (
                  <li key={i}>
                    <button
                      className="link"
                      onClick={() => {
                        editor.current?.focus()
                        editor.current?.setSelectionRange(p.from, p.to)
                      }}
                    >
                      {t(p.message)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">
              {t('documents.hint', { file: `${DOCUMENTS_DIR}/${name}.md` })}
            </p>
          </div>
          <Resizer
            width={editorWidth || halfWidth}
            onChange={setEditorWidth}
            edge="left"
            min={260}
            max={Math.max(260, bodyWidth - settingsWidth - 300)}
          />
          <div className="document-preview" ref={preview}>
            <div className="document-zoom" role="group" aria-label={t('documents.zoom')}>
              <button type="button" title={t('documents.zoomOut')} onClick={() => zoomBy(-1)}>
                −
              </button>
              <button
                type="button"
                className={zoomPct ? '' : 'active'}
                title={t('documents.zoomFit')}
                onClick={() => setZoomPct(0)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" title={t('documents.zoomIn')} onClick={() => zoomBy(1)}>
                +
              </button>
            </div>
            <DocumentPreview
              text={text}
              project={meta}
              sets={sets}
              templates={templates}
              zoom={zoom}
              localization={localization}
              onPick={(from) => {
                const el = editor.current
                if (!el) return
                el.focus()
                el.setSelectionRange(from, from)
                // il campo scorre fino al cursore: si toglie e si rimette il fuoco
                el.blur()
                el.focus()
              }}
            />
          </div>
          {pageOpen && (
            <DocumentSettingsPanel
              settings={settings}
              languages={projectLanguages(file)}
              onChange={(change) => onChange(withDocumentSettings(text, change))}
              onClose={() => setPageOpen(false)}
            />
          )}
        </div>
        {exporting && (
          <DocumentExportDialog
            name={name}
            problems={problems.length}
            onExport={exportAs}
            onClose={() => setExporting(false)}
          />
        )}
        {imageEdit && (
          <ImageDialog
            initial={imageEdit.value}
            onClose={() => setImageEdit(null)}
            onSave={(md) => {
              setImageEdit(null)
              putBlock(md, imageEdit.from, imageEdit.to)
            }}
          />
        )}
        {boxEdit && (
          <BoxDialog
            initial={boxEdit.box?.style}
            onClose={() => setBoxEdit(null)}
            onRemove={
              boxEdit.box
                ? () => {
                    const box = boxEdit.box!
                    setBoxEdit(null)
                    rewrite(unwrapBox(text, box), box.from)
                  }
                : undefined
            }
            onSave={(style) => {
              setBoxEdit(null)
              const { box, from, to } = boxEdit
              if (box) {
                const head = boxStartLine(style)
                rewrite(
                  text.slice(0, box.from) + head + text.slice(box.headTo),
                  box.from + head.length
                )
                return
              }
              const out = wrapInBox(text, from, to, style, t('documents.boxSample'))
              rewrite(out.text, out.caret)
            }}
          />
        )}
        {tableEdit && (
          <TableDialog
            initial={tableEdit.value}
            sets={sets}
            templates={templates}
            project={meta}
            onClose={() => setTableEdit(null)}
            onSave={(md) => {
              setTableEdit(null)
              putBlock(md, tableEdit.from, tableEdit.to)
            }}
          />
        )}
        {setupEdit && (
          <SetupDialog
            initial={setupEdit.value}
            sets={sets}
            templates={templates}
            project={meta}
            maxWidth={DOC_PAGES[settings.page][0] - 2 * settings.margin}
            font={(settings.size * 0.88 * 25.4) / 72}
            display={(s) =>
              documentText(s, {
                project: shownProject,
                ...docInfo,
                language: localization?.language,
                sets,
                assets,
                styles,
                variables
              })
            }
            onSave={(md) => {
              setSetupEdit(null)
              putBlock(md, setupEdit.from, setupEdit.to)
            }}
            onClose={() => setSetupEdit(null)}
          />
        )}
        {anatomyEdit && (
          <InsertCardDialog
            anatomy
            initial={anatomyEdit.value}
            sets={sets}
            templates={templates}
            project={meta}
            onInsert={(md) => {
              setAnatomyEdit(null)
              putBlock(md, anatomyEdit.from, anatomyEdit.to)
            }}
            onClose={() => setAnatomyEdit(null)}
          />
        )}
        {inserting && (
          <InsertCardDialog
            sets={sets}
            templates={templates}
            project={meta}
            onInsert={(block) => {
              setInserting(false)
              insertBlock(block)
            }}
            onClose={() => setInserting(false)}
          />
        )}
      </section>
    </LocalizationContext.Provider>
  )
}
