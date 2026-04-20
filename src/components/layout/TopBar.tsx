import { Link, useLocation } from 'react-router-dom'
import { Home, User, LogOut, Shield, FolderTree } from 'lucide-react'
import { useNamespaces } from '@wip/react'
import { useAuth } from '@/hooks/use-auth'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import { apiUrl } from '@/lib/wip'

// Routes where the namespace filter has no effect — infrastructure
// inspection pages read across the whole WIP instance.
const CROSS_NAMESPACE_PATHS = ['/postgres', '/mongodb', '/nats']

export default function TopBar() {
  const { user, isAuthenticated, isAnonymous, isLoading } = useAuth()
  const { namespace, setNamespace } = useNamespaceFilter()
  const { data: namespaces } = useNamespaces()
  const { pathname } = useLocation()
  const namespaceInactive = CROSS_NAMESPACE_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <Home size={18} />
        </Link>
        <span className="text-sm font-medium text-gray-700">WIP Console</span>

        {/* Namespace selector */}
        <div
          className="flex items-center gap-1.5 ml-2 pl-3 border-l border-gray-200"
          title={namespaceInactive ? 'Namespace filter does not apply on this page — data is shown across all namespaces.' : undefined}
        >
          <FolderTree size={14} className={namespaceInactive ? 'text-gray-300' : 'text-gray-400'} />
          <select
            value={namespace}
            onChange={e => setNamespace(e.target.value)}
            disabled={namespaceInactive}
            className={
              namespaceInactive
                ? 'text-sm text-gray-300 bg-transparent border-none focus:outline-none pr-1 py-0.5 cursor-not-allowed'
                : 'text-sm text-gray-600 bg-transparent border-none focus:outline-none cursor-pointer pr-1 py-0.5 hover:text-gray-900'
            }
          >
            <option value="">All namespaces</option>
            {namespaces
              ?.sort((a, b) => a.prefix.localeCompare(b.prefix))
              .map(ns => (
                <option key={ns.prefix} value={ns.prefix}>{ns.prefix}</option>
              ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {isLoading ? (
          <span className="text-gray-300 text-xs">...</span>
        ) : isAuthenticated && user ? (
          <>
            <div className="flex items-center gap-1.5 text-gray-500">
              <User size={14} />
              <span>{user.name || user.email}</span>
            </div>
            {user.groups && user.groups.length > 0 && (
              <div className="flex items-center gap-1 text-gray-400" title={`Groups: ${user.groups.join(', ')}`}>
                <Shield size={12} />
                <span className="text-xs">{user.groups.join(', ')}</span>
              </div>
            )}
            <a
              href={user.method === 'gateway' ? '/auth/logout' : apiUrl('/auth/logout')}
              className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={14} />
            </a>
          </>
        ) : isAnonymous ? (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Shield size={12} className="text-amber-400" />
            dev mode (no auth)
          </span>
        ) : (
          <span className="text-xs text-gray-400">offline</span>
        )}
      </div>
    </header>
  )
}
