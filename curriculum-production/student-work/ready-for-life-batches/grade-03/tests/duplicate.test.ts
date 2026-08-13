import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { checkDuplicatesAndGenericContent } from '../src/duplicateCheck.ts'

/**
 * Guards the task's explicit instruction not to mass-template generic focus
 * substitutions. The source lessons.jsonl varies only a "focus" phrase
 * across one boilerplate template — a lazy authoring pass would leave
 * objective/scenario text with heavy content-word overlap across lessons.
 * This asserts the authored corpus does not look like that.
 */
describe('duplicate / generic-content detection', () => {
  const entries = loadCorpus()

  it('has zero near-duplicate objective or scenario pairs and zero generic-phrase or thin-objective findings', () => {
    const findings = checkDuplicatesAndGenericContent(entries)
    if (findings.length > 0) {
      throw new Error(findings.map((f) => `[${f.rule}] ${f.packageIds.join(' <-> ')}: ${f.detail}`).join('\n'))
    }
    expect(findings).toEqual([])
  })
})
