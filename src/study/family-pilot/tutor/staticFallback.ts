import type { StudySubject } from '../../types'
import type { FamilyPilotHelpContext } from './types'

/**
 * The static Study-help fallback. Fixed copy, no model call — used whenever
 * Tutor Core can't take this turn (ineligible content, or the gateway failed
 * mid-session) so a help request never fails the lesson.
 */
const FALLBACK_BY_SUBJECT: Record<StudySubject, string> = {
  math: "I can't pull up extra tutor help for this one right now. Try breaking the problem into smaller steps, or ask a parent or teacher to sit with you for a minute.",
  reading: 'Try rereading the tricky part out loud, or ask a parent or teacher what a word or sentence means.',
  writing: 'Jot down one sentence about what you want to say, then read it back — or ask a parent or teacher to help you get unstuck.',
  other: 'Take a breath and try the next small step, or ask a parent or teacher for help with this one.',
}

export function staticHelpMessage(context: FamilyPilotHelpContext): string {
  return FALLBACK_BY_SUBJECT[context.subject]
}
