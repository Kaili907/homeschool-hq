import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CanonicalCourseCompletion } from './model'
import { ParentCourseCompletionReport } from './ParentCourseCompletionReport'

function completion(patch: Partial<CanonicalCourseCompletion> = {}): CanonicalCourseCompletion {
  return {
    status: 'COMPLETE',
    courseRef: 'ma-g5-mathematics',
    title: 'Grade 5 Mathematics',
    subject: 'mathematics',
    workingGrade: '5',
    requiredLessonCount: 1,
    completedLessonCount: 1,
    requiredAssessmentCount: 1,
    certifiedAssessmentCount: 1,
    completedAt: '2026-08-14T13:00:00.000Z',
    pendingAssessment: false,
    guardianGate: false,
    nextCourseOptions: [{
      courseRef: 'ma-g7-mathematics', title: 'Grade 7 Mathematics', grade: 7, subject: 'mathematics',
    }],
    ...patch,
  }
}

describe('Parent course completion report', () => {
  it('renders completion, authoritative date, current level, canonical next choice, and Parent authority', () => {
    const html = renderToStaticMarkup(<ParentCourseCompletionReport courses={[completion()]} />)
    expect(html).toContain('Course completed')
    expect(html).toContain('Completion date: August 14, 2026')
    expect(html).toContain('Current working level: Grade 5')
    expect(html).toContain('Grade 7 Mathematics · Grade 7')
    expect(html).toContain('Nothing starts automatically')
    expect(html).toContain('authorized Parent action')
  })

  it('renders final-assessment and guardian gates as not complete', () => {
    const html = renderToStaticMarkup(<ParentCourseCompletionReport courses={[completion({
      status: 'PENDING_CERTIFICATION',
      completedAt: null,
      certifiedAssessmentCount: 0,
      pendingAssessment: true,
      guardianGate: true,
      nextCourseOptions: [],
    })]} />)
    expect(html).toContain('Course not complete — certification pending')
    expect(html).toContain('Final assessment pending: this course is not complete yet.')
    expect(html).toContain('Guardian certification pending: this course is not complete yet.')
    expect(html).not.toContain('Completion date:')
    expect(html).not.toContain('Grade 7 Mathematics')
  })

  it('states the Grade 6 curriculum gap without inventing a choice', () => {
    const html = renderToStaticMarkup(<ParentCourseCompletionReport courses={[completion({
      status: 'UNAVAILABLE',
      courseRef: null,
      title: 'Mathematics · Grade 6',
      workingGrade: '6',
      requiredLessonCount: 0,
      completedLessonCount: 0,
      requiredAssessmentCount: 0,
      certifiedAssessmentCount: 0,
      completedAt: null,
      nextCourseOptions: [],
    })]} />)
    expect(html).toContain('Canonical curriculum unavailable')
    expect(html).toContain('Grade 6 has no admitted Manuel Academy curriculum')
    expect(html).toContain('No Grade 6 course has been invented')
    expect(html).not.toContain('Course completed')
  })
})
