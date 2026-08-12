import { canHelp } from '../../tutor/tutorBridge'
import type { FamilyPilotHelpContext, FamilyPilotHelpEligibility } from '../../tutor/types'

/**
 * FAMILY-PILOT-SUBJECT-ELA — Tutor capability check for an ELA segment. This
 * does not add, replace, or bypass the existing Tutor bridge
 * (src/study/family-pilot/tutor/tutorBridge.ts#canHelp): it is a thin,
 * subject-scoped call into that same reviewed gate. Tutor Core today only
 * covers math, so canHelp already routes every 'reading'/'writing' context to
 * { path: 'static-fallback' } with subject-specific copy already reviewed in
 * staticFallback.ts — the lesson is never blocked, and Tutor never completes
 * graded work, writes the assessed response, or reveals assessment answers,
 * because it is never handed any of that content in the first place (ELA
 * assessment prompts and scoring guidance live only in curriculum-content and
 * are never read by this lane).
 */
export function getElaTutorCapability(context: FamilyPilotHelpContext): FamilyPilotHelpEligibility {
  return canHelp(context)
}
