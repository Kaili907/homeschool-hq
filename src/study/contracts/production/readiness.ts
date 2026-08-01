import type { StudyProductionErrorCode } from './errors'
import { STUDY_PORT_REGISTRY_SCHEMA_VERSION, STUDY_READINESS_SCHEMA_VERSION } from './versions'

export type StudyProductionReadinessState = 'ready' | 'not-ready' | 'degraded'

export const REQUIRED_PRODUCTION_DEPENDENCIES = Object.freeze([
  'session-verifying-authorizer',
  'household-learner-resolver',
  'study-session-adapter',
  'checkpoint-adapter',
  'review-queue',
  'calendar-adapter',
  'parent-settings-adapter',
  'adult-private-adapter',
  'event-ledger',
  'adult-review-proposal-store',
  'outbox-store',
  'rate-limiter',
  'authorized-recipient-resolver',
  'production-classifier',
  'monitoring-sink',
  'delivery-provider',
  'receipt-validator',
] as const)

export type ProductionDependencyKey = typeof REQUIRED_PRODUCTION_DEPENDENCIES[number]
export type ProductionTrustBoundary = 'trusted-server' | 'authenticated-rpc'
export type ProductionDurability = 'durable' | 'stateless'

export interface ProductionDependencyRegistration {
  readonly schemaVersion: typeof STUDY_PORT_REGISTRY_SCHEMA_VERSION
  readonly key: ProductionDependencyKey
  readonly implementation: 'production'
  readonly trustBoundary: ProductionTrustBoundary
  readonly durability: ProductionDurability
  readonly status: StudyProductionReadinessState
  readonly version: string
}
interface DependencySpecification {
  readonly trustBoundary: ProductionTrustBoundary
  readonly durability: ProductionDurability
  readonly safetyCritical: boolean
}
export const PRODUCTION_DEPENDENCY_SPECIFICATIONS: Readonly<Record<ProductionDependencyKey, DependencySpecification>> = Object.freeze({
  'session-verifying-authorizer': { trustBoundary: 'trusted-server', durability: 'stateless', safetyCritical: true },
  'household-learner-resolver': { trustBoundary: 'trusted-server', durability: 'durable', safetyCritical: true },
  'study-session-adapter': { trustBoundary: 'authenticated-rpc', durability: 'durable', safetyCritical: true },
  'checkpoint-adapter': { trustBoundary: 'authenticated-rpc', durability: 'durable', safetyCritical: true },
  'review-queue': { trustBoundary: 'authenticated-rpc', durability: 'durable', safetyCritical: true },
  'calendar-adapter': { trustBoundary: 'authenticated-rpc', durability: 'durable', safetyCritical: true },
  'parent-settings-adapter': { trustBoundary: 'authenticated-rpc', durability: 'durable', safetyCritical: true },
  'adult-private-adapter': { trustBoundary: 'authenticated-rpc', durability: 'durable', safetyCritical: true },
  'event-ledger': { trustBoundary: 'authenticated-rpc', durability: 'durable', safetyCritical: true },
  'adult-review-proposal-store': { trustBoundary: 'trusted-server', durability: 'durable', safetyCritical: true },
  'outbox-store': { trustBoundary: 'trusted-server', durability: 'durable', safetyCritical: true },
  'rate-limiter': { trustBoundary: 'trusted-server', durability: 'durable', safetyCritical: true },
  'authorized-recipient-resolver': { trustBoundary: 'trusted-server', durability: 'durable', safetyCritical: true },
  'production-classifier': { trustBoundary: 'trusted-server', durability: 'stateless', safetyCritical: true },
  'monitoring-sink': { trustBoundary: 'trusted-server', durability: 'durable', safetyCritical: true },
  'delivery-provider': { trustBoundary: 'trusted-server', durability: 'durable', safetyCritical: true },
  'receipt-validator': { trustBoundary: 'trusted-server', durability: 'durable', safetyCritical: true },
})

export interface StudentSessionIssuerReadiness {
  readonly status: StudyProductionReadinessState
  readonly issuerVersion: string
  readonly trustBoundary: 'trusted-server'
  readonly issuesServerVerifiableGrants: true
}

export interface StaffAuthorizationModelReadiness {
  readonly status: StudyProductionReadinessState
  readonly approvedModelVersion: string
  readonly trustBoundary: 'trusted-server'
  readonly explicitStudyPermission: true
  readonly auditEventsRequired: true
}

export interface ProductionReadinessIssue {
  readonly dependency: ProductionDependencyKey | 'student-session-issuer' | 'staff-authorization-model'
  readonly code: StudyProductionErrorCode
}

export interface StudyProductionReadiness {
  readonly schemaVersion: typeof STUDY_READINESS_SCHEMA_VERSION
  readonly status: StudyProductionReadinessState
  readonly permitsAcademicStudy: boolean
  readonly dependenciesComplete: boolean
  readonly issues: readonly ProductionReadinessIssue[]
  readonly access: {
    readonly guardian: StudyProductionReadinessState
    readonly directStudent: StudyProductionReadinessState
    readonly staff: 'enabled' | 'disabled'
  }
}

function validVersion(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 120
}

function registrationIssue(
  registration: ProductionDependencyRegistration,
): StudyProductionErrorCode | null {
  const expected = PRODUCTION_DEPENDENCY_SPECIFICATIONS[registration.key]
  if (
    registration.schemaVersion !== STUDY_PORT_REGISTRY_SCHEMA_VERSION ||
    registration.implementation !== 'production' ||
    registration.trustBoundary !== expected.trustBoundary ||
    registration.durability !== expected.durability ||
    !validVersion(registration.version)
  ) return 'production-dependency-invalid'
  if (registration.status === 'not-ready') return 'production-dependency-not-ready'
  if (registration.status === 'degraded') return 'production-dependency-degraded'
  return null
}

export function evaluateProductionReadiness(
  registrations: readonly ProductionDependencyRegistration[],
  options: {
    readonly studentSessionIssuer?: StudentSessionIssuerReadiness
    readonly staffAuthorizationModel?: StaffAuthorizationModelReadiness
  } = {},
): StudyProductionReadiness {
  const issues: ProductionReadinessIssue[] = []
  const byKey = new Map<ProductionDependencyKey, ProductionDependencyRegistration>()
  for (const registration of registrations) {
    if (!REQUIRED_PRODUCTION_DEPENDENCIES.includes(registration.key)) continue
    if (byKey.has(registration.key)) {
      issues.push({ dependency: registration.key, code: 'production-registry-duplicate' })
      continue
    }
    byKey.set(registration.key, registration)
  }
  for (const key of REQUIRED_PRODUCTION_DEPENDENCIES) {
    const registration = byKey.get(key)
    if (!registration) {
      issues.push({ dependency: key, code: 'production-dependency-missing' })
      continue
    }
    const code = registrationIssue(registration)
    if (code) issues.push({ dependency: key, code })
  }

  const missingOrInvalid = issues.some(({ code }) =>
    code === 'production-dependency-missing' ||
    code === 'production-dependency-invalid' ||
    code === 'production-dependency-not-ready' ||
    code === 'production-registry-duplicate')
  const degraded = issues.some(({ code }) => code === 'production-dependency-degraded')
  const status: StudyProductionReadinessState = missingOrInvalid ? 'not-ready' : degraded ? 'degraded' : 'ready'

  const issuer = options.studentSessionIssuer
  const directStudent = issuer &&
    issuer.status === 'ready' &&
    issuer.trustBoundary === 'trusted-server' &&
    issuer.issuesServerVerifiableGrants === true &&
    validVersion(issuer.issuerVersion)
    ? 'ready'
    : issuer?.status === 'degraded' ? 'degraded' : 'not-ready'
  if (directStudent !== 'ready') {
    issues.push({ dependency: 'student-session-issuer', code: 'student-session-issuer-unavailable' })
  }

  const staff = options.staffAuthorizationModel
  const staffEnabled = Boolean(
    staff &&
    staff.status === 'ready' &&
    staff.trustBoundary === 'trusted-server' &&
    staff.explicitStudyPermission === true &&
    staff.auditEventsRequired === true &&
    validVersion(staff.approvedModelVersion),
  )
  if (!staffEnabled) issues.push({ dependency: 'staff-authorization-model', code: 'staff-authorization-disabled' })

  return Object.freeze({
    schemaVersion: STUDY_READINESS_SCHEMA_VERSION,
    status,
    permitsAcademicStudy: status === 'ready',
    dependenciesComplete: REQUIRED_PRODUCTION_DEPENDENCIES.every((key) => byKey.has(key)),
    issues: Object.freeze(issues),
    access: Object.freeze({
      guardian: status,
      directStudent,
      staff: staffEnabled ? 'enabled' : 'disabled',
    }),
  })
}

export function readinessWireResult(readiness: StudyProductionReadiness): {
  readonly schemaVersion: typeof STUDY_READINESS_SCHEMA_VERSION
  readonly status: StudyProductionReadinessState
} {
  return Object.freeze({ schemaVersion: STUDY_READINESS_SCHEMA_VERSION, status: readiness.status })
}

export interface StudyProductionAvailabilityInput {
  readonly featureFlagValue: string | undefined
  readonly authenticatedHostSession: boolean
  readonly selectedLearnerAuthorized: boolean
  readonly readiness: StudyProductionReadiness
}

/** Feature visibility never upgrades missing server authorization or readiness. */
export function productionStudyIsAvailable(input: StudyProductionAvailabilityInput): boolean {
  return input.featureFlagValue === 'true' &&
    input.authenticatedHostSession &&
    input.selectedLearnerAuthorized &&
    input.readiness.status === 'ready' &&
    input.readiness.permitsAcademicStudy
}
