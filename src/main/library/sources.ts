import { readFile } from 'fs/promises'
import { join } from 'path'
import { writeFileSafe } from '../fs'
import { SOURCES_FILE, type AssetsUpdate, type Sources } from '../../shared/library'
import { listAssets } from '../project/assets'
import { readProjectFonts } from '../project/fonts'

// assets/sources.json: provenienza e licenza dei file importati, una voce per percorso

export async function readSources(folder: string): Promise<Sources> {
  try {
    const data = JSON.parse(await readFile(join(folder, 'assets', SOURCES_FILE), 'utf8'))
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  } catch {
    return {}
  }
}

/** Aggiunge o sostituisce voci, togliendo quelle dei file che non esistono più */
export async function updateSources(folder: string, entries: Sources): Promise<Sources> {
  const assets = new Set(await listAssets(folder))
  const all = { ...(await readSources(folder)), ...entries }
  const kept = Object.fromEntries(
    Object.entries(all)
      .filter(([path]) => assets.has(path))
      .sort(([a], [b]) => a.localeCompare(b))
  )
  // file temporaneo e rinomina: un arresto a metà non lascia un sources.json troncato
  const file = join(folder, 'assets', SOURCES_FILE)
  await writeFileSafe(file, JSON.stringify(kept, null, 2) + '\n')
  return kept
}

export async function assetsUpdate(folder: string, sources?: Sources): Promise<AssetsUpdate> {
  const assets = await listAssets(folder)
  return {
    assets,
    fonts: await readProjectFonts(folder, assets),
    sources: sources ?? (await readSources(folder))
  }
}
