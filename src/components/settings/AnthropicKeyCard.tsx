import { useState, useEffect, useCallback } from 'react'
import { Bot, Save, Trash2, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { apiUrl } from '@/lib/wip'
import { cn } from '@/lib/cn'

interface KeyStatus {
  available: boolean
  model?: string
  source: 'override' | 'env' | 'none'
  last4: string | null
}

/**
 * Anthropic API key — in-memory runtime override for the askBar / NL-query
 * feature. Mirrors APP-KB's pattern: a write-only password field that posts
 * the key to an admin-gated server endpoint, where it is validated with a
 * live probe and held in process memory only (never persisted, lost on
 * restart, falls back to the ANTHROPIC_API_KEY env var). The key is never
 * displayed — only the source + last-4 are shown.
 */
export default function AnthropicKeyCard() {
  const [status, setStatus] = useState<KeyStatus | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/nl/status'))
      if (res.ok) setStatus(await res.json() as KeyStatus)
    } catch { /* ignore — leave status null */ }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!key.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(apiUrl('/api/nl/anthropic-key'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setStatus(body as KeyStatus)
      setKey('')
      setMsg({ kind: 'ok', text: `Key validated and set — in-memory override active (…${body.last4}). Lost on server restart.` })
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Failed to set key' })
    } finally {
      setBusy(false)
    }
  }

  const clear = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(apiUrl('/api/nl/anthropic-key'), { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setStatus(body as KeyStatus)
      setMsg({
        kind: 'ok',
        text: body.source === 'env'
          ? 'Override cleared — using ANTHROPIC_API_KEY from the environment.'
          : 'Override cleared — no key configured.',
      })
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Failed to clear override' })
    } finally {
      setBusy(false)
    }
  }

  const source = status?.source ?? 'none'
  const last4 = status?.last4
  const sourceLabel =
    source === 'override' ? `Session override (…${last4})`
    : source === 'env' ? `Environment (…${last4})`
    : 'Not configured'

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-4 space-y-3">
      <div className="flex items-start gap-2">
        <Bot size={16} className="text-primary mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Anthropic API Key — askBar / NL Query</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Powers natural-language queries. Provide a key at runtime without a redeploy — it is held in server
            memory only, never written to disk, and lost on restart (falls back to the <code className="font-mono">ANTHROPIC_API_KEY</code> env
            var). Write-only: the key is never shown, and it applies to this server instance for everyone until cleared.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Current source:</span>
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md',
          source === 'none' ? 'bg-gray-100 text-gray-500' : 'bg-success/10 text-success',
        )}>
          {source !== 'none' && <CheckCircle size={10} />}
          {sourceLabel}
        </span>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="sk-ant-…"
          className="flex-1 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
        <button
          type="submit"
          disabled={busy || !key.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {busy ? 'Validating…' : 'Set key'}
        </button>
        {source === 'override' && (
          <button
            type="button"
            onClick={clear}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="Clear the override and fall back to the env key"
          >
            <Trash2 size={14} /> Clear
          </button>
        )}
      </form>

      {msg && (
        <div className={cn(
          'flex items-center gap-2 text-xs rounded-md px-3 py-2',
          msg.kind === 'ok' ? 'bg-success/5 text-success border border-success/20' : 'bg-danger/5 text-danger border border-danger/20',
        )}>
          {msg.kind === 'ok' ? <CheckCircle size={12} className="shrink-0" /> : <AlertTriangle size={12} className="shrink-0" />}
          {msg.text}
        </div>
      )}
    </div>
  )
}
