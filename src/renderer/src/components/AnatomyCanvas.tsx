import { useRef, useState } from 'react'
import type { Anatomy } from '../../../shared/model/document'
import type { ProjectMeta } from '../../../shared/model/system'
import type { Template } from '../../../shared/model/template'
import type { LoadedSet } from '../../../shared/project'
import { useI18n } from '../i18n/context'
import AnatomyDiagram from '../render/AnatomyDiagram'

// L'anatomia nella sua finestra, da modificare sul disegno: i punti si trascinano e un doppio
// clic su un'etichetta apre un campo sopra di essa per cambiarne il testo.

export default function AnatomyCanvas({
  anatomy,
  sets,
  templates,
  project,
  unit,
  maxWidth,
  font,
  onMovePoint,
  onLabel
}: {
  anatomy: Anatomy
  sets: LoadedSet[]
  templates: Template[]
  project?: string | ProjectMeta
  unit: number
  maxWidth: number
  font: number
  onMovePoint(index: number, at: { x: number; y: number } | undefined): void
  /** Nuovo testo dell'etichetta `index` di anatomy.callouts */
  onLabel(index: number, text: string): void
}): React.JSX.Element {
  const { t } = useI18n()
  const box = useRef<HTMLDivElement>(null)
  const [edit, setEdit] = useState<{
    index: number
    text: string
    x: number
    y: number
    w: number
  } | null>(null)
  const commit = (): void => {
    if (edit) onLabel(edit.index, edit.text)
    setEdit(null)
  }
  return (
    <div ref={box} className="anatomy-canvas">
      <AnatomyDiagram
        anatomy={anatomy}
        sets={sets}
        templates={templates}
        project={project}
        unit={unit}
        maxWidth={maxWidth}
        font={font}
        dragHint={t('documents.anatomy.dragPoint')}
        onMovePoint={onMovePoint}
        editHint={t('documents.anatomy.editLabel')}
        onEditLabel={(index, el) => {
          const c = anatomy.callouts[index]
          const area = box.current?.getBoundingClientRect()
          if (!c || !area) return
          const r = el.getBoundingClientRect()
          const w = Math.max(r.width, 200)
          setEdit({
            index,
            text: c.label,
            x: Math.max(0, Math.min(r.left - area.left, area.width - w)),
            y: r.top - area.top,
            w
          })
        }}
      />
      {edit && (
        <textarea
          className="anatomy-label-edit"
          autoFocus
          rows={2}
          style={{ left: edit.x, top: edit.y, width: edit.w }}
          value={edit.text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setEdit({ ...edit, text: e.target.value })}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              // Esc chiude il campo, non la finestra
              e.stopPropagation()
              setEdit(null)
            }
          }}
        />
      )}
    </div>
  )
}
