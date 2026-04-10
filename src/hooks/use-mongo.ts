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

async function fetchInfra<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(`/api/infra/mongo${path}`))
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`MongoDB ${path}: HTTP ${res.status} — ${body}`)
  }
  return res.json()
}

export function useMongoDatabases() {
  return useQuery({
    queryKey: ['rc-console', 'mongo', 'databases'],
    queryFn: () => fetchInfra<{ databases: MongoDatabase[] }>('/databases').then(r => r.databases),
    staleTime: 60_000,
  })
}

export function useMongoCollections(database: string | null) {
  return useQuery({
    queryKey: ['rc-console', 'mongo', 'collections', database],
    queryFn: () =>
      fetchInfra<{ collections: MongoCollection[] }>(`/collections/${database}`).then(r => r.collections),
    enabled: !!database,
    staleTime: 60_000,
  })
}

export function useMongoIndexes(database: string | null, collection: string | null) {
  return useQuery({
    queryKey: ['rc-console', 'mongo', 'indexes', database, collection],
    queryFn: () =>
      fetchInfra<{ indexes: MongoIndex[] }>(`/indexes/${database}/${collection}`).then(r => r.indexes),
    enabled: !!database && !!collection,
    staleTime: 120_000,
  })
}

export function useMongoDocuments(database: string | null, collection: string | null, page: number = 1) {
  return useQuery({
    queryKey: ['rc-console', 'mongo', 'docs', database, collection, page],
    queryFn: () =>
      fetchInfra<MongoDocBrowse>(`/docs/${database}/${collection}?page=${page}&page_size=20`),
    enabled: !!database && !!collection,
    staleTime: 30_000,
  })
}
