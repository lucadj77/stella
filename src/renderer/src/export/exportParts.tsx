import { useRef, useState } from 'react'
import { confirmKey } from '../components/confirm'
import Menu, { MenuPanel } from '../components/Menu'
import type { NamedProfile } from '../../../shared/export'
import type { ComponentKind } from '../../../shared/model/template'
import { useI18n } from '../i18n/context'
import { ChoicePicture, KindIcon, type ChoiceIcon } from './exportIcons'

// I pezzi della finestra Esporta: scelte a pulsanti (con o senza disegno), sezioni chiuse con il
// riassunto dei valori nel titolo, il menu dei tipi di oggetto con le icone e il menu dei profili.

export interface ChoiceOption<T extends string | number> {
  value: T
  label: string
  /** Riga piccola sotto l'etichetta */
  note?: string
  icon?: ChoiceIcon
  title?: string
}

/** Una scelta tra pochi valori, a pulsanti: con i disegni sono grandi, senza sono chip */
export function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
  reason
}: {
  label?: string
  value: T
  options: ChoiceOption<T>[]
  onChange(v: T): void
  disabled?: boolean
  /** Perché la scelta è spenta */
  reason?: string
}): React.JSX.Element {
  const pictures = options.some((o) => o.icon)
  return (
    <div className={'export-choice-row' + (disabled ? ' disabled' : '')}>
      {label && <span className="export-choice-label">{label}</span>}
      <div
        className={pictures ? 'export-choices pictures' : 'export-choices chips'}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={'export-choice' + (o.value === value ? ' active' : '')}
            disabled={disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
          >
            {o.icon && <ChoicePicture name={o.icon} />}
            <span className="export-choice-text">{o.label}</span>
            {o.note && <span className="export-choice-note">{o.note}</span>}
          </button>
        ))}
      </div>
      {disabled && reason && <span className="export-reason">{reason}</span>}
    </div>
  )
}

/** Una riga di opzioni con l'etichetta a sinistra, spenta con il motivo se non si applica */
export function Row({
  label,
  children,
  hint,
  disabled,
  reason
}: {
  label: string
  children: React.ReactNode
  hint?: string
  disabled?: boolean
  reason?: string
}): React.JSX.Element {
  return (
    <div className={'export-row' + (disabled ? ' disabled' : '')}>
      <span className="export-row-label">{label}</span>
      <div className="export-row-control">
        {/* una riga spenta spegne tutti i suoi campi */}
        <fieldset disabled={disabled}>{children}</fieldset>
        {disabled && reason && <span className="export-reason">{reason}</span>}
      </div>
      {hint && !disabled && <p className="export-hint">{hint}</p>}
    </div>
  )
}

const OPEN_KEY = 'exportSections'

function openSections(): string[] {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]')
  } catch {
    return []
  }
}

/**
 * Una sezione chiusa: il titolo dice già i valori che contiene, così si controllano senza
 * aprirla. Le sezioni aperte restano aperte la volta dopo.
 */
export function Section({
  id,
  title,
  summary,
  children
}: {
  id: string
  title: string
  summary: string
  children: React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(() => openSections().includes(id))
  return (
    <details
      className="export-section"
      open={open}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open
        setOpen(now)
        try {
          const list = openSections().filter((x) => x !== id)
          localStorage.setItem(OPEN_KEY, JSON.stringify(now ? [...list, id] : list))
        } catch {
          // senza localStorage le sezioni si aprono chiuse
        }
      }}
    >
      <summary>
        <span className="export-section-title">{title}</span>
        <span className="export-section-summary">{summary}</span>
      </summary>
      <div className="export-section-body">{children}</div>
    </details>
  )
}

/** Il tipo di oggetto di Tabletop Simulator, con l'icona del tipo nel pulsante e nel menu */
export function KindPicker({
  value,
  options,
  onChange
}: {
  value: ComponentKind
  options: [ComponentKind, string][]
  onChange(k: ComponentKind): void
}): React.JSX.Element {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const label = options.find(([k]) => k === value)?.[1] ?? value
  return (
    <>
      <button
        ref={button}
        type="button"
        className="kind-picker"
        aria-haspopup="menu"
        aria-expanded={!!at}
        onClick={() => {
          if (at) return setAt(null)
          const r = button.current!.getBoundingClientRect()
          setAt({ x: r.left, y: r.bottom + 4 })
        }}
      >
        <KindIcon kind={value} size={18} />
        <span>{label}</span>
        <span className="muted">▾</span>
      </button>
      {at && (
        <MenuPanel x={at.x} y={at.y} keep={button} onClose={() => setAt(null)}>
          {options.map(([k, text]) => (
            <button
              key={k}
              role="menuitemradio"
              aria-checked={k === value}
              className={'menu-item kind-menu-item' + (k === value ? ' active' : '')}
              onClick={() => {
                setAt(null)
                onChange(k)
              }}
            >
              <KindIcon kind={k} size={18} />
              <span>{text}</span>
            </button>
          ))}
        </MenuPanel>
      )}
    </>
  )
}

/**
 * Il menu dei profili, in basso nella finestra: sceglie un profilo del progetto, salva le
 * opzioni attuali in quello scelto o in uno nuovo, lo elimina. Un principiante non lo vede finché
 * non lo cerca.
 */
export function ProfileMenu({
  profiles,
  active,
  current,
  naming,
  onNaming,
  onPick,
  onChange
}: {
  profiles: NamedProfile[]
  /** Profilo scelto, '' per nessuno */
  active: string
  /** Tipo e opzioni mostrati ora nella finestra */
  current: () => NamedProfile
  /** Il nome del profilo nuovo che si sta scrivendo, null se non si scrive */
  naming: string | null
  onNaming(name: string | null): void
  onPick(p: NamedProfile | null): void
  /** Nuovo elenco dei profili e profilo da considerare scelto */
  onChange(profiles: NamedProfile[], active: string): void
}): React.JSX.Element {
  const { t } = useI18n()
  const own = profiles.find((p) => p.name === active)
  const save = (name: string): void => {
    const p = { ...current(), name }
    const at = profiles.findIndex((x) => x.name === name)
    onChange(at < 0 ? [...profiles, p] : profiles.map((x, i) => (i === at ? p : x)), name)
  }
  const trimmed = naming?.trim() ?? ''

  if (naming !== null)
    return (
      <form
        className="profile-name"
        onSubmit={(e) => {
          e.preventDefault()
          if (!trimmed) return
          save(trimmed)
          onNaming(null)
        }}
      >
        <input
          autoFocus
          value={naming}
          placeholder={t('export.profileName')}
          onChange={(e) => onNaming(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              onNaming(null)
            }
          }}
        />
        <button type="submit" className="primary" disabled={!trimmed}>
          {profiles.some((p) => p.name === trimmed)
            ? t('export.profileReplace')
            : t('export.profileCreate')}
        </button>
        <button type="button" onClick={() => onNaming(null)}>
          {t('dialog.cancel')}
        </button>
      </form>
    )
  return (
    <Menu
      className="profile-menu"
      title={t('tip.exportProfile')}
      label={`${t('export.profileLabel', { name: own ? own.name : t('export.profileNoneShort') })} ▾`}
      items={[
        { label: t('export.profileNoneLong'), onClick: () => onPick(null) },
        ...profiles.map((p) => ({
          label: `${p.name === active ? '● ' : ''}${p.name} · ${t(`export.${p.kind}`)}`,
          onClick: () => onPick(p)
        })),
        'sep' as const,
        ...(own
          ? [
              {
                label: t('export.profileSaveIn', { name: own.name }),
                title: t('tip.profileSave'),
                onClick: () => save(own.name)
              }
            ]
          : []),
        {
          label: t('export.profileSaveNew'),
          title: t('tip.profileSaveAs'),
          onClick: () => onNaming('')
        },
        ...(own
          ? [
              {
                label: t('export.profileDeleteNamed', { name: own.name }),
                danger: true,
                onClick: async () => {
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
                }
              }
            ]
          : [])
      ]}
    />
  )
}
