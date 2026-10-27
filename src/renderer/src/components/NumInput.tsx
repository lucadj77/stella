import { useState } from 'react'

// Campo per un numero che si scrive liberamente: finché ha il fuoco mostra ciò che si digita
// (anche vuoto, "1," o un valore fuori dai limiti), e passa a onChange solo i numeri completi.
// Uscendo dal campo torna a mostrare il valore vero. Prima era un input type="number"
// controllato: cancellando tutto o scrivendo una cifra in più il valore veniva corretto subito e
// le cifre non si lasciavano cambiare.

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | string
  /** Riceve il testo già con il punto come separatore decimale */
  onChange(e: { target: { value: string } }): void
  /** Il campo vuoto è un valore (per esempio "nessun limite") */
  allowEmpty?: boolean
}

const parse = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  const n = Number(t)
  return t !== '' && Number.isFinite(n) ? n : null
}

const round = (n: number): number => Math.round(n * 10000) / 10000

export default function NumInput({
  value,
  onChange,
  allowEmpty,
  onFocus,
  onBlur,
  onKeyDown,
  min,
  max,
  step,
  ...rest
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const send = (text: string): void => {
    if (text.trim() === '') {
      if (allowEmpty) onChange({ target: { value: '' } })
      return
    }
    const n = parse(text)
    if (n !== null) onChange({ target: { value: String(n) } })
  }
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value))
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setDraft(null)
        onBlur?.(e)
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        send(e.target.value)
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (e.defaultPrevented) return
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape' && draft !== null) {
          // annulla ciò che si è scritto e lascia il campo
          e.stopPropagation()
          setDraft(null)
          e.currentTarget.blur()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const s = (Number(step) || 1) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
          let n = round((parse(draft ?? String(value)) ?? (Number(value) || 0)) + s)
          if (min !== undefined && min !== '') n = Math.max(Number(min), n)
          if (max !== undefined && max !== '') n = Math.min(Number(max), n)
          setDraft(String(n))
          send(String(n))
        }
      }}
    />
  )
}
