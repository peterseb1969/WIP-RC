import type { CrossVersionView, ReportingConfig } from '@wip/client'

// Cross-version-view helpers (CASE-716 item 5).
//
// The types themselves now come from @wip/client — 0.44.0 typed both surfaces
// this file used to shim, closing CASE-720. What remains is the RC-side
// string<->wire conversion the template editor needs, which is a UI concern,
// not platform surface.
//
// cross_version_view upgrades an entity's bare-name view from identity-core to
// a mapped cross-version view. `columns` maps a target column to its source:
// `{from: <source field>}`, or `{}`/null for identity passthrough.

export type CrossVersionViewVersions = CrossVersionView['versions']

/** Reads the config off a template's reporting block, normalising to null. */
export function readCrossVersionView(
  reporting: ReportingConfig | null | undefined,
): CrossVersionView | null {
  return reporting?.cross_version_view ?? null
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
