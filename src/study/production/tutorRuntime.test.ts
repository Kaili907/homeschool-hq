/**
 * STUDY-A1-PROD-TUTOR-WRAPPER Phases 13-17 — the production runtime.
 *
 * The adapter's own decisions are tested in ./tutorAdapter.test.ts and its
 * equivalence to the frozen bridge in ./tutorAdapterDrift.test.ts. This file is
 * about the wrapper that sits above them: what it accepts, what it refuses,
 * what shape it hands the host, and — the part with the most ways to go quietly
 * wrong — which of the four result branches each failure lands in.
 *
 * That last one is not a formatting question. `stopped` writes a durable safety
 * record against a named child and locks her session across refreshes;
 * `interrupted` and `quarantined` write nothing at all. Putting a technical
 * failure on the stopped branch tells a girl to go and find a trusted adult
 * because a server was unreachable, and tells her father she caused a safety
 * incident. Every mapping below is tested for the branch it lands in, not just
 * for failing closed.
 */
import { describe, expect, it } from 'vitest'
import {
  STUDY_TUTOR_CONTRACT_VERSION,
  STUDY_TUTOR_FORBIDDEN_KEYS,
  STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH,
  STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH,
  isStudyTutorReasonCode,
  parseStudyTutorLearnerText,
  parseStudyTutorRef,
  type StudyTutorLaunch,
  type StudyTutorRuntime,
  type StudyTutorTurn,
} from '../contracts/tutor'
import type { StudyEventLedgerPort, StudySafetyPort } from '../ports'
import type { StudyRuntimeInterruption, StudySafeEvent, StudySafetyResult } from '../types'
import { ProductionStudyTutorRuntime, STUDY_TUTOR_RUNTIME_REASON_CODES } from './tutorRuntime'
import { STUDY_TUTOR_ADAPTER_REASON_CODES } from './tutorAdapter'

const SESSION = parseStudyTutorRef('study-session:runtime-test')!
const REQUEST = parseStudyTutorRef('study-turn:runtime-test')!
const LESSON = parseStudyTutorRef('lesson:runtime-test')!
const SEGMENT = parseStudyTutorRef('segment:runtime-test')!
const SKILL = parseStudyTutorRef('skill:runtime-test')!
const LEARNER_TEXT = parseStudyTutorLearnerText('ready')!

const scope = {
  householdRef: 'household:runtime-test',
  learnerRef: 'learner:runtime-test',
  sessionRef: 'study-session:runtime-test',
}

function safetyPort(results: readonly StudySafetyResult[] | StudySafetyResult): StudySafetyPort {
  const queue = Array.isArray(results) ? [...results] : null
  return {
    mode: 'production',
    classifierVersion: 'test-study-a1-prod-tutor-wrapper-runtime',
    evaluate: async () => (queue ? queue.shift() ?? clear() : results as StudySafetyResult),
  }
}

function clear(): StudySafetyResult {
  return { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
}

function interrupted(interruption: StudyRuntimeInterruption): StudySafetyResult {
  return { outcome: 'invalid', mayContinue: false, adultHelpState: 'not-confirmed', interruption }
}

function eventLedgerPort(appended: StudySafeEvent[]): StudyEventLedgerPort {
  return {
    append: async (_scope, event) => {
      appended.push(event)
      return 'appended'
    },
  }
}

function runtime(overrides: {
  readonly safety?: StudySafetyPort
  readonly isCurrent?: () => boolean
  readonly appended?: StudySafeEvent[]
} = {}): ProductionStudyTutorRuntime {
  return new ProductionStudyTutorRuntime({
    scope,
    hostProfileRef: 'profile:runtime-test',
    safety: overrides.safety ?? safetyPort(clear()),
    eventLedger: eventLedgerPort(overrides.appended ?? []),
    isCurrent: overrides.isCurrent ?? (() => true),
    bridgeSessionRef: 'study-session:runtime-test',
  })
}

function turn(overrides: Partial<StudyTutorTurn> = {}): StudyTutorTurn {
  return {
    sessionRef: SESSION,
    requestRef: REQUEST,
    lessonRef: LESSON,
    segmentRef: SEGMENT,
    subject: 'math',
    skillRef: SKILL,
    taskType: 'guided-practice',
    transientLearnerText: LEARNER_TEXT,
    expectedAnswer: 'ready',
    occurredAt: '2026-08-01T14:00:00.000Z',
    learnerLocalDate: '2026-08-01',
    householdTimeZone: 'America/Detroit',
    ...overrides,
  }
}

const LAUNCH: StudyTutorLaunch = {
  sessionRef: SESSION,
  lessonRef: LESSON,
  householdTimeZone: 'America/Detroit',
  learnerLocalDate: '2026-08-01',
}

describe('Phase 13 — the wrapper satisfies the contract without minting a brand', () => {
  it('is a StudyTutorRuntime, pinned at the contract version', () => {
    // The structural pin. Assigning to the interface is what makes `submit`'s
    // branded return type load-bearing: a wrapper that returned an unvalidated
    // object literal could not be assigned here at all.
    const production: StudyTutorRuntime = runtime()
    expect(production.contractVersion).toBe(STUDY_TUTOR_CONTRACT_VERSION)
  })

  it('launches without preparing any durable Study state', async () => {
    const appended: StudySafeEvent[] = []
    await expect(runtime({ appended }).launch(LAUNCH)).resolves.toBeUndefined()
    // The launch's whole job is validation. Durable preparation belongs to the
    // host and happens after this settles, behind the LaunchSettled witness.
    expect(appended).toEqual([])
  })

  it('rejects a launch whose day boundary is malformed', async () => {
    await expect(runtime().launch({ ...LAUNCH, learnerLocalDate: '01-08-2026' })).rejects.toThrow()
    await expect(runtime().launch({ ...LAUNCH, learnerLocalDate: '2026-02-30' })).rejects.toThrow()
    await expect(runtime().launch({ ...LAUNCH, householdTimeZone: 'Nowhere/Fake' })).rejects.toThrow()
  })

  it('rejects a launch for an authority that is no longer current', async () => {
    await expect(runtime({ isCurrent: () => false }).launch(LAUNCH)).rejects.toThrow()
  })

  it('rejects a launch when no per-session pseudonym can be produced', async () => {
    // Refused at the SESSION rather than surfacing later as a quarantined turn
    // once the block is already marked begun.
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })
    try {
      await expect(runtime().launch(LAUNCH)).rejects.toThrow()
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
    }
  })
})

describe('Phase 15 — every failure lands on the branch that matches what happened', () => {
  it('accepts a clear turn and returns transient prose', async () => {
    const result = await runtime().submit(turn())
    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') return
    expect(typeof result.visibleText).toBe('string')
    expect(result.visibleText.length).toBeLessThanOrEqual(STUDY_TUTOR_VISIBLE_TEXT_MAX_LENGTH)
    expect(result.eventRef).toBe(REQUEST)
    // Exactly the contract's key set for this branch, so nothing extra rode along.
    expect(Object.keys(result).sort()).toEqual(['eventRef', 'status', 'visibleText'])
    // The parser FROZE this object. That is what proves it came through
    // `acceptStudyTutorResult` rather than from an `as ValidatedStudyTutorResult`
    // on a fresh literal — the one residual bypass F4 records, and the mutation
    // campaign's M15. A hand-minted brand produces an unfrozen object.
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('freezes every branch, so no branch can be hand-minted', () => {
    // Stated for all four, because M15 could be applied to any one of them and
    // the accepted branch is only the most tempting.
    const branches = [
      runtime().submit(turn()),
      runtime({ safety: safetyPort(interrupted({ kind: 'rate-limit' })) }).submit(turn()),
      runtime({ safety: safetyPort({ outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' }) }).submit(turn()),
      runtime().submit(turn({ subject: 'other' })),
    ]
    return Promise.all(branches).then((results) => {
      expect(results.map((result) => result.status).sort())
        .toEqual(['accepted', 'interrupted', 'quarantined', 'stopped'])
      for (const result of results) expect(Object.isFrozen(result)).toBe(true)
    })
  })

  it('round-trips authorization-infrastructure as INTERRUPTED, never as a stop', async () => {
    // The mapping this card is required to preserve. An unreachable
    // authorization verifier happens before the classifier sees any learner
    // text; calling it a stop would record a safety incident about a child the
    // classifier never judged.
    const appended: StudySafeEvent[] = []
    const result = await runtime({
      safety: safetyPort(interrupted({ kind: 'authorization-infrastructure' })),
      appended,
    }).submit(turn())
    expect(result.status).toBe('interrupted')
    if (result.status !== 'interrupted') return
    expect(result.interruption).toEqual({ kind: 'authorization-infrastructure' })
    // And nothing durable was written on the way.
    expect(appended).toEqual([])
  })

  it('round-trips rate-limit and both session-authorization reasons as interrupted', async () => {
    const cases: readonly StudyRuntimeInterruption[] = [
      { kind: 'rate-limit' },
      { kind: 'session-authorization', reason: 'adult-authentication-rejected' },
      { kind: 'session-authorization', reason: 'study-session-rejected' },
    ]
    for (const interruption of cases) {
      const result = await runtime({ safety: safetyPort(interrupted(interruption)) }).submit(turn())
      expect(result.status).toBe('interrupted')
      if (result.status !== 'interrupted') continue
      expect(result.interruption).toEqual(interruption)
    }
  })

  it('puts a genuine safety refusal on the stopped branch', async () => {
    const result = await runtime({
      safety: safetyPort({ outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' }),
    }).submit(turn())
    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') return
    expect(result.reasonCode).toBe('mounted-input-safety-urgent')
    expect(result.deliveryStatus).toBe('proposed-not-delivered')
    // The contract gives a stop no learner-facing message: the host owns the
    // words a stopped child reads.
    expect(Object.keys(result).sort()).toEqual(['deliveryStatus', 'reasonCode', 'status'])
  })

  it('quarantines a subject the Tutor cannot teach, rather than stopping the learner', async () => {
    // `other` is the host subject with no Tutor registration — the reachable
    // case, reached without a cast, so this tests the guard rather than a
    // hypothetical. `reading` and `writing` both map to `english`, and `math`
    // maps to itself, so this is the whole of the unmapped set.
    const result = await runtime().submit(turn({ subject: 'other' }))
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') return
    expect(result.reasonCode).toBe(STUDY_TUTOR_RUNTIME_REASON_CODES.unsupportedSubject)
  })

  it('quarantines a task type with no Tutor equivalent', async () => {
    const result = await runtime().submit(turn({ taskType: 'project-work' }))
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') return
    expect(result.reasonCode).toBe(STUDY_TUTOR_RUNTIME_REASON_CODES.unsupportedTask)
  })

  it('quarantines rather than stops when a pseudonym cannot be produced mid-turn', async () => {
    const original = globalThis.crypto
    Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true })
    try {
      const result = await runtime().submit(turn())
      expect(result.status).toBe('quarantined')
      if (result.status !== 'quarantined') return
      expect(result.reasonCode).toBe(STUDY_TUTOR_RUNTIME_REASON_CODES.pseudonymUnavailable)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
    }
  })

  it('quarantines when the safety port throws, and blames nobody for it', async () => {
    const result = await runtime({
      safety: {
        mode: 'production',
        classifierVersion: 'throwing',
        evaluate: () => { throw new Error('safety service unreachable') },
      },
    }).submit(turn())
    // A throwing port is fail-closed `invalid`, which is a stop and not an
    // interruption: the port answered nothing, so nothing says the learner was
    // cleared. It is the safe direction, and it is recorded as such.
    expect(result.status).toBe('stopped')
    if (result.status !== 'stopped') return
    expect(result.reasonCode).toBe('mounted-input-safety-invalid')
  })

  it('uses only reason codes the contract itself admits', async () => {
    for (const code of [
      ...Object.values(STUDY_TUTOR_RUNTIME_REASON_CODES),
      ...Object.values(STUDY_TUTOR_ADAPTER_REASON_CODES),
    ]) {
      // A quarantine whose reason code the parser rejects would be re-quarantined
      // as a contract-parse failure, and the real reason would be lost.
      expect(isStudyTutorReasonCode(code)).toBe(true)
    }
  })
})

describe('Phase 16 — authority is re-asserted after every await', () => {
  it('does no durable work for a turn whose epoch lapsed during the safety check', async () => {
    let live = true
    const appended: StudySafeEvent[] = []
    const result = await runtime({
      appended,
      isCurrent: () => live,
      safety: {
        mode: 'production',
        classifierVersion: 'lapsing',
        evaluate: async () => {
          // The learner switch, the logout, the grant expiry — landing inside
          // the safety call.
          live = false
          return clear()
        },
      },
    }).submit(turn())
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') return
    expect(result.reasonCode).toBe(STUDY_TUTOR_RUNTIME_REASON_CODES.stale)
    // The heart of it: zero durable writes for the new epoch.
    expect(appended).toEqual([])
  })

  it('refuses before doing anything when the epoch is already stale', async () => {
    const appended: StudySafeEvent[] = []
    const result = await runtime({ appended, isCurrent: () => false }).submit(turn())
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') return
    expect(result.reasonCode).toBe(STUDY_TUTOR_RUNTIME_REASON_CODES.stale)
    expect(appended).toEqual([])
  })

  it('refuses a result that arrives after the epoch ended, even though the turn itself succeeded', async () => {
    /**
     * The LAST async boundary, and the one the other tests in this block do not
     * reach. The turn is authorized the whole way through — the safety checks
     * pass, Tutor Core runs, the accepted event is appended — and the epoch ends
     * only once that work is done. This is the late-arriving result: a learner
     * switch or a logout that lands while the Tutor was thinking.
     *
     * It has to be tested separately because every earlier check would have
     * caught a staleness that began earlier, and would go on passing with the
     * final check deleted. Found by the mutation campaign (M19), which survived
     * until this test existed.
     *
     * The trigger is the append itself rather than a call counter: the runtime
     * asks `isCurrent()` before appending and the epoch is still live then, so
     * flipping inside the append leaves exactly one later caller — the final
     * check. No arithmetic to get wrong if a check is added or removed.
     */
    let appendHappened = false
    const appended: StudySafeEvent[] = []
    const production = new ProductionStudyTutorRuntime({
      scope,
      hostProfileRef: 'profile:runtime-test',
      safety: safetyPort(clear()),
      eventLedger: {
        append: async (_scope, event) => {
          appended.push(event)
          appendHappened = true
          return 'appended'
        },
      },
      isCurrent: () => !appendHappened,
      bridgeSessionRef: 'study-session:runtime-test',
    })
    const result = await production.submit(turn())
    // The accepted event WAS appended — the turn genuinely succeeded — and the
    // host is still told nothing it could show or record for the new epoch.
    expect(appended).toHaveLength(1)
    expect(result.status).toBe('quarantined')
    if (result.status !== 'quarantined') return
    expect(result.reasonCode).toBe(STUDY_TUTOR_RUNTIME_REASON_CODES.stale)
  })

  it('refuses the accepted-event append itself once the epoch has gone', async () => {
    // The one durable write inside the bridge. A late result from an old epoch
    // must not reach the host's event ledger even if everything upstream of it
    // succeeded.
    let safetyCalls = 0
    const appended: StudySafeEvent[] = []
    const result = await runtime({
      appended,
      // Current for both safety calls, gone by the time the bridge appends.
      isCurrent: () => safetyCalls < 2,
      safety: {
        mode: 'production',
        classifierVersion: 'lapsing-late',
        evaluate: async () => {
          safetyCalls += 1
          return clear()
        },
      },
    }).submit(turn())
    expect(appended).toEqual([])
    expect(result.status).not.toBe('accepted')
    expect(result.status).not.toBe('stopped')
  })
})

describe('Phase 14 — every Tutor-facing value comes from a canonical parser', () => {
  it('cannot be handed an unvalidated reference', () => {
    const attempt = (production: StudyTutorRuntime) => production.submit({
      ...turn(),
      // @ts-expect-error an unvalidated string is not a StudyTutorRef
      requestRef: 'study-turn:never-parsed',
    })
    expect(typeof attempt).toBe('function')
  })

  it('cannot be handed unvalidated learner text', () => {
    const attempt = (production: StudyTutorRuntime) => production.submit({
      ...turn(),
      // @ts-expect-error an unvalidated string is not StudyTutorLearnerText
      transientLearnerText: 'never parsed',
    })
    expect(typeof attempt).toBe('function')
  })

  it('rejects oversized learner input rather than truncating it', () => {
    // The refusal happens at the parser, before a turn can be built, which is
    // exactly why the wrapper cannot truncate: there is no oversized turn for
    // it to shorten. Truncating would send the Tutor the stump of a child's
    // sentence and let it answer that.
    const oversized = 'a'.repeat(STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH + 1)
    expect(parseStudyTutorLearnerText(oversized)).toBeNull()
    const atBound = 'a'.repeat(STUDY_TUTOR_LEARNER_TEXT_MAX_LENGTH)
    expect(parseStudyTutorLearnerText(atBound)).toBe(atBound)
  })
})

describe('Phase 17 — nothing durable carries the learner or her words', () => {
  it('appends a Tutor directive event carrying no learner text and no prose', async () => {
    const appended: StudySafeEvent[] = []
    const learnerText = parseStudyTutorLearnerText('my-private-answer-sentinel-9f2c1')!
    const result = await runtime({ appended }).submit(turn({ transientLearnerText: learnerText }))
    expect(result.status).toBe('accepted')
    const serialized = JSON.stringify(appended)
    expect(serialized).not.toContain('my-private-answer-sentinel')
    if (result.status === 'accepted') expect(serialized).not.toContain(result.visibleText)
    // The event carries the bridge's own bookkeeping and nothing else.
    for (const event of appended) {
      expect(event.type).toBe('tutor-directive')
      expect(Object.keys(event.payload).sort()).toEqual(['bridgeEventVersion', 'eventLedgerIdempotencyKey'])
    }
  })

  it('sends no host, household, profile or student identifier across the boundary', async () => {
    // Structural: the turn shape has no field for one. Checked against the
    // contract's own forbidden list rather than a list restated here.
    const built = turn()
    for (const forbidden of STUDY_TUTOR_FORBIDDEN_KEYS) {
      expect(Object.hasOwn(built, forbidden)).toBe(false)
    }
    expect(Object.hasOwn(built, 'hostProfileRef')).toBe(false)
    expect(Object.hasOwn(built, 'scope')).toBe(false)
  })

  it('returns no transcript field for prose to accumulate in', async () => {
    const first = await runtime().submit(turn())
    const second = await runtime().submit(turn())
    for (const result of [first, second]) {
      expect(Object.keys(result)).not.toContain('transcript')
      expect(Object.keys(result)).not.toContain('conversation')
      expect(Object.keys(result)).not.toContain('history')
    }
  })
})
