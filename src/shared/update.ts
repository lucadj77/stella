// Controllo degli aggiornamenti: l'app confronta la propria versione con l'ultima release
// pubblicata su GitHub e ne mostra le novità. Le note arrivano da CHANGELOG.md, con una parte in
// inglese e una in italiano. Le versioni con un suffisso (1.2.0-beta.1)
// sono beta: le segnala solo a chi ha scelto il canale Beta.

/** Le ultime release, beta comprese: per il canale Beta */
export const RELEASES_API = 'https://api.github.com/repos/lucadj77/stella/releases?per_page=30'
/** L'ultima release ufficiale (GitHub non vi conta le pre-release): per il canale Stabile */
export const LATEST_RELEASE_API = 'https://api.github.com/repos/lucadj77/stella/releases/latest'

/** stable: solo le versioni ufficiali; beta: anche le beta, e le ufficiali più recenti */
export type UpdateChannel = 'stable' | 'beta'

/**
 * Il canale di un'installazione: quello scelto, o senza scelta Beta per chi ha una beta (i
 * collaudatori restano in beta anche dopo la versione ufficiale) e Stabile per gli altri
 */
export function channelFor(version: string, saved: unknown): UpdateChannel {
  if (saved === 'stable' || saved === 'beta') return saved
  return isPrerelease(version) ? 'beta' : 'stable'
}

/** auto: l'app si aggiorna da sola; manual: si scarica il pacchetto dalla pagina della release */
export type UpdateMode = 'auto' | 'manual'

export interface UpdateInfo {
  /** Versione senza la v iniziale, per esempio 1.1.0 */
  version: string
  /** Note della release in Markdown */
  notes: string
  /** Pagina della release, da cui si scaricano i pacchetti */
  url: string
}

/** Le parti di una versione: v1.2.0-beta.1 → [1, 2, 0] e il suffisso beta.1 */
function parse(version: string): { nums: number[]; pre: string[] } {
  const [main, ...rest] = version.trim().replace(/^v/, '').split('-')
  const nums = main.split('.').map((p) => parseInt(p, 10) || 0)
  return { nums, pre: rest.length ? rest.join('-').split('.') : [] }
}

/** Una beta: la versione ha un suffisso dopo il trattino */
export function isPrerelease(version: string): boolean {
  return parse(version).pre.length > 0
}

/**
 * Positivo se a è più recente di b, negativo se è più vecchia, 0 se sono uguali. Come in semver,
 * una beta viene prima della versione ufficiale con lo stesso numero: 1.2.0-beta.2 < 1.2.0.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < 3; i++) {
    const d = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0)
    if (d) return d
  }
  if (!pa.pre.length || !pb.pre.length) return pb.pre.length - pa.pre.length
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const x = pa.pre[i]
    const y = pb.pre[i]
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1
    const nx = /^\d+$/.test(x) ? Number(x) : null
    const ny = /^\d+$/.test(y) ? Number(y) : null
    if (nx !== null && ny !== null) {
      if (nx !== ny) return nx - ny
    } else if (x !== y) return nx !== null ? -1 : ny !== null ? 1 : x < y ? -1 : 1
  }
  return 0
}

/**
 * L'aggiornamento da proporre tra le release di GitHub (un elenco, o la sola ultima ufficiale): la
 * più recente, se lo è più della versione corrente. Le beta valgono solo per il canale Beta. Chi
 * passa da Beta a Stabile non torna indietro: aspetta la prima ufficiale più recente della sua beta.
 */
export function updateFromReleases(
  releases: unknown,
  current: string,
  channel: UpdateChannel = channelFor(current, null)
): UpdateInfo | null {
  const list = Array.isArray(releases) ? releases : releases ? [releases] : []
  const beta = channel === 'beta'
  let best: Record<string, unknown> | null = null
  for (const r of list) {
    if (!r || typeof r !== 'object') continue
    const tag = (r as Record<string, unknown>).tag_name
    if (typeof tag !== 'string' || (r as Record<string, unknown>).draft) continue
    if (!beta && (isPrerelease(tag) || (r as Record<string, unknown>).prerelease)) continue
    if (compareVersions(tag, current) <= 0) continue
    if (!best || compareVersions(tag, best.tag_name as string) > 0)
      best = r as Record<string, unknown>
  }
  if (!best) return null
  return {
    version: (best.tag_name as string).replace(/^v/, ''),
    notes: typeof best.body === 'string' ? best.body : '',
    url: typeof best.html_url === 'string' ? best.html_url : ''
  }
}

/**
 * La parte delle note nella lingua dell'interfaccia: le note hanno un titolo per lingua
 * ("### Italiano", "### English"). Senza titoli si mostrano per intero.
 */
export function notesForLanguage(notes: string, lang: string): string {
  const sections = new Map<string, string[]>()
  let current: string[] | null = null
  const before: string[] = []
  for (const line of notes.replace(/\r\n/g, '\n').split('\n')) {
    const m = /^#{1,4}\s*(Italiano|English)\s*$/i.exec(line)
    if (m) {
      current = []
      sections.set(m[1].toLowerCase() === 'italiano' ? 'it' : 'en', current)
    } else (current ?? before).push(line)
  }
  const chosen = sections.get(lang) ?? sections.get('en') ?? before
  return chosen.join('\n').trim()
}

/** La sezione di CHANGELOG.md per una versione: le righe sotto "## 1.1.0" fino alla successiva */
export function changelogSection(changelog: string, version: string): string | null {
  const lines = changelog.replace(/\r\n/g, '\n').split('\n')
  const v = version.replace(/^v/, '')
  const start = lines.findIndex((l) =>
    new RegExp(`^##\\s+v?${v.replace(/\./g, '\\.')}(?=\\s|$)`).test(l)
  )
  if (start < 0) return null
  const end = lines.findIndex((l, i) => i > start && /^##\s/.test(l))
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .trim()
}
