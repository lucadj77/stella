import { app, net, type WebContents } from 'electron'
import { spawn, execFile } from 'child_process'
import { constants } from 'fs'
import { access, appendFile, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { promisify } from 'util'
import {
  channelFor,
  LATEST_RELEASE_API,
  RELEASES_API,
  updateFromReleases,
  type UpdateChannel,
  type UpdateInfo,
  type UpdateMode
} from '../shared/update'

// Aggiornamento dall'app. Il controllo sceglie la release secondo il canale (Stabile o Beta). Su
// Windows (installato con il setup) e Linux (AppImage) la installa electron-updater, puntato sui
// file latest.yml / latest-linux.yml di quella release, e sostituisce l'app senza firma. Sul Mac Squirrel vuole una firma Apple vera: l'app scarica lo zip della
// release (scaricato così non ha la quarantena), lo estrae accanto a sé e, appena si chiude, uno
// script la sostituisce e la riapre. La versione portabile di Windows e il .deb si aggiornano a
// mano, dalla pagina della release.

const DOWNLOAD = 'https://github.com/lucadj77/stella/releases/download'

/** Il pacchetto .app che contiene questo eseguibile, sul Mac */
function macBundle(): string | null {
  const bundle = resolve(process.execPath, '..', '..', '..')
  return bundle.endsWith('.app') ? bundle : null
}

async function writable(path: string): Promise<boolean> {
  try {
    await access(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

/** Come si aggiorna questa installazione */
export async function updateMode(): Promise<UpdateMode> {
  if (!app.isPackaged) return 'manual'
  if (process.platform === 'win32') return process.env.PORTABLE_EXECUTABLE_DIR ? 'manual' : 'auto'
  if (process.platform === 'linux') return process.env.APPIMAGE ? 'auto' : 'manual'
  if (process.platform === 'darwin') {
    const bundle = macBundle()
    // un'app aperta senza spostarla in Applicazioni gira da una copia temporanea di macOS
    if (!bundle || bundle.includes('/AppTranslocation/')) return 'manual'
    return (await writable(dirname(bundle))) && (await writable(bundle)) ? 'auto' : 'manual'
  }
  return 'manual'
}

/** Il canale scelto in Impostazioni, in <dati dell'app>/update.json */
const channelPath = (): string => join(app.getPath('userData'), 'update.json')

/**
 * Il canale degli aggiornamenti. La prima volta lo si salva secondo la versione: chi ha una beta
 * resta in Beta anche quando riceverà la versione ufficiale, che da sola non lo direbbe più.
 */
export async function updateChannel(): Promise<UpdateChannel> {
  let saved: unknown = null
  try {
    saved = (JSON.parse(await readFile(channelPath(), 'utf8')) as { channel?: unknown }).channel
  } catch {
    // ancora nessuna scelta
  }
  const channel = channelFor(app.getVersion(), saved)
  if (saved !== channel) await setUpdateChannel(channel).catch(() => undefined)
  return channel
}

export async function setUpdateChannel(channel: UpdateChannel): Promise<void> {
  await mkdir(dirname(channelPath()), { recursive: true })
  await writeFile(channelPath(), JSON.stringify({ channel }, null, 2) + '\n')
}

/** La versione da proporre nel canale scelto: la Stabile chiede la sola ultima ufficiale */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const channel = await updateChannel()
  const res = await net.fetch(channel === 'stable' ? LATEST_RELEASE_API : RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `Stella/${app.getVersion()}`
    }
  })
  // senza versioni ufficiali GitHub risponde 404: nessun aggiornamento
  if (res.status === 404 && channel === 'stable') return null
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return updateFromReleases(await res.json(), app.getVersion(), channel)
}

/** Registro dell'aggiornamento, per capire perché non è riuscito: <dati dell'app>/update.log */
export const updateLogPath = (): string => join(app.getPath('userData'), 'update.log')

function log(level: string, args: unknown[]): void {
  const line = `${new Date().toISOString()} ${level} ${args
    .map((a) => (a instanceof Error ? (a.stack ?? a.message) : String(a)))
    .join(' ')}\n`
  appendFile(updateLogPath(), line).catch(() => undefined)
}

const fileLogger = {
  info: (...a: unknown[]): void => log('info', a),
  warn: (...a: unknown[]): void => log('warn', a),
  error: (...a: unknown[]): void => log('error', a),
  debug: (...a: unknown[]): void => log('debug', a)
}

/** Scarica la versione e riavvia l'app aggiornata; il progresso va a sender, da 0 a 1 */
export async function installUpdate(version: string, sender: WebContents): Promise<void> {
  try {
    await install(version, sender)
  } catch (e) {
    log('error', [`update to ${version} failed:`, e])
    throw e
  }
}

async function install(version: string, sender: WebContents): Promise<void> {
  const progress = (p: number): void => {
    if (!sender.isDestroyed()) sender.send('update:progress', p)
  }
  if ((await updateMode()) !== 'auto') throw new Error('this installation updates by hand')
  log('info', [`update ${app.getVersion()} -> ${version} on ${process.platform}`])
  if (process.platform === 'darwin') return installMac(version, progress)
  // electron-updater è CommonJS e definisce autoUpdater con un getter che l'import() di Node non vede
  // come esportazione con nome: va preso da default (module.exports), o è undefined
  const { autoUpdater } = (await import('electron-updater')).default
  autoUpdater.logger = fileLogger
  // senza un ascoltatore un errore dell'installazione chiuderebbe l'app
  if (!autoUpdater.listenerCount('error')) autoUpdater.on('error', (e) => log('error', [e]))
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  // la release scelta dal controllo, non la più recente del feed di GitHub: con le correzioni della
  // stabile (1.2.1) uscite dopo una beta (1.3.0-beta.3) le due direbbero versioni diverse
  autoUpdater.setFeedURL({ provider: 'generic', url: `${DOWNLOAD}/v${version}` })
  autoUpdater.removeAllListeners('download-progress')
  autoUpdater.on('download-progress', (p) => progress(p.percent / 100))
  const found = await autoUpdater.checkForUpdates()
  if (!found?.isUpdateAvailable) throw new Error('no update found')
  await autoUpdater.downloadUpdate()
  progress(1)
  // senza installazione guidata, e l'app si riapre
  setImmediate(() => autoUpdater.quitAndInstall(true, true))
}

async function installMac(version: string, progress: (p: number) => void): Promise<void> {
  const bundle = macBundle()
  if (!bundle) throw new Error('app bundle not found')
  const file = `Stella-${version}-mac-${process.arch}.zip`
  const res = await net.fetch(`${DOWNLOAD}/v${version}/${file}`)
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  const chunks: Uint8Array[] = []
  let got = 0
  const reader = res.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.length
    if (total) progress(Math.min(0.95, (got / total) * 0.95))
  }
  const zip = join(tmpdir(), file)
  await writeFile(zip, Buffer.concat(chunks))
  // estratta nella stessa cartella dell'app: lo scambio è uno spostamento sullo stesso disco
  const staging = join(dirname(bundle), '.stella-update')
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  await promisify(execFile)('/usr/bin/ditto', ['-x', '-k', zip, staging])
  await rm(zip, { force: true })
  const found = (await readdir(staging)).find((n) => n.endsWith('.app'))
  if (!found) throw new Error('no app in the update')
  progress(1)
  // la nuova app prende il proprio nome (Stella.app anche al posto di Naibi.app), a meno che una
  // cartella con quel nome ci sia già: allora resta al posto della vecchia
  const script = [
    'while kill -0 "$STELLA_PID" 2>/dev/null; do sleep 0.3; done',
    'T="$STELLA_TARGET"',
    'if [ "$T" != "$STELLA_OLD" ] && [ -e "$T" ]; then T="$STELLA_OLD"; fi',
    'rm -rf "$STELLA_OLD.old"',
    'if mv "$STELLA_OLD" "$STELLA_OLD.old"; then',
    '  if mv "$STELLA_NEW" "$T"; then rm -rf "$STELLA_OLD.old"; else mv "$STELLA_OLD.old" "$STELLA_OLD"; T="$STELLA_OLD"; fi',
    'else T="$STELLA_OLD"; fi',
    'xattr -cr "$T" 2>/dev/null',
    'rm -rf "$STELLA_STAGING"',
    'open "$T"'
  ].join('\n')
  const child = spawn('/bin/sh', ['-c', script], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      STELLA_PID: String(process.pid),
      STELLA_OLD: bundle,
      STELLA_NEW: join(staging, found),
      STELLA_TARGET: join(dirname(bundle), found),
      STELLA_STAGING: staging
    }
  })
  child.unref()
  setImmediate(() => app.quit())
}
