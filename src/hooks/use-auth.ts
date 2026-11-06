import { useQuery } from '@tanstack/react-query'
import { shouldReloadForLogin } from '@/lib/app-origins'
import { apiUrl } from '@/lib/wip'

/** When RC last reloaded to log in again (per tab), so a 401 that persists doesn't loop. */
const RELOGIN_KEY = 'rc-console:relogin-at'

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
          // Reload RC's own URL: the gateway takes the browser through its
          // login, or through its handshake on an app origin, where
          // /auth/login doesn't exist. Not repeated if it didn't help.
          let last: number | null = null
          try { last = Number(sessionStorage.getItem(RELOGIN_KEY)) || null } catch { /* storage blocked */ }
          if (shouldReloadForLogin(Date.now(), last)) {
            try { sessionStorage.setItem(RELOGIN_KEY, String(Date.now())) } catch { /* storage blocked */ }
            window.location.reload()
            return { anonymous: true } // won't render — reload in progress
          }
          throw new Error('Your session has ended and logging in again did not restore it. Reload the page to try again.')
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
