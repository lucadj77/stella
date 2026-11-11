// Anteprima per chi vede i colori in modo diverso: le matrici dei filtri SVG applicati alle
// carte del set (griglia, anteprima e carta grande). Le matrici sono quelle di Machado, Oliveira e Fernandes
// (2009) a gravità piena, in RGB lineare; il grigio usa la luminanza di Rec. 709.

export type Vision = 'normal' | 'protan' | 'deutan' | 'tritan' | 'gray'

export const VISIONS: Vision[] = ['normal', 'protan', 'deutan', 'tritan', 'gray']

export const VISION_MATRICES: Record<Exclude<Vision, 'normal'>, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998]
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881]
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039]
  ],
  gray: [
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722],
    [0.2126, 0.7152, 0.0722]
  ]
}

/** I valori di feColorMatrix: tre righe dei colori, la trasparenza resta com'è */
export function visionMatrix(v: Exclude<Vision, 'normal'>): string {
  return [...VISION_MATRICES[v].map((r) => [...r, 0, 0]), [0, 0, 0, 1, 0]]
    .map((r) => r.join(' '))
    .join('  ')
}
