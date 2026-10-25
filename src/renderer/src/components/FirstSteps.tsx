import { useState } from 'react'
import type { LoadedProject } from '../../../shared/project'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'

// Primi passi di un progetto nuovo: template, set, primo componente, esportazione. La striscia
// compare solo nei progetti aperti senza componenti, si spunta da sola e si può nascondere.

const HIDDEN_KEY = 'firstSteps.hidden'

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function write(key: string): void {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // senza memoria locale la striscia torna alla prossima apertura
  }
}

const hasComponents = (p: LoadedProject): boolean =>
  p.sets.some((s) => (s.data?.rows.length ?? 0) > 0)

export default function FirstSteps({
  project,
  exported,
  onNewTemplate,
  onNewSet,
  onOpenSet,
  onExport
}: {
  project: LoadedProject
  /** L'esportazione è già stata aperta da quando c'è un componente */
  exported: boolean
  onNewTemplate(): void
  onNewSet(): void
  /** Apre il primo set, dove si aggiunge il primo componente */
  onOpenSet(): void
  onExport(): void
}): React.JSX.Element | null {
  const { t } = useI18n()
  // un progetto che ha già dei componenti quando si apre non ne ha bisogno
  const [wanted] = useState(() => !hasComponents(project) && !read(HIDDEN_KEY))
  const [hidden, setHidden] = useState(false)
  if (!wanted || hidden) return null
  const steps: { done: boolean; label: MessageKey; action: MessageKey; run(): void }[] = [
    {
      done: project.templates.length > 0,
      label: 'firstSteps.template',
      action: 'sidebar.newTemplate',
      run: onNewTemplate
    },
    {
      done: project.sets.length > 0,
      label: 'firstSteps.set',
      action: 'sidebar.newSet',
      run: onNewSet
    },
    {
      done: hasComponents(project),
      label: 'firstSteps.component',
      action: 'firstSteps.componentAction',
      run: onOpenSet
    },
    { done: exported, label: 'firstSteps.export', action: 'app.export', run: onExport }
  ]
  const next = steps.findIndex((s) => !s.done)
  if (next < 0) return null
  return (
    <div className="first-steps" role="region" aria-label={t('firstSteps.title')}>
      <strong className="first-steps-title">{t('firstSteps.title')}</strong>
      <ol className="first-steps-list">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className={s.done ? 'done' : i === next ? 'current' : undefined}
            aria-current={i === next ? 'step' : undefined}
          >
            <span className="first-steps-mark">{s.done ? '✓' : i + 1}</span>
            {t(s.label)}
          </li>
        ))}
      </ol>
      <button className="primary" onClick={steps[next].run}>
        {t(steps[next].action)}
      </button>
      <span className="spacer" />
      <button
        className="icon-btn"
        title={t('firstSteps.hide')}
        aria-label={t('firstSteps.hide')}
        onClick={() => {
          write(HIDDEN_KEY)
          setHidden(true)
        }}
      >
        ×
      </button>
    </div>
  )
}
