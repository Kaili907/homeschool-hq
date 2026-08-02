import type { StudyOutboxPort } from '../contracts/persistence'
import { record, trustedServerRpc, type StudySupabaseClient } from './supabaseShared'

/** Must only be constructed in a trusted server process; never bundle a service key. */
export class SupabaseStudyOutboxAdapter implements StudyOutboxPort {
  constructor(private readonly serverClient: StudySupabaseClient) {}

  async createAdultReviewProposal(input: Record<string, unknown>) {
    return record(await trustedServerRpc(
      this.serverClient,
      'academy_study_create_adult_review_proposal',
      { p_proposal: input },
    ))
  }

  async enqueue(input: Record<string, unknown>) {
    return record(await trustedServerRpc(
      this.serverClient,
      'academy_study_enqueue_outbox',
      { p_outbox: input },
    ))
  }

  async transition(input: Record<string, unknown>) {
    return record(await trustedServerRpc(
      this.serverClient,
      'academy_study_transition_outbox',
      { p_transition: input },
    ))
  }

  async status(outboxId: string) {
    const result = await trustedServerRpc(
      this.serverClient,
      'academy_study_outbox_status',
      { p_outbox_id: outboxId },
    )
    return result === null ? null : record(result)
  }
}
