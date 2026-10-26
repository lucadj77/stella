import { useState } from 'react'
import { ATTRIBUTES, BUILTIN_SHAPES, BUILTIN_STYLES } from '../../../shared/model/markup'
import { IMAGE_ATTRIBUTES } from '../../../shared/model/variables'
import { SYSTEM_VARIABLES } from '../../../shared/model/system'
import {
  DONATE_URL,
  guideSectionUrl,
  guideUrl,
  siteUrl,
  tutorialsUrl,
  videoUrl,
  type GuideSection
} from '../../../shared/donate'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import Segmented from './Segmented'
import { isMacPlatform, platformKeys } from '../../../shared/keys'

// Aiuto interno: markup, campi e variabili (anche quelle di sistema), formule e scorciatoie, da
// consultare senza aprire la guida. Le parole chiave restano in inglese; vedi docs/guida.

type Tab = 'start' | 'text' | 'variables' | 'formulas' | 'keys'

const TAB_KEY = 'help.tab'

/** Markdown: cosa si scrive ($ è un testo di esempio) e la chiave della spiegazione */
const MARKDOWN: [string, MessageKey][] = [
  ['**$**', 'help.md.bold'],
  ['*$*', 'help.md.italic'],
  ['++$++', 'help.md.underline'],
  ['~~$~~', 'help.md.strike'],
  ['==$==', 'help.md.highlight'],
  ['^$^  ~$~', 'help.md.supsub'],
  ['# …  ## …', 'help.md.heading'],
  ['> …', 'help.md.note'],
  ['- …  1. …', 'help.md.list'],
  ['---', 'help.md.rule'],
  ['\\', 'help.md.break'],
  ['_$_', 'help.md.nowrap']
]

const FUNCTIONS = [
  'IF',
  'AND',
  'OR',
  'NOT',
  'MIN',
  'MAX',
  'ABS',
  'ROUND',
  'FLOOR',
  'CEILING',
  'UPPER',
  'LOWER',
  'LEN',
  'CONCAT',
  'ISBLANK',
  'COUNTIN',
  'MOD',
  'PICK'
] as const

const KEYS: [string, MessageKey][] = [
  ['⌘S', 'help.keys.save'],
  ['⌘O  ⌘W', 'help.keys.project'],
  ['⌘Z  ⇧⌘Z', 'help.keys.undo'],
  ['⌘A  Esc', 'help.keys.selectCards'],
  ['Alt+Enter', 'help.keys.cellBreak'],
  ['{  ↑ ↓  Enter', 'help.keys.suggest'],
  ['PgUp  PgDn', 'help.keys.page'],
  ['T  R  E  I  G  V', 'help.keys.tools'],
  ['⌘F', 'help.keys.search'],
  ['⌘D', 'help.keys.duplicate'],
  ['⌘C  ⌘X  ⌘V', 'help.keys.copy'],
  ['⌘G  ⇧⌘G', 'help.keys.group'],
  ['Del', 'help.keys.delete'],
  ['← → ↑ ↓  ⇧', 'help.keys.move'],
  ['⇧ / Alt', 'help.keys.drag'],
  ['⌘', 'help.keys.dragCenter'],
  ['⌘ + wheel', 'help.keys.zoom'],
  ['F1', 'help.keys.help']
]

/** Righe di codice e spiegazione, con un esempio facoltativo in una terza colonna */
function Table({
  rows
}: {
  rows: ([string, string] | [string, string, string])[]
}): React.JSX.Element {
  return (
    <table className="help-table">
      <tbody>
        {rows.map(([code, text, example]) => (
          <tr key={code}>
            <td>
              <code>{code}</code>
            </td>
            <td>{text}</td>
            {example !== undefined && (
              <td>
                <code>{example}</code>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** I primi passi: cosa si fa, con il capitolo della guida */
const STEPS: [MessageKey, MessageKey, GuideSection][] = [
  ['help.start.template', 'help.start.templateText', 'template'],
  ['help.start.set', 'help.start.setText', 'set'],
  ['help.start.component', 'help.start.componentText', 'set'],
  ['help.start.export', 'help.start.exportText', 'export']
]

/** Le parole che tornano in tutta l'app */
const GLOSSARY: MessageKey[] = [
  'help.word.component',
  'help.word.template',
  'help.word.set',
  'help.word.layer',
  'help.word.column',
  'help.word.bleed',
  'help.word.safe',
  'help.word.variable',
  'help.word.style',
  'help.word.assets'
]

function savedTab(): Tab | null {
  try {
    const v = localStorage.getItem(TAB_KEY)
    return v === 'start' || v === 'text' || v === 'variables' || v === 'formulas' || v === 'keys'
      ? v
      : null
  } catch {
    return null
  }
}

export default function HelpDialog({
  onClose,
  start = false
}: {
  onClose(): void
  /** Apre sui primi passi: nessun progetto aperto, o un progetto ancora senza componenti */
  start?: boolean
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const [tab, setTabState] = useState<Tab>(() => (start ? 'start' : (savedTab() ?? 'start')))
  const setTab = (v: Tab): void => {
    setTabState(v)
    try {
      localStorage.setItem(TAB_KEY, v)
    } catch {
      // la scheda torna quella di base
    }
  }
  const field = t('help.sampleField')
  const icon = t('help.sampleIcon')

  return (
    <Dialog title={t('help.title')} onClose={onClose}>
      <div className="help-dialog">
        <p className="help-guide">
          <a href={guideUrl(lang)} target="_blank" rel="noreferrer">
            {t('help.guide')}
          </a>
          {' · '}
          <a href={siteUrl(lang)} target="_blank" rel="noreferrer">
            {t('help.site')}
          </a>
        </p>
        <p className="help-support">
          <a href={DONATE_URL} target="_blank" rel="noreferrer">
            {t('help.support')}
          </a>
        </p>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            ['start', t('help.tab.start')],
            ['text', t('help.tab.text')],
            ['variables', t('help.tab.variables')],
            ['formulas', t('help.tab.formulas')],
            ['keys', t('help.tab.keys')]
          ]}
        />
        <div className="help-body">
          {tab === 'start' && (
            <>
              <h3>{t('help.start.title')}</h3>
              <ol className="help-steps">
                {STEPS.map(([title, text, section]) => (
                  <li key={title}>
                    <strong>{t(title)}</strong> {t(text)}{' '}
                    <a href={guideSectionUrl(section, lang)} target="_blank" rel="noreferrer">
                      {t('help.start.inGuide')}
                    </a>
                  </li>
                ))}
              </ol>
              <h3>{t('help.start.videos')}</h3>
              <p className="help-videos">
                <a href={videoUrl('overview', lang)} target="_blank" rel="noreferrer">
                  {t('help.start.overview')}
                </a>
                <a href={videoUrl('firstComponent', lang)} target="_blank" rel="noreferrer">
                  {t('help.start.firstComponent')}
                </a>
                <a href={tutorialsUrl(lang)} target="_blank" rel="noreferrer">
                  {t('welcome.allVideos')}
                </a>
              </p>
              <h3>{t('help.start.words')}</h3>
              <Table rows={GLOSSARY.map((k) => [t(`${k}.name` as MessageKey), t(k)])} />
            </>
          )}
          {tab === 'text' && (
            <>
              <h3>{t('help.markdown')}</h3>
              <Table
                rows={MARKDOWN.map(([c, k]) => [c.replaceAll('$', t('help.sampleText')), t(k)])}
              />
              <h3>{t('help.attributes')}</h3>
              <p>{t('help.attributesIntro')}</p>
              <Table
                rows={Object.keys(ATTRIBUTES).map((a) => [
                  a,
                  t(`markupHelp.attr.${a}` as MessageKey)
                ])}
              />
              <p>
                {t('help.styles', {
                  list: Object.keys(BUILTIN_STYLES)
                    .map((s) => '.' + s)
                    .join(', ')
                })}{' '}
                {t('help.shapes', { list: BUILTIN_SHAPES.join(', ') })}
              </p>
            </>
          )}
          {tab === 'variables' && (
            <>
              <h3>{t('help.fields')}</h3>
              <Table
                rows={[
                  [`{${field}}`, t('help.field.field')],
                  [`{${icon}}`, t('help.field.variable')],
                  [`{${icon}*3}  {${icon}*${field}}`, t('help.field.repeat')],
                  [`{${icon} tint=red size=150%}`, t('help.field.attrs')],
                  ['\\{  \\*  \\[', t('help.field.escape')]
                ]}
              />
              <h3>{t('help.imageAttributes')}</h3>
              <Table
                rows={Object.keys(IMAGE_ATTRIBUTES).map((a) => [
                  a,
                  t(`markupHelp.attr.image.${a}` as MessageKey)
                ])}
              />
              <h3>{t('help.system')}</h3>
              <p>{t('help.systemIntro')}</p>
              <Table
                rows={SYSTEM_VARIABLES.map((v) => [`{${v}}`, t(`system.${v}` as MessageKey)])}
              />
            </>
          )}
          {tab === 'formulas' && (
            <>
              <p>{t('help.formulasIntro')}</p>
              <Table
                rows={[
                  [`{${field}}.png`, t('help.formula.text')],
                  [`{${field}}+2`, t('help.formula.math')],
                  [`=IF({${field}}>3; "A"; "B")`, t('help.formula.expr')],
                  ['= <> < > <= >=  &', t('help.formula.operators')]
                ]}
              />
              <h3>{t('help.functions')}</h3>
              <p>{t('help.examplesIntro')}</p>
              <Table
                rows={FUNCTIONS.map((f) => [
                  f,
                  t(`help.fn.${f}` as MessageKey),
                  t(`help.ex.${f}` as MessageKey)
                ])}
              />
            </>
          )}
          {tab === 'keys' && (
            <>
              <Table rows={KEYS.map(([c, k]) => [platformKeys(c, isMacPlatform(), lang), t(k)])} />
            </>
          )}
        </div>
        <div className="dialog-buttons">
          <button className="primary" onClick={onClose}>
            {t('about.close')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
