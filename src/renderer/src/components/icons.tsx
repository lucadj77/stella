/** Icona immagine: cornice con montagna e sole, nel colore del testo */
export function ImageIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: '-0.125em' }}
    >
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <circle cx="11" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <path d="M1.5 12 L6 7.5 L9.5 11 L11 9.5 L14.5 13" />
    </svg>
  )
}

/** Livello griglia: nove caselle */
export function GridIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={{ verticalAlign: '-0.125em' }}
    >
      {[1.5, 6.25, 11].flatMap((y) =>
        [1.5, 6.25, 11].map((x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="3.5" height="3.5" rx="0.6" />
        ))
      )}
    </svg>
  )
}

/** Fonte "colonna del foglio": una piccola tabella */
export function ColumnIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <rect x="2" y="2.5" width="12" height="11" rx="1" />
      <path d="M2 6.5h12M6.5 6.5v7" />
    </svg>
  )
}

/** Fonte "valore fisso": una puntina */
export function FixedIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="6" r="3.5" />
      <path d="M8 9.5V14.5" />
    </svg>
  )
}

/** Tratto comune delle icone della barra laterale */
function Outline({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Set: un mazzo di carte */
export function SetsIcon(): React.JSX.Element {
  return (
    <Outline>
      <rect x="5" y="1.5" width="8.5" height="11" rx="1.2" />
      <path d="M3 4v8.5a1.5 1.5 0 0 0 1.5 1.5H10" />
    </Outline>
  )
}

/** Template: una carta con titolo, immagine e testo */
export function TemplateIcon(): React.JSX.Element {
  return (
    <Outline>
      <rect x="3" y="1.5" width="10" height="13" rx="1.2" />
      <path d="M5.5 4.5h5M5.5 7h5v2.5h-5zM5.5 12h3" />
    </Outline>
  )
}

/** Stili di testo: una T con le righe del paragrafo */
export function StylesIcon(): React.JSX.Element {
  return (
    <Outline>
      <path d="M2 3h7M5.5 3v9M11 7h3M11 10h3M8.5 13h5.5" />
    </Outline>
  )
}

/** Variabili: le graffe di {nome} */
export function VariablesIcon(): React.JSX.Element {
  return (
    <Outline>
      <path d="M6 2.5c-1.5 0-2 .6-2 1.8v1.9c0 1-.5 1.6-1.5 1.8 1 .2 1.5.8 1.5 1.8v1.9c0 1.2.5 1.8 2 1.8M10 2.5c1.5 0 2 .6 2 1.8v1.9c0 1 .5 1.6 1.5 1.8-1 .2-1.5.8-1.5 1.8v1.9c0 1.2-.5 1.8-2 1.8" />
    </Outline>
  )
}

/** Note: un foglio con le righe e l'angolo piegato */
export function NotesIcon(): React.JSX.Element {
  return (
    <Outline>
      <path d="M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3M5.5 7.5h5M5.5 10h5M5.5 12.5h3" />
    </Outline>
  )
}

/** Documenti: un libretto aperto, come un regolamento */
export function DocumentsIcon(): React.JSX.Element {
  return (
    <Outline>
      <path d="M8 4c-1.5-1.2-3.5-1.5-6-1.3v10c2.5-.2 4.5.1 6 1.3 1.5-1.2 3.5-1.5 6-1.3v-10c-2.5-.2-4.5.1-6 1.3zM8 4v10" />
    </Outline>
  )
}

/** Riduce il pannello a icone, o lo riapre: un pannello con la colonna laterale */
export function PanelIcon(): React.JSX.Element {
  return (
    <Outline>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M6 2.5v11" />
    </Outline>
  )
}

/** Freccia di una sezione: in basso se aperta, a destra se chiusa */
export function ChevronIcon({ open }: { open: boolean }): React.JSX.Element {
  return (
    <svg
      width="0.8em"
      height="0.8em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: open ? undefined : 'rotate(-90deg)', transition: 'transform 0.15s' }}
    >
      <path d="M3.5 6l4.5 4.5L12.5 6" />
    </svg>
  )
}

/** Elimina: un cestino */
export function TrashIcon(): React.JSX.Element {
  return (
    <Outline>
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9.5h6.6L12 4M6.8 6.5v4.5M9.2 6.5v4.5" />
    </Outline>
  )
}

/** Matita: rinomina */
export function PencilIcon(): React.JSX.Element {
  return (
    <Outline>
      <path d="M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3" />
    </Outline>
  )
}

/** Occhio: mostra o nasconde un campo */
export function EyeIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
    >
      <path d="M1.5 8c1.6-3 3.8-4.5 6.5-4.5s4.9 1.5 6.5 4.5c-1.6 3-3.8 4.5-6.5 4.5S3.1 11 1.5 8z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  )
}

/** Cursori: le proprietà di un livello */
export function SlidersIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M2 4h12M2 8h12M2 12h12" />
      <circle cx="5" cy="4" r="1.5" fill="var(--panel)" />
      <circle cx="10.5" cy="8" r="1.5" fill="var(--panel)" />
      <circle cx="7" cy="12" r="1.5" fill="var(--panel)" />
    </svg>
  )
}

/** Puntina: proprietà fissata sotto il suo campo */
export function PinIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2h4M7 2v4L4.5 9h7L9 6V2M8 9v5" />
    </svg>
  )
}

/** Occhio barrato: livello nascosto su questa carta */
export function EyeOffIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1.5 8c1.6-3 3.8-4.5 6.5-4.5s4.9 1.5 6.5 4.5c-1.6 3-3.8 4.5-6.5 4.5S3.1 11 1.5 8z" />
      <path d="M2.5 13.5l11-11" />
    </svg>
  )
}

/** Valore ereditato dal template base: due anelli di catena */
export function LinkIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ verticalAlign: '-0.125em' }}
    >
      <path d="M6.5 9.5 L9.5 6.5" />
      <path d="M7 4.5 L8.5 3a2.5 2.5 0 0 1 3.5 3.5 L10.5 8" />
      <path d="M9 11.5 L7.5 13a2.5 2.5 0 0 1 -3.5 -3.5 L5.5 8" />
    </svg>
  )
}

/** Valore cambiato rispetto al base: freccia che torna indietro */
export function RevertIcon(): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: '-0.125em' }}
    >
      <path d="M3.5 6.5 A5 5 0 1 1 3.8 10" />
      <path d="M3 3 L3.5 6.5 L7 6" />
    </svg>
  )
}
