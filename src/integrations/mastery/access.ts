import {
  asStudentId,
  type StudentId,
} from '../../../adaptive-learning/mastery/index.ts'

export type MasteryHostPrincipal =
  | {
      readonly kind: 'learner'
      readonly learnerId: string
    }
  | {
      readonly kind: 'adult'
      readonly actorId: string
    }
  | null

export type MasteryAccessDecision =
  | {
      readonly allowed: true
      readonly studentId: StudentId
    }
  | {
      readonly allowed: false
      readonly reason:
        | 'unauthenticated'
        | 'learner_scope_mismatch'
        | 'learner_route_only'
        | 'invalid_learner_id'
    }

/**
 * The learner map accepts only the ephemeral learner principal established by
 * a successful PIN flow. A persisted activeProfileId is not authentication.
 */
export function authorizeLearnerMasteryRoute(
  principal: MasteryHostPrincipal,
  activeProfileId: string | null,
  learnerProfileId: string,
): MasteryAccessDecision {
  if (!principal || !activeProfileId) {
    return { allowed: false, reason: 'unauthenticated' }
  }
  if (principal.kind !== 'learner') {
    return { allowed: false, reason: 'learner_route_only' }
  }
  if (
    principal.learnerId !== activeProfileId ||
    learnerProfileId !== activeProfileId
  ) {
    return { allowed: false, reason: 'learner_scope_mismatch' }
  }

  try {
    return {
      allowed: true,
      studentId: asStudentId(activeProfileId),
    }
  } catch {
    return { allowed: false, reason: 'invalid_learner_id' }
  }
}
