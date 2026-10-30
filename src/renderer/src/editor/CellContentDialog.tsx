import { useContext, useState } from 'react'
import type { GroupLayer } from '../../../shared/model/template'
import type { MessageKey } from '../i18n/en'
import { useI18n } from '../i18n/context'
import { VariablesContext } from '../render/assets'
import { Dialog } from './dialogs'

// «Inserisci un contenuto»: cosa mettere in tutte le caselle di una griglia, o nelle caselle di
// una regola. Un valore (un testo con l'assistente delle formule), una forma o un'immagine, o un
// gruppo che c'è già.

/** La scelta fatta nella finestra */
export type CellContentChoice =
  | { kind: 'value' }
  | { kind: 'shape'; shape: string }
  | { kind: 'image'; src: string }
  | { kind: 'group'; id: string }

const SHAPES = ['rect', 'ellipse', 'polygon', 'star'] as const

export default function CellContentDialog({
  title,
  groups,
  onPick,
  onClose
}: {
  title: string
  /** Gruppi della lista che possono entrare nella griglia */
  groups: GroupLayer[]
  onPick(choice: CellContentChoice): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  const images = Object.entries(variables ?? {})
    .filter(([, v]) => v.type === 'image')
    .map(([name]) => name)
  const [step, setStep] = useState<'start' | 'shape' | 'group'>('start')
  const pick = (c: CellContentChoice): void => {
    onPick(c)
    onClose()
  }
  return (
    <Dialog title={title} onClose={onClose}>
      {step === 'start' && (
        <div className="cell-content-choices">
          <button type="button" onClick={() => pick({ kind: 'value' })}>
            <strong>{t('cellContent.value')}</strong>
            <span>{t('cellContent.valueHint')}</span>
          </button>
          <button type="button" onClick={() => setStep('shape')}>
            <strong>{t('cellContent.shape')}</strong>
            <span>{t('cellContent.shapeHint')}</span>
          </button>
          <button type="button" disabled={!groups.length} onClick={() => setStep('group')}>
            <strong>{t('cellContent.group')}</strong>
            <span>{groups.length ? t('cellContent.groupHint') : t('cellContent.noGroups')}</span>
          </button>
        </div>
      )}
      {step === 'shape' && (
        <>
          <h3>{t('cellContent.shapes')}</h3>
          <div className="cell-content-list">
            {SHAPES.map((shape) => (
              <button key={shape} type="button" onClick={() => pick({ kind: 'shape', shape })}>
                {t(`shape.${shape}` as MessageKey)}
              </button>
            ))}
          </div>
          <h3>{t('cellContent.images')}</h3>
          <div className="cell-content-list">
            <button type="button" onClick={() => pick({ kind: 'image', src: '' })}>
              {t('cellContent.imageFile')}
            </button>
            {images.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => pick({ kind: 'image', src: `{${name}}` })}
              >
                {`{${name}}`}
              </button>
            ))}
          </div>
          {!images.length && <p className="muted small">{t('cellContent.noImageVariables')}</p>}
        </>
      )}
      {step === 'group' && (
        <>
          <p className="muted small">{t('cellContent.groupMove')}</p>
          <div className="cell-content-list">
            {groups.map((g) => (
              <button key={g.id} type="button" onClick={() => pick({ kind: 'group', id: g.id })}>
                {g.name}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="dialog-buttons">
        {step !== 'start' && (
          <button type="button" onClick={() => setStep('start')}>
            {t('cellContent.back')}
          </button>
        )}
        <button type="button" onClick={onClose}>
          {t('dialog.cancel')}
        </button>
      </div>
    </Dialog>
  )
}
