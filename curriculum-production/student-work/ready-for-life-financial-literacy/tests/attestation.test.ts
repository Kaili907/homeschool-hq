import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { computeCompletionStatus, type AdultAttestation, type LearnerAssertion } from '../src/validate.ts'

const learnerClick: LearnerAssertion = { completed: true, timestampIso: '2026-08-12T12:00:00Z' }
const guardianAttestation: AdultAttestation = {
  certifyingActor: 'household-authorized guardian',
  observedTaskDescription: 'Observed the whole handwashing loop from wetting to hanging to dry.',
  timestampIso: '2026-08-12T12:05:00Z',
}

describe('computeCompletionStatus: the core attestation invariant', () => {
  it('a learner click ALONE can never certify a guardian-required task, for every guardian package in the real corpus', () => {
    const guardianPackages = loadCorpus().filter((e) => e.pkg.completionAuthority === 'guardian')
    expect(guardianPackages.length).toBeGreaterThan(0)
    for (const { pkg } of guardianPackages) {
      const status = computeCompletionStatus(pkg, learnerClick, null)
      expect(status).not.toBe('CERTIFIED')
      expect(status).toBe('RECORDED_PENDING_GUARDIAN_ATTESTATION')
    }
  })

  it('a real guardian attestation DOES certify a guardian-required task', () => {
    const guardianPackages = loadCorpus().filter((e) => e.pkg.completionAuthority === 'guardian')
    for (const { pkg } of guardianPackages) {
      const status = computeCompletionStatus(pkg, learnerClick, guardianAttestation)
      expect(status).toBe('CERTIFIED')
    }
  })

  it('a guardian attestation with no learner click at all still certifies (the guardian action is authoritative, not the learner click)', () => {
    const guardianPackages = loadCorpus().filter((e) => e.pkg.completionAuthority === 'guardian')
    for (const { pkg } of guardianPackages) {
      expect(computeCompletionStatus(pkg, null, guardianAttestation)).toBe('CERTIFIED')
    }
  })

  it('learner-authority packages (every financial-literacy lesson, and non-real-world ready-for-life lessons) certify from a learner click alone, correctly', () => {
    const learnerPackages = loadCorpus().filter((e) => e.pkg.completionAuthority === 'learner')
    expect(learnerPackages.length).toBeGreaterThan(0)
    for (const { pkg } of learnerPackages) {
      expect(computeCompletionStatus(pkg, learnerClick, null)).toBe('CERTIFIED')
      expect(computeCompletionStatus(pkg, null, null)).toBe('NOT_STARTED')
    }
  })
})
