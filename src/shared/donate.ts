/** Donazioni libere a Luca: la pagina PayPal.me, usata dall'app e dal sito */
export const DONATE_URL = 'https://paypal.me/DiGialleonardo'

/** Il server Discord di supporto, in inglese e italiano */
export const DISCORD_URL = 'https://discord.gg/bkP3a3CwkP'

/** Il sito di Stella, nella lingua dell'interfaccia (inglese alla radice, italiano in /it/) */
export const SITE_URL = 'https://stella.lucadj.eu/'
export const siteUrl = (lang: string): string => (lang === 'it' ? `${SITE_URL}it/` : SITE_URL)

/** La guida completa su GitHub, nella lingua dell'interfaccia */
const GUIDE = 'https://github.com/lucadj77/stella/blob/main/docs'
export const guideUrl = (lang: string, anchor = ''): string =>
  `${GUIDE}/${lang === 'it' ? 'guida' : 'guide'}/README.md${anchor ? '#' + anchor : ''}`

/** I video tutorial sul sito, nella sezione con l'elenco */
export const tutorialsUrl = (lang: string): string => `${siteUrl(lang)}#tutorial`

/** I primi due video, per chi comincia: la panoramica e il primo componente da zero */
export const FIRST_VIDEOS = {
  overview: {
    it: 'https://www.youtube.com/watch?v=0JnZ92Jy_JU',
    en: 'https://www.youtube.com/watch?v=51ZJAKmUprc'
  },
  firstComponent: {
    it: 'https://www.youtube.com/watch?v=kUgGQ_ab8Yg',
    en: 'https://www.youtube.com/watch?v=YISuOjfzjJU'
  }
} as const
export const videoUrl = (v: keyof typeof FIRST_VIDEOS, lang: string): string =>
  lang === 'it' ? FIRST_VIDEOS[v].it : FIRST_VIDEOS[v].en

/** Capitoli della guida, con l'ancora che GitHub dà al titolo in ciascuna lingua */
const GUIDE_SECTIONS = {
  concepts: { it: '1-concetti-di-base', en: '1-basic-concepts' },
  template: { it: '4-disegnare-un-template', en: '4-designing-a-template' },
  set: { it: '5-inserire-e-modificare-le-carte', en: '5-entering-and-editing-cards' },
  formulaAssistant: { it: '91-lassistente-formule', en: '91-the-formula-assistant' },
  generate: { it: '10-generare-le-carte', en: '10-generating-cards' },
  export: { it: '11-esportare', en: '11-exporting' }
} as const
export type GuideSection = keyof typeof GUIDE_SECTIONS
export const guideSectionUrl = (section: GuideSection, lang: string): string =>
  guideUrl(lang, lang === 'it' ? GUIDE_SECTIONS[section].it : GUIDE_SECTIONS[section].en)
