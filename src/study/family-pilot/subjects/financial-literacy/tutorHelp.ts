import { canHelp } from '../../tutor/tutorBridge'
import { staticHelpMessage } from '../../tutor/staticFallback'
import type { FamilyPilotHelpContext, FamilyPilotHelpEligibility } from '../../tutor/types'
import type { FinLitLessonRef } from './types'

/**
 * FAMILY-PILOT-FINLIT-1 — the Tutor / static-help capability.
 *
 * src/study/family-pilot/tutor/tutorBridge.ts's canHelp() only ever routes to
 * 'tutor-core' for `context.subject === 'math'`. Financial-literacy content
 * is always StudySubject 'other' (see studyAdapter.ts), so canHelp() always
 * returns 'static-fallback' for this lane — that is the existing, reviewed
 * boundary this module respects, not a gap it works around. What this module
 * adds is lesson-aware framing layered on top of the fixed fallback copy; it
 * never replaces or duplicates that copy, and it never opens a live Tutor
 * Core session.
 */

/** Always resolves to 'static-fallback' for financial literacy; exposed so
 * callers get the eligibility reason through the same reviewed path every
 * other subject uses, instead of a lane-local shortcut. */
export function financialLiteracyHelpEligibility(context: FamilyPilotHelpContext): FamilyPilotHelpEligibility {
  return canHelp(context)
}

/** The static help text for a segment, using the lesson's own title when
 * known, and falling back to the exact reviewed copy otherwise. */
export function financialLiteracyHelpText(
  context: FamilyPilotHelpContext,
  lesson: FinLitLessonRef | null,
): string {
  const fallback = staticHelpMessage(context)
  if (!lesson) return fallback
  return `This step is from "${lesson.title}." ${fallback}`
}
