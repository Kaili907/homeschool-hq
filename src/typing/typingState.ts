import type { Profile } from '../types'
import { isoToday } from '../appState'
import { applyDrillResult, getTypingState, type DrillResult } from './engine'

/**
 * SE-A profile-facing typing helper. Composes the whole drill outcome —
 * best-stat update, mastery latch, frontier advance, counters — into ONE
 * profile patch, so a drill that both records a result AND advances the ladder
 * never splits into two stale-base setState calls (the MA finish/record lesson).
 */
export function recordDrill(p: Profile, result: DrillResult): Profile {
  const nextTyping = applyDrillResult(getTypingState(p), result, isoToday())
  return { ...p, typing: nextTyping }
}

/** Did this drill push the girl onto a new lesson? (drives the ≤1.5s celebration) */
export function drillAdvanced(p: Profile, result: DrillResult): boolean {
  const before = getTypingState(p).unlockedIndex
  const after = applyDrillResult(getTypingState(p), result, isoToday()).unlockedIndex
  return after > before
}
