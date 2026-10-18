/**
 * Tests for the MongoDB query pad's autocomplete source and document id
 * labels (src/lib/mongo-completions.ts, src/components/mongo/DocumentList.tsx).
 */
import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { CompletionContext } from '@codemirror/autocomplete'
import { mongoCompletionSource } from '../../src/lib/mongo-completions'
import { documentIdLabel } from '../../src/components/mongo/DocumentList'

function complete(doc: string, explicit = false) {
  const state = EditorState.create({ doc })
  const source = mongoCompletionSource(['namespace', 'data.title'])
  return source(new CompletionContext(state, doc.length, explicit)) as { from: number; options: { label: string }[] } | null
}

describe('mongoCompletionSource', () => {
  it('completes field paths and operators inside a quoted key, replacing from after the quote', () => {
    const r = complete('{"names')
    expect(r?.from).toBe(2)
    const labels = r!.options.map(o => o.label)
    expect(labels).toContain('namespace')
    expect(labels).toContain('data.title')
    expect(labels).toContain('$gt')
  })

  it('offers operators after a $', () => {
    expect(complete('{"n": {"$g')?.from).toBe(8)
  })

  it('stays quiet outside quotes, and on a bare quote unless asked', () => {
    expect(complete('{ ')).toBeNull()
    expect(complete('{"')).toBeNull()
    expect(complete('{"', true)).not.toBeNull()
  })
})

describe('documentIdLabel', () => {
  it('shows plain ids, Extended JSON $oid hex, and a fallback', () => {
    expect(documentIdLabel({ _id: 'abc' }, 'row 1')).toBe('abc')
    expect(documentIdLabel({ _id: { $oid: '6a29' } }, 'row 1')).toBe('6a29')
    expect(documentIdLabel({ value: 1 }, 'row 1')).toBe('row 1')
    expect(documentIdLabel({ _id: { a: 1 } }, 'row 1')).toBe('{"a":1}')
  })
})
