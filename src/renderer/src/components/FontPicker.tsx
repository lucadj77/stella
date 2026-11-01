import { useEffect, useMemo, useState } from 'react'
import type {
  FontCatalog,
  FontFamilyEntry,
  FontVariant,
  SystemFontFamily
} from '../../../shared/library'
import { fuzzyFilter } from '../../../shared/model/fuzzy'
import {
  FONT_GENRES,
  STYLE_GROUPS,
  filterFonts,
  similarFonts,
  tagIndex,
  tagSlug,
  type FontGenre
} from '../../../shared/model/fontSearch'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import { publishAssetsUpdate } from '../render/assets'
import { APP_FONTS, useProjectFonts } from '../render/fonts'
import Segmented from './Segmented'

// Scelta del font con anteprima: i font del progetto, quelli di Google, che si scaricano in
// assets/fonts/, e quelli installati sul computer, che si possono copiare nel progetto. I font
// Google si cercano anche per genere e stile (model/fontSearch.ts), si segnano come preferiti e
// si trovano simili a uno dato. Vedi docs/specifica.md, sezione 10.2.

const SAMPLE_KEY = 'fontPickerSample'
const VIEW_KEY = 'fontPickerView'
const FAVORITES_KEY = 'fontFavorites'
const RECENT_KEY = 'fontRecent'
const RECENT_MAX = 12
const PAGE = 40
const CATEGORIES = ['serif', 'sans-serif', 'display', 'handwriting', 'monospace'] as const
const SUBSETS = ['latin-ext', 'greek', 'cyrillic', 'vietnamese'] as const

function loadList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // preferenza non essenziale
  }
}

let catalogPromise: Promise<FontCatalog> | null = null

function loadCatalog(): Promise<FontCatalog> {
  catalogPromise ??= window.api.fontCatalog()
  catalogPromise.catch(() => (catalogPromise = null))
  return catalogPromise
}

let systemPromise: Promise<SystemFontFamily[]> | null = null

/** La ricerca dei font del computer legge le cartelle del sistema: si fa una volta */
function loadSystemFonts(): Promise<SystemFontFamily[]> {
  systemPromise ??= window.api.systemFonts()
  systemPromise.catch(() => (systemPromise = null))
  return systemPromise
}

type Tab = 'project' | 'google' | 'system'

/** Fogli di stile già aggiunti per le anteprime dei font Google */
const previewLinks = new Set<string>()

function loadPreview(f: FontFamilyEntry): void {
  if (previewLinks.has(f[0])) return
  previewLinks.add(f[0])
  const weight = f[2].includes(400) ? 400 : f[2][0]
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${f[0].replace(/ /g, '+')}:wght@${weight}&display=swap`
  link.onerror = () => previewLinks.delete(f[0])
  document.head.appendChild(link)
}

function loadSample(fallback: string): string {
  try {
    return localStorage.getItem(SAMPLE_KEY) || fallback
  } catch {
    return fallback
  }
}

/** Varianti proposte: normale e grassetto, più il corsivo se c'è */
function defaultVariants(f: FontFamilyEntry): FontVariant[] {
  const near = (w: number): number =>
    f[2].reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), f[2][0])
  const weights = [...new Set([near(400), near(700)])]
  const out = weights.map((weight) => ({ weight, italic: false }))
  if (f[3]) out.push({ weight: near(400), italic: true })
  return out
}

const key = (v: FontVariant): string => `${v.weight}${v.italic ? 'i' : ''}`

export default function FontPicker({
  value,
  onPick,
  onClose
}: {
  value: string
  onPick(family: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const project = useProjectFonts()
  const [tab, setTab] = useState<Tab>(project.families.length ? 'project' : 'google')
  const [sample, setSampleState] = useState(() => loadSample(t('fonts.sample')))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [genre, setGenre] = useState<FontGenre | null>(null)
  const [style, setStyle] = useState<string | null>(null)
  const [boldItalic, setBoldItalic] = useState(false)
  const [subset, setSubset] = useState<string | null>(null)
  /** Solo i preferiti o i recenti, invece di tutto il catalogo */
  const [only, setOnly] = useState<'favorites' | 'recent' | null>(null)
  /** Font di cui si mostrano i simili */
  const [similar, setSimilar] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<string[]>(() => loadList(FAVORITES_KEY))
  const [recent, setRecent] = useState<string[]>(() => loadList(RECENT_KEY))
  const [view, setViewState] = useState<'list' | 'grid'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list'
    } catch {
      return 'list'
    }
  })
  const [catalog, setCatalog] = useState<FontCatalog | null>(null)
  const [system, setSystem] = useState<SystemFontFamily[] | null>(null)
  /** Pagine mostrate: si torna alla prima quando cambiano ricerca o filtro */
  const [more, setMore] = useState({ view: '', limit: PAGE })
  const [open, setOpen] = useState<FontFamilyEntry | null>(null)
  const [variants, setVariants] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Message | null>(null)
  /** Aggiornamento del catalogo dei font Google in corso, o il suo esito */
  const [updating, setUpdating] = useState<'running' | { before: number; after: number } | null>(
    null
  )

  const updateCatalog = async (): Promise<void> => {
    setUpdating('running')
    setError(null)
    try {
      const r = await window.api.updateCatalog('google-fonts')
      catalogPromise = null
      setCatalog(await loadCatalog())
      setUpdating(r)
    } catch (e) {
      setUpdating(null)
      setError(messageFromError(e))
    }
  }

  const setView = (v: 'list' | 'grid'): void => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // preferenza non essenziale
    }
  }

  const toggleFavorite = (family: string): void => {
    const next = favorites.includes(family)
      ? favorites.filter((f) => f !== family)
      : [...favorites, family]
    setFavorites(next)
    saveList(FAVORITES_KEY, next)
  }

  /** Cambiare un filtro chiude l'elenco dei simili */
  const filtered =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setSimilar(null)
    }

  const setSample = (s: string): void => {
    setSampleState(s)
    try {
      localStorage.setItem(SAMPLE_KEY, s)
    } catch {
      // preferenza non essenziale
    }
  }

  useEffect(() => {
    if (tab !== 'google' || catalog) return
    loadCatalog()
      .then(setCatalog)
      .catch((e) => setError(messageFromError(e)))
  }, [tab, catalog])

  useEffect(() => {
    if (tab !== 'system' || system) return
    loadSystemFonts()
      .then(setSystem)
      .catch((e) => setError(messageFromError(e)))
  }, [tab, system])

  const own = useMemo(
    () => new Set([...project.families, ...APP_FONTS].map((f) => f.toLowerCase())),
    [project.families]
  )

  const tags = useMemo(() => tagIndex(catalog?.tags), [catalog])

  const google = useMemo(() => {
    if (!catalog) return []
    if (similar) return similarFonts(catalog, tags, similar)
    const labels = {
      tag: (tag: string) => t(`fonts.tag.${tagSlug(tag)}` as MessageKey),
      genre: (g: FontGenre) => t(`fonts.genre.${g}` as MessageKey)
    }
    const filter = { category, genre, style, boldItalic, subset, query: '' }
    let list = filterFonts(catalog, tags, filter, labels)
    if (query.trim()) {
      // prima i nomi, anche scritti male, poi i font che hanno lo stile cercato
      const byName = fuzzyFilter(list, query, (f) => f[0])
      const names = new Set(byName.map((f) => f[0]))
      const byStyle = filterFonts(catalog, tags, { ...filter, query }, labels).filter(
        (f) => !names.has(f[0])
      )
      list = [...byName, ...byStyle]
    }
    if (only === 'favorites') list = list.filter((f) => favorites.includes(f[0]))
    if (only === 'recent') {
      const pos = new Map(recent.map((f, k) => [f, k]))
      list = list.filter((f) => pos.has(f[0])).sort((a, b) => pos.get(a[0])! - pos.get(b[0])!)
    }
    return list
  }, [
    catalog,
    tags,
    similar,
    category,
    genre,
    style,
    boldItalic,
    subset,
    query,
    only,
    favorites,
    recent,
    t
  ])

  const systemList = useMemo(
    () => (system ? fuzzyFilter(system, query, (f) => f.family) : []),
    [system, query]
  )

  const page = `${tab}|${category}|${genre}|${style}|${boldItalic}|${subset}|${only}|${similar}|${query}`
  const limit = more.view === page ? more.limit : PAGE
  const visible = google.slice(0, limit)
  useEffect(() => {
    if (tab === 'google' && navigator.onLine) visible.forEach(loadPreview)
  }, [tab, visible])

  const projectFamilies = useMemo(
    () =>
      fuzzyFilter(
        [...new Set([...project.families, ...APP_FONTS])].sort((a, b) => a.localeCompare(b)),
        query,
        (f) => f
      ),
    [project.families, query]
  )

  const choose = (f: FontFamilyEntry): void => {
    if (open?.[0] === f[0]) return setOpen(null)
    setOpen(f)
    setVariants(new Set(defaultVariants(f).map(key)))
    setError(null)
  }

  const toggle = (v: FontVariant): void => {
    const next = new Set(variants)
    if (next.has(key(v))) next.delete(key(v))
    else next.add(key(v))
    setVariants(next)
  }

  const download = async (f: FontFamilyEntry): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const list = allVariants(f).filter((v) => variants.has(key(v)))
      publishAssetsUpdate(await window.api.downloadFont(f[0], list))
      const next = [f[0], ...recent.filter((r) => r !== f[0])].slice(0, RECENT_MAX)
      setRecent(next)
      saveList(RECENT_KEY, next)
      onPick(f[0])
      onClose()
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setBusy(false)
    }
  }

  const copy = async (family: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      publishAssetsUpdate(await window.api.copySystemFont(family))
      onPick(family)
      onClose()
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setBusy(false)
    }
  }

  const preview = (family: string): React.CSSProperties => ({
    fontFamily: `'${family}', ${t('fonts.fallbackFamily')}`
  })

  return (
    <Dialog title={t('fonts.title')} onClose={busy ? () => undefined : onClose}>
      <div className="font-picker">
        <div className="asset-picker-bar">
          <Segmented
            value={tab}
            options={[
              ['project', t('fonts.tabProject')],
              ['google', 'Google Fonts'],
              ['system', t('fonts.tabSystem')]
            ]}
            onChange={(v) => setTab(v as Tab)}
          />
          <input
            autoFocus
            type="search"
            value={query}
            placeholder={t('fonts.search')}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="asset-picker-bar">
          <span className="muted small">{t('fonts.sampleLabel')}</span>
          <input value={sample} onChange={(e) => setSample(e.target.value)} />
          <Segmented
            value={view}
            options={[
              ['list', t('fonts.viewList')],
              ['grid', t('fonts.viewGrid')]
            ]}
            onChange={(v) => setView(v as 'list' | 'grid')}
          />
        </div>
        {tab === 'google' && (
          <div className="asset-picker-folders">
            <button
              className={only === 'favorites' ? 'on' : ''}
              onClick={() => filtered(setOnly)(only === 'favorites' ? null : 'favorites')}
            >
              {t('fonts.favorites', { n: favorites.length })}
            </button>
            <button
              className={only === 'recent' ? 'on' : ''}
              onClick={() => filtered(setOnly)(only === 'recent' ? null : 'recent')}
            >
              {t('fonts.recent')}
            </button>
            <span className="chip-sep" />
            <button
              className={category === null ? 'on' : ''}
              onClick={() => filtered(setCategory)(null)}
            >
              {t('assetPicker.all')}
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={category === c ? 'on' : ''}
                onClick={() => filtered(setCategory)(c)}
              >
                {t(`fonts.category.${c}` as MessageKey)}
              </button>
            ))}
            <span className="spacer" />
            {/* nel web il catalogo è quello della versione pubblicata */}
            {!window.api.isWeb && (
              <button
                className="small-btn"
                title={t('catalog.updateHint')}
                disabled={updating === 'running'}
                onClick={updateCatalog}
              >
                {updating === 'running' ? t('catalog.updating') : t('catalog.update')}
              </button>
            )}
          </div>
        )}
        {tab === 'google' && catalog?.tags && (
          <div className="asset-picker-folders" title={t('fonts.genreHint')}>
            <span className="muted small chip-label">{t('fonts.genreLabel')}</span>
            {FONT_GENRES.map((g) => (
              <button
                key={g}
                className={genre === g ? 'on' : ''}
                onClick={() => filtered(setGenre)(genre === g ? null : g)}
              >
                {t(`fonts.genre.${g}` as MessageKey)}
              </button>
            ))}
          </div>
        )}
        {tab === 'google' && (
          <div className="asset-picker-bar font-filters">
            {catalog?.tags && (
              <label>
                <span className="muted small">{t('fonts.styleLabel')}</span>
                <select
                  value={style ?? ''}
                  onChange={(e) => filtered(setStyle)(e.target.value || null)}
                >
                  <option value="">{t('fonts.anyStyle')}</option>
                  {STYLE_GROUPS.map((g) => (
                    <optgroup key={g.group} label={t(`fonts.styleGroup.${g.group}` as MessageKey)}>
                      {g.tags.map((tag) => (
                        <option key={tag} value={tag}>
                          {t(`fonts.tag.${tagSlug(tag)}` as MessageKey)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            )}
            <label title={t('fonts.boldItalicHint')}>
              <input
                type="checkbox"
                checked={boldItalic}
                onChange={(e) => filtered(setBoldItalic)(e.target.checked)}
              />
              {t('fonts.boldItalic')}
            </label>
            <label>
              <span className="muted small">{t('fonts.subsetLabel')}</span>
              <select
                value={subset ?? ''}
                onChange={(e) => filtered(setSubset)(e.target.value || null)}
              >
                <option value="">{t('fonts.subset.all')}</option>
                {SUBSETS.map((s) => (
                  <option key={s} value={s}>
                    {t(`fonts.subset.${s}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
            {catalog && (
              <span className="muted small font-count">
                {t('fonts.count', { n: google.length })}
              </span>
            )}
          </div>
        )}
        {tab === 'google' && similar && (
          <div className="font-similar-banner">
            <span>{t('fonts.similarTo', { family: similar })}</span>
            <button onClick={() => setSimilar(null)}>{t('fonts.backToList')}</button>
          </div>
        )}
        {tab === 'google' && updating && updating !== 'running' && (
          <p className="muted small">
            {updating.after === updating.before
              ? t('catalog.unchanged', { n: updating.after })
              : t('catalog.updated', { before: updating.before, after: updating.after })}
          </p>
        )}
        <div className={view === 'grid' ? 'font-list grid' : 'font-list'}>
          {tab === 'project' &&
            projectFamilies.map((f) => (
              <button
                key={f}
                className={
                  f.toLowerCase() === value.trim().toLowerCase() ? 'font-row on' : 'font-row'
                }
                onClick={() => {
                  onPick(f)
                  onClose()
                }}
              >
                <span className="font-row-head">
                  <b>{f}</b>
                  <span className="muted small">
                    {APP_FONTS.includes(f) && !project.families.includes(f)
                      ? t('fonts.inApp')
                      : t('fonts.inProject')}
                  </span>
                </span>
                <span className="font-sample" style={preview(f)}>
                  {sample}
                </span>
              </button>
            ))}
          {tab === 'project' && projectFamilies.length === 0 && (
            <p className="muted">{t('fonts.noProjectFonts')}</p>
          )}
          {tab === 'system' && !system && !error && <p className="muted">{t('fonts.scanning')}</p>}
          {tab === 'system' &&
            systemList.slice(0, limit).map((f) => (
              <div
                key={f.family}
                className={
                  f.family.toLowerCase() === value.trim().toLowerCase()
                    ? 'font-row system-row on'
                    : 'font-row system-row'
                }
              >
                <button
                  className="font-row-main"
                  onClick={() => {
                    onPick(f.family)
                    onClose()
                  }}
                >
                  <span className="font-row-head">
                    <b>{f.family}</b>
                    <span className="muted small">
                      {f.styles === 1 ? t('fonts.oneStyle') : t('fonts.styles', { n: f.styles })}
                      {own.has(f.family.toLowerCase())
                        ? ` · ${t('fonts.inProject')}`
                        : f.reason
                          ? ` · ${t(`fonts.reason.${f.reason}`)}`
                          : ''}
                    </span>
                  </span>
                  <span className="font-sample" style={preview(f.family)}>
                    {sample}
                  </span>
                </button>
                {f.copyable && !own.has(f.family.toLowerCase()) && (
                  <button
                    className="font-copy"
                    disabled={busy}
                    title={t('fonts.copyHint')}
                    onClick={() => copy(f.family)}
                  >
                    {t('fonts.copy')}
                  </button>
                )}
              </div>
            ))}
          {tab === 'system' && systemList.length > limit && (
            <button
              className="more-btn"
              onClick={() => setMore({ view: page, limit: limit + PAGE })}
            >
              {t('icons.more', { n: systemList.length - limit })}
            </button>
          )}
          {tab === 'system' && system && systemList.length === 0 && (
            <p className="muted">{t('fonts.noMatch')}</p>
          )}
          {tab === 'google' && !catalog && !error && <p className="muted">{t('icons.loading')}</p>}
          {tab === 'google' && catalog && !navigator.onLine && (
            <p className="field-warning">{t('fonts.offline')}</p>
          )}
          {tab === 'google' &&
            visible.map((f) => (
              <div key={f[0]} className={open?.[0] === f[0] ? 'font-row open' : 'font-row'}>
                <button
                  className={favorites.includes(f[0]) ? 'font-star on' : 'font-star'}
                  title={favorites.includes(f[0]) ? t('fonts.unfavorite') : t('fonts.favorite')}
                  aria-label={
                    favorites.includes(f[0]) ? t('fonts.unfavorite') : t('fonts.favorite')
                  }
                  aria-pressed={favorites.includes(f[0])}
                  onClick={() => toggleFavorite(f[0])}
                >
                  {favorites.includes(f[0]) ? '★' : '☆'}
                </button>
                <button className="font-row-main" onClick={() => choose(f)}>
                  <span className="font-row-head">
                    <b>{f[0]}</b>
                    <span className="muted small">
                      {t(`fonts.category.${f[1]}` as MessageKey)} ·{' '}
                      {styleCount(f) === 1
                        ? t('fonts.oneStyle')
                        : t('fonts.styles', { n: styleCount(f) })}
                      {own.has(f[0].toLowerCase()) && ` · ${t('fonts.inProject')}`}
                    </span>
                  </span>
                  <span className="font-sample" style={preview(f[0])}>
                    {sample}
                  </span>
                </button>
                {open?.[0] === f[0] && (
                  <div className="font-variants">
                    <div className="font-variant-list">
                      {allVariants(f).map((v) => (
                        <label key={key(v)}>
                          <input
                            type="checkbox"
                            checked={variants.has(key(v))}
                            onChange={() => toggle(v)}
                          />
                          {v.weight}
                          {v.italic ? ` ${t('fonts.italic')}` : ''}
                        </label>
                      ))}
                    </div>
                    <span className="muted small">
                      {t('fonts.licenseNote', { license: f[5] || '?' })}
                    </span>
                    {tags.has(f[0]) && (
                      <button
                        title={t('fonts.similarHint')}
                        onClick={() => {
                          setSimilar(f[0])
                          setOpen(null)
                        }}
                      >
                        {t('fonts.similar')}
                      </button>
                    )}
                    <button
                      className="primary"
                      disabled={!variants.size || busy}
                      onClick={() => download(f)}
                    >
                      {busy ? t('fonts.downloading') : t('fonts.download', { n: variants.size })}
                    </button>
                  </div>
                )}
              </div>
            ))}
          {tab === 'google' && google.length > limit && (
            <button
              className="more-btn"
              onClick={() => setMore({ view: page, limit: limit + PAGE })}
            >
              {t('icons.more', { n: google.length - limit })}
            </button>
          )}
          {tab === 'google' && catalog && google.length === 0 && (
            <p className="muted">
              {only === 'favorites'
                ? t('fonts.noFavorites')
                : only === 'recent'
                  ? t('fonts.noRecent')
                  : t('fonts.noMatch')}
            </p>
          )}
        </div>
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          <span className="muted small spacer-right">
            {tab === 'google'
              ? t('fonts.googleNote')
              : tab === 'system'
                ? t('fonts.systemNote')
                : t('fonts.projectNote')}
          </span>
          <button onClick={onClose} disabled={busy}>
            {t('dialog.cancel')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

const styleCount = (f: FontFamilyEntry): number => f[2].length * (f[3] ? 2 : 1)

function allVariants(f: FontFamilyEntry): FontVariant[] {
  const out = f[2].map((weight) => ({ weight, italic: false }))
  if (f[3]) out.push(...f[2].map((weight) => ({ weight, italic: true })))
  return out
}
