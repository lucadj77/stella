// Il filtro del contorno (render/outline.tsx) come elementi del DOM, per l'esportazione in SVG.

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Sfocatura di base che toglie i gradini, nelle unità del filtro */
export const softOf = (r: number): number => Math.max(0.5, r * 0.3)

/**
 * Le primitive del filtro: la sagoma (alfa) allargata di r in ogni direzione. feMorphology
 * allarga solo a rettangolo; tre rettangoli (largo, alto, quadrato a 45°) insieme fanno quasi un
 * cerchio, e una sfocatura riportata a bordo netto toglie i gradini.
 */
function primitives(r: number, color: string, soft: number): [string, Record<string, string>][] {
  const k = Math.SQRT2 - 1
  const d = Math.SQRT1_2
  return [
    [
      'feMorphology',
      { in: 'SourceAlpha', operator: 'dilate', radius: `${r} ${r * k}`, result: 'o1' }
    ],
    [
      'feMorphology',
      { in: 'SourceAlpha', operator: 'dilate', radius: `${r * k} ${r}`, result: 'o2' }
    ],
    [
      'feMorphology',
      { in: 'SourceAlpha', operator: 'dilate', radius: `${r * d} ${r * d}`, result: 'o3' }
    ],
    ['feMerge', { result: 'grown', '>': 'o1 o2 o3' }],
    // i gradini dei rettangoli si ammorbidiscono: sfocatura, poi di nuovo un bordo netto a metà
    ['feGaussianBlur', { in: 'grown', stdDeviation: String(soft) }],
    ['feComponentTransfer', { result: 'smooth', '>alpha': '8 -3.5' }],
    ['feFlood', { 'flood-color': color }],
    ['feComposite', { in2: 'smooth', operator: 'in' }],
    ['feMerge', { '>': ' SourceGraphic' }]
  ]
}

/**
 * Lo stesso filtro come elemento del DOM, per l'esportazione in SVG. La regione è quella
 * dell'oggetto, allargata di un lato per parte: basta per i contorni delle icone.
 */
export function outlineFilterElement(id: string, r: number, color: string): SVGFilterElement {
  const f = document.createElementNS(SVG_NS, 'filter')
  f.id = id
  for (const [k, v] of Object.entries({ x: '-100%', y: '-100%', width: '300%', height: '300%' }))
    f.setAttribute(k, v)
  f.setAttribute('primitiveUnits', 'userSpaceOnUse')
  for (const [tag, attrs] of primitives(r, color, softOf(r))) {
    const el = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (k === '>') {
        // i figli di feMerge: nomi separati da spazi, uno vuoto è il risultato precedente
        for (const name of v.split(' ')) {
          const node = document.createElementNS(SVG_NS, 'feMergeNode')
          if (name) node.setAttribute('in', name)
          el.appendChild(node)
        }
      } else if (k === '>alpha') {
        const [slope, intercept] = v.split(' ')
        const a = document.createElementNS(SVG_NS, 'feFuncA')
        a.setAttribute('type', 'linear')
        a.setAttribute('slope', slope)
        a.setAttribute('intercept', intercept)
        el.appendChild(a)
      } else el.setAttribute(k, v)
    }
    f.appendChild(el)
  }
  return f
}
