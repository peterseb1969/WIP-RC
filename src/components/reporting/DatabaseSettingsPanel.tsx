import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useDbSettings } from '@/hooks/use-db-settings'
import {
  categoriesOf,
  contextInfo,
  filterSettings,
  formatValue,
  isNotDefault,
  overrideAppliesTo,
  sourceText,
  splitOverride,
  type DbSession,
  type PgOverride,
} from '@/lib/db-settings'
import SearchInput from '@/components/common/SearchInput'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { cn } from '@/lib/cn'

function SessionLine({ session }: { session: DbSession | null }) {
  if (!session) {
    return <p className="text-xs text-gray-500">The session that answered could not be identified.</p>
  }
  const version = session.version.split(' on ')[0]
  const started = session.session_started ? new Date(session.session_started).toLocaleString() : 'unknown'
  return (
    <p className="text-xs text-gray-500">
      Read by a pooled session of <span className="font-mono">{session.role}</span> on{' '}
      <span className="font-mono">{session.database}</span> · {version} · session started {started}
    </p>
  )
}

function OverridesTable({ overrides, session }: { overrides: PgOverride[]; session: DbSession | null }) {
  return (
    <section aria-labelledby="db-overrides-heading" className="bg-white border border-gray-200 rounded-lg">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h2 id="db-overrides-heading" className="text-sm font-semibold text-gray-700">
          Defaults set on a role or database
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          These apply to sessions that start afterwards. A session that is already open, including a pooled one, keeps
          the value it started with until it is recycled.
        </p>
      </div>
      {overrides.length === 0 ? (
        <p className="px-4 py-3 text-xs text-gray-400">No role or database carries its own defaults.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Database</th>
              <th className="px-4 py-2 font-medium">Setting</th>
              <th className="px-4 py-2 font-medium">Covers the session above</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {overrides.map(o => {
              const { name, value } = splitOverride(o.setting)
              const covers = session ? overrideAppliesTo(o, session) : null
              return (
                <tr key={`${o.role}|${o.database}|${o.setting}`}>
                  <td className="px-4 py-1.5 font-mono text-gray-600">{o.role}</td>
                  <td className="px-4 py-1.5 font-mono text-gray-600">{o.database}</td>
                  <td className="px-4 py-1.5 font-mono text-gray-800">
                    {name} = {value}
                  </td>
                  <td className="px-4 py-1.5 text-gray-500">{covers === null ? '—' : covers ? 'Yes' : 'No'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

/**
 * Database tab of the PostgreSQL page: a read-only view of the reporting
 * database's configuration as the reporting role's sessions see it. Every
 * setting with its value, where the value comes from and what it would take to
 * change it, plus the defaults a role or database carries. Nothing here
 * changes anything: those defaults are set by the platform's configuration or a
 * database administrator.
 */
export default function DatabaseSettingsPanel() {
  const { data, isLoading, error, refetch, isFetching } = useDbSettings()
  const [query, setQuery] = useState('')
  const [notDefaultOnly, setNotDefaultOnly] = useState(false)
  const [category, setCategory] = useState('')

  const categories = useMemo(() => categoriesOf(data?.settings ?? []), [data])
  const shown = useMemo(
    () => filterSettings(data?.settings ?? [], { query, notDefaultOnly, category }),
    [data, query, notDefaultOnly, category],
  )

  if (isLoading) return <LoadingState label="Reading database settings..." />
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />
  if (!data) return null

  const notDefaultCount = data.settings.filter(isNotDefault).length

  return (
    <div className="space-y-3 max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-gray-500">
            How the reporting database is configured, as the reporting role&apos;s sessions see it. Read-only: defaults
            are changed by the platform&apos;s configuration or by a database administrator, not here.
          </p>
          <SessionLine session={data.session} />
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <OverridesTable overrides={data.overrides} session={data.session} />

      <section aria-labelledby="db-settings-heading" className="bg-white border border-gray-200 rounded-lg">
        <div className="px-4 py-2.5 border-b border-gray-100 space-y-2">
          <h2 id="db-settings-heading" className="text-sm font-semibold text-gray-700">Settings</h2>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Filter by name, description or category…"
              className="w-72"
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
              <span className="sr-only">Category</span>
              <select
                aria-label="Category"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-primary"
              >
                <option value="">All categories</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notDefaultOnly}
                onChange={e => setNotDefaultOnly(e.target.checked)}
                className="accent-primary"
              />
              Not at default ({notDefaultCount})
            </label>
            <span className="ml-auto text-[11px] text-gray-400">
              {shown.length} of {data.settings.length} settings
            </span>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="px-4 py-3 text-xs text-gray-400">No setting matches the filter.</p>
        ) : (
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <caption className="sr-only">Database settings</caption>
              <thead className="text-left text-gray-500 border-b border-gray-100 sticky top-0 bg-white">
                <tr>
                  <th className="px-4 py-2 font-medium">Setting</th>
                  <th className="px-4 py-2 font-medium">Value</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">To change it</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shown.map(s => {
                  const ctx = contextInfo(s.context)
                  const changed = isNotDefault(s)
                  return (
                    <tr key={s.name} className="align-top">
                      <td className="px-4 py-1.5">
                        <div className="font-mono text-gray-800">{s.name}</div>
                        <div className="text-[11px] text-gray-400">{s.short_desc}</div>
                      </td>
                      <td className="px-4 py-1.5 font-mono text-gray-700 whitespace-nowrap">
                        {formatValue(s)}
                        {changed && s.boot_val !== null && s.boot_val !== s.setting && (
                          <div className="text-[10px] text-gray-400" title="The built-in default">
                            default {s.boot_val}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-1.5">
                        <span
                          title={sourceText(s.source)}
                          className={cn(
                            'px-1.5 py-0.5 rounded',
                            changed ? 'bg-primary/10 text-primary-dark font-medium' : 'text-gray-400',
                          )}
                        >
                          {s.source}
                        </span>
                      </td>
                      <td className="px-4 py-1.5 text-gray-500">
                        <span title={ctx.hint}>{ctx.label}</span>
                        {s.pending_restart && (
                          <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded bg-yellow-100 text-yellow-700">
                            restart pending
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-50">
          Some settings reserved for monitoring roles are not listed for this role.
        </p>
      </section>
    </div>
  )
}
