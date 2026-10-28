import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Eye, Fingerprint, Loader2 } from 'lucide-react'
import { useNamespaces, useTemplates, useWipClient, wipKeys } from '@wip/react'
import type { RehashIdentitiesItem, RehashIdentitiesRequest, RehashIdentitiesResponse } from '@wip/client'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import { maintenanceClient } from '@/lib/wip'
import { syncTemplateOptions } from '@/lib/batch-sync-templates'
import {
  applyBlockReason,
  previewIsCurrent,
  registryOutcome,
  shortHash,
  summarizeRegistry,
  type RehashScope,
} from '@/lib/identity-rehash'
import { cn } from '@/lib/cn'

// Rows shown from a pass: every scanned document that was not left unchanged is
// an item, which can be most of a large namespace.
const MAX_ITEM_ROWS = 200

const STATUS_STYLE: Record<RehashIdentitiesItem['status'], string> = {
  changed: 'bg-primary/10 text-primary-dark',
  unresolved: 'bg-yellow-100 text-yellow-700',
  collision: 'bg-danger/10 text-danger',
  error: 'bg-danger/10 text-danger',
}

interface Previewed {
  scope: RehashScope
  result: RehashIdentitiesResponse
}

function buildRequest(scope: RehashScope, dryRun: boolean): RehashIdentitiesRequest {
  return {
    namespace: scope.namespace,
    dry_run: dryRun,
    ...(scope.templates.length > 0 ? { template_values: [...scope.templates] } : {}),
  }
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'bad' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
      <div
        className={cn(
          'text-lg font-semibold',
          tone === 'bad' && value > 0 ? 'text-danger' : tone === 'warn' && value > 0 ? 'text-yellow-700' : 'text-gray-800'
        )}
      >
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}

function ItemsTable({ items, showRegistry }: { items: RehashIdentitiesItem[]; showRegistry: boolean }) {
  const shown = items.slice(0, MAX_ITEM_ROWS)
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-left text-gray-500 border-b border-gray-100">
          <tr>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Template</th>
            <th className="px-3 py-2 font-medium">Document</th>
            <th className="px-3 py-2 font-medium">Hash</th>
            {showRegistry && <th className="px-3 py-2 font-medium">Registry re-key</th>}
            <th className="px-3 py-2 font-medium">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {shown.map(item => {
            const outcome = registryOutcome(item)
            return (
              <tr key={item.document_id} className="align-top">
                <td className="px-3 py-2">
                  <span className={cn('px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[item.status])}>{item.status}</span>
                </td>
                <td className="px-3 py-2 font-mono text-gray-600">{item.template_value ?? '—'}</td>
                <td className="px-3 py-2 font-mono">
                  {item.template_value ? (
                    <Link
                      to={`/documents/${encodeURIComponent(item.template_value)}/${encodeURIComponent(item.document_id)}`}
                      className="text-primary hover:underline"
                    >
                      {item.document_id}
                    </Link>
                  ) : (
                    <span className="text-gray-600">{item.document_id}</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                  <span title={item.old_hash ?? ''}>{shortHash(item.old_hash)}</span>
                  {' → '}
                  <span title={item.new_hash ?? ''}>{shortHash(item.new_hash)}</span>
                </td>
                {showRegistry && (
                  <td
                    className={cn(
                      'px-3 py-2 font-mono',
                      outcome === 'failed' ? 'text-danger font-medium' : 'text-gray-600'
                    )}
                  >
                    {item.registry_status ?? '—'}
                  </td>
                )}
                <td className="px-3 py-2 text-gray-500">{item.detail ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {items.length > shown.length && (
        <p className="px-3 py-2 text-[11px] text-gray-400 border-t border-gray-100">
          Showing {shown.length.toLocaleString()} of {items.length.toLocaleString()}. Narrow the pass to one template
          to see the rest.
        </p>
      )}
    </div>
  )
}

function CollisionPanel({ result }: { result: RehashIdentitiesResponse }) {
  if (result.collision_groups.length === 0) return null
  return (
    <div className="bg-danger/5 border border-danger/20 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-danger">
        <AlertTriangle size={14} />
        {result.collision_groups.length.toLocaleString()} group{result.collision_groups.length !== 1 ? 's' : ''} of documents
        would end up with the same identity
      </div>
      <p className="text-xs text-gray-600">
        Collisions are only reported, never applied, and the documents in them are left untouched. They are documents
        that were stored apart but are the same thing once their term and reference fields resolve, and they need
        curating first. Retiring one side of a group does not clear the collision.
      </p>
      <ul className="space-y-1 text-xs">
        {result.collision_groups.map(group => (
          <li key={`${group.template_id}:${group.identity_hash}`} className="font-mono text-gray-600">
            <span title={group.identity_hash}>{shortHash(group.identity_hash)}</span>: {group.document_ids.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  )
}

function AppliedPanel({ result }: { result: RehashIdentitiesResponse }) {
  const registry = summarizeRegistry(result.items)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 rounded-lg border bg-white border-gray-200">
        <CheckCircle size={20} className="text-success shrink-0" />
        <div>
          <div className="text-sm font-medium text-gray-800">
            {result.applied.toLocaleString()} document{result.applied !== 1 ? 's' : ''} rewritten in {result.namespace}
          </div>
          <p className="text-xs text-gray-500">
            That counts documents whose stored hashes were rewritten, whether or not the Registry re-key for them
            succeeded. Check the Registry column below.
          </p>
        </div>
      </div>

      {registry.failed > 0 && (
        <div role="alert" className="bg-danger/5 border border-danger/20 rounded-lg p-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-danger">
            <AlertTriangle size={14} />
            The Registry re-key failed for {registry.failed.toLocaleString()} document{registry.failed !== 1 ? 's' : ''}
          </div>
          <p className="text-xs text-gray-600">
            Running the pass again does not retry a failed re-key, so do not use it as the fix. The documents are
            listed below with the status the Registry returned.
          </p>
        </div>
      )}

      {registry.byStatus.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-600">
          <div className="font-medium text-gray-700 mb-1">Registry re-key, by status returned</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono">
            {registry.byStatus.map(s => (
              <li key={s.status} className={s.failed ? 'text-danger' : undefined}>
                {s.status}: {s.count.toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-gray-700 space-y-1">
        <div className="font-medium">Reporting is not updated by this pass</div>
        <p className="whitespace-pre-wrap">{result.reporting_note}</p>
        <p className="text-gray-500">
          The <Link to="/postgres" className="text-primary hover:underline">PostgreSQL page</Link> has a Batch Sync tab
          for running syncs on a namespace.
        </p>
      </div>

      {result.items.length > 0 && <ItemsTable items={result.items} showRegistry />}
    </div>
  )
}

/**
 * Identity Maintenance: recompute stored identity hashes for one namespace
 * (document-store rehash pass). Always starts as a preview; Apply is offered
 * only for a preview of the scope now on screen that found something to change,
 * and the applied result keeps "rows rewritten" apart from the Registry outcome
 * because the platform counts the first whether or not the second succeeded.
 */
export default function IdentityMaintenancePage() {
  const client = useWipClient()
  const queryClient = useQueryClient()
  const { namespace: globalNamespace } = useNamespaceFilter()
  const { data: namespaces } = useNamespaces()
  const { data: templates } = useTemplates({ status: 'active', latest_only: true, page_size: 1000 })

  const [namespace, setNamespace] = useState(globalNamespace)
  const [selected, setSelected] = useState<string[]>([])
  const [previewed, setPreviewed] = useState<Previewed | null>(null)
  const [applied, setApplied] = useState<RehashIdentitiesResponse | null>(null)
  const [confirming, setConfirming] = useState(false)

  const form: RehashScope = { namespace, templates: selected }

  const facetsQ = useQuery({
    queryKey: ['rc-console', 'rehash-template-facets', namespace],
    queryFn: () => client.documents.getTemplateFacets({ namespace, status: 'all' }),
    enabled: Boolean(namespace),
    staleTime: 60_000,
  })
  const templateOptions = facetsQ.data ? syncTemplateOptions(templates?.items ?? [], facetsQ.data.facets) : []

  const preview = useMutation<RehashIdentitiesResponse, Error, RehashScope>({
    mutationFn: scope => maintenanceClient.documents.rehashIdentities(buildRequest(scope, true)),
    onSuccess: (result, scope) => setPreviewed({ scope, result }),
  })

  // A pass changes documents and Registry entries, so what other pages cached is
  // stale once it has run, including after a request that failed part-way.
  const apply = useMutation<RehashIdentitiesResponse, Error, RehashScope>({
    mutationFn: scope => maintenanceClient.documents.rehashIdentities(buildRequest(scope, false)),
    onSuccess: result => {
      setApplied(result)
      setPreviewed(null)
    },
    onSettled: () => {
      setConfirming(false)
      queryClient.invalidateQueries({ queryKey: wipKeys.documents.all })
      queryClient.invalidateQueries({ queryKey: wipKeys.registry.all })
    },
  })

  const busy = preview.isPending || apply.isPending
  const current = previewIsCurrent(previewed?.scope ?? null, form)
  const blockReason = applyBlockReason(previewed?.result ?? null, current)

  const changeNamespace = (ns: string) => {
    setNamespace(ns)
    setSelected([])
    setConfirming(false)
  }
  const toggleTemplate = (value: string) => {
    setSelected(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]))
    setConfirming(false)
  }
  const handlePreview = () => {
    setApplied(null)
    setPreviewed(null)
    setConfirming(false)
    apply.reset()
    preview.mutate(form)
  }
  const handleApply = () => {
    if (!previewed) return
    preview.reset()
    apply.mutate(previewed.scope)
  }

  const result = previewed?.result ?? null

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
          <Fingerprint size={24} className="text-primary" />
          Identity Maintenance
        </h1>
        <p className="text-sm text-gray-400 mt-1">Recompute stored identity hashes for one namespace</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <p className="text-xs text-gray-500">
          Documents written before identity hashing resolved term and reference fields carry a hash built from the
          spelling that was submitted. This pass recomputes the hash the way a new write would, so the same real-world
          thing is one identity. It covers one namespace at a time and needs admin rights. It always starts as a
          preview, and nothing is written until you apply. The call is synchronous, so a large namespace can take
          minutes.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="rehash-namespace" className="block text-xs font-medium text-gray-600 mb-1">Namespace *</label>
            <select
              id="rehash-namespace"
              value={namespace}
              onChange={e => changeNamespace(e.target.value)}
              disabled={busy}
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-primary disabled:bg-gray-50"
            >
              <option value="">Select namespace…</option>
              {(namespaces ?? []).filter(n => n.status !== 'deleted').map(n => (
                <option key={n.prefix} value={n.prefix}>{n.prefix}</option>
              ))}
            </select>
          </div>

          <fieldset disabled={busy || !namespace}>
            <legend className="block text-xs font-medium text-gray-600 mb-1">
              Templates <span className="font-normal text-gray-400">(none selected = every template)</span>
            </legend>
            <div className="border border-gray-200 rounded-md max-h-36 overflow-y-auto divide-y divide-gray-50 bg-white">
              {!namespace && <p className="px-2 py-1.5 text-xs text-gray-400">Pick a namespace first.</p>}
              {namespace && facetsQ.isLoading && <p className="px-2 py-1.5 text-xs text-gray-400">Loading templates…</p>}
              {namespace && facetsQ.isError && (
                <p className="px-2 py-1.5 text-xs text-danger">
                  Could not list this namespace&apos;s templates ({facetsQ.error.message}). The pass will cover every template.
                </p>
              )}
              {namespace && facetsQ.data && templateOptions.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-gray-400">This namespace has no documents.</p>
              )}
              {templateOptions.map(o => (
                <label key={o.template_id} className="flex items-center gap-2 px-2 py-1 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggleTemplate(o.value)}
                    className="accent-primary"
                  />
                  {o.text}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <button
          onClick={handlePreview}
          disabled={busy || !namespace}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {preview.isPending ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          {preview.isPending ? 'Previewing…' : 'Preview (nothing is written)'}
        </button>
      </div>

      {preview.error && (
        <div role="alert" className="bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 text-sm text-danger">
          Preview failed: {preview.error.message}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Preview of <span className="font-mono">{result.namespace}</span>
            {previewed && previewed.scope.templates.length > 0 && <> for {previewed.scope.templates.join(', ')}</>}. Nothing
            has been written.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Counter label="Scanned" value={result.scanned} />
            <Counter label="Would change" value={result.changed} />
            <Counter label="Unchanged" value={result.unchanged} />
            <Counter label="Unresolved" value={result.unresolved} tone="warn" />
            <Counter label="Collisions" value={result.collisions} tone="bad" />
            <Counter label="Errors" value={result.errors} tone="bad" />
          </div>

          {result.unresolved > 0 && (
            <p className="text-xs text-gray-500">
              Unresolved documents have no stored resolution to recompute from, so they are reported and left as they are.
            </p>
          )}
          <CollisionPanel result={result} />
          {result.items.length > 0 && <ItemsTable items={result.items} showRegistry={false} />}

          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            {!confirming ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setConfirming(true)}
                  disabled={busy || blockReason !== null}
                  title={blockReason ?? undefined}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-sm rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  Apply to {result.changed.toLocaleString()} document{result.changed !== 1 ? 's' : ''}…
                </button>
                {blockReason && <span className="text-xs text-gray-500">{blockReason}</span>}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-700">
                  Rewrite the identity hash of {result.changed.toLocaleString()} document
                  {result.changed !== 1 ? 's' : ''} in <span className="font-mono">{result.namespace}</span> and re-key
                  them in the Registry? Documents that collide, are unresolved or errored are left unchanged. The pass
                  is recomputed when it runs, so it may differ slightly from this preview. Running it again does not
                  retry a failed Registry re-key.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApply}
                    disabled={apply.isPending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-danger text-white text-sm rounded-md hover:opacity-90 disabled:opacity-50"
                  >
                    {apply.isPending && <Loader2 size={14} className="animate-spin" />}
                    {apply.isPending ? 'Applying…' : 'Apply rehash'}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={apply.isPending}
                    className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {apply.error && (
        <div role="alert" className="bg-danger/5 border border-danger/20 rounded-lg px-4 py-3 text-sm text-danger space-y-1">
          <div>Apply failed: {apply.error.message}</div>
          <p className="text-xs text-gray-600">
            The request failed, but the pass may have finished on the server. Run a preview to see what is left.
          </p>
        </div>
      )}

      {applied && <AppliedPanel result={applied} />}
    </div>
  )
}
