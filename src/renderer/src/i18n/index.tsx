import { useCallback, useMemo, useState } from 'react'
import { en, type MessageKey } from './en'
import { it } from './it'
import { I18nContext, LANGUAGES, type Language, type Translate } from './context'
import { isMacPlatform, platformKeys } from '../../../shared/keys'

const MAC = isMacPlatform()

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { en, it }
const STORAGE_KEY = 'language'

function initialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && saved in LANGUAGES) return saved as Language
  return navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en'
}

export function I18nProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [lang, setLangState] = useState<Language>(initialLanguage)

  const setLang = useCallback((l: Language) => {
    localStorage.setItem(STORAGE_KEY, l)
    setLangState(l)
  }, [])

  const t = useCallback<Translate>(
    function translate(key, params): string {
      const m = typeof key === 'string' ? { key, params } : key
      // una chiave sconosciuta (per esempio da una versione più nuova) si mostra com'è
      const raw = DICTIONARIES[lang][m.key as MessageKey] ?? en[m.key as MessageKey] ?? m.key
      // le scorciatoie nella forma del sistema in uso: ⌘S sul Mac, Ctrl+S altrove
      const text = platformKeys(raw, MAC, lang)
      // {n:carta|carte}: la parola al singolare se n è 1, altrimenti al plurale
      const plural = text.replace(/\{(\w+):([^|{}]*)\|([^{}]*)\}/g, (s, name, one, many) => {
        const p = m.params?.[name]
        return p === undefined ? s : Number(p) === 1 ? one : many
      })
      return plural.replace(/\{(\w+)\}/g, (s, name) => {
        const p = m.params?.[name]
        return p === undefined ? s : typeof p === 'object' ? translate(p, undefined) : String(p)
      })
    },
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
