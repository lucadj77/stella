import { useState } from 'react'
import { confirmKey } from '../components/confirm'
import type { ExportKind, NamedProfile } from '../../../shared/export'
import { useI18n } from '../i18n/context'

/**
 * Profili di esportazione con nome: si sceglie un profilo (il tipo e le opzioni passano nella
 * finestra), si salvano le opzioni attuali nel profilo scelto o con un nome nuovo, si elimina.
 * I preset dei servizi di stampa stanno in un gruppo a parte e non si modificano.
 */
export default function ProfileBar({
  profiles,
  presets,
  active,
  current,
  onPick,
  onChange
}: {
  profiles: NamedProfile[]
  presets: NamedProfile[]
  /** Profilo scelto, '' per nessuno */
  active: string
  /** Tipo e opzioni mostrati ora nella finestra */
  current: () => NamedProfile
  onPick(p: NamedProfile | null): void
  /** Nuovo elenco dei profili e profilo da considerare scelto */
  onChange(profiles: NamedProfile[], active: string): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [naming, setNaming] = useState<string | null>(null)
  const own = profiles.find((p) => p.name === active)
  const kindLabel = (k: ExportKind): string => t(`export.${k}`)

  const save = (name: string): void => {
    const p = { ...current(), name }
    const at = profiles.findIndex((x) => x.name === name)
    onChange(at < 0 ? [...profiles, p] : profiles.map((x, i) => (i === at ? p : x)), name)
  }
  const trimmed = naming?.trim() ?? ''

  return (
    <div className="profile-bar">
      <span className="field-label">{t('export.profile')}</span>
      {naming === null ? (
        <>
          <select
            value={active}
            title={t('tip.exportProfile')}
            onChange={(e) => {
              const name = e.target.value
              onPick(
                profiles.find((p) => p.name === name) ??
                  presets.find((p) => p.name === name) ??
                  null
              )
            }}
          >
            <option value="">{t('export.profileNone')}</option>
            {profiles.length > 0 && (
              <optgroup label={t('export.profilesOwn')}>
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} · {kindLabel(p.kind)}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={t('export.profilesPresets')}>
              {presets.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} · {kindLabel(p.kind)}
                </option>
              ))}
            </optgroup>
          </select>
          <button
            type="button"
            disabled={!own}
            title={t('tip.profileSave')}
            onClick={() => own && save(own.name)}
          >
            {t('export.profileSave')}
          </button>
          <button type="button" title={t('tip.profileSaveAs')} onClick={() => setNaming('')}>
            {t('export.profileSaveAs')}
          </button>
          {own && (
            <button
              type="button"
              className="icon-btn"
              title={t('export.profileDelete')}
              onClick={async () => {
                if (
                  await confirmKey(
                    t,
                    'export.profileDeleteConfirm',
                    { name: own.name },
                    { danger: true }
                  )
                )
                  onChange(
                    profiles.filter((p) => p !== own),
                    ''
                  )
              }}
            >
              ×
            </button>
          )}
        </>
      ) : (
        <form
          className="profile-name"
          onSubmit={(e) => {
            e.preventDefault()
            if (!trimmed || presets.some((p) => p.name === trimmed)) return
            save(trimmed)
            setNaming(null)
          }}
        >
          <input
            autoFocus
            value={naming}
            placeholder={t('export.profileName')}
            onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setNaming(null)
              }
            }}
          />
          <button
            type="submit"
            className="primary"
            disabled={!trimmed || presets.some((p) => p.name === trimmed)}
          >
            {profiles.some((p) => p.name === trimmed)
              ? t('export.profileReplace')
              : t('export.profileCreate')}
          </button>
          <button type="button" onClick={() => setNaming(null)}>
            {t('dialog.cancel')}
          </button>
        </form>
      )}
    </div>
  )
}
