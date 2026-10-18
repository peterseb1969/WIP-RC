import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Template, FieldDefinition } from '@wip/client'

// The platform rejects any identity_fields change on a template, draft or
// active, with or without documents. The editor's warnings must block such a
// save rather than call it safe.

const docTotal = vi.hoisted(() => ({ value: 0 }))
vi.mock('@wip/react', () => ({
  useDocuments: () => ({ data: { total: docTotal.value, items: [] }, isLoading: false }),
  useActivateTemplate: () => ({ mutate: vi.fn(), isPending: false }),
}))

import VersionWarnings from '@/components/templates/VersionWarnings'

const fields: FieldDefinition[] = [
  { name: 'code', label: 'code', type: 'string' } as FieldDefinition,
  { name: 'title', label: 'title', type: 'string' } as FieldDefinition,
]

function template(over: Partial<Template> = {}): Template {
  return {
    template_id: 't1',
    value: 'T',
    label: 'T',
    namespace: 'ns',
    version: 1,
    status: 'active',
    identity_fields: ['code'],
    fields,
    ...over,
  } as Template
}

function renderWarnings(original: Template, identity: string[]) {
  const onBlockingChange = vi.fn()
  render(
    <VersionWarnings
      original={original}
      currentFields={fields}
      currentIdentityFields={identity}
      namespace="ns"
      onBlockingChange={onBlockingChange}
    />,
  )
  return onBlockingChange
}

describe('VersionWarnings', () => {
  beforeEach(() => { docTotal.value = 0 })

  it('blocks an identity change on a template with no documents', () => {
    const onBlocking = renderWarnings(template(), ['code', 'title'])
    expect(screen.getByText(/Identity fields can't change after a template is created \(was: code\)/)).toBeInTheDocument()
    expect(screen.queryByText(/safe/i)).not.toBeInTheDocument()
    expect(onBlocking).toHaveBeenLastCalledWith(true)
  })

  it('blocks an identity change on a draft', () => {
    const onBlocking = renderWarnings(template({ status: 'draft' }), ['title'])
    expect(screen.getByText(/Identity fields can't change/)).toBeInTheDocument()
    expect(onBlocking).toHaveBeenLastCalledWith(true)
  })

  it('warns about the new version, without blocking, when identity is unchanged', () => {
    docTotal.value = 2
    const onBlocking = renderWarnings(template(), ['code'])
    expect(screen.getByText(/2 documents use this template\. Schema changes will create version 2/)).toBeInTheDocument()
    expect(screen.queryByText(/Identity fields/)).not.toBeInTheDocument()
    expect(onBlocking).toHaveBeenLastCalledWith(false)
  })
})
