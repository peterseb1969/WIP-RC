import { WipConflictError, WipNotFoundError } from '@wip/client'

/**
 * A short note for a stored value whose lookup failed, by what the platform
 * said. A 404 means it names nothing; a 409 means it names several entities
 * (the platform lists the candidates and picks none); anything else, a
 * Registry outage (503) included, means the lookup could not be answered and
 * says nothing about the value.
 */
export function lookupNote(error: unknown): string {
  if (error instanceof WipNotFoundError) return 'not found'
  if (error instanceof WipConflictError) return 'ambiguous'
  return error ? 'lookup failed' : ''
}
