import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Key, Plug, Plus } from 'lucide-react'
import type { Attachment } from '@wip/client'
import RefreshButton from '@/components/common/RefreshButton'
import StatusBadge from '@/components/common/StatusBadge'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import { useAPIKeys } from '@/hooks/use-api-keys'
import { useAttachments, useDeactivateAttachment, useSaveAttachment } from '@/hooks/use-attachments'
import { draftFrom, keysOfApp, newDraft, requestFrom, type AttachmentDraft } from '@/lib/attachments'
import { isManaged, WIP_DEPLOY } from '@/lib/managed-records'
import { cn } from '@/lib/cn'
import { appUrl } from '@/lib/app-origins'
import { basePath } from '@/lib/wip'

const input = 'w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary-light'

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer" title={hint}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 rounded border-gray-300" />
      <span>{label}</span>
    </label>
  )
}

/** Create or edit form. On edit the name is fixed: it is the record's identity and its path. */
function AttachmentForm({ initial, isNew, onDone, onCancel }: {
  initial: AttachmentDraft
  isNew: boolean
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const [d, setD] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof AttachmentDraft>(k: K, v: AttachmentDraft[K]) => { setD(prev => ({ ...prev, [k]: v })); setError(null) }
  const save = useSaveAttachment(item => {
    const warn = item.warnings?.length ? ` ${item.warnings.join(' ')}` : ''
    onDone(`${item.status === 'unchanged' ? 'No change to' : isNew ? 'Attached' : 'Saved'} /apps/${item.name}.${warn}`)
  })

  const submit = () => {
    const built = requestFrom(d)
    if ('error' in built) { setError(built.error); return }
    save.mutate(built.request, { onError: err => setError(err.message) })
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3" role="group" aria-label={isNew ? 'Attach an app' : `Edit ${d.name}`}>
      {isNew && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-start gap-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>
            An attached app is served on WIP&apos;s own origin, under /apps/&lt;name&gt;, and receives its visitors&apos;
            requests. Its pages can act in the browser as the visitor. Attach only apps you trust.
          </span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="att-name" className="block text-xs text-gray-500 mb-1">Name *</label>
          <input id="att-name" className={cn(input, !isNew && 'bg-gray-100 text-gray-500')} value={d.name} readOnly={!isNew}
            onChange={e => set('name', e.target.value)} placeholder="my-app" />
          <p className="text-[10px] text-gray-400 mt-0.5">Served at /apps/{d.name.trim() || '<name>'}/</p>
        </div>
        <div>
          <label htmlFor="att-upstream" className="block text-xs text-gray-500 mb-1">Upstream *</label>
          <input id="att-upstream" className={input} value={d.upstream} onChange={e => set('upstream', e.target.value)}
            placeholder="http://my-app:8080" />
          <p className="text-[10px] text-gray-400 mt-0.5">Scheme, host and port only.</p>
        </div>
        <div>
          <label htmlFor="att-display" className="block text-xs text-gray-500 mb-1">Display name</label>
          <input id="att-display" className={input} value={d.display_name} onChange={e => set('display_name', e.target.value)} />
        </div>
        <div>
          <label htmlFor="att-health" className="block text-xs text-gray-500 mb-1">Health path</label>
          <input id="att-health" className={input} value={d.health} onChange={e => set('health', e.target.value)} placeholder="/api/health" />
          <p className="text-[10px] text-gray-400 mt-0.5">Probed by the router&apos;s app edge only.</p>
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-gray-500 mb-1">Gateway</legend>
        <Check label="Login required (behind the auth gateway)" checked={d.auth_required} onChange={v => set('auth_required', v)} />
        <div>
          <label htmlFor="att-groups" className="block text-xs text-gray-500 mb-1">Allowed groups <span className="text-gray-300">(comma-separated; empty: any logged-in user)</span></label>
          <input id="att-groups" className={input} value={d.allowed_groups} onChange={e => set('allowed_groups', e.target.value)} placeholder="wip-admins" />
        </div>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-gray-500 mb-1">Proxy</legend>
        <div className="grid grid-cols-2 gap-1.5">
          <Check label="Strip /apps/<name> before proxying" checked={d.strip_prefix} onChange={v => set('strip_prefix', v)} />
          <Check label="Redirect /apps/<name> to /apps/<name>/" checked={d.redirect_bare_path} onChange={v => set('redirect_bare_path', v)} />
          <Check label="Send the upstream's host as Host" checked={d.upstream_host_header} onChange={v => set('upstream_host_header', v)} />
          <Check label="Streaming (flush responses as they arrive)" checked={d.streaming} onChange={v => set('streaming', v)} />
          <Check label="UI only" checked={d.ui_only} onChange={v => set('ui_only', v)} />
        </div>
        <div>
          <label htmlFor="att-preserve" className="block text-xs text-gray-500 mb-1">Keep the prefix for these subpaths <span className="text-gray-300">(comma-separated, under /apps/&lt;name&gt;/)</span></label>
          <input id="att-preserve" className={input} value={d.preserve_prefix_subpaths} onChange={e => set('preserve_prefix_subpaths', e.target.value)} />
        </div>
      </fieldset>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-gray-500 mb-1">Upstream TLS</legend>
        <Check label="Verify the upstream's certificate (https upstreams)" checked={d.tls_verify} onChange={v => set('tls_verify', v)} />
        <div>
          <label htmlFor="att-ca" className="block text-xs text-gray-500 mb-1">CA certificate <span className="text-gray-300">(PEM, optional)</span></label>
          <textarea id="att-ca" rows={2} className={cn(input, 'font-mono text-xs')} value={d.ca_pem}
            onChange={e => set('ca_pem', e.target.value)} placeholder="-----BEGIN CERTIFICATE-----" spellCheck={false} />
        </div>
      </fieldset>

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={submit} disabled={save.isPending}
          className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50">
          {save.isPending ? 'Saving…' : isNew ? 'Attach' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-500 hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  )
}

function AttachmentRow({ a, expanded, onToggle, onMessage }: {
  a: Attachment
  expanded: boolean
  onToggle: () => void
  onMessage: (m: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: keys } = useAPIKeys()
  const appKeys = keysOfApp(keys?.items ?? [], a.name)
  const managed = isManaged(a)
  const deactivate = useDeactivateAttachment()
  const revive = useSaveAttachment(() => onMessage(`Revived /apps/${a.name}.`))

  const doRevive = () => {
    const built = requestFrom(draftFrom(a))
    if ('error' in built) { setError(built.error); return }
    setError(null)
    revive.mutate(built.request, { onError: err => setError(err.message) })
  }

  return (
    <div className="border-b border-gray-100 last:border-0" data-testid={`attachment-${a.name}`}>
      <button type="button" onClick={onToggle} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
        {expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
        <Plug size={15} className={a.status === 'active' ? 'text-primary' : 'text-gray-300'} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-800">{a.name}</span>
          {a.display_name && <span className="text-xs text-gray-400 ml-2">{a.display_name}</span>}
          <span className="text-xs text-gray-400 ml-2 font-mono">{a.path} → {a.upstream}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {managed && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{WIP_DEPLOY}</span>}
          {appKeys.length > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <Key size={8} /> {appKeys.length}
            </span>
          )}
          <StatusBadge status={a.status === 'active' ? 'active' : 'inactive'} label={a.status} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pl-12 space-y-3 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-500">
            {a.status === 'active' && (
              <a href={appUrl(a.name, window.location, basePath)} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">
                Open {a.path}/ <ExternalLink size={10} />
              </a>
            )}
            <span>Login: {a.auth_required ? (a.allowed_groups.length ? a.allowed_groups.join(', ') : 'any logged-in user') : 'not required'}</span>
            {a.health && <span>Health: {a.health}</span>}
            <span>TLS verify: {a.upstream_tls?.verify === false ? 'off' : 'on'}{a.upstream_tls?.ca_pem ? ', own CA' : ''}</span>
            <span>Updated {new Date(a.updated_at).toLocaleString()} by {a.updated_by}</span>
          </div>

          <div>
            <span className="text-gray-500">Keys of this app </span>
            <span className="text-gray-300">(API keys whose owner is app:{a.name})</span>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {appKeys.length === 0 && <span className="text-gray-400">none</span>}
              {appKeys.map(k => (
                <Link key={k.name} to="/api-keys" className="font-mono bg-gray-100 rounded px-1.5 py-0.5 text-gray-700 hover:bg-gray-200">{k.name}</Link>
              ))}
              {!managed && (
                <Link to={`/api-keys?create=1&owner=${encodeURIComponent(`app:${a.name}`)}`} className="text-primary inline-flex items-center gap-1">
                  <Plus size={11} /> Create a key for {a.name}
                </Link>
              )}
            </div>
          </div>

          {error && <p className="text-danger" role="alert">{error}</p>}
          {managed ? (
            <p className="text-gray-500">wip-deploy manages this attachment; change it in the install&apos;s manifests.</p>
          ) : editing ? (
            <AttachmentForm initial={draftFrom(a)} isNew={false}
              onDone={m => { setEditing(false); onMessage(m) }} onCancel={() => setEditing(false)} />
          ) : confirming ? (
            <div className="bg-danger/5 border border-danger/20 rounded-lg p-2.5 space-y-1.5">
              <p className="text-danger">Deactivate /apps/{a.name}? The router stops serving it; the record stays and can be revived.</p>
              <div className="flex gap-2">
                <button type="button" disabled={deactivate.isPending}
                  onClick={() => deactivate.mutate(a.name, {
                    onSuccess: () => { setConfirming(false); onMessage(`Deactivated /apps/${a.name}.`) },
                    onError: err => setError(err.message),
                  })}
                  className="px-2.5 py-1 bg-danger text-white rounded disabled:opacity-50">
                  {deactivate.isPending ? 'Deactivating…' : 'Yes, deactivate'}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="px-2.5 py-1 border border-gray-200 rounded text-gray-500">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(true)}
                className="px-2.5 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">Edit</button>
              {a.status === 'active' ? (
                <button type="button" onClick={() => { setError(null); setConfirming(true) }}
                  className="px-2.5 py-1.5 border border-gray-200 rounded-md text-danger/70 hover:text-danger hover:bg-danger/5">Deactivate</button>
              ) : (
                <button type="button" onClick={doRevive} disabled={revive.isPending}
                  className="px-2.5 py-1.5 border border-primary/30 rounded-md text-primary hover:bg-primary/5 disabled:opacity-50">
                  {revive.isPending ? 'Reviving…' : 'Revive'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AttachmentsPage() {
  const { data, isLoading, isFetching, error, refetch } = useAttachments()
  const [showCreate, setShowCreate] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const all = (data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
  const rows = showInactive ? all : all.filter(a => a.status === 'active')
  const inactiveCount = all.length - all.filter(a => a.status === 'active').length

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Attachments</h1>
          <p className="text-sm text-gray-400 mt-1">Apps served at /apps/&lt;name&gt; that wip-deploy doesn&apos;t deploy</p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshButton onRefresh={() => refetch({ cancelRefetch: false })} refreshing={isFetching && !isLoading}
            label="Refresh attachments" variant="boxed" />
          <button type="button" onClick={() => { setShowCreate(s => !s); setMessage(null) }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-dark">
            <Plus size={14} /> Attach an app
          </button>
        </div>
      </div>

      {message && <p className="text-xs text-success bg-success/5 border border-success/20 rounded px-3 py-2" role="status">{message}</p>}

      {showCreate && (
        <AttachmentForm initial={newDraft()} isNew
          onDone={m => { setShowCreate(false); setMessage(m) }} onCancel={() => setShowCreate(false)} />
      )}

      {isLoading && <LoadingState label="Loading attachments..." />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{rows.length} attachment{rows.length === 1 ? '' : 's'}{!showInactive && inactiveCount > 0 ? ` (${inactiveCount} inactive hidden)` : ''}</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
              Show inactive
            </label>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg">
            {rows.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">No attachments{!showInactive && inactiveCount ? ' active' : ''}.</p>
            ) : rows.map(a => (
              <AttachmentRow key={a.name} a={a} expanded={expanded === a.name}
                onToggle={() => setExpanded(p => (p === a.name ? null : a.name))} onMessage={setMessage} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
