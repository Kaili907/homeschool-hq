import type {
  AdminBillingDisposition,
  AdminCapability,
  AdminCostKind,
  AdminCurrency,
  AdminEngineId,
  AdminHealthState,
  AdminOperationalResult,
  AdminRole,
  IntegerMicros,
} from './admin0Vocabulary'

export const ADMIN_SECTIONS = [
  'overview',
  'learners',
  'engines',
  'costs',
  'curriculum',
  'safety',
  'system-health',
  'configuration',
  'audit-log',
  'access',
  'releases',
] as const

export type AdminSection = (typeof ADMIN_SECTIONS)[number]

export const OVERVIEW_PRESETS = ['today', '7-days', '30-days', 'school-year'] as const
export type OverviewPreset = (typeof OVERVIEW_PRESETS)[number]

export type OverviewRange =
  | { readonly kind: 'preset'; readonly preset: OverviewPreset }
  | { readonly kind: 'custom'; readonly start: string; readonly end: string }

export type Metric<T> =
  | { readonly status: 'available'; readonly value: T }
  | { readonly status: 'unavailable' }
  | { readonly status: 'unknown' }

export type ApplicableMetric<T> = Metric<T> | { readonly status: 'not_applicable' }

export type EngineReasonCode =
  | 'elevated_latency'
  | 'feature_disabled'
  | 'partial_dependency_loss'
  | 'persistence_unavailable'
  | 'provider_error'
  | 'provider_timeout'
  | 'sync_conflict'
  | 'telemetry_incomplete'

export interface EngineObservation {
  readonly engineId: AdminEngineId
  readonly health: AdminHealthState
  readonly appVersion: string | null
  /** Null means no independently versioned engine legitimately applies. */
  readonly engineVersion: string | null
  readonly observedAt: string | null
  readonly windowStart: string
  readonly windowEnd: string
  readonly reasonCodes: readonly EngineReasonCode[]
}

export type CostResultReasonCode =
  | 'attribution_incomplete'
  | 'missing_effective_price'
  | 'missing_provider_usage'
  | 'provider_throttled'
  | 'provider_timeout'
  | 'reconciliation_conflict'
  | 'response_sanitization_rejected'

export type AggregateCompleteness =
  | 'complete'
  | 'partial_attribution_ambiguous'
  | 'partial_attribution_unresolved'
  | 'partial_usage_unavailable'

interface SpendContext {
  readonly billingDisposition: AdminBillingDisposition
  readonly currency: AdminCurrency
  readonly completeness: AggregateCompleteness
  readonly result: AdminOperationalResult | null
  readonly resultReasonCode: CostResultReasonCode | null
}

export type PresentedSpend =
  | SpendContext & {
      readonly status: 'available'
      readonly costMicros: IntegerMicros
      readonly costKind: Exclude<AdminCostKind, 'unavailable'>
    }
  | SpendContext & { readonly status: 'unavailable'; readonly costKind: 'unavailable' }
  | SpendContext & { readonly status: 'unknown'; readonly costKind: AdminCostKind }

export interface AdminOverviewModel {
  readonly contractVersion: 2
  readonly range: OverviewRange
  /** Canonical observation time for this overview, separate from refresh history. */
  readonly observedAt: string | null
  readonly freshness: 'current' | 'stale'
  readonly staleReasonCode?: OverviewStaleReasonCode
  readonly academy: {
    readonly environment: Metric<string>
    readonly appVersion: Metric<string>
    readonly curriculumVersion: ApplicableMetric<string>
    readonly overallHealth: Metric<AdminHealthState>
    readonly lastSuccessfulDataRefresh: Metric<string>
  }
  readonly learners: {
    readonly activeLearners: Metric<number>
    readonly lessonsStarted: Metric<number>
    readonly lessonsCompleted: Metric<number>
    readonly studySessions: Metric<number>
    readonly instructionalMinutes: Metric<number>
  }
  readonly engines: readonly EngineObservation[]
  readonly ai: {
    readonly requests: Metric<number>
    readonly inputTokens: Metric<number>
    readonly outputTokens: Metric<number>
    readonly cachedInputReadTokens: Metric<number>
    readonly cachedInputWriteTokens: Metric<number>
    readonly ttsCharacters: Metric<number>
    readonly spend: PresentedSpend
    readonly reconciledSpend?: PresentedSpend
  }
  readonly safety: {
    readonly openSafetyStops: Metric<number>
    readonly adultReviewsPending: Metric<number>
    readonly safeguardFailures: Metric<number>
  }
  readonly system: {
    readonly apiErrorRatePercent: Metric<number>
    readonly latencyMs: Metric<number>
    readonly syncFailures: Metric<number>
    readonly persistenceFailures: Metric<number>
  }
  readonly curriculum?: {
    readonly publishedVersion: Metric<string>
    readonly validationState: Metric<string>
    readonly validatedAt: Metric<string>
    readonly validationArtifactVersion: Metric<string>
    readonly coverageWarning: Metric<string>
  }
  readonly enginePerformance?: readonly {
    readonly engineId: AdminEngineId
    readonly evidenceState: 'available' | 'partial' | 'insufficient_evidence' | 'unavailable'
  }[]
  readonly domainStatuses?: Readonly<Record<OverviewDomain, OverviewDomainStatus>>
}

export type OverviewDomain =
  | 'academy'
  | 'learners'
  | 'engineHealth'
  | 'enginePerformance'
  | 'costs'
  | 'safety'
  | 'system'
  | 'curriculum'

export interface OverviewDomainStatus {
  readonly availability: 'available' | 'unavailable'
  readonly freshness: 'current' | 'stale' | 'unknown'
  readonly completeness: 'complete' | 'partial' | 'truncated' | 'unknown'
  readonly observationStatus: 'current' | 'stale' | 'partial' | 'unavailable' | 'unknown'
  readonly windowLabel: string
}

export type OverviewErrorCode = 'overview_timeout' | 'overview_unavailable' | 'refresh_failed'
export type OverviewStaleReasonCode = 'refresh_delayed' | 'refresh_failed' | 'telemetry_incomplete'
export type AuthorizationReasonCode =
  | 'admin_assignment_required'
  | 'authorization_unavailable'
  | 'overview_read_required'

export type OverviewLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly model: AdminOverviewModel }
  | { readonly status: 'error'; readonly code: OverviewErrorCode }

export type ServerResolvedAdminAuthorization =
  | { readonly status: 'resolving' }
  | { readonly status: 'unauthorized'; readonly reasonCode: AuthorizationReasonCode }
  | {
      readonly status: 'authorized'
      readonly role: AdminRole
      readonly capabilities: readonly AdminCapability[]
    }

/**
 * Sensitive data is structurally absent before server authorization resolves.
 * The component also checks overview:read at render time; this remains defense
 * in depth and never replaces ADMIN-1's server/API authorization boundary.
 */
export type AdminConsoleProps =
  | { readonly authorization: Extract<ServerResolvedAdminAuthorization, { status: 'resolving' }> }
  | { readonly authorization: Extract<ServerResolvedAdminAuthorization, { status: 'unauthorized' }> }
  | {
      readonly authorization: Extract<ServerResolvedAdminAuthorization, { status: 'authorized' }>
      readonly overview: OverviewLoadState
      readonly selectedRange: OverviewRange
      readonly onRangeChange: (range: OverviewRange) => void
      readonly onRetry?: () => void
      readonly onNavigate?: (section: AdminSection) => void
    }

export function hasOverviewReadCapability(authorization: ServerResolvedAdminAuthorization): boolean {
  return authorization.status === 'authorized'
    && authorization.capabilities.includes('overview:read')
}

export function validateCustomRange(start: string, end: string): string | null {
  if (!start || !end) return 'Choose both a start and end date.'
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }
  if (!validDate(start) || !validDate(end)) return 'Enter valid calendar dates.'
  if (start > end) return 'Start date must be on or before end date.'
  return null
}

export function movePresetSelection(
  current: OverviewPreset,
  key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End',
): OverviewPreset {
  if (key === 'Home') return OVERVIEW_PRESETS[0]
  if (key === 'End') return OVERVIEW_PRESETS[OVERVIEW_PRESETS.length - 1]
  const index = OVERVIEW_PRESETS.indexOf(current)
  const offset = key === 'ArrowLeft' ? -1 : 1
  return OVERVIEW_PRESETS[(index + offset + OVERVIEW_PRESETS.length) % OVERVIEW_PRESETS.length]
}
