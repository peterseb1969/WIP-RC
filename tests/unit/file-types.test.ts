/**
 * Tests for matching a file's MIME type against a file field's allowed_types
 * patterns (exact, family wildcard, any).
 */
import { describe, it, expect } from 'vitest'
import { mimeTypeAllowed } from '../../src/lib/file-types'

describe('mimeTypeAllowed', () => {
  it('allows everything when no types are configured', () => {
    expect(mimeTypeAllowed('application/x-thing', [])).toBe(true)
    expect(mimeTypeAllowed('application/x-thing', undefined)).toBe(true)
  })

  it('matches a family wildcard', () => {
    expect(mimeTypeAllowed('text/plain', ['text/*'])).toBe(true)
    expect(mimeTypeAllowed('image/png', ['image/*', 'application/pdf'])).toBe(true)
    expect(mimeTypeAllowed('application/pdf', ['image/*'])).toBe(false)
  })

  it('does not let a family wildcard match a longer type name', () => {
    expect(mimeTypeAllowed('textual/plain', ['text/*'])).toBe(false)
  })

  it('matches exact types, ignoring case and parameters', () => {
    expect(mimeTypeAllowed('application/pdf', ['application/pdf'])).toBe(true)
    expect(mimeTypeAllowed('Text/CSV; charset=utf-8', ['text/csv'])).toBe(true)
    expect(mimeTypeAllowed('text/csv', ['text/plain'])).toBe(false)
  })

  it('treats * and */* as any type', () => {
    expect(mimeTypeAllowed('video/mp4', ['*'])).toBe(true)
    expect(mimeTypeAllowed('video/mp4', ['*/*'])).toBe(true)
  })

  it('leaves an undetected type to the server', () => {
    expect(mimeTypeAllowed('', ['image/*'])).toBe(true)
  })
})
