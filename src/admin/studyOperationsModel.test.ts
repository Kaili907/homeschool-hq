import { describe, expect, it } from 'vitest'
import {
  STUDY_OPERATION_GATE_IDS,
  decodeStudyOperationsProjection,
  deriveStudyOperationsStatus,
  type StudyOperationStatus,
} from './studyOperationsModel'

const STATUSES: readonly StudyOperationStatus[] = [
  'ready', 'partial', 'manual_review', 'unavailable', 'not_configured',
  'blocked', 'unknown', 'ready', 'partial', 'manual_review',
]

function projection() {
  const gates = STUDY_OPERATION_GATE_IDS.map((id, index) => ({
    id,
    status: STATUSES[index],
    reasonCode: STATUSES[index] === 'ready' ? 'verified' : 'unknown_evidence',
    contractVersion: index % 2 === 0 ? 'study-production.v1' : null,
    lastVerifiedAt: index % 2 === 0 ? '2026-08-10T14:00:00.000Z' : null,
    operatorAction: STATUSES[index] === 'ready' ? 'none' : 'retry_evidence',
  }))
  return {
    contractVersion: 2,
    schemaVersion: 1,
    generatedAt: '2026-08-10T14:05:00.000Z',
    overallStatus: deriveStudyOperationsStatus(gates),
    gates,
  }
}

describe('Admin Study Operations wire model', () => {
  it('accepts the exact ordered ten-gate projection and every readiness status', () => {
    const decoded = decodeStudyOperationsProjection(projection())
    expect(decoded?.gates.map((gate) => gate.id)).toEqual(STUDY_OPERATION_GATE_IDS)
    expect(new Set(decoded?.gates.map((gate) => gate.status))).toEqual(new Set([
      'ready', 'partial', 'manual_review', 'unavailable', 'not_configured',
      'blocked', 'unknown',
    ]))
    expect(decoded?.overallStatus).toBe('blocked')
  })

  it('derives one summary from separate gates without replacing their states', () => {
    expect(deriveStudyOperationsStatus([{ status: 'ready' }, { status: 'unknown' }])).toBe('unknown')
    expect(deriveStudyOperationsStatus([{ status: 'unavailable' }, { status: 'partial' }])).toBe('partial')
    expect(deriveStudyOperationsStatus([{ status: 'blocked' }, { status: 'ready' }])).toBe('blocked')
    expect(deriveStudyOperationsStatus([])).toBe('unknown')
  })

  it('rejects malformed, reordered, extra, and privacy-bearing server data', () => {
    const extraTop = { ...projection(), learnerId: 'private-learner' }
    expect(decodeStudyOperationsProjection(extraTop)).toBeNull()

    const extraGate = projection()
    extraGate.gates[0] = { ...extraGate.gates[0], rawError: 'provider SECRET' } as never
    expect(decodeStudyOperationsProjection(extraGate)).toBeNull()

    const reordered = projection()
    ;[reordered.gates[0], reordered.gates[1]] = [reordered.gates[1], reordered.gates[0]]
    expect(decodeStudyOperationsProjection(reordered)).toBeNull()

    expect(decodeStudyOperationsProjection({ ...projection(), overallStatus: 'ready' })).toBeNull()
    expect(decodeStudyOperationsProjection({ ...projection(), generatedAt: 'yesterday' })).toBeNull()
  })
})
