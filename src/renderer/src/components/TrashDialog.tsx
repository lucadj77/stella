import { useEffect, useState } from 'react'
import type { DeletedItem } from '../../../shared/project'
import { templateColumns } from '../../../shared/model/sheet'
import type { Template } from '../../../shared/model/template'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { publishAssetsUpdate } from '../render/assets'
import { messageFromError, type Message } from '../../../shared/messages'

/** Template con più colonne in comune con il foglio: il più probabile per ripristinarlo */
function bestTemplate(columns: string[], templates: Template[]): string {
  let best = templates[0]?.name ?? ''
  let score = -1
  for (const t of templates) {
    const n = templateColumns(t).filter((c) => columns.includes(c)).length
    if (n > score) {
      best = t.name
      score = n
    }
  }
  return best
}

/** Cestino del progetto: template, note, set e immagini eliminati, da rimettere nel progetto */
export default function TrashDialog({
  templates,
  onRestore,
  onClose
}: {
  templates: Template[]
  /** Per un foglio, il template del set che si crea */
  onRestore(item: DeletedItem, template: string): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const [items, setItems] = useState<DeletedItem[] | null>(null)
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [error, setError] = useState<Message | null>(null)

  // un'immagine torna subito al suo posto in assets/: la finestra resta aperta per le altre
  const restoreImages = async (files: string[]): Promise<void> => {
    setError(null)
    try {
      const r = await window.api.restoreImages(files)
      publishAssetsUpdate(r.update)
      setItems((list) => list && list.filter((x) => !files.includes(x.file)))
    } catch (e) {
      setError(messageFromError(e))
    }
  }
  const images = (items ?? []).filter((x) => x.kind === 'image')

  useEffect(() => {
    void window.api.listDeleted().then(setItems, () => setItems([]))
  }, [])

  const when = (iso: string): string =>
    new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })
  const templateOf = (item: DeletedItem): string =>
    chosen[item.file] ?? bestTemplate(item.columns ?? [], templates)

  return (
    <Dialog title={t('trash.title')} onClose={onClose}>
      <div className="dialog-form trash-dialog">
        <p className="muted small">{t('trash.hint')}</p>
        {items === null ? (
          <p className="muted">{t('trash.loading')}</p>
        ) : items.length === 0 ? (
          <p>{t('trash.empty')}</p>
        ) : (
          <ul className="trash-list">
            {items.map((item) => (
              <li key={item.file}>
                <span className="trash-kind">{t(`trash.kind.${item.kind}`)}</span>
                <span className="trash-name" title={item.file}>
                  <strong>{item.name}</strong>
                  <span className="muted small">{when(item.date)}</span>
                </span>
                {item.kind === 'sheet' && (
                  <select
                    title={t('trash.template')}
                    value={templateOf(item)}
                    onChange={(e) => setChosen((c) => ({ ...c, [item.file]: e.target.value }))}
                  >
                    {templates.map((x) => (
                      <option key={x.name} value={x.name}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  disabled={item.kind === 'sheet' && !templates.length}
                  onClick={() =>
                    item.kind === 'image'
                      ? void restoreImages([item.file])
                      : onRestore(item, templateOf(item))
                  }
                >
                  {t('trash.restore')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          {images.length > 1 && (
            <button onClick={() => void restoreImages(images.map((x) => x.file))}>
              {t('trash.restoreImages', { n: images.length })}
            </button>
          )}
          <button className="primary" onClick={onClose}>
            {t('dialog.close')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
