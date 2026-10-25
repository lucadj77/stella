import { resolve } from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// Versione web (src/web): la stessa interfaccia dell'app, con window.api fatta nel browser. Il
// codice dei progetti in src/main/project usa fs/promises e path di Node: qui diventano gli
// shims sopra la File System Access API. Vedi docs/web.md.

const shims = resolve('src/web/shims')

/**
 * I cataloghi inclusi (resources/catalogs) si importano con ?asset, che in electron-vite dà il
 * percorso del file: qui diventano file della build, letti con fetch da shims/fs.ts
 */
function assetFiles(): Plugin {
  return {
    name: 'stella-asset-files',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!source.endsWith('?asset')) return null
      const r = await this.resolve(source.slice(0, -6), importer, { skipSelf: true })
      // l'id non finisce in .json: il plugin dei JSON di Vite proverebbe a leggerlo
      return r ? `\0stella-asset:${r.id}.js` : null
    },
    load(id) {
      if (!id.startsWith('\0stella-asset:')) return null
      const file = id.slice('\0stella-asset:'.length, -'.js'.length)
      return `import url from ${JSON.stringify(file + '?url')}\nexport default 'web-asset:' + url`
    }
  }
}

export default defineConfig({
  root: 'src/web',
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    alias: [
      { find: '@renderer', replacement: resolve('src/renderer/src') },
      { find: /^(node:)?fs\/promises$/, replacement: resolve(shims, 'fs.ts') },
      { find: /^(node:)?fs$/, replacement: resolve(shims, 'fsSync.ts') },
      { find: /^(node:)?path$/, replacement: resolve(shims, 'path.ts') },
      { find: /^(node:)?zlib$/, replacement: resolve(shims, 'zlib.ts') },
      { find: /^(node:)?url$/, replacement: resolve(shims, 'url.ts') },
      { find: /^(node:)?crypto$/, replacement: resolve(shims, 'crypto.ts') },
      { find: /^electron$/, replacement: resolve(shims, 'electron.ts') }
    ]
  },
  plugins: [assetFiles(), react()],
  build: {
    outDir: resolve('out/web'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000
  }
})
