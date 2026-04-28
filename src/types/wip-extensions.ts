/**
 * Local type extensions for fields that exist on the WIP wire format but
 * are not yet exposed in @wip/client's TypeScript types.
 *
 * Verified present on the wire (template-store /templates response):
 *   - Template.usage: 'entity' | 'relationship' | 'reference'
 *   - Template.source_templates: string[]
 *   - Template.target_templates: string[]
 *   - Template.versioned: boolean
 *   - FieldDefinition.full_text_indexed: boolean | null
 *   - SearchResult.score: number | null  (FTS hits)
 *   - SearchResult.snippet: string | null  (FTS hits, ts_headline output)
 *
 * When @wip/client ships these in its dist .d.ts, remove this file and
 * use the canonical types directly.
 *
 * Refs: CASE-63 (PoNIF #7/#8), CASE-64 (edge-type rename), CASE-150 (FTS).
 */
import type { Template, FieldDefinition, SearchResult } from '@wip/client'

export type TemplateUsage = 'entity' | 'relationship' | 'reference'

export interface TemplateExt extends Template {
  usage?: TemplateUsage
  source_templates?: string[]
  target_templates?: string[]
  versioned?: boolean
}

export interface FieldDefinitionExt extends FieldDefinition {
  full_text_indexed?: boolean | null
}

export interface SearchResultExt extends SearchResult {
  score?: number | null
  snippet?: string | null
}

/** Search request param shape for FTS (CASE-150). Not in @wip/client types yet. */
export interface FtsSearchParams {
  query: string
  namespace?: string
  template?: string
  mode?: 'auto' | 'fts' | 'substring'
  include_inactive?: boolean
  snippet_format?: 'html' | 'text'
  limit?: number
}

/** Narrowing helper: is this template an edge type? */
export function isEdgeType(t: Template | TemplateExt): t is TemplateExt & { usage: 'relationship' } {
  return (t as TemplateExt).usage === 'relationship'
}
