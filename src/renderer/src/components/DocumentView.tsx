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
import { headingAt } from '../../../shared/model/docEdit'
import Menu from './Menu'
import { runEdit } from './editRun'
import FindBar from './FindBar'

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
  file: Pick<ProjectFile, 'languages' | 'names'>
  sets: LoadedSet[]
  templates: Template[]
  fonts: ProjectFont[]
  onChange(text: string): void
  onRename(name: string): void
  onDelete(): void
  onDuplicate(): void
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

  // gli errori del markup li elenca già il campo; qui carte, immagini e nomi che non si trovano
  const problems = useMemo(
    () =>
      documentProblems(text, {
        project,
        sets,
        assets,
        styles,
        variables,
        templates,
        languages: projectLanguages(file)
      }).filter((p) => p.message.key.startsWith('doc.')),
    [text, project, sets, assets, styles, variables, templates, file]
  )
  const localization = useMemo(() => documentLocalization(file, sets, text), [file, sets, text])
  /** Il nome del progetto nella lingua del documento, per {project.name} */
  const shownProject = localization?.project ?? project

  const settings = useMemo(() => documentSettings(text).settings, [text])
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
  const zoom = room ? Math.min(1, (room - 26) / pageWidth) : 1

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
    }
    if (!el || !box || document.activeElement !== el) return
    const at = el.selectionStart
    let target: HTMLElement | null = null
    for (const b of box.querySelectorAll<HTMLElement>('.doc-block'))
      if (Number(b.dataset.from) <= at) target = b
    if (!target) return
    const top = target.offsetTop - box.offsetTop
    if (
      top < box.scrollTop ||
      top + Math.min(target.offsetHeight, 80) > box.scrollTop + box.clientHeight
    )
      box.scrollTo({ top: Math.max(0, top - 40) })
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
        <div className={pageOpen ? 'document-body with-settings' : 'document-body'}>
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
          <div className="document-preview" ref={preview}>
            <DocumentPreview
              text={text}
              project={project}
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
            project={project}
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
            project={project}
            maxWidth={DOC_PAGES[settings.page][0] - 2 * settings.margin}
            font={(settings.size * 0.88 * 25.4) / 72}
            display={(s) =>
              documentText(s, {
                project: shownProject,
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
            project={project}
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
            project={project}
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
