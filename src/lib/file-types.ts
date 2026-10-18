/**
 * Whether a file's MIME type matches a file field's `allowed_types`, which are
 * patterns: an exact type (`application/pdf`), a family (`image/*`) or any
 * (`*` / `*\/*`). Comparison ignores case and MIME parameters (`; charset=…`).
 * An empty list allows everything. An empty `type` (the browser could not tell)
 * is not refused here — the server validates the upload either way.
 */
export function mimeTypeAllowed(type: string, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true
  const t = type.split(';')[0]!.trim().toLowerCase()
  if (!t) return true
  return allowed.some(raw => {
    const p = raw.trim().toLowerCase()
    if (p === '*' || p === '*/*') return true
    if (p.endsWith('/*')) return t.startsWith(p.slice(0, -1))
    return t === p
  })
}
