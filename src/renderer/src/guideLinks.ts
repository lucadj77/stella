// I link alla guida su GitHub dall'app: la versione pubblicata apre il tag della sua versione
// (v1.10.2 e così via), così il testo, le ancore delle sezioni e le immagini sono quelli della
// guida che l'app porta con sé per la ricerca. In sviluppo il tag non c'è ancora: si apre main.

import { guideImageUrl, guideSectionUrl, guideUrl, type GuideSection } from '../../shared/donate'

const GUIDE_REF =
  import.meta.env.DEV || typeof __APP_VERSION__ !== 'string' ? 'main' : `v${__APP_VERSION__}`

export const guideLink = (lang: string, anchor = ''): string => guideUrl(lang, anchor, GUIDE_REF)
export const guideSectionLink = (section: GuideSection, lang: string): string =>
  guideSectionUrl(section, lang, GUIDE_REF)
export const guideImageLink = (lang: string, src: string): string =>
  guideImageUrl(lang, src, GUIDE_REF)
