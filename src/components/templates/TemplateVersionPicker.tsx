import { useEffect } from 'react'
import { useTemplateVersions } from '@/hooks/use-template-versions'
import { Label } from '@/components/common/FormInputs'

/**
 * Version picker for a pinned template reference (CASE-493).
 *
 * Renders the concrete version list for `templateId` and pins one. "Latest"
 * was deleted on the template→template reference axes (extends / template_ref /
 * array_template_ref), so every such reference must carry an explicit version
 * — the backend rejects a reference declared without one. When a reference is
 * first chosen and nothing is pinned yet, this auto-selects the newest version
 * as a sensible default the user can change.
 */
export default function TemplateVersionPicker({
  label,
  templateId,
  value,
  onChange,
}: {
  label: string
  templateId: string | undefined
  value: number | undefined
  onChange: (version: number | undefined) => void
}) {
  const { data: versions, isLoading, isError } = useTemplateVersions(templateId)

  // Default to the newest version once the list loads and nothing is pinned.
  useEffect(() => {
    if (value === undefined && versions && versions.length > 0) {
      onChange(versions[0]!.version)
    }
  }, [value, versions, onChange])

  if (!templateId) return null

  // Preserve a pinned version even if it's no longer in the returned list
  // (e.g. it was deactivated) so the existing pin is never silently dropped.
  const known = versions ?? []
  const hasPinned = value === undefined || known.some(v => v.version === value)
  const options = hasPinned ? known : [{ version: value, status: 'inactive' as const, label: '' }, ...known]

  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        disabled={isLoading}
        className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-light focus:border-primary-light disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="">{isLoading ? 'Loading versions…' : 'Select version…'}</option>
        {options.map(v => (
          <option key={v.version} value={v.version}>
            v{v.version}{v.status !== 'active' ? ` (${v.status})` : ''}
          </option>
        ))}
      </select>
      {isError && (
        <p className="mt-1 text-[11px] text-danger">Could not load versions for this template.</p>
      )}
      {!isLoading && !isError && known.length === 0 && (
        <p className="mt-1 text-[11px] text-amber-600">No versions found for this template.</p>
      )}
    </div>
  )
}
