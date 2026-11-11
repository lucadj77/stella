import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { guideParts, headingAnchor, markWords, plainMarkdown, searchGuide } from '../guideSearch'

const read = (lang: string): string =>
  readFileSync(new URL(`../../../docs/${lang}/README.md`, import.meta.url), 'utf8')

describe('guide search', () => {
  it('gives the same anchors as GitHub', () => {
    expect(headingAnchor('5. Entering and editing components')).toBe(
      '5-entering-and-editing-components'
    )
    expect(headingAnchor("9.1 L'assistente formule")).toBe('91-lassistente-formule')
    expect(headingAnchor('5.7 Componenti in più lingue')).toBe('57-componenti-in-più-lingue')
  })

  it('finds every link of the contents among the sections', () => {
    for (const lang of ['guida', 'guide']) {
      const md = read(lang)
      const anchors = new Set(guideParts(md).map((p) => p.anchor))
      const contents = md.slice(0, md.indexOf('## 1.'))
      const links = [...contents.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1])
      expect(links.length).toBeGreaterThan(20)
      for (const l of links)
        if (!/^(installare-stella|installing-stella)$/.test(l)) expect(anchors).toContain(l)
    }
  })

  it('puts the sections with the words in the title first', () => {
    const parts = guideParts(read('guide'))
    const hits = searchGuide(parts, 'folding dice')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.map((h) => h.part.anchor)).toContain('112-print-pdf')
    const grid = searchGuide(parts, 'grid')
    expect(grid[0].part.title).toMatch(/grid/i)
  })

  it('ignores accents and case', () => {
    const parts = guideParts(read('guida'))
    expect(searchGuide(parts, 'PIU LINGUE').map((h) => h.part.anchor)).toContain(
      '57-componenti-in-più-lingue'
    )
  })

  it('keeps sections inside code blocks out of the headings', () => {
    const parts = guideParts('## A\n\ntext\n\n```\n## not a heading\n```\n\n### B\n\nmore')
    expect(parts.map((p) => p.title)).toEqual(['A', 'B'])
    expect(parts[1].chapter).toBe('A')
  })

  it('turns Markdown into plain text', () => {
    expect(plainMarkdown('**Bold** and [a link](#x) ![img](a.png) `code`')).toBe(
      'Bold and a link code'
    )
  })

  it('marks the words found', () => {
    expect(markWords('Più lingue', 'piu')).toEqual([
      { text: 'Più', hit: true },
      { text: ' lingue', hit: false }
    ])
  })
})

describe('guide paragraphs', () => {
  it('keeps bold lead-ins and list items apart', () => {
    const [part] = guideParts(
      '## A\n\n**Folding dice.** With **To fold** every die.\n\n- **Bleed**: with bleed\n- plain item'
    )
    expect(part.paragraphs).toEqual([
      { lead: 'Folding dice.', text: 'With To fold every die.' },
      { lead: 'Bleed:', text: 'with bleed', item: true },
      { text: 'plain item', item: true }
    ])
    expect(part.text).toContain('Folding dice. With To fold every die.')
  })
})
