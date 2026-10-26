// Ricerca nel pannello delle proprietà. Lavora sul DOM già disegnato: le voci sono di tanti tipi
// (campi, gruppi di campi, sezioni con "Avanzate") e il loro testo è quello che l'utente vede.
// Una sezione il cui titolo (h2 o h3) contiene il testo cercato si mostra intera; altrimenti si
// mostrano le sole voci con l'etichetta che lo contiene, con il titolo della loro sezione. Le
// "Avanzate" che contengono una voce trovata si aprono finché dura la ricerca.

const HIDDEN = 'search-hidden'

/** Minuscole e senza accenti: "pos" trova "Posizione", "opacita" trova "Opacità" */
export const normalizeSearch = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/**
 * Filtra le voci sotto `root`. Si può chiamare più volte con lo stesso testo: cambia solo ciò
 * che serve. Restituisce false se con un testo non vuoto non si è trovato niente.
 */
export function filterProperties(root: HTMLElement, query: string): boolean {
  const q = normalizeSearch(query)
  const hide = new Set<Element>()
  const open = new Set<HTMLDetailsElement>()
  const has = (text: string | null): boolean => normalizeSearch(text ?? '').includes(q)
  const labelHit = (field: Element): boolean =>
    has(field.querySelector('.field-label')?.textContent ?? null)
  const openAll = (el: Element): void => {
    if (el instanceof HTMLDetailsElement) open.add(el)
    el.querySelectorAll('details').forEach((d) => open.add(d))
  }

  // le voci di un contenitore, divise in sezioni dai titoli
  const visit = (container: Element): boolean => {
    let any = false
    let heading: Element | null = null
    let titleHit = false
    let sectionAny = false
    const closeSection = (): void => {
      if (heading && !titleHit && !sectionAny) hide.add(heading)
    }
    for (const el of Array.from(container.children)) {
      if (el.matches('h2, h3')) {
        closeSection()
        heading = el
        titleHit = has(el.textContent)
        sectionAny = false
        if (titleHit) any = true
        continue
      }
      if (el.matches('summary, .prop-search-empty')) continue
      if (titleHit) {
        openAll(el)
        sectionAny = true
        continue
      }
      const fields = el.matches('.field') ? [el] : Array.from(el.querySelectorAll('.field'))
      if (!fields.some(labelHit)) {
        hide.add(el)
        continue
      }
      // con più voci dentro (un gruppo, le Avanzate) si filtra anche all'interno
      if (fields.length > 1 || el.querySelector('h2, h3')) visit(el)
      if (el instanceof HTMLDetailsElement) open.add(el)
      sectionAny = true
      any = true
    }
    closeSection()
    return any
  }
  const found = q ? visit(root) : true

  root.querySelectorAll('.' + HIDDEN).forEach((e) => {
    if (!hide.has(e)) e.classList.remove(HIDDEN)
  })
  hide.forEach((e) => e.classList.add(HIDDEN))
  // le Avanzate aperte dalla ricerca si richiudono dopo; la scelta salvata non cambia (Section
  // ignora gli eventi toggle con questi segni)
  root.querySelectorAll('details').forEach((d) => {
    if (open.has(d) && !d.open) {
      d.dataset.searchOpen = '1'
      d.open = true
    } else if (!open.has(d) && d.dataset.searchOpen) {
      delete d.dataset.searchOpen
      d.dataset.searchClosing = '1'
      d.open = false
    }
  })
  return found
}

/** Vero se l'evento toggle di un <details> viene dalla ricerca e non dall'utente */
export function searchToggle(d: HTMLDetailsElement): boolean {
  if (d.dataset.searchClosing) {
    delete d.dataset.searchClosing
    return true
  }
  return !!d.dataset.searchOpen
}
