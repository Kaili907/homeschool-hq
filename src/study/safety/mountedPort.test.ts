import { describe, expect, it, vi } from 'vitest'
import { learnerSafeResult } from './learnerSafe'
import {
  createMountedStudySafetyPort,
  MOUNTED_STUDY_SAFETY_CLASSIFIER_VERSION,
} from './mountedPort'

const scope = {
  householdRef: 'household:mounted-test',
  learnerRef: 'learner:mounted-test',
  sessionRef: 'session:mounted-test',
}

describe('mounted Study HTTP safety port', () => {
  it('connects learner input and Tutor output to the authenticated real classifier client with distinct valid ids', async () => {
    const requests: Array<Record<string, unknown>> = []
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return {
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          classification: 'clear',
          learner: learnerSafeResult('clear'),
          continueToTutorCore: true,
        }),
      }
    })
    const port = createMountedStudySafetyPort({
      getAccessToken: async () => 'test.access.token',
      fetchImpl,
    })
    const base = {
      scope,
      studentRef: { kind: 'legacy-profile-id' as const, value: 'profile-mounted-test' },
    }
    const input = await port.evaluate({
      ...base,
      requestRef: 'request:one',
      contentKind: 'learner-input',
      transientText: 'learner input sentinel',
    })
    const output = await port.evaluate({
      ...base,
      requestRef: 'request:one',
      contentKind: 'tutor-output',
      transientText: 'Tutor output sentinel',
    })

    expect(port).toMatchObject({
      mode: 'production',
      classifierVersion: MOUNTED_STUDY_SAFETY_CLASSIFIER_VERSION,
    })
    expect(input).toEqual({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' })
    expect(output).toEqual(input)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(requests.map((request) => request.transientText)).toEqual([
      'learner input sentinel',
      'Tutor output sentinel',
    ])
    expect(requests[0]!.requestId).not.toBe(requests[1]!.requestId)
    for (const request of requests) {
      expect(request.requestId).toMatch(/^[0-9a-f-]{36}$/)
      expect(request.sessionId).toMatch(/^[0-9a-f-]{36}$/)
      expect(request.studentRef).toEqual({ kind: 'legacy-profile-id', value: 'profile-mounted-test' })
    }
  })

  it('preserves confirmed durable proposal state and otherwise fails closed', async () => {
    const flagged = createMountedStudySafetyPort({
      getAccessToken: async () => 'test.access.token',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          classification: 'urgent',
          learner: learnerSafeResult('urgent'),
          continueToTutorCore: false,
        }),
      }),
    })
    const request = {
      scope,
      requestRef: 'request:flagged',
      studentRef: { kind: 'legacy-profile-id' as const, value: 'profile-mounted-test' },
      contentKind: 'tutor-output' as const,
      transientText: 'flagged output sentinel',
    }
    await expect(flagged.evaluate(request)).resolves.toEqual({
      outcome: 'urgent',
      mayContinue: false,
      adultHelpState: 'proposed-not-delivered',
    })

    const unavailable = createMountedStudySafetyPort({ getAccessToken: async () => null })
    await expect(unavailable.evaluate(request)).resolves.toEqual({
      outcome: 'invalid',
      mayContinue: false,
      adultHelpState: 'not-confirmed',
    })
  })
})
