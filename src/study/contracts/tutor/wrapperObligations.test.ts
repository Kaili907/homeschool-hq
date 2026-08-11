import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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
  STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT,
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

describe('wrapper landing requirements', () => {
  it('names every condition the contract cannot close by itself', () => {
    expect(STUDY_TUTOR_WRAPPER_LANDING_REQUIREMENTS).toHaveLength(3)
    for (const requirement of STUDY_TUTOR_WRAPPER_LANDING_REQUIREMENTS) {
      expect(requirement.id).toBe('WRAPPER_LANDING_REQUIREMENT')
      // Whatever the status, the enforcement stays with the wrapper's own
      // integration suite: a requirement that quietly became "enforced by a
      // comment" is a requirement nothing enforces.
      expect(requirement.enforcedBy).toBe('production-wrapper-integration-tests')
      expect(Object.isFrozen(requirement)).toBe(true)
      expect(['open', 'closed']).toContain(requirement.status)
    }
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.condition).toBe('F1')
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.requirement).toBe('AWAIT_LAUNCH_BEFORE_DURABLE_PREPARATION')
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.condition).toBe('F4')
    expect(STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT.condition).toBe('F5')
    // Each condition appears exactly once: a duplicated entry would let a card
    // "add" a requirement without adding one.
    expect(new Set(STUDY_TUTOR_WRAPPER_LANDING_REQUIREMENTS.map((r) => r.condition)).size).toBe(3)
  })

  it('records F5 as open, with the legacy fallback deliberately left in place', () => {
    // The card's own summary, as data. `legacySelectorRemainsFallback` is the
    // one a later reader most needs: `selectTutorProgram` STILL answers an
    // unmatched routing id with `registration.programs[0]`, because the mounted
    // preview host depends on it, and the production selector is a separate
    // function that answers `null`. A card that removed the fallback and left
    // this `true` would be lying here rather than silently.
    expect(STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT.status).toBe('open')
    expect(STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT.legacySelectorRemainsFallback).toBe(true)
    expect(STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT.productionSelector).toBe('selectEligibleTutorProgram')
    expect(STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT.malformedReferencePolicy).toBe('reject-not-truncate')
    // No learner grade authority, stated as data so a later card cannot quietly
    // introduce one and leave the claim standing.
    expect(STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT.usesLearnerGradeAuthority).toBe(false)
    expect(STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT.residualBypass)
      .toBe('calling-settleStudyTutorLaunch-directly')
  })

  it('pins the four steps content eligibility must precede, launch first', () => {
    // ZERO DURABLE WORK. The launch is first because eligibility is knowable
    // before a Tutor session is opened, and F1's three durable preparations
    // follow it — so this list is F1's with the launch prepended, and the
    // assertion says exactly that rather than repeating three strings by hand.
    expect([...STUDY_TUTOR_CONTENT_ELIGIBILITY_REQUIREMENT.mustPrecede]).toEqual([
      'tutor-launch-settlement',
      ...STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.mustPrecede,
    ])
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

  /**
   * STUDY-A1-F4-PARSE-BEFORE-HOST-C Phase 12. The host reparse is recorded
   * WITHOUT closing the wrapper obligation, and the two facts are pinned
   * together so neither can drift into the other. A later card that flips
   * `status` to 'closed' because "the host handles it now" fails the first
   * assertion; one that quietly drops the host fields fails the rest.
   */
  it('records the host reparse without closing the wrapper obligation', () => {
    // Unchanged, and the point: a wrapper can still write the assertion.
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.status).toBe('open')
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.residualBypass)
      .toBe('single-explicit-type-assertion')

    // What the host card did change.
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.hostEnforcement)
      .toBe('host-reparse-of-untrusted-result')
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.hostEnforcementCard)
      .toBe('STUDY-A1-F4-PARSE-BEFORE-HOST-C')
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.hostTrustsTheBrand).toBe(false)
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.loadBearingAtHost).toBe(false)

    // The compile-time layer is NOT retired to celebrate the runtime one. Both
    // are named, and they are named as different things.
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.contractEnforcement).toBe('validated-result-brand')
    expect(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.contractEnforcement)
      .not.toBe(STUDY_TUTOR_PARSE_BEFORE_HOST_REQUIREMENT.hostEnforcement)
  })

  it('does not claim in prose that the host closed the wrapper obligation', () => {
    // The honest sentence is "open, but not load-bearing at the host". The
    // comfortable one — that reparsing closed F4 — is held shut here, in the
    // same place and for the same reason the `as unknown as` overstatement is.
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'wrapperObligations.ts'),
      'utf8',
    )
    expect(source).toContain('STILL OPEN')
    expect(source).toContain('LOAD-BEARING AT THE HOST')
    expect(source).not.toMatch(/F4 is (?:now )?closed/i)
    expect(source).not.toMatch(/closes? (?:the )?F4/i)
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

  /**
   * STUDY-A1-PROD-TUTOR-WRAPPER-C. F1 is closed, and this is where the claim is
   * held to its evidence rather than to its own assertion.
   *
   * Closing a requirement by editing one word is exactly the paperwork move the
   * H2 comment warned about, so the checks below are about the code that
   * discharges it: the ordering module must exist, it must be the only producer
   * of the witness, and the host container must actually route its preparation
   * through both halves. If a later card deletes the ordering module or unwires
   * the container, this fails and the closure is exposed as false.
   */
  it('records F1 as closed, with the structural enforcement named', () => {
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.status).toBe('closed')
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.closedBy).toBe('STUDY-A1-PROD-TUTOR-WRAPPER-C')
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.contractEnforcement).toBe('launch-settled-witness')
    // The same residual F4 records, stated rather than glossed over.
    expect(STUDY_TUTOR_AWAIT_LAUNCH_REQUIREMENT.residualBypass).toBe('single-explicit-type-assertion')
  })

  it('is closed by code that exists, not by an edited word', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const ordering = readFileSync(join(root, 'production', 'tutorLaunchOrdering.ts'), 'utf8')
    // One await, one post-await re-assertion, one witness producer.
    expect(ordering).toMatch(/await launch\(\)/)
    expect(ordering).toMatch(/export async function settleStudyTutorLaunch/)
    expect(ordering).toMatch(/export async function prepareDurableStudySession/)
    // The brand is unexported, so nothing else can mint the witness.
    expect(ordering).toMatch(/declare const STUDY_TUTOR_LAUNCH_SETTLED_BRAND: unique symbol/)
    expect(ordering).not.toMatch(/export function settled\b/)

    // And the host actually uses both halves. The three durable preparations
    // live inside the helper, so the container reaching them any other way
    // would show up as the container calling the ports directly during
    // preparation — which is what the integration test proves it does not.
    //
    // STUDY-A1-PRODUCTION-SAFE-CONTAINER — the host body is now
    // studySessionSurface.tsx, rendered by both the preview and the production
    // container. Reading it here is reading the one place the ordering exists.
    const hostDirectory = join(root, '..', 'components', 'study')
    const surface = readFileSync(join(hostDirectory, 'studySessionSurface.tsx'), 'utf8')
    expect(surface).toMatch(/await settleStudyTutorLaunch\(/)
    expect(surface).toMatch(/prepareDurableStudySession\(settled,/)

    // ONE implementation, not two that agree. A production container with its
    // own copy of the ordering would satisfy every assertion above while being
    // free to drift from the preview one, and F1 would be closed for whichever
    // of the two a later card happened to look at.
    const orderingCallers = readdirSync(hostDirectory)
      .filter((name) => (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.includes('.test.'))
      .filter((name) => readFileSync(join(hostDirectory, name), 'utf8').includes('settleStudyTutorLaunch'))
    expect(orderingCallers).toEqual(['studySessionSurface.tsx'])
  })
})
