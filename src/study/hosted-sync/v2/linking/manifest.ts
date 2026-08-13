import type {
  FirstLinkManifest,
  FirstLinkManifestAssignment,
  FirstLinkManifestSession,
  FirstLinkManifestStudent,
  FirstLinkPlan,
  LocalHouseholdForLink,
  ParentFirstLinkConfirmation,
} from './types'

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`
}

export async function sha256Digest(value: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Secure digest support is required for first-link import.')
  const bytes = new TextEncoder().encode(canonical(value))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, '0')).join('')
}

export async function digestFirstLinkPlan(
  plan: FirstLinkPlan,
  local: LocalHouseholdForLink,
): Promise<string> {
  return sha256Digest(Object.freeze({ plan, local }))
}

async function operationId(attemptId: string, path: readonly string[]): Promise<string> {
  const digest = await sha256Digest(Object.freeze([attemptId, ...path]))
  return `fl1_${digest.slice(0, 48)}`
}

export async function buildFirstLinkManifest(input: {
  readonly attemptId: string
  readonly plan: FirstLinkPlan
  readonly local: LocalHouseholdForLink
  readonly confirmation: ParentFirstLinkConfirmation
}): Promise<FirstLinkManifest> {
  if (!input.plan.readyForParentConfirmation) throw new Error('First-link plan is not resolved.')
  if (!input.confirmation.approved) throw new Error('Explicit Parent confirmation is required.')
  const expectedPlanDigest = await digestFirstLinkPlan(input.plan, input.local)
  if (input.confirmation.planDigest !== expectedPlanDigest) {
    throw new Error('Parent confirmation does not match the current first-link plan.')
  }
  if (
    input.plan.localHouseholdRef !== input.local.localHouseholdRef ||
    input.plan.students.length !== input.local.students.length
  ) throw new Error('First-link plan does not cover the exact local household snapshot.')

  const students: FirstLinkManifestStudent[] = []
  for (const localStudent of input.local.students) {
    const planned = input.plan.students.find((item) => item.localStudentRef === localStudent.localStudentRef)
    if (!planned || (planned.state !== 'EXACT_MATCH' && planned.state !== 'NEW_REMOTE_STUDENT')) {
      throw new Error(`Student ${localStudent.localStudentRef} is not resolved.`)
    }
    if (
      planned.assignments.length !== localStudent.assignments.length ||
      planned.sessions.length !== localStudent.studyDocument.sessions.length
    ) throw new Error(`Student ${localStudent.localStudentRef} plan coverage is incomplete.`)
    const assignments: FirstLinkManifestAssignment[] = []
    for (const assignment of localStudent.assignments) {
      const mapping = planned.assignments.find(
        (item) => item.localAssignmentRef === assignment.localAssignmentRef,
      )
      if (!mapping || mapping.state === 'CONFLICT') {
        throw new Error(`Assignment ${assignment.localAssignmentRef} is not resolved.`)
      }
      assignments.push(Object.freeze({
        operationId: await operationId(input.attemptId, [
          'student', localStudent.localStudentRef, 'assignment', assignment.localAssignmentRef,
        ]),
        kind: assignment.kind,
        localAssignmentRef: assignment.localAssignmentRef,
        contentRef: assignment.contentRef,
        title: assignment.title,
        subject: assignment.subject,
        state: assignment.state,
        completedAt: assignment.completedAt,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        progress: Object.freeze({
          completedSegmentRefs: Object.freeze([...assignment.progress.completedSegmentRefs]),
          totalSegments: assignment.progress.totalSegments,
          lastSegmentRef: assignment.progress.lastSegmentRef,
          activeSeconds: assignment.progress.activeSeconds,
        }),
        remoteAssignmentRef: mapping.remoteAssignmentRef,
        mapping: mapping.state,
      }))
    }
    const sessions: FirstLinkManifestSession[] = []
    for (const session of localStudent.studyDocument.sessions) {
      const mapping = planned.sessions.find((item) => item.localSessionRef === session.localSessionRef)
      if (!mapping || mapping.state === 'CONFLICT') {
        throw new Error(`Study session ${session.localSessionRef} is not resolved.`)
      }
      sessions.push(Object.freeze({
        operationId: await operationId(input.attemptId, [
          'student', localStudent.localStudentRef, 'session', session.localSessionRef,
        ]),
        localSessionRef: session.localSessionRef,
        localAssignmentRef: session.localAssignmentRef,
        blockRef: session.blockRef,
        lessonRef: session.lessonRef,
        status: session.status,
        segmentRef: session.segmentRef,
        updatedAt: session.updatedAt,
        lastAcceptedEventRef: session.lastAcceptedEventRef,
        checkpoint: session.checkpoint ? Object.freeze({
          checkpointRef: session.checkpoint.checkpointRef,
          revision: session.checkpoint.revision,
          capturedAt: session.checkpoint.capturedAt,
          completedSegmentRefs: Object.freeze([...session.checkpoint.completedSegmentRefs]),
          elapsedActiveSecondsInSegment: session.checkpoint.elapsedActiveSecondsInSegment,
        }) : null,
        remoteSessionRef: mapping.remoteSessionRef,
        mapping: mapping.state,
      }))
    }
    students.push(Object.freeze({
      operationId: await operationId(input.attemptId, ['student', localStudent.localStudentRef]),
      localStudentRef: localStudent.localStudentRef,
      remoteStudentRef: planned.remoteStudentRef,
      mapping: planned.state,
      displayName: localStudent.displayName,
      identity: Object.freeze({ kind: localStudent.identity.kind, value: localStudent.identity.value }),
      assignments: Object.freeze(assignments),
      studyDocument: Object.freeze({
        localDocumentRef: localStudent.studyDocument.localDocumentRef,
        updatedAt: localStudent.studyDocument.updatedAt,
        operationId: await operationId(input.attemptId, [
          'student', localStudent.localStudentRef, 'study-document', localStudent.studyDocument.localDocumentRef,
        ]),
        sessions: Object.freeze(sessions),
      }),
      sources: Object.freeze(await Promise.all(localStudent.sources.map(async (source) => Object.freeze({
        localSourceRef: source.localSourceRef,
        localAssignmentRef: source.localAssignmentRef,
        lessonRef: source.lessonRef,
        title: source.title,
        publisher: source.publisher,
        publishedAt: source.publishedAt,
        attachedAt: source.attachedAt,
        status: source.status,
        operationId: await operationId(input.attemptId, [
          'student', localStudent.localStudentRef, 'source', source.localSourceRef,
        ]),
      })))),
      attestations: Object.freeze(await Promise.all(localStudent.attestations.map(async (attestation) => Object.freeze({
        localAssignmentRef: attestation.localAssignmentRef,
        lessonRef: attestation.lessonRef,
        localSessionRef: attestation.localSessionRef,
        status: attestation.status,
        learnerAssertedAt: attestation.learnerAssertedAt,
        attestedAt: attestation.attestedAt,
        evidenceMode: attestation.evidenceMode,
        operationId: await operationId(input.attemptId, [
          'student', localStudent.localStudentRef, 'attestation',
          attestation.localAssignmentRef, attestation.localSessionRef,
        ]),
        authorityTreatment: 'authenticated-parent-import-receipt-required' as const,
      })))),
      safetyHolds: Object.freeze(await Promise.all(localStudent.safetyHolds.map(async (hold) => Object.freeze({
        localHoldRef: hold.localHoldRef,
        localSessionRef: hold.localSessionRef,
        createdAt: hold.createdAt,
        status: hold.status,
        reasonCode: hold.reasonCode,
        source: hold.source,
        acknowledgedAt: hold.acknowledgedAt,
        clearedAt: hold.clearedAt,
        operationId: await operationId(input.attemptId, [
          'student', localStudent.localStudentRef, 'safety-hold', hold.localHoldRef,
        ]),
      })))),
    }))
  }

  const withoutDigest = Object.freeze({
    manifestVersion: 1 as const,
    attemptId: input.attemptId,
    localSnapshotDigest: await sha256Digest(input.local),
    household: Object.freeze({
      operationId: await operationId(input.attemptId, ['household', input.local.localHouseholdRef]),
      localHouseholdRef: input.local.localHouseholdRef,
      remoteHouseholdRef: input.plan.remoteHouseholdRef,
      authorityRef: input.plan.authorityRef,
    }),
    serverBaseRevisionSeed: input.plan.serverBaseRevision,
    capturedAt: input.local.capturedAt,
    confirmation: input.confirmation,
    students: Object.freeze(students),
    rawAnswerIncluded: false as const,
    tutorTranscriptIncluded: false as const,
    pinIncluded: false as const,
    adultAnswerAuthorityIncluded: false as const,
  })
  const manifestDigest = await sha256Digest(withoutDigest)
  return Object.freeze({ ...withoutDigest, manifestDigest })
}

export function requiredOperationIds(manifest: FirstLinkManifest): readonly string[] {
  const ids = [manifest.household.operationId]
  for (const student of manifest.students) {
    ids.push(student.operationId, student.studyDocument.operationId)
    ids.push(...student.assignments.map((item) => item.operationId))
    ids.push(...student.studyDocument.sessions.map((item) => item.operationId))
    ids.push(...student.sources.map((item) => item.operationId))
    ids.push(...student.attestations.map((item) => item.operationId))
    ids.push(...student.safetyHolds.map((item) => item.operationId))
  }
  return Object.freeze([...ids].sort())
}
