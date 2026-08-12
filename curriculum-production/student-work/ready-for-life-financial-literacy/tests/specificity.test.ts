import { describe, expect, it } from 'vitest'
import { assessContentSpecificity } from '../../../../src/curriculum/production-quality/index.ts'
import { loadCorpus } from '../src/loadCorpus.ts'

/**
 * Runs the real, shared, non-authoritative specificity heuristic (the same
 * code the production-quality gate uses to route templated-looking content
 * to NEEDS_HUMAN_REVIEW) against every long-form text block this branch
 * authored. This is what makes "not generic template scaffolding" a checked
 * claim rather than an assertion.
 */
describe('assessContentSpecificity over every authored text block', () => {
  const entries = loadCorpus()

  it('flags nothing as insufficiently specific', () => {
    // Checks the substantial paragraph-length fields this heuristic is
    // calibrated for (25+ words, 8+ distinct non-title words) — the same
    // fields the real gate evaluates as instruction/independentWork/
    // remediation/extension. Individual task[].directions are deliberately
    // terse, single-sentence imperatives (e.g. "Read your care label."),
    // not paragraphs, so they are combined per package instead of checked
    // one sentence at a time, matching how gateProjection.ts itself joins
    // them before handing text to the real gate.
    const failures: string[] = []
    for (const { pkg } of entries) {
      const allTaskText = pkg.tasks.map((t) => `${t.directions} ${t.prompts.map((p) => p.text).join(' ')}`).join(' ')
      const blocks: Array<[string, string]> = [
        ['objective', pkg.objective],
        ['scenario', pkg.scenario],
        ['remediation', pkg.remediation],
        ['extension', pkg.extension],
        ['tasks (combined)', allTaskText],
      ]
      for (const [label, text] of blocks) {
        const signal = assessContentSpecificity({ present: true, text }, pkg.lessonRef.title)
        if (signal.evaluated && !signal.sufficientlySpecific) {
          failures.push(`${pkg.packageId} ${label}: ${signal.reasons.join('; ')}`)
        }
      }
    }
    expect(failures).toEqual([])
  })
})
