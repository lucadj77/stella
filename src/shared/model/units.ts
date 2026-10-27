// Unità di misura delle lunghezze mostrate nell'interfaccia. Il modello resta sempre in
// millimetri: l'unità scelta cambia solo i numeri che si leggono e si scrivono nei campi.

export type LengthUnit = 'mm' | 'cm' | 'in'
export const LENGTH_UNITS: LengthUnit[] = ['mm', 'cm', 'in']
export const isLengthUnit = (v: unknown): v is LengthUnit =>
  typeof v === 'string' && (LENGTH_UNITS as string[]).includes(v)

/** Millimetri in un'unità */
export const MM_PER_UNIT: Record<LengthUnit, number> = { mm: 1, cm: 10, in: 25.4 }

/** Sigla mostrata accanto ai numeri */
export const UNIT_LABEL: Record<LengthUnit, string> = { mm: 'mm', cm: 'cm', in: 'in' }

/** Decimali sensati per unità: un decimo di mm, un centesimo di cm, un millesimo di pollice */
const DECIMALS: Record<LengthUnit, number> = { mm: 2, cm: 3, in: 3 }

export function toUnit(mm: number, unit: LengthUnit): number {
  const k = 10 ** DECIMALS[unit]
  return Math.round((mm / MM_PER_UNIT[unit]) * k) / k
}

export function fromUnit(value: number, unit: LengthUnit): number {
  return value * MM_PER_UNIT[unit]
}

/** Una misura in mm scritta nell'unità scelta, come "6,3 cm" o "2.48 in" */
export function formatLength(mm: number, unit: LengthUnit, lang = 'en'): string {
  return `${toUnit(mm, unit).toLocaleString(lang, { maximumFractionDigits: DECIMALS[unit] })} ${UNIT_LABEL[unit]}`
}

const NICE = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]

/** Passo dei campi nell'unità scelta, vicino a quello in mm e con un valore tondo */
export function unitStep(stepMm: number, unit: LengthUnit): number {
  const v = stepMm / MM_PER_UNIT[unit]
  return NICE.find((n) => n >= v * 0.75) ?? v
}
