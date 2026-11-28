// Misure dentro un campo di testo, per farlo scorrere fino a un punto del testo

/**
 * Altezza nel campo dove inizia il carattere `at`, a capo automatico compreso: la misura una
 * copia nascosta del campo che contiene solo il testo prima
 */
export function textTop(el: HTMLTextAreaElement, at: number): number {
  const cs = getComputedStyle(el)
  const copy = document.createElement('textarea')
  for (const k of [
    'width',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'padding',
    'border',
    'boxSizing',
    'whiteSpace',
    'overflowWrap',
    'wordBreak',
    'tabSize'
  ] as const)
    copy.style[k] = cs[k]
  Object.assign(copy.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    height: '0',
    overflowY: 'scroll',
    visibility: 'hidden'
  })
  copy.value = el.value.slice(0, at)
  document.body.appendChild(copy)
  const top = copy.scrollHeight - parseFloat(cs.paddingBottom)
  copy.remove()
  // il testo copiato finisce con l'a capo prima del titolo: l'ultima riga è quella del titolo
  return at > 0 ? top - (parseFloat(cs.lineHeight) || 0) : 0
}

/**
 * Fa scorrere il campo finché il carattere `at` è in vista, se non lo è già: la riga finisce a un
 * terzo dell'altezza, così si vede anche il testo intorno
 */
export function scrollTextIntoView(el: HTMLTextAreaElement, at: number): void {
  const top = textTop(el, at)
  const line = parseFloat(getComputedStyle(el).lineHeight) || 16
  if (top >= el.scrollTop && top + line <= el.scrollTop + el.clientHeight) return
  el.scrollTop = Math.max(0, top - el.clientHeight / 3)
}
