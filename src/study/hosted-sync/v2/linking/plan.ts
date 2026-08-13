import type {
  AssignmentLinkPlanItem,
  ExplicitStudentMappingChoice,
  FirstLinkInspection,
  FirstLinkPlan,
  LocalHouseholdForLink,
  LocalStudentForLink,
  RemoteStudentSummary,
  SessionLinkPlanItem,
  StudentLinkPlanItem,
  StudentLinkState,
} from './types'

function sameIdentity(
  left: { readonly kind: string; readonly value: string },
  right: { readonly kind: string; readonly value: string },
): boolean {
  return left.kind === right.kind && left.value === right.value
}

function byRef<T>(items: readonly T[], ref: (item: T) => string): readonly T[] {
  return Object.freeze([...items].sort((left, right) => ref(left).localeCompare(ref(right))))
}

function hasDuplicateRefs<T>(items: readonly T[], ref: (item: T) => string): boolean {
  const refs = items.map(ref)
  return new Set(refs).size !== refs.length
}

function assignmentPlan(
  local: LocalStudentForLink,
  remote: RemoteStudentSummary | null,
): readonly AssignmentLinkPlanItem[] {
  if (!remote) {
    return local.assignments.map((assignment) => Object.freeze({
      localAssignmentRef: assignment.localAssignmentRef,
      state: 'NEW_REMOTE_ASSIGNMENT' as const,
      remoteAssignmentRef: null,
      reasonCode: null,
    }))
  }
  const duplicateRemoteRefs = new Set<string>()
  const seen = new Set<string>()
  for (const item of remote.assignments) {
    if (seen.has(item.remoteAssignmentRef)) duplicateRemoteRefs.add(item.remoteAssignmentRef)
    seen.add(item.remoteAssignmentRef)
  }
  return local.assignments.map((assignment): AssignmentLinkPlanItem => {
    const exact = remote.assignments.filter(
      (item) => item.originLocalAssignmentRef === assignment.localAssignmentRef,
    )
    if (exact.length !== 1) {
      if (exact.length > 1) {
        return Object.freeze({
          localAssignmentRef: assignment.localAssignmentRef,
          state: 'CONFLICT',
          remoteAssignmentRef: null,
          reasonCode: 'duplicate-remote-origin-assignment',
        })
      }
      const sameContent = remote.assignments.filter(
        (item) => item.kind === assignment.kind && item.contentRef === assignment.contentRef,
      )
      if (sameContent.length > 0) {
        return Object.freeze({
          localAssignmentRef: assignment.localAssignmentRef,
          state: 'CONFLICT',
          remoteAssignmentRef: null,
          reasonCode: 'remote-assignment-same-content-without-origin-proof',
        })
      }
      return Object.freeze({
        localAssignmentRef: assignment.localAssignmentRef,
        state: 'NEW_REMOTE_ASSIGNMENT',
        remoteAssignmentRef: null,
        reasonCode: null,
      })
    }
    const match = exact[0]!
    if (
      duplicateRemoteRefs.has(match.remoteAssignmentRef) ||
      match.kind !== assignment.kind ||
      match.contentRef !== assignment.contentRef
    ) {
      return Object.freeze({
        localAssignmentRef: assignment.localAssignmentRef,
        state: 'CONFLICT',
        remoteAssignmentRef: match.remoteAssignmentRef,
        reasonCode: 'remote-assignment-identity-mismatch',
      })
    }
    return Object.freeze({
      localAssignmentRef: assignment.localAssignmentRef,
      state: 'EXACT_MATCH',
      remoteAssignmentRef: match.remoteAssignmentRef,
      reasonCode: null,
    })
  })
}

function sessionPlan(
  local: LocalStudentForLink,
  remote: RemoteStudentSummary | null,
  assignments: readonly AssignmentLinkPlanItem[],
): readonly SessionLinkPlanItem[] {
  if (!remote) {
    return local.studyDocument.sessions.map((session) => Object.freeze({
      localSessionRef: session.localSessionRef,
      localAssignmentRef: session.localAssignmentRef,
      state: 'NEW_REMOTE_SESSION' as const,
      remoteSessionRef: null,
      reasonCode: null,
    }))
  }
  return local.studyDocument.sessions.map((session): SessionLinkPlanItem => {
    const assignment = assignments.find((item) => item.localAssignmentRef === session.localAssignmentRef)
    if (!assignment || assignment.state === 'CONFLICT') {
      return Object.freeze({
        localSessionRef: session.localSessionRef,
        localAssignmentRef: session.localAssignmentRef,
        state: 'CONFLICT',
        remoteSessionRef: null,
        reasonCode: 'session-assignment-conflict',
      })
    }
    const exact = remote.sessions.filter((item) => item.originLocalSessionRef === session.localSessionRef)
    if (exact.length > 1) {
      return Object.freeze({
        localSessionRef: session.localSessionRef,
        localAssignmentRef: session.localAssignmentRef,
        state: 'CONFLICT',
        remoteSessionRef: null,
        reasonCode: 'duplicate-remote-origin-session',
      })
    }
    if (exact.length === 1) {
      const match = exact[0]!
      if (
        match.lessonRef !== session.lessonRef ||
        (assignment.remoteAssignmentRef !== null && match.remoteAssignmentRef !== assignment.remoteAssignmentRef)
      ) {
        return Object.freeze({
          localSessionRef: session.localSessionRef,
          localAssignmentRef: session.localAssignmentRef,
          state: 'CONFLICT',
          remoteSessionRef: match.remoteSessionRef,
          reasonCode: 'remote-session-identity-mismatch',
        })
      }
      return Object.freeze({
        localSessionRef: session.localSessionRef,
        localAssignmentRef: session.localAssignmentRef,
        state: 'EXACT_MATCH',
        remoteSessionRef: match.remoteSessionRef,
        reasonCode: null,
      })
    }
    const ambiguous = assignment.remoteAssignmentRef === null
      ? []
      : remote.sessions.filter(
          (item) => item.remoteAssignmentRef === assignment.remoteAssignmentRef && item.lessonRef === session.lessonRef,
        )
    if (ambiguous.length > 0) {
      return Object.freeze({
        localSessionRef: session.localSessionRef,
        localAssignmentRef: session.localAssignmentRef,
        state: 'CONFLICT',
        remoteSessionRef: null,
        reasonCode: 'remote-session-same-assignment-without-origin-proof',
      })
    }
    return Object.freeze({
      localSessionRef: session.localSessionRef,
      localAssignmentRef: session.localAssignmentRef,
      state: 'NEW_REMOTE_SESSION',
      remoteSessionRef: null,
      reasonCode: null,
    })
  })
}

function conflictStudent(
  local: LocalStudentForLink,
  identityResolution: StudentLinkState,
  remoteStudentRef: string | null,
  candidates: readonly string[],
  reasonCode: string,
): StudentLinkPlanItem {
  return Object.freeze({
    localStudentRef: local.localStudentRef,
    displayName: local.displayName,
    state: 'CONFLICT',
    identityResolution,
    remoteStudentRef,
    candidateRemoteStudentRefs: Object.freeze([...candidates]),
    assignments: Object.freeze([]),
    sessions: Object.freeze([]),
    reasonCode,
  })
}

/**
 * Deterministic and deliberately name-blind. Display names are carried only so
 * a Parent can understand the plan; they never participate in matching.
 */
export function buildFirstLinkPlan(
  local: LocalHouseholdForLink,
  inspection: FirstLinkInspection,
  choices: readonly ExplicitStudentMappingChoice[] = [],
): FirstLinkPlan {
  const remoteByRef = new Map(inspection.remoteStudents.map((item) => [item.remoteStudentRef, item]))
  const choiceByLocal = new Map<string, ExplicitStudentMappingChoice>()
  const duplicatedChoices = new Set<string>()
  const localRefs = new Set(local.students.map((item) => item.localStudentRef))
  for (const choice of choices) {
    if (!localRefs.has(choice.localStudentRef)) {
      throw new Error(`Parent mapping choice names unknown local student ${choice.localStudentRef}.`)
    }
    if (choiceByLocal.has(choice.localStudentRef)) duplicatedChoices.add(choice.localStudentRef)
    choiceByLocal.set(choice.localStudentRef, choice)
  }

  const exactByLocal = new Map<string, readonly RemoteStudentSummary[]>()
  for (const student of local.students) {
    exactByLocal.set(student.localStudentRef, inspection.remoteStudents.filter((remote) =>
      remote.identities.some((identity) => sameIdentity(student.identity, identity)),
    ))
  }
  const claimedRemoteRefs = new Map<string, string[]>()
  for (const student of local.students) {
    const exact = exactByLocal.get(student.localStudentRef) ?? []
    const selected = exact.length === 1
      ? exact[0]!.remoteStudentRef
      : choiceByLocal.get(student.localStudentRef)?.remoteStudentRef
    if (selected === null || selected === undefined) continue
    claimedRemoteRefs.set(selected, [...(claimedRemoteRefs.get(selected) ?? []), student.localStudentRef])
  }

  const students = local.students.map((student): StudentLinkPlanItem => {
    const exact = exactByLocal.get(student.localStudentRef) ?? []
    const choice = choiceByLocal.get(student.localStudentRef)
    if (duplicatedChoices.has(student.localStudentRef)) {
      return conflictStudent(student, 'CONFLICT', null, [], 'duplicate-parent-mapping-choice')
    }
    if (exact.length > 1) {
      return conflictStudent(
        student,
        'CONFLICT',
        null,
        exact.map((item) => item.remoteStudentRef).sort(),
        'stable-identity-matches-multiple-remote-students',
      )
    }

    let identityResolution: StudentLinkState
    let remote: RemoteStudentSummary | null = null
    if (exact.length === 1) {
      remote = exact[0]!
      identityResolution = 'EXACT_MATCH'
      if (choice && choice.remoteStudentRef !== remote.remoteStudentRef) {
        return conflictStudent(
          student,
          identityResolution,
          remote.remoteStudentRef,
          [],
          'parent-choice-cannot-override-stable-identity',
        )
      }
    } else if (choice) {
      if (choice.remoteStudentRef === null) {
        identityResolution = 'NEW_REMOTE_STUDENT'
      } else {
        remote = remoteByRef.get(choice.remoteStudentRef) ?? null
        if (!remote) {
          return conflictStudent(student, 'CONFLICT', null, [], 'parent-choice-names-unknown-remote-student')
        }
        identityResolution = 'EXACT_MATCH'
      }
    } else {
      const candidates = inspection.remoteStudents
        .filter((item) => !(claimedRemoteRefs.get(item.remoteStudentRef)?.length))
        .map((item) => item.remoteStudentRef)
        .sort()
      if (candidates.length > 0) {
        return Object.freeze({
          localStudentRef: student.localStudentRef,
          displayName: student.displayName,
          state: 'EXPLICIT_MAP_REQUIRED',
          identityResolution: 'EXPLICIT_MAP_REQUIRED',
          remoteStudentRef: null,
          candidateRemoteStudentRefs: Object.freeze(candidates),
          assignments: Object.freeze([]),
          sessions: Object.freeze([]),
          reasonCode: 'no-stable-identity-match',
        })
      }
      identityResolution = 'NEW_REMOTE_STUDENT'
    }

    if (remote && (claimedRemoteRefs.get(remote.remoteStudentRef)?.length ?? 0) > 1) {
      return conflictStudent(
        student,
        identityResolution,
        remote.remoteStudentRef,
        [],
        'remote-student-selected-more-than-once',
      )
    }
    if (remote && (
      hasDuplicateRefs(remote.assignments, (item) => item.remoteAssignmentRef) ||
      hasDuplicateRefs(remote.sessions, (item) => item.remoteSessionRef)
    )) {
      return conflictStudent(
        student,
        identityResolution,
        remote.remoteStudentRef,
        [],
        'duplicate-remote-state-identity',
      )
    }
    const assignments = assignmentPlan(student, remote)
    const sessions = sessionPlan(student, remote, assignments)
    const downstreamConflict = assignments.some((item) => item.state === 'CONFLICT') ||
      sessions.some((item) => item.state === 'CONFLICT')
    return Object.freeze({
      localStudentRef: student.localStudentRef,
      displayName: student.displayName,
      state: downstreamConflict ? 'CONFLICT' : identityResolution,
      identityResolution,
      remoteStudentRef: remote?.remoteStudentRef ?? null,
      candidateRemoteStudentRefs: Object.freeze([]),
      assignments: byRef(assignments, (item) => item.localAssignmentRef),
      sessions: byRef(sessions, (item) => item.localSessionRef),
      reasonCode: downstreamConflict ? 'remote-state-conflict' : null,
    })
  })

  return Object.freeze({
    planVersion: 1,
    localHouseholdRef: local.localHouseholdRef,
    remoteHouseholdRef: inspection.authority.remoteHouseholdRef,
    authorityRef: inspection.authority.authorityRef,
    serverBaseRevision: inspection.serverBaseRevision,
    students: byRef(students, (item) => item.localStudentRef),
    readyForParentConfirmation: students.every(
      (item) => item.state === 'EXACT_MATCH' || item.state === 'NEW_REMOTE_STUDENT',
    ),
  })
}
