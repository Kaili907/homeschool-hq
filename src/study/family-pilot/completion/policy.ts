import type {
  FamilyPilotAttestationEvidence,
  FamilyPilotCompletionAuthority,
  FamilyPilotCompletionRecordV1,
  FamilyPilotCompletionStatus,
  FamilyPilotSnapshot,
} from '../core'

// FAMILY-PILOT-COMPLETION: the one completion-policy seam.
//
// Two authorities, and only two:
//
//   LEARNER_AUTHORITY
//     The learner finishing the work finishes the assignment. This is the
//     pilot's normal behaviour and the default for every lesson.
//
//   GUARDIAN_ATTESTATION_REQUIRED
//     The learner's completion is RECORDED and the assignment stays
//     PENDING_GUARDIAN_ATTESTATION. Only a household-authorized adult, acting
//     through an adult-facing surface, can certify it.
//
// The vocabulary is deliberately the curriculum's. A Ready-for-Life style
// student-work package carries `completionAuthority: 'learner' | 'guardian'`
// alongside a sign-off block whose `studentSelfReport` is
// 'recorded-but-not-certifying', and a real-world action always carries a
// non-null simulation alternative. This module is where that authored contract
// becomes runtime behaviour: `familyPilotCompletionAuthority` is the whole
// translation, so a package that says 'guardian' cannot be executed as though
// it said 'learner'.

/** The authored curriculum spelling of the same decision. */
export type CurriculumCompletionAuthority = 'learner' | 'guardian'

/** Authored spelling -> runtime authority. The only place the two are joined. */
export function familyPilotCompletionAuthority(
  authored: CurriculumCompletionAuthority,
): FamilyPilotCompletionAuthority {
  return authored === 'guardian' ? 'GUARDIAN_ATTESTATION_REQUIRED' : 'LEARNER_AUTHORITY'
}

/**
 * The attestation invariant, as a pure function of the two assertions that can
 * exist.
 *
 * Under guardian authority a learner assertion is not an input at all: it can
 * move the record to PENDING and no further, so it is absent from the CERTIFIED
 * branch by construction rather than by a check that could be forgotten.
 */
export function computeFamilyPilotCompletionStatus(
  authority: FamilyPilotCompletionAuthority,
  learnerAsserted: boolean,
  adultAttested: boolean,
): FamilyPilotCompletionStatus {
  if (authority === 'GUARDIAN_ATTESTATION_REQUIRED') {
    if (adultAttested) return 'CERTIFIED'
    return learnerAsserted ? 'PENDING_GUARDIAN_ATTESTATION' : 'NOT_COMPLETE'
  }
  return learnerAsserted ? 'CERTIFIED' : 'NOT_COMPLETE'
}

export interface FamilyPilotCompletionPolicyInput {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
}

/**
 * Resolves the completion authority for one piece of work.
 *
 * A port rather than a table because the authority belongs to the CURRICULUM,
 * not to the pilot: it travels with the lesson package. The pilot only has to
 * ask, and to fail safe when the answer is unavailable.
 */
export interface FamilyPilotCompletionPolicyPort {
  readonly authorityFor: (
    input: FamilyPilotCompletionPolicyInput,
  ) => FamilyPilotCompletionAuthority
}

/** The default. Every lesson completes on the learner's own authority. */
export function learnerAuthorityCompletionPolicy(): FamilyPilotCompletionPolicyPort {
  return { authorityFor: () => 'LEARNER_AUTHORITY' }
}

/**
 * Guardian attestation for a named set of lessons, learner authority for the
 * rest. This is the shape a curriculum-backed policy takes once packages
 * declare their own authority: the set is the lessons whose package says
 * 'guardian'.
 */
export function guardianAttestationCompletionPolicy(
  guardianLessonRefs: Iterable<string>,
): FamilyPilotCompletionPolicyPort {
  const required = new Set(guardianLessonRefs)
  return {
    authorityFor: ({ lessonRef }) =>
      required.has(lessonRef) ? 'GUARDIAN_ATTESTATION_REQUIRED' : 'LEARNER_AUTHORITY',
  }
}

/**
 * Wraps a policy so a throwing or absent one cannot decide a completion.
 *
 * The fallback is GUARDIAN_ATTESTATION_REQUIRED, not the default authority: a
 * policy that cannot answer must not be the reason a real-world adult-observed
 * task gets certified by a child's click. The cost of failing this way is that
 * an adult is asked to sign off on work that may not have needed it; the cost
 * of failing the other way is a false certification, which is the thing this
 * whole seam exists to prevent.
 */
export function resolveCompletionAuthority(
  policy: FamilyPilotCompletionPolicyPort | undefined,
  input: FamilyPilotCompletionPolicyInput,
): FamilyPilotCompletionAuthority {
  if (!policy) return 'LEARNER_AUTHORITY'
  try {
    const authority = policy.authorityFor(input)
    return authority === 'GUARDIAN_ATTESTATION_REQUIRED'
      ? 'GUARDIAN_ATTESTATION_REQUIRED'
      : authority === 'LEARNER_AUTHORITY'
        ? 'LEARNER_AUTHORITY'
        : 'GUARDIAN_ATTESTATION_REQUIRED'
  } catch {
    return 'GUARDIAN_ATTESTATION_REQUIRED'
  }
}

// ------------------------------------------------------------- attestation

/**
 * One adult attestation request.
 *
 * `lessonRef` is required and is the staleness guard: the adult surface names
 * the lesson it was showing, and an attestation raised against a lesson that is
 * no longer the one under this assignment is refused rather than applied.
 *
 * There is deliberately no field for a note, a description of what was
 * observed, a photo, or a recording. See FamilyPilotCompletionRecordV1.
 */
export interface FamilyPilotAttestationRequest {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
  /** Opaque adult reference. Never a name, an email, or a contact detail. */
  readonly attestedByRef: string
  readonly evidenceMode: FamilyPilotAttestationEvidence
}

export type FamilyPilotAttestationRejection =
  | 'adult-not-authorized'
  | 'unknown-student'
  | 'unknown-assignment'
  | 'lesson-binding-mismatch'
  | 'attestation-not-required'
  | 'attestation-not-recorded'
  /** Device storage refused the write. Nothing was certified. */
  | 'attestation-not-saved'
  /** Stored state came from a newer build; this one may not write to it. */
  | 'store-read-only'

export type FamilyPilotAttestationResult =
  | {
      readonly status: 'ok'
      readonly snapshot: FamilyPilotSnapshot
      readonly completion: FamilyPilotCompletionRecordV1
      /** True when this call certified nothing because it already was certified. */
      readonly alreadyAttested: boolean
    }
  | {
      readonly status: 'rejected'
      readonly reason: FamilyPilotAttestationRejection
      readonly message: string
      readonly snapshot: FamilyPilotSnapshot
    }

/** One piece of work waiting on this household's adult. */
export interface FamilyPilotPendingAttestation {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly subject: string
  readonly title: string
  readonly learnerAssertedAt: string | null
}
