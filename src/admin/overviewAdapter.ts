import type { AdminOverviewModel, EngineStatus, Metric, OverallHealth, OverviewRange } from './overviewModel'

export type SourceMetric<T> = T | null | undefined

/** Narrow transport shape. null means unavailable; omitted means unknown. */
export interface AdminOverviewSource {
  readonly range: OverviewRange
  readonly freshness: 'current' | 'stale'
  readonly staleReason?: string
  readonly academy: {
    readonly environment?: string | null
    readonly appVersion?: string | null
    readonly curriculumVersion?: string | null
    readonly overallHealth?: OverallHealth | null
    readonly lastSuccessfulDataRefresh?: string | null
  }
  readonly learners: {
    readonly activeLearners?: number | null
    readonly lessonsStarted?: number | null
    readonly lessonsCompleted?: number | null
    readonly studySessions?: number | null
    readonly instructionalMinutes?: number | null
  }
  readonly engines: readonly EngineStatus[]
  readonly ai: {
    readonly requests?: number | null
    readonly inputTokens?: number | null
    readonly outputTokens?: number | null
    readonly ttsCharacters?: number | null
    readonly spend?: { readonly amountUsd: number; readonly basis: 'calculated' | 'estimated' } | null
  }
  readonly safety: {
    readonly openSafetyStops?: number | null
    readonly adultReviewsPending?: number | null
    readonly safeguardFailures?: number | null
  }
  readonly system: {
    readonly apiErrorRatePercent?: number | null
    readonly latencyMs?: number | null
    readonly syncFailures?: number | null
    readonly persistenceFailures?: number | null
  }
}

export function adaptSourceMetric<T>(value: SourceMetric<T>): Metric<T> {
  if (value === undefined) return { status: 'unknown' }
  if (value === null) return { status: 'unavailable' }
  return { status: 'available', value }
}

export function adaptAdminOverview(source: AdminOverviewSource): AdminOverviewModel {
  return {
    range: source.range,
    freshness: source.freshness,
    staleReason: source.staleReason,
    academy: {
      environment: adaptSourceMetric(source.academy.environment),
      appVersion: adaptSourceMetric(source.academy.appVersion),
      curriculumVersion: adaptSourceMetric(source.academy.curriculumVersion),
      overallHealth: adaptSourceMetric(source.academy.overallHealth),
      lastSuccessfulDataRefresh: adaptSourceMetric(source.academy.lastSuccessfulDataRefresh),
    },
    learners: {
      activeLearners: adaptSourceMetric(source.learners.activeLearners),
      lessonsStarted: adaptSourceMetric(source.learners.lessonsStarted),
      lessonsCompleted: adaptSourceMetric(source.learners.lessonsCompleted),
      studySessions: adaptSourceMetric(source.learners.studySessions),
      instructionalMinutes: adaptSourceMetric(source.learners.instructionalMinutes),
    },
    engines: source.engines,
    ai: {
      requests: adaptSourceMetric(source.ai.requests),
      inputTokens: adaptSourceMetric(source.ai.inputTokens),
      outputTokens: adaptSourceMetric(source.ai.outputTokens),
      ttsCharacters: adaptSourceMetric(source.ai.ttsCharacters),
      spend: adaptSourceMetric(source.ai.spend),
    },
    safety: {
      openSafetyStops: adaptSourceMetric(source.safety.openSafetyStops),
      adultReviewsPending: adaptSourceMetric(source.safety.adultReviewsPending),
      safeguardFailures: adaptSourceMetric(source.safety.safeguardFailures),
    },
    system: {
      apiErrorRatePercent: adaptSourceMetric(source.system.apiErrorRatePercent),
      latencyMs: adaptSourceMetric(source.system.latencyMs),
      syncFailures: adaptSourceMetric(source.system.syncFailures),
      persistenceFailures: adaptSourceMetric(source.system.persistenceFailures),
    },
  }
}
