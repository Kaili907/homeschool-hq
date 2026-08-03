import type {
  StoredResult,
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

export class SupabaseStudyPersistenceAdapter implements StudyPersistencePort {
  constructor(private readonly client: StudySupabaseClient) {}

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
        },
        p_idempotency_key: idempotencyKey,
      },
    ))
    if (result.status === 'idempotency-collision') {
      return { status: 'idempotency-collision' as const }
    }
    return {
      status: 'created' as const,
      sessionId: stringValue(result.sessionId),
      revision: safeInteger(result.revision),
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
