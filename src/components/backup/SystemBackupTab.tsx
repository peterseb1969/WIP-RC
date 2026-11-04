import { useState } from 'react'
import { AlertTriangle, Download, FileUp, Play, ShieldAlert } from 'lucide-react'
import { useWipClient } from '@wip/react'
import type { SystemArchive, SystemRestoreMode, SystemRestoreReport } from '@wip/client'
import { cn } from '@/lib/cn'
import {
  MIRROR_CONFIRMATION,
  MODE_HELP,
  OUTCOMES,
  SECTIONS,
  archiveFileName,
  canApply,
  outcomeIds,
  parseArchive,
  restoreErrorMessage,
} from '@/lib/system-restore'

// The Registry's auth state as one archive: API keys (hashes), grants,
// reservations and app attachments. Restore is a dry run first; only the
// options the dry run was made with can be applied, and a mirror asks for a
// typed confirmation because it removes records.

function SystemBackupCard() {
  const client = useWipClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const download = async () => {
    setBusy(true); setError(null); setSaved(null)
    try {
      const archive = await client.registry.systemBackup()
      const name = archiveFileName(window.location.hostname, archive.created_at)
      const url = URL.createObjectURL(new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
      setSaved(`${name}: ${archive.api_keys.length} keys, ${archive.grants.length} grants, ` +
        `${archive.reservations.length} reservations, ${archive.attachments.length} attachments`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
      <h2 className="text-sm font-medium text-gray-700">System backup</h2>
      <p className="text-xs text-gray-500">
        Saves the Registry&apos;s auth state as a JSON file: every API key (as its hash, never the key itself),
        grant, namespace reservation and app attachment. Namespace data is backed up on the Backup tab.
      </p>
      <p className="text-xs text-amber-700 flex items-start gap-1.5">
        <ShieldAlert size={12} className="shrink-0 mt-0.5" />
        <span>The file holds every key hash and the key salt. Store it like a secret.</span>
      </p>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-dark disabled:opacity-50"
      >
        <Download size={14} /> {busy ? 'Backing up…' : 'Download system backup'}
      </button>
      {saved && <p className="text-xs text-success" role="status">Saved {saved}.</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </section>
  )
}

function ReportView({ report }: { report: SystemRestoreReport }) {
  return (
    <div className="space-y-2" data-testid="restore-report">
      {report.warnings.map(w => (
        <p key={w} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-start gap-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" /> <span>{w}</span>
        </p>
      ))}
      {report.salt_adopted && (
        <p className="text-xs text-gray-600">
          {report.dry_run ? 'Applying would adopt' : 'Adopted'} the archive&apos;s key salt, so its key hashes work on this stack.
        </p>
      )}
      {report.refused && report.refused.length > 0 && (
        <div className="text-xs text-danger bg-danger/5 border border-danger/20 rounded px-2 py-1.5" role="alert">
          <p className="font-medium">Refused: this plan can&apos;t be applied.</p>
          <ul className="list-disc pl-4">
            {report.refused.map(r => <li key={r.id}><span className="font-mono">{r.id}</span>: {r.reason}</li>)}
          </ul>
        </div>
      )}
      <table className="w-full text-xs border border-gray-200 rounded">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50">
            <th className="px-2 py-1">Records</th>
            {OUTCOMES.map(o => <th key={o.key} className="px-2 py-1 font-medium">{o.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map(s => (
            <tr key={s.key} className="border-t border-gray-100" data-testid={`report-${s.key}`}>
              <td className="px-2 py-1 font-medium text-gray-700">{s.label}</td>
              {OUTCOMES.map(o => {
                const ids = outcomeIds(report[s.key], o.key)
                return (
                  <td key={o.key} className={cn('px-2 py-1', ids.length ? 'text-gray-800' : 'text-gray-300')} title={ids.join('\n') || undefined}>
                    {ids.length}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {SECTIONS.map(s => {
        const section = report[s.key]
        const lists = OUTCOMES
          .map(o => ({ o, ids: outcomeIds(section, o.key) }))
          .filter(x => x.ids.length && x.o.key !== 'unchanged' && x.o.key !== 'skipped')
        const skipped = section?.skipped ?? []
        if (!lists.length && !skipped.length) return null
        return (
          <details key={s.key} className="text-xs">
            <summary className="cursor-pointer text-gray-600">{s.label}: details</summary>
            <div className="pl-3 mt-1 space-y-1">
              {lists.map(({ o, ids }) => (
                <p key={o.key}><span className="text-gray-500">{o.label}:</span> <span className="font-mono">{ids.join(', ')}</span></p>
              ))}
              {skipped.length > 0 && (
                <ul className="list-disc pl-4 text-gray-600">
                  {skipped.map(k => (
                    <li key={k.id}><span className="font-mono">{k.id}</span> skipped: {k.reason} <span className="text-gray-400">({k.reason_code})</span></li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        )
      })}
    </div>
  )
}

function SystemRestoreCard() {
  const client = useWipClient()
  const [archive, setArchive] = useState<SystemArchive | null>(null)
  const [fileName, setFileName] = useState('')
  const [mode, setMode] = useState<SystemRestoreMode>('upsert')
  const [includeUserGrants, setIncludeUserGrants] = useState(false)
  const [dryRun, setDryRun] = useState<SystemRestoreReport | null>(null)
  const [applied, setApplied] = useState<SystemRestoreReport | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState<'dry' | 'apply' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // A dry run describes one archive with one set of options; any change
  // invalidates it, so Apply always applies what was reviewed.
  const reset = () => { setDryRun(null); setApplied(null); setConfirmText(''); setError(null) }

  const onFile = async (file: File | undefined) => {
    reset(); setArchive(null); setFileName('')
    if (!file) return
    const parsed = parseArchive(await file.text())
    if ('error' in parsed) { setError(parsed.error); return }
    setArchive(parsed.archive); setFileName(file.name)
  }

  const run = async (apply: boolean) => {
    if (!archive) return
    setBusy(apply ? 'apply' : 'dry'); setError(null)
    try {
      const report = await client.registry.systemRestore(archive, {
        dryRun: !apply,
        mode,
        includeUserGrants,
        ...(apply && mode === 'mirror' && dryRun?.plan_digest ? { expect: dryRun.plan_digest } : {}),
      })
      if (apply) { setApplied(report); setArchive(null); setFileName(''); setDryRun(null) } else setDryRun(report)
    } catch (err) {
      setError(restoreErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const confirmed = mode !== 'mirror' || confirmText.trim() === MIRROR_CONFIRMATION
  const applyAllowed = !!dryRun && canApply(dryRun) && confirmed && !busy

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-medium text-gray-700">System restore</h2>
      <p className="text-xs text-gray-500">
        Restores keys, grants, reservations and attachments from a system backup. Always a dry run first: Apply
        applies exactly the reviewed plan.
      </p>

      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 cursor-pointer">
        <FileUp size={14} /> {fileName || 'Choose a system backup…'}
        <input
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label="System backup file"
          onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }}
        />
      </label>

      {archive && (
        <>
          <p className="text-xs text-gray-500" data-testid="archive-summary">
            Taken {new Date(archive.created_at).toLocaleString()}
            {archive.source.oidc_issuer ? ` on ${archive.source.oidc_issuer}` : ''}: {archive.api_keys.length} keys,{' '}
            {archive.grants.length} grants, {archive.reservations.length} reservations, {archive.attachments.length} attachments.
          </p>
          <fieldset className="space-y-1" aria-label="Restore mode">
            {(['upsert', 'overwrite', 'mirror'] as const).map(m => (
              <label key={m} className="flex items-start gap-2 text-xs cursor-pointer">
                <input type="radio" name="restore-mode" value={m} checked={mode === m}
                  onChange={() => { setMode(m); reset() }} className="mt-0.5" />
                <span><span className="font-medium text-gray-700">{m}</span> <span className="text-gray-500">— {MODE_HELP[m]}</span></span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={includeUserGrants} onChange={e => { setIncludeUserGrants(e.target.checked); reset() }} />
            Restore user grants even if the archive comes from another login provider (OIDC issuer)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => run(false)}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-sm rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Play size={14} /> {busy === 'dry' ? 'Running dry run…' : 'Dry run'}
            </button>
          </div>
        </>
      )}

      {error && <p className="text-xs text-danger" role="alert">{error}</p>}

      {dryRun && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dry run ({dryRun.mode ?? mode})</h3>
          <ReportView report={dryRun} />
          {mode === 'mirror' && canApply(dryRun) && (
            <label className="block text-xs text-danger">
              A mirror removes the records listed as deleted. Type <span className="font-mono font-semibold">{MIRROR_CONFIRMATION}</span> to apply:
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                aria-label="Type mirror to confirm"
                className="ml-2 border border-danger/40 rounded px-2 py-0.5 text-xs w-28"
              />
            </label>
          )}
          <button
            type="button"
            onClick={() => run(true)}
            disabled={!applyAllowed}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md text-white disabled:opacity-50',
              mode === 'mirror' ? 'bg-danger hover:bg-danger' : 'bg-primary hover:bg-primary-dark',
            )}
          >
            {busy === 'apply' ? 'Applying…' : `Apply ${mode}`}
          </button>
        </div>
      )}

      {applied && (
        <div className="space-y-2 border-t border-gray-100 pt-3" role="status">
          <h3 className="text-xs font-semibold text-success uppercase tracking-wider">Applied ({applied.mode ?? mode})</h3>
          <ReportView report={applied} />
        </div>
      )}
    </section>
  )
}

export default function SystemBackupTab() {
  return (
    <div className="space-y-4">
      <SystemBackupCard />
      <SystemRestoreCard />
    </div>
  )
}
