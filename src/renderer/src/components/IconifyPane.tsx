import { useEffect, useMemo, useState } from 'react'
import { licenseClass, tintSvg, type IconifySet, type LicenseClass } from '../../../shared/iconify'
import { fuzzyScore } from '../../../shared/model/fuzzy'
import { messageFromError, type Message } from '../../../shared/messages'
import { thumbClass, type ThumbBackground } from './thumbBackground'
import { useI18n } from '../i18n/context'

// Collezioni di Iconify nella finestra delle icone: elenco delle collezioni con la licenza a
// sinistra, ricerca online in tutte o in una, anteprime caricate a pagine. Serve la rete.

const PAGE = 240
const HIDE_KEY = 'iconifyHideRestricted'

let collections: Promise<IconifySet[]> | null = null
/** SVG già ricevuti, per id: restano finché l'app è aperta */
const svgCache = new Map<string, string>()

function loadCollections(): Promise<IconifySet[]> {
  collections ??= window.api.iconifyCollections()
  collections.catch(() => (collections = null))
  return collections
}

export interface IconifyIcon {
  id: string
  name: string
  set: IconifySet
  svg: string
}

/** Anteprima di un'icona di Iconify come immagine: il disegno arriva dalla rete */
export function IconifyPreview({
  svg,
  tint,
  size
}: {
  svg: string
  tint: string
  size: number
}): React.JSX.Element {
  const src = useMemo(
    () => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(tintSvg(svg, tint)),
    [svg, tint]
  )
  return <img src={src} alt="" width={size} height={size} draggable={false} />
}

const licenseBadge = (c: LicenseClass): string =>
  c === 'free' ? 'license-free' : c === 'attribution' ? 'license-by' : 'license-restricted'

export default function IconifyPane({
  query,
  tint,
  background,
  chosen,
  onToggle
}: {
  query: string
  tint: string
  background: ThumbBackground
  /** id "prefisso:nome" delle icone scelte */
  chosen: Set<string>
  onToggle(icon: IconifyIcon): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [sets, setSets] = useState<IconifySet[] | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const [prefix, setPrefix] = useState<string | null>(null)
  const [setFilter, setSetFilter] = useState('')
  const [hideRestricted, setHideRestrictedState] = useState(() => {
    try {
      return localStorage.getItem(HIDE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [category, setCategory] = useState<string | null>(null)
  /** Icone trovate per la ricerca o la collezione scelta */
  const [found, setFound] = useState<{
    key: string
    ids: string[]
    categories: Record<string, string[]>
  } | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const [, setLoaded] = useState(0)

  useEffect(() => {
    let live = true
    loadCollections()
      .then((s) => live && setSets(s))
      .catch((e) => live && setError(messageFromError(e)))
    return () => {
      live = false
    }
  }, [])

  const setHideRestricted = (v: boolean): void => {
    setHideRestrictedState(v)
    try {
      localStorage.setItem(HIDE_KEY, v ? '1' : '0')
    } catch {
      // preferenza non essenziale
    }
  }

  const byPrefix = useMemo(() => new Map((sets ?? []).map((s) => [s.prefix, s])), [sets])
  const allowed = (s: IconifySet | undefined): boolean =>
    !!s && (!hideRestricted || licenseClass(s.license.spdx) !== 'restricted')

  const shownSets = useMemo(() => {
    const list = (sets ?? []).filter(
      (s) => !hideRestricted || licenseClass(s.license.spdx) !== 'restricted'
    )
    if (!setFilter.trim()) return list
    return list
      .map((s) => ({
        s,
        score: fuzzyScore(setFilter, `${s.name} ${s.prefix} ${s.category ?? ''}`)
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.s)
  }, [sets, setFilter, hideRestricted])

  // ricerca online con una pausa dopo l'ultimo tasto, oppure tutte le icone della collezione
  const key = `${prefix ?? ''}|${query.trim()}`
  useEffect(() => {
    const q = query.trim()
    if (!q && !prefix) return
    let live = true
    const timer = setTimeout(
      () => {
        const p = q
          ? window.api
              .iconifySearch(q, prefix ?? undefined)
              .then((ids) => ({ ids, categories: {} }))
          : window.api.iconifyCollection(prefix!).then((r) => ({
              ids: r.icons.map((n) => `${prefix}:${n}`),
              categories: r.categories
            }))
        p.then((r) => {
          if (!live) return
          setError(null)
          setFound({ key, ...r })
          setLimit(PAGE)
          setCategory(null)
        }).catch((e) => live && setError(messageFromError(e)))
      },
      q ? 400 : 0
    )
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [key, query, prefix])

  const current = found?.key === key ? found : null
  const ids = useMemo(() => {
    if (!current) return []
    const list =
      category && current.categories[category]
        ? current.categories[category].map((n) => `${prefix}:${n}`)
        : current.ids
    return list.filter((id) => allowed(byPrefix.get(id.slice(0, id.indexOf(':')))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, category, prefix, byPrefix, hideRestricted])
  const visible = ids.slice(0, limit)

  // disegni delle icone visibili non ancora ricevuti
  const missing = visible.filter((id) => !svgCache.has(id))
  const missingKey = missing.join(',')
  useEffect(() => {
    if (!missingKey) return
    let live = true
    window.api
      .iconifySvgs(missingKey.split(','))
      .then((svgs) => {
        for (const [id, svg] of Object.entries(svgs)) svgCache.set(id, svg)
        if (live) setLoaded((n) => n + 1)
      })
      .catch((e) => live && setError(messageFromError(e)))
    return () => {
      live = false
    }
  }, [missingKey])

  const selected = prefix ? byPrefix.get(prefix) : undefined
  const categories = current ? Object.keys(current.categories).sort() : []

  const iconOf = (id: string): IconifyIcon | null => {
    const svg = svgCache.get(id)
    const set = byPrefix.get(id.slice(0, id.indexOf(':')))
    return svg && set ? { id, name: id.slice(id.indexOf(':') + 1), set, svg } : null
  }

  return (
    <div className="icon-browser-body">
      <nav className="icon-tags iconify-sets">
        <input
          type="search"
          value={setFilter}
          placeholder={t('iconify.filterSets')}
          onChange={(e) => setSetFilter(e.target.value)}
        />
        <label className="iconify-hide">
          <input
            type="checkbox"
            checked={hideRestricted}
            onChange={(e) => setHideRestricted(e.target.checked)}
          />
          {t('iconify.hideRestricted')}
        </label>
        <div className="license-legend muted small">
          {(['free', 'attribution', 'restricted'] as const).map((c) => (
            <span key={c}>
              <span className={`license-dot ${licenseBadge(c)}`} />
              {t(`iconify.legend.${c}`)}
            </span>
          ))}
        </div>
        <button className={prefix === null ? 'on' : ''} onClick={() => setPrefix(null)}>
          {t('iconify.allSets')}
        </button>
        {shownSets.map((s) => (
          <button
            key={s.prefix}
            className={prefix === s.prefix ? 'on' : ''}
            title={`${s.name} · ${s.author.name} · ${s.license.title}`}
            onClick={() => setPrefix(s.prefix)}
          >
            <span className={`license-dot ${licenseBadge(licenseClass(s.license.spdx))}`} />
            {s.name} <span className="muted">{s.total}</span>
          </button>
        ))}
      </nav>
      <div className="icon-results">
        {selected && (
          <div className="iconify-info">
            <strong>{selected.name}</strong>
            <span className="muted">
              {selected.author.name} · {selected.total} {t('iconify.icons')}
            </span>
            <span className={`license-tag ${licenseBadge(licenseClass(selected.license.spdx))}`}>
              {selected.license.title || selected.license.spdx}
            </span>
            <span className="muted small">
              {t(`iconify.license.${licenseClass(selected.license.spdx)}`)}
              {selected.palette ? ' ' + t('iconify.palette') : ''}
            </span>
            {categories.length > 0 && !query.trim() && (
              <select value={category ?? ''} onChange={(e) => setCategory(e.target.value || null)}>
                <option value="">{t('iconify.allCategories')}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {error && <p className="field-error">{t(error)}</p>}
        {!sets && !error && <p className="muted">{t('iconify.loading')}</p>}
        {sets && !query.trim() && !prefix && <p className="muted">{t('iconify.hint')}</p>}
        {current && ids.length === 0 && <p className="muted">{t('assetPicker.noMatch')}</p>}
        <div
          className={'asset-grid icon-grid' + thumbClass(background)}
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))' }}
        >
          {visible.map((id) => {
            const icon = iconOf(id)
            return (
              <button
                key={id}
                className={chosen.has(id) ? 'asset-tile on' : 'asset-tile'}
                title={`${id} · ${icon?.set.license.title ?? ''}`}
                disabled={!icon}
                onClick={() => icon && onToggle(icon)}
              >
                <span className="asset-thumb icon-thumb">
                  {icon && <IconifyPreview svg={icon.svg} tint={tint} size={48} />}
                </span>
                <span className="asset-name">{id.slice(id.indexOf(':') + 1)}</span>
              </button>
            )
          })}
        </div>
        {ids.length > limit && (
          <button className="more-btn" onClick={() => setLimit(limit + PAGE)}>
            {t('icons.more', { n: ids.length - limit })}
          </button>
        )}
      </div>
    </div>
  )
}
