import { describe, it, expect } from 'vitest'
import type { Profile } from '../types'
import { buildAssistantContext, renderAssistantContext } from './context'
import { TEST_BY_ID } from '../assessment/banks'

/**
 * Acceptance: context assembly includes ONLY her own data and EXCLUDES assessment
 * item content, other profiles, journal text, and keys.
 */

function teen(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p5',
    name: 'Nadia',
    grade: '12',
    pin: '',
    theme: 'clean',
    skills: {},
    missions: {
      '2026-07-24': {
        items: [
          { id: 'math-block', label: 'Math block 60 minutes', done: false },
          { id: 'english', label: 'English', done: true },
        ],
      },
    },
    streaks: { current: 2, best: 5, lastActiveDate: '2026-07-24' },
    createdAt: '2026-01-01T00:00:00.000Z',
    placementDone: true,
    totals: { questionsAnswered: 10, correct: 7, bestStreak: 4, sessions: 3 },
    courses: [
      { id: 'algebra2', name: 'Algebra II', units: [
        { id: 'u1', label: 'Unit 1', done: true },
        { id: 'u2', label: 'Unit 2', done: false },
      ] },
    ],
    collegeTasks: [
      { id: 'c2', label: 'Common App essay — first draft', due: '2026-09-15', done: false },
      { id: 'c4', label: 'Submit FAFSA', due: '2020-01-01', done: false }, // overdue
    ],
    hsStats: { trig: { attempts: 8, correct: 4 } },
    ...overrides,
  }
}

/** A profile with an assigned + in-progress assessment carrying a secret start code and her answers. */
function teenWithAssessment(): Profile {
  return teen({
    assessments: {
      assigned: [{ testId: 'hs-reading', startCode: 'SECRET-CODE-9137', assignedAt: '2026-07-01' }],
      attempts: [
        {
          testId: 'hs-reading',
          profileId: 'p5',
          startedAt: '2026-07-02',
          answers: { r1: { value: 'HER-PRIVATE-ANSWER-XYZ', skipped: false, msOnItem: 1000 } },
        },
      ],
      retakeUnlocked: [],
    },
  })
}

describe('buildAssistantContext — includes her own school-day data', () => {
  const ctx = buildAssistantContext(teen(), '2026-07-24')

  it('includes her name, grade, mission, deadlines, courses, unit stats', () => {
    expect(ctx.name).toBe('Nadia')
    expect(ctx.grade).toBe('12')
    expect(ctx.mission.map((m) => m.label)).toContain('Math block 60 minutes')
    expect(ctx.deadlines?.some((d) => d.label.includes('FAFSA') && d.overdue)).toBe(true)
    expect(ctx.courses[0]).toMatchObject({ name: 'Algebra II', done: 1, total: 2 })
    expect(ctx.geometry.find((g) => g.name === 'Trig Ratios')?.accuracy).toBe(50)
  })

  it('renders a compact text block with those facts', () => {
    const txt = renderAssistantContext(ctx)
    expect(txt).toContain('Nadia')
    expect(txt).toContain('Math block 60 minutes')
    expect(txt).toContain('FAFSA')
    expect(txt).toContain('Algebra II 1/2')
  })
})

describe('buildAssistantContext — EXCLUDES assessment content, answers, start codes', () => {
  const p = teenWithAssessment()
  const ctx = buildAssistantContext(p, '2026-07-24')
  const txt = renderAssistantContext(ctx)
  const readingTest = TEST_BY_ID['hs-reading']

  it('includes the assessment TITLE and a status word only', () => {
    expect(ctx.assessments).toHaveLength(1)
    expect(ctx.assessments[0].title).toBe(readingTest.title)
    expect(ctx.assessments[0].status).toContain('progress')
    expect(txt).toContain(readingTest.title)
  })

  it('NEVER includes an item prompt, an answer key/keyNote, the start code, or her answer', () => {
    // real item content from the bank must not leak
    const firstPrompt = readingTest.sections[0].items[0].prompt
    expect(firstPrompt.length).toBeGreaterThan(5)
    expect(txt).not.toContain(firstPrompt)
    expect(txt).not.toContain('central idea of the passage')
    expect(txt).not.toContain('Mackinac') // from a keyNote
    // secret start code and her submitted answer must not leak
    expect(txt).not.toContain('SECRET-CODE-9137')
    expect(txt).not.toContain('HER-PRIVATE-ANSWER-XYZ')
    // whole serialized context object, too (belt and suspenders)
    const json = JSON.stringify(ctx)
    expect(json).not.toContain('SECRET-CODE-9137')
    expect(json).not.toContain('HER-PRIVATE-ANSWER-XYZ')
    expect(json).not.toContain('central idea of the passage')
  })
})

describe('buildAssistantContext — structurally single-profile', () => {
  it('takes one profile and cannot reference another girl (no other-profile data in output)', () => {
    const ctx = buildAssistantContext(teen({ name: 'Nadia' }), '2026-07-24')
    const txt = renderAssistantContext(ctx)
    // a sibling's distinctive name is never present because the builder has no access to it
    expect(txt).not.toContain('Sophomore')
    expect(txt).toContain('Nadia')
  })

  it('non-seniors get no college deadlines block', () => {
    const ctx = buildAssistantContext(teen({ grade: '10', collegeTasks: undefined }), '2026-07-24')
    expect(ctx.deadlines).toBeUndefined()
  })
})
