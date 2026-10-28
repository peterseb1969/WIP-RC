import type { RehashIdentitiesItem, RehashIdentitiesResponse } from '@wip/client'

/** What a rehash request was scoped to: the namespace and the (possibly empty) template filter. */
export interface RehashScope {
  namespace: string
  /** Template values; empty means every template in the namespace. */
  templates: readonly string[]
}

/**
 * Whether a preview was run for the scope now in the form. The template order is
 * irrelevant. An apply recomputes the pass, so applying on a scope the preview
 * never covered would change documents nobody looked at.
 */
export function previewIsCurrent(previewed: RehashScope | null, form: RehashScope): boolean {
  if (!previewed || previewed.namespace !== form.namespace) return false
  const a = [...previewed.templates].sort()
  const b = [...form.templates].sort()
  return a.length === b.length && a.every((t, i) => t === b[i])
}

/**
 * Why Apply is not available, or null when it is. Needs a preview of the
 * current scope that found something to change.
 */
export function applyBlockReason(
  preview: Pick<RehashIdentitiesResponse, 'dry_run' | 'changed'> | null,
  current: boolean,
): string | null {
  if (!preview || !preview.dry_run) return 'Run a preview first.'
  if (!current) return 'The namespace or template filter changed since the preview. Run it again.'
  if (preview.changed === 0) return 'The preview found nothing to change.'
  return null
}

export type RegistryOutcome = 'none' | 'ok' | 'failed'

// The Registry's re-key endpoint answers each entry with one of: rekeyed,
// unchanged, not_found, conflict, error. Document-store passes that through and
// adds "missing" (no result for the document) or "error: <message>" (the call
// failed). Only the first two mean the Registry now holds the new identity.
const REKEY_OK = new Set(['rekeyed', 'unchanged'])

/**
 * How one item's Registry re-key went. `none`: no re-key was attempted (a dry
 * run, or a document the pass did not apply). `ok`: the Registry re-keyed the
 * entry or already held that identity. `failed`: anything else — not_found,
 * conflict, missing, an error, or a status this code does not know. An
 * allowlist of successes, so a new failure status is never shown as success.
 */
export function registryOutcome(item: Pick<RehashIdentitiesItem, 'registry_status'>): RegistryOutcome {
  const s = item.registry_status
  if (s === null || s === undefined) return 'none'
  return REKEY_OK.has(s.trim().toLowerCase()) ? 'ok' : 'failed'
}

export interface RegistrySummary {
  /** One row per distinct registry_status among items that were re-keyed, most common first. */
  byStatus: Array<{ status: string; count: number; failed: boolean }>
  /** Items the Registry re-key failed for. */
  failed: number
  /** Items a re-key was attempted for. */
  attempted: number
}

/** Counts of Registry outcomes across the items of an applied pass. */
export function summarizeRegistry(items: ReadonlyArray<Pick<RehashIdentitiesItem, 'registry_status'>>): RegistrySummary {
  const counts = new Map<string, number>()
  let failed = 0
  let attempted = 0
  for (const item of items) {
    const outcome = registryOutcome(item)
    if (outcome === 'none') continue
    attempted++
    if (outcome === 'failed') failed++
    const status = item.registry_status as string
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }
  const byStatus = [...counts.entries()]
    .map(([status, count]) => ({ status, count, failed: registryOutcome({ registry_status: status }) === 'failed' }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status))
  return { byStatus, failed, attempted }
}

/** A hash cut to its first 8 characters for tables; a dash when there is none. */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return '—'
  return hash.length > 8 ? `${hash.slice(0, 8)}…` : hash
}
