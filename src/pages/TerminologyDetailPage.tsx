import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  BookOpen,
  ArrowLeft,
  Hash,
  Tag,
  Copy,
  Check,
  RefreshCw,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { useTerminology, useTerms } from '@wip/react'
import type { Term } from '@wip/client'
import SearchInput from '@/components/common/SearchInput'
import Pagination from '@/components/common/Pagination'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import StatusBadge from '@/components/common/StatusBadge'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Term Row
// ---------------------------------------------------------------------------

function TermRow({ term }: { term: Term }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(term.value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const aliases = term.aliases ?? []

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
      <Tag size={14} className="text-gray-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{String(term.label ?? term.value)}</span>
          <button
            onClick={handleCopy}
            className="text-gray-300 hover:text-gray-500"
            title="Copy value"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-mono text-gray-400">{String(term.value)}</span>
          {aliases.length > 0 && (
            <span className="text-xs text-gray-300">
              aliases: {aliases.join(', ')}
            </span>
          )}
        </div>
        {term.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{term.description}</p>
        )}
      </div>
      <div className="shrink-0">
        <StatusBadge
          status={term.status === 'active' ? 'active' : term.status === 'deprecated' ? 'warning' : 'inactive'}
          label={String(term.status ?? 'unknown')}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Terminology Detail Page
// ---------------------------------------------------------------------------

export default function TerminologyDetailPage() {
  const { id } = useParams()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'deprecated' | ''>('active')

  const { data: terminology, isLoading: termLoading, error: termError } = useTerminology(id ?? '')
  const { data: termsData, isLoading: termsLoading, error: termsError, refetch } = useTerms(id ?? '', {
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    page_size: 50,
  })

  if (termLoading) return <LoadingState label="Loading terminology..." />
  if (termError) return <ErrorState message={termError.message} />
  if (!terminology) return <ErrorState message="Terminology not found" />

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div>
        <Link
          to="/terminologies"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 mb-2"
        >
          <ArrowLeft size={12} />
          Back to Terminologies
        </Link>
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-blue-500" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">
              {terminology.label || terminology.value}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-mono text-gray-400">{terminology.value}</span>
              {terminology.namespace && (
                <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {terminology.namespace}
                </span>
              )}
              <StatusBadge
                status={terminology.status === 'active' ? 'active' : 'inactive'}
                label={terminology.status}
              />
            </div>
          </div>
        </div>
        {terminology.description && (
          <p className="text-sm text-gray-500 mt-2">{terminology.description}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-6 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Hash size={10} />
          ID: {terminology.terminology_id}
        </span>
        {terminology.term_count !== undefined && (
          <span>{terminology.term_count} terms</span>
        )}
        {terminology.created_at && (
          <span>Created: {new Date(terminology.created_at).toLocaleDateString()}</span>
        )}
      </div>

      {/* Terms Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Terms</h2>
          <button
            onClick={() => refetch()}
            className="p-1.5 text-gray-400 hover:text-gray-600"
            title="Refresh terms"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search terms..."
            className="flex-1 max-w-sm"
          />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deprecated">Deprecated</option>
            <option value="">All</option>
          </select>
        </div>

        {/* Term list */}
        {termsLoading && <LoadingState label="Loading terms..." />}
        {termsError && <ErrorState message={termsError.message} onRetry={() => refetch()} />}

        {termsData && (
          <>
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {(termsData.items ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 p-6 text-center">No terms found.</p>
              ) : (
                (termsData.items ?? []).map(term => (
                  <TermRow key={term.term_id} term={term} />
                ))
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {termsData.total ?? 0} term{(termsData.total ?? 0) !== 1 ? 's' : ''} total
              </p>
              <Pagination
                page={page}
                totalPages={termsData.pages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
