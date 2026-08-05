import { describe, expect, it } from 'vitest'
import { recordLocalPreAcceptanceSafetyStop, readLocalSafetyStops, type PreAcceptanceSafetyFailureMode } from './localStopLedger'

function memoryStorage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
}

describe('A6-4 local pre-acceptance safety-stop ledger', () => {
  it.each([
    'classifier-unreachable', 'request-timeout', 'gateway-503', 'authentication-failure', 'malformed-server-response', 'non-production-safety-port', 'network-failure-mid-request',
  ] as const)('durably records %s without learner text and survives refresh', async (failureMode: PreAcceptanceSafetyFailureMode) => {
    const storage = memoryStorage()
    const record = await recordLocalPreAcceptanceSafetyStop({
      occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode,
      serverCaptureStatus: failureMode === 'authentication-failure' ? 'server-not-contacted' : 'server-acceptance-not-confirmed',
    }, storage)
    expect(record).toMatchObject({ studentRef: 'learner:test', failureMode, captureOrigin: 'local-pre-acceptance-stop' })
    expect(readLocalSafetyStops(storage)).toEqual([record])
    expect(JSON.stringify(readLocalSafetyStops(storage))).not.toContain('transient')
  })

  it('keeps two same-instant stops and reads a forward-compatible v2 record', async () => {
    const storage = memoryStorage()
    await recordLocalPreAcceptanceSafetyStop({ occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed' }, storage)
    await recordLocalPreAcceptanceSafetyStop({ occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode: 'network-failure-mid-request', serverCaptureStatus: 'server-acceptance-not-confirmed' }, storage)
    expect(readLocalSafetyStops(storage)).toHaveLength(2)
    storage.setItem('manuel-academy.study.local-safety-stops.v1', JSON.stringify([{ schemaVersion: 2, recordId: 'v2-stop', occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', sessionRef: 's', serverCaptureStatus: 'future-status', captureOrigin: 'local-pre-acceptance-stop' }]))
    expect(readLocalSafetyStops(storage)[0]).toMatchObject({ schemaVersion: 2, serverCaptureStatus: 'future-status' })
  })

  it('persists a quota failure as incomplete after reload, or unavailable for total storage failure', async () => {
    const values = new Map<string, string>()
    const quota = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (key.endsWith(':health')) values.set(key, value); else throw new Error('quota') } }
    await recordLocalPreAcceptanceSafetyStop({ occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed' }, quota)
    expect(values.get('manuel-academy.study.local-safety-stops.v1:health')).toBe('failed')
    expect(readLocalSafetyStops(quota)).toEqual([])
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(await recordLocalPreAcceptanceSafetyStop({ occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:test', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed' }, blocked)).toBeNull()
  })

  it('uses Web Locks to serialize concurrent writes and marks detected clobber incomplete on fallback', async () => {
    const storage = memoryStorage()
    const lockCalls: string[] = []
    const locks = { request: async <T>(name: string, callback: () => Promise<T>) => { lockCalls.push(name); return callback() } }
    await Promise.all(['one', 'two'].map((studentRef) => recordLocalPreAcceptanceSafetyStop({ occurredAt: '2026-08-05T12:00:00.000Z', studentRef, failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed' }, storage, locks)))
    expect(lockCalls).toHaveLength(2)
    expect(readLocalSafetyStops(storage)).toHaveLength(2)
    const clobber = { getItem: storage.getItem, setItem: (key: string, value: string) => storage.setItem(key, key === 'manuel-academy.study.local-safety-stops.v1' ? '[]' : value) }
    await recordLocalPreAcceptanceSafetyStop({ occurredAt: '2026-08-05T12:00:01.000Z', studentRef: 'three', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed' }, clobber, undefined)
    expect(storage.getItem('manuel-academy.study.local-safety-stops.v1:health')).toBe('failed')
  })
})
