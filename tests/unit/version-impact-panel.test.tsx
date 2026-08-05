import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TemplateVersionEventDetails } from '@wip/client'
import VersionImpactPanel from '@/components/templates/VersionImpactPanel'

// Regression cover for the shapes that only became visible once @wip/client
// 0.44.0 typed the version-event block (CASE-720). While RC shimmed these
// locally, changed_type was typed as string[] and identity_changed as boolean
// — both wrong, and the panel rendered changed_type straight into a join().

function details(over: Partial<TemplateVersionEventDetails> = {}): TemplateVersionEventDetails {
  return {
    added_optional: [],
    added_required: [],
    removed: [],
    changed_type: [],
    made_required: [],
    modified_existing: [],
    identity_changed: null,
    relationship_refs_changed: null,
    impact: { status: 'ok', total_live_docs: 0 },
    migration: { eligible: true, reason: '', via: 'migrate_documents' },
    ...over,
  } as TemplateVersionEventDetails
}

describe('VersionImpactPanel', () => {
  it('renders a type change as old → new, not [object Object]', () => {
    render(
      <VersionImpactPanel
        details={details({
          changed_type: [{ name: 'quantity', old_type: 'string', new_type: 'integer' }],
        })}
      />,
    )

    expect(screen.getByText(/quantity: string → integer/)).toBeInTheDocument()
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument()
  })

  it('renders an identity change as the old → new field lists', () => {
    render(
      <VersionImpactPanel
        details={details({ identity_changed: { old: ['sku'], new: ['sku', 'region'] } })}
      />,
    )

    expect(screen.getByText('Identity changed')).toBeInTheDocument()
    expect(screen.getByText(/sku → sku, region/)).toBeInTheDocument()
  })

  it('omits the identity line when identity did not change', () => {
    render(<VersionImpactPanel details={details()} />)
    expect(screen.queryByText('Identity changed')).not.toBeInTheDocument()
  })

  it('reports unavailable impact as unknown, never as zero documents', () => {
    render(
      <VersionImpactPanel
        details={details({
          impact: { status: 'unavailable', reason: 'document-store unreachable' },
        })}
      />,
    )

    expect(screen.getByText(/Impact could not be determined/)).toBeInTheDocument()
    expect(screen.getByText(/document-store unreachable/)).toBeInTheDocument()
    expect(screen.getByText(/unknown, not zero/)).toBeInTheDocument()
  })

  it('shows live-document counts broken down by version', () => {
    render(
      <VersionImpactPanel
        version={3}
        details={details({
          impact: {
            status: 'ok',
            total_live_docs: 12,
            docs_per_version: { '1': 5, '2': 7 },
          },
        })}
      />,
    )

    expect(screen.getByText('Version 3 created')).toBeInTheDocument()
    expect(screen.getByText(/12 live documents/)).toBeInTheDocument()
    expect(screen.getByText(/v1: 5/)).toBeInTheDocument()
    expect(screen.getByText(/v2: 7/)).toBeInTheDocument()
  })
})
