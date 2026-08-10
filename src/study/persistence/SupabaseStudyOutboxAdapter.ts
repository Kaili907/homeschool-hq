import type { StudyOutboxPort } from '../contracts/persistence'
import { record, trustedServerRpc, type StudySupabaseClient } from './supabaseShared'

/**
 * Must only be constructed in a trusted server process; never bundle a service key.
 *
 * NON-ROUTABLE (STUDY-A1-PROD-DEAD-PRODUCER-RETIREMENT-C). All four RPCs below
 * are revoked from every role by
 * 20260801012000_academy_study_engine_production_reconciliation.sql, which
 * replaced them with the attempt-bound `_v1` functions the Netlify adult-review
 * ports call. Kept for the durable Session 13 assembly's registry slots and for
 * migration compatibility; not retired, and not to be wired into any live path
 * without restoring a grant first. Held out of the browser bundle by
 * src/study/production/deadProducerBoundary.test.ts.
 */
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
