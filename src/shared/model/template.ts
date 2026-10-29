// Modello dei template: vedi docs/specifica.md, sezioni 1-5 e 8.1.
// Unità: millimetri per posizioni e dimensioni, punti per il testo, gradi per la rotazione.

export type Side = 'front' | 'back'

export type HAlign = 'left' | 'center' | 'right' | 'justify'
export type VAlign = 'top' | 'middle' | 'bottom'
export type Anchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'

export interface Stroke {
  color: string
  /** Spessore in mm, oppure in % della dimensione del testo (solo testo) se termina con % */
  width: number | string
  /** Tratteggio; assente vuol dire linea continua */
  dash?: 'dashed' | 'dotted'
}

/**
 * Dissolvenza dell'opacità: il livello passa da un'opacità all'altra lungo una direzione
 * (lineare) o dal centro verso i bordi (radiale). Opacità e posizioni sono 0-1.
 */
export interface Fade {
  kind: 'linear' | 'radial'
  /** Gradi come nelle sfumature: 180 va dall'alto verso il basso */
  angle: number
  from: number
  to: number
  start: number
  end: number
}

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay'

/**
 * Come segue il livello un cambio di formato del template ("lascia i livelli"): resta fermo a
 * sinistra o in alto, segue il lato opposto, resta centrato, si allunga con la carta, o scala.
 */
export interface Constraints {
  h: 'left' | 'right' | 'center' | 'both' | 'scale'
  v: 'top' | 'bottom' | 'center' | 'both' | 'scale'
}

export interface Shadow {
  color: string
  blur: number
  dx: number
  dy: number
}

/**
 * Da dove arriva il valore principale del livello sulle carte: una colonna del foglio
 * (di base quella con il nome del livello), il valore fisso del template o una formula.
 */
export type ValueSource =
  { kind: 'column'; column: string | null } | { kind: 'fixed' } | { kind: 'formula'; expr: string }

export interface LayerBase {
  id: string
  /** Univoco nel template: è anche il nome della colonna nel foglio */
  name: string
  visible: boolean
  locked: boolean
  x: number
  y: number
  w: number
  h: number
  rotation: number
  anchor: Anchor
  opacity: number
  /** Fusione con ciò che sta sotto */
  blend: BlendMode
  fade: Fade | null
  shadow: Shadow | null
  constraints: Constraints
  /** Proprietà esposte in tabella oltre al valore principale */
  exposed: string[]
  source: ValueSource
  /**
   * Snap point di Tabletop Simulator al centro del livello (in ogni casella per le griglie);
   * assente o null: nessuno
   */
  snap?: LayerSnap | null
}

/** Snap point di un livello, esportato in Tabletop Simulator */
export interface LayerSnap {
  /** Tag separati da virgole, anche con {campi}: il punto attira solo gli oggetti con un tag uguale */
  tags: string
  /** Il punto dà anche la rotazione all'oggetto che vi si aggancia */
  rotated: boolean
  /** Angolo in gradi in senso orario; null segue la rotazione del livello */
  angle: number | null
}

export interface TextLayer extends LayerBase {
  type: 'text'
  text: string
  style: string | null
  font: string
  weight: number
  italic: boolean
  size: number
  color: string
  align: HAlign
  valign: VAlign
  lineHeight: number
  letterSpacing: number
  paragraphSpacing: number
  /** Rientro della prima riga di ogni paragrafo, in mm */
  indent: number
  padding: number
  /** Margini interni diversi per lato (alto, destra, basso, sinistra); null usa padding */
  paddingSides: [number, number, number, number] | null
  transform: 'none' | 'upper' | 'lower' | 'capitalize'
  stroke: Stroke | null
  fit: 'none' | 'shrink' | 'truncate'
  minSize: number
  underline: boolean
  strike: boolean
  /** A capo automatico; senza, ogni paragrafo resta su una riga */
  wrap: boolean
  /**
   * Testo nelle altre lingue del progetto (lingua → testo), per i livelli con fonte fissa: una
   * lingua che manca o un testo vuoto usano `text`. Vedi model/language.ts
   */
  texts?: Record<string, string>
}

/** Parte dell'immagine da usare, in frazioni (0-1) del file: vedi crop.ts */
export interface Crop {
  x: number
  y: number
  w: number
  h: number
}

export interface ImageLayer extends LayerBase {
  type: 'image'
  src: string
  /** overflow: come cover, ma la parte che esce dal riquadro resta visibile */
  fit: 'cover' | 'overflow' | 'contain' | 'stretch' | 'original' | 'tile'
  /** Ritaglio dell'immagine prima dell'adattamento; null per l'immagine intera */
  crop: Crop | null
  /** Dove sta l'immagine nel riquadro quando non lo riempie o lo eccede */
  align: Anchor
  /** Scala dell'immagine rispetto all'adattamento, intorno al centro: 1 = 100% */
  zoom: number
  /** Rotazione dell'immagine dentro il riquadro, in gradi; il riquadro non ruota */
  imageRotation: number
  /** Spostamento dell'immagine nel riquadro, in mm */
  offsetX: number
  offsetY: number
  flipH: boolean
  flipV: boolean
  tint: string | null
  /** Regolazioni: 1 = invariato */
  grayscale: boolean
  brightness: number
  contrast: number
  saturation: number
  radius: number
  stroke: Stroke | null
  missing: 'placeholder' | 'hide'
  /**
   * Sfondo della variabile immagine scritta come sorgente (model/shapes.ts): c'è solo nelle carte
   * legate ai dati, non si salva nel template
   */
  backdrop?: { shape?: string; src?: string; color: string | null; pad: number }
}

export type ShapeKind = 'rect' | 'ellipse' | 'polygon' | 'star' | 'line' | 'path'

export interface ShapeLayer extends LayerBase {
  type: 'shape'
  shape: ShapeKind
  /** Colore, variabile colore o sfumatura (linear-gradient(...), radial-gradient(...)) */
  fill: string | null
  stroke: Stroke | null
  radius: number
  sides: number
  innerRatio: number
  /** Tracciato SVG in coordinate 0-1 rispetto al riquadro, per shape = 'path' */
  path: string
}

/** Forma delle caselle di una griglia */
export type GridCell = 'square' | 'circle' | 'hex' | 'triangle' | 'diamond' | 'path'

/**
 * Griglia di caselle uguali (una plancia, un tracciato a punti, una mappa a esagoni), disegnata
 * dentro il riquadro: a zoom 100% la griglia più grande che ci sta senza deformare le caselle.
 * Vedi model/grid.ts.
 */
export interface GridLayer extends LayerBase {
  type: 'grid'
  cell: GridCell
  rows: number
  columns: number
  /** Larghezza della casella rispetto all'altezza (quadrata, tonda, rombo): 1 = uguali */
  cellRatio: number
  /** Esagoni con la punta in alto (pointy) o con un lato in alto (flat) */
  orientation: 'pointy' | 'flat'
  /**
   * Rotazione della forma di ogni casella intorno al suo centro, in gradi: gira solo il contorno,
   * non il posto delle caselle né il loro contenuto
   */
  cellRotation: number
  /** Forma delle caselle per cell = 'path': tracciato SVG in coordinate 0-1 della casella */
  cellPath: string
  /**
   * Caselle a incastro: esagoni ad alveare, cerchi e quadrati sfalsati di mezza casella, triangoli
   * alternati, rombi che si toccano sui lati
   */
  interlock: boolean
  /** Spazio tra le caselle in mm */
  gap: number
  /** Spazio tra le caselle e il bordo della griglia, in mm */
  padding: number
  /** Misura: 1 (100%) riempie il riquadro, meno la rimpicciolisce, di più la ingrandisce */
  zoom: number
  /** Posizione della griglia nel riquadro quando non lo riempie */
  alignX: LayoutAlign
  alignY: LayoutAlign
  /** Taglia ciò che esce dal riquadro */
  clip: boolean
  /** Raggio degli angoli delle caselle in mm (non per i cerchi) */
  radius: number
  /** Riempimento e contorno delle caselle */
  fill: string | null
  stroke: Stroke | null
  /** Sfondo della griglia, dietro e tra le caselle, e il suo bordo */
  background: string | null
  border: Stroke | null
  /** Raggio degli angoli dello sfondo in mm */
  backgroundRadius: number
  /**
   * Nome di un gruppo dello stesso lato che si ripete in ogni casella: disegnato com'è nella
   * prima, spostato nelle altre. Dentro valgono {cell.index}, {cell.row}, {cell.column},
   * {cell.count} e {cell.random}. Vuoto: caselle vuote
   */
  content: string
  /** Solo sulla carta disegnata: il gruppo del contenuto legato a ogni casella, in ordine */
  cells?: GroupLayer[]
  /**
   * Regole delle caselle, in ordine: dove la condizione è vera la casella cambia riempimento,
   * contorno, raggio o si nasconde. Una regola dopo prevale su una prima
   */
  cellRules: CellRule[]
  /** Solo sulla carta disegnata: l'aspetto di ogni casella dopo le regole, in ordine */
  looks?: CellLook[]
}

/**
 * Una regola delle caselle di una griglia. Le proprietà assenti restano come le dà la griglia
 * (o una regola prima); null toglie il riempimento o il contorno
 */
export interface CellRule {
  /** Condizione, una formula con {cell.index}, {cell.row}, {cell.column} e i campi della carta */
  when: string
  fill?: string | null
  stroke?: Stroke | null
  radius?: number
  /** La casella non si disegna, né il suo contenuto né il suo snap point */
  hidden?: boolean
}

/** Come si disegna una casella sulla carta */
export interface CellLook {
  fill: string | null
  stroke: Stroke | null
  radius: number
  hidden: boolean
}

export type GroupLayout = 'none' | 'row' | 'column' | 'grid'
export type LayoutAlign = 'start' | 'center' | 'end'

export interface GroupLayer extends LayerBase {
  type: 'group'
  clip: boolean
  children: Layer[]
  /** Disposizione automatica dei figli dentro il riquadro del gruppo */
  layout: GroupLayout
  /** Spazio tra i figli in mm */
  gap: number
  /** Colonne della griglia */
  columns: number
  /** Posizione del contenuto nel riquadro, lungo la riga o la colonna */
  justify: LayoutAlign
  /** Allineamento di ciascun figlio nell'altra direzione */
  alignItems: LayoutAlign
  /** Quante volte ripetere i figli: un numero o un campo, come {forza} */
  repeat: string
}

/**
 * Valore della carta senza rappresentazione: non si disegna, ma il suo risultato si può usare
 * come {nome} nelle formule e nei testi degli altri livelli.
 */
export interface ValueLayer extends LayerBase {
  type: 'value'
  value: string
  /** Valore nelle altre lingue (lingua → valore), con fonte fissa; come `texts` dei testi */
  values?: Record<string, string>
}

/**
 * Snap point di Tabletop Simulator in un punto qualsiasi: nell'editor è un mirino, nelle stampe
 * e nelle immagini non si vede. Il punto è il centro del riquadro; `snap` c'è sempre.
 */
export interface SnapLayer extends LayerBase {
  type: 'snap'
}

export type Layer =
  TextLayer | ImageLayer | ShapeLayer | GridLayer | GroupLayer | ValueLayer | SnapLayer
export type LayerType = Layer['type']

export type CardShape = 'rect' | 'ellipse' | 'hexagon' | 'path'
export type ShapeRotation = 0 | 90 | 180 | 270
export const isShapeRotation = (v: unknown): v is ShapeRotation =>
  v === 0 || v === 90 || v === 180 || v === 270

/**
 * Tipo di componente disegnato dal template: cambia le parole dell'interfaccia (una faccia di dado,
 * un segnalino) e l'oggetto proposto in Tabletop Simulator. Assente vale carta.
 */
export type ComponentKind = 'card' | 'token' | 'tile' | 'board' | 'die' | 'standee'
export const COMPONENT_KINDS: ComponentKind[] = ['card', 'token', 'tile', 'board', 'die', 'standee']
export const isComponentKind = (v: unknown): v is ComponentKind =>
  typeof v === 'string' && (COMPONENT_KINDS as string[]).includes(v)
/** Il tipo di un template, carta se non è indicato */
export const kindOf = (t: Pick<Template, 'kind'> | null | undefined): ComponentKind =>
  t?.kind ?? 'card'
/**
 * Pedina: una sagoma da tenere in piedi, su fondo trasparente. Il retro non si disegna: è il
 * fronte specchiato, così stampando le due facce, ritagliandole e incollandole combaciano
 */
export const isStandee = (t: Pick<Template, 'kind'> | null | undefined): boolean =>
  kindOf(t) === 'standee'

export interface ManualGuides {
  x: number[]
  y: number[]
}

export interface Template {
  name: string
  /** Nome del file in templates/ senza estensione, se diverso dal nome; non si salva */
  file?: string
  /** File in templates/ prima di una rinomina non ancora salvata; non si salva */
  origin?: string
  /** Tipo di componente; assente vale carta */
  kind?: ComponentKind
  width: number
  height: number
  bleed: number
  safeMargin: number
  cornerRadius: number
  /** Forma della carta rifilata; assente vale rettangolo (con cornerRadius) */
  shape?: CardShape
  /** Contorno per shape = 'path': tracciato SVG in coordinate 0-1 rispetto alla carta */
  shapePath?: string
  /**
   * Rotazione della forma in gradi (0, 90, 180, 270): ruota solo il contorno, non il contenuto.
   * Con 90 e 270 la forma è disegnata nel riquadro con i lati scambiati e poi girata: l'editor
   * scambia anche larghezza e altezza della carta, così un esagono con un lato in alto diventa
   * con la punta in alto. Assente vale 0
   */
  shapeRotation?: ShapeRotation
  /** Forma specchiata in orizzontale o in verticale, dopo la rotazione; solo il contorno */
  shapeFlipH?: boolean
  shapeFlipV?: boolean
  /** Guide manuali dell'editor in mm: linee verticali (x) e orizzontali (y) */
  guides?: ManualGuides
  /** Campo che dà il nome alle carte nelle anteprime dei set; null usa la prima colonna */
  labelField?: string | null
  /** Tag di Tabletop Simulator, separati da virgole, anche con {campi} */
  ttsTags?: string
  front: Layer[]
  back: Layer[]
  /**
   * Template derivato: nome del template base. front e back sono allora il risultato della
   * risoluzione (base più `changes`), e nel file si scrivono solo le differenze.
   */
  extends?: string
  changes?: TemplateChanges
}

/** Proprietà del template che un derivato può cambiare; le misure della carta no */
export const INHERITABLE_TEMPLATE_KEYS = [
  'kind',
  'bleed',
  'safeMargin',
  'cornerRadius',
  'shape',
  'shapePath',
  'shapeRotation',
  'shapeFlipH',
  'shapeFlipV',
  'guides',
  'labelField',
  'ttsTags'
] as const
export type InheritableTemplateKey = (typeof INHERITABLE_TEMPLATE_KEYS)[number]

/** Livello che esiste solo nel derivato, con il posto in cui si inserisce tra quelli del base */
export interface AddedLayer {
  side: Side
  /** Gruppo ereditato che lo contiene; assente: al primo livello del lato */
  parent?: string
  /** Livello dopo il quale viene nella lista (cioè subito sotto); assente: in cima */
  after?: string
  layer: Layer
}

/** Differenze di un template derivato dal suo base */
export interface TemplateChanges {
  template?: Partial<Pick<Template, InheritableTemplateKey>>
  /** Nome del livello del base → proprietà cambiate, ognuna sostituita per intero */
  layers?: Record<string, Record<string, unknown>>
  added?: AddedLayer[]
}

/** Valore principale di ogni tipo di livello: è la colonna che porta il nome del livello */
export const PRIMARY_PROPERTY: Record<LayerType, string> = {
  text: 'text',
  image: 'src',
  shape: 'fill',
  grid: 'fill',
  group: 'visible',
  value: 'value',
  snap: 'visible'
}

/** I livelli valore non hanno riquadro: non si disegnano, non si selezionano sulla carta */
export const isDrawn = (l: Layer): boolean => l.type !== 'value'
