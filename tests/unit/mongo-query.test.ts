/**
 * Tests for the MongoDB query pad's parsing and safety checks
 * (server/infra/mongo-query.ts).
 */
import { describe, it, expect } from 'vitest'
import { BSON } from 'mongodb'
import { parseQueryPart, parseBoundedInt, findUnsafe, collectFieldPaths, QueryInputError } from '../../server/infra/mongo-query'

describe('parseQueryPart', () => {
  it('treats blank or missing text as an empty object', () => {
    expect(parseQueryPart(undefined, 'Filter')).toEqual({})
    expect(parseQueryPart('  ', 'Filter')).toEqual({})
  })

  it('parses Extended JSON into BSON values', () => {
    const f = parseQueryPart('{"_id": {"$oid": "6a2902cd15b7aa3144fa2b65"}, "at": {"$date": "2026-10-18T00:00:00Z"}, "n": {"$gt": 1}}', 'Filter')
    expect(f._id).toBeInstanceOf(BSON.ObjectId)
    expect(f.at).toBeInstanceOf(Date)
    expect(f.n).toEqual({ $gt: 1 })
  })

  it('rejects invalid JSON, non-objects and non-text input', () => {
    expect(() => parseQueryPart('{"a": ', 'Filter')).toThrow(/not valid JSON/)
    expect(() => parseQueryPart('[1]', 'Filter')).toThrow(/must be a JSON object/)
    expect(() => parseQueryPart('"x"', 'Sort')).toThrow(/must be a JSON object/)
    expect(() => parseQueryPart({ a: 1 }, 'Filter')).toThrow(QueryInputError)
  })

  it('rejects JavaScript operators at any depth and in any part', () => {
    expect(() => parseQueryPart('{"$where": "true"}', 'Filter')).toThrow(/\$where/)
    expect(() => parseQueryPart('{"$and": [{"a": 1}, {"$expr": {"$function": {"body": "x", "args": [], "lang": "js"}}}]}', 'Filter')).toThrow(/\$function/)
    expect(() => parseQueryPart('{"v": {"$accumulator": {}}}', 'Projection')).toThrow(/Projection: \$accumulator/)
  })

  it('rejects BSON code values', () => {
    expect(() => parseQueryPart('{"x": {"$code": "1"}}', 'Filter')).toThrow(/code values/)
  })
})

describe('findUnsafe', () => {
  it('allows ordinary operators and treats BSON values as leaves', () => {
    expect(findUnsafe({ a: { $in: [1, 2] }, b: new BSON.ObjectId(), c: { $regex: '^x' } })).toBeNull()
  })

  it('does not mistake a "$where" string value for the operator', () => {
    expect(findUnsafe({ note: '$where' })).toBeNull()
  })
})

describe('parseBoundedInt', () => {
  it('uses the fallback when absent and accepts in-range integers', () => {
    expect(parseBoundedInt(undefined, 'Limit', 1, 500, 50)).toBe(50)
    expect(parseBoundedInt('20', 'Limit', 1, 500, 50)).toBe(20)
  })

  it('rejects out-of-range and fractional values', () => {
    expect(() => parseBoundedInt(0, 'Limit', 1, 500, 50)).toThrow(/1 to 500/)
    expect(() => parseBoundedInt(501, 'Limit', 1, 500, 50)).toThrow()
    expect(() => parseBoundedInt(2.5, 'Limit', 1, 500, 50)).toThrow()
  })
})

describe('collectFieldPaths', () => {
  it('collects dotted paths through objects and arrays, stopping at BSON values and the depth limit', () => {
    const docs = [
      { _id: new BSON.ObjectId(), data: { title: 't', tags: [{ name: 'a' }] }, deep: { a: { b: { c: { d: 1 } } } } },
      { data: { pages: 3 } },
    ]
    const paths = collectFieldPaths(docs)
    expect(paths).toEqual(expect.arrayContaining(['_id', 'data', 'data.title', 'data.tags', 'data.tags.name', 'data.pages', 'deep.a.b']))
    expect(paths).not.toContain('deep.a.b.c')
    expect(paths.some(p => p.startsWith('_id.'))).toBe(false)
  })
})
