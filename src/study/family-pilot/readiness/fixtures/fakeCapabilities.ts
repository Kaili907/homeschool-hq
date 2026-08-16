import type { GradeLevel, ReadinessCapabilityPorts, StudentRef, SubjectId } from '../types'

/** A subject/grade pair, used to seed or gap-out fake capability ports. */
export interface FakeCourseKey {
  readonly subject: SubjectId
  readonly grade: GradeLevel
}

export interface FakeCapabilityOverrides {
  readonly catalogAvailable?: boolean
  /** Courses the fake catalog actually has. Everything else is a CONTENT_GAP. */
  readonly courses?: readonly FakeCourseKey[]
  readonly studyUnavailableFor?: readonly FakeCourseKey[]
  readonly assignmentUnavailableFor?: readonly FakeCourseKey[]
  readonly persistenceUnavailableFor?: readonly { readonly studentRef: StudentRef; readonly subject: SubjectId }[]
  readonly safetyUnavailableFor?: readonly {
    readonly studentRef: StudentRef
    readonly subject: SubjectId
    readonly grade: GradeLevel
  }[]
  readonly tutorUnavailableFor?: readonly FakeCourseKey[]
  readonly staticHelpUnavailableFor?: readonly FakeCourseKey[]
}

function courseKey(subject: SubjectId, grade: GradeLevel): string {
  return `${subject}::${grade}`
}

/**
 * Builds an in-memory ReadinessCapabilityPorts implementation for tests.
 * Everything defaults to "available"; pass overrides to carve out specific
 * gaps. This is the injected fake the mission calls for — real convergence
 * work implements the same ports against the actual modules.
 */
export function createFakeReadinessCapabilities(
  overrides: FakeCapabilityOverrides = {},
): ReadinessCapabilityPorts {
  const catalogAvailable = overrides.catalogAvailable ?? true
  const courseSet = new Set((overrides.courses ?? []).map((c) => courseKey(c.subject, c.grade)))
  const studyGaps = new Set((overrides.studyUnavailableFor ?? []).map((c) => courseKey(c.subject, c.grade)))
  const assignmentGaps = new Set(
    (overrides.assignmentUnavailableFor ?? []).map((c) => courseKey(c.subject, c.grade)),
  )
  const persistenceGaps = new Set(
    (overrides.persistenceUnavailableFor ?? []).map((p) => `${p.studentRef}::${p.subject}`),
  )
  const safetyGaps = new Set(
    (overrides.safetyUnavailableFor ?? []).map((s) => `${s.studentRef}::${s.subject}::${s.grade}`),
  )
  const tutorGaps = new Set((overrides.tutorUnavailableFor ?? []).map((c) => courseKey(c.subject, c.grade)))
  const staticHelpGaps = new Set(
    (overrides.staticHelpUnavailableFor ?? []).map((c) => courseKey(c.subject, c.grade)),
  )

  return {
    catalog: {
      isAvailable: () => catalogAvailable,
      hasCourse: (subject, grade) => courseSet.has(courseKey(subject, grade)),
    },
    study: {
      isAvailable: (subject, grade) => !studyGaps.has(courseKey(subject, grade)),
    },
    assignment: {
      isAvailable: (subject, grade) => !assignmentGaps.has(courseKey(subject, grade)),
    },
    persistence: {
      isAvailable: (studentRef, subject) => !persistenceGaps.has(`${studentRef}::${subject}`),
    },
    safety: {
      isAvailable: (studentRef, subject, grade) => !safetyGaps.has(`${studentRef}::${subject}::${grade}`),
    },
    tutor: {
      isTutorAvailable: (subject, grade) => !tutorGaps.has(courseKey(subject, grade)),
      isStaticHelpAvailable: (subject, grade) => !staticHelpGaps.has(courseKey(subject, grade)),
    },
  }
}

/** Cartesian product helper: every subject at every grade, all present in the fake catalog. */
export function everyCourse(
  subjects: readonly SubjectId[],
  grades: readonly GradeLevel[],
): FakeCourseKey[] {
  return subjects.flatMap((subject) => grades.map((grade) => ({ subject, grade })))
}
