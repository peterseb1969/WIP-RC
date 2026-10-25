import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NamespaceFilterProvider } from '@/hooks/use-namespace-filter'
import NamespaceMismatchBadge from '@/components/common/NamespaceMismatchBadge'

// Detail pages show their entity in its own namespace whatever the top bar
// says; the badge is the only cue that the two differ.

const STORAGE_KEY = 'rc-console:namespace-filter'

function selectAndRender(selected: string, entityNs: string | null) {
  const m = new Map<string, string>([[STORAGE_KEY, selected]])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
  })
  return render(
    <NamespaceFilterProvider>
      <NamespaceMismatchBadge namespace={entityNs} />
    </NamespaceFilterProvider>,
  )
}

describe('NamespaceMismatchBadge', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('names the selected namespace when the entity is elsewhere', () => {
    selectAndRender('kb', 'wip')
    expect(screen.getByText('not in selected namespace kb')).toBeInTheDocument()
  })

  it('stays silent when the namespaces match', () => {
    const { container } = selectAndRender('kb', 'kb')
    expect(container).toBeEmptyDOMElement()
  })

  it('stays silent with "All namespaces" selected', () => {
    const { container } = selectAndRender('', 'wip')
    expect(container).toBeEmptyDOMElement()
  })

  it('stays silent when the entity carries no namespace', () => {
    const { container } = selectAndRender('kb', null)
    expect(container).toBeEmptyDOMElement()
  })
})
