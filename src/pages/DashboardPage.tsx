import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity as ActivityIcon,
  ChevronDown,
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
  Plus,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Layers,
} from 'lucide-react'
import { useActivity, useTerminologies, useTemplates, useDocuments } from '@wip/react'
import { useServiceHealth, type ServiceHealth } from '@/hooks/use-service-health'
import { useNamespaceStats, type NamespaceWithStats } from '@/hooks/use-namespace-stats'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import { cn } from '@/lib/cn'
import { apiUrl } from '@/lib/wip'

// ---------------------------------------------------------------------------
// Service Health Cards
// ---------------------------------------------------------------------------

const HEALTH_COLLAPSED_KEY = 'rc-console:health-collapsed'

function ServiceHealthGrid() {
  const { data: services, isLoading, refetch, dataUpdatedAt } = useServiceHealth()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(HEALTH_COLLAPSED_KEY) === '1' } catch { return false }
  })

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(HEALTH_COLLAPSED_KEY, next ? '1' : '0') } catch { /* ignore */ }
  }

  if (isLoading) return <LoadingState label="Checking services..." />

  const total = services?.length ?? 0
  const healthy = services?.filter(s => s.status === 'healthy').length ?? 0
  const unhealthy = services?.filter(s => s.status === 'unhealthy') ?? []
  const allHealthy = healthy === total

  const updatedAgo = dataUpdatedAt
    ? `${Math.round((Date.now() - dataUpdatedAt) / 1000)}s ago`
    : ''

  return (
    <section>
      <div className="flex items-center justify-between">
        <button onClick={toggle} className="flex items-center gap-2 group">
          <ChevronDown size={14} className={cn('text-gray-400 transition-transform', collapsed && '-rotate-90')} />
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors">Service Health</h2>
          {collapsed && (
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              allHealthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              {allHealthy ? `${total}/${total} healthy` : `${healthy}/${total} healthy — ${unhealthy.map(s => s.name).join(', ')}`}
            </span>
          )}
        </button>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
          title="Refresh health checks"
        >
          <RefreshCw size={12} />
          {updatedAgo}
        </button>
      </div>
      {!collapsed && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
          {services?.map(svc => (
            <ServiceCard key={svc.slug} service={svc} />
          ))}
        </div>
      )}
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
        <span className="ml-1 text-gray-300">{service.slug}</span>
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
  const { namespace } = useNamespaceFilter()
  const { data: allNamespaces, isLoading } = useNamespaceStats()

  if (isLoading) return <LoadingState label="Loading namespaces..." />

  const namespaces = namespace
    ? allNamespaces?.filter(ns => ns.prefix === namespace)
    : allNamespaces

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
        <Link to={`/terminologies?ns=${ns.prefix}`} className="hover:text-blue-600 transition-colors">{ns.terminologies} terms</Link>
        <Link to={`/templates?ns=${ns.prefix}`} className="hover:text-blue-600 transition-colors">{ns.templates} tpl</Link>
        <Link to={`/documents?ns=${ns.prefix}`} className="hover:text-blue-600 transition-colors">{ns.documents} docs</Link>
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
// Quick Actions
// ---------------------------------------------------------------------------

function QuickActions() {
  const { namespace } = useNamespaceFilter()
  const actions = [
    { label: 'New Terminology', to: '/terminologies', icon: BookOpen },
    { label: 'New Template', to: '/templates/new', icon: FileCode2, needsNs: true },
    { label: 'New Document', to: '/documents', icon: FileText },
    { label: 'Upload File', to: '/files', icon: Upload },
    { label: 'Import Docs', to: '/documents/import', icon: Upload },
  ]

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
      <div className="flex flex-wrap gap-2">
        {actions.map(a => {
          const disabled = a.needsNs && !namespace
          const Icon = a.icon
          return disabled ? (
            <span
              key={a.label}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-gray-100 text-gray-400 rounded-md cursor-not-allowed"
              title="Select a namespace first"
            >
              <Icon size={12} />
              {a.label}
            </span>
          ) : (
            <Link
              key={a.label}
              to={a.to}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-white border border-gray-200 text-gray-700 rounded-md hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              <Plus size={10} className="text-gray-400" />
              <Icon size={12} />
              {a.label}
            </Link>
          )
        })}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Data Quality Card
// ---------------------------------------------------------------------------

interface IntegritySummary {
  status: string
  summary: {
    total_templates: number
    total_documents: number
    documents_checked: number
    templates_with_issues: number
    documents_with_issues: number
  }
  checked_at: string
}

function DataQualityCard() {
  const [result, setResult] = useState<IntegritySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/wip/api/reporting-sync/health/integrity'))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Data Quality</h2>
        <Link to="/integrity" className="text-xs text-blue-500 hover:text-blue-700">Full report</Link>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {!result && !loading && !error && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Run an integrity check to verify data quality.</p>
            <button onClick={handleCheck} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600">
              <ShieldCheck size={12} />
              Run Check
            </button>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <RefreshCw size={14} className="animate-spin" />
            Running integrity check...
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={14} />{error}</span>
            <button onClick={handleCheck} className="text-xs text-blue-500 hover:text-blue-700">Retry</button>
          </div>
        )}
        {result && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.status === 'healthy' || result.status === 'ok' ? (
                  <CheckCircle size={16} className="text-green-500" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-500" />
                )}
                <span className={cn('text-sm font-medium', result.status === 'healthy' || result.status === 'ok' ? 'text-green-700' : 'text-amber-700')}>
                  {result.status === 'healthy' || result.status === 'ok' ? 'Healthy' : 'Issues found'}
                </span>
              </div>
              <button onClick={handleCheck} className="text-xs text-gray-400 hover:text-gray-600">
                <RefreshCw size={12} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center text-xs">
              <div>
                <div className="text-lg font-semibold text-gray-700">{result.summary.total_templates}</div>
                <div className="text-gray-400">Templates</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-700">{result.summary.documents_checked}</div>
                <div className="text-gray-400">Docs checked</div>
              </div>
              <div>
                <div className={cn('text-lg font-semibold', result.summary.templates_with_issues > 0 ? 'text-amber-600' : 'text-gray-700')}>
                  {result.summary.templates_with_issues}
                </div>
                <div className="text-gray-400">Tpl issues</div>
              </div>
              <div>
                <div className={cn('text-lg font-semibold', result.summary.documents_with_issues > 0 ? 'text-amber-600' : 'text-gray-700')}>
                  {result.summary.documents_with_issues}
                </div>
                <div className="text-gray-400">Doc issues</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Recent Items Grid
// ---------------------------------------------------------------------------

function RecentItemsGrid() {
  const { namespace } = useNamespaceFilter()
  const ns = namespace || undefined
  const { data: termsData } = useTerminologies({ namespace: ns, page_size: 5 })
  const { data: tplData } = useTemplates({ namespace: ns, latest_only: true, page_size: 5 })
  const { data: docsData } = useDocuments({ namespace: ns, page_size: 5 })

  const terminologies = termsData?.items ?? []
  const templates = tplData?.items ?? []
  const documents = docsData?.items ?? []

  if (terminologies.length === 0 && templates.length === 0 && documents.length === 0) return null

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Items</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Terminologies */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Terminologies</span>
            <Link to="/terminologies" className="text-[10px] text-blue-500 hover:text-blue-700">View all</Link>
          </div>
          {terminologies.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-4 text-center">None</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {terminologies.map(t => (
                <Link key={t.terminology_id} to={`/terminologies/${t.terminology_id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs">
                  <BookOpen size={10} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700 truncate">{t.label || t.value}</span>
                  <span className="text-gray-400 ml-auto shrink-0">{t.term_count ?? '—'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Templates */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Templates</span>
            <Link to="/templates" className="text-[10px] text-blue-500 hover:text-blue-700">View all</Link>
          </div>
          {templates.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-4 text-center">None</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {templates.map(t => (
                <Link key={t.template_id} to={`/templates/${t.template_id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs">
                  <FileCode2 size={10} className="text-indigo-400 shrink-0" />
                  <span className="text-gray-700 truncate">{t.label || t.value}</span>
                  <span className="text-gray-400 ml-auto shrink-0 flex items-center gap-1"><Layers size={8} />v{t.version ?? 1}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Documents</span>
            <Link to="/documents" className="text-[10px] text-blue-500 hover:text-blue-700">View all</Link>
          </div>
          {documents.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-4 text-center">None</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {documents.map(d => (
                <Link key={d.document_id} to={`/documents/${d.template_value ?? '_'}/${d.document_id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs">
                  <FileText size={10} className="text-gray-400 shrink-0" />
                  <span className="text-gray-700 truncate font-mono">{d.document_id.slice(0, 12)}...</span>
                  {d.template_value && <span className="text-indigo-400 ml-auto shrink-0">{d.template_value}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
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
      <QuickActions />
      <NamespaceSummary />
      <DataQualityCard />
      <RecentItemsGrid />
      <InfraQuickStatus />
      <RecentActivity />
    </div>
  )
}
