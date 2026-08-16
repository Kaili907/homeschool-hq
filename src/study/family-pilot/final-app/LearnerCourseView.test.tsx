import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { FinalLearnerCourseView } from './autoPlannerHost'
import { LearnerCourseView } from './LearnerCourseView'

function view(patch: Partial<FinalLearnerCourseView> = {}): FinalLearnerCourseView {
  return {
    courseRef: 'ma-g4-mathematics', courseTitle: 'Grade 4 Mathematics',
    subject: 'mathematics', workingGrade: '4', completedLessons: 8, totalLessons: 180,
    currentPosition: 'Lesson 9 of 180', todayStatus: 'NOT_REQUIRED_TODAY', workAheadAllowed: true,
    next: { lessonRef: 'math-9', title: 'Equivalent fractions', assignmentRef: null, state: null },
    gate: null,
    action: { type: 'START_WORK_AHEAD', label: 'Work ahead: start Equivalent fractions', assignmentRef: null, lessonRef: 'math-9' },
    ...patch,
  }
}

describe('learner Course view', () => {
  it('shows subject-neutral progress, Today status, next eligible work, and contextual action naming', () => {
    const markup = renderToStaticMarkup(<LearnerCourseView view={view()} onBack={() => undefined} onAction={() => undefined} />)
    expect(markup).toContain('Grade 4 Mathematics')
    expect(markup).toContain('Working Grade 4')
    expect(markup).toContain('8 of 180')
    expect(markup).toContain('Mathematics isn’t required today.')
    expect(markup).toContain('Equivalent fractions')
    expect(markup).toContain('aria-label="Work ahead: start Equivalent fractions in Grade 4 Mathematics"')
  })

  it('keeps Today complete while offering the next optional lesson', () => {
    const markup = renderToStaticMarkup(<LearnerCourseView view={view({ todayStatus: 'TODAY_COMPLETE' })} onBack={() => undefined} onAction={() => undefined} />)
    expect(markup).toContain('Today’s Mathematics is complete.')
    expect(markup).toContain('Work ahead')
  })

  it('shows no-school, Parent-disabled, and terminal gate states without an override button', () => {
    const disabled = renderToStaticMarkup(<LearnerCourseView view={view({
      todayStatus: 'NO_SCHOOL_TODAY', workAheadAllowed: false, action: null,
      gate: { kind: 'PREREQUISITE', message: 'You’re caught up. Your next lesson will appear according to your School Plan.' },
    })} onBack={() => undefined} onAction={() => undefined} />)
    expect(disabled).toContain('No school today')
    expect(disabled).toContain('according to your School Plan')
    expect(disabled).not.toContain('Work ahead: start')

    const complete = renderToStaticMarkup(<LearnerCourseView view={view({
      next: null, action: null, gate: { kind: 'COURSE_COMPLETE', message: 'Course complete. A parent chooses what course comes next.' },
    })} onBack={() => undefined} onAction={() => undefined} />)
    expect(complete).toContain('A parent chooses what course comes next.')
    expect(complete).not.toContain('Work ahead: start')
  })
})
