import { useContext, useMemo, useState } from 'react'
import { assetRefName, isImageAsset, resolveAsset } from '../../../shared/model/assets'
import { fuzzyFilter } from '../../../shared/model/fuzzy'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { BUILTIN_SHAPES } from '../../../shared/model/markup'
import { messageFromError, type Message } from '../../../shared/messages'
import { AssetsContext, assetUrl, publishAssetsUpdate, VariablesContext } from '../render/assets'
import MarkupText from '../render/MarkupText'
import IconBrowser from './IconBrowser'

const SIZE_KEY = 'assetPickerSize'
const DARK_KEY = 'assetPickerDark'

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
  extras = false
}: {
  /** Nome scritto ora nel campo: la sua immagine appare selezionata */
  value: string
  onPick(name: string): void
  onClose(): void
  extras?: boolean | 'variables'
}): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const variables = useContext(VariablesContext)
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState<string | null>(null)
  const [size, setSizeState] = useState(loadSize)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<Message | null>(null)
  // le icone bianche su sfondo chiaro non si vedono
  const [dark, setDarkState] = useState(() => {
    try {
      return localStorage.getItem(DARK_KEY) === '1'
    } catch {
      return false
    }
  })
  const setDark = (on: boolean): void => {
    setDarkState(on)
    try {
      localStorage.setItem(DARK_KEY, on ? '1' : '0')
    } catch {
      // preferenza non essenziale
    }
  }
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
    () => [...new Set(images.filter((a) => a.includes('/')).map((a) => a.split('/')[0]))].sort(),
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
      className={on ? 'asset-tile on' : 'asset-tile'}
      title={name}
      onClick={() => {
        onPick(name)
        onClose()
      }}
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
      const u = await window.api.addImages()
      if (u) publishAssetsUpdate(u)
    } catch (e) {
      setError(messageFromError(e))
    }
  }

  const pick = (path: string): void => {
    onPick(assetRefName(path, assets))
    onClose()
  }

  return (
    <Dialog title={t('assetPicker.title')} onClose={onClose}>
      <div className="asset-picker">
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
          <button className={dark ? 'small-btn on' : 'small-btn'} onClick={() => setDark(!dark)}>
            {t('icons.darkBackground')}
          </button>
          <button onClick={addImages} title={t('assetPicker.addImagesHint')}>
            {t('assetPicker.addImages')}
          </button>
          <button onClick={() => setImporting(true)}>{t('assetPicker.importIcons')}</button>
        </div>
        {error && <div className="banner error">{t(error)}</div>}
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
            className={dark ? 'asset-grid dark' : 'asset-grid'}
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}
          >
            {shapes.length > 0 && <h3 className="asset-grid-title">{t('assetPicker.shapes')}</h3>}
            {shapes.map((x) =>
              tile(`shape:${x}`, x, value === x, markupThumb(`[\u2007]{bg=${x} bg-color=#8A8A8A}`))
            )}
            {imageVars.length > 0 && (
              <h3 className="asset-grid-title">{t('assetPicker.variables')}</h3>
            )}
            {imageVars.map((n) => tile(`var:${n}`, n, value === n, markupThumb(`{${n}}`)))}
            {extraCount > 0 && shown.length > 0 && (
              <h3 className="asset-grid-title">{t('assetPicker.files')}</h3>
            )}
            {shown.map((a) => {
              const name = a.slice(a.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '')
              return (
                <button
                  key={a}
                  className={a === current ? 'asset-tile on' : 'asset-tile'}
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
          <button onClick={onClose}>{t('dialog.cancel')}</button>
        </div>
      </div>
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
