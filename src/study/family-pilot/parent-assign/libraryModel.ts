export type ManualAssignmentLibraryStatus =
  | 'assigned'
  | 'completed'
  | 'current'
  | 'waiting'
  | 'blocked'

export interface ManualLessonAssignmentFact {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly state: 'planned' | 'active' | 'paused' | 'completed' | 'abandoned'
}

export interface ManualAssessmentAssignmentFact {
  readonly assignmentRef: string
  readonly assessmentRef: string
  readonly status:
    | 'PLANNED'
    | 'ACTIVE'
    | 'PENDING_ASSESSMENT'
    | 'ADULT_REVIEW_REQUIRED'
    | 'PENDING_GUARDIAN_ATTESTATION'
    | 'CERTIFIED'
}

export interface ManualAssignmentCandidateStatus {
  readonly assignmentRef: string
  readonly status: ManualAssignmentLibraryStatus
  readonly detail: string
}

function overriddenStatus(
  assignmentRef: string,
  waitingAssignmentRefs: ReadonlySet<string>,
  blockedAssignmentRefs: ReadonlySet<string>,
): ManualAssignmentCandidateStatus | null {
  if (blockedAssignmentRefs.has(assignmentRef)) {
    return { assignmentRef, status: 'blocked', detail: 'Blocked by an authoritative readiness requirement.' }
  }
  if (waitingAssignmentRefs.has(assignmentRef)) {
    return { assignmentRef, status: 'waiting', detail: 'Waiting for the required Parent review or attestation.' }
  }
  return null
}

/** Exact-ref status projection. Any returned value also prevents a duplicate assignment. */
export function lessonCandidateStatus(input: {
  readonly lessonRef: string
  readonly assignments: readonly ManualLessonAssignmentFact[]
  readonly waitingAssignmentRefs?: ReadonlySet<string>
  readonly blockedAssignmentRefs?: ReadonlySet<string>
}): ManualAssignmentCandidateStatus | null {
  const assignment = input.assignments.find((item) => item.lessonRef === input.lessonRef)
  if (!assignment) return null
  const overridden = overriddenStatus(
    assignment.assignmentRef,
    input.waitingAssignmentRefs ?? new Set<string>(),
    input.blockedAssignmentRefs ?? new Set<string>(),
  )
  if (overridden) return overridden
  if (assignment.state === 'completed') {
    return { assignmentRef: assignment.assignmentRef, status: 'completed', detail: 'This exact lesson is complete.' }
  }
  if (assignment.state === 'active' || assignment.state === 'paused') {
    return { assignmentRef: assignment.assignmentRef, status: 'current', detail: 'This exact lesson is current work.' }
  }
  return {
    assignmentRef: assignment.assignmentRef,
    status: 'assigned',
    detail: assignment.state === 'abandoned'
      ? 'This exact lesson was previously assigned and skipped.'
      : 'This exact lesson is already assigned.',
  }
}

/** Exact-ref assessment status projection. Any returned value also prevents a duplicate assignment. */
export function assessmentCandidateStatus(input: {
  readonly assessmentRef: string
  readonly assignments: readonly ManualAssessmentAssignmentFact[]
  readonly blockedAssignmentRefs?: ReadonlySet<string>
}): ManualAssignmentCandidateStatus | null {
  const assignment = input.assignments.find((item) => item.assessmentRef === input.assessmentRef)
  if (!assignment) return null
  const overridden = overriddenStatus(
    assignment.assignmentRef,
    new Set<string>(),
    input.blockedAssignmentRefs ?? new Set<string>(),
  )
  if (overridden) return overridden
  if (assignment.status === 'CERTIFIED') {
    return { assignmentRef: assignment.assignmentRef, status: 'completed', detail: 'This exact assessment is complete.' }
  }
  if (assignment.status === 'ACTIVE') {
    return { assignmentRef: assignment.assignmentRef, status: 'current', detail: 'This exact assessment is current work.' }
  }
  if (['PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED', 'PENDING_GUARDIAN_ATTESTATION'].includes(assignment.status)) {
    return { assignmentRef: assignment.assignmentRef, status: 'waiting', detail: 'This assessment is waiting for its required scoring or Parent review.' }
  }
  return { assignmentRef: assignment.assignmentRef, status: 'assigned', detail: 'This exact assessment is already assigned.' }
}

function searchable(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Searches only canonical display fields and canonical unit/lesson ordinals supplied by the caller. */
export function matchesManualLibrarySearch(
  query: string,
  fields: {
    readonly title: string
    readonly unitTitle: string
    readonly subjectTitle: string
    readonly unitNumber: number
    readonly lessonNumber?: number
  },
): boolean {
  const terms = searchable(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const haystack = searchable([
    fields.title,
    fields.unitTitle,
    fields.subjectTitle,
    `unit ${fields.unitNumber}`,
    fields.lessonNumber === undefined ? '' : `lesson ${fields.lessonNumber}`,
  ].join(' '))
  return terms.every((term) => haystack.includes(term))
}
