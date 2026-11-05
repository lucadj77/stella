import { useMemo, useState } from 'react'
import type { LoadedProject } from '../../../shared/project'
import { isRemoteImage, resolveAsset } from '../../../shared/model/assets'
import { bindRow } from '../../../shared/model/bind'
import { creditsText } from '../../../shared/model/credits'
import { markupFonts } from '../../../shared/model/fonts'
import { markupRefs } from '../../../shared/model/markup'
import { walkLayers } from '../../../shared/model/normalize'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'

// Crediti delle icone e dei font importati, da mettere nel regolamento o sulla scatola.
// Vedi docs/specifica.md, sezione 10.3.

/** File di assets/ e famiglie di font usati dalle carte di tutti i set */
function usedByCards(project: LoadedProject): { assets: Set<string>; fonts: Set<string> } {
  const assets = new Set<string>()
  const fonts = new Set<string>()
  const styles = project.file.styles ?? {}
  const add = (name: string): void => {
    const r = resolveAsset(name, project.assets)
    if (r.ok) assets.add(r.path)
  }
  for (const set of project.sets) {
    const tpl = project.templates.find((x) => x.name === set.template)
    if (!tpl || !set.data) continue
    for (const row of set.data.rows) {
      const bound = bindRow(set.data.headers, row, tpl, project.templates, {
        assets: project.assets,
        variables: project.file.variables
      })
      for (const l of walkLayers([...bound.template.front, ...bound.template.back])) {
        if (!l.visible) continue
        if (l.type === 'image') add(l.src)
        if (l.type === 'text') {
          markupRefs(l.text).forEach(add)
          for (const f of [l.font, ...markupFonts(l.text, styles, project.file.variables)])
            fonts.add(f.toLowerCase())
        }
      }
    }
  }
  return { assets, fonts }
}

export default function CreditsDialog({
  project,
  onClose
}: {
  project: LoadedProject
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [onlyUsed, setOnlyUsed] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const [copied, setCopied] = useState(false)

  const used = useMemo(() => usedByCards(project), [project])
  const text = useMemo(
    () =>
      creditsText(
        project.sources,
        {
          icons: (source, license) => t('credits.icons', { source, license }),
          font: (family, license) => t('credits.font', { family, license }),
          images: () => t('credits.images'),
          licenseName: (spdx) => {
            const k = `license.${spdx}` as MessageKey
            const name = t(k)
            return name === k ? spdx : name
          }
        },
        onlyUsed ? used : undefined,
        [...used.assets].filter(isRemoteImage)
      ),
    [project.sources, onlyUsed, used, t]
  )
  const empty = !text.trim()

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  const save = async (): Promise<void> => {
    setError(null)
    try {
      setSaved(await window.api.saveCredits(text))
    } catch (e) {
      setError(messageFromError(e))
    }
  }

  return (
    <Dialog title={t('credits.title')} onClose={onClose}>
      <div className="credits-dialog">
        <p className="muted small">{t('credits.intro')}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={onlyUsed}
            onChange={(e) => setOnlyUsed(e.target.checked)}
          />
          {t('credits.onlyUsed')}
        </label>
        {empty ? (
          <p className="muted">{t('credits.empty')}</p>
        ) : (
          <textarea readOnly value={text} rows={12} />
        )}
        {saved && <p className="muted small">{t('credits.saved', { file: saved })}</p>}
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('export.close')}</button>
          <button disabled={empty} onClick={save}>
            {t('credits.save')}
          </button>
          <button className="primary" disabled={empty} onClick={copy}>
            {copied ? t('credits.copied') : t('credits.copy')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
