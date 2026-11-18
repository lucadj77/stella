import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listAssets } from '../assets'
import { moveImages, restoreImages, trashImages } from '../imageFiles'
import { dropDeleted, listDeleted } from '../trash'

let folder: string
const sources = (): Promise<Record<string, unknown>> =>
  readFile(join(folder, 'assets', 'sources.json'), 'utf8').then(JSON.parse)

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'stella-images-'))
  await mkdir(join(folder, 'assets', 'images', 'vecchie'), { recursive: true })
  await mkdir(join(folder, 'assets', 'icons'), { recursive: true })
  await writeFile(join(folder, 'assets', 'images', 'spada.png'), 'png')
  await writeFile(join(folder, 'assets', 'images', 'scudo.png'), 'png')
  await writeFile(join(folder, 'assets', 'images', 'vecchie', 'elmo.png'), 'png')
  await writeFile(join(folder, 'assets', 'icons', 'oro.svg'), '<svg/>')
  await writeFile(
    join(folder, 'assets', 'sources.json'),
    JSON.stringify({
      'icons/oro.svg': { kind: 'icon', source: 'x', license: 'CC0-1.0', title: 'oro', id: 'oro' }
    })
  )
})
afterEach(async () => {
  await rm(folder, { recursive: true, force: true })
})

describe('immagini del progetto', () => {
  it('elimina nel cestino e ripristina al loro posto, con la licenza', async () => {
    const u = await trashImages(folder, ['icons/oro.svg', 'images/vecchie/elmo.png'])
    expect(u.assets).toEqual(['images/scudo.png', 'images/spada.png', 'sources.json'])
    expect(u.sources).toEqual({})
    const list = (await listDeleted(folder)).filter((x) => x.kind === 'image')
    expect(list.map((x) => x.name).sort()).toEqual(['icons/oro.svg', 'images/vecchie/elmo.png'])
    const r = await restoreImages(
      folder,
      list.map((x) => x.file)
    )
    expect(r.paths.sort()).toEqual(['icons/oro.svg', 'images/vecchie/elmo.png'])
    expect(r.update.sources['icons/oro.svg']).toMatchObject({ kind: 'icon' })
    expect((await listDeleted(folder)).length).toBe(0)
  })

  it('al ripristino non sovrascrive un file con lo stesso nome', async () => {
    await trashImages(folder, ['images/spada.png'])
    await writeFile(join(folder, 'assets', 'images', 'spada.png'), 'nuova')
    const [item] = await listDeleted(folder)
    const r = await restoreImages(folder, [item.file])
    expect(r.paths).toEqual(['images/spada 2.png'])
  })

  it('toglie dal cestino per sempre', async () => {
    await trashImages(folder, ['images/spada.png'])
    const [item] = await listDeleted(folder)
    await dropDeleted(folder, [item.file])
    expect(await listDeleted(folder)).toEqual([])
  })

  it("sposta in una cartella nuova, anche dentro un'altra, e sposta la licenza", async () => {
    const r = await moveImages(folder, ['images/spada.png', 'icons/oro.svg'], 'images/Eroi')
    expect(r.moves).toEqual([
      { from: 'images/spada.png', to: 'images/Eroi/spada.png' },
      { from: 'icons/oro.svg', to: 'images/Eroi/oro.svg' }
    ])
    expect(await listAssets(folder)).toEqual([
      'images/Eroi/oro.svg',
      'images/Eroi/spada.png',
      'images/scudo.png',
      'images/vecchie/elmo.png',
      'sources.json'
    ])
    expect(Object.keys(await sources())).toEqual(['images/Eroi/oro.svg'])
  })

  it("si ferma se nella cartella c'è già un file con lo stesso nome", async () => {
    await writeFile(join(folder, 'assets', 'images', 'vecchie', 'spada.png'), 'altra')
    await expect(moveImages(folder, ['images/spada.png'], 'images/vecchie')).rejects.toThrow()
    expect(await listAssets(folder)).toContain('images/spada.png')
  })

  it('rifiuta cartelle fuori da assets e file che non ci sono', async () => {
    await expect(moveImages(folder, ['images/spada.png'], '../fuori')).rejects.toThrow()
    await expect(trashImages(folder, ['../project.json'])).rejects.toThrow()
    await expect(trashImages(folder, ['images/nessuna.png'])).rejects.toThrow()
  })
})
