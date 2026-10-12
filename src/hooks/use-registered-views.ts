import { useMutation, useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useNamespaces, useWipClient } from '@wip/react'
import type { DeleteViewResult, RegisterViewResult, RegisteredView } from '@wip/client'

// Registered reporting views (@wip/client 0.53.0). The list endpoint is
// per-namespace and there is no instance-wide listing, so the console fans out
// one listViews call per namespace and merges. @wip/react has no hooks for
// these yet — the typed client is called directly.

const VIEWS_KEY = ['rc-console', 'registered-views'] as const

export interface RegisteredViewsState {
  views: RegisteredView[]
  /** Namespaces whose listing failed, with the error — shown, never hidden. */
  failures: Array<{ namespace: string; message: string }>
  isLoading: boolean
  refetch: () => void
}

export function useRegisteredViews(): RegisteredViewsState {
  const client = useWipClient()
  const { data: namespaces, isLoading: nsLoading } = useNamespaces()
  const prefixes = (namespaces ?? []).filter(n => n.status !== 'deleted').map(n => n.prefix).sort()

  const results = useQueries({
    queries: prefixes.map(ns => ({
      queryKey: [...VIEWS_KEY, ns],
      queryFn: () => client.reporting.listViews(ns),
      staleTime: 60_000,
      retry: false,
    })),
  })

  const views: RegisteredView[] = []
  const failures: RegisteredViewsState['failures'] = []
  results.forEach((r, i) => {
    if (r.data) views.push(...r.data.views)
    else if (r.error) failures.push({ namespace: prefixes[i]!, message: (r.error as Error).message })
  })
  views.sort((a, b) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name))

  return {
    views,
    failures,
    isLoading: nsLoading || results.some(r => r.isLoading),
    refetch: () => results.forEach(r => r.refetch()),
  }
}

// A replaced view keeps its name, so cached row previews keyed on
// `SELECT * FROM "ns"."v"` would show the old definition's columns — drop
// them along with the namespace's listing.
function invalidateAfterChange(queryClient: QueryClient, namespace: string) {
  queryClient.invalidateQueries({ queryKey: [...VIEWS_KEY, namespace] })
  queryClient.invalidateQueries({ queryKey: ['rc-console', 'query-rows'] })
}

export interface RegisterViewInput {
  namespace: string
  name: string
  sql: string
  registered_by: string
}

export function useRegisterView() {
  const client = useWipClient()
  const queryClient = useQueryClient()
  return useMutation<RegisterViewResult, Error, RegisterViewInput>({
    mutationFn: ({ namespace, ...view }) => client.reporting.registerView(namespace, view),
    onSuccess: (_r, { namespace }) => invalidateAfterChange(queryClient, namespace),
  })
}

export function useDeleteView() {
  const client = useWipClient()
  const queryClient = useQueryClient()
  return useMutation<DeleteViewResult, Error, { namespace: string; name: string }>({
    mutationFn: ({ namespace, name }) => client.reporting.deleteView(namespace, name),
    onSuccess: (_r, { namespace }) => invalidateAfterChange(queryClient, namespace),
  })
}
