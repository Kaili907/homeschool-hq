import type {
  StudyAdultPrivatePort,
  StudyCalendarPort,
  StudyCheckpointPort,
  StudyEventLedgerPort,
  StudyOutboxPort,
  StudyParentSettingsPort,
  StudyPersistencePort,
  StudyReviewQueuePort,
} from '../contracts/persistence'
import {
  brandProductionPort,
  type BrandedProductionPort,
  type ProductionPortImplementation,
} from '../contracts/production/ports'
import {
  PRODUCTION_DEPENDENCY_SPECIFICATIONS,
  type ProductionDependencyKey,
  type StudyProductionReadinessState,
} from '../contracts/production/readiness'
import { STUDY_PRODUCTION_CONTRACT_VERSION } from '../contracts/production/versions'

export const SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES = Object.freeze([
  'study-session-adapter',
  'checkpoint-adapter',
  'review-queue',
  'calendar-adapter',
  'parent-settings-adapter',
  'adult-private-adapter',
  'event-ledger',
  'adult-review-proposal-store',
  'outbox-store',
] as const satisfies readonly ProductionDependencyKey[])

export type Session13DurableAcademicDependency =
  typeof SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES[number]

/** The eight durable Session 13 adapters; the outbox adapter serves two registry contracts. */
export interface Session13DurableAcademicAdapters {
  readonly studySession: StudyPersistencePort
  readonly checkpoint: StudyCheckpointPort
  readonly reviewQueue: StudyReviewQueuePort
  readonly calendar: StudyCalendarPort
  readonly parentSettings: StudyParentSettingsPort
  readonly adultPrivate: StudyAdultPrivatePort
  readonly eventLedger: StudyEventLedgerPort
  readonly outbox: StudyOutboxPort
}

export interface Session13DurableAcademicProductionInput {
  readonly adapters: Session13DurableAcademicAdapters
  readonly implementationIds: Readonly<Record<Session13DurableAcademicDependency, string>>
  /** Live probes are mandatory; this composer never treats configured as healthy. */
  readonly health: Readonly<Record<
    Session13DurableAcademicDependency,
    () => StudyProductionReadinessState
  >>
}

/**
 * Adapts the existing Session 13 durable RPC implementations into the one
 * canonical production registry contract. No preview or in-memory substitute
 * is constructed when an adapter or health probe is absent.
 */
export function createSession13DurableAcademicProductionPorts(
  input: Session13DurableAcademicProductionInput,
): readonly BrandedProductionPort<Session13DurableAcademicDependency>[] {
  const ports = {
    'study-session-adapter': input.adapters.studySession,
    'checkpoint-adapter': input.adapters.checkpoint,
    'review-queue': input.adapters.reviewQueue,
    'calendar-adapter': input.adapters.calendar,
    'parent-settings-adapter': input.adapters.parentSettings,
    'adult-private-adapter': input.adapters.adultPrivate,
    'event-ledger': input.adapters.eventLedger,
    'adult-review-proposal-store': input.adapters.outbox,
    'outbox-store': input.adapters.outbox,
  } as const

  return Object.freeze(SESSION_13_DURABLE_ACADEMIC_DEPENDENCIES.map((key) => {
    const specification = PRODUCTION_DEPENDENCY_SPECIFICATIONS[key]
    const implementation = {
      deployment: 'production',
      contractVersion: STUDY_PRODUCTION_CONTRACT_VERSION,
      implementationId: input.implementationIds[key],
      trustBoundary: specification.trustBoundary,
      durable: true,
      port: ports[key],
      readiness: input.health[key],
    } as ProductionPortImplementation<typeof key>
    return brandProductionPort(key, implementation)
  }))
}
