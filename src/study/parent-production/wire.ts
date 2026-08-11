import type { ProductionStudyParentHubPorts } from './contracts'
import { snapshotExactRecord } from './exactRecord'

export const PARENT_HUB_PRODUCTION_ROLE_KEYS = [
  'settings',
  'reviews',
  'calendar',
  'safetyReview',
  'adultPrivate',
  'notifications',
] as const satisfies readonly (keyof ProductionStudyParentHubPorts)[]

type DeclaredRole = typeof PARENT_HUB_PRODUCTION_ROLE_KEYS[number]
type MissingRole = Exclude<keyof ProductionStudyParentHubPorts, DeclaredRole>
type UnknownRole = Exclude<DeclaredRole, keyof ProductionStudyParentHubPorts>
type AllRolesDeclared = [MissingRole, UnknownRole] extends [never, never] ? true : false

/** Compile-time proof that the declared root and the six-role inventory remain identical. */
export const PARENT_HUB_PRODUCTION_CONTRACT_COMPLETE: AllRolesDeclared = true

function snapshotCompleteProductionStudyParentHubPorts(
  ports: unknown,
): Readonly<ProductionStudyParentHubPorts> | null {
  const snapshot = snapshotExactRecord(ports, [{ required: PARENT_HUB_PRODUCTION_ROLE_KEYS }])
  if (!snapshot || PARENT_HUB_PRODUCTION_ROLE_KEYS.some((role) => !snapshot[role])) return null
  return Object.freeze({
    settings: snapshot.settings,
    reviews: snapshot.reviews,
    calendar: snapshot.calendar,
    safetyReview: snapshot.safetyReview,
    adultPrivate: snapshot.adultPrivate,
    notifications: snapshot.notifications,
  }) as Readonly<ProductionStudyParentHubPorts>
}

export function assertCompleteProductionStudyParentHubPorts(
  ports: Partial<ProductionStudyParentHubPorts>,
): asserts ports is ProductionStudyParentHubPorts {
  if (!snapshotCompleteProductionStudyParentHubPorts(ports)) {
    throw new Error('Parent Hub production contract must contain exactly the six adult roles.')
  }
}

/** Requires real implementations for every adult role; it never supplies fallbacks. */
export function defineProductionStudyParentHubPorts(
  ports: ProductionStudyParentHubPorts,
): Readonly<ProductionStudyParentHubPorts> {
  const snapshot = snapshotCompleteProductionStudyParentHubPorts(ports)
  if (!snapshot) {
    throw new Error('Parent Hub production contract must contain exactly the six adult roles.')
  }
  return snapshot
}
