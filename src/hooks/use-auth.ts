import { useQuery } from '@tanstack/react-query'
import { apiUrl } from '@/lib/wip'

interface UserInfo {
  email?: string
  name?: string
  groups?: string[]
  anonymous?: boolean
  method?: 'gateway' | string
}

/**
 * Fetches current user info from the Express backend.
 *
 * When OIDC is configured:
 *   - Authenticated: returns { email, name, groups }
 *   - Unauthenticated: server redirects to Dex login (browser follows)
 *
 * When OIDC is not configured (dev mode):
 *   - Always returns { anonymous: true }
 */
export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery<UserInfo>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch(apiUrl('/api/me'))
      if (!res.ok) {
        // In production behind the gateway, a 401 means the gateway session
        // expired. Redirect to gateway login instead of showing stale UI.
        if (res.status === 401 && import.meta.env.PROD) {
          window.location.href = '/auth/login'
          return { anonymous: true } // won't render — redirect in progress
        }
        throw new Error(`Auth check failed: ${res.status}`)
      }
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })

  const isAuthenticated = !!data && !data.anonymous
  const isAnonymous = !!data?.anonymous

  return {
    user: data,
    isAuthenticated,
    isAnonymous,
    isLoading,
    error,
    refetch,
  }
}
