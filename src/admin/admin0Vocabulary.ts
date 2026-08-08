/**
 * Faithful ADMIN-5 projection of the frozen ADMIN-0 vocabulary at
 * 9be368c5f311b99b1a0234dabb4a52b929220389.
 *
 * This branch predates ADMIN-0, so it cannot import src/admin/contracts.ts yet.
 * During integration these exports can be replaced with re-exports from that
 * canonical module without changing the ADMIN-5 presentation model.
 */
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

export const ADMIN_COST_KINDS = ['calculated', 'reconciled', 'unavailable'] as const
export type AdminCostKind = (typeof ADMIN_COST_KINDS)[number]

/** Canonical PostgreSQL BIGINT JSON representation from ADMIN-0. */
export type IntegerMicros = string

export function isCanonicalIntegerMicros(value: string): value is IntegerMicros {
  return /^(0|[1-9]\d*)$/.test(value)
}
