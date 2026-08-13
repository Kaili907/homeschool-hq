import { describe, expect, it } from 'vitest'
import { buildCorpus } from '../src/build.ts'
import { checkNoAnswerLeakage, checkSafety } from '../src/checks.ts'
import type { CorpusEntry } from '../src/types.ts'

describe('financial safety', () => {
  const entries = buildCorpus()

  it('marks every lesson as a fictional simulation completed by the learner', () => {
    for (const entry of entries) {
      expect(entry.pkg.isFictionalSimulation).toBe(true)
      expect(entry.pkg.realWorldAction).toBe(false)
      expect(entry.pkg.completionAuthority).toBe('learner')
      expect(entry.pkg.signOff).toBeNull()
      expect(entry.pkg.financialSafety).toEqual({ neverRequestsRealCredentials: true, noIndividualizedAdvice: true })
    }
  })

  it('never requests a real credential and never gives individualised advice', () => {
    expect(entries.flatMap(checkSafety)).toEqual([])
  })

  it('keeps every answer, rubric, and computation out of the student-facing package', () => {
    expect(entries.flatMap(checkNoAnswerLeakage)).toEqual([])
  })

  /**
   * A lint that never fires is indistinguishable from a lint that cannot fire.
   * These two cases prove the credential and advice checks have teeth.
   */
  it('would flag a sheet that asked a learner for a real card number', () => {
    const entry = entries[0]
    const tampered: CorpusEntry = {
      ...entry,
      pkg: {
        ...entry.pkg,
        tasks: [
          {
            taskId: 't9',
            kind: 'independent',
            directions: 'Enter your real bank account number in the box below.',
            prompts: [{ ref: 't9-p1', promptType: 'short-response', text: 'What is your family\'s card number?' }],
          },
        ],
      },
    }
    const issues = checkSafety(tampered)
    expect(issues.some((issue) => issue.rule === 'no-real-credential-request')).toBe(true)
  })

  it('would flag a sheet that told a learner what to invest in', () => {
    const entry = entries[0]
    const tampered: CorpusEntry = { ...entry, pkg: { ...entry.pkg, remediation: 'You should invest your savings in the fund with the best returns.' } }
    expect(checkSafety(tampered).some((issue) => issue.rule === 'no-individualized-advice')).toBe(true)
  })

  it('does not flag quoted scam wording that learners are meant to recognise', () => {
    const entry = entries[0]
    const teaching: CorpusEntry = {
      ...entry,
      pkg: { ...entry.pkg, safetyNotes: [...entry.pkg.safetyNotes, "The invented message reads 'enter your card number to claim the prize'."] },
    }
    expect(checkSafety(teaching).some((issue) => issue.rule === 'no-real-credential-request')).toBe(false)
  })
})
