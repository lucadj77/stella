import { useMemo, useRef, useState } from 'react'
import type { LoadedProject } from '../../../shared/project'
import { imageUsages } from '../../../shared/model/imageUsage'
import { isImageAsset } from '../../../shared/model/assets'
import { definitionUsages, usesIndex } from '../../../shared/model/overview'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import {
  DocumentsIcon,
  ImageIcon,
  NotesIcon,
  SetsIcon,
  StylesIcon,
  TemplateIcon,
  VariablesIcon
} from '../components/icons'
import { StylesPane, VariablesPane } from './DefinitionPanes'
import ImagesPane from './ImagesPane'
import {
  ManageNavContext,
  MANAGE_TABS,
  storeManageTab,
  type ManageActions,
  type ManageTab
} from './manageTypes'
import { DocumentsPane, NotesPane, SetsPane, TemplatesPane } from './ProjectPanes'

// «Gestisci il progetto»: una scheda per ogni sezione della barra laterale, con tutti gli
// elementi, dove sono usati, filtri, selezione multipla e azioni. I nomi sono collegamenti che
// portano alla scheda dell'elemento. Vedi docs/specifica.md, sezione 3.2.

const TAB_ICONS: Record<ManageTab, React.ReactNode> = {
  sets: <SetsIcon />,
  templates: <TemplateIcon />,
  styles: <StylesIcon />,
  variables: <VariablesIcon />,
  images: <ImageIcon />,
  documents: <DocumentsIcon />,
  notes: <NotesIcon />
}

export default function ManageDialog({
  project,
  tab: initialTab,
  focus: initialFocus,
  styles,
  styleNames,
  variableNames,
  templateNames,
  actions,
  onClose
}: {
  project: LoadedProject
  tab: ManageTab
  focus?: string
  /** Stili del progetto con quelli predefiniti */
  styles: Record<string, string>
  /** Nell'ordine della barra laterale */
  styleNames: string[]
  variableNames: string[]
  templateNames: string[]
  actions: ManageActions
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const root = useRef<HTMLDivElement>(null)
  /**
   * Esc con un'altra finestra aperta sopra (la modifica di una variabile, una rinomina): non si
   * chiude questa, si passa il fuoco a quella, che si chiude con il prossimo Esc
   */
  const close = (): void => {
    const mine = root.current?.closest('.dialog-backdrop')
    const all = document.querySelectorAll<HTMLElement>('.dialog-backdrop')
    const top = all[all.length - 1]
    if (mine && top && top !== mine) {
      top.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
      return
    }
    onClose()
  }
  // ogni collegamento rimonta la scheda con la voce scelta: `visit` cambia a ogni passaggio
  const [at, setAt] = useState({ tab: initialTab, focus: initialFocus, visit: 0 })
  const go = (tab: ManageTab, focus?: string): void => {
    storeManageTab(tab)
    setAt((a) => ({ tab, focus, visit: a.visit + 1 }))
  }

  const data = useMemo(() => {
    const scope = {
      templates: project.templates,
      sets: project.sets,
      variables: project.file.variables ?? {},
      styles: project.file.styles ?? {},
      documents: project.documents,
      notes: project.notes,
      assets: project.assets
    }
    const variables = definitionUsages(scope, 'variable', Object.keys(scope.variables))
    const styleUse = definitionUsages(scope, 'style', Object.keys(styles))
    const images = imageUsages({
      templates: project.templates,
      sets: project.sets,
      documents: project.documents,
      assets: project.assets,
      variables: project.file.variables,
      styles: project.file.styles,
      cover: project.file.cover
    })
    return { variables, styles: styleUse, images, uses: usesIndex(variables, styleUse, images) }
  }, [project, styles])

  const counts: Record<ManageTab, number> = {
    sets: project.sets.length,
    // le varianti stanno dentro il loro template, come nella barra laterale
    templates: templateNames.length,
    styles: styleNames.length,
    variables: variableNames.length,
    images: project.assets.filter(isImageAsset).length,
    documents: project.documents?.length ?? 0,
    notes: project.notes?.length ?? 0
  }
  const common = { project, focus: at.focus, actions }

  return (
    <Dialog title={t('manage.title')} onClose={close} guide="manage">
      <ManageNavContext.Provider value={{ go }}>
        <div className="manage-dialog" ref={root}>
          <div className="manage-tabs" role="tablist">
            {MANAGE_TABS.map((x) => (
              <button
                key={x}
                role="tab"
                aria-selected={at.tab === x}
                className={at.tab === x ? 'on' : ''}
                onClick={() => go(x)}
              >
                <span className="section-icon">{TAB_ICONS[x]}</span>
                {t(`manage.tab.${x}`)} <span className="images-count">{counts[x]}</span>
              </button>
            ))}
          </div>
          <div key={`${at.tab}:${at.visit}`} className="manage-body">
            {at.tab === 'variables' && (
              <VariablesPane {...common} names={variableNames} usages={data.variables} />
            )}
            {at.tab === 'styles' && (
              <StylesPane {...common} names={styleNames} styles={styles} usages={data.styles} />
            )}
            {at.tab === 'templates' && (
              <TemplatesPane {...common} names={templateNames} uses={data.uses} />
            )}
            {at.tab === 'sets' && <SetsPane {...common} uses={data.uses} />}
            {at.tab === 'documents' && <DocumentsPane {...common} uses={data.uses} />}
            {at.tab === 'notes' && <NotesPane {...common} />}
            {at.tab === 'images' && (
              <ImagesPane
                project={project}
                usages={data.images}
                focus={at.focus}
                onMoved={actions.imagesMoved}
              />
            )}
          </div>
          <div className="dialog-buttons">
            <button className="primary" onClick={onClose}>
              {t('dialog.close')}
            </button>
          </div>
        </div>
      </ManageNavContext.Provider>
    </Dialog>
  )
}
