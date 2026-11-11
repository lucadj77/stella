import { Component, type ReactNode } from 'react'
import { useI18n } from '../i18n/context'

// Un errore mentre si disegna una schermata (set, template, documento) non deve svuotare tutta la
// finestra: la barra in alto e la barra laterale restano, quindi si può ancora salvare. La
// schermata mostra l'errore, con Riprova e i dettagli da copiare per segnalarlo.

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }): void {
    console.error(error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return <ErrorScreen error={error} onRetry={() => this.setState({ error: null })} />
  }
}

function ErrorScreen({ error, onRetry }: { error: Error; onRetry(): void }): React.JSX.Element {
  const { t } = useI18n()
  const details = `Stella ${__APP_VERSION__}\n${error.stack ?? error.message}`
  return (
    <section className="content error-screen" role="alert">
      <h2>{t('crash.title')}</h2>
      <p>{t('crash.text')}</p>
      <pre className="error-details">{error.message}</pre>
      <div className="dialog-buttons">
        <button type="button" onClick={() => void navigator.clipboard?.writeText(details)}>
          {t('crash.copy')}
        </button>
        <button type="button" className="primary" onClick={onRetry}>
          {t('crash.retry')}
        </button>
      </div>
    </section>
  )
}
