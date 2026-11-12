// Espressioni numeriche degli script nanDECK: + - * / ^, parentesi, numeri con il punto
// decimale (anche .5) e percentuali. Una percentuale vale quella parte di `percent`, cioè della
// misura a cui si riferisce il parametro (larghezza o altezza della carta, o del frame).

type Token = { kind: 'num'; value: number } | { kind: 'op'; value: string }

function tokenize(text: string, percent: number | null): Token[] | null {
  const out: Token[] = []
  let i = 0
  const s = text.replace(/%%/g, '%')
  while (i < s.length) {
    const c = s[i]
    if (c === ' ' || c === '\t') {
      i++
      continue
    }
    const num = /^(\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i))
    if (num) {
      let value = Number(num[0])
      i += num[0].length
      if (s[i] === '%') {
        if (percent === null) return null
        value = (value / 100) * percent
        i++
      }
      out.push({ kind: 'num', value })
      continue
    }
    if ('+-*/^()'.includes(c)) {
      out.push({ kind: 'op', value: c })
      i++
      continue
    }
    return null
  }
  return out
}

/**
 * Valore numerico dell'espressione, o null se non è un'espressione (testo, nomi, simboli).
 * `percent` è la misura che corrisponde al 100%; null se le percentuali non hanno senso.
 */
export function evalNumber(text: string, percent: number | null = null): number | null {
  const t = text.trim()
  if (!t) return null
  const tokens = tokenize(t, percent)
  if (!tokens || !tokens.length) return null
  let pos = 0
  const peek = (): Token | undefined => tokens[pos]
  const isOp = (v: string): boolean => {
    const p = peek()
    return !!p && p.kind === 'op' && p.value === v
  }
  const primary = (): number | null => {
    const p = peek()
    if (!p) return null
    if (p.kind === 'num') {
      pos++
      return p.value
    }
    if (p.value === '(') {
      pos++
      const v = sum()
      if (v === null || !isOp(')')) return null
      pos++
      return v
    }
    if (p.value === '-' || p.value === '+') {
      pos++
      const v = power()
      return v === null ? null : p.value === '-' ? -v : v
    }
    return null
  }
  const power = (): number | null => {
    const base = primary()
    if (base === null) return null
    if (isOp('^')) {
      pos++
      const exp = power()
      return exp === null ? null : Math.pow(base, exp)
    }
    return base
  }
  const product = (): number | null => {
    let v = power()
    while (v !== null && (isOp('*') || isOp('/'))) {
      const op = (tokens[pos++] as { value: string }).value
      const r = power()
      if (r === null) return null
      v = op === '*' ? v * r : r === 0 ? 0 : v / r
    }
    return v
  }
  const sum = (): number | null => {
    let v = product()
    while (v !== null && (isOp('+') || isOp('-'))) {
      const op = (tokens[pos++] as { value: string }).value
      const r = product()
      if (r === null) return null
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  const v = sum()
  if (v === null || pos !== tokens.length || !Number.isFinite(v)) return null
  return v
}

/** Numero scritto senza decimali inutili: 3, 2.5, 0.333 */
export function formatNumber(n: number): string {
  const r = Math.round(n * 1e6) / 1e6
  return String(Object.is(r, -0) ? 0 : r)
}
