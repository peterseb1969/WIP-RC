// ---------------------------------------------------------------------------
// terminology-import — pure parsing/mapping helpers for the terminology
// Import panel (CASE-672 / CASE-674). No client calls here: everything is
// unit-testable text-in / structures-out.
// ---------------------------------------------------------------------------

import type { CreateTermRequest } from '@wip/client'

// The subset of OBO Graph JSON the server's import-ontology endpoint reads.
// `type: 'CLASS'` is load-bearing: the server skips nodes of any other type
// (def_store/services/import_export.py — `if n.get("type") != "CLASS"`).
export interface OboGraphNode {
  id: string
  lbl?: string
  type: 'CLASS'
  meta?: {
    definition?: { val?: string }
    synonyms?: Array<{ val: string }>
    deprecated?: boolean
  }
}

export interface OboGraphEdge {
  sub: string
  pred: string
  obj: string
}

export interface OboGraphDocument {
  graphs: Array<{ nodes: OboGraphNode[]; edges: OboGraphEdge[] }>
}

/** Cut a trailing OBO comment ("! parent label"), honoring quoted strings. */
function stripOboComment(value: string): string {
  let inQuote = false
  for (let i = 0; i < value.length; i++) {
    const c = value[i]
    if (c === '"' && value[i - 1] !== '\\') inQuote = !inQuote
    else if (c === '!' && !inQuote) return value.slice(0, i)
  }
  return value
}

/**
 * Minimal plain-text OBO parser: [Term] stanzas with id / name / def /
 * synonym / is_a / relationship / is_obsolete. Emits OBO Graph JSON so the
 * result feeds the same server-side import as a native .obo.json file.
 * [Typedef] and other stanzas are skipped. Throws with an actionable message
 * when the text has no [Term] stanzas at all.
 */
export function parseOboText(text: string): OboGraphDocument {
  const nodes: OboGraphNode[] = []
  const edges: OboGraphEdge[] = []

  let current: OboGraphNode | null = null
  let inTermStanza = false

  const commit = () => {
    if (current && inTermStanza && current.id) nodes.push(current)
    current = null
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('[')) {
      commit()
      inTermStanza = line === '[Term]'
      if (inTermStanza) current = { id: '', type: 'CLASS' }
      continue
    }
    if (!inTermStanza || !current) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue
    const tag = line.slice(0, colon).trim()
    const value = stripOboComment(line.slice(colon + 1)).trim()

    switch (tag) {
      case 'id':
        current.id = value
        break
      case 'name':
        current.lbl = value
        break
      case 'def': {
        const m = value.match(/"([\s\S]*?)"/)
        if (m?.[1]) {
          current.meta = { ...current.meta, definition: { val: m[1] } }
        }
        break
      }
      case 'synonym': {
        const m = value.match(/"([\s\S]*?)"/)
        if (m?.[1]) {
          const synonyms = current.meta?.synonyms ?? []
          current.meta = { ...current.meta, synonyms: [...synonyms, { val: m[1] }] }
        }
        break
      }
      case 'is_a': {
        const target = value.split(/\s/)[0]
        if (target && current.id) edges.push({ sub: current.id, pred: 'is_a', obj: target })
        break
      }
      case 'relationship': {
        // "relationship: part_of HP:0000118"
        const [pred, target] = value.split(/\s+/)
        if (pred && target && current.id) edges.push({ sub: current.id, pred, obj: target })
        break
      }
      case 'is_obsolete':
        if (value === 'true') current.meta = { ...current.meta, deprecated: true }
        break
    }
  }
  commit()

  if (nodes.length === 0) {
    throw new Error(
      'No [Term] stanzas found — this does not look like an OBO file. ' +
        'Supported: plain-text OBO with [Term] stanzas, or OBO Graph JSON.'
    )
  }

  return { graphs: [{ nodes, edges }] }
}

/**
 * Map parsed CSV rows (papaparse header mode) to CreateTermRequest items.
 * Accepts the header aliases the panel has always accepted. Rows without a
 * resolvable value are returned separately so the UI can report them.
 */
export function csvRowsToTerms(rows: Array<Record<string, string>>): {
  terms: CreateTermRequest[]
  skippedRows: number
} {
  const terms: CreateTermRequest[] = []
  let skippedRows = 0
  for (const row of rows) {
    const value = row['value'] || row['code'] || row['term'] || row['name']
    if (!value) {
      skippedRows++
      continue
    }
    terms.push({
      value,
      label: row['label'] || row['display_name'] || undefined,
      description: row['description'] || row['definition'] || undefined,
      aliases: row['aliases']
        ? row['aliases'].split('|').map(a => a.trim()).filter(Boolean)
        : undefined,
      sort_order: row['sort_order'] ? Number(row['sort_order']) : undefined,
      created_by: 'rc-console',
    })
  }
  return { terms, skippedRows }
}

/** True when a parsed JSON document is OBO Graph JSON rather than a term list/bundle. */
export function looksLikeOboGraph(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return Array.isArray(d.graphs) || Array.isArray(d.nodes)
}

// Uniform result the panel renders, whatever the import path.
export interface ImportSummary {
  termsCreated: number
  termsSkipped: number
  termsErrored: number
  relationsCreated: number
  relationsSkipped: number
  relationsErrored: number
  /** Per-item failures with row identity (term value where known). */
  failures: Array<{ value: string; error: string }>
}

export function emptySummary(): ImportSummary {
  return {
    termsCreated: 0,
    termsSkipped: 0,
    termsErrored: 0,
    relationsCreated: 0,
    relationsSkipped: 0,
    relationsErrored: 0,
    failures: [],
  }
}

/**
 * Fold a BulkResponse (per-item results with `index`) into an ImportSummary,
 * resolving row identity through the submitted terms array.
 */
export function summarizeBulkTerms(
  results: Array<{ index: number; status: string; error?: string; value?: string }>,
  submitted: CreateTermRequest[],
  maxFailures = 50
): ImportSummary {
  const s = emptySummary()
  for (const item of results) {
    if (item.status === 'created' || item.status === 'updated' || item.status === 'ok') {
      s.termsCreated++
    } else if (item.status === 'skipped' || item.status === 'unchanged') {
      s.termsSkipped++
    } else {
      s.termsErrored++
      if (s.failures.length < maxFailures) {
        s.failures.push({
          value: item.value ?? submitted[item.index]?.value ?? `row ${item.index + 1}`,
          error: item.error ?? item.status,
        })
      }
    }
  }
  return s
}
