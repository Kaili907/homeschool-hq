/**
 * ADMIN-0: canonical Admin Console vocabulary and wire-level contracts.
 *
 * This module is deliberately dependency-free. It defines shared names for the
 * later Admin sessions; it does not authorize a request or persist a record.
 */

export const ADMIN_CONTRACT_VERSION = 2 as const
export const ADMIN_CONSOLE_PATH = '/academy/admin' as const

export const ADMIN_ROLES = ['owner', 'admin', 'viewer'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const ADMIN_READ_CAPABILITIES = [
  'overview:read',
  'learners:read',
  'engines:read',
  'costs:read',
  'safety:read',
  'health:read',
  'curriculum:read',
  'configuration:read',
  'audit:read',
  'releases:read',
] as const

export const ADMIN_OPERATIONAL_CAPABILITIES = [
  'engines:operate',
  'safety:triage',
  'incidents:acknowledge',
  'curriculum:drafts:write',
] as const

export const ADMIN_OWNER_CAPABILITIES = [
  'admin_roles:manage',
  'configuration:manage',
  'curriculum:approve',
  'curriculum:publish',
  'releases:manage',
] as const

export type AdminCapability =
  | (typeof ADMIN_READ_CAPABILITIES)[number]
  | (typeof ADMIN_OPERATIONAL_CAPABILITIES)[number]
  | (typeof ADMIN_OWNER_CAPABILITIES)[number]

export const ADMIN_ROLE_CAPABILITIES: Readonly<Record<AdminRole, readonly AdminCapability[]>> =
  Object.freeze({
    viewer: Object.freeze([...ADMIN_READ_CAPABILITIES]),
    admin: Object.freeze([
      ...ADMIN_READ_CAPABILITIES,
      ...ADMIN_OPERATIONAL_CAPABILITIES,
    ]),
    owner: Object.freeze([
      ...ADMIN_READ_CAPABILITIES,
      ...ADMIN_OPERATIONAL_CAPABILITIES,
      ...ADMIN_OWNER_CAPABILITIES,
    ]),
  })

export function hasAdminCapability(
  role: AdminRole,
  capability: AdminCapability,
): boolean {
  return ADMIN_ROLE_CAPABILITIES[role].includes(capability)
}

export const ADMIN_ENGINE_IDS = [
  'tutor',
  'study',
  'assessment',
  'curriculum',
  'jarvis',
  'tts',
  'gateway',
  'sync',
] as const
export type AdminEngineId = (typeof ADMIN_ENGINE_IDS)[number]

export const ADMIN_HEALTH_STATES = [
  'healthy',
  'degraded',
  'unavailable',
  'disabled',
  'unknown',
] as const
export type AdminHealthState = (typeof ADMIN_HEALTH_STATES)[number]

export const ADMIN_OPERATIONAL_RESULTS = [
  'success',
  'fallback',
  'rejected',
  'timeout',
  'provider_error',
  'validation_error',
  'safety_stop',
] as const
export type AdminOperationalResult = (typeof ADMIN_OPERATIONAL_RESULTS)[number]

export const ADMIN_TELEMETRY_EVENT_TYPES = [
  'tutor.turn',
  'study.session',
  'assessment.attempt',
  'curriculum.load',
  'jarvis.turn',
  'tts.synthesis',
  'gateway.request',
  'sync.operation',
  'safety.classification',
  'persistence.operation',
] as const
export type AdminTelemetryEventType = (typeof ADMIN_TELEMETRY_EVENT_TYPES)[number]

/** Metadata is flat, bounded, scalar, and key-allowlisted by the writer. */
export const ADMIN_TELEMETRY_METADATA_KEYS = [
  'attempt',
  'cache_hit',
  'failure_stage',
  'feature_flag',
  'http_status',
  'operation',
  'provider',
  'reason_code',
  'retryable',
  'route',
  'severity',
  'source',
  'voice_ref',
] as const
export type AdminTelemetryMetadataKey =
  (typeof ADMIN_TELEMETRY_METADATA_KEYS)[number]
export type AdminTelemetryMetadataValue = string | number | boolean | null
export type AdminTelemetryMetadata = Readonly<
  Partial<Record<AdminTelemetryMetadataKey, AdminTelemetryMetadataValue>>
>

export const ADMIN_PROHIBITED_TELEMETRY_FIELDS = [
  'messages',
  'conversation',
  'transcript',
  'prompt',
  'response',
  'student_audio',
  'audio',
  'emotional_label',
  'emotion',
  'personality_judgment',
  'diagnostic_inference',
  'assessment_answer',
  'answer_content',
  'raw_answer',
] as const
export type AdminProhibitedTelemetryField =
  (typeof ADMIN_PROHIBITED_TELEMETRY_FIELDS)[number]

export interface AdminVersionSnapshot {
  /** Immutable deployed build identifier, not a mutable environment label. */
  readonly appVersion: string
  /** Independently versioned engine implementation or contract identifier. */
  readonly engineVersion: string
  /** Immutable curriculum package version, null when the event has no curriculum context. */
  readonly curriculumVersion: string | null
}

interface AdminOperationalEventBase extends AdminVersionSnapshot {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly eventId: string
  readonly occurredAt: string
  readonly engine: AdminEngineId
  readonly courseRef: string | null
  readonly unitRef: string | null
  readonly lessonRef: string | null
  readonly skillRef: string | null
  readonly eventType: AdminTelemetryEventType
  readonly result: AdminOperationalResult
  readonly durationMs: number | null
  readonly metadata: AdminTelemetryMetadata
}

export interface AdminHouseholdOperationalEvent extends AdminOperationalEventBase {
  readonly scope: 'household'
  readonly householdRef: string
  readonly learnerRef: string | null
}

export interface AdminSystemOperationalEvent extends AdminOperationalEventBase {
  readonly scope: 'system'
  readonly householdRef: null
  readonly learnerRef: null
}

export type AdminOperationalEvent =
  | AdminHouseholdOperationalEvent
  | AdminSystemOperationalEvent

/**
 * PostgreSQL BIGINT values cross JSON as canonical decimal strings so no
 * JavaScript floating-point or unsafe-integer conversion can alter money.
 */
export type IntegerMicros = string

export const ADMIN_COST_KINDS = ['calculated', 'reconciled', 'unavailable'] as const
export type AdminCostKind = (typeof ADMIN_COST_KINDS)[number]

export const ADMIN_BILLING_DISPOSITIONS = [
  'billable',
  'not_billable',
  'unknown',
] as const
export type AdminBillingDisposition =
  (typeof ADMIN_BILLING_DISPOSITIONS)[number]

export const ADMIN_HOUSEHOLD_ATTRIBUTION_STATES = [
  'resolved',
  'no_active_household',
  'ambiguous',
  'lookup_unavailable',
] as const
export type AdminHouseholdAttributionState =
  (typeof ADMIN_HOUSEHOLD_ATTRIBUTION_STATES)[number]

export const ADMIN_CURRENCIES = ['USD'] as const
export type AdminCurrency = (typeof ADMIN_CURRENCIES)[number]

/** Version applicability for a trusted provider execution. */
export interface AdminUsageVersionSnapshot {
  /** Every provider execution is attributable to one immutable deployed build. */
  readonly appVersion: string
  /** Null only when the calling engine has no independent version. */
  readonly engineVersion: string | null
  /** Null when the provider execution has no trusted curriculum context. */
  readonly curriculumVersion: string | null
}

export interface AdminAppliedPriceSnapshot {
  readonly rateId: string
  readonly pricingCatalogVersion: string
  readonly provider: string
  readonly providerProductId: string
  readonly logicalModelTier: string | null
  readonly unit: AdminPricingUnit
  readonly unitSize: number
  readonly priceMicrosPerUnitSize: IntegerMicros
  readonly currency: AdminCurrency
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
}

export interface AdminUsageCostComponent {
  readonly unit: AdminPricingUnit
  readonly quantity: number
  readonly rate: AdminAppliedPriceSnapshot
  readonly calculatedCostMicros: IntegerMicros
}

export interface AdminUsageCostRecord extends AdminUsageVersionSnapshot {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly usageId: string
  readonly occurredAt: string
  /** Verified Supabase account/user reference; never a browser claim. */
  readonly accountRef: string
  readonly householdRef: string | null
  readonly householdAttribution: AdminHouseholdAttributionState
  readonly learnerRef: string | null
  readonly engine: AdminEngineId
  readonly provider: string
  /** Billable provider product/SKU selected by trusted server policy. */
  readonly providerProductId: string
  /** Null for products, such as current TTS, with no Academy logical tier. */
  readonly logicalModelTier: string | null
  /** Server/Admin-only. Never add this field to learner gateway responses. */
  readonly providerModelId: string
  /** Null means the provider did not return trustworthy usage; it never means zero. */
  readonly inputTokens: number | null
  readonly outputTokens: number | null
  readonly cachedInputReadTokens: number | null
  readonly cachedInputWriteTokens: number | null
  readonly ttsCharacters: number | null
  readonly requestCount: number
  readonly latencyMs: number
  readonly result: AdminOperationalResult
  readonly resultReasonCode: string | null
  readonly billingDisposition: AdminBillingDisposition
  /** Null when usage or an effective price is unavailable. */
  readonly costMicros: IntegerMicros | null
  readonly currency: AdminCurrency
  readonly costKind: AdminCostKind
  readonly pricingCatalogVersion: string | null
  readonly costComponents: readonly AdminUsageCostComponent[]
  /** Required only when costKind is reconciled. */
  readonly reconciliationRef: string | null
}

export const ADMIN_PRICING_UNITS = [
  'input_token',
  'output_token',
  'cached_input_read_token',
  'cached_input_write_token',
  'tts_character',
  'request',
] as const
export type AdminPricingUnit = (typeof ADMIN_PRICING_UNITS)[number]

export interface AdminPricingCatalog {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly pricingCatalogVersion: string
  readonly currency: AdminCurrency
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
  readonly publishedAt: string
  readonly sourceRef: string
}

export interface AdminProviderPrice {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly rateId: string
  readonly pricingCatalogVersion: string
  readonly provider: string
  readonly providerProductId: string
  readonly providerModelId: string
  readonly logicalModelTier: string | null
  readonly unit: AdminPricingUnit
  readonly unitSize: number
  readonly priceMicrosPerUnitSize: IntegerMicros
  readonly currency: AdminCurrency
  readonly effectiveFrom: string
  readonly effectiveTo: string | null
}

export const ADMIN_USAGE_IDEMPOTENCY_RESULTS = [
  'created',
  'replayed',
  'reconciliation_conflict',
] as const
export type AdminUsageIdempotencyResult =
  (typeof ADMIN_USAGE_IDEMPOTENCY_RESULTS)[number]

export function isCanonicalIntegerMicros(value: string): value is IntegerMicros {
  return /^(0|[1-9]\d*)$/.test(value)
}

/** Shared cross-field checks for the version 2 usage/cost wire shape. */
export function hasConsistentAdminUsageCost(
  record: Pick<
    AdminUsageCostRecord,
    | 'householdRef'
    | 'householdAttribution'
    | 'learnerRef'
    | 'billingDisposition'
    | 'costMicros'
    | 'costKind'
    | 'pricingCatalogVersion'
    | 'costComponents'
    | 'currency'
    | 'reconciliationRef'
  >,
): boolean {
  if (
    (record.householdAttribution === 'resolved') !==
      (record.householdRef !== null) ||
    (record.learnerRef !== null && record.householdRef === null)
  ) {
    return false
  }

  const hasCost =
    record.costMicros !== null && isCanonicalIntegerMicros(record.costMicros)
  if (record.costKind === 'unavailable') {
    return (
      record.billingDisposition !== 'not_billable' &&
      record.costMicros === null &&
      record.reconciliationRef === null &&
      record.costComponents.length === 0
    )
  }
  if (!hasCost || record.billingDisposition === 'unknown') return false

  if (record.costKind === 'reconciled') {
    return !!record.reconciliationRef && record.costComponents.length === 0
  }
  if (record.reconciliationRef !== null) return false

  if (record.billingDisposition === 'not_billable') {
    return record.costMicros === '0' && record.costComponents.length === 0
  }

  if (record.costMicros !== '0' && record.costComponents.length === 0) {
    return false
  }
  return record.costComponents.every(
    (component) =>
      component.unit === component.rate.unit &&
      component.rate.currency === record.currency &&
      component.rate.pricingCatalogVersion === record.pricingCatalogVersion &&
      isCanonicalIntegerMicros(component.calculatedCostMicros),
  )
}

export const ADMIN_AUDIT_ACTIONS = [
  'admin_role.assign',
  'admin_role.revoke',
  'configuration.update',
  'engine.control',
  'safety.triage',
  'incident.acknowledge',
  'curriculum_draft.create',
  'curriculum_draft.update',
  'curriculum_entity.create',
  'curriculum_entity.update',
  'curriculum_entity.tombstone',
  'curriculum_draft.collaborator.add',
  'curriculum_draft.collaborator.revoke',
  'curriculum_approval.approve',
  'curriculum_approval.changes_requested',
  'curriculum.approve',
  'curriculum.publish',
  'release.activate',
  'release.rollback',
] as const
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number]

export const ADMIN_AUDIT_RESOURCE_TYPES = [
  'admin_role_assignment',
  'configuration',
  'engine',
  'safety_case',
  'incident',
  'curriculum_draft',
  'curriculum_entity',
  'curriculum_approval',
  'curriculum_release',
  'application_release',
] as const
export type AdminAuditResourceType =
  (typeof ADMIN_AUDIT_RESOURCE_TYPES)[number]

export type AdminAuditScalar = string | number | boolean | null
export type AdminAuditValue = Readonly<
  Record<string, AdminAuditScalar | readonly AdminAuditScalar[]>
>

export interface AdminAuditEvent {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly eventId: string
  readonly occurredAt: string
  readonly actor: {
    readonly userRef: string
    readonly role: AdminRole
  }
  readonly action: AdminAuditAction
  readonly resource: {
    readonly type: AdminAuditResourceType
    readonly ref: string
    readonly version: string | null
    readonly revision: string | null
  }
  readonly previousValue: AdminAuditValue | null
  readonly newValue: AdminAuditValue | null
  readonly reasonCode: string | null
  readonly correlationId: string
}

export const ADMIN_CURRICULUM_LIFECYCLE = [
  'published',
  'draft_created',
  'editing',
  'validated',
  'previewed',
  'diff_reviewed',
  'approved',
  'published_new_version',
] as const
export type AdminCurriculumLifecycleState =
  (typeof ADMIN_CURRICULUM_LIFECYCLE)[number]
