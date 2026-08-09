import {
  SupabaseStudyAdultPrivateAdapter,
  SupabaseStudyCalendarAdapter,
  SupabaseStudyCheckpointAdapter,
  SupabaseStudyEventLedgerAdapter,
  SupabaseStudyOutboxAdapter,
  SupabaseStudyParentSettingsAdapter,
  SupabaseStudyPersistenceAdapter,
  SupabaseStudyReviewQueueAdapter,
} from '../persistence'
import type { StudySupabaseClient } from '../persistence/supabaseShared'
import {
  SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES,
  createSession13DurableAcademicProductionPorts,
  type Session13DurableAcademicDependency,
  type Session13DurableAcademicProductionInput,
} from './durableAcademicProductionPorts'

export interface Session13ProductionAssemblyInput {
  readonly authenticatedClient: StudySupabaseClient
  /** Server-isolated client only; never construct this from browser credentials. */
  readonly trustedServerClient: StudySupabaseClient
  readonly health: Session13DurableAcademicProductionInput['health']
}

const IMPLEMENTATION_IDS = Object.freeze(Object.fromEntries(
  SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES.map((key) => [
    key,
    `academy-supabase:${key}:v1`,
  ]),
) as unknown as Readonly<Record<Session13DurableAcademicDependency, string>>)

/**
 * The one concrete Session 13 adapter-to-production-registry assembly path.
 *
 * ZERO CALLERS (STUDY-A1-PROD-DEAD-PRODUCER-RETIREMENT-C). It produces branded
 * production registry ports over `contracts/persistence`, which is a different
 * contract from the host `StudyPortBundle` in src/study/ports.ts despite the two
 * sharing slot and type names. Giving it a caller — in particular making it the
 * browser's port bundle — is an explicit review, not a refactor:
 * src/study/production/deadProducerBoundary.test.ts fails on both.
 */
export function createSession13ProductionAssembly(input: Session13ProductionAssemblyInput) {
  const adapters = Object.freeze({
    studySession: new SupabaseStudyPersistenceAdapter(input.authenticatedClient),
    checkpoint: new SupabaseStudyCheckpointAdapter(input.authenticatedClient),
    reviewQueue: new SupabaseStudyReviewQueueAdapter(input.authenticatedClient),
    calendar: new SupabaseStudyCalendarAdapter(input.authenticatedClient),
    parentSettings: new SupabaseStudyParentSettingsAdapter(input.authenticatedClient),
    adultPrivate: new SupabaseStudyAdultPrivateAdapter(input.authenticatedClient),
    eventLedger: new SupabaseStudyEventLedgerAdapter(input.authenticatedClient),
    outbox: new SupabaseStudyOutboxAdapter(input.trustedServerClient),
  })
  return Object.freeze({
    adapters,
    ports: createSession13DurableAcademicProductionPorts({
      adapters,
      implementationIds: IMPLEMENTATION_IDS,
      health: input.health,
    }),
  })
}
