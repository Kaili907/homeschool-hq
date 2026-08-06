import { describe, expect, it, vi } from 'vitest'
import { createStudySessionTransport } from '../client/studySessionTransport'
import type { StudySessionGrant } from '../contracts/identity/session'
import { learnerSafeResult } from './learnerSafe'
import { isSessionStoppedByLocalLedger, readLocalSafetyStops } from './localStopLedger'
import {
  createMountedStudySafetyPort,
  MOUNTED_STUDY_SAFETY_CLASSIFIER_VERSION,
} from './mountedPort'

const scope = {
  householdRef: 'household:mounted-test',
  learnerRef: 'learner:mounted-test',
  sessionRef: 'session:mounted-test',
}

/** The classifier gateway refuses a request without the learner Study session. */
function installedTransport() {
  const transport = createStudySessionTransport()
  transport.install({
    schemaVersion: 1,
    status: 'issued',
    sessionReference: 'aca_stu_v1_synthetic-study-session-reference-aaaaaaaaa',
    expiresAt: '2026-08-06T12:00:00.000Z',
  } as StudySessionGrant)
  return transport
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
      sessionAuthorization: installedTransport(),
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
      sessionAuthorization: installedTransport(),
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

    const unavailable = createMountedStudySafetyPort({ getAccessToken: async () => null, sessionAuthorization: installedTransport() })
    await expect(unavailable.evaluate(request)).resolves.toEqual({
      outcome: 'invalid',
      mayContinue: false,
      adultHelpState: 'not-confirmed',
    })
  })

  // A6-5-C — an outage record must carry sessionRef, or the durable stop lock
  // has nothing to match on and a gateway outage stops the lesson only until
  // the learner refreshes.
  it('records a gateway outage against the session, so the durable stop lock seeds from it', async () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
    vi.stubGlobal('window', { localStorage: storage })
    try {
      const port = createMountedStudySafetyPort({
        getAccessToken: async () => 'test.access.token',
        fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
        sessionAuthorization: installedTransport(),
      })
      await port.evaluate({
        scope,
        requestRef: 'request:outage',
        studentRef: { kind: 'legacy-profile-id' as const, value: 'profile-mounted-test' },
        contentKind: 'learner-input' as const,
        transientText: 'learner input sentinel',
      })
      expect(readLocalSafetyStops(storage)).toHaveLength(1)
      expect(readLocalSafetyStops(storage)[0]).toMatchObject({
        studentRef: scope.learnerRef,
        sessionRef: scope.sessionRef,
        failureMode: 'gateway-503',
        serverCaptureStatus: 'server-acceptance-not-confirmed',
      })
      expect(isSessionStoppedByLocalLedger({ studentRef: scope.learnerRef, sessionRef: scope.sessionRef }, storage)).toBe(true)
      expect(JSON.stringify(readLocalSafetyStops(storage))).not.toContain('sentinel')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
