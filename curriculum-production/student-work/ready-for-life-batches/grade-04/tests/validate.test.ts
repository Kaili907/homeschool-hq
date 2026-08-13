import { describe, expect, it } from 'vitest'
import { loadCombinedGrade4Corpus } from '../src/loadCorpus.ts'
import { validateCorpus } from '../src/validate.ts'

/**
 * The "stronger local checks" this task requires beyond the real gate: no
 * answer leakage into student-facing packages, correct guardian attestation
 * shape, a simulation/equal-credit alternative for every real-world-action
 * lesson, no photo/video/voice capture requirement, no required purchase,
 * and no assumption about a specific household shape. Run over the full
 * combined 36-lesson grade-4 corpus, not just this batch's 34.
 */
describe('local production-readiness checks over the combined grade-4 corpus', () => {
  const entries = loadCombinedGrade4Corpus()

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

  it('matches the source-of-truth completion authority and real-world-action flags for every lesson', () => {
    // Derived directly from the raw grade-4 lessons.jsonl (branch
    // mac/g34-rfl-finlit-r1): Application-or-project and Mastery-check phase
    // lessons in the "adult-required" units are guardian/realWorldAction, all
    // others are learner/not-real-world. Encoded here as the exact per-lesson
    // ground truth so no package silently drifts from source intent.
    const guardianLessons = new Set([
      'ma-g4-ready-for-life-u01-l04', 'ma-g4-ready-for-life-u01-l05',
      'ma-g4-ready-for-life-u02-l03', 'ma-g4-ready-for-life-u02-l04', 'ma-g4-ready-for-life-u02-l05',
      'ma-g4-ready-for-life-u03-l04', 'ma-g4-ready-for-life-u03-l05',
      'ma-g4-ready-for-life-u04-l04', 'ma-g4-ready-for-life-u04-l05',
      'ma-g4-ready-for-life-u05-l04', 'ma-g4-ready-for-life-u05-l05',
      'ma-g4-ready-for-life-u06-l04', 'ma-g4-ready-for-life-u06-l05', 'ma-g4-ready-for-life-u06-l06',
    ])
    for (const { pkg } of entries) {
      const expectGuardian = guardianLessons.has(pkg.lessonRef.lessonId)
      expect(pkg.completionAuthority, pkg.packageId).toBe(expectGuardian ? 'guardian' : 'learner')
      expect(pkg.realWorldAction, pkg.packageId).toBe(expectGuardian)
    }
  })
})
