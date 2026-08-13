import { parseStudySessionGrant } from '../../contracts/identity/session'
import {
  HOSTED_AUTHORITY_STATE,
  STUDY_SESSION_HEADER,
  type AdultIdentityResolution,
  type AuthorizationHeadersInput,
  type AuthorizationHeadersResolution,
  type AuthorizedHouseholdIdentity,
  type AuthorizedStudentAuthority,
  type AuthorizedStudentListResolution,
  type CreateHostedFamilyIdentityBridgeOptions,
  type HostedAdultAuthenticationState,
  type HostedAuthorizationInterruption,
  type HostedAuthorityRejected,
  type HostedAuthorityUnavailable,
  type HostedFamilyIdentityBridge,
  type HostedFamilyIdentityFailure,
  type HouseholdIdentityResolution,
  type ResolvedHostedFamilyAuthority,
  type StudentAuthorityResolution,
  type StudySessionGrantInstallResult,
} from './contracts'
import {
  parseHostedAdultAuthorizationEnvelope,
  parseHostedFamilyAuthorityEnvelope,
  parseHostedStudentRef,
  parseRequestHeaders,
} from './validation'

type AuthorityReadResult =
  | Readonly<{ status: 'authorized'; authority: ResolvedHostedFamilyAuthority }>
  | HostedFamilyIdentityFailure

interface StudentTicket {
  readonly generation: number
  readonly adultRef: string
  readonly householdRef: string
  readonly studentRef: string
  readonly authorityRevision: number
  readonly expiresAt: string
}

interface InstalledGrant {
  readonly sessionReference: string
  readonly studentRef: string
  readonly generation: number
  readonly expiresAt: string
}

function adultInterruption(state: HostedAdultAuthenticationState): HostedAuthorizationInterruption {
  return Object.freeze({
    status: 'interrupted',
    source: HOSTED_AUTHORITY_STATE,
    state,
    interruption: Object.freeze({
      kind: 'session-authorization',
      reason: 'adult-authentication-rejected',
    }),
  })
}

function studyInterruption(
  state: 'study-session-missing' | 'study-session-expired' | 'study-session-revoked',
): HostedAuthorizationInterruption {
  return Object.freeze({
    status: 'interrupted',
    source: HOSTED_AUTHORITY_STATE,
    state,
    interruption: Object.freeze({
      kind: 'session-authorization',
      reason: 'study-session-rejected',
    }),
  })
}

function unavailable(reason: HostedAuthorityUnavailable['reason']): HostedAuthorityUnavailable {
  return Object.freeze({ status: 'unavailable', source: HOSTED_AUTHORITY_STATE, reason })
}

function rejected(reason: HostedAuthorityRejected['reason']): HostedAuthorityRejected {
  return Object.freeze({ status: 'rejected', source: HOSTED_AUTHORITY_STATE, reason })
}

function earliestExpiration(...values: readonly string[]): string {
  return new Date(Math.min(...values.map((value) => Date.parse(value)))).toISOString()
}

function authorityFingerprint(authority: ResolvedHostedFamilyAuthority): string {
  return JSON.stringify({
    adultRef: authority.adult.adultRef,
    householdRef: authority.household.householdRef,
    authorityRevision: authority.household.authorityRevision,
    students: authority.students,
  })
}

/**
 * Browser-only identity and authorization context. It does not initialize an
 * auth SDK, contact a hosted service, or touch persistence until a caller
 * invokes a method and the supplied provider chooses to do so.
 */
export function createHostedFamilyIdentityBridge(
  options: CreateHostedFamilyIdentityBridgeOptions,
): HostedFamilyIdentityBridge {
  const now = options.now ?? Date.now
  const tickets = new WeakMap<object, StudentTicket>()
  let authority: ResolvedHostedFamilyAuthority | null = null
  let fingerprint: string | null = null
  let generation = 0
  let installedGrant: InstalledGrant | null = null
  let clearedGrantState: 'study-session-missing' | 'study-session-revoked' = 'study-session-missing'
  let pendingAuthorityRead: Promise<AuthorityReadResult> | null = null

  function clearGrant(reason: 'manual' | 'revoked' = 'manual'): void {
    installedGrant = null
    clearedGrantState = reason === 'revoked' ? 'study-session-revoked' : 'study-session-missing'
  }

  function invalidateAuthority(): void {
    generation += 1
    authority = null
    fingerprint = null
    clearGrant()
  }

  function applyAuthority(next: ResolvedHostedFamilyAuthority): AuthorityReadResult {
    if (
      options.expectedHouseholdRef !== undefined &&
      next.household.householdRef !== options.expectedHouseholdRef
    ) {
      invalidateAuthority()
      return rejected('wrong-household')
    }
    if (Date.parse(next.household.expiresAt) <= now()) {
      invalidateAuthority()
      return adultInterruption('expired')
    }
    const nextFingerprint = authorityFingerprint(next)
    if (nextFingerprint !== fingerprint) {
      generation += 1
      clearGrant()
      fingerprint = nextFingerprint
    }
    // A same-authority auth refresh may extend the envelope without changing
    // household or roster identity. Keep the new expiration without revoking a
    // student ticket or Study grant that is already bounded more tightly.
    authority = next
    return Object.freeze({ status: 'authorized', authority: next })
  }

  async function performAuthorityRead(signal?: AbortSignal): Promise<AuthorityReadResult> {
    let raw: unknown
    try {
      raw = await options.provider.readHostedAuthority(signal)
    } catch {
      return unavailable('hosted-authority-unavailable')
    }
    const envelope = parseHostedFamilyAuthorityEnvelope(raw)
    if (!envelope) {
      invalidateAuthority()
      return unavailable('hosted-authority-invalid')
    }
    if (envelope.status === 'unavailable') return unavailable('hosted-authority-unavailable')
    if (envelope.status !== 'authorized') {
      invalidateAuthority()
      return adultInterruption(envelope.status)
    }
    const adult = Object.freeze({
      source: HOSTED_AUTHORITY_STATE,
      adultRef: envelope.adult.adultRef,
      expiresAt: envelope.expiresAt,
    })
    const household: AuthorizedHouseholdIdentity = Object.freeze({
      source: HOSTED_AUTHORITY_STATE,
      adultRef: envelope.adult.adultRef,
      householdRef: envelope.household.householdRef,
      relationship: envelope.household.relationship,
      authorityRevision: envelope.household.authorityRevision,
      expiresAt: envelope.expiresAt,
    })
    return applyAuthority(Object.freeze({
      source: HOSTED_AUTHORITY_STATE,
      adult,
      household,
      students: envelope.students,
    }))
  }

  function readAuthority(signal?: AbortSignal): Promise<AuthorityReadResult> {
    if (pendingAuthorityRead) return pendingAuthorityRead
    const read = performAuthorityRead(signal)
    pendingAuthorityRead = read
    void read.finally(() => {
      if (pendingAuthorityRead === read) pendingAuthorityRead = null
    })
    return read
  }

  function ticketFor(candidate: AuthorizedStudentAuthority): StudentTicket | null {
    const ticket = tickets.get(candidate as object)
    if (
      !ticket ||
      !authority ||
      ticket.generation !== generation ||
      ticket.adultRef !== authority.adult.adultRef ||
      ticket.householdRef !== authority.household.householdRef ||
      ticket.authorityRevision !== authority.household.authorityRevision ||
      Date.parse(ticket.expiresAt) <= now()
    ) return null
    return ticket
  }

  async function resolveAdultIdentity(signal?: AbortSignal): Promise<AdultIdentityResolution> {
    const result = await readAuthority(signal)
    return result.status === 'authorized'
      ? Object.freeze({ status: 'authenticated', identity: result.authority.adult })
      : result
  }

  async function resolveHousehold(signal?: AbortSignal): Promise<HouseholdIdentityResolution> {
    const result = await readAuthority(signal)
    return result.status === 'authorized'
      ? Object.freeze({ status: 'authorized', household: result.authority.household })
      : result
  }

  async function listAuthorizedStudents(signal?: AbortSignal): Promise<AuthorizedStudentListResolution> {
    const result = await readAuthority(signal)
    return result.status === 'authorized'
      ? Object.freeze({
          status: 'authorized',
          householdRef: result.authority.household.householdRef,
          students: result.authority.students,
        })
      : result
  }

  async function assertStudentAuthority(
    studentRef: unknown,
    signal?: AbortSignal,
  ): Promise<StudentAuthorityResolution> {
    const parsedRef = parseHostedStudentRef(studentRef)
    if (!parsedRef) return rejected('tampered-student-ref')
    const result = await readAuthority(signal)
    if (result.status !== 'authorized') return result
    const student = result.authority.students.find(
      (candidate) => candidate.studentRef.value === parsedRef.value,
    )
    if (!student) return rejected('unknown-student')
    const studentAuthority: AuthorizedStudentAuthority = Object.freeze({
      source: HOSTED_AUTHORITY_STATE,
      householdRef: result.authority.household.householdRef,
      studentRef: parsedRef,
      authorityRevision: result.authority.household.authorityRevision,
      expiresAt: result.authority.household.expiresAt,
    })
    tickets.set(studentAuthority, Object.freeze({
      generation,
      adultRef: result.authority.adult.adultRef,
      householdRef: result.authority.household.householdRef,
      studentRef: parsedRef.value,
      authorityRevision: result.authority.household.authorityRevision,
      expiresAt: result.authority.household.expiresAt,
    }))
    return Object.freeze({ status: 'authorized', authority: studentAuthority, student })
  }

  function installStudySessionGrant(
    studentAuthority: AuthorizedStudentAuthority,
    value: unknown,
  ): StudySessionGrantInstallResult {
    // A rotation attempt invalidates the previous reference before any caller-
    // controlled value is inspected. Failed rotation therefore fails closed.
    clearGrant()
    const ticket = ticketFor(studentAuthority)
    if (!ticket) return Object.freeze({ status: 'rejected', reason: 'stale-student-authority' })
    const grant = parseStudySessionGrant(value)
    if (!grant) return Object.freeze({ status: 'rejected', reason: 'study-session-grant-invalid' })
    if (Date.parse(grant.expiresAt) <= now()) {
      return Object.freeze({ status: 'rejected', reason: 'study-session-grant-expired' })
    }
    installedGrant = Object.freeze({
      sessionReference: grant.sessionReference,
      studentRef: ticket.studentRef,
      generation: ticket.generation,
      expiresAt: grant.expiresAt,
    })
    return Object.freeze({
      status: 'installed',
      expiresAt: earliestExpiration(grant.expiresAt, ticket.expiresAt),
    })
  }

  async function getAuthorizationHeaders(
    input: AuthorizationHeadersInput,
  ): Promise<AuthorizationHeadersResolution> {
    const baseHeaders = parseRequestHeaders(input.headers ?? {}, {
      requireAuthorization: false,
      providerHeaders: false,
    })
    if (!baseHeaders || Object.keys(baseHeaders).some((name) => {
      const normalized = name.toLowerCase()
      return normalized === 'authorization' || normalized === STUDY_SESSION_HEADER
    })) return rejected('invalid-request-headers')

    const resolved = await readAuthority(input.signal)
    if (resolved.status !== 'authorized') return resolved
    const operationGeneration = generation
    const studentTicket = input.scope === 'study' ? ticketFor(input.authority) : null
    if (input.scope === 'study' && !studentTicket) return rejected('stale-student-authority')

    if (input.scope === 'study') {
      if (!installedGrant) return studyInterruption(clearedGrantState)
      if (installedGrant.generation !== generation) {
        clearGrant()
        return rejected('stale-student-authority')
      }
      if (installedGrant.studentRef !== studentTicket?.studentRef) {
        return rejected('student-authority-mismatch')
      }
      if (Date.parse(installedGrant.expiresAt) <= now()) {
        installedGrant = null
        clearedGrantState = 'study-session-missing'
        return studyInterruption('study-session-expired')
      }
    }

    let rawAuthorization: unknown
    try {
      rawAuthorization = await options.provider.authorizeAdultRequest(input.signal)
    } catch {
      return unavailable('hosted-authority-unavailable')
    }
    const authorization = parseHostedAdultAuthorizationEnvelope(rawAuthorization)
    if (!authorization) {
      invalidateAuthority()
      return unavailable('authorization-headers-invalid')
    }
    if (authorization.status === 'unavailable') return unavailable('hosted-authority-unavailable')
    if (authorization.status !== 'authorized') {
      invalidateAuthority()
      return adultInterruption(authorization.status)
    }
    if (Date.parse(authorization.expiresAt) <= now()) {
      invalidateAuthority()
      return adultInterruption('expired')
    }
    if (
      operationGeneration !== generation ||
      !authority ||
      authorization.adultRef !== authority.adult.adultRef ||
      authorization.householdRef !== authority.household.householdRef ||
      authorization.authorityRevision !== authority.household.authorityRevision
    ) {
      const wrongExpectedHousehold = options.expectedHouseholdRef !== undefined &&
        authorization.householdRef !== options.expectedHouseholdRef
      invalidateAuthority()
      return rejected(wrongExpectedHousehold ? 'wrong-household' : 'stale-student-authority')
    }

    let grantExpiration: string | null = null
    const headers: Record<string, string> = { ...baseHeaders, ...authorization.headers }
    if (input.scope === 'study') {
      const currentGrant = installedGrant
      const currentTicket = ticketFor(input.authority)
      if (!currentGrant || !currentTicket || currentGrant.studentRef !== currentTicket.studentRef) {
        return rejected('stale-student-authority')
      }
      headers[STUDY_SESSION_HEADER] = currentGrant.sessionReference
      grantExpiration = currentGrant.expiresAt
    }

    return Object.freeze({
      status: 'authorized',
      headers: Object.freeze(headers),
      expiresAt: earliestExpiration(
        resolved.authority.household.expiresAt,
        authorization.expiresAt,
        ...(grantExpiration ? [grantExpiration] : []),
      ),
    })
  }

  return Object.freeze({
    resolveAdultIdentity,
    resolveHousehold,
    listAuthorizedStudents,
    assertStudentAuthority,
    installStudySessionGrant,
    clearStudySessionGrant: clearGrant,
    getAuthorizationHeaders,
  })
}
