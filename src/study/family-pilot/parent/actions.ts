import type { StudyPortBundle } from '../../ports'
import { StudyParentController } from '../../parentController'
import type { StudyAdultAuthorization, StudyLearnerScope } from '../../types'
import type { FamilyPilotActionOutcome } from './types'

/**
 * The normal family-pilot action surface. Every action here is a thin,
 * typed wrapper around an existing Study Engine port/controller — no new
 * backend behavior is invented. Notably absent: clearing a device-local
 * safety stop. src/study/safety/localStopLedger.ts makes that lock
 * deliberately permanent ("a stop is a stop... narrowing this would let a
 * flagged learner back in by refreshing") and exposes no port to clear it,
 * so this module does not add a "clear pilot hold" action.
 */

function assertAdultAuthorized(authorization: StudyAdultAuthorization, scope: StudyLearnerScope): void {
  if (!authorization.adultAuthorized || authorization.householdRef !== scope.householdRef) {
    throw new Error('Verified adult authorization is required.')
  }
}

export async function allowResume(
  ports: StudyPortBundle,
  authorization: StudyAdultAuthorization,
  scope: StudyLearnerScope,
  blockRef: string,
  now: () => Date = () => new Date(),
): Promise<FamilyPilotActionOutcome> {
  try {
    assertAdultAuthorized(authorization, scope)
    const entries = await ports.calendar.list(scope)
    const entry = entries.find((candidate) => candidate.blockRef === blockRef)
    if (!entry || entry.state !== 'paused') {
      return { ok: false, message: 'Only a currently paused block can be resumed.' }
    }
    await ports.calendar.resume(scope, blockRef, now().toISOString())
    return { ok: true, message: 'Resume allowed.' }
  } catch {
    return { ok: false, message: 'Resume could not be completed. Check authorization and the current block state.' }
  }
}

export async function acknowledgeReview(
  ports: StudyPortBundle,
  scope: StudyLearnerScope,
  authorization: StudyAdultAuthorization,
  recommendationRef: string,
  decision: 'accepted' | 'rejected',
): Promise<FamilyPilotActionOutcome> {
  try {
    const controller = new StudyParentController(ports)
    await controller.execute(scope, authorization, {
      type: decision === 'accepted' ? 'accept-recommendation' : 'reject-recommendation',
      recommendationRef,
    })
    return {
      ok: true,
      message: decision === 'accepted' ? 'Review acknowledged and accepted.' : 'Review acknowledged and declined.',
    }
  } catch {
    return { ok: false, message: 'The review action was rejected. Check authorization and the current review queue.' }
  }
}
