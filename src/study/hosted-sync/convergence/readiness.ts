import type { HostedStudyLocalSyncState } from './syncMetadata'
import type { HostedStudySyncConfig } from './config'

export const HOSTED_STUDY_SYNC_READINESS_STATES = Object.freeze([
  'SYNC_DISABLED_LOCAL_ONLY',
  'SYNC_HEALTHY',
  'SYNC_OFFLINE_QUEUED',
  'SYNC_AUTH_REQUIRED',
  'SYNC_CONFLICT_REQUIRES_ATTENTION',
  'SYNC_SERVER_UNAVAILABLE',
] as const)

export type HostedStudySyncReadinessState = typeof HOSTED_STUDY_SYNC_READINESS_STATES[number]

export interface HostedStudySyncReadiness {
  readonly state: HostedStudySyncReadinessState
  /** Ordinary sync failure never disables a healthy local Study store. */
  readonly localStudyMayContinue: boolean
  readonly queuedOperationCount: number
}

export function evaluateHostedStudySyncReadiness(input: {
  readonly config: HostedStudySyncConfig
  readonly syncState: HostedStudyLocalSyncState | null
  readonly localStorageReady: boolean
}): HostedStudySyncReadiness {
  const queuedOperationCount = input.syncState?.queue.length ?? 0
  const state: HostedStudySyncReadinessState = input.config.status !== 'enabled'
    ? 'SYNC_DISABLED_LOCAL_ONLY'
    : input.syncState?.lastOutcome === 'AUTH_REQUIRED'
      ? 'SYNC_AUTH_REQUIRED'
      : input.syncState?.lastOutcome === 'CONFLICT'
        ? 'SYNC_CONFLICT_REQUIRES_ATTENTION'
        : input.syncState?.lastOutcome === 'SERVER_UNAVAILABLE'
          ? 'SYNC_SERVER_UNAVAILABLE'
          : queuedOperationCount > 0
            ? 'SYNC_OFFLINE_QUEUED'
            : 'SYNC_HEALTHY'
  return Object.freeze({
    state,
    localStudyMayContinue: input.localStorageReady,
    queuedOperationCount,
  })
}
