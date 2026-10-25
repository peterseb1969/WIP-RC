import { StrictMode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { MemoryRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { NamespaceFilterProvider, useNamespaceFilter, useNamespaceInUrl } from '@/hooks/use-namespace-filter'

// `?ns=` used to be consumed into localStorage and stripped from the URL, so a
// list's URL never said which namespace it showed. These pin the two-way sync,
// under StrictMode on purpose: the app runs in it, and a double-run effect must
// not let the saved value overwrite a link's ?ns=.

const STORAGE_KEY = 'rc-console:namespace-filter'

// The test environment has no usable localStorage; an in-memory one stands in.
function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
    clear: () => m.clear(),
  }
}

function ListPage() {
  useNamespaceInUrl()
  const { namespace, setNamespace } = useNamespaceFilter()
  const { search } = useLocation()
  return (
    <div>
      <span data-testid="ns">{namespace || 'ALL'}</span>
      <span data-testid="search">{search}</span>
      <button onClick={() => setNamespace('picked')}>pick</button>
      <button onClick={() => setNamespace('')}>all</button>
      <Link to="/list?ns=linked">link</Link>
    </div>
  )
}

function renderAt(url: string) {
  return render(
    <StrictMode>
      <NamespaceFilterProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes><Route path="/list" element={<ListPage />} /></Routes>
        </MemoryRouter>
      </NamespaceFilterProvider>
    </StrictMode>,
  )
}

const ns = () => screen.getByTestId('ns').textContent
const search = () => screen.getByTestId('search').textContent

describe('useNamespaceInUrl', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()) })

  it('lets ?ns= win over the saved filter and keeps it in the URL', () => {
    localStorage.setItem(STORAGE_KEY, 'saved')
    renderAt('/list?ns=fromurl&template=X')
    expect(ns()).toBe('fromurl')
    expect(search()).toBe('?ns=fromurl&template=X')
  })

  it('writes the saved filter into a URL that has no ?ns=', () => {
    localStorage.setItem(STORAGE_KEY, 'saved')
    renderAt('/list?template=X')
    expect(ns()).toBe('saved')
    expect(search()).toBe('?template=X&ns=saved')
  })

  it('leaves the URL alone with no ?ns= and "All namespaces" saved', () => {
    renderAt('/list')
    expect(ns()).toBe('ALL')
    expect(search()).toBe('')
  })

  it('follows the selector: sets ?ns=, and removes it for All', () => {
    renderAt('/list?ns=first')
    act(() => { fireEvent.click(screen.getByText('pick')) })
    expect(ns()).toBe('picked')
    expect(search()).toBe('?ns=picked')
    act(() => { fireEvent.click(screen.getByText('all')) })
    expect(ns()).toBe('ALL')
    expect(search()).toBe('')
  })

  it('follows a same-page link to another namespace', () => {
    renderAt('/list?ns=first')
    act(() => { fireEvent.click(screen.getByText('link')) })
    expect(ns()).toBe('linked')
    expect(search()).toBe('?ns=linked')
  })
})
