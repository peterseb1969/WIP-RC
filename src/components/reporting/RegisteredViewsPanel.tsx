import { useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Eye,
  FlaskConical,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { useNamespaces } from '@wip/react'
import type { RegisteredView } from '@wip/client'
import DataTable from '@/components/common/DataTable'
import SearchInput from '@/components/common/SearchInput'
import LoadingState from '@/components/common/LoadingState'
import { cn } from '@/lib/cn'
import { useAuth } from '@/hooks/use-auth'
import { useQueryRows, useRunQuery } from '@/hooks/use-reporting'
import { useDeleteView, useRegisterView, useRegisteredViews } from '@/hooks/use-registered-views'
import {
  consoleRegistrant,
  filterViews,
  isExternallyOwned,
  previewSql,
  selectFromView,
  viewKey,
} from '@/lib/registered-views'

// ---------------------------------------------------------------------------
// RegisteredViewsPanel — named SQL views a namespace keeps in its reporting
// schema. Lists every namespace's views (they are not in the /tables
// inventory), shows each view's definition and rows, and creates, replaces
// and deletes them. Replace is the platform's register-by-name: the column
// set may change freely.
// ---------------------------------------------------------------------------

type Mode =
  | { kind: 'idle' }
  | { kind: 'view'; key: string }
  | { kind: 'new' }
  | { kind: 'edit'; key: string }

interface Props {
  onOpenInQueryPad: (sql: string, namespace: string) => void
}

/**
 * Views tab of the PostgreSQL page: every namespace's registered views with
 * definition, row preview, create/replace (with a Test run first) and delete.
 * `onOpenInQueryPad` hands a read of the selected view to the Query Pad tab.
 */
export default function RegisteredViewsPanel({ onOpenInQueryPad }: Props) {
  const { views, failures, isLoading, refetch } = useRegisteredViews()
  const [nsFilter, setNsFilter] = useState('')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })

  const visible = useMemo(() => filterViews(views, nsFilter, search), [views, nsFilter, search])
  const byNamespace = useMemo(() => {
    const groups = new Map<string, RegisteredView[]>()
    for (const v of visible) groups.set(v.namespace, [...(groups.get(v.namespace) ?? []), v])
    return [...groups.entries()]
  }, [visible])
  const viewNamespaces = useMemo(() => [...new Set(views.map(v => v.namespace))].sort(), [views])

  const selectedKey = mode.kind === 'view' || mode.kind === 'edit' ? mode.key : null
  const selected = selectedKey ? views.find(v => viewKey(v) === selectedKey) ?? null : null

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Left: view list */}
      <div className="col-span-4 bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col max-h-[calc(100vh-280px)]">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Registered views</h3>
            <span className="text-xs text-gray-400">{views.length}</span>
            <button
              onClick={refetch}
              className="ml-auto p-1 text-gray-400 hover:text-gray-600"
              title="Reload views"
              aria-label="Reload views"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => setMode({ kind: 'new' })}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-white text-xs rounded-md hover:bg-primary-dark"
            >
              <Plus size={12} />
              New view
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={nsFilter}
              onChange={e => setNsFilter(e.target.value)}
              className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-600 bg-white focus:outline-none focus:border-primary"
              aria-label="Filter by namespace"
            >
              <option value="">All namespaces</option>
              {viewNamespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
            </select>
            <SearchInput value={search} onChange={setSearch} placeholder="Name or SQL…" className="flex-1" />
          </div>
        </div>

        {failures.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-100 bg-amber-50 text-xs text-amber-700 space-y-0.5">
            {failures.map(f => (
              <div key={f.namespace} className="flex items-start gap-1.5">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>Couldn't list views in <span className="font-mono">{f.namespace}</span>: {f.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {isLoading && views.length === 0 ? (
            <LoadingState label="Loading views…" />
          ) : views.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">
              No registered views yet. A view saves a query — joins, roll-ups, hierarchy walks — under a
              name that can then be queried like a table.
            </p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No views match the filter.</p>
          ) : (
            byNamespace.map(([ns, nsViews]) => (
              <div key={ns}>
                <div className="px-3 py-1.5 bg-gray-50 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                  {ns}
                </div>
                {nsViews.map(v => (
                  <button
                    key={viewKey(v)}
                    onClick={() => setMode({ kind: 'view', key: viewKey(v) })}
                    className={cn(
                      'w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-gray-50',
                      selectedKey === viewKey(v) && 'bg-primary/5',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Eye size={12} className="text-gray-400 shrink-0" />
                      <span className="font-mono text-xs text-gray-800 truncate">{v.name}</span>
                    </div>
                    {v.registered_by && (
                      <div className="text-[11px] text-gray-400 truncate pl-[18px]">{v.registered_by}</div>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: detail / editor */}
      <div className="col-span-8">
        {mode.kind === 'new' && (
          <ViewEditor
            key="new"
            onCancel={() => setMode({ kind: 'idle' })}
            onSaved={v => setMode({ kind: 'view', key: viewKey(v) })}
            defaultNamespace={nsFilter}
          />
        )}
        {mode.kind === 'edit' && selected && (
          <ViewEditor
            key={`edit:${selectedKey}`}
            existing={selected}
            onCancel={() => setMode({ kind: 'view', key: viewKey(selected) })}
            onSaved={v => setMode({ kind: 'view', key: viewKey(v) })}
          />
        )}
        {mode.kind === 'view' && selected && (
          <ViewDetail
            key={selectedKey}
            view={selected}
            onEdit={() => setMode({ kind: 'edit', key: viewKey(selected) })}
            onDeleted={() => setMode({ kind: 'idle' })}
            onOpenInQueryPad={onOpenInQueryPad}
          />
        )}
        {(mode.kind === 'idle' || ((mode.kind === 'view' || mode.kind === 'edit') && !selected)) && (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">
            Select a view to see its definition and rows, or create a new one
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

function ViewDetail({
  view,
  onEdit,
  onDeleted,
  onOpenInQueryPad,
}: {
  view: RegisteredView
  onEdit: () => void
  onDeleted: () => void
  onOpenInQueryPad: (sql: string, namespace: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const deleteView = useDeleteView()
  const readSql = selectFromView(view, 100)
  const rows = useQueryRows(readSql, view.namespace)

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h3 className="font-mono text-base font-semibold text-gray-800 truncate">{view.name}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{view.namespace}</span>
              {view.registered_by && <span>by {view.registered_by}</span>}
              {view.registered_at && <span>{new Date(view.registered_at).toLocaleString()}</span>}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenInQueryPad(readSql, view.namespace)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
            >
              <Play size={12} />
              Open in Query Pad
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
            >
              <Pencil size={12} />
              Edit
            </button>
            {!confirmDelete && (
              <button
                onClick={() => { deleteView.reset(); setConfirmDelete(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-danger/30 rounded-md text-danger hover:bg-danger/5"
              >
                <Trash2 size={12} />
                Delete
              </button>
            )}
          </div>
        </div>

        {confirmDelete && (
          <div className="flex items-center gap-2 px-3 py-2 bg-danger/5 border border-danger/20 rounded-md text-xs">
            <span className="text-danger">
              Delete <span className="font-mono">{view.name}</span>? Queries that read it will stop working.
            </span>
            <button
              onClick={() => deleteView.mutate({ namespace: view.namespace, name: view.name }, { onSuccess: onDeleted })}
              disabled={deleteView.isPending}
              className="ml-auto inline-flex items-center gap-1 px-2 py-1 bg-danger text-white rounded hover:bg-danger/90 disabled:opacity-50"
            >
              {deleteView.isPending && <Loader2 size={11} className="animate-spin" />}
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
        {deleteView.error && <ErrorBox message={deleteView.error.message} />}

        {isExternallyOwned(view) && <OwnershipNote registeredBy={view.registered_by!} />}

        <pre className="font-mono text-xs bg-gray-50 border border-gray-100 rounded-md p-3 whitespace-pre-wrap text-gray-700 max-h-64 overflow-y-auto">
          {view.sql}
        </pre>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium">Rows</span>
          {rows.data && !rows.error && rows.data.row_count > 0 && (
            <span className="text-gray-400">first {rows.data.row_count} shown</span>
          )}
        </div>
        {rows.isLoading && <LoadingState label="Reading view…" />}
        {rows.error && <ErrorBox message={(rows.error as Error).message} />}
        {/* On a failed refetch the query keeps its previous data — never show
            those rows under the error, they belong to an older definition. */}
        {rows.data && !rows.error && rows.data.rows.length > 0 && (
          <DataTable columns={rows.data.columns} rows={rows.data.rows} maxHeight="400px" />
        )}
        {rows.data && !rows.error && rows.data.rows.length === 0 && (
          <p className="text-sm text-gray-400">The view returns no rows.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Editor (create / replace)
// ---------------------------------------------------------------------------

function ViewEditor({
  existing,
  defaultNamespace,
  onCancel,
  onSaved,
}: {
  existing?: RegisteredView
  defaultNamespace?: string
  onCancel: () => void
  onSaved: (view: { namespace: string; name: string }) => void
}) {
  const isEdit = !!existing
  const { data: namespaces } = useNamespaces()
  const { user } = useAuth()
  const [namespace, setNamespace] = useState(existing?.namespace ?? defaultNamespace ?? '')
  const [name, setName] = useState(existing?.name ?? 'v_')
  const [sql, setSql] = useState(existing?.sql ?? 'SELECT ')
  const register = useRegisterView()
  const test = useRunQuery()

  const canRun = !!namespace && !!sql.trim()
  const canSave = canRun && !!name.trim() && name.trim() !== 'v_'

  const handleTest = () => {
    register.reset()
    test.mutate({ sql: previewSql(sql), namespace })
  }
  const handleSave = () => {
    test.reset()
    register.mutate(
      { namespace, name: name.trim(), sql: sql.trim(), registered_by: consoleRegistrant(user) },
      { onSuccess: r => onSaved({ namespace: r.namespace, name: r.name }) },
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">
            {isEdit ? <>Edit <span className="font-mono">{existing.name}</span></> : 'New view'}
          </h3>
          <button onClick={onCancel} className="ml-auto p-1 text-gray-400 hover:text-gray-600" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {isEdit && isExternallyOwned(existing) && <OwnershipNote registeredBy={existing.registered_by!} />}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Namespace *</label>
            <select
              value={namespace}
              onChange={e => setNamespace(e.target.value)}
              disabled={isEdit}
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-primary disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">Select namespace…</option>
              {(namespaces ?? []).filter(n => n.status !== 'deleted').map(n => (
                <option key={n.prefix} value={n.prefix}>{n.prefix}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isEdit}
              spellCheck={false}
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-primary disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-400">
          {isEdit
            ? 'Saving replaces the definition; the columns may change. To rename or move a view, create a new one and delete this one.'
            : 'Start the name with v_ — doc_* and other names the reporting layer uses for its own tables are reserved.'}
        </p>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">SQL *</label>
          <textarea
            value={sql}
            onChange={e => setSql(e.target.value)}
            spellCheck={false}
            rows={10}
            className="w-full font-mono text-sm bg-gray-900 text-success/60 rounded-lg border border-gray-700 p-3 focus:outline-none focus:border-primary"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            One read-only SELECT (a WITH … SELECT is fine). Unqualified names — doc_&lt;template&gt;, terms,
            term_relations — resolve in the chosen namespace; other namespaces need "ns".doc_x. Every table
            it reads must already exist.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={!canRun || test.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {test.isPending ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}
            Test
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || register.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {register.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save
          </button>
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>

        {register.error && <ErrorBox message={register.error.message} />}
        {test.error && <ErrorBox message={test.error.message} />}
      </div>

      {test.data && (
        <div className="space-y-2">
          <div className="text-xs text-gray-500">
            <span className="font-medium">Test result</span>
            <span className="text-gray-400"> — {test.data.row_count > 0 ? `first ${test.data.row_count} rows` : 'no rows'}; nothing saved yet</span>
          </div>
          {test.data.rows.length > 0 ? (
            <DataTable columns={test.data.columns} rows={test.data.rows} maxHeight="320px" />
          ) : (
            <p className="text-sm text-gray-400">The query returns no rows.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function OwnershipNote({ registeredBy }: { registeredBy: string }) {
  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
      <span>
        Registered by <span className="font-mono">{registeredBy}</span>. Apps typically re-register their views
        each time they start, which would replace changes made here.
      </span>
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-danger/5 border border-danger/20 rounded-lg text-sm text-danger">
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <div className="font-mono text-xs whitespace-pre-wrap">{message}</div>
    </div>
  )
}
