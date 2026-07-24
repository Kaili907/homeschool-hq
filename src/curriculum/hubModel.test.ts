import { describe, expect, it } from 'vitest'
import type { Profile, SchoolYear } from '../types'
import { emptyProfile } from '../migration'
import { defaultSchoolYear, nudgePointer } from './pacing'
import { parsePlanDoc, type PlanDoc } from './parser'
import { docForSubject, expectedSubjects, subjectPlansFor, todayForGirl } from './hubModel'

const START = '2026-08-31' // Monday
const sy = (over: Partial<SchoolYear> = {}): SchoolYear => ({ ...defaultSchoolYear(START), ...over })
const kid = (grade: Profile['grade']): Profile => emptyProfile('p1', 'Kid', grade)

// Two plans: mindset (all grades, weeks 1..3), personal-finance (10/12, week 5 has a Tue item).
const DOCS: PlanDoc[] = [
  parsePlanDoc(`---\nsubject: Competitor's Mind\nsubjectId: mindset\ngrades: all\n---\n## Week 1 — a\n- lesson a\n## Week 5 — e\n- lesson e\n`),
  parsePlanDoc(`---\nsubject: Personal Finance\nsubjectId: personal-finance\ngrades: 10,12\n---\n## Week 5 — money\n- budgets\n- ✋ paystub\n- (Mon) vocab intro\n`),
]

describe('expected subjects per grade', () => {
  it('littles/6th vs teens differ', () => {
    expect(expectedSubjects('3').map((s) => s.id)).toContain('japanese')
    expect(expectedSubjects('3').map((s) => s.id)).not.toContain('personal-finance')
    expect(expectedSubjects('10').map((s) => s.id)).toContain('personal-finance')
    expect(expectedSubjects('10').map((s) => s.id)).not.toContain('japanese')
  })
})

describe('missing-scope placeholders', () => {
  it('a subject with no plan doc is missing (placeholder), one with a doc is not', () => {
    // grade 6: mindset has a doc; math does not; personal-finance does not apply to grade 6.
    expect(docForSubject(DOCS, 'mindset', '6')).not.toBeNull()
    expect(docForSubject(DOCS, 'math', '6')).toBeNull()
    expect(docForSubject(DOCS, 'personal-finance', '6')).toBeNull() // wrong grade → missing

    const plans = subjectPlansFor(kid('6'), DOCS, sy(), '2026-09-28') // scope week 5
    const byId = Object.fromEntries(plans.map((p) => [p.subject.id, p]))
    expect(byId['math'].missing).toBe(true) // → "awaiting placement results"
    expect(byId['mindset'].missing).toBe(false)
    expect(byId['mindset'].pointer).toBe(5) // calendar-derived
  })

  it('teens see personal-finance as present, math as missing', () => {
    const plans = subjectPlansFor(kid('10'), DOCS, sy(), '2026-09-28')
    const byId = Object.fromEntries(plans.map((p) => [p.subject.id, p]))
    expect(byId['personal-finance'].missing).toBe(false)
    expect(byId['math'].missing).toBe(true)
    expect(byId['english'].missing).toBe(true)
  })
})

describe('today derivation', () => {
  it('renders day-filtered items at the pointer for present subjects, placeholders for missing', () => {
    // 2026-09-28 is a Monday, scope week 5.
    const today = todayForGirl(kid('10'), DOCS, sy(), '2026-09-28')
    expect(today.travelWeek).toBe(false)
    expect(today.scopeWeek).toBe(5)
    const pf = today.subjects.find((s) => s.subject.id === 'personal-finance')!
    // week 5 has: budgets (untagged), ✋ paystub (untagged), (Mon) vocab intro → all show on Monday
    expect(pf.items.map((i) => i.text)).toEqual(['budgets', 'paystub', 'vocab intro'])
    expect(pf.items.find((i) => i.text === 'paystub')!.dadTaught).toBe(true)
    const math = today.subjects.find((s) => s.subject.id === 'math')!
    expect(math.missing).toBe(true)
    expect(math.items).toEqual([])
  })

  it('a (Mon)-tagged item hides on other weekdays', () => {
    const tue = todayForGirl(kid('10'), DOCS, sy(), '2026-09-29') // Tuesday, still week 5
    const pf = tue.subjects.find((s) => s.subject.id === 'personal-finance')!
    expect(pf.items.map((i) => i.text)).toEqual(['budgets', 'paystub']) // vocab intro (Mon) hidden
  })

  it('a travel week shows the badge and NO items', () => {
    const y = sy({ offWeeks: ['2026-09-28'] }) // that Monday off
    const today = todayForGirl(kid('10'), DOCS, y, '2026-09-28')
    expect(today.travelWeek).toBe(true)
    for (const s of today.subjects) expect(s.items).toEqual([])
  })

  it('a nudged pointer changes only that subject\'s Today items', () => {
    // Put mindset at week 1 for this girl; personal-finance stays on the calendar (week 5).
    const p = nudgePointer(kid('10'), 'mindset', 1, 'reteach', '2026-09-28T00:00:00Z', sy(), '2026-09-28')
    const today = todayForGirl(p, DOCS, sy(), '2026-09-28')
    const mindset = today.subjects.find((s) => s.subject.id === 'mindset')!
    const pf = today.subjects.find((s) => s.subject.id === 'personal-finance')!
    expect(mindset.pointer).toBe(1)
    expect(mindset.items.map((i) => i.text)).toEqual(['lesson a']) // week 1 item
    expect(pf.pointer).toBe(5) // unchanged
  })
})
