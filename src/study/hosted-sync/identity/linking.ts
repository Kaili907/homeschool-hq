import type { FamilySetupState } from '../../family-pilot/setup'
import {
  DEVICE_LOCAL_IDENTITY_STATE,
  HOSTED_AUTHORITY_STATE,
  type AuthorizedStudentListResolution,
} from './contracts'

export const FAMILY_IDENTITY_LINK_SCHEMA_VERSION = 1 as const

export interface DeviceLocalFamilyIdentityState {
  readonly source: typeof DEVICE_LOCAL_IDENTITY_STATE
  readonly householdRef: string
  readonly setup: FamilySetupState
}

export interface ExplicitStudentIdentityLink {
  readonly localStudentRef: string
  readonly hostedStudentRef: Readonly<{ kind: 'academy-student-id'; value: string }>
}

/**
 * Durable convergence metadata may use this shape later, but this module does
 * not persist it. It is accepted only after an adult has explicitly reviewed
 * the household and each local-to-hosted student mapping.
 */
export interface ExplicitFamilyIdentityLink {
  readonly schemaVersion: typeof FAMILY_IDENTITY_LINK_SCHEMA_VERSION
  readonly kind: 'explicit-adult-confirmed-link'
  readonly localHouseholdRef: string
  readonly hostedHouseholdRef: string
  readonly studentLinks: readonly ExplicitStudentIdentityLink[]
  readonly confirmedAt: string
}

export type LocalHostedIdentityConvergence =
  | Readonly<{
      status: 'device-local-only'
      source: typeof DEVICE_LOCAL_IDENTITY_STATE
      offlineContinuation: 'requires-convergence-policy'
    }>
  | Readonly<{
      status: 'hosted-only'
      source: typeof HOSTED_AUTHORITY_STATE
    }>
  | Readonly<{
      status: 'explicit-link-required'
      localHouseholdRef: string
      hostedHouseholdRef: string
    }>
  | Readonly<{
      status: 'linked'
      localHouseholdRef: string
      hostedHouseholdRef: string
      studentLinks: readonly ExplicitStudentIdentityLink[]
    }>
  | Readonly<{
      status: 'review-required'
      reason:
        | 'hosted-authority-not-ready'
        | 'link-shape-invalid'
        | 'local-household-mismatch'
        | 'hosted-household-mismatch'
        | 'local-student-unmapped'
        | 'local-student-unknown'
        | 'hosted-student-unknown'
        | 'duplicate-student-link'
    }>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function parseLink(value: unknown): ExplicitFamilyIdentityLink | null {
  if (!isRecord(value)) return null
  const keys = Object.keys(value)
  if (
    keys.length !== 6 ||
    !['schemaVersion', 'kind', 'localHouseholdRef', 'hostedHouseholdRef', 'studentLinks', 'confirmedAt']
      .every((key) => keys.includes(key)) ||
    value.schemaVersion !== FAMILY_IDENTITY_LINK_SCHEMA_VERSION ||
    value.kind !== 'explicit-adult-confirmed-link' ||
    typeof value.localHouseholdRef !== 'string' ||
    value.localHouseholdRef.length < 1 ||
    typeof value.hostedHouseholdRef !== 'string' ||
    value.hostedHouseholdRef.length < 1 ||
    !Array.isArray(value.studentLinks) ||
    !isInstant(value.confirmedAt)
  ) return null

  const studentLinks: ExplicitStudentIdentityLink[] = []
  for (const candidate of value.studentLinks) {
    if (!isRecord(candidate) || Object.keys(candidate).length !== 2) return null
    if (
      typeof candidate.localStudentRef !== 'string' ||
      candidate.localStudentRef.length < 1 ||
      !isRecord(candidate.hostedStudentRef) ||
      Object.keys(candidate.hostedStudentRef).length !== 2 ||
      candidate.hostedStudentRef.kind !== 'academy-student-id' ||
      typeof candidate.hostedStudentRef.value !== 'string'
    ) return null
    studentLinks.push(Object.freeze({
      localStudentRef: candidate.localStudentRef,
      hostedStudentRef: Object.freeze({
        kind: 'academy-student-id',
        value: candidate.hostedStudentRef.value,
      }),
    }))
  }
  return Object.freeze({
    schemaVersion: FAMILY_IDENTITY_LINK_SCHEMA_VERSION,
    kind: 'explicit-adult-confirmed-link',
    localHouseholdRef: value.localHouseholdRef,
    hostedHouseholdRef: value.hostedHouseholdRef,
    studentLinks: Object.freeze(studentLinks),
    confirmedAt: value.confirmedAt,
  })
}

/**
 * Pure migration planner: no storage writes, network calls, ID generation, or
 * display-name matching. A same-name roster therefore still requires an exact
 * adult-confirmed mapping of stable identifiers.
 */
export function evaluateLocalHostedIdentityLink(input: Readonly<{
  local: DeviceLocalFamilyIdentityState | null
  hosted: AuthorizedStudentListResolution | null
  link?: ExplicitFamilyIdentityLink | unknown
}>): LocalHostedIdentityConvergence {
  if (!input.local) {
    return input.hosted?.status === 'authorized'
      ? Object.freeze({ status: 'hosted-only', source: HOSTED_AUTHORITY_STATE })
      : Object.freeze({ status: 'review-required', reason: 'hosted-authority-not-ready' })
  }
  if (!input.hosted) {
    return Object.freeze({
      status: 'device-local-only',
      source: DEVICE_LOCAL_IDENTITY_STATE,
      offlineContinuation: 'requires-convergence-policy',
    })
  }
  if (input.hosted.status !== 'authorized') {
    return Object.freeze({ status: 'review-required', reason: 'hosted-authority-not-ready' })
  }
  if (input.link === undefined) {
    return Object.freeze({
      status: 'explicit-link-required',
      localHouseholdRef: input.local.householdRef,
      hostedHouseholdRef: input.hosted.householdRef,
    })
  }

  const link = parseLink(input.link)
  if (!link) return Object.freeze({ status: 'review-required', reason: 'link-shape-invalid' })
  if (link.localHouseholdRef !== input.local.householdRef) {
    return Object.freeze({ status: 'review-required', reason: 'local-household-mismatch' })
  }
  if (link.hostedHouseholdRef !== input.hosted.householdRef) {
    return Object.freeze({ status: 'review-required', reason: 'hosted-household-mismatch' })
  }

  const localRefs = new Set(input.local.setup.students.map((student) => student.studentRef))
  const hostedRefs = new Set(input.hosted.students.map((student) => student.studentRef.value))
  const linkedLocalRefs = new Set<string>()
  const linkedHostedRefs = new Set<string>()
  for (const studentLink of link.studentLinks) {
    if (!localRefs.has(studentLink.localStudentRef)) {
      return Object.freeze({ status: 'review-required', reason: 'local-student-unknown' })
    }
    if (!hostedRefs.has(studentLink.hostedStudentRef.value)) {
      return Object.freeze({ status: 'review-required', reason: 'hosted-student-unknown' })
    }
    if (
      linkedLocalRefs.has(studentLink.localStudentRef) ||
      linkedHostedRefs.has(studentLink.hostedStudentRef.value)
    ) return Object.freeze({ status: 'review-required', reason: 'duplicate-student-link' })
    linkedLocalRefs.add(studentLink.localStudentRef)
    linkedHostedRefs.add(studentLink.hostedStudentRef.value)
  }
  if ([...localRefs].some((studentRef) => !linkedLocalRefs.has(studentRef))) {
    return Object.freeze({ status: 'review-required', reason: 'local-student-unmapped' })
  }
  return Object.freeze({
    status: 'linked',
    localHouseholdRef: link.localHouseholdRef,
    hostedHouseholdRef: link.hostedHouseholdRef,
    studentLinks: link.studentLinks,
  })
}
