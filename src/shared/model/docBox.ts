// Riquadri dei documenti: uno sfondo colorato (e se si vuole un bordo) che comincia e finisce dove
// si decide, per dare risalto a un pezzo di testo o staccare dal foglio immagini bianche senza
// bordo. Il Markdown non ha un modo per dirlo: Stella scrive due commenti attorno ai blocchi,
//   <!-- box fill=#fff3c4 border=#e0b000 -->
//   ...titoli, paragrafi, elenchi, tabelle, carte...
//   <!-- /box -->
// che gli altri programmi non mostrano e l'esportazione in Markdown non scrive.

export interface BoxStyle {
  /** Sfondo (anche una variabile del progetto); null per nessuno */
  fill: string | null
  /** Colore del bordo; null per nessun bordo */
  border: string | null
  /** Spessore del bordo in mm */
  borderWidth: number
  /** Spazio tra il bordo e il contenuto, in mm */
  padding: number
  /** Raggio degli angoli in mm */
  radius: number
  /** Larghezza in frazione della riga (width=40%); null = tutta, o metà se ha il testo accanto */
  width: number | null
  /** Il testo che segue scorre accanto, con il riquadro a sinistra o a destra (wrap=left) */
  wrap: 'left' | 'right' | null
}

export const DEFAULT_BOX_STYLE: BoxStyle = {
  fill: '#f3f3f0',
  border: null,
  borderWidth: 0.3,
  padding: 3,
  radius: 0,
  width: null,
  wrap: null
}

/** Un riquadro nel testo del documento */
export interface DocBox {
  style: BoxStyle
  /** Opzioni che non si capiscono */
  bad: string[]
  /** Inizio e fine della riga che apre il riquadro */
  from: number
  headTo: number
  /** Inizio della riga che lo chiude; null se manca (il riquadro va fino in fondo) */
  endFrom: number | null
  /** Fine della riga che lo chiude, o del documento */
  to: number
}

const START = /^\s*<!--\s*box(\s(?:(?!-->).)*)?-->\s*$/
const END = /^\s*<!--\s*\/box\s*-->\s*$/

export const isBoxStart = (line: string): boolean => START.test(line)
export const isBoxEnd = (line: string): boolean => END.test(line)

export const BOX_END_LINE = '<!-- /box -->'

/** Legge la riga che apre il riquadro; `bad` sono le opzioni che non si capiscono */
export function parseBoxStyle(line: string): { style: BoxStyle; bad: string[] } {
  const style: BoxStyle = { ...DEFAULT_BOX_STYLE }
  const bad: string[] = []
  const body = START.exec(line)?.[1] ?? ''
  const color = (v: string): string | null => (v === 'none' || v === '' ? null : v)
  for (const part of body.trim().split(/\s+/)) {
    if (!part) continue
    const eq = part.indexOf('=')
    const k = eq < 0 ? part : part.slice(0, eq)
    const v = eq < 0 ? '' : part.slice(eq + 1)
    const n = parseFloat(v)
    if (k === 'fill') style.fill = color(v)
    else if (k === 'border') style.border = color(v)
    else if (k === 'borderWidth' && n >= 0) style.borderWidth = n
    else if (k === 'padding' && n >= 0) style.padding = n
    else if (k === 'radius' && n >= 0) style.radius = n
    else if (k === 'width' && /^\d+(?:[.,]\d+)?%$/.test(v) && n >= 10 && n <= 100)
      style.width = parseFloat(v.replace(',', '.')) / 100
    else if (k === 'wrap' && (v === 'left' || v === 'right' || v === 'none'))
      style.wrap = v === 'none' ? null : v
    else bad.push(part)
  }
  return { style, bad }
}

/** La riga che apre il riquadro, solo con ciò che cambia rispetto a quello di base */
export function boxStartLine(s: BoxStyle): string {
  const d = DEFAULT_BOX_STYLE
  const opts: string[] = []
  const color = (c: string | null): string => c ?? 'none'
  if (s.fill !== d.fill) opts.push(`fill=${color(s.fill)}`)
  if (s.border !== d.border) opts.push(`border=${color(s.border)}`)
  if (s.border !== null && s.borderWidth !== d.borderWidth)
    opts.push(`borderWidth=${round(s.borderWidth)}`)
  if (s.padding !== d.padding) opts.push(`padding=${round(s.padding)}`)
  if (s.radius !== d.radius) opts.push(`radius=${round(s.radius)}`)
  if (s.width && s.width < 1) opts.push(`width=${round(s.width * 100)}%`)
  if (s.wrap) opts.push(`wrap=${s.wrap}`)
  return `<!-- box${opts.map((o) => ' ' + o).join('')} -->`
}

const round = (n: number): string => String(Math.round(n * 100) / 100)

/**
 * Mette in un riquadro le righe tra from e to (prese intere), o un riquadro con `sample` al
 * cursore se non c'è una selezione. Restituisce il testo nuovo e dove mettere il cursore.
 */
export function wrapInBox(
  src: string,
  from: number,
  to: number,
  style: BoxStyle,
  sample: string
): { text: string; caret: number } {
  const head = boxStartLine(style)
  if (from === to) {
    const before = src.slice(0, from)
    const after = src.slice(from)
    const lead = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const tail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    const block = `${head}\n\n${sample}\n\n${BOX_END_LINE}`
    const caret = before.length + lead.length + head.length + 2 + sample.length
    return { text: before + lead + block + tail + after, caret }
  }
  const start = src.lastIndexOf('\n', from - 1) + 1
  // una selezione che finisce a inizio riga non prende quella riga
  const last = to > from && src[to - 1] === '\n' ? to - 1 : to
  const nl = src.indexOf('\n', last)
  const end = nl < 0 ? src.length : nl
  const inner = src.slice(start, end)
  const before = src.slice(0, start)
  const after = src.slice(end)
  const lead = !before || before.endsWith('\n\n') ? '' : '\n'
  const tail = !after || after.startsWith('\n\n') ? '' : '\n'
  const block = `${head}\n\n${inner}\n\n${BOX_END_LINE}`
  return {
    text: before + lead + block + tail + after,
    caret: before.length + lead.length + block.length
  }
}

/** Toglie il riquadro e lascia il contenuto */
export function unwrapBox(src: string, box: DocBox): string {
  const skipBlank = (at: number): number => (src.slice(at, at + 2) === '\n\n' ? at + 1 : at)
  if (box.endFrom === null) return src.slice(0, box.from) + src.slice(skipBlank(box.headTo) + 1)
  return (
    src.slice(0, box.from) +
    src.slice(skipBlank(box.headTo) + 1, box.endFrom).replace(/\n+$/, '\n') +
    src.slice(box.to + 1)
  )
}
