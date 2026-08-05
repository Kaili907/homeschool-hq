import { describe, expect, it } from 'vitest'
import { recordLocalPreAcceptanceSafetyStop, readLocalSafetyStops, type PreAcceptanceSafetyFailureMode } from './localStopLedger'

function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
}

describe('A6-4 local pre-acceptance safety-stop ledger', () => {
  it.each([
    'classifier-unreachable', 'request-timeout', 'gateway-503', 'authentication-failure', 'malformed-server-response', 'non-production-safety-port', 'network-failure-mid-request',
  ] as const)('durably records %s without learner text and survives refresh', (failureMode: PreAcceptanceSafetyFailureMode) => {
    const storage = memoryStorage()
    const record = recordLocalPreAcceptanceSafetyStop({
      occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode,
      serverCaptureStatus: failureMode === 'authentication-failure' ? 'server-not-contacted' : 'server-acceptance-not-confirmed',
    }, storage)
    expect(record).toMatchObject({ studentRef: 'learner:test', failureMode, captureOrigin: 'local-pre-acceptance-stop' })
    expect(readLocalSafetyStops(storage)).toEqual([record])
    expect(JSON.stringify(readLocalSafetyStops(storage))).not.toContain('transient')
  })

  it('keeps two same-instant stops and reads a forward-compatible v2 record', () => {
    const storage = memoryStorage()
    recordLocalPreAcceptanceSafetyStop({ occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed' }, storage)
    recordLocalPreAcceptanceSafetyStop({ occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode: 'network-failure-mid-request', serverCaptureStatus: 'server-acceptance-not-confirmed' }, storage)
    expect(readLocalSafetyStops(storage)).toHaveLength(2)
    storage.setItem('manuel-academy.study.local-safety-stops.v1', JSON.stringify([{ schemaVersion: 2, recordId: 'v2-stop', occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', sessionRef: 's', serverCaptureStatus: 'future-status', captureOrigin: 'local-pre-acceptance-stop' }]))
    expect(readLocalSafetyStops(storage)[0]).toMatchObject({ schemaVersion: 2, serverCaptureStatus: 'future-status' })
  })

  it('reports unavailable history when storage fails', () => {
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(recordLocalPreAcceptanceSafetyStop({ occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed' }, blocked)).toBeNull()
  })
})
