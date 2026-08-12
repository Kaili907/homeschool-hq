import type { Grade } from '../../../types'
import {
  CLOSEOUT_REPLY,
  MAX_EXCHANGES,
  SCRIPTED_FLAG_REPLY,
  isConcerning,
  sanitizeReply,
} from '../../../tutor/tutorEngine'
import {
  askTutor,
  defaultTutorApiDeps,
  type AnthropicMessage,
  type TutorApiDeps,
} from '../../../tutor/tutorApi'
import { approvedJarvisPresentation, type StudyJarvisPresentation } from '../../jarvisAdapter'
import type { StudyScope } from '../../types'
import { staticHelpMessage } from './staticFallback'
import { TUTOR_CORE_GRADES, type FamilyPilotHelpContext, type FamilyPilotHelpEligibility, type FamilyPilotHelpPath } from './types'

/**
 * Family Pilot Tutor bridge (canHelp / startHelp / submitTurn / closeHelp).
 *
 * Scope note: this is deliberately LOCAL ONLY. It reuses src/tutor/tutorEngine.ts
 * and src/tutor/tutorApi.ts — the existing, reviewed Tutor Core — for math
 * problems with a known answer, and never calls or references the Server
 * Tutor approved-mapping system (src/study/production/**). An empty
 * approved-mapping set there is not a blocker for this bridge: when Tutor
 * Core can't take a turn, submitTurn degrades to the static Study-help
 * fallback instead of failing the lesson.
 *
 * Every function here is pure / stateless — a session is plain data owned by
 * the caller, so two students' sessions can never share or leak into each
 * other. Nothing in this module writes to any storage or network cache;
 * closeHelp() returns a summary with no raw conversation text, matching the
 * rawAnswerIncluded/transcriptIncluded:false convention used across
 * src/study/types.ts.
 */

const GREETING = "Hi! I'm here to help with this one — tell me what part is tricky."
const RETURN_TO_LESSON = 'Okay — back to your lesson!'

function gradeLiteral(grade: number): Grade | null {
  const candidate = String(Math.trunc(grade))
  return (TUTOR_CORE_GRADES as readonly string[]).includes(candidate) ? (candidate as Grade) : null
}

/** Whether the current segment can be handled by local Tutor Core, and why. */
export function canHelp(context: FamilyPilotHelpContext): FamilyPilotHelpEligibility {
  if (context.subject !== 'math') {
    return { path: 'static-fallback', reason: `Tutor Core only covers math; this segment is ${context.subject}.` }
  }
  const problem = context.problem
  if (!problem || !problem.prompt.trim() || !problem.correctAnswer.trim()) {
    return { path: 'static-fallback', reason: 'No single answer-checked problem is active for this segment.' }
  }
  if (!gradeLiteral(context.grade)) {
    return { path: 'static-fallback', reason: `Tutor Core does not cover grade ${context.grade}.` }
  }
  return { path: 'tutor-core', reason: 'Math problem with a known answer, in a Tutor Core grade.' }
}

export interface FamilyPilotHelpSession {
  readonly scope: StudyScope
  readonly context: FamilyPilotHelpContext
  readonly path: FamilyPilotHelpPath
  readonly eligibilityReason: string
  readonly studentTurns: number
  readonly flaggedForAdult: boolean
  readonly redactionOccurred: boolean
  readonly closed: boolean
  /** In-memory only, for this live session's API context. Never persisted or returned raw. */
  readonly transcript: readonly AnthropicMessage[]
}

export interface FamilyPilotHelpStep {
  readonly session: FamilyPilotHelpSession
  readonly presentation: StudyJarvisPresentation
}

function present(context: FamilyPilotHelpContext, text: string): StudyJarvisPresentation {
  return approvedJarvisPresentation(text, { noAudio: context.noAudio, mediaAvailable: context.mediaAvailable })
}

/** Opens a help session, scoped to the caller's context. Always succeeds. */
export function startHelp(context: FamilyPilotHelpContext): FamilyPilotHelpStep {
  const eligibility = canHelp(context)
  const session: FamilyPilotHelpSession = {
    scope: context.scope,
    context,
    path: eligibility.path,
    eligibilityReason: eligibility.reason,
    studentTurns: 0,
    flaggedForAdult: false,
    redactionOccurred: false,
    closed: false,
    transcript: [],
  }
  const text = eligibility.path === 'tutor-core' ? GREETING : staticHelpMessage(context)
  return { session, presentation: present(context, text) }
}

export interface FamilyPilotTutorDeps {
  /** Test seam; production resolves to tutor/tutorApi.ts's real gateway deps. */
  readonly apiDeps?: TutorApiDeps
}

/** Advances a session by one student message. Never throws; degrades to the fallback instead. */
export async function submitTurn(
  session: FamilyPilotHelpSession,
  studentMessage: string,
  deps: FamilyPilotTutorDeps = {},
): Promise<FamilyPilotHelpStep> {
  if (session.closed) return { session, presentation: present(session.context, RETURN_TO_LESSON) }

  const text = studentMessage.trim()

  // Local safety net first — runs before any API call, on every path.
  if (isConcerning(text)) {
    const next: FamilyPilotHelpSession = { ...session, studentTurns: session.studentTurns + 1, flaggedForAdult: true }
    return { session: next, presentation: present(session.context, SCRIPTED_FLAG_REPLY) }
  }

  if (session.path === 'static-fallback') {
    const next: FamilyPilotHelpSession = { ...session, studentTurns: session.studentTurns + 1 }
    return { session: next, presentation: present(session.context, staticHelpMessage(session.context)) }
  }

  const problem = session.context.problem
  const grade = gradeLiteral(session.context.grade)
  if (!problem || !grade) {
    // Context changed out from under an already-open tutor-core session — degrade, don't fail.
    const next: FamilyPilotHelpSession = {
      ...session,
      path: 'static-fallback',
      eligibilityReason: 'Problem context is no longer available for this segment.',
      studentTurns: session.studentTurns + 1,
    }
    return { session: next, presentation: present(session.context, staticHelpMessage(session.context)) }
  }

  if (session.studentTurns >= MAX_EXCHANGES) {
    const next: FamilyPilotHelpSession = { ...session, studentTurns: session.studentTurns + 1, flaggedForAdult: true }
    return { session: next, presentation: present(session.context, CLOSEOUT_REPLY) }
  }

  const apiDeps = deps.apiDeps ?? defaultTutorApiDeps()
  const result = await askTutor(apiDeps, {
    messages: [...session.transcript, { role: 'user', content: text }],
    gateway: {
      mode: 'tutor',
      context: {
        grade,
        problem: problem.prompt,
        correctAnswer: problem.correctAnswer,
        studentAnswer: problem.studentAnswer,
        graded: false,
      },
    },
  })

  if (!result.ok) {
    const next: FamilyPilotHelpSession = {
      ...session,
      path: 'static-fallback',
      eligibilityReason: `Tutor Core gateway unavailable (${result.reason}).`,
      studentTurns: session.studentTurns + 1,
    }
    return { session: next, presentation: present(session.context, staticHelpMessage(session.context)) }
  }

  const { text: safe, redacted } = sanitizeReply(result.text, problem.correctAnswer)
  const next: FamilyPilotHelpSession = {
    ...session,
    studentTurns: session.studentTurns + 1,
    redactionOccurred: session.redactionOccurred || redacted,
    transcript: [...session.transcript, { role: 'user', content: text }, { role: 'assistant', content: safe }],
  }
  return { session: next, presentation: present(session.context, safe) }
}

export interface FamilyPilotHelpSummary {
  readonly scope: StudyScope
  readonly path: FamilyPilotHelpPath
  readonly studentTurns: number
  readonly flaggedForAdult: boolean
  readonly redactionOccurred: boolean
  readonly rawConversationIncluded: false
}

/** Closes the session and hands the learner back to the Study session. No raw text survives. */
export function closeHelp(
  session: FamilyPilotHelpSession,
): { readonly session: FamilyPilotHelpSession; readonly summary: FamilyPilotHelpSummary; readonly presentation: StudyJarvisPresentation } {
  const summary: FamilyPilotHelpSummary = {
    scope: session.scope,
    path: session.path,
    studentTurns: session.studentTurns,
    flaggedForAdult: session.flaggedForAdult,
    redactionOccurred: session.redactionOccurred,
    rawConversationIncluded: false,
  }
  return {
    session: { ...session, closed: true, transcript: [] },
    summary,
    presentation: present(session.context, RETURN_TO_LESSON),
  }
}
