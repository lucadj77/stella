/**
 * Un «?» piccolo con la spiegazione al passaggio del mouse (e al fuoco da tastiera), al posto di
 * un paragrafo sempre visibile
 */
export default function HelpTip({ text }: { text: string }): React.JSX.Element {
  return (
    <span className="help-tip" tabIndex={0} role="note" title={text} aria-label={text}>
      ?
    </span>
  )
}
