import {
  ADMIN_CONTRACT_VERSION,
  ADMIN_ROLE_CAPABILITIES,
  type AdminCapability,
  type AdminRole,
} from './contracts'

export const ADMIN_ACCESS_READ_CAPABILITY = 'overview:read' as const
export const ADMIN_ACCESS_MANAGE_CAPABILITY = 'admin_roles:manage' as const
export const ADMIN_ACCESS_REASON_CODES = [
  'operator.request',
  'policy.enforcement',
  'corrective.action',
  'emergency.response',
] as const

export type AdminAccessReasonCode = (typeof ADMIN_ACCESS_REASON_CODES)[number]

export interface AdminAccessPrincipal {
  readonly principalRef: string
  readonly assignmentRef: string
  readonly role: AdminRole
  readonly status: 'active'
  readonly revision: string
  readonly isCurrent: boolean
  /** Display-only derivation from the canonical role contract; never authority. */
  readonly capabilities: readonly AdminCapability[]
}

export interface AdminAccessProjection {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly principals: readonly AdminAccessPrincipal[]
}

export type AdminAccessReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly projection: AdminAccessProjection }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'error'; readonly code: 'access_timeout' | 'access_unavailable' | 'access_malformed' }

export type AdminAccessMutationRequest =
  | {
      readonly action: 'change-role'
      readonly assignmentRef: string
      readonly expectedRevision: string
      readonly newRole: AdminRole
      readonly reasonCode: AdminAccessReasonCode
      readonly requestId: string
    }
  | {
      readonly action: 'revoke'
      readonly assignmentRef: string
      readonly expectedRevision: string
      readonly reasonCode: AdminAccessReasonCode
      readonly requestId: string
    }

export interface AdminAccessMutationResult {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly assignmentRef: string
  readonly role: AdminRole
  readonly status: 'active' | 'revoked'
  readonly revision: string
  readonly idempotencyResult: 'applied' | 'replayed'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const POSITIVE_REVISION = /^[1-9]\d*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
}

function isRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && Object.hasOwn(ADMIN_ROLE_CAPABILITIES, value)
}

export function sanitizeAdminAccessProjection(value: unknown): AdminAccessProjection | null {
  if (!isRecord(value) || !hasExactKeys(value, ['schemaVersion', 'principals'])
    || value.schemaVersion !== ADMIN_CONTRACT_VERSION || !Array.isArray(value.principals)
    || value.principals.length > 250) return null

  const principalRefs = new Set<string>()
  const assignmentRefs = new Set<string>()
  let currentCount = 0
  const principals: AdminAccessPrincipal[] = []
  for (const candidate of value.principals) {
    if (!isRecord(candidate)) return null
    const baseKeys = [
      'principalRef', 'assignmentRef', 'role', 'status', 'revision', 'isCurrent',
    ] as const
    const keysAreSafe = hasExactKeys(candidate, baseKeys)
      || hasExactKeys(candidate, [...baseKeys, 'capabilities'])
    if (!keysAreSafe || typeof candidate.principalRef !== 'string' || !UUID.test(candidate.principalRef)
      || typeof candidate.assignmentRef !== 'string' || !UUID.test(candidate.assignmentRef)
      || !isRole(candidate.role) || candidate.status !== 'active'
      || typeof candidate.revision !== 'string' || !POSITIVE_REVISION.test(candidate.revision)
      || typeof candidate.isCurrent !== 'boolean'
      || principalRefs.has(candidate.principalRef)
      || assignmentRefs.has(candidate.assignmentRef)) return null
    const expectedCapabilities = ADMIN_ROLE_CAPABILITIES[candidate.role]
    if (Object.hasOwn(candidate, 'capabilities') && (
      !Array.isArray(candidate.capabilities)
      || candidate.capabilities.length !== expectedCapabilities.length
      || candidate.capabilities.some((capability, index) => capability !== expectedCapabilities[index])
    )) return null
    principalRefs.add(candidate.principalRef)
    assignmentRefs.add(candidate.assignmentRef)
    if (candidate.isCurrent) currentCount += 1
    principals.push(Object.freeze({
      principalRef: candidate.principalRef.toLowerCase(),
      assignmentRef: candidate.assignmentRef.toLowerCase(),
      role: candidate.role,
      status: 'active',
      revision: candidate.revision,
      isCurrent: candidate.isCurrent,
      capabilities: expectedCapabilities,
    }))
  }
  if (currentCount !== 1) return null
  return Object.freeze({
    schemaVersion: ADMIN_CONTRACT_VERSION,
    principals: Object.freeze(principals),
  })
}

export function sanitizeAdminAccessMutationResult(value: unknown): AdminAccessMutationResult | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'schemaVersion', 'assignmentRef', 'role', 'status', 'revision', 'idempotencyResult',
  ]) || value.schemaVersion !== ADMIN_CONTRACT_VERSION
    || typeof value.assignmentRef !== 'string' || !UUID.test(value.assignmentRef)
    || !isRole(value.role)
    || (value.status !== 'active' && value.status !== 'revoked')
    || typeof value.revision !== 'string' || !POSITIVE_REVISION.test(value.revision)
    || (value.idempotencyResult !== 'applied' && value.idempotencyResult !== 'replayed')) return null
  return Object.freeze({
    schemaVersion: ADMIN_CONTRACT_VERSION,
    assignmentRef: value.assignmentRef.toLowerCase(),
    role: value.role,
    status: value.status,
    revision: value.revision,
    idempotencyResult: value.idempotencyResult,
  })
}

export function shortPrincipalRef(principalRef: string): string {
  return `Principal ${principalRef.slice(0, 8)}`
}
