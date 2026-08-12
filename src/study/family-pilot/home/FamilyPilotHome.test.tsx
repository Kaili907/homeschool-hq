import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FamilyPilotHome } from './FamilyPilotHome'
import type { FamilyPilotHomeAssignment, FamilyPilotHomeProps, FamilyPilotHomeStudent } from './types'

const student: FamilyPilotHomeStudent = { displayName: 'Ava' }

function assignment(overrides: Partial<FamilyPilotHomeAssignment> = {}): FamilyPilotHomeAssignment {
  return {
    assignmentRef: 'assignment-1',
    title: 'Fractions review',
    subject: 'Math',
    status: 'not-started',
    ...overrides,
  }
}

function noop() {}

function baseProps(overrides: Partial<FamilyPilotHomeProps> = {}): FamilyPilotHomeProps {
  return {
    student,
    todayAssignments: [],
    completedTodayCount: 0,
    onStartAssignment: noop,
    onResumeAssignment: noop,
    onOpenTutor: noop,
    onOpenAssignments: noop,
    onSwitchStudent: noop,
    ...overrides,
  }
}

function render(props: FamilyPilotHomeProps): string {
  return renderToStaticMarkup(<FamilyPilotHome {...props} />)
}

// `FamilyPilotHome` has no hooks, so it can be invoked directly as a plain
// function to get its raw React element tree — letting these tests confirm
// exactly which callback a control is wired to, which static-markup string
// checks can't see (React strips event-handler props from SSR output).
type Tree = ReturnType<typeof FamilyPilotHome>

function collectButtons(node: unknown, acc: any[] = []): any[] {
  if (node === null || node === undefined || typeof node !== 'object') return acc
  if (Array.isArray(node)) {
    for (const child of node) collectButtons(child, acc)
    return acc
  }
  const element = node as { type?: unknown; props?: { children?: unknown } }
  if (!('type' in element)) return acc
  if (element.type === 'button') acc.push(element)
  if (element.props && 'children' in element.props) collectButtons(element.props.children, acc)
  return acc
}

function buttonWithLabel(tree: Tree, label: string) {
  return collectButtons(tree).find(
    (button) => button.props['aria-label'] === label || button.props.children === label,
  )
}

describe('FamilyPilotHome — student display and loading/error states', () => {
  it("shows the student's safe display label, not an id", () => {
    const markup = render(baseProps())
    expect(markup).toContain('Ava')
  })

  it('renders a status role while loading and hides the day', () => {
    const markup = render(
      baseProps({ todayAssignments: [assignment()], loading: true }),
    )
    expect(markup).toContain('role="status"')
    expect(markup).not.toContain('Fractions review')
  })

  it('renders an alert role with the error message and hides the day', () => {
    const markup = render(
      baseProps({ todayAssignments: [assignment()], error: 'Could not reach the study server.' }),
    )
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Could not reach the study server.')
    expect(markup).not.toContain('Fractions review')
  })
})

describe("FamilyPilotHome — today's work", () => {
  it('shows an empty state when there is no assignments today', () => {
    const markup = render(baseProps())
    expect(markup).toContain('Nothing assigned for today.')
  })

  it('offers Start for a planned (not-started) assignment', () => {
    const markup = render(baseProps({ todayAssignments: [assignment({ status: 'not-started' })] }))
    expect(markup).toContain('Not started')
    expect(markup).toContain('aria-label="Start Fractions review"')
    expect(markup).not.toContain('aria-label="Resume Fractions review"')
  })

  it('offers Resume for an in-progress assignment', () => {
    const markup = render(baseProps({ todayAssignments: [assignment({ status: 'in-progress' })] }))
    expect(markup).toContain('In progress')
    expect(markup).toContain('aria-label="Resume Fractions review"')
    expect(markup).not.toContain('aria-label="Start Fractions review"')
  })

  it('shows a completed assignment with no action button', () => {
    const markup = render(baseProps({ todayAssignments: [assignment({ status: 'completed' })] }))
    expect(markup).toContain('Completed')
    expect(markup).not.toContain('aria-label="Start Fractions review"')
    expect(markup).not.toContain('aria-label="Resume Fractions review"')
  })

  it('highlights the in-progress assignment with its own Resume action', () => {
    const inProgress = assignment({ assignmentRef: 'assignment-2', title: 'Reading log', status: 'in-progress' })
    const markup = render(
      baseProps({ todayAssignments: [inProgress], inProgressAssignment: inProgress }),
    )
    expect(markup).toContain('Pick up where you left off')
    expect(markup).toContain('aria-label="Resume Reading log"')
  })
})

describe('FamilyPilotHome — indicators shown only when supplied', () => {
  it('renders no tutor-help section when tutorAvailability is not supplied', () => {
    const markup = render(baseProps())
    expect(markup).not.toContain('Tutor help')
  })

  it('shows the tutor-help indicator as available when supplied and available', () => {
    const markup = render(baseProps({ tutorAvailability: { available: true } }))
    expect(markup).toContain('Tutor help')
    expect(markup).toContain('Your Tutor is ready to help.')
  })

  it('shows the tutor-help indicator as unavailable with a reason when supplied', () => {
    const markup = render(
      baseProps({ tutorAvailability: { available: false, reason: 'Ask a grown-up to turn on Tutor help.' } }),
    )
    expect(markup).toContain('Ask a grown-up to turn on Tutor help.')
  })

  it('renders no hold banner when hold is not supplied', () => {
    const markup = render(baseProps())
    expect(markup).not.toContain('Study is on hold')
  })

  it('shows the hold indicator and disables assignment actions when active', () => {
    const markup = render(
      baseProps({
        todayAssignments: [assignment({ status: 'not-started' })],
        inProgressAssignment: null,
        hold: { active: true, reason: 'Checking in with a grown-up first.' },
      }),
    )
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Study is on hold')
    expect(markup).toContain('Checking in with a grown-up first.')
    expect(markup).toContain('aria-label="Start Fractions review" disabled=""')
  })
})

describe('FamilyPilotHome — callback identity', () => {
  it('wires zero-argument controls to the exact callback passed in, not a wrapper', () => {
    const onOpenTutor = vi.fn()
    const onOpenAssignments = vi.fn()
    const onSwitchStudent = vi.fn()
    const tree = FamilyPilotHome(
      baseProps({ tutorAvailability: { available: true }, onOpenTutor, onOpenAssignments, onSwitchStudent }),
    )

    expect(buttonWithLabel(tree, 'Switch student')?.props.onClick).toBe(onSwitchStudent)
    expect(buttonWithLabel(tree, 'Ask your Tutor')?.props.onClick).toBe(onOpenTutor)
    expect(buttonWithLabel(tree, 'View all assignments')?.props.onClick).toBe(onOpenAssignments)
  })

  it("calls onStartAssignment / onResumeAssignment with the clicked assignment's own ref", () => {
    const onStartAssignment = vi.fn()
    const onResumeAssignment = vi.fn()
    const tree = FamilyPilotHome(
      baseProps({
        todayAssignments: [
          assignment({ assignmentRef: 'a-1', title: 'Fractions review', status: 'not-started' }),
          assignment({ assignmentRef: 'a-2', title: 'Reading log', status: 'in-progress' }),
        ],
        onStartAssignment,
        onResumeAssignment,
      }),
    )

    buttonWithLabel(tree, 'Start Fractions review')?.props.onClick()
    expect(onStartAssignment).toHaveBeenCalledTimes(1)
    expect(onStartAssignment).toHaveBeenCalledWith('a-1')
    expect(onResumeAssignment).not.toHaveBeenCalled()

    buttonWithLabel(tree, 'Resume Reading log')?.props.onClick()
    expect(onResumeAssignment).toHaveBeenCalledTimes(1)
    expect(onResumeAssignment).toHaveBeenCalledWith('a-2')
  })

  it('resumes the highlighted in-progress card with its own ref, independent of the list', () => {
    const onResumeAssignment = vi.fn()
    const inProgress = assignment({ assignmentRef: 'a-9', title: 'Reading log', status: 'in-progress' })
    const tree = FamilyPilotHome(
      baseProps({ todayAssignments: [inProgress], inProgressAssignment: inProgress, onResumeAssignment }),
    )

    buttonWithLabel(tree, 'Resume Reading log')?.props.onClick()
    expect(onResumeAssignment).toHaveBeenCalledTimes(1)
    expect(onResumeAssignment).toHaveBeenCalledWith('a-9')
  })
})

describe('FamilyPilotHome — no cross-student leakage when props change', () => {
  it('never blends a previous student\'s name or assignment into the next render', () => {
    const markupA = render(
      baseProps({
        student: { displayName: 'Ava' },
        todayAssignments: [assignment({ assignmentRef: 'ava-only', title: 'Ava-only assignment' })],
      }),
    )
    const markupB = render(
      baseProps({
        student: { displayName: 'Beatrice' },
        todayAssignments: [assignment({ assignmentRef: 'beatrice-only', title: 'Beatrice-only assignment' })],
      }),
    )

    expect(markupA).toContain('Ava')
    expect(markupA).toContain('Ava-only assignment')
    expect(markupA).not.toContain('Beatrice')
    expect(markupA).not.toContain('Beatrice-only assignment')

    expect(markupB).toContain('Beatrice')
    expect(markupB).toContain('Beatrice-only assignment')
    expect(markupB).not.toContain('Ava')
    expect(markupB).not.toContain('Ava-only assignment')
  })
})

describe('FamilyPilotHome — accessibility contract', () => {
  it('has a skip link and a single main landmark', () => {
    const markup = render(baseProps())
    expect(markup).toContain('Skip to today')
    expect((markup.match(/<main/g) ?? []).length).toBe(1)
  })

  it('marks the region busy while loading', () => {
    const markup = render(baseProps({ loading: true }))
    expect(markup).toContain('aria-busy="true"')
  })
})
