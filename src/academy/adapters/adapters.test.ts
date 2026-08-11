import { describe, expect, it } from 'vitest'
import type { AcademyLesson, AcademyProtectedUnitChunk, AcademySchedule } from '../contentTypes'
import { emptyProfile } from '../../migration'
import { enrollInCatalog } from '../academyState'
import { buildAcademyTutorContext } from './tutorContextAdapter'
import { buildAcademyStudyContext } from './studyContextAdapter'

const lesson: AcademyLesson = {
  schema_version: '1.0',
  lesson_id: 'ma-g5-mathematics-u01-l01',
  course_id: 'ma-g5-mathematics',
  grade: 5,
  subject: 'mathematics',
  course_day: 1,
  unit_number: 1,
  unit_title: 'Unit One',
  day_in_unit: 1,
  title: 'Launch lesson',
  phase: 'Launch',
  focus: 'routines',
  estimated_minutes: '45-60',
  standards: ['5.OA.1'],
  essential_question: 'Q?',
  learning_objectives: ['a', 'b', 'c'],
  success_criteria: ['done'],
  materials: ['notebook'],
  lesson_flow: [
    { segment: 'Welcome', minutes: '5', teacher_or_tutor_action: 'welcome' },
  ],
  student_activity: 'apply',
  formative_check: 'explain',
  mastery_rule: 'two occasions',
  accessibility_and_accommodations: ['keyboard'],
  safety_and_privacy: ['no private info'],
}

const protectedChunk: AcademyProtectedUnitChunk = {
  releaseVersion: '1.0.0',
  courseId: 'ma-g5-mathematics',
  unitNumber: 1,
  lessons: {
    'ma-g5-mathematics-u01-l01': {
      answer_or_scoring_guidance: 'Score the target, not the child.',
      adaptive_tutor_routes: [{ signal: 'prerequisite gap', action: 'step back one idea' }],
    },
  },
  assessmentMasteryInterpretation: null,
}

describe('CURR-1 tutor context adapter (contract v1)', () => {
  it('projects lesson + protected routes with the hard safety invariants', () => {
    const ctx = buildAcademyTutorContext(lesson, protectedChunk)
    expect(ctx.adapterVersion).toBe(1)
    expect(ctx.lessonRef).toBe('ma-g5-mathematics-u01-l01')
    expect(ctx.adaptiveRoutes).toHaveLength(1)
    expect(ctx.scoringGuidance).toContain('Score the target')
    // the tutor may see guidance, but the contract pins what a surface must enforce
    expect(ctx.revealsAnswers).toBe(false)
    expect(ctx.gradedWorkPolicy).toBe('never-complete-graded-work')
  })

  it('a lesson missing from the protected chunk degrades to empty routes', () => {
    const ctx = buildAcademyTutorContext(
      { ...lesson, lesson_id: 'ma-g5-mathematics-u01-l02' },
      protectedChunk,
    )
    expect(ctx.adaptiveRoutes).toEqual([])
    expect(ctx.scoringGuidance).toBeNull()
  })
})

describe('CURR-1 study context adapter (contract v1)', () => {
  const schedule: AcademySchedule = {
    releaseVersion: '1.0.0',
    grade: '5',
    days: [
      {
        week: 2,
        day: 3,
        lessons: [
          { lessonId: 'ma-g5-mathematics-u01-l08', title: 'L8' },
          { lessonId: 'ma-g5-science-u01-l03', title: 'S3' },
        ],
      },
    ],
  }
  const profile = enrollInCatalog(
    emptyProfile('p2', 'Fifth Grader', '5'),
    { releaseVersion: '1.0.0', grade: '5', courses: [] },
    '2026-08-04T00:00:00.000Z',
  )

  it('maps a scheduled day into study-vocabulary refs', () => {
    const ctx = buildAcademyStudyContext(profile, schedule, 2, 3)
    expect(ctx).toEqual({
      adapterVersion: 1,
      releaseVersion: '1.0.0',
      lessonRef: 'grade-5:academy-week-2-day-3',
      skillRefs: ['ma-g5-mathematics-u01-l08', 'ma-g5-science-u01-l03'],
      scopeWeek: 2,
      scopeDay: 3,
    })
  })

  it('returns null off-schedule and for unenrolled profiles', () => {
    expect(buildAcademyStudyContext(profile, schedule, 40, 1)).toBeNull()
    expect(
      buildAcademyStudyContext(emptyProfile('p3', 'Sixth', '6'), schedule, 2, 3),
    ).toBeNull()
  })

  it('fails closed when browser schedule and enrollment versions disagree', () => {
    expect(buildAcademyStudyContext(
      profile,
      { ...schedule, releaseVersion: '2.0.0' },
      2,
      3,
    )).toBeNull()
  })
})
