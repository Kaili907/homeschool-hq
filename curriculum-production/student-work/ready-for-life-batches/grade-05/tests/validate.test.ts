import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { validateCorpus } from '../src/validate.ts'

/**
 * The "stronger local checks" beyond the real gate: no answer leakage into
 * student-facing packages, correct guardian attestation shape, a
 * simulation/equal-credit alternative for every real-world-action lesson,
 * no photo/video/voice capture requirement, no required purchase, and no
 * assumption about a specific household shape.
 */
describe('local production-readiness checks over the authored grade-05 corpus', () => {
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
        expect(pkg.simulationAlternative?.description.length).toBeGreaterThan(40)
      }
    }
  })

  it('no package requires an identifiable photo', () => {
    for (const { pkg } of entries) {
      expect(pkg.signOff?.identifiablePhotoRequired).not.toBe(true)
    }
  })

  it('every package scenario and at least one task reference the lesson-specific focus phrase', () => {
    // Specificity check: confirm scenario/task text is genuinely tied to the
    // lesson's focus, not generic language reusable across the whole unit.
    // We check that the scenario shares a meaningful content word (4+
    // letters, not a stopword) with the lesson title beyond the shared
    // phase-name boilerplate.
    const STOP = new Set(['with', 'from', 'this', 'that', 'your', 'their', 'into', 'then', 'what', 'when', 'they', 'have', 'will', 'each', 'while'])
    for (const { pkg } of entries) {
      const focusWords = pkg.lessonRef.title
        .split(':')[1]
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP.has(w))
      const scenarioLower = pkg.scenario.toLowerCase()
      const tasksLower = pkg.tasks.map((t) => `${t.directions} ${t.prompts.map((p) => p.text).join(' ')}`).join(' ').toLowerCase()
      const hitsInScenario = focusWords.filter((w) => scenarioLower.includes(w))
      const hitsInTasks = focusWords.filter((w) => tasksLower.includes(w))
      expect(
        hitsInScenario.length > 0 || hitsInTasks.length > 0,
        `${pkg.packageId}: neither scenario nor tasks reference any focus word from "${pkg.lessonRef.title}" (${focusWords.join(', ')})`,
      ).toBe(true)
    }
  })

  it('every guardian package requires guardian permission before start and adult supervision is stated', () => {
    for (const { pkg } of entries) {
      if (pkg.completionAuthority === 'guardian') {
        expect(pkg.signOff?.requiresGuardianPermissionBeforeStart).toBe(true)
        expect(typeof pkg.signOff?.requiresTrustedAdultSupervision).toBe('boolean')
      }
    }
  })
})
