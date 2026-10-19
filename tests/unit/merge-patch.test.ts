/**
 * Tests for the merge patch the document editor sends: nested objects are
 * diffed key by key so a removed key is deleted, arrays replace, unchanged
 * keys are left out.
 */
import { describe, it, expect } from 'vitest'
import { mergePatch } from '../../src/lib/merge-patch'

describe('mergePatch', () => {
  it('sends changed and new fields, leaves unchanged ones out', () => {
    expect(mergePatch({ a: 1, b: 'x' }, { a: 2, b: 'x', c: true })).toEqual({ a: 2, c: true })
  })

  it('deletes a cleared or removed field with null', () => {
    expect(mergePatch({ a: 1, b: 2 }, { a: null })).toEqual({ a: null, b: null })
  })

  it('diffs nested objects so a removed nested key is deleted', () => {
    expect(mergePatch({ one: { name: 'o', kind: 'beta' } }, { one: { name: 'o' } })).toEqual({ one: { kind: null } })
    expect(mergePatch({ one: { name: 'o', kind: 'beta' } }, { one: { name: 'p', kind: 'beta' } })).toEqual({ one: { name: 'p' } })
  })

  it('replaces arrays whole, including arrays of objects', () => {
    const before = { items: [{ name: 'a', kind: 'alpha' }] }
    expect(mergePatch(before, { items: [{ name: 'a' }] })).toEqual({ items: [{ name: 'a' }] })
  })

  it('gives an empty patch for equal data', () => {
    expect(mergePatch({ one: { a: [1, 2] }, n: 0 }, { one: { a: [1, 2] }, n: 0 })).toEqual({})
  })

  it('a value replacing an object, or an object replacing a value, is sent whole', () => {
    expect(mergePatch({ x: 'text' }, { x: { k: 1 } })).toEqual({ x: { k: 1 } })
    expect(mergePatch({ x: { k: 1 } }, { x: 'text' })).toEqual({ x: 'text' })
  })
})
