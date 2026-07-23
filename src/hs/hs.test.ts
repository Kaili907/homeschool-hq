import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../types'
import type { HsQuestion } from './hsQuestion'
import { GEOMETRY_GENERATORS, geometryFresh, geometryQuestion } from './geometryGen'
import { ALGEBRA_GENERATORS, algebraQuestion, buildAlgebraDeck } from './algebraGen'
import { GEOMETRY_UNITS, ALGEBRA_TOPICS } from './hsCatalog'
import {
  addCollegeTask,
  ensureHsDefaults,
  isOverdue,
  recordHsAnswer,
  sortedCollegeTasks,
  toggleCourseUnit,
} from './hsState'
import { emptyProfile } from '../migration'
import type { CollegeTask } from '../types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]
const RUNS = 60

function assertWellFormed(q: HsQuestion, unit: string) {
  expect(q.unit).toBe(unit)
  expect(q.prompt.trim().length).toBeGreaterThan(0)
  expect(q.choices.length).toBeGreaterThanOrEqual(2)
  expect(q.choices.length).toBeLessThanOrEqual(4)
  // every choice distinct
  expect(new Set(q.choices).size).toBe(q.choices.length)
  // answer index valid and points at a real choice
  expect(q.answerIndex).toBeGreaterThanOrEqual(0)
  expect(q.answerIndex).toBeLessThan(q.choices.length)
  expect(q.choices[q.answerIndex]).toBeDefined()
  // no fallback-filler distractor leaked (would signal a starved distractor pool)
  for (const c of q.choices) expect(c).not.toMatch(/\?\d+$/)
}

describe('geometry catalog', () => {
  it('has the nine spec units, ids unique', () => {
    expect(GEOMETRY_UNITS).toHaveLength(9)
    expect(Object.keys(GEOMETRY_GENERATORS)).toHaveLength(9)
    const ids = GEOMETRY_UNITS.map((u) => u.id)
    expect(new Set(ids).size).toBe(9)
    for (const id of ids) expect(GEOMETRY_GENERATORS[id]).toBeTypeOf('function')
  })
})

describe('geometry generator fuzz (9 units × 3 difficulties)', () => {
  for (const unit of GEOMETRY_UNITS) {
    it(`${unit.id} produces well-formed questions`, () => {
      for (const d of DIFFICULTIES) {
        for (let run = 0; run < RUNS; run++) {
          assertWellFormed(geometryQuestion(unit.id, d), unit.id)
        }
      }
    })
  }
})

describe('algebra generator fuzz (3 topics × 3 difficulties)', () => {
  for (const topic of ALGEBRA_TOPICS) {
    it(`${topic.id} produces well-formed questions`, () => {
      for (const d of DIFFICULTIES) {
        for (let run = 0; run < RUNS; run++) {
          assertWellFormed(algebraQuestion(topic.id, d), topic.id)
        }
      }
    })
  }
})

describe('algebra maintenance deck', () => {
  it('draws exactly 5 well-formed questions from the algebra topics', () => {
    const topicIds = new Set(ALGEBRA_TOPICS.map((t) => t.id))
    for (let run = 0; run < 40; run++) {
      const deck = buildAlgebraDeck(5)
      expect(deck).toHaveLength(5)
      for (const q of deck) {
        expect(topicIds.has(q.unit)).toBe(true)
        assertWellFormed(q, q.unit)
      }
    }
  })

  it('never repeats a topic three times in a row', () => {
    for (let run = 0; run < 60; run++) {
      const units = buildAlgebraDeck(5).map((q) => q.unit)
      for (let i = 2; i < units.length; i++) {
        expect(units[i] === units[i - 1] && units[i] === units[i - 2]).toBe(false)
      }
    }
  })
})

describe('geometryFresh dedupe within a session', () => {
  it('avoids immediate prompt repeats (best effort)', () => {
    const seen = new Set<string>()
    const prompts: string[] = []
    for (let i = 0; i < 30; i++) prompts.push(geometryFresh('pythagorean', 2, seen).prompt)
    // with 30 draws we expect a healthy spread, not all identical
    expect(new Set(prompts).size).toBeGreaterThan(5)
  })
})

describe('college deadline sorting (senior)', () => {
  const T = (id: string, due: string, done = false): CollegeTask => ({ id, label: id, due, done })
  const today = '2026-07-23'

  it('flags overdue only for incomplete, past-due, dated tasks', () => {
    expect(isOverdue(T('a', '2026-07-01'), today)).toBe(true)
    expect(isOverdue(T('b', '2026-08-01'), today)).toBe(false)
    expect(isOverdue(T('c', '2026-07-01', true), today)).toBe(false) // done
    expect(isOverdue(T('d', ''), today)).toBe(false) // undated
  })

  it('orders overdue-first (soonest-past first), then upcoming by date, then done', () => {
    const tasks = [
      T('upcoming-late', '2026-12-01'),
      T('done-old', '2026-01-01', true),
      T('overdue-recent', '2026-07-20'),
      T('undated', ''),
      T('overdue-old', '2026-05-01'),
      T('upcoming-soon', '2026-08-01'),
    ]
    const sorted = sortedCollegeTasks(tasks, today)
    expect(sorted.map((s) => s.task.id)).toEqual([
      'overdue-old',
      'overdue-recent',
      'upcoming-soon',
      'upcoming-late',
      'undated',
      'done-old',
    ])
    // overdue flag matches position
    expect(sorted.slice(0, 2).every((s) => s.overdue)).toBe(true)
    expect(sorted.slice(2).every((s) => !s.overdue)).toBe(true)
  })

  it('sorts purely by date within the overdue group', () => {
    const tasks = [T('later', '2026-07-10'), T('earlier', '2026-03-10'), T('mid', '2026-06-10')]
    expect(sortedCollegeTasks(tasks, today).map((s) => s.task.id)).toEqual(['earlier', 'mid', 'later'])
  })
})

describe('HS state helpers', () => {
  it('ensureHsDefaults seeds courses (10 & 12) and college tasks (12 only), non-destructively', () => {
    const soph = ensureHsDefaults(emptyProfile('p4', 'Soph', '10'))
    expect(soph.courses && soph.courses.length).toBeGreaterThan(0)
    expect(soph.collegeTasks).toBeUndefined()

    const senior = ensureHsDefaults(emptyProfile('p5', 'Senior', '12'))
    expect(senior.courses && senior.courses.length).toBeGreaterThan(0)
    expect(senior.collegeTasks && senior.collegeTasks.length).toBeGreaterThan(0)

    // idempotent: does not overwrite existing edits
    const edited = { ...senior, collegeTasks: [] }
    expect(ensureHsDefaults(edited).collegeTasks).toEqual([])

    // a grade-3 profile is untouched
    const kid = emptyProfile('p1', 'Kid', '3')
    expect(ensureHsDefaults(kid)).toBe(kid)
  })

  it('recordHsAnswer tallies per-unit and bumps totals', () => {
    let p = emptyProfile('p4', 'Soph', '10')
    p = recordHsAnswer(p, 'pythagorean', true, '2026-07-23')
    p = recordHsAnswer(p, 'pythagorean', false, '2026-07-23')
    expect(p.hsStats?.pythagorean).toEqual({ attempts: 2, correct: 1, lastSeen: '2026-07-23' })
    expect(p.totals.questionsAnswered).toBe(2)
    expect(p.totals.correct).toBe(1)
  })

  it('toggleCourseUnit flips a single unit only', () => {
    let p = ensureHsDefaults(emptyProfile('p4', 'Soph', '10'))
    const course = p.courses![0]
    const unitId = course.units[0].id
    p = toggleCourseUnit(p, course.id, unitId, true)
    const c2 = p.courses!.find((c) => c.id === course.id)!
    expect(c2.units.find((u) => u.id === unitId)!.done).toBe(true)
    expect(c2.units.filter((u) => u.done)).toHaveLength(1)
  })

  it('addCollegeTask appends without mutating input', () => {
    const p0 = ensureHsDefaults(emptyProfile('p5', 'Senior', '12'))
    const n = p0.collegeTasks!.length
    const p1 = addCollegeTask(p0, 'Visit campus', '2026-09-01')
    expect(p1.collegeTasks).toHaveLength(n + 1)
    expect(p0.collegeTasks).toHaveLength(n) // original unchanged
  })
})
