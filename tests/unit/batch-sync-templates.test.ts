import { describe, it, expect } from 'vitest'
import type { Template, TemplateFacet } from '@wip/client'
import { syncTemplateOptions, templateOptionText } from '@/lib/batch-sync-templates'

function tmpl(template_id: string, value: string, label: string | null, namespace = 'ns-a'): Template {
  return { template_id, value, label, namespace } as unknown as Template
}

function facet(template_id: string, template_namespace: string | null): TemplateFacet {
  return { template_id, template_value: null, template_namespace, document_count: 3 }
}

describe('templateOptionText', () => {
  it('shows label and value together', () => {
    expect(templateOptionText('Patient record', 'PATIENT')).toBe('Patient record (PATIENT)')
  })

  it('shows the value once when there is no label or the label is the value', () => {
    expect(templateOptionText(null, 'PATIENT')).toBe('PATIENT')
    expect(templateOptionText(undefined, 'PATIENT')).toBe('PATIENT')
    expect(templateOptionText('  ', 'PATIENT')).toBe('PATIENT')
    expect(templateOptionText('PATIENT', 'PATIENT')).toBe('PATIENT')
  })
})

describe('syncTemplateOptions', () => {
  const all = [
    tmpl('t-3', 'VISIT', 'Visit'),
    tmpl('t-1', 'PATIENT', 'Patient record'),
    tmpl('t-2', 'SHARED', 'Shared lookup', 'ns-b'),
  ]

  it('offers every template, sorted by value, when there is no namespace scope', () => {
    expect(syncTemplateOptions(all, null).map(o => o.value)).toEqual(['PATIENT', 'SHARED', 'VISIT'])
  })

  it('limits a scoped list to templates the namespace documents use', () => {
    const opts = syncTemplateOptions(all, [facet('t-1', 'ns-a'), facet('t-3', 'ns-a')])
    expect(opts.map(o => o.value)).toEqual(['PATIENT', 'VISIT'])
  })

  it('keeps a template owned by another namespace when this namespace has documents on it', () => {
    const opts = syncTemplateOptions(all, [facet('t-2', 'ns-b')])
    expect(opts.map(o => o.value)).toEqual(['SHARED'])
  })

  it('offers nothing for a namespace with no documents', () => {
    expect(syncTemplateOptions(all, [])).toEqual([])
  })

  it('ignores facets whose template is not in the active list', () => {
    expect(syncTemplateOptions(all, [facet('gone', null), facet('t-1', 'ns-a')]).map(o => o.value)).toEqual(['PATIENT'])
  })

  it('carries label and value in the option text', () => {
    expect(syncTemplateOptions(all, null)[0]).toEqual({
      template_id: 't-1',
      value: 'PATIENT',
      text: 'Patient record (PATIENT)',
    })
  })
})
