import type { StoredResult, StudyCalendarBlockRecord, StudyCalendarPort } from '../contracts/persistence'
import { authenticatedRpc, record, type StudySupabaseClient } from './supabaseShared'

export class SupabaseStudyCalendarAdapter implements StudyCalendarPort {
  constructor(private readonly client: StudySupabaseClient) {}

  async upsertCalendarBlock(
    block: StudyCalendarBlockRecord,
    expectedRevision: number,
    idempotencyKey: string,
  ): Promise<StoredResult> {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_upsert_adult_managed_record',
      {
        p_record_kind: 'calendar',
        p_record: {
          id: block.id,
          student_id: block.studentId,
          block_type: block.blockType,
          source_reference: block.sourceReference,
          scheduled_start: block.scheduledStart,
          intended_local_date: block.intendedLocalDate,
          explicit_offset: block.explicitOffset,
          duration_minutes: block.durationMinutes,
          completion_units: block.completionUnits,
          required_units: block.requiredUnits,
          resume_session_id: block.resumeSessionId,
          resume_segment_id: block.resumeSegmentId,
          state: block.state,
        },
        p_expected_revision: expectedRevision,
        p_idempotency_key: idempotencyKey,
      },
    )) as StoredResult
  }
}
