import type { ProductionStudyParentHubPorts } from './contracts'

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

export function assertCompleteProductionStudyParentHubPorts(
  ports: Partial<ProductionStudyParentHubPorts>,
): asserts ports is ProductionStudyParentHubPorts {
  const missing = PARENT_HUB_PRODUCTION_ROLE_KEYS.filter((role) => !ports[role])
  if (missing.length > 0) {
    throw new Error(`Parent Hub production unavailable: missing ${missing.join(', ')} port.`)
  }
}

/** Requires real implementations for every adult role; it never supplies fallbacks. */
export function defineProductionStudyParentHubPorts(
  ports: ProductionStudyParentHubPorts,
): Readonly<ProductionStudyParentHubPorts> {
  const keys = Object.keys(ports)
  if (keys.length !== PARENT_HUB_PRODUCTION_ROLE_KEYS.length ||
    keys.some((key) => !PARENT_HUB_PRODUCTION_ROLE_KEYS.includes(key as DeclaredRole))) {
    throw new Error('Parent Hub production contract must contain exactly the six adult roles.')
  }
  assertCompleteProductionStudyParentHubPorts(ports)
  return Object.freeze({ ...ports })
}
