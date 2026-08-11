import { describe, expect, it } from 'vitest'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from './ports'
import { AcceptedRc1HostRuntime } from './runtimeFacade'
import { createStudyTurnRequestRef } from './studyRequestRef'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'

// STUDY-A1-COMP Phase 10. `validInterruption` used to ask
// `SESSION_AUTHORIZATION_REASONS.has(String(candidate.reason))`, so an object
// whose `toString` returned an approved code was admitted — and then the ORIGINAL
// object, not the validated string, travelled out as the interruption reason.
// Anything that object closed over (a bearer, a session reference, a server body)
// would ride into the container and onto the learner's surface.
//
// A reason must now be a primitive string before membership is even asked, and
// only the primitive may leave. Everything malformed falls to the genuine
// safety-stop path, which is the safe direction.

function portReturning(interruptionReason: unknown): StudySafetyPort {
  return {
    mode: 'production',
    classifierVersion: 'test-study-a1-comp-strict-interruption-v1',
    // A hostile or malformed port is exactly the threat model: the runtime is
    // the last validator before the container acts on the result.
    evaluate: async () => ({
      outcome: 'invalid' as const,
      mayContinue: false,
      adultHelpState: 'not-confirmed' as const,
      interruption: { kind: 'session-authorization', reason: interruptionReason },
    }) as never,
  }
}

async function submitWith(safety: StudySafetyPort) {
  const context = syntheticGrade5StudyContext('math')
  const { ports: localPorts } = createLocalDevelopmentStudyPorts()
  const ports: StudyPortBundle = { ...localPorts, safety }
  const { entry, scope } = await createSyntheticMathBlock(ports, {
    suffix: `strict-${Math.random().toString(36).slice(2, 8)}`,
  })
  const sessionRef = `${entry.blockRef}:session`
  const runtime = new AcceptedRc1HostRuntime(ports)
  runtime.launch(context, entry, sessionRef)
  return runtime.submit({
    context,
    entry,
    scope: { ...scope, sessionRef },
    requestRef: createStudyTurnRequestRef(),
    segmentRef: entry.segments[0]!.segmentRef,
    transientLearnerText: 'ready',
    expectedAnswer: 'ready',
    occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
  })
}

describe('runtime facade interruption validation is strict about the reason type', () => {
  it('refuses an object whose toString spoofs an approved reason', async () => {
    const secret = 'x-study-session-reference-that-must-never-travel'
    const spoof = {
      toString: () => 'study-session-rejected',
      capturedSessionReference: secret,
    }
    const result = await submitWith(portReturning(spoof))

    // Not honoured as an interruption, so the turn stays on the true
    // safety-stop path rather than being quietly downgraded.
    expect(result.status).toBe('stopped')
    // Nothing the hostile object carried may appear anywhere in the result.
    expect(JSON.stringify(result)).not.toContain(secret)
  })

  it('refuses a getter-backed hostile reason', async () => {
    const hostile = {}
    Object.defineProperty(hostile, 'toString', {
      value: () => 'adult-authentication-rejected',
      enumerable: false,
    })
    const result = await submitWith(portReturning(hostile))
    expect(result.status).toBe('stopped')
  })

  it.each([
    ['an object reason', { reason: 'study-session-rejected' }],
    ['an array reason', ['study-session-rejected']],
    ['a number reason', 42],
    ['a boolean reason', true],
    ['a null reason', null],
    ['an undefined reason', undefined],
    ['a String object reason', new String('study-session-rejected')],
  ])('refuses %s and keeps the turn on the safety-stop path', async (_label, reason) => {
    const result = await submitWith(portReturning(reason))
    expect(result.status).toBe('stopped')
  })

  it('still honours the two genuine primitive reasons', async () => {
    for (const reason of ['adult-authentication-rejected', 'study-session-rejected'] as const) {
      const result = await submitWith(portReturning(reason))
      expect(result.status).toBe('interrupted')
      if (result.status !== 'interrupted') throw new Error('unreachable')
      expect(result.interruption.kind).toBe('session-authorization')
      // The primitive itself, not a wrapper that merely stringifies to it.
      expect(typeof (result.interruption as { reason?: unknown }).reason).toBe('string')
      expect((result.interruption as { reason?: unknown }).reason).toBe(reason)
    }
  })

  it('keeps the reason it checked when an accessor answers differently each read', async () => {
    // Validating and rebuilding must be ONE pass. When they were two, the check
    // read `reason` once and the rebuild read it again — so an own accessor
    // could answer the check with an approved code and hand the second read a
    // different object, which then travelled out as the interruption reason.
    const secret = 'x-bearer-that-must-never-travel'
    let reads = 0
    const shifting = {
      kind: 'session-authorization',
      get reason() {
        reads += 1
        // Approved on the first read; hostile on every read after it.
        return reads <= 1 ? 'study-session-rejected' : { capturedBearer: secret }
      },
    }
    const result = await submitWith({
      mode: 'production',
      classifierVersion: 'test-study-a1-comp-strict-interruption-v1',
      evaluate: async () => ({
        outcome: 'invalid' as const,
        mayContinue: false,
        adultHelpState: 'not-confirmed' as const,
        interruption: shifting,
      }) as never,
    })

    // Whichever way it resolves, the hostile object never leaves the runtime.
    expect(JSON.stringify(result)).not.toContain(secret)
    if (result.status === 'interrupted') {
      expect(typeof (result.interruption as { reason?: unknown }).reason).toBe('string')
      expect((result.interruption as { reason?: unknown }).reason).toBe('study-session-rejected')
    } else {
      expect(result.status).toBe('stopped')
    }
  })

  it('returns an interruption object carrying nothing but the validated kind and reason', async () => {
    const result = await submitWith(portReturning('study-session-rejected'))
    expect(result.status).toBe('interrupted')
    if (result.status !== 'interrupted') throw new Error('unreachable')
    expect(Object.keys(result.interruption).sort()).toEqual(['kind', 'reason'])
  })
})
