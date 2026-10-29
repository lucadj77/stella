import type { AssetsUpdate } from '../../../shared/library'
import { createContext, useContext, useMemo } from 'react'
import type { BindContext } from '../../../shared/model/bind'
import type { Variables } from '../../../shared/model/variables'
import type { Localization } from '../../../shared/model/language'
import { numberFormatting, type NumberSettings } from '../../../shared/model/numberFormat'
import { useProjectFonts } from './fonts'

/** File sotto assets/ del progetto aperto, per risolvere i nomi delle immagini */
export const AssetsContext = createContext<string[]>([])

export function assetUrl(path: string): string {
  if (window.api.assetUrl) return window.api.assetUrl(path)
  return `gc-asset://project/${path.split('/').map(encodeURIComponent).join('/')}`
}

/** Stili di testo del progetto (nome → attributi), usati con .nome nel markup */
export const StylesContext = createContext<Record<string, string>>({})

/** Salva uno stile del progetto (def null lo elimina); null se non c'è un progetto aperto */
export const SaveStyleContext = createContext<
  ((name: string, def: string | null, oldName?: string) => void) | null
>(null)

/** Nell'editor i livelli vuoti si mostrano comunque, per poterli vedere e prendere */
export const ShowEmptyContext = createContext(false)

const assetListeners = new Set<(u: AssetsUpdate) => void>()

/** Avvisa il progetto aperto che gli asset sono cambiati, per esempio dopo un'importazione */
export function publishAssetsUpdate(u: AssetsUpdate): void {
  assetListeners.forEach((l) => l(u))
}

export function onAssetsUpdate(cb: (u: AssetsUpdate) => void): () => void {
  assetListeners.add(cb)
  return () => assetListeners.delete(cb)
}

/** Variabili del progetto aperto (docs/specifica.md, 6.1) */
export const VariablesContext = createContext<Variables>({})

/** Colori scritti come codice nel progetto aperto, dal più usato: vedi usedColors */
export const ProjectColorsContext = createContext<string[]>([])

/** Lingua in cui si mostrano le carte, se non è quella principale del progetto */
export const LocalizationContext = createContext<Localization | undefined>(undefined)

/** Lingue del progetto, la principale per prima; vuoto se il progetto ha una sola lingua */
export const ProjectLanguagesContext = createContext<string[]>([])

/** Lingue e formati dei numeri del progetto aperto: vedi model/numberFormat.ts */
export const NumberSettingsContext = createContext<NumberSettings>({})

/** Nelle formule del progetto aperto 2,5 è un numero: la lingua principale usa la virgola */
export function useDecimalComma(): boolean {
  const settings = useContext(NumberSettingsContext)
  return useMemo(() => numberFormatting(settings)?.decimalComma ?? false, [settings])
}

/** Ciò che serve per applicare una riga a un template: immagini, stili, variabili e lingua */
export function useBindContext(): BindContext {
  const assets = useContext(AssetsContext)
  const styles = useContext(StylesContext)
  const variables = useContext(VariablesContext)
  const localization = useContext(LocalizationContext)
  const settings = useContext(NumberSettingsContext)
  const { has: hasFont } = useProjectFonts()
  return useMemo(
    () => ({
      assets,
      styles,
      variables,
      hasFont,
      localization,
      numbers: numberFormatting(settings, localization?.language)
    }),
    [assets, styles, variables, hasFont, localization, settings]
  )
}
