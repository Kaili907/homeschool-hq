import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AcademyGrade } from '../types'
import type { AcademyCatalog, AcademyCatalogCourse, AcademySchedule } from './contentTypes'
import { composeProgram, loadProgram, type AcademyProgramSource } from './program'
import { resetAcademyContentCache } from './contentClient'
import type { AcademyProgramEntry } from './workingLevel'

/**
 * ACADEMY-LEVEL-DECOUPLE — one profile, courses drawn from more than one level.
 * The composed program is what the student surface renders, so these rules are
 * the difference between "she gets Grade 5 math and Grade 7 reading" and
 * "she gets one grade's everything".
 */

function course(grade: AcademyGrade, subject: string, lessons: number): AcademyCatalogCourse {
  const courseId = `ma-g${grade}-${subject}`
  return {
    courseId,
    subject,
    lessonCount: lessons,
    units: [
      {
        unitId: `${courseId}-u01`,
        unitNumber: 1,
        title: 'Unit 1',
        days: lessons,
        essentialQuestion: 'Why?',
        performanceTask: 'Build something',
        lessonIds: Array.from(
          { length: lessons },
          (_, i) => `${courseId}-u01-l${String(i + 1).padStart(2, '0')}`,
        ),
        hasAssessment: true,
      },
    ],
  }
}

function source(grade: AcademyGrade, subjects: string[]): AcademyProgramSource {
  const courses = subjects.map((s) => course(grade, s, 2))
  const catalog: AcademyCatalog = { releaseVersion: '1.0.0', grade, courses }
  const schedule: AcademySchedule = {
    releaseVersion: '1.0.0',
    grade,
    days: [
      {
        week: 1,
        day: 1,
        lessons: courses.map((c) => ({
          lessonId: c.units[0].lessonIds[0],
          title: `${c.subject} day 1`,
        })),
      },
    ],
  }
  return { level: grade, catalog, schedule }
}

const G5 = source('5', ['mathematics', 'science'])
const G7 = source('7', ['english-language-arts', 'science'])

const MIXED: AcademyProgramEntry[] = [
  { subject: 'mathematics', level: '5' },
  { subject: 'english-language-arts', level: '7' },
]

describe('composeProgram', () => {
  it('draws mathematics from level 5 and ELA from level 7 in one program', () => {
    const program = composeProgram(MIXED, [G5, G7])
    expect(program.catalog.courses.map((c) => c.courseId)).toEqual([
      'ma-g5-mathematics',
      'ma-g7-english-language-arts',
    ])
    expect(program.levelOf).toEqual({
      'ma-g5-mathematics': '5',
      'ma-g7-english-language-arts': '7',
    })
    expect(program.levels).toEqual(['5', '7'])
  })

  it('leaves out subjects the program did not ask for, at either level', () => {
    const program = composeProgram(MIXED, [G5, G7])
    const ids = program.catalog.courses.map((c) => c.courseId)
    expect(ids).not.toContain('ma-g5-science')
    expect(ids).not.toContain('ma-g7-science')
  })

  it('merges the year schedule and drops lessons for courses she does not have', () => {
    const program = composeProgram(MIXED, [G5, G7])
    expect(program.schedule.days).toHaveLength(1)
    const [day] = program.schedule.days
    expect(day).toMatchObject({ week: 1, day: 1 })
    expect(day.lessons.map((l) => l.lessonId)).toEqual([
      'ma-g5-mathematics-u01-l01',
      'ma-g7-english-language-arts-u01-l01',
    ])
  })

  it('a single-level program is exactly that level, unchanged', () => {
    const entries: AcademyProgramEntry[] = [
      { subject: 'mathematics', level: '5' },
      { subject: 'science', level: '5' },
    ]
    const program = composeProgram(entries, [G5])
    expect(program.levels).toEqual(['5'])
    expect(program.catalog.grade).toBe('5')
    expect(program.catalog.courses.map((c) => c.courseId)).toEqual([
      'ma-g5-mathematics',
      'ma-g5-science',
    ])
    expect(program.schedule.days[0].lessons).toHaveLength(2)
  })

  it('an empty program composes to nothing rather than throwing', () => {
    const program = composeProgram([], [])
    expect(program.catalog.courses).toEqual([])
    expect(program.schedule.days).toEqual([])
    expect(program.levels).toEqual([])
  })
})

describe('loadProgram', () => {
  afterEach(() => {
    resetAcademyContentCache()
    vi.unstubAllGlobals()
  })

  it('fetches one catalog + schedule per distinct level, then composes', () => {
    const bodies: Record<string, unknown> = {
      '/curriculum/1.0.0/grade-5/catalog.json': G5.catalog,
      '/curriculum/1.0.0/grade-5/schedule.json': G5.schedule,
      '/curriculum/1.0.0/grade-7/catalog.json': G7.catalog,
      '/curriculum/1.0.0/grade-7/schedule.json': G7.schedule,
    }
    const seen: string[] = []
    vi.stubGlobal('fetch', (path: string) => {
      seen.push(path)
      const body = bodies[path]
      return Promise.resolve({ ok: body !== undefined, status: body ? 200 : 404, json: async () => body })
    })

    return loadProgram(MIXED).then((program) => {
      expect(seen.sort()).toEqual(Object.keys(bodies).sort())
      expect(program.catalog.courses.map((c) => c.courseId)).toEqual([
        'ma-g5-mathematics',
        'ma-g7-english-language-arts',
      ])
    })
  })
})
