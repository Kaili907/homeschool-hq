/**
 * Shared wire primitives for the Manuel Academy study engine.
 *
 * Branded IDs are compile-time only. Runtime payloads remain plain strings so
 * legacy identifiers such as "p1", "mult", and "personal-finance" are
 * preserved byte-for-byte.
 */

export const STUDY_ENGINE_SCHEMA_VERSION = 1 as const
export type StudyEngineSchemaVersion = typeof STUDY_ENGINE_SCHEMA_VERSION

declare const brand: unique symbol
export type BrandedId<Name extends string> = string & { readonly [brand]: Name }

export type StudentId = BrandedId<'StudentId'>
export type StudyPlanId = BrandedId<'StudyPlanId'>
export type LessonId = BrandedId<'LessonId'>
export type SegmentId = BrandedId<'SegmentId'>
export type SessionId = BrandedId<'SessionId'>
export type SessionEventId = BrandedId<'SessionEventId'>
export type SessionResultId = BrandedId<'SessionResultId'>
export type FocusProfileId = BrandedId<'FocusProfileId'>
export type EvidenceId = BrandedId<'EvidenceId'>
export type SkillId = BrandedId<'SkillId'>
export type SubjectId = BrandedId<'SubjectId'>
export type ReviewId = BrandedId<'ReviewId'>
export type RetrievalAttemptId = BrandedId<'RetrievalAttemptId'>
export type ControlSetId = BrandedId<'ControlSetId'>
export type PrivateRecordId = BrandedId<'PrivateRecordId'>
export type PrivateNoteId = BrandedId<'PrivateNoteId'>
export type RecommendationId = BrandedId<'RecommendationId'>
export type AccommodationId = BrandedId<'AccommodationId'>
export type AdjustmentId = BrandedId<'AdjustmentId'>
export type InterruptionId = BrandedId<'InterruptionId'>

export type ISODate = string
export type ISODateTime = string
export type IanaTimeZone = string

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | { readonly [key: string]: JsonValue } | readonly JsonValue[]

export type ContractSource = 'manual' | 'adaptive-engine' | 'migration' | 'import'

export interface ContractMetadata {
  readonly source?: ContractSource
  readonly tags?: readonly string[]
  /**
   * The only open extension surface. Keys must be namespaced (for example,
   * "manuel:trace-id") and values must be bounded, JSON-safe data.
   */
  readonly extensions?: Readonly<Record<string, JsonValue>>
}

export interface ContractHeader<Kind extends string, Id extends string> {
  readonly kind: Kind
  readonly schemaVersion: StudyEngineSchemaVersion
  readonly id: Id
  readonly revision: number
  readonly createdAt: ISODateTime
  readonly updatedAt: ISODateTime
  readonly metadata?: ContractMetadata
}

export interface VersionedReference<Id extends string> {
  readonly id: Id
  readonly revision: number
}

export type GradeBand = 'elementary-3-5' | 'middle-6-8' | 'high-9-12'

/**
 * A contextual and revisable planning range for effective work blocks.
 * It is not a permanent characteristic of a child.
 */
export interface EffectiveWorkBlockRange {
  readonly minimumMinutes: number
  readonly targetMinutes: number
  readonly maximumMinutes: number
}

export interface MinuteRange {
  readonly minimumMinutes: number
  readonly defaultMinutes: number
  readonly maximumMinutes: number
}

export type AdultRole = 'parent' | 'teacher'
export type SessionActor = 'student' | AdultRole | 'tutor' | 'system'

export interface ActorReference {
  readonly role: SessionActor
  /** Opaque actor ID. Omit for an automated system actor. */
  readonly actorId?: string
}

/** Explicit cast helper. It never transforms or normalizes the identifier. */
export const asBrandedId = <Id extends string>(value: string): Id => value as Id

