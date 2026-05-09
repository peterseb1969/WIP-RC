import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react'
import {
  useTemplateByValue,
  useDocument,
  useCreateDocument,
  useUpdateDocument,
  useWipClient,
} from '@wip/react'
import { useQuery } from '@tanstack/react-query'
import type { Template, FieldDefinition } from '@wip/client'
import LoadingState from '@/components/common/LoadingState'
import ErrorState from '@/components/common/ErrorState'
import DocumentForm from '@/components/documents/DocumentForm'
import { useNamespaceFilter } from '@/hooks/use-namespace-filter'
import { cn } from '@/lib/cn'

// ---------------------------------------------------------------------------
// DocumentFormPage — create + edit shell.
//
// - create mode: /documents/:templateValue/new
//   Loads latest template version, starts with empty data.
// - edit mode: /documents/:templateValue/:id/edit
//   Loads the document + its pinned template version. Uses PATCH with
//   ifMatch for optimistic concurrency.
//
// Identity fields are read-only in edit mode (server enforces the rule via
// PATCH; the UI mirrors it for clarity).
// ---------------------------------------------------------------------------

type Mode = 'create' | 'edit'

export default function DocumentFormPage({ mode }: { mode: Mode }) {
  const { templateValue, id: documentId } = useParams()
  const navigate = useNavigate()
  const { namespace: globalNs } = useNamespaceFilter()

  // Create mode — load latest template by value.
  const createModeTemplateQ = useTemplateByValue(templateValue ?? '', {
    enabled: mode === 'create' && !!templateValue,
  })

  // Edit mode — load document first, then its pinned template version.
  const docQ = useDocument(documentId ?? '', {
    enabled: mode === 'edit' && !!documentId,
  })
  const editModeTemplateQ = usePinnedTemplate(
    docQ.data?.template_id,
    docQ.data?.template_version,
    mode === 'edit' && !!docQ.data,
  )

  const template = mode === 'create' ? createModeTemplateQ.data : editModeTemplateQ.data
  const isLoading =
    (mode === 'create' && createModeTemplateQ.isLoading) ||
    (mode === 'edit' && (docQ.isLoading || editModeTemplateQ.isLoading))
  const loadError =
    (mode === 'create' && createModeTemplateQ.error) ||
    (mode === 'edit' && (docQ.error || editModeTemplateQ.error))

  // --- Form state ---
  const [initialized, setInitialized] = useState(false)
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const initialDataRef = useRef<Record<string, unknown>>({})
  const loadedVersionRef = useRef<number | undefined>(undefined)
  const [banner, setBanner] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Initialize form once data is loaded
  useEffect(() => {
    if (initialized || !template) return
    if (mode === 'create') {
      const initial = defaultDataFor(template)
      setFormData(initial)
      initialDataRef.current = initial
      setInitialized(true)
    } else if (mode === 'edit' && docQ.data) {
      const initial = structuredClone(docQ.data.data ?? {}) as Record<string, unknown>
      setFormData(initial)
      initialDataRef.current = initial
      loadedVersionRef.current = docQ.data.version
      setInitialized(true)
    }
  }, [initialized, template, mode, docQ.data])

  const isDirty = useMemo(() => {
    if (!initialized) return false
    return !shallowEqualJSON(formData, initialDataRef.current)
  }, [formData, initialized])

  // Unsaved-changes guard
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // --- Mutations ---
  const createDoc = useCreateDocument({
    onSuccess: (res) => {
      if (res.document_id) {
        navigate(`/documents/${templateValue}/${res.document_id}`)
      }
    },
    onError: (err) => setBanner(err.message),
  })
  const updateDoc = useUpdateDocument({
    onSuccess: () => {
      if (documentId) navigate(`/documents/${templateValue}/${documentId}`)
    },
    onError: (err) => setBanner(err.message),
  })

  const isPending = createDoc.isPending || updateDoc.isPending

  // --- Save ---
  const handleSave = useCallback(() => {
    setBanner(null)
    setFieldErrors({})
    if (!template) return

    // Client-side mandatory check
    const errs = validateMandatory(template, formData)
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setBanner('Please fix the highlighted errors before saving.')
      return
    }

    if (mode === 'create') {
      const ns = template.namespace || globalNs
      if (!ns) { setBanner('Namespace could not be resolved for this template.'); return }
      createDoc.mutate({
        template_id: template.template_id,
        template_version: template.version,
        namespace: ns,
        data: formData,
        created_by: 'rc-console',
      })
    } else if (mode === 'edit' && documentId) {
      // Compute dirty patch: fields that differ from the initial load. null
      // for deletions so the server drops them.
      const patch: Record<string, unknown> = {}
      const initial = initialDataRef.current
      const keys = new Set([...Object.keys(initial), ...Object.keys(formData)])
      for (const k of keys) {
        if (!shallowEqualJSON(formData[k], initial[k])) {
          patch[k] = k in formData ? formData[k] : null
        }
      }
      if (Object.keys(patch).length === 0) {
        setBanner('No changes to save.')
        return
      }
      updateDoc.mutate({
        documentId,
        patch,
        ifMatch: loadedVersionRef.current,
      })
    }
  }, [template, formData, mode, createDoc, updateDoc, documentId, globalNs, templateValue])

  const handleCancel = () => {
    if (isDirty && !window.confirm('Discard unsaved changes?')) return
    if (mode === 'edit' && documentId) {
      navigate(`/documents/${templateValue}/${documentId}`)
    } else {
      navigate(`/documents?template=${templateValue ?? ''}`)
    }
  }

  if (isLoading) return <LoadingState label="Loading template..." />
  if (loadError) return <ErrorState message={loadError.message} />
  if (!template) return <ErrorState message="Template not found" />

  const identityFieldNames = new Set(template.identity_fields ?? [])
  const title = mode === 'create'
    ? `New ${template.label || template.value}`
    : `Edit ${template.label || template.value}`

  // Show pinned version hint if edit mode against older template version
  const pinnedInfo = mode === 'edit' && docQ.data && template.version !== docQ.data.template_version
    ? `Editing against pinned template v${docQ.data.template_version}. Latest is v${template.version}.`
    : null

  const isConcurrencyConflict = banner?.toLowerCase().includes('concurrency') || banner?.toLowerCase().includes('conflict')

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to={mode === 'edit' && documentId
              ? `/documents/${templateValue}/${documentId}`
              : `/documents?template=${templateValue ?? ''}`}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary mb-2"
          >
            <ArrowLeft size={12} />
            {mode === 'edit' ? 'Back to document' : 'Back to Documents'}
          </Link>
          <h1 className="text-2xl font-semibold text-gray-800">
            {title}
            <span className="ml-2 text-xs font-mono text-gray-400">v{template.version}</span>
          </h1>
          {template.description && (
            <p className="text-sm text-gray-400 mt-0.5">{template.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || (mode === 'edit' && !isDirty)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white rounded-md',
              isPending || (mode === 'edit' && !isDirty)
                ? 'bg-primary/30 cursor-not-allowed'
                : 'bg-primary hover:bg-primary',
            )}
          >
            <Save size={14} />
            {isPending ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {/* Pinned version info */}
      {pinnedInfo && (
        <div className="text-xs text-primary-dark bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
          {pinnedInfo}
        </div>
      )}

      {/* Error banner */}
      {banner && (
        <div className="flex items-start gap-2 text-sm text-danger bg-danger/5 border border-danger/20 rounded-md px-3 py-2">
          <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />
          <div className="flex-1">{banner}</div>
          {isConcurrencyConflict && mode === 'edit' && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs text-danger underline hover:text-danger shrink-0"
            >
              Reload
            </button>
          )}
        </div>
      )}

      {/* Body */}
      <DocumentForm
        template={template}
        value={formData}
        onChange={setFormData}
        errors={fieldErrors}
        identityFieldNames={identityFieldNames}
        mode={mode}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a specific pinned template version via the client directly (the
 * @wip/react `useTemplate` hook only accepts an id, no version).
 */
function usePinnedTemplate(
  templateId: string | undefined,
  version: number | undefined,
  enabled: boolean,
) {
  const client = useWipClient()
  return useQuery<Template>({
    queryKey: ['rc-console', 'template-pinned', templateId, version],
    queryFn: () => client.templates.getTemplate(templateId!, version),
    enabled: enabled && !!templateId,
    staleTime: 60_000,
  })
}

function defaultDataFor(template: Template): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of template.fields ?? []) {
    if (f.default_value !== undefined && f.default_value !== null) {
      out[f.name] = f.default_value
    }
  }
  return out
}

function validateMandatory(
  template: Template,
  data: Record<string, unknown>,
): Record<string, string> {
  const errs: Record<string, string> = {}
  for (const f of template.fields ?? []) {
    if (!f.mandatory) continue
    const v = data[f.name]
    if (v === undefined || v === null || v === '') {
      errs[f.name] = `${f.label || f.name} is required`
    }
  }
  return errs
}

function shallowEqualJSON(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// FieldDefinition re-export (to keep the import surface tidy in tests)
export type { FieldDefinition }
