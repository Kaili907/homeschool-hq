// Minimal, synchronous stand-ins for the three React hooks TestPlayer uses.
//
// This repo's component tests run without a DOM (every other *.test.tsx renders
// through react-dom/server), but the evidence tests have to CLICK: press Next on
// an untouched item, press Back, press Skip, press Finish. Substituting the hooks
// lets a test call the REAL, unmodified TestPlayer function and invoke the real
// handlers on the real element tree — nothing about the component is re-created
// here. Hook state is keyed by call order, exactly as React keys it.
//
// This module deliberately imports nothing: the test file feeds it to
// vi.mock('react', …), whose factory is hoisted above every import.

type Updater<T> = T | ((prev: T) => T)

let slots: unknown[] = []
let cursor = 0

/** Drop all hook state (a fresh mount). */
export function resetHooks(): void {
  slots = []
  cursor = 0
}

/** Rewind the call-order cursor before each render pass. */
export function beginRender(): void {
  cursor = 0
}

export function useState<T>(initial: T | (() => T)): [T, (next: Updater<T>) => void] {
  const slot = cursor++
  if (!(slot in slots)) {
    slots[slot] = typeof initial === 'function' ? (initial as () => T)() : initial
  }
  const set = (next: Updater<T>) => {
    const prev = slots[slot] as T
    slots[slot] = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
  }
  return [slots[slot] as T, set]
}

export function useRef<T>(initial: T): { current: T } {
  const slot = cursor++
  if (!(slot in slots)) slots[slot] = { current: initial }
  return slots[slot] as { current: T }
}

/** Recomputed every render. TestPlayer's only memo is a pure derivation of `test`. */
export function useMemo<T>(factory: () => T, _deps: unknown[]): T {
  cursor++ // consume a slot so later hooks keep React's ordering
  return factory()
}
