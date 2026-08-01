import type { EventAppendResult, StudyEventLedgerPort } from '../contracts/persistence'
import { authenticatedRpc, record, type StudySupabaseClient } from './supabaseShared'

export class SupabaseStudyEventLedgerAdapter implements StudyEventLedgerPort {
  constructor(private readonly client: StudySupabaseClient) {}

  async appendAcceptedEvent(
    sessionId: string,
    eventId: string,
    eventVersion: number,
    idempotencyKey: string,
  ): Promise<EventAppendResult> {
    return record(await authenticatedRpc(
      this.client,
      'academy_study_append_event',
      {
        p_session_id: sessionId,
        p_event_id: eventId,
        p_event_version: eventVersion,
        p_idempotency_key: idempotencyKey,
      },
    )) as EventAppendResult
  }
}
