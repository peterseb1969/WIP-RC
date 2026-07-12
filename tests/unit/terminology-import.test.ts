/**
 * Tests for the terminology import helpers (CASE-672 / CASE-674):
 * plain-text OBO parsing, CSV row mapping, bulk result summarizing.
 */
import { describe, it, expect } from 'vitest'
import {
  parseOboText,
  csvRowsToTerms,
  looksLikeOboGraph,
  summarizeBulkTerms,
} from '../../src/lib/terminology-import'

const SAMPLE_OBO = `format-version: 1.2
ontology: sample

[Term]
id: HP:0000001
name: All
def: "The root of all terms." [HPO:probinson]

[Term]
id: HP:0000118
name: Phenotypic abnormality
def: "A phenotypic abnormality." [HPO:probinson]
synonym: "Organ abnormality" EXACT []
is_a: HP:0000001 ! All

[Term]
id: HP:0000924
name: Abnormality of the skeletal system
is_a: HP:0000118 ! Phenotypic abnormality
relationship: part_of HP:0000001

[Term]
id: HP:9999999
name: Old term
is_obsolete: true

[Typedef]
id: part_of
name: part of
`

describe('parseOboText', () => {
  const graph = parseOboText(SAMPLE_OBO)
  const { nodes, edges } = graph.graphs[0]!

  it('parses all [Term] stanzas and skips [Typedef]', () => {
    expect(nodes.map(n => n.id)).toEqual(['HP:0000001', 'HP:0000118', 'HP:0000924', 'HP:9999999'])
  })

  it('extracts names, definitions, and synonyms', () => {
    const n = nodes.find(n => n.id === 'HP:0000118')!
    expect(n.lbl).toBe('Phenotypic abnormality')
    expect(n.meta?.definition?.val).toBe('A phenotypic abnormality.')
    expect(n.meta?.synonyms).toEqual([{ val: 'Organ abnormality' }])
  })

  it('extracts is_a and relationship edges, stripping trailing comments', () => {
    expect(edges).toContainEqual({ sub: 'HP:0000118', pred: 'is_a', obj: 'HP:0000001' })
    expect(edges).toContainEqual({ sub: 'HP:0000924', pred: 'is_a', obj: 'HP:0000118' })
    expect(edges).toContainEqual({ sub: 'HP:0000924', pred: 'part_of', obj: 'HP:0000001' })
    expect(edges).toHaveLength(3)
  })

  it('marks obsolete terms as deprecated', () => {
    expect(nodes.find(n => n.id === 'HP:9999999')?.meta?.deprecated).toBe(true)
  })

  it('does not treat ! inside quoted strings as a comment', () => {
    const g = parseOboText('[Term]\nid: X:1\ndef: "Watch out! Danger." []\n')
    expect(g.graphs[0]!.nodes[0]!.meta?.definition?.val).toBe('Watch out! Danger.')
  })

  it('throws an actionable error on non-OBO text', () => {
    expect(() => parseOboText('just some prose, no stanzas')).toThrow(/No \[Term\] stanzas/)
  })
})

describe('csvRowsToTerms', () => {
  it('maps header aliases and splits pipe-separated aliases', () => {
    const { terms, skippedRows } = csvRowsToTerms([
      { value: 'M', label: 'Male', aliases: 'Mr|MR', sort_order: '1' },
      { code: 'F', display_name: 'Female', definition: 'F desc' },
      { label: 'no value column at all' },
    ])
    expect(skippedRows).toBe(1)
    expect(terms).toHaveLength(2)
    expect(terms[0]).toMatchObject({ value: 'M', label: 'Male', aliases: ['Mr', 'MR'], sort_order: 1 })
    expect(terms[1]).toMatchObject({ value: 'F', label: 'Female', description: 'F desc' })
  })
})

describe('looksLikeOboGraph', () => {
  it('detects graphs/nodes shapes and rejects others', () => {
    expect(looksLikeOboGraph({ graphs: [] })).toBe(true)
    expect(looksLikeOboGraph({ nodes: [] })).toBe(true)
    expect(looksLikeOboGraph({ terminology: {}, terms: [] })).toBe(false)
    expect(looksLikeOboGraph([1, 2])).toBe(false)
    expect(looksLikeOboGraph(null)).toBe(false)
  })
})

describe('summarizeBulkTerms', () => {
  it('buckets statuses and resolves failure row identity via index', () => {
    const submitted = [{ value: 'A' }, { value: 'B' }, { value: 'C' }, { value: 'D' }]
    const s = summarizeBulkTerms(
      [
        { index: 0, status: 'created' },
        { index: 1, status: 'skipped' },
        { index: 2, status: 'error', error: 'inactive terminology' },
        { index: 3, status: 'unchanged' },
      ],
      submitted
    )
    expect(s.termsCreated).toBe(1)
    expect(s.termsSkipped).toBe(2)
    expect(s.termsErrored).toBe(1)
    expect(s.failures).toEqual([{ value: 'C', error: 'inactive terminology' }])
  })

  it('caps collected failures at maxFailures', () => {
    const submitted = Array.from({ length: 100 }, (_, i) => ({ value: `T${i}` }))
    const results = submitted.map((_, i) => ({ index: i, status: 'error', error: 'boom' }))
    const s = summarizeBulkTerms(results, submitted, 50)
    expect(s.termsErrored).toBe(100)
    expect(s.failures).toHaveLength(50)
  })
})
