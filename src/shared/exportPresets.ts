import type { NamedProfile } from './export'

// Preset dei servizi di stampa e della stampa in casa. Non toccano set e cartella, che restano
// quelli scelti nella finestra. Le misure in pixel dipendono dall'abbondanza del template:
// MakePlayingCards chiede 36 px per lato a 300 DPI (3,05 mm), The Game Crafter 1/8" (3,2 mm);
// i 3 mm predefiniti dei template bastano (docs/specifica.md, 9.4).

export interface ExportPreset {
  /** Chiave del nome tradotto */
  label: 'preset.mpc' | 'preset.tgc' | 'preset.homeA4' | 'preset.homeLetter' | 'preset.printShop'
  profile: Omit<NamedProfile, 'name'>
}

const cardImages = {
  format: 'png',
  dpi: 300,
  bleed: true,
  sides: 'both',
  copies: false,
  transparent: false
} as const

const homePdf = {
  bleed: false,
  rounded: false,
  marks: 'corners',
  sides: 'both',
  duplex: 'long',
  copies: true,
  layout: 'auto',
  autoRotate: true,
  landscape: false,
  margin: 10,
  spacing: 0,
  split: 'single'
} as const

const printShopPdf = {
  bleed: true,
  rounded: false,
  marks: 'corners',
  sides: 'both',
  duplex: 'none',
  copies: true,
  layout: 'auto',
  autoRotate: true,
  landscape: false,
  margin: 10,
  spacing: 0,
  split: 'single'
} as const

export const EXPORT_PRESETS: ExportPreset[] = [
  // fronti e retri in cartelle separate, come si caricano sul sito
  {
    label: 'preset.mpc',
    profile: { kind: 'images', options: { ...cardImages, pattern: '%set/%side/%n' } }
  },
  {
    label: 'preset.tgc',
    profile: { kind: 'images', options: { ...cardImages, pattern: '%set/%n_%side' } }
  },
  { label: 'preset.homeA4', profile: { kind: 'pdf', options: { ...homePdf, page: 'A4' } } },
  { label: 'preset.homeLetter', profile: { kind: 'pdf', options: { ...homePdf, page: 'Letter' } } },
  // per una tipografia: con l'abbondanza e i segni di taglio, fronti e retri su pagine alterne
  { label: 'preset.printShop', profile: { kind: 'pdf', options: printShopPdf } }
]

/** Cosa si vuole fare con l'esportazione: sceglie il tipo e, per il PDF, parte da un preset */
export type ExportGoal = 'home' | 'shop' | 'tts' | 'images'
export const EXPORT_GOALS: ExportGoal[] = ['home', 'shop', 'tts', 'images']
