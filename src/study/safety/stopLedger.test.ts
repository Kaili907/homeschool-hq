import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudyScope } from '../types'

// A6-5-C — the durable, local-first safety-stop record. A stop must be on
// record the instant it happens, including the stops where the server never
// saw anything, and the session it stopped must stay locked afterwards.

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
const OTHER_SESSION: StudyScope = { ...SCOPE, sessionRef: 'block:math-2:session' }

/** A fresh module graph, i.e. what a page refresh gives the browser. */
async function afterRefresh() {
  vi.resetModules()
  return import('./stopLedger')
}

describe('A6-5-C durable safety-stop ledger', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('localStorage', new MemStorage())
  })

  it('locks the stopped session and keeps it locked through a page refresh', async () => {
    const first = await import('./stopLedger')
    expect(first.isStudySessionStopped(SCOPE)).toBe(false)
    first.recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T14:00:00.000Z',
      classification: 'urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    expect(first.isStudySessionStopped(SCOPE)).toBe(true)

    const reloaded = await afterRefresh()
    expect(reloaded.isStudySessionStopped(SCOPE)).toBe(true)
  })

  it('locks only the session that stopped', async () => {
    const ledger = await import('./stopLedger')
    ledger.recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T14:00:00.000Z',
      classification: 'uncertain',
      deliveryStatus: 'proposed-not-delivered',
    })
    expect(ledger.isStudySessionStopped(SCOPE)).toBe(true)
    expect(ledger.isStudySessionStopped(OTHER_SESSION)).toBe(false)
    expect(ledger.isStudySessionStopped({ ...SCOPE, learnerRef: 'learner:other' })).toBe(false)
  })

  it('records a stop the server captured as captured', async () => {
    const ledger = await import('./stopLedger')
    const record = ledger.recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T14:00:00.000Z',
      classification: 'urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    expect(record).toMatchObject({
      captureStatus: 'captured',
      captureReasonCode: null,
      learnerRef: 'learner:mm',
      classification: 'urgent',
      occurredAt: '2026-08-05T14:00:00.000Z',
    })
  })

  it('records a stop whose server proposal was not confirmed, and still shows it to an adult', async () => {
    const ledger = await import('./stopLedger')
    ledger.recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T14:00:00.000Z',
      classification: 'invalid',
      deliveryStatus: 'not-confirmed',
    })
    const [entry] = ledger.readSafetyStopLedger()
    expect(entry).toMatchObject({ captureStatus: 'not-confirmed' })
    expect(ledger.readSafetyStopLedger()).toHaveLength(1)
  })

  it.each([
    'client-auth-unavailable',
    'client-unauthenticated',
    'client-network-error',
    'client-gateway-error',
    'client-malformed-response',
  ])('records a stop after the client-side failure %s as never-attempted', async (reasonCode) => {
    const ledger = await import('./stopLedger')
    ledger.noteClientSideSafetyFailure(SCOPE, reasonCode)
    ledger.recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T14:00:00.000Z',
      classification: 'invalid',
      deliveryStatus: 'not-confirmed',
    })
    expect(ledger.readSafetyStopLedger()[0]).toMatchObject({
      captureStatus: 'never-attempted',
      captureReasonCode: reasonCode,
    })
  })

  it('does not carry a consumed client-side failure onto a later stop', async () => {
    const ledger = await import('./stopLedger')
    ledger.noteClientSideSafetyFailure(SCOPE, 'client-network-error')
    ledger.recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T14:00:00.000Z',
      classification: 'invalid',
      deliveryStatus: 'not-confirmed',
    })
    ledger.recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T14:05:00.000Z',
      classification: 'urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    const [newest, older] = ledger.readSafetyStopLedger()
    expect(newest).toMatchObject({ occurredAt: '2026-08-05T14:05:00.000Z', captureStatus: 'captured' })
    expect(older).toMatchObject({ captureStatus: 'never-attempted' })
  })

  it('keeps a refused storage write visible to the adult for the rest of the browser session', async () => {
    const refusing = new MemStorage()
    refusing.setItem = () => { throw new Error('QuotaExceededError') }
    vi.stubGlobal('localStorage', refusing)
    const ledger = await import('./stopLedger')
    ledger.recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T14:00:00.000Z',
      classification: 'urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    expect(ledger.readSafetyStopLedger()).toHaveLength(1)
    expect(ledger.isStudySessionStopped(SCOPE)).toBe(true)
  })

  it('stores no learner text — only opaque refs, a classification and a capture status', async () => {
    const store = new MemStorage()
    vi.stubGlobal('localStorage', store)
    const ledger = await import('./stopLedger')
    ledger.recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T14:00:00.000Z',
      classification: 'urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    const raw = JSON.parse(store.getItem('homeschool-hq:study-safety-stops:v1') ?? '[]') as unknown[]
    expect(Object.keys(raw[0] as object).sort()).toEqual([
      'captureReasonCode', 'captureStatus', 'classification', 'householdRef',
      'learnerRef', 'occurredAt', 'sessionRef', 'stopRef',
    ])
  })
})
