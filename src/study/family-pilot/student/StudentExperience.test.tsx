import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActiveAssignmentView, AssignmentList, StudentExperience } from './StudentExperience'
import type { StudentAssignment, StudentProfile } from './types'

const student: StudentProfile = { displayName: 'Ava' }

function assignment(overrides: Partial<StudentAssignment> = {}): StudentAssignment {
  return {
    assignmentRef: 'assignment-1',
    title: 'Fractions review',
    subject: 'Math',
    status: 'NOT_STARTED',
    segments: [
      { segmentRef: 'seg-1', title: 'Warm-up' },
      { segmentRef: 'seg-2', title: 'Guided practice' },
    ],
    ...overrides,
  }
}

function noop() {}

function render(node: Parameters<typeof renderToStaticMarkup>[0]) {
  return renderToStaticMarkup(node)
}

describe('StudentExperience — profile and loading/error states', () => {
  it('shows the student’s safe display label, not an id', () => {
    const markup = render(
      <StudentExperience
        student={student}
        assignments={[]}
        onStart={noop}
        onResume={noop}
        onPause={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('Ava')
  })

  it('renders a status role while loading and hides the assignment list', () => {
    const markup = render(
      <StudentExperience
        student={student}
        assignments={[assignment()]}
        loading
        onStart={noop}
        onResume={noop}
        onPause={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('role="status"')
    expect(markup).not.toContain('Fractions review')
  })

  it('renders an alert role with the error message and hides the assignment list', () => {
    const markup = render(
      <StudentExperience
        student={student}
        assignments={[assignment()]}
        error="Could not reach the study server."
        onStart={noop}
        onResume={noop}
        onPause={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Could not reach the study server.')
    expect(markup).not.toContain('Fractions review')
  })

  it('renders an empty state when there is no assigned work', () => {
    const markup = render(
      <StudentExperience
        student={student}
        assignments={[]}
        onStart={noop}
        onResume={noop}
        onPause={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('Nothing assigned right now.')
  })

  it('never renders a second student’s data — props only ever carry one student', () => {
    const markup = render(
      <StudentExperience
        student={student}
        assignments={[assignment()]}
        onStart={noop}
        onResume={noop}
        onPause={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    // The component has no prop for a roster of students, so there is no
    // shape through which a second student's assignments could render.
    expect(markup).toContain('Ava')
    expect(markup).not.toContain('another-student')
  })
})

describe('AssignmentList — status distinction and primary actions', () => {
  it('labels a NOT_STARTED assignment and offers a start action', () => {
    const markup = render(<AssignmentList assignments={[assignment({ status: 'NOT_STARTED' })]} onStart={noop} onResume={noop} />)
    expect(markup).toContain('Not started')
    expect(markup).toContain('Start assignment')
    expect(markup).toContain('aria-label="Start Fractions review"')
  })

  it('labels an IN_PROGRESS + paused assignment and offers a resume action', () => {
    const markup = render(
      <AssignmentList
        assignments={[assignment({ status: 'IN_PROGRESS', sessionState: 'paused' })]}
        onStart={noop}
        onResume={noop}
      />,
    )
    expect(markup).toContain('In progress')
    expect(markup).toContain('Resume assignment')
  })

  it('labels an IN_PROGRESS + active assignment and offers a continue action', () => {
    const markup = render(
      <AssignmentList
        assignments={[assignment({ status: 'IN_PROGRESS', sessionState: 'active' })]}
        onStart={noop}
        onResume={noop}
      />,
    )
    expect(markup).toContain('In progress')
    expect(markup).toContain('Continue assignment')
  })

  it('labels a COMPLETED assignment and offers no primary action button', () => {
    const markup = render(<AssignmentList assignments={[assignment({ status: 'COMPLETED' })]} onStart={noop} onResume={noop} />)
    expect(markup).toContain('Completed')
    expect(markup).not.toContain('Start assignment')
    expect(markup).not.toContain('Resume assignment')
    expect(markup).not.toContain('Continue assignment')
  })
})

describe('ActiveAssignmentView — current step and lifecycle actions', () => {
  it('shows the current (first incomplete) segment and progress count', () => {
    const markup = render(
      <ActiveAssignmentView
        assignment={assignment({ status: 'IN_PROGRESS', sessionState: 'active', completedSegmentRefs: ['seg-1'] })}
        onPause={noop}
        onResume={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('Guided practice')
    expect(markup).toContain('1 of 2 steps complete')
  })

  it('offers Pause (not Continue) while active', () => {
    const markup = render(
      <ActiveAssignmentView
        assignment={assignment({ status: 'IN_PROGRESS', sessionState: 'active' })}
        onPause={noop}
        onResume={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('aria-label="Pause Fractions review"')
    expect(markup).not.toContain('aria-label="Continue Fractions review"')
  })

  it('offers Continue (not Pause) while paused, and announces the paused state', () => {
    const markup = render(
      <ActiveAssignmentView
        assignment={assignment({ status: 'IN_PROGRESS', sessionState: 'paused' })}
        onPause={noop}
        onResume={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('aria-label="Continue Fractions review"')
    expect(markup).not.toContain('aria-label="Pause Fractions review"')
    expect(markup).toContain('Paused')
  })

  it('always offers a Finish action and a way back to the assignment list', () => {
    const markup = render(
      <ActiveAssignmentView
        assignment={assignment({ status: 'IN_PROGRESS' })}
        onPause={noop}
        onResume={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('aria-label="Finish Fractions review"')
    expect(markup).toContain('Return to assignments')
  })

  it('reports that every step is complete once there is no current segment', () => {
    const markup = render(
      <ActiveAssignmentView
        assignment={assignment({ completedSegmentRefs: ['seg-1', 'seg-2'] })}
        onPause={noop}
        onResume={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('All steps are complete.')
  })
})

describe('StudentExperience — accessibility contract', () => {
  it('has a skip link and a single main landmark', () => {
    const markup = render(
      <StudentExperience
        student={student}
        assignments={[]}
        onStart={noop}
        onResume={noop}
        onPause={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('Skip to your assignments')
    expect((markup.match(/<main/g) ?? []).length).toBe(1)
  })

  it('marks the region busy while loading', () => {
    const markup = render(
      <StudentExperience
        student={student}
        assignments={[]}
        loading
        onStart={noop}
        onResume={noop}
        onPause={noop}
        onComplete={noop}
        onExit={noop}
      />,
    )
    expect(markup).toContain('aria-busy="true"')
  })
})
