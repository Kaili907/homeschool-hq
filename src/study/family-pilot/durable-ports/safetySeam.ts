// FAMILY-PILOT-DURABLE-PORTS: the safety seam, from the persistence side.
//
// This module makes no safety decision about a student, a lesson, or anything a
// student wrote. It has exactly one thing to say, and the Family Pilot Safety
// Hold module has no other way to learn it: whether this student's durable Study
// record can currently be trusted.
//
// That matters because a store that answered "no record" for a corrupt document
// would present a stopped or finished assignment as fresh work. The ports
// already refuse in that state; this expresses the same refusal in the decision
// shape ../integration/safety.ts already speaks, so a composition can consult it
// alongside the real safety holds without either side being rewritten.
//
// The import below is type-only on purpose. Nothing here depends on the
// integration layer at runtime, and this module is not wired anywhere — the
// convergence that owns composition decides how to combine this refusal with
// the Safety Hold module's own.

import type { FamilyPilotSafetyDecision, FamilyPilotSafetyPort } from '../integration/safety'
import type { StudyLearnerScope } from '../../types'
import type { FamilyPilotDurableStudyServices } from './durableStudyPorts'

const ALLOWED: FamilyPilotSafetyDecision = Object.freeze({ allowed: true })

/**
 * Refuses Study entry when this student's durable record cannot be read, and
 * says nothing at all otherwise.
 *
 * 'unavailable' — no device storage — is deliberately NOT a refusal. A family in
 * a private window would otherwise be locked out of Study entirely, and the
 * runtime keeps its own durable stop ledger regardless of what this store holds.
 * It is reported through `services.health()` so a parent surface can show it.
 */
export function durableStudyRecordDecision(
  services: FamilyPilotDurableStudyServices,
  scope: StudyLearnerScope,
): FamilyPilotSafetyDecision {
  const health = services.health(scope)
  if (health.status === 'quarantined') {
    return Object.freeze({
      allowed: false,
      reasonCode: `durable-study-record-${health.reasonCode ?? 'unreadable'}`,
      studentMessage: 'Your saved work could not be opened. Please go get an adult.',
    })
  }
  if (health.status === 'read-only') {
    return Object.freeze({
      allowed: false,
      reasonCode: `durable-study-record-${health.reasonCode ?? 'schema-version-ahead'}`,
      studentMessage: health.reasonCode === 'household-binding-mismatch' || health.reasonCode === 'storage-read-failed'
        ? 'Your saved work could not be opened. Please go get an adult.'
        : 'Your saved work needs a newer version of this app. Please go get an adult.',
    })
  }
  return ALLOWED
}

/**
 * The same decision as a FamilyPilotSafetyPort, for a composition that wants to
 * consult it through the existing seam. `studentRef` is the Core reference,
 * which ../integration/identity.ts documents as identical to `learnerRef`.
 */
export function createDurableStudyRecordSafetyPort(
  services: FamilyPilotDurableStudyServices,
  householdRef: string,
): FamilyPilotSafetyPort {
  const decide = (input: { readonly studentRef: string }): FamilyPilotSafetyDecision =>
    durableStudyRecordDecision(services, { householdRef, learnerRef: input.studentRef })
  return Object.freeze({ checkStudyEntry: decide, checkTutorEntry: decide })
}
