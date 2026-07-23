import { describe, expect, it } from 'vitest'
import type { AppState } from './types'
import type { SkillId } from './skills'
import {
  finishSession,
  getStat,
  patchProfile,
  recordAnswer,
  updateProfile,
} from './appState'
import { autoCompletePractice, ensureToday, setItemDone } from './missions'
import { emptyProfile } from './migration'

// ---------------------------------------------------------------------------
// Regression harness for the stale-snapshot write bug class.
//
// These tests model React's two setState batching modes and contrast them so the
// three historical bug shapes are reproducible AND their functional-update fix is
// proven — all against the REAL reducers (recordAnswer / finishSession /
// ensureToday) and the REAL primitive (appState.patchProfile).
//
//   • VALUE form  — setState(nextValue): every write in a tick is computed from
//     the SAME committed snapshot, then enqueued; on flush the LAST value wins.
//     This is exactly the trap the shipped code hit (MA record+finish compose,
//     M4 finish-via-ref, M4 derive-at-render): the second write clobbers the
//     first because both started from the same stale base.
//
//   • UPDATER form — setState(prev => next): the queued functions apply in order
//     to the EVOLVING state, so each write sees the previous write's result.
//     Writes compose; nothing is clobbered. This is the H1 conversion.
// ---------------------------------------------------------------------------

type Write = AppState | ((s: AppState) => AppState)

function makeStore(initial: AppState) {
  let committed = initial
  let queue: Write[] = []
  return {
    /** latest committed snapshot (what a render closure would capture) */
    snapshot: () => committed,
    /** enqueue a write; nothing commits until flush() (one React tick) */
    setState: (w: Write) => queue.push(w),
    /** apply the whole tick's queued writes in enqueue order */
    flush() {
      for (const w of queue) committed = typeof w === 'function' ? w(committed) : w
      queue = []
      return committed
    },
  }
}

const MULT: SkillId = 'mult'
const DAY = '2026-07-20' // a Monday, fixed so mission seeding is deterministic

const fresh = (): AppState => {
  const p = emptyProfile('p1', 'Test Kid', '3')
  return { schemaVersion: 2, profiles: { p1: p }, activeProfileId: 'p1', parentPin: '' }
}

// ---------------------------------------------------------------------------
// Shape 1 — two same-tick writes (two answers recorded before a re-render).
// ---------------------------------------------------------------------------
describe('shape 1: two same-tick writes', () => {
  it('VALUE form loses the first write (documents the historical bug)', () => {
    const store = makeStore(fresh())
    const base = store.snapshot() // one render snapshot, captured once
    // Both handlers fire in the same tick, each deriving from the same `base`.
    store.setState(updateProfile(base, recordAnswer(base.profiles.p1, MULT, 1, true)))
    store.setState(updateProfile(base, recordAnswer(base.profiles.p1, MULT, 1, true)))
    const out = store.flush().profiles.p1
    expect(out.totals.questionsAnswered).toBe(1) // second clobbered the first
  })

  it('UPDATER form composes both writes', () => {
    const store = makeStore(fresh())
    store.setState((s) => patchProfile(s, 'p1', (p) => recordAnswer(p, MULT, 1, true)))
    store.setState((s) => patchProfile(s, 'p1', (p) => recordAnswer(p, MULT, 1, true)))
    const out = store.flush().profiles.p1
    expect(out.totals.questionsAnswered).toBe(2)
    expect(out.totals.correct).toBe(2)
    expect(getStat(out, MULT).attempts).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Shape 2 — racing effects (a mission-seeding effect firing alongside a write).
// Mirrors App's ensureToday effect racing the first practice answer on mount.
// ---------------------------------------------------------------------------
describe('shape 2: racing effects', () => {
  it('VALUE form drops one racer (documents the historical bug)', () => {
    const store = makeStore(fresh())
    const base = store.snapshot()
    // effect A records an answer; effect B seeds today's missions — both from base
    store.setState(updateProfile(base, recordAnswer(base.profiles.p1, MULT, 1, true)))
    store.setState(updateProfile(base, ensureToday(base.profiles.p1, DAY)))
    const out = store.flush().profiles.p1
    // ensureToday was enqueued last → it wins; the recorded answer is lost
    expect(out.missions[DAY]).toBeDefined()
    expect(out.totals.questionsAnswered).toBe(0)
  })

  it('UPDATER form lands both racers', () => {
    const store = makeStore(fresh())
    store.setState((s) => patchProfile(s, 'p1', (p) => recordAnswer(p, MULT, 1, true)))
    store.setState((s) => patchProfile(s, 'p1', (p) => ensureToday(p, DAY)))
    const out = store.flush().profiles.p1
    expect(out.missions[DAY]).toBeDefined() // mission seeded
    expect(out.totals.questionsAnswered).toBe(1) // AND the answer survived
  })
})

// ---------------------------------------------------------------------------
// Shape 3 — record + finish in the same tick (the practice onFinish shape).
// ---------------------------------------------------------------------------
describe('shape 3: record + finish same tick', () => {
  it('VALUE form lets finish clobber the final answer (documents the bug)', () => {
    const store = makeStore(fresh())
    const base = store.snapshot()
    store.setState(updateProfile(base, recordAnswer(base.profiles.p1, MULT, 1, true)))
    store.setState(updateProfile(base, finishSession(base.profiles.p1, 3)))
    const out = store.flush().profiles.p1
    expect(out.totals.sessions).toBe(1) // finish landed
    expect(out.totals.questionsAnswered).toBe(0) // but the last answer was lost
  })

  it('UPDATER form composes record then finish', () => {
    const store = makeStore(fresh())
    store.setState((s) => patchProfile(s, 'p1', (p) => recordAnswer(p, MULT, 1, true)))
    store.setState((s) => patchProfile(s, 'p1', (p) => finishSession(p, 3)))
    const out = store.flush().profiles.p1
    expect(out.totals.questionsAnswered).toBe(1)
    expect(out.totals.correct).toBe(1)
    expect(out.totals.sessions).toBe(1)
    expect(out.totals.bestStreak).toBe(3)
  })

  it('matches App practice onFinish: autoCompletePractice ∘ finishSession over prev', () => {
    // Seed today's missions with an auto item, then finish a practice run in a
    // later tick exactly as App.tsx does: one updater composing the reducers on
    // the freshest profile. The recorded answer AND the auto-completed mission
    // must both persist.
    const store = makeStore(fresh())
    store.setState((s) => patchProfile(s, 'p1', (p) => ensureToday(p, DAY)))
    store.flush()
    store.setState((s) =>
      patchProfile(s, 'p1', (p) => recordAnswer(p, MULT, 1, true)),
    )
    store.setState((s) =>
      patchProfile(s, 'p1', (p) => autoCompletePractice(finishSession(p, 2), DAY)),
    )
    const out = store.flush().profiles.p1
    expect(out.totals.questionsAnswered).toBe(1) // answer kept
    expect(out.totals.sessions).toBe(1) // session bumped
    // any auto mission item for the day is now checked off
    const autoItems = out.missions[DAY].items.filter((i) => i.auto)
    if (autoItems.length > 0) expect(autoItems.every((i) => i.done)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// patchProfile primitive contract.
// ---------------------------------------------------------------------------
describe('patchProfile primitive', () => {
  it('derives the update base from the latest state, not a captured snapshot', () => {
    let s = fresh()
    s = patchProfile(s, 'p1', (p) => recordAnswer(p, MULT, 1, true))
    s = patchProfile(s, 'p1', (p) => recordAnswer(p, MULT, 1, false))
    expect(s.profiles.p1.totals.questionsAnswered).toBe(2)
    expect(s.profiles.p1.totals.correct).toBe(1)
  })

  it('is a no-op for an unknown profile id', () => {
    const s = fresh()
    const out = patchProfile(s, 'nope', (p) => setItemDone(p, 'x', true))
    expect(out).toBe(s)
  })
})
