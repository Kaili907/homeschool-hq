import type { AdminCapability } from './contracts'
import type { AdminCostsModel } from './costsModel'
import type { AdminRuntimeConfigurationProjection } from './configurationModel'
import type { LearnerAnalyticsSnapshot } from './learnerAnalyticsModel'
import type { ProductionReadinessProjection } from './productionReadinessModel'
import {
  safeSafetyReasonMessage,
  type SafetyOperationsSnapshotV1,
} from './safetyOperationsModel'
import type { SystemHealthProjection } from './systemHealth'

export const ADMIN_ATTENTION_DOMAINS = [
  'readiness',
  'health',
  'configuration',
  'learners',
  'safety',
  'costs',
] as const
export type AdminAttentionDomain = (typeof ADMIN_ATTENTION_DOMAINS)[number]

export const ADMIN_ATTENTION_SEVERITIES = [
  'critical',
  'high',
  'medium',
  'informational',
] as const
export type AdminAttentionSeverity = (typeof ADMIN_ATTENTION_SEVERITIES)[number]

export const ADMIN_ATTENTION_STATUSES = [
  'needs_attention',
  'blocked_unavailable',
  'warning',
  'informational',
] as const
export type AdminAttentionStatus = (typeof ADMIN_ATTENTION_STATUSES)[number]

export type AdminAttentionItemType =
  | 'production-readiness-gate'
  | 'system-health-state'
  | 'runtime-configuration-state'
  | 'learner-operational-flag'
  | 'safety-condition'
  | 'cost-accounting-state'
  | 'evidence-unavailable'

export interface AdminAttentionSourceAttribution {
  readonly id: string
  readonly label: string
}

export interface AdminAttentionItem {
  /** Stable bounded type and reference; this is not a persisted record. */
  readonly itemType: AdminAttentionItemType
  readonly reference: string
  readonly domain: AdminAttentionDomain
  readonly severity: AdminAttentionSeverity
  readonly status: AdminAttentionStatus
  readonly explanation: string
  readonly evidence: {
    readonly observedAt: string | null
    readonly window: { readonly start: string; readonly end: string } | null
    readonly label: string
  }
  readonly destination: string
  readonly sourceAttribution: readonly AdminAttentionSourceAttribution[]
  readonly retryable: boolean
}

export type AdminAttentionProjectionState<T> =
  | { readonly status: 'ready'; readonly projection: T }
  | { readonly status: 'unavailable' }

export interface AdminAttentionEvidence {
  readonly readiness?: AdminAttentionProjectionState<ProductionReadinessProjection>
  readonly health?: AdminAttentionProjectionState<SystemHealthProjection>
  readonly configuration?: AdminAttentionProjectionState<AdminRuntimeConfigurationProjection>
  readonly learners?: AdminAttentionProjectionState<LearnerAnalyticsSnapshot>
  readonly safety?: AdminAttentionProjectionState<SafetyOperationsSnapshotV1>
  readonly costs?: AdminAttentionProjectionState<AdminCostsModel>
}

export interface AdminAttentionCenterModel {
  readonly items: readonly AdminAttentionItem[]
  readonly visibleDomains: readonly AdminAttentionDomain[]
  readonly evidence: {
    readonly status: 'complete' | 'partial' | 'unavailable'
    readonly expectedSourceCount: number
    readonly availableSourceCount: number
    readonly unavailableDomains: readonly AdminAttentionDomain[]
    readonly incompleteDomains: readonly AdminAttentionDomain[]
  }
}

interface Candidate extends AdminAttentionItem {
  readonly dedupeKey: string
}

const MAX_ATTENTION_ITEMS = 100

const DOMAIN_CAPABILITY: Readonly<Record<AdminAttentionDomain, AdminCapability>> = {
  readiness: 'releases:read',
  health: 'health:read',
  configuration: 'configuration:read',
  learners: 'learners:read',
  safety: 'safety:read',
  costs: 'costs:read',
}

export const ADMIN_ATTENTION_DOMAIN_LABELS: Readonly<Record<AdminAttentionDomain, string>> = {
  readiness: 'Production Readiness',
  health: 'System Health',
  configuration: 'Configuration',
  learners: 'Learner Operations',
  safety: 'Safety',
  costs: 'AI & Costs',
}

const DESTINATIONS: Readonly<Record<AdminAttentionDomain, string>> = {
  readiness: '/academy/admin/production-readiness',
  health: '/academy/admin/health',
  configuration: '/academy/admin/configuration',
  learners: '/academy/admin/learners',
  safety: '/academy/admin/safety',
  costs: '/academy/admin/costs',
}

const SOURCE: Readonly<Record<AdminAttentionDomain, AdminAttentionSourceAttribution>> =
  Object.fromEntries(ADMIN_ATTENTION_DOMAINS.map((domain) => [domain, Object.freeze({
    id: domain,
    label: ADMIN_ATTENTION_DOMAIN_LABELS[domain],
  })])) as Readonly<Record<AdminAttentionDomain, AdminAttentionSourceAttribution>>

const CHECK_LABELS: Readonly<Record<string, string>> = {
  'application.build': 'The production build gate',
  'application.runtime_configuration': 'Effective runtime configuration',
  'database.repository_migrations': 'Repository migration evidence',
  'database.hosted_migrations': 'Hosted migration evidence',
  'authorization.foundation': 'The Admin authorization foundation',
  'authorization.owner_bootstrap': 'Owner bootstrap evidence',
  'ai_tts.ai_state': 'The AI runtime gate',
  'ai_tts.tts_state': 'The text-to-speech runtime gate',
  'ai_tts.voice_catalog': 'The voice catalog gate',
  'telemetry.operational_aggregate': 'Operational telemetry evidence',
  'telemetry.provider_accounting': 'Provider accounting evidence',
  'curriculum.release_registry': 'The curriculum release registry',
  'curriculum.active_validation': 'Active curriculum validation',
  'study.mount': 'The Study mount gate',
  'study.readiness': 'Study production readiness',
  'deployment.environment': 'Deployment environment presence',
}

const READINESS_DEDUPE_KEYS: Readonly<Record<string, string>> = {
  'application.runtime_configuration': 'configuration:runtime',
  'telemetry.operational_aggregate': 'telemetry:operational',
  'telemetry.provider_accounting': 'costs:provider-accounting',
}

const SEVERITY_RANK: Readonly<Record<AdminAttentionSeverity, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  informational: 3,
}

const STATUS_RANK: Readonly<Record<AdminAttentionStatus, number>> = {
  needs_attention: 0,
  blocked_unavailable: 1,
  warning: 2,
  informational: 3,
}

const UNAVAILABLE_SEVERITY: Readonly<Record<AdminAttentionDomain, AdminAttentionSeverity>> = {
  readiness: 'critical',
  health: 'critical',
  configuration: 'critical',
  learners: 'high',
  safety: 'critical',
  costs: 'medium',
}

function candidate(input: Omit<Candidate, 'sourceAttribution'> & {
  readonly sourceAttribution?: readonly AdminAttentionSourceAttribution[]
}): Candidate {
  return Object.freeze({
    ...input,
    sourceAttribution: Object.freeze(input.sourceAttribution ?? [SOURCE[input.domain]]),
  })
}

function unavailableCandidate(domain: AdminAttentionDomain): Candidate {
  return candidate({
    dedupeKey: `evidence:${domain}`,
    itemType: 'evidence-unavailable',
    reference: domain,
    domain,
    severity: UNAVAILABLE_SEVERITY[domain],
    status: 'blocked_unavailable',
    explanation: `${ADMIN_ATTENTION_DOMAIN_LABELS[domain]} evidence is unavailable, so this domain cannot be cleared.`,
    evidence: { observedAt: null, window: null, label: 'Current read attempt' },
    destination: DESTINATIONS[domain],
    retryable: true,
  })
}

function readinessCandidates(projection: ProductionReadinessProjection): Candidate[] {
  const items: Candidate[] = []
  for (const check of projection.domains.flatMap((domain) => domain.checks)) {
    const evidenceConcern = check.evidence.status !== 'VERIFIED'
    if (check.status === 'READY' && !evidenceConcern) continue
    if (!check.required && check.status === 'NOT_APPLICABLE') continue
    const label = CHECK_LABELS[check.id] ?? 'A production readiness gate'
    const blocking = check.required || check.status === 'BLOCKED' || check.status === 'UNAVAILABLE'
    items.push(candidate({
      dedupeKey: READINESS_DEDUPE_KEYS[check.id] ?? `readiness:${check.id}`,
      itemType: 'production-readiness-gate',
      reference: check.id,
      domain: 'readiness',
      severity: check.required ? 'critical' : blocking ? 'high' : 'medium',
      status: blocking ? 'blocked_unavailable' : 'warning',
      explanation: check.required
        ? `${label} is blocking production readiness.`
        : `${label} needs operator review before it can be treated as ready.`,
      evidence: { observedAt: projection.generatedAt, window: null, label: 'Readiness projection' },
      destination: DESTINATIONS.readiness,
      retryable: true,
    }))
  }
  return items
}

function healthCandidates(projection: SystemHealthProjection): Candidate[] {
  const items: Candidate[] = []
  const evidenceGap = projection.freshness !== 'current'
    || projection.evidenceCompleteness !== 'complete'
    || projection.overallReasonCodes.some((reason) => [
      'no_evidence', 'stale_evidence', 'telemetry_incomplete', 'insufficient_volume',
    ].includes(reason))
  const healthNeedsAttention = projection.overallHealth !== 'healthy'
    && projection.overallHealth !== 'disabled'

  if (healthNeedsAttention || evidenceGap) {
    const unavailable = projection.overallHealth === 'unavailable'
    const degraded = projection.overallHealth === 'degraded'
    const explanation = unavailable
      ? 'Core academy operations are unavailable in the current health evaluation.'
      : degraded
        ? 'Academy operations are degraded in the current health evaluation.'
        : projection.freshness === 'no_evidence'
          ? 'System Health has no current operational evidence.'
          : projection.freshness === 'stale'
            ? 'System Health evidence is stale and cannot establish current health.'
            : 'System Health cannot be determined from complete current evidence.'
    items.push(candidate({
      dedupeKey: evidenceGap ? 'telemetry:operational' : 'health:overall',
      itemType: 'system-health-state',
      reference: 'overall',
      domain: 'health',
      severity: unavailable ? 'critical' : degraded ? 'high' : 'medium',
      status: unavailable || (!degraded && evidenceGap) ? 'blocked_unavailable' : 'needs_attention',
      explanation,
      evidence: {
        observedAt: projection.observedAt,
        window: projection.evaluationWindow,
        label: 'Current one-hour health evaluation',
      },
      destination: DESTINATIONS.health,
      retryable: true,
    }))
  }
  return items
}

function configurationCandidates(projection: AdminRuntimeConfigurationProjection): Candidate[] {
  const affected = projection.settings.filter((setting) =>
    setting.runtime.resolution === 'error'
    || setting.runtime.resolution === 'fallback'
    || setting.runtime.resolution === 'constraint')
  if (affected.length === 0) return []
  const hasError = affected.some((setting) => setting.runtime.resolution === 'error')
  const hasFallback = affected.some((setting) => setting.runtime.resolution === 'fallback')
  return [candidate({
    dedupeKey: 'configuration:runtime',
    itemType: 'runtime-configuration-state',
    reference: 'runtime',
    domain: 'configuration',
    severity: hasError ? 'critical' : hasFallback ? 'high' : 'medium',
    status: hasError ? 'blocked_unavailable' : 'warning',
    explanation: hasError
      ? 'Effective runtime configuration required a safe resolution after a configuration failure.'
      : hasFallback
        ? 'Effective runtime configuration is using one or more safe fallback values.'
        : 'Deployment constraints changed one or more effective runtime values.',
    evidence: { observedAt: null, window: null, label: 'Current effective runtime projection' },
    destination: DESTINATIONS.configuration,
    retryable: true,
  })]
}

function learnerCandidates(snapshot: LearnerAnalyticsSnapshot): Candidate[] {
  const items = snapshot.learners.flatMap((learner) => {
    if (!/^p[1-5]$/.test(learner.learnerRef) || learner.openReviewCount <= 0) return []
    return [candidate({
      dedupeKey: `learner:${learner.learnerRef}:operational-review`,
      itemType: 'learner-operational-flag',
      reference: learner.learnerRef,
      domain: 'learners',
      severity: learner.needsDadCount > 0 ? 'high' : 'medium',
      status: 'needs_attention',
      explanation: `${learner.openReviewCount} learner operational review ${learner.openReviewCount === 1 ? 'flag requires' : 'flags require'} adult attention.`,
      evidence: { observedAt: snapshot.observedAt, window: null, label: 'Learner Operations projection' },
      destination: `${DESTINATIONS.learners}/${learner.learnerRef}`,
      retryable: true,
    })]
  })
  if (snapshot.learners.some((learner) => learner.study.status === 'unavailable')) {
    items.push(candidate({
      dedupeKey: 'evidence:learners',
      itemType: 'evidence-unavailable',
      reference: 'learner-review-evidence',
      domain: 'learners',
      severity: 'high',
      status: 'blocked_unavailable',
      explanation: 'Learner review evidence is unavailable for one or more authorized learner records.',
      evidence: { observedAt: snapshot.observedAt, window: null, label: 'Learner Operations projection' },
      destination: DESTINATIONS.learners,
      retryable: true,
    }))
  }
  return items
}

function safetyCandidates(snapshot: SafetyOperationsSnapshotV1): Candidate[] {
  const items: Candidate[] = []
  const evidenceIncomplete = snapshot.sources.some((source) => source.status === 'unavailable')
    || snapshot.operationalTelemetry.status === 'unavailable'
    || snapshot.page.nextCursor !== null
    || Object.values(snapshot.summary).some((metric) => metric.status === 'unavailable')
  if (evidenceIncomplete) {
    items.push(candidate({
      dedupeKey: 'evidence:safety',
      itemType: 'evidence-unavailable',
      reference: 'safety-coverage',
      domain: 'safety',
      severity: 'critical',
      status: 'blocked_unavailable',
      explanation: 'Safety evidence coverage is incomplete, so unresolved conditions cannot be cleared.',
      evidence: { observedAt: snapshot.observedAt, window: null, label: 'Safety Operations source coverage' },
      destination: DESTINATIONS.safety,
      retryable: true,
    }))
  }
  const activeEvents = snapshot.events.filter((event) =>
    event.state === 'open'
    || event.state === 'pending-review'
    || event.state === 'fail-closed'
    || event.state === 'unknown'
    || event.resolution.state === 'unresolved'
    || event.resolution.state === 'pending-adult-review'
    || event.resolution.state === 'unknown')
  for (const event of activeEvents) {
    const source = Object.freeze({
      id: event.source,
      label: event.source.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' '),
    })
    items.push(candidate({
      dedupeKey: `safety:${event.eventRef}`,
      itemType: 'safety-condition',
      reference: event.eventRef,
      domain: 'safety',
      severity: 'critical',
      status: event.state === 'unknown' || event.resolution.state === 'unknown'
        ? 'blocked_unavailable' : 'needs_attention',
      explanation: safeSafetyReasonMessage(event.reasonCode),
      evidence: { observedAt: event.occurredAt, window: null, label: 'Safety event evidence' },
      destination: `${DESTINATIONS.safety}#safety-event-${encodeURIComponent(event.eventRef)}`,
      sourceAttribution: [SOURCE.safety, source],
      retryable: true,
    }))
  }

  const activeSummary = [
    snapshot.summary.openSafetyStops,
    snapshot.summary.adultReviewPending,
    snapshot.summary.unresolvedSafetyConditions,
    snapshot.summary.failClosedEvents,
  ].reduce((maximum, metric) => metric.status === 'available'
    ? Math.max(maximum, metric.value) : maximum, 0)
  if (activeSummary > activeEvents.length) {
    const remaining = activeSummary - activeEvents.length
    items.push(candidate({
      dedupeKey: 'safety:unresolved-summary',
      itemType: 'safety-condition',
      reference: 'unresolved-summary',
      domain: 'safety',
      severity: 'critical',
      status: 'needs_attention',
      explanation: `${remaining} additional unresolved safety ${remaining === 1 ? 'condition requires' : 'conditions require'} adult review.`,
      evidence: { observedAt: snapshot.observedAt, window: null, label: 'Safety Operations summary' },
      destination: DESTINATIONS.safety,
      retryable: true,
    }))
  }
  return items
}

function costCandidates(model: AdminCostsModel): Candidate[] {
  const costGapCount = model.summary.unavailableCostCount
  const usageGapCount = model.summary.usageUnavailableCount
  const incomplete = model.source.status === 'partial'
    || costGapCount > 0
    || usageGapCount > 0
    || model.summary.calculatedCost.status !== 'available'
  if (!incomplete) return []
  return [candidate({
    dedupeKey: 'costs:provider-accounting',
    itemType: 'cost-accounting-state',
    reference: 'provider-accounting',
    domain: 'costs',
    severity: 'medium',
    status: 'warning',
    explanation: costGapCount > 0 || usageGapCount > 0
      ? `Accounting evidence is incomplete for ${costGapCount} cost ${costGapCount === 1 ? 'record' : 'records'} and ${usageGapCount} usage ${usageGapCount === 1 ? 'record' : 'records'}.`
      : 'Monthly cost accounting evidence is partial or unavailable.',
    evidence: {
      observedAt: model.generatedAt,
      window: { start: model.range.startAt, end: model.range.endExclusive },
      label: 'Current month cost projection',
    },
    destination: DESTINATIONS.costs,
    retryable: true,
  })]
}

function isInternallyIncomplete(domain: AdminAttentionDomain, evidence: AdminAttentionEvidence): boolean {
  if (domain === 'readiness' && evidence.readiness?.status === 'ready') {
    return evidence.readiness.projection.domains.some((item) => item.checks.some((check) =>
      check.status === 'PARTIAL'
      || check.status === 'UNVERIFIED'
      || check.status === 'UNAVAILABLE'
      || check.evidence.status !== 'VERIFIED'))
  }
  if (domain === 'health' && evidence.health?.status === 'ready') {
    const projection = evidence.health.projection
    return projection.evidenceCompleteness !== 'complete' || projection.freshness !== 'current'
  }
  if (domain === 'learners' && evidence.learners?.status === 'ready') {
    return evidence.learners.projection.learners.some((learner) => learner.study.status === 'unavailable')
  }
  if (domain === 'safety' && evidence.safety?.status === 'ready') {
    const projection = evidence.safety.projection
    return projection.sources.some((source) => source.status === 'unavailable')
      || projection.operationalTelemetry.status === 'unavailable'
      || projection.page.nextCursor !== null
      || Object.values(projection.summary).some((metric) => metric.status === 'unavailable')
  }
  if (domain === 'costs' && evidence.costs?.status === 'ready') {
    return evidence.costs.projection.source.status === 'partial'
  }
  return false
}

function stateFor(domain: AdminAttentionDomain, evidence: AdminAttentionEvidence) {
  return evidence[domain]
}

function candidatesFor(domain: AdminAttentionDomain, evidence: AdminAttentionEvidence): Candidate[] {
  if (domain === 'readiness' && evidence.readiness?.status === 'ready') {
    return readinessCandidates(evidence.readiness.projection)
  }
  if (domain === 'health' && evidence.health?.status === 'ready') {
    return healthCandidates(evidence.health.projection)
  }
  if (domain === 'configuration' && evidence.configuration?.status === 'ready') {
    return configurationCandidates(evidence.configuration.projection)
  }
  if (domain === 'learners' && evidence.learners?.status === 'ready') {
    return learnerCandidates(evidence.learners.projection)
  }
  if (domain === 'safety' && evidence.safety?.status === 'ready') {
    return safetyCandidates(evidence.safety.projection)
  }
  if (domain === 'costs' && evidence.costs?.status === 'ready') {
    return costCandidates(evidence.costs.projection)
  }
  return []
}

function mergeCandidates(items: readonly Candidate[]): AdminAttentionItem[] {
  const merged = new Map<string, Candidate>()
  for (const item of items) {
    const current = merged.get(item.dedupeKey)
    if (!current) {
      merged.set(item.dedupeKey, item)
      continue
    }
    const preferItem = SEVERITY_RANK[item.severity] < SEVERITY_RANK[current.severity]
      || (item.severity === current.severity && STATUS_RANK[item.status] < STATUS_RANK[current.status])
    const preferred = preferItem ? item : current
    const sources = [...current.sourceAttribution, ...item.sourceAttribution].filter((source, index, all) =>
      all.findIndex((candidateSource) => candidateSource.id === source.id) === index)
    merged.set(item.dedupeKey, candidate({
      ...preferred,
      sourceAttribution: sources,
    }))
  }
  return [...merged.values()]
    .sort((left, right) =>
      SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]
      || STATUS_RANK[left.status] - STATUS_RANK[right.status]
      || left.domain.localeCompare(right.domain)
      || left.reference.localeCompare(right.reference))
    .slice(0, MAX_ATTENTION_ITEMS)
    .map(({ dedupeKey: _dedupeKey, ...item }) => Object.freeze(item))
}

/**
 * Composes sanitized authoritative projections into a bounded, read-only view.
 * Domains without a caller capability are never inspected or represented.
 */
export function buildAdminAttentionCenter(
  capabilities: readonly AdminCapability[],
  evidence: AdminAttentionEvidence,
): AdminAttentionCenterModel {
  const visibleDomains = ADMIN_ATTENTION_DOMAINS.filter((domain) =>
    capabilities.includes(DOMAIN_CAPABILITY[domain]))
  const unavailableDomains: AdminAttentionDomain[] = []
  const incompleteDomains: AdminAttentionDomain[] = []
  const items: Candidate[] = []
  let availableSourceCount = 0

  for (const domain of visibleDomains) {
    const state = stateFor(domain, evidence)
    if (!state || state.status === 'unavailable') {
      unavailableDomains.push(domain)
      items.push(unavailableCandidate(domain))
      continue
    }
    availableSourceCount += 1
    if (isInternallyIncomplete(domain, evidence)) incompleteDomains.push(domain)
    items.push(...candidatesFor(domain, evidence))
  }

  const expectedSourceCount = visibleDomains.length
  const evidenceStatus = expectedSourceCount === 0 || availableSourceCount === 0
    ? 'unavailable'
    : unavailableDomains.length > 0 || incompleteDomains.length > 0
      ? 'partial'
      : 'complete'

  return Object.freeze({
    items: Object.freeze(mergeCandidates(items)),
    visibleDomains: Object.freeze(visibleDomains),
    evidence: Object.freeze({
      status: evidenceStatus,
      expectedSourceCount,
      availableSourceCount,
      unavailableDomains: Object.freeze(unavailableDomains),
      incompleteDomains: Object.freeze(incompleteDomains),
    }),
  })
}
