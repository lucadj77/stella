// Ricerca nella guida (docs/guida e docs/guide): la finestra Aiuto la divide in sezioni, una per
// titolo, e trova quelle che contengono tutte le parole cercate. Ogni sezione ha l'ancora che
// GitHub dà al suo titolo, per aprirla nella guida completa.

export interface GuidePart {
  /** Ancora di GitHub, senza # */
  anchor: string
  /** Titolo come si legge, senza i segni del Markdown */
  title: string
  /** 2 per i capitoli (##), 3 e 4 per le sezioni */
  level: number
  /** Capitolo che contiene la sezione, per le sezioni di livello 3 e 4 */
  chapter?: string
  /** Testo della sezione, senza Markdown, con i paragrafi separati da una riga vuota */
  text: string
  /** I paragrafi, con l'inizio in grassetto a parte e le voci di elenco segnate */
  paragraphs: GuideParagraph[]
}

export interface GuideParagraph {
  /** Le prime parole in grassetto, come «Dadi da piegare.» o «Abbondanza» */
  lead?: string
  text: string
  /** Voce di un elenco */
  item?: boolean
  /** Un'immagine della guida al posto del testo: src come nel Markdown (img/editor.png) */
  image?: { src: string; alt: string }
}

export interface GuideHit {
  part: GuidePart
  /** Un pezzo del testo attorno alla prima parola trovata, o l'inizio della sezione */
  snippet: string
}

/** L'ancora che GitHub dà a un titolo: minuscole, senza punteggiatura, spazi in trattini */
export function headingAnchor(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\- _]/gu, '')
    .replace(/ /g, '-')
}

/** Testo semplice da una riga di Markdown: niente immagini, link solo con il testo, niente segni */
export function plainMarkdown(md: string): string {
  return md
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '')
    .replace(/<\/?(table|tr|td|th|tbody|thead)[^>]*>/g, ' ')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\s)_(\S)/g, '$1$2')
    .replace(/(\S)_(\s|$|[.,;:])/g, '$1$2')
    .replace(/\\([|*_[\]{}`])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** Un paragrafo di Markdown: il segno dell'elenco e l'inizio in grassetto messi a parte */
function paragraphOf(md: string): GuideParagraph {
  const item = /^([-*]|\d+\.)\s+/.exec(md)
  const rest = item ? md.slice(item[0].length) : md
  const bold = /^\*\*([^*]+)\*\*(:?)\s*/.exec(rest)
  const out: GuideParagraph = bold
    ? { lead: plainMarkdown(bold[1] + bold[2]), text: plainMarkdown(rest.slice(bold[0].length)) }
    : { text: plainMarkdown(rest) }
  return item ? { ...out, item: true } : out
}

/** Le immagini della cartella img/ in una riga: ![alt](img/…) da sola o <img src="img/…" alt="…"> */
function imagesOf(line: string): { src: string; alt: string }[] {
  const md = /^\s*!\[([^\]]*)\]\((img\/[^)\s]+)\)\s*$/.exec(line)
  if (md) return [{ src: md[2], alt: md[1] }]
  if (/^\s*\|/.test(line)) return []
  const out: { src: string; alt: string }[] = []
  for (const m of line.matchAll(/<img\b[^>]*>/g)) {
    const src = /\bsrc="(img\/[^"]+)"/.exec(m[0])
    if (src) out.push({ src: src[1], alt: /\balt="([^"]*)"/.exec(m[0])?.[1] ?? '' })
  }
  return out
}

/** Le righe di una tabella Markdown come testo: celle separate da « · », senza la riga dei trattini */
function tableLine(line: string): string | null {
  const cells = line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim())
  if (cells.every((c) => /^:?-+:?$/.test(c))) return null
  return cells.filter(Boolean).join(' · ')
}

/** La guida divisa in sezioni, una per titolo di livello 2, 3 o 4; l'indice resta fuori */
export function guideParts(md: string): GuidePart[] {
  const parts: GuidePart[] = []
  const used = new Map<string, number>()
  let current: { part: GuidePart; lines: string[] } | null = null
  let chapter: string | undefined
  let fence = false
  const close = (): void => {
    if (!current) return
    const paragraphs: GuideParagraph[] = []
    let para: string[] = []
    const flush = (): void => {
      if (para.length) paragraphs.push(paragraphOf(para.join(' ')))
      para = []
    }
    for (const raw of current.lines) {
      const line = raw.trimEnd()
      if (!line.trim()) {
        flush()
        continue
      }
      // le immagini della guida, da sole su una riga o nelle tabelle HTML che le affiancano
      const images = imagesOf(line)
      if (images.length) {
        flush()
        for (const image of images) paragraphs.push({ text: '', image })
        continue
      }
      if (/^\s*\|/.test(line)) {
        flush()
        const row = tableLine(line)
        if (row) paragraphs.push({ text: plainMarkdown(row) })
        continue
      }
      // una voce di un elenco comincia un paragrafo suo
      if (/^\s*([-*]|\d+\.)\s/.test(line)) flush()
      para.push(line.trim())
    }
    flush()
    current.part.paragraphs = paragraphs.filter((p) => p.text || p.lead || p.image)
    current.part.text = current.part.paragraphs
      .filter((p) => !p.image)
      .map((p) => (p.lead ? p.lead + (p.text ? ' ' + p.text : '') : p.text))
      .join('\n\n')
    parts.push(current.part)
    current = null
  }
  for (const line of md.split('\n')) {
    if (/^(```|````)/.test(line.trim())) fence = !fence
    const m = fence ? null : /^(#{2,4})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) {
      current?.lines.push(line)
      continue
    }
    close()
    const level = m[1].length
    const title = plainMarkdown(m[2])
    const base = headingAnchor(m[2].replace(/[*`]/g, ''))
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    const anchor = n ? `${base}-${n}` : base
    if (level === 2) chapter = title
    // l'indice dei capitoli è solo un elenco di link
    if (level === 2 && /^(contents|indice)$/i.test(title)) continue
    current = {
      part: {
        anchor,
        title,
        level,
        ...(level > 2 && chapter ? { chapter } : {}),
        text: '',
        paragraphs: []
      },
      lines: []
    }
  }
  close()
  return parts
}

/** Minuscole e senza accenti, per trovare «modalita» in «modalità» */
function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Le sezioni che contengono tutte le parole, prima quelle con le parole nel titolo */
export function searchGuide(parts: GuidePart[], query: string, limit = 30): GuideHit[] {
  const words = fold(query)
    .split(/\s+/)
    .filter((w) => w.length > 0)
  if (!words.length || words.join('').length < 2) return []
  const scored: { hit: GuideHit; score: number; order: number }[] = []
  parts.forEach((part, order) => {
    const title = fold(part.title)
    const text = fold(part.text)
    if (!words.every((w) => title.includes(w) || text.includes(w))) return
    let score = 0
    for (const w of words) {
      if (title.includes(w)) score += 10
      score += Math.min(5, text.split(w).length - 1)
    }
    scored.push({ hit: { part, snippet: snippetOf(part.text, words) }, score, order })
  })
  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.hit)
}

/** Il pezzo di testo attorno alla prima parola trovata, a parole intere */
function snippetOf(text: string, words: string[]): string {
  const flat = text.replace(/\n+/g, ' ')
  const folded = fold(flat)
  const at = Math.min(...words.map((w) => folded.indexOf(w)).filter((i) => i >= 0))
  if (!Number.isFinite(at)) return cut(flat, 0)
  // il testo piegato ha la stessa lunghezza dell'originale per le lettere accentate comuni
  return cut(flat, Math.max(0, at - 60))
}

function cut(text: string, from: number, size = 200): string {
  let start = from
  if (start > 0) {
    const space = text.indexOf(' ', start)
    start = space >= 0 && space < start + 20 ? space + 1 : start
  }
  let end = Math.min(text.length, start + size)
  if (end < text.length) {
    const space = text.lastIndexOf(' ', end)
    if (space > start + size / 2) end = space
  }
  return (start > 0 ? '… ' : '') + text.slice(start, end) + (end < text.length ? ' …' : '')
}

/** I pezzi di un testo, segnando quelli che sono parole cercate (per evidenziarle) */
export function markWords(text: string, query: string): { text: string; hit: boolean }[] {
  const words = fold(query)
    .split(/\s+/)
    .filter((w) => w.length > 1)
  if (!words.length) return [{ text, hit: false }]
  const folded = fold(text)
  // la piegatura toglie gli accenti senza cambiare la lunghezza delle lettere comuni
  if (folded.length !== text.length) return [{ text, hit: false }]
  const marks = new Array<boolean>(text.length).fill(false)
  for (const w of words) {
    for (let i = folded.indexOf(w); i >= 0; i = folded.indexOf(w, i + w.length))
      marks.fill(true, i, i + w.length)
  }
  const out: { text: string; hit: boolean }[] = []
  for (let i = 0; i < text.length;) {
    let j = i
    while (j < text.length && marks[j] === marks[i]) j++
    out.push({ text: text.slice(i, j), hit: marks[i] })
    i = j
  }
  return out
}
