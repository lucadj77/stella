import { useEffect, useMemo, useState } from 'react'
import type { LoadedProject } from '../../../shared/project'
import type { Side } from '../../../shared/model/template'
import { walkLayers } from '../../../shared/model/normalize'
import { resolveAsset } from '../../../shared/model/assets'
import { isGenericFont, markupFonts } from '../../../shared/model/fonts'
import {
  DEFAULT_IMAGE,
  MAX_OPEN_FILES,
  DEFAULT_PDF,
  DEFAULT_TTS,
  pdfGrid,
  sidesOf,
  type ExportJob,
  type ExportKind,
  type ExportProfiles,
  type ExportProgress,
  type NamedProfile,
  type ExportResult,
  type ExportSet,
  type ImageOptions,
  type PdfOptions,
  ttsSetObject,
  type TtsObjectType,
  type TtsOptions,
  type TtsSetObject
} from '../../../shared/export'
import { messageFromError, type Message } from '../../../shared/messages'
import { readRealPath, writeRealPath } from '../../../shared/realPath'
import { Dialog } from '../editor/dialogs'
import CreditsDialog from './CreditsDialog'
import ExportPreview from './ExportPreview'
import ProfileBar from './ProfileBar'
import { EXPORT_PRESETS } from '../../../shared/exportPresets'
import { useProjectFonts, type FontCheck } from '../render/fonts'
import Segmented from '../components/Segmented'
import { buildSets } from '../../../shared/exportJob'
import { projectLanguages } from '../../../shared/model/language'
import { languageName } from '../i18n/languageName'
import { cardFingerprints } from '../../../shared/model/compare'
import { ColorSwatch } from '../components/ColorPicker'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import { browserViewable } from '../../../shared/viewable'

const KIND_KEY = 'exportKind'
const DPIS = [150, 300, 600]

export default function ExportDialog({
  project,
  changed,
  language = null,
  onProfiles,
  onClose
}: {
  project: LoadedProject
  /** Lingua delle carte mostrata nell'app, se non è la principale: la prima proposta */
  language?: string | null
  /** Con un confronto attivo, le righe nuove o cambiate di ogni set: si possono esportare solo quelle */
  changed?: Record<string, number[]> | null
  /** Opzioni salvate nel file di progetto dopo un'esportazione */
  onProfiles(p: ExportProfiles): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang: ui } = useI18n()
  const saved = project.file.export ?? {}
  const languages = projectLanguages(project.file)
  /** Lingua da esportare: un codice, o * per tutte (le altre lingue nelle loro sottocartelle) */
  const [exportLanguage, setExportLanguage] = useState(language ?? languages[0] ?? '')
  const jobLanguages =
    exportLanguage === '*' ? languages : [exportLanguage || languages[0] || ''].filter(Boolean)
  const [kind, setKindState] = useState<ExportKind>(() => {
    const k = localStorage.getItem(KIND_KEY)
    return k === 'pdf' || k === 'tts' ? k : 'images'
  })
  const setKind = (k: ExportKind): void => {
    localStorage.setItem(KIND_KEY, k)
    setKindState(k)
  }
  const [img, setImg] = useState<ImageOptions>({ ...DEFAULT_IMAGE, ...saved.images })
  const [pdf, setPdf] = useState<PdfOptions>({ ...DEFAULT_PDF, ...saved.pdf })
  const [tts, setTts] = useState<TtsOptions>(() => ({
    ...DEFAULT_TTS,
    nickname: defaultNickname(project),
    ...saved.tts,
    // nel web i file vanno solo nella cartella di Tabletop Simulator: il mazzo ha bisogno del
    // percorso vero delle immagini, che si conosce solo per quella (vedi shared/realPath.ts)
    ...(window.api.isWeb ? { destination: 'tts' as const } : {})
  }))
  const [realPath, setRealPath] = useState(() =>
    window.api.isWeb && tts.ttsFolder ? readRealPath(tts.ttsFolder) : ''
  )
  const [defaults, setDefaults] = useState({ export: '', tts: '' })
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const { has: hasFont } = useProjectFonts()
  const [credits, setCredits] = useState(false)
  const [preview, setPreview] = useState<ExportJob | null>(null)
  const [named, setNamed] = useState<NamedProfile[]>(saved.named ?? [])
  const [activeProfile, setActiveProfile] = useState('')
  const presets = useMemo(
    () => EXPORT_PRESETS.map((p) => ({ ...p.profile, name: t(p.label) }) as NamedProfile),
    [t]
  )
  const running = progress !== null

  useEffect(() => {
    window.api.defaultExportFolders().then(setDefaults)
    return window.api.onExportProgress(setProgress)
  }, [])

  const options = kind === 'images' ? img : kind === 'pdf' ? pdf : tts
  const setNames = project.sets.map((s) => s.name)
  // nessun set scelto vuol dire tutti; un set rinominato o eliminato si ignora
  const chosen = options.sets.filter((s) => setNames.includes(s))
  const selected = chosen.length ? chosen : setNames
  const patch = (p: Partial<ImageOptions & PdfOptions & TtsOptions>): void => {
    if (kind === 'images') setImg((o) => ({ ...o, ...p }))
    else if (kind === 'pdf') setPdf((o) => ({ ...o, ...p }))
    else setTts((o) => ({ ...o, ...p }))
  }
  const [onlyChanged, setOnlyChanged] = useState(!!changed)
  const changedCount = changed ? selected.reduce((n, s) => n + (changed[s]?.length ?? 0), 0) : 0
  const toggleSet = (name: string): void => {
    const next = selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]
    patch({ sets: next.length === setNames.length ? [] : next })
  }

  /** Almeno un set scelto esce come mazzo di carte: servono le opzioni dei fogli */
  const hasCards = selected.some((name) => ttsSetObject(tts, name).type === 'card')

  const firstTemplate = useMemo(() => {
    const set = project.sets.find((s) => selected.includes(s.name))
    return project.templates.find((x) => x.name === set?.template) ?? null
  }, [project, selected])
  const fieldNames = useMemo(() => {
    const names = new Set<string>()
    for (const s of project.sets) {
      if (!selected.includes(s.name)) continue
      const tpl = project.templates.find((x) => x.name === s.template)
      if (tpl)
        for (const l of walkLayers([...tpl.front, ...tpl.back]))
          if (l.type === 'text' || l.type === 'value') names.add(l.name)
      for (const h of s.data?.headers ?? [])
        if (h && !h.includes('.') && h !== 'amount') names.add(h)
    }
    return [...names]
  }, [project, selected])

  /** Il lavoro con le opzioni attuali: lo stesso per l'anteprima e per l'esportazione */
  const buildJob = (lang: string | null = jobLanguages[0] ?? null): ExportJob => {
    // la lingua principale resta nella cartella di sempre
    const other = lang && lang !== languages[0] ? lang : undefined
    const all = buildSets(project, selected, other)
    // solo le carte cambiate dal confronto: i set senza carte cambiate non escono
    const sets =
      changed && onlyChanged
        ? all
            .map((s) => {
              const rows = new Set(changed[s.name] ?? [])
              return { ...s, cards: s.cards.filter((c) => rows.has(c.n - 1)) }
            })
            .filter((s) => s.cards.length)
        : all
    const base = { project: project.file.name, sets, ...(other ? { language: other } : {}) }
    return kind === 'images'
      ? { ...base, kind, options: img }
      : kind === 'pdf'
        ? { ...base, kind, options: pdf }
        : { ...base, kind, options: tts }
  }

  /** Profilo scelto: tipo e opzioni nella finestra. Un preset non cambia set e cartella */
  const pickProfile = (p: NamedProfile | null): void => {
    setActiveProfile(p?.name ?? '')
    if (!p) return
    const preset = presets.some((x) => x.name === p.name)
    const keep = <T extends { sets: string[] }>(o: T): Partial<T> =>
      preset ? ({ sets: o.sets, ...('folder' in o ? { folder: o.folder } : {}) } as Partial<T>) : {}
    if (p.kind === 'images') setImg((o) => ({ ...DEFAULT_IMAGE, ...p.options, ...keep(o) }))
    else if (p.kind === 'pdf') setPdf((o) => ({ ...DEFAULT_PDF, ...p.options, ...keep(o) }))
    else
      setTts((o) => ({
        ...DEFAULT_TTS,
        nickname: defaultNickname(project),
        ...p.options,
        ...keep(o)
      }))
    setKind(p.kind)
  }
  const currentProfile = (): NamedProfile =>
    kind === 'images'
      ? { name: '', kind, options: img }
      : kind === 'pdf'
        ? { name: '', kind, options: pdf }
        : { name: '', kind, options: tts }
  /** I profili si scrivono subito nel file di progetto, come le ultime opzioni */
  const saveNamed = (list: NamedProfile[], active: string): void => {
    setNamed(list)
    setActiveProfile(active)
    const profiles: ExportProfiles = { ...saved, named: list.length ? list : undefined }
    window.api.saveExportProfiles(profiles).catch(() => undefined)
    onProfiles(profiles)
  }

  /**
   * Impronte delle carte esportate, per confrontare più avanti con "l'ultima esportazione": un set
   * esportato per intero si sostituisce, le carte di un'esportazione parziale si aggiungono
   */
  const recordPrinted = async (sets: ExportJob['sets']): Promise<void> => {
    const prints = cardFingerprints(project, project.assets)
    const old = await window.api.readPrinted()
    const out = { ...old?.sets }
    for (const s of sets) {
      const now = prints[s.name] ?? []
      out[s.name] =
        s.cards.length === now.length
          ? now
          : [...(out[s.name] ?? []), ...s.cards.map((c) => now[c.n - 1]).filter(Boolean)]
    }
    await window.api.savePrinted({ date: Date.now(), sets: out })
  }

  const run = async (): Promise<void> => {
    setError(null)
    setResult(null)
    setProgress({ done: 0, total: 0 })
    const profiles: ExportProfiles = {
      ...saved,
      images: img,
      pdf,
      tts,
      named: named.length ? named : undefined
    }
    try {
      window.api.saveExportProfiles(profiles).catch(() => undefined)
      onProfiles(profiles)
      const jobs = jobLanguages.length ? jobLanguages.map((l) => buildJob(l)) : [buildJob(null)]
      const sets = jobs[0].sets
      const r: ExportResult = { files: 0, folders: [], warnings: [], cancelled: false }
      // una lingua dopo l'altra, ognuna nella sua cartella
      for (const job of jobs) {
        const one = await window.api.runExport(job, {
          assets: project.assets,
          fonts: project.fonts,
          styles: project.file.styles ?? {},
          variables: project.file.variables ?? {}
        })
        r.files += one.files
        r.folders.push(...one.folders.filter((f) => !r.folders.includes(f)))
        r.paths = [...(r.paths ?? []), ...(one.paths ?? [])]
        r.warnings.push(...one.warnings)
        if (one.cancelled) {
          r.cancelled = true
          break
        }
      }
      const sides: Side[] =
        kind === 'images'
          ? sidesOf(img.sides)
          : kind === 'pdf' && pdf.duplex === 'none'
            ? sidesOf(pdf.sides)
            : ['front', 'back']
      const missing = missingImages(project, sets, sides)
      if (missing.length)
        r.warnings.push({ key: 'export.missingImages', params: { cards: missing.join('; ') } })
      const fonts = missingFonts(project, sets, hasFont)
      if (fonts.length)
        r.warnings.push({ key: 'export.missingFonts', params: { fonts: fonts.join(', ') } })
      setResult(r)
      if (!r.cancelled) await recordPrinted(sets).catch(() => undefined)
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setProgress(null)
    }
  }

  const chooseFolder = async (current: string, key: 'folder' | 'ttsFolder'): Promise<void> => {
    const f = await window.api.chooseExportFolder(current)
    if (!f) return
    patch({ [key]: f })
    if (key === 'ttsFolder' && window.api.isWeb) setRealPath(readRealPath(f))
  }

  /** "Personalizzato" scelto nel menu: il campo resta anche se il valore è uno di quelli fissi */
  const [customDpi, setCustomDpi] = useState(false)

  const num = (v: string, fallback: number): number => {
    const n = parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : fallback
  }

  const field = (label: MessageKey, control: React.ReactNode, hint?: string): React.JSX.Element => (
    <div className="field">
      <span className="field-label">{t(label)}</span>
      <div className="field-control">{control}</div>
      {hint && <p className="field-note export-note">{hint}</p>}
    </div>
  )
  const check = (
    value: boolean,
    onChange: (v: boolean) => void,
    label: MessageKey
  ): React.JSX.Element => (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      {t(label)}
    </label>
  )
  const select = <T extends string | number>(
    value: T,
    choices: [T, string][],
    onChange: (v: T) => void
  ): React.JSX.Element => (
    <select
      value={String(value)}
      onChange={(e) => {
        const c = choices.find(([v]) => String(v) === e.target.value)
        if (c) onChange(c[0])
      }}
    >
      {choices.map(([v, label]) => (
        <option key={String(v)} value={String(v)}>
          {label}
        </option>
      ))}
    </select>
  )
  const mm = (
    value: number,
    onChange: (v: number) => void,
    disabled = false
  ): React.JSX.Element => (
    <>
      <input
        className="num"
        type="number"
        step={0.5}
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(num(e.target.value, value))}
      />
      <span className="unit">mm</span>
    </>
  )
  const folderField = (
    value: string,
    placeholder: string,
    key: 'folder' | 'ttsFolder'
  ): React.JSX.Element => (
    <>
      <input
        value={value}
        placeholder={placeholder}
        title={value || placeholder}
        // nel web una cartella si sceglie solo con il pulsante
        readOnly={window.api.isWeb}
        onChange={(e) => patch({ [key]: e.target.value })}
      />
      <button
        type="button"
        onClick={() => chooseFolder(value || placeholder, key)}
        title={t('tip.chooseFolder')}
      >
        {t('export.choose')}
      </button>
    </>
  )
  const sides: [ImageOptions['sides'], string][] = [
    ['front', t('export.front')],
    ['back', t('export.back')],
    ['both', t('export.bothSides')]
  ]

  let perPage: string | null = null
  if (kind === 'pdf' && firstTemplate) {
    const g = pdfGrid(pdf, firstTemplate)
    perPage =
      g.x0 < 0 || g.y0 < 0
        ? t('export.gridTooBig')
        : t(g.rotated ? 'export.perPageRotated' : 'export.perPage', {
            cols: g.cols,
            rows: g.rows,
            n: g.cols * g.rows
          })
  }

  return (
    <Dialog title={t('export.title')} onClose={running ? () => undefined : onClose} guide="export">
      <div className="export-dialog">
        <Segmented<ExportKind>
          value={kind}
          options={[
            ['images', t('export.images')],
            ['pdf', t('export.pdf')],
            ['tts', t('export.tts')] as [ExportKind, string]
          ]}
          onChange={(k) => {
            setKind(k)
            setActiveProfile('')
          }}
        />
        <ProfileBar
          profiles={named}
          presets={presets}
          active={activeProfile}
          current={currentProfile}
          onPick={pickProfile}
          onChange={saveNamed}
        />
        <div className="export-fields">
          {field(
            'export.sets',
            <div className="export-sets">
              {setNames.map((name) => (
                <label key={name} className="check">
                  <input
                    type="checkbox"
                    checked={selected.includes(name)}
                    onChange={() => toggleSet(name)}
                  />
                  {name}
                </label>
              ))}
            </div>
          )}
          {languages.length > 0 &&
            field(
              'export.language',
              <select value={exportLanguage} onChange={(e) => setExportLanguage(e.target.value)}>
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {languageName(l, ui)}
                  </option>
                ))}
                <option value="*">{t('export.allLanguages')}</option>
              </select>,
              t('export.languageHint')
            )}
          {changed &&
            field(
              'export.onlyChanged',
              <label className="check">
                <input
                  type="checkbox"
                  checked={onlyChanged}
                  onChange={(e) => setOnlyChanged(e.target.checked)}
                />
                {t('export.onlyChangedHint', { n: changedCount })}
              </label>
            )}
          {field(
            'export.copies',
            check(options.copies, (copies) => patch({ copies }), 'export.copiesHint')
          )}

          {kind === 'images' && (
            <>
              {field(
                'export.format',
                <>
                  {select(
                    img.format,
                    [
                      ['png', 'PNG'],
                      ['jpg', 'JPG'],
                      ['webp', 'WebP'],
                      ['svg', 'SVG']
                    ],
                    (format) => patch({ format })
                  )}
                  {(img.format === 'jpg' || img.format === 'webp') && (
                    <>
                      <span className="unit">{t('export.quality')}</span>
                      <input
                        className="num narrow"
                        type="number"
                        min={1}
                        max={100}
                        value={img.quality}
                        onChange={(e) => patch({ quality: num(e.target.value, img.quality) })}
                      />
                    </>
                  )}
                </>
              )}
              {img.format !== 'svg' &&
                field(
                  'export.resolution',
                  <>
                    {select<number>(
                      customDpi || !DPIS.includes(img.dpi) ? 0 : img.dpi,
                      [
                        ...DPIS.map((d): [number, string] => [d, `${d} DPI`]),
                        [0, t('export.custom')]
                      ],
                      (dpi) => {
                        setCustomDpi(!dpi)
                        if (dpi) patch({ dpi })
                      }
                    )}
                    {(customDpi || !DPIS.includes(img.dpi)) && (
                      <>
                        <input
                          className="num"
                          type="number"
                          min={30}
                          max={1200}
                          value={img.dpi}
                          onChange={(e) =>
                            patch({
                              dpi: Math.max(30, Math.min(1200, num(e.target.value, img.dpi)))
                            })
                          }
                        />
                        <span className="unit">DPI</span>
                      </>
                    )}
                  </>,
                  firstTemplate
                    ? t('export.pixels', {
                        w: Math.round(
                          ((firstTemplate.width + (img.bleed ? 2 * firstTemplate.bleed : 0)) *
                            img.dpi) /
                            25.4
                        ),
                        h: Math.round(
                          ((firstTemplate.height + (img.bleed ? 2 * firstTemplate.bleed : 0)) *
                            img.dpi) /
                            25.4
                        )
                      })
                    : undefined
                )}
              {field(
                'export.bleed',
                check(img.bleed, (bleed) => patch({ bleed }), 'export.bleedInclude')
              )}
              {field(
                'export.sides',
                select(img.sides, sides, (s) => patch({ sides: s }))
              )}
              {img.format !== 'jpg' &&
                !img.bleed &&
                field(
                  'export.background',
                  check(
                    img.transparent,
                    (transparent) => patch({ transparent }),
                    'export.transparent'
                  )
                )}
              {field(
                'export.pattern',
                <input value={img.pattern} onChange={(e) => patch({ pattern: e.target.value })} />,
                t('export.patternHint')
              )}
              {field('export.folder', folderField(img.folder, defaults.export, 'folder'))}
            </>
          )}

          {kind === 'pdf' && (
            <>
              {field(
                'export.page',
                <>
                  {select(
                    pdf.page,
                    [
                      ['A4', 'A4'],
                      ['A3', 'A3'],
                      ['Letter', 'Letter'],
                      ['custom', t('export.custom')]
                    ],
                    (page) => patch({ page })
                  )}
                  {select(
                    pdf.landscape ? 'l' : 'p',
                    [
                      ['p', t('export.portrait')],
                      ['l', t('export.landscape')]
                    ],
                    (v) => patch({ landscape: v === 'l' })
                  )}
                </>
              )}
              {pdf.page === 'custom' &&
                field(
                  'export.pageSize',
                  <>
                    {mm(pdf.pageWidth, (pageWidth) => patch({ pageWidth }))}
                    <span className="unit">×</span>
                    {mm(pdf.pageHeight, (pageHeight) => patch({ pageHeight }))}
                  </>
                )}
              {field(
                'export.margin',
                mm(pdf.margin, (margin) => patch({ margin }))
              )}
              {field(
                'export.bleed',
                check(pdf.bleed, (bleed) => patch({ bleed }), 'export.bleedTouch')
              )}
              {!pdf.bleed &&
                field(
                  'export.corners',
                  check(pdf.rounded, (rounded) => patch({ rounded }), 'export.rounded')
                )}
              {field(
                'export.spacing',
                mm(pdf.spacing, (spacing) => patch({ spacing }), pdf.bleed)
              )}
              {field(
                'export.layout',
                <>
                  {select(
                    pdf.layout,
                    [
                      ['auto', t('export.layoutAuto')],
                      ['fixed', t('export.layoutFixed')]
                    ],
                    (layout) => patch({ layout })
                  )}
                  {pdf.layout === 'fixed' && (
                    <>
                      <input
                        className="num narrow"
                        type="number"
                        min={1}
                        value={pdf.cols}
                        onChange={(e) =>
                          patch({ cols: Math.max(1, Math.round(num(e.target.value, pdf.cols))) })
                        }
                      />
                      <span className="unit">×</span>
                      <input
                        className="num narrow"
                        type="number"
                        min={1}
                        value={pdf.rows}
                        onChange={(e) =>
                          patch({ rows: Math.max(1, Math.round(num(e.target.value, pdf.rows))) })
                        }
                      />
                    </>
                  )}
                </>,
                perPage ?? undefined
              )}
              {field(
                'export.fold',
                check(pdf.fold, (fold) => patch({ fold }), 'export.foldPairs'),
                pdf.fold ? t('export.foldHint') : undefined
              )}
              {pdf.layout === 'auto' &&
                !pdf.fold &&
                field(
                  'export.rotate',
                  check(pdf.autoRotate, (autoRotate) => patch({ autoRotate }), 'export.autoRotate')
                )}
              {pdf.layout === 'auto' &&
                !pdf.fold &&
                field(
                  'export.poster',
                  <>
                    {check(pdf.poster, (poster) => patch({ poster }), 'export.posterSplit')}
                    {pdf.poster && (
                      <>
                        <span className="unit">{t('export.posterOverlap')}</span>
                        <input
                          className="num narrow"
                          type="number"
                          min={0}
                          value={pdf.posterOverlap}
                          onChange={(e) =>
                            patch({ posterOverlap: Math.max(0, num(e.target.value, 10)) })
                          }
                        />
                        <span className="unit">mm</span>
                      </>
                    )}
                  </>,
                  t('export.posterHint')
                )}
              {field(
                'export.marks',
                <>
                  {select(
                    pdf.marks,
                    [
                      ['none', t('export.marksNone')],
                      ['corners', t('export.marksCorners')],
                      ['lines', t('export.marksLines')]
                    ],
                    (marks) => patch({ marks })
                  )}
                  {pdf.marks !== 'none' && (
                    <ColorSwatch
                      value={pdf.markColor}
                      title={t('export.markColor')}
                      onChange={(markColor) => patch({ markColor })}
                    />
                  )}
                </>
              )}
              {pdf.marks !== 'none' && (
                <>
                  {pdf.marks === 'corners' &&
                    field(
                      'export.markLength',
                      mm(pdf.markLength, (markLength) => patch({ markLength }))
                    )}
                  {field(
                    'export.markWidth',
                    <>
                      {mm(pdf.markWidth, (markWidth) => patch({ markWidth }))}
                      {check(
                        pdf.marksOver,
                        (marksOver) => patch({ marksOver }),
                        'export.marksOver'
                      )}
                    </>
                  )}
                </>
              )}
              {!pdf.fold &&
                field(
                  'export.duplex',
                  select(
                    pdf.duplex,
                    [
                      ['none', t('export.duplexNone')],
                      ['long', t('export.duplexLong')],
                      ['short', t('export.duplexShort')]
                    ],
                    (duplex) => patch({ duplex })
                  )
                )}
              {pdf.fold
                ? null
                : pdf.duplex === 'none'
                  ? field(
                      'export.sides',
                      select(pdf.sides, sides, (s) => patch({ sides: s }))
                    )
                  : field(
                      'export.offset',
                      <>
                        <span className="unit">x</span>
                        {mm(pdf.offsetX, (offsetX) => patch({ offsetX }))}
                        <span className="unit">y</span>
                        {mm(pdf.offsetY, (offsetY) => patch({ offsetY }))}
                      </>,
                      t('export.offsetHint')
                    )}
              {field(
                'export.files',
                select(
                  pdf.split,
                  [
                    ['single', t('export.splitSingle')],
                    ['set', t('export.splitSet')],
                    ['side', t('export.splitSide')]
                  ],
                  (split) => patch({ split })
                )
              )}
              {pdf.split !== 'set' &&
                field(
                  'export.continuous',
                  check(
                    pdf.continuous,
                    (continuous) => patch({ continuous }),
                    'export.continuousCheck'
                  ),
                  t('export.continuousHint')
                )}
              {field(
                'export.extras',
                <>
                  {check(pdf.proof, (proof) => patch({ proof }), 'export.proof')}
                  {!window.api.isWeb && check(pdf.cmyk, (cmyk) => patch({ cmyk }), 'export.cmyk')}
                </>,
                window.api.isWeb ? t('web.pdfHint') : pdf.cmyk ? t('export.cmykHint') : undefined
              )}
              {field('export.folder', folderField(pdf.folder, defaults.export, 'folder'))}
            </>
          )}

          {kind === 'tts' && (
            <>
              {field(
                'export.ttsObjects',
                <div className="tts-objects">
                  {selected.map((name) => {
                    const obj = ttsSetObject(tts, name)
                    const set = (p: Partial<TtsSetObject>): void =>
                      patch({ objects: { ...tts.objects, [name]: { ...obj, ...p } } })
                    return (
                      <div key={name} className="tts-object">
                        <span className="tts-object-name" title={name}>
                          {name}
                        </span>
                        {select<TtsObjectType>(
                          obj.type,
                          [
                            ['card', t('export.ttsCard')],
                            ['token', t('export.ttsToken')],
                            ['tile', t('export.ttsTile')],
                            ['board', t('export.ttsBoard')],
                            ['die', t('export.ttsDie')]
                          ],
                          (type) => set({ type })
                        )}
                        {obj.type !== 'card' && obj.type !== 'die' && (
                          <>
                            <span className="unit">{t('export.ttsThickness')}</span>
                            <input
                              className="num narrow"
                              type="number"
                              step={0.5}
                              min={0.1}
                              max={50}
                              value={obj.thickness}
                              title={t('export.ttsThicknessHint')}
                              onChange={(e) =>
                                set({
                                  thickness: Math.max(
                                    0.1,
                                    Math.min(50, num(e.target.value, obj.thickness))
                                  )
                                })
                              }
                            />
                            <span className="unit">mm</span>
                          </>
                        )}
                        {(obj.type === 'tile' || obj.type === 'board') && (
                          <>
                            <span className="unit">{t('export.ttsEdge')}</span>
                            <ColorSwatch
                              value={obj.edgeColor}
                              title={t('export.ttsEdge')}
                              onChange={(edgeColor) => set({ edgeColor })}
                            />
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>,
                t('export.ttsObjectsHint')
              )}
              {hasCards &&
                tts.copies &&
                field(
                  'export.copiesIn',
                  select(
                    tts.copiesIn,
                    [
                      ['deck', t('export.copiesInDeck')],
                      ['sheet', t('export.copiesInSheet')]
                    ],
                    (copiesIn) => patch({ copiesIn })
                  )
                )}
              {hasCards &&
                field(
                  'export.grid',
                  <>
                    {select(
                      tts.grid,
                      [
                        ['auto', t('export.gridAuto')],
                        ['fixed', t('export.layoutFixed')]
                      ],
                      (grid) => patch({ grid })
                    )}
                    {tts.grid === 'fixed' && (
                      <>
                        <input
                          className="num narrow"
                          type="number"
                          min={2}
                          max={10}
                          value={tts.cols}
                          onChange={(e) =>
                            patch({
                              cols: Math.max(
                                2,
                                Math.min(10, Math.round(num(e.target.value, tts.cols)))
                              )
                            })
                          }
                        />
                        <span className="unit">×</span>
                        <input
                          className="num narrow"
                          type="number"
                          min={2}
                          max={7}
                          value={tts.rows}
                          onChange={(e) =>
                            patch({
                              rows: Math.max(
                                2,
                                Math.min(7, Math.round(num(e.target.value, tts.rows)))
                              )
                            })
                          }
                        />
                      </>
                    )}
                  </>,
                  t('export.gridHint')
                )}
              {field(
                'export.maxSize',
                select<number>(
                  tts.maxSize,
                  [
                    [4096, '4096 px'],
                    [8192, '8192 px']
                  ],
                  (v) => patch({ maxSize: v === 8192 ? 8192 : 4096 })
                )
              )}
              {hasCards &&
                field(
                  'export.ttsBack',
                  select(
                    tts.back,
                    [
                      ['auto', t('export.backAuto')],
                      ['single', t('export.backSingle')],
                      ['sheet', t('export.backSheet')]
                    ],
                    (back) => patch({ back })
                  )
                )}
              {!window.api.isWeb &&
                field(
                  'export.destination',
                  select(
                    tts.destination,
                    [
                      ['project', t('export.destProject')],
                      ['tts', t('export.destTts')],
                      ['both', t('export.destBoth')]
                    ],
                    (destination) => patch({ destination })
                  )
                )}
              {tts.destination !== 'project' &&
                field(
                  window.api.isWeb ? 'web.ttsFolder' : 'export.ttsFolder',
                  folderField(tts.ttsFolder, defaults.tts, 'ttsFolder'),
                  window.api.isWeb ? t('web.ttsFolderHint') : undefined
                )}
              {window.api.isWeb &&
                tts.ttsFolder &&
                field(
                  'web.ttsRealPath',
                  <input
                    value={realPath}
                    placeholder={t('web.ttsRealPathPlaceholder')}
                    onChange={(e) => {
                      setRealPath(e.target.value)
                      writeRealPath(tts.ttsFolder, e.target.value)
                    }}
                  />,
                  t('web.ttsRealPathHint')
                )}
              {field(
                'export.nickname',
                select(
                  tts.nickname,
                  [['', t('export.noField')], ...fieldNames.map((f): [string, string] => [f, f])],
                  (nickname) => patch({ nickname })
                )
              )}
              {field(
                'export.description',
                select(
                  tts.description,
                  [['', t('export.noField')], ...fieldNames.map((f): [string, string] => [f, f])],
                  (description) => patch({ description })
                )
              )}
            </>
          )}
        </div>

        {error && <p className="field-error">{t(error)}</p>}
        {result && (
          <div className="export-result">
            <p>
              {result.cancelled
                ? t('export.cancelled', { n: result.files })
                : t('export.done', { n: result.files })}
            </p>
            {result.warnings.map((w, i) => (
              <p key={i} className="field-error">
                {t(w)}
              </p>
            ))}
            {/* pochi file (un PDF, un mazzo): si aprono direttamente */}
            {/* nel browser si aprono solo i file che sa mostrare: gli altri sono già nella cartella */}
            {(result.paths?.length ?? 0) <= MAX_OPEN_FILES &&
              result.paths
                ?.filter((f) => !window.api.isWeb || browserViewable(f))
                .map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="link"
                    onClick={() => window.api.showFolder(f)}
                  >
                    {t('export.openFile', { file: f.split(/[\\/]/).pop() ?? f })}
                  </button>
                ))}
            {result.folders.map((f) =>
              // il browser non apre le cartelle: si dice solo dove sono i file
              window.api.isWeb ? (
                <p key={f} className="muted small">
                  {f}
                </p>
              ) : (
                <button
                  key={f}
                  type="button"
                  className="link"
                  onClick={() => window.api.showFolder(f)}
                >
                  {t('export.openFolder', { folder: f })}
                </button>
              )
            )}
          </div>
        )}
        <div className="dialog-buttons">
          <button
            type="button"
            className="spacer-right"
            title={t('credits.hint')}
            onClick={() => setCredits(true)}
          >
            {t('credits.open')}
          </button>
          {running && (
            <span className="muted export-progress">
              {progress.total
                ? t('export.progress', { done: progress.done, total: progress.total })
                : t('export.preparing')}
            </span>
          )}
          {running ? (
            <button type="button" onClick={() => window.api.cancelExport()}>
              {t('export.cancel')}
            </button>
          ) : (
            <button type="button" onClick={onClose}>
              {t('export.close')}
            </button>
          )}
          <button
            type="button"
            title={t('export.previewHint')}
            disabled={running || !selected.length || (!!changed && onlyChanged && !changedCount)}
            onClick={() => setPreview(buildJob())}
          >
            {t('export.preview')}
          </button>
          <button
            type="button"
            className="primary"
            disabled={running || !selected.length || (!!changed && onlyChanged && !changedCount)}
            onClick={run}
          >
            {t('export.run')}
          </button>
        </div>
      </div>
      {credits && <CreditsDialog project={project} onClose={() => setCredits(false)} />}
      {preview && <ExportPreview job={preview} onExport={run} onClose={() => setPreview(null)} />}
    </Dialog>
  )
}

/**
 * Immagini che mancano in assets/ nei lati esportati, ognuna con le carte che la usano:
 * nell'esportazione restano i segnaposto
 */
function missingImages(project: LoadedProject, sets: ExportSet[], sides: Side[]): string[] {
  const byImage = new Map<string, string[]>()
  for (const set of sets)
    for (const c of set.cards) {
      const layers = walkLayers(sides.flatMap((side) => c.template[side]))
      const names = new Set(
        layers
          .filter(
            (l) =>
              l.type === 'image' &&
              l.visible &&
              l.missing !== 'hide' &&
              l.src.trim() !== '' &&
              !resolveAsset(l.src, project.assets).ok
          )
          .map((l) => (l.type === 'image' ? l.src.trim() : ''))
      )
      const card = `${set.name} ${c.n}${c.label ? ` (${c.label})` : ''}`
      for (const name of names) byImage.set(name, [...(byImage.get(name) ?? []), card])
    }
  return [...byImage].map(([name, cards]) => `"${name}": ${cards.join(', ')}`)
}

/** Font usati dalle carte esportate che non sono né nel progetto né installati */
function missingFonts(project: LoadedProject, sets: ExportSet[], hasFont: FontCheck): string[] {
  const out = new Set<string>()
  for (const set of sets)
    for (const c of set.cards)
      for (const l of walkLayers([...c.template.front, ...c.template.back])) {
        if (l.type !== 'text' || !l.visible) continue
        for (const f of [
          l.font,
          ...markupFonts(l.text, project.file.styles, project.file.variables)
        ])
          if (f.trim() && !isGenericFont(f) && !hasFont(f)) out.add(f)
      }
  return [...out].sort()
}

/** Nickname di base: il campo che dà il nome alle carte, o il primo testo del template */
function defaultNickname(project: LoadedProject): string {
  const tpl = project.templates.find((x) => x.name === project.sets[0]?.template)
  if (!tpl) return ''
  if (tpl.labelField) return tpl.labelField
  return walkLayers(tpl.front).find((l) => l.type === 'text')?.name ?? ''
}
