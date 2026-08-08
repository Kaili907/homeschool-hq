import {
  isCanonicalIntegerMicros,
  type AdminCostKind,
  type AdminHealthState,
  type IntegerMicros,
} from './admin0Vocabulary'
import type {
  AdminOverviewModel,
  AuthorizationReasonCode,
  EngineObservation,
  EngineReasonCode,
  Metric,
  OverviewErrorCode,
  OverviewRange,
  OverviewStaleReasonCode,
  PresentedSpend,
} from './overviewModel'

export type EvidenceCountSource =
  | { readonly evidence: 'complete'; readonly value: number }
  | { readonly evidence: 'incomplete' }
  | { readonly evidence: 'unavailable' }

export interface CostSource {
  readonly costMicros: IntegerMicros | null
  readonly costKind: AdminCostKind
  readonly currency: 'USD'
}

export interface AdminOverviewSource {
  readonly range: OverviewRange
  readonly observedAt: string
  readonly freshness: 'current' | 'stale'
  readonly staleReasonCode?: OverviewStaleReasonCode
  readonly academy: {
    readonly environment: string | null
    readonly appVersion: string | null
    readonly curriculumVersion: string | null
    readonly overallHealth: AdminHealthState | null
    readonly lastSuccessfulDataRefresh: string | null
  }
  readonly learners: {
    readonly activeLearners: number | null
    readonly lessonsStarted: number | null
    readonly lessonsCompleted: number | null
    readonly studySessions: number | null
    readonly instructionalMinutes: number | null
  }
  readonly engines: readonly EngineObservation[]
  readonly ai: {
    /** Null means trustworthy aggregate usage was not available, never zero. */
    readonly requests: number | null
    readonly inputTokens: number | null
    readonly outputTokens: number | null
    readonly ttsCharacters: number | null
    readonly spend: CostSource
  }
  readonly safety: {
    readonly openSafetyStops: EvidenceCountSource
    readonly adultReviewsPending: EvidenceCountSource
    readonly safeguardFailures: EvidenceCountSource
  }
  readonly system: {
    /** Null means operational evidence is absent/incomplete, so health is unknown. */
    readonly apiErrorRatePercent: number | null
    readonly latencyMs: number | null
    readonly syncFailures: number | null
    readonly persistenceFailures: number | null
  }
}

export const AUTHORIZATION_MESSAGES: Readonly<Record<AuthorizationReasonCode, string>> = {
  admin_assignment_required: 'Your account does not have an active Admin assignment.',
  authorization_unavailable: 'Administrator authorization could not be verified.',
  overview_read_required: 'Your Admin role does not include overview access.',
}

export const OVERVIEW_ERROR_MESSAGES: Readonly<Record<OverviewErrorCode, string>> = {
  overview_timeout: 'The overview request timed out. Try again shortly.',
  overview_unavailable: 'Operational data is temporarily unavailable.',
  refresh_failed: 'The latest overview refresh could not be completed.',
}

export const STALE_MESSAGES: Readonly<Record<OverviewStaleReasonCode, string>> = {
  refresh_delayed: 'The latest refresh is delayed.',
  refresh_failed: 'The latest refresh did not complete.',
  telemetry_incomplete: 'Current operational evidence is incomplete.',
}

export const ENGINE_REASON_MESSAGES: Readonly<Record<EngineReasonCode, string>> = {
  elevated_latency: 'Elevated latency',
  feature_disabled: 'Disabled by approved configuration',
  partial_dependency_loss: 'Partial dependency loss',
  persistence_unavailable: 'Persistence unavailable',
  provider_error: 'Provider error',
  provider_timeout: 'Provider timeout',
  sync_conflict: 'Sync conflict requires review',
  telemetry_incomplete: 'Operational evidence incomplete',
}

export function safeAuthorizationMessage(code: AuthorizationReasonCode): string {
  return AUTHORIZATION_MESSAGES[code] ?? 'Administrator access is unavailable.'
}

export function safeOverviewErrorMessage(code: OverviewErrorCode): string {
  return OVERVIEW_ERROR_MESSAGES[code] ?? 'Operational data is temporarily unavailable.'
}

export function safeStaleMessage(code: OverviewStaleReasonCode | undefined): string {
  return code ? STALE_MESSAGES[code] ?? 'Current operational evidence is incomplete.' : 'Current operational evidence is incomplete.'
}

export function safeEngineReasonMessage(code: string): string {
  return ENGINE_REASON_MESSAGES[code as EngineReasonCode] ?? 'Additional operational detail is unavailable.'
}

export function adaptVersion(value: string | null): Metric<string> {
  return value === null ? { status: 'unknown' } : { status: 'available', value }
}

export function adaptLastSuccessfulRefresh(value: string | null): Metric<string> {
  return value === null ? { status: 'unavailable' } : { status: 'available', value }
}

export function adaptLearnerMetric(value: number | null): Metric<number> {
  return value === null ? { status: 'unavailable' } : { status: 'available', value }
}

export function adaptUsageMetric(value: number | null): Metric<number> {
  return value === null ? { status: 'unknown' } : { status: 'available', value }
}

export function adaptSystemMetric(value: number | null): Metric<number> {
  return value === null ? { status: 'unknown' } : { status: 'available', value }
}

export function adaptSafetyMetric(source: EvidenceCountSource): Metric<number> {
  if (source.evidence === 'complete') return { status: 'available', value: source.value }
  return { status: source.evidence === 'incomplete' ? 'unknown' : 'unavailable' }
}

export function adaptCost(source: CostSource): Metric<PresentedSpend> {
  if (source.costKind === 'unavailable') return { status: 'unavailable' }
  if (source.costMicros === null || !isCanonicalIntegerMicros(source.costMicros)) {
    return { status: 'unknown' }
  }
  return {
    status: 'available',
    value: { costMicros: source.costMicros, costKind: source.costKind },
  }
}

/** Exact, half-up cents presentation without converting integer micros to Number. */
export function formatUsdMicros(value: IntegerMicros): string {
  if (!isCanonicalIntegerMicros(value)) throw new Error('Invalid canonical IntegerMicros value.')
  const roundedCents = (BigInt(value) + 5_000n) / 10_000n
  const dollars = roundedCents / 100n
  const cents = (roundedCents % 100n).toString().padStart(2, '0')
  const groupedDollars = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `$${groupedDollars}.${cents}`
}

export function adaptAdminOverview(source: AdminOverviewSource): AdminOverviewModel {
  return {
    range: source.range,
    observedAt: source.observedAt,
    freshness: source.freshness,
    staleReasonCode: source.staleReasonCode,
    academy: {
      environment: adaptVersion(source.academy.environment),
      appVersion: adaptVersion(source.academy.appVersion),
      curriculumVersion: adaptVersion(source.academy.curriculumVersion),
      overallHealth: source.academy.overallHealth === null
        ? { status: 'unknown' }
        : { status: 'available', value: source.academy.overallHealth },
      lastSuccessfulDataRefresh: adaptLastSuccessfulRefresh(source.academy.lastSuccessfulDataRefresh),
    },
    learners: {
      activeLearners: adaptLearnerMetric(source.learners.activeLearners),
      lessonsStarted: adaptLearnerMetric(source.learners.lessonsStarted),
      lessonsCompleted: adaptLearnerMetric(source.learners.lessonsCompleted),
      studySessions: adaptLearnerMetric(source.learners.studySessions),
      instructionalMinutes: adaptLearnerMetric(source.learners.instructionalMinutes),
    },
    engines: source.engines,
    ai: {
      requests: adaptUsageMetric(source.ai.requests),
      inputTokens: adaptUsageMetric(source.ai.inputTokens),
      outputTokens: adaptUsageMetric(source.ai.outputTokens),
      ttsCharacters: adaptUsageMetric(source.ai.ttsCharacters),
      spend: adaptCost(source.ai.spend),
    },
    safety: {
      openSafetyStops: adaptSafetyMetric(source.safety.openSafetyStops),
      adultReviewsPending: adaptSafetyMetric(source.safety.adultReviewsPending),
      safeguardFailures: adaptSafetyMetric(source.safety.safeguardFailures),
    },
    system: {
      apiErrorRatePercent: adaptSystemMetric(source.system.apiErrorRatePercent),
      latencyMs: adaptSystemMetric(source.system.latencyMs),
      syncFailures: adaptSystemMetric(source.system.syncFailures),
      persistenceFailures: adaptSystemMetric(source.system.persistenceFailures),
    },
  }
}
