import type {
  StoredResult,
  StudyCurriculumBinding,
  StudyCurriculumBindingResult,
  StudyPersistencePort,
  StudySessionRecord,
} from '../contracts/persistence'
import {
  authenticatedRpc,
  record,
  safeInteger,
  stringValue,
  type StudySupabaseClient,
} from './supabaseShared'

const SHA256 = /^[0-9a-f]{64}$/
const RELEASE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PACKAGE_ID = /^[a-z0-9][a-z0-9-]{0,119}$/

function curriculumBinding(value: unknown): StudyCurriculumBindingResult {
  const result = record(value)
  if (result.schemaVersion !== 1) throw new TypeError('curriculum_binding_contract')
  if (result.status === 'bound') {
    const binding: StudyCurriculumBinding = {
      schemaVersion: 1,
      status: 'bound',
      releaseId: stringValue(result.releaseId),
      packageId: stringValue(result.packageId),
      releaseVersion: stringValue(result.releaseVersion),
      curriculumManifestSha256: stringValue(result.curriculumManifestSha256),
    }
    if (!UUID.test(binding.releaseId)
      || !PACKAGE_ID.test(binding.packageId)
      || !RELEASE_VERSION.test(binding.releaseVersion)
      || !SHA256.test(binding.curriculumManifestSha256)) {
      throw new TypeError('curriculum_binding_contract')
    }
    return Object.freeze(binding)
  }
  const reasons = new Set([
    'curriculum-release-missing',
    'curriculum-release-unsupported',
    'curriculum-release-unavailable',
    'curriculum-release-mismatch',
    'legacy-curriculum-binding-ambiguous',
    'study-session-unavailable',
  ])
  if ((result.status !== 'unavailable' && result.status !== 'manual-review')
    || typeof result.reasonCode !== 'string'
    || !reasons.has(result.reasonCode)) {
    throw new TypeError('curriculum_binding_contract')
  }
  return Object.freeze({
    schemaVersion: 1,
    status: result.status,
    reasonCode: result.reasonCode,
  }) as StudyCurriculumBindingResult
}

export class SupabaseStudyPersistenceAdapter implements StudyPersistencePort {
  constructor(private readonly client: StudySupabaseClient) {}

  async resolveCurriculumBinding(input: {
    studentId: string
    subjectId: string
    intendedLocalDate: string
    requestedReleaseVersion: string
  }) {
    return curriculumBinding(await authenticatedRpc(
      this.client,
      'academy_study_resolve_curriculum_binding_v1',
      {
        p_student_id: input.studentId,
        p_subject_id: input.subjectId,
        p_intended_local_date: input.intendedLocalDate,
        p_requested_release_version: input.requestedReleaseVersion,
      },
    ))
  }

  async createSession(session: StudySessionRecord, idempotencyKey: string) {
    const result = record(await authenticatedRpc(
      this.client,
      'academy_study_create_session',
      {
        p_session: {
          id: session.id,
          schema_version: session.schemaVersion,
          student_id: session.studentId,
          lesson_id: session.lessonId,
          subject_id: session.subjectId,
          study_plan_id: session.studyPlanId,
          state: session.state,
          started_at: session.startedAt,
          completed_at: session.completedAt,
          intended_local_date: session.intendedLocalDate,
          curriculum_release_version: session.curriculumReleaseVersion,
        },
        p_idempotency_key: idempotencyKey,
      },
    ))
    if (result.status === 'idempotency-collision') {
      return { status: 'idempotency-collision' as const }
    }
    if (result.status === 'unavailable' || result.status === 'manual-review') {
      return curriculumBinding(result) as Exclude<
        StudyCurriculumBindingResult,
        { status: 'bound' }
      >
    }
    if (result.status !== 'created') throw new TypeError('curriculum_binding_contract')
    const binding = curriculumBinding(result.curriculumBinding)
    if (binding.status !== 'bound') throw new TypeError('curriculum_binding_contract')
    return {
      status: 'created' as const,
      sessionId: stringValue(result.sessionId),
      revision: safeInteger(result.revision),
      curriculumBinding: binding,
    }
  }

  async transitionSession(input: {
    sessionId: string
    expectedRevision: number
    state: StudySessionRecord['state']
    completedAt: string | null
    idempotencyKey: string
  }): Promise<StoredResult> {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_transition_session',
      {
        p_session_id: input.sessionId,
        p_expected_revision: input.expectedRevision,
        p_state: input.state,
        p_completed_at: input.completedAt,
        p_idempotency_key: input.idempotencyKey,
      },
    )) as StoredResult
  }
}
