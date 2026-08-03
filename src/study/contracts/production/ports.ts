import { StudyProductionError } from './errors'
import type {
  StudyAdultPrivatePort,
  StudyCalendarPort,
  StudyCheckpointPort,
  StudyEventLedgerPort,
  StudyOutboxPort,
  StudyParentSettingsPort,
  StudyPersistencePort,
  StudyReviewQueuePort,
} from '../persistence'
import type {
  ServerUrgentSafetyClassifierPort,
  StudySafetyMonitoringPort,
  StudySafetyRateLimitPort,
} from '../safety'
import type {
  AdultReviewDeliveryProviderPort,
  AdultReviewReceiptValidatorPort,
} from '../adult-review'
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
import {
  STUDY_PORT_REGISTRY_SCHEMA_VERSION,
  STUDY_PRODUCTION_CONTRACT_VERSION,
} from './versions'

const PRODUCTION_PORT: unique symbol = Symbol('study-production-port')
const PRODUCTION_REGISTRY: unique symbol = Symbol('study-production-registry')
const BRANDED_PRODUCTION_PORTS = new WeakSet<object>()
const BRANDED_PRODUCTION_REGISTRIES = new WeakSet<object>()

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

export interface ProductionDependencyPortMap {
  readonly 'session-verifying-authorizer': StudySessionVerifyingAuthorizerPort
  readonly 'household-learner-resolver': HouseholdLearnerAuthorityResolverPort
  readonly 'study-session-adapter': StudyPersistencePort
  readonly 'checkpoint-adapter': StudyCheckpointPort
  readonly 'review-queue': StudyReviewQueuePort
  readonly 'calendar-adapter': StudyCalendarPort
  readonly 'parent-settings-adapter': StudyParentSettingsPort
  readonly 'adult-private-adapter': StudyAdultPrivatePort
  readonly 'event-ledger': StudyEventLedgerPort
  readonly 'adult-review-proposal-store': Pick<StudyOutboxPort, 'createAdultReviewProposal'>
  readonly 'outbox-store': Pick<StudyOutboxPort, 'enqueue' | 'transition' | 'status'>
  readonly 'rate-limiter': StudySafetyRateLimitPort
  readonly 'authorized-recipient-resolver': AdultNotificationAuthorizationPort
  readonly 'production-classifier': ServerUrgentSafetyClassifierPort
  readonly 'monitoring-sink': StudySafetyMonitoringPort
  readonly 'delivery-provider': AdultReviewDeliveryProviderPort
  readonly 'receipt-validator': AdultReviewReceiptValidatorPort
}

export interface ProductionPortRuntimeMetadata {
  readonly deployment: 'production'
  readonly contractVersion: typeof STUDY_PRODUCTION_CONTRACT_VERSION
  readonly implementationId: string
  readonly trustBoundary: ProductionTrustBoundary
  readonly durable: boolean
  readonly testOnly?: boolean
  readonly previewOnly?: boolean
  readonly inMemory?: boolean
}

export interface ProductionPortImplementation<
  Key extends ProductionDependencyKey = ProductionDependencyKey,
> extends ProductionPortRuntimeMetadata {
  readonly port: ProductionDependencyPortMap[Key]
  /** A live health probe. Static configuration alone must not return ready. */
  readonly readiness: () => StudyProductionReadinessState
}

export interface BrandedProductionPort<
  Key extends ProductionDependencyKey = ProductionDependencyKey,
> {
  readonly [PRODUCTION_PORT]: Key
  readonly key: Key
  readonly port: Readonly<ProductionDependencyPortMap[Key]>
  /** Server-internal registration. Use readinessWireResult at a browser boundary. */
  internalRegistration(): ProductionDependencyRegistration
}

const NON_PRODUCTION_IMPLEMENTATION = /(?:^|[\s:._/-])(local|memory|in-memory|test|fixture|preview|synthetic|noop|mock)(?:$|[\s:._/-])/i

/**
 * The only canonical way to enter a port in the production registry. It checks
 * runtime provenance in addition to TypeScript shape so a cast cannot silently
 * select a local, preview, noop, or in-memory implementation.
 */
export function brandProductionPort<
  Key extends ProductionDependencyKey,
>(key: Key, implementation: ProductionPortImplementation<Key>): BrandedProductionPort<Key> {
  const expected = PRODUCTION_DEPENDENCY_SPECIFICATIONS[key]
  const state = implementation?.readiness?.()
  const port = implementation?.port
  if (
    !expected ||
    implementation?.deployment !== 'production' ||
    implementation.contractVersion !== expected.contractVersion ||
    implementation.trustBoundary !== expected.trustBoundary ||
    implementation.durable !== (expected.durability === 'durable') ||
    implementation.testOnly === true ||
    implementation.previewOnly === true ||
    implementation.inMemory === true ||
    typeof implementation.implementationId !== 'string' ||
    implementation.implementationId.trim() === '' ||
    NON_PRODUCTION_IMPLEMENTATION.test(implementation.implementationId) ||
    !port ||
    typeof port !== 'object' ||
    !expected.requiredMethods.every((method) => typeof (port as unknown as Record<string, unknown>)[method] === 'function') ||
    !['ready', 'not-ready', 'degraded'].includes(state)
  ) throw new StudyProductionError('production-dependency-invalid')

  Object.freeze(port)
  const readiness = implementation.readiness
  const handle: BrandedProductionPort<Key> = {
    [PRODUCTION_PORT]: key,
    key,
    port,
    internalRegistration: () => {
      const status = readiness()
      if (!['ready', 'not-ready', 'degraded'].includes(status)) {
        throw new StudyProductionError('production-dependency-invalid')
      }
      return Object.freeze({
        schemaVersion: STUDY_PORT_REGISTRY_SCHEMA_VERSION,
        contractVersion: STUDY_PRODUCTION_CONTRACT_VERSION,
        key,
        implementation: 'production',
        trustBoundary: implementation.trustBoundary,
        durability: implementation.durable ? 'durable' : 'stateless',
        status,
        version: implementation.implementationId,
      })
    },
  }
  Object.freeze(handle)
  BRANDED_PRODUCTION_PORTS.add(handle)
  return handle
}

export function isBrandedProductionPort(value: unknown): value is BrandedProductionPort {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BrandedProductionPort>
  return BRANDED_PRODUCTION_PORTS.has(value) &&
    typeof candidate.key === 'string' &&
    candidate[PRODUCTION_PORT] === candidate.key &&
    typeof candidate.internalRegistration === 'function' &&
    Object.isFrozen(candidate) &&
    Object.isFrozen(candidate.port)
}

export type StudyProductionPortRegistry = Readonly<{
  [Key in ProductionDependencyKey]: BrandedProductionPort<Key>
}> & { readonly [PRODUCTION_REGISTRY]: typeof STUDY_PORT_REGISTRY_SCHEMA_VERSION }

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
  const result = Object.fromEntries(registry) as unknown as StudyProductionPortRegistry
  Object.defineProperty(result, PRODUCTION_REGISTRY, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: STUDY_PORT_REGISTRY_SCHEMA_VERSION,
  })
  Object.freeze(result)
  BRANDED_PRODUCTION_REGISTRIES.add(result)
  return result
}

export function isStudyProductionPortRegistry(
  value: unknown,
): value is StudyProductionPortRegistry {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StudyProductionPortRegistry>
  if (
    !BRANDED_PRODUCTION_REGISTRIES.has(value) ||
    candidate[PRODUCTION_REGISTRY] !== STUDY_PORT_REGISTRY_SCHEMA_VERSION ||
    !Object.isFrozen(candidate) ||
    Object.keys(candidate).length !== Object.keys(PRODUCTION_DEPENDENCY_SPECIFICATIONS).length
  ) return false
  return (Object.keys(PRODUCTION_DEPENDENCY_SPECIFICATIONS) as ProductionDependencyKey[])
    .every((key) => isBrandedProductionPort(candidate[key]) && candidate[key]?.key === key)
}

export function productionPortReadiness(
  registry: StudyProductionPortRegistry,
): readonly ProductionDependencyRegistration[] {
  if (!isStudyProductionPortRegistry(registry)) {
    throw new StudyProductionError('production-dependency-invalid')
  }
  return Object.freeze(
    (Object.keys(PRODUCTION_DEPENDENCY_SPECIFICATIONS) as ProductionDependencyKey[])
      .map((key) => registry[key].internalRegistration()),
  )
}
