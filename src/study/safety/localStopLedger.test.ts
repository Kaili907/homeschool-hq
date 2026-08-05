import { describe, expect, it } from 'vitest'
import { isSessionStoppedByLocalLedger, LOCAL_SAFETY_STOP_LEDGER_KEY, readLocalSafetyStops, recordLocalPreAcceptanceSafetyStop, recordLocalSessionSafetyStop, type PreAcceptanceSafetyFailureMode } from './localStopLedger'

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

// A6-5-C — the same ledger now carries the durable stop lock. Every trap below
// is a way the lock could silently fail open and let a flagged learner back in.
describe('A6-5-C durable stop lock over the unified ledger', () => {
  const SESSION = { studentRef: 'learner:kid', sessionRef: 'block-1:session' }

  it('locks the session from a server-answered stop and records no learner text', async () => {
    const storage = memoryStorage()
    expect(isSessionStoppedByLocalLedger(SESSION, storage)).toBe(false)
    const record = await recordLocalSessionSafetyStop({ ...SESSION, occurredAt: '2026-08-05T14:00:00.000Z', serverCaptureStatus: 'server-answered-stop' }, storage)
    expect(record).toMatchObject({ schemaVersion: 2, serverCaptureStatus: 'server-answered-stop', captureOrigin: 'local-session-stop' })
    expect(record?.failureMode).toBeUndefined()
    expect(isSessionStoppedByLocalLedger(SESSION, storage)).toBe(true)
  })

  // TRAP 3 — an A6-4 outage record is a stop too. If the lock only seeded from
  // A6-5-C's own records, a gateway outage would stop the lesson and then let a
  // refresh straight back in.
  it('seeds the lock from an A6-4 outage record, and from an unknown-status record', async () => {
    const storage = memoryStorage()
    await recordLocalPreAcceptanceSafetyStop({ ...SESSION, occurredAt: '2026-08-05T14:00:00.000Z', failureMode: 'gateway-503', serverCaptureStatus: 'server-acceptance-not-confirmed' }, storage)
    expect(isSessionStoppedByLocalLedger(SESSION, storage)).toBe(true)

    const other = memoryStorage()
    other.setItem(LOCAL_SAFETY_STOP_LEDGER_KEY, JSON.stringify([{ schemaVersion: 2, recordId: 'future', occurredAt: '2026-08-05T14:00:00.000Z', ...SESSION, serverCaptureStatus: 'status-from-a-newer-build', captureOrigin: 'origin-from-a-newer-build' }]))
    expect(isSessionStoppedByLocalLedger(SESSION, other)).toBe(true)
  })

  // TRAP 2 — a record the reader drops is a session silently unlocked.
  it('keeps v1, v2, absent-failureMode and absent-sessionRef records through the reader', async () => {
    const storage = memoryStorage()
    storage.setItem(LOCAL_SAFETY_STOP_LEDGER_KEY, JSON.stringify([
      { schemaVersion: 1, recordId: 'v1', occurredAt: '2026-08-05T12:00:00.000Z', studentRef: 'learner:kid', failureMode: 'gateway-503', serverCaptureStatus: 'server-not-contacted', captureOrigin: 'local-pre-acceptance-stop' },
      { schemaVersion: 2, recordId: 'v2-session', occurredAt: '2026-08-05T13:00:00.000Z', ...SESSION, serverCaptureStatus: 'server-answered-stop', captureOrigin: 'local-session-stop' },
      { schemaVersion: 2, recordId: 'v2-unknown', occurredAt: '2026-08-05T14:00:00.000Z', ...SESSION, serverCaptureStatus: 'future-status', captureOrigin: 'future-origin' },
    ]))
    expect(readLocalSafetyStops(storage).map((record) => record.recordId)).toEqual(['v1', 'v2-session', 'v2-unknown'])
  })

  // TRAP 1 — recordId keys on the session, never on the optional failureMode.
  // Two stops in one session at the same instant must both survive; collapsing
  // them would drop a real safety event from the parent's panel.
  it('keeps two same-session same-instant stops distinct rather than deduping one away', async () => {
    const storage = memoryStorage()
    const first = await recordLocalSessionSafetyStop({ ...SESSION, occurredAt: '2026-08-05T14:00:00.000Z', serverCaptureStatus: 'server-answered-stop' }, storage)
    const second = await recordLocalSessionSafetyStop({ ...SESSION, occurredAt: '2026-08-05T14:00:00.000Z', serverCaptureStatus: 'server-acceptance-not-confirmed' }, storage)
    expect(first!.recordId).not.toBe(second!.recordId)
    expect(first!.recordId).toContain(SESSION.sessionRef)
    expect(first!.recordId).not.toContain('undefined')
    expect(readLocalSafetyStops(storage)).toHaveLength(2)
  })

  it('locks only the stopped session and only that learner', async () => {
    const storage = memoryStorage()
    await recordLocalSessionSafetyStop({ ...SESSION, occurredAt: '2026-08-05T14:00:00.000Z', serverCaptureStatus: 'server-answered-stop' }, storage)
    expect(isSessionStoppedByLocalLedger({ ...SESSION, sessionRef: 'block-2:session' }, storage)).toBe(false)
    expect(isSessionStoppedByLocalLedger({ ...SESSION, studentRef: 'learner:sibling' }, storage)).toBe(false)
  })
})
