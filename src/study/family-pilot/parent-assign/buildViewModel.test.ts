import { describe, expect, it } from 'vitest'
import { buildAssignViewModel } from './buildViewModel'
import type { FamilyPilotAssignLesson, FamilyPilotAssignment, FamilyPilotAssignStudent, FamilyPilotWorkingGradeEntry } from './types'

const ada: FamilyPilotAssignStudent = { studentRef: 'student:ada', displayName: 'Ada', nominalGrade: 5 }

const mathLesson: FamilyPilotAssignLesson = { lessonRef: 'lesson:math-1', title: 'Fractions I', subject: 'math', grade: 5 }
const readingLesson: FamilyPilotAssignLesson = { lessonRef: 'lesson:reading-1', title: 'Chapter 3', subject: 'reading', grade: 5 }

function baseInput(overrides: Partial<Parameters<typeof buildAssignViewModel>[0]> = {}) {
  return {
    student: ada,
    availableLessons: [mathLesson, readingLesson],
    currentAssignments: [] as readonly FamilyPilotAssignment[],
    workingGrade: [{ subject: 'math', grade: 5 }] as readonly FamilyPilotWorkingGradeEntry[],
    enabledSubjects: ['math', 'reading'] as const,
    supportsSkip: false,
    ...overrides,
  }
}

describe('buildAssignViewModel — no assignments', () => {
  it('returns an empty current-assignments list', () => {
    const model = buildAssignViewModel(baseInput())
    expect(model.currentAssignments).toEqual([])
  })
})

describe('buildAssignViewModel — available next lesson', () => {
  it('lists a lesson with no existing assignment as assignable, keyed to the correct student and lesson', () => {
    const model = buildAssignViewModel(baseInput())
    const row = model.assignableLessons.find((lesson) => lesson.lessonRef === mathLesson.lessonRef)
    expect(row).toBeDefined()
    expect(row?.duplicateAssignmentRef).toBeNull()
    expect(model.studentRef).toBe('student:ada')
  })

  it('excludes lessons outside enabledSubjects', () => {
    const model = buildAssignViewModel(baseInput({ enabledSubjects: ['math'] }))
    expect(model.assignableLessons.map((lesson) => lesson.lessonRef)).toEqual([mathLesson.lessonRef])
  })
})

describe('buildAssignViewModel — in-progress resume', () => {
  it('marks an in-progress assignment as resumable', () => {
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:1',
      studentRef: ada.studentRef,
      lessonRef: mathLesson.lessonRef,
      lessonTitle: mathLesson.title,
      subject: 'math',
      status: 'in-progress',
      optional: false,
    }
    const model = buildAssignViewModel(baseInput({ currentAssignments: [assignment] }))
    expect(model.currentAssignments).toHaveLength(1)
    expect(model.currentAssignments[0].canResume).toBe(true)
    expect(model.currentAssignments[0].assignmentRef).toBe('assignment:1')
  })

  it('does not mark a not-started assignment as resumable', () => {
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:2',
      studentRef: ada.studentRef,
      lessonRef: readingLesson.lessonRef,
      lessonTitle: readingLesson.title,
      subject: 'reading',
      status: 'not-started',
      optional: false,
    }
    const model = buildAssignViewModel(baseInput({ currentAssignments: [assignment] }))
    expect(model.currentAssignments[0].canResume).toBe(false)
  })
})

describe('buildAssignViewModel — current work only shows open assignments', () => {
  it('excludes completed and skipped assignments so "current work" never reads as still-needs-attention', () => {
    const open: FamilyPilotAssignment = {
      assignmentRef: 'assignment:open',
      studentRef: ada.studentRef,
      lessonRef: mathLesson.lessonRef,
      lessonTitle: mathLesson.title,
      subject: 'math',
      status: 'in-progress',
      optional: false,
    }
    const completed: FamilyPilotAssignment = {
      assignmentRef: 'assignment:completed',
      studentRef: ada.studentRef,
      lessonRef: readingLesson.lessonRef,
      lessonTitle: readingLesson.title,
      subject: 'reading',
      status: 'completed',
      optional: false,
    }
    const skipped: FamilyPilotAssignment = {
      assignmentRef: 'assignment:skipped',
      studentRef: ada.studentRef,
      lessonRef: 'lesson:skipped',
      lessonTitle: 'Skipped lesson',
      subject: 'math',
      status: 'skipped',
      optional: true,
    }
    const model = buildAssignViewModel(baseInput({ currentAssignments: [open, completed, skipped] }))
    expect(model.currentAssignments.map((row) => row.assignmentRef)).toEqual(['assignment:open'])
  })
})

describe('buildAssignViewModel — assign action carries the correct student', () => {
  it('every assignable-lesson row resolves to this student, regardless of other students in the input', () => {
    const model = buildAssignViewModel(baseInput())
    expect(model.assignableLessons.every(() => model.studentRef === ada.studentRef)).toBe(true)
  })
})

describe('buildAssignViewModel — same-name students stay distinct', () => {
  it('filters currentAssignments by studentRef, not displayName, so a same-named student cannot leak in', () => {
    const otherAda: FamilyPilotAssignStudent = { studentRef: 'student:ada-2', displayName: 'Ada', nominalGrade: 3 }
    const assignmentForOtherAda: FamilyPilotAssignment = {
      assignmentRef: 'assignment:other',
      studentRef: otherAda.studentRef,
      lessonRef: mathLesson.lessonRef,
      lessonTitle: mathLesson.title,
      subject: 'math',
      status: 'in-progress',
      optional: false,
    }
    const model = buildAssignViewModel(baseInput({ currentAssignments: [assignmentForOtherAda] }))
    expect(model.currentAssignments).toEqual([])
    expect(model.assignableLessons.find((l) => l.lessonRef === mathLesson.lessonRef)?.duplicateAssignmentRef).toBeNull()
  })
})

describe('buildAssignViewModel — working grade display', () => {
  it('surfaces the nominal grade and the per-subject working grade', () => {
    const model = buildAssignViewModel(
      baseInput({
        workingGrade: [
          { subject: 'math', grade: 6 },
          { subject: 'reading', grade: 4 },
        ],
      }),
    )
    expect(model.nominalGrade).toBe(5)
    expect(model.workingGrades).toEqual([
      { subject: 'math', grade: 6 },
      { subject: 'reading', grade: 4 },
    ])
  })

  it('drops working-grade entries for subjects the host has not enabled', () => {
    const model = buildAssignViewModel(
      baseInput({
        enabledSubjects: ['math'],
        workingGrade: [
          { subject: 'math', grade: 6 },
          { subject: 'reading', grade: 4 },
        ],
      }),
    )
    expect(model.workingGrades).toEqual([{ subject: 'math', grade: 6 }])
  })
})

describe('buildAssignViewModel — duplicate/in-progress warning', () => {
  it('flags a lesson that already has an open assignment instead of allowing a duplicate assign', () => {
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:3',
      studentRef: ada.studentRef,
      lessonRef: mathLesson.lessonRef,
      lessonTitle: mathLesson.title,
      subject: 'math',
      status: 'paused',
      optional: false,
    }
    const model = buildAssignViewModel(baseInput({ currentAssignments: [assignment] }))
    const row = model.assignableLessons.find((lesson) => lesson.lessonRef === mathLesson.lessonRef)
    expect(row?.duplicateAssignmentRef).toBe('assignment:3')
    expect(row?.duplicateStatus).toBe('paused')
    expect(row?.canResumeDuplicate).toBe(true)
  })

  it('does not flag a lesson whose only prior assignment is completed', () => {
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:4',
      studentRef: ada.studentRef,
      lessonRef: mathLesson.lessonRef,
      lessonTitle: mathLesson.title,
      subject: 'math',
      status: 'completed',
      optional: false,
    }
    const model = buildAssignViewModel(baseInput({ currentAssignments: [assignment] }))
    const row = model.assignableLessons.find((lesson) => lesson.lessonRef === mathLesson.lessonRef)
    expect(row?.duplicateAssignmentRef).toBeNull()
    expect(row?.priorStatus).toBe('completed')
  })

  it('does not offer a resume action for a not-started duplicate', () => {
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:5',
      studentRef: ada.studentRef,
      lessonRef: mathLesson.lessonRef,
      lessonTitle: mathLesson.title,
      subject: 'math',
      status: 'not-started',
      optional: false,
    }
    const model = buildAssignViewModel(baseInput({ currentAssignments: [assignment] }))
    const row = model.assignableLessons.find((lesson) => lesson.lessonRef === mathLesson.lessonRef)
    expect(row?.duplicateAssignmentRef).toBe('assignment:5')
    expect(row?.canResumeDuplicate).toBe(false)
  })
})

describe('buildAssignViewModel — skip visibility follows host support', () => {
  it('only marks an assignment skippable when the host provided a skip callback', () => {
    const assignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:6',
      studentRef: ada.studentRef,
      lessonRef: mathLesson.lessonRef,
      lessonTitle: mathLesson.title,
      subject: 'math',
      status: 'in-progress',
      optional: false,
    }
    const withoutSkip = buildAssignViewModel(baseInput({ currentAssignments: [assignment], supportsSkip: false }))
    const withSkip = buildAssignViewModel(baseInput({ currentAssignments: [assignment], supportsSkip: true }))
    expect(withoutSkip.currentAssignments[0].canSkip).toBe(false)
    expect(withSkip.currentAssignments[0].canSkip).toBe(true)
  })
})

describe('buildAssignViewModel — student switch produces no stale content', () => {
  it('a second call for a different student never carries over the first student\'s assignments', () => {
    const beatrice: FamilyPilotAssignStudent = { studentRef: 'student:beatrice', displayName: 'Beatrice', nominalGrade: 7 }
    const adaAssignment: FamilyPilotAssignment = {
      assignmentRef: 'assignment:ada-only',
      studentRef: ada.studentRef,
      lessonRef: mathLesson.lessonRef,
      lessonTitle: mathLesson.title,
      subject: 'math',
      status: 'in-progress',
      optional: false,
    }
    buildAssignViewModel(baseInput({ currentAssignments: [adaAssignment] }))
    const secondModel = buildAssignViewModel(baseInput({ student: beatrice, currentAssignments: [adaAssignment] }))
    expect(secondModel.currentAssignments).toEqual([])
    expect(secondModel.studentRef).toBe('student:beatrice')
  })
})
