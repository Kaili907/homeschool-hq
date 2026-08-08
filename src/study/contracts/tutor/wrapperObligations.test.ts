import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseStudyTutorRef } from './refs'
import {
  STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE,
  type ValidatedStudyTutorResult,
  acceptStudyTutorResult,
  parseStudyTutorResult,
} from './results'
import { STUDY_TUTOR_CONTRACT_VERSION, type StudyTutorLaunch, type StudyTutorRuntime, type StudyTutorTurn } from './runtime'
import {
  STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT,
  STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT,
  STUDY_TUTOR_WRAPPER_LANDING_REQUIREMENTS,
} from './wrapperObligations'

/**
 * STUDY-A1-TUTOR-CONTRACT-H2 Phases 5 and 6 — the two review conditions the
 * contract cannot close on its own.
 *
 * Everything here is contract-level and uses local fakes. No production wrapper
 * is implemented, and StudySessionContainer is not touched: F1 is a property of
 * a host that does not exist yet, so what is testable now is the shape of the
 * obligation and the fact that violating it is observable.
 */

const REF = parseStudyTutorRef('study-session:9f2c1')!

const LAUNCH: StudyTutorLaunch = {
  sessionRef: REF,
  lessonRef: parseStudyTutorRef('lesson:fractions-equivalence')!,
  householdTimeZone: 'America/Detroit',
  learnerLocalDate: '2026-08-01',
}

describe('F4 — parse before a result is a contract value', () => {
  it('turns anything unparseable into a quarantine rather than a typed lie', () => {
    for (const raw of [
      undefined,
      null,
      'accepted',
      { status: 'accepted' },
      { status: 'accepted', eventRef: 'event.1', visibleText: 'ok', transcript: ['turn one'] },
      { status: 'accepted', eventRef: 'I am scared to tell my mum', visibleText: 'ok' },
      { status: 'accepted', eventRef: 'event.1', visibleText: 'a'.repeat(2_000_000) },
      { status: 'completed', eventRef: 'event.1' },
    ]) {
      expect(acceptStudyTutorResult(raw)).toEqual({
        status: 'quarantined',
        reasonCode: STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE,
      })
    }
  })

  it('passes a valid result through unchanged, and frozen', () => {
    const raw = { status: 'accepted', eventRef: 'event.1', visibleText: 'Try that step again.' }
    const accepted = acceptStudyTutorResult(raw)
    expect(accepted).toEqual(raw)
    expect(accepted).not.toBe(raw)
    expect(Object.isFrozen(accepted)).toBe(true)
    // Same decision as the parser, every time: the helper adds a branch, not a rule.
    expect(accepted).toEqual(parseStudyTutorResult(raw))
  })

  it('is total against a hostile implementation, like the parser it wraps', () => {
    const hostile = {
      status: 'accepted',
      eventRef: 'event.1',
      get visibleText(): string { throw new Error('accessor') },
    }
    expect(() => acceptStudyTutorResult(hostile)).not.toThrow()
    expect(acceptStudyTutorResult(hostile).status).toBe('quarantined')
  })

  it('quarantines with a code the contract already admits', () => {
    // The fail-closed code is itself a legal operator code, so a host that logs
    // or matches on reason codes needs no special case for it.
    const quarantined = acceptStudyTutorResult(null)
    expect(parseStudyTutorResult(quarantined)).toEqual(quarantined)
  })

  it('lets a wrapper satisfy the boundary with a raw transport typed `unknown`', () => {
    // The shape a landing wrapper is required to have: the transport's output
    // is `unknown` until it has been parsed, and is never asserted to be a
    // contract value beforehand.
    class ParsingWrapper implements StudyTutorRuntime {
      readonly contractVersion = STUDY_TUTOR_CONTRACT_VERSION
      constructor(private readonly transport: (turn: StudyTutorTurn) => Promise<unknown>) {}
      async launch(_launch: StudyTutorLaunch): Promise<void> {}
      // H3 Phase 8: the transport's output is `unknown`, and the declared return
      // is the validated type, so `acceptStudyTutorResult` is not merely the
      // recommended way to write this method — it is the only way that compiles.
      async submit(turn: StudyTutorTurn): Promise<ValidatedStudyTutorResult> {
        return acceptStudyTutorResult(await this.transport(turn))
      }
    }
    const smuggling = new ParsingWrapper(async () => ({
      status: 'accepted',
      eventRef: 'event.1',
      visibleText: 'ok',
      officialGrade: 'C',
    }))
    return expect(smuggling.submit({} as StudyTutorTurn)).resolves.toEqual({
      status: 'quarantined',
      reasonCode: STUDY_TUTOR_UNPARSED_RESULT_REASON_CODE,
    })
  })
})

describe('F1 — launch must be awaited before durable preparation', () => {
  /** The three durable preparations, in the order the mounted host would do them. */
  function recordingHost(runtime: StudyTutorRuntime) {
    const durable: string[] = []
    const prepare = (): void => {
      durable.push('calendar-start', 'session-launched-event', 'session-persistence')
    }
    return {
      durable,
      /** What a landing wrapper is required to do. */
      correct: async (): Promise<void> => {
        await runtime.launch(LAUNCH)
        prepare()
      },
      /**
       * What F1 forbids: the promise is created and never sequenced against the
       * durable writes. It is returned here only so the test can settle it —
       * a host doing this drops it, and its rejection reaches no one.
       */
      violating: (): Promise<void> => {
        const dropped = runtime.launch(LAUNCH)
        prepare()
        return dropped
      },
    }
  }

  function runtimeWith(launch: () => Promise<void>): StudyTutorRuntime {
    return {
      contractVersion: STUDY_TUTOR_CONTRACT_VERSION,
      launch,
      submit: async () => acceptStudyTutorResult({ status: 'quarantined', reasonCode: 'not-under-test' }),
    }
  }

  it('is asynchronous, so a host has something to await', () => {
    const runtime = runtimeWith(async () => {})
    expect(runtime.launch(LAUNCH)).toBeInstanceOf(Promise)
  })

  it('orders durable preparation after a settled launch when awaited', async () => {
    const order: string[] = []
    const runtime = runtimeWith(async () => {
      await Promise.resolve()
      order.push('launch-settled')
    })
    const host = recordingHost(runtime)
    await host.correct()
    expect([...order, ...host.durable]).toEqual([
      'launch-settled',
      'calendar-start',
      'session-launched-event',
      'session-persistence',
    ])
  })

  it('records a Study session that never started when launch is not awaited', async () => {
    // The failure the requirement exists to prevent, made visible: launch
    // rejects, and the host has already written all three durable records for a
    // learner whose Tutor session does not exist.
    let rejected = false
    const runtime = runtimeWith(async () => {
      await Promise.resolve()
      rejected = true
      throw new Error('Tutor session could not be opened.')
    })
    const host = recordingHost(runtime)
    const dropped = host.violating()
    // All three durable records are already written, and the launch has not
    // even failed yet — there was never a moment the host could have checked.
    expect(host.durable).toEqual(['calendar-start', 'session-launched-event', 'session-persistence'])
    expect(rejected).toBe(false)
    await expect(dropped).rejects.toThrow('Tutor session could not be opened.')
    expect(rejected).toBe(true)
    expect(host.durable).toHaveLength(3)

    // And awaiting the same launch is what would have stopped it.
    const awaited = recordingHost(runtime)
    await expect(awaited.correct()).rejects.toThrow('Tutor session could not be opened.')
    expect(awaited.durable).toEqual([])
  })
})

describe('wrapper landing requirements stay open', () => {
  it('names both conditions the contract cannot close by itself', () => {
    expect(STUDY_TUTOR_WRAPPER_LANDING_REQUIREMENTS).toHaveLength(2)
    for (const requirement of STUDY_TUTOR_WRAPPER_LANDING_REQUIREMENTS) {
      expect(requirement.id).toBe('WRAPPER_LANDING_REQUIREMENT')
      // Not "closed" here, and not quietly downgraded to a comment later.
      expect(requirement.status).toBe('open')
      expect(requirement.enforcedBy).toBe('production-wrapper-integration-tests')
      expect(Object.isFrozen(requirement)).toBe(true)
    }
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.condition).toBe('F1')
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.requirement).toBe('AWAIT_LAUNCH_BEFORE_DURABLE_PREPARATION')
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.condition).toBe('F4')
  })

  it('pins the three durable preparations a launch must precede', () => {
    expect([...STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.mustPrecede]).toEqual([
      'calendar-start',
      'session-launched-event',
      'session-persistence',
    ])
  })

  it('states that a raw result is `unknown` until parsed', () => {
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.rawResultType).toBe('unknown')
    expect([...STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.admissibleOutcomes]).toEqual([
      'accepted-contract-value',
      'quarantine',
      'refusal',
    ])
  })

  // H3 Phase 8/12. F4 gained a structural boundary; it did not become closed,
  // and F1 gained nothing at all. Both of those are asserted rather than
  // described, so a later card cannot quietly promote either one.
  it('records the H3 structural enforcement of F4 without closing it', () => {
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.status).toBe('open')
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.contractEnforcement).toBe('validated-result-brand')
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.contractEnforcementCard).toBe('STUDY-A1-TUTOR-CONTRACT-H3')
  })

  // H4 Phase 10. H3 documented the residual bypass as a DOUBLE assertion, which
  // overstated what the brand costs. Measured on this tree, a single assertion
  // compiles from the transport's output, from `unknown`, and from an object
  // literal. The correction is pinned as data so the weaker, comfortable
  // sentence cannot come back.
  it('states the residual bypass as one assertion, not two', () => {
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.residualBypass)
      .toBe('single-explicit-type-assertion')
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.residualBypassCorrectedBy)
      .toBe('STUDY-A1-TUTOR-CONTRACT-H4')
    // Still open: naming the bypass precisely is not the same as closing it,
    // and TypeScript cannot close it at all.
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.status).toBe('open')
  })

  it('names the two bypasses the brand does remove, so the claim stays narrow', () => {
    expect([...STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.removesBypasses]).toEqual([
      'declaring-the-transport-return-type-as-the-contract-type',
      'object-literal-of-the-right-shape',
    ])
  })

  it('does not claim in prose that a double assertion is required', () => {
    // The overstatement lived in a comment, so a comment is where it is held
    // shut. `as unknown as` must not reappear as the stated cost of the bypass.
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'wrapperObligations.ts'),
      'utf8',
    )
    const doubleAssertion = new RegExp(`as${'\\s'}+unknown${'\\s'}+as${'\\s'}+ValidatedStudyTutorResult`)
    expect(source).not.toMatch(doubleAssertion)
    expect(source).toMatch(/ONE assertion is\s+\* enough/)
  })

  it('leaves the async launch requirement exactly where H2 left it', () => {
    // H3 touches nothing about F1. The host that must await `launch` still does
    // not exist, so claiming this closed would be a claim about code nobody has
    // written.
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.status).toBe('open')
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.requirement).toBe('AWAIT_LAUNCH_BEFORE_DURABLE_PREPARATION')
    expect(Object.hasOwn(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT, 'contractEnforcement')).toBe(false)
  })
})
