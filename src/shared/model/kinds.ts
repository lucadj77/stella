import type { CardShape, ComponentKind } from './template'

// Formati proposti per ogni tipo di componente quando si crea un template. Misure in mm.

export interface KindPreset {
  /** Chiave del nome: format.<key> */
  key: string
  width: number
  height: number
  shape?: CardShape
}

export const KIND_PRESETS: Record<ComponentKind, KindPreset[]> = {
  card: [
    { key: 'poker', width: 63, height: 88 },
    { key: 'bridge', width: 56, height: 87 },
    { key: 'miniEuro', width: 44, height: 68 },
    { key: 'miniUs', width: 41, height: 63 },
    { key: 'tarot', width: 70, height: 120 },
    { key: 'square', width: 70, height: 70 },
    { key: 'a6', width: 105, height: 148 }
  ],
  token: [
    { key: 'round25', width: 25, height: 25, shape: 'ellipse' },
    { key: 'round20', width: 20, height: 20, shape: 'ellipse' },
    { key: 'round38', width: 38, height: 38, shape: 'ellipse' },
    { key: 'square25', width: 25, height: 25 }
  ],
  tile: [
    { key: 'square50', width: 50, height: 50 },
    { key: 'square70', width: 70, height: 70 },
    { key: 'hex50', width: 50, height: 43.3, shape: 'hexagon' },
    { key: 'hex80', width: 80, height: 69.3, shape: 'hexagon' }
  ],
  board: [
    { key: 'board300', width: 300, height: 300 },
    { key: 'a3', width: 420, height: 297 },
    { key: 'a4', width: 297, height: 210 },
    { key: 'board500', width: 500, height: 500 }
  ],
  die: [
    { key: 'face16', width: 16, height: 16 },
    { key: 'face19', width: 19, height: 19 },
    { key: 'face25', width: 25, height: 25 }
  ]
}

/** Raggio degli angoli di base: le carte arrotondate, le plance e i dadi quasi dritti */
export const KIND_CORNER: Record<ComponentKind, number> = {
  card: 3,
  token: 0,
  tile: 0,
  board: 0,
  die: 1
}
