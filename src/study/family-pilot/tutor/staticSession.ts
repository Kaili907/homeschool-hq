import { approvedJarvisPresentation } from '../../jarvisAdapter'
import { CLOSEOUT_REPLY, isConcerning, MAX_EXCHANGES, SCRIPTED_FLAG_REPLY } from '../../../tutor/safety'
import type { FamilyPilotHelpContext } from './types'
import type {
  FamilyPilotHelpSession,
  FamilyPilotHelpStep,
  FamilyPilotHelpSummary,
} from './tutorBridge'
import { staticHelpMessage } from './staticFallback'

const RETURN_TO_LESSON = 'Okay — back to your lesson!'

function present(context: FamilyPilotHelpContext, text: string) {
  return approvedJarvisPresentation(text, {
    noAudio: context.noAudio,
    mediaAvailable: context.mediaAvailable,
  })
}

/** Production Family Pilot help is fixed curriculum guidance with no answer key. */
export function startStaticHelp(context: FamilyPilotHelpContext): FamilyPilotHelpStep {
  return {
    session: {
      scope: context.scope,
      context,
      path: 'static-fallback',
      eligibilityReason: 'The production pilot provides answer-independent curriculum help.',
      studentTurns: 0,
      flaggedForAdult: false,
      redactionOccurred: false,
      closed: false,
      transcript: [],
    },
    presentation: present(context, staticHelpMessage(context)),
  }
}

export function continueStaticHelp(session: FamilyPilotHelpSession, studentMessage: string): FamilyPilotHelpStep {
  if (session.closed) return { session, presentation: present(session.context, RETURN_TO_LESSON) }
  if (isConcerning(studentMessage.trim())) {
    const next = { ...session, studentTurns: session.studentTurns + 1, flaggedForAdult: true, transcript: [] }
    return { session: next, presentation: present(session.context, SCRIPTED_FLAG_REPLY) }
  }
  if (session.studentTurns >= MAX_EXCHANGES) {
    const next = { ...session, studentTurns: session.studentTurns + 1, flaggedForAdult: true, transcript: [] }
    return { session: next, presentation: present(session.context, CLOSEOUT_REPLY) }
  }
  const next = { ...session, studentTurns: session.studentTurns + 1, transcript: [] }
  return { session: next, presentation: present(session.context, staticHelpMessage(session.context)) }
}

export function closeStaticHelp(session: FamilyPilotHelpSession): {
  readonly session: FamilyPilotHelpSession
  readonly summary: FamilyPilotHelpSummary
  readonly presentation: FamilyPilotHelpStep['presentation']
} {
  const summary: FamilyPilotHelpSummary = {
    scope: session.scope,
    path: 'static-fallback',
    studentTurns: session.studentTurns,
    flaggedForAdult: session.flaggedForAdult,
    redactionOccurred: session.redactionOccurred,
    rawConversationIncluded: false,
  }
  return {
    session: { ...session, path: 'static-fallback', closed: true, transcript: [] },
    summary,
    presentation: present(session.context, RETURN_TO_LESSON),
  }
}
