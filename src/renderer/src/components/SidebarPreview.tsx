import type { LoadedProject } from '../../../shared/project'
import { bindRow } from '../../../shared/model/bind'
import { projectSystem, systemOfSet } from '../../../shared/model/system'
import type { LoadedSet } from '../../../shared/project'
import type { Template } from '../../../shared/model/template'
import { palette, resolveColor, type Variables } from '../../../shared/model/variables'
import { useI18n } from '../i18n/context'
import { useBindContext, VariablesContext } from '../render/assets'
import CardSvg from '../render/CardSvg'
import MarkupText from '../render/MarkupText'
import type { Hover } from './useSidebarPreview'

// Anteprima delle voci della barra laterale: soffermando il puntatore su un set, un template,
// uno stile o una variabile compare accanto alla barra un riquadro con il suo contenuto.

const GAP = 8
/** Altezza delle carte nell'anteprima, in pixel */
const CARD_HEIGHT = 150
const SET_CARDS = 3

export default function SidebarPreview({
  hover,
  project,
  styles,
  side
}: {
  hover: Hover | null
  project: LoadedProject
  /** Stili del progetto insieme a quelli predefiniti */
  styles: Record<string, string>
  /** Lato della barra: l'anteprima compare dall'altra parte */
  side: 'left' | 'right'
}): React.JSX.Element | null {
  const { t } = useI18n()
  const ctx = useBindContext()
  if (!hover) return null
  const { target, rect } = hover
  const variables = project.file.variables ?? {}

  const cards = (tpl: Template, set: LoadedSet | undefined, count: number): Template[] => {
    const rows = set?.data?.rows.slice(0, count) ?? []
    const info = set ? systemOfSet(project.file, set) : projectSystem(project.file)
    return (rows.length ? rows : [[]]).map(
      (r, i) =>
        bindRow(set?.data?.headers ?? [], r, tpl, project.templates, {
          ...ctx,
          system: { ...info, number: rows.length ? i + 1 : undefined }
        }).template
    )
  }
  const scaleOf = (tpl: Template): number => Math.min(CARD_HEIGHT / tpl.height, 140 / tpl.width)

  let title: string
  let note: string | null
  let hint: string | null = null
  let body: React.ReactNode
  if (target.kind === 'set') {
    const set = project.sets[target.index]
    if (!set) return null
    const tpl = project.templates.find((x) => x.name === set.template)
    title = set.name
    note = t('sidebarPreview.set', { template: set.template, n: set.data?.rows.length ?? 0 })
    hint = t('tip.openSet')
    if (tpl && set.data?.rows.length) {
      const shown = cards(tpl, set, SET_CARDS)
      body = (
        <div className="sidebar-preview-cards">
          {shown.map((c, i) => (
            <CardSvg key={i} template={c} side="front" scale={scaleOf(c)} />
          ))}
        </div>
      )
    } else body = <p className="muted small">{t('sidebarPreview.noCards')}</p>
  } else if (target.kind === 'template') {
    const tpl = project.templates.find((x) => x.name === target.name)
    if (!tpl) return null
    // con i dati della prima carta di un set che lo usa, altrimenti con i valori predefiniti
    const set = project.sets.find((s) => s.template === tpl.name && s.data?.rows.length)
    const [card] = cards(tpl, set, 1)
    title = tpl.name
    note = t('sidebarPreview.template', { w: tpl.width, h: tpl.height })
    hint = t('tip.openTemplate')
    body = (
      <div className="sidebar-preview-cards">
        <CardSvg template={card} side="front" scale={scaleOf(card)} />
        <CardSvg template={card} side="back" scale={scaleOf(card)} />
      </div>
    )
  } else if (target.kind === 'style') {
    title = `.${target.name}`
    note = styles[target.name] ?? ''
    body = (
      <div className="sidebar-preview-text">
        <MarkupText
          text={`[${t('sidebarPreview.sample')}]{.${target.name}}`}
          unit={4}
          ratio={1}
          paragraphSpacing={0}
        />
      </div>
    )
  } else {
    const v = variables[target.name]
    if (!v) return null
    title = `{${target.name}}`
    note = t(`variable.type.${v.type}`)
    body = <VariableBody name={target.name} variables={variables} />
  }

  return (
    <div
      className="sidebar-preview"
      role="tooltip"
      ref={(el) => {
        // il riquadro resta dentro la finestra
        if (!el) return
        const h = el.offsetHeight
        const w = el.offsetWidth
        const top = Math.max(4, Math.min(rect.top, window.innerHeight - h - 4))
        const left = side === 'left' ? rect.right + GAP : rect.left - GAP - w
        el.style.top = `${top}px`
        el.style.left = `${Math.max(4, Math.min(left, window.innerWidth - w - 4))}px`
      }}
      style={{ top: rect.top, left: side === 'left' ? rect.right + GAP : undefined }}
    >
      <div className="sidebar-preview-title">{title}</div>
      {body}
      {note && <div className="muted small sidebar-preview-note">{note}</div>}
      {hint && <div className="muted small sidebar-preview-note">{hint}</div>}
    </div>
  )
}

function VariableBody({
  name,
  variables
}: {
  name: string
  variables: Variables
}): React.JSX.Element {
  const v = variables[name]
  if (v.type === 'color') {
    const color = resolveColor(v.color, palette(variables))
    return (
      <div className="sidebar-preview-color">
        <span style={{ background: color }} />
        <code>{v.color}</code>
      </div>
    )
  }
  if (v.type === 'value') return <div className="sidebar-preview-value">{v.value}</div>
  return (
    <div className={v.type === 'image' ? 'sidebar-preview-icon' : 'sidebar-preview-text'}>
      <VariablesContext.Provider value={variables}>
        <MarkupText text={`{${name}}`} unit={4} ratio={1} paragraphSpacing={0} />
      </VariablesContext.Provider>
    </div>
  )
}
