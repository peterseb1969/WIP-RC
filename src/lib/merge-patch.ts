/**
 * The RFC 7396 JSON Merge Patch that turns `before` into `after`. The
 * document PATCH applies one: objects merge key by key, arrays and scalars
 * replace, and `null` deletes. A key gone from an object therefore has to
 * be sent as `null` at its own depth; sending the whole new object would
 * leave the old key in place. Unchanged keys are left out, so two equal
 * values give `{}`.
 */
export function mergePatch(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = before[key]
    const now = after[key]
    if (!(key in after) || now === undefined || now === null) {
      if (was !== undefined && was !== null) patch[key] = null
      continue
    }
    if (isPlainObject(was) && isPlainObject(now)) {
      const inner = mergePatch(was, now)
      if (Object.keys(inner).length > 0) patch[key] = inner
      continue
    }
    if (JSON.stringify(was) !== JSON.stringify(now)) patch[key] = now
  }
  return patch
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
