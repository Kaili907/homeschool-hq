import { useCallback, useEffect, useState } from 'react'
import { isoToday } from '../appState'

/** Delay to the next local midnight plus a small scheduling cushion. */
export function millisecondsUntilNextLocalDate(now: Date): number {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    25,
  )
  return Math.max(25, next.getTime() - now.getTime())
}

/**
 * Keeps mission and planner "today" boundaries aligned with family-local time
 * even when a tab remains open across midnight.
 */
export function useLocalCalendarDate(): string {
  const [date, setDate] = useState(() => isoToday())
  const refresh = useCallback(() => setDate(isoToday()), [])

  useEffect(() => {
    const now = new Date()
    const timer = globalThis.setTimeout(
      refresh,
      millisecondsUntilNextLocalDate(now),
    )
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    globalThis.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      globalThis.clearTimeout(timer)
      globalThis.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [date, refresh])

  return date
}
