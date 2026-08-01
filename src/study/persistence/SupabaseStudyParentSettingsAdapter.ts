import type {
  StoredResult,
  StudyParentSettingsPort,
  StudyParentSettingsRecord,
} from '../contracts/persistence'
import { authenticatedRpc, record, type StudySupabaseClient } from './supabaseShared'

export class SupabaseStudyParentSettingsAdapter implements StudyParentSettingsPort {
  constructor(private readonly client: StudySupabaseClient) {}

  async upsertParentSettings(
    settings: StudyParentSettingsRecord,
    expectedRevision: number,
    idempotencyKey: string,
  ): Promise<StoredResult> {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_upsert_adult_managed_record',
      {
        p_record_kind: 'parent_settings',
        p_record: {
          student_id: settings.studentId,
          timer_mode: settings.timerMode,
          maximum_work_minutes: settings.maximumWorkMinutes,
          break_minimum_minutes: settings.breakMinimumMinutes,
          break_maximum_minutes: settings.breakMaximumMinutes,
          required_breaks: settings.requiredBreaks,
          reduced_motion: settings.reducedMotion,
          no_audio: settings.noAudio,
          large_text: settings.largeText,
          read_aloud: settings.readAloud,
          speech_input_allowed: settings.speechInputAllowed,
          parent_override: settings.parentOverride,
        },
        p_expected_revision: expectedRevision,
        p_idempotency_key: idempotencyKey,
      },
    )) as StoredResult
  }

  async effectiveSettings(studentId: string, effectiveDate?: string) {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_effective_settings',
      {
        p_student_id: studentId,
        p_effective_date: effectiveDate ?? new Date().toISOString().slice(0, 10),
      },
    ))
  }
}
