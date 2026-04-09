import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity as ActivityIcon,
  Clock,
  RefreshCw,
  BookOpen,
  Tag,
  FileCode2,
  FileText,
  Files,
  User,
  Filter,
} from 'lucide-react'
import { useActivity, useWipClient, useTerminologies } from '@wip/react'
import { useQuery } from '@tanstack/react-query'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import Pagination from '@/components/common/Pagination'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Entity type icon + color
// ---------------------------------------------------------------------------

function entityIcon(type: string) {
  switch (type) {
    case 'terminology': return <BookOpen size={12} className="text-blue-400" />
    case 'term': return <Tag size={12} className="text-orange-400" />
    case 'template': return <FileCode2 size={12} className="text-indigo-400" />
    case 'document': return <FileText size={12} className="text-green-400" />
    case 'file': return <Files size={12} className="text-pink-400" />
    default: return <ActivityIcon size={12} className="text-gray-400" />
  }
}

function actionBadge(action: string) {
  const colors: Record<string, string> = {
    created: 'bg-green-100 text-green-700',
    updated: 'bg-blue-100 text-blue-700',
    deleted: 'bg-red-100 text-red-700',
    deprecated: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', colors[action] ?? 'bg-gray-100 text-gray-600')}>
      {action}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Activity Feed Tab
// ---------------------------------------------------------------------------

function ActivityFeed() {
  const [typeFilter, setTypeFilter] = useState('')
  const [limit] = useState(50)
  const { data, isLoading, error, refetch } = useActivity({
    types: typeFilter || undefined,
    limit,
  })

  const activities = data?.activities ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Filter size={12} className="text-gray-400" />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="">All types</option>
          <option value="terminology">Terminologies</option>
          <option value="term">Terms</option>
          <option value="template">Templates</option>
          <option value="document">Documents</option>
          <option value="file">Files</option>
        </select>
        <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-gray-600" title="Refresh">
          <RefreshCw size={14} />
        </button>
        <span className="text-xs text-gray-400 ml-auto">{data?.total ?? 0} events</span>
      </div>

      {isLoading && <LoadingState label="Loading activity..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-400 p-6 text-center">No activity recorded.</p>
          ) : (
            activities.map((act, i) => (
              <div key={`${act.entity_id}-${act.timestamp}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                {entityIcon(act.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {actionBadge(act.action)}
                    <span className="text-xs text-gray-500">{act.type}</span>
                  </div>
                  <div className="text-xs text-gray-400 font-mono truncate mt-0.5">{act.entity_id}</div>
                </div>
                {act.user && (
                  <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                    <User size={10} />
                    {act.user}
                  </span>
                )}
                <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(act.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Terminology Audit Log Tab
// ---------------------------------------------------------------------------

function AuditLogTab() {
  const [selectedTerminology, setSelectedTerminology] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data: terminologies } = useTerminologies({ status: 'active', page_size: 1000 })
  const client = useWipClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['rc-console', 'audit-log', selectedTerminology, actionFilter, page],
    queryFn: () => {
      if (selectedTerminology) {
        return client.defStore.getTerminologyAuditLog(selectedTerminology, {
          action: actionFilter || undefined,
          page,
          page_size: 50,
        })
      }
      return client.defStore.getRecentAuditLog({
        action: actionFilter || undefined,
        page,
        page_size: 50,
      })
    },
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={12} className="text-gray-400" />
        <select
          value={selectedTerminology}
          onChange={e => { setSelectedTerminology(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="">All terminologies</option>
          {(terminologies?.items ?? []).map(t => (
            <option key={t.terminology_id} value={t.terminology_id}>{t.label || t.value}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="">All actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deprecated">Deprecated</option>
          <option value="deleted">Deleted</option>
        </select>
        <button onClick={() => refetch()} className="p-1.5 text-gray-400 hover:text-gray-600" title="Refresh">
          <RefreshCw size={14} />
        </button>
        <span className="text-xs text-gray-400 ml-auto">{data?.total ?? 0} entries</span>
      </div>

      {isLoading && <LoadingState label="Loading audit log..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">No audit entries found.</p>
            ) : (
              items.map((entry, i) => (
                <div key={`${entry.term_id}-${entry.changed_at}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                  <Tag size={12} className="text-orange-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {actionBadge(entry.action)}
                      <Link
                        to={`/terminologies/${entry.terminology_id}`}
                        className="text-xs text-blue-500 hover:text-blue-700 font-mono truncate"
                      >
                        {entry.terminology_id.slice(0, 8)}...
                      </Link>
                    </div>
                    <div className="text-xs text-gray-400 font-mono truncate mt-0.5">
                      term: {entry.term_id}
                    </div>
                    {entry.comment && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.comment}</p>
                    )}
                  </div>
                  {entry.changed_by && (
                    <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                      <User size={10} />
                      {entry.changed_by}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(entry.changed_at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
          {(data.total ?? 0) > 50 && (
            <Pagination page={page} totalPages={Math.ceil((data.total ?? 0) / 50)} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity Page
// ---------------------------------------------------------------------------

export default function ActivityPage() {
  const [tab, setTab] = useState<'activity' | 'audit'>('activity')

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Activity</h1>
        <p className="text-sm text-gray-400 mt-1">Cross-entity activity feed and terminology audit logs</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('activity')}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            tab === 'activity'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Activity Feed
        </button>
        <button
          onClick={() => setTab('audit')}
          className={cn(
            'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
            tab === 'audit'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Audit Log
        </button>
      </div>

      {tab === 'activity' && <ActivityFeed />}
      {tab === 'audit' && <AuditLogTab />}
    </div>
  )
}
