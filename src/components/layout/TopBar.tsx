import { Link } from 'react-router-dom'
import { Home, User, LogOut, Shield } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function TopBar() {
  const { user, isAuthenticated, isAnonymous, isLoading } = useAuth()

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <Home size={18} />
        </Link>
        <span className="text-sm font-medium text-gray-700">WIP Console</span>
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
              href="/auth/logout"
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
