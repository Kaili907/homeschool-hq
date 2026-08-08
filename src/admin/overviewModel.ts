export const ADMIN_SECTIONS = [
  'overview',
  'learners',
  'engines',
  'ai-costs',
  'curriculum',
  'safety',
  'system-health',
  'configuration',
  'audit-log',
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
  | { readonly status: 'unavailable'; readonly reason?: string }
  | { readonly status: 'unknown'; readonly reason?: string }

export type EngineHealth = 'healthy' | 'degraded' | 'unavailable' | 'disabled' | 'unknown'
export type OverallHealth = Exclude<EngineHealth, 'disabled'>
export type EngineName = 'Tutor' | 'Study' | 'Assessment' | 'Jarvis' | 'TTS' | 'Sync'

export interface EngineStatus {
  readonly name: EngineName
  readonly health: EngineHealth
  readonly detail?: string
  readonly href?: string
}

export interface AdminOverviewModel {
  readonly range: OverviewRange
  readonly freshness: 'current' | 'stale'
  readonly staleReason?: string
  readonly academy: {
    readonly environment: Metric<string>
    readonly appVersion: Metric<string>
    readonly curriculumVersion: Metric<string>
    readonly overallHealth: Metric<OverallHealth>
    readonly lastSuccessfulDataRefresh: Metric<string>
  }
  readonly learners: {
    readonly activeLearners: Metric<number>
    readonly lessonsStarted: Metric<number>
    readonly lessonsCompleted: Metric<number>
    readonly studySessions: Metric<number>
    readonly instructionalMinutes: Metric<number>
  }
  readonly engines: readonly EngineStatus[]
  readonly ai: {
    readonly requests: Metric<number>
    readonly inputTokens: Metric<number>
    readonly outputTokens: Metric<number>
    readonly ttsCharacters: Metric<number>
    readonly spend: Metric<{ readonly amountUsd: number; readonly basis: 'calculated' | 'estimated' }>
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
}

export type OverviewLoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly model: AdminOverviewModel }
  | { readonly status: 'error'; readonly message: string }

/**
 * Authorization is deliberately discriminated so privileged overview data cannot
 * even be supplied to the shell until ADMIN-1 has produced an authorized result.
 */
export type AdminConsoleProps =
  | { readonly authorization: 'resolving' }
  | { readonly authorization: 'unauthorized'; readonly reason?: string }
  | {
      readonly authorization: 'authorized'
      readonly overview: OverviewLoadState
      readonly selectedRange: OverviewRange
      readonly onRangeChange: (range: OverviewRange) => void
      readonly onRetry?: () => void
      readonly onNavigate?: (section: AdminSection) => void
    }

export function validateCustomRange(start: string, end: string): string | null {
  if (!start || !end) return 'Choose both a start and end date.'
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }
  if (!validDate(start) || !validDate(end)) {
    return 'Enter valid calendar dates.'
  }
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
