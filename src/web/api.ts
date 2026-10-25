import { mkdir, onFileChange, readFile, writeFile } from './shims/fs'
import { basename, dirname, join } from './shims/path'
import type { Api, BackupSettings, BackupState } from '../shared/api'
import type { ExportProgress } from '../shared/export'
import { MessageError, msg } from '../shared/messages'
import { browserViewable } from '../shared/viewable'
import { loadProject } from '../main/project/load'
import { saveTemplate, trashTemplate } from '../main/project/templates'
import { saveDocument, saveNote, trashDocument, trashNote } from '../main/project/notes'
import { writeDocumentExport } from '../main/project/docExport'
import { dropDeleted, listDeleted, readDeleted } from '../main/project/trash'
import { readBackupVersion, readPrinted, savePrinted } from '../main/project/versions'
import { fetchGoogleSheet } from '../main/project/googleSheets'
import { createProject } from '../main/project/create'
import { saveData } from '../main/project/save'
import { inspectDataFile } from '../main/project/inspect'
import { saveExportProfiles } from '../main/project/exportProfiles'
import { runExport } from '../main/export/run'
import { fontCatalog, iconCatalog } from '../main/library/catalogs'
import { importIcons } from '../main/library/icons'
import {
  iconifyCollection,
  iconifyCollections,
  iconifySearch,
  iconifySvgs,
  importIconifyIcons
} from '../main/library/iconify'
import {
  autoBackup,
  backupsSize,
  createBackup,
  listBackups,
  readBackupSettings,
  restoreBackup,
  writeBackupSettings
} from '../main/project/backup'
import { backupDirFor, backupSettingsFile } from '../main/project/backupPaths'
import { defaultTarget, importTtc } from '../main/import/ttc'
import { readRealPath, realPathMatches, toRealPath, virtualRoot } from '../shared/realPath'
import { ensurePermission, hasPermission, pickFolder } from './fs/roots'
import { assetChanged, assetUrl, openAssets } from './assets'
import { addImages, copySystemFont, downloadGoogleFont, dropImages, systemFonts } from './library'
import { addRecent, hasThumbnail, listRecent, removeRecent, saveThumbnail } from './recent'
import { FrameWindow, exportPageApi } from './exportFrame'
import { prepareWebExample } from './example'

// window.api nella versione web: le stesse funzioni dell'app desktop (src/preload), fatte nel
// browser. Il codice dei progetti è quello di src/main/project, che qui legge e scrive i file
// attraverso shims/fs.ts. Ciò che il browser non può fare resta solo nell'app desktop.

let folder: string | null = null
let projectName = ''
/** Modifiche non salvate nel progetto aperto: il browser avvisa prima di chiudere la scheda */
let dirty = false
let cancelled = false
const progressListeners = new Set<(p: ExportProgress) => void>()

addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault()
})

function projectFolder(): string {
  if (!folder) throw new MessageError(msg('template.noProject'))
  return folder
}

// i file scritti sotto assets/ (icone, font, immagini) devono avere subito il loro URL
onFileChange(assetChanged)

/** Un backup alla volta, come nell'app desktop */
let backupQueue: Promise<unknown> = Promise.resolve()
function queued<T>(job: () => Promise<T>): Promise<T> {
  const p = backupQueue.then(job)
  backupQueue = p.catch(() => undefined)
  return p
}

/**
 * Cartella dei backup del progetto aperto. Senza una cartella scelta stanno nello spazio del sito
 * (DATA_ROOT), che il browser non mostra; una cartella scelta va autorizzata a ogni sessione.
 */
async function backupDir(settings?: BackupSettings, ask = true): Promise<string> {
  const s = settings ?? (await readBackupSettings(backupSettingsFile()))
  if (s.folder && !(await (ask ? ensurePermission(s.folder) : hasPermission(s.folder))))
    throw new MessageError(msg('web.permissionDenied'))
  return (await backupDirFor(projectFolder(), projectName, s)).dir
}

async function backupState(): Promise<BackupState> {
  const settings = await readBackupSettings(backupSettingsFile())
  const dir = await backupDir(settings)
  return {
    folder: dir,
    defaultFolder: '',
    settings,
    items: await listBackups(dir),
    totalSize: await backupsSize(dir)
  }
}

/** Il percorso vero di un file nella cartella di Tabletop Simulator, scritto dall'utente */
function ttsRealPath(file: string): { path: string; platform: string } {
  const real = readRealPath(file)
  if (!real) throw new MessageError(msg('web.ttsRealPathMissing'))
  return toRealPath(file, real)
}

const desktopOnly = (): Promise<never> => Promise.reject(new MessageError(msg('web.desktopOnly')))

export const webApi: Api = {
  isWeb: true,
  assetUrl,
  chooseProjectFolder: () => pickFolder('stella-project'),
  recentProjects: () => listRecent(),
  removeRecentProject: (f) => removeRecent(f),
  // l'esempio incluso nella build, copiato nello spazio del sito
  prepareExampleProject: (lang) => prepareWebExample(lang),
  saveThumbnail: async (template, context, onlyIfMissing) => {
    const f = folder
    if (!f || (onlyIfMissing && (await hasThumbnail(f)))) return
    await saveThumbnail(f, template, context)
  },
  defaultProjectsFolder: async () => '',
  // nel browser non c'è un percorso da copiare: il file dei dati si mette poi nella cartella
  chooseDataFile: async () => null,
  createProject: async (name, parent, data) => {
    if (!parent) throw new MessageError(msg('web.chooseParent'))
    if (!(await ensurePermission(parent))) throw new MessageError(msg('web.permissionDenied'))
    return createProject(name, parent, data)
  },
  loadProject: async (f) => {
    // il browser chiede il permesso sulla cartella a ogni sessione
    if (!(await ensurePermission(f))) throw new MessageError(msg('web.permissionDenied'))
    const project = await loadProject(f)
    await openAssets(f)
    folder = f
    projectName = project.file.name || f
    // il backup automatico parte solo se la sua cartella è già autorizzata: chiederlo qui
    // farebbe apparire una seconda richiesta del browser all'apertura
    readBackupSettings(backupSettingsFile())
      .then(async (settings) => {
        const dir = await backupDir(settings, false)
        const name = projectName
        return queued(() => autoBackup(f, name, dir, settings))
      })
      .catch((e) => console.error(e))
    await addRecent(f, project.file.name).catch((e) => console.error(e))
    return project
  },
  saveTemplate: (template) => saveTemplate(projectFolder(), template),
  deleteTemplate: (file) => trashTemplate(projectFolder(), file),
  saveNote: (name, text, oldName) => saveNote(projectFolder(), name, text, oldName),
  deleteNote: (name) => trashNote(projectFolder(), name),
  saveDocument: (name, text, oldName) => saveDocument(projectFolder(), name, text, oldName),
  deleteDocument: (name) => trashDocument(projectFolder(), name),
  exportDocumentFiles: (files) => writeDocumentExport(projectFolder(), files),
  documentPdf: desktopOnly,
  listDeleted: () => listDeleted(projectFolder()),
  readDeleted: (file) => readDeleted(projectFolder(), file),
  dropDeleted: (files) => dropDeleted(projectFolder(), files),
  saveData: (changes) => saveData(projectFolder(), changes),
  reloadData: () => loadProject(projectFolder()),
  // nel browser l'importazione da un altro file non c'è ancora: il pulsante è nascosto
  chooseImportFile: async () => null,
  inspectData: async () => {
    const project = await loadProject(projectFolder())
    return inspectDataFile(join(projectFolder(), project.file.dataFile))
  },
  onDataFileChanged: () => () => undefined,
  // l'ingrandimento è quello del browser (Ctrl + e Ctrl −)
  setUiZoom: () => undefined,
  setTheme: () => undefined,
  runExport: (job, context) => {
    cancelled = false
    if (job.kind === 'tts') {
      // vedi ExportDialog: nel web solo la cartella di Tabletop Simulator, scelta dall'utente
      if (!job.options.ttsFolder) throw new MessageError(msg('web.ttsChooseFolder'))
      const real = readRealPath(job.options.ttsFolder)
      if (!real) throw new MessageError(msg('web.ttsRealPathMissing'))
      if (!realPathMatches(job.options.ttsFolder, real))
        throw new MessageError(
          msg('web.ttsRealPathMismatch', { folder: virtualRoot(job.options.ttsFolder).slice(1) })
        )
      job = { ...job, options: { ...job.options, destination: 'tts' } }
    }
    return runExport(job, {
      realPath: ttsRealPath,
      openWindow: (c) => FrameWindow.open(c),
      projectFolder: projectFolder(),
      platform: 'web',
      home: '',
      documents: '',
      context,
      onProgress: (p) => progressListeners.forEach((l) => l(p)),
      isCancelled: () => cancelled
    })
  },
  cancelExport: () => {
    cancelled = true
  },
  onExportProgress: (cb) => {
    progressListeners.add(cb)
    return () => progressListeners.delete(cb)
  },
  chooseExportFolder: () => pickFolder('stella-export'),
  saveExportProfiles: async (profiles) => {
    if (folder) await saveExportProfiles(folder, profiles)
  },
  defaultExportFolders: async () => ({ export: folder ? join(folder, 'export') : '', tts: '' }),
  showFolder: (path) => openExportedFile(path),
  iconCatalog: (collection) => iconCatalog(collection),
  importIcons: (collection, items) => importIcons(projectFolder(), collection, items),
  // il catalogo è quello della versione pubblicata, che si aggiorna con il sito
  updateCatalog: desktopOnly,
  iconifyCollections: () => iconifyCollections(),
  iconifyCollection: (prefix) => iconifyCollection(prefix),
  iconifySearch: (query, prefix) => iconifySearch(query, prefix),
  iconifySvgs: (ids) => iconifySvgs(ids),
  importIconifyIcons: (items) => importIconifyIcons(projectFolder(), items),
  fontCatalog: () => fontCatalog(),
  downloadFont: (family, variants) => downloadGoogleFont(projectFolder(), family, variants),
  systemFonts: () => systemFonts(),
  copySystemFont: (family) => copySystemFont(projectFolder(), family),
  addImages: () => addImages(projectFolder()),
  dropImages: (files) => dropImages(projectFolder(), files),
  saveCredits: async (text) => {
    const dir = join(projectFolder(), 'export')
    await mkdir(dir, { recursive: true })
    const file = join(dir, 'credits.txt')
    await writeFile(file, text)
    return file
  },
  chooseFolder: () => pickFolder('stella-folder'),
  backups: () => backupState(),
  createBackup: async () => {
    const f = projectFolder()
    const dir = await backupDir()
    const name = projectName
    return queued(() => createBackup(f, name, dir))
  },
  saveBackupSettings: async (settings) => {
    await writeBackupSettings(backupSettingsFile(), settings)
    return backupState()
  },
  // si estraggono solo i backup del progetto aperto, nella cartella scelta dall'utente: la finestra
  // del browser va aperta subito dopo il clic, quindi la apre BackupDialog prima di chiamare qui
  restoreBackup: async (file, parent) => {
    const dir = await backupDir()
    if (dirname(file) !== dir) throw new Error('not a backup')
    if (!parent) throw new MessageError(msg('web.restoreCancelled'))
    return restoreBackup(file, parent)
  },
  backupVersion: async (file) => {
    if (dirname(file) !== (await backupDir())) throw new Error('not a backup')
    return readBackupVersion(file)
  },
  readPrinted: () => readPrinted(projectFolder()),
  fetchGoogleSheet: (link) => fetchGoogleSheet(link),
  savePrinted: (state) => savePrinted(projectFolder(), state),
  // accanto all'originale solo se la cartella scelta lo contiene; altrimenti la si sceglie
  defaultTtcTarget: async (source) => (dirname(source) === '/' ? '' : defaultTarget(source)),
  importTtc: async (options) => {
    for (const p of [options.source, options.target, options.iconFolder])
      if (p && !(await ensurePermission(p))) throw new MessageError(msg('web.permissionDenied'))
    return importTtc(options)
  },
  // il comando lo trova la skill: l'app desktop se c'è, se no il pacchetto stella-cli
  stellaCommand: async () => ({ command: '', ready: true }),
  // chi apre il sito ha sempre l'ultima versione
  checkForUpdate: async () => null,
  // la versione web stabile sta in /app/, la beta in /beta/
  updateChannel: async () =>
    /\/beta\/?$/.test(location.pathname.replace(/[^/]*$/, '')) ? 'beta' : 'stable',
  setUpdateChannel: async () => {},
  updateMode: async () => 'manual',
  installUpdate: async () => {},
  onUpdateProgress: () => () => {},
  appVersion: async () => __APP_VERSION__,
  saveSkill: desktopOnly,
  skillsFolder: desktopOnly,
  setAppState: async (f, d) => {
    dirty = !!f && d
  },
  onAgentLock: () => () => undefined,
  unlockAgent: async () => undefined,
  setAppMenu: () => undefined,
  onMenuCommand: () => () => undefined,
  exportPage: exportPageApi() ?? {
    onContext: () => undefined,
    onScene: () => undefined,
    ready: () => undefined,
    shown: () => undefined,
    alive: () => undefined
  }
}

/**
 * Nel browser le cartelle non si aprono: un file esportato si apre in una scheda nuova, o si
 * scarica se il browser non sa mostrarlo (Word). Una cartella non fa nulla.
 */
async function openExportedFile(path: string): Promise<string> {
  const name = basename(path)
  if (!name.includes('.')) return ''
  const type = browserViewable(path)
  // la scheda si apre subito, durante il clic: dopo un'attesa il browser la bloccherebbe
  const tab = type ? window.open('', '_blank') : null
  let data: string | Uint8Array
  try {
    data = await readFile(path)
  } catch {
    tab?.close()
    return ''
  }
  const url = URL.createObjectURL(
    new Blob([data as BlobPart], { type: type ?? 'application/octet-stream' })
  )
  if (tab) tab.location.href = url
  else {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return ''
}
