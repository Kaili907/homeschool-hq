import { describe, expect, it } from 'vitest'
import { SUPPORTED_ACADEMY_GRADES } from '../../../curriculum/grade-authority'
import { parseStudyBoundContentResponse } from './content'

function response(grade: number) {
  const lessonId = `ma-g${grade}-mathematics-u01-l01`
  return {
    schemaVersion: 1,
    status: 'ready',
    reasonCode: 'content-ready',
    sessionRef: 'session:grade-authority',
    lessonRef: `grade-${grade}:academy-week-1-day-1`,
    skillRefs: [lessonId],
    curriculumBinding: {
      schemaVersion: 1,
      releaseId: '16000000-0000-4000-8000-000000000001',
      packageId: 'test-package',
      releaseVersion: '1.0.0',
      curriculumManifestSha256: 'a'.repeat(64),
    },
    lessons: [{
      lessonId,
      courseId: `ma-g${grade}-mathematics`,
      grade,
      subject: 'mathematics',
      courseDay: 1,
      unitNumber: 1,
      unitTitle: 'Unit 1',
      dayInUnit: 1,
      title: 'Lesson 1',
      standards: ['standard'],
      schemaVersion: '1.0',
      learningObjectives: ['objective'],
      successCriteria: ['criterion'],
      materials: ['notebook'],
      lessonFlow: [{ segment: 'Learn', teacherOrTutorAction: 'Teach.' }],
      formativeCheck: 'Check.',
      accommodations: ['Support.'],
    }],
  }
}

describe('Study learner content grade authority', () => {
  it('accepts every curriculum-supported grade, including two-digit grades', () => {
    for (const grade of SUPPORTED_ACADEMY_GRADES) {
      expect(parseStudyBoundContentResponse(response(grade))).not.toBeNull()
    }
  })

  it('rejects unsupported Grade 6 instead of falling back', () => {
    expect(parseStudyBoundContentResponse(response(6))).toBeNull()
  })
})
