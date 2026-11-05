import { net, protocol } from 'electron'
import { resolve, sep } from 'path'
import { pathToFileURL } from 'url'
import { remoteImage } from './library/urlImages'
import { decodeRemotePath } from '../shared/model/remoteUrl'

// Le immagini del progetto si caricano come gc-asset://project/<percorso sotto assets/>

export const ASSET_SCHEME = 'gc-asset'

let projectFolder: string | null = null

export function setProjectFolder(folder: string): void {
  projectFolder = folder
}

export function getProjectFolder(): string | null {
  return projectFolder
}

export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
    }
  ])
}

export function handleAssetProtocol(): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    const url = new URL(request.url)
    // gc-asset://remote/...: un'immagine collegata da internet, passando dalla cache
    if (url.host === 'remote') {
      const remote = decodeRemotePath(url.pathname)
      const image = remote ? await remoteImage(remote) : null
      if (!image) return new Response('Not found', { status: 404 })
      return new Response(image.data as BodyInit, {
        headers: { 'Content-Type': image.type, 'Access-Control-Allow-Origin': '*' }
      })
    }
    if (!projectFolder) return new Response('No project', { status: 404 })
    const root = resolve(projectFolder, 'assets')
    const rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')
    const file = resolve(root, rel)
    // niente uscite dalla cartella assets con ../
    if (!file.startsWith(root + sep)) return new Response('Forbidden', { status: 403 })
    const res = await net.fetch(pathToFileURL(file).toString())
    // il renderer legge gli SVG con fetch per conoscerne le dimensioni: serve il permesso CORS
    const headers = new Headers(res.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(res.body, { status: res.status, headers })
  })
}
