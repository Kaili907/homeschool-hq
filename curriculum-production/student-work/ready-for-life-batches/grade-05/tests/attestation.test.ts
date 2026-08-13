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

describe('attestation shape across the authored grade-05 corpus', () => {
  const entries = loadCorpus()

  it('signOff is non-null iff completionAuthority is guardian, and null iff learner', () => {
    for (const { pkg } of entries) {
      if (pkg.completionAuthority === 'guardian') {
        expect(pkg.signOff, `${pkg.packageId} is guardian but signOff is null`).not.toBeNull()
      } else {
        expect(pkg.signOff, `${pkg.packageId} is learner but signOff is non-null`).toBeNull()
      }
    }
  })

  it('every guardian package has identifiablePhotoRequired: false', () => {
    const guardianEntries = entries.filter((e) => e.pkg.completionAuthority === 'guardian')
    expect(guardianEntries.length).toBeGreaterThan(0)
    for (const { pkg } of guardianEntries) {
      expect(pkg.signOff?.identifiablePhotoRequired).toBe(false)
    }
  })

  it('counts exactly 7 guardian and 29 learner lessons, matching the authored safety judgment calls', () => {
    const guardianCount = entries.filter((e) => e.pkg.completionAuthority === 'guardian').length
    const learnerCount = entries.filter((e) => e.pkg.completionAuthority === 'learner').length
    expect(guardianCount).toBe(7)
    expect(learnerCount).toBe(29)
    expect(guardianCount + learnerCount).toBe(36)
  })

  it('none of the 7 guardian sign-off requests ever certify from a bare learner click', () => {
    const guardianEntries = entries.filter((e) => e.pkg.completionAuthority === 'guardian')
    for (const { pkg } of guardianEntries) {
      const status = computeCompletionStatus(
        { completionAuthority: pkg.completionAuthority },
        { completed: true, timestampIso: '2026-01-01T00:00:00Z' },
        null,
      )
      expect(status, `${pkg.packageId} must not certify from a learner click alone`).toBe('RECORDED_PENDING_GUARDIAN_ATTESTATION')
    }
  })
})
