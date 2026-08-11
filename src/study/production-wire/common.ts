/**
 * Shared primitives for the Study production wire.
 *
 * This module deliberately has no dependency on the preview Study snapshot or
 * the Tutor recovery checkpoint. Every parser validates and rebuilds the value
 * that crosses the network boundary; it never trims, coerces, or returns the
 * caller's object.
 */

export const PRODUCTION_WIRE_SCHEMA_VERSION = 1 as const
export const PRODUCTION_WIRE_IDENTIFIER_MAX_LENGTH = 160
export const PRODUCTION_WIRE_MAX_SEGMENTS = 64
export const PRODUCTION_WIRE_MAX_DURATION_MINUTES = 24 * 60
export const PRODUCTION_WIRE_MAX_ACTIVE_SECONDS = 24 * 60 * 60

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

declare const SESSION_REF_BRAND: unique symbol
declare const CHECKPOINT_REF_BRAND: unique symbol
declare const CALENDAR_BLOCK_REF_BRAND: unique symbol
declare const SEGMENT_REF_BRAND: unique symbol
declare const LESSON_REF_BRAND: unique symbol
declare const CONTENT_VERSION_REF_BRAND: unique symbol
declare const SOURCE_REF_BRAND: unique symbol
declare const EVENT_ID_BRAND: unique symbol
declare const EVENT_REF_BRAND: unique symbol
declare const IDEMPOTENCY_KEY_BRAND: unique symbol
declare const MUTATION_REF_BRAND: unique symbol
declare const OPERATION_REF_BRAND: unique symbol

export type ProductionSessionRefV1 = string & { readonly [SESSION_REF_BRAND]: 'production-session-ref-v1' }
export type ProductionCheckpointRefV1 = string & { readonly [CHECKPOINT_REF_BRAND]: 'production-checkpoint-ref-v1' }
export type ProductionCalendarBlockRefV1 = string & { readonly [CALENDAR_BLOCK_REF_BRAND]: 'production-calendar-block-ref-v1' }
export type ProductionSegmentRefV1 = string & { readonly [SEGMENT_REF_BRAND]: 'production-segment-ref-v1' }
export type ProductionLessonRefV1 = string & { readonly [LESSON_REF_BRAND]: 'production-lesson-ref-v1' }
export type ProductionContentVersionRefV1 = string & { readonly [CONTENT_VERSION_REF_BRAND]: 'production-content-version-ref-v1' }
export type ProductionSourceRefV1 = string & { readonly [SOURCE_REF_BRAND]: 'production-source-ref-v1' }

/** Ledger identity, assigned independently from the Tutor event reference. */
export type ProductionEventIdV1 = string & { readonly [EVENT_ID_BRAND]: 'production-event-id-v1' }
/** Reference returned by the accepted Tutor operation. */
export type ProductionEventRefV1 = string & { readonly [EVENT_REF_BRAND]: 'production-event-ref-v1' }
/** Replay identity for an idempotent endpoint invocation. */
export type ProductionIdempotencyKeyV1 = string & { readonly [IDEMPOTENCY_KEY_BRAND]: 'production-idempotency-key-v1' }
/** Stable identity for one durable write, including checkpoint CAS writes. */
export type ProductionMutationRefV1 = string & { readonly [MUTATION_REF_BRAND]: 'production-mutation-ref-v1' }
/** Identity of a lifecycle operation, which may contain more than one write. */
export type ProductionOperationRefV1 = string & { readonly [OPERATION_REF_BRAND]: 'production-operation-ref-v1' }

function identifier<T extends string>(value: unknown): T | null {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value) ? value as T : null
}

function namespacedIdentifier<T extends string>(
  value: unknown,
  prefixes: readonly string[],
): T | null {
  const parsed = identifier<string>(value)
  if (parsed === null) return null
  return prefixes.some((prefix) => parsed.startsWith(prefix) && parsed.length > prefix.length)
    ? parsed as T
    : null
}

export const parseProductionSessionRefV1 = (value: unknown): ProductionSessionRefV1 | null =>
  identifier<ProductionSessionRefV1>(value)
export const parseProductionCheckpointRefV1 = (value: unknown): ProductionCheckpointRefV1 | null =>
  identifier<ProductionCheckpointRefV1>(value)
export const parseProductionCalendarBlockRefV1 = (value: unknown): ProductionCalendarBlockRefV1 | null =>
  identifier<ProductionCalendarBlockRefV1>(value)
export const parseProductionSegmentRefV1 = (value: unknown): ProductionSegmentRefV1 | null =>
  identifier<ProductionSegmentRefV1>(value)
export const parseProductionLessonRefV1 = (value: unknown): ProductionLessonRefV1 | null =>
  identifier<ProductionLessonRefV1>(value)
export const parseProductionContentVersionRefV1 = (value: unknown): ProductionContentVersionRefV1 | null =>
  identifier<ProductionContentVersionRefV1>(value)
export const parseProductionSourceRefV1 = (value: unknown): ProductionSourceRefV1 | null =>
  identifier<ProductionSourceRefV1>(value)
export const parseProductionEventIdV1 = (value: unknown): ProductionEventIdV1 | null =>
  namespacedIdentifier<ProductionEventIdV1>(value, ['event:id-', 'ledger-event:'])
export const parseProductionEventRefV1 = (value: unknown): ProductionEventRefV1 | null =>
  namespacedIdentifier<ProductionEventRefV1>(value, ['event:ref-', 'tutor:event-ref-', 'tutor-event:'])
export const parseProductionIdempotencyKeyV1 = (value: unknown): ProductionIdempotencyKeyV1 | null =>
  namespacedIdentifier<ProductionIdempotencyKeyV1>(value, ['idem:', 'idempotency:'])
export const parseProductionMutationRefV1 = (value: unknown): ProductionMutationRefV1 | null =>
  namespacedIdentifier<ProductionMutationRefV1>(value, ['mutation:'])
export const parseProductionOperationRefV1 = (value: unknown): ProductionOperationRefV1 | null =>
  namespacedIdentifier<ProductionOperationRefV1>(value, ['operation:'])

export type ProductionWireInfrastructureFailureV1 =
  | Readonly<{ schemaVersion: 1; status: 'auth-refused' }>
  | Readonly<{ schemaVersion: 1; status: 'auth-infrastructure-unavailable' }>
  | Readonly<{ schemaVersion: 1; status: 'rate-limited' }>
  | Readonly<{ schemaVersion: 1; status: 'server-unavailable' }>

export const PRODUCTION_WIRE_INFRASTRUCTURE_STATUSES = Object.freeze([
  'auth-refused',
  'auth-infrastructure-unavailable',
  'rate-limited',
  'server-unavailable',
] as const)

/**
 * Canonical data-only record boundary. The returned object is detached from
 * the caller: every own data descriptor is copied once, then only the frozen
 * null-prototype snapshot may be read by a parser.
 */
export function snapshotDataRecord(value: unknown): Record<string, unknown> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return null

    const ownKeys = Reflect.ownKeys(value)
    if (ownKeys.some((key) => typeof key !== 'string')) return null

    const snapshot = Object.create(null) as Record<string, unknown>
    for (const key of ownKeys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')) return null
      const snapshotValue = descriptor.value
      Object.defineProperty(snapshot, key, {
        value: snapshotValue,
        enumerable: true,
        configurable: false,
        writable: false,
      })
    }
    return Object.freeze(snapshot)
  } catch {
    return null
  }
}

export function exactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const record = snapshotDataRecord(value)
  if (!record) return null
  const expectedKeys = new Set(keys)
  if (expectedKeys.size !== keys.length) return null
  const ownKeys = Reflect.ownKeys(record)
  if (ownKeys.length !== expectedKeys.size) return null
  return ownKeys.every((key) => typeof key === 'string' && expectedKeys.has(key)) ? record : null
}

export function member<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : null
}

export function revision(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

export function expectedRevision(value: unknown): number | null | undefined {
  if (value === null) return null
  return revision(value) ?? undefined
}

export function boundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : null
}

export function instant(value: unknown): string | null {
  return typeof value === 'string' &&
    value.length <= 35 &&
    INSTANT_PATTERN.test(value) &&
    localDate(value.slice(0, 10)) !== null &&
    Number.isFinite(Date.parse(value))
    ? value
    : null
}

export function localDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const matched = LOCAL_DATE_PATTERN.exec(value)
  if (!matched) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) &&
    parsed.getUTCFullYear() === Number(matched[1]) &&
    parsed.getUTCMonth() + 1 === Number(matched[2]) &&
    parsed.getUTCDate() === Number(matched[3])
    ? value
    : null
}

export function distinctArray<T extends string>(
  value: unknown,
  maximum: number,
  parse: (entry: unknown) => T | null,
): readonly T[] | null {
  try {
    if (!Array.isArray(value)) return null
    if (Object.getPrototypeOf(value) !== Array.prototype) return null
    const ownKeys = Reflect.ownKeys(value)
    if (ownKeys.some((key) => typeof key !== 'string')) return null

    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length')
    if (
      !lengthDescriptor ||
      !Object.hasOwn(lengthDescriptor, 'value') ||
      lengthDescriptor.enumerable !== false ||
      lengthDescriptor.configurable !== false
    ) return null
    const count = lengthDescriptor.value
    if (!Number.isSafeInteger(count) || count < 0 || count > maximum) return null

    const expectedKeys = new Set<string>(['length'])
    for (let index = 0; index < count; index += 1) expectedKeys.add(String(index))
    if (
      ownKeys.length !== expectedKeys.size ||
      !ownKeys.every((key) => typeof key === 'string' && expectedKeys.has(key))
    ) return null

    const snapshot: unknown[] = []
    for (let index = 0; index < count; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
      if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')) return null
      const snapshotValue = descriptor.value
      snapshot.push(snapshotValue)
    }

    const parsed: T[] = []
    for (const snapshotValue of snapshot) {
      const entry = parse(snapshotValue)
      if (entry === null || parsed.includes(entry)) return null
      parsed.push(entry)
    }
    return Object.freeze(parsed)
  } catch {
    return null
  }
}

export function parseProductionWireInfrastructureFailureV1(
  value: unknown,
): ProductionWireInfrastructureFailureV1 | null {
  try {
    const record = exactRecord(value, ['schemaVersion', 'status'])
    if (!record || record.schemaVersion !== 1) return null
    const status = member(record.status, PRODUCTION_WIRE_INFRASTRUCTURE_STATUSES)
    return status ? Object.freeze({ schemaVersion: 1 as const, status }) : null
  } catch {
    return null
  }
}

export function safely<T>(parse: () => T | null): T | null {
  try {
    return parse()
  } catch {
    return null
  }
}
