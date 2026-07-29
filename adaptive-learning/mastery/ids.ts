/**
 * Stable, opaque wire identifiers for the Manuel Academy mastery subsystem.
 *
 * Existing identity, subject, skill, and evidence IDs are direct aliases of
 * the canonical Study Engine contract. Branding exists only at compile time.
 * Values are never normalized, derived from display labels, or rewritten at
 * runtime, so legacy identifiers such as `p1`, `mult`, and `fracUnit` remain
 * byte-for-byte intact.
 */

import type {
  EvidenceId as CanonicalEvidenceId,
  GradeBand as CanonicalGradeBand,
  ISODate as CanonicalISODate,
  ISODateTime as CanonicalISODateTime,
  SkillId as CanonicalSkillId,
  StudentId as CanonicalStudentId,
  SubjectId as CanonicalSubjectId,
} from '../../adaptive-tutor/study-engine/contracts/common.ts'

declare const masteryIdBrand: unique symbol

export type BrandedMasteryId<Name extends string> = string & {
  readonly [masteryIdBrand]: Name
}

export type StudentId = CanonicalStudentId
export type SubjectId = CanonicalSubjectId
export type SkillId = CanonicalSkillId
export type SkillGraphId = BrandedMasteryId<'SkillGraphId'>
export type MasteryRecordId = BrandedMasteryId<'MasteryRecordId'>
export type EvidenceId = CanonicalEvidenceId
export type AssessmentAttemptId = BrandedMasteryId<'AssessmentAttemptId'>
export type TutorInterventionId = BrandedMasteryId<'TutorInterventionId'>
export type IndependentDemonstrationId =
  BrandedMasteryId<'IndependentDemonstrationId'>
export type OverrideId = BrandedMasteryId<'OverrideId'>
export type OverrideAuditEntryId = BrandedMasteryId<'OverrideAuditEntryId'>

export type ISODate = CanonicalISODate
export type ISODateTime = CanonicalISODateTime
export type GradeBand = CanonicalGradeBand

/**
 * IDs are intentionally permissive enough to preserve the existing Manuel
 * Academy identifiers while excluding whitespace, path syntax, and control
 * characters. The semantic stability rule is organizational: assign an ID
 * once and never recycle it, even when a title changes.
 */
export const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/

export function isStableId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 128 &&
    STABLE_ID_PATTERN.test(value)
  )
}

export function assertStableId(value: unknown, label = 'identifier'): string {
  if (!isStableId(value)) {
    throw new TypeError(
      `${label} must be a 1-128 character opaque ID using letters, digits, ".", "_", ":", "/", or "-".`,
    )
  }
  return value
}

function brandId<Id extends string>(value: string, label: string): Id {
  return assertStableId(value, label) as Id
}

export const asStudentId = (value: string): StudentId =>
  brandId<StudentId>(value, 'studentId')

export const asSubjectId = (value: string): SubjectId =>
  brandId<SubjectId>(value, 'subjectId')

export const asSkillId = (value: string): SkillId =>
  brandId<SkillId>(value, 'skillId')

export const asSkillGraphId = (value: string): SkillGraphId =>
  brandId<SkillGraphId>(value, 'skillGraphId')

export const asMasteryRecordId = (value: string): MasteryRecordId =>
  brandId<MasteryRecordId>(value, 'masteryRecordId')

export const asEvidenceId = (value: string): EvidenceId =>
  brandId<EvidenceId>(value, 'evidenceId')

export const asAssessmentAttemptId = (value: string): AssessmentAttemptId =>
  brandId<AssessmentAttemptId>(value, 'assessmentAttemptId')

export const asTutorInterventionId = (
  value: string,
): TutorInterventionId =>
  brandId<TutorInterventionId>(value, 'tutorInterventionId')

export const asIndependentDemonstrationId = (
  value: string,
): IndependentDemonstrationId =>
  brandId<IndependentDemonstrationId>(
    value,
    'independentDemonstrationId',
  )

export const asOverrideId = (value: string): OverrideId =>
  brandId<OverrideId>(value, 'overrideId')

export const asOverrideAuditEntryId = (
  value: string,
): OverrideAuditEntryId =>
  brandId<OverrideAuditEntryId>(value, 'overrideAuditEntryId')

/**
 * A tuple storage key for hosts that need deterministic lookup without
 * pretending a concatenation of two independent opaque IDs is itself a valid,
 * bounded aggregate ID. Persisted MasteryRecordId values remain caller-issued.
 */
export function masteryRecordStorageKeyFor(
  studentId: StudentId,
  skillId: SkillId,
): readonly [StudentId, 'student-skill-mastery', SkillId] {
  return [studentId, 'student-skill-mastery', skillId]
}
