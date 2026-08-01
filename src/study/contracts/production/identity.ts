import type { StudyProductionErrorCode } from './errors'
import { STUDY_AUTHORIZATION_SCHEMA_VERSION, STUDY_IDENTITY_SCHEMA_VERSION } from './versions'

declare const SERVER_DERIVED_ID: unique symbol

export type ServerDerivedId<Kind extends string> = string & {
  readonly [SERVER_DERIVED_ID]: Kind
}

export type AuthenticatedUserId = ServerDerivedId<'authenticated-user'>
export type HouseholdId = ServerDerivedId<'household'>
export type StudentId = ServerDerivedId<'student'>
export type LearnerSessionId = ServerDerivedId<'learner-session'>
export type MembershipId = ServerDerivedId<'membership'>
export type RelationshipId = ServerDerivedId<'guardian-student-relationship'>
export type StudentSessionGrantId = ServerDerivedId<'student-session-grant'>
export type StaffMembershipId = ServerDerivedId<'staff-membership'>
export type NotificationPermissionId = ServerDerivedId<'notification-permission'>
export type StableRecipientRef = ServerDerivedId<'stable-recipient-ref'>
export type StableRouteRef = ServerDerivedId<'stable-route-ref'>
export type AuthorizationEvidenceRef = ServerDerivedId<'authorization-evidence'>

export type GuardianLearnerPermission = 'viewer' | 'learning_manager' | 'identity_manager'
export type StudentStudyCapability =
  | 'student:assignments:read'
  | 'student:attempts:create'
  | 'student:progress:read'
export type StaffStudyPermission = 'study:read' | 'study:manage' | 'study:adult-private' | 'study:notify'

export interface IdentityLifecycleEpochs {
  readonly authenticatedSession: number
  readonly household: number
  readonly learner: number
  readonly membership: number
  readonly relationship: number
}

export interface AuthorizationWindow {
  readonly revision: number
  readonly issuedAt: string
  readonly expiresAt: string
  readonly lifecycleEpochs: IdentityLifecycleEpochs
}

export interface AuthenticatedHouseholdContext {
  readonly schemaVersion: typeof STUDY_IDENTITY_SCHEMA_VERSION
  readonly authenticatedUserId: AuthenticatedUserId
  readonly householdId: HouseholdId
  readonly membershipId: MembershipId
}

export interface AuthenticatedLearnerContext extends AuthenticatedHouseholdContext {
  readonly studentId: StudentId
  readonly learnerSessionId: LearnerSessionId
  readonly relationshipId: RelationshipId
}

interface ServerAuthorityBase {
  readonly schemaVersion: typeof STUDY_AUTHORIZATION_SCHEMA_VERSION
  readonly authoritySource: 'verified-server'
  readonly evidenceRef: AuthorizationEvidenceRef
  readonly householdId: HouseholdId
  readonly studentId: StudentId
  readonly learnerSessionId: LearnerSessionId
  readonly window: AuthorizationWindow
}

export interface GuardianStudyAuthority extends ServerAuthorityBase {
  readonly actorKind: 'guardian'
  readonly authenticatedUserId: AuthenticatedUserId
  readonly membershipId: MembershipId
  readonly relationshipId: RelationshipId
  readonly permission: GuardianLearnerPermission
}

export interface StudentSessionStudyAuthority extends ServerAuthorityBase {
  readonly actorKind: 'student-session'
  readonly studentSessionGrantId: StudentSessionGrantId
  readonly sessionVersion: number
  readonly capabilities: readonly StudentStudyCapability[]
  readonly issuerVersion: string
}

export interface StaffStudyAuthority extends ServerAuthorityBase {
  readonly actorKind: 'staff'
  readonly authenticatedUserId: AuthenticatedUserId
  readonly staffMembershipId: StaffMembershipId
  readonly permissions: readonly StaffStudyPermission[]
  readonly approvedModelVersion: string
  readonly auditEvidenceRef: AuthorizationEvidenceRef
}

export type StudyProductionAuthority =
  | GuardianStudyAuthority
  | StudentSessionStudyAuthority
  | StaffStudyAuthority

export interface AuthorizedAdultNotificationRoute {
  readonly recipientRef: StableRecipientRef
  readonly routeRef: StableRouteRef
  readonly notificationPermissionId: NotificationPermissionId
  readonly membershipId: MembershipId
  readonly relationshipId: RelationshipId
  readonly householdId: HouseholdId
  readonly studentId: StudentId
  readonly channel: 'email' | 'in-app' | 'sms'
  readonly authorizationRevision: number
  readonly expiresAt: string
  readonly evidenceRef: AuthorizationEvidenceRef
}

export type AuthorizationDecision<T> =
  | { readonly status: 'authorized'; readonly authority: T }
  | { readonly status: 'denied'; readonly code: StudyProductionErrorCode }
  | { readonly status: 'not-ready'; readonly code: StudyProductionErrorCode }

export interface ServerGuardianAuthorizationEvidence {
  readonly authoritySource: 'verified-server'
  readonly evidenceRef: string
  readonly authenticatedUserId: string
  readonly householdId: string
  readonly studentId: string
  readonly learnerSessionId: string
  readonly membershipId: string
  readonly relationshipId: string
  readonly householdStatus: 'active' | 'archived'
  readonly learnerStatus: 'invited' | 'active' | 'paused' | 'transferred' | 'graduated' | 'archived' | 'deactivated'
  readonly membershipStatus: 'invited' | 'active' | 'revoked'
  readonly memberRole: 'guardian' | 'other'
  readonly relationshipStatus: 'active' | 'revoked'
  readonly permission: GuardianLearnerPermission
  readonly window: AuthorizationWindow
}

export interface ServerStudentSessionAuthorizationEvidence {
  readonly authoritySource: 'verified-server'
  readonly evidenceRef: string
  readonly householdId: string
  readonly studentId: string
  readonly learnerSessionId: string
  readonly studentSessionGrantId: string
  readonly householdStatus: 'active' | 'archived'
  readonly learnerStatus: 'invited' | 'active' | 'paused' | 'transferred' | 'graduated' | 'archived' | 'deactivated'
  readonly grantStatus: 'active' | 'revoked'
  readonly sessionVersion: number
  readonly currentSessionVersion: number
  readonly capabilities: readonly StudentStudyCapability[]
  readonly issuerAvailable: boolean
  readonly issuerVersion: string | null
  readonly window: AuthorizationWindow
}

export interface ServerStaffAuthorizationEvidence {
  readonly authoritySource: 'verified-server'
  readonly evidenceRef: string
  readonly authenticatedUserId: string
  readonly householdId: string
  readonly studentId: string
  readonly learnerSessionId: string
  readonly staffMembershipId: string
  readonly staffStatus: 'active' | 'revoked'
  readonly householdStatus: 'active' | 'archived'
  readonly learnerStatus: 'active' | 'inactive'
  readonly permissions: readonly StaffStudyPermission[]
  readonly approvedModelVersion: string | null
  readonly auditEvidenceRef: string | null
  readonly window: AuthorizationWindow
}

export interface ServerAdultNotificationEvidence {
  readonly authoritySource: 'verified-server'
  readonly evidenceRef: string
  readonly householdId: string
  readonly studentId: string
  readonly recipientRef: string
  readonly routeRef: string
  readonly notificationPermissionId: string
  readonly membershipId: string
  readonly relationshipId: string
  readonly membershipStatus: 'active' | 'revoked'
  readonly relationshipStatus: 'active' | 'revoked'
  readonly permissionStatus: 'active' | 'revoked'
  readonly memberRole: 'guardian' | 'other'
  readonly channel: 'email' | 'in-app' | 'sms'
  readonly authorizationRevision: number
  readonly expiresAt: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FORBIDDEN_IDENTIFIER_TEXT = /(?:^|[\s:._/-])(synthetic|sentinel|fixture|preview|example|test)(?:$|[\s:._/-])/i
const REPEATED_UUID = /^([0-9a-f])\1{7}-\1{4}-\1{4}-\1{4}-\1{12}$/i

export function isProductionIdentityId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value) && !REPEATED_UUID.test(value) && !FORBIDDEN_IDENTIFIER_TEXT.test(value)
}

export function isStableServerReference(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length >= 16 &&
    value.length <= 200 &&
    !FORBIDDEN_IDENTIFIER_TEXT.test(value) &&
    !value.includes('@') &&
    !/^\+?[0-9][0-9 ()-]{6,}$/.test(value)
}

function id<Kind extends string>(value: string): ServerDerivedId<Kind> {
  return value as ServerDerivedId<Kind>
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function validInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validWindow(window: AuthorizationWindow, now: Date): StudyProductionErrorCode | null {
  if (!positiveInteger(window?.revision) || !validInstant(window?.issuedAt) || !validInstant(window?.expiresAt)) {
    return 'authorization-stale'
  }
  if (Date.parse(window.expiresAt) <= now.getTime()) return 'authorization-expired'
  if (Date.parse(window.issuedAt) > now.getTime()) return 'authorization-stale'
  const epochs = window.lifecycleEpochs
  if (!epochs || Object.values(epochs).some((epoch) => !positiveInteger(epoch))) return 'lifecycle-epoch-stale'
  return null
}

function immutableWindow(window: AuthorizationWindow): AuthorizationWindow {
  return Object.freeze({
    revision: window.revision,
    issuedAt: window.issuedAt,
    expiresAt: window.expiresAt,
    lifecycleEpochs: Object.freeze({ ...window.lifecycleEpochs }),
  })
}

function validIdentityIds(values: readonly unknown[]): StudyProductionErrorCode | null {
  for (const value of values) {
    if (typeof value === 'string' && FORBIDDEN_IDENTIFIER_TEXT.test(value)) return 'synthetic-identifier-rejected'
    if (!isProductionIdentityId(value)) return 'invalid-production-identifier'
  }
  return null
}

function validEvidenceRef(value: unknown): value is string {
  return isStableServerReference(value) && !/^(?:email|phone|sms|address):/i.test(value)
}

export function authorizeGuardianStudy(
  evidence: ServerGuardianAuthorizationEvidence,
  now = new Date(),
  requiredPermission: GuardianLearnerPermission = 'viewer',
): AuthorizationDecision<GuardianStudyAuthority> {
  if (evidence.authoritySource !== 'verified-server') return { status: 'denied', code: 'browser-authority-claim-rejected' }
  const invalidId = validIdentityIds([
    evidence.authenticatedUserId,
    evidence.householdId,
    evidence.studentId,
    evidence.learnerSessionId,
    evidence.membershipId,
    evidence.relationshipId,
  ])
  if (invalidId || !validEvidenceRef(evidence.evidenceRef)) return { status: 'denied', code: invalidId ?? 'invalid-production-identifier' }
  if (evidence.householdStatus !== 'active') return { status: 'denied', code: 'household-not-active' }
  if (evidence.learnerStatus !== 'active') return { status: 'denied', code: 'learner-not-active' }
  if (evidence.membershipStatus !== 'active') return { status: 'denied', code: 'membership-not-active' }
  if (evidence.memberRole !== 'guardian') return { status: 'denied', code: 'guardian-role-required' }
  if (evidence.relationshipStatus !== 'active') return { status: 'denied', code: 'relationship-not-active' }
  const permissionRank: Readonly<Record<GuardianLearnerPermission, number>> = {
    viewer: 1,
    learning_manager: 2,
    identity_manager: 3,
  }
  if (!permissionRank[evidence.permission] || permissionRank[evidence.permission] < permissionRank[requiredPermission]) {
    return { status: 'denied', code: 'learner-permission-required' }
  }
  const windowError = validWindow(evidence.window, now)
  if (windowError) return { status: 'denied', code: windowError }
  return {
    status: 'authorized',
    authority: Object.freeze({
      schemaVersion: STUDY_AUTHORIZATION_SCHEMA_VERSION,
      authoritySource: 'verified-server',
      actorKind: 'guardian',
      evidenceRef: id<'authorization-evidence'>(evidence.evidenceRef),
      authenticatedUserId: id<'authenticated-user'>(evidence.authenticatedUserId),
      householdId: id<'household'>(evidence.householdId),
      studentId: id<'student'>(evidence.studentId),
      learnerSessionId: id<'learner-session'>(evidence.learnerSessionId),
      membershipId: id<'membership'>(evidence.membershipId),
      relationshipId: id<'guardian-student-relationship'>(evidence.relationshipId),
      permission: evidence.permission,
      window: immutableWindow(evidence.window),
    }),
  }
}

export function authorizeStudentSessionStudy(
  evidence: ServerStudentSessionAuthorizationEvidence,
  requiredCapability: StudentStudyCapability,
  now = new Date(),
): AuthorizationDecision<StudentSessionStudyAuthority> {
  if (!evidence.issuerAvailable || !evidence.issuerVersion) {
    return { status: 'not-ready', code: 'student-session-issuer-unavailable' }
  }
  if (evidence.authoritySource !== 'verified-server') return { status: 'denied', code: 'browser-authority-claim-rejected' }
  const invalidId = validIdentityIds([
    evidence.householdId,
    evidence.studentId,
    evidence.learnerSessionId,
    evidence.studentSessionGrantId,
  ])
  if (invalidId || !validEvidenceRef(evidence.evidenceRef)) return { status: 'denied', code: invalidId ?? 'invalid-production-identifier' }
  if (evidence.householdStatus !== 'active') return { status: 'denied', code: 'household-not-active' }
  if (evidence.learnerStatus !== 'active') return { status: 'denied', code: 'learner-not-active' }
  if (evidence.grantStatus !== 'active') return { status: 'denied', code: 'student-session-revoked' }
  if (!positiveInteger(evidence.sessionVersion) || evidence.sessionVersion !== evidence.currentSessionVersion) {
    return { status: 'denied', code: 'student-session-invalid' }
  }
  if (!evidence.capabilities.includes(requiredCapability)) return { status: 'denied', code: 'learner-permission-required' }
  const windowError = validWindow(evidence.window, now)
  if (windowError) {
    return { status: 'denied', code: windowError === 'authorization-expired' ? 'student-session-expired' : windowError }
  }
  return {
    status: 'authorized',
    authority: Object.freeze({
      schemaVersion: STUDY_AUTHORIZATION_SCHEMA_VERSION,
      authoritySource: 'verified-server',
      actorKind: 'student-session',
      evidenceRef: id<'authorization-evidence'>(evidence.evidenceRef),
      householdId: id<'household'>(evidence.householdId),
      studentId: id<'student'>(evidence.studentId),
      learnerSessionId: id<'learner-session'>(evidence.learnerSessionId),
      studentSessionGrantId: id<'student-session-grant'>(evidence.studentSessionGrantId),
      sessionVersion: evidence.sessionVersion,
      capabilities: Object.freeze([...evidence.capabilities]),
      issuerVersion: evidence.issuerVersion,
      window: immutableWindow(evidence.window),
    }),
  }
}

export function authorizeStaffStudy(
  evidence: ServerStaffAuthorizationEvidence,
  requiredPermission: StaffStudyPermission,
  now = new Date(),
): AuthorizationDecision<StaffStudyAuthority> {
  if (!evidence.approvedModelVersion || !evidence.auditEvidenceRef) {
    return { status: 'not-ready', code: 'staff-authorization-disabled' }
  }
  if (evidence.authoritySource !== 'verified-server') return { status: 'denied', code: 'browser-authority-claim-rejected' }
  const invalidId = validIdentityIds([
    evidence.authenticatedUserId,
    evidence.householdId,
    evidence.studentId,
    evidence.learnerSessionId,
    evidence.staffMembershipId,
  ])
  if (invalidId || !validEvidenceRef(evidence.evidenceRef) || !validEvidenceRef(evidence.auditEvidenceRef)) {
    return { status: 'denied', code: invalidId ?? 'invalid-production-identifier' }
  }
  if (evidence.staffStatus !== 'active') return { status: 'denied', code: 'authorization-revoked' }
  if (evidence.householdStatus !== 'active') return { status: 'denied', code: 'household-not-active' }
  if (evidence.learnerStatus !== 'active') return { status: 'denied', code: 'learner-not-active' }
  if (!evidence.permissions.includes(requiredPermission)) return { status: 'denied', code: 'staff-permission-required' }
  const windowError = validWindow(evidence.window, now)
  if (windowError) return { status: 'denied', code: windowError }
  return {
    status: 'authorized',
    authority: Object.freeze({
      schemaVersion: STUDY_AUTHORIZATION_SCHEMA_VERSION,
      authoritySource: 'verified-server',
      actorKind: 'staff',
      evidenceRef: id<'authorization-evidence'>(evidence.evidenceRef),
      authenticatedUserId: id<'authenticated-user'>(evidence.authenticatedUserId),
      householdId: id<'household'>(evidence.householdId),
      studentId: id<'student'>(evidence.studentId),
      learnerSessionId: id<'learner-session'>(evidence.learnerSessionId),
      staffMembershipId: id<'staff-membership'>(evidence.staffMembershipId),
      permissions: Object.freeze([...evidence.permissions]),
      approvedModelVersion: evidence.approvedModelVersion,
      auditEvidenceRef: id<'authorization-evidence'>(evidence.auditEvidenceRef),
      window: immutableWindow(evidence.window),
    }),
  }
}

export function authorizeAdultNotification(
  evidence: ServerAdultNotificationEvidence,
  now = new Date(),
): AuthorizationDecision<AuthorizedAdultNotificationRoute> {
  if (evidence.authoritySource !== 'verified-server') return { status: 'denied', code: 'browser-authority-claim-rejected' }
  const supplied = evidence as unknown as Record<string, unknown>
  if (['email', 'phone', 'address', 'contact', 'routeAddress', 'recipientAddress'].some((key) => key in supplied)) {
    return { status: 'denied', code: 'recipient-not-authorized' }
  }
  const invalidId = validIdentityIds([
    evidence.householdId,
    evidence.studentId,
    evidence.notificationPermissionId,
    evidence.membershipId,
    evidence.relationshipId,
  ])
  if (
    invalidId ||
    !isStableServerReference(evidence.recipientRef) ||
    !isStableServerReference(evidence.routeRef) ||
    !validEvidenceRef(evidence.evidenceRef)
  ) return { status: 'denied', code: invalidId ?? 'recipient-not-authorized' }
  if (evidence.membershipStatus !== 'active' || evidence.memberRole !== 'guardian') {
    return { status: 'denied', code: 'membership-not-active' }
  }
  if (evidence.relationshipStatus !== 'active') return { status: 'denied', code: 'relationship-not-active' }
  if (evidence.permissionStatus !== 'active') {
    return { status: 'denied', code: 'adult-notification-permission-required' }
  }
  if (!positiveInteger(evidence.authorizationRevision)) return { status: 'denied', code: 'authorization-stale' }
  if (!validInstant(evidence.expiresAt) || Date.parse(evidence.expiresAt) <= now.getTime()) {
    return { status: 'denied', code: 'authorization-expired' }
  }
  return {
    status: 'authorized',
    authority: Object.freeze({
      recipientRef: id<'stable-recipient-ref'>(evidence.recipientRef),
      routeRef: id<'stable-route-ref'>(evidence.routeRef),
      notificationPermissionId: id<'notification-permission'>(evidence.notificationPermissionId),
      membershipId: id<'membership'>(evidence.membershipId),
      relationshipId: id<'guardian-student-relationship'>(evidence.relationshipId),
      householdId: id<'household'>(evidence.householdId),
      studentId: id<'student'>(evidence.studentId),
      channel: evidence.channel,
      authorizationRevision: evidence.authorizationRevision,
      expiresAt: evidence.expiresAt,
      evidenceRef: id<'authorization-evidence'>(evidence.evidenceRef),
    }),
  }
}

export interface CurrentAuthorizationSnapshot {
  readonly now: Date
  readonly authorizationRevision: number
  readonly householdId: string
  readonly studentId: string
  readonly learnerSessionId: string
  readonly lifecycleEpochs: IdentityLifecycleEpochs
  readonly revoked: boolean
}

/** Revalidates long-lived work after switches, logout, expiry, and revocation. */
export function validateCurrentAuthority(
  authority: StudyProductionAuthority,
  current: CurrentAuthorizationSnapshot,
): { readonly current: true } | { readonly current: false; readonly code: StudyProductionErrorCode } {
  if (current.revoked) return { current: false, code: 'authorization-revoked' }
  if (Date.parse(authority.window.expiresAt) <= current.now.getTime()) return { current: false, code: 'authorization-expired' }
  if (authority.window.revision !== current.authorizationRevision) return { current: false, code: 'authorization-stale' }
  if (authority.householdId !== current.householdId) return { current: false, code: 'household-mismatch' }
  if (authority.studentId !== current.studentId || authority.learnerSessionId !== current.learnerSessionId) {
    return { current: false, code: 'learner-mismatch' }
  }
  for (const key of Object.keys(authority.window.lifecycleEpochs) as (keyof IdentityLifecycleEpochs)[]) {
    if (authority.window.lifecycleEpochs[key] !== current.lifecycleEpochs[key]) {
      return { current: false, code: 'lifecycle-epoch-stale' }
    }
  }
  return { current: true }
}

/**
 * Runtime validation for a production authority crossing into a composition
 * root. TypeScript brands disappear at runtime, so UUID-shaped browser objects
 * must not satisfy the production identity gate.
 */
export function isCurrentStudyProductionAuthority(
  value: unknown,
  now = new Date(),
): value is StudyProductionAuthority {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const authority = value as Partial<StudyProductionAuthority>
  if (
    authority.schemaVersion !== STUDY_AUTHORIZATION_SCHEMA_VERSION ||
    authority.authoritySource !== 'verified-server' ||
    !validEvidenceRef(authority.evidenceRef) ||
    validIdentityIds([authority.householdId, authority.studentId, authority.learnerSessionId]) !== null ||
    !authority.window ||
    validWindow(authority.window, now) !== null
  ) return false

  if (authority.actorKind === 'guardian') {
    return validIdentityIds([
      authority.authenticatedUserId,
      authority.membershipId,
      authority.relationshipId,
    ]) === null &&
      typeof authority.permission === 'string' &&
      ['viewer', 'learning_manager', 'identity_manager'].includes(authority.permission)
  }
  if (authority.actorKind === 'student-session') {
    return validIdentityIds([authority.studentSessionGrantId]) === null &&
      positiveInteger(authority.sessionVersion) &&
      isStableServerReference(authority.issuerVersion) &&
      Array.isArray(authority.capabilities) &&
      authority.capabilities.length > 0 &&
      authority.capabilities.every((capability) => [
        'student:assignments:read',
        'student:attempts:create',
        'student:progress:read',
      ].includes(capability))
  }
  if (authority.actorKind === 'staff') {
    return validIdentityIds([authority.authenticatedUserId, authority.staffMembershipId]) === null &&
      isStableServerReference(authority.approvedModelVersion) &&
      validEvidenceRef(authority.auditEvidenceRef) &&
      Array.isArray(authority.permissions) &&
      authority.permissions.length > 0 &&
      authority.permissions.every((permission) => [
        'study:read', 'study:manage', 'study:adult-private', 'study:notify',
      ].includes(permission))
  }
  return false
}

export function isScopeAuthorized(
  authority: StudyProductionAuthority,
  scope: { readonly householdId: string; readonly studentId: string; readonly learnerSessionId?: string },
): boolean {
  return authority.householdId === scope.householdId &&
    authority.studentId === scope.studentId &&
    (scope.learnerSessionId === undefined || authority.learnerSessionId === scope.learnerSessionId)
}

export const BROWSER_AUTHORITY_CLAIM_KEYS = Object.freeze([
  'authenticatedUserId',
  'householdId',
  'studentId',
  'learnerSessionId',
  'membershipId',
  'relationshipId',
  'studentSessionGrantId',
  'staffMembershipId',
  'actorKind',
  'memberRole',
  'role',
  'permissions',
  'permission',
  'authorizationRevision',
  'lifecycleEpochs',
  'recipientRef',
  'routeRef',
  'notificationPermissionId',
  'adultNotificationPermission',
  'authorizationEvidenceRef',
  'authoritySource',
  'verifiedBy',
  'staffRole',
  'email',
  'phone',
] as const)

const BROWSER_CLAIMS = new Set<string>(BROWSER_AUTHORITY_CLAIM_KEYS)

/** Browser payloads may carry selectors, but never identity or authorization evidence. */
export function findBrowserSuppliedAuthorityClaims(candidate: unknown): readonly string[] {
  const found = new Set<string>()
  const visited = new Set<object>()
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || visited.has(value)) return
    visited.add(value)
    for (const [key, nested] of Object.entries(value)) {
      if (BROWSER_CLAIMS.has(key)) found.add(key)
      else visit(nested)
    }
  }
  visit(candidate)
  return Object.freeze([...found].sort())
}
