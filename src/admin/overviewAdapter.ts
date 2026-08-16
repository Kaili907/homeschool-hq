import {
  ADMIN_CONTRACT_VERSION,
  isCanonicalIntegerMicros,
  type AdminBillingDisposition,
  type AdminCostKind,
  type AdminCurrency,
  type AdminHealthState,
  type AdminOperationalResult,
  type IntegerMicros,
} from './admin0Vocabulary'
import type {
  AggregateCompleteness,
  AdminOverviewModel,
  ApplicableMetric,
  AuthorizationReasonCode,
  CostResultReasonCode,
  EngineObservation,
  EngineReasonCode,
  Metric,
  OverviewErrorCode,
  OverviewRange,
  OverviewStaleReasonCode,
  PresentedSpend,
} from './overviewModel'
import { ADMIN_EXPANDED_RELEASE, type AdminReleaseReadModel } from './releaseDataModel'

export type EvidenceCountSource =
  | { readonly evidence: 'complete'; readonly value: number }
  | { readonly evidence: 'incomplete' }
  | { readonly evidence: 'unavailable' }

export type CurriculumVersionSource =
  | { readonly applicability: 'trusted'; readonly version: string }
  | { readonly applicability: 'not_applicable' }
  | { readonly applicability: 'unknown' }

export interface CostSource {
  readonly costMicros: IntegerMicros | null
  readonly costKind: AdminCostKind
  readonly billingDisposition: AdminBillingDisposition
  readonly currency: AdminCurrency
  readonly completeness: AggregateCompleteness
  readonly result: AdminOperationalResult
  readonly resultReasonCode: CostResultReasonCode | null
}

export interface AdminOverviewSource {
  readonly contractVersion: typeof ADMIN_CONTRACT_VERSION
  readonly range: OverviewRange
  readonly observedAt: string
  readonly freshness: 'current' | 'stale'
  readonly staleReasonCode?: OverviewStaleReasonCode
  readonly academy: {
    readonly environment: string | null
    /** Required immutable deployed build identifier from trusted context. */
    readonly appVersion: string
    readonly curriculumVersion: CurriculumVersionSource
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
    readonly cachedInputReadTokens: number | null
    readonly cachedInputWriteTokens: number | null
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

export const COST_REASON_MESSAGES: Readonly<Record<CostResultReasonCode, string>> = {
  attribution_incomplete: 'Some usage could not be attributed.',
  missing_effective_price: 'An effective price was unavailable.',
  missing_provider_usage: 'Trustworthy provider usage was unavailable.',
  provider_throttled: 'The provider throttled one or more requests.',
  provider_timeout: 'The provider outcome was not known before timeout.',
  reconciliation_conflict: 'Usage facts require reconciliation.',
  response_sanitization_rejected: 'A provider response did not pass validation.',
}

export const COMPLETENESS_MESSAGES: Readonly<Record<AggregateCompleteness, string>> = {
  complete: 'Recorded usage has no known attribution or usage-quantity limitation.',
  partial_attribution_ambiguous: 'Aggregate is partial because some household attribution was ambiguous.',
  partial_attribution_unresolved: 'Aggregate is partial because some attribution could not be resolved.',
  partial_usage_unavailable: 'Aggregate is partial because some trustworthy usage was unavailable.',
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

export function safeCostReasonMessage(code: string | null): string | null {
  if (code === null) return null
  return COST_REASON_MESSAGES[code as CostResultReasonCode] ?? 'Additional cost detail is unavailable.'
}

export function safeCompletenessMessage(completeness: AggregateCompleteness): string {
  return COMPLETENESS_MESSAGES[completeness] ?? 'Aggregate completeness could not be established.'
}

export function adaptVersion(value: string | null): Metric<string> {
  return value === null ? { status: 'unknown' } : { status: 'available', value }
}

export function adaptCurriculumVersion(source: CurriculumVersionSource): ApplicableMetric<string> {
  if (source.applicability === 'trusted') return { status: 'available', value: source.version }
  return { status: source.applicability === 'not_applicable' ? 'not_applicable' : 'unknown' }
}

export function adaptLastSuccessfulRefresh(value: string | null): Metric<string> {
  return value === null ? { status: 'unavailable' } : { status: 'available', value }
}

export function adaptLearnerMetric(value: number | null): Metric<number> {
  return value === null ? { status: 'unavailable' } : { status: 'available', value }
}

export function adaptUsageMetric(value: number | null): Metric<number> {
  if (value === null || !Number.isSafeInteger(value) || value < 0) return { status: 'unknown' }
  return { status: 'available', value }
}

export function adaptSystemMetric(value: number | null): Metric<number> {
  return value === null ? { status: 'unknown' } : { status: 'available', value }
}

export function adaptSafetyMetric(source: EvidenceCountSource): Metric<number> {
  if (source.evidence === 'complete') return { status: 'available', value: source.value }
  return { status: source.evidence === 'incomplete' ? 'unknown' : 'unavailable' }
}

export function adaptCost(source: CostSource): PresentedSpend {
  const context = {
    billingDisposition: source.billingDisposition,
    currency: source.currency,
    completeness: source.completeness,
    result: source.result,
    resultReasonCode: source.resultReasonCode,
  }
  if (source.costKind === 'unavailable') {
    return source.costMicros === null
      ? { ...context, status: 'unavailable', costKind: 'unavailable' }
      : { ...context, status: 'unknown', costKind: 'unavailable' }
  }
  if (
    source.costMicros === null
    || !isCanonicalIntegerMicros(source.costMicros)
    || source.billingDisposition === 'unknown'
    || (source.billingDisposition === 'not_billable' && source.costMicros !== '0')
  ) {
    return { ...context, status: 'unknown', costKind: source.costKind }
  }
  return { ...context, status: 'available', costMicros: source.costMicros, costKind: source.costKind }
}

/** Exact, half-up cents presentation without converting integer micros to Number. */
export function formatUsdMicros(value: IntegerMicros, currency: AdminCurrency): string {
  if (currency !== 'USD') throw new Error('Unsupported Admin currency.')
  if (!isCanonicalIntegerMicros(value)) throw new Error('Invalid canonical IntegerMicros value.')
  const roundedCents = (BigInt(value) + 5_000n) / 10_000n
  const dollars = roundedCents / 100n
  const cents = (roundedCents % 100n).toString().padStart(2, '0')
  const groupedDollars = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `$${groupedDollars}.${cents}`
}

export function adaptAdminOverview(
  source: AdminOverviewSource,
  release: AdminReleaseReadModel = ADMIN_EXPANDED_RELEASE,
): AdminOverviewModel {
  return {
    contractVersion: source.contractVersion,
    range: source.range,
    observedAt: source.observedAt,
    freshness: source.freshness,
    staleReasonCode: source.staleReasonCode,
    academy: {
      environment: adaptVersion(source.academy.environment),
      appVersion: { status: 'available', value: source.academy.appVersion },
      curriculumVersion: adaptCurriculumVersion(source.academy.curriculumVersion),
      overallHealth: source.academy.overallHealth === null
        ? { status: 'unknown' }
        : { status: 'available', value: source.academy.overallHealth },
      lastSuccessfulDataRefresh: adaptLastSuccessfulRefresh(source.academy.lastSuccessfulDataRefresh),
      release,
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
      cachedInputReadTokens: adaptUsageMetric(source.ai.cachedInputReadTokens),
      cachedInputWriteTokens: adaptUsageMetric(source.ai.cachedInputWriteTokens),
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
