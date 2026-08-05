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
})
