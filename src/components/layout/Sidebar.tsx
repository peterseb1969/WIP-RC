import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderTree,
  BookOpen,
  FileCode2,
  FileText,
  Files,
  BookMarked,
  Key,
  Database,
  HardDrive,
  Radio,
  ShieldCheck,
  Activity,
  Search,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Upload,
  Archive,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  children?: Array<{ to: string; label: string; icon?: React.ComponentType<{ size?: number; className?: string }> }>
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Data',
    items: [
      { to: '/namespaces', icon: FolderTree, label: 'Namespaces' },
      {
        to: '/terminologies', icon: BookOpen, label: 'Terminologies',
        children: [
          { to: '/terminologies', label: 'Browse' },
        ],
      },
      {
        to: '/templates', icon: FileCode2, label: 'Templates',
        children: [
          { to: '/templates', label: 'Browse' },
          { to: '/templates/new', label: 'New Template', icon: Plus },
        ],
      },
      {
        to: '/documents', icon: FileText, label: 'Documents',
        children: [
          { to: '/documents', label: 'Browse' },
          { to: '/documents/import', label: 'Import CSV', icon: Upload },
        ],
      },
      {
        to: '/files', icon: Files, label: 'Files',
        children: [
          { to: '/files', label: 'Browse' },
        ],
      },
      { to: '/registry', icon: BookMarked, label: 'Registry' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { to: '/postgres', icon: Database, label: 'PostgreSQL' },
      { to: '/mongodb', icon: HardDrive, label: 'MongoDB' },
      { to: '/nats', icon: Radio, label: 'NATS' },
    ],
  },
  {
    label: 'Health',
    items: [
      { to: '/integrity', icon: ShieldCheck, label: 'Integrity' },
      { to: '/audit-explorer', icon: Search, label: 'Audit Explorer' },
      { to: '/activity', icon: Activity, label: 'Activity' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/api-keys', icon: Key, label: 'API Keys' },
      { to: '/backup', icon: Archive, label: 'Backup & Restore' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/query', icon: MessageSquare, label: 'NL Query' },
    ],
  },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'h-full bg-gray-900 text-gray-300 flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo / brand */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-gray-800">
        {!collapsed && (
          <span className="text-sm font-semibold text-white tracking-wide">RC Console</span>
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map(section => (
          <div key={section.label} className="mb-2">
            {!collapsed && (
              <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {section.label}
              </div>
            )}
            {section.items.map(item => (
              <SidebarItem key={item.to} item={item} collapsed={collapsed} currentPath={location.pathname} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

function SidebarItem({ item, collapsed, currentPath }: { item: NavItem; collapsed: boolean; currentPath: string }) {
  const hasChildren = item.children && item.children.length > 0
  const isParentActive = currentPath.startsWith(item.to) && item.to !== '/'
  const [expanded, setExpanded] = useState(isParentActive)

  if (!hasChildren || collapsed) {
    return (
      <NavLink
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 px-4 py-2 text-sm transition-colors',
            isActive
              ? 'bg-gray-800 text-white border-r-2 border-blue-500'
              : 'hover:bg-gray-800/50 hover:text-white'
          )
        }
        title={collapsed ? item.label : undefined}
      >
        <item.icon size={18} />
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left',
          isParentActive ? 'text-white' : 'hover:bg-gray-800/50 hover:text-white'
        )}
      >
        <item.icon size={18} />
        <span className="flex-1">{item.label}</span>
        <ChevronDown size={14} className={cn('text-gray-500 transition-transform', !expanded && '-rotate-90')} />
      </button>
      {expanded && (
        <div className="ml-6 border-l border-gray-800">
          {item.children!.map(child => (
            <NavLink
              key={child.to}
              to={child.to}
              end
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 pl-4 pr-4 py-1.5 text-xs transition-colors',
                  isActive
                    ? 'text-white bg-gray-800'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                )
              }
            >
              {child.icon && <child.icon size={12} />}
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
