import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { validateCorpus, detectTemplateCollapse } from '../src/validate.ts'

/**
 * The "stronger local checks plus safeguards" this production task requires
 * beyond the real gate: no answer leakage into student-facing packages,
 * correct guardian attestation shape, a simulation/equal-credit alternative
 * for every real-world-action lesson, no photo/video/voice capture, no
 * required purchase, no assumed household shape, no implied real
 * employment/bank/driving/account access, and no duplicate/template-collapse
 * across the 36 lessons.
 */
describe('local production-readiness checks over the Grade 8 batch', () => {
  const entries = loadCorpus()

  it('has zero validation issues across every rule', () => {
    const issues = validateCorpus(entries)
    if (issues.length > 0) {
      throw new Error(issues.map((i) => `[${i.rule}] ${i.packageId}: ${i.detail}`).join('\n'))
    }
    expect(issues).toEqual([])
  })

  it('has zero duplicate/template-collapse signals across the 36 lessons', () => {
    const issues = detectTemplateCollapse(entries)
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
