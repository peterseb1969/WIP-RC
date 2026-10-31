import type { DocumentQueryRequest } from '@wip/client'

/**
 * Filtering the documents list by template version.
 *
 * The list endpoint has no template-version parameter, so a version filter goes
 * through the query endpoint with a `template_version` filter. That endpoint
 * returns active rows when no status is given, one per live document; asked for
 * `inactive` it returns superseded history rows, not soft-deleted documents. So
 * a version-filtered list shows live documents only, pinned to that version.
 */

/** The `?version=` URL value as a template version, or null when absent or not a positive integer. */
export function parseVersionParam(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return n >= 1 ? n : null
}

/** Versions to offer for a template whose latest version is `latest`: newest first. */
export function versionOptions(latest: number | null | undefined): number[] {
  if (!latest || latest < 1) return []
  return Array.from({ length: latest }, (_, i) => latest - i)
}

/** Query body for one page of the live documents of a template that are pinned to `version`. */
export function versionQuery(
  templateId: string,
  version: number,
  page: number,
  pageSize: number,
  sort: { sortBy: string; sortOrder: 'asc' | 'desc' },
): DocumentQueryRequest {
  return {
    template_id: templateId,
    status: 'active',
    filters: [{ field: 'template_version', operator: 'eq', value: version }],
    page,
    page_size: pageSize,
    sort_by: sort.sortBy,
    sort_order: sort.sortOrder,
  }
}
