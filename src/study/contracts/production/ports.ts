import { StudyProductionError } from './errors'
import type {
  AuthorizationDecision,
  AuthorizedAdultNotificationRoute,
  GuardianStudyAuthority,
  ServerAdultNotificationEvidence,
  ServerGuardianAuthorizationEvidence,
  ServerStaffAuthorizationEvidence,
  ServerStudentSessionAuthorizationEvidence,
  StaffStudyAuthority,
  StaffStudyPermission,
  StudentSessionStudyAuthority,
  StudentStudyCapability,
} from './identity'
import {
  PRODUCTION_DEPENDENCY_SPECIFICATIONS,
  type ProductionDependencyKey,
  type ProductionDependencyRegistration,
  type ProductionTrustBoundary,
  type StudyProductionReadinessState,
} from './readiness'
import { STUDY_PORT_REGISTRY_SCHEMA_VERSION } from './versions'

const PRODUCTION_PORT: unique symbol = Symbol('study-production-port')

export interface VerifiedServerPrincipal {
  readonly verifiedBy: 'trusted-server'
  readonly principalKind: 'guardian' | 'student-session' | 'staff'
  readonly principalRef: string
  readonly verifiedAt: string
  readonly expiresAt: string
  readonly sessionEpoch: number
}

export interface ProductionLearnerSelector {
  /** Selection only. The server independently derives and binds household authority. */
  readonly kind: 'academy-student-id' | 'legacy-profile-id'
  readonly value: string
}

export interface StudySessionVerifyingAuthorizerPort {
  readonly portName: 'session-verifying-authorizer'
  verify(request: {
    readonly authorizationHeader: string
    readonly correlationId: string
  }): Promise<
    | { readonly status: 'verified'; readonly principal: VerifiedServerPrincipal }
    | { readonly status: 'denied' | 'unavailable'; readonly code: string }
  >
}

export interface HouseholdLearnerAuthorityResolverPort {
  readonly portName: 'household-learner-resolver'
  resolveGuardian(input: {
    readonly principal: VerifiedServerPrincipal
    readonly selector: ProductionLearnerSelector
    readonly learnerSessionSelector: string
  }): Promise<ServerGuardianAuthorizationEvidence>
  resolveStudentSession(input: {
    readonly principal: VerifiedServerPrincipal
    readonly selector: ProductionLearnerSelector
    readonly learnerSessionSelector: string
  }): Promise<ServerStudentSessionAuthorizationEvidence>
  resolveStaff(input: {
    readonly principal: VerifiedServerPrincipal
    readonly selector: ProductionLearnerSelector
    readonly learnerSessionSelector: string
  }): Promise<ServerStaffAuthorizationEvidence>
}

export interface GuardianAuthorizationPort {
  authorize(
    evidence: ServerGuardianAuthorizationEvidence,
    now?: Date,
    requiredPermission?: 'viewer' | 'learning_manager' | 'identity_manager',
  ): AuthorizationDecision<GuardianStudyAuthority>
}

export interface StudentSessionAuthorizationPort {
  readonly verifiesSignedServerGrant: true
  authorize(
    evidence: ServerStudentSessionAuthorizationEvidence,
    requiredCapability: StudentStudyCapability,
    now?: Date,
  ): AuthorizationDecision<StudentSessionStudyAuthority>
}

/** Optional production dependency. Direct student access stays not-ready without it. */
export interface StudentSessionIssuerPort {
  readonly portName: 'student-session-issuer'
  readonly issuerVersion: string
  readonly trustBoundary: 'trusted-server'
  issue(input: {
    readonly credentialProofRef: string
    readonly requestedCapabilities: readonly StudentStudyCapability[]
    readonly correlationId: string
  }): Promise<{ readonly state: 'issued'; readonly opaqueGrant: string; readonly expiresAt: string } | { readonly state: 'denied' }>
}

export interface StaffAuthorizationPort {
  readonly portName: 'staff-authorization-model'
  readonly approvedModelVersion: string
  authorize(
    evidence: ServerStaffAuthorizationEvidence,
    requiredPermission: StaffStudyPermission,
    now?: Date,
  ): Promise<AuthorizationDecision<StaffStudyAuthority>>
  recordAudit(input: {
    readonly authority: StaffStudyAuthority
    readonly action: string
    readonly correlationId: string
  }): Promise<{ readonly recorded: true; readonly auditEvidenceRef: string }>
}

export interface AdultNotificationAuthorizationPort {
  readonly portName: 'authorized-recipient-resolver'
  resolve(input: {
    readonly householdId: string
    readonly studentId: string
    readonly proposalRef: string
    readonly now: string
  }): Promise<readonly ServerAdultNotificationEvidence[]>
  reauthorize(input: {
    readonly recipientRef: string
    readonly routeRef: string
    readonly proposalRef: string
    readonly now: string
  }): Promise<AuthorizationDecision<AuthorizedAdultNotificationRoute>>
}

export interface ProductionPortRuntimeMetadata {
  readonly deployment: 'production'
  readonly implementationId: string
  readonly trustBoundary: ProductionTrustBoundary
  readonly durable: boolean
  readonly testOnly?: boolean
  readonly previewOnly?: boolean
  readonly isReady: () => StudyProductionReadinessState
}

export type ProductionPortImplementation = object & ProductionPortRuntimeMetadata

export interface BrandedProductionPort<
  Key extends ProductionDependencyKey = ProductionDependencyKey,
  Port extends ProductionPortImplementation = ProductionPortImplementation,
> {
  readonly [PRODUCTION_PORT]: Key
  readonly key: Key
  readonly port: Port
  readiness(): ProductionDependencyRegistration
}

const NON_PRODUCTION_IMPLEMENTATION = /(?:^|[\s:._/-])(local|memory|in-memory|test|fixture|preview|synthetic|noop|mock)(?:$|[\s:._/-])/i

/**
 * The only canonical way to enter a port in the production registry. It checks
 * runtime provenance in addition to TypeScript shape so a cast cannot silently
 * select a local, preview, noop, or in-memory implementation.
 */
export function brandProductionPort<
  Key extends ProductionDependencyKey,
  Port extends ProductionPortImplementation,
>(key: Key, port: Port): BrandedProductionPort<Key, Port> {
  const expected = PRODUCTION_DEPENDENCY_SPECIFICATIONS[key]
  const state = port?.isReady?.()
  if (
    port?.deployment !== 'production' ||
    port.trustBoundary !== expected.trustBoundary ||
    port.durable !== (expected.durability === 'durable') ||
    port.testOnly === true ||
    port.previewOnly === true ||
    typeof port.implementationId !== 'string' ||
    port.implementationId.trim() === '' ||
    NON_PRODUCTION_IMPLEMENTATION.test(port.implementationId) ||
    !['ready', 'not-ready', 'degraded'].includes(state)
  ) throw new StudyProductionError('production-dependency-invalid')

  const handle: BrandedProductionPort<Key, Port> = {
    [PRODUCTION_PORT]: key,
    key,
    port,
    readiness: () => Object.freeze({
      schemaVersion: STUDY_PORT_REGISTRY_SCHEMA_VERSION,
      key,
      implementation: 'production',
      trustBoundary: port.trustBoundary,
      durability: port.durable ? 'durable' : 'stateless',
      status: port.isReady(),
      version: port.implementationId,
    }),
  }
  return Object.freeze(handle)
}

export function isBrandedProductionPort(value: unknown): value is BrandedProductionPort {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BrandedProductionPort>
  return typeof candidate.key === 'string' && candidate[PRODUCTION_PORT] === candidate.key && typeof candidate.readiness === 'function'
}

export type StudyProductionPortRegistry = Readonly<{
  [Key in ProductionDependencyKey]: BrandedProductionPort<Key>
}>

export function createProductionPortRegistry(
  ports: readonly BrandedProductionPort[],
): StudyProductionPortRegistry {
  const registry = new Map<ProductionDependencyKey, BrandedProductionPort>()
  for (const port of ports) {
    if (!isBrandedProductionPort(port)) throw new StudyProductionError('production-dependency-invalid')
    if (registry.has(port.key)) throw new StudyProductionError('production-registry-duplicate')
    registry.set(port.key, port)
  }
  for (const key of Object.keys(PRODUCTION_DEPENDENCY_SPECIFICATIONS) as ProductionDependencyKey[]) {
    if (!registry.has(key)) throw new StudyProductionError('production-dependency-missing')
  }
  return Object.freeze(Object.fromEntries(registry) as unknown as StudyProductionPortRegistry)
}

export function productionPortReadiness(
  registry: StudyProductionPortRegistry,
): readonly ProductionDependencyRegistration[] {
  return Object.freeze(
    (Object.keys(PRODUCTION_DEPENDENCY_SPECIFICATIONS) as ProductionDependencyKey[])
      .map((key) => registry[key].readiness()),
  )
}
