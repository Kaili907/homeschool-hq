import { describe, expect, it } from 'vitest'
import { buildCorpus } from '../src/build.ts'
import { GRADE_PROFILES, checkGradeArithmetic } from '../src/gradeLevel.ts'
import { OracleError, run, verify } from '../src/oracle.ts'

describe('the oracle fails closed', () => {
  it('accepts an authored answer that matches the independent recomputation', () => {
    const result = verify('$4.50', { op: 'sum', of: [{ op: 'money', cents: 200 }, { op: 'money', cents: 250 }] }, 'fixture')
    expect(result.formatted).toBe('$4.50')
    expect(result.trace).toBe('(2.00 + 2.50) = 4.50')
  })

  it('throws rather than emitting when the authored answer disagrees', () => {
    expect(() =>
      verify('$9.99', { op: 'sum', of: [{ op: 'money', cents: 200 }, { op: 'money', cents: 250 }] }, 'fixture'),
    ).toThrow(/ORACLE DISAGREEMENT/)
  })

  it('refuses a division declared exact that does not divide evenly', () => {
    expect(() => run({ op: 'divide', of: { op: 'money', cents: 1000 }, by: 3, round: 'exact' })).toThrow(OracleError)
  })

  it('rounds half-up to the cent only where rounding is declared', () => {
    expect(run({ op: 'percent', of: { op: 'money', cents: 315000 }, bps: 765, round: 'half-up' }).formatted).toBe('$240.98')
  })
})

describe('every committed answer key', () => {
  const entries = buildCorpus()

  it('is recomputed by the oracle and agrees with the committed answer', () => {
    let items = 0
    for (const entry of entries) {
      const authority = entry.scoring.scoringAuthority
      if (authority.kind !== 'ANSWER_KEY') continue
      for (const item of authority.items) {
        const result = run(item.verification.computation)
        expect(result.formatted).toBe(item.answer)
        expect(item.verification.trace).toBe(result.trace)
        items += 1
      }
    }
    expect(items).toBe(900)
  })

  it('stays inside the arithmetic its grade actually works in', () => {
    const violations = entries.flatMap((entry) => {
      const authority = entry.scoring.scoringAuthority
      if (authority.kind !== 'ANSWER_KEY') return []
      return authority.items.flatMap((item) =>
        checkGradeArithmetic(entry.source.grade, item.verification.computation, `${entry.pkg.packageId} ${item.ref}`),
      )
    })
    expect(violations).toEqual([])
  })

  it('would reject grade-3 work that reached for grade-8 arithmetic', () => {
    const tooAdvanced = checkGradeArithmetic(3, { op: 'compound', principal: { op: 'money', cents: 100000 }, bps: 500, periods: 10 }, 'fixture')
    expect(tooAdvanced.length).toBeGreaterThan(0)
    expect(GRADE_PROFILES[3].maxCompoundPeriods).toBe(0)
  })
})
