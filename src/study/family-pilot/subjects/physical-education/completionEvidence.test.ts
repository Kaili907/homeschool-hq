import { describe, expect, it } from 'vitest'
import { buildCompletionEvidence } from './completionEvidence'

function evidence(overrides: Partial<Parameters<typeof buildCompletionEvidence>[0]> = {}) {
  return buildCompletionEvidence({
    lessonRef: 'ma-g5-physical-education-u01-l01',
    segmentRef: 'ma-g5-physical-education-u01-l01:segment:1',
    completedAt: '2026-08-12T14:00:00.000Z',
    recordedBy: 'learner',
    ...overrides,
  })
}

describe('completion-evidence metadata', () => {
  it('records only completion, never a body metric', () => {
    const result = evidence()
    expect(result.evidenceKind).toBe('self-reported-completion')
    expect(result.bodyMetricsIncluded).toBe(false)
  })

  it('never carries media evidence — the no-media proof path', () => {
    expect(evidence().mediaIncluded).toBe(false)
  })

  it('never carries a raw reflection — nothing here can hold learner text', () => {
    const result = evidence()
    expect(result.rawReflectionIncluded).toBe(false)
    expect(result).not.toHaveProperty('text')
    expect(result).not.toHaveProperty('reflection')
    expect(result).not.toHaveProperty('transcript')
    expect(result).not.toHaveProperty('note')
  })

  it('rejects a lessonRef or segmentRef that is not a stable opaque reference', () => {
    expect(() => evidence({ lessonRef: '../not-safe' })).toThrow()
    expect(() => evidence({ segmentRef: '' })).toThrow()
  })

  it('rejects a missing completedAt instead of defaulting silently', () => {
    expect(() => evidence({ completedAt: '' })).toThrow()
  })
})
