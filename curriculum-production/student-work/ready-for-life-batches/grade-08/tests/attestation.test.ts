import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { computeCompletionStatus } from '../src/validate.ts'

describe('computeCompletionStatus — the attestation invariant', () => {
  it('a learner assertion alone never certifies a guardian-required task', () => {
    const status = computeCompletionStatus(
      { completionAuthority: 'guardian' },
      { completed: true, timestampIso: '2026-01-01T00:00:00Z' },
      null,
    )
    expect(status).toBe('RECORDED_PENDING_GUARDIAN_ATTESTATION')
    expect(status).not.toBe('CERTIFIED')
  })

  it('a real adult attestation certifies a guardian-required task', () => {
    const status = computeCompletionStatus(
      { completionAuthority: 'guardian' },
      { completed: true, timestampIso: '2026-01-01T00:00:00Z' },
      {
        certifyingActor: 'household-authorized guardian',
        observedTaskDescription: 'Observed the full task from start to finish.',
        timestampIso: '2026-01-01T00:05:00Z',
      },
    )
    expect(status).toBe('CERTIFIED')
  })

  it('a learner-authority task certifies from the learner assertion alone', () => {
    const status = computeCompletionStatus({ completionAuthority: 'learner' }, { completed: true, timestampIso: '2026-01-01T00:00:00Z' }, null)
    expect(status).toBe('CERTIFIED')
  })
})

describe('guardian-authority packages in the authored corpus', () => {
  const entries = loadCorpus()
  const guardianEntries = entries.filter((e) => e.pkg.completionAuthority === 'guardian')

  it('every guardian package rejects a bare learner click (never CERTIFIED without a real AdultAttestation)', () => {
    for (const { pkg } of guardianEntries) {
      const status = computeCompletionStatus(pkg, { completed: true, timestampIso: '2026-01-01T00:00:00Z' }, null)
      expect(status, `${pkg.packageId} must not certify from a learner click alone`).toBe('RECORDED_PENDING_GUARDIAN_ATTESTATION')
    }
  })

  it('every guardian package has requiresGuardianPermissionBeforeStart true and a non-empty evidenceTypes list', () => {
    for (const { pkg } of guardianEntries) {
      expect(pkg.signOff?.requiresGuardianPermissionBeforeStart).toBe(true)
      expect(pkg.signOff?.evidenceTypes.length).toBeGreaterThan(0)
    }
  })
})
