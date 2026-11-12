// Condizioni di IF e ELSEIF di nanDECK: confronti (=, <>, <, >, <=, >=, @ contenuto in,
// # non contenuto in) tra parentesi, uniti con _NOT_, _AND_ e _OR_ (in quest'ordine di
// precedenza), più _TRUE_ e _FALSE_.

export type CondNode =
  | { kind: 'and' | 'or'; items: CondNode[] }
  | { kind: 'not'; item: CondNode }
  | { kind: 'const'; value: boolean }
  | { kind: 'atom'; left: string; op: string | null; right: string }

const KEYWORD = /^_(AND|OR|NOT|TRUE|FALSE)_/i

/** Albero di una condizione; null se le parentesi non tornano */
export function parseCondition(text: string): CondNode | null {
  let i = 0
  const s = text
  const skip = (): void => {
    while (i < s.length && /\s/.test(s[i])) i++
  }
  const keyword = (k: string): boolean => {
    skip()
    const m = KEYWORD.exec(s.slice(i))
    if (m && m[1].toUpperCase() === k) {
      i += m[0].length
      return true
    }
    return false
  }
  const or = (): CondNode | null => {
    const items = [and()]
    while (keyword('OR')) items.push(and())
    if (items.some((x) => !x)) return null
    return items.length === 1 ? items[0] : { kind: 'or', items: items as CondNode[] }
  }
  const and = (): CondNode | null => {
    const items = [not()]
    while (keyword('AND')) items.push(not())
    if (items.some((x) => !x)) return null
    return items.length === 1 ? items[0] : { kind: 'and', items: items as CondNode[] }
  }
  const not = (): CondNode | null => {
    if (keyword('NOT')) {
      const item = not()
      return item && { kind: 'not', item }
    }
    if (keyword('TRUE')) return { kind: 'const', value: true }
    if (keyword('FALSE')) return { kind: 'const', value: false }
    skip()
    if (s[i] === '(' && closesGroup(s, i)) {
      i++
      const inner = or()
      skip()
      if (s[i] !== ')') return null
      i++
      return inner
    }
    return atom()
  }
  const atom = (): CondNode | null => {
    const start = i
    let depth = 0
    while (i < s.length) {
      const c = s[i]
      if ('([{'.includes(c)) depth++
      else if (')]}'.includes(c)) {
        if (depth === 0) break
        depth--
      } else if (depth === 0 && c === '_' && KEYWORD.test(s.slice(i))) break
      i++
    }
    const t = s.slice(start, i).trim()
    if (!t) return null
    return splitAtom(t)
  }
  const tree = or()
  skip()
  return tree && i >= s.length ? tree : null
}

/**
 * Una parentesi che apre un gruppo logico, non un'espressione come ({(n)}+1)=3: il gruppo
 * contiene un operatore di confronto o una parola chiave fuori dalle parentesi interne
 */
function closesGroup(s: string, at: number): boolean {
  let depth = 0
  for (let j = at; j < s.length; j++) {
    const c = s[j]
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) {
      depth--
      if (depth === 0) {
        // dopo la parentesi chiusa non deve esserci un altro confronto
        const rest = s.slice(j + 1).trim()
        return rest === '' || KEYWORD.test(rest) || rest.startsWith(')')
      }
    }
  }
  return false
}

function splitAtom(t: string): CondNode {
  let depth = 0
  for (let j = 0; j < t.length; j++) {
    const c = t[j]
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth--
    else if (depth === 0) {
      const op = /^(<>|<=|>=|=|<|>|@|#)/.exec(t.slice(j))?.[1]
      if (op) return { kind: 'atom', left: t.slice(0, j), op, right: t.slice(j + op.length) }
    }
  }
  return { kind: 'atom', left: t, op: null, right: '' }
}

/** Valore della condizione; value dà il testo di un lato (etichette e espressioni già calcolate) */
export function evaluateCondition(
  node: CondNode,
  value: (side: string) => string,
  compare: (a: string, op: string, b: string) => boolean
): boolean {
  switch (node.kind) {
    case 'const':
      return node.value
    case 'not':
      return !evaluateCondition(node.item, value, compare)
    case 'and':
      return node.items.every((x) => evaluateCondition(x, value, compare))
    case 'or':
      return node.items.some((x) => evaluateCondition(x, value, compare))
    case 'atom': {
      const a = value(node.left).trim()
      if (node.op === null) return !!a && a !== '0'
      const b = value(node.right).trim()
      // @: il primo valore sta nel secondo
      if (node.op === '@') return b.toLowerCase().includes(a.toLowerCase())
      if (node.op === '#') return !b.toLowerCase().includes(a.toLowerCase())
      return compare(a, node.op, b)
    }
  }
}
