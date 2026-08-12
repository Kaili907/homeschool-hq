import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { validateCorpus, validateEntry } from '../src/validate.ts'
import type { CorpusEntry } from '../src/types.ts'

describe('validateCorpus over the real authored corpus', () => {
  const entries = loadCorpus()

  it('has zero validation issues across every authored package', () => {
    const issues = validateCorpus(entries)
    expect(issues).toEqual([])
  })

  it('every real-world-action ready-for-life package is guardian-authority with a signOff', () => {
    for (const { pkg } of entries) {
      if (pkg.realWorldAction) {
        expect(pkg.completionAuthority).toBe('guardian')
        expect(pkg.signOff).not.toBeNull()
      }
    }
  })

  it('every financial-literacy package is fictional, learner-authority, and flags financial safety', () => {
    const finlit = entries.filter((e) => e.pkg.lessonRef.subject === 'financial-literacy')
    expect(finlit.length).toBeGreaterThan(0)
    for (const { pkg } of finlit) {
      expect(pkg.isFictionalSimulation).toBe(true)
      expect(pkg.realWorldAction).toBe(false)
      expect(pkg.completionAuthority).toBe('learner')
      expect(pkg.financialSafety?.neverRequestsRealCredentials).toBe(true)
      expect(pkg.financialSafety?.noIndividualizedAdvice).toBe(true)
    }
  })
})

describe('validateAttestationShape catches a synthetic violation', () => {
  it('flags a guardian-authority package whose signOff is missing', () => {
    const base = loadCorpus().find((e) => e.pkg.completionAuthority === 'guardian')!
    const broken: CorpusEntry = { ...base, pkg: { ...base.pkg, signOff: null } }
    const issues = validateEntry(broken)
    expect(issues.some((i) => i.rule === 'attestation-shape')).toBe(true)
  })

  it('flags a package whose studentSelfReport is miswritten as certifying', () => {
    const base = loadCorpus().find((e) => e.pkg.completionAuthority === 'guardian')!
    const broken: CorpusEntry = {
      ...base,
      pkg: {
        ...base.pkg,
        // @ts-expect-error intentionally constructing an invalid fixture
        signOff: { ...base.pkg.signOff, studentSelfReport: 'certifying' },
      },
    }
    const issues = validateEntry(broken)
    expect(issues.some((i) => i.rule === 'attestation-shape')).toBe(true)
  })
})

describe('validateSimulationAlternative catches a synthetic violation', () => {
  it('flags a realWorldAction package with no simulation alternative', () => {
    const base = loadCorpus().find((e) => e.pkg.realWorldAction)!
    const broken: CorpusEntry = { ...base, pkg: { ...base.pkg, simulationAlternative: null } }
    const issues = validateEntry(broken)
    expect(issues.some((i) => i.rule === 'simulation-alternative-required')).toBe(true)
  })
})

describe('lintNoRealCredentialRequests catches a synthetic violation', () => {
  it('flags injected text asking a learner to enter a real card number', () => {
    const base = loadCorpus().find((e) => e.pkg.lessonRef.subject === 'financial-literacy')!
    const broken: CorpusEntry = { ...base, pkg: { ...base.pkg, objective: 'Please enter your real credit card number to continue.' } }
    const issues = validateEntry(broken)
    expect(issues.some((i) => i.rule === 'no-real-credential-request')).toBe(true)
  })

  it('does not flag the real corpus text', () => {
    const entries = loadCorpus()
    for (const entry of entries) {
      const issues = validateEntry(entry)
      expect(issues.filter((i) => i.rule === 'no-real-credential-request')).toEqual([])
    }
  })
})
