import { useContext, useMemo, useState } from 'react'
import { resolveAsset } from '../../../shared/model/assets'
import { cardRefSource } from '../../../shared/model/document'
import { projectFolderName } from '../../../shared/model/projectName'
import { coverCard, thumbnailTemplate } from '../../../shared/model/thumbnail'
import type { LoadedProject, ProjectCover } from '../../../shared/project'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { AssetsContext, assetUrl } from '../render/assets'
import CardSvg from '../render/CardSvg'
import AssetPicker from './AssetPicker'
import InsertCardDialog from './InsertCardDialog'

/** Ciò che la finestra cambia in stella.json */
export interface ProjectInfo {
  name: string
  author: string
  version: string
  cover: ProjectCover | null
}

/** Lato maggiore dell'anteprima della copertina, in pixel */
const PREVIEW = 150

/** Nome della variabile accanto al campo: si vede subito come richiamarlo */
function VariableTag({ name }: { name: string }): React.JSX.Element {
  return <code className="project-info-var">{`{${name}}`}</code>
}

/**
 * Informazioni progetto (menu Progetto): nome, autore e versione, che i testi richiamano con
 * {project.name}, {project.author} e {project.version}; la cartella, da aprire o rinominare; la
 * copertina della schermata di ingresso.
 */
export default function ProjectInfoDialog({
  project,
  onSave,
  onRenameFolder,
  onLanguages,
  onClose
}: {
  project: LoadedProject
  onSave(info: ProjectInfo): void
  onRenameFolder(name: string): void
  /** Apre Lingue…, dove stanno i nomi tradotti */
  onLanguages(): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const file = project.file
  const [name, setName] = useState(file.name)
  const [author, setAuthor] = useState(file.author ?? '')
  const [version, setVersion] = useState(file.version ?? '')
  const [cover, setCover] = useState<ProjectCover | null>(file.cover ?? null)
  const [picking, setPicking] = useState<'card' | 'image' | null>(null)
  const assets = useContext(AssetsContext)
  const folderName = project.folder.split(/[\\/]/).filter(Boolean).pop() ?? ''
  const [folder, setFolder] = useState(folderName)

  // il componente scelto, come riferimento per la finestra di scelta e come descrizione
  const picked = cover && !('image' in cover) ? coverCard(cover, project) : null
  const pickedRef = picked
    ? cardRefSource({ set: picked.set.name, row: picked.row + 1, side: picked.side }).replace(
        /^card:/i,
        ''
      )
    : ''
  const image = cover && 'image' in cover ? resolveAsset(cover.image, assets) : null

  // l'anteprima di un componente: lo stesso disegno della miniatura
  const coverKey = JSON.stringify(cover)
  const preview = useMemo(() => {
    const c = JSON.parse(coverKey) as ProjectCover | null
    if (c && 'image' in c) return null
    return thumbnailTemplate({ ...project, file: { ...project.file, cover: c ?? undefined } })
  }, [project, coverKey])
  const description = image
    ? cover && 'image' in cover
      ? cover.image
      : ''
    : picked
      ? t('projectInfo.coverPicked', {
          set: picked.set.name,
          n: picked.row + 1,
          side: t(picked.side === 'back' ? 'documents.back' : 'documents.front').toLowerCase()
        })
      : ''

  const newFolder = projectFolderName(folder)
  const canSave = name.trim() !== ''

  return (
    <Dialog title={t('projectInfo.title')} onClose={onClose}>
      <div className="dialog-form project-info-dialog">
        <label>
          <span className="project-info-label">
            {t('projectInfo.name')} <VariableTag name="project.name" />
          </span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <p className="muted small">
          {t('projectInfo.namesHint')}{' '}
          <button type="button" className="link" onClick={onLanguages}>
            {t('projectInfo.translatedNames')}
          </button>
        </p>
        <div className="dialog-row">
          <label>
            <span className="project-info-label">
              {t('projectInfo.author')} <VariableTag name="project.author" />
            </span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <label>
            <span className="project-info-label">
              {t('projectInfo.version')} <VariableTag name="project.version" />
            </span>
            <input value={version} placeholder="0.1" onChange={(e) => setVersion(e.target.value)} />
          </label>
        </div>

        <h4>{t('projectInfo.cover')}</h4>
        <p className="muted small">{t('projectInfo.coverHint')}</p>
        <div className="project-info-cover">
          <div className="project-info-cover-fields">
            <button
              type="button"
              className={!cover ? 'selected' : ''}
              aria-pressed={!cover}
              onClick={() => setCover(null)}
            >
              {t('projectInfo.coverFirst')}
            </button>
            <button
              type="button"
              className={picked ? 'selected' : ''}
              aria-pressed={!!picked}
              disabled={!project.sets.some((x) => x.data?.rows.length)}
              onClick={() => setPicking('card')}
            >
              {t('projectInfo.coverComponent')}
            </button>
            <button
              type="button"
              className={image ? 'selected' : ''}
              aria-pressed={!!image}
              onClick={() => setPicking('image')}
            >
              {t('projectInfo.coverImage')}
            </button>
            <p className="muted small">{description}</p>
          </div>
          <div className="project-info-cover-preview">
            {image?.ok ? (
              <img src={assetUrl(image.path)} alt="" />
            ) : preview ? (
              <CardSvg
                template={preview}
                side="front"
                scale={PREVIEW / Math.max(preview.width, preview.height)}
              />
            ) : (
              <span className="muted small">{t('projectInfo.noCover')}</span>
            )}
          </div>
        </div>

        {!window.api.isWeb && (
          <>
            <h4>{t('projectInfo.folder')}</h4>
            <p className="muted small project-info-path">{project.folder}</p>
            <div className="project-info-folder">
              <input
                value={folder}
                aria-label={t('projectInfo.folderName')}
                onChange={(e) => setFolder(e.target.value)}
              />
              <button
                type="button"
                disabled={!newFolder || newFolder === folderName}
                title={t('projectInfo.renameFolderHint')}
                onClick={() => onRenameFolder(folder)}
              >
                {t('projectInfo.renameFolder')}
              </button>
              <button type="button" onClick={() => void window.api.showFolder(project.folder)}>
                {t('projectInfo.openFolder')}
              </button>
            </div>
            {newFolder && newFolder !== folder.trim() && (
              <p className="field-note small">
                {t('projectInfo.folderWillBe', { folder: newFolder })}
              </p>
            )}
            {projectFolderName(name) !== folderName && (
              <p className="muted small">
                <button
                  type="button"
                  className="link"
                  onClick={() => setFolder(projectFolderName(name))}
                >
                  {t('projectInfo.folderFromName', { folder: projectFolderName(name) })}
                </button>
              </p>
            )}
          </>
        )}

        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button
            className="primary"
            disabled={!canSave}
            onClick={() =>
              onSave({ name: name.trim(), author: author.trim(), version: version.trim(), cover })
            }
          >
            {t('dialog.ok')}
          </button>
        </div>
      </div>
      {picking === 'card' && (
        <InsertCardDialog
          pick={pickedRef}
          bare
          sets={project.sets}
          templates={project.templates}
          project={project.file}
          onInsert={(card) => {
            setPicking(null)
            // la larghezza non conta per la copertina
            setCover({ card: card.replace(/([?&])width=[^&]*&?/i, '$1').replace(/[?&]$/, '') })
          }}
          onClose={() => setPicking(null)}
        />
      )}
      {picking === 'image' && (
        <AssetPicker
          value={cover && 'image' in cover ? cover.image : ''}
          onPick={(name) => {
            setPicking(null)
            setCover({ image: name })
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </Dialog>
  )
}
