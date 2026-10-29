import { useEffect, useRef, useState } from 'react'
import type { DocRenderFile, DocRenderInput } from '../../../shared/api'
import { documentSettings } from '../../../shared/model/document'
import DocumentPreview from '../render/DocumentPreview'
import {
  AssetsContext,
  NumberSettingsContext,
  StylesContext,
  VariablesContext
} from '../render/assets'
import type { NumberSettings } from '../../../shared/model/numberFormat'
import { useRegisterFonts } from '../render/fonts'
import { documentHtml, documentMarkdown } from './documentExport'
import { documentDocx } from './documentDocx'
import { settle } from './settle'

const NO_NUMBERS: NumberSettings = {}

// Pagina della finestra nascosta che esporta un documento senza l'app (stella export-doc): lo
// disegna come l'anteprima, alla misura vera, e ne ricava l'HTML o il Markdown con le carte in
// PNG o il file Word, come il tasto Esporta documento.

interface Job {
  input: DocRenderInput
  done(files: DocRenderFile[]): void
  fail(e: Error): void
}

/** Un errore che non è un Error (un evento, un oggetto), in parole */
function describe(e: unknown): string {
  if (e instanceof Event)
    return `${e.type} event on ${(e.target as Element | null)?.tagName ?? '?'}`
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

function base64(data: Uint8Array): string {
  let s = ''
  for (let i = 0; i < data.length; i += 0x8000)
    s += String.fromCharCode(...data.subarray(i, i + 0x8000))
  return btoa(s)
}

async function render(root: HTMLElement, input: DocRenderInput): Promise<DocRenderFile[]> {
  await settle(root)
  const page = root.querySelector<HTMLElement>('.doc-page')
  if (!page) throw new Error('the document was not drawn')
  const settings = documentSettings(input.text).settings
  if (input.kind === 'md' || input.kind === 'docx') {
    const ctx = {
      project: input.project,
      language: input.localization?.language,
      sets: input.sets,
      assets: input.assets,
      styles: input.styles,
      variables: input.variables
    }
    const files =
      input.kind === 'md'
        ? await documentMarkdown(page, input.name, input.text, ctx, input.fonts)
        : await documentDocx(page, input.name, input.text, ctx, settings, input.fonts)
    return files.map((f) =>
      typeof f.data === 'string'
        ? { path: f.path, text: f.data }
        : { path: f.path, base64: base64(f.data) }
    )
  }
  const html = await documentHtml(page, input.name, settings, input.fonts)
  return [{ path: `${input.name}.html`, text: html }]
}

export default function DocumentExportPage(): React.JSX.Element {
  const [job, setJob] = useState<Job | null>(null)
  const root = useRef<HTMLDivElement>(null)
  useRegisterFonts(job?.input.fonts)

  useEffect(() => {
    const w = window as unknown as { stellaDocument?: (input: DocRenderInput) => Promise<unknown> }
    // il processo principale riceve bene solo un testo come errore
    w.stellaDocument = (input) =>
      new Promise((done, fail) => setJob({ input, done, fail })).catch((e: Error) => {
        throw e.message || String(e)
      })
  }, [])

  useEffect(() => {
    if (!job || !root.current) return
    render(root.current, job.input).then(job.done, (e) =>
      job.fail(e instanceof Error ? e : new Error(describe(e)))
    )
  }, [job])

  const input = job?.input
  return (
    <AssetsContext.Provider value={input?.assets ?? []}>
      <StylesContext.Provider value={input?.styles ?? {}}>
        <VariablesContext.Provider value={input?.variables ?? {}}>
          <NumberSettingsContext.Provider value={input?.numbers ?? NO_NUMBERS}>
            <div ref={root}>
              {input && (
                <DocumentPreview
                  text={input.text}
                  project={input.project}
                  sets={input.sets}
                  templates={input.templates}
                  zoom={1}
                  localization={input.localization}
                />
              )}
            </div>
          </NumberSettingsContext.Provider>
        </VariablesContext.Provider>
      </StylesContext.Provider>
    </AssetsContext.Provider>
  )
}
