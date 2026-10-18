/**
 * Tests for formatCode — the query editors' Format action (src/lib/format-code.ts).
 */
import { describe, it, expect } from 'vitest'
import { formatCode } from '../../src/lib/format-code'

describe('formatCode', () => {
  it('pretty-prints JSON with two-space indents', async () => {
    expect(await formatCode('json', '{"status":"open","n":{"$gt":1}}')).toBe('{\n  "status": "open",\n  "n": {\n    "$gt": 1\n  }\n}')
  })

  it('rejects invalid JSON so the caller keeps the text as typed', async () => {
    await expect(formatCode('json', '{"status": ')).rejects.toThrow()
  })

  it('formats PostgreSQL with upper-case keywords, keeping quoted identifiers and parameters', async () => {
    const out = await formatCode('sql', 'select count(*) from "dev-wip-song".doc_song where status = $1')
    expect(out).toMatch(/^SELECT/)
    expect(out).toContain('"dev-wip-song".doc_song')
    expect(out).toContain('$1')
    expect(out).toContain('\n')
  })

  it('leaves blank input alone', async () => {
    expect(await formatCode('sql', '   ')).toBe('   ')
  })
})
