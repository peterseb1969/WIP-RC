import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
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

export function useNamespaceFilter() {
  return useContext(NamespaceFilterContext)
}

/**
 * Reads `?ns=` from the URL and syncs it to the global namespace filter.
 * Call this at the top of any list page that should respect namespace overrides
 * from cross-page links (e.g. namespace stats on the Namespaces page).
 * The param is consumed (removed from URL) after syncing to keep URLs clean.
 */
export function useSyncNamespaceFromUrl() {
  const { setNamespace } = useContext(NamespaceFilterContext)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const ns = searchParams.get('ns')
    if (ns !== null) {
      setNamespace(ns)
      searchParams.delete('ns')
      setSearchParams(searchParams, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount
}
