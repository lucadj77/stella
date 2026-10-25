import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n'
import { ConfirmHost } from './components/ConfirmHost'
import { loadTheme, setTheme } from './theme/theme'
import ExportPage from './export/ExportPage'
import DocumentExportPage from './export/DocumentExportPage'

const root = createRoot(document.getElementById('root')!)

// un file lasciato cadere fuori dai punti che lo accettano non deve aprire il file nella finestra
// (si perderebbero le modifiche): il trascinamento si ferma qui
const hasFiles = (e: DragEvent): boolean => !!e.dataTransfer?.types.includes('Files')
window.addEventListener('dragover', (e) => hasFiles(e) && e.preventDefault())
window.addEventListener('drop', (e) => hasFiles(e) && e.preventDefault())

if (location.hash === '#export') {
  // finestra nascosta delle esportazioni: senza StrictMode, che registrerebbe due volte gli ascolti
  root.render(
    <I18nProvider>
      <ExportPage />
    </I18nProvider>
  )
} else if (location.hash === '#document') {
  // finestra nascosta che esporta un documento dal comando stella
  root.render(
    <I18nProvider>
      <DocumentExportPage />
    </I18nProvider>
  )
} else {
  // prima del primo disegno, così la finestra non si apre con il tema sbagliato
  setTheme(loadTheme())
  root.render(
    <StrictMode>
      <I18nProvider>
        <App />
        <ConfirmHost />
      </I18nProvider>
    </StrictMode>
  )
}
