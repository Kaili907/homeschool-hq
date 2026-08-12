import { describe, expect, it, vi } from 'vitest'
import { FamilyPilotParentAssignPanel } from './FamilyPilotParentAssignPanel'
import type { FamilyPilotAssignLesson, FamilyPilotAssignment, FamilyPilotAssignStudent } from './types'

/**
 * There is no jsdom/testing-library in this repo, so a real DOM click can't
 * be simulated. FamilyPilotParentAssignPanel takes no hooks — it is a pure
 * function of its props — so it can be invoked directly as a plain function
 * to get back its React element tree, walked here to find the button that
 * was actually rendered, and its onClick invoked directly. This verifies
 * the real callback binding (correct studentRef/lessonRef/assignmentRef),
 * not just the pure view-model that feeds it.
 */

interface AnyElement {
  readonly type: unknown
  readonly props: Record<string, unknown>
}

function isElement(node: unknown): node is AnyElement {
  return typeof node === 'object' && node !== null && 'type' in node && 'props' in node
}

function collectButtons(node: unknown, results: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectButtons(child, results))
    return results
  }
  if (!isElement(node)) return results
  if (node.type === 'button') results.push(node)
  const children = (node.props as { children?: unknown }).children
  if (children !== undefined) collectButtons(children, results)
  return results
}

function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isElement(node)) return textOf((node.props as { children?: unknown }).children)
  return ''
}

function collectByType(node: unknown, type: string, results: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectByType(child, type, results))
    return results
  }
  if (!isElement(node)) return results
  if (node.type === type) results.push(node)
  const children = (node.props as { children?: unknown }).children
  if (children !== undefined) collectByType(children, type, results)
  return results
}

function findFunctionComponent(node: unknown): AnyElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFunctionComponent(child)
      if (found) return found
    }
    return undefined
  }
  if (!isElement(node)) return undefined
  if (typeof node.type === 'function') return node
  const children = (node.props as { children?: unknown }).children
  return children !== undefined ? findFunctionComponent(children) : undefined
}

const ada: FamilyPilotAssignStudent = { studentRef: 'student:ada', displayName: 'Ada', nominalGrade: 5 }
const lesson: FamilyPilotAssignLesson = { lessonRef: 'lesson:bind-check', title: 'Bind check', subject: 'math', grade: 5 }

describe('FamilyPilotParentAssignPanel — assign callback correct student', () => {
  it('invokes onAssignLesson with this student\'s ref and the clicked lesson\'s ref', () => {
    const onAssignLesson = vi.fn()
    const tree = FamilyPilotParentAssignPanel({
      student: ada,
      availableLessons: [lesson],
      currentAssignments: [],
      workingGrade: [],
      enabledSubjects: ['math'],
      onAssignLesson,
      onResumeAssignment: () => {},
    })
    const assignButton = collectButtons(tree).find((button) => textOf(button).includes('Assign to Ada'))
    expect(assignButton).toBeDefined()
    ;(assignButton?.props.onClick as () => void)()
    expect(onAssignLesson).toHaveBeenCalledWith('student:ada', 'lesson:bind-check')
  })

  it('does not confuse two students that share a display name', () => {
    const decoy: FamilyPilotAssignStudent = { studentRef: 'student:ada-decoy', displayName: 'Ada', nominalGrade: 2 }
    const onAssignLesson = vi.fn()
    const tree = FamilyPilotParentAssignPanel({
      student: decoy,
      availableLessons: [lesson],
      currentAssignments: [],
      workingGrade: [],
      enabledSubjects: ['math'],
      onAssignLesson,
      onResumeAssignment: () => {},
    })
    const assignButton = collectButtons(tree).find((button) => textOf(button).includes('Assign to Ada'))
    ;(assignButton?.props.onClick as () => void)()
    expect(onAssignLesson).toHaveBeenCalledWith('student:ada-decoy', 'lesson:bind-check')
  })
})

describe('FamilyPilotParentAssignPanel — resume action correct student and assignment', () => {
  it('invokes onResumeAssignment with this student\'s ref and the clicked assignment\'s ref', () => {
    const onResumeAssignment = vi.fn()
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:resume-check',
      studentRef: ada.studentRef,
      lessonRef: 'lesson:existing',
      lessonTitle: 'Existing lesson',
      subject: 'math',
      status: 'in-progress',
      optional: false,
    }
    const tree = FamilyPilotParentAssignPanel({
      student: ada,
      availableLessons: [],
      currentAssignments: [assignment],
      workingGrade: [],
      enabledSubjects: ['math'],
      onAssignLesson: () => {},
      onResumeAssignment,
    })
    const resumeButton = collectButtons(tree).find((button) => textOf(button).includes('Resume for Ada'))
    expect(resumeButton).toBeDefined()
    ;(resumeButton?.props.onClick as () => void)()
    expect(onResumeAssignment).toHaveBeenCalledWith('student:ada', 'assignment:resume-check')
  })

  it('resumes the duplicate assignment (not a fresh assign) when the lesson is already open', () => {
    const onResumeAssignment = vi.fn()
    const onAssignLesson = vi.fn()
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:dup-resume',
      studentRef: ada.studentRef,
      lessonRef: lesson.lessonRef,
      lessonTitle: lesson.title,
      subject: 'math',
      status: 'paused',
      optional: false,
    }
    const tree = FamilyPilotParentAssignPanel({
      student: ada,
      availableLessons: [lesson],
      currentAssignments: [assignment],
      workingGrade: [],
      enabledSubjects: ['math'],
      onAssignLesson,
      onResumeAssignment,
    })
    const resumeButton = collectButtons(tree).find((button) => textOf(button).includes('Resume for Ada'))
    ;(resumeButton?.props.onClick as () => void)()
    expect(onResumeAssignment).toHaveBeenCalledWith('student:ada', 'assignment:dup-resume')
    expect(onAssignLesson).not.toHaveBeenCalled()
  })
})

describe('FamilyPilotParentAssignPanel — skip action', () => {
  it('invokes onSkipAssignment with this student\'s ref and assignment ref when the host supports it', () => {
    const onSkipAssignment = vi.fn()
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:skip-check',
      studentRef: ada.studentRef,
      lessonRef: 'lesson:existing',
      lessonTitle: 'Existing lesson',
      subject: 'math',
      status: 'in-progress',
      optional: false,
    }
    const tree = FamilyPilotParentAssignPanel({
      student: ada,
      availableLessons: [],
      currentAssignments: [assignment],
      workingGrade: [],
      enabledSubjects: ['math'],
      onAssignLesson: () => {},
      onResumeAssignment: () => {},
      onSkipAssignment,
    })
    const skipButton = collectButtons(tree).find((button) => textOf(button).includes('Skip this lesson'))
    expect(skipButton).toBeDefined()
    ;(skipButton?.props.onClick as () => void)()
    expect(onSkipAssignment).toHaveBeenCalledWith('student:ada', 'assignment:skip-check')
  })

  it('renders no skip action when the host does not support it', () => {
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:no-skip',
      studentRef: ada.studentRef,
      lessonRef: 'lesson:existing',
      lessonTitle: 'Existing lesson',
      subject: 'math',
      status: 'in-progress',
      optional: false,
    }
    const tree = FamilyPilotParentAssignPanel({
      student: ada,
      availableLessons: [],
      currentAssignments: [assignment],
      workingGrade: [],
      enabledSubjects: ['math'],
      onAssignLesson: () => {},
      onResumeAssignment: () => {},
    })
    const skipButton = collectButtons(tree).find((button) => textOf(button).includes('Skip this lesson'))
    expect(skipButton).toBeUndefined()
  })
})

describe('FamilyPilotParentAssignPanel — working grade change', () => {
  it('invokes onChangeWorkingGrade with this student\'s ref, subject, and the new grade', () => {
    const onChangeWorkingGrade = vi.fn()
    const tree = FamilyPilotParentAssignPanel({
      student: ada,
      availableLessons: [],
      currentAssignments: [],
      workingGrade: [{ subject: 'math', grade: 5 }],
      enabledSubjects: ['math'],
      onAssignLesson: () => {},
      onResumeAssignment: () => {},
      onChangeWorkingGrade,
    })
    // GradeGrid is a nested function component — the root call above only
    // returns its unexpanded element, so expand it the same way to reach
    // the real <select> and its real onChange handler.
    const gradeGridElement = findFunctionComponent(tree)
    expect(gradeGridElement).toBeDefined()
    const gradeGridTree = (gradeGridElement?.type as (props: Record<string, unknown>) => unknown)(gradeGridElement?.props ?? {})
    const select = collectByType(gradeGridTree, 'select')[0]
    expect(select).toBeDefined()
    ;(select.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: '6' } })
    expect(onChangeWorkingGrade).toHaveBeenCalledWith('student:ada', 'math', 6)
  })
})
