import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE,
  focusSnapshot,
  recordActiveInterval,
  recordBreakEnded,
  recordBreakStarted,
  resolveFamilyPilotBreakGuidance,
  startFocusSession,
  suggestBreak,
} from './FamilyPilotFocusTracker'
import type { FamilyPilotFocusSession } from './types'

const T0 = '2026-08-01T13:00:00.000Z'
const T1 = '2026-08-01T13:10:00.000Z' // T0 + 10 min
const T2 = '2026-08-01T13:12:00.000Z' // break start
const T3 = '2026-08-01T13:20:00.000Z' // break end / resume
const T4 = '2026-08-01T13:30:00.000Z' // T3 + 10 min

function session(studentRef: string, sessionRef: string): FamilyPilotFocusSession {
  return startFocusSession({ studentRef, sessionRef, startedAt: T0 })
}

describe('startFocusSession', () => {
  it('starts active with no elapsed time and no break yet', () => {
    const s = session('student:a', 'session:a')
    expect(s).toEqual({
      studentRef: 'student:a',
      sessionRef: 'session:a',
      startedAt: T0,
      activeSince: T0,
      elapsedActiveSeconds: 0,
      activeSecondsSinceLastBreak: 0,
      lastBreakAt: null,
      breakSuggested: false,
    })
  })
})

describe('recordActiveInterval', () => {
  it('accumulates elapsed active time for a reported span', () => {
    const s = recordActiveInterval(session('student:a', 'session:a'), { from: T0, to: T1 })
    expect(s.elapsedActiveSeconds).toBe(600)
    expect(s.activeSecondsSinceLastBreak).toBe(600)
    expect(s.activeSince).toBe(T1)
  })

  it('excludes a gap the host never reports, such as a Study Runtime pause', () => {
    let s = session('student:a', 'session:a')
    s = recordActiveInterval(s, { from: T0, to: T1 }) // 10 min active
    // Study Runtime pauses from T1 to T3; the host reports nothing for that gap.
    s = recordActiveInterval(s, { from: T3, to: T4 }) // 10 more min active
    expect(s.elapsedActiveSeconds).toBe(1200)
  })

  it('is a no-op for an empty or out-of-order span', () => {
    const started = session('student:a', 'session:a')
    expect(recordActiveInterval(started, { from: T1, to: T0 })).toEqual(started)
    expect(recordActiveInterval(started, { from: T0, to: T0 })).toEqual(started)
  })
})

describe('break time', () => {
  it('is excluded even if a stale active interval is reported during it', () => {
    let s = session('student:a', 'session:a')
    s = recordActiveInterval(s, { from: T0, to: T1 })
    s = recordBreakStarted(s, { startedAt: T1 })
    expect(s.activeSince).toBeNull()
    expect(s.lastBreakAt).toBe(T1)

    const duringBreak = recordActiveInterval(s, { from: T1, to: T2 })
    expect(duringBreak).toBe(s) // no-op: on break, so nothing accrues
    expect(duringBreak.elapsedActiveSeconds).toBe(600)
  })

  it('resumes and continues accumulation after the break ends', () => {
    let s = session('student:a', 'session:a')
    s = recordActiveInterval(s, { from: T0, to: T1 }) // 600s
    s = recordBreakStarted(s, { startedAt: T1 })
    s = recordBreakEnded(s, { resumedAt: T3 })
    expect(s.activeSince).toBe(T3)

    s = recordActiveInterval(s, { from: T3, to: T4 }) // +600s
    expect(s.elapsedActiveSeconds).toBe(1200)
    expect(s.activeSecondsSinceLastBreak).toBe(600) // reset when the break started
  })

  it('ignores a redundant recordBreakEnded while already active', () => {
    let s = session('student:a', 'session:a')
    s = recordActiveInterval(s, { from: T0, to: T1 })
    const unchanged = recordBreakEnded(s, { resumedAt: T2 })
    expect(unchanged).toBe(s)
  })

  it('ignores a redundant recordBreakStarted while already on a break', () => {
    let s = session('student:a', 'session:a')
    s = recordActiveInterval(s, { from: T0, to: T1 })
    s = recordBreakStarted(s, { startedAt: T1 })
    const unchanged = recordBreakStarted(s, { startedAt: T2 })
    expect(unchanged).toBe(s)
    expect(unchanged.lastBreakAt).toBe(T1)
  })
})

describe('suggestBreak', () => {
  const shortGuidance = { source: 'pilot-guidance' as const, activeMinutesBeforeBreak: 10 }

  it('suggests a break once the active-time threshold is reached', () => {
    let s = session('student:a', 'session:a')
    s = recordActiveInterval(s, { from: T0, to: T1 }) // exactly 10 min
    expect(suggestBreak(s, shortGuidance).breakSuggested).toBe(true)
  })

  it('does not suggest a break before the threshold', () => {
    const s = recordActiveInterval(session('student:a', 'session:a'), { from: T0, to: T2 }) // 12 min accrued
    const belowThreshold = suggestBreak(s, { source: 'pilot-guidance', activeMinutesBeforeBreak: 60 })
    expect(belowThreshold.breakSuggested).toBe(false)
  })

  it('is idempotent once suggested', () => {
    let s = recordActiveInterval(session('student:a', 'session:a'), { from: T0, to: T1 })
    s = suggestBreak(s, shortGuidance)
    const again = suggestBreak(s, shortGuidance)
    expect(again).toBe(s)
  })

  it('does not re-suggest immediately after a break, before the next threshold worth of active time', () => {
    let s = recordActiveInterval(session('student:a', 'session:a'), { from: T0, to: T1 })
    s = suggestBreak(s, shortGuidance)
    expect(s.breakSuggested).toBe(true)
    s = recordBreakStarted(s, { startedAt: T1 })
    s = recordBreakEnded(s, { resumedAt: T2 })
    expect(suggestBreak(s, shortGuidance).breakSuggested).toBe(false)
  })

  it('defaults to the conservative pilot guidance when none is supplied', () => {
    expect(DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE).toEqual({
      source: 'pilot-guidance',
      activeMinutesBeforeBreak: 25,
    })
  })
})

describe('resolveFamilyPilotBreakGuidance', () => {
  it('reuses an existing resolved Study effective settings break interval', () => {
    expect(resolveFamilyPilotBreakGuidance(20)).toEqual({
      source: 'study-effective-settings',
      activeMinutesBeforeBreak: 20,
    })
  })

  it('falls back to the labeled pilot default when no settings value exists', () => {
    expect(resolveFamilyPilotBreakGuidance(undefined)).toEqual(DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE)
    expect(resolveFamilyPilotBreakGuidance(0)).toEqual(DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE)
    expect(resolveFamilyPilotBreakGuidance(-5)).toEqual(DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE)
  })
})

describe('reload from snapshot', () => {
  it('continues identically after a JSON round-trip, as a page reload would produce', () => {
    let live = session('student:a', 'session:a')
    live = recordActiveInterval(live, { from: T0, to: T1 })

    const reloaded: FamilyPilotFocusSession = JSON.parse(JSON.stringify(live))
    expect(reloaded).toEqual(live)

    const liveNext = recordActiveInterval(live, { from: T1, to: T4 })
    const reloadedNext = recordActiveInterval(reloaded, { from: T1, to: T4 })
    expect(reloadedNext).toEqual(liveNext)
  })
})

describe('isolation', () => {
  it('keeps two students entirely independent', () => {
    const a0 = session('student:a', 'session:shared')
    const b0 = session('student:b', 'session:shared')
    const a1 = recordActiveInterval(a0, { from: T0, to: T1 })
    expect(b0.elapsedActiveSeconds).toBe(0)
    expect(a1.studentRef).toBe('student:a')
    expect(b0.studentRef).toBe('student:b')
  })

  it('keeps two sessions for the same student entirely independent', () => {
    const first = session('student:a', 'session:one')
    const second = session('student:a', 'session:two')
    const firstAfter = recordActiveInterval(first, { from: T0, to: T4 })
    const secondAfter = recordBreakStarted(second, { startedAt: T0 })
    expect(firstAfter.elapsedActiveSeconds).toBe(1800)
    expect(secondAfter.activeSince).toBeNull()
    expect(secondAfter.elapsedActiveSeconds).toBe(0)
  })
})

describe('completed session', () => {
  it('stops accruing time once the host stops reporting intervals for it', () => {
    let s = session('student:a', 'session:a')
    s = recordActiveInterval(s, { from: T0, to: T1 })
    // Study Runtime reports the assignment completed; the host records no
    // further intervals. Nothing in this module reads a live clock, so
    // repeated reads never add time on their own.
    const first = focusSnapshot(s)
    const second = focusSnapshot(s)
    expect(second).toEqual(first)
    expect(second.elapsedActiveSeconds).toBe(600)
  })
})

describe('focusSnapshot', () => {
  it('projects without mutating or extrapolating from the underlying session', () => {
    const s = recordActiveInterval(session('student:a', 'session:a'), { from: T0, to: T1 })
    expect(focusSnapshot(s)).toEqual({
      studentRef: 'student:a',
      sessionRef: 'session:a',
      startedAt: T0,
      isActive: true,
      elapsedActiveSeconds: 600,
      elapsedActiveMinutes: 10,
      lastBreakAt: null,
      breakSuggested: false,
    })
  })

  it('reports inactive while on a break', () => {
    const s = recordBreakStarted(session('student:a', 'session:a'), { startedAt: T0 })
    expect(focusSnapshot(s).isActive).toBe(false)
  })
})

describe('no emotional or diagnostic labels', () => {
  const bannedTerms = [
    'diagnos', 'attention', 'distract', 'adhd', 'disorder',
    'struggl', 'behavior', 'inattent', 'disability',
  ]

  it('keeps every user-facing label free of diagnostic or emotional language', () => {
    const s = suggestBreak(
      recordActiveInterval(session('student:a', 'session:a'), { from: T0, to: T1 }),
      { source: 'pilot-guidance', activeMinutesBeforeBreak: 1 },
    )
    const text = JSON.stringify({ s, snapshot: focusSnapshot(s), guidance: DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE }).toLowerCase()
    for (const term of bannedTerms) expect(text).not.toContain(term)
  })
})

describe('deterministic clock injection', () => {
  it('never reads the system clock; every timestamp is supplied by the caller', () => {
    const originalNow = Date.now
    Date.now = () => { throw new Error('unexpected system clock read') }
    try {
      let s = session('student:clock', 'session:clock')
      s = recordActiveInterval(s, { from: T0, to: T1 })
      s = suggestBreak(s, { source: 'pilot-guidance', activeMinutesBeforeBreak: 5 })
      s = recordBreakStarted(s, { startedAt: T1 })
      s = recordBreakEnded(s, { resumedAt: T2 })
      focusSnapshot(s)
    } finally {
      Date.now = originalNow
    }
  })
})
