import type { StoredResult, StudyReviewQueuePort, StudyReviewRecord } from '../contracts/persistence'
import { authenticatedRpc, record, type StudySupabaseClient } from './supabaseShared'

export class SupabaseStudyReviewQueueAdapter implements StudyReviewQueuePort {
  constructor(private readonly client: StudySupabaseClient) {}

  async upsertReview(
    review: StudyReviewRecord,
    expectedRevision: number,
    idempotencyKey: string,
  ): Promise<StoredResult> {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_upsert_adult_managed_record',
      {
        p_record_kind: 'review',
        p_record: {
          id: review.id,
          student_id: review.studentId,
          skill_id: review.skillId,
          source_session_id: review.sourceSessionId,
          review_kind: review.reviewKind,
          due_at: review.dueAt,
          intended_local_date: review.intendedLocalDate,
          priority: review.priority,
          state: review.state,
          attempt_count: review.attemptCount,
          interval_days: review.intervalDays,
          reteaching_required: review.reteachingRequired,
          prerequisite_remediation_required:
            review.prerequisiteRemediationRequired,
        },
        p_expected_revision: expectedRevision,
        p_idempotency_key: idempotencyKey,
      },
    )) as StoredResult
  }
}
