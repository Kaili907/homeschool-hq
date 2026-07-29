/**
 * Compile-time proof that this feature consumes canonical Study Engine wire
 * primitives rather than replacing them with structurally incompatible brands.
 */
import type {
  EvidenceId as CanonicalEvidenceId,
  GradeBand as CanonicalGradeBand,
  ISODateTime as CanonicalISODateTime,
  SkillId as CanonicalSkillId,
  StudentId as CanonicalStudentId,
  SubjectId as CanonicalSubjectId,
} from '../../adaptive-tutor/study-engine/contracts/common.ts'
import type {
  EvidenceId,
  GradeBand,
  ISODateTime,
  SkillId,
  StudentId,
  SubjectId,
} from './ids.ts'

type Extends<Left, Right> = Left extends Right ? true : false
type Equal<Left, Right> =
  Extends<Left, Right> extends true
    ? Extends<Right, Left> extends true
      ? true
      : false
    : false
type Assert<Condition extends true> = Condition

type StudentIdIsCanonical = Assert<Equal<StudentId, CanonicalStudentId>>
type SubjectIdIsCanonical = Assert<Equal<SubjectId, CanonicalSubjectId>>
type SkillIdIsCanonical = Assert<Equal<SkillId, CanonicalSkillId>>
type EvidenceIdIsCanonical = Assert<Equal<EvidenceId, CanonicalEvidenceId>>
type DateTimeIsCanonical = Assert<Equal<ISODateTime, CanonicalISODateTime>>
type GradeBandIsCanonical = Assert<Equal<GradeBand, CanonicalGradeBand>>

export type CanonicalCompatibilityAssertions =
  | StudentIdIsCanonical
  | SubjectIdIsCanonical
  | SkillIdIsCanonical
  | EvidenceIdIsCanonical
  | DateTimeIsCanonical
  | GradeBandIsCanonical

