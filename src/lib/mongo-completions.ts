import type { CompletionSource } from '@codemirror/autocomplete'

/** MongoDB query and projection operators offered by the query pad's autocomplete. */
export const MONGO_OPERATORS = [
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin',
  '$exists', '$type', '$regex', '$options', '$not', '$and', '$or', '$nor',
  '$elemMatch', '$size', '$all', '$mod', '$expr', '$text', '$search',
  '$slice', '$meta',
] as const

/**
 * Autocomplete for the query pad's JSON editors: the collection's field paths
 * and MongoDB operators, completed inside a key or string as it is typed
 * (`"data.ti` → `data.title`, `"$g` → `$gt`).
 */
export function mongoCompletionSource(fields: readonly string[]): CompletionSource {
  const options = [
    ...fields.map(f => ({ label: f, type: 'property' })),
    ...MONGO_OPERATORS.map(op => ({ label: op, type: 'keyword' })),
  ]
  return context => {
    const word = context.matchBefore(/"[$\w.]*$/)
    if (!word) return null
    if (word.text === '"' && !context.explicit) return null
    return { from: word.from + 1, options, validFor: /^[$\w.]*$/ }
  }
}
