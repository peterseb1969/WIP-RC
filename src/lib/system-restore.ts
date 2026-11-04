import {
  PLAN_CHANGED,
  RESTORE_REFUSED,
  SALT_MISMATCH,
  wipErrorCode,
  type SystemArchive,
  type SystemRestoreMode,
  type SystemRestoreRecordReport,
  type SystemRestoreReport,
} from '@wip/client'

// The Registry's system backup and restore: every API key (hash only),
// grant, reservation and app attachment. The archive is sensitive (every key
// hash and the runtime-key salt), so the console only ever holds it in
// memory: a download goes straight to a file, and an upload is read, used
// and dropped.

/** Sections of a restore report, in the order shown. */
export const SECTIONS = [
  { key: 'api_keys', label: 'API keys' },
  { key: 'grants', label: 'Grants' },
  { key: 'reservations', label: 'Reservations' },
  { key: 'attachments', label: 'Attachments' },
] as const satisfies ReadonlyArray<{ key: keyof SystemRestoreReport; label: string }>

/** Outcome columns of a section, in the order shown. Each may be absent or empty. */
export const OUTCOMES = [
  { key: 'created', label: 'created' },
  { key: 'replaced', label: 'replaced' },
  { key: 'unchanged', label: 'unchanged' },
  { key: 'skipped', label: 'skipped' },
  { key: 'orphaned', label: 'orphaned' },
  { key: 'unresolved', label: 'upstream not reachable yet' },
  { key: 'deleted', label: 'deleted' },
  { key: 'deactivated', label: 'deactivated' },
] as const satisfies ReadonlyArray<{ key: keyof SystemRestoreRecordReport; label: string }>

export const MODE_HELP: Record<SystemRestoreMode, string> = {
  upsert: 'Create what is missing. Records that exist are left as they are.',
  overwrite: 'Also replace records that differ from the archive.',
  mirror:
    'Also remove what the archive does not hold, so the archive becomes the exact auth state. ' +
    "Records the install's files manage, config-key names, bootstrap grants and the key making the request are kept.",
}

/** The word to type before a mirror is applied. */
export const MIRROR_CONFIRMATION = 'mirror'

/**
 * Read an uploaded file as a system archive, or say why it isn't one. Only
 * the envelope is checked; the Registry validates every record.
 */
export function parseArchive(text: string): { archive: SystemArchive } | { error: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { error: 'The file is not JSON. A system backup is the JSON file the Download button saves.' }
  }
  const a = data as Partial<SystemArchive> | null
  if (!a || typeof a !== 'object' || a.format !== 'wip-system-backup') {
    return { error: 'This is not a WIP system backup (format "wip-system-backup"). Namespace backups are restored on the Restore tab.' }
  }
  if (a.version !== 1) {
    return { error: `This system backup has version ${String(a.version)}; this console reads version 1.` }
  }
  for (const k of ['api_keys', 'grants', 'reservations'] as const) {
    if (!Array.isArray(a[k])) return { error: `The archive has no ${k} list.` }
  }
  return { archive: { ...a, attachments: Array.isArray(a.attachments) ? a.attachments : [] } as SystemArchive }
}

/** A file name for a downloaded archive, e.g. wip-system-backup-localhost-2026-11-04T21-30-00Z.json */
export function archiveFileName(host: string, createdAt: string): string {
  const stamp = createdAt.replace(/\.\d+/, '').replace(/:/g, '-')
  const safeHost = host.replace(/[^a-zA-Z0-9.-]/g, '_') || 'wip'
  return `wip-system-backup-${safeHost}-${stamp}.json`
}

/** What an error from a restore means for the operator, by its code. */
export function restoreErrorMessage(err: unknown): string {
  const code = wipErrorCode(err)
  const detail = err instanceof Error ? err.message : String(err)
  switch (code) {
    case SALT_MISMATCH:
      return 'This stack cannot take the archive\'s key salt, so the archive\'s key hashes would not work here ' +
        '(today: this stack already holds API keys of its own, or the archive carries only the salt\'s fingerprint). ' +
        `Retrying does not help. The Registry said: ${detail}`
    case RESTORE_REFUSED:
      return 'Nothing was written: the restore would remove or replace the key this console authenticates with. ' +
        `See the refused records in the dry run. The Registry said: ${detail}`
    case PLAN_CHANGED:
      return 'Nothing was written: what the mirror would remove has changed since the dry run. Run the dry run again and review it. ' +
        `The Registry said: ${detail}`
    default:
      return detail
  }
}

/** The ids listed under one outcome of a section (skipped entries by their id). */
export function outcomeIds(section: SystemRestoreRecordReport | undefined, outcome: (typeof OUTCOMES)[number]['key']): string[] {
  const v = section?.[outcome]
  if (!v) return []
  return (v as Array<string | { id: string }>).map(x => (typeof x === 'string' ? x : x.id))
}

/** Whether a dry run's plan may be applied: no refusals. */
export function canApply(report: SystemRestoreReport): boolean {
  return !report.refused || report.refused.length === 0
}
