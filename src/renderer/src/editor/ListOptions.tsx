import { useContext, useMemo, useState } from 'react'
import { assetRefName, isImageAsset, resolveAsset } from '../../../shared/model/assets'
import { findOption, PRIMARY_PROPERTY, type Layer } from '../../../shared/model/template'
import { defaultValue } from '../../../shared/model/bind'
import AssetPicker from '../components/AssetPicker'
import { ColorSwatch } from '../components/ColorPicker'
import { ImageIcon } from '../components/icons'
import { useI18n } from '../i18n/context'
import { AssetsContext, assetUrl } from '../render/assets'

/** Miniatura di un'immagine del progetto, o un riquadro vuoto se non si trova */
export function OptionThumb({ name }: { name: string }): React.JSX.Element {
  const assets = useContext(AssetsContext)
  const r = name.trim() ? resolveAsset(name.trim(), assets) : null
  return (
    <span className="option-thumb">
      {r?.ok ? <img src={assetUrl(r.path)} alt="" draggable={false} /> : null}
    </span>
  )
}

/**
 * Le voci dell'elenco di un livello (fonte «Elenco»): una riga per voce, con la miniatura per le
 * immagini e il campione per i colori. Il pallino sceglie la voce che vale quando la cella è
 * vuota, cioè il valore del template.
 */
export default function ListOptions({
  layer: l,
  options,
  set
}: {
  layer: Layer
  options: string[]
  set(patch: Partial<Layer>): void
}): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const [picking, setPicking] = useState<number | 'new' | null>(null)
  const current = defaultValue(l) ?? ''
  const isDefault = findOption(options, current)
  const key = PRIMARY_PROPERTY[l.type]
  const write = (next: string[]): void => {
    if (l.source.kind !== 'column') return
    set({ source: { ...l.source, options: next } })
  }
  const update = (i: number, v: string): void => {
    const next = options.slice()
    // la voce che era il valore del template lo resta anche con il nome nuovo
    if (isDefault !== undefined && options[i] === isDefault)
      set({
        source: { kind: 'column', column: colOf(l), options: replace(next, i, v) },
        [key]: v
      } as Partial<Layer>)
    else write(replace(next, i, v))
  }
  const move = (i: number, d: -1 | 1): void => {
    const j = i + d
    if (j < 0 || j >= options.length) return
    const next = options.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    write(next)
  }
  const remove = (i: number): void => write(options.filter((_, k) => k !== i))
  const folders = useMemo(
    () =>
      [
        ...new Set(
          assets
            .filter(isImageAsset)
            .map((a) => (a.includes('/') ? a.slice(0, a.lastIndexOf('/')) : ''))
        )
      ].sort(),
    [assets]
  )
  const fromFolder = (folder: string): void => {
    const names = assets
      .filter((a) => isImageAsset(a) && a.slice(0, Math.max(0, a.lastIndexOf('/'))) === folder)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((a) => assetRefName(a, assets))
    const next = [...options]
    for (const n of names) if (!findOption(next, n)) next.push(n)
    write(next)
  }

  return (
    <div className="list-options">
      <span className="field-label">{t('source.options')}</span>
      {options.length === 0 && <p className="small muted">{t('source.optionsEmpty')}</p>}
      <ul>
        {options.map((o, i) => (
          <li key={i} className={o === isDefault ? 'is-default' : undefined}>
            <input
              type="radio"
              name={`default-${l.id}`}
              title={t('source.optionDefault')}
              aria-label={t('source.optionDefault')}
              checked={o === isDefault}
              onChange={() => set({ [key]: o } as Partial<Layer>)}
            />
            {l.type === 'image' && (
              <button
                type="button"
                className="option-pick"
                title={t('assetPicker.open')}
                onClick={() => setPicking(i)}
              >
                <OptionThumb name={o} />
              </button>
            )}
            {l.type === 'shape' && (
              <ColorSwatch
                value={o}
                title={t('cardForm.pickColor')}
                onChange={(c) => update(i, c)}
              />
            )}
            <input
              type="text"
              className="option-text"
              value={o}
              aria-label={t('source.option', { n: i + 1 })}
              onChange={(e) => update(i, e.target.value)}
            />
            <span className="option-tools">
              <button
                type="button"
                className="icon-btn"
                title={t('source.optionUp')}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                title={t('source.optionDown')}
                disabled={i === options.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn"
                title={t('source.optionRemove')}
                onClick={() => remove(i)}
              >
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="list-options-add">
        {l.type === 'image' ? (
          <>
            <button type="button" className="pick-btn" onClick={() => setPicking('new')}>
              <ImageIcon /> {t('source.optionAddImage')}
            </button>
            {folders.length > 0 && (
              <select
                value=""
                title={t('source.optionsFromFolderHint')}
                onChange={(e) => e.target.value !== '' && fromFolder(e.target.value.slice(1))}
              >
                <option value="">{t('source.optionsFromFolder')}</option>
                {folders.map((f) => (
                  <option key={f} value={'/' + f}>
                    {f || 'assets'}
                  </option>
                ))}
              </select>
            )}
          </>
        ) : (
          <button type="button" className="pick-btn" onClick={() => write([...options, ''])}>
            {t('source.optionAdd')}
          </button>
        )}
      </div>
      {current.trim() && !isDefault && (
        <p className="small warn">{t('source.defaultNotInList', { value: current })}</p>
      )}
      {picking !== null && (
        <AssetPicker
          value={picking === 'new' ? '' : (options[picking] ?? '')}
          onPick={(name) => {
            if (picking === 'new') {
              if (!findOption(options, name)) write([...options, name])
            } else update(picking, name)
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}

const replace = (list: string[], i: number, v: string): string[] =>
  list.map((x, k) => (k === i ? v : x))

const colOf = (l: Layer): string | null => (l.source.kind === 'column' ? l.source.column : null)
