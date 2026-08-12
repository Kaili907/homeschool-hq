import type { StudyScope } from '../../../../types'
import type { FamilyPilotHelpContext } from '../../../tutor/types'
import type { TechCsDayPhase, TechCsLessonRef } from '../catalog/types'

/**
 * FF-M7 — Tutor / static explanation support for the Technology / CS lane.
 *
 * Every technology/CS help context carries subject 'other' and no
 * answer-checked problem, so the existing Family Pilot tutor bridge's
 * canHelp() (src/study/family-pilot/tutor/tutorBridge.ts) always resolves it
 * to the static-fallback path — technology/CS never reaches live Tutor Core.
 * That is intentional: source code and project work don't have the single
 * checkable answer Tutor Core's math bridge requires, so this lane sticks to
 * fixed, curriculum-shaped guidance instead.
 *
 * staticTechCsExplanation is the boundary that makes "the Tutor may help
 * reason about code and algorithms but may not silently complete graded
 * projects" a checkable contract rather than a convention: a
 * 'complete-project' request is always refused, and every granted response is
 * built from a fixed phase-hint table, never from the unit's own performance
 * task text, so it can never echo back a solved deliverable.
 */

export function techCsHelpContext(
  scope: StudyScope,
  grade: number,
  options: { readonly noAudio: boolean; readonly mediaAvailable: boolean },
): FamilyPilotHelpContext {
  return {
    scope,
    subject: 'other',
    grade,
    noAudio: options.noAudio,
    mediaAvailable: options.mediaAvailable,
  }
}

export type TechCsHelpRequest = 'hint' | 'explain-concept' | 'complete-project'

export interface TechCsHelpResponse {
  readonly granted: boolean
  readonly text: string
}

const REFUSAL_TEXT =
  "I can't complete a graded project for you. I can help you reason through the next step, explain a concept, or point out something to check."

const PHASE_HINT: Readonly<Record<TechCsDayPhase, string>> = {
  'launch-diagnostic': 'Start by recalling what you already know, then name one question you have.',
  'explicit-model': 'Look back at the model example and name the one step that is different from what you tried.',
  'guided-practice': 'Work through it one small step at a time — what evidence or reasoning supports the next step?',
  'application-project': 'Break the project into its smallest pieces and check one piece at a time before combining them.',
  'mastery-check': 'Show your reasoning or process alongside your answer, not just the result.',
  'correction-reflection': 'Compare your work to the success criteria and name one specific thing to fix.',
}

/** Curriculum-shaped static guidance only. Never derived from the unit's own
 * performance-task text, so it can never leak a solved answer for graded
 * work. Refuses outright on 'complete-project'. */
export function staticTechCsExplanation(lesson: TechCsLessonRef, request: TechCsHelpRequest): TechCsHelpResponse {
  if (request === 'complete-project') {
    return { granted: false, text: REFUSAL_TEXT }
  }
  const hint = PHASE_HINT[lesson.dayPhase]
  const text = request === 'explain-concept' ? `"${lesson.focus}" is today's focus. ${hint}` : hint
  return { granted: true, text }
}
