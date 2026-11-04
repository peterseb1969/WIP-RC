// What a namespace holds now, per kind: what is live and what is retired.
//
// The Registry's per-namespace stats count every entity it ever registered,
// including soft-deleted ones (kb: 5,908 documents = 5,885 active + 23
// deleted), so a deletion never lowers them. These counts come from the
// services that own the data instead, so adding and deleting both show.

/** Live and retired counts of one kind. */
export interface KindCount {
  active: number
  /** Retired: deleted documents and files, deactivated templates and terminologies, deprecated terms. */
  retired: number
}

export interface NamespaceCounts {
  terminologies: KindCount
  terms: KindCount
  templates: KindCount
  documents: KindCount
  /** `active` includes orphans: files no document references. */
  files: KindCount & { orphan: number }
}

/**
 * Templates live and retired, from every version of every template in the
 * namespace. A template is retired when none of its versions is active.
 * (Listing with latest_only and status=inactive is no use here: it returns
 * superseded versions of templates that are still live.)
 */
export function templateCounts(rows: Array<{ value: string; status: string }>): KindCount {
  const live = new Map<string, boolean>()
  for (const r of rows) live.set(r.value, (live.get(r.value) ?? false) || r.status === 'active')
  let active = 0
  for (const isLive of live.values()) if (isLive) active++
  return { active, retired: live.size - active }
}

/**
 * Terms live and deprecated. Each terminology's `term_count` counts its
 * active terms. The Registry counts every term it registered, deprecated
 * ones too; a hard-deleted term leaves the Registry, so the difference is
 * the deprecated terms.
 */
export function termCounts(termCountsOfTerminologies: Array<number | null | undefined>, registered: number | undefined): KindCount {
  const active = termCountsOfTerminologies.reduce<number>((sum, n) => sum + (n ?? 0), 0)
  return { active, retired: Math.max(0, (registered ?? active) - active) }
}

/** The label for a kind's retired count. */
export const RETIRED_LABEL: Record<keyof NamespaceCounts, string> = {
  terminologies: 'deactivated',
  terms: 'deprecated',
  templates: 'deactivated',
  documents: 'deleted',
  files: 'deleted',
}
