import { approvedJarvisPresentation } from '../../jarvisAdapter'
import type { StudyJarvisPresentation } from '../../jarvisAdapter'
import type { StudyScope } from '../../types'
import { CLOSEOUT_REPLY, isConcerning, MAX_EXCHANGES, SCRIPTED_FLAG_REPLY } from '../../../tutor/safety'
import type { FamilyPilotHelpContext, FamilyPilotHelpPath } from './types'
import { staticHelpMessage } from './staticFallback'

const RETURN_TO_LESSON = 'Okay — back to your lesson!'

function present(context: FamilyPilotHelpContext, text: string) {
  return approvedJarvisPresentation(text, {
    noAudio: context.noAudio,
    mediaAvailable: context.mediaAvailable,
  })
}

/** Production-only help state. It is structurally incapable of carrying conversation text. */
export interface FamilyPilotStaticHelpSession {
  readonly scope: StudyScope
  readonly context: FamilyPilotHelpContext
  readonly path: FamilyPilotHelpPath
  readonly eligibilityReason: string
  readonly studentTurns: number
  readonly flaggedForAdult: boolean
  readonly redactionOccurred: boolean
  readonly closed: boolean
}

export interface FamilyPilotStaticHelpStep {
  readonly session: FamilyPilotStaticHelpSession
  readonly presentation: StudyJarvisPresentation
}

export interface FamilyPilotStaticHelpSummary {
  readonly scope: StudyScope
  readonly path: FamilyPilotHelpPath
  readonly studentTurns: number
  readonly flaggedForAdult: boolean
  readonly redactionOccurred: boolean
  readonly rawConversationIncluded: false
}

/** Production Family Pilot help is fixed curriculum guidance with no answer key. */
export function startStaticHelp(context: FamilyPilotHelpContext): FamilyPilotStaticHelpStep {
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
    },
    presentation: present(context, staticHelpMessage(context)),
  }
}

export function continueStaticHelp(session: FamilyPilotStaticHelpSession, studentMessage: string): FamilyPilotStaticHelpStep {
  if (session.closed) return { session, presentation: present(session.context, RETURN_TO_LESSON) }
  if (isConcerning(studentMessage.trim())) {
    const next = { ...session, studentTurns: session.studentTurns + 1, flaggedForAdult: true }
    return { session: next, presentation: present(session.context, SCRIPTED_FLAG_REPLY) }
  }
  if (session.studentTurns >= MAX_EXCHANGES) {
    const next = { ...session, studentTurns: session.studentTurns + 1, flaggedForAdult: true }
    return { session: next, presentation: present(session.context, CLOSEOUT_REPLY) }
  }
  const next = { ...session, studentTurns: session.studentTurns + 1 }
  return { session: next, presentation: present(session.context, staticHelpMessage(session.context)) }
}

export function closeStaticHelp(session: FamilyPilotStaticHelpSession): {
  readonly session: FamilyPilotStaticHelpSession
  readonly summary: FamilyPilotStaticHelpSummary
  readonly presentation: FamilyPilotStaticHelpStep['presentation']
} {
  const summary: FamilyPilotStaticHelpSummary = {
    scope: session.scope,
    path: 'static-fallback',
    studentTurns: session.studentTurns,
    flaggedForAdult: session.flaggedForAdult,
    redactionOccurred: session.redactionOccurred,
    rawConversationIncluded: false,
  }
  return {
    session: { ...session, path: 'static-fallback', closed: true },
    summary,
    presentation: present(session.context, RETURN_TO_LESSON),
  }
}
