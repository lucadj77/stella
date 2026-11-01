import { parseDocument, withoutComments, type DocBlock } from './document'

// Le note del progetto si mostrano con il markup del testo delle carte, che non ha tabelle: qui
// la nota si divide in pezzi di testo e tabelle Markdown, che il pannello disegna a parte.

export type TableBlock = Extract<DocBlock, { kind: 'table' }>

export type NotePart = { kind: 'text'; text: string } | { kind: 'table'; table: TableBlock }

export function noteParts(source: string): NotePart[] {
  const src = withoutComments(source.replace(/\r\n?/g, '\n'))
  // le proprietà in testa (---) non sono una tabella: in una nota sono testo come il resto
  const tables = parseDocument(source).filter(
    (b): b is TableBlock => b.kind === 'table' && b.header.length > 0
  )
  const out: NotePart[] = []
  let pos = 0
  const text = (to: number): void => {
    const t = src.slice(pos, to).replace(/^\n+|\n+$/g, '')
    if (t.trim()) out.push({ kind: 'text', text: t })
  }
  for (const t of tables) {
    text(t.from)
    out.push({ kind: 'table', table: t })
    pos = t.to
  }
  text(src.length)
  return out
}
