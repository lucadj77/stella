import { useMemo, useState } from 'react'
import { IMAGE_EXTENSIONS } from '../../../shared/model/assets'
import { projectFolderName } from '../../../shared/model/projectName'
import { thumbnailTemplate } from '../../../shared/model/thumbnail'
import type { LoadedProject, ProjectCover } from '../../../shared/project'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { assetUrl } from '../render/assets'
import CardSvg from '../render/CardSvg'

/** Ciò che la finestra cambia in stella.json */
export interface ProjectInfo {
  name: string
  author: string
  version: string
  cover: ProjectCover | null
}

type CoverKind = 'first' | 'component' | 'image'

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
  const startCover = file.cover
  const [kind, setKind] = useState<CoverKind>(
    !startCover ? 'first' : 'image' in startCover ? 'image' : 'component'
  )
  const withData = project.sets.filter((s) => s.data?.rows.length)
  const [coverSet, setCoverSet] = useState(
    startCover && 'set' in startCover ? startCover.set : (withData[0]?.name ?? '')
  )
  const [coverRow, setCoverRow] = useState(startCover && 'set' in startCover ? startCover.row : 1)
  const [coverSide, setCoverSide] = useState<'front' | 'back'>(
    startCover && 'set' in startCover ? (startCover.side ?? 'front') : 'front'
  )
  const images = project.assets.filter((a) =>
    IMAGE_EXTENSIONS.some((e) => a.toLowerCase().endsWith(e))
  )
  const [coverImage, setCoverImage] = useState(
    startCover && 'image' in startCover ? startCover.image : (images[0] ?? '')
  )
  const folderName = project.folder.split(/[\\/]/).filter(Boolean).pop() ?? ''
  const [folder, setFolder] = useState(folderName)

  const rows = project.sets.find((s) => s.name === coverSet)?.data?.rows.length ?? 0
  const cover: ProjectCover | null =
    kind === 'image' && coverImage
      ? { image: coverImage }
      : kind === 'component' && coverSet
        ? {
            set: coverSet,
            row: Math.min(Math.max(1, coverRow || 1), Math.max(1, rows)),
            ...(coverSide === 'back' ? { side: 'back' as const } : {})
          }
        : null

  // l'anteprima di un componente: lo stesso disegno della miniatura
  const coverKey = JSON.stringify(cover)
  const preview = useMemo(() => {
    if (kind === 'image') return null
    const c = JSON.parse(coverKey) as ProjectCover | null
    return thumbnailTemplate({ ...project, file: { ...project.file, cover: c ?? undefined } })
  }, [project, kind, coverKey])

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
            <select value={kind} onChange={(e) => setKind(e.target.value as CoverKind)}>
              <option value="first">{t('projectInfo.coverFirst')}</option>
              <option value="component" disabled={!withData.length}>
                {t('projectInfo.coverComponent')}
              </option>
              <option value="image" disabled={!images.length}>
                {t('projectInfo.coverImage')}
              </option>
            </select>
            {kind === 'component' && (
              <>
                <label>
                  {t('projectInfo.coverSet')}
                  <select value={coverSet} onChange={(e) => setCoverSet(e.target.value)}>
                    {withData.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="dialog-row">
                  <label>
                    {t('projectInfo.coverRow')}
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, rows)}
                      value={coverRow}
                      onChange={(e) => setCoverRow(parseInt(e.target.value, 10) || 1)}
                    />
                  </label>
                  <label>
                    {t('projectInfo.coverSide')}
                    <select
                      value={coverSide}
                      onChange={(e) => setCoverSide(e.target.value as 'front' | 'back')}
                    >
                      <option value="front">{t('documents.front')}</option>
                      <option value="back">{t('documents.back')}</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            {kind === 'image' && (
              <select value={coverImage} onChange={(e) => setCoverImage(e.target.value)}>
                {images.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="project-info-cover-preview">
            {kind === 'image' && coverImage ? (
              <img src={assetUrl(coverImage)} alt="" />
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
    </Dialog>
  )
}
