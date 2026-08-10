import {
  STUDY_OPERATION_STATUSES,
  STUDY_OPERATIONS_SCHEMA_VERSION,
  deriveStudyOperationsStatus,
} from '../../../src/admin/studyOperationsModel.ts'
import { ADMIN_CONTRACT_VERSION } from '../../../src/admin/contracts.ts'
import { createAdminHealthSource } from './admin-health-source.js'
import { envFlagEnabled } from './http.js'
import {
  createStudyProductionReadinessService,
} from './study-production/readiness.js'

const SESSION_SEMANTICS_DEPENDENCIES = Object.freeze([
  'study-session-adapter',
  'checkpoint-adapter',
  'calendar-adapter',
  'parent-settings-adapter',
  'event-ledger',
])
const READINESS_STATES = new Set(['ready', 'not-ready', 'degraded'])
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,119}$/

function isoInstant(value) {
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value ? value : null
}

function version(value) {
  return typeof value === 'string' && SAFE_VERSION.test(value) ? value : null
}

function gate(id, status, reasonCode, contractVersion, lastVerifiedAt, operatorAction) {
  return Object.freeze({
    id,
    status,
    reasonCode,
    contractVersion: version(contractVersion),
    lastVerifiedAt: isoInstant(lastVerifiedAt),
    operatorAction,
  })
}

async function safeRead(source) {
  if (typeof source?.read !== 'function') return { kind: 'missing' }
  try {
    return { kind: 'available', value: await source.read() }
  } catch {
    return { kind: 'failed' }
  }
}

async function safeList(source) {
  if (typeof source?.list !== 'function') return { kind: 'missing' }
  try {
    return { kind: 'available', value: await source.list() }
  } catch {
    return { kind: 'failed' }
  }
}

function normalizeProbe(result) {
  const value = result?.value
  if (
    result?.kind !== 'available'
    || !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !STUDY_OPERATION_STATUSES.includes(value.status)
  ) return null
  return Object.freeze({
    status: value.status,
    contractVersion: version(value.contractVersion),
    lastVerifiedAt: isoInstant(value.lastVerifiedAt),
  })
}

function gateFromProbe({
  id,
  result,
  missingStatus = 'unavailable',
  missingReason,
  defaultContractVersion = null,
  action,
}) {
  const evidence = normalizeProbe(result)
  if (!evidence) {
    return gate(
      id,
      missingStatus,
      result.kind === 'failed' ? 'source_unavailable' : missingReason,
      defaultContractVersion,
      null,
      result.kind === 'failed' ? 'retry_evidence' : action,
    )
  }
  const reasonCode = evidence.status === 'ready'
    ? 'verified'
    : evidence.status === 'partial'
      ? 'partial_evidence'
      : evidence.status === 'manual_review'
        ? 'manual_verification_required'
        : evidence.status === 'unknown'
          ? 'unknown_evidence'
          : missingReason
  return gate(
    id,
    evidence.status,
    reasonCode,
    evidence.contractVersion ?? defaultContractVersion,
    evidence.lastVerifiedAt,
    evidence.status === 'ready' ? 'none' : action,
  )
}

async function safeReadiness(service) {
  try {
    const snapshot = await service?.check?.({ force: true })
    if (!snapshot || !READINESS_STATES.has(snapshot.status)) return null
    return snapshot
  } catch {
    return null
  }
}

function readinessObservedAt(snapshot) {
  const value = snapshot?.checkedAtMs
  return Number.isFinite(value) ? new Date(value).toISOString() : null
}

function sessionSemanticsGate(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.registrations)) {
    return gate(
      'session_semantics',
      'unavailable',
      'source_unavailable',
      'study-production.v1',
      null,
      'retry_evidence',
    )
  }
  const registrations = new Map()
  for (const item of snapshot.registrations) {
    if (
      item
      && typeof item === 'object'
      && typeof item.dependency === 'string'
      && READINESS_STATES.has(item.status)
      && !registrations.has(item.dependency)
    ) registrations.set(item.dependency, item.status)
  }
  const states = SESSION_SEMANTICS_DEPENDENCIES.map((key) => registrations.get(key))
  if (states.some((state) => state === undefined)) {
    return gate(
      'session_semantics',
      'unknown',
      'unknown_evidence',
      'study-production.v1',
      readinessObservedAt(snapshot),
      'retry_evidence',
    )
  }
  const status = states.includes('not-ready')
    ? 'blocked'
    : states.includes('degraded') ? 'partial' : 'ready'
  return gate(
    'session_semantics',
    status,
    status === 'ready' ? 'verified'
      : status === 'partial' ? 'partial_evidence' : 'session_semantics_not_ready',
    'study-production.v1',
    readinessObservedAt(snapshot),
    status === 'ready' ? 'none' : 'restore_session_readiness',
  )
}

function telemetryGate(result) {
  if (result.kind !== 'available') {
    return gate(
      'study_telemetry',
      'unavailable',
      'study_telemetry_unavailable',
      'admin-telemetry.v2',
      null,
      'retry_evidence',
    )
  }
  const value = result.value
  if (!value || !Array.isArray(value.events)) {
    return gate(
      'study_telemetry',
      'unavailable',
      'study_telemetry_unavailable',
      'admin-telemetry.v2',
      null,
      'retry_evidence',
    )
  }
  const studyEvents = value.events.filter((event) =>
    event?.engine === 'study' && event?.eventType === 'study.session' && isoInstant(event?.occurredAt))
  const lastVerifiedAt = studyEvents
    .map((event) => event.occurredAt)
    .sort()
    .at(-1) ?? null
  if (value.sourceTruncated === true || Number(value.rejectedRows) > 0) {
    return gate(
      'study_telemetry',
      'partial',
      'study_telemetry_partial',
      'admin-telemetry.v2',
      lastVerifiedAt,
      'inspect_telemetry',
    )
  }
  if (!lastVerifiedAt) {
    return gate(
      'study_telemetry',
      'unknown',
      'study_telemetry_absent',
      'admin-telemetry.v2',
      null,
      'inspect_telemetry',
    )
  }
  return gate(
    'study_telemetry',
    'ready',
    'study_telemetry_verified',
    'admin-telemetry.v2',
    lastVerifiedAt,
    'none',
  )
}

function defaultMountGate(env, snapshot, explicitResult) {
  if (explicitResult.kind !== 'missing') {
    return gateFromProbe({
      id: 'production_mount',
      result: explicitResult,
      missingReason: 'production_mount_unverified',
      defaultContractVersion: 'study-production.v1',
      action: 'verify_production_mount',
    })
  }
  if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) {
    return gate(
      'production_mount',
      'not_configured',
      'study_feature_disabled',
      'study-production.v1',
      null,
      'enable_study',
    )
  }
  if (!snapshot) {
    return gate(
      'production_mount',
      'unknown',
      'production_mount_unverified',
      'study-production.v1',
      null,
      'verify_production_mount',
    )
  }
  if (snapshot.status === 'not-ready') {
    return gate(
      'production_mount',
      'blocked',
      'production_mount_blocked',
      'study-production.v1',
      readinessObservedAt(snapshot),
      'restore_session_readiness',
    )
  }
  return gate(
    'production_mount',
    snapshot.status === 'degraded' ? 'partial' : 'manual_review',
    snapshot.status === 'degraded' ? 'partial_evidence' : 'production_mount_unverified',
    'study-production.v1',
    readinessObservedAt(snapshot),
    'verify_production_mount',
  )
}

/**
 * Server-only composition. Optional evidence readers are clean integration
 * seams for future authorities; their absence never upgrades a gate.
 */
export function createAdminStudyOperationsSource(options = {}) {
  const env = options.env ?? process.env
  const now = options.now ?? (() => new Date())
  const readinessService = options.readinessService
    ?? createStudyProductionReadinessService({
      env,
      fetchImpl: options.fetchImpl ?? globalThis.fetch,
      now: () => now().getTime(),
    })
  const telemetrySource = options.telemetrySource
    ?? createAdminHealthSource({
      env,
      fetchImpl: options.fetchImpl ?? globalThis.fetch,
      client: options.telemetryClient,
    })
  const evidence = options.evidence ?? {}

  return Object.freeze({
    async read() {
      const [
        snapshot,
        telemetry,
        effectiveSettings,
        curriculumBinding,
        boundContent,
        workerHealth,
        costAccounting,
        attemptCoverage,
        productionMount,
      ] = await Promise.all([
        safeReadiness(readinessService),
        safeList(telemetrySource),
        safeRead(evidence.effectiveSettingsV2),
        safeRead(evidence.curriculumReleaseBinding),
        safeRead(evidence.boundContentRuntime),
        safeRead(evidence.workerHealth),
        safeRead(evidence.providerCostAccounting),
        safeRead(evidence.providerAttemptCoverage),
        safeRead(evidence.productionMount),
      ])

      const workerComposition = workerHealth.kind === 'available'
        ? { kind: 'available', value: workerHealth.value?.composition }
        : workerHealth
      const workerSchedule = workerHealth.kind === 'available'
        ? { kind: 'available', value: workerHealth.value?.schedule }
        : workerHealth

      const gates = Object.freeze([
        gateFromProbe({
          id: 'effective_settings_v2',
          result: effectiveSettings,
          missingReason: 'effective_settings_v2_not_integrated',
          action: 'integrate_effective_settings',
        }),
        gateFromProbe({
          id: 'curriculum_release_binding',
          result: curriculumBinding,
          missingReason: 'curriculum_release_binding_not_integrated',
          action: 'bind_curriculum_release',
        }),
        sessionSemanticsGate(snapshot),
        gateFromProbe({
          id: 'bound_content_runtime',
          result: boundContent,
          missingReason: 'bound_content_runtime_not_integrated',
          action: 'integrate_bound_content',
        }),
        gateFromProbe({
          id: 'adult_review_worker_composition',
          result: workerComposition,
          missingReason: 'adult_review_worker_not_composed',
          defaultContractVersion: 'study-adult-review.operations.v2',
          action: 'compose_worker',
        }),
        gateFromProbe({
          id: 'adult_review_worker_schedule',
          result: workerSchedule,
          missingReason: workerHealth.kind === 'missing'
            ? 'adult_review_worker_schedule_absent'
            : 'adult_review_worker_schedule_unverified',
          action: 'configure_worker_schedule',
        }),
        telemetryGate(telemetry),
        gateFromProbe({
          id: 'provider_cost_accounting',
          result: costAccounting,
          missingReason: 'provider_cost_accounting_not_integrated',
          defaultContractVersion: 'admin-usage-cost.v2',
          action: 'integrate_cost_accounting',
        }),
        gateFromProbe({
          id: 'provider_attempt_coverage',
          result: attemptCoverage,
          missingReason: 'provider_attempt_coverage_not_integrated',
          action: 'complete_attempt_coverage',
        }),
        defaultMountGate(env, snapshot, productionMount),
      ])
      return Object.freeze({
        contractVersion: ADMIN_CONTRACT_VERSION,
        schemaVersion: STUDY_OPERATIONS_SCHEMA_VERSION,
        generatedAt: now().toISOString(),
        overallStatus: deriveStudyOperationsStatus(gates),
        gates,
      })
    },
  })
}
