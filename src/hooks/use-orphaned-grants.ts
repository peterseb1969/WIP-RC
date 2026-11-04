import { useWipClient } from '@wip/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GrantSubjectType } from '@wip/client'
import { GRANTS_QUERY_KEY } from '@/hooks/use-api-keys'

// Orphaned grants: grants a system restore wrote for a namespace that
// neither existed nor was reserved on this stack. They give nothing until
// activated: a platform admin creating the namespace activates every orphan
// on it, and a namespace admin can activate them on an existing namespace.
// A reservation holder creating the namespace activates nothing.

/** The activation rule, as shown to operators. */
export const ORPHAN_RULE =
  'An orphaned grant gives nothing. A system restore wrote it for a namespace this stack did not have. ' +
  'It becomes effective when a platform admin creates the namespace, or when a namespace admin activates it ' +
  'on an existing namespace. A reservation holder creating the namespace does not activate it.'

export const ORPHANED_GRANTS_KEY = ['rc-console', 'orphaned-grants'] as const

/** Every orphaned grant on the stack (platform admin listing). */
export function useOrphanedGrants() {
  const client = useWipClient()
  return useQuery({
    queryKey: ORPHANED_GRANTS_KEY,
    queryFn: async () => (await client.registry.listAllGrants({ orphaned: true, page_size: 1000 })).items,
    staleTime: 30_000,
  })
}

interface GrantRef { namespace: string; subject: string; subject_type: GrantSubjectType }

function useInvalidateGrants() {
  const qc = useQueryClient()
  return (namespace: string) => {
    qc.invalidateQueries({ queryKey: ORPHANED_GRANTS_KEY })
    qc.invalidateQueries({ queryKey: GRANTS_QUERY_KEY(namespace) })
  }
}

/** Activate an orphaned grant on its (existing) namespace. Bulk-first: a per-item error throws. */
export function useActivateGrant(onError?: (err: Error) => void) {
  const client = useWipClient()
  const invalidate = useInvalidateGrants()
  return useMutation({
    mutationFn: async ({ namespace, subject, subject_type }: GrantRef) => {
      const res = await client.registry.activateGrants(namespace, [{ subject, subject_type }])
      const item = res.results[0]
      if (item?.status === 'error') throw new Error(item.error ?? 'Activation failed')
      if (item?.status === 'not_found') throw new Error('Grant not found: it may have been revoked or activated already')
      return item
    },
    onSettled: (_d, _e, ref) => invalidate(ref.namespace),
    onError,
  })
}

/** Revoke a grant, orphaned or not. Bulk-first: a per-item error throws. */
export function useRevokeGrant(onError?: (err: Error) => void) {
  const client = useWipClient()
  const invalidate = useInvalidateGrants()
  return useMutation({
    mutationFn: async ({ namespace, subject, subject_type }: GrantRef) => {
      const res = await client.registry.revokeGrants(namespace, [{ subject, subject_type }])
      const item = res.results[0]
      if (item?.status === 'error') throw new Error(item.error ?? 'Revoke failed')
      if (item?.status === 'not_found') throw new Error('Grant not found: it may already be revoked')
      return item
    },
    onSettled: (_d, _e, ref) => invalidate(ref.namespace),
    onError,
  })
}
