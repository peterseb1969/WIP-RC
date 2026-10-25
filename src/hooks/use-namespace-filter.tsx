import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

interface NamespaceFilterContextValue {
  namespace: string          // '' means "all namespaces"
  setNamespace: (ns: string) => void
}

const NamespaceFilterContext = createContext<NamespaceFilterContextValue>({
  namespace: '',
  setNamespace: () => {},
})

const STORAGE_KEY = 'rc-console:namespace-filter'

/**
 * Provides the console-wide namespace filter chosen in the top bar ('' = all
 * namespaces). Persisted to localStorage so the choice survives reloads.
 */
export function NamespaceFilterProvider({ children }: { children: ReactNode }) {
  const [namespace, setNamespaceRaw] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || '' } catch { return '' }
  })

  const setNamespace = useCallback((ns: string) => {
    setNamespaceRaw(ns)
    try { localStorage.setItem(STORAGE_KEY, ns) } catch { /* ignore */ }
  }, [])

  return (
    <NamespaceFilterContext.Provider value={{ namespace, setNamespace }}>
      {children}
    </NamespaceFilterContext.Provider>
  )
}

/** The current global namespace filter and its setter (see NamespaceFilterProvider). */
export function useNamespaceFilter() {
  return useContext(NamespaceFilterContext)
}

/**
 * Keeps `?ns=` in the URL and the global namespace filter in step, both ways,
 * so a page's URL always says which namespace it shows and can be shared.
 * Call this at the top of every page whose content the filter scopes.
 *
 * - When the URL's `?ns=` moves (page load, a link, back/forward), it wins: the
 *   filter is set to it, and the param stays in the URL.
 * - When the filter moves (the top-bar selector), the URL follows: `?ns=` is
 *   set, or removed for "All namespaces".
 * - With no `?ns=`, the saved filter applies and is written into the URL.
 */
export function useNamespaceInUrl() {
  const { namespace, setNamespace } = useContext(NamespaceFilterContext)
  const [searchParams, setSearchParams] = useSearchParams()
  const urlNs = searchParams.get('ns')
  // The filter's value at the previous run. Tracking the filter rather than the
  // URL keeps this idempotent when StrictMode runs the effect twice on mount.
  const lastNs = useRef<string | undefined>(undefined)

  useEffect(() => {
    const filterMoved = lastNs.current !== undefined && lastNs.current !== namespace
    lastNs.current = namespace
    const wanted = namespace || null
    if (urlNs === wanted) return
    if (urlNs !== null && !filterMoved) {
      setNamespace(urlNs)
      return
    }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (wanted) next.set('ns', wanted)
      else next.delete('ns')
      return next
    }, { replace: true })
  }, [urlNs, namespace, setNamespace, setSearchParams])
}
