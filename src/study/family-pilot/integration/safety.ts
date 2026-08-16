// FAMILY-PILOT-INTEGRATION: the optional safety seam.
//
// The local Family Pilot Safety work is being built on its own branch and is
// not merged here. This port is the agreed narrow seam so that the two can meet
// later without either side being rewritten: pilot C1 must run correctly with
// `safety` absent, so every call site treats an unset port as "no opinion" and
// never as "denied".
//
// This is NOT the hosted commercial adult-review pipeline, which stays
// deliberately unwired.

export type FamilyPilotSafetyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reasonCode: string; readonly studentMessage: string }

export interface FamilyPilotSafetyPort {
  /**
   * Consulted before a student starts or resumes Study. Returning a refusal
   * blocks that transition only; it never mutates pilot state.
   */
  readonly checkStudyEntry?: (input: {
    readonly studentRef: string
    readonly assignmentRef: string
  }) => FamilyPilotSafetyDecision
  /** Consulted before a Tutor help session opens. */
  readonly checkTutorEntry?: (input: {
    readonly studentRef: string
    readonly assignmentRef: string
  }) => FamilyPilotSafetyDecision
}

const ALLOWED: FamilyPilotSafetyDecision = Object.freeze({ allowed: true })

/**
 * An absent port, an absent hook, or a hook that throws all resolve to
 * "allowed". A pilot that hard-failed closed when safety is not installed would
 * be a pilot the family cannot use at all, and the Study runtime keeps its own
 * durable stop ledger regardless of what this seam says.
 */
export function checkStudyEntry(
  safety: FamilyPilotSafetyPort | undefined,
  input: { readonly studentRef: string; readonly assignmentRef: string },
): FamilyPilotSafetyDecision {
  try {
    return safety?.checkStudyEntry?.(input) ?? ALLOWED
  } catch {
    return ALLOWED
  }
}

export function checkTutorEntry(
  safety: FamilyPilotSafetyPort | undefined,
  input: { readonly studentRef: string; readonly assignmentRef: string },
): FamilyPilotSafetyDecision {
  try {
    return safety?.checkTutorEntry?.(input) ?? ALLOWED
  } catch {
    return ALLOWED
  }
}
