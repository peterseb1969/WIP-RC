import { useEffect, useState, useMemo } from 'react'
import {
  AlertTriangle,
  Info,
  XOctagon,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { useDocuments, useActivateTemplate } from '@wip/react'
import type { Template, FieldDefinition, ActivateTemplateResponse } from '@wip/client'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// Warning types
// ---------------------------------------------------------------------------

type WarningLevel = 'info' | 'warning' | 'blocking' | 'error'

interface VersionWarning {
  level: WarningLevel
  message: string
}

const LEVEL_CONFIG: Record<WarningLevel, { icon: typeof Info; color: string; bg: string; border: string }> = {
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  blocking: { icon: XOctagon, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  error: { icon: XOctagon, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

// ---------------------------------------------------------------------------
// VersionWarnings
// ---------------------------------------------------------------------------

export interface VersionWarningsProps {
  /** The existing template (null for create mode) */
  original: Template | null
  /** Current form state */
  currentFields: FieldDefinition[]
  currentIdentityFields: string[]
  namespace: string
  /** Called with true if there's a blocking warning */
  onBlockingChange?: (isBlocking: boolean) => void
}

export default function VersionWarnings({
  original,
  currentFields,
  currentIdentityFields,
  namespace,
  onBlockingChange,
}: VersionWarningsProps) {
  const [dryRunResult, setDryRunResult] = useState<ActivateTemplateResponse | null>(null)
  const [dryRunError, setDryRunError] = useState<string | null>(null)

  // Check document count for this template
  const { data: docsData, isLoading: docsLoading } = useDocuments(
    original ? { template_value: original.value, namespace, page_size: 1 } : undefined,
    { enabled: !!original },
  )

  // Dry-run activation to get server-side warnings
  const dryRun = useActivateTemplate({
    onSuccess: (result) => {
      setDryRunResult(result)
      setDryRunError(null)
    },
    onError: (err: Error) => {
      setDryRunError(err.message)
      setDryRunResult(null)
    },
  })

  // Run dry-run activation only for draft templates (active templates reject activate calls)
  useEffect(() => {
    if (original?.template_id && namespace && original.status === 'draft' && !dryRun.isPending) {
      dryRun.mutate({ id: original.template_id, namespace, dry_run: true })
    }
    // Only re-run when the template ID, status, or namespace changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original?.template_id, original?.status, namespace])

  const docCount = docsData?.total ?? 0

  // Compute warnings
  const warnings = useMemo(() => {
    const result: VersionWarning[] = []

    // Create mode — no warnings needed
    if (!original) return result

    // Draft template — just save
    if (original.status === 'draft') {
      result.push({
        level: 'info',
        message: 'This template is a draft. Saving will not affect any documents.',
      })
      return result
    }

    // Active template — check document impact
    const version = original.version ?? 1

    if (docCount === 0) {
      result.push({
        level: 'info',
        message: `This will create version ${version + 1}. No documents are affected.`,
      })
    } else {
      // Documents exist — warn about version bump
      result.push({
        level: 'warning',
        message: `${docCount} document${docCount !== 1 ? 's' : ''} use this template. Saving will create version ${version + 1}.`,
      })
    }

    // Check identity field changes
    const originalIdentity = original.identity_fields ?? []
    const identityChanged = !arraysEqual(originalIdentity, currentIdentityFields)

    if (identityChanged && docCount > 0) {
      // This is the critical case Peter flagged:
      // - If docs use `latest` → BLOCKING (inconsistent hashing)
      // - If docs use pinned versions → INFO (two coexisting schemas, safe)
      //
      // We can't currently determine per-document version strategy from the list API,
      // so we show a strong warning and let the user decide.
      // TODO: When document query supports version_strategy filtering, split this into
      //       blocking (latest) vs info (pinned) per the design spec matrix.
      result.push({
        level: 'blocking',
        message:
          'Identity fields have changed. If any documents reference this template as "latest", ' +
          'this will cause inconsistent identity hashing. Pin existing documents to the current ' +
          'version first, or create a new template. If all documents use pinned versions, this is safe.',
      })
    } else if (identityChanged) {
      result.push({
        level: 'info',
        message: 'Identity fields changed. No documents exist, so this is safe.',
      })
    }

    // Check for removed fields that documents might populate
    if (original.fields && docCount > 0) {
      const originalNames = new Set(original.fields.map(f => f.name))
      const currentNames = new Set(currentFields.map(f => f.name))
      const removed = [...originalNames].filter(n => !currentNames.has(n))
      if (removed.length > 0) {
        result.push({
          level: 'warning',
          message: `Removed field${removed.length !== 1 ? 's' : ''}: ${removed.join(', ')}. Existing documents may have data in ${removed.length !== 1 ? 'these fields' : 'this field'}.`,
        })
      }
    }

    // Check for type changes on existing fields
    if (original.fields && docCount > 0) {
      const originalMap = new Map(original.fields.map(f => [f.name, f]))
      const typeChanges: string[] = []
      for (const field of currentFields) {
        const orig = originalMap.get(field.name)
        if (orig && orig.type !== field.type) {
          typeChanges.push(`${field.name}: ${orig.type} → ${field.type}`)
        }
      }
      if (typeChanges.length > 0) {
        result.push({
          level: 'warning',
          message: `Field type changed: ${typeChanges.join(', ')}. Existing documents may have incompatible data.`,
        })
      }
    }

    // Server-side dry-run warnings
    if (dryRunResult) {
      for (const w of dryRunResult.warnings ?? []) {
        result.push({ level: 'warning', message: w.message })
      }
      for (const e of dryRunResult.errors ?? []) {
        result.push({ level: 'error', message: e.message })
      }
      // Check for cascade activations via activation_details
      const cascaded = (dryRunResult.activation_details ?? []).filter(
        d => d.template_id !== original?.template_id
      )
      if (cascaded.length > 0) {
        result.push({
          level: 'info',
          message: `Activating will also activate: ${cascaded.map(d => d.value).join(', ')}`,
        })
      }
    }
    if (dryRunError) {
      result.push({ level: 'error', message: `Dry-run failed: ${dryRunError}` })
    }

    return result
  }, [original, docCount, currentFields, currentIdentityFields, dryRunResult, dryRunError])

  // Notify parent about blocking state
  const hasBlocking = warnings.some(w => w.level === 'blocking' || w.level === 'error')
  useEffect(() => {
    onBlockingChange?.(hasBlocking)
  }, [hasBlocking, onBlockingChange])

  // Nothing to show for create mode
  if (!original && warnings.length === 0) return null

  const isLoading = docsLoading || dryRun.isPending

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 px-3 py-2">
        <Loader2 size={14} className="animate-spin" />
        Checking impact...
      </div>
    )
  }

  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-2">
        <CheckCircle size={14} />
        No issues detected. Safe to save.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        const config = LEVEL_CONFIG[w.level]
        const Icon = config.icon
        return (
          <div
            key={i}
            className={cn(
              'flex items-start gap-2 text-sm rounded-md px-3 py-2 border',
              config.bg, config.border, config.color,
            )}
          >
            <Icon size={14} className="shrink-0 mt-0.5" />
            <span>{w.message}</span>
          </div>
        )
      })}
    </div>
  )
}
