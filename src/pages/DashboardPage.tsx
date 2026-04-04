import { Link } from 'react-router-dom'
import {
  Activity as ActivityIcon,
  Database,
  FolderTree,
  BookOpen,
  FileCode2,
  FileText,
  HardDrive,
  Radio,
  Server,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { useActivity } from '@wip/react'
import { useServiceHealth, type ServiceHealth } from '@/hooks/use-service-health'
import { useNamespaceStats, type NamespaceWithStats } from '@/hooks/use-namespace-stats'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Service Health Cards
// ---------------------------------------------------------------------------

function ServiceHealthGrid() {
  const { data: services, isLoading, refetch, dataUpdatedAt } = useServiceHealth()

  if (isLoading) return <LoadingState label="Checking services..." />

  const updatedAgo = dataUpdatedAt
    ? `${Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago`
    : ''

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Service Health</h2>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          title="Refresh health checks"
        >
          <RefreshCw size={12} />
          {updatedAgo}
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {services?.map(svc => (
          <ServiceCard key={svc.slug} service={svc} />
        ))}
      </div>
    </section>
  )
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 flex flex-col gap-2',
        service.status === 'healthy'
          ? 'border-green-200 bg-green-50/50'
          : service.status === 'unhealthy'
          ? 'border-red-200 bg-red-50/50'
          : 'border-yellow-200 bg-yellow-50/50'
      )}
    >
      <div className="flex items-center justify-between">
        <Server size={16} className="text-gray-400" />
        <StatusBadge status={service.status} />
      </div>
      <div className="text-sm font-medium text-gray-700 truncate">{service.name}</div>
      <div className="text-xs text-gray-400">
        {service.responseTimeMs !== null ? `${service.responseTimeMs}ms` : '—'}
        <span className="ml-1 text-gray-300">:{service.port}</span>
      </div>
      {service.error && (
        <div className="text-xs text-red-500 truncate" title={service.error}>
          {service.error}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Namespace Summary
// ---------------------------------------------------------------------------

function NamespaceSummary() {
  const { data: namespaces, isLoading } = useNamespaceStats()

  if (isLoading) return <LoadingState label="Loading namespaces..." />

  if (!namespaces || namespaces.length === 0) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Namespaces</h2>
        <p className="text-sm text-gray-400">No namespaces found.</p>
      </section>
    )
  }

  // Summary totals
  const totals = namespaces.reduce(
    (acc, ns) => ({
      terminologies: acc.terminologies + ns.terminologies,
      templates: acc.templates + ns.templates,
      documents: acc.documents + ns.documents,
    }),
    { terminologies: 0, templates: 0, documents: 0 }
  )

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Namespaces</h2>
        <Link to="/namespaces" className="text-xs text-blue-500 hover:text-blue-700">View all</Link>
      </div>

      {/* Totals bar */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <TotalCard icon={FolderTree} label="Namespaces" value={namespaces.length} to="/namespaces" />
        <TotalCard icon={BookOpen} label="Terminologies" value={totals.terminologies} to="/terminologies" />
        <TotalCard icon={FileCode2} label="Templates" value={totals.templates} to="/templates" />
        <TotalCard icon={FileText} label="Documents" value={totals.documents} to="/documents" />
      </div>

      {/* Per-namespace rows */}
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {namespaces.map(ns => (
          <NamespaceRow key={ns.prefix} ns={ns} />
        ))}
      </div>
    </section>
  )
}

function TotalCard({ icon: Icon, label, value, to }: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
  value: number
  to: string
}) {
  return (
    <Link
      to={to}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className="text-gray-400" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-gray-800">{value.toLocaleString()}</div>
    </Link>
  )
}

function NamespaceRow({ ns }: { ns: NamespaceWithStats }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <FolderTree size={14} className="text-gray-400" />
        <div>
          <span className="text-sm font-medium text-gray-700">{ns.prefix}</span>
          {ns.description && (
            <span className="text-xs text-gray-400 ml-2">{ns.description}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <span title="Terminologies">{ns.terminologies} terms</span>
        <span title="Templates">{ns.templates} tpl</span>
        <span title="Documents">{ns.documents} docs</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent Activity
// ---------------------------------------------------------------------------

function RecentActivity() {
  const { data, isLoading } = useActivity({ limit: 15 })

  if (isLoading) return <LoadingState label="Loading activity..." />

  const activities = data?.activities ?? []

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Activity</h2>
        <Link to="/activity" className="text-xs text-blue-500 hover:text-blue-700">View all</Link>
      </div>
      {activities.length === 0 ? (
        <p className="text-sm text-gray-400">No recent activity.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {activities.map((act, i) => (
            <div key={`${act.entity_id}-${act.timestamp}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
              <ActivityIcon size={14} className="text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-700">
                  <span className="font-medium capitalize">{act.action}</span>
                  {' '}
                  <span className="text-gray-500">{act.type}</span>
                </span>
                <span className="text-xs text-gray-400 ml-2 truncate">{act.entity_id}</span>
              </div>
              <div className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                <Clock size={10} />
                {formatTimestamp(act.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}d ago`
  } catch {
    return ts
  }
}

// ---------------------------------------------------------------------------
// Infrastructure Summary (quick status cards for PG, Mongo, NATS)
// ---------------------------------------------------------------------------

function InfraQuickStatus() {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Infrastructure</h2>
      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/postgres"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <Database size={16} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-700">PostgreSQL</span>
          </div>
          <p className="text-xs text-gray-400">Reporting layer, SQL queries</p>
        </Link>
        <Link
          to="/mongodb"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <HardDrive size={16} className="text-green-600" />
            <span className="text-sm font-medium text-gray-700">MongoDB</span>
          </div>
          <p className="text-xs text-gray-400">Document stores, collections</p>
        </Link>
        <Link
          to="/nats"
          className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 mb-2">
            <Radio size={16} className="text-purple-500" />
            <span className="text-sm font-medium text-gray-700">NATS</span>
          </div>
          <p className="text-xs text-gray-400">Event streams, consumers</p>
        </Link>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">System health and data overview</p>
      </div>

      <ServiceHealthGrid />
      <NamespaceSummary />
      <InfraQuickStatus />
      <RecentActivity />
    </div>
  )
}
