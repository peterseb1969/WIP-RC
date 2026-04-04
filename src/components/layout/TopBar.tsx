import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function TopBar() {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <Home size={18} />
        </Link>
        <span className="text-sm font-medium text-gray-700">WIP Console</span>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>dev</span>
      </div>
    </header>
  )
}
