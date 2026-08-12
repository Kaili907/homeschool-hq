import { DEFAULT_STUDY_ACCESSIBILITY, learnerLocalDate } from '../../hostContext'
import type { HostStudyLaunchContext, StudyLearnerScope, StudySubject } from '../../types'
import type { FamilyPilotStudentRef } from '../auth/types'
import type { FamilyPilotLearnerOption } from '../parent/types'

// FAMILY-PILOT-INTEGRATION: one identity, spelled seven ways.
//
// The seven pilot modules were built in parallel and each named the learner in
// its own vocabulary: Core keys records on a flat `studentRef`, Student Login
// selects a `StudyLearnerSelector`, the Study runtime scopes work by
// `learnerRef`, and the Parent Hub lists `FamilyPilotLearnerOption`. Left
// unreconciled, that is exactly how student A's work ends up rendered under
// student B — so every conversion in the integrated pilot goes through this
// file, and nowhere else.
//
// The Core `studentRef` is canonical. It is the value that is persisted, so it
// is the only one that survives a reload, and every other spelling is derived
// from it by a total function. Critically, `learnerRef === studentRef`: the
// Study runtime's own `student-mismatch` guard therefore compares the very
// string Core persisted, which makes the runtime a second, independent check on
// student isolation rather than a system that has to be kept in sync with one.

/**
 * The pilot is one household on one device, so the household reference is a
 * constant rather than a server-issued value. It is deliberately NOT derived
 * from any authenticated user: pilot state must never be mistakable for
 * server-derived authority (see the BROWSER_AUTHORITY_CLAIM_KEYS note in
 * ../core/schema.ts).
 */
export const FAMILY_PILOT_HOUSEHOLD_REF = 'family-pilot-household'

/**
 * Selector kind. 'legacy-profile-id' is correct and 'academy-student-id' would
 * be a lie: a pilot studentRef is a device-local profile id this build minted,
 * never an Academy server student id.
 */
const SELECTOR_KIND = 'legacy-profile-id' as const

/** Core studentRef -> the selector the Student Login surface controls. */
export function toStudentSelector(studentRef: string): FamilyPilotStudentRef {
  return { kind: SELECTOR_KIND, value: studentRef }
}

/**
 * Selector -> Core studentRef. The selector carries the canonical ref verbatim,
 * so this is exact: no parsing, no prefix stripping, and no way for two
 * students to collapse onto one ref.
 */
export function fromStudentSelector(selector: FamilyPilotStudentRef): string {
  return selector.value
}

/** Core studentRef -> the Study runtime's learner scope. */
export function learnerScopeFor(studentRef: string): StudyLearnerScope {
  return { householdRef: FAMILY_PILOT_HOUSEHOLD_REF, learnerRef: studentRef }
}

/** Core studentRef -> the Parent Hub's learner option. */
export function learnerOptionFor(
  studentRef: string,
  displayName: string,
): FamilyPilotLearnerOption {
  return { hostProfileRef: studentRef, learnerRef: studentRef, displayName }
}

/**
 * The launch context for one lesson under one student.
 *
 * buildHostStudyContext() is deliberately not reused here: it refuses to build
 * a context without an authenticated, bound, provenance-verified sync user, and
 * the family pilot is local-first by design. The pilot supplies the same
 * defaults that function does rather than inventing its own policy.
 */
export function launchContextFor(input: {
  readonly studentRef: string
  readonly grade: number
  readonly subject: StudySubject
  readonly lessonRef: string
  readonly skillRefs: readonly string[]
  readonly householdTimeZone: string
  readonly at: Date
}): HostStudyLaunchContext {
  return {
    householdRef: FAMILY_PILOT_HOUSEHOLD_REF,
    learnerRef: input.studentRef,
    hostProfileRef: input.studentRef,
    grade: input.grade,
    subject: input.subject,
    lessonRef: input.lessonRef,
    skillRefs: [...input.skillRefs],
    householdTimeZone: input.householdTimeZone,
    learnerLocalDate: learnerLocalDate(input.at, input.householdTimeZone),
    accessibility: DEFAULT_STUDY_ACCESSIBILITY,
    timerPreference: { visibility: 'shown', milestonesOnly: false },
    parentLimits: { maximumWorkMinutes: 30, breakMinutes: 5 },
    accommodationLimits: {},
  }
}
