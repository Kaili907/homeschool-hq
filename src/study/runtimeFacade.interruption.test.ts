import { describe, expect, it } from 'vitest'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import type { StudyPortBundle, StudySafetyPort } from './ports'
import { AcceptedRc1HostRuntime } from './runtimeFacade'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'
import type { StudySafetyRequest, StudySafetyResult } from './types'

// STUDY-A1-AUTH-C — the runtime result model. A refused session and a shed
// request are interruptions, not stops: they carry no classification, no reason
// code, no delivery status and nothing about the learner. Everything else — a
// real flag, an outage, and any result shape the runtime cannot vouch for —
// stays on the true safety-stop path, which is the safer direction to fail in.

const CLEAR: StudySafetyResult = { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }
const INVALID: StudySafetyResult = { outcome: 'invalid', mayContinue: false, adultHelpState: 'not-confirmed' }

const SESSION_REJECTED: StudySafetyResult = {
  ...INVALID,
  interruption: { kind: 'session-authorization', reason: 'study-session-rejected' },
}
const BEARER_REJECTED: StudySafetyResult = {
  ...INVALID,
  interruption: { kind: 'session-authorization', reason: 'adult-authentication-rejected' },
}
const RATE_LIMITED: StudySafetyResult = { ...INVALID, interruption: { kind: 'rate-limit' } }

function port(
  evaluate: (request: StudySafetyRequest) => StudySafetyResult | Promise<StudySafetyResult>,
): StudySafetyPort {
  return { mode: 'production', classifierVersion: 'test-a1-auth-c-v1', evaluate }
}

let sequence = 0

async function turn(safety: StudySafetyPort) {
  sequence += 1
  const context = syntheticGrade5StudyContext('math')
  const { ports: localPorts } = createLocalDevelopmentStudyPorts()
  const ports: StudyPortBundle = { ...localPorts, safety }
  const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: `a1-auth-c-${sequence}` })
  const sessionRef = `session:a1-auth-c:${sequence}`
  const runtime = new AcceptedRc1HostRuntime(ports)
  runtime.launch(context, entry, sessionRef)
  return runtime.submit({
    context,
    entry,
    scope: { ...scope, sessionRef },
    requestRef: `request:a1-auth-c:${sequence}`,
    segmentRef: entry.segments[0]!.segmentRef,
    transientLearnerText: 'learner-text-sentinel',
    expectedAnswer: 'ready',
    occurredAt: new Date(SYNTHETIC_NOW.getTime() + 5_000).toISOString(),
  })
}

/** Input classification refuses; Tutor Core is never reached. */
function inputPort(decision: StudySafetyResult): StudySafetyPort {
  return port((request) => (request.contentKind === 'learner-input' ? decision : CLEAR))
}

describe('Study runtime interruption boundary', () => {
  it.each([
    ['a refused Study session', SESSION_REJECTED, { kind: 'session-authorization', reason: 'study-session-rejected' }],
    ['a refused adult bearer', BEARER_REJECTED, { kind: 'session-authorization', reason: 'adult-authentication-rejected' }],
    ['a shed request', RATE_LIMITED, { kind: 'rate-limit' }],
  ])('returns a typed interruption rather than a stop for %s', async (_label, decision, interruption) => {
    const result = await turn(inputPort(decision))
    expect(result).toEqual({ status: 'interrupted', interruption, coreSubmitInvocations: 0 })
  })

  it('carries no classification, reason code, delivery status, identifier or learner text', async () => {
    const result = await turn(inputPort(SESSION_REJECTED))
    expect(result.status).toBe('interrupted')
    const exposed = JSON.stringify(result)
    for (const forbidden of [
      'urgent', 'uncertain', 'invalid', 'classifier', 'deliveryStatus', 'reasonCode',
      'studentMessage', 'learner-text-sentinel', 'household', 'session:a1-auth-c',
    ]) {
      expect(exposed).not.toContain(forbidden)
    }
  })

  it.each([
    ['urgent', { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' } as StudySafetyResult],
    ['uncertain', { outcome: 'uncertain', mayContinue: false, adultHelpState: 'proposed-not-delivered' } as StudySafetyResult],
    ['a fail-closed invalid result', INVALID],
  ])('keeps %s on the safety-stop path with no interruption', async (_label, decision) => {
    const result = await turn(inputPort(decision))
    expect(result.status).toBe('stopped')
    expect(result).not.toHaveProperty('interruption')
  })

  it('keeps a classifier that throws on the safety-stop path', async () => {
    const result = await turn(port(() => { throw new Error('classifier unreachable') }))
    expect(result).toMatchObject({ status: 'stopped', classification: 'invalid' })
  })

  // A forged or unrecognised interruption must never buy a learner past the
  // safety stop, and must never be honoured as a known one.
  it.each([
    ['an unknown interruption kind', { kind: 'trust-me' }],
    ['an unknown authorization reason', { kind: 'session-authorization', reason: 'household-rejected' }],
    ['a session-authorization interruption with no reason', { kind: 'session-authorization' }],
    ['an interruption carrying extra fields', { kind: 'rate-limit', retryAfter: 30, detail: 'server-secret' }],
    ['an interruption carrying a session reference', { kind: 'session-authorization', reason: 'study-session-rejected', sessionReference: 'aca_stu_v1_leak' }],
    ['a non-object interruption', 'session-authorization'],
    ['a null interruption', null],
    ['an array interruption', [{ kind: 'rate-limit' }]],
  ])('falls back to the safety stop for %s', async (_label, interruption) => {
    const result = await turn(inputPort({ ...INVALID, interruption } as unknown as StudySafetyResult))
    expect(result.status).toBe('stopped')
    expect(JSON.stringify(result)).not.toContain('server-secret')
    expect(JSON.stringify(result)).not.toContain('aca_stu_v1_')
  })

  // An interruption is only ever attached to a fail-closed result. Anything that
  // claims one while also claiming the learner may continue is not trustworthy.
  it.each([
    ['a clear result', { outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }],
    ['an urgent result', { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' }],
    ['an uncertain result', { outcome: 'uncertain', mayContinue: false, adultHelpState: 'proposed-not-delivered' }],
  ])('refuses an interruption attached to %s', async (_label, decision) => {
    const result = await turn(inputPort({
      ...decision,
      interruption: { kind: 'session-authorization', reason: 'study-session-rejected' },
    } as unknown as StudySafetyResult))
    expect(result.status).toBe('stopped')
    expect(result).not.toHaveProperty('interruption')
  })

  it('never invokes Tutor Core for an interruption raised by the learner-input check', async () => {
    const kinds: string[] = []
    const result = await turn(port((request) => {
      kinds.push(request.contentKind)
      return SESSION_REJECTED
    }))
    expect(result).toMatchObject({ status: 'interrupted', coreSubmitInvocations: 0 })
    expect(kinds).toEqual(['learner-input'])
  })

  // The session can be refused between the two checks. Tutor Core has run by
  // then, but the refusal is still a lifecycle event, so it must not be dressed
  // up as a safety stop. The Tutor text is discarded either way.
  it('interrupts rather than stops when the session is refused on the Tutor-output check', async () => {
    const result = await turn(port((request) => (
      request.contentKind === 'learner-input' ? CLEAR : SESSION_REJECTED
    )))
    expect(result).toEqual({
      status: 'interrupted',
      interruption: { kind: 'session-authorization', reason: 'study-session-rejected' },
      coreSubmitInvocations: 1,
    })
  })

  it('still stops on a genuine Tutor-output flag', async () => {
    const result = await turn(port((request) => (
      request.contentKind === 'learner-input'
        ? CLEAR
        : { outcome: 'urgent', mayContinue: false, adultHelpState: 'proposed-not-delivered' }
    )))
    expect(result).toMatchObject({ status: 'stopped', classification: 'urgent', coreSubmitInvocations: 1 })
  })

  it('leaves an accepted turn untouched', async () => {
    const result = await turn(port(() => CLEAR))
    expect(result.status).toBe('accepted')
  })

  // The point of separating a shed request from a stop: the very next attempt
  // on the same session and the same segment must still be able to succeed.
  it('lets the turn after a rate limit be accepted normally', async () => {
    let shed = true
    const context = syntheticGrade5StudyContext('math')
    const { ports: localPorts } = createLocalDevelopmentStudyPorts()
    const ports: StudyPortBundle = {
      ...localPorts,
      safety: port(() => (shed ? RATE_LIMITED : CLEAR)),
    }
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'a1-auth-c-retry' })
    const sessionRef = 'session:a1-auth-c:retry'
    const runtime = new AcceptedRc1HostRuntime(ports)
    runtime.launch(context, entry, sessionRef)
    const attempt = (requestRef: string, offsetMs: number) => runtime.submit({
      context,
      entry,
      scope: { ...scope, sessionRef },
      requestRef,
      segmentRef: entry.segments[0]!.segmentRef,
      transientLearnerText: 'ready',
      expectedAnswer: 'ready',
      occurredAt: new Date(SYNTHETIC_NOW.getTime() + offsetMs).toISOString(),
    })

    expect(await attempt('request:a1-auth-c:retry:1', 5_000)).toMatchObject({ status: 'interrupted' })
    shed = false
    expect(await attempt('request:a1-auth-c:retry:2', 9_000)).toMatchObject({ status: 'accepted' })
  })
})


