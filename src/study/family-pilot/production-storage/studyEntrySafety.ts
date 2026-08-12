// FAMILY-PILOT-PRODUCTION-STORAGE: one Study-entry decision for the household.
//
// Two separate refusals can stand between a student and Study, and until now
// nothing joined them:
//
//   • the Family Pilot Safety Hold seam (../integration/safety), which is about
//     the child, and
//   • ../durable-ports/safetySeam, which is about whether this student's saved
//     work can currently be trusted.
//
// Both already speak FamilyPilotSafetyDecision, so joining them is a composition
// and not a new policy. Nothing here invents a reason to refuse.
//
// Order is deliberate: the Safety Hold is asked first. A hold is a decision
// about a child and must not be hidden behind a message about storage — and a
// student who is held is not going to reach the ports either way.
//
// One thing IS widened, deliberately and visibly: the durable-record refusal is
// documented in ../durable-ports/safetySeam as being about Study entry, and it
// is applied to Tutor entry here as well. That follows the precedent set by
// `createDurableStudyRecordSafetyPort` in that same file, which answers both
// hooks with one decision — a Tutor session writes through the same document,
// so a record this build must not touch blocks both doors or neither.

import {
  checkStudyEntry as askHoldForStudy,
  checkTutorEntry as askHoldForTutor,
  type FamilyPilotSafetyDecision,
  type FamilyPilotSafetyPort,
} from '../integration/safety'

export interface FamilyPilotStudyEntrySafetyInput {
  /**
   * This student's durable-record decision, read fresh on every call: a record
   * that goes unreadable mid-session has to start refusing at the next entry,
   * not at the next composition.
   */
  readonly durableRecord: (studentRef: string) => FamilyPilotSafetyDecision
  /** The Family Pilot Safety Hold seam. Absent means "no opinion", never "denied". */
  readonly holds?: FamilyPilotSafetyPort
}

/**
 * The composed entry guard: refused if the household's Safety Hold refuses, then
 * refused if this student's durable record cannot be trusted, otherwise allowed.
 *
 * Both sides are asked per student, so a hold on one child and an unreadable
 * record for another are independent — neither reaches a sibling.
 *
 * A throwing hold is already handled by the seam's own wrappers, which resolve
 * it to "allowed"; nothing is caught again here. The composed port itself is
 * likewise consumed through those wrappers, so this file adds no try/catch of
 * its own for a path that is guarded twice over.
 */
export function createFamilyPilotStudyEntrySafety(
  input: FamilyPilotStudyEntrySafetyInput,
): FamilyPilotSafetyPort {
  const decide = (
    ask: typeof askHoldForStudy,
  ) => (entry: { readonly studentRef: string; readonly assignmentRef: string }) => {
    const held = ask(input.holds, entry)
    return held.allowed ? input.durableRecord(entry.studentRef) : held
  }
  return Object.freeze({
    checkStudyEntry: decide(askHoldForStudy),
    checkTutorEntry: decide(askHoldForTutor),
  })
}
