import {
  asBrandedId,
  type GradeBand,
  type SkillId,
  type StudentId,
  type SubjectId,
} from './common.ts'

export type LegacyAcademyGrade = '3' | '4' | '6' | '10' | '12'

const LEGACY_GRADE_BANDS: Readonly<Record<LegacyAcademyGrade, GradeBand>> = {
  '3': 'elementary-3-5',
  '4': 'elementary-3-5',
  '6': 'middle-6-8',
  '10': 'high-9-12',
  '12': 'high-9-12',
}

/** Maps only the legacy closed grade union; it does not infer placement. */
export function gradeBandFromLegacyGrade(grade: LegacyAcademyGrade): GradeBand {
  return LEGACY_GRADE_BANDS[grade]
}

/**
 * Temporary adapters preserve legacy identifiers byte-for-byte. Callers must
 * validate the returned aggregate at the study-engine boundary.
 */
export const studentIdFromLegacyProfileId = (id: string): StudentId =>
  asBrandedId<StudentId>(id)

export const skillIdFromLegacySkillId = (id: string): SkillId =>
  asBrandedId<SkillId>(id)

export const subjectIdFromLegacySubjectId = (id: string): SubjectId =>
  asBrandedId<SubjectId>(id)

