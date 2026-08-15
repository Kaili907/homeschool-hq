import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FamilyPilotParentAssignPanel } from './FamilyPilotParentAssignPanel'
import type { FamilyPilotAssignLesson, FamilyPilotAssignment, FamilyPilotAssignStudent, FamilyPilotWorkingGradeEntry } from './types'

// Mirrors FamilyPilotStudentCard.render.test.tsx: fold each ref into a field
// the panel actually renders (title / lessonTitle) so "no cross-student
// leakage" is a meaningful string-containment check, not just a check that a
// key prop was set correctly.

const ada: FamilyPilotAssignStudent = { studentRef: 'student:ada', displayName: 'Ada', nominalGrade: 5 }
const beatrice: FamilyPilotAssignStudent = { studentRef: 'student:beatrice', displayName: 'Beatrice', nominalGrade: 7 }

function lessonFor(subjectMarker: string): FamilyPilotAssignLesson {
  return { lessonRef: `lesson:${subjectMarker}`, title: `Lesson ${subjectMarker}`, subject: 'math', grade: 5 }
}

function assignmentFor(student: FamilyPilotAssignStudent, marker: string): FamilyPilotAssignment {
  return {
    assignmentRef: `assignment:${marker}`,
    studentRef: student.studentRef,
    lessonRef: `lesson:existing-${marker}`,
    lessonTitle: `Existing ${marker}`,
    subject: 'math',
    status: 'in-progress',
    optional: false,
  }
}

function renderPanel(
  student: FamilyPilotAssignStudent,
  currentAssignments: readonly FamilyPilotAssignment[] = [],
  availableLessons: readonly FamilyPilotAssignLesson[] = [],
  workingGrade: readonly FamilyPilotWorkingGradeEntry[] = [{ subject: 'math', grade: student.nominalGrade }],
): string {
  return renderToStaticMarkup(
    <FamilyPilotParentAssignPanel
      student={student}
      availableLessons={availableLessons}
      currentAssignments={currentAssignments}
      workingGrade={workingGrade}
      enabledSubjects={['math']}
      onAssignLesson={() => {}}
      onResumeAssignment={() => {}}
    />,
  )
}

describe('FamilyPilotParentAssignPanel — same-name students stay distinct', () => {
  it('renders only the given student\'s name and assignment content', () => {
    const beatriceSameName: FamilyPilotAssignStudent = { studentRef: 'student:beatrice-2', displayName: 'Ada', nominalGrade: 2 }
    const htmlA = renderPanel(ada, [assignmentFor(ada, 'ada-only')])
    const htmlB = renderPanel(beatriceSameName, [assignmentFor(beatriceSameName, 'beatrice-only')])

    expect(htmlA).toContain('Existing ada-only')
    expect(htmlA).not.toContain('Existing beatrice-only')
    expect(htmlB).toContain('Existing beatrice-only')
    expect(htmlB).not.toContain('Existing ada-only')

    expect(htmlA).toContain('data-student-ref="student:ada"')
    expect(htmlB).toContain('data-student-ref="student:beatrice-2"')
  })
})

describe('FamilyPilotParentAssignPanel — student switch replaces displayed assignments', () => {
  it('a render for the next student never carries the previous student\'s assignment content', () => {
    const htmlBefore = renderPanel(ada, [assignmentFor(ada, 'ada-only')])
    expect(htmlBefore).toContain('Existing ada-only')

    // The panel holds no internal state keyed to the previous student, so a
    // host-driven prop swap to a new student is a plain re-render — this is
    // the same call with a different `student`/`currentAssignments` pair.
    const htmlAfter = renderPanel(beatrice, [])
    expect(htmlAfter).not.toContain('Existing ada-only')
    expect(htmlAfter).not.toContain('student:ada')
  })
})

describe('FamilyPilotParentAssignPanel — empty state', () => {
  it('shows empty-state copy when there is no current work and nothing to assign', () => {
    const html = renderPanel(ada)
    expect(html).toContain('No work is currently assigned to Ada.')
    expect(html).toContain('No available lessons to assign to Ada right now.')
  })
})

describe('FamilyPilotParentAssignPanel — in-progress resume', () => {
  it('renders a resume action naming the student for an in-progress assignment', () => {
    const html = renderPanel(ada, [assignmentFor(ada, 'resume-me')])
    expect(html).toContain('Resume for Ada')
  })
})

describe('FamilyPilotParentAssignPanel — available next lesson', () => {
  it('renders an assign action for a lesson with no open assignment', () => {
    const html = renderPanel(ada, [], [lessonFor('math-1')])
    expect(html).toContain('Assign to Ada')
    expect(html).toContain('Lesson math-1')
  })
})

describe('FamilyPilotParentAssignPanel — duplicate/in-progress warning', () => {
  it('shows a warning and resume action instead of an assign action when the lesson is already open', () => {
    const lesson: FamilyPilotAssignLesson = { lessonRef: 'lesson:dup', title: 'Duplicate lesson', subject: 'math', grade: 5 }
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:dup',
      studentRef: ada.studentRef,
      lessonRef: lesson.lessonRef,
      lessonTitle: lesson.title,
      subject: 'math',
      status: 'in-progress',
      optional: false,
    }
    const html = renderPanel(ada, [assignment], [lesson])
    expect(html).toContain('Already assigned to Ada')
    expect(html).not.toContain('Assign to Ada')
  })

  it('does not leave a dead-end warning for a not-started duplicate — it points back at Current work instead', () => {
    const lesson: FamilyPilotAssignLesson = { lessonRef: 'lesson:queued', title: 'Queued lesson', subject: 'math', grade: 5 }
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:queued',
      studentRef: ada.studentRef,
      lessonRef: lesson.lessonRef,
      lessonTitle: lesson.title,
      subject: 'math',
      status: 'not-started',
      optional: false,
    }
    const html = renderPanel(ada, [assignment], [lesson])
    expect(html).toContain('Already queued for Ada')
    expect(html).toContain('Current work above')
    expect(html).not.toContain('Assign to Ada')
    expect(html).not.toContain('Resume for Ada')
  })

  it('notes a previously completed exact lesson and suppresses a duplicate assignment action', () => {
    const lesson: FamilyPilotAssignLesson = { lessonRef: 'lesson:done-before', title: 'Done before', subject: 'math', grade: 5 }
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:done-before',
      studentRef: ada.studentRef,
      lessonRef: lesson.lessonRef,
      lessonTitle: lesson.title,
      subject: 'math',
      status: 'completed',
      optional: false,
    }
    const html = renderPanel(ada, [assignment], [lesson])
    expect(html).not.toContain('Assign to Ada')
    expect(html).toContain('Already completed by Ada — an exact duplicate was not created.')
  })
})

describe('FamilyPilotParentAssignPanel — working grade display', () => {
  it('shows the nominal grade and the per-subject working grade', () => {
    const html = renderToStaticMarkup(
      <FamilyPilotParentAssignPanel
        student={ada}
        availableLessons={[]}
        currentAssignments={[]}
        workingGrade={[{ subject: 'math', grade: 6 }]}
        enabledSubjects={['math']}
        onAssignLesson={() => {}}
        onResumeAssignment={() => {}}
      />,
    )
    expect(html).toContain('Nominal grade')
    expect(html).toContain('>5<')
    expect(html).toContain('Working grade — math')
  })

  it('renders an editable grade control only when the host provides onChangeWorkingGrade', () => {
    const readOnlyHtml = renderPanel(ada)
    expect(readOnlyHtml).not.toContain('<select')

    const editableHtml = renderToStaticMarkup(
      <FamilyPilotParentAssignPanel
        student={ada}
        availableLessons={[]}
        currentAssignments={[]}
        workingGrade={[{ subject: 'math', grade: 5 }]}
        enabledSubjects={['math']}
        onAssignLesson={() => {}}
        onResumeAssignment={() => {}}
        onChangeWorkingGrade={() => {}}
      />,
    )
    expect(editableHtml).toContain('<select')
  })
})

describe('FamilyPilotParentAssignPanel — keyboard / basic accessibility', () => {
  it('uses native interactive elements and label associations instead of non-semantic click targets', () => {
    const lesson = lessonFor('a11y')
    const html = renderToStaticMarkup(
      <FamilyPilotParentAssignPanel
        student={ada}
        availableLessons={[lesson]}
        currentAssignments={[assignmentFor(ada, 'a11y-current')]}
        workingGrade={[{ subject: 'math', grade: 5 }]}
        enabledSubjects={['math']}
        onAssignLesson={() => {}}
        onResumeAssignment={() => {}}
        onSkipAssignment={() => {}}
        onChangeWorkingGrade={() => {}}
      />,
    )

    // Every clickable control is a real <button>, never a div/span faking one.
    expect(html).not.toContain('role="button"')
    // Sections are labelled for screen-reader/keyboard navigation.
    expect(html).toContain('aria-labelledby="family-pilot-assign-current-student:ada"')
    expect(html).toContain('aria-labelledby="family-pilot-assign-available-student:ada"')
    // The working-grade control has a real label wired to its id.
    const labelMatch = html.match(/<label for="([^"]+)"[^>]*>Working grade — math<\/label>/)
    expect(labelMatch).not.toBeNull()
    if (labelMatch) {
      expect(html).toContain(`id="${labelMatch[1]}"`)
    }
  })
})
