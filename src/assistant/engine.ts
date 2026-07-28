import type { AssistantMessage, ISODate, Profile } from '../types'
import { isConcerning, SCRIPTED_FLAG_REPLY } from '../tutor/tutorEngine'
import { askTutor, type AnthropicMessage, type TutorApiDeps } from '../tutor/tutorApi'
import { assistantName, assistantPersona, atDailyCap } from './assistantState'
import { buildAssistantContext, renderAssistantContext } from './context'
import { buildActionCatalog, parseAction, renderActionCatalog, type AssistantAction } from './actions'
import { buildAssistantSystemPrompt } from './prompt'
import { renderExternalLessonContext, type ExternalLessonContext } from './externalLessonContext'

/**
 * MJ HS-assistant — one conversation turn.
 *
 * Order of guarantees (none depends on the model or the network):
 *   1. Concerning-content pre-screen → scripted care line + parent flag, NO API call.
 *   2. Daily-cap gate → a scripted "capped" line, NO API call.
 *   3. Otherwise assemble the request through the SAME model path the app uses and
 *      call it; parse an optional proposed action (still confirm-gated in the UI).
 * Degrades exactly like MT-2: no key / offline / error → an "offline" line.
 */

/** How many prior messages to include as conversation context (keeps tokens bounded). */
const HISTORY_WINDOW = 10

const NAPPING = 'Assistant is offline — check the key in Grown-Ups, or try again in a moment.'
const CAPPED = "That's all the assistant help for today — you've hit the daily limit. Ask your dad if you need more."

export type AssistantTurnResult =
  | { kind: 'reply'; text: string; action?: AssistantAction; source: 'api' }
  | { kind: 'flagged'; text: string }
  | { kind: 'capped'; text: string }
  | { kind: 'offline'; text: string }

/**
 * Assemble the exact request the app sends to the model for one turn. PURE and
 * separately testable: the refusal tests assert the returned `system` carries the
 * hardcoded must-nots (essay + assessment answers), so the constraint reaches the
 * configured model path regardless of what the model then returns.
 */
export function assembleAssistantRequest(
  profile: Profile,
  today: ISODate,
  history: AssistantMessage[],
  userText: string,
  lessonContext?: ExternalLessonContext,
): { system: string; messages: AnthropicMessage[]; catalog: AssistantAction[] } {
  const ctx = buildAssistantContext(profile, today)
  const catalog = buildActionCatalog(profile, today)
  const system = buildAssistantSystemPrompt({
    name: assistantName(profile),
    persona: assistantPersona(profile),
    grade: profile.grade,
    contextBlock: renderAssistantContext(ctx),
    actionCatalogText: renderActionCatalog(catalog),
    lessonContextBlock: lessonContext ? renderExternalLessonContext(lessonContext) : undefined,
  })
  const prior: AnthropicMessage[] = history
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))
  const messages: AnthropicMessage[] = [...prior, { role: 'user', content: userText }]
  return { system, messages, catalog }
}

/**
 * Run one turn. `deps` is the injected Anthropic client (defaultTutorApiDeps in the
 * app; a spy in tests). The cap/flag pre-screens run BEFORE any call.
 */
export async function runAssistantTurn(
  deps: TutorApiDeps,
  args: {
    profile: Profile
    today: ISODate
    history: AssistantMessage[]
    userText: string
    lessonContext?: ExternalLessonContext
  },
): Promise<AssistantTurnResult> {
  // 1. concerning content → scripted care line, no API, parent flag raised by caller.
  if (isConcerning(args.userText)) {
    return { kind: 'flagged', text: SCRIPTED_FLAG_REPLY }
  }
  // 2. daily cap → scripted capped line, no API.
  if (atDailyCap(args.profile, args.today)) {
    return { kind: 'capped', text: CAPPED }
  }
  // 3. real call through the configured model path.
  const { system, messages, catalog } = assembleAssistantRequest(
    args.profile,
    args.today,
    args.history,
    args.userText,
    args.lessonContext,
  )
  const res = await askTutor(deps, { system, messages })
  if (!res.ok) return { kind: 'offline', text: NAPPING }
  const { text, action } = parseAction(res.text, catalog)
  return { kind: 'reply', text: text || res.text, action, source: 'api' }
}
