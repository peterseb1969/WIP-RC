import type { ReportingConfig } from '@wip/client'

// CASE-720: the backend accepts and persists these two template surfaces, but
// @wip/client 0.36.0 does not type them. Delete this file and the casts at its
// call sites when a client bump adds them.
//
// cross_version_view (CASE-716 item 5) upgrades an entity's bare-name view from
// identity-core to a mapped cross-version view. `columns` maps a target column
// to its source: {"from": "<source field>"} or {} for identity passthrough.
// renames ({new_field: old_field}, CASE-711) tells a version-creating upsert
// that a field was renamed rather than dropped-and-added.

export type CrossVersionViewVersions = 'all' | number[]

export interface CrossVersionViewColumn {
  from?: string
}

export interface CrossVersionViewConfig {
  versions: CrossVersionViewVersions
  columns: Record<string, CrossVersionViewColumn>
}

export type ReportingConfigWithCvv = ReportingConfig & {
  cross_version_view?: CrossVersionViewConfig | null
}

/** Reads the untyped field off a template's reporting block. */
export function readCrossVersionView(
  reporting: ReportingConfig | null | undefined,
): CrossVersionViewConfig | null {
  const cvv = (reporting as ReportingConfigWithCvv | null | undefined)?.cross_version_view
  return cvv ?? null
}

/** `all` | comma-separated ints → the wire form; invalid input yields null. */
export function parseVersionsInput(raw: string): CrossVersionViewVersions | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.toLowerCase() === 'all') return 'all'
  const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean)
  const nums = parts.map(Number)
  if (nums.length === 0 || nums.some(n => !Number.isInteger(n) || n < 1)) return null
  return nums
}

export function formatVersionsInput(v: CrossVersionViewVersions | undefined): string {
  if (!v || v === 'all') return 'all'
  return v.join(', ')
}

// ---------------------------------------------------------------------------
// Version-event impact (CASE-711 / CASE-722)
//
// A template write that mints a new version reports what it affects:
// live-doc counts and whether the change is migration-eligible. Advisory by
// design — the platform never blocks a write on it, and `status: unavailable`
// (document-store unreachable) must render as "unknown", never as zero.
// Untyped in @wip/client's BulkResultItem.details — see CASE-720.
// ---------------------------------------------------------------------------

export interface VersionImpact {
  status: 'ok' | 'unavailable' | string
  total_live_docs?: number
  docs_per_version?: Record<string, number>
  field_nonempty_counts?: Record<string, number>
  error?: string
  reason?: string
}

export interface VersionMigration {
  eligible: boolean | null
  reason?: string
  via?: string
}

export interface VersionEventDetails {
  added_optional?: string[]
  added_required?: string[]
  removed?: string[]
  changed_type?: string[]
  made_required?: string[]
  modified_existing?: string[]
  identity_changed?: boolean | null
  impact?: VersionImpact | 'unavailable' | null
  migration?: VersionMigration | null
}

/** Pulls the untyped details block off a create/update result. */
export function readVersionEventDetails(result: unknown): VersionEventDetails | null {
  const details = (result as { details?: unknown } | null | undefined)?.details
  if (!details || typeof details !== 'object') return null
  return details as VersionEventDetails
}

/** Normalizes the two shapes the platform can send for impact. */
export function normalizeImpact(
  impact: VersionImpact | 'unavailable' | null | undefined,
): VersionImpact | null {
  if (!impact) return null
  if (typeof impact === 'string') return { status: impact }
  return impact
}
