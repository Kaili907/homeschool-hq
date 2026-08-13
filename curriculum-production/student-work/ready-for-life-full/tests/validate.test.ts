import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { validateCorpus } from '../src/validate.ts'

/**
 * The "stronger local checks" the production task requires beyond the real
 * gate: no answer leakage into student-facing packages, correct guardian
 * attestation shape, a simulation/equal-credit alternative for every
 * real-world-action lesson, no photo/video/voice capture requirement, no
 * required purchase, and no assumption about a specific household shape.
 */
describe('local production-readiness checks over the authored corpus', () => {
  const entries = loadCorpus()

  it('has zero validation issues across every rule', () => {
    const issues = validateCorpus(entries)
    if (issues.length > 0) {
      throw new Error(issues.map((i) => `[${i.rule}] ${i.packageId}: ${i.detail}`).join('\n'))
    }
    expect(issues).toEqual([])
  })

  it('every realWorldAction:true lesson has a non-empty simulationAlternative', () => {
    for (const { pkg } of entries) {
      if (pkg.realWorldAction) {
        expect(pkg.simulationAlternative, `${pkg.packageId} missing simulationAlternative`).not.toBeNull()
        expect(pkg.simulationAlternative?.description.length).toBeGreaterThan(0)
      }
    }
  })

  it('no package requires an identifiable photo', () => {
    for (const { pkg } of entries) {
      expect(pkg.signOff?.identifiablePhotoRequired).not.toBe(true)
    }
  })
})
