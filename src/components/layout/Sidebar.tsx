import { NavLink } from 'react-router-dom'
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
  Archive,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const navSections = [
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
      { to: '/terminologies', icon: BookOpen, label: 'Terminologies' },
      { to: '/templates', icon: FileCode2, label: 'Templates' },
      { to: '/documents', icon: FileText, label: 'Documents' },
      { to: '/files', icon: Files, label: 'Files' },
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
  return (
    <aside
      className={cn(
        'h-full bg-primary text-white/80 flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo / brand */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-primary-light">
        {!collapsed && (
          <span className="text-sm font-semibold text-white tracking-wide">RC Console</span>
        )}
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map(section => (
          <div key={section.label} className="mb-2">
            {!collapsed && (
              <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                {section.label}
              </div>
            )}
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-white/15 text-white font-medium'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
