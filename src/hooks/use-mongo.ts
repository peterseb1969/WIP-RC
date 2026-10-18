import { useQuery } from '@tanstack/react-query'
import { apiUrl } from '@/lib/wip'

export interface MongoDatabase {
  name: string
  collections: number
  sizeOnDisk: number | null
  status: 'ok' | 'error'
  error?: string
}

export interface MongoCollection {
  name: string
  type: string
  documentCount: number | null
  indexCount: number | null
}

export interface MongoIndex {
  name: string
  key: Record<string, number>
  unique?: boolean
  sparse?: boolean
  v?: number
}

export interface MongoDocBrowse {
  database: string
  collection: string
  documents: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
  pages: number
}

/** Why MongoDB refused the console: no credentials, refused credentials, or missing privilege. */
export type MongoAuthError = 'not_configured' | 'rejected' | 'forbidden'

/** A failed MongoDB request; carries the auth classification when MongoDB refused the console. */
export class MongoInfraError extends Error {
  constructor(
    message: string,
    readonly authError: MongoAuthError | null = null,
    readonly auth: 'none' | 'user' | null = null,
    readonly user: string | null = null,
  ) {
    super(message)
  }
}

async function fetchInfra<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(`/api/infra/mongo${path}`))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let body: { error?: string; auth_error?: MongoAuthError | null; auth?: 'none' | 'user'; user?: string | null } = {}
    try { body = JSON.parse(text) } catch { /* not JSON */ }
    throw new MongoInfraError(
      `MongoDB ${path}: HTTP ${res.status} — ${body.error ?? text}`,
      body.auth_error ?? null,
      body.auth ?? null,
      body.user ?? null,
    )
  }
  return res.json()
}

/**
 * MongoDB databases with collection counts and size, from the backend's direct
 * Mongo connection (`/api/infra/mongo/databases`) — not via WIP's APIs.
 */
export interface MongoDatabaseList {
  databases: MongoDatabase[]
  /** How the backend authenticated: anonymously or as `user`. */
  auth?: 'none' | 'user'
  user?: string | null
}

export function useMongoDatabases() {
  return useQuery({
    queryKey: ['rc-console', 'mongo', 'databases'],
    queryFn: () => fetchInfra<MongoDatabaseList>('/databases'),
    staleTime: 60_000,
  })
}

/** Collections of one database with document and index counts. Idle until a database is chosen. */
export function useMongoCollections(database: string | null) {
  return useQuery({
    queryKey: ['rc-console', 'mongo', 'collections', database],
    queryFn: () =>
      fetchInfra<{ collections: MongoCollection[] }>(`/collections/${database}`).then(r => r.collections),
    enabled: !!database,
    staleTime: 60_000,
  })
}

/** Index definitions of one collection. Idle until database and collection are chosen. */
export function useMongoIndexes(database: string | null, collection: string | null) {
  return useQuery({
    queryKey: ['rc-console', 'mongo', 'indexes', database, collection],
    queryFn: () =>
      fetchInfra<{ indexes: MongoIndex[] }>(`/indexes/${database}/${collection}`).then(r => r.indexes),
    enabled: !!database && !!collection,
    staleTime: 120_000,
  })
}

/** One page (20 raw documents) of a collection, for read-only inspection. */
export function useMongoDocuments(database: string | null, collection: string | null, page: number = 1) {
  return useQuery({
    queryKey: ['rc-console', 'mongo', 'docs', database, collection, page],
    queryFn: () =>
      fetchInfra<MongoDocBrowse>(`/docs/${database}/${collection}?page=${page}&page_size=20`),
    enabled: !!database && !!collection,
    staleTime: 30_000,
  })
}
