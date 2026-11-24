export default function Segmented<T extends string>({
  value,
  options,
  disabled,
  onChange
}: {
  value: T
  disabled?: boolean
  /** Valore, etichetta (anche un'icona: allora il suggerimento le dà il nome) e suggerimento */
  options: [T, React.ReactNode, string?][]
  onChange(v: T): void
}): React.JSX.Element {
  return (
    <div className="segmented" role="group">
      {options.map(([v, label, hint]) => (
        <button
          key={v}
          title={hint}
          aria-label={typeof label === 'string' ? undefined : hint}
          className={v === value ? 'active' : ''}
          aria-pressed={v === value}
          disabled={disabled}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
