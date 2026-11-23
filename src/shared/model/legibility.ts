import { parseHex, parseRgbFunction, type Rgba } from './colorMath'
import { kindOf, type ComponentKind, type Template } from './template'
import { VISION_MATRICES, type Vision } from '../vision'

// Leggibilità dei componenti: quanto devono essere grandi testi e icone per la distanza da cui
// si leggono al tavolo, contrasto, colori che si confondono per chi li vede in modo diverso,
// numeri che capovolti diventano altri. Sono solo avvisi: l'esportazione non si blocca mai.
//
// La misura che conta è l'altezza della x (le minuscole), come angolo visivo: 0,2° si legge
// comodamente, 0,1° è il limite. A 40 cm, 0,2° sono 1,4 mm di x, circa 8 pt con un font comune.

/** Distanze di lettura proposte, in cm */
export const READING_DISTANCES = [
  { id: 'hand', cm: 40 },
  { id: 'front', cm: 70 },
  { id: 'center', cm: 100 },
  { id: 'across', cm: 150 }
] as const
export type ReadingDistanceId = (typeof READING_DISTANCES)[number]['id']

/** Angolo dell'altezza della x che si legge comodamente, e quello al limite */
export const COMFORT_DEG = 0.2
export const LIMIT_DEG = 0.1
/** Con «vista ridotta» le misure minime crescono della metà */
export const REDUCED_VISION = 1.5
/** Un'icona si riconosce se è alta almeno il doppio della x che si legge comodamente */
export const ICON_FACTOR = 2
/** Altezza della x rispetto al corpo, quando non si può misurare il font */
export const DEFAULT_X_RATIO = 0.5
export const PT_MM = 25.4 / 72

/** Distanza e lettura capovolta proposte per tipo di componente */
const KIND_DEFAULTS: Record<ComponentKind, { cm: number; upsideDown: boolean }> = {
  card: { cm: 40, upsideDown: false },
  token: { cm: 100, upsideDown: true },
  tile: { cm: 100, upsideDown: true },
  board: { cm: 100, upsideDown: true },
  die: { cm: 70, upsideDown: true },
  standee: { cm: 100, upsideDown: false }
}

/** Distanza da cui si legge di solito un tipo di componente, e se si legge anche capovolto */
export function readingOf(t: Pick<Template, 'kind'>): { cm: number; upsideDown: boolean } {
  return KIND_DEFAULTS[kindOf(t)]
}

const tan = (deg: number): number => Math.tan((deg * Math.PI) / 180)

/** Altezza minima in mm perché un dettaglio sotto l'angolo `deg` si veda da `cm` */
export function minHeightMm(cm: number, deg: number, reduced = false): number {
  return cm * 10 * tan(deg) * (reduced ? REDUCED_VISION : 1)
}

/** Fino a che distanza (cm) si vede un dettaglio alto `mm` sotto l'angolo `deg` */
export function readableUpToCm(mm: number, deg: number, reduced = false): number {
  return mm / tan(deg) / 10 / (reduced ? REDUCED_VISION : 1)
}

/** Altezza della x in mm di un testo di `pt` punti */
export function xHeightMm(pt: number, ratio = DEFAULT_X_RATIO): number {
  return pt * PT_MM * ratio
}

export type SizeVerdict = 'ok' | 'small' | 'tooSmall'

/** Un testo con la x alta `mm` letto da `cm`: comodo, piccolo (sotto 0,2°) o troppo (sotto 0,1°) */
export function textVerdict(mm: number, cm: number, reduced = false): SizeVerdict {
  if (mm >= minHeightMm(cm, COMFORT_DEG, reduced) - 1e-9) return 'ok'
  return mm >= minHeightMm(cm, LIMIT_DEG, reduced) - 1e-9 ? 'small' : 'tooSmall'
}

/** Un'icona alta `mm` letta da `cm` */
export function iconVerdict(mm: number, cm: number, reduced = false): SizeVerdict {
  return textVerdict(mm / ICON_FACTOR, cm, reduced)
}

/**
 * Sfocatura che simula la distanza nella barra della visione: la deviazione della gaussiana è
 * un quarto dell'altezza della x al limite (0,1°), così i testi sotto il limite si impastano e
 * quelli comodi restano leggibili. Come frazione di larghezza e altezza del componente, che non
 * dipende da quanto è grande la miniatura; null senza distanza.
 */
export function visionBlurOf(
  t: Pick<Template, 'width' | 'height'>,
  cm: number
): [number, number] | null {
  if (!(cm > 0) || !(t.width > 0) || !(t.height > 0)) return null
  const sigma = minHeightMm(cm, LIMIT_DEG) / 4
  return [sigma / t.width, sigma / t.height]
}

// --- colori ---

/** Colore da un codice o da rgb(); null per i colori che non si leggono (sfumature, nomi) */
export function parseColor(text: string | null | undefined): Rgba | null {
  if (!text) return null
  return parseHex(text) ?? parseRgbFunction(text)
}

const linear = (c: number): number => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const gamma = (l: number): number => {
  const v = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

/** Luminanza relativa (WCAG 2) */
export function luminance(c: Rgba): number {
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b)
}

/** Rapporto di contrasto WCAG fra due colori: da 1 a 21 */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Contrasto minimo: 4,5 per il testo normale, 3 per quello grande (dai 18 pt, o 14 in grassetto) */
export function minContrast(pt: number, weight: number): number {
  return pt >= 18 || (pt >= 14 && weight >= 700) ? 3 : 4.5
}

/** Un colore come lo vede chi ha una delle visioni simulate (le matrici dell'anteprima) */
export function simulate(c: Rgba, v: Vision): Rgba {
  if (v === 'normal') return c
  const m = VISION_MATRICES[v]
  const l = [linear(c.r), linear(c.g), linear(c.b)]
  const [r, g, b] = m.map((row) => gamma(row[0] * l[0] + row[1] * l[1] + row[2] * l[2]))
  return { r, g, b, a: c.a }
}

function toLab(c: Rgba): [number, number, number] {
  const [r, g, b] = [linear(c.r), linear(c.g), linear(c.b)]
  // sRGB → XYZ (D65), normalizzato sul bianco
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** Differenza fra due colori CIEDE2000: sotto 10 due colori di pieno si confondono facilmente */
export function deltaE2000(c1: Rgba, c2: Rgba): number {
  const [L1, a1, b1] = toLab(c1)
  const [L2, a2, b2] = toLab(c2)
  const rad = Math.PI / 180
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cm = (C1 + C2) / 2
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const h = (b: number, a: number): number => {
    if (a === 0 && b === 0) return 0
    const v = Math.atan2(b, a) / rad
    return v < 0 ? v + 360 : v
  }
  const h1p = h(b1, a1p)
  const h2p = h(b2, a2p)
  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad)
  const Lpm = (L1 + L2) / 2
  const Cpm = (C1p + C2p) / 2
  let hpm = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hpm += h1p + h2p < 360 ? 360 : -360
    hpm /= 2
  }
  const T =
    1 -
    0.17 * Math.cos((hpm - 30) * rad) +
    0.24 * Math.cos(2 * hpm * rad) +
    0.32 * Math.cos((3 * hpm + 6) * rad) -
    0.2 * Math.cos((4 * hpm - 63) * rad)
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2))
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7))
  const Sl = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2)
  const Sc = 1 + 0.045 * Cpm
  const Sh = 1 + 0.015 * Cpm * T
  const Rt = -Math.sin(2 * dTheta * rad) * Rc
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh)
  )
}

/** Sotto questa differenza due colori si confondono */
export const CONFUSED_DE = 10
/** Le visioni simulate nel controllo dei colori */
export const CHECKED_VISIONS = ['protan', 'deutan', 'tritan'] as const

/**
 * Le coppie di colori ben distinte a vista normale che si confondono con una delle visioni
 * simulate: per ognuna la visione con la differenza più piccola
 */
export function confusedPairs(
  colors: string[]
): { a: string; b: string; vision: (typeof CHECKED_VISIONS)[number]; deltaE: number }[] {
  const parsed = colors
    .map((c) => [c, parseColor(c)] as const)
    .filter((x): x is readonly [string, Rgba] => !!x[1] && x[1].a > 0.5)
  const out: ReturnType<typeof confusedPairs> = []
  for (let i = 0; i < parsed.length; i++)
    for (let j = i + 1; j < parsed.length; j++) {
      const [a, ca] = parsed[i]
      const [b, cb] = parsed[j]
      if (deltaE2000(ca, cb) < CONFUSED_DE * 2) continue
      let worst: (typeof out)[number] | null = null
      for (const v of CHECKED_VISIONS) {
        const d = deltaE2000(simulate(ca, v), simulate(cb, v))
        if (d < CONFUSED_DE && (!worst || d < worst.deltaE)) worst = { a, b, vision: v, deltaE: d }
      }
      if (worst) out.push(worst)
    }
  return out
}

// --- capovolto ---

const FLIP: Record<string, string> = { '0': '0', '1': '1', '6': '9', '8': '8', '9': '6' }

/**
 * Il numero che si legge girando il componente di 180° se è un altro numero (6 → 9, 16 → 91),
 * altrimenti null. Solo testi fatti di cifre, senza un segno che li distingua (come 6. o 6̲)
 */
export function upsideDownReading(text: string): string | null {
  const s = text.trim()
  if (!/^\d+$/.test(s) || ![...s].every((c) => c in FLIP)) return null
  const flipped = [...s]
    .reverse()
    .map((c) => FLIP[c])
    .join('')
  if (flipped === s || flipped.startsWith('0')) return null
  return flipped
}

// --- colore come unico segnale ---

/**
 * Le carte si dividono in gruppi per il colore di un livello: il colore è l'unico segnale se
 * nessun altro livello (testo o immagine) ha un valore uguale dentro ogni gruppo e diverso fra i
 * gruppi. `colors` e i valori degli altri livelli sono per carta, nello stesso ordine.
 */
export function colorIsOnlySignal(
  colors: (string | null)[],
  others: Record<string, (string | null)[]>
): boolean {
  const groups = new Map<string, number[]>()
  colors.forEach((c, i) => {
    if (c === null) return
    const list = groups.get(c) ?? []
    list.push(i)
    groups.set(c, list)
  })
  // servono almeno due gruppi, e almeno un gruppo con più di una carta per capirne la regola
  if (groups.size < 2 || ![...groups.values()].some((g) => g.length > 1)) return false
  for (const values of Object.values(others)) {
    const per = [...groups.values()].map((g) => new Set(g.map((i) => values[i] ?? '')))
    if (per.some((s) => s.size !== 1)) continue
    const keys = per.map((s) => [...s][0])
    if (new Set(keys).size === keys.length && keys.every((k) => k !== '')) return false
  }
  return true
}
