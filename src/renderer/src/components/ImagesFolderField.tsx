import { useContext, useMemo, useState } from 'react'
import { isImageAsset } from '../../../shared/model/assets'
import { cleanFolder, dirOf } from '../../../shared/model/imageUsage'
import { IMAGES_FOLDER } from '../../../shared/library'
import { AssetsContext } from '../render/assets'
import { useI18n } from '../i18n/context'
import { changeImagesFolder, getImagesFolder, useImagesFolder } from './imagesFolder'

/**
 * Campo «Cartella» per le immagini nuove: le cartelle che hanno già immagini, o una nuova scritta
 * a mano (si crea con la prima immagine)
 */
export default function ImagesFolderField(): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const folder = useImagesFolder() ?? IMAGES_FOLDER
  // quello che si sta scrivendo; null: la cartella scelta
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? folder
  const folders = useMemo(
    () =>
      [...new Set([IMAGES_FOLDER, ...assets.filter(isImageAsset).map(dirOf)])]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [assets]
  )
  const clean = text.trim() ? cleanFolder(text) : IMAGES_FOLDER
  const bad = !clean
  const commit = (): void => {
    if (bad) return
    const next = clean === IMAGES_FOLDER ? undefined : clean
    setDraft(null)
    if (next !== getImagesFolder()) changeImagesFolder(next)
  }
  return (
    <label className="images-folder" title={t('images.folderHint')}>
      {t('images.folder')}
      <input
        list="images-folders"
        value={text}
        className={bad ? 'invalid' : undefined}
        aria-invalid={bad}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape' && draft !== null) {
            e.stopPropagation()
            setDraft(null)
          }
        }}
      />
      <datalist id="images-folders">
        {folders.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      {bad && <span className="field-error">{t('images.badFolder', { folder: text })}</span>}
    </label>
  )
}
