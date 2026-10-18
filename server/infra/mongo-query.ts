import { BSON } from 'mongodb'

// Parsing and safety checks for the MongoDB query pad. Queries arrive as
// Extended JSON text (filter, projection, sort), are parsed with the driver's
// EJSON parser — nothing is evaluated — and are checked before they reach
// MongoDB. The console's MongoDB user holds only the `read` role, so the
// server refuses writes; it does not refuse server-side JavaScript, which is
// what the operator check below blocks.

/** Operators that run JavaScript inside mongod. Rejected anywhere in a query. */
export const JS_OPERATORS = ['$where', '$function', '$accumulator'] as const

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 500
export const MAX_SKIP = 100_000
/** Server-side time limit for every query-pad operation. */
export const MAX_TIME_MS = 10_000

export class QueryInputError extends Error {}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && Object.getPrototypeOf(v) === Object.prototype
}

/**
 * The first reason a parsed query part is unsafe, or null: a JavaScript
 * operator as a key at any depth, or a BSON Code value (`{"$code": …}`).
 */
export function findUnsafe(value: unknown, path = ''): string | null {
  if (value instanceof BSON.Code) return `JavaScript code values are not allowed (at ${path || 'top level'})`
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const r = findUnsafe(value[i], `${path}[${i}]`)
      if (r) return r
    }
    return null
  }
  if (!isPlainObject(value)) return null
  for (const [key, child] of Object.entries(value)) {
    if ((JS_OPERATORS as readonly string[]).includes(key)) {
      return `${key} runs JavaScript in the database and is not allowed`
    }
    const r = findUnsafe(child, path ? `${path}.${key}` : key)
    if (r) return r
  }
  return null
}

/**
 * Parse one query part (filter, projection or sort) from Extended JSON text.
 * Blank text means `{}`. Throws QueryInputError for invalid JSON, a non-object
 * value, or an unsafe operator.
 */
export function parseQueryPart(text: unknown, label: string): Record<string, unknown> {
  if (text === undefined || text === null || (typeof text === 'string' && !text.trim())) return {}
  if (typeof text !== 'string') throw new QueryInputError(`${label} must be Extended JSON text`)
  let parsed: unknown
  try {
    parsed = BSON.EJSON.parse(text, { relaxed: true })
  } catch (err) {
    throw new QueryInputError(`${label} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!isPlainObject(parsed)) throw new QueryInputError(`${label} must be a JSON object`)
  const unsafe = findUnsafe(parsed)
  if (unsafe) throw new QueryInputError(`${label}: ${unsafe}`)
  return parsed
}

/** An integer within [min, max], `fallback` when absent. Throws QueryInputError otherwise. */
export function parseBoundedInt(value: unknown, label: string, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new QueryInputError(`${label} must be a whole number from ${min} to ${max}`)
  }
  return n
}

/**
 * Dotted field paths found in sample documents, for autocomplete. Descends
 * into nested objects (and objects inside arrays) up to `maxDepth` levels;
 * BSON values such as ObjectId and Date are leaves.
 */
export function collectFieldPaths(docs: unknown[], maxDepth = 3): string[] {
  const paths = new Set<string>()
  const walk = (value: unknown, prefix: string, depth: number) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, prefix, depth)
      return
    }
    if (!isPlainObject(value) || depth >= maxDepth) return
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key
      paths.add(path)
      walk(child, path, depth + 1)
    }
  }
  for (const doc of docs) walk(doc, '', 0)
  return [...paths].sort()
}
