import { ADMIN_CONTRACT_VERSION } from './contracts'

export const STUDY_OPERATIONS_SCHEMA_VERSION = 2 as const

export const STUDY_OPERATION_GATE_IDS = [
  'effective_settings_v2',
  'curriculum_release_binding',
  'session_semantics',
  'bound_content_runtime',
  'adult_review_worker_composition',
  'adult_review_worker_schedule',
  'adult_review_worker_run_evidence',
  'study_telemetry',
  'provider_cost_accounting',
  'provider_attempt_coverage',
  'production_mount',
] as const
export type StudyOperationGateId = (typeof STUDY_OPERATION_GATE_IDS)[number]

export const STUDY_OPERATION_STATUSES = [
  'ready',
  'partial',
  'manual_review',
  'unavailable',
  'not_configured',
  'blocked',
  'unknown',
] as const
export type StudyOperationStatus = (typeof STUDY_OPERATION_STATUSES)[number]

export const STUDY_OPERATION_REASON_CODES = [
  'verified',
  'partial_evidence',
  'manual_verification_required',
  'unknown_evidence',
  'effective_settings_v2_not_integrated',
  'curriculum_release_binding_not_integrated',
  'session_semantics_not_ready',
  'bound_content_runtime_not_integrated',
  'adult_review_worker_not_composed',
  'adult_review_worker_composed',
  'adult_review_worker_schedule_absent',
  'adult_review_worker_schedule_unverified',
  'adult_review_worker_schedule_configured',
  'adult_review_worker_no_run_evidence',
  'adult_review_worker_no_work',
  'adult_review_worker_processed',
  'adult_review_worker_partial',
  'adult_review_worker_failed',
  'adult_review_worker_unavailable',
  'adult_review_worker_run_stale',
  'study_telemetry_verified',
  'study_telemetry_partial',
  'study_telemetry_absent',
  'study_telemetry_unavailable',
  'provider_cost_accounting_not_integrated',
  'provider_attempt_coverage_not_integrated',
  'study_feature_disabled',
  'production_mount_blocked',
  'production_mount_unverified',
  'source_unavailable',
] as const
export type StudyOperationReasonCode = (typeof STUDY_OPERATION_REASON_CODES)[number]

export const STUDY_OPERATION_ACTIONS = [
  'none',
  'integrate_effective_settings',
  'bind_curriculum_release',
  'restore_session_readiness',
  'integrate_bound_content',
  'compose_worker',
  'configure_worker_schedule',
  'inspect_worker_runs',
  'restore_worker_runtime',
  'inspect_telemetry',
  'integrate_cost_accounting',
  'complete_attempt_coverage',
  'enable_study',
  'verify_production_mount',
  'retry_evidence',
] as const
export type StudyOperationAction = (typeof STUDY_OPERATION_ACTIONS)[number]

export interface StudyOperationGate {
  readonly id: StudyOperationGateId
  readonly status: StudyOperationStatus
  readonly reasonCode: StudyOperationReasonCode
  readonly contractVersion: string | null
  readonly lastVerifiedAt: string | null
  readonly operatorAction: StudyOperationAction
}

export const STUDY_WORKER_CONFIGURED_STATES = ['configured', 'not_configured'] as const
export type StudyWorkerConfiguredState = (typeof STUDY_WORKER_CONFIGURED_STATES)[number]

export const STUDY_WORKER_RESULT_CATEGORIES = [
  'no_work',
  'processed',
  'partial_with_retryable_failures',
  'failed',
  'unavailable',
] as const
export type StudyWorkerResultCategory = (typeof STUDY_WORKER_RESULT_CATEGORIES)[number]

export const STUDY_WORKER_STALENESS_CLASSIFICATIONS = [
  'healthy', 'degraded', 'unknown', 'unavailable',
] as const
export type StudyWorkerStalenessClassification =
  (typeof STUDY_WORKER_STALENESS_CLASSIFICATIONS)[number]

/** Exact minimized shape returned by academy_study_adult_review_worker_status_v1. */
export interface StudyWorkerEvidence {
  readonly schemaVersion: 1
  readonly configuredState: StudyWorkerConfiguredState
  readonly latestRunTimestamp: string | null
  readonly latestSuccessfulRunTimestamp: string | null
  readonly latestResultCategory: StudyWorkerResultCategory | null
  readonly stalenessClassification: StudyWorkerStalenessClassification
  readonly workerVersion: string | null
}

export interface StudyOperationsProjection {
  readonly contractVersion: typeof ADMIN_CONTRACT_VERSION
  readonly schemaVersion: typeof STUDY_OPERATIONS_SCHEMA_VERSION
  readonly generatedAt: string
  readonly overallStatus: StudyOperationStatus
  readonly workerEvidence: StudyWorkerEvidence | null
  readonly gates: readonly StudyOperationGate[]
}

export type StudyOperationsReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly projection: StudyOperationsProjection }
  | { readonly status: 'denied' }
  | {
      readonly status: 'error'
      readonly code: 'study_operations_timeout' | 'study_operations_unavailable'
    }

const STATUS_PRECEDENCE: readonly StudyOperationStatus[] = [
  'blocked',
  'partial',
  'manual_review',
  'unavailable',
  'not_configured',
  'unknown',
  'ready',
]
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,119}$/

export function deriveStudyOperationsStatus(
  gates: readonly Pick<StudyOperationGate, 'status'>[],
): StudyOperationStatus {
  return STATUS_PRECEDENCE.find((status) => gates.some((gate) => gate.status === status))
    ?? 'unknown'
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const candidate = record(value)
  if (!candidate) return null
  const actual = Object.keys(candidate)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
    ? candidate
    : null
}

function instant(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
}

export function decodeStudyWorkerEvidence(value: unknown): StudyWorkerEvidence | null {
  const candidate = exact(value, [
    'schemaVersion', 'configuredState', 'latestRunTimestamp',
    'latestSuccessfulRunTimestamp', 'latestResultCategory',
    'stalenessClassification', 'workerVersion',
  ])
  if (
    !candidate
    || candidate.schemaVersion !== 1
    || !STUDY_WORKER_CONFIGURED_STATES.includes(candidate.configuredState as never)
    || !(candidate.latestRunTimestamp === null || instant(candidate.latestRunTimestamp))
    || !(candidate.latestSuccessfulRunTimestamp === null
      || instant(candidate.latestSuccessfulRunTimestamp))
    || !(candidate.latestResultCategory === null
      || STUDY_WORKER_RESULT_CATEGORIES.includes(candidate.latestResultCategory as never))
    || !STUDY_WORKER_STALENESS_CLASSIFICATIONS.includes(
      candidate.stalenessClassification as never,
    )
    || !(candidate.workerVersion === null
      || (typeof candidate.workerVersion === 'string' && SAFE_VERSION.test(candidate.workerVersion)))
  ) return null

  const configured = candidate.configuredState === 'configured'
  const latestRun = candidate.latestRunTimestamp as string | null
  const latestSuccess = candidate.latestSuccessfulRunTimestamp as string | null
  const category = candidate.latestResultCategory as StudyWorkerResultCategory | null
  const staleness = candidate.stalenessClassification as StudyWorkerStalenessClassification
  const workerVersion = candidate.workerVersion as string | null
  if (
    (latestRun === null) !== (category === null)
    || (latestRun === null) !== (workerVersion === null)
    || (latestRun === null && latestSuccess !== null)
    || (latestSuccess !== null && latestRun !== null
      && Date.parse(latestSuccess) > Date.parse(latestRun))
    || ((category === 'no_work' || category === 'processed') && latestSuccess !== latestRun)
    || (staleness === 'healthy'
      && (!configured || (category !== 'no_work' && category !== 'processed')))
    || (staleness === 'unknown' && (!configured || latestRun !== null))
    || (staleness === 'degraded'
      && (!configured || latestRun === null || category === 'unavailable'))
    || (staleness === 'unavailable' && configured && category !== 'unavailable')
  ) return null

  return Object.freeze({
    schemaVersion: 1,
    configuredState: candidate.configuredState,
    latestRunTimestamp: latestRun,
    latestSuccessfulRunTimestamp: latestSuccess,
    latestResultCategory: category,
    stalenessClassification: staleness,
    workerVersion,
  }) as StudyWorkerEvidence
}

function decodeGate(value: unknown, expectedId: StudyOperationGateId): StudyOperationGate | null {
  const candidate = exact(value, [
    'id', 'status', 'reasonCode', 'contractVersion', 'lastVerifiedAt', 'operatorAction',
  ])
  if (
    !candidate
    || candidate.id !== expectedId
    || !STUDY_OPERATION_STATUSES.includes(candidate.status as never)
    || !STUDY_OPERATION_REASON_CODES.includes(candidate.reasonCode as never)
    || !(candidate.contractVersion === null
      || (typeof candidate.contractVersion === 'string' && SAFE_VERSION.test(candidate.contractVersion)))
    || !(candidate.lastVerifiedAt === null || instant(candidate.lastVerifiedAt))
    || !STUDY_OPERATION_ACTIONS.includes(candidate.operatorAction as never)
  ) return null
  return Object.freeze({ ...candidate }) as unknown as StudyOperationGate
}

/** Strict browser boundary: extra fields and reordered/missing gates fail closed. */
export function decodeStudyOperationsProjection(value: unknown): StudyOperationsProjection | null {
  const candidate = exact(value, [
    'contractVersion', 'schemaVersion', 'generatedAt', 'overallStatus',
    'workerEvidence', 'gates',
  ])
  if (
    !candidate
    || candidate.contractVersion !== ADMIN_CONTRACT_VERSION
    || candidate.schemaVersion !== STUDY_OPERATIONS_SCHEMA_VERSION
    || !instant(candidate.generatedAt)
    || !STUDY_OPERATION_STATUSES.includes(candidate.overallStatus as never)
    || !Array.isArray(candidate.gates)
    || candidate.gates.length !== STUDY_OPERATION_GATE_IDS.length
  ) return null

  const workerEvidence = candidate.workerEvidence === null
    ? null
    : decodeStudyWorkerEvidence(candidate.workerEvidence)
  if (candidate.workerEvidence !== null && workerEvidence === null) return null

  const gates = candidate.gates.map((gate, index) =>
    decodeGate(gate, STUDY_OPERATION_GATE_IDS[index]))
  if (gates.some((gate) => gate === null)) return null
  if (deriveStudyOperationsStatus(gates as StudyOperationGate[]) !== candidate.overallStatus) {
    return null
  }
  return Object.freeze({
    contractVersion: ADMIN_CONTRACT_VERSION,
    schemaVersion: STUDY_OPERATIONS_SCHEMA_VERSION,
    generatedAt: candidate.generatedAt,
    overallStatus: candidate.overallStatus,
    workerEvidence,
    gates: Object.freeze(gates as StudyOperationGate[]),
  }) as StudyOperationsProjection
}
