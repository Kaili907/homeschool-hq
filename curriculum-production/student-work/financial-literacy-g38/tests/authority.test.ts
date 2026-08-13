import { describe, expect, it } from 'vitest'
import { buildCorpus } from '../src/build.ts'
import { SOURCE_GENERIC_GUIDANCE } from '../src/checks.ts'
import { ORACLE_ID } from '../src/oracle.ts'

/**
 * The previous review found that a readiness gate could pass a corpus whose
 * answer keys were empty or boilerplate, because presence was checked and
 * text never was. These assertions are the answer to that finding: every
 * scoring record carries a machine-readable claim a hardened (Gate H2) check
 * can test, and each claim is verified here against the record itself.
 */
describe('scoring authority tagging', () => {
  const entries = buildCorpus()

  it('tags every record for Gate H2 with an agreeing oracle verdict', () => {
    for (const entry of entries) {
      expect(entry.scoring.authorityTag.gate).toBe('H2')
      expect(entry.scoring.authorityTag.oracleId).toBe(ORACLE_ID)
      expect(entry.scoring.authorityTag.oracleVerdict).toBe('AGREES')
      expect(entry.scoring.authorityTag.derivedFromSourceGenericGuidance).toBe(false)
      expect(entry.scoring.adultOnly).toBe(true)
    }
  })

  it('gives every fixed-answer lesson non-empty answers with figure-bearing reasoning', () => {
    const fixed = entries.filter((entry) => entry.scoring.scoringAuthority.kind === 'ANSWER_KEY')
    expect(fixed).toHaveLength(180)
    for (const entry of fixed) {
      const authority = entry.scoring.scoringAuthority
      if (authority.kind !== 'ANSWER_KEY') throw new Error('unreachable')
      expect(entry.scoring.authorityTag.authorityClass).toBe('FIXED_ANSWER_KEY')
      expect(entry.scoring.authorityTag.answerDerivation).toBe('independent-recompute')
      expect(authority.items.length).toBeGreaterThan(0)
      for (const item of authority.items) {
        expect(item.answer.trim().length).toBeGreaterThan(0)
        expect(item.verification.trace).toMatch(/\d/)
        expect(item.verification.reasoning).toMatch(/\d/)
        expect(item.promptText.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('gives every judgment lesson a rubric and acceptable-answer criteria, and no exact answer', () => {
    const judgment = entries.filter((entry) => entry.scoring.scoringAuthority.kind === 'RUBRIC')
    expect(judgment).toHaveLength(36)
    for (const entry of judgment) {
      const authority = entry.scoring.scoringAuthority
      if (authority.kind !== 'RUBRIC') throw new Error('unreachable')
      expect(entry.scoring.authorityTag.authorityClass).toBe('RUBRIC_JUDGMENT')
      expect(entry.scoring.authorityTag.answerDerivation).toBe('not-applicable-judgment')
      expect(authority.criteria.length).toBeGreaterThan(0)
      expect(authority.acceptableAnswerCriteria.length).toBeGreaterThan(0)
      expect(JSON.stringify(authority)).not.toContain('"answer"')
    }
  })

  it('never reproduces the generic guidance the source repeats for every lesson', () => {
    for (const entry of entries) {
      expect(JSON.stringify(entry.scoring)).not.toContain(SOURCE_GENERIC_GUIDANCE.slice(0, 60))
      expect(entry.pkg.integrity.answerDerivedFromSourceGuidance).toBe(false)
    }
  })
})
