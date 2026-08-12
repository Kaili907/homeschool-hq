import type { AcademyGrade, AcademySubject, Grade } from '../../../types'

/** Stable local identifier for a roster entry. Never regenerated on edit. */
export type FamilySetupStudentRef = string

/**
 * One student in the local family roster. Display name is not identity —
 * the studentRef is — so two students may share a displayName.
 */
export interface FamilySetupStudent {
  readonly studentRef: FamilySetupStudentRef
  readonly displayName: string
  /** What she *is*, for reporting surfaces. Distinct from working grade. */
  readonly nominalGrade: Grade
  /** Per-subject override of the nominal grade. Absent subject rides nominal. */
  readonly workingGradeBySubject: Partial<Record<AcademySubject, AcademyGrade>>
  readonly enabledSubjects: readonly AcademySubject[]
  readonly pinRequired: boolean
  readonly createdAt: string
  readonly updatedAt: string
}

export interface FamilySetupState {
  readonly students: readonly FamilySetupStudent[]
  readonly completedAt: string | null
}

export const EMPTY_FAMILY_SETUP_STATE: FamilySetupState = Object.freeze({
  students: [],
  completedAt: null,
})

export type FamilySetupBlockReason =
  | 'student-not-found'
  | 'duplicate-ref'
  | 'invalid-student-ref'
  | 'max-students-reached'
  | 'invalid-display-name'
  | 'invalid-nominal-grade'
  | 'invalid-working-grade'
  | 'invalid-subject'
  | 'subject-not-enabled'
  | 'no-enabled-subjects'
  | 'empty-roster'
  | 'invalid-configuration'
  | 'progress-confirmation-required'

export type FamilySetupMutationResult =
  | { readonly status: 'ok'; readonly state: FamilySetupState }
  | {
      readonly status: 'blocked'
      readonly reason: FamilySetupBlockReason
      readonly studentRef?: FamilySetupStudentRef
      readonly issues?: readonly FamilySetupValidationIssue[]
    }

export interface FamilySetupValidationIssue {
  /** Absent for roster-level issues (e.g. an empty roster) that aren't tied to one student. */
  readonly studentRef?: FamilySetupStudentRef
  readonly reason: FamilySetupBlockReason
}

export interface FamilySetupValidationResult {
  readonly valid: boolean
  readonly issues: readonly FamilySetupValidationIssue[]
}

/** Host-supplied signal for whether removal would discard real work. */
export interface FamilySetupRemovalContext {
  readonly hasProgress: boolean
  /** Set true once the host has confirmed the destructive removal (e.g. via a dialog). */
  readonly confirmed?: boolean
}
