import type {
  CreateAPIKeyRequest,
  NamespaceReserve,
  ReservationSettings,
  RemoveAPIKeyNamespaceResult,
} from '@wip/client'

// Runtime namespace reservations on API keys. A key that reserves a
// namespace gets `admin` on it and may create it, with exactly the reserved
// settings, through the namespace upsert. This is how a Console-issued key
// bootstraps an app that wip-deploy does not manage.

export type GrantLevel = 'read' | 'write' | 'admin'

/** The six reservation settings as the dialog edits them (lists and JSON as text). */
export interface ReservationDraft {
  description: string
  isolation_mode: 'open' | 'strict'
  allowed_external_refs: string
  inbound_references: 'closed' | 'open'
  deletion_mode: 'retain' | 'full'
  id_config: string
}

/** The platform defaults a namespace is created with when a setting is omitted. */
export function defaultDraft(): ReservationDraft {
  return {
    description: '',
    isolation_mode: 'open',
    allowed_external_refs: '',
    inbound_references: 'closed',
    deletion_mode: 'retain',
    id_config: '{}',
  }
}

export function splitList(text: string): string[] {
  return text.split(',').map(s => s.trim()).filter(Boolean)
}

/**
 * The settings to send for a draft: only those that differ from the
 * defaults, since the Registry fills omitted ones with exactly the defaults.
 */
export function draftToSettings(draft: ReservationDraft): { settings: ReservationSettings } | { error: string } {
  const settings: ReservationSettings = {}
  if (draft.description.trim()) settings.description = draft.description.trim()
  if (draft.isolation_mode !== 'open') settings.isolation_mode = draft.isolation_mode
  const refs = splitList(draft.allowed_external_refs)
  if (refs.length) settings.allowed_external_refs = refs
  if (draft.inbound_references !== 'closed') settings.inbound_references = draft.inbound_references
  if (draft.deletion_mode !== 'retain') settings.deletion_mode = draft.deletion_mode

  const raw = draft.id_config.trim()
  if (raw && raw !== '{}') {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { error: 'ID config is not valid JSON' }
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { error: 'ID config must be a JSON object' }
    }
    if (Object.keys(parsed).length) settings.id_config = parsed as Record<string, unknown>
  }
  return { settings }
}

/** Warnings for the two guarded choices. */
export function guardedWarnings(draft: ReservationDraft): string[] {
  const warnings: string[] = []
  if (draft.deletion_mode === 'full') {
    warnings.push('Deletion mode "full" allows permanent hard deletes in this namespace.')
  }
  if (draft.inbound_references === 'open') {
    warnings.push('Inbound references "open" lets any writer, from any namespace, reference this namespace\'s entities.')
  }
  return warnings
}

/** One namespace in the create dialog. */
export interface NamespaceRow {
  prefix: string
  reserve: boolean
  draft: ReservationDraft
}

export function emptyRow(): NamespaceRow {
  return { prefix: '', reserve: false, draft: defaultDraft() }
}

/**
 * Reserving a namespace that already exists is accepted by the Registry but
 * changes nothing: a reservation never retunes an existing namespace, and
 * the admin grant it brings is what the plain admin permission gives.
 */
export const EXISTING_NAMESPACE_HINT =
  'This namespace exists, and a reservation never changes an existing namespace. Give the key the admin permission instead.'

type CreateNamespaceFields = Pick<CreateAPIKeyRequest, 'namespaces' | 'reserve' | 'grant_permission'>

/**
 * The namespace part of a create request. Blank rows are ignored. No rows
 * at all means an unscoped (privileged) key. The permission applies to the
 * namespaces not reserved; a reserved one always gets admin.
 */
export function buildCreateNamespaces(
  rows: NamespaceRow[],
  existing: ReadonlySet<string>,
  permission: '' | GrantLevel,
): { fields: CreateNamespaceFields } | { error: string } {
  const filled = rows
    .map(r => ({ ...r, prefix: r.prefix.trim() }))
    .filter(r => r.prefix)
  if (!filled.length) return { fields: {} }

  const seen = new Set<string>()
  for (const r of filled) {
    if (seen.has(r.prefix)) return { error: `Namespace "${r.prefix}" is listed twice` }
    seen.add(r.prefix)
  }

  const reserve: NamespaceReserve[] = []
  for (const r of filled.filter(r => r.reserve)) {
    if (existing.has(r.prefix)) {
      return { error: `Namespace "${r.prefix}" exists, so it can't be reserved. Give the key the admin permission instead.` }
    }
    const result = draftToSettings(r.draft)
    if ('error' in result) return { error: `${r.prefix}: ${result.error}` }
    reserve.push(Object.keys(result.settings).length ? { prefix: r.prefix, settings: result.settings } : { prefix: r.prefix })
  }

  const plain = filled.filter(r => !r.reserve)
  return {
    fields: {
      namespaces: filled.map(r => r.prefix),
      ...(reserve.length ? { reserve } : {}),
      ...(plain.length && permission ? { grant_permission: permission } : {}),
    },
  }
}

/** What narrowing a key by one namespace did to a reservation of it. */
export function narrowOutcome(result: RemoveAPIKeyNamespaceResult): string {
  switch (result.reservation) {
    case 'released':
      return `Removed ${result.prefix} and released its reservation (the namespace was never created).`
    case 'kept':
      return `Removed ${result.prefix}. Its reservation is kept because the namespace exists; release it under Reservations.`
    default:
      return `Removed ${result.prefix} and its grant.`
  }
}
