import { staticHelpMessage } from '../../tutor/staticFallback'
import { canHelp } from '../../tutor/tutorBridge'
import type { FamilyPilotHelpContext, FamilyPilotHelpPath } from '../../tutor/types'
import type { ScienceLessonDetail } from './types'

/**
 * FAMILY-PILOT-SCIENCE-1 — the Tutor capability projection.
 *
 * This does not reimplement Tutor eligibility: it reuses the existing,
 * reviewed Family Pilot Tutor bridge (canHelp / staticHelpMessage) so the
 * Science lane can never drift from the same boundary math already respects.
 * canHelp only ever grants the live Tutor Core path to a single
 * answer-checked math problem (context.subject === 'math' with a
 * context.problem present); a science lesson never supplies either, so this
 * always — and correctly — resolves to the static fallback. Tutor may
 * explain, interpret data, and ask guiding questions once a real help
 * session is open (see ../../tutor/tutorBridge.ts submitTurn), but it never
 * fabricates an observation or completes a graded investigation for the
 * learner: there is no code path here that could hand it one.
 */

const PROBE_SCOPE = Object.freeze({
  householdRef: 'family-pilot-science-probe',
  learnerRef: 'family-pilot-science-probe',
  sessionRef: 'family-pilot-science-probe:tutor-capability',
})

export interface ScienceTutorCapability {
  readonly lessonId: string
  readonly path: FamilyPilotHelpPath
  readonly reason: string
  /** The exact text a learner would see if they opened help on this lesson
   * right now. Static, scripted copy — never a model call. */
  readonly staticHelpMessage: string
  /** True for every science lesson: static-only operation is always
   * available, independent of Tutor Core's own availability. */
  readonly staticOperationAvailable: true
}

export interface ScienceTutorCapabilityOptions {
  readonly grade?: number
  readonly noAudio?: boolean
  readonly mediaAvailable?: boolean
}

/** The help capability for one science lesson. Deterministic and free of
 * side effects — it never opens or advances a help session. */
export function getScienceTutorCapability(
  lesson: ScienceLessonDetail,
  options: ScienceTutorCapabilityOptions = {},
): ScienceTutorCapability {
  const context: FamilyPilotHelpContext = {
    scope: PROBE_SCOPE,
    // Science is never the single answer-checked math problem canHelp
    // requires for the live Tutor Core path (see module doc above).
    subject: 'other',
    grade: options.grade ?? Number(lesson.grade),
    noAudio: options.noAudio ?? false,
    mediaAvailable: options.mediaAvailable ?? true,
  }
  const eligibility = canHelp(context)
  return {
    lessonId: lesson.lessonId,
    path: eligibility.path,
    reason: eligibility.reason,
    staticHelpMessage: staticHelpMessage(context),
    staticOperationAvailable: true,
  }
}
