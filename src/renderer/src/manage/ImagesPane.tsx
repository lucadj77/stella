import { useEffect, useMemo, useRef, useState } from 'react'
import type { LoadedProject } from '../../../shared/project'
import { isImageAsset } from '../../../shared/model/assets'
import { fuzzyFilter } from '../../../shared/model/fuzzy'
import {
  baseOf,
  cleanFolder,
  dirOf,
  groupByTemplate,
  isUnusedImage,
  matchesFilter,
  type ImageFilter,
  type ImageUsage
} from '../../../shared/model/imageUsage'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { LinkList } from './ListPane'
import { useManageNav, type ManageTab } from './manageTypes'
import { assetUrl, publishAssetsUpdate } from '../render/assets'
import { askConfirm } from '../components/confirm'
import { useContextMenu } from '../components/useContextMenu'
import ThumbBackgroundSwitch from '../components/ThumbBackgroundSwitch'
import { thumbClass, useThumbBackground } from '../components/thumbBackground'
import IconBrowser from '../components/IconBrowser'
import { dragHasFiles, hasDroppedImages, importDropped } from '../components/dropImages'

// Scheda Immagini di «Gestisci il progetto» (issue #198): dove è usata ogni immagine di assets/, con filtri e
// raggruppamenti; si eliminano (nel cestino del progetto) e si spostano in cartelle. Vedi
// docs/specifica.md, sezione 3.1.

type Grouping = 'none' | 'folder' | 'template'

const FILTERS: ImageFilter[] = ['all', 'templates', 'sets', 'documents', 'unused']
const SIZE_KEY = 'imagesDialogSize'
const GROUP_KEY = 'imagesDialogGroup'

function stored<T extends string>(key: string, ok: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && ok.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // preferenza non essenziale
  }
}

export default function ImagesPane({
  project,
  usages,
  focus,
  onMoved
}: {
  project: LoadedProject
  /** Dove è usata ogni immagine: vedi imageUsages */
  usages: Map<string, ImageUsage>
  /** Immagine da mostrare selezionata, arrivando da un collegamento */
  focus?: string
  /** Dopo uno spostamento: riscrive i riferimenti che contengono la cartella */
  onMoved(moves: { from: string; to: string }[]): void
}): React.JSX.Element {
  const { t } = useI18n()
  const menu = useContextMenu()
  const [bg, setBg] = useThumbBackground()
  const [filter, setFilter] = useState<ImageFilter>('all')
  const [grouping, setGroupingState] = useState<Grouping>(() =>
    stored(GROUP_KEY, ['none', 'folder', 'template'] as const, 'folder')
  )
  const [query, setQuery] = useState('')
  const [size, setSizeState] = useState(() => {
    try {
      const n = Number(localStorage.getItem(SIZE_KEY))
      return n >= 48 && n <= 160 ? n : 88
    } catch {
      return 88
    }
  })
  const [selected, setSelected] = useState<Set<string>>(() => new Set(focus ? [focus] : []))
  const [anchor, setAnchor] = useState<string | null>(focus ?? null)
  const [moving, setMoving] = useState<string[] | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)
  const grid = useRef<HTMLDivElement>(null)
  const tiles = useRef(new Map<string, { el: HTMLElement; path: string }>())
  const [rect, setRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [importingIcons, setImportingIcons] = useState(false)
  const [dropping, setDropping] = useState(false)
  // immagini prima di un'aggiunta: quando il progetto le ha ricevute, le nuove restano selezionate
  const before = useRef<Set<string> | null>(null)

  // l'immagine scelta da un collegamento si vede subito
  useEffect(() => {
    if (focus) tiles.current.get(focus)?.el.scrollIntoView({ block: 'nearest' })
    // solo all'apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setGrouping = (g: Grouping): void => {
    setGroupingState(g)
    store(GROUP_KEY, g)
  }
  const setSize = (n: number): void => {
    setSizeState(n)
    store(SIZE_KEY, String(n))
  }

  const images = useMemo(() => project.assets.filter(isImageAsset), [project.assets])
  useEffect(() => {
    const old = before.current
    if (!old) return
    const added = images.filter((p) => !old.has(p))
    if (!added.length) return
    before.current = null
    // le nuove si vedono anche se il filtro o la ricerca le nasconderebbero
    setFilter('all')
    setQuery('')
    setSelected(new Set(added))
    setAnchor(added[0])
    requestAnimationFrame(() => {
      for (const { el, path } of tiles.current.values())
        if (path === added[0]) el.scrollIntoView({ block: 'nearest' })
    })
  }, [images])

  /** Aggiunge immagini al progetto (dal computer, dalle icone o lasciate cadere) */
  const adding = async (run: () => Promise<void>): Promise<void> => {
    setError(null)
    before.current = new Set(images)
    try {
      await run()
    } catch (e) {
      before.current = null
      setError(messageFromError(e))
    }
  }
  const addImages = (): Promise<void> =>
    adding(async () => {
      const u = await window.api.addImages()
      if (u) publishAssetsUpdate(u)
    })
  const counts = useMemo(
    () =>
      Object.fromEntries(
        FILTERS.map((f) => [f, images.filter((p) => matchesFilter(usages.get(p)!, f)).length])
      ) as Record<ImageFilter, number>,
    [images, usages]
  )
  const shown = useMemo(
    () =>
      fuzzyFilter(
        images.filter((p) => matchesFilter(usages.get(p)!, filter)),
        query,
        (p) => p.replace(/\.[^.]+$/, '')
      ),
    [images, usages, filter, query]
  )

  const sections = useMemo((): { title: string; paths: string[] }[] => {
    if (grouping === 'none') return [{ title: '', paths: shown }]
    const map = new Map<string, string[]>()
    const add = (key: string, p: string): void => {
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    if (grouping === 'folder') {
      for (const p of shown) add(dirOf(p), p)
      return [...map]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, paths]) => ({ title: k ? `assets/${k}` : 'assets', paths }))
    }
    // per template: quelli che la usano direttamente o con i loro set
    const other: string[] = []
    const docs: string[] = []
    const unused: string[] = []
    for (const p of shown) {
      const u = usages.get(p)!
      const owners = ownerTemplates(u, project)
      owners.forEach((o) => add(o, p))
      if (!owners.length) {
        if (isUnusedImage(u)) unused.push(p)
        else if (u.documents.length) docs.push(p)
        else other.push(p)
      }
    }
    const out = [...map]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, paths]) => ({ title: t('images.group.template', { name: k }), paths }))
    if (docs.length) out.push({ title: t('images.group.documents'), paths: docs })
    if (other.length) out.push({ title: t('images.group.other'), paths: other })
    if (unused.length) out.push({ title: t('images.group.unused'), paths: unused })
    return out
  }, [grouping, shown, usages, project, t])

  /** Ordine in cui si vedono le miniature, per la selezione con ⇧ */
  const order = useMemo(() => sections.flatMap((s) => s.paths), [sections])

  const click = (e: React.MouseEvent, p: string): void => {
    if (e.shiftKey && anchor && order.includes(anchor)) {
      const [a, b] = [order.indexOf(anchor), order.indexOf(p)].sort((x, y) => x - y)
      const range = order.slice(a, b + 1)
      setSelected((s) => new Set(e.metaKey || e.ctrlKey ? [...s, ...range] : range))
      return
    }
    if (e.metaKey || e.ctrlKey) {
      setSelected((s) => {
        const n = new Set(s)
        if (n.has(p)) n.delete(p)
        else n.add(p)
        return n
      })
    } else setSelected(new Set([p]))
    setAnchor(p)
  }

  // rettangolo di selezione trascinato sulla griglia, partendo da uno spazio vuoto
  const pointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.asset-tile')) return
    const box = grid.current!.getBoundingClientRect()
    const scroll = grid.current!.scrollTop
    const start = { x: e.clientX - box.left, y: e.clientY - box.top + scroll }
    const base = e.metaKey || e.ctrlKey || e.shiftKey ? new Set(selected) : new Set<string>()
    setSelected(base)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent): void => {
      const b = grid.current!.getBoundingClientRect()
      const cur = { x: ev.clientX - b.left, y: ev.clientY - b.top + grid.current!.scrollTop }
      const r = {
        x0: Math.min(start.x, cur.x),
        y0: Math.min(start.y, cur.y),
        x1: Math.max(start.x, cur.x),
        y1: Math.max(start.y, cur.y)
      }
      setRect(r)
      const hit = new Set(base)
      for (const { el, path: p } of tiles.current.values()) {
        const tb = el.getBoundingClientRect()
        const x0 = tb.left - b.left
        const y0 = tb.top - b.top + grid.current!.scrollTop
        if (x0 < r.x1 && x0 + tb.width > r.x0 && y0 < r.y1 && y0 + tb.height > r.y0) hit.add(p)
      }
      setSelected(hit)
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setRect(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const describe = (u: ImageUsage): string => {
    const parts: string[] = []
    if (u.templates.length) parts.push(t('images.badge.templates', { n: u.templates.length }))
    if (u.sets.length) parts.push(t('images.badge.sets', { n: u.sets.length }))
    if (u.documents.length) parts.push(t('images.badge.documents', { n: u.documents.length }))
    if (u.variables.length || u.styles.length) parts.push(t('images.badge.definitions'))
    if (u.cover) parts.push(t('images.badge.cover'))
    return parts.join(' · ') || t('images.badge.unused')
  }

  const remove = async (paths: string[]): Promise<void> => {
    if (!paths.length || busy) return
    const used = paths.filter((p) => !isUnusedImage(usages.get(p)!))
    const ok = await askConfirm({
      title:
        paths.length === 1
          ? t('images.delete.titleOne', { name: baseOf(paths[0]) })
          : t('images.delete.titleMany', { n: paths.length }),
      message: used.length
        ? t('images.delete.used', {
            n: used.length,
            names: used.slice(0, 5).map(baseOf).join(', ') + (used.length > 5 ? '…' : '')
          })
        : t('images.delete.unused', { n: paths.length }),
      ok: t('images.delete.ok', { n: paths.length }),
      danger: true
    })
    if (!ok) return
    setBusy(true)
    setError(null)
    try {
      publishAssetsUpdate(await window.api.trashImages(paths))
      setSelected(new Set())
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setBusy(false)
    }
  }

  const move = async (moves: { paths: string[]; folder: string }[]): Promise<boolean> => {
    setBusy(true)
    setError(null)
    const done: { from: string; to: string }[] = []
    try {
      for (const m of moves) {
        const r = await window.api.moveImages(m.paths, m.folder)
        publishAssetsUpdate(r.update)
        done.push(...r.moves)
      }
      return true
    } catch (e) {
      setError(messageFromError(e))
      return false
    } finally {
      if (done.length) {
        onMoved(done)
        const to = new Map(done.map((d) => [d.from, d.to]))
        setSelected((s) => new Set([...s].map((p) => to.get(p) ?? p)))
      }
      setBusy(false)
    }
  }

  const groupAll = async (): Promise<void> => {
    const plan = groupByTemplate(usages, project.templates, project.sets)
    if (!plan.length) {
      await askConfirm({
        title: t('images.group.nothing'),
        ok: t('dialog.ok'),
        cancel: null
      })
      return
    }
    const folders = [...new Set(plan.map((p) => p.folder))]
    const ok = await askConfirm({
      title: t('images.groupByTemplate.title', { n: plan.length, folders: folders.length }),
      message:
        folders
          .map((f) => `assets/${f} (${plan.filter((p) => p.folder === f).length})`)
          .join(', ') +
        '. ' +
        t('images.groupByTemplate.message'),
      ok: t('images.groupByTemplate.ok')
    })
    if (!ok) return
    await move(
      folders.map((folder) => ({
        folder,
        paths: plan.filter((p) => p.folder === folder).map((p) => p.path)
      }))
    )
  }

  const chosen = order.filter((p) => selected.has(p))
  const single = chosen.length === 1 ? chosen[0] : null

  const tileMenu = (e: React.MouseEvent, p: string): void => {
    const paths = selected.has(p) ? chosen : [p]
    if (!selected.has(p)) {
      setSelected(new Set([p]))
      setAnchor(p)
    }
    menu.open(e, [
      { label: t('images.move', { n: paths.length }), onClick: () => setMoving(paths) },
      'sep',
      {
        label: t('images.delete', { n: paths.length }),
        danger: true,
        shortcut: t('images.deleteKey'),
        onClick: () => void remove(paths)
      }
    ])
  }

  return (
    <>
      <div
        className="images-dialog asset-picker manage-pane"
        tabIndex={-1}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).tagName === 'INPUT') return
          if ((e.key === 'Delete' || e.key === 'Backspace') && chosen.length) {
            e.preventDefault()
            void remove(chosen)
          } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            setSelected(new Set(order))
          }
        }}
      >
        <p className="muted small">{t('images.hint')}</p>
        <div className="images-filters" role="tablist">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? 'on' : ''}
              onClick={() => setFilter(f)}
              title={t(`images.filter.${f}.hint`)}
            >
              {t(`images.filter.${f}`)} <span className="images-count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="asset-picker-bar">
          <input
            type="search"
            value={query}
            placeholder={t('assetPicker.search')}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="images-group" title={t('images.groupBy.hint')}>
            {t('images.groupBy')}
            <select value={grouping} onChange={(e) => setGrouping(e.target.value as Grouping)}>
              <option value="none">{t('images.groupBy.none')}</option>
              <option value="folder">{t('images.groupBy.folder')}</option>
              <option value="template">{t('images.groupBy.template')}</option>
            </select>
          </label>
          <input
            type="range"
            min={48}
            max={160}
            step={8}
            value={size}
            title={t('assetPicker.size')}
            onChange={(e) => setSize(Number(e.target.value))}
          />
          <ThumbBackgroundSwitch value={bg} onChange={setBg} />
          <button onClick={() => void addImages()} title={t('images.addHint')}>
            {t('assetPicker.addImages')}
          </button>
          <button
            onClick={() => {
              before.current = new Set(images)
              setImportingIcons(true)
            }}
          >
            {t('assetPicker.importIcons')}
          </button>
        </div>
        {error && <div className="banner error">{t(error)}</div>}
        <div
          className={'images-body' + (dropping ? ' dropping' : '')}
          onDragOver={(e) => {
            if (!dragHasFiles(e)) return
            e.preventDefault()
            setDropping(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false)
          }}
          onDrop={(e) => {
            setDropping(false)
            // un pacchetto .zip passa alla finestra
            if (!hasDroppedImages(e)) return
            e.preventDefault()
            void adding(async () => {
              await importDropped(e)
            })
          }}
        >
          <div
            ref={grid}
            className="images-grid-wrap"
            onPointerDown={pointerDown}
            onContextMenu={(e) => e.preventDefault()}
          >
            {images.length === 0 ? (
              <p className="muted">{t('assetPicker.empty')}</p>
            ) : shown.length === 0 ? (
              <p className="muted">{t('images.noneHere')}</p>
            ) : (
              sections.map((s) => (
                <section key={s.title || '-'}>
                  {s.title && (
                    <h3 className="asset-grid-title">
                      {s.title} <span className="muted small">{s.paths.length}</span>
                    </h3>
                  )}
                  <div
                    className={'asset-grid' + thumbClass(bg)}
                    style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}
                  >
                    {s.paths.map((p) => {
                      const u = usages.get(p)!
                      return (
                        <button
                          key={p}
                          ref={(el) => {
                            // con il raggruppamento per template una miniatura può comparire più volte
                            const k = `${s.title}\n${p}`
                            if (el) tiles.current.set(k, { el, path: p })
                            else tiles.current.delete(k)
                          }}
                          className={
                            'asset-tile' +
                            (selected.has(p) ? ' on' : '') +
                            (isUnusedImage(u) ? ' unused' : '')
                          }
                          title={`${p}\n${describe(u)}`}
                          onClick={(e) => click(e, p)}
                          onDoubleClick={() => setMoving([p])}
                          onContextMenu={(e) => tileMenu(e, p)}
                        >
                          <span className="asset-thumb" style={{ height: size }}>
                            <img src={assetUrl(p)} alt="" loading="lazy" draggable={false} />
                          </span>
                          <span className="asset-name">{baseOf(p).replace(/\.[^.]+$/, '')}</span>
                          <span className="images-badge">{describe(u)}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))
            )}
            {rect && (
              <div
                className="images-rect"
                style={{
                  left: rect.x0,
                  top: rect.y0,
                  width: rect.x1 - rect.x0,
                  height: rect.y1 - rect.y0
                }}
              />
            )}
          </div>
          <aside className="images-side">
            {chosen.length === 0 ? (
              <p className="muted small">{t('images.selectHint')}</p>
            ) : (
              <>
                {single ? (
                  <Details path={single} usage={usages.get(single)!} />
                ) : (
                  <p>
                    <strong>{t('images.selected', { n: chosen.length })}</strong>
                  </p>
                )}
                <div className="images-actions">
                  <button disabled={busy} onClick={() => setMoving(chosen)}>
                    {t('images.move', { n: chosen.length })}
                  </button>
                  <button className="danger" disabled={busy} onClick={() => void remove(chosen)}>
                    {t('images.delete', { n: chosen.length })}
                  </button>
                </div>
              </>
            )}
            <div className="images-folders-tool">
              <p className="muted small">{t('images.groupByTemplate.hint')}</p>
              <button disabled={busy} onClick={groupAll}>
                {t('images.groupByTemplate')}
              </button>
            </div>
          </aside>
        </div>
        <p className="muted small manage-count">
          {t('assetPicker.count', { n: shown.length, total: images.length })}
        </p>
      </div>
      {menu.node}
      {importingIcons && (
        <IconBrowser
          onClose={() => {
            setImportingIcons(false)
            // nessuna icona importata: niente da selezionare alla prossima modifica
            if (before.current && images.every((p) => before.current!.has(p))) before.current = null
          }}
        />
      )}
      {moving && (
        <MoveDialog
          paths={moving}
          folders={[...new Set(images.map(dirOf))].sort()}
          onMove={async (folder) => {
            if (await move([{ paths: moving, folder }])) setMoving(null)
          }}
          onClose={() => setMoving(null)}
        />
      )}
    </>
  )
}

/** Template che usano l'immagine, direttamente o con le carte dei loro set */
function ownerTemplates(u: ImageUsage, project: LoadedProject): string[] {
  const owners = new Set(u.templates)
  for (const s of u.sets) {
    const set = project.sets.find((x) => x.name === s)
    if (set) owners.add(set.template)
  }
  return [...owners].sort()
}

function Details({ path, usage }: { path: string; usage: ImageUsage }): React.JSX.Element {
  const { t } = useI18n()
  const { go } = useManageNav()
  const rows: [string, string[], ManageTab, (n: string) => string][] = [
    [t('images.where.templates'), usage.templates, 'templates', (n) => n],
    [t('images.where.sets'), usage.sets, 'sets', (n) => n],
    [t('images.where.documents'), usage.documents, 'documents', (n) => n],
    [t('images.where.variables'), usage.variables, 'variables', (n) => `{${n}}`],
    [t('images.where.styles'), usage.styles, 'styles', (n) => `.${n}`]
  ]
  return (
    <div className="images-details">
      <img src={assetUrl(path)} alt="" draggable={false} />
      <code>assets/{path}</code>
      {isUnusedImage(usage) ? (
        <p className="muted small">{t('images.where.none')}</p>
      ) : (
        <dl>
          {rows
            .filter(([, list]) => list.length)
            .map(([label, list, tab, format]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <LinkList items={list} format={format} onClick={(n) => go(tab, n)} />
                </dd>
              </div>
            ))}
          {usage.cover && (
            <div>
              <dt>{t('images.where.cover')}</dt>
              <dd>✓</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}

/** Sceglie o scrive la cartella di destinazione, sotto assets/ */
function MoveDialog({
  paths,
  folders,
  onMove,
  onClose
}: {
  paths: string[]
  folders: string[]
  onMove(folder: string): Promise<void>
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [folder, setFolder] = useState(dirOf(paths[0]))
  const clean = cleanFolder(folder)
  const same = clean !== null && paths.every((p) => dirOf(p) === clean)
  return (
    <Dialog title={t('images.moveTitle', { n: paths.length })} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (clean !== null && !same) void onMove(clean)
        }}
      >
        <p className="muted small">{t('images.moveHint')}</p>
        <label>
          {t('images.folder')}
          <span className="images-folder-field">
            <span className="muted">assets/</span>
            <input
              autoFocus
              list="images-folders"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
            />
          </span>
          <datalist id="images-folders">
            {folders.filter(Boolean).map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>
        <div className="images-folder-list">
          {folders.map((f) => (
            <button
              type="button"
              key={f || '-'}
              className={clean === f ? 'small-btn on' : 'small-btn'}
              onClick={() => setFolder(f)}
            >
              {f ? `assets/${f}` : 'assets'}
            </button>
          ))}
        </div>
        {clean === null && <p className="field-error">{t('images.badFolder', { folder })}</p>}
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button className="primary" disabled={clean === null || same}>
            {t('images.moveOk', { n: paths.length })}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
