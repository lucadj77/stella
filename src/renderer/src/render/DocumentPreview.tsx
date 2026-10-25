import { Fragment, memo, useContext, useMemo } from 'react'
import type { LoadedSet } from '../../../shared/project'
import type { Template } from '../../../shared/model/template'
import { resolveAsset } from '../../../shared/model/assets'
import {
  imageVariable,
  palette,
  resolveColor,
  resolveFont,
  type Variables
} from '../../../shared/model/variables'
import { msg } from '../../../shared/messages'
import { cellBorders, cellImageKey, cellParts } from '../../../shared/model/docTable'
import type { BoxStyle, DocBox } from '../../../shared/model/docBox'
import AnatomyDiagram from './AnatomyDiagram'
import SetupDiagram from './SetupDiagram'
import { setupView, setupWithText } from './setupGeometry'
import { useBoundCard } from './useBoundCard'
import {
  anatomyCardSource,
  DOC_PAGES,
  documentSettings,
  documentText,
  figureAlign,
  imageProblem,
  isCardSource,
  parseDocument,
  splitImageSource,
  type DocBlock,
  type DocSettings,
  type DocumentContext
} from '../../../shared/model/document'
import { useI18n } from '../i18n/context'
import CardSvg from './CardSvg'
import { MarkupInline } from './MarkupText'
import {
  AssetsContext,
  LocalizationContext,
  StylesContext,
  VariablesContext,
  assetUrl
} from './assets'
import type { Localization } from '../../../shared/model/language'

// Anteprima di un documento del progetto (model/document.ts): il Markdown come una pagina, con il
// markup di Stella nel testo e le carte disegnate dal progetto, come nell'esportazione.

/** Pixel per millimetro: le carte si vedono alla loro misura vera (96 punti per pollice) */
export const DOC_UNIT = 96 / 25.4
/** mm in un punto tipografico */
const PT = 25.4 / 72

interface Props {
  text: string
  project: string
  sets: LoadedSet[]
  templates: Template[]
  /** Riduzione della pagina per farla stare nello spazio, 1 alla misura vera */
  zoom?: number
  /** Posizione nel testo del blocco su cui si è fatto clic */
  onPick?(from: number): void
  /** Lingua delle carte del documento (documentLocalization); nessuna per la principale */
  localization?: Localization
}

/** Lo stile della pagina dalle impostazioni in testa al documento */
function pageStyle(s: DocSettings, variables: DocumentContext['variables']): React.CSSProperties {
  const pal = palette(variables)
  const family = (f: string): string | undefined =>
    f.trim() ? `'${resolveFont(f, variables)}', sans-serif` : undefined
  return {
    width: `${DOC_PAGES[s.page][0]}mm`,
    padding: `${s.margin}mm`,
    fontFamily: family(s.font),
    fontSize: `${s.size}pt`,
    lineHeight: s.lineHeight,
    textAlign: s.align,
    color: resolveColor(s.color, pal),
    ['--doc-heading-font' as string]: family(s.headingFont) ?? 'inherit',
    ['--doc-heading-color' as string]: s.headingColor
      ? resolveColor(s.headingColor, pal)
      : 'inherit',
    ['--doc-spacing' as string]: `${s.paragraphSpacing}pt`
  }
}

export default function DocumentPreview({
  text,
  project,
  sets,
  templates,
  zoom = 1,
  onPick,
  localization
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const styles = useContext(StylesContext)
  const variables = useContext(VariablesContext)
  const ctx = useMemo<DocumentContext>(
    () => ({
      project: localization?.project ?? project,
      language: localization?.language,
      sets,
      assets,
      styles,
      variables
    }),
    [project, sets, assets, styles, variables, localization]
  )
  const blocks = useMemo(() => parseDocument(text), [text])
  const settings = useMemo(() => documentSettings(text).settings, [text])
  return (
    // le carte del documento si disegnano nella sua lingua, non in quella scelta nell'app
    <LocalizationContext.Provider value={localization}>
      <div className="doc-page" style={{ ...pageStyle(settings, variables), zoom }}>
        {!blocks.length && <p className="muted">{t('documents.empty')}</p>}
        {groups(blocks).map(({ box, items }) => {
          /* chiave per posizione: scrivendo prima di una carta la carta non si ridisegna */
          const list = items.map(({ block: b, k }) => (
            <div
              key={`${k}:${b.kind}`}
              className="doc-block"
              data-from={b.from}
              onClick={(e) => {
                // un clic su un collegamento o una selezione di testo non sposta il cursore
                if (!window.getSelection()?.isCollapsed) return
                e.stopPropagation()
                onPick?.(b.from)
              }}
            >
              <Block block={b} ctx={ctx} templates={templates} settings={settings} />
            </div>
          ))
          return box ? (
            <div
              key={`box:${items[0].k}`}
              className="doc-box"
              style={boxStyle(box.style, variables)}
            >
              {list}
            </div>
          ) : (
            list
          )
        })}
      </div>
    </LocalizationContext.Provider>
  )
}

/** I blocchi in fila, con quelli di uno stesso riquadro messi insieme */
function groups(blocks: DocBlock[]): { box?: DocBox; items: { block: DocBlock; k: number }[] }[] {
  const out: { box?: DocBox; items: { block: DocBlock; k: number }[] }[] = []
  blocks.forEach((block, k) => {
    const last = out[out.length - 1]
    if (last && block.box && last.box === block.box) last.items.push({ block, k })
    else out.push({ box: block.box, items: [{ block, k }] })
  })
  return out
}

/** Sfondo, bordo e spazio di un riquadro */
function boxStyle(s: BoxStyle, variables: Variables): React.CSSProperties {
  const pal = palette(variables)
  return {
    background: s.fill ? resolveColor(s.fill, pal) : undefined,
    border:
      s.border && s.borderWidth > 0
        ? `${s.borderWidth}mm solid ${resolveColor(s.border, pal)}`
        : undefined,
    padding: `${s.padding}mm`,
    borderRadius: s.radius ? `${s.radius}mm` : undefined
  }
}

function Block({
  block: b,
  ctx,
  templates,
  settings
}: {
  block: DocBlock
  settings: DocSettings
  ctx: DocumentContext
  templates: Template[]
}): React.JSX.Element {
  const { t } = useI18n()
  const inline = (s: string): React.JSX.Element => (
    <MarkupInline text={documentText(s, ctx)} unit={DOC_UNIT} />
  )
  switch (b.kind) {
    case 'heading': {
      const H = `h${b.level}` as 'h1' | 'h2' | 'h3'
      return <H>{inline(b.text)}</H>
    }
    case 'paragraph':
      return <p>{inline(b.text)}</p>
    case 'quote':
      return <blockquote>{inline(b.text)}</blockquote>
    case 'rule':
      return <hr />
    case 'code':
      return <pre>{b.text}</pre>
    case 'list':
      return (
        <div className="doc-list">
          {b.items.map((it, k) => (
            <div key={k} className="doc-item" style={{ marginLeft: `${it.depth * 1.4}em` }}>
              <span className="doc-marker">{it.ordered ? `${it.number}.` : '•'}</span>
              <span>{inline(it.text)}</span>
            </div>
          ))}
        </div>
      )
    case 'table':
      return <TableView block={b} ctx={ctx} templates={templates} inline={inline} />
    case 'anatomy': {
      const problem = b.card
        ? imageProblem(anatomyCardSource(b.card), ctx)
        : msg('doc.anatomy.noCard')
      return (
        <div className="doc-figure">
          <figure data-from={b.from}>
            {problem ? (
              <span className="doc-missing">{t(problem)}</span>
            ) : (
              <AnatomyDiagram
                anatomy={{
                  ...b,
                  callouts: b.callouts.map((c) => ({ ...c, label: documentText(c.label, ctx) }))
                }}
                sets={ctx.sets ?? []}
                templates={templates}
                project={ctx.project}
                unit={DOC_UNIT}
                maxWidth={(DOC_PAGES[settings.page][0] - 2 * settings.margin) * (b.width ?? 1)}
                font={settings.size * 0.88 * PT * (b.font ?? 1)}
              />
            )}
          </figure>
        </div>
      )
    }
    case 'setup': {
      const setup = setupWithText(b, (s) => documentText(s, ctx))
      // width: e font: restringono lo schema e cambiano il corpo delle didascalie
      const maxWidth = (DOC_PAGES[settings.page][0] - 2 * settings.margin) * (b.width ?? 1)
      const sets = ctx.sets ?? []
      return (
        <div className="doc-figure">
          <figure data-from={b.from}>
            <SetupDiagram
              setup={setup}
              view={setupView(
                setup,
                sets,
                templates,
                maxWidth,
                settings.size * 0.88 * PT * (b.font ?? 1)
              )}
              sets={sets}
              templates={templates}
              project={ctx.project}
              unit={DOC_UNIT}
              maxWidth={maxWidth}
            />
          </figure>
        </div>
      )
    }
    case 'figure':
      return (
        <div className={`doc-figure align-${figureAlign(b.images)}`}>
          {b.images.map((img, k) => (
            <Figure
              key={k}
              src={img.src}
              alt={img.alt}
              from={img.from}
              ctx={ctx}
              templates={templates}
            />
          ))}
        </div>
      )
  }
}

/** Una tabella, con il suo aspetto e le immagini nelle celle */
function TableView({
  block: b,
  ctx,
  templates,
  inline
}: {
  block: Extract<DocBlock, { kind: 'table' }>
  ctx: DocumentContext
  templates: Template[]
  inline(s: string): React.JSX.Element
}): React.JSX.Element {
  const s = b.style
  const pal = palette(ctx.variables)
  const color = (c: string | null): string | undefined => (c ? resolveColor(c, pal) : undefined)
  const line = `${s.borderWidth}mm solid ${color(s.border)}`
  const all = b.header.length ? [b.header, ...b.rows] : b.rows
  const cols = Math.max(b.align.length, ...all.map((r) => r.length))
  const cellStyle = (row: number, col: number, fill: string | null): React.CSSProperties => {
    const on = cellBorders(s.lines, row, col, all.length, cols)
    const side = (v: boolean): string => (v && s.borderWidth > 0 ? line : 'none')
    return {
      textAlign: b.align[col] ?? undefined,
      borderTop: side(on.top),
      borderRight: side(on.right),
      borderBottom: side(on.bottom),
      borderLeft: side(on.left),
      background: color(fill) ?? 'none'
    }
  }
  const content = (text: string, row: number, col: number): React.ReactNode =>
    cellParts(text).map((p, k) =>
      p.kind === 'text' ? (
        <Fragment key={k}>{inline(p.text)}</Fragment>
      ) : (
        <Figure
          key={k}
          src={p.src}
          alt={p.alt}
          from={cellImageKey(b.from, row, col, k)}
          ctx={ctx}
          templates={templates}
        />
      )
    )
  const head = b.header.length > 0
  return (
    <table
      className={head ? undefined : 'doc-properties'}
      style={{ width: s.width ? `${s.width}%` : undefined }}
    >
      {s.columns.length > 0 && (
        <colgroup>
          {Array.from({ length: cols }, (_, k) => (
            <col key={k} style={{ width: s.columns[k] ? `${s.columns[k]}%` : undefined }} />
          ))}
        </colgroup>
      )}
      {head && (
        <thead>
          <tr>
            {b.header.map((h, k) => (
              <th key={k} style={cellStyle(0, k, s.header)}>
                {content(h, 0, k)}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {b.rows.map((r, i) => {
          const row = head ? i + 1 : i
          const fill = i % 2 === 1 && s.stripes ? s.stripes : s.fill
          return (
            <tr key={i}>
              {r.map((c, k) => (
                <td key={k} style={cellStyle(row, k, fill)}>
                  {content(c, row, k)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** Una carta del progetto o un'immagine degli asset, con la didascalia */
const Figure = memo(function Figure({
  src,
  alt,
  from,
  ctx,
  templates
}: {
  src: string
  alt: string
  /** Posizione nel testo (o chiave nella cella): l'esportazione ritrova così la carta disegnata */
  from: number | string
  ctx: DocumentContext
  templates: Template[]
}): React.JSX.Element {
  const { t } = useI18n()
  const problem = imageProblem(src, ctx)
  const content = problem ? (
    <span className="doc-missing">{t(problem)}</span>
  ) : isCardSource(src) ? (
    <CardImage src={src} sets={ctx.sets ?? []} templates={templates} project={ctx.project} />
  ) : (
    <AssetImage src={src} ctx={ctx} />
  )
  return (
    <figure data-from={from}>
      {content}
      {alt && (
        <figcaption>
          <MarkupInline text={documentText(alt, ctx)} unit={DOC_UNIT} />
        </figcaption>
      )}
    </figure>
  )
})

function CardImage({
  src,
  sets,
  templates,
  project
}: {
  src: string
  sets: LoadedSet[]
  templates: Template[]
  project?: string
}): React.JSX.Element | null {
  const card = useBoundCard(src, sets, templates, project)
  if (!card) return null
  const tpl = card.template
  const scale = ((card.ref.width ?? tpl.width) / tpl.width) * DOC_UNIT
  return <CardSvg template={tpl} side={card.ref.side} scale={scale} />
}

function AssetImage({ src, ctx }: { src: string; ctx: DocumentContext }): React.JSX.Element {
  if (/^https?:\/\//i.test(src)) return <img src={src} alt="" />
  const { path, options } = splitImageSource(src)
  const name = path.replace(/^\{(.*)\}$/, '$1')
  const v = imageVariable(name, ctx.variables)
  const r = resolveAsset(v ? v.src : name, ctx.assets ?? [])
  // con la larghezza scritta l'altezza segue le proporzioni; la pagina resta il limite
  const style = options.width ? { width: options.width * DOC_UNIT } : undefined
  return r.ok ? (
    <img src={assetUrl(r.path)} alt="" style={style} />
  ) : (
    <span className="doc-missing">{src}</span>
  )
}
