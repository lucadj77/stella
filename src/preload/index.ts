import { contextBridge, ipcRenderer, webFrame } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api } from '../shared/api'

const api: Api = {
  isWeb: false,
  chooseProjectFolder: () => ipcRenderer.invoke('project:choose-folder'),
  relocateProject: (mode, text) => ipcRenderer.invoke('project:relocate', mode, text),
  loadProject: (folder) => ipcRenderer.invoke('project:load', folder),
  recentProjects: () => ipcRenderer.invoke('recent:list'),
  removeRecentProject: (folder) => ipcRenderer.invoke('recent:remove', folder),
  prepareExampleProject: (lang) => ipcRenderer.invoke('example:prepare', lang),
  saveThumbnail: (template, context, onlyIfMissing) =>
    ipcRenderer.invoke('project:thumbnail', template, context, onlyIfMissing),
  defaultProjectsFolder: () => ipcRenderer.invoke('project:default-parent'),
  createProject: (name, parent, data, existing) =>
    ipcRenderer.invoke('project:create', name, parent, data, existing),
  chooseDataFile: () => ipcRenderer.invoke('project:choose-data-file'),
  saveTemplate: (template) => ipcRenderer.invoke('template:save', template),
  deleteTemplate: (file) => ipcRenderer.invoke('template:delete', file),
  saveNote: (name, text, oldName) => ipcRenderer.invoke('note:save', name, text, oldName),
  deleteNote: (name) => ipcRenderer.invoke('note:delete', name),
  saveDocument: (name, text, oldName) => ipcRenderer.invoke('document:save', name, text, oldName),
  deleteDocument: (name) => ipcRenderer.invoke('document:delete', name),
  exportDocumentFiles: (files) => ipcRenderer.invoke('document:export-files', files),
  documentPdf: (html) => ipcRenderer.invoke('document:pdf', html),
  listDeleted: () => ipcRenderer.invoke('trash:list'),
  readDeleted: (file) => ipcRenderer.invoke('trash:read', file),
  dropDeleted: (files) => ipcRenderer.invoke('trash:drop', files),
  saveData: (changes) => ipcRenderer.invoke('data:save', changes),
  reloadData: () => ipcRenderer.invoke('project:reload-data'),
  inspectData: () => ipcRenderer.invoke('data:inspect'),
  chooseImportFile: () => ipcRenderer.invoke('data:choose-import'),
  onDataFileChanged: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('project:data-changed', listener)
    return () => ipcRenderer.removeListener('project:data-changed', listener)
  },
  setUiZoom: (factor) => webFrame.setZoomFactor(factor),
  setTheme: (theme) => ipcRenderer.send('theme:set', theme),
  runExport: (job, context) => ipcRenderer.invoke('export:run', job, context),
  cancelExport: () => ipcRenderer.send('export:cancel'),
  onExportProgress: (cb) => {
    const listener = (_: unknown, p: Parameters<typeof cb>[0]): void => cb(p)
    ipcRenderer.on('export:progress', listener)
    return () => ipcRenderer.removeListener('export:progress', listener)
  },
  chooseExportFolder: (current) => ipcRenderer.invoke('export:choose-folder', current),
  saveExportProfiles: (profiles) => ipcRenderer.invoke('export:save-profiles', profiles),
  defaultExportFolders: () => ipcRenderer.invoke('export:default-folders'),
  showFolder: (path) => ipcRenderer.invoke('shell:show-folder', path),
  iconCatalog: (collection) => ipcRenderer.invoke('library:icon-catalog', collection),
  importIcons: (collection, items) => ipcRenderer.invoke('library:import-icons', collection, items),
  fontCatalog: () => ipcRenderer.invoke('library:font-catalog'),
  updateCatalog: (which) => ipcRenderer.invoke('library:update-catalog', which),
  iconifyCollections: () => ipcRenderer.invoke('iconify:collections'),
  iconifyCollection: (prefix) => ipcRenderer.invoke('iconify:collection', prefix),
  iconifySearch: (query, prefix) => ipcRenderer.invoke('iconify:search', query, prefix),
  iconifySvgs: (ids) => ipcRenderer.invoke('iconify:svgs', ids),
  importIconifyIcons: (items) => ipcRenderer.invoke('iconify:import', items),
  downloadFont: (family, variants) => ipcRenderer.invoke('library:download-font', family, variants),
  systemFonts: () => ipcRenderer.invoke('library:system-fonts'),
  copySystemFont: (family) => ipcRenderer.invoke('library:copy-system-font', family),
  addImages: () => ipcRenderer.invoke('library:add-images'),
  dropImages: (files: { name: string; data: Uint8Array }[]) =>
    ipcRenderer.invoke('library:drop-images', files),
  saveCredits: (text) => ipcRenderer.invoke('library:save-credits', text),
  chooseFolder: (current) => ipcRenderer.invoke('folder:choose', current),
  backups: () => ipcRenderer.invoke('backup:list'),
  createBackup: (label) => ipcRenderer.invoke('backup:create', label),
  labelBackup: (file, label) => ipcRenderer.invoke('backup:label', file, label),
  saveBackupSettings: (settings) => ipcRenderer.invoke('backup:settings', settings),
  restoreBackup: (file) => ipcRenderer.invoke('backup:restore', file),
  backupVersion: (file) => ipcRenderer.invoke('backup:version', file),
  readPrinted: () => ipcRenderer.invoke('printed:read'),
  fetchGoogleSheet: (link) => ipcRenderer.invoke('gsheets:fetch', link),
  savePrinted: (state) => ipcRenderer.invoke('printed:save', state),
  defaultTtcTarget: (source) => ipcRenderer.invoke('ttc:default-target', source),
  importTtc: (options) => ipcRenderer.invoke('ttc:import', options),
  stellaCommand: () => ipcRenderer.invoke('ai:command'),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  updateChannel: () => ipcRenderer.invoke('update:channel'),
  setUpdateChannel: (channel) => ipcRenderer.invoke('update:set-channel', channel),
  updateMode: () => ipcRenderer.invoke('update:mode'),
  installUpdate: (version) => ipcRenderer.invoke('update:install', version),
  onUpdateProgress: (cb) => {
    const listener = (_: unknown, p: number): void => cb(p)
    ipcRenderer.on('update:progress', listener)
    return () => ipcRenderer.removeListener('update:progress', listener)
  },
  appVersion: () => ipcRenderer.invoke('app:version'),
  saveSkill: (folder, text) => ipcRenderer.invoke('ai:save-skill', folder, text),
  skillsFolder: () => ipcRenderer.invoke('ai:skills-folder'),
  setAppState: (folder, dirty) => ipcRenderer.invoke('agent:app-state', folder, dirty),
  onAgentLock: (cb) => {
    const listener = (_: unknown, lock: Parameters<typeof cb>[0]): void => cb(lock)
    ipcRenderer.on('agent:lock', listener)
    return () => ipcRenderer.removeListener('agent:lock', listener)
  },
  unlockAgent: () => ipcRenderer.invoke('agent:unlock'),
  setAppMenu: (menus) => ipcRenderer.send('menu:set', menus),
  onMenuCommand: (cb) => {
    const listener = (_: unknown, id: string): void => cb(id)
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.removeListener('menu:command', listener)
  },
  exportPage: {
    onContext: (cb) => ipcRenderer.on('export:context', (_, c) => cb(c)),
    onScene: (cb) => ipcRenderer.on('export:scene', (_, id, scene) => cb(id, scene)),
    ready: () => ipcRenderer.send('export:page-ready'),
    shown: (id, error) => ipcRenderer.send('export:shown', id, error),
    alive: (id) => ipcRenderer.send('export:alive', id)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
