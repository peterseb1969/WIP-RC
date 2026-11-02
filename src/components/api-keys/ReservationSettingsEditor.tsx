import { AlertTriangle } from 'lucide-react'
import { guardedWarnings, type ReservationDraft } from '@/lib/key-reservations'

const inputClass =
  'w-full border border-gray-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:border-primary-light'

/**
 * The six settings a reserved namespace is created with, filled with the
 * platform defaults. The key's bootstrap creates the namespace with exactly
 * these; it can't change them.
 */
export default function ReservationSettingsEditor({ prefix, draft, onChange }: {
  prefix: string
  draft: ReservationDraft
  onChange: (draft: ReservationDraft) => void
}) {
  const set = <K extends keyof ReservationDraft>(key: K, value: ReservationDraft[K]) =>
    onChange({ ...draft, [key]: value })
  const id = (field: string) => `reserve-${prefix || 'new'}-${field}`
  const warnings = guardedWarnings(draft)

  return (
    <div
      className="border border-primary/20 bg-primary/5 rounded-md p-2.5 space-y-2"
      role="group"
      aria-label={`Reservation settings for ${prefix || 'the new namespace'}`}
    >
      <p className="text-[11px] text-gray-500">
        The key gets admin on <span className="font-mono">{prefix || 'this namespace'}</span> and its
        bootstrap creates it with exactly these settings.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-3">
          <label htmlFor={id('description')} className="block text-[10px] text-gray-500 mb-0.5">Description</label>
          <input id={id('description')} type="text" value={draft.description}
            onChange={e => set('description', e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor={id('isolation')} className="block text-[10px] text-gray-500 mb-0.5">Isolation mode</label>
          <select id={id('isolation')} value={draft.isolation_mode}
            onChange={e => set('isolation_mode', e.target.value as ReservationDraft['isolation_mode'])}
            className={inputClass}>
            <option value="open">open</option>
            <option value="strict">strict</option>
          </select>
        </div>
        <div>
          <label htmlFor={id('inbound')} className="block text-[10px] text-gray-500 mb-0.5">Inbound references</label>
          <select id={id('inbound')} value={draft.inbound_references}
            onChange={e => set('inbound_references', e.target.value as ReservationDraft['inbound_references'])}
            className={inputClass}>
            <option value="closed">closed</option>
            <option value="open">open</option>
          </select>
        </div>
        <div>
          <label htmlFor={id('deletion')} className="block text-[10px] text-gray-500 mb-0.5">Deletion mode</label>
          <select id={id('deletion')} value={draft.deletion_mode}
            onChange={e => set('deletion_mode', e.target.value as ReservationDraft['deletion_mode'])}
            className={inputClass}>
            <option value="retain">retain</option>
            <option value="full">full</option>
          </select>
        </div>
        <div className="col-span-3">
          <label htmlFor={id('refs')} className="block text-[10px] text-gray-500 mb-0.5">
            Allowed external refs <span className="text-gray-300">(comma-separated, used when strict)</span>
          </label>
          <input id={id('refs')} type="text" value={draft.allowed_external_refs}
            onChange={e => set('allowed_external_refs', e.target.value)} placeholder="wip, shared"
            className={inputClass} />
        </div>
        <div className="col-span-3">
          <label htmlFor={id('idconfig')} className="block text-[10px] text-gray-500 mb-0.5">
            ID config <span className="text-gray-300">(JSON; {'{}'} for UUID7 everywhere)</span>
          </label>
          <textarea id={id('idconfig')} value={draft.id_config} rows={2}
            onChange={e => set('id_config', e.target.value)}
            className={`${inputClass} font-mono`} spellCheck={false} />
        </div>
      </div>
      {warnings.map(w => (
        <p key={w} className="text-[11px] text-amber-700 flex items-start gap-1.5">
          <AlertTriangle size={11} className="shrink-0 mt-0.5" />
          <span>{w}</span>
        </p>
      ))}
    </div>
  )
}
