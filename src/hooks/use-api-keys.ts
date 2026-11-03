import { useWipClient } from '@wip/react'
import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type {
  AddAPIKeyNamespaceRequest,
  APIKeyRevokeResult,
  CreateAPIKeyRequest,
  CreateAPIKeyResponse,
  RemoveAPIKeyNamespaceResult,
  UpdateAPIKeyRequest,
} from '@wip/client'
import { isManagedRefusal } from '@/lib/managed-records'

// API keys and their namespace reservations (no @wip/react hooks for these).
// Everything lives under one query-key root, so any key change also
// refreshes the reservations list.

/** Grant rows of one namespace. Here, not in GrantsPanel, so both can import it without a cycle. */
export const GRANTS_QUERY_KEY = (prefix: string) =>
  ['rc-console', 'grants', prefix] as const

export const API_KEY_KEYS = {
  all: ['rc-console', 'api-keys'] as const,
  list: () => [...API_KEY_KEYS.all, 'list'] as const,
  reservations: () => [...API_KEY_KEYS.all, 'reservations'] as const,
}

/**
 * A write refused because wip-deploy owns the record means this view is
 * stale (the record was imported since it was read, or another tab acted):
 * re-read keys and reservations so it shows read-only. The refusal's own
 * message still goes to the caller.
 */
function onWriteError(qc: QueryClient, err: Error) {
  if (isManagedRefusal(err)) qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
}

interface MutationCallbacks<T> {
  onSuccess?: (data: T) => void
  onError?: (err: Error) => void
}

export function useAPIKeys() {
  const client = useWipClient()
  return useQuery({
    queryKey: API_KEY_KEYS.list(),
    queryFn: () => client.registry.listAPIKeys(),
    staleTime: 30_000,
  })
}

export function useReservations() {
  const client = useWipClient()
  return useQuery({
    queryKey: API_KEY_KEYS.reservations(),
    queryFn: () => client.registry.listReservations(),
    staleTime: 30_000,
  })
}

export function useCreateAPIKey(options?: MutationCallbacks<CreateAPIKeyResponse>) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateAPIKeyRequest) => client.registry.createAPIKey(req),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
      for (const ns of data.namespaces ?? []) qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY(ns) })
      options?.onSuccess?.(data)
    },
    onError: (err: Error) => { onWriteError(qc, err); options?.onError?.(err) },
  })
}

export function useUpdateAPIKey(options?: MutationCallbacks<void>) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: UpdateAPIKeyRequest }) =>
      client.registry.updateAPIKey(name, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
      options?.onSuccess?.()
    },
    onError: (err: Error) => { onWriteError(qc, err); options?.onError?.(err) },
  })
}

export function useRevokeAPIKey(options?: MutationCallbacks<APIKeyRevokeResult>) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => client.registry.revokeAPIKey(name),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
      for (const ns of data.revoked_grants ?? []) qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY(ns) })
      options?.onSuccess?.(data)
    },
    onError: (err: Error) => { onWriteError(qc, err); options?.onError?.(err) },
  })
}

/** Widen a runtime key by one namespace: scope and grant together, optionally a reservation. */
export function useAddKeyNamespace(options?: MutationCallbacks<void>) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, prefix, request }: { name: string; prefix: string; request: AddAPIKeyNamespaceRequest }) =>
      client.registry.addAPIKeyNamespace(name, prefix, request),
    onSuccess: (_data, { prefix }) => {
      qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
      qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY(prefix) })
      options?.onSuccess?.()
    },
    onError: (err: Error) => { onWriteError(qc, err); options?.onError?.(err) },
  })
}

/** Narrow a runtime key by one namespace: scope, grant, and a reservation of an uncreated namespace. */
export function useRemoveKeyNamespace(options?: MutationCallbacks<RemoveAPIKeyNamespaceResult>) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, prefix }: { name: string; prefix: string }) =>
      client.registry.removeAPIKeyNamespace(name, prefix),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
      qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY(data.prefix) })
      options?.onSuccess?.(data)
    },
    onError: (err: Error) => { onWriteError(qc, err); options?.onError?.(err) },
  })
}

/** Release a runtime reservation. The namespace itself is never touched. */
export function useReleaseReservation(options?: MutationCallbacks<string>) {
  const client = useWipClient()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (prefix: string) => {
      await client.registry.releaseReservation(prefix)
      return prefix
    },
    onSuccess: (prefix) => {
      qc.invalidateQueries({ queryKey: API_KEY_KEYS.all })
      options?.onSuccess?.(prefix)
    },
    onError: (err: Error) => { onWriteError(qc, err); options?.onError?.(err) },
  })
}
