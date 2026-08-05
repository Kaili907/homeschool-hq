import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STUDY_SAFETY_SCHEMA_VERSION } from '../contracts/safety'
import type { StudyScope } from '../types'
import { learnerSafeResult } from './learnerSafe'
import { createMountedStudySafetyPort } from './mountedPort'
import { recordSafetyStop } from './stopLedger'

// A6-5-C — the capture status has to be true. A stop that follows a client-side
// failure has no server proposal anywhere, and the adult record must say so
// rather than implying the server holds a copy.

class MemStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

const SCOPE: StudyScope = {
  householdRef: 'household:a',
  learnerRef: 'learner:mm',
  sessionRef: 'block:math-1:session',
}

const REQUEST = {
  scope: SCOPE,
  requestRef: 'request:a6-5-c:1',
  studentRef: { kind: 'legacy-profile-id' as const, value: 'profile:mm' },
  contentKind: 'learner-input' as const,
  transientText: 'ready',
}

function urgentBody() {
  return {
    schemaVersion: STUDY_SAFETY_SCHEMA_VERSION,
    classification: 'urgent',
    learner: learnerSafeResult('urgent'),
    continueToTutorCore: false,
  }
}

/** Records the stop the container would record for this evaluation result. */
function stopAfterEvaluation(adultHelpState: string) {
  return recordSafetyStop({
    scope: SCOPE,
    occurredAt: '2026-08-05T14:00:00.000Z',
    classification: adultHelpState === 'proposed-not-delivered' ? 'urgent' : 'invalid',
    deliveryStatus: adultHelpState === 'proposed-not-delivered' ? 'proposed-not-delivered' : 'not-confirmed',
  })
}

describe('A6-5-C mounted safety port capture status', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemStorage())
  })

  it.each([
    ['unauthenticated', { getAccessToken: async () => null }, 'client-unauthenticated'],
    ['auth unavailable', { getAccessToken: async () => { throw new Error('no session') } }, 'client-auth-unavailable'],
    ['network error', {
      getAccessToken: async () => 'header.payload.signature',
      fetchImpl: async () => { throw new Error('offline') },
    }, 'client-network-error'],
    ['gateway error', {
      getAccessToken: async () => 'header.payload.signature',
      fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
    }, 'client-gateway-error'],
    ['malformed response', {
      getAccessToken: async () => 'header.payload.signature',
      fetchImpl: async () => ({ ok: true, json: async () => ({ classification: 'clear' }) }),
    }, 'client-malformed-response'],
  ])('records a stop after a %s failure as never-attempted', async (_label, deps, reasonCode) => {
    const port = createMountedStudySafetyPort(deps as Parameters<typeof createMountedStudySafetyPort>[0])
    const result = await port.evaluate(REQUEST)
    expect(result).toMatchObject({ outcome: 'invalid', mayContinue: false })

    expect(stopAfterEvaluation(result.adultHelpState)).toMatchObject({
      captureStatus: 'never-attempted',
      captureReasonCode: reasonCode,
    })
  })

  it('records a stop the gateway answered as captured', async () => {
    const port = createMountedStudySafetyPort({
      getAccessToken: async () => 'header.payload.signature',
      fetchImpl: async () => ({ ok: true, json: async () => urgentBody() }),
    })
    const result = await port.evaluate(REQUEST)
    expect(result).toMatchObject({ outcome: 'urgent', adultHelpState: 'proposed-not-delivered' })

    expect(stopAfterEvaluation(result.adultHelpState)).toMatchObject({
      captureStatus: 'captured',
      captureReasonCode: null,
    })
  })
})
