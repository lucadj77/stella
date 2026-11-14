/** Donazioni libere a Luca: la pagina PayPal.me, usata dall'app e dal sito */
export const DONATE_URL = 'https://paypal.me/DiGialleonardo'

/** Il server Discord di supporto, in inglese e italiano */
export const DISCORD_URL = 'https://discord.gg/bkP3a3CwkP'

/** Il sito di Stella, nella lingua dell'interfaccia (inglese alla radice, italiano in /it/) */
export const SITE_URL = 'https://stella.lucadj.eu/'
export const siteUrl = (lang: string): string => (lang === 'it' ? `${SITE_URL}it/` : SITE_URL)

/** La guida completa su GitHub, nella lingua dell'interfaccia. ref è il ramo o il tag: l'app
 * apre quello della sua versione, perché titoli, ancore e immagini siano quelli del testo che ha */
const REPO = 'https://github.com/lucadj77/stella'
const guideDir = (lang: string): string => (lang === 'it' ? 'guida' : 'guide')
export const guideUrl = (lang: string, anchor = '', ref = 'main'): string =>
  `${REPO}/blob/${ref}/docs/${guideDir(lang)}/README.md${anchor ? '#' + anchor : ''}`
/** Un'immagine della guida (src come nel Markdown, per esempio img/editor.png), da GitHub */
export const guideImageUrl = (lang: string, src: string, ref = 'main'): string =>
  `https://raw.githubusercontent.com/lucadj77/stella/${ref}/docs/${guideDir(lang)}/${src}`

/** I video tutorial sul sito, nella sezione con l'elenco */
export const tutorialsUrl = (lang: string): string => `${siteUrl(lang)}#tutorial`

/** I primi due video, per chi comincia: la panoramica e il primo componente da zero */
export const FIRST_VIDEOS = {
  overview: {
    it: 'https://www.youtube.com/watch?v=GYwoJcKFGSg',
    en: 'https://www.youtube.com/watch?v=qe6E6msuJDw'
  },
  firstComponent: {
    it: 'https://www.youtube.com/watch?v=l7tMw_gYE7k',
    en: 'https://www.youtube.com/watch?v=dIXdNuigAnY'
  }
} as const
export const videoUrl = (v: keyof typeof FIRST_VIDEOS, lang: string): string =>
  lang === 'it' ? FIRST_VIDEOS[v].it : FIRST_VIDEOS[v].en

/** Capitoli della guida, con l'ancora che GitHub dà al titolo in ciascuna lingua */
const GUIDE_SECTIONS = {
  concepts: { it: '1-concetti-di-base', en: '1-basic-concepts' },
  template: { it: '4-disegnare-un-template', en: '4-designing-a-template' },
  set: { it: '5-inserire-e-modificare-i-componenti', en: '5-entering-and-editing-components' },
  formulaAssistant: { it: '91-lassistente-formule', en: '91-the-formula-assistant' },
  generate: { it: '10-generare-i-componenti', en: '10-generating-components' },
  export: { it: '11-esportare', en: '11-exporting' },
  pick: { it: '116-scegliere-i-componenti', en: '116-choosing-the-components' }
} as const
export type GuideSection = keyof typeof GUIDE_SECTIONS
export const guideSectionUrl = (section: GuideSection, lang: string, ref = 'main'): string =>
  guideUrl(lang, lang === 'it' ? GUIDE_SECTIONS[section].it : GUIDE_SECTIONS[section].en, ref)
