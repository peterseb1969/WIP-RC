import { useMemo, useState } from 'react'
import { Play, WrapText, Loader2 } from 'lucide-react'
import LazyCodeEditor from '@/components/editor/LazyCodeEditor'
import ErrorState from '@/components/common/ErrorState'
import DocumentList from '@/components/mongo/DocumentList'
import { useMongoFields, useMongoQuery, type MongoQueryResult } from '@/hooks/use-mongo'
import { mongoCompletionSource } from '@/lib/mongo-completions'
import { formatCode } from '@/lib/format-code'

const MAX_LIMIT = 500

/**
 * Read-only MongoDB query pad for one collection: filter, projection and sort
 * as Extended JSON (e.g. `{"_id": {"$oid": "…"}}`), plus limit and skip. Runs
 * on the server as the console's read-only MongoDB user; JavaScript operators
 * are rejected and every query is time-limited.
 */
export default function MongoQueryPanel({ database, collection }: { database: string; collection: string }) {
  const [filter, setFilter] = useState('{}')
  const [projection, setProjection] = useState('')
  const [sort, setSort] = useState('')
  const [limit, setLimit] = useState(50)
  const [skip, setSkip] = useState(0)
  const [result, setResult] = useState<MongoQueryResult | null>(null)
  const query = useMongoQuery()
  const { data: fields } = useMongoFields(database, collection)
  const completions = useMemo(() => mongoCompletionSource(fields ?? []), [fields])

  const run = (atSkip = skip) => {
    if (query.isPending) return
    setSkip(atSkip)
    query.mutate(
      { database, collection, filter, projection, sort, limit, skip: atSkip },
      { onSuccess: setResult, onError: () => setResult(null) },
    )
  }

  const formatAll = () => {
    const fmt = (text: string, set: (t: string) => void) =>
      formatCode('json', text).then(set).catch(() => { /* invalid JSON stays as typed; the lint marks it */ })
    void fmt(filter, setFilter)
    void fmt(projection, setProjection)
    void fmt(sort, setSort)
  }

  const editor = (label: string, value: string, onChange: (v: string) => void, placeholder: string, minHeight: number) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <LazyCodeEditor
        language="json"
        value={value}
        onChange={onChange}
        onRun={() => run(0)}
        completions={completions}
        ariaLabel={`${label} (Extended JSON)`}
        placeholder={placeholder}
        minHeight={minHeight}
        maxHeight={240}
      />
    </div>
  )

  const last = result ? result.skip + result.documents.length : 0

  return (
    <div className="space-y-3">
      {editor('Filter', filter, setFilter, '{"status": "active"}', 90)}
      <div className="grid grid-cols-2 gap-3">
        {editor('Projection', projection, setProjection, '{"value": 1, "_id": 0}', 60)}
        {editor('Sort', sort, setSort, '{"created_at": -1}', 60)}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs text-gray-600 flex items-center gap-1.5">
          Limit
          <input
            type="number"
            min={1}
            max={MAX_LIMIT}
            value={limit}
            onChange={e => setLimit(Math.min(MAX_LIMIT, Math.max(1, Number(e.target.value) || 1)))}
            className="w-20 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary"
          />
        </label>
        <button
          onClick={() => run(0)}
          disabled={query.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {query.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Find
        </button>
        <button
          onClick={formatAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50"
        >
          <WrapText size={14} />
          Format
        </button>
        <span className="text-xs text-gray-400">
          {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to run · Extended JSON, e.g. {'{"_id": {"$oid": "…"}}'}
        </span>
        {result && (
          <span className="text-xs text-gray-500 ml-auto">
            {result.total === 0
              ? 'No matching documents'
              : `${(result.skip + 1).toLocaleString()}–${last.toLocaleString()} of ${result.total.toLocaleString()} matching`}
            {' '}· {result.elapsedMs} ms
          </span>
        )}
      </div>

      {query.error && <ErrorState message={query.error.message} />}

      {result && result.documents.length > 0 && (
        <>
          <DocumentList key={`${result.skip}-${result.elapsedMs}`} documents={result.documents} />
          {result.total > result.limit && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => run(Math.max(0, result.skip - result.limit))}
                disabled={result.skip === 0 || query.isPending}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => run(result.skip + result.limit)}
                disabled={last >= result.total || query.isPending}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
