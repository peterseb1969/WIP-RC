import { useEffect, useRef } from 'react'

/** Gap between the end of one read and the start of the next. */
export const AUTO_REFRESH_DELAY_MS = 5_000

/**
 * Re-read a query on a timer while `enabled`, for watching data that is
 * being written (an install filling a namespace). The next read is
 * scheduled only once the current one has finished, never on a fixed
 * clock: on a large namespace one read can take several seconds, and
 * overlapping reads would only add load. While the tab is hidden nothing
 * is read; the read that was due runs when the tab is shown again.
 */
export function useAutoRefresh(
  enabled: boolean,
  isFetching: boolean,
  refetch: () => unknown,
  delayMs: number = AUTO_REFRESH_DELAY_MS,
) {
  // Callers often pass a new function each render; the timer must not
  // restart because of it.
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    if (!enabled || isFetching) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', onVisible)
      refetchRef.current()
    }
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') refetchRef.current()
      else document.addEventListener('visibilitychange', onVisible)
    }, delayMs)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, isFetching, delayMs])
}
