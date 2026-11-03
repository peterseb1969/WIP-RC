import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAutoRefresh } from '@/hooks/use-auto-refresh'

// Auto-refresh re-reads a fixed time after the previous read finished,
// never while one is running, and not while the tab is hidden.

let visibility: DocumentVisibilityState = 'visible'

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

type Props = { enabled: boolean; fetching: boolean }

function setup(initial: Props) {
  const refetch = vi.fn()
  const hook = renderHook(({ enabled, fetching }: Props) => useAutoRefresh(enabled, fetching, refetch, 5000), {
    initialProps: initial,
  })
  return { refetch, ...hook }
}

describe('useAutoRefresh', () => {
  it('does nothing while off', () => {
    const { refetch } = setup({ enabled: false, fetching: false })
    vi.advanceTimersByTime(60_000)
    expect(refetch).not.toHaveBeenCalled()
  })

  it('re-reads the delay after the previous read finished, never during one', () => {
    const { refetch, rerender } = setup({ enabled: true, fetching: false })
    vi.advanceTimersByTime(4_999)
    expect(refetch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(refetch).toHaveBeenCalledTimes(1)

    // The read takes 8 s: no second read is started meanwhile.
    rerender({ enabled: true, fetching: true })
    vi.advanceTimersByTime(8_000)
    expect(refetch).toHaveBeenCalledTimes(1)

    // It finished: the next one comes 5 s later.
    rerender({ enabled: true, fetching: false })
    vi.advanceTimersByTime(5_000)
    expect(refetch).toHaveBeenCalledTimes(2)
  })

  it('a new refetch function each render does not restart the timer', () => {
    const first = vi.fn()
    const { rerender } = renderHook(({ fn }: { fn: () => void }) => useAutoRefresh(true, false, fn, 5000), {
      initialProps: { fn: first },
    })
    vi.advanceTimersByTime(3_000)
    const second = vi.fn()
    rerender({ fn: second })
    vi.advanceTimersByTime(2_000)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('waits for a hidden tab to be shown again', () => {
    const { refetch } = setup({ enabled: true, fetching: false })
    visibility = 'hidden'
    vi.advanceTimersByTime(30_000)
    expect(refetch).not.toHaveBeenCalled()
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('stops when switched off', () => {
    const { refetch, rerender } = setup({ enabled: true, fetching: false })
    vi.advanceTimersByTime(2_000)
    rerender({ enabled: false, fetching: false })
    vi.advanceTimersByTime(30_000)
    expect(refetch).not.toHaveBeenCalled()
  })
})
