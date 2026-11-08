import { describe, expect, it } from 'vitest'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { deflateSync, inflateSync } from 'zlib'
import ExcelJS from 'exceljs'

// La prima carta disegnata da un processo nuovo deve uscire uguale alle altre. Un testo
// "adatta: ingrandisci" fatto solo di icone misurava il corpo prima che le immagini fossero
// caricate (larghe zero) e sceglieva un corpo troppo grande; dalla seconda carta le immagini
// erano già in memoria e la misura era giusta.
//
// Il test disegna con il comando stella, quindi usa l'app compilata in out/: va eseguito dopo
// `npx electron-vite build`, e senza la compilazione si salta. Su Linux senza schermo serve
// xvfb-run.

const root = join(__dirname, '..', '..', '..')
const built = existsSync(join(root, 'out', 'renderer', 'index.html'))
const linuxHeadless = process.platform === 'linux' && !process.env.DISPLAY
const xvfb = linuxHeadless && spawnSync('which', ['xvfb-run']).status === 0
const canRun = built && (!linuxHeadless || xvfb)

/** Un PNG quadrato con un cerchio colorato su fondo trasparente */
function circlePng(size: number, [r, g, b]: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf: Buffer): number => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8)
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const c = size / 2
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    for (let x = 0; x < size; x++) {
      if ((x - c) ** 2 + (y - c) ** 2 > (c * 0.95) ** 2) continue
      raw.set([r, g, b, 255], row + 1 + x * 4)
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** Pixel di un PNG a 8 bit non interlacciato (RGB o RGBA, come li scrive Chromium) */
function decodePng(file: Buffer): { width: number; height: number; channels: number; px: Buffer } {
  let pos = 8
  let width = 0
  let height = 0
  let channels = 0
  const data: Buffer[] = []
  while (pos < file.length) {
    const len = file.readUInt32BE(pos)
    const type = file.toString('ascii', pos + 4, pos + 8)
    const body = file.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      channels = body[9] === 6 ? 4 : 3
    } else if (type === 'IDAT') data.push(body)
    pos += 12 + len
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * channels
  const px = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? px[y * stride + x - channels] : 0
      const b = y > 0 ? px[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0
      const pred =
        filter === 1
          ? a
          : filter === 2
            ? b
            : filter === 3
              ? (a + b) >> 1
              : filter === 4
                ? (() => {
                    const p = a + b - c
                    const pa = Math.abs(p - a)
                    const pb = Math.abs(p - b)
                    const pc = Math.abs(p - c)
                    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
                  })()
                : 0
      px[y * stride + x] = (line[x] + pred) & 0xff
    }
  }
  return { width, height, channels, px }
}

/**
 * Pixel molto diversi tra due immagini. L'antialiasing delle icone grandi rimpicciolite cambia
 * un po' da un'esecuzione all'altra (poche decine di livelli): conta solo una differenza netta,
 * come quella delle icone spostate da un corpo sbagliato.
 */
function differentPixels(a: Buffer, b: Buffer): number {
  const x = decodePng(a)
  const y = decodePng(b)
  if (x.width !== y.width || x.height !== y.height || x.channels !== y.channels) return Infinity
  let count = 0
  for (let i = 0; i < x.px.length; i += x.channels) {
    let max = 0
    for (let c = 0; c < x.channels; c++) max = Math.max(max, Math.abs(x.px[i + c] - y.px[i + c]))
    if (max > 100) count++
  }
  return count
}

async function makeProject(dir: string, tint?: string): Promise<void> {
  mkdirSync(join(dir, 'assets', 'images'), { recursive: true })
  mkdirSync(join(dir, 'data'))
  mkdirSync(join(dir, 'templates'))
  const icons: Record<string, [number, number, number]> = {
    avi: [192, 57, 43],
    osc: [41, 128, 185],
    stu: [39, 174, 96]
  }
  // immagini grandi, come quelle del progetto in cui è comparso il difetto
  for (const [name, color] of Object.entries(icons))
    writeFileSync(join(dir, 'assets', 'images', `${name}.png`), circlePng(1181, color))
  writeFileSync(
    join(dir, 'stella.json'),
    JSON.stringify({
      formatVersion: 1,
      name: 'First card',
      dataFile: 'data/cards.xlsx',
      sets: [{ name: 'influence', template: 'influence' }],
      variables: Object.fromEntries(
        Object.keys(icons).map((n) => [n, { type: 'image', src: n, scale: 0.7, tint }])
      )
    })
  )
  writeFileSync(
    join(dir, 'templates', 'influence.json'),
    JSON.stringify({
      name: 'influence',
      width: 63,
      height: 88,
      bleed: 0,
      front: [
        {
          type: 'text',
          name: 'prefs',
          x: 5,
          y: 30,
          w: 53,
          h: 20,
          rotation: 106.6,
          text: '{avi}>{osc}>{stu}',
          weight: 900,
          letterSpacing: -200,
          padding: 1,
          fit: 'grow',
          maxSize: 80,
          color: '#000000',
          align: 'center',
          valign: 'middle'
        },
        { type: 'shape', name: 'bg', shape: 'rect', x: 0, y: 0, w: 63, h: 88, fill: '#ffffff' }
      ]
    })
  )
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('influence')
  sheet.addRow(['name'])
  for (let i = 1; i <= 3; i++) sheet.addRow([`card ${i}`])
  await book.xlsx.writeFile(join(dir, 'data', 'cards.xlsx'))
}

function render(project: string, out: string, extra: string[] = []): void {
  const args = [
    join(root, 'bin', 'stella.mjs'),
    'render',
    project,
    '--set',
    'influence',
    '--out',
    out,
    ...extra
  ]
  const r = xvfb
    ? spawnSync('xvfb-run', ['-a', process.execPath, ...args], { encoding: 'utf8' })
    : spawnSync(process.execPath, args, { encoding: 'utf8' })
  expect(r.status, r.stderr).toBe(0)
}

describe.skipIf(!canRun)('prima carta di un processo nuovo', () => {
  // con la tinta l'icona è disegnata come maschera, e la larghezza viene dalle proporzioni
  it.each([
    ['icone', undefined],
    ['icone colorate', '#333333']
  ])(
    'un testo grow fatto di %s esce uguale nella prima carta e nelle seguenti',
    async (_, tint) => {
      const dir = mkdtempSync(join(tmpdir(), 'stella-first-card-'))
      try {
        const project = join(dir, 'project')
        await makeProject(project, tint)
        render(project, join(dir, 'all'))
        const card = (out: string, n: number): Buffer =>
          readFileSync(join(dir, out, 'influence', `${n}.png`))
        // le carte sono uguali: la prima deve coincidere con le altre
        expect(differentPixels(card('all', 1), card('all', 2))).toBe(0)
        expect(differentPixels(card('all', 1), card('all', 3))).toBe(0)
        // una carta sola, disegnata per prima in un altro processo, come dopo un'altra carta
        render(project, join(dir, 'one'), ['--card', '3'])
        expect(differentPixels(card('one', 3), card('all', 2))).toBe(0)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
    180000
  )
})
