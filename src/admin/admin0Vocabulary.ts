/**
 * Faithful ADMIN-5 projection of the frozen ADMIN-0 vocabulary at
 * 73693f9e12a4a02546a4245bfea71143262e2df9 (contract version 2).
 *
 * This branch predates ADMIN-0, so it cannot import src/admin/contracts.ts yet.
 * During integration these exports can be replaced with re-exports from that
 * canonical module without changing the ADMIN-5 presentation model.
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

export const ADMIN_COST_KINDS = ['calculated', 'reconciled', 'unavailable'] as const
export type AdminCostKind = (typeof ADMIN_COST_KINDS)[number]

export const ADMIN_BILLING_DISPOSITIONS = ['billable', 'not_billable', 'unknown'] as const
export type AdminBillingDisposition = (typeof ADMIN_BILLING_DISPOSITIONS)[number]

export const ADMIN_HOUSEHOLD_ATTRIBUTION_STATES = [
  'resolved',
  'no_active_household',
  'ambiguous',
  'lookup_unavailable',
] as const
export type AdminHouseholdAttributionState = (typeof ADMIN_HOUSEHOLD_ATTRIBUTION_STATES)[number]

export const ADMIN_CURRENCIES = ['USD'] as const
export type AdminCurrency = (typeof ADMIN_CURRENCIES)[number]

/** Canonical PostgreSQL BIGINT JSON representation from ADMIN-0. */
export type IntegerMicros = string

export function isCanonicalIntegerMicros(value: string): value is IntegerMicros {
  return /^(0|[1-9]\d*)$/.test(value)
}
