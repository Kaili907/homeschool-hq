export const PRODUCTION_READINESS_STATUSES = [
  'READY',
  'BLOCKED',
  'PARTIAL',
  'UNVERIFIED',
  'NOT_APPLICABLE',
  'UNAVAILABLE',
] as const
export type ProductionReadinessStatus = (typeof PRODUCTION_READINESS_STATUSES)[number]

export const PRODUCTION_READINESS_EVIDENCE_STATUSES = [
  'VERIFIED',
  'REPORTED',
  'UNVERIFIED',
  'MISMATCH',
  'UNAVAILABLE',
] as const
export type ProductionReadinessEvidenceStatus = (typeof PRODUCTION_READINESS_EVIDENCE_STATUSES)[number]

export const PRODUCTION_READINESS_DOMAIN_IDS = [
  'application',
  'database',
  'authorization',
  'ai_tts',
  'telemetry',
  'curriculum',
  'study',
  'deployment',
] as const
export type ProductionReadinessDomainId = (typeof PRODUCTION_READINESS_DOMAIN_IDS)[number]

export type EnvironmentPresence = 'present' | 'missing' | 'not_checked'

export interface ProductionReadinessObservation {
  readonly label: string
  readonly status: EnvironmentPresence
}

export interface ProductionReadinessCheck {
  readonly id: string
  readonly title: string
  readonly status: ProductionReadinessStatus
  readonly required: boolean
  readonly summary: string
  readonly action: string | null
  readonly evidence: {
    readonly source: string
    readonly status: ProductionReadinessEvidenceStatus
  }
  readonly observations: readonly ProductionReadinessObservation[]
}

export interface ProductionReadinessDomain {
  readonly id: ProductionReadinessDomainId
  readonly label: string
  readonly status: ProductionReadinessStatus
  readonly summary: string
  readonly checks: readonly ProductionReadinessCheck[]
}

export interface ProductionReadinessProjection {
  readonly schemaVersion: 1
  readonly generatedAt: string
  readonly status: 'READY' | 'BLOCKED'
  readonly requiredSummary: {
    readonly total: number
    readonly ready: number
    readonly blocking: number
  }
  readonly domains: readonly ProductionReadinessDomain[]
}

const CHECK_IDS = new Set([
  'application.build',
  'application.runtime_configuration',
  'database.repository_migrations',
  'database.hosted_migrations',
  'authorization.foundation',
  'authorization.owner_bootstrap',
  'ai_tts.ai_state',
  'ai_tts.tts_state',
  'ai_tts.voice_catalog',
  'telemetry.operational_aggregate',
  'telemetry.provider_accounting',
  'telemetry.monthly_cost_alert',
  'curriculum.release_registry',
  'curriculum.active_validation',
  'curriculum.release_controls',
  'study.mount',
  'study.readiness',
  'deployment.environment',
])
const PRESENCE = new Set<EnvironmentPresence>(['present', 'missing', 'not_checked'])

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
}

function safeText(value: unknown, max = 320): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= max
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
}

function status(value: unknown): value is ProductionReadinessStatus {
  return PRODUCTION_READINESS_STATUSES.includes(value as ProductionReadinessStatus)
}

function observation(value: unknown): ProductionReadinessObservation | null {
  const source = record(value)
  if (!source || !exactKeys(source, ['label', 'status'])
    || !safeText(source.label, 160)
    || !PRESENCE.has(source.status as EnvironmentPresence)) return null
  return Object.freeze({ label: source.label, status: source.status as EnvironmentPresence })
}

function readinessCheck(value: unknown): ProductionReadinessCheck | null {
  const source = record(value)
  const evidence = record(source?.evidence)
  if (!source || !evidence
    || !exactKeys(source, ['id', 'title', 'status', 'required', 'summary', 'action', 'evidence', 'observations'])
    || !exactKeys(evidence, ['source', 'status'])
    || typeof source.id !== 'string' || !CHECK_IDS.has(source.id)
    || !safeText(source.title, 120)
    || !status(source.status)
    || typeof source.required !== 'boolean'
    || !safeText(source.summary)
    || (source.action !== null && !safeText(source.action, 320))
    || !safeText(evidence.source, 160)
    || !PRODUCTION_READINESS_EVIDENCE_STATUSES.includes(
      evidence.status as ProductionReadinessEvidenceStatus,
    )
    || !Array.isArray(source.observations)
    || source.observations.length > 32) return null
  const observations = source.observations.map(observation)
  if (observations.some((item) => item === null)) return null
  return Object.freeze({
    id: source.id,
    title: source.title,
    status: source.status,
    required: source.required,
    summary: source.summary,
    action: source.action as string | null,
    evidence: Object.freeze({
      source: evidence.source,
      status: evidence.status as ProductionReadinessEvidenceStatus,
    }),
    observations: Object.freeze(observations as ProductionReadinessObservation[]),
  })
}

function readinessDomain(value: unknown): ProductionReadinessDomain | null {
  const source = record(value)
  if (!source || !exactKeys(source, ['id', 'label', 'status', 'summary', 'checks'])
    || !PRODUCTION_READINESS_DOMAIN_IDS.includes(source.id as ProductionReadinessDomainId)
    || !safeText(source.label, 80)
    || !status(source.status)
    || !safeText(source.summary, 240)
    || !Array.isArray(source.checks)
    || source.checks.length < 1
    || source.checks.length > 8) return null
  const checks = source.checks.map(readinessCheck)
  if (checks.some((item) => item === null)) return null
  const domainId = source.id as ProductionReadinessDomainId
  if ((checks as ProductionReadinessCheck[]).some((item) => !item.id.startsWith(`${domainId}.`))) return null
  return Object.freeze({
    id: domainId,
    label: source.label,
    status: source.status,
    summary: source.summary,
    checks: Object.freeze(checks as ProductionReadinessCheck[]),
  })
}

export function parseProductionReadinessProjection(value: unknown): ProductionReadinessProjection | null {
  const source = record(value)
  const requiredSummary = record(source?.requiredSummary)
  if (!source || !requiredSummary
    || !exactKeys(source, ['schemaVersion', 'generatedAt', 'status', 'requiredSummary', 'domains'])
    || !exactKeys(requiredSummary, ['total', 'ready', 'blocking'])
    || source.schemaVersion !== 1
    || typeof source.generatedAt !== 'string'
    || Number.isNaN(Date.parse(source.generatedAt))
    || (source.status !== 'READY' && source.status !== 'BLOCKED')
    || !Number.isSafeInteger(requiredSummary.total) || Number(requiredSummary.total) < 1
    || !Number.isSafeInteger(requiredSummary.ready) || Number(requiredSummary.ready) < 0
    || !Number.isSafeInteger(requiredSummary.blocking) || Number(requiredSummary.blocking) < 0
    || Number(requiredSummary.ready) + Number(requiredSummary.blocking) !== Number(requiredSummary.total)
    || (source.status === 'READY') !== (Number(requiredSummary.blocking) === 0)
    || !Array.isArray(source.domains)
    || source.domains.length !== PRODUCTION_READINESS_DOMAIN_IDS.length) return null
  const domains = source.domains.map(readinessDomain)
  if (domains.some((item) => item === null)) return null
  if (domains.some((item, index) => item?.id !== PRODUCTION_READINESS_DOMAIN_IDS[index])) return null
  const checks = (domains as ProductionReadinessDomain[]).flatMap((item) => item.checks)
  if (new Set(checks.map((item) => item.id)).size !== checks.length) return null
  const requiredChecks = checks.filter((item) => item.required)
  const ready = requiredChecks.filter((item) => item.status === 'READY').length
  if (requiredChecks.length !== requiredSummary.total
    || ready !== requiredSummary.ready
    || requiredChecks.length - ready !== requiredSummary.blocking) return null
  return Object.freeze({
    schemaVersion: 1,
    generatedAt: source.generatedAt,
    status: source.status,
    requiredSummary: Object.freeze({
      total: Number(requiredSummary.total),
      ready: Number(requiredSummary.ready),
      blocking: Number(requiredSummary.blocking),
    }),
    domains: Object.freeze(domains as ProductionReadinessDomain[]),
  })
}
