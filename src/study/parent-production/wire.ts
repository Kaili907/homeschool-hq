import type { ProductionStudyParentHubPorts } from './contracts'
import { snapshotExactRecord } from './exactRecord'

export const PARENT_HUB_PRODUCTION_ROLE_KEYS = Object.freeze([
  'settings',
  'reviews',
  'calendar',
  'safetyReview',
  'adultPrivate',
  'notifications',
] as const satisfies readonly (keyof ProductionStudyParentHubPorts)[])

type DeclaredRole = typeof PARENT_HUB_PRODUCTION_ROLE_KEYS[number]
type MissingRole = Exclude<keyof ProductionStudyParentHubPorts, DeclaredRole>
type UnknownRole = Exclude<DeclaredRole, keyof ProductionStudyParentHubPorts>
type AllRolesDeclared = [MissingRole, UnknownRole] extends [never, never] ? true : false

/** Compile-time proof that the declared root and the six-role inventory remain identical. */
export const PARENT_HUB_PRODUCTION_CONTRACT_COMPLETE: AllRolesDeclared = true

/** Callable members each role must expose; `satisfies` proves every name exists on its own role. */
const PARENT_HUB_PRODUCTION_ROLE_METHODS = {
  settings: ['read', 'apply'],
  reviews: ['list', 'decide'],
  calendar: ['list', 'pause', 'createContinuation'],
  safetyReview: ['listOpen', 'reviewAndClear'],
  adultPrivate: ['commitNote'],
  notifications: ['list', 'markRead'],
} as const satisfies { readonly [Role in DeclaredRole]: readonly (keyof ProductionStudyParentHubPorts[Role])[] }

/** The one pinned non-callable member the contract declares. */
const PARENT_HUB_PRODUCTION_DELIVERY: ProductionStudyParentHubPorts['notifications']['delivery'] = 'in-app'

type UncheckedRoleMember = {
  [Role in DeclaredRole]:
  Exclude<keyof ProductionStudyParentHubPorts[Role], typeof PARENT_HUB_PRODUCTION_ROLE_METHODS[Role][number]>
}[DeclaredRole]
type AllRoleMembersChecked = [UncheckedRoleMember] extends ['delivery'] ? true : false

/** Compile-time proof that every declared role member is covered by a runtime check. */
export const PARENT_HUB_PRODUCTION_MEMBERS_CHECKED: AllRoleMembersChecked = true

export const PARENT_HUB_CONTRACT_REFUSAL_CODES = Object.freeze([
  'parent-hub-contract-not-exact-record',
  'parent-hub-contract-role-not-a-port',
] as const)

export type ParentHubContractRefusalCode = typeof PARENT_HUB_CONTRACT_REFUSAL_CODES[number]

/** Carries a fixed code and at most one of our own six role names, never caller-supplied data. */
export class ParentHubContractRefusal extends Error {
  readonly code: ParentHubContractRefusalCode
  readonly role: DeclaredRole | null

  constructor(code: ParentHubContractRefusalCode, role: DeclaredRole | null = null) {
    super('Parent Hub production contract must contain exactly the six adult roles.')
    this.name = 'ParentHubContractRefusal'
    this.code = code
    this.role = role
  }
}

/** Bounds the walk so a hostile prototype trap cannot spin an unbounded chain. */
const MAXIMUM_ROLE_MEMBER_DEPTH = 8

/** Reads one slot as data, so probing an object never invokes an accessor it declares. */
function dataSlot(holder: object, key: PropertyKey): unknown {
  const descriptor = Reflect.getOwnPropertyDescriptor(holder, key)
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined
}

/**
 * Every built-in prototype of this realm. A role may never borrow a declared member from one:
 * polluting a shared prototype would otherwise dress a bare `{}`, `[]` or `new Map()` as a role.
 * Derived rather than hand-listed so a newer built-in cannot quietly fall outside the boundary.
 */
const SHARED_MEMBER_PROTOTYPES: ReadonlySet<object> = new Set(
  Reflect.ownKeys(globalThis)
    .map((key) => dataSlot(globalThis, key))
    .filter((value) => typeof value === 'function')
    .map((value) => dataSlot(value as object, 'prototype'))
    // `Function.prototype` is itself callable, so accept both object and function slots.
    .filter((value): value is object =>
      value !== null && (typeof value === 'object' || typeof value === 'function')),
)

/** Resolves one member through descriptors alone, so a caller accessor is never invoked. */
function roleMemberValue(port: object, member: string): unknown {
  let current: object | null = port
  for (let depth = 0; depth <= MAXIMUM_ROLE_MEMBER_DEPTH; depth += 1) {
    if (current === null || SHARED_MEMBER_PROTOTYPES.has(current)) return undefined
    const descriptor = Reflect.getOwnPropertyDescriptor(current, member)
    if (descriptor) return Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined
    current = Reflect.getPrototypeOf(current)
  }
  return undefined
}

/** Real roles are commonly class instances, so members may sit on the bounded prototype chain. */
function isRolePort(port: unknown, role: DeclaredRole): boolean {
  if (port === null || typeof port !== 'object') return false
  try {
    const members: readonly string[] = PARENT_HUB_PRODUCTION_ROLE_METHODS[role]
    for (const member of members) {
      if (typeof roleMemberValue(port, member) !== 'function') return false
    }
    return role !== 'notifications' ||
      roleMemberValue(port, 'delivery') === PARENT_HUB_PRODUCTION_DELIVERY
  } catch {
    return false
  }
}

/** Builds the detached record the caller is authorised to use; the live argument is never blessed. */
function validatedProductionStudyParentHubPorts(ports: unknown): Readonly<ProductionStudyParentHubPorts> {
  const snapshot = snapshotExactRecord(ports, [{ required: PARENT_HUB_PRODUCTION_ROLE_KEYS }])
  if (!snapshot) throw new ParentHubContractRefusal('parent-hub-contract-not-exact-record')

  const validated = Object.create(null) as Partial<Record<DeclaredRole, unknown>>
  for (const role of PARENT_HUB_PRODUCTION_ROLE_KEYS) {
    const port = snapshot[role]
    if (!isRolePort(port, role)) throw new ParentHubContractRefusal('parent-hub-contract-role-not-a-port', role)
    validated[role] = port
  }
  // Widening only: the loop above fixed the key set and checked every member the contract can verify.
  return Object.freeze(validated) as Readonly<ProductionStudyParentHubPorts>
}

/** Requires real implementations for every adult role; it never supplies fallbacks. */
export function defineProductionStudyParentHubPorts(
  ports: ProductionStudyParentHubPorts,
): Readonly<ProductionStudyParentHubPorts> {
  return validatedProductionStudyParentHubPorts(ports)
}

/** Fail-closed reader for untrusted roots: yields the detached record, or null for any refusal. */
export function parseCompleteProductionStudyParentHubPorts(
  ports: unknown,
): Readonly<ProductionStudyParentHubPorts> | null {
  try {
    return validatedProductionStudyParentHubPorts(ports)
  } catch (refusal) {
    // Hostile input is already contained upstream, so anything else here is our own defect.
    if (refusal instanceof ParentHubContractRefusal) return null
    throw refusal
  }
}
