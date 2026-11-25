import { getImagesFolder } from './imagesFolder'
import ImagesFolderField from './ImagesFolderField'
import { useContext, useMemo, useState } from 'react'
import {
  assetRefName,
  isImageAsset,
  isRemoteImage,
  resolveAsset
} from '../../../shared/model/assets'
import { fuzzyFilter } from '../../../shared/model/fuzzy'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { BUILTIN_SHAPES } from '../../../shared/model/markup'
import { messageFromError, type Message } from '../../../shared/messages'
import {
  AssetsContext,
  assetUrl,
  publishAssetsUpdate,
  refreshRemoteImages,
  SourcesContext,
  VariablesContext
} from '../render/assets'
import MarkupText from '../render/MarkupText'
import { dragHasFiles, hasDroppedImages, importDropped } from './dropImages'
import IconBrowser from './IconBrowser'
import UrlImageDialog from './UrlImageDialog'
import QrDialog from './QrDialog'
import ThumbBackgroundSwitch from './ThumbBackgroundSwitch'
import { thumbClass, useThumbBackground } from './thumbBackground'
import { canOpenManage, openManage } from '../manage/manageTypes'

const SIZE_KEY = 'assetPickerSize'

function loadSize(): number {
  try {
    const n = Number(localStorage.getItem(SIZE_KEY))
    return n >= 48 && n <= 160 ? n : 80
  } catch {
    return 80
  }
}

/**
 * Finestra con le miniature delle immagini di assets/: un clic sceglie l'immagine e restituisce
 * il nome con cui richiamarla (nome breve, o con la cartella se è ambiguo). Con `extras` propone
 * prima le forme predefinite e le variabili immagine, come serve per bg= nel markup; con
 * `extras="variables"` solo le variabili, come per le immagini dello schema del tavolo.
 */
export default function AssetPicker({
  value,
  onPick,
  onClose,
  onSkip,
  onPickMany,
  bracedVariables = false,
  extras = false
}: {
  /** Nome scritto ora nel campo: la sua immagine appare selezionata */
  value: string
  onPick(name: string): void
  onClose(): void
  /** Per un livello nuovo: «Senza immagine» lo crea vuoto, da collegare poi a una colonna */
  onSkip?(): void
  extras?: boolean | 'variables'
  /**
   * Scelta di più immagini insieme (per esempio le voci di un elenco): un clic seleziona o
   * deseleziona, «Aggiungi» le passa tutte nell'ordine in cui sono state scelte
   */
  onPickMany?(names: string[]): void
  /**
   * Le variabili immagine si restituiscono tra graffe ({cuore}), come nelle voci di un elenco:
   * così non si confondono con un file con lo stesso nome
   */
  bracedVariables?: boolean
}): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const variables = useContext(VariablesContext)
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState<string | null>(null)
  const [size, setSizeState] = useState(loadSize)
  const [importing, setImporting] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [fromUrl, setFromUrl] = useState(false)
  const [qr, setQr] = useState(false)
  const [busy, setBusy] = useState(false)
  const sources = useContext(SourcesContext)
  const [error, setError] = useState<Message | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const multi = !!onPickMany
  /** Con la scelta multipla un clic aggiunge o toglie dalla selezione, altrimenti sceglie */
  const choose = (name: string): void => {
    if (!multi) {
      onPick(name)
      onClose()
      return
    }
    setChosen((c) => (c.includes(name) ? c.filter((x) => x !== name) : [...c, name]))
  }
  const [bg, setBg] = useThumbBackground()
  const setSize = (n: number): void => {
    setSizeState(n)
    try {
      localStorage.setItem(SIZE_KEY, String(n))
    } catch {
      // preferenza non essenziale
    }
  }

  const images = useMemo(() => assets.filter(isImageAsset), [assets])
  const folders = useMemo(
    // tutte le cartelle, anche quelle dentro le altre (images/Eroi): ognuna mostra anche le sue
    () =>
      [
        ...new Set(
          images.flatMap((a) => {
            const parts = a.split('/').slice(0, -1)
            return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
          })
        )
      ].sort(),
    [images]
  )
  const current = useMemo(() => {
    const r = resolveAsset(value, assets)
    return r.ok ? r.path : null
  }, [value, assets])
  const shown = useMemo(
    () =>
      fuzzyFilter(
        images.filter((a) => !folder || a.startsWith(folder + '/')),
        query,
        (a) => a.replace(/\.[^.]+$/, '')
      ),
    [images, folder, query]
  )

  // forme e variabili non stanno in una cartella: si vedono solo con "Tutte"
  const shapes = useMemo(
    () => (extras === true && !folder ? fuzzyFilter([...BUILTIN_SHAPES], query, (x) => x) : []),
    [extras, folder, query]
  )
  const imageVars = useMemo(
    () =>
      extras && !folder
        ? fuzzyFilter(
            Object.keys(variables ?? {})
              .filter((n) => variables[n].type === 'image')
              .sort(),
            query,
            (x) => x
          )
        : [],
    [extras, folder, query, variables]
  )
  const tile = (
    key: string,
    name: string,
    on: boolean,
    thumb: React.ReactNode
  ): React.ReactNode => (
    <button
      key={key}
      className={(multi ? chosen.includes(name) : on) ? 'asset-tile on' : 'asset-tile'}
      title={name}
      aria-pressed={multi ? chosen.includes(name) : undefined}
      onClick={() => choose(name)}
    >
      <span className="asset-thumb" style={{ height: size }}>
        {thumb}
      </span>
      <span className="asset-name">{name}</span>
    </button>
  )
  /** Forma o variabile disegnata come nel testo, alta quanto la miniatura */
  const markupThumb = (text: string): React.ReactNode => (
    <span className="asset-markup" style={{ fontSize: size * 0.45 }}>
      <MarkupText text={text} unit={4} ratio={1} paragraphSpacing={0} />
    </span>
  )
  const extraCount = shapes.length + imageVars.length

  /** Copia in assets/images/ immagini scelte dal computer */
  const addImages = async (): Promise<void> => {
    setError(null)
    try {
      const u = await window.api.addImages(getImagesFolder())
      if (u) publishAssetsUpdate(u)
    } catch (e) {
      setError(messageFromError(e))
    }
  }

  /** Riscarica da internet: il collegamento scritto nel campo, o il file scaricato scelto */
  const redownload = async (): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      if (link) await refreshRemoteImages([link])
      else if (current) publishAssetsUpdate(await window.api.redownloadImage(current))
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setBusy(false)
    }
  }
  const link = isRemoteImage(value) ? value.trim() : null
  const downloaded = current && sources[current]?.kind === 'image' ? sources[current] : null

  const pick = (path: string): void => choose(assetRefName(path, assets))

  return (
    <Dialog title={t('assetPicker.title')} onClose={onClose}>
      <div
        className={'asset-picker' + (dropping ? ' dropping' : '')}
        // immagini trascinate dal computer: entrano nel progetto; una sola si sceglie subito
        onDragOver={(e) => {
          if (!dragHasFiles(e)) return
          e.preventDefault()
          setDropping(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropping(false)
        }}
        onDrop={async (e) => {
          setDropping(false)
          if (!hasDroppedImages(e)) return
          e.preventDefault()
          setError(null)
          try {
            const names = await importDropped(e)
            if (names.length === 1) {
              onPick(names[0])
              onClose()
            }
          } catch (err) {
            setError(messageFromError(err))
          }
        }}
      >
        <div className="asset-picker-bar">
          <input
            autoFocus
            type="search"
            value={query}
            placeholder={t('assetPicker.search')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && shown.length > 0 && pick(shown[0])}
          />
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
          <ImagesFolderField />
          <button onClick={addImages} title={t('assetPicker.addImagesHint')}>
            {t('assetPicker.addImages')}
          </button>
          <button onClick={() => setImporting(true)}>{t('assetPicker.importIcons')}</button>
          <button onClick={() => setFromUrl(true)} title={t('assetPicker.fromUrlHint')}>
            {t('assetPicker.fromUrl')}
          </button>
          <button onClick={() => setQr(true)} title={t('assetPicker.qrHint')}>
            {t('assetPicker.qr')}
          </button>
          {canOpenManage() && (
            <button
              onClick={() => {
                onClose()
                openManage('images')
              }}
              title={t('images.menuHint')}
            >
              {t('images.manage')}
            </button>
          )}
        </div>
        {error && <div className="banner error">{t(error)}</div>}
        {link && (
          <div className="asset-link">
            <img src={assetUrl(link)} alt="" draggable={false} />
            <span className="muted small">{t('assetPicker.link')}</span>
            <code title={link}>{link}</code>
            <button disabled={busy} onClick={redownload} title={t('assetPicker.refreshLinkHint')}>
              {t('assetPicker.refreshLink')}
            </button>
          </div>
        )}
        {folders.length > 0 && (
          <div className="asset-picker-folders">
            <button className={folder === null ? 'on' : ''} onClick={() => setFolder(null)}>
              {t('assetPicker.all')}
            </button>
            {folders.map((f) => (
              <button key={f} className={folder === f ? 'on' : ''} onClick={() => setFolder(f)}>
                {f}
              </button>
            ))}
          </div>
        )}
        {images.length === 0 && !extraCount ? (
          <p className="muted">{t('assetPicker.empty')}</p>
        ) : shown.length === 0 && !extraCount ? (
          <p className="muted">{t('assetPicker.noMatch')}</p>
        ) : (
          <div
            className={'asset-grid' + thumbClass(bg)}
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}
          >
            {shapes.length > 0 && <h3 className="asset-grid-title">{t('assetPicker.shapes')}</h3>}
            {shapes.map((x) =>
              tile(`shape:${x}`, x, value === x, markupThumb(`[\u2007]{bg=${x} bg-color=#8A8A8A}`))
            )}
            {imageVars.length > 0 && (
              <h3 className="asset-grid-title">{t('assetPicker.variables')}</h3>
            )}
            {imageVars.map((n) => {
              const ref = bracedVariables ? `{${n}}` : n
              return tile(`var:${n}`, ref, value.trim() === ref, markupThumb(`{${n}}`))
            })}
            {extraCount > 0 && shown.length > 0 && (
              <h3 className="asset-grid-title">{t('assetPicker.files')}</h3>
            )}
            {shown.map((a) => {
              const name = a.slice(a.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '')
              return (
                <button
                  key={a}
                  className={
                    (multi ? chosen.includes(assetRefName(a, assets)) : a === current)
                      ? 'asset-tile on'
                      : 'asset-tile'
                  }
                  title={a}
                  onClick={() => pick(a)}
                >
                  <span className="asset-thumb" style={{ height: size }}>
                    <img src={assetUrl(a)} alt="" loading="lazy" draggable={false} />
                  </span>
                  <span className="asset-name">{name}</span>
                </button>
              )
            })}
          </div>
        )}
        <div className="dialog-buttons">
          <span className="muted small spacer-right">
            {t('assetPicker.count', { n: shown.length, total: images.length })}
          </span>
          {downloaded && current && (
            <button
              disabled={busy}
              onClick={redownload}
              title={t('assetPicker.redownloadHint', { url: downloaded.url ?? '' })}
            >
              {t('assetPicker.redownload', { name: current.slice(current.lastIndexOf('/') + 1) })}
            </button>
          )}
          {onSkip && (
            <button onClick={onSkip} title={t('assetPicker.skipHint')}>
              {t('assetPicker.skip')}
            </button>
          )}
          {multi && (
            <button
              disabled={!shown.length}
              title={t('assetPicker.selectShownHint')}
              onClick={() =>
                setChosen((c) => [
                  ...c,
                  ...shown.map((a) => assetRefName(a, assets)).filter((n) => !c.includes(n))
                ])
              }
            >
              {t('assetPicker.selectShown')}
            </button>
          )}
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          {multi && (
            <button
              className="primary"
              disabled={!chosen.length}
              onClick={() => {
                onPickMany?.(chosen)
                onClose()
              }}
            >
              {t('assetPicker.addChosen', { n: chosen.length })}
            </button>
          )}
        </div>
      </div>
      {qr && (
        <QrDialog
          value={value}
          onPick={(name) => {
            onPick(name)
            onClose()
          }}
          onClose={() => setQr(false)}
        />
      )}
      {fromUrl && (
        <UrlImageDialog
          onPick={(name) => {
            onPick(name)
            onClose()
          }}
          onClose={() => setFromUrl(false)}
        />
      )}
      {importing && (
        <IconBrowser
          // con una sola icona importata la si sceglie subito
          onImported={(names) => {
            if (names.length === 1) {
              onPick(names[0])
              onClose()
            }
          }}
          onClose={() => setImporting(false)}
        />
      )}
    </Dialog>
  )
}
