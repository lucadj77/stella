import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  useContext,
  useSyncExternalStore
} from 'react'
import { useI18n } from '../i18n/context'
import { Inherit, InheritMark } from './inheritance'
import { propKeys } from './inheritContext'
import { searchToggle } from './propSearch'

// Proprietà avanzate del pannello: ogni sezione mostra sempre le voci principali e raccoglie le
// altre in "Avanzate", chiusa. Ogni voce si sposta da una parte all'altra con il pulsante che
// compare passandoci sopra; la scelta è una preferenza dell'interfaccia, ricordata tra una
// sessione e l'altra come il lucchetto delle proporzioni. Vedi docs/specifica.md, sezione 1.

const KEY = 'advancedFields'
const listeners = new Set<() => void>()

/** sezione.voce → true se sta in Avanzate, false se sempre visibile; manca = come di base */
type Prefs = Record<string, boolean>

function read(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

let prefs = read()

function save(next: Prefs): void {
  prefs = next
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // senza archivio locale vale solo per questa sessione
  }
  listeners.forEach((l) => l())
}

function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => prefs
  )
}

interface Ctx {
  scope: string
  mode: 'main' | 'advanced'
}

const SectionContext = createContext<Ctx | null>(null)

const isAdvanced = (p: Prefs, scope: string, id: string, adv?: boolean): boolean =>
  p[`${scope}.${id}`] ?? !!adv

/** Una voce del pannello: `adv` la mette di base in Avanzate */
export function P({
  id,
  adv,
  children
}: {
  id: string
  adv?: boolean
  children: React.ReactNode
}): React.JSX.Element | null {
  const ctx = useContext(SectionContext)
  const p = usePrefs()
  const { t } = useI18n()
  if (!ctx) return <Inherit keys={propKeys(id)}>{children}</Inherit>
  const advanced = isAdvanced(p, ctx.scope, id, adv)
  if (advanced !== (ctx.mode === 'advanced')) return null
  return (
    <div className="prop-item">
      {children}
      <InheritMark keys={propKeys(id)} />
      <button
        className="prop-move"
        title={advanced ? t('editor.showAlways') : t('editor.moveToAdvanced')}
        onClick={() => save({ ...prefs, [`${ctx.scope}.${id}`]: !advanced })}
      >
        {advanced ? '↑' : '↓'}
      </button>
    </div>
  )
}

/** Le voci P tra i figli, anche dentro i frammenti e le condizioni */
function items(children: React.ReactNode): React.ReactElement<{ id: string; adv?: boolean }>[] {
  const out: React.ReactElement<{ id: string; adv?: boolean }>[] = []
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return
    if (c.type === P) out.push(c as React.ReactElement<{ id: string; adv?: boolean }>)
    else if (c.type === Fragment)
      out.push(...items((c.props as { children?: React.ReactNode }).children))
  })
  return out
}

/** Sezione del pannello: le voci principali, poi "Avanzate" con le altre */
export function Section({
  scope,
  title,
  children
}: {
  scope: string
  title?: string
  children: React.ReactNode
}): React.JSX.Element {
  const { t } = useI18n()
  const p = usePrefs()
  const all = items(children)
  const advanced = all.filter((e) => isAdvanced(p, scope, e.props.id, e.props.adv))
  const moved = Object.keys(p).some((k) => k.startsWith(scope + '.'))
  const openKey = `open:${scope}`
  return (
    <>
      {title && <h3>{title}</h3>}
      <SectionContext.Provider value={{ scope, mode: 'main' }}>{children}</SectionContext.Provider>
      {(advanced.length > 0 || moved) && (
        <details
          className="advanced"
          open={!!p[openKey]}
          onToggle={(e) => {
            // aperte o richiuse dalla ricerca: la scelta dell'utente resta quella salvata
            if (searchToggle(e.currentTarget as HTMLDetailsElement)) return
            const open = (e.currentTarget as HTMLDetailsElement).open
            if (open !== !!p[openKey]) save({ ...prefs, [openKey]: open })
          }}
        >
          <summary>{t('editor.advanced', { n: advanced.length })}</summary>
          <SectionContext.Provider value={{ scope, mode: 'advanced' }}>
            {advanced}
          </SectionContext.Provider>
          {moved && (
            <button
              className="link small"
              onClick={() =>
                save(
                  Object.fromEntries(
                    Object.entries(prefs).filter(
                      ([k]) => !k.startsWith(scope + '.') || k === openKey
                    )
                  )
                )
              }
            >
              {t('editor.resetAdvanced')}
            </button>
          )}
        </details>
      )}
    </>
  )
}
