import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

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
