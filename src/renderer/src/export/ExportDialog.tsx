import { useEffect, useMemo, useState } from 'react'
import NumInput from '../components/NumInput'
import type { LoadedProject } from '../../../shared/project'
import { kindOf } from '../../../shared/model/template'
import { walkLayers } from '../../../shared/model/normalize'
import {
  DEFAULT_IMAGE,
  DEFAULT_PDF,
  DEFAULT_TTS,
  pdfGrid,
  ttsSetObject,
  ttsDefaultThickness,
  type ExportJob,
  type ExportKind,
  type ExportProfiles,
  type ExportProgress,
  type NamedProfile,
  type ExportResult,
  type ImageOptions,
  type PdfOptions,
  type TtsObjectType,
  type TtsOptions,
  type TtsSetObject
} from '../../../shared/export'
import { messageFromError, type Message } from '../../../shared/messages'
import { readRealPath, writeRealPath } from '../../../shared/realPath'
import { exportSummary, previewItems } from '../../../shared/exportPreview'
import { Dialog } from '../editor/dialogs'
import CreditsDialog from './CreditsDialog'
import ExportPreview from './ExportPreview'
import LivePreview from './LivePreview'
import { ResultLinks } from './ExportToast'
import { Choice, KindPicker, ProfileMenu, Row, Section } from './exportParts'
import { buildJob, runExport, selectedSets, type KindOptions } from './exportRun'
import { EXPORT_GOALS, EXPORT_PRESETS, type ExportGoal } from '../../../shared/exportPresets'
import { useProjectFonts } from '../render/fonts'
import { projectLanguages } from '../../../shared/model/language'
import { languageName } from '../i18n/languageName'
import { ColorSwatch } from '../components/ColorPicker'
import { useI18n } from '../i18n/context'
import { useLengthUnit } from '../units'
import { UNIT_LABEL, fromUnit, toUnit, unitStep } from '../../../shared/model/units'
import type { MessageKey } from '../i18n/en'

// La finestra Esporta, in quattro strati: cosa vuoi fare (gli obiettivi), le scelte che contano
// (con i disegni), le sezioni chiuse con il riassunto dei valori e la frase che dice cosa
// succederà. A destra l'anteprima vera, in piccolo. Vedi docs/specifica.md, sezione 9.

const KIND_KEY = 'exportKind'
const DPIS = [150, 300, 600]
/** Dopo l'ultimo cambio di opzioni, l'anteprima e la frase si ricalcolano dopo questo tempo */
const SETTLE_MS = 350

/** Lo schema dei nomi dei preset delle immagini: dice per chi sono */
const presetPattern = (label: string): string => {
  const p = EXPORT_PRESETS.find((x) => x.label === label)?.profile
  return p?.kind === 'images' ? ((p.options as Partial<ImageOptions>).pattern ?? '') : ''
}
const AUDIENCE_PATTERN = { mpc: presetPattern('preset.mpc'), tgc: presetPattern('preset.tgc') }
type Audience = 'generic' | 'mpc' | 'tgc'

export default function ExportDialog({
  project,
  changed,
  language = null,
  profile,
  onProfiles,
  onClose
}: {
  project: LoadedProject
  /** Lingua delle carte mostrata nell'app, se non è la principale: la prima proposta */
  language?: string | null
  /** Con un confronto attivo, le righe nuove o cambiate di ogni set: si possono esportare solo quelle */
  changed?: Record<string, number[]> | null
  /** Profilo da caricare all'apertura (scelto nel menu del pulsante Esporta) */
  profile?: string
  /** Opzioni salvate nel file di progetto dopo un'esportazione */
  onProfiles(p: ExportProfiles): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang: ui } = useI18n()
  const lengthUnit = useLengthUnit()
  const saved = project.file.export ?? {}
  const languages = projectLanguages(project.file)
  /** Lingua da esportare: un codice, o * per tutte (le altre lingue nelle loro sottocartelle) */
  const [exportLanguage, setExportLanguage] = useState(language ?? languages[0] ?? '')
  const startProfile = saved.named?.find((p) => p.name === profile)
  const [kind, setKindState] = useState<ExportKind>(() => {
    if (startProfile) return startProfile.kind
    const k = localStorage.getItem(KIND_KEY)
    return k === 'pdf' || k === 'tts' ? k : 'images'
  })
  const setKind = (k: ExportKind): void => {
    localStorage.setItem(KIND_KEY, k)
    setKindState(k)
  }
  const [img, setImg] = useState<ImageOptions>(() => ({
    ...DEFAULT_IMAGE,
    ...saved.images,
    ...(startProfile?.kind === 'images' ? startProfile.options : {})
  }))
  const [pdf, setPdf] = useState<PdfOptions>(() => ({
    ...DEFAULT_PDF,
    ...saved.pdf,
    ...(startProfile?.kind === 'pdf' ? startProfile.options : {})
  }))
  const [tts, setTts] = useState<TtsOptions>(() => ({
    ...DEFAULT_TTS,
    ...saved.tts,
    ...(startProfile?.kind === 'tts' ? startProfile.options : {}),
    // nel web i file vanno solo nella cartella di Tabletop Simulator: il mazzo ha bisogno del
    // percorso vero delle immagini, che si conosce solo per quella (vedi shared/realPath.ts)
    ...(window.api.isWeb ? { destination: 'tts' as const } : {})
  }))
  /** L'obiettivo scelto: il PDF per la stampa in casa o per la tipografia */
  const [goal, setGoal] = useState<ExportGoal>(() =>
    kind === 'pdf' ? (pdf.bleed ? 'shop' : 'home') : kind
  )
  const [realPath, setRealPath] = useState(() =>
    window.api.isWeb && tts.ttsFolder ? readRealPath(tts.ttsFolder) : ''
  )
  const [defaults, setDefaults] = useState({ export: '', tts: '' })
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const { has: hasFont } = useProjectFonts()
  const [credits, setCredits] = useState(false)
  const [enlarged, setEnlarged] = useState<ExportJob | null>(null)
  const [named, setNamed] = useState<NamedProfile[]>(saved.named ?? [])
  const [activeProfile, setActiveProfile] = useState(startProfile?.name ?? '')
  const [naming, setNaming] = useState<string | null>(null)
  /** Il set la cui riga di Tabletop Simulator è stata cambiata per ultima: la sua spiegazione */
  const [ttsFocus, setTtsFocus] = useState<string | null>(null)
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
  const what: KindOptions =
    kind === 'images'
      ? { kind, options: img }
      : kind === 'pdf'
        ? { kind, options: pdf }
        : { kind, options: tts }
  const setNames = project.sets.map((s) => s.name)
  const selected = selectedSets(project, options.sets)
  const patch = (p: Partial<ImageOptions & PdfOptions & TtsOptions>): void => {
    if (kind === 'images') setImg((o) => ({ ...o, ...p }))
    else if (kind === 'pdf') setPdf((o) => ({ ...o, ...p }))
    else setTts((o) => ({ ...o, ...p }))
  }
  const [onlyChanged, setOnlyChanged] = useState(!!changed)
  const changedCount = changed ? selected.reduce((n, s) => n + (changed[s]?.length ?? 0), 0) : 0
  const toggleSet = (name: string): void => {
    const next = selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]
    if (next.length) patch({ sets: next.length === setNames.length ? [] : next })
  }
  const rowsOf = (name: string): number =>
    project.sets.find((s) => s.name === name)?.data?.rows.length ?? 0

  /** Tag TTS del template del set: quelli proposti finché il set non ne ha di suoi */
  const templateTags = (name: string): string => {
    const set = project.sets.find((s) => s.name === name)
    return project.templates.find((x) => x.name === set?.template)?.ttsTags ?? ''
  }
  /** Il tipo di componente del template del set, proposto come oggetto di Tabletop Simulator */
  const componentKind = (name: string): TtsObjectType => {
    const set = project.sets.find((s) => s.name === name)
    return kindOf(project.templates.find((x) => x.name === set?.template))
  }
  /** Almeno un set scelto esce come mazzo di carte: servono le opzioni dei fogli */
  const hasCards = selected.some(
    (name) => ttsSetObject(tts, name, componentKind(name)).type === 'card'
  )

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

  // l'anteprima e la frase seguono le opzioni poco dopo l'ultimo cambio: costruire il lavoro
  // lega tutte le carte, e non serve rifarlo a ogni tasto
  const live = useMemo(
    () => ({ what, language: exportLanguage, onlyChanged }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, img, pdf, tts, exportLanguage, onlyChanged]
  )
  const [stable, setStable] = useState(live)
  useEffect(() => {
    if (stable === live) return
    const timer = setTimeout(() => setStable(live), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [live, stable])
  const pending = stable !== live
  const firstLanguage =
    stable.language === '*' ? (languages[0] ?? null) : stable.language || languages[0] || null
  const job = useMemo(
    () =>
      buildJob(project, stable.what, firstLanguage, changed && stable.onlyChanged ? changed : null),
    [project, stable, firstLanguage, changed]
  )
  const plan = useMemo(() => previewItems(job), [job])
  const summary = useMemo(() => exportSummary(job, plan), [job, plan])
  const [previewIndex, setPreviewIndex] = useState(0)

  /** Profilo scelto: tipo e opzioni nella finestra. Un preset non cambia set e cartella */
  const pickProfile = (p: NamedProfile | null): void => {
    setActiveProfile(p && !presets.some((x) => x.name === p.name) ? p.name : '')
    if (!p) return
    const preset = presets.some((x) => x.name === p.name)
    const keep = <T extends { sets: string[] }>(o: T): Partial<T> =>
      preset ? ({ sets: o.sets, ...('folder' in o ? { folder: o.folder } : {}) } as Partial<T>) : {}
    if (p.kind === 'images') setImg((o) => ({ ...DEFAULT_IMAGE, ...p.options, ...keep(o) }))
    else if (p.kind === 'pdf') setPdf((o) => ({ ...DEFAULT_PDF, ...p.options, ...keep(o) }))
    else setTts((o) => ({ ...DEFAULT_TTS, ...p.options, ...keep(o) }))
    setKind(p.kind)
    setGoal(p.kind === 'pdf' ? ((p.options.bleed ?? DEFAULT_PDF.bleed) ? 'shop' : 'home') : p.kind)
  }
  const presetNamed = (label: MessageKey): NamedProfile | undefined =>
    presets.find((x) => x.name === t(label))
  const chooseGoal = (g: ExportGoal): void => {
    if (g === goal) return
    setGoal(g)
    setActiveProfile('')
    if (g === 'tts' || g === 'images') {
      setKind(g)
      return
    }
    const p = presetNamed(
      g === 'shop' ? 'preset.printShop' : ui === 'en' ? 'preset.homeLetter' : 'preset.homeA4'
    )
    if (p) pickProfile(p)
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

  const run = async (): Promise<void> => {
    setError(null)
    setResult(null)
    setProgress({ done: 0, total: 0 })
    const profiles: ExportProfiles = {
      ...saved,
      images: img,
      pdf,
      tts,
      named: named.length ? named : undefined,
      last: { kind, ...(exportLanguage ? { language: exportLanguage } : {}) }
    }
    try {
      window.api.saveExportProfiles(profiles).catch(() => undefined)
      onProfiles(profiles)
      setResult(
        await runExport(
          project,
          what,
          exportLanguage,
          hasFont,
          changed && onlyChanged ? changed : null
        )
      )
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

  /** "Altro…" scelto tra le risoluzioni: il campo resta anche se il valore è uno di quelli fissi */
  const [customDpi, setCustomDpi] = useState(false)

  const num = (v: string, fallback: number): number => {
    const n = parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : fallback
  }
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
  /** Misura in mm, mostrata e scritta nell'unità scelta nelle impostazioni */
  const mm = (value: number, onChange: (v: number) => void): React.JSX.Element => (
    <>
      <NumInput
        className="num"
        step={unitStep(0.5, lengthUnit)}
        min={0}
        value={toUnit(value, lengthUnit)}
        onChange={(e) => {
          const v = parseFloat(e.target.value.replace(',', '.'))
          onChange(Number.isFinite(v) ? fromUnit(v, lengthUnit) : value)
        }}
      />
      <span className="unit">{UNIT_LABEL[lengthUnit]}</span>
    </>
  )
  /** Una misura per il riassunto: «4 mm» nell'unità scelta */
  const len = (v: number): string =>
    `${toUnit(v, lengthUnit).toLocaleString(ui)} ${UNIT_LABEL[lengthUnit]}`
  const folderField = (
    value: string,
    placeholder: string,
    key: 'folder' | 'ttsFolder'
  ): React.JSX.Element => (
    <span className="export-folder">
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
    </span>
  )
  /** La cartella in breve, per i riassunti: le ultime due parti del percorso */
  const shortFolder = (folder: string): string => {
    if (!folder.trim()) return 'export'
    const parts = folder.split(/[\\/]/).filter(Boolean)
    return parts.length > 2 ? '…/' + parts.slice(-2).join('/') : parts.join('/')
  }
  const sideChoices = [
    { value: 'front' as const, label: t('export.front') },
    { value: 'back' as const, label: t('export.back') },
    { value: 'both' as const, label: t('export.bothSides') }
  ]
  const sideLabel = (s: ImageOptions['sides']): string =>
    sideChoices.find((c) => c.value === s)?.label ?? s

  // ——— le parti comuni: set, copie, lingua ———
  const common = (
    <div className="export-common">
      <div className="export-set-chips" role="group" aria-label={t('export.sets')}>
        {setNames.map((name) => (
          <label
            key={name}
            className={'export-set-chip' + (selected.includes(name) ? ' active' : '')}
          >
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={() => toggleSet(name)}
            />
            {name}
            <span className="muted">{rowsOf(name)}</span>
          </label>
        ))}
      </div>
      <div className="export-common-row">
        {check(options.copies, (copies) => patch({ copies }), 'export.copiesHint')}
        {languages.length > 0 && (
          <label className="export-inline">
            {t('export.language')}
            <select
              value={exportLanguage}
              title={t('export.languageHint')}
              onChange={(e) => setExportLanguage(e.target.value)}
            >
              {languages.map((l) => (
                <option key={l} value={l}>
                  {languageName(l, ui)}
                </option>
              ))}
              <option value="*">{t('export.allLanguages')}</option>
            </select>
          </label>
        )}
        {changed && (
          <label className="check">
            <input
              type="checkbox"
              checked={onlyChanged}
              onChange={(e) => setOnlyChanged(e.target.checked)}
            />
            {t('export.onlyChangedHint', { n: changedCount })}
          </label>
        )}
      </div>
    </div>
  )

  // ——— PDF ———
  let perPage = ''
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
  const foldReason = t('export.notWithFold')
  const bleedChoice = (
    <Choice
      label={t('export.bleed')}
      value={pdf.bleed ? 'on' : 'off'}
      onChange={(v) => patch({ bleed: v === 'on' })}
      options={[
        {
          value: 'off',
          label: t('export.bleedOff'),
          note: t('export.bleedOffNote'),
          icon: 'bleed-off'
        },
        {
          value: 'on',
          label: t('export.bleedOn'),
          note: t('export.bleedOnNote'),
          icon: 'bleed-on'
        }
      ]}
    />
  )
  const pdfOptions = kind === 'pdf' && (
    <>
      <h3 className="export-heading">{t('export.matters')}</h3>
      <Row label={t('export.paper')}>
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
        {pdf.page === 'custom' && (
          <>
            {mm(pdf.pageWidth, (pageWidth) => patch({ pageWidth }))}
            <span className="unit">×</span>
            {mm(pdf.pageHeight, (pageHeight) => patch({ pageHeight }))}
          </>
        )}
        <span className="muted small">{t('export.marginsShort', { v: len(pdf.margin) })}</span>
      </Row>
      {goal === 'shop' && bleedChoice}
      <Choice
        label={t('export.duplex')}
        value={pdf.duplex}
        onChange={(duplex) => patch({ duplex })}
        disabled={pdf.fold}
        reason={foldReason}
        options={[
          { value: 'none', label: t('export.duplexNoneShort'), icon: 'duplex-none' },
          { value: 'long', label: t('export.duplexLongShort'), icon: 'duplex-long' },
          { value: 'short', label: t('export.duplexShortShort'), icon: 'duplex-short' }
        ]}
      />
      {!pdf.fold && pdf.duplex === 'none' && (
        <Choice
          label={t('export.sides')}
          value={pdf.sides}
          options={sideChoices}
          onChange={(sides) => patch({ sides })}
        />
      )}
      {goal === 'shop' && <p className="export-hint">{t('export.shopDuplexHint')}</p>}
      <Choice
        label={t('export.marks')}
        value={pdf.marks}
        onChange={(marks) => patch({ marks })}
        options={[
          { value: 'none', label: t('export.marksNone'), icon: 'marks-none' },
          { value: 'corners', label: t('export.marksCorners'), icon: 'marks-corners' },
          { value: 'lines', label: t('export.marksLines'), icon: 'marks-lines' }
        ]}
      />
      <Section
        id="pdf-layout"
        title={t('export.layoutSection')}
        summary={[
          pdf.fold ? t('export.foldShort') : perPage,
          pdf.layout === 'auto' && !pdf.fold && pdf.autoRotate ? t('export.rotateShort') : '',
          pdf.layout === 'auto' && !pdf.fold && pdf.poster ? t('export.posterShort') : '',
          t('export.marginsShort', { v: len(pdf.margin) })
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <Row label={t('export.margin')}>{mm(pdf.margin, (margin) => patch({ margin }))}</Row>
        <Row label={t('export.layout')} hint={perPage}>
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
              <NumInput
                className="num narrow"
                min={1}
                value={pdf.cols}
                onChange={(e) =>
                  patch({ cols: Math.max(1, Math.round(num(e.target.value, pdf.cols))) })
                }
              />
              <span className="unit">×</span>
              <NumInput
                className="num narrow"
                min={1}
                value={pdf.rows}
                onChange={(e) =>
                  patch({ rows: Math.max(1, Math.round(num(e.target.value, pdf.rows))) })
                }
              />
            </>
          )}
        </Row>
        <Row label={t('export.fold')} hint={pdf.fold ? t('export.foldHint') : undefined}>
          {check(pdf.fold, (fold) => patch({ fold }), 'export.foldPairs')}
        </Row>
        <Row
          label={t('export.rotate')}
          disabled={pdf.fold || pdf.layout === 'fixed'}
          reason={pdf.fold ? foldReason : t('export.onlyAutoLayout')}
        >
          {check(pdf.autoRotate, (autoRotate) => patch({ autoRotate }), 'export.autoRotate')}
        </Row>
        <Row
          label={t('export.poster')}
          hint={t('export.posterHint')}
          disabled={pdf.fold || pdf.layout === 'fixed'}
          reason={pdf.fold ? foldReason : t('export.onlyAutoLayout')}
        >
          {check(pdf.poster, (poster) => patch({ poster }), 'export.posterSplit')}
          {pdf.poster && (
            <>
              <span className="unit">{t('export.posterOverlap')}</span>
              <NumInput
                className="num narrow"
                min={0}
                value={toUnit(pdf.posterOverlap, lengthUnit)}
                onChange={(e) =>
                  patch({
                    posterOverlap: Math.max(
                      0,
                      fromUnit(num(e.target.value, toUnit(10, lengthUnit)), lengthUnit)
                    )
                  })
                }
              />
              <span className="unit">{UNIT_LABEL[lengthUnit]}</span>
            </>
          )}
        </Row>
      </Section>
      <Section
        id="pdf-cut"
        title={t('export.cutSection')}
        summary={[
          pdf.bleed ? t('export.bleedOnShort') : t('export.bleedOffShort'),
          pdf.bleed
            ? t('export.cornersCovered')
            : pdf.rounded
              ? t('export.cornersRounded')
              : t('export.cornersSquare'),
          pdf.marks === 'none'
            ? t('export.marksNoneShort')
            : pdf.marks === 'corners'
              ? t('export.marksShort', { v: len(pdf.markLength) })
              : t('export.marksLinesShort'),
          !pdf.bleed && pdf.spacing > 0 ? t('export.spacingShort', { v: len(pdf.spacing) }) : ''
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        {goal !== 'shop' && (
          <Row label={t('export.bleed')}>
            {check(pdf.bleed, (bleed) => patch({ bleed }), 'export.bleedTouch')}
          </Row>
        )}
        <Row label={t('export.corners')} disabled={pdf.bleed} reason={t('export.bleedCovers')}>
          {check(pdf.rounded, (rounded) => patch({ rounded }), 'export.rounded')}
        </Row>
        <Row label={t('export.spacing')} disabled={pdf.bleed} reason={t('export.bleedTouching')}>
          {mm(pdf.spacing, (spacing) => patch({ spacing }))}
        </Row>
        <Row
          label={t('export.markColor')}
          disabled={pdf.marks === 'none'}
          reason={t('export.noMarks')}
        >
          <ColorSwatch
            value={pdf.markColor}
            title={t('export.markColor')}
            onChange={(markColor) => patch({ markColor })}
          />
        </Row>
        <Row
          label={t('export.markLength')}
          disabled={pdf.marks !== 'corners'}
          reason={t('export.onlyCornerMarks')}
        >
          {mm(pdf.markLength, (markLength) => patch({ markLength }))}
        </Row>
        <Row
          label={t('export.markWidth')}
          disabled={pdf.marks === 'none'}
          reason={t('export.noMarks')}
        >
          {mm(pdf.markWidth, (markWidth) => patch({ markWidth }))}
          {check(pdf.marksOver, (marksOver) => patch({ marksOver }), 'export.marksOver')}
        </Row>
      </Section>
      <Section
        id="pdf-files"
        title={t('export.filesSection')}
        summary={[
          t(
            pdf.split === 'single'
              ? 'export.splitSingleShort'
              : pdf.split === 'set'
                ? 'export.splitSetShort'
                : 'export.splitSideShort'
          ),
          pdf.proof ? t('export.proofShort') : '',
          pdf.cmyk && !window.api.isWeb ? 'CMYK' : '',
          shortFolder(pdf.folder)
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <Row label={t('export.files')}>
          {select(
            pdf.split,
            [
              ['single', t('export.splitSingle')],
              ['set', t('export.splitSet')],
              ['side', t('export.splitSide')]
            ],
            (split) => patch({ split })
          )}
        </Row>
        <Row
          label={t('export.continuous')}
          hint={t('export.continuousHint')}
          disabled={pdf.split === 'set'}
          reason={t('export.notOnePerSet')}
        >
          {check(pdf.continuous, (continuous) => patch({ continuous }), 'export.continuousCheck')}
        </Row>
        <Row
          label={t('export.offset')}
          hint={t('export.offsetHint')}
          disabled={pdf.fold || pdf.duplex === 'none'}
          reason={pdf.fold ? foldReason : t('export.onlyDuplex')}
        >
          <span className="unit">x</span>
          {mm(pdf.offsetX, (offsetX) => patch({ offsetX }))}
          <span className="unit">y</span>
          {mm(pdf.offsetY, (offsetY) => patch({ offsetY }))}
        </Row>
        <Row
          label={t('export.extras')}
          hint={window.api.isWeb ? t('web.pdfHint') : pdf.cmyk ? t('export.cmykHint') : undefined}
        >
          {check(pdf.proof, (proof) => patch({ proof }), 'export.proof')}
          {!window.api.isWeb && check(pdf.cmyk, (cmyk) => patch({ cmyk }), 'export.cmyk')}
        </Row>
        <Row label={t('export.folder')}>{folderField(pdf.folder, defaults.export, 'folder')}</Row>
      </Section>
    </>
  )

  // ——— Immagini ———
  const audience: Audience =
    img.bleed && img.sides === 'both' && img.pattern === AUDIENCE_PATTERN.mpc
      ? 'mpc'
      : img.bleed && img.sides === 'both' && img.pattern === AUDIENCE_PATTERN.tgc
        ? 'tgc'
        : 'generic'
  const chooseAudience = (a: Audience): void => {
    if (a === audience) return
    if (a === 'generic') {
      setImg((o) => ({ ...DEFAULT_IMAGE, sets: o.sets, folder: o.folder, format: o.format }))
      return
    }
    const p = presetNamed(a === 'mpc' ? 'preset.mpc' : 'preset.tgc')
    if (p) pickProfile(p)
  }
  const dpiCustom = customDpi || !DPIS.includes(img.dpi)
  const pixels = firstTemplate
    ? t('export.pixelsBleed', {
        w: Math.round(
          ((firstTemplate.width + (img.bleed ? 2 * firstTemplate.bleed : 0)) * img.dpi) / 25.4
        ),
        h: Math.round(
          ((firstTemplate.height + (img.bleed ? 2 * firstTemplate.bleed : 0)) * img.dpi) / 25.4
        ),
        bleed: img.bleed ? t('export.withBleed') : ''
      }).trim()
    : ''
  const imageOptions = kind === 'images' && (
    <>
      <h3 className="export-heading">{t('export.matters')}</h3>
      <Choice<Audience>
        label={t('export.audience')}
        value={audience}
        onChange={chooseAudience}
        options={[
          { value: 'generic', label: t('export.audienceGeneric') },
          { value: 'mpc', label: 'MakePlayingCards' },
          { value: 'tgc', label: 'The Game Crafter' }
        ]}
      />
      <p className="export-hint">{t(`export.audience.${audience}`)}</p>
      <Row label={t('export.format')}>
        <Choice
          value={img.format}
          onChange={(format) => patch({ format })}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpg', label: 'JPG' },
            { value: 'webp', label: 'WebP' },
            { value: 'svg', label: 'SVG', title: t('export.svgHint') }
          ]}
        />
        {(img.format === 'jpg' || img.format === 'webp') && (
          <>
            <span className="unit">{t('export.quality')}</span>
            <NumInput
              className="num narrow"
              min={1}
              max={100}
              value={img.quality}
              onChange={(e) => patch({ quality: num(e.target.value, img.quality) })}
            />
          </>
        )}
      </Row>
      <Row
        label={t('export.resolution')}
        hint={pixels}
        disabled={img.format === 'svg'}
        reason={t('export.svgNoDpi')}
      >
        <Choice<number>
          value={dpiCustom ? 0 : img.dpi}
          onChange={(dpi) => {
            setCustomDpi(!dpi)
            if (dpi) patch({ dpi })
          }}
          options={[
            ...DPIS.map((d) => ({ value: d, label: String(d) })),
            { value: 0, label: t('export.otherDpi') }
          ]}
        />
        {dpiCustom && (
          <NumInput
            className="num"
            min={30}
            max={1200}
            value={img.dpi}
            onChange={(e) =>
              patch({ dpi: Math.max(30, Math.min(1200, num(e.target.value, img.dpi))) })
            }
          />
        )}
        <span className="unit">DPI</span>
      </Row>
      <Choice
        label={t('export.sides')}
        value={img.sides}
        options={sideChoices}
        onChange={(sides) => patch({ sides })}
      />
      <Section
        id="images-details"
        title={t('export.detailsSection')}
        summary={[
          img.bleed ? t('export.bleedOnShort') : t('export.bleedOffShort'),
          img.transparent && img.format !== 'jpg' && !img.bleed ? t('export.transparentShort') : '',
          img.pattern,
          shortFolder(img.folder)
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <Row label={t('export.bleed')}>
          {check(img.bleed, (bleed) => patch({ bleed }), 'export.bleedInclude')}
        </Row>
        <Row
          label={t('export.background')}
          disabled={img.format === 'jpg' || img.bleed}
          reason={img.format === 'jpg' ? t('export.notJpg') : t('export.bleedCovers')}
        >
          {check(img.transparent, (transparent) => patch({ transparent }), 'export.transparent')}
        </Row>
        <Row label={t('export.pattern')} hint={t('export.patternHint')}>
          <input value={img.pattern} onChange={(e) => patch({ pattern: e.target.value })} />
        </Row>
        <Row label={t('export.folder')}>{folderField(img.folder, defaults.export, 'folder')}</Row>
      </Section>
    </>
  )

  // ——— Tabletop Simulator ———
  const kindOptions: [TtsObjectType, string][] = [
    ['card', t('export.ttsCard')],
    ['token', t('export.ttsToken')],
    ['standee', t('export.ttsStandee')],
    ['tile', t('export.ttsTile')],
    ['board', t('export.ttsBoard')],
    ['die', t('export.ttsDie')]
  ]
  const focusSet = ttsFocus && selected.includes(ttsFocus) ? ttsFocus : selected[0]
  const focusType = focusSet ? ttsSetObject(tts, focusSet, componentKind(focusSet)).type : 'card'
  const deckReason = t('export.onlyDecks')
  const fieldLabel = (f: string): string => f || t('export.noField')
  const ttsOptions = kind === 'tts' && (
    <>
      <div className="tts-table">
        <div className="tts-table-head">
          <span>{t('export.sets')}</span>
          <span>{t('export.ttsObject')}</span>
          <span>{t('export.ttsDetails')}</span>
        </div>
        {selected.map((name) => {
          const obj = ttsSetObject(tts, name, componentKind(name))
          const set = (p: Partial<TtsSetObject>): void => {
            setTtsFocus(name)
            patch({ objects: { ...tts.objects, [name]: { ...obj, ...p } } })
          }
          return (
            <div key={name} className="tts-object" onFocus={() => setTtsFocus(name)}>
              <span className="tts-object-name" title={name}>
                {name} <span className="muted">{rowsOf(name)}</span>
              </span>
              <KindPicker
                value={obj.type}
                options={kindOptions}
                onChange={(type) =>
                  // lo spessore lasciato al valore predefinito segue il nuovo tipo
                  set(
                    obj.thickness === ttsDefaultThickness(obj.type)
                      ? { type, thickness: ttsDefaultThickness(type) }
                      : { type }
                  )
                }
              />
              <span className="tts-object-details">
                {obj.type !== 'card' && obj.type !== 'die' && (
                  <>
                    <NumInput
                      className="num narrow"
                      title={t('export.ttsThickness')}
                      step={unitStep(0.5, lengthUnit)}
                      value={toUnit(obj.thickness, lengthUnit)}
                      onChange={(e) =>
                        set({
                          thickness: Math.max(
                            0.1,
                            Math.min(
                              50,
                              fromUnit(
                                num(e.target.value, toUnit(obj.thickness, lengthUnit)),
                                lengthUnit
                              )
                            )
                          )
                        })
                      }
                    />
                    <span className="unit">{UNIT_LABEL[lengthUnit]}</span>
                  </>
                )}
                {(obj.type === 'tile' || obj.type === 'board') && (
                  <ColorSwatch
                    value={obj.edgeColor}
                    title={t('export.ttsEdge')}
                    onChange={(edgeColor) => set({ edgeColor })}
                  />
                )}
                {obj.type !== 'die' && (
                  <input
                    className="tts-object-tags"
                    placeholder={t('export.ttsTags')}
                    title={t('export.ttsTagsHint')}
                    value={obj.tags ?? templateTags(name)}
                    onChange={(e) => set({ tags: e.target.value })}
                  />
                )}
              </span>
            </div>
          )
        })}
        <p className="export-hint">
          <b>{kindOptions.find(([k]) => k === focusType)?.[1]}</b>:{' '}
          {t(`export.ttsKindHint.${focusType}`)}
        </p>
      </div>
      {window.api.isWeb ? (
        <>
          <Row label={t('web.ttsFolder')} hint={t('web.ttsFolderHint')}>
            {folderField(tts.ttsFolder, defaults.tts, 'ttsFolder')}
          </Row>
          {tts.ttsFolder && (
            <Row label={t('web.ttsRealPath')} hint={t('web.ttsRealPathHint')}>
              <input
                value={realPath}
                placeholder={t('web.ttsRealPathPlaceholder')}
                onChange={(e) => {
                  setRealPath(e.target.value)
                  writeRealPath(tts.ttsFolder, e.target.value)
                }}
              />
            </Row>
          )}
        </>
      ) : (
        <>
          <Choice
            label={t('export.destination')}
            value={tts.destination}
            onChange={(destination) => patch({ destination })}
            options={[
              {
                value: 'project',
                label: t('export.destProjectShort'),
                note: t('export.destProjectNote'),
                icon: 'dest-project'
              },
              {
                value: 'tts',
                label: t('export.destTtsShort'),
                note: t('export.destTtsNote'),
                icon: 'dest-tts'
              },
              {
                value: 'both',
                label: t('export.destBoth'),
                note: t('export.destBothNote'),
                icon: 'dest-both'
              }
            ]}
          />
          {tts.destination !== 'project' && (
            <Row label={t('export.ttsFolder')}>
              {folderField(tts.ttsFolder, defaults.tts, 'ttsFolder')}
            </Row>
          )}
        </>
      )}
      <Section
        id="tts-decks"
        title={t('export.decksSection')}
        summary={[
          hasCards
            ? tts.copies
              ? t(
                  tts.copiesIn === 'deck' ? 'export.copiesInDeckShort' : 'export.copiesInSheetShort'
                )
              : ''
            : t('export.noDecks'),
          hasCards
            ? tts.grid === 'auto'
              ? t('export.gridAutoShort')
              : `${tts.cols} × ${tts.rows}`
            : '',
          hasCards
            ? t(
                tts.back === 'auto'
                  ? 'export.backAutoShort'
                  : tts.back === 'single'
                    ? 'export.backSingleShort'
                    : 'export.backSheetShort'
              )
            : '',
          `${tts.maxSize} px`
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <Row
          label={t('export.copiesIn')}
          disabled={!hasCards || !tts.copies}
          reason={hasCards ? t('export.onlyWithCopies') : deckReason}
        >
          {select(
            tts.copiesIn,
            [
              ['deck', t('export.copiesInDeck')],
              ['sheet', t('export.copiesInSheet')]
            ],
            (copiesIn) => patch({ copiesIn })
          )}
        </Row>
        <Row
          label={t('export.grid')}
          hint={t('export.gridHint')}
          disabled={!hasCards}
          reason={deckReason}
        >
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
              <NumInput
                className="num narrow"
                min={2}
                max={10}
                value={tts.cols}
                onChange={(e) =>
                  patch({
                    cols: Math.max(2, Math.min(10, Math.round(num(e.target.value, tts.cols))))
                  })
                }
              />
              <span className="unit">×</span>
              <NumInput
                className="num narrow"
                min={2}
                max={7}
                value={tts.rows}
                onChange={(e) =>
                  patch({
                    rows: Math.max(2, Math.min(7, Math.round(num(e.target.value, tts.rows))))
                  })
                }
              />
            </>
          )}
        </Row>
        <Row label={t('export.ttsBack')} disabled={!hasCards} reason={deckReason}>
          {select(
            tts.back,
            [
              ['auto', t('export.backAuto')],
              ['single', t('export.backSingle')],
              ['sheet', t('export.backSheet')]
            ],
            (back) => patch({ back })
          )}
        </Row>
        <Row label={t('export.maxSize')}>
          {select<number>(
            tts.maxSize,
            [
              [4096, '4096 px'],
              [8192, '8192 px']
            ],
            (v) => patch({ maxSize: v === 8192 ? 8192 : 4096 })
          )}
        </Row>
      </Section>
      <Section
        id="tts-names"
        title={t('export.namesSection')}
        summary={`Nickname: ${fieldLabel(tts.nickname)} · Description: ${fieldLabel(tts.description)}`}
      >
        <Row label={t('export.nickname')}>
          {select(
            tts.nickname,
            [['', t('export.noField')], ...fieldNames.map((f): [string, string] => [f, f])],
            (nickname) => patch({ nickname })
          )}
        </Row>
        <Row label={t('export.description')}>
          {select(
            tts.description,
            [['', t('export.noField')], ...fieldNames.map((f): [string, string] => [f, f])],
            (description) => patch({ description })
          )}
        </Row>
      </Section>
    </>
  )

  // ——— la frase di riepilogo ———
  const components = t('export.sum.components', { n: summary.components, sets: summary.sets })
  let sentence: string
  let details: string
  if (kind === 'pdf') {
    const pageName = pdf.page === 'custom' ? '' : pdf.page
    sentence = t('export.sum.pdf', {
      what: components,
      pages: summary.pages,
      page: pageName,
      files:
        summary.files === 1 ? t('export.sum.onePdf') : t('export.sum.pdfs', { n: summary.files }),
      folder: shortFolder(pdf.folder)
    }).replace('  ', ' ')
    details = [
      pdf.fold
        ? t('export.foldShort')
        : pdf.duplex === 'none'
          ? t('export.duplexNoneShort').toLowerCase()
          : t(
              pdf.duplex === 'long' ? 'export.duplexLongShort' : 'export.duplexShortShort'
            ).toLowerCase(),
      pdf.marks === 'none'
        ? t('export.marksNoneShort')
        : t('export.marksSum', {
            marks: t(
              pdf.marks === 'corners' ? 'export.marksCorners' : 'export.marksLines'
            ).toLowerCase()
          }),
      t('export.sum.sheets', { n: summary.sheets })
    ].join(' · ')
  } else if (kind === 'images') {
    sentence = t('export.sum.images', {
      what: components,
      n: summary.files,
      format: img.format.toUpperCase(),
      dpi: img.format === 'svg' ? '' : t('export.sum.dpi', { dpi: img.dpi }),
      folder: shortFolder(img.folder)
    }).replace('  ', ' ')
    details = [
      sideLabel(img.sides).toLowerCase(),
      img.bleed ? t('export.bleedOnShort') : t('export.bleedOffShort'),
      audience !== 'generic'
        ? t('export.sum.readyFor', {
            site: audience === 'mpc' ? 'MakePlayingCards' : 'The Game Crafter'
          })
        : ''
    ]
      .filter(Boolean)
      .join(' · ')
  } else {
    const dest =
      tts.destination === 'project'
        ? 'export/tts'
        : tts.destination === 'tts'
          ? 'Saved Objects'
          : t('export.sum.both')
    sentence = t('export.sum.tts', { what: components, n: summary.objects, dest })
    details = t('export.sum.ttsFiles', { images: summary.images, json: summary.objects })
  }

  const blocked = running || !selected.length || (!!changed && onlyChanged && !changedCount)
  return (
    <Dialog title={t('export.title')} onClose={running ? () => undefined : onClose} guide="export">
      <div className="export-dialog">
        <div className="export-goals" role="radiogroup" aria-label={t('export.goal')}>
          {EXPORT_GOALS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={goal === g}
              className={'export-goal' + (goal === g ? ' active' : '')}
              disabled={running}
              onClick={() => chooseGoal(g)}
            >
              <span className="export-goal-title">{t(`export.goal.${g}`)}</span>
              <span className="export-goal-text">{t(`export.goal.${g}.text`)}</span>
            </button>
          ))}
        </div>
        <div className="export-body">
          <div className="export-options">
            {common}
            {pdfOptions}
            {imageOptions}
            {ttsOptions}
          </div>
          <LivePreview
            plan={plan}
            pending={pending}
            index={previewIndex}
            onIndex={setPreviewIndex}
            onEnlarge={() => setEnlarged(job)}
          />
        </div>
        <div className="export-summary" aria-live="polite">
          <p className="export-sentence">{selected.length ? sentence : t('export.noSets')}</p>
          {selected.length > 0 && <p className="muted small">{details}</p>}
          {plan.notes.map((n, i) => (
            <p key={i} className="field-error">
              {t(n)}
            </p>
          ))}
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
            <ResultLinks result={result} />
          </div>
        )}
        <div className="dialog-buttons">
          <button type="button" title={t('credits.hint')} onClick={() => setCredits(true)}>
            {t('credits.open')}
          </button>
          <ProfileMenu
            profiles={named}
            active={activeProfile}
            current={currentProfile}
            naming={naming}
            onNaming={setNaming}
            onPick={pickProfile}
            onChange={saveNamed}
          />
          <span className="spacer" />
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
          <button type="button" className="primary" disabled={blocked} onClick={run}>
            {t('export.run')}
          </button>
        </div>
      </div>
      {credits && <CreditsDialog project={project} onClose={() => setCredits(false)} />}
      {enlarged && (
        <ExportPreview
          job={enlarged}
          start={previewIndex}
          onExport={run}
          onClose={() => setEnlarged(null)}
        />
      )}
    </Dialog>
  )
}
