/** Donazioni libere a Luca: la pagina PayPal.me, usata dall'app e dal sito */
export const DONATE_URL = 'https://paypal.me/DiGialleonardo'

/** Il sito di Stella, nella lingua dell'interfaccia (inglese alla radice, italiano in /it/) */
export const SITE_URL = 'https://stella.lucadj.eu/'
export const siteUrl = (lang: string): string => (lang === 'it' ? `${SITE_URL}it/` : SITE_URL)
