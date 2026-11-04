import type { ProjectMeta } from '../../../shared/model/system'
import { useMemo } from 'react'
import type { LoadedSet } from '../../../shared/project'
import type { Template } from '../../../shared/model/template'
import { bindRow } from '../../../shared/model/bind'
import { systemOfSet } from '../../../shared/model/system'
import { findCard, isMessage, parseCardRef, type CardRef } from '../../../shared/model/document'
import { useBindContext } from './assets'

/** La carta del riferimento, con i dati della sua riga, o null se non si trova */
export function useBoundCard(
  src: string,
  sets: LoadedSet[],
  templates: Template[],
  project?: string | ProjectMeta
): { ref: CardRef; template: Template } | null {
  const bindCtx = useBindContext()
  return useMemo(() => {
    const ref = parseCardRef(src)
    if (isMessage(ref)) return null
    const found = findCard(ref, sets)
    if (isMessage(found)) return null
    const { set, row } = found
    const template = templates.find((x) => x.name === set.template)
    if (!set.data || !template) return null
    const bound = bindRow(set.data.headers, set.data.rows[row], template, templates, {
      ...bindCtx,
      system: { ...systemOfSet(project ?? '', set), number: row + 1 }
    })
    return { ref, template: bound.template }
  }, [src, sets, templates, bindCtx, project])
}
