import AiToolsDialog from './components/AiToolsDialog'
import Menu, { type MenuItem } from './components/Menu'
import { useContextMenu } from './components/useContextMenu'
import { findUsages } from '../../shared/model/usages'
import type { UsagesNav } from './components/UsagesSection'
import AgentLockOverlay from './components/AgentLockOverlay'
import HelpDialog from './components/HelpDialog'
import BackupDialog from './components/BackupDialog'
import GenerateDialog from './components/GenerateDialog'
import StatsDialog from './components/StatsDialog'
import SplitImageDialog from './components/SplitImageDialog'
import GoogleSheetsDialog, { type SheetImport } from './components/GoogleSheetsDialog'
import TrashDialog from './components/TrashDialog'
import CompareDialog, { type CompareBase } from './components/CompareDialog'
import { cardFingerprints, changedCards } from '../../shared/model/compare'
import TextCheckDialog from './components/TextCheckDialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  DeletedItem,
  LoadedProject,
  LoadedSet,
  ProjectFile,
  SetDefinition,
  ProjectNote,
  Sheet
} from '../../shared/project'
import { messageFromError, msg, type Message } from '../../shared/messages'
import { bindRow, computedValues, rowToCard, type BoundCard } from '../../shared/model/bind'
import { systemOfSet } from '../../shared/model/system'
import {
  baseOf,
  cardTemplate,
  derivedOf,
  detach,
  newDerived,
  rediffDerived,
  resolveTemplates,
  syncDerived
} from '../../shared/model/inherit'
import type { GroupLayer, Layer, Side, Template } from '../../shared/model/template'
import type { Bounds } from '../../shared/model/edit'
import {
  addColumn,
  booleanColumns,
  duplicateRows,
  insertRow,
  isValidSheetName,
  moveRows,
  newSheet,
  removeRows,
  applyOrder,
  setColumns,
  defaultHiddenColumns,
  viewRows,
  writeCells,
  NO_VIEW,
  type RowView
} from '../../shared/model/sheet'
import {
  renameInDefinitions,
  renameInSheet,
  renameInTemplate,
  type RefKind
} from '../../shared/model/rename'
import { hitTest, toLocal, worldBounds } from '../../shared/model/geometry'
import { arrangeGroup } from '../../shared/model/arrange'
import {
  denormalizeTemplate,
  isValidTemplateName,
  normalizeTemplate,
  walkLayers
} from '../../shared/model/normalize'
import DataTable from './components/DataTable'
import Segmented from './components/Segmented'
import Resizer from './components/Resizer'
import {
  useClosedSections,
  useProjectSections,
  LONG_LIST,
  usePanelCompact,
  usePanelSide,
  usePanelWidth
} from './components/usePanelWidth'
import PanelSideButton from './components/PanelSideButton'
import SidebarSection from './components/SidebarSection'
import { useDragReorder } from './components/useDragReorder'
import {
  alphabetical,
  isAlphabetical,
  moveItem,
  orderNames,
  renameInOrder,
  groupList,
  groupNames,
  groupOf,
  setGroup,
  type GroupKind,
  type ListOrder,
  type OrderKind
} from '../../shared/model/order'
import {
  PanelIcon,
  SetsIcon,
  StylesIcon,
  TemplateIcon,
  VariablesIcon,
  NotesIcon,
  DocumentsIcon
} from './components/icons'
import TemplateEditor, { EDITOR_UNDO } from './editor/TemplateEditor'
import { Dialog, NewTemplateDialog, type NewTemplate } from './editor/dialogs'
import { KIND_CORNER } from '../../shared/model/kinds'
import CardGrid from './components/CardGrid'
import CardForm from './components/CardForm'
import ColumnsMenu from './components/ColumnsMenu'
import { askConfirm, confirmKey, showNotice } from './components/confirm'
import FirstSteps from './components/FirstSteps'
import { kindWords } from './i18n/kinds'
import HelpTip from './components/HelpTip'
import InlineEditor, { type InlineEdit } from './components/InlineEditor'
import ValueInfo from './components/ValueInfo'
import { AddColumnDialog, DuplicateDialog, NewSetDialog } from './components/setDialogs'
import DataCheckDialog from './components/DataCheckDialog'
import ImportSheetDialog from './components/ImportSheetDialog'
import { renameSet } from '../../shared/model/renameSet'
import { sharingSets, syncSharedSheets } from '../../shared/model/sharedSheets'
import { changesData } from '../../shared/model/readOnlyData'
import { renameTemplate } from '../../shared/model/renameTemplate'
import { followInDocuments, type RefSnapshot } from '../../shared/model/docRefs'
import {
  replaceInProject,
  type FindHit,
  type FindPlace,
  type FindScope
} from '../../shared/model/projectFind'
import ProjectFindDialog from './components/ProjectFindDialog'
import CardSvg from './render/CardSvg'
import {
  AssetsContext,
  LocalizationContext,
  ProjectLanguagesContext,
  ProjectColorsContext,
  SaveStyleContext,
  StylesContext,
  VariablesContext,
  onAssetsUpdate,
  useBindContext
} from './render/assets'
import { useProjectFonts, useRegisterFonts } from './render/fonts'
import VariableDialog, { VariableSwatch } from './components/VariableDialog'
import { usedColors, type Variable, type Variables } from '../../shared/model/variables'
import FormatDialog from './components/FormatDialog'
import { isMacPlatform, platformKeys } from '../../shared/keys'
import ExportDialog from './export/ExportDialog'
import ExportToast, { type ExportRun } from './export/ExportToast'
import { runExport, savedOptions } from './export/exportRun'
import LanguagesDialog, { type LanguagesChange } from './components/LanguagesDialog'
import { languageName } from './i18n/languageName'
import { localizationOf, projectLanguages } from '../../shared/model/language'
import ImportTtcDialog from './components/ImportTtcDialog'
import StartScreen from './components/StartScreen'
import { thumbnailTemplate } from '../../shared/model/thumbnail'
import UpdateNotice from './components/UpdateNotice'
import { checkForUpdateNow } from './components/updateCheck'
import type { UpdateChannel } from '../../shared/update'
import Tooltip from './components/Tooltip'
import SidebarPreview from './components/SidebarPreview'
import { useSidebarPreview } from './components/useSidebarPreview'
import NotePanel from './components/NotePanel'
import DocumentView from './components/DocumentView'
import { useDocuments } from './components/useDocuments'
import { BUILTIN_STYLES, parseAttrs, serializeAttrs } from '../../shared/model/markup'
import { LANGUAGES, useI18n, type Language } from './i18n/context'
import { THEMES, applyTheme, loadTheme } from './theme/theme'
import { setLengthUnit, useLengthUnit } from './units'
import { LENGTH_UNITS, toUnit, type LengthUnit } from '../../shared/model/units'
import type { AgentLock, Theme } from '../../shared/api'

const NO_STYLES: Record<string, string> = {}
/** Da quante voci stili e variabili hanno il campo per filtrarle */
const FILTER_FROM = 12
const NO_VARIABLES: Variables = {}
const UI_ZOOM_KEY = 'uiZoom'
const UI_ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6]
const WEBSITE = 'https://github.com/lucadj77/stella'

function loadUiZoom(): number {
  try {
    const z = Number(localStorage.getItem(UI_ZOOM_KEY))
    return UI_ZOOMS.includes(z) ? z : 1
  } catch {
    return 1
  }
}

type View = 'table' | 'grid'
/** Stato dei dati per annulla/ripristina */
/** Stato dei dati per ⌘Z; i template solo quando li ha cambiati una rinomina */
type DataSnapshot = { sets: LoadedSet[]; file: ProjectFile; templates?: Template[] }
const COALESCE_MS = 1200
type Selected =
  | { kind: 'set'; index: number }
  | { kind: 'template'; name: string }
  | { kind: 'document'; name: string }

/** Ridisegna la miniatura per la schermata di ingresso; un errore non disturba il lavoro */
function updateThumbnail(project: LoadedProject, onlyIfMissing: boolean): void {
  const tpl = thumbnailTemplate(project)
  if (!tpl) return
  const context = {
    assets: project.assets,
    fonts: project.fonts,
    styles: project.file.styles ?? {},
    variables: project.file.variables ?? {}
  }
  window.api.saveThumbnail(tpl, context, onlyIfMissing).catch((e) => console.error(e))
}

function App(): React.JSX.Element {
  const { t, lang, setLang } = useI18n()
  // dimensione dell'interfaccia: ingrandisce testi e controlli insieme, come ⌘+ nel browser
  const [uiZoom, setUiZoom] = useState(loadUiZoom)
  useEffect(() => window.api.setUiZoom(uiZoom), [uiZoom])
  const changeUiZoom = (z: number): void => {
    setUiZoom(z)
    try {
      localStorage.setItem(UI_ZOOM_KEY, String(z))
    } catch {
      // preferenza non essenziale
    }
  }
  // canale degli aggiornamenti; nel browser dice quale versione web è aperta
  const [channel, setChannel] = useState<UpdateChannel | null>(null)
  useEffect(() => {
    window.api.updateChannel().then(setChannel, () => {})
  }, [])
  const changeChannel = (c: UpdateChannel): void => {
    if (window.api.isWeb) {
      // la stabile sta in app/, la beta in beta/, accanto al sito di presentazione
      const here = location.pathname.replace(/[^/]*$/, '').replace(/(app|beta)\/$/, '')
      location.href = `${here}${c === 'beta' ? 'beta' : 'app'}/`
      return
    }
    setChannel(c)
    window.api.setUpdateChannel(c).then(checkForUpdateNow, () => {})
  }
  const [theme, setTheme] = useState(loadTheme)
  const lengthUnit = useLengthUnit()
  const changeTheme = (th: Theme): void => {
    setTheme(th)
    applyTheme(th)
  }
  const [error, setError] = useState<Message | null>(null)
  const [project, setProjectState] = useState<LoadedProject | null>(null)
  // i set che condividono un foglio ricevono ognuno le modifiche ai dati fatte dagli altri;
  // con il file dati in sola lettura una modifica ai dati non passa
  const setProject = useCallback(
    (u: React.SetStateAction<LoadedProject | null>): void =>
      setProjectState((prev) => {
        const next = typeof u === 'function' ? u(prev) : u
        if (!prev || !next || next.sets === prev.sets) return next
        if (next.folder === prev.folder && next.file.dataReadOnly && changesData(prev, next)) {
          queueMicrotask(() => setError(msg('data.readOnly')))
          return prev
        }
        const sets = syncSharedSheets(prev.sets, next.sets)
        return sets === next.sets ? next : { ...next, sets }
      }),
    []
  )
  useRegisterFonts(project?.fonts)
  // la versione installata resta visibile nel titolo della finestra
  const projectName = project?.file.name
  useEffect(() => {
    document.title = [projectName, `Stella Game Center ${__APP_VERSION__}`]
      .filter(Boolean)
      .join(' — ')
  }, [projectName])
  // icone e font importati: gli asset cambiano senza ricaricare il progetto
  useEffect(() => onAssetsUpdate((u) => setProject((p) => p && { ...p, ...u })), [setProject])
  const [selected, setSelected] = useState<Selected>({ kind: 'set', index: 0 })
  /**
   * Carta da mostrare nell'editor quando lo si apre da "Modifica template" di un set. Vale solo
   * per quella scelta (`for`): riaprendo il template in un altro modo l'editor parte senza dati.
   */
  const [editPreview, setEditPreview] = useState<{
    for: Selected
    set: string
    row: number
  } | null>(null)
  /** Nota aperta nel pannello accanto alla schermata */
  const [openNote, setOpenNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  /** Template modificati e non ancora salvati */
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  /** Stile aperto nell'editor: '' per uno nuovo */
  const [editingStyle, setEditingStyle] = useState<string | null>(null)
  // cambia quando una rinomina riscrive i template: l'editor aperto riparte dal template nuovo
  const [editorRev, setEditorRev] = useState(0)
  /** Variabile aperta nell'editor: '' per una nuova */
  const [editingVariable, setEditingVariable] = useState<string | null>(null)
  const [creatingSet, setCreatingSet] = useState(false)
  /** La finestra Esporta aperta, con il profilo da caricare ('' per le ultime opzioni) */
  const [exporting, setExportingState] = useState<string | null>(null)
  const setExporting = (open: boolean, profile = ''): void =>
    setExportingState(open ? profile : null)
  /** «Ripeti l'ultima esportazione» in corso o appena finita, senza la finestra */
  const [exportRun, setExportRun] = useState<ExportRun | null>(null)
  const { has: hasFont } = useProjectFonts()
  /** Progetto in cui si è aperta l'esportazione: l'ultimo dei primi passi */
  const [exportedIn, setExportedIn] = useState<string | null>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [sheetsOpen, setSheetsOpen] = useState(false)
  const [languagesOpen, setLanguagesOpen] = useState(false)
  /** Lingua in cui si mostrano le carte, per il progetto aperto; null è la principale */
  const [shownLanguage, setShownLanguage] = useState<{ folder: string; language: string } | null>(
    null
  )
  /** Confronto con un backup o con l'ultima esportazione: le carte cambiate da allora */
  const [comparing, setComparing] = useState(false)
  const [compareBase, setCompareBase] = useState<CompareBase | null>(null)
  /** Elementi ripristinati dal cestino: escono da deleted/ quando il progetto si salva */
  const [restored, setRestored] = useState<
    { file: string; kind: 'template' | 'set'; name: string }[]
  >([])
  const [aiTools, setAiTools] = useState(false)
  /** Cerca e sostituisci in tutto il progetto */
  const [findingAll, setFindingAll] = useState(false)
  const [help, setHelp] = useState(false)
  const contextMenu = useContextMenu()
  // F1 apre l'aiuto da qualsiasi schermata
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'F1') return
      e.preventDefault()
      setHelp(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const [importing, setImporting] = useState(false)
  const [duplicating, setDuplicating] = useState<Selected | null>(null)
  /** Set di cui si sta cambiando il nome */
  const [renamingSet, setRenamingSet] = useState<number | null>(null)
  /** Template di cui si sta cambiando il nome */
  const [renamingTemplate, setRenamingTemplate] = useState<string | null>(null)
  /** Template da cui si sta creando un derivato */
  const [deriving, setDeriving] = useState<string | null>(null)
  /** Fogli modificati e non ancora salvati, per nome del foglio */
  const [dirtySheets, setDirtySheets] = useState<Set<string>>(new Set())
  /**
   * Fogli sul disco dei set eliminati e non ancora salvati: al salvataggio vanno in deleted/ anche
   * se nel frattempo un set nuovo ha preso lo stesso nome (il foglio nuovo si scrive da capo)
   */
  const [trashedSheets, setTrashedSheets] = useState<Set<string>>(new Set())
  /** file di progetto da riscrivere (set nuovi) */
  const [fileDirty, setFileDirty] = useState(false)
  /** Il file dati è cambiato fuori da Stella e non si è ancora riletto */
  const [dataChanged, setDataChanged] = useState(false)
  /** Finestra Controlla file dati aperta */
  const [checkingData, setCheckingData] = useState(false)
  /** Finestra per importare un foglio da un altro file aperta */
  const [importingSheet, setImportingSheet] = useState(false)
  const [history, setHistory] = useState<{
    past: DataSnapshot[]
    future: DataSnapshot[]
    key?: string
    at: number
  }>({ past: [], future: [], at: 0 })
  const [saving, setSaving] = useState(false)
  const readOnlyData = !!project?.file.dataReadOnly
  // in sola lettura i fogli non si salvano: una modifica rifiutata non chiede di salvare
  const anyDirty = dirty.size > 0 || (dirtySheets.size > 0 && !readOnlyData) || fileDirty
  /** Vero, con un avviso, se il file dati è in sola lettura e quindi l'azione non si fa */
  const dataLocked = (): boolean => {
    if (!project?.file.dataReadOnly) return false
    setError(msg('data.readOnly'))
    return true
  }
  const [sidebarWidth, setSidebarWidth] = usePanelWidth('sidebar.v2', 260)
  const [sidebarSide, toggleSidebarSide] = usePanelSide('sidebar', 'left')
  const [sidebarCompact, setSidebarCompact] = usePanelCompact('sidebar')
  const [closedSections, setSectionClosed] = useClosedSections('sidebar')
  // stili e variabili: aperti o chiusi per progetto, chiusi da soli se l'elenco è lungo
  const [projectSectionOpen, setProjectSectionOpen] = useProjectSections(project?.folder ?? null)
  /** Testo per filtrare stili e variabili nella barra laterale */
  const [listFilter, setListFilter] = useState<Partial<Record<GroupKind, string>>>({})
  /** Titolo del gruppo su cui si sta trascinando una voce */
  const [groupDrop, setGroupDrop] = useState<string | null>(null)
  const sidebarPreview = useSidebarPreview()

  const load = useCallback(async (folder: string) => {
    setLoading(true)
    setError(null)
    try {
      const loaded = await window.api.loadProject(folder)
      // un progetto letto dal disco sostituisce tutto: niente controlli sui dati
      setProjectState(loaded)
      setDataChanged(false)
      setDirty(new Set())
      setDirtySheets(new Set())
      setTrashedSheets(new Set())
      setRestored([])
      setCompareBase(null)
      setFileDirty(false)
      setHistory({ past: [], future: [], at: 0 })
      // l'editor del template aperto riparte dal disco (Ricarica, o un agente che ha finito)
      setEditorRev((r) => r + 1)
      setSelected((s) =>
        s.kind === 'set'
          ? { kind: 'set', index: s.index < loaded.sets.length ? s.index : 0 }
          : (s.kind === 'template' ? loaded.templates : (loaded.documents ?? [])).some(
                (x) => x.name === s.name
              )
            ? s
            : { kind: 'set', index: 0 }
      )
      updateThumbnail(loaded, true)
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  /** Rilegge solo i dati, quando il file dati è cambiato fuori da Stella; i template restano */
  const reloadData = useCallback(async () => {
    try {
      const loaded = await window.api.reloadData()
      setDataChanged(false)
      setError(null)
      setProjectState((p) =>
        p?.folder !== loaded.folder
          ? p
          : {
              ...p,
              sets: p.sets.map((s) => ({
                ...s,
                data: loaded.sets.find((x) => x.name === s.name)?.data ?? null
              })),
              unusedSheets: loaded.unusedSheets,
              unusedData: loaded.unusedData,
              diskSheets: loaded.diskSheets,
              dataFileLosses: loaded.dataFileLosses
            }
      )
      // i passi da annullare hanno i dati di prima
      setHistory({ past: [], future: [], at: 0 })
      setDirtySheets(new Set())
    } catch (e) {
      setError(messageFromError(e))
    }
  }, [])
  // senza modifiche ai dati da salvare si rilegge subito; altrimenti si chiede (banner)
  const canReloadData =
    !fileDirty && trashedSheets.size === 0 && (dirtySheets.size === 0 || readOnlyData)
  const canReloadRef = useRef(canReloadData)
  useEffect(() => {
    canReloadRef.current = canReloadData
  }, [canReloadData])
  useEffect(
    () =>
      window.api.onDataFileChanged(() =>
        canReloadRef.current ? void reloadData() : setDataChanged(true)
      ),
    [reloadData]
  )

  /** Sola lettura del file dati: si attiva solo senza modifiche ai dati da salvare */
  const setDataReadOnly = (on: boolean): void => {
    if (!project) return
    if (on && (dirtySheets.size > 0 || trashedSheets.size > 0)) {
      setError(msg('data.saveFirst'))
      return
    }
    const file: ProjectFile = { ...project.file, dataReadOnly: true }
    if (!on) delete file.dataReadOnly
    setProject({ ...project, file })
    setFileDirty(true)
  }

  // Un'IA che lavora con il comando stella (vedi docs/cli.md): `stella begin` legge da qui se ci sono
  // modifiche non salvate; mentre lavora l'app è bloccata, quando finisce si ricarica il progetto
  const [agentLock, setAgentLock] = useState<{ folder: string; lock: AgentLock } | null>(null)
  const folder = project?.folder ?? null
  // un altro progetto si apre nella sua lingua principale
  const cardLanguage = shownLanguage?.folder === folder ? shownLanguage.language : null
  const setCardLanguage = (language: string | null): void =>
    setShownLanguage(language && folder ? { folder, language } : null)
  const languages = project ? projectLanguages(project.file) : []
  const localization = useMemo(
    () => (project ? localizationOf(project.file, project.sets, cardLanguage) : undefined),
    [project, cardLanguage]
  )

  /** Lingue del progetto, nomi tradotti e colonne da tradurre: ⌘Z annulla */
  const saveLanguages = (c: LanguagesChange): void => {
    if (!project) return
    /** Toglie i nomi vuoti: un oggetto senza nomi non resta nel file */
    const withNames = <T extends { names?: Record<string, string> }>(
      o: T,
      names: Record<string, string> | undefined
    ): T => {
      const next = { ...o, names }
      if (!names || !Object.keys(names).length) delete next.names
      return next
    }
    const file: ProjectFile = withNames({ ...project.file, languages: c.languages }, c.names)
    if (!c.languages.length) delete file.languages
    file.sets = file.sets.map((s, i) => withNames(s, c.setNames[i]))
    // le colonne vanno nel foglio: due set con lo stesso foglio le ricevono una volta sola
    const bySheet = new Map<string, string[]>()
    project.sets.forEach((s, i) => {
      const key = s.sheet ?? s.name
      bySheet.set(key, [...new Set([...(bySheet.get(key) ?? []), ...(c.columns[i] ?? [])])])
    })
    const changedSheets: string[] = []
    const sets = project.sets.map((s, i) => {
      const cols = bySheet.get(s.sheet ?? s.name) ?? []
      let data = s.data
      if (data && cols.length && !project.file.dataReadOnly) {
        for (const h of cols) data = addColumn(data, h)
        changedSheets.push(data.name)
      }
      return withNames({ ...s, data }, c.setNames[i])
    })
    setHistory((h) => ({
      past: [...h.past.slice(-99), { sets: project.sets, file: project.file }],
      future: [],
      at: 0
    }))
    setProject({ ...project, file, sets })
    setFileDirty(true)
    if (changedSheets.length) setDirtySheets((d) => new Set([...d, ...changedSheets]))
    if (cardLanguage && !c.languages.slice(1).includes(cardLanguage)) setCardLanguage(null)
    setLanguagesOpen(false)
  }
  useEffect(() => {
    window.api.setAppState(folder, anyDirty).catch((e) => console.error(e))
  }, [folder, anyDirty])
  useEffect(() => {
    if (!folder) return
    let working = false
    return window.api.onAgentLock((lock) => {
      setAgentLock(lock && { folder, lock })
      if (working && !lock) load(folder)
      working = !!lock
    })
  }, [folder, load])

  const openExport = (profile = ''): void => {
    if (exportRun?.progress) return
    setExporting(true, profile)
    if (project) setExportedIn(project.folder)
  }

  /** Esporta di nuovo con le opzioni dell'ultima esportazione, senza aprire la finestra */
  const repeatExport = async (): Promise<void> => {
    const last = project?.file.export?.last
    if (!project || exporting !== null || exportRun?.progress) return
    if (!last) return openExport()
    const what = savedOptions(last.kind, project.file.export)
    const languages = projectLanguages(project.file)
    setExportRun({ what, progress: { done: 0, total: 0 } })
    const off = window.api.onExportProgress((progress) =>
      setExportRun((r) => (r?.progress ? { ...r, progress } : r))
    )
    try {
      const result = await runExport(project, what, last.language ?? languages[0] ?? '', hasFont)
      setExportRun({ what, result })
    } catch (e) {
      setExportRun({ what, error: messageFromError(e) })
    } finally {
      off()
    }
  }

  /** Chiede conferma prima di perdere modifiche non salvate */
  const discardOk = async (): Promise<boolean> =>
    !anyDirty || confirmKey(t, 'app.discardChanges', undefined, { danger: true })

  const open = async (): Promise<void> => {
    const folder = await window.api.chooseProjectFolder()
    if (folder) load(folder)
  }

  /** Copia o sposta la cartella del progetto: prima si salva, così la copia è completa */
  const relocate = async (mode: 'copy' | 'move'): Promise<void> => {
    if (!project) return
    if (anyDirty) {
      await showNotice(t, t('relocate.saveFirst'))
      return
    }
    try {
      const to = await window.api.relocateProject(mode, {
        title: t(mode === 'copy' ? 'relocate.copyTitle' : 'relocate.moveTitle'),
        button: t(mode === 'copy' ? 'relocate.copyButton' : 'relocate.moveButton'),
        copy: t('relocate.copySuffix')
      })
      if (!to) return
      if (mode === 'move') {
        await load(to)
        return
      }
      const open = await askConfirm({
        title: t('relocate.copied'),
        message: to,
        ok: t('relocate.openCopy'),
        cancel: t('relocate.stay')
      })
      if (open) await load(to)
    } catch (e) {
      setError(messageFromError(e))
    }
  }

  /** Torna alla schermata di ingresso */
  const closeProject = async (): Promise<void> => {
    if (!(await discardOk())) return
    setProject(null)
    setError(null)
    setSelected({ kind: 'set', index: 0 })
  }

  const updateTemplate = useCallback(
    (tpl: Template) => {
      setProject((p) => {
        if (!p) return p
        // i derivati seguono subito il base; quelli che cambiano per una rinomina vanno salvati
        const synced = syncDerived(
          p.templates,
          p.templates.map((x) => (x.name === tpl.name ? tpl : x))
        )
        if (synced.changed.length) setDirty((d) => new Set([...d, ...synced.changed]))
        return { ...p, templates: synced.templates }
      })
      setDirty((d) => (d.has(tpl.name) ? d : new Set(d).add(tpl.name)))
    },
    [setProject]
  )

  /** Nuovo template derivato: uguale al base finché non lo si modifica */
  const deriveTemplate = (from: string, name: string): void => {
    const base = project?.templates.find((x) => x.name === from)
    if (!base) return
    const tpl = newDerived(base, name)
    setProject((p) => p && { ...p, templates: [...p.templates, tpl] })
    setDirty((d) => new Set(d).add(name))
    setSelected({ kind: 'template', name })
  }

  /** Cronologia dell'editor aperto, per i pulsanti annulla e ripeti della barra */
  const [editorHistory, setEditorHistory] = useState({ undo: false, redo: false })
  const undoAny = (redo: boolean): void => {
    if (selected.kind === 'template')
      window.dispatchEvent(new CustomEvent(EDITOR_UNDO, { detail: { redo } }))
    else undoData(redo)
  }

  /** Il derivato diventa un template normale, con i valori che ha ora */
  const detachTemplate = async (name: string): Promise<void> => {
    const tpl = project?.templates.find((x) => x.name === name)
    if (!tpl?.extends) return
    if (!(await confirmKey(t, 'inherit.detachConfirm', { name, base: tpl.extends }))) return
    setProject(
      (p) => p && { ...p, templates: p.templates.map((x) => (x.name === name ? detach(x) : x)) }
    )
    setDirty((d) => new Set(d).add(name))
    setEditorRev((r) => r + 1)
  }

  /** Modifica del foglio di un set; le modifiche ravvicinate con la stessa chiave si annullano insieme */
  const updateSheet = (index: number, sheet: Sheet, key?: string): void => {
    if (!project || dataLocked()) return
    const now = Date.now()
    const coalesce = key !== undefined && key === history.key && now - history.at < COALESCE_MS
    setHistory((h) => ({
      past: coalesce ? h.past : [...h.past.slice(-99), { sets: project.sets, file: project.file }],
      future: [],
      key,
      at: now
    }))
    // aggiornamento funzionale: nello stesso evento può cambiare anche altro (per esempio uno stile)
    setProject(
      (p) => p && { ...p, sets: p.sets.map((x, i) => (i === index ? { ...x, data: sheet } : x)) }
    )
    setDirtySheets((d) => (d.has(sheet.name) ? d : new Set(d).add(sheet.name)))
  }

  /** Assegna al set un altro template; i dati non cambiano e ⌘Z annulla */
  const setTemplate = (index: number, template: string): void => {
    if (!project || project.sets[index]?.template === template) return
    setHistory((h) => ({
      past: [...h.past.slice(-99), { sets: project.sets, file: project.file }],
      future: [],
      at: 0
    }))
    setProject({
      ...project,
      sets: project.sets.map((x, i) => (i === index ? { ...x, template } : x)),
      file: {
        ...project.file,
        sets: project.file.sets.map((x, i) => (i === index ? { ...x, template } : x))
      }
    })
    setFileDirty(true)
  }

  /** Colonne mostrate nel set: è una preferenza, salvata nel progetto ma fuori dall'annulla */
  const setColumnsView = (
    index: number,
    view: Pick<SetDefinition, 'hiddenColumns' | 'showComputed' | 'pinnedProperties'>
  ): void => {
    if (!project) return
    const patch = <T extends SetDefinition>(x: T): T => {
      const next = { ...x, ...view }
      if (!next.hiddenColumns?.length) delete next.hiddenColumns
      if (!next.showComputed) delete next.showComputed
      if (!next.pinnedProperties?.length) delete next.pinnedProperties
      return next
    }
    setProject({
      ...project,
      sets: project.sets.map((x, i) => (i === index ? patch(x) : x)),
      file: { ...project.file, sets: project.file.sets.map((x, i) => (i === index ? patch(x) : x)) }
    })
    setFileDirty(true)
  }

  /** Sposta un set nella barra laterale; il set aperto resta aperto. ⌘Z annulla */
  const reorderSets = (order: number[]): void => {
    if (!project || order.every((x, i) => x === i)) return
    setHistory((h) => ({
      past: [...h.past.slice(-99), { sets: project.sets, file: project.file }],
      future: [],
      at: 0
    }))
    setProject({
      ...project,
      sets: order.map((i) => project.sets[i]),
      file: { ...project.file, sets: order.map((i) => project.file.sets[i]) }
    })
    setFileDirty(true)
    if (selected.kind === 'set') setSelected({ kind: 'set', index: order.indexOf(selected.index) })
  }
  const moveSet = (from: number, to: number): void =>
    reorderSets(moveItem(project?.sets.map((_, i) => i) ?? [], from, to))
  const sortSetsAlpha = (): void => {
    if (!project) return
    const idx = project.sets.map((_, i) => i)
    reorderSets(idx.sort((a, b) => alphabetical(project.sets[a].name, project.sets[b].name)))
  }

  /** Ordine scelto a mano di template, stili o variabili; `null` torna all'ordine alfabetico */
  const setListOrder = (kind: OrderKind, names: string[] | null): void =>
    changeOrder((o) => {
      const order = { ...o }
      if (names) order[kind] = names
      else delete order[kind]
      return order
    })

  /**
   * Sposta una voce di stili o variabili trascinandola: nell'elenco da `from` a `to` e nel gruppo
   * `group`, o in quello della voce `target` su cui è stata lasciata
   */
  const dropInGroups = (
    kind: GroupKind,
    names: string[],
    from: number,
    to: number,
    target: { item: number } | { group: string }
  ): void => {
    const current = project?.file.order
    const group = 'group' in target ? target.group : groupOf(current, kind, names[target.item])
    if (from === to && groupOf(current, kind, names[from]) === group) return
    changeOrder((o) =>
      setGroup({ ...o, [kind]: moveItem(names, from, to) }, kind, names[from], group)
    )
  }

  const changeOrder = (change: (order: ListOrder) => ListOrder | undefined): void => {
    if (!project) return
    const order = change({ ...project.file.order }) ?? {}
    setHistory((h) => ({
      past: [...h.past.slice(-99), { sets: project.sets, file: project.file }],
      future: [],
      at: 0
    }))
    setProject({
      ...project,
      file: { ...project.file, order: Object.keys(order).length ? order : undefined }
    })
    setFileDirty(true)
  }

  const undoData = (redo: boolean): void => {
    if (!project) return
    const from = redo ? history.future : history.past
    const snap = from[from.length - 1]
    if (!snap) return
    const current: DataSnapshot = {
      sets: project.sets,
      file: project.file,
      templates: snap.templates && project.templates
    }
    setHistory((h) =>
      redo
        ? { past: [...h.past, current], future: h.future.slice(0, -1), at: 0 }
        : { past: h.past.slice(0, -1), future: [...h.future, current], at: 0 }
    )
    // un set eliminato che torna riprende il suo foglio, che non è più tra quelli non collegati
    const linked = new Set(snap.sets.flatMap((x) => (x.data ? [x.data.name] : [])))
    // un set eliminato che torna non deve più perdere il suo foglio sul disco
    setTrashedSheets((t) => {
      const next = new Set(t)
      for (const x of snap.sets) if (x.data) next.delete(x.data.origin ?? x.data.name)
      return next
    })
    setProject({
      ...project,
      ...snap,
      templates: snap.templates ?? project.templates,
      unusedSheets: project.unusedSheets.filter((x) => !linked.has(x)),
      unusedData: project.unusedData?.filter((x) => !linked.has(x.name))
    })
    // ciò che cambia tornando indietro va comunque salvato
    setDirtySheets((d) => {
      const next = new Set(d)
      for (const x of [...snap.sets, ...project.sets]) {
        const before = project.sets.find((y) => y.name === x.name)?.data
        const after = snap.sets.find((y) => y.name === x.name)?.data
        if (x.data && before !== after) next.add(x.data.name)
      }
      return next
    })
    if (snap.file !== project.file) setFileDirty(true)
    if (snap.templates)
      markRenamed(project, { ...project, templates: snap.templates, sets: snap.sets })
  }

  /** Dopo una rinomina: template e fogli cambiati vanno salvati, l'editor riparte dal template nuovo */
  const markRenamed = (before: LoadedProject, after: LoadedProject): void => {
    const tpls = after.templates.filter((t, i) => t !== before.templates[i]).map((t) => t.name)
    const sheets = after.sets.flatMap((x, i) =>
      x.data && x.data !== before.sets[i].data ? [x.data.name] : []
    )
    if (tpls.length) {
      setDirty((d) => new Set([...d, ...tpls]))
      setEditorRev((r) => r + 1)
    }
    if (sheets.length) setDirtySheets((d) => new Set([...d, ...sheets]))
  }

  /** Crea, modifica, rinomina (con `oldName`) o elimina (def null) uno stile del progetto */
  const saveStyle = useCallback(
    (name: string, def: string | null, oldName?: string, group?: string): void => {
      setProject((p) => {
        if (!p) return p
        const renaming = !!oldName && oldName !== name && def !== null
        const base = renaming ? renameReferences(p, 'style', oldName, name) : p
        const styles = { ...base.file.styles }
        if (renaming) delete styles[oldName]
        if (def === null) delete styles[name]
        else styles[name] = def
        setHistory((h) => ({
          past: [
            ...h.past.slice(-99),
            { sets: p.sets, file: p.file, templates: renaming ? p.templates : undefined }
          ],
          future: [],
          at: 0
        }))
        if (renaming) markRenamed(p, base)
        let order = renaming
          ? renameInOrder(base.file.order, 'styles', oldName, name)
          : base.file.order
        if (def === null) order = setGroup(order, 'styles', name, '')
        else if (group !== undefined) order = setGroup(order, 'styles', name, group)
        return { ...base, file: { ...base.file, styles, order } }
      })
      setFileDirty(true)
    },
    [setProject]
  )

  // Note del progetto: si scrivono subito su disco, poco dopo l'ultima modifica, senza passare dal
  // salvataggio del progetto né dall'annulla
  const noteTimers = useRef(new Map<string, { timer: number; text: string }>())
  const writeNote = (name: string, text: string, oldName?: string): Promise<void> =>
    window.api.saveNote(name, text, oldName).catch((e) => setError(messageFromError(e)))
  const flushNote = (name: string): void => {
    const pending = noteTimers.current.get(name)
    if (!pending) return
    window.clearTimeout(pending.timer)
    noteTimers.current.delete(name)
    void writeNote(name, pending.text)
  }
  const setNotes = (change: (notes: ProjectNote[]) => ProjectNote[]): void =>
    setProject((p) => p && { ...p, notes: change(p.notes ?? []) })
  const changeNote = (name: string, text: string): void => {
    setNotes((notes) => notes.map((n) => (n.name === name ? { ...n, text } : n)))
    const old = noteTimers.current.get(name)
    if (old) window.clearTimeout(old.timer)
    noteTimers.current.set(name, { text, timer: window.setTimeout(() => flushNote(name), 600) })
  }
  const newNote = async (): Promise<void> => {
    const names = new Set((project?.notes ?? []).map((n) => n.name))
    const base = t('notes.newName')
    let name = base
    for (let i = 2; names.has(name); i++) name = `${base} ${i}`
    await writeNote(name, '')
    setNotes((notes) => [...notes, { name, text: '' }].sort((a, b) => a.name.localeCompare(b.name)))
    setOpenNote(name)
  }
  const renameNote = async (from: string, to: string): Promise<void> => {
    const pending = noteTimers.current.get(from)
    if (pending) window.clearTimeout(pending.timer)
    noteTimers.current.delete(from)
    const text = pending?.text ?? project?.notes?.find((n) => n.name === from)?.text ?? ''
    try {
      await window.api.saveNote(to, text, from)
    } catch (e) {
      setError(messageFromError(e))
      return
    }
    setNotes((notes) =>
      notes
        .map((n) => (n.name === from ? { name: to, text } : n))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
    setOpenNote(to)
  }
  const deleteNote = async (name: string): Promise<void> => {
    const pending = noteTimers.current.get(name)
    if (pending) window.clearTimeout(pending.timer)
    noteTimers.current.delete(name)
    await window.api.deleteNote(name).catch((e) => setError(messageFromError(e)))
    setNotes((notes) => notes.filter((n) => n.name !== name))
    setOpenNote((o) => (o === name ? null : o))
  }
  const closeNote = (): void => {
    if (openNote) flushNote(openNote)
    setOpenNote(null)
  }

  const documents = useDocuments(project, setProject, setError)
  const openDocument = selected.kind === 'document' ? selected.name : null
  // i documenti seguono le rinomine (set, colonne, valori delle carte, livelli, variabili,
  // stili), da qualunque parte arrivino: modifica, annulla, file ricaricato
  const [refsNotice, setRefsNotice] = useState<string | null>(null)
  const refsBefore = useRef<{ folder: string; snap: RefSnapshot } | null>(null)
  useEffect(() => {
    if (!project) {
      refsBefore.current = null
      return
    }
    const snap: RefSnapshot = {
      sets: project.sets,
      templates: project.templates,
      variables: project.file.variables,
      styles: project.file.styles
    }
    const prev = refsBefore.current
    refsBefore.current = { folder: project.folder, snap }
    if (!prev || prev.folder !== project.folder) return
    const { changed, count } = followInDocuments(project.documents ?? [], prev.snap, snap)
    if (!changed.length) return
    for (const d of changed) documents.change(d.name, d.text)
    setRefsNotice(t('doc.refsUpdated', { n: count, docs: changed.map((d) => d.name).join(', ') }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project?.folder,
    project?.sets,
    project?.templates,
    project?.file.variables,
    project?.file.styles
  ])
  /**
   * Sostituisce nei punti scelti del cerca nel progetto, dopo un backup con un nome che lo dice.
   * Documenti e note si scrivono subito; dati, template e variabili si salvano e si annullano
   * come le altre modifiche.
   */
  const replaceAcrossProject = async (
    hits: FindHit[],
    query: string,
    replacement: string
  ): Promise<number> => {
    if (!project) return 0
    // il backup deve avere i documenti e le note come sono adesso
    for (const d of project.documents ?? []) documents.flush(d.name)
    for (const n of project.notes ?? []) flushNote(n.name)
    await window.api.createBackup(t('findAll.backupLabel', { query }))
    const r = replaceInProject(findScope(project), hits, replacement)
    for (const d of r.documents) documents.change(d.name, d.text)
    for (const n of r.notes) changeNote(n.name, n.text)
    const variablesChanged = r.variables !== (project.file.variables ?? {})
    if (r.sets === project.sets && r.templates === project.templates && !variablesChanged)
      return r.count
    const synced = syncDerived(project.templates, r.templates)
    setHistory((h) => ({
      past: [
        ...h.past.slice(-99),
        {
          sets: project.sets,
          file: project.file,
          templates: r.templates !== project.templates ? project.templates : undefined
        }
      ],
      future: [],
      at: 0
    }))
    setProject(
      (p) =>
        p && {
          ...p,
          sets: r.sets,
          templates: synced.templates,
          file: variablesChanged ? { ...p.file, variables: r.variables } : p.file
        }
    )
    const sheets = r.sets.flatMap((x, i) =>
      x.data && x.data !== project.sets[i].data ? [x.data.name] : []
    )
    if (sheets.length) setDirtySheets((d) => new Set([...d, ...sheets]))
    const templates = r.templates
      .filter((x, i) => x !== project.templates[i])
      .map((x) => x.name)
      .concat(synced.changed)
    if (templates.length) {
      setDirty((d) => new Set([...d, ...templates]))
      setEditorRev((v) => v + 1)
    }
    if (variablesChanged) setFileDirty(true)
    return r.count
  }
  /** Apre il punto di un risultato del cerca nel progetto */
  const openFound = (place: FindPlace): void => {
    setFindingAll(false)
    if (place.kind === 'document') setSelected({ kind: 'document', name: place.name })
    else if (place.kind === 'note') setOpenNote(place.name)
    else if (place.kind === 'cell') setSelected({ kind: 'set', index: place.set })
    else if (place.kind === 'layer') setSelected({ kind: 'template', name: place.template })
    else setEditingVariable(place.name)
  }
  useEffect(() => {
    if (!refsNotice) return undefined
    const timer = window.setTimeout(() => setRefsNotice(null), 8000)
    return () => window.clearTimeout(timer)
  }, [refsNotice])
  // lasciando un documento le modifiche in attesa si scrivono subito
  useEffect(() => {
    if (!openDocument) return undefined
    return () => documents.flush(openDocument)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocument])
  const newDocument = async (): Promise<void> => {
    const name = await documents.create(t('documents.newName'))
    if (name) setSelected({ kind: 'document', name })
  }
  const deleteDocument = async (name: string): Promise<void> => {
    if (!(await confirmKey(t, 'documents.deleteConfirm', { name }, { danger: true }))) return
    await documents.remove(name)
    if (openDocument === name) setSelected({ kind: 'set', index: 0 })
  }
  /** Una copia del documento con un nome libero (Regolamento 2), che si apre */
  const duplicateDocument = async (name: string): Promise<void> => {
    const text = project?.documents?.find((d) => d.name === name)?.text ?? ''
    const copy = await documents.restore(name, text).catch((e) => {
      setError(messageFromError(e))
      return null
    })
    if (copy) setSelected({ kind: 'document', name: copy })
  }
  const documentMenu = (name: string): MenuItem[] => [
    {
      label: t('sidebar.duplicate'),
      title: t('documents.duplicateHint'),
      onClick: () => void duplicateDocument(name)
    },
    'sep',
    {
      label: t('documents.deleteShort'),
      title: t('documents.delete'),
      danger: true,
      onClick: () => void deleteDocument(name)
    }
  ]

  /** Crea, modifica, rinomina (con `oldName`) o elimina (v null) una variabile del progetto */
  const saveVariable = (
    name: string,
    v: Variable | null,
    oldName?: string,
    group?: string
  ): void => {
    setProject((p) => {
      if (!p) return p
      const renaming = !!oldName && oldName !== name && v !== null
      const base = renaming ? renameReferences(p, 'variable', oldName, name) : p
      const variables = { ...base.file.variables }
      if (renaming) delete variables[oldName]
      if (v === null) delete variables[name]
      else variables[name] = v
      setHistory((h) => ({
        past: [
          ...h.past.slice(-99),
          { sets: p.sets, file: p.file, templates: renaming ? p.templates : undefined }
        ],
        future: [],
        at: 0
      }))
      if (renaming) markRenamed(p, base)
      let order = renaming
        ? renameInOrder(base.file.order, 'variables', oldName, name)
        : base.file.order
      if (v === null) order = setGroup(order, 'variables', name, '')
      else if (group !== undefined) order = setGroup(order, 'variables', name, group)
      return { ...base, file: { ...base.file, variables, order } }
    })
    setFileDirty(true)
  }

  const saveAll = async (): Promise<void> => {
    if (!project || saving) return
    // un foglio condiviso da più set si scrive una volta; in sola lettura nessuno
    const sheets = readOnlyData
      ? []
      : [
          ...new Map(
            project.sets
              .map((x) => x.data)
              .filter((d): d is Sheet => !!d && dirtySheets.has(d.name))
              .map((d) => [d.name, d])
          ).values()
        ]
    // fogli sul disco che nessun set usa più (set eliminati): escono dal file dati
    const used = new Set([
      ...project.sets.flatMap((x) => (x.data ? [x.data.name, x.data.origin ?? ''] : [])),
      ...project.unusedSheets
    ])
    const removed = readOnlyData
      ? []
      : (project.diskSheets ?? []).filter((x) => !used.has(x) || trashedSheets.has(x))
    // grafici e simili che il salvataggio toglierebbe dal file dati: Stella li tiene quando cambia
    // solo celle, li perde quando deve riscrivere il file (fogli nuovi, rinominati o tolti)
    const losses = project.dataFileLosses ?? []
    const lossConfirm = (): Promise<boolean> =>
      confirmKey(
        t,
        'save.dataLossConfirm',
        { what: losses.map((x) => t(`dataLoss.${x}`)).join(', ') },
        { danger: true }
      )
    const restructure =
      removed.length > 0 ||
      sheets.some((x) => x.origin || !(project.diskSheets ?? []).includes(x.name))
    if (restructure && losses.length && !(await lossConfirm())) return
    setError(null)
    setSaving(true)
    try {
      const savedTemplates: Template[] = []
      for (const name of dirty) {
        const tpl = project.templates.find((x) => x.name === name)
        if (!tpl) continue
        await window.api.saveTemplate(tpl)
        savedTemplates.push(tpl)
      }
      setDirty(new Set())
      // i template rinominati ora hanno sul disco il file nuovo
      if (savedTemplates.some((x) => x.origin))
        setProject(
          (p) =>
            p && {
              ...p,
              templates: p.templates.map((x) => {
                if (!x.origin || !savedTemplates.includes(x)) return x
                const tpl = { ...x }
                delete tpl.origin
                return tpl
              })
            }
        )
      let rewritten = false
      if (sheets.length || fileDirty || removed.length) {
        const changes = { file: fileDirty ? project.file : undefined, sheets, removed }
        try {
          // senza conferma il file non si riscrive tutto, se perderebbe qualcosa
          ;({ rewritten } = await window.api.saveData({ ...changes, keepParts: !restructure }))
        } catch (e) {
          if (messageFromError(e).key !== 'save.needsRewrite') throw e
          // i dati restano da salvare
          if (!lossConfirm()) return
          ;({ rewritten } = await window.api.saveData(changes))
        }
      }
      const onDisk = [
        ...project.sets.flatMap((x) => (x.data ? [x.data.name] : [])),
        ...project.unusedSheets
      ]
      // dopo che il file è stato riscritto tutto non c'è più niente da perdere
      setProject(
        (p) => p && { ...p, diskSheets: onDisk, ...(rewritten ? { dataFileLosses: [] } : {}) }
      )
      // i fogli rinominati ora hanno sul disco il nome nuovo
      if (sheets.some((x) => x.origin))
        setProject(
          (p) =>
            p && {
              ...p,
              sets: p.sets.map((x) => {
                if (!x.data?.origin || !sheets.includes(x.data)) return x
                const data = { ...x.data }
                delete data.origin
                return { ...x, data }
              })
            }
        )
      // i ripristinati ora sono nel progetto; quelli tolti di nuovo (annulla) restano nel cestino
      const kept = restored.filter((r) =>
        r.kind === 'template'
          ? project.templates.some((x) => x.name === r.name)
          : project.sets.some((x) => x.data?.name === r.name)
      )
      if (kept.length) await window.api.dropDeleted(kept.map((r) => r.file))
      setRestored([])
      setDirtySheets(new Set())
      setTrashedSheets(new Set())
      setFileDirty(false)
      updateThumbnail(project, false)
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setSaving(false)
    }
  }

  const createSet = (name: string, template: string, sheetName: string | null): void => {
    if (!project || (!sheetName && dataLocked())) return
    if (project.file.dataFile.toLowerCase().endsWith('.csv')) {
      setError({ key: 'save.csvOneSheet' })
      setCreatingSet(false)
      return
    }
    const tpl = project.templates.find((x) => x.name === template) ?? null
    // un foglio non collegato si riprende dal file con le sue righe; si rilegge al salvataggio
    // un foglio già usato da un altro set si condivide: stessi dati, template diverso
    const data: Sheet = sheetName
      ? (project.sets.find((x) => x.data?.name === sheetName)?.data ??
        project.unusedData?.find((x) => x.name === sheetName) ??
        newSheet(sheetName, tpl))
      : newSheet(name, tpl)
    const def = { name, template, ...(data.name !== name ? { sheet: data.name } : {}) }
    setHistory((h) => ({
      past: [...h.past, { sets: project.sets, file: project.file }],
      future: [],
      at: 0
    }))
    setProject({
      ...project,
      file: { ...project.file, sets: [...project.file.sets, def] },
      sets: [...project.sets, { ...def, data }],
      unusedSheets: project.unusedSheets.filter((x) => x !== data.name)
    })
    if (!sheetName) setDirtySheets((d) => new Set(d).add(data.name))
    setFileDirty(true)
    setSelected({ kind: 'set', index: project.sets.length })
    setCreatingSet(false)
  }

  /** Nome libero per una copia: "Nome copia", "Nome copia 2", ... */
  const copyName = (base: string, taken: string[]): string => {
    const stem = `${base} ${t('duplicate.suffix')}`
    let name = stem
    for (let n = 2; taken.includes(name); n++) name = `${stem} ${n}`
    return name
  }
  const setNames = (): string[] =>
    project
      ? [
          ...project.sets.map((x) => x.name),
          ...project.sets.flatMap((x) => (x.data ? [x.data.name] : [])),
          // il foglio di un set rinominato ha ancora il nome vecchio finché non si salva
          ...project.sets.flatMap((x) => (x.data?.origin ? [x.data.origin] : [])),
          ...project.unusedSheets
        ]
      : []
  const templateNames = (): string[] =>
    project
      ? project.templates.flatMap((x) => [
          x.name,
          x.file ?? x.name,
          ...(x.origin ? [x.origin] : [])
        ])
      : []

  const duplicateSet = (index: number, name: string): void => {
    if (!project || dataLocked()) return
    const src = project.sets[index]
    if (project.file.dataFile.toLowerCase().endsWith('.csv')) {
      setError({ key: 'save.csvOneSheet' })
      return
    }
    const data: Sheet = src.data
      ? { ...src.data, name, rows: src.data.rows.map((r) => [...r]) }
      : { name, headers: ['amount'], rows: [] }
    const def = { name, template: src.template }
    setHistory((h) => ({
      past: [...h.past, { sets: project.sets, file: project.file }],
      future: [],
      at: 0
    }))
    const at = index + 1
    const sets = [...project.sets]
    sets.splice(at, 0, { ...def, data })
    const defs = [...project.file.sets]
    defs.splice(at, 0, def)
    setProject({ ...project, sets, file: { ...project.file, sets: defs } })
    setDirtySheets((d) => new Set(d).add(name))
    setFileDirty(true)
    setSelected({ kind: 'set', index: at })
  }

  /** Nuovo nome di un set; il foglio dei dati prende lo stesso nome al salvataggio */
  const renameSetAt = async (index: number, name: string): Promise<void> => {
    if (!project) return
    const set = project.sets[index]
    const before = set.data
    const csv = project.file.dataFile.toLowerCase().endsWith('.csv')
    // un foglio già nel file può essere citato da formule di altri fogli: si chiede se rinominarlo
    const onDisk = !!before && !set.sheet && (project.diskSheets ?? []).includes(before.name)
    // un foglio condiviso con altri set tiene il suo nome
    const keepSheet =
      sharingSets(project.sets, index).length > 0 ||
      !!project.file.dataReadOnly ||
      (!csv &&
        onDisk &&
        !(await confirmKey(
          t,
          'sidebar.renameSheetConfirm',
          { sheet: before.name, name },
          { cancel: true }
        )))
    const { file, sets } = renameSet(project.file, project.sets, index, name, csv, keepSheet)
    // come per i template: la cronologia riparte, perché i passi precedenti hanno il nome
    // vecchio e, dopo un salvataggio, annullare ricreerebbe il foglio da capo
    setHistory({ past: [], future: [], at: 0 })
    setProject({ ...project, file, sets })
    const after = sets[index].data
    if (before && after && before.name !== after.name)
      setDirtySheets((d) => {
        const next = new Set(d)
        next.delete(before.name)
        return next.add(after.name)
      })
    setFileDirty(true)
  }

  /**
   * Toglie un set dal progetto. Al salvataggio il suo foglio esce dal file dati e va in deleted/,
   * così il nome torna libero; fino ad allora ⌘Z annulla.
   */
  const deleteSet = async (index: number): Promise<void> => {
    if (!project) return
    const set = project.sets[index]
    if (!(await confirmKey(t, 'sidebar.deleteSetConfirm', { name: set.name }, { danger: true })))
      return
    setHistory((h) => ({
      past: [...h.past, { sets: project.sets, file: project.file }],
      future: [],
      at: 0
    }))
    // un foglio che altri set usano ancora resta nel file
    const shared = sharingSets(project.sets, index).length > 0
    // in sola lettura il foglio resta nel file, tra quelli non collegati
    const kept = !shared && project.file.dataReadOnly ? set.data : null
    const sheet = shared || kept ? null : set.data
    setProject({
      ...project,
      sets: project.sets.filter((_, i) => i !== index),
      file: { ...project.file, sets: project.file.sets.filter((_, i) => i !== index) },
      ...(kept
        ? {
            unusedSheets: [...project.unusedSheets, kept.name],
            unusedData: [...(project.unusedData ?? []), kept]
          }
        : {})
    })
    if (sheet) {
      setDirtySheets((d) => {
        const next = new Set(d)
        next.delete(sheet.name)
        return next
      })
      // il foglio sul disco ha ancora il nome di prima se il set era stato rinominato
      setTrashedSheets((t) => new Set(t).add(sheet.origin ?? sheet.name))
    }
    setFileDirty(true)
    if (selected.kind === 'set' && selected.index >= index && selected.index > 0)
      setSelected({ kind: 'set', index: selected.index - 1 })
  }

  /**
   * Nuovo nome di un template, anche nei derivati, nei set e nella colonna `template` delle carte.
   * Il file cambia nome al salvataggio. Non si annulla con ⌘Z (come l'eliminazione): la cronologia
   * dei dati riparte, perché i passi precedenti richiamano il nome vecchio.
   */
  const renameTemplateTo = (from: string, to: string): void => {
    if (!project) return
    const after = { ...project, ...renameTemplate(project, from, to) }
    setProject(after)
    setHistory({ past: [], future: [], at: 0 })
    setDirty((d) => {
      const next = new Set(d)
      next.delete(from)
      return next
    })
    markRenamed(project, after)
    setFileDirty(true)
    if (selected.kind === 'template' && selected.name === from)
      setSelected({ kind: 'template', name: to })
  }

  /** Elimina un template non usato dai set: il file va in deleted/ nel progetto */
  const deleteTemplate = async (name: string): Promise<void> => {
    if (!project) return
    const users = project.sets.filter((s) => s.template === name).map((s) => s.name)
    if (users.length) {
      await showNotice(t, t('sidebar.templateInUse', { name, sets: users.join(', ') }))
      return
    }
    const derived = derivedOf(project.templates, name).map((x) => x.name)
    if (derived.length) {
      await showNotice(t, t('inherit.hasDerived', { name, list: derived.join(', ') }))
      return
    }
    const tpl = project.templates.find((x) => x.name === name)
    if (!tpl || !(await confirmKey(t, 'sidebar.deleteTemplateConfirm', { name }, { danger: true })))
      return
    try {
      await window.api.deleteTemplate(tpl.origin ?? tpl.file ?? tpl.name)
    } catch (e) {
      setError(messageFromError(e))
      return
    }
    setProject((p) => p && { ...p, templates: p.templates.filter((x) => x.name !== name) })
    setDirty((d) => {
      const next = new Set(d)
      next.delete(name)
      return next
    })
    if (selected.kind === 'template' && selected.name === name)
      setSelected({ kind: 'set', index: 0 })
  }

  /** Carte nuove o cambiate rispetto alla versione del confronto, per set; si aggiornano a ogni modifica */
  const changed = useMemo(
    () =>
      compareBase && project
        ? changedCards(cardFingerprints(project, project.assets), compareBase.before)
        : null,
    [compareBase, project]
  )

  /** Rimette nel progetto un elemento del cestino; un foglio diventa un set con il template scelto */
  const restoreDeleted = async (item: DeletedItem, template: string): Promise<void> => {
    if (!project) return
    const free = (base: string, taken: string[]): string => {
      let name = base
      for (let i = 2; taken.includes(name); i++) name = `${base} ${i}`
      return name
    }
    try {
      const c = await window.api.readDeleted(item.file)
      if (c.kind === 'note') {
        const name = free(
          c.name,
          (project.notes ?? []).map((n) => n.name)
        )
        await window.api.saveNote(name, c.text)
        await window.api.dropDeleted([item.file])
        setNotes((notes) =>
          [...notes, { name, text: c.text }].sort((a, b) => a.name.localeCompare(b.name))
        )
        setOpenNote(name)
      } else if (c.kind === 'document') {
        const name = await documents.restore(c.name, c.text)
        await window.api.dropDeleted([item.file])
        setSelected({ kind: 'document', name })
      } else if (c.kind === 'template') {
        const name = free(c.template.name, templateNames())
        const tpl: Template = { ...c.template, name }
        delete tpl.file
        // un derivato si completa dal suo base, come al caricamento
        setProject(
          (p) => p && { ...p, templates: resolveTemplates([...p.templates, tpl]).templates }
        )
        setDirty((d) => new Set(d).add(name))
        setRestored((r) => [...r, { file: item.file, kind: 'template', name }])
        setSelected({ kind: 'template', name })
      } else {
        if (dataLocked()) return
        if (project.file.dataFile.toLowerCase().endsWith('.csv')) {
          setError({ key: 'save.csvOneSheet' })
          return
        }
        const name = free(c.sheet.name, setNames())
        const data: Sheet = { ...c.sheet, name }
        const def = { name, template }
        setHistory((h) => ({
          past: [...h.past, { sets: project.sets, file: project.file }],
          future: [],
          at: 0
        }))
        setProject({
          ...project,
          file: { ...project.file, sets: [...project.file.sets, def] },
          sets: [...project.sets, { ...def, data }]
        })
        setDirtySheets((d) => new Set(d).add(name))
        setFileDirty(true)
        setRestored((r) => [...r, { file: item.file, kind: 'set', name }])
        setSelected({ kind: 'set', index: project.sets.length })
      }
      setTrashOpen(false)
    } catch (e) {
      setError(messageFromError(e))
    }
  }

  /**
   * Un foglio di un altro file al posto dei dati di un set: prima un backup del progetto com'è
   * salvato, poi la modifica, che si annulla con ⌘Z e va salvata come le altre
   */
  const importSheetFromFile = async (setName: string, sheet: Sheet): Promise<void> => {
    if (!project || dataLocked()) return
    try {
      await window.api.createBackup()
    } catch (e) {
      setError(messageFromError(e))
      return
    }
    const index = project.sets.findIndex((s) => s.name === setName)
    if (index < 0) return
    updateSheet(index, sheet)
    setSelected({ kind: 'set', index })
    setImportingSheet(false)
  }

  /** Dati dal foglio Google: ogni scheda sostituisce i dati del suo set; ⌘Z annulla */
  const importGoogleSheet = (link: string, imports: SheetImport[]): void => {
    if (!project || dataLocked()) return
    setHistory((h) => ({
      past: [...h.past.slice(-99), { sets: project.sets, file: project.file }],
      future: [],
      at: 0
    }))
    const names: string[] = []
    const sets = project.sets.map((s) => {
      const found = imports.find((i) => i.set === s.name)
      if (!found) return s
      const data: Sheet = {
        ...s.data,
        name: s.data?.name ?? s.sheet ?? s.name,
        headers: found.sheet.headers,
        rows: found.sheet.rows
      }
      names.push(data.name)
      return { ...s, data }
    })
    setProject({ ...project, sets, file: { ...project.file, googleSheet: link } })
    setDirtySheets((d) => new Set([...d, ...names]))
    if (project.file.googleSheet !== link) setFileDirty(true)
    setSheetsOpen(false)
  }

  const duplicateTemplate = (from: string, name: string): void => {
    const src = project?.templates.find((x) => x.name === from)
    if (!src) return
    // i livelli ricevono id nuovi rileggendo il template come da file
    const copy = normalizeTemplate({ ...denormalizeTemplate(src), name })
    // la copia di un derivato deriva dallo stesso base: si risolve come al caricamento
    setProject((p) => p && { ...p, templates: resolveTemplates([...p.templates, copy]).templates })
    setDirty((d) => new Set(d).add(name))
    setSelected({ kind: 'template', name })
  }

  // ⌘S salva tutto ovunque; ⌘Z nei set annulla le modifiche ai dati (nell'editor vale l'editor)
  const onKey = (e: KeyboardEvent): void => {
    const mod = e.metaKey || e.ctrlKey
    if (!mod) return
    const k = e.key.toLowerCase()
    if (k === 's') {
      e.preventDefault()
      saveAll()
      return
    }
    if (e.code === 'KeyE' && !e.altKey && project) {
      e.preventDefault()
      if (e.shiftKey) void repeatExport()
      else openExport()
      return
    }
    if (e.code === 'KeyF' && e.shiftKey && !e.altKey && project) {
      e.preventDefault()
      setFindingAll(true)
      return
    }
    if (selected.kind !== 'set') return
    const target = e.target as HTMLElement
    if (target.closest('input, textarea, select, [role="dialog"]')) return
    if (k === 'z') undoData(e.shiftKey)
    else if (k === 'y') undoData(true)
    else return
    e.preventDefault()
  }
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const createTemplate = ({ name, width, height, kind, shape }: NewTemplate): void => {
    // la pedina è una figura su fondo trasparente, con il retro specchiato dal fronte: niente
    // sfondi e niente abbondanza, il bordo è la figura stessa
    const standee = kind === 'standee'
    const tpl = normalizeTemplate({
      name,
      kind,
      width,
      height,
      cornerRadius: KIND_CORNER[kind],
      ...(standee ? { bleed: 0, safeMargin: 0 } : {}),
      ...(shape ? { shape } : {}),
      front: standee
        ? []
        : [
            {
              type: 'shape',
              name: 'background',
              x: -3,
              y: -3,
              w: width + 6,
              h: height + 6,
              fill: '#FFFFFF',
              locked: true
            }
          ],
      back: standee
        ? []
        : [
            {
              type: 'shape',
              name: 'back_background',
              x: -3,
              y: -3,
              w: width + 6,
              h: height + 6,
              fill: '#5E4421',
              locked: true
            }
          ]
    })
    setProject((p) => p && { ...p, templates: [...p.templates, tpl] })
    setDirty((d) => new Set(d).add(name))
    setSelected({ kind: 'template', name })
    setCreating(false)
  }

  const current = selected.kind === 'set' ? project?.sets[selected.index] : undefined
  const editing =
    selected.kind === 'template'
      ? project?.templates.find((x) => x.name === selected.name)
      : undefined
  // i set del template, più quello da cui si è aperto se la carta usa un template suo
  const fromSet = editPreview?.for === selected ? editPreview : null
  const editorSets = editing
    ? (project?.sets ?? []).filter(
        (s) => s.template === editing.name || (fromSet && s.name === fromSet.set)
      )
    : []
  const editorPreviewIndex = fromSet ? editorSets.findIndex((s) => s.name === fromSet.set) : -1
  const editorPreview =
    editorPreviewIndex >= 0 && fromSet ? { set: editorPreviewIndex, row: fromSet.row } : null

  // la barra laterale sta a sinistra o a destra, a scelta
  const allStyles = { ...BUILTIN_STYLES, ...project?.file.styles }
  const order = project?.file.order
  const styleList = orderNames(Object.keys(allStyles), order?.styles)
  const variables = project?.file.variables ?? NO_VARIABLES
  const projectColors = useMemo(
    () =>
      project
        ? usedColors([
            project.templates,
            project.file.styles,
            project.file.variables,
            ...project.sets.map((s) => s.data?.rows)
          ])
        : [],
    [project]
  )
  const variableList = orderNames(Object.keys(variables), order?.variables).map(
    (n): [string, Variable] => [n, variables[n]]
  )
  const templateList = orderNames(
    project?.templates.map((x) => x.name) ?? [],
    order?.templates
  ).flatMap((n) => project?.templates.find((x) => x.name === n) ?? [])
  // trascinando una voce si salva l'ordine dell'elenco come appare
  const dragSets = useDragReorder(moveSet)
  const dragTemplates = useDragReorder((a, b) =>
    setListOrder(
      'templates',
      moveItem(
        templateList.map((x) => x.name),
        a,
        b
      )
    )
  )
  const dragStyles = useDragReorder((a, b, item) =>
    dropInGroups('styles', styleList, a, b, { item })
  )
  const dragVariables = useDragReorder((a, b, item) =>
    dropInGroups(
      'variables',
      variableList.map(([n]) => n),
      a,
      b,
      { item }
    )
  )
  /**
   * Stili o variabili nella barra laterale: con molte voci un campo per filtrarle per nome, e le
   * voci con un gruppo sotto il titolo del gruppo, che si chiude con un clic
   */
  const groupedItems = (
    kind: GroupKind,
    names: string[],
    dragging: number | null,
    item: (name: string, index: number) => React.ReactNode
  ): React.ReactNode => {
    const query = listFilter[kind]?.trim().toLowerCase() ?? ''
    const groups = groupList(names, order, kind)
    const shown = (name: string): boolean => !query || name.toLowerCase().includes(query)
    return (
      <>
        {names.length > FILTER_FROM && (
          <input
            className="sidebar-filter"
            type="search"
            placeholder={t('sidebar.filter')}
            value={listFilter[kind] ?? ''}
            onChange={(e) => setListFilter((f) => ({ ...f, [kind]: e.target.value }))}
          />
        )}
        {groups.map(({ group, items }) => {
          const visible = items.filter((x) => shown(x.name))
          if (group && !visible.length) return null
          const id = `${kind}:${group}`
          // con un filtro i gruppi si aprono, per vedere ciò che si cerca
          const open = !group || !!query || !closedSections.has(id)
          return (
            <div key={id} className={group ? 'sidebar-group' : undefined}>
              {group && (
                <button
                  className={`sidebar-group-title${groupDrop === id ? ' drop-into' : ''}`}
                  aria-expanded={open}
                  onClick={() => setSectionClosed(id, open)}
                  // una voce lasciata sul titolo entra nel gruppo
                  onDragOver={(e) => {
                    if (dragging === null) return
                    e.preventDefault()
                    setGroupDrop(id)
                  }}
                  onDragLeave={() => setGroupDrop(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setGroupDrop(null)
                    if (dragging !== null) dropInGroups(kind, names, dragging, dragging, { group })
                  }}
                >
                  <span className="caret">{open ? '▾' : '▸'}</span>
                  {group}
                  <span className="muted small">{items.length}</span>
                </button>
              )}
              {open && <ul>{visible.map((x) => item(x.name, x.index))}</ul>}
            </div>
          )
        })}
      </>
    )
  }

  /** Dove sono usati uno stile o una variabile; un clic apre il template o il set e chiude la finestra */
  const usagesNav = (kind: RefKind, name: string): UsagesNav | undefined =>
    project
      ? {
          usages: findUsages(
            {
              templates: project.templates,
              sets: project.sets,
              variables: project.file.variables ?? {},
              styles: project.file.styles ?? {}
            },
            kind,
            name
          ),
          openTemplate: (n) => {
            setEditingStyle(null)
            setEditingVariable(null)
            setSelected({ kind: 'template', name: n })
          },
          openSet: (index) => {
            setEditingStyle(null)
            setEditingVariable(null)
            setSelected({ kind: 'set', index })
          }
        }
      : undefined

  /** Pulsante "A–Z" accanto al +, solo quando l'elenco non è già alfabetico */
  const sortButton = (names: string[], onSort: () => void): React.ReactNode =>
    !isAlphabetical(names) && (
      <button className="icon-btn sort-alpha" title={t('sidebar.sortAlpha')} onClick={onSort}>
        A–Z
      </button>
    )
  // sezioni della barra laterale, per la versione ridotta a icone
  const sidebarSections: [string, React.ReactNode, string][] = [
    ['sets', <SetsIcon key="sets" />, t('sidebar.sets')],
    ['templates', <TemplateIcon key="templates" />, t('sidebar.templates')],
    ['styles', <StylesIcon key="styles" />, t('sidebar.styles')],
    ['variables', <VariablesIcon key="variables" />, t('sidebar.variables')],
    ['documents', <DocumentsIcon key="documents" />, t('sidebar.documents')],
    ['notes', <NotesIcon key="notes" />, t('sidebar.notes')]
  ]
  const sidebar =
    project && sidebarCompact ? (
      <nav className="sidebar compact" data-side={sidebarSide}>
        <button
          className="icon-btn sidebar-compact-btn"
          title={t('sidebar.expand')}
          onClick={() => setSidebarCompact(false)}
        >
          <PanelIcon />
        </button>
        {sidebarSections.map(([id, icon, title]) => (
          <button
            key={id}
            className="sidebar-icon"
            title={title}
            onClick={() => {
              // apre il pannello sulla sezione scelta
              setSectionClosed(id, false)
              if (id === 'styles' || id === 'variables') setProjectSectionOpen(id, true)
              setSidebarCompact(false)
              requestAnimationFrame(() =>
                document.getElementById(`sidebar-${id}`)?.scrollIntoView({ block: 'start' })
              )
            }}
          >
            {icon}
          </button>
        ))}
      </nav>
    ) : (
      project && (
        <nav className="sidebar" data-side={sidebarSide} style={{ width: sidebarWidth }}>
          <div className="sidebar-bar">
            <button
              className="icon-btn sidebar-compact-btn"
              title={t('sidebar.compact')}
              onClick={() => setSidebarCompact(true)}
            >
              <PanelIcon />
            </button>
            <PanelSideButton side={sidebarSide} onToggle={toggleSidebarSide} />
          </div>
          <SidebarSection
            id="sets"
            icon={<SetsIcon />}
            title={t('sidebar.sets')}
            open={!closedSections.has('sets')}
            onToggle={(open) => setSectionClosed('sets', !open)}
            actions={
              <>
                {project &&
                  sortButton(
                    project.sets.map((x) => x.name),
                    sortSetsAlpha
                  )}
                <button
                  className="icon-btn"
                  title={t('sidebar.newSet')}
                  onClick={() => setCreatingSet(true)}
                >
                  +
                </button>
              </>
            }
          >
            <ul>
              {project.sets.map((s, i) => (
                <li key={s.name} {...dragSets.itemProps(i)}>
                  <button
                    className={selected.kind === 'set' && i === selected.index ? 'active' : ''}
                    onClick={() => setSelected({ kind: 'set', index: i })}
                    onContextMenu={(e) => contextMenu.open(e, setMenu(i))}
                    {...sidebarPreview.bind({ kind: 'set', index: i })}
                  >
                    <span>
                      {s.name}
                      {s.data && dirtySheets.has(s.data.name) && (
                        <span className="dirty-dot" title={t('app.unsaved')} />
                      )}
                    </span>
                    <span className="muted">{s.data ? countCards(s.data) : '–'}</span>
                  </button>
                  <button
                    className="icon-btn item-dup"
                    title={t('app.more')}
                    onClick={(e) => contextMenu.open(e, setMenu(i))}
                  >
                    ⋯
                  </button>
                </li>
              ))}
            </ul>
          </SidebarSection>
          <SidebarSection
            id="templates"
            icon={<TemplateIcon />}
            title={t('sidebar.templates')}
            open={!closedSections.has('templates')}
            onToggle={(open) => setSectionClosed('templates', !open)}
            actions={
              <>
                {sortButton(
                  templateList.map((x) => x.name),
                  () => setListOrder('templates', null)
                )}
                <button
                  className="icon-btn"
                  title={t('sidebar.newTemplate')}
                  onClick={() => setCreating(true)}
                >
                  +
                </button>
              </>
            }
          >
            <ul>
              {templateList.map((tpl, i) => (
                <li key={tpl.name} {...dragTemplates.itemProps(i)}>
                  <button
                    className={
                      selected.kind === 'template' && selected.name === tpl.name ? 'active' : ''
                    }
                    onClick={() => setSelected({ kind: 'template', name: tpl.name })}
                    onContextMenu={(e) => contextMenu.open(e, templateMenu(tpl.name))}
                    {...sidebarPreview.bind({ kind: 'template', name: tpl.name })}
                  >
                    <span>
                      {tpl.name}
                      {dirty.has(tpl.name) && (
                        <span className="dirty-dot" title={t('app.unsaved')} />
                      )}
                    </span>
                    <span
                      className={tpl.extends ? 'muted derived-base' : 'muted'}
                      title={tpl.extends ? `${t('inherit.derivedFrom')} ${tpl.extends}` : undefined}
                    >
                      {tpl.extends
                        ? `↳ ${tpl.extends}`
                        : `${toUnit(tpl.width, lengthUnit)}×${toUnit(tpl.height, lengthUnit)}`}
                    </span>
                  </button>
                  <button
                    className="icon-btn item-dup"
                    title={t('app.more')}
                    onClick={(e) => contextMenu.open(e, templateMenu(tpl.name))}
                  >
                    ⋯
                  </button>
                </li>
              ))}
            </ul>
          </SidebarSection>
          <SidebarSection
            id="styles"
            icon={<StylesIcon />}
            title={t('sidebar.styles')}
            count={styleList.length}
            open={projectSectionOpen('styles', styleList.length <= LONG_LIST)}
            onToggle={(open) => setProjectSectionOpen('styles', open)}
            actions={
              <>
                {sortButton(styleList, () => setListOrder('styles', null))}
                <button
                  className="icon-btn"
                  title={t('sidebar.newStyle')}
                  onClick={() => setEditingStyle('')}
                >
                  +
                </button>
              </>
            }
          >
            {groupedItems('styles', styleList, dragStyles.dragging, (name, i) => (
              <li key={name} {...dragStyles.itemProps(i)}>
                <button
                  onClick={() => setEditingStyle(name)}
                  {...sidebarPreview.bind({ kind: 'style', name })}
                >
                  <span>.{name}</span>
                  {!(name in (project.file.styles ?? {})) && (
                    <span className="muted small">{t('sidebar.builtinStyle')}</span>
                  )}
                </button>
              </li>
            ))}
          </SidebarSection>
          <SidebarSection
            id="variables"
            icon={<VariablesIcon />}
            title={t('sidebar.variables')}
            count={variableList.length}
            open={projectSectionOpen('variables', variableList.length <= LONG_LIST)}
            onToggle={(open) => setProjectSectionOpen('variables', open)}
            actions={
              <>
                {sortButton(
                  variableList.map(([n]) => n),
                  () => setListOrder('variables', null)
                )}
                <button
                  className="icon-btn"
                  title={t('sidebar.newVariable')}
                  onClick={() => setEditingVariable('')}
                >
                  +
                </button>
              </>
            }
          >
            {groupedItems(
              'variables',
              variableList.map(([n]) => n),
              dragVariables.dragging,
              (name, i) => (
                <li key={name} {...dragVariables.itemProps(i)}>
                  <button
                    onClick={() => setEditingVariable(name)}
                    {...sidebarPreview.bind({ kind: 'variable', name })}
                  >
                    <span>{`{${name}}`}</span>
                    <VariableSwatch v={variables[name]} variables={variables} />
                  </button>
                </li>
              )
            )}
          </SidebarSection>
          <SidebarSection
            id="documents"
            icon={<DocumentsIcon />}
            title={t('sidebar.documents')}
            open={!closedSections.has('documents')}
            onToggle={(open) => setSectionClosed('documents', !open)}
            actions={
              <button
                className="icon-btn"
                title={t('sidebar.newDocument')}
                onClick={() => void newDocument()}
              >
                +
              </button>
            }
          >
            <ul>
              {(project.documents ?? []).map((d) => (
                <li key={d.name}>
                  <button
                    className={openDocument === d.name ? 'active' : ''}
                    onClick={() => setSelected({ kind: 'document', name: d.name })}
                    onContextMenu={(e) => contextMenu.open(e, documentMenu(d.name))}
                  >
                    <span>{d.name}</span>
                  </button>
                  <button
                    className="icon-btn item-dup"
                    title={t('app.more')}
                    onClick={(e) => contextMenu.open(e, documentMenu(d.name))}
                  >
                    ⋯
                  </button>
                </li>
              ))}
            </ul>
            {!project.documents?.length && (
              <button
                className="sidebar-add"
                title={t('sidebar.noDocuments')}
                onClick={() => void newDocument()}
              >
                {t('sidebar.addDocument')}
              </button>
            )}
          </SidebarSection>
          <SidebarSection
            id="notes"
            icon={<NotesIcon />}
            title={t('sidebar.notes')}
            open={!closedSections.has('notes')}
            onToggle={(open) => setSectionClosed('notes', !open)}
            actions={
              <button
                className="icon-btn"
                title={t('sidebar.newNote')}
                onClick={() => void newNote()}
              >
                +
              </button>
            }
          >
            <ul>
              {(project.notes ?? []).map((n) => (
                <li key={n.name}>
                  <button
                    className={openNote === n.name ? 'active' : ''}
                    onClick={() => {
                      if (openNote && openNote !== n.name) flushNote(openNote)
                      setOpenNote(openNote === n.name ? null : n.name)
                    }}
                  >
                    <span>{n.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            {!project.notes?.length && (
              <button
                className="sidebar-add"
                title={t('sidebar.noNotes')}
                onClick={() => void newNote()}
              >
                {t('sidebar.addNote')}
              </button>
            )}
          </SidebarSection>
          {project.unusedSheets.length > 0 && (
            <p className="muted small">
              {t('sidebar.unusedSheets', { names: project.unusedSheets.join(', ') })}
            </p>
          )}
          <label className="muted small data-readonly" title={t('data.readOnlyHint')}>
            <input
              type="checkbox"
              checked={readOnlyData}
              onChange={(e) => setDataReadOnly(e.target.checked)}
            />
            {t('data.readOnlyLabel', { file: project.file.dataFile.split('/').pop() ?? '' })}
          </label>
          <button className="data-check-btn" onClick={() => setCheckingData(true)}>
            {t('sidebar.checkData')}
          </button>
        </nav>
      )
    )

  /**
   * Azioni su un set o un template: le stesse nel ⋯ della barra laterale, col tasto destro
   * e nel ⋯ accanto al nome aperto
   */
  const setMenu = (index: number): MenuItem[] => [
    { label: t('rename.ok'), title: t('tip.renameSet'), onClick: () => setRenamingSet(index) },
    {
      label: t('sidebar.duplicate'),
      title: t('tip.duplicateSet'),
      onClick: () => setDuplicating({ kind: 'set', index })
    },
    'sep',
    {
      label: t('sidebar.delete'),
      title: t('tip.deleteSet'),
      danger: true,
      onClick: () => deleteSet(index)
    }
  ]
  const templateMenu = (name: string): MenuItem[] => [
    {
      label: t('rename.ok'),
      title: t('tip.renameTemplate'),
      onClick: () => setRenamingTemplate(name)
    },
    {
      label: t('sidebar.duplicate'),
      title: t('tip.duplicateTemplate'),
      onClick: () => setDuplicating({ kind: 'template', name })
    },
    {
      label: t('inherit.deriveShort'),
      title: t('inherit.derive'),
      onClick: () => setDeriving(name)
    },
    'sep',
    {
      label: t('sidebar.delete'),
      title: t('tip.deleteTemplate'),
      danger: true,
      onClick: () => deleteTemplate(name)
    }
  ]

  /** Comandi del progetto usati di rado: nel menu Progetto e nel menu dell'app */
  /** Il menu ▾ del pulsante Esporta: ripetere l'ultima esportazione o partire da un profilo */
  const lastExport = project?.file.export?.last
  const keyLabel = (k: string): string => platformKeys(k, isMacPlatform(), lang)
  const exportMenu: MenuItem[] = [
    { label: t('app.export'), shortcut: keyLabel('⌘E'), onClick: () => openExport() },
    {
      label: t('export.menu.repeat'),
      shortcut: keyLabel('⇧⌘E'),
      title: lastExport
        ? `${t(
            lastExport.kind === 'pdf'
              ? project?.file.export?.pdf?.bleed
                ? 'export.goal.shop'
                : 'export.goal.home'
              : `export.goal.${lastExport.kind}`
          )} · ${t('export.menu.repeatHint')}`
        : t('export.menu.repeatHint'),
      disabled: !lastExport || !!exportRun?.progress,
      onClick: () => void repeatExport()
    },
    ...((project?.file.export?.named ?? []).length
      ? [
          'sep' as const,
          { label: t('export.menu.profiles'), disabled: true, onClick: () => undefined },
          ...(project?.file.export?.named ?? []).map((p) => ({
            label: `${p.name} · ${t(`export.${p.kind}`)}`,
            onClick: () => openExport(p.name)
          }))
        ]
      : [])
  ]
  const projectMenu: MenuItem[] = [
    { label: t('findAll.menu'), title: t('findAll.menuHint'), onClick: () => setFindingAll(true) },
    'sep',
    { label: t('app.backup'), title: t('tip.backup'), onClick: () => setBackingUp(true) },
    { label: t('app.trash'), title: t('tip.trash'), onClick: () => setTrashOpen(true) },
    {
      label: t('app.googleSheets'),
      title: t('tip.googleSheets'),
      onClick: () => setSheetsOpen(true)
    },
    { label: t('app.languages'), title: t('tip.languages'), onClick: () => setLanguagesOpen(true) },
    'sep',
    // nel browser le cartelle si gestiscono dal sistema
    ...(window.api.isWeb
      ? []
      : ([
          {
            label: t('relocate.copyMenu'),
            title: t('relocate.copyHint'),
            onClick: () => void relocate('copy')
          },
          {
            label: t('relocate.moveMenu'),
            title: t('relocate.moveHint'),
            onClick: () => void relocate('move')
          }
        ] as MenuItem[])),
    {
      label: t('app.reloadFromDisk'),
      title: t('tip.reload'),
      onClick: async () => project && (await discardOk()) && load(project.folder)
    },
    { label: t('app.closeProjectLong'), title: t('tip.closeProject'), onClick: closeProject }
  ]

  // menu dell'app desktop: le stesse voci della barra, con le scorciatoie accanto
  const menuCommands: Record<string, () => void> = {
    open: () => void open(),
    save: () => void saveAll(),
    export: () => openExport(),
    repeatExport: () => void repeatExport(),
    backup: () => setBackingUp(true),
    findAll: () => project && setFindingAll(true),
    trash: () => setTrashOpen(true),
    sheets: () => setSheetsOpen(true),
    languages: () => setLanguagesOpen(true),
    reload: async () => project && (await discardOk()) && load(project.folder),
    close: closeProject,
    copyProject: () => void relocate('copy'),
    moveProject: () => void relocate('move'),
    uiBigger: () =>
      changeUiZoom(UI_ZOOMS[Math.min(UI_ZOOMS.indexOf(uiZoom) + 1, UI_ZOOMS.length - 1)]),
    uiSmaller: () => changeUiZoom(UI_ZOOMS[Math.max(UI_ZOOMS.indexOf(uiZoom) - 1, 0)]),
    uiReset: () => changeUiZoom(1),
    help: () => setHelp(true),
    aiTools: () => setAiTools(true),
    updates: checkForUpdateNow,
    website: () => window.open(WEBSITE)
  }
  const commandsRef = useRef(menuCommands)
  useEffect(() => {
    commandsRef.current = menuCommands
  })
  useEffect(() => window.api.onMenuCommand((id) => commandsRef.current[id]?.()), [])
  const hasProject = !!project
  const canSave = hasProject && anyDirty && !saving
  useEffect(() => {
    if (window.api.isWeb) return
    const sep = { type: 'separator' as const }
    const isMac = navigator.userAgent.includes('Mac')
    window.api.setAppMenu([
      {
        label: t('menu.file'),
        items: [
          { id: 'open', label: t('menu.openProject'), accelerator: 'CmdOrCtrl+O' },
          sep,
          {
            id: 'save',
            label: t('app.save'),
            accelerator: 'CmdOrCtrl+S',
            showOnly: true,
            enabled: canSave
          },
          {
            id: 'export',
            label: t('app.export'),
            accelerator: 'CmdOrCtrl+E',
            showOnly: true,
            enabled: hasProject
          },
          {
            id: 'repeatExport',
            label: t('export.menu.repeat'),
            accelerator: 'CmdOrCtrl+Shift+E',
            showOnly: true,
            enabled: hasProject
          },
          sep,
          { id: 'backup', label: t('app.backup'), enabled: hasProject },
          { id: 'trash', label: t('app.trash'), enabled: hasProject },
          { id: 'sheets', label: t('app.googleSheets'), enabled: hasProject },
          { id: 'languages', label: t('app.languages'), enabled: hasProject },
          sep,
          { id: 'copyProject', label: t('relocate.copyMenu'), enabled: hasProject },
          { id: 'moveProject', label: t('relocate.moveMenu'), enabled: hasProject },
          { id: 'reload', label: t('app.reloadFromDisk'), enabled: hasProject },
          {
            id: 'close',
            label: t('app.closeProjectLong'),
            accelerator: 'CmdOrCtrl+W',
            enabled: hasProject
          },
          ...(isMac ? [] : [sep, { role: 'quit', label: t('menu.quit') }])
        ]
      },
      {
        label: t('menu.edit'),
        items: [
          { role: 'undo', label: t('menu.undo') },
          { role: 'redo', label: t('menu.redo') },
          sep,
          { role: 'cut', label: t('menu.cut') },
          { role: 'copy', label: t('menu.copy') },
          { role: 'paste', label: t('menu.paste') },
          { role: 'selectAll', label: t('menu.selectAll') },
          sep,
          {
            id: 'findAll',
            label: t('findAll.menu'),
            accelerator: 'CmdOrCtrl+Shift+F',
            showOnly: true,
            enabled: hasProject
          }
        ]
      },
      {
        label: t('menu.view'),
        items: [
          { id: 'uiBigger', label: t('menu.uiBigger'), accelerator: 'CmdOrCtrl+Plus' },
          // ⌘= per le tastiere in cui + vuole il Maiuscolo
          { id: 'uiBigger', label: t('menu.uiBigger'), accelerator: 'CmdOrCtrl+=', visible: false },
          { id: 'uiSmaller', label: t('menu.uiSmaller'), accelerator: 'CmdOrCtrl+-' },
          { id: 'uiReset', label: t('menu.uiReset'), accelerator: 'CmdOrCtrl+0' },
          sep,
          { role: 'togglefullscreen', label: t('menu.fullScreen') },
          { role: 'toggleDevTools', label: t('menu.devTools') }
        ]
      },
      {
        label: t('menu.help'),
        items: [
          { id: 'help', label: t('app.help'), accelerator: 'F1', showOnly: true },
          { id: 'aiTools', label: t('app.aiTools') },
          sep,
          { id: 'updates', label: t('update.check') },
          { id: 'website', label: t('menu.website') }
        ]
      }
    ])
  }, [t, hasProject, canSave])

  /** Menu ⚙: dimensione dell'interfaccia, tema, lingua e strumenti IA, in ogni schermata */
  const settings = (
    <Menu className="settings-button" label="⚙" title={t('app.settings')} alignRight>
      {(close) => (
        <>
          <div className="settings-menu">
            {/* nel browser l'ingrandimento è quello del browser stesso */}
            {!window.api.isWeb && (
              <>
                <label className="muted" htmlFor="ui-size" title={t('app.uiSizeHint')}>
                  {t('app.uiSize')}
                </label>
                <select
                  id="ui-size"
                  value={uiZoom}
                  onChange={(e) => changeUiZoom(Number(e.target.value))}
                >
                  {UI_ZOOMS.map((z) => (
                    <option key={z} value={z}>
                      {Math.round(z * 100)}%
                    </option>
                  ))}
                </select>
              </>
            )}
            <label className="muted" htmlFor="ui-unit" title={t('app.lengthUnitHint')}>
              {t('app.lengthUnit')}
            </label>
            <select
              id="ui-unit"
              value={lengthUnit}
              title={t('app.lengthUnitHint')}
              onChange={(e) => setLengthUnit(e.target.value as LengthUnit)}
            >
              {LENGTH_UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`app.lengthUnit.${u}`)}
                </option>
              ))}
            </select>
            <label className="muted" htmlFor="ui-theme">
              {t('app.theme')}
            </label>
            <select
              id="ui-theme"
              value={theme}
              onChange={(e) => changeTheme(e.target.value as Theme)}
            >
              {THEMES.map((th) => (
                <option key={th} value={th}>
                  {t(`app.theme.${th}`)}
                </option>
              ))}
            </select>
            {channel && (
              <>
                <label className="muted" htmlFor="ui-channel" title={t('app.channelHint')}>
                  {t(window.api.isWeb ? 'app.webChannel' : 'app.channel')}
                </label>
                <select
                  id="ui-channel"
                  value={channel}
                  title={t('app.channelHint')}
                  onChange={(e) => changeChannel(e.target.value as UpdateChannel)}
                >
                  <option value="stable">{t('app.channel.stable')}</option>
                  <option value="beta">{t('app.channel.beta')}</option>
                </select>
              </>
            )}
            <label className="muted" htmlFor="ui-language">
              {t('app.language')}
            </label>
            <select
              id="ui-language"
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
            >
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="menu-sep" />
          <button
            className="menu-item"
            title={t('tip.aiTools')}
            onClick={() => {
              close()
              setAiTools(true)
            }}
          >
            {t('app.aiTools')}
          </button>
        </>
      )}
    </Menu>
  )

  return (
    <AssetsContext.Provider value={project?.assets ?? []}>
      <StylesContext.Provider value={project?.file.styles ?? NO_STYLES}>
        <VariablesContext.Provider value={variables}>
          <ProjectColorsContext.Provider value={projectColors}>
            <LocalizationContext.Provider value={localization}>
              <ProjectLanguagesContext.Provider value={languages}>
                <SaveStyleContext.Provider value={project ? saveStyle : null}>
                  <div className="app">
                    <Tooltip />
                    {contextMenu.node}
                    {!window.api.isWeb && <UpdateNotice dirty={anyDirty} />}
                    {help && (
                      <HelpDialog
                        onClose={() => setHelp(false)}
                        start={
                          !project || !project.sets.some((s) => (s.data?.rows.length ?? 0) > 0)
                        }
                      />
                    )}
                    {project && !sidebarCompact && (
                      <SidebarPreview
                        hover={sidebarPreview.hover}
                        project={project}
                        styles={allStyles}
                        side={sidebarSide}
                      />
                    )}
                    {project && (
                      <header className="toolbar">
                        <span className="project-name" title={project.folder}>
                          {project.file.name}
                        </span>
                        {/* annulla e ripeti valgono per ciò che è aperto: l'editor o i dati */}
                        <span className="tool-group">
                          <button
                            className="tool"
                            title={t('editor.undo')}
                            disabled={editing ? !editorHistory.undo : !history.past.length}
                            onClick={() => undoAny(false)}
                          >
                            ↶
                          </button>
                          <button
                            className="tool"
                            title={t('editor.redo')}
                            disabled={editing ? !editorHistory.redo : !history.future.length}
                            onClick={() => undoAny(true)}
                          >
                            ↷
                          </button>
                        </span>
                        {languages.length > 0 && (
                          <select
                            className="card-language"
                            value={localization?.language ?? languages[0]}
                            title={t('tip.cardLanguage')}
                            aria-label={t('app.cardLanguage')}
                            onChange={(e) =>
                              setCardLanguage(
                                e.target.value === languages[0] ? null : e.target.value
                              )
                            }
                          >
                            {languages.map((l) => (
                              <option key={l} value={l}>
                                {languageName(l, lang)}
                              </option>
                            ))}
                          </select>
                        )}
                        {loading && <span className="muted">{t('app.loading')}</span>}
                        <span className="spacer" />
                        {/* dal più usato al meno usato; ciò che serve di rado sta nel menu Progetto */}
                        <button
                          className="primary"
                          disabled={!anyDirty || saving}
                          title={t('app.saveHint')}
                          onClick={saveAll}
                        >
                          {anyDirty ? t('app.save') : t('app.saved')}
                        </button>
                        <span className="split-button">
                          <button onClick={() => openExport()} title={t('tip.export')}>
                            {t('app.export')}
                          </button>
                          <Menu
                            label="▾"
                            title={t('app.exportMenu')}
                            alignRight
                            items={exportMenu}
                          />
                        </span>
                        <Menu
                          label={`${t('app.projectMenu')} ▾`}
                          title={t('tip.projectMenu')}
                          alignRight
                          items={projectMenu}
                        />
                        <button onClick={() => setHelp(true)} title={t('tip.help')}>
                          {t('app.help')}
                        </button>
                        {settings}
                      </header>
                    )}

                    {project && error && <div className="banner error">{t(error)}</div>}
                    {project && refsNotice && (
                      <div className="banner info refs-notice">
                        {refsNotice}
                        <button onClick={() => setRefsNotice(null)}>{t('dialog.close')}</button>
                      </div>
                    )}
                    {project && dataChanged && !canReloadData && (
                      <div className="banner warning data-changed">
                        {t('data.changedOutside')}
                        <button onClick={async () => (await discardOk()) && load(project.folder)}>
                          {t('app.reload')}
                        </button>
                        <button onClick={() => setDataChanged(false)}>{t('data.ignore')}</button>
                      </div>
                    )}
                    {project?.warnings.map((w, i) => (
                      <div key={i} className="banner warning">
                        {t(w)}
                      </div>
                    ))}

                    {project && (
                      <FirstSteps
                        key={project.folder}
                        project={project}
                        exported={exportedIn === project.folder}
                        onNewTemplate={() => setCreating(true)}
                        onNewSet={() => setCreatingSet(true)}
                        onOpenSet={() => setSelected({ kind: 'set', index: 0 })}
                        onExport={openExport}
                      />
                    )}

                    {project ? (
                      <main className="workspace">
                        {sidebarSide === 'left' && (
                          <>
                            {sidebar}
                            {!sidebarCompact && (
                              <Resizer
                                width={sidebarWidth}
                                onChange={setSidebarWidth}
                                edge="left"
                                max={400}
                              />
                            )}
                          </>
                        )}
                        {openDocument && project.documents?.some((d) => d.name === openDocument) ? (
                          <DocumentView
                            key={openDocument}
                            name={openDocument}
                            text={
                              project.documents.find((d) => d.name === openDocument)?.text ?? ''
                            }
                            others={project.documents
                              .map((d) => d.name)
                              .filter((n) => n !== openDocument)}
                            project={project.file.name}
                            file={project.file}
                            sets={project.sets}
                            templates={project.templates}
                            fonts={project.fonts}
                            onChange={(text) => documents.change(openDocument, text)}
                            onRename={(to) =>
                              void documents
                                .rename(openDocument, to)
                                .then((ok) => ok && setSelected({ kind: 'document', name: to }))
                            }
                            onDelete={() => void deleteDocument(openDocument)}
                            onDuplicate={() => void duplicateDocument(openDocument)}
                          />
                        ) : editing ? (
                          <TemplateEditor
                            key={`${editing.name}:${editorRev}`}
                            template={editing}
                            sets={editorSets}
                            initialPreview={editorPreview}
                            projectName={project.file.name}
                            onChange={updateTemplate}
                            base={baseOf(project.templates, editing)}
                            onOpen={(name) => setSelected({ kind: 'template', name })}
                            onDetach={() => detachTemplate(editing.name)}
                            menu={templateMenu(editing.name)}
                            onHistory={setEditorHistory}
                          />
                        ) : current ? (
                          <SetView
                            key={project.sets.indexOf(current)}
                            set={current}
                            projectName={project.file.name}
                            readOnly={readOnlyData}
                            templates={project.templates}
                            onChange={(sheet, key) =>
                              updateSheet(selected.kind === 'set' ? selected.index : 0, sheet, key)
                            }
                            onEditTemplate={(name, row) => {
                              const sel: Selected = { kind: 'template', name }
                              setEditPreview(
                                row === undefined || row < 0
                                  ? null
                                  : { for: sel, set: current.name, row }
                              )
                              setSelected(sel)
                            }}
                            menu={setMenu(selected.kind === 'set' ? selected.index : 0)}

                            onChangeTemplate={(name) =>
                              setTemplate(selected.kind === 'set' ? selected.index : 0, name)
                            }
                            onChangeColumns={(view) =>
                              setColumnsView(selected.kind === 'set' ? selected.index : 0, view)
                            }
                            compare={
                              compareBase && changed
                                ? { label: compareBase.label, rows: changed[current.name] ?? [] }
                                : null
                            }
                            onCompare={() => setComparing(true)}
                            onEndCompare={() => setCompareBase(null)}
                          />
                        ) : (
                          <section className="content">
                            {!project.sets.length && (
                              <div className="empty">
                                <div>
                                  {project.templates.length ? (
                                    <>
                                      <p>{t('app.noSets')}</p>
                                      <button
                                        className="primary"
                                        onClick={() => setCreatingSet(true)}
                                      >
                                        {t('sidebar.newSet')}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <p>{t('app.emptyProject')}</p>
                                      <button className="primary" onClick={() => setCreating(true)}>
                                        {t('sidebar.newTemplate')}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </section>
                        )}
                        {openNote && project.notes?.some((n) => n.name === openNote) && (
                          <NotePanel
                            key={openNote}
                            name={openNote}
                            text={project.notes.find((n) => n.name === openNote)?.text ?? ''}
                            others={project.notes.map((n) => n.name).filter((n) => n !== openNote)}
                            onChange={(text) => changeNote(openNote, text)}
                            onRename={(to) => void renameNote(openNote, to)}
                            onDelete={() => void deleteNote(openNote)}
                            onClose={closeNote}
                          />
                        )}
                        {sidebarSide === 'right' && (
                          <>
                            {!sidebarCompact && (
                              <Resizer
                                width={sidebarWidth}
                                onChange={setSidebarWidth}
                                edge="right"
                                max={400}
                              />
                            )}
                            {sidebar}
                          </>
                        )}
                      </main>
                    ) : (
                      <StartScreen
                        onHelp={() => setHelp(true)}
                        error={error}
                        loading={loading}
                        settings={settings}
                        onOpen={load}
                        onChoose={open}
                        onImport={() => setImporting(true)}
                      />
                    )}
                    {renamingTemplate !== null && project && (
                      <DuplicateDialog
                        title={t('rename.templateTitle')}
                        okLabel={t('rename.ok')}
                        initial={renamingTemplate}
                        validate={(name) => {
                          const tpl = project.templates.find((x) => x.name === renamingTemplate)
                          const own = [renamingTemplate, tpl?.file, tpl?.origin]
                          return !isValidTemplateName(name)
                            ? t('newTemplate.invalidName')
                            : !own.includes(name) && templateNames().includes(name)
                              ? t('newTemplate.exists')
                              : null
                        }}
                        onDuplicate={(name) => {
                          if (name !== renamingTemplate) renameTemplateTo(renamingTemplate, name)
                          setRenamingTemplate(null)
                        }}
                        onClose={() => setRenamingTemplate(null)}
                      />
                    )}
                    {renamingSet !== null && project?.sets[renamingSet] && (
                      <DuplicateDialog
                        title={t('rename.setTitle')}
                        okLabel={t('rename.ok')}
                        initial={project.sets[renamingSet].name}
                        validate={(name) => {
                          const set = project.sets[renamingSet]
                          const own = [set.name, set.data?.name, set.data?.origin]
                          return !isValidSheetName(name)
                            ? t('newSet.invalidName')
                            : !own.includes(name) && setNames().includes(name)
                              ? t('newSet.exists')
                              : null
                        }}
                        onDuplicate={(name) => {
                          if (name !== project.sets[renamingSet].name)
                            renameSetAt(renamingSet, name)
                          setRenamingSet(null)
                        }}
                        onClose={() => setRenamingSet(null)}
                      />
                    )}
                    {duplicating && project && (
                      <DuplicateDialog
                        title={
                          duplicating.kind === 'set'
                            ? t('duplicate.setTitle')
                            : t('duplicate.templateTitle')
                        }
                        initial={copyName(
                          duplicating.kind === 'set'
                            ? project.sets[duplicating.index].name
                            : duplicating.name,
                          duplicating.kind === 'set' ? setNames() : templateNames()
                        )}
                        validate={(name) =>
                          duplicating.kind === 'set'
                            ? !isValidSheetName(name)
                              ? t('newSet.invalidName')
                              : setNames().includes(name)
                                ? t('newSet.exists')
                                : null
                            : !isValidTemplateName(name)
                              ? t('newTemplate.invalidName')
                              : templateNames().includes(name)
                                ? t('newTemplate.exists')
                                : null
                        }
                        onDuplicate={(name) => {
                          if (duplicating.kind === 'set') duplicateSet(duplicating.index, name)
                          else duplicateTemplate(duplicating.name, name)
                          setDuplicating(null)
                        }}
                        onClose={() => setDuplicating(null)}
                      />
                    )}
                    {deriving && project && (
                      <DuplicateDialog
                        title={t('inherit.deriveTitle')}
                        okLabel={t('inherit.deriveOk')}
                        initial={copyName(deriving, templateNames())}
                        validate={(name) =>
                          !isValidTemplateName(name)
                            ? t('newTemplate.invalidName')
                            : templateNames().includes(name)
                              ? t('newTemplate.exists')
                              : null
                        }
                        onDuplicate={(name) => {
                          deriveTemplate(deriving, name)
                          setDeriving(null)
                        }}
                        onClose={() => setDeriving(null)}
                      />
                    )}
                    {checkingData && project && (
                      <DataCheckDialog
                        project={project}
                        onImport={() => {
                          setCheckingData(false)
                          setImportingSheet(true)
                        }}
                        onClose={() => setCheckingData(false)}
                      />
                    )}
                    {importingSheet && project && (
                      <ImportSheetDialog
                        project={project}
                        initialSet={
                          selected.kind === 'set' ? project.sets[selected.index]?.name : undefined
                        }
                        onImport={(set, sheet) => void importSheetFromFile(set, sheet)}
                        onClose={() => setImportingSheet(false)}
                      />
                    )}
                    {creatingSet && project && (
                      <NewSetDialog
                        templates={project.templates}
                        existing={[
                          ...project.sets.map((x) => x.name),
                          ...project.sets.flatMap((x) => (x.data ? [x.data.name] : [])),
                          ...project.unusedSheets
                        ]}
                        unusedSheets={project.unusedSheets}
                        usedSheets={[
                          ...new Map(
                            project.sets.flatMap((x) =>
                              x.data
                                ? [[x.data.name, { sheet: x.data.name, set: x.name }] as const]
                                : []
                            )
                          ).values()
                        ]}
                        onCreate={createSet}
                        onClose={() => setCreatingSet(false)}
                      />
                    )}
                    {creating && project && (
                      <NewTemplateDialog
                        existing={templateNames()}
                        onCreate={createTemplate}
                        onClose={() => setCreating(false)}
                      />
                    )}
                  </div>
                  {importing && (
                    <ImportTtcDialog
                      onOpen={async (folder) => {
                        if (!(await discardOk())) return
                        setImporting(false)
                        load(folder)
                      }}
                      onClose={() => setImporting(false)}
                    />
                  )}
                  {aiTools && <AiToolsDialog onClose={() => setAiTools(false)} />}
                  {findingAll && project && (
                    <ProjectFindDialog
                      scope={findScope(project)}
                      onReplace={replaceAcrossProject}
                      onOpen={openFound}
                      onClose={() => setFindingAll(false)}
                    />
                  )}
                  {agentLock && agentLock.folder === folder && (
                    <AgentLockOverlay
                      lock={agentLock.lock}
                      onUnlock={() =>
                        window.api.unlockAgent().catch((e) => setError(messageFromError(e)))
                      }
                    />
                  )}
                  {comparing && project && (
                    <CompareDialog
                      project={project}
                      onCompare={(base) => {
                        setCompareBase(base)
                        setComparing(false)
                      }}
                      onClose={() => setComparing(false)}
                    />
                  )}
                  {languagesOpen && project && (
                    <LanguagesDialog
                      project={project}
                      onSave={saveLanguages}
                      onClose={() => setLanguagesOpen(false)}
                    />
                  )}
                  {sheetsOpen && project && (
                    <GoogleSheetsDialog
                      project={project}
                      onImport={importGoogleSheet}
                      onClose={() => setSheetsOpen(false)}
                    />
                  )}
                  {trashOpen && project && (
                    <TrashDialog
                      templates={project.templates}
                      onRestore={restoreDeleted}
                      onClose={() => setTrashOpen(false)}
                    />
                  )}
                  {backingUp && project && (
                    <BackupDialog
                      dirty={anyDirty}
                      onSave={saveAll}
                      onRestored={async (folder) => {
                        setBackingUp(false)
                        if (await discardOk()) load(folder)
                      }}
                      onClose={() => setBackingUp(false)}
                    />
                  )}
                  {exportRun && <ExportToast run={exportRun} onClose={() => setExportRun(null)} />}
                  {exporting !== null && project && (
                    <ExportDialog
                      project={project}
                      profile={exporting}
                      changed={changed}
                      language={localization?.language ?? null}
                      // le opzioni sono già scritte su disco: il progetto non risulta modificato
                      onProfiles={(profiles) =>
                        setProject((p) => p && { ...p, file: { ...p.file, export: profiles } })
                      }
                      onClose={() => setExporting(false)}
                    />
                  )}
                  {editingStyle !== null && project && (
                    <FormatDialog
                      mode="style"
                      styleName={editingStyle || undefined}
                      group={groupOf(order, 'styles', editingStyle)}
                      usages={editingStyle ? usagesNav('style', editingStyle) : undefined}
                      groups={groupNames(order, 'styles', styleList)}
                      initial={parseAttrs(allStyles[editingStyle] ?? '').attrs}
                      sample={editingStyle || 'Aa'}
                      onApply={(attrs, name, group) => {
                        if (name)
                          saveStyle(name, serializeAttrs(attrs), editingStyle || undefined, group)
                        setEditingStyle(null)
                      }}
                      onDelete={() => {
                        saveStyle(editingStyle, null)
                        setEditingStyle(null)
                      }}
                      onClose={() => setEditingStyle(null)}
                    />
                  )}
                  {editingVariable !== null && project && (
                    <VariableDialog
                      name={editingVariable}
                      group={groupOf(order, 'variables', editingVariable)}
                      usages={editingVariable ? usagesNav('variable', editingVariable) : undefined}
                      fieldNames={
                        new Set([
                          ...project.templates.flatMap((x) =>
                            walkLayers([...x.front, ...x.back]).map((l) => l.name)
                          ),
                          ...project.sets.flatMap((x) => x.data?.headers ?? [])
                        ])
                      }
                      groups={groupNames(
                        order,
                        'variables',
                        variableList.map(([n]) => n)
                      )}
                      onSave={(name, v, group) => {
                        saveVariable(name, v, editingVariable || undefined, group)
                        setEditingVariable(null)
                      }}
                      onDelete={() => {
                        saveVariable(editingVariable, null)
                        setEditingVariable(null)
                      }}
                      onClose={() => setEditingVariable(null)}
                    />
                  )}
                </SaveStyleContext.Provider>
              </ProjectLanguagesContext.Provider>
            </LocalizationContext.Provider>
          </ProjectColorsContext.Provider>
        </VariablesContext.Provider>
      </StylesContext.Provider>
    </AssetsContext.Provider>
  )
}

function SetView({
  set,
  projectName,
  readOnly,
  templates,
  onChange,
  onEditTemplate,
  menu,
  onChangeTemplate,
  onChangeColumns,
  compare,
  onCompare,
  onEndCompare
}: {
  set: LoadedSet
  /** Nome del progetto, per {project.name} */
  projectName: string
  /** File dati in sola lettura: le modifiche ai dati non passano */
  readOnly: boolean
  templates: Template[]
  onChange(sheet: Sheet, key?: string): void
  /** Assegna al set un altro template */
  onChangeTemplate(name: string): void
  /** Colonne nascoste e livelli calcolati mostrati */
  onChangeColumns(
    view: Pick<SetDefinition, 'hiddenColumns' | 'showComputed' | 'pinnedProperties'>
  ): void
  /** Apre nell'editor un template: quello del set o quello di una carta */
  /** row: la carta da mostrare nell'editor */
  onEditTemplate(name: string, row?: number): void
  /** Duplica ed elimina il set */
  /** Rinomina, duplica, elimina: il menu ⋯ accanto al nome */
  menu: MenuItem[]
  /** Confronto attivo: con che cosa e quali righe sono nuove o cambiate */
  compare: { label: string; rows: number[] } | null
  onCompare(): void
  onEndCompare(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [selection, setSelection] = useState<number[]>([0])
  const [side, setSide] = useState<Side>('front')
  const [addingColumn, setAddingColumn] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [checkingText, setCheckingText] = useState(false)
  const [focus, setFocus] = useState<{ column: string; seq: number } | null>(null)
  /** Campi del modulo con i dettagli del livello aperti: restano aperti passando di carta in carta */
  const [details, setDetails] = useState<Set<string>>(new Set())
  /** Livello in modifica direttamente sulla carta in anteprima */
  const [inline, setInline] = useState<InlineEdit | null>(null)
  /** Livello fisso o con formula su cui si è fatto doppio clic */
  const [info, setInfo] = useState<{ layer: Layer; box: Bounds; row: number } | null>(null)
  /** Anteprima grande in una finestra */
  const [big, setBig] = useState(false)
  /** Ultimo clic sull'anteprima, per passare al livello sotto con un altro clic */
  const lastPick = useRef<{ x: number; y: number; row: number; column: string } | null>(null)
  const [rowView, setRowView] = useState<RowView>(NO_VIEW)
  const [previewWidth, setPreviewWidth] = usePanelWidth('preview.v2', 380)
  const [previewSide, togglePreviewSide] = usePanelSide('preview', 'right')
  // dimensione delle miniature: pixel per millimetro
  const [thumb, setThumb] = usePanelWidth('thumbScale', 2.6)
  const contentRef = useRef<HTMLElement>(null)
  const thumbRef = useRef(thumb)
  useEffect(() => {
    thumbRef.current = thumb
  }, [thumb])
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    // Cmd/Ctrl + rotella o pizzico sul trackpad ingrandiscono le miniature
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const d = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 50)
      setThumb(clampThumb(thumbRef.current * Math.exp(-d * 0.004)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })
  // ogni set si apre nella griglia; la tabella si sceglie quando serve
  const [view, setView] = useState<View>('grid')

  const template = templates.find((tpl) => tpl.name === set.template) ?? null
  const bindCtx = useBindContext()
  const cards = useMemo<BoundCard[]>(() => {
    if (!template || !set.data) return []
    const { headers, rows } = set.data
    const info = systemOfSet(projectName, set)
    return rows.map((row, i) =>
      bindRow(headers, row, template, templates, { ...bindCtx, system: { ...info, number: i + 1 } })
    )
  }, [template, templates, set, projectName, bindCtx])
  /** Template di ogni carta: quello del set o quello della colonna template */
  const rowTemplates = useMemo(
    () =>
      template && set.data
        ? set.data.rows.map((r) => cardTemplate(set.data!.headers, r, template, templates).template)
        : [],
    [template, templates, set.data]
  )

  const [onlyChanged, setOnlyChanged] = useState(false)
  const order = useMemo(() => {
    const rows = set.data ? viewRows(set.data, rowView) : []
    if (!compare || !onlyChanged) return rows
    const marked = new Set(compare.rows)
    return rows.filter((r) => marked.has(r))
  }, [set.data, rowView, compare, onlyChanged])

  // colonne mostrate: tutte quelle modificabili, tranne le nascoste; i livelli fissi e con
  // formula solo a richiesta
  const allColumns = useMemo(
    () => (set.data ? setColumns(set.data, template, [...new Set(rowTemplates)]) : []),
    [set.data, template, rowTemplates]
  )
  const hidden = new Set(set.hiddenColumns ?? [])
  const pinned = new Set(set.pinnedProperties ?? [])
  const columns = allColumns.filter(
    (c) => !hidden.has(c.header) && (!c.computed || set.showComputed)
  )
  const booleans = useMemo(
    () => (set.data ? booleanColumns(set.data, template) : new Map<string, boolean | null>()),
    [set.data, template]
  )
  // valori dei livelli fissi e con formula, solo quando si mostrano
  const showsComputed = columns.some((c) => c.computed)
  const computedRows = useMemo(
    () =>
      template && set.data && showsComputed
        ? set.data.rows.map((r, i) =>
            computedValues(
              rowTemplates[i] ?? template,
              rowToCard(set.data!.headers, r),
              bindCtx.variables
            )
          )
        : [],
    [template, rowTemplates, set.data, bindCtx, showsComputed]
  )
  const computed = useCallback(
    (row: number): Record<string, string> => computedRows[row] ?? {},
    [computedRows]
  )
  // le parole per i componenti del set: carte, segnalini, facce...
  const words = kindWords(t, template)

  // PagSu e PagGiù passano alla carta precedente o successiva, nell'ordine della vista, anche
  // mentre si scrive nei campi della carta (il campo resta lo stesso)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'PageDown' && e.key !== 'PageUp') return
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !order.length) return
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest('[role="dialog"], select, .table-wrap textarea, .table-wrap input'))
        return
      e.preventDefault()
      const at = order.indexOf(selection[0] ?? -1)
      const next =
        at < 0
          ? order[e.key === 'PageDown' ? 0 : order.length - 1]
          : order[Math.max(0, Math.min(order.length - 1, at + (e.key === 'PageDown' ? 1 : -1)))]
      if (next === selection[0] && selection.length === 1) return
      const column = target?.closest('.card-form') ? target.dataset.column : undefined
      if (column) setFocus({ column, seq: Date.now() })
      setSelection([next])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ⌘A seleziona tutte le carte della vista, Esc torna a una sola; non mentre si scrive
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || !order.length) return
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return
      const all = (e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'a'
      if (all) {
        e.preventDefault()
        const first = order.includes(selection[0]) ? selection[0] : order[0]
        setSelection([first, ...order.filter((r) => r !== first)])
      } else if (e.key === 'Escape' && selection.length > 1) {
        e.preventDefault()
        setSelection([selection[0]])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!set.data) {
    return (
      <section className="content">
        <p className="muted">{t('set.noData')}</p>
      </section>
    )
  }
  const sheet = set.data
  const localization = bindCtx.localization
  const viewActive = rowView.sort !== null || rowView.filter.trim() !== ''
  /** Clic su un'intestazione: crescente, decrescente, poi l'ordine del foglio */
  const sortBy = (column: string): void =>
    setRowView((v) =>
      v.sort !== column
        ? { ...v, sort: column, desc: false }
        : v.desc
          ? { ...v, sort: null, desc: false }
          : { ...v, desc: true }
    )
  const current = selection[0] ?? -1
  const card = cards[current]
  // "Modifica template" apre quello della carta, che può essere diverso da quello del set
  const cardTemplateName = rowTemplates[current]?.name ?? set.template
  const none = current < 0 || current >= sheet.rows.length

  /** Tutte le carte della vista, con quella mostrata per prima */
  const selectAll = (): void =>
    setSelection(none ? order : [current, ...order.filter((r) => r !== current)])

  const addCard = (): void => {
    const at = none ? sheet.rows.length : Math.max(...selection) + 1
    onChange(insertRow(sheet, at))
    setSelection([at])
  }
  const duplicate = (): void => {
    onChange(duplicateRows(sheet, selection))
    // ogni copia sta subito sotto la sua riga: le righe prima di lei sono slittate di quante copie
    const sorted = [...new Set(selection)].sort((a, b) => a - b)
    setSelection(sorted.map((row, k) => row + k + 1))
  }
  const remove = async (): Promise<void> => {
    if (
      selection.length > 1 &&
      !(await confirmKey(
        t,
        'set.deleteConfirm',
        { what: words.count(selection.length) },
        { danger: true }
      ))
    )
      return
    onChange(removeRows(sheet, selection))
    setSelection([Math.min(Math.min(...selection), sheet.rows.length - selection.length - 1)])
  }

  /** Livelli con un campo sotto il puntatore, dal più in alto, con dove stanno sulla carta */
  const fieldsAt = (
    e: React.MouseEvent<HTMLDivElement>,
    allowed: Set<string>
  ): { column: string; layer: Layer; box: Bounds; p: { x: number; y: number } }[] => {
    const hits = layersAt(e)
    const out: { column: string; layer: Layer; box: Bounds; p: { x: number; y: number } }[] = []
    for (const { layer: l, chain, p } of hits) {
      const column = l.source.kind === 'column' ? (l.source.column ?? l.name) : null
      if (column && allowed.has(column) && !out.some((f) => f.column === column))
        out.push({ column, layer: l, box: worldBounds(l, chain), p })
    }
    return out
  }

  /** Livelli della carta sotto il puntatore, dal più in alto; la scala è quella della carta cliccata */
  const layersAt = (
    e: React.MouseEvent<HTMLDivElement>
  ): { layer: Layer; chain: GroupLayer[]; p: { x: number; y: number } }[] => {
    if (!card) return []
    const svg = e.currentTarget.querySelector('svg')
    if (!svg) return []
    const scale = Number(e.currentTarget.dataset.scale) || PREVIEW_SCALE
    const r = svg.getBoundingClientRect()
    const p = { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
    const layers = side === 'front' ? card.template.front : card.template.back
    return hitsAt(layers, p).map((h) => ({ ...h, p }))
  }

  /** Colonna di ciò che si vede: in un'altra lingua quella tradotta, se il foglio la ha */
  const shownColumn = (column: string): string => {
    const translated = localization && `${column}@${localization.language}`
    return translated && sheet.headers.includes(translated) ? translated : column
  }

  /**
   * Clic su un livello della carta in anteprima: si va al campo della sua colonna. Alt+clic
   * nello stesso punto passa al livello sotto, se anche quello ha un campo.
   */
  const pickField = (e: React.MouseEvent<HTMLDivElement>): void => {
    // il secondo clic di un doppio clic apre la modifica sulla carta
    if (e.detail > 1) return
    const found = fieldsAt(e, new Set(columns.filter((c) => !c.computed).map((c) => c.header)))
    if (!found.length) return
    const p = found[0].p
    const last = lastPick.current
    const again =
      e.altKey && last && last.row === current && Math.hypot(last.x - p.x, last.y - p.y) < 1
        ? (found.findIndex((f) => f.column === last.column) + 1) % found.length
        : 0
    lastPick.current = { ...p, row: current, column: found[again].column }
    setFocus({ column: shownColumn(found[again].column), seq: Date.now() })
  }

  /** Doppio clic sulla carta: si modifica il livello lì, sopra l'anteprima */
  const editOnCard = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (none) return
    // un livello fisso o con formula in cima non si modifica qui: si dice da dove viene il valore
    const top = layersAt(e).find((h) => h.layer.type !== 'group')
    if (top && top.layer.source.kind !== 'column') {
      setInline(null)
      setInfo({ layer: top.layer, box: worldBounds(top.layer, top.chain), row: current })
      return
    }
    setInfo(null)
    const found = fieldsAt(
      e,
      new Set(allColumns.filter((c) => !c.computed).map((c) => c.header))
    ).filter((f) => ['text', 'image', 'shape', 'grid'].includes(f.layer.type))
    if (!found.length) return
    // dopo un Alt+clic si modifica il livello scelto, non quello in cima
    const last = lastPick.current
    const hit = (last && found.find((f) => f.column === last.column)) || found[0]
    const column = shownColumn(hit.column)
    const index = sheet.headers.indexOf(column)
    const original = index < 0 ? '' : (sheet.rows[current]?.[index] ?? '')
    // una griglia si cambia come una forma: il valore è il riempimento
    const type = hit.layer.type === 'grid' ? 'shape' : hit.layer.type
    setInline({ column, type, box: hit.box, original, row: current })
  }

  /** La carta selezionata, con clic, doppio clic e modifica sulla carta, alla scala data */
  const cardStage = (scale: number): React.JSX.Element | null =>
    card ? (
      <div
        className="preview-card"
        data-scale={scale}
        title={inline || info ? undefined : t('preview.clickHint')}
        onClick={pickField}
        onDoubleClick={editOnCard}
      >
        <div className="preview-card-inner">
          <CardSvg template={card.template} side={side} scale={scale} />
          {inline && inline.row === current && (
            <InlineEditor
              key={`${inline.row}:${inline.column}`}
              edit={inline}
              scale={scale}
              value={sheet.rows[current]?.[sheet.headers.indexOf(inline.column)] ?? ''}
              fields={sheet.headers.filter((h) => h !== 'amount' && !h.includes('.'))}
              onChange={(v) =>
                onChange(
                  writeCells(sheet, [inline.row], inline.column, v),
                  `cell:${inline.row}:${inline.column}`
                )
              }
              onClose={() => setInline(null)}
            />
          )}
          {info && info.row === current && (
            <ValueInfo
              layer={info.layer}
              box={info.box}
              scale={scale}
              onEditTemplate={() => onEditTemplate(cardTemplateName, current)}
              onClose={() => setInfo(null)}
            />
          )}
        </div>
      </div>
    ) : null

  // il modulo sta accanto all'anteprima, o nella finestra della carta grande
  const cardForm = !none && (
    <CardForm
      key={selection.join(',')}
      sheet={sheet}
      row={current}
      rows={selection}
      template={rowTemplates[current] ?? template}
      setTemplate={set.template}
      templateChoices={
        template
          ? templates
              .filter((x) => x.width === template.width && x.height === template.height)
              .map((x) => x.name)
          : []
      }
      columns={columns}
      booleans={booleans}
      computed={computed}
      focus={focus}
      details={details}
      pinned={pinned}
      onTogglePin={(h) =>
        onChangeColumns({
          pinnedProperties: pinned.has(h) ? [...pinned].filter((x) => x !== h) : [...pinned, h]
        })
      }
      onToggleDetails={(h) =>
        setDetails((d) => {
          const next = new Set(d)
          if (next.has(h)) next.delete(h)
          else next.add(h)
          return next
        })
      }
      onChange={onChange}
    />
  )

  const preview = (
    <aside className="preview" data-side={previewSide} style={{ width: previewWidth }}>
      <div className="preview-header">
        <h2>
          {t('preview.title')}
          <PanelSideButton side={previewSide} onToggle={togglePreviewSide} />
        </h2>
        <Segmented<Side>
          value={side}
          options={[
            ['front', t('preview.front'), t('tip.front')],
            ['back', t('preview.back'), t('tip.back')]
          ]}
          onChange={setSide}
        />
      </div>
      {!template ? (
        <p className="muted">{t('preview.noTemplate', { name: set.template })}</p>
      ) : card ? (
        <>
          {big ? (
            <div className="preview-card preview-card-away">
              <button onClick={() => setBig(false)}>{t('preview.closeBig')}</button>
            </div>
          ) : (
            cardStage(PREVIEW_SCALE)
          )}
          <div className="preview-buttons">
            <button
              className="preview-edit"
              title={t('tip.editTemplate', { name: cardTemplateName })}
              onClick={() => onEditTemplate(cardTemplateName, current)}
            >
              <TemplateIcon /> {t('preview.editTemplate')}
            </button>
            {!big && (
              <button className="preview-edit" onClick={() => setBig(true)}>
                ⤢ {t('preview.openBig')}
              </button>
            )}
          </div>
          {card.problems.length > 0 && (
            <div className="problems">
              <h3>{t('preview.problems')}</h3>
              <ul>
                {card.problems.map((p, i) => (
                  <li key={i}>{t(p)}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="muted">
          {sheet.rows.length ? t('preview.selectRow') : t('preview.emptySet')}
        </p>
      )}
      {!big && cardForm}
    </aside>
  )

  return (
    <>
      {previewSide === 'left' && (
        <>
          {preview}
          <Resizer
            width={previewWidth}
            onChange={setPreviewWidth}
            edge="left"
            min={240}
            max={640}
          />
        </>
      )}
      <section className="content" ref={contentRef}>
        <div className="set-header">
          <h1>{set.name}</h1>
          <Menu className="more-button" label="⋯" title={t('app.more')} items={menu} />

          <span className="muted set-template">
            {t('set.templateLabel')}
            <select
              value={set.template}
              title={t('tip.setTemplate')}
              onChange={(e) => onChangeTemplate(e.target.value)}
            >
              {/* un template mancante resta nell'elenco, così si vede quale manca */}
              {!template && <option value={set.template}>{set.template}</option>}
              {templates.map((x) => (
                <option key={x.name} value={x.name}>
                  {x.name}
                </option>
              ))}
            </select>
            · {t('set.counts', { rows: sheet.rows.length, what: words.count(countCards(sheet)) })}
            {readOnly && (
              <span className="readonly-badge" title={t('data.readOnlyHint')}>
                {t('data.readOnlyBadge')}
              </span>
            )}
          </span>
          <span className="spacer" />
          {view === 'grid' && (
            <input
              type="range"
              className="thumb-size"
              min={THUMB_MIN}
              max={THUMB_MAX}
              step={0.1}
              value={thumb}
              title={t('set.thumbSize')}
              onChange={(e) => setThumb(Number(e.target.value))}
            />
          )}
          <Segmented<View>
            value={view}
            options={[
              ['table', t('set.table'), t('tip.tableView')],
              ['grid', t('set.grid'), t('tip.gridView')]
            ]}
            onChange={setView}
          />
        </div>
        {/* carte, struttura del foglio, controlli; Elimina in fondo, lontano da + Carta */}
        <div className="set-actions">
          <span className="action-group">
            <button onClick={addCard} title={t('tip.addCard')}>
              {words.add}
            </button>
            <button disabled={none} onClick={duplicate} title={t('tip.duplicateCards')}>
              {t('set.duplicate')}
            </button>
          </span>
          <span className="action-group">
            <button onClick={() => setAddingColumn(true)} title={t('tip.addColumn')}>
              {t('set.addColumn')}
            </button>
            <ColumnsMenu
              columns={allColumns}
              hidden={hidden}
              showComputed={!!set.showComputed}
              onChange={onChangeColumns}
              onReset={() => {
                onChangeColumns({
                  hiddenColumns: defaultHiddenColumns(allColumns, template, [
                    ...new Set(rowTemplates)
                  ]),
                  showComputed: false
                })
                setDetails(new Set())
              }}
            />
          </span>
          <span className="action-group">
            {/* gli strumenti usati più di rado, in un menu solo */}
            <Menu
              label={`${t('set.tools')} ▾`}
              title={t('tip.setTools')}
              items={[
                {
                  label: t('set.generate'),
                  title: t('tip.generateCards'),
                  onClick: () => setGenerating(true)
                },
                {
                  label: t('set.split'),
                  title: t('tip.split'),
                  disabled: !template,
                  onClick: () => setSplitting(true)
                },
                'sep',
                { label: t('set.stats'), title: t('tip.stats'), onClick: () => setShowStats(true) },
                { label: t('set.compare'), title: t('tip.compare'), onClick: onCompare },
                {
                  label: t('set.textCheck'),
                  title: t('tip.textCheck'),
                  disabled: !template,
                  onClick: () => setCheckingText(true)
                }
              ]}
            />
          </span>
          <span className="action-group">
            <button
              className="danger"
              disabled={none}
              onClick={remove}
              title={t('tip.deleteCards')}
            >
              {t('set.delete')}
            </button>
          </span>
        </div>
        {/* vista: filtro e ordine non cambiano i dati finché non si applica l'ordine */}
        <div className="set-actions set-view-row">
          <input
            type="search"
            className="row-filter"
            placeholder={t('set.filter')}
            title={t('tip.filterRows')}
            value={rowView.filter}
            onChange={(e) => setRowView((v) => ({ ...v, filter: e.target.value }))}
          />
          <select
            className="row-filter-column"
            title={t('tip.filterColumn')}
            value={rowView.filterColumn ?? ''}
            onChange={(e) => setRowView((v) => ({ ...v, filterColumn: e.target.value || null }))}
          >
            <option value="">{t('set.filterAll')}</option>
            {sheet.headers
              .filter((h) => h && !h.includes('.'))
              .map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
          </select>
          {view === 'grid' && (
            <select
              title={t('tip.sortColumn')}
              value={rowView.sort ?? ''}
              onChange={(e) =>
                setRowView((v) => ({ ...v, sort: e.target.value || null, desc: false }))
              }
            >
              <option value="">{t('set.sortNone')}</option>
              {sheet.headers
                .filter((h) => h && !h.includes('.'))
                .map((h) => (
                  <option key={h} value={h}>
                    {t('set.sortBy', { column: h })}
                  </option>
                ))}
            </select>
          )}
          {rowView.sort !== null && (
            <>
              {view === 'grid' && (
                <button
                  title={t('tip.sortDirection')}
                  onClick={() => setRowView((v) => ({ ...v, desc: !v.desc }))}
                >
                  {rowView.desc ? '↓' : '↑'}
                </button>
              )}
              <button
                title={t('tip.applyOrder')}
                onClick={() => {
                  onChange(applyOrder(sheet, rowView))
                  setRowView((v) => ({ ...v, sort: null, desc: false }))
                }}
              >
                {t('set.applyOrder')}
              </button>
            </>
          )}
          {viewActive && (
            <button title={t('tip.clearView')} onClick={() => setRowView(NO_VIEW)}>
              {t('set.clearView')}
            </button>
          )}
          {sheet.rows.length > 0 && (
            <HelpTip text={view === 'grid' && template ? t('set.gridHint') : t('set.editHint')} />
          )}
        </div>
        {compare && (
          <div className="compare-bar set-hint">
            <span className="compare-dot" />
            <span>{t('compare.result', { n: compare.rows.length, since: compare.label })}</span>
            <label className="check">
              <input
                type="checkbox"
                checked={onlyChanged}
                onChange={(e) => setOnlyChanged(e.target.checked)}
              />
              {t('compare.onlyChanged')}
            </label>
            <button onClick={onEndCompare}>{t('compare.end')}</button>
          </div>
        )}
        {selection.length > 1 ? (
          <div className="selection-bar set-hint">
            <strong title={t('set.selectedHint')}>
              {t('set.selected', { what: words.count(selection.length) })}
            </strong>
            {selection.length < order.length && (
              <button title={t('tip.selectAll')} onClick={selectAll}>
                {t('set.selectAll')}
              </button>
            )}
            <button title={t('tip.selectNone')} onClick={() => setSelection([current])}>
              {t('set.selectNone')}
            </button>
          </div>
        ) : viewActive ? (
          <p className="muted small set-hint">
            {t('set.viewHint', { shown: order.length, total: sheet.rows.length })}
          </p>
        ) : null}
        {sheet.rows.length === 0 && (
          <div className="set-empty">
            <p className="set-empty-title">{t('set.emptyTitle')}</p>
            <p className="muted">{t('set.emptyText')}</p>
            {!readOnly && (
              <button className="primary big" onClick={addCard}>
                {t('set.addFirst')}
              </button>
            )}
          </div>
        )}
        {sheet.rows.length === 0 ? null : view === 'table' || !template ? (
          <DataTable
            sheet={sheet}
            columns={columns}
            booleans={booleans}
            computed={computed}
            selected={selection}
            onSelect={setSelection}
            onChange={onChange}
            rows={order}
            sort={{ column: rowView.sort, desc: rowView.desc }}
            onSort={sortBy}
          />
        ) : (
          <CardGrid
            cards={cards}
            side={side}
            selected={current}
            selection={selection}
            onSelect={(i, e) => {
              // come nella tabella: Maiuscolo seleziona un intervallo, ⌘ aggiunge o toglie
              if (e.shiftKey && selection.length) {
                const pa = order.indexOf(current)
                const pb = order.indexOf(i)
                const [a, b] = pa < pb ? [pa, pb] : [pb, pa]
                setSelection([
                  current,
                  ...order.slice(Math.max(0, a), b + 1).filter((r) => r !== current)
                ])
              } else if (e.metaKey || e.ctrlKey) {
                const next = selection.includes(i)
                  ? selection.filter((r) => r !== i)
                  : [...selection, i]
                setSelection(next.length ? next : [i])
              } else setSelection([i])
            }}
            onSelectArea={setSelection}
            onMove={
              viewActive
                ? undefined
                : (rows, before) => {
                    const moved = moveRows(sheet, rows, before)
                    if (moved.sheet === sheet) return
                    onChange(moved.sheet)
                    // la carta trascinata resta quella mostrata accanto
                    const first = moved.rows[rows.indexOf(current)] ?? moved.rows[0]
                    setSelection([first, ...moved.rows.filter((r) => r !== first)])
                  }
            }
            scale={thumb}
            order={order}
            marked={compare ? new Set(compare.rows) : undefined}
          />
        )}
      </section>
      {previewSide === 'right' && (
        <>
          <Resizer
            width={previewWidth}
            onChange={setPreviewWidth}
            edge="right"
            min={240}
            max={640}
          />
          {preview}
        </>
      )}
      {big && card && (
        <Dialog
          title={t('preview.bigTitle', { what: words.title, n: current + 1 })}
          onClose={() => setBig(false)}
        >
          <div className="big-preview">
            <div className="big-preview-bar">
              <button
                disabled={order.indexOf(current) <= 0}
                title={t('preview.prevCard')}
                onClick={() => setSelection([order[order.indexOf(current) - 1]])}
              >
                ←
              </button>
              <Segmented<Side>
                value={side}
                options={[
                  ['front', t('preview.front'), t('tip.front')],
                  ['back', t('preview.back'), t('tip.back')]
                ]}
                onChange={setSide}
              />
              <button
                disabled={order.indexOf(current) >= order.length - 1}
                title={t('preview.nextCard')}
                onClick={() => setSelection([order[order.indexOf(current) + 1]])}
              >
                →
              </button>
            </div>
            <div className="big-preview-body">
              <div className="big-preview-card">
                {cardStage(
                  Math.min(
                    (window.innerHeight - 200) / card.template.height,
                    (window.innerWidth - 560) / card.template.width
                  )
                )}
                <p className="muted small">{t('preview.clickHint')}</p>
              </div>
              <div className="big-preview-form">{cardForm}</div>
            </div>
          </div>
        </Dialog>
      )}
      {checkingText && (
        <TextCheckDialog
          cards={cards}
          onPick={(row) => {
            setSelection([row])
            setCheckingText(false)
          }}
          onClose={() => setCheckingText(false)}
        />
      )}
      {splitting && template && (
        <SplitImageDialog
          sheet={sheet}
          template={template}
          onApply={(s) => {
            onChange(s)
            setSplitting(false)
          }}
          onClose={() => setSplitting(false)}
        />
      )}
      {showStats && (
        <StatsDialog
          sheet={sheet}
          rows={order}
          columns={allColumns}
          template={template}
          templates={templates}
          variables={bindCtx.variables}
          filtered={rowView.filter.trim() !== ''}
          onClose={() => setShowStats(false)}
        />
      )}
      {generating && (
        <GenerateDialog
          sheet={sheet}
          template={template}
          onApply={(s) => {
            onChange(s)
            setGenerating(false)
          }}
          onClose={() => setGenerating(false)}
        />
      )}
      {addingColumn && (
        <AddColumnDialog
          sheet={sheet}
          template={template}
          onAdd={(h) => {
            onChange(addColumn(sheet, h))
            setAddingColumn(false)
          }}
          onClose={() => setAddingColumn(false)}
        />
      )}
    </>
  )
}

const PREVIEW_SCALE = 4.4

/** Il progetto con i riferimenti a una variabile o a uno stile rinominati ovunque */
/** Dove cerca il cerca e sostituisci nel progetto */
function findScope(p: LoadedProject): FindScope {
  return {
    documents: p.documents ?? [],
    notes: p.notes ?? [],
    sets: p.sets,
    templates: p.templates,
    variables: p.file.variables ?? {}
  }
}

function renameReferences(
  p: LoadedProject,
  kind: RefKind,
  from: string,
  to: string
): LoadedProject {
  const renamed = p.templates.map((t) => renameInTemplate(t, kind, from, to))
  // i derivati ricalcolano le differenze; quelli che la rinomina non tocca restano come sono
  const templates = rediffDerived(renamed).map((t, i) =>
    renamed[i] === p.templates[i] ? p.templates[i] : t
  )
  const sets = p.sets.map((x) => {
    if (!x.data) return x
    const tpl = p.templates.find((t) => t.name === x.template) ?? null
    const data = renameInSheet(x.data, tpl, kind, from, to)
    return data === x.data ? x : { ...x, data }
  })
  const defs = renameInDefinitions(p.file.variables ?? {}, p.file.styles ?? {}, kind, from, to)
  return { ...p, templates, sets, file: { ...p.file, ...defs } }
}

/**
 * Livelli sotto il punto, dal più in alto, entrando nei gruppi con i figli dove sono disegnati,
 * ognuno con i gruppi che lo contengono. I livelli che sulla carta non mostrano nulla (testo
 * vuoto, immagine senza file, opacità zero) non coprono quelli sotto.
 */
function hitsAt(
  layers: Layer[],
  p: { x: number; y: number },
  chain: GroupLayer[] = []
): { layer: Layer; chain: GroupLayer[] }[] {
  const out: { layer: Layer; chain: GroupLayer[] }[] = []
  for (const l of layers) {
    if (!hitTest(l, p) || l.opacity <= 0) continue
    if (l.type === 'group') {
      const g = arrangeGroup(l)
      out.push(...hitsAt(g.children, toLocal(l, p), [...chain, g]), { layer: l, chain })
    } else if (!isBlank(l)) out.push({ layer: l, chain })
  }
  return out
}

function isBlank(l: Layer): boolean {
  if (l.type === 'text') return !l.text.trim()
  if (l.type === 'image') return !l.src.trim()
  if (l.type === 'shape') return !l.fill && !l.stroke
  if (l.type === 'grid') return !l.fill && !l.stroke && !l.background && !l.border
  return false
}

const THUMB_MIN = 1.2
const THUMB_MAX = 8

function clampThumb(v: number): number {
  return Math.min(THUMB_MAX, Math.max(THUMB_MIN, v))
}

/** Numero di carte del set, sommando la colonna amount quando presente */
function countCards(sheet: { headers: string[]; rows: string[][] }): number {
  const col = sheet.headers.indexOf('amount')
  if (col < 0) return sheet.rows.length
  return sheet.rows.reduce((sum, r) => {
    const n = parseInt(r[col], 10)
    return sum + (Number.isFinite(n) && n >= 0 ? n : 1)
  }, 0)
}

export default App
