import type { LoadedSet } from '../project'
import { usesRandom } from './formula'
import { isRandomSpec } from './generate'
import { TEMPLATE_COLUMN } from './inherit'
import type { Template } from './template'

// Il caso nei set: un set usa numeri a caso se le sue formule (nel template o nelle celle) usano
// RAND, RANDBETWEEN, DEAL o {cell.random}, o se le sue righe vengono da una generazione a caso.
// Il seme del set (SetDefinition.seed) li rende ripetibili; Rigenera ne sceglie un altro.

/** Il set ha numeri a caso che un altro seme cambierebbe */
export function setUsesRandom(
  set: Pick<LoadedSet, 'template' | 'data' | 'generator'>,
  templates: Template[]
): boolean {
  if (set.generator && isRandomSpec(set.generator.spec)) return true
  const names = new Set([set.template])
  const col = set.data?.headers.indexOf(TEMPLATE_COLUMN) ?? -1
  if (col >= 0) for (const r of set.data?.rows ?? []) if (r[col]?.trim()) names.add(r[col].trim())
  for (const t of templates) if (names.has(t.name) && usesRandom(JSON.stringify(t))) return true
  return !!set.data?.rows.some((r) => r.some((v) => v.includes('(') && usesRandom(v)))
}

/** Un seme nuovo, da 1 a 999999 */
export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * 999999)
}
