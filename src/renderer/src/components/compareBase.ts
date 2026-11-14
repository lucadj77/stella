import type { BackupItem } from '../../../shared/api'
import type { ExportCard } from '../../../shared/export'
import { cardFingerprints } from '../../../shared/model/compare'
import type { LoadedProject, PrintedState, ProjectVersion } from '../../../shared/project'
import type { Translate } from '../i18n/context'

// Le versioni del progetto con cui confrontare quella di adesso: l'ultima esportazione (solo le
// impronte delle carte) o un backup (il progetto intero, per vedere com'era ogni carta).

/** Versione con cui confrontare: le impronte delle sue carte, per set */
export interface CompareBase {
  label: string
  before: Record<string, string[]>
  /** Il progetto com'era, per mostrare le carte di prima: c'è solo per i backup */
  version?: ProjectVersion
}

/** Le versioni con cui si può confrontare: l'ultima esportazione e i backup, dal più recente */
export interface CompareSources {
  printed: PrintedState | null
  backups: BackupItem[]
}

export async function readCompareSources(): Promise<CompareSources> {
  const [printed, backups] = await Promise.all([
    window.api.readPrinted().catch(() => null),
    window.api
      .backups()
      .then((s) => s.items)
      .catch(() => [] as BackupItem[])
  ])
  return { printed, backups }
}

/** `choice`: 'printed' o il file di un backup */
export async function readCompareBase(
  choice: string,
  sources: CompareSources,
  project: LoadedProject,
  t: Translate,
  when: (ms: number) => string
): Promise<CompareBase | null> {
  if (choice === 'printed' && sources.printed)
    return {
      label: t('compare.sincePrinted', { date: when(sources.printed.date) }),
      before: sources.printed.sets
    }
  const item = sources.backups.find((b) => b.file === choice)
  if (!item) return null
  const version = await window.api.backupVersion(item.file)
  return {
    label: t('compare.sinceBackup', { date: when(item.date) }),
    before: cardFingerprints(version, project.assets),
    version
  }
}

/**
 * Il componente di prima di ogni componente di adesso: la stessa riga se ha lo stesso nome, se
 * no un componente con quel nome, se no la stessa riga
 */
export function pairBefore(now: ExportCard[], before: ExportCard[]): Map<number, ExportCard> {
  const out = new Map<number, ExportCard>()
  const used = new Set<ExportCard>()
  for (const c of now) {
    const row = before.find((b) => !used.has(b) && b.n === c.n)
    // la stessa riga se ha ancora lo stesso nome; se no la carta con quel nome, spostata
    const named =
      row && row.label === c.label
        ? row
        : c.label
          ? before.find((b) => !used.has(b) && b.label === c.label)
          : undefined
    const same = named ?? row
    if (same) {
      used.add(same)
      out.set(c.n, same)
    }
  }
  return out
}
