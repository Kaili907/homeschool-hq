import { describe, expect, it } from 'vitest'
import type { AppState, CourseTrack, Profile } from './types'
import type { SkillId } from './skills'
import {
  finishSession,
  getStat,
  patchProfile,
  recordAnswer,
  updateProfile,
} from './appState'
import { autoCompletePractice, ensureToday, setItemDone } from './missions'
import { ensureHsDefaults, setCourses } from './hs/hsState'
import { emptyProfile } from './migration'

// ---------------------------------------------------------------------------
// Regression harness for the stale-snapshot write bug class.
//
// These tests model React's two setState batching modes and contrast them so the
// four historical bug shapes are reproducible AND their functional-update fix is
// proven — all against the REAL reducers (recordAnswer / finishSession /
// ensureToday / setCourses) and the REAL primitive (appState.patchProfile).
//
//   • VALUE / snapshot form — the payload is computed from the SAME committed
//     render snapshot, then written; on flush the LAST write wins. This is the
//     trap the shipped code hit — as a whole-value setState (record+finish),
//     and as an updater whose FIELD payload was still snapshot-derived and
//     replaced a field wholesale (the derive-at-render shape). Either way the
//     second write clobbers the first.
//
//   • UPDATER form — the payload derives from the updater's `prev`, so queued
//     writes apply to the EVOLVING state and compose; nothing is clobbered.
//     This is the H1 conversion.
//
// NB: this suite proves the composition CONTRACT with the real reducers; it is
// not a component-render harness, so it exercises the reducer layer, not the
// wiring inside App/GrownUps/HighSchoolHome (those are covered by typecheck +
// the existing feature suites).
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
    // the grade-3 weekday template carries a math auto item; a finished practice
    // must check it off. (SE-B: math practice flips only MATH autos — the typing
    // auto item is left for its own drill, so assert against the math kind.)
    const mathAutos = out.missions[DAY].items.filter((i) => i.auto && (i.autoKind ?? 'math') === 'math')
    expect(mathAutos.length).toBeGreaterThan(0)
    expect(mathAutos.every((i) => i.done)).toBe(true)
    // the typing auto item exists but is NOT flipped by a math session
    expect(out.missions[DAY].items.find((i) => i.autoKind === 'typing')?.done).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Shape 4 — derive-at-render / wholesale field replace.
// The subtle variant: the OUTER call is a functional updater, but the field
// payload is still built from a render snapshot and replaces the field
// wholesale (setCourses replaces prev.courses entirely). Two such edits in one
// tick clobber unless the transform is applied to prev's OWN field. This is the
// shape that was still live in HsGrownUps course edits / GrownUps TemplateEditor
// before the fix.
// ---------------------------------------------------------------------------
describe('shape 4: derive-at-render wholesale replace', () => {
  const twoCourses = (): CourseTrack[] => [
    { id: 'c1', name: 'Alg', units: [{ id: 'u1', label: 'U1', done: false }] },
    { id: 'c2', name: 'Geo', units: [{ id: 'u2', label: 'U2', done: false }] },
  ]
  const seed = (): AppState => {
    const base = ensureHsDefaults(emptyProfile('p1', 'Teen', '10'))
    const p: Profile = { ...base, courses: twoCourses() }
    return { schemaVersion: 2, profiles: { p1: p }, activeProfileId: 'p1', parentPin: '' }
  }
  const mark = (courses: CourseTrack[], courseId: string): CourseTrack[] =>
    courses.map((c) =>
      c.id === courseId
        ? { ...c, units: c.units.map((u) => ({ ...u, done: true })) }
        : c,
    )
  const doneOf = (p: Profile, courseId: string) =>
    (p.courses ?? []).find((c) => c.id === courseId)!.units.every((u) => u.done)

  it('SNAPSHOT payload lets the second course edit clobber the first', () => {
    const store = makeStore(seed())
    const snap = store.snapshot().profiles.p1.courses ?? [] // captured at render
    // both updaters ignore prev's courses and replay the transformed SNAPSHOT
    store.setState((s) => patchProfile(s, 'p1', (prev) => setCourses(prev, mark(snap, 'c1'))))
    store.setState((s) => patchProfile(s, 'p1', (prev) => setCourses(prev, mark(snap, 'c2'))))
    const out = store.flush().profiles.p1
    expect(doneOf(out, 'c2')).toBe(true)
    expect(doneOf(out, 'c1')).toBe(false) // first edit reverted by the stale array
  })

  it('PREV-derived payload composes both course edits', () => {
    const store = makeStore(seed())
    // transform applied to prev's OWN courses — the H1 setCourseList shape
    store.setState((s) =>
      patchProfile(s, 'p1', (prev) => setCourses(prev, mark(prev.courses ?? [], 'c1'))),
    )
    store.setState((s) =>
      patchProfile(s, 'p1', (prev) => setCourses(prev, mark(prev.courses ?? [], 'c2'))),
    )
    const out = store.flush().profiles.p1
    expect(doneOf(out, 'c1')).toBe(true)
    expect(doneOf(out, 'c2')).toBe(true)
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
