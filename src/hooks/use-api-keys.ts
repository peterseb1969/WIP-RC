import { useWipClient } from '@wip/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AddAPIKeyNamespaceRequest,
  APIKeyRevokeResult,
  CreateAPIKeyRequest,
  CreateAPIKeyResponse,
  RemoveAPIKeyNamespaceResult,
  UpdateAPIKeyRequest,
} from '@wip/client'
import { GRANTS_QUERY_KEY } from '@/components/grants/GrantsPanel'

// API keys and their namespace reservations (no @wip/react hooks for these).
// Everything lives under one query-key root, so any key change also
// refreshes the reservations list.

export const API_KEY_KEYS = {
  all: ['rc-console', 'api-keys'] as const,
  list: () => [...API_KEY_KEYS.all, 'list'] as const,
  reservations: () => [...API_KEY_KEYS.all, 'reservations'] as const,
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
    onError: options?.onError,
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
    onError: options?.onError,
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
    onError: options?.onError,
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
    onError: options?.onError,
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
    onError: options?.onError,
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
    onError: options?.onError,
  })
}
