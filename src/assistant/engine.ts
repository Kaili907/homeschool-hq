import type { AssistantMessage, ISODate, Profile } from '../types'
import { isConcerning, SCRIPTED_FLAG_REPLY } from '../tutor/tutorEngine'
import { askTutor, type AcademyGatewayRequest, type AnthropicMessage, type TutorApiDeps } from '../tutor/tutorApi'
import { assistantName, assistantPersona, atDailyCap } from './assistantState'
import { buildAssistantContext } from './context'
import { buildActionCatalog, parseAction, type AssistantAction } from './actions'

/**
 * MJ HS-assistant — one conversation turn.
 *
 * Order of guarantees (none depends on the model or the network):
 *   1. Concerning-content pre-screen → scripted care line + parent flag, NO API call.
 *   2. Daily-cap gate → a scripted "capped" line, NO API call.
 *   3. Otherwise assemble the request through the SAME model path the app uses and
 *      call it; parse an optional proposed action (still confirm-gated in the UI).
 * Degrades exactly like MT-2: gateway policy / offline / error → an "offline" line.
 */

/** How many prior messages to include as conversation context (keeps tokens bounded). */
const HISTORY_WINDOW = 10
const singleLine = (value: string, max: number) =>
  value
    .replace(/[\u0000-\u001f\u007f]+/gu, ' ')
    .trim()
    .slice(0, max)
const boundedInt = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.trunc(Number.isFinite(value) ? value : min)))

const NAPPING = 'Assistant is offline — sign in or try again in a moment.'
const NOT_ENTITLED = 'Assistant access is not enabled for this account. Ask your dad for help.'
const GATEWAY_DISABLED = 'Assistant access is paused right now. Try again later.'
const CAPPED = "That's all the assistant help for today — you've hit the daily limit. Ask your dad if you need more."

export type AssistantTurnResult =
  | { kind: 'reply'; text: string; action?: AssistantAction; source: 'api' }
  | { kind: 'flagged'; text: string }
  | { kind: 'capped'; text: string }
  | { kind: 'offline'; text: string }

/**
 * Assemble the exact allowlisted request the app sends to the Academy gateway.
 * Provider policy and credentials stay server-owned.
 */
export function assembleAssistantRequest(
  profile: Profile,
  today: ISODate,
  history: AssistantMessage[],
  userText: string,
): {
  messages: AnthropicMessage[]
  catalog: AssistantAction[]
  gateway: AcademyGatewayRequest
} {
  const ctx = buildAssistantContext(profile, today)
  const catalog = buildActionCatalog(profile, today)
  const prior: AnthropicMessage[] = history
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))
  while (prior[0]?.role === 'assistant') prior.shift()
  const messages: AnthropicMessage[] = [...prior, { role: 'user', content: userText }]
  const gateway: AcademyGatewayRequest = {
    mode: 'jarvis',
    context: {
      assistant: {
        name: singleLine(assistantName(profile), 40) || 'Jarvis',
        tonePreference: singleLine(assistantPersona(profile), 160),
      },
      student: {
        grade: ctx.grade as '10' | '12',
        today: ctx.today,
        mission: ctx.mission.slice(0, 24).map((item) => ({
          label: singleLine(item.label, 160) || 'Untitled mission item',
          done: item.done,
        })),
        deadlines: (ctx.deadlines ?? []).slice(0, 24).map((item) => ({
          label: singleLine(item.label, 160) || 'Untitled deadline',
          due: /^\d{4}-\d{2}-\d{2}$/.test(item.due) ? item.due : '',
          overdue: item.overdue,
        })),
        courses: ctx.courses.slice(0, 24).map((item) => {
          const total = boundedInt(item.total, 0, 1000)
          return {
            name: singleLine(item.name, 120) || 'Untitled course',
            done: boundedInt(item.done, 0, total),
            total,
          }
        }),
        geometry: ctx.geometry.slice(0, 24).map((item) => ({
          name: singleLine(item.name, 120) || 'Geometry practice',
          attempts: boundedInt(item.attempts, 1, 100000),
          accuracy: item.accuracy === null ? null : boundedInt(item.accuracy, 0, 100),
        })),
        algebra: ctx.algebra.slice(0, 24).map((item) => ({
          name: singleLine(item.name, 120) || 'Algebra practice',
          attempts: boundedInt(item.attempts, 1, 100000),
          accuracy: item.accuracy === null ? null : boundedInt(item.accuracy, 0, 100),
        })),
        assessments: ctx.assessments.slice(0, 24).map((item) => ({
          title: singleLine(item.title, 160) || 'Assessment',
          status: item.status,
        })),
      },
      actions: catalog
        .filter(({ key }) => key.length <= 100 && /^[A-Za-z0-9:_-]+$/.test(key))
        .slice(0, 50)
        .map(({ key, label }) => ({
          key,
          label: singleLine(label, 180) || 'Confirm action',
        })),
      graded: false,
    },
  }
  return { messages, catalog, gateway }
}

/**
 * Run one turn. `deps` is the injected Anthropic client (defaultTutorApiDeps in the
 * app; a spy in tests). The cap/flag pre-screens run BEFORE any call.
 */
export async function runAssistantTurn(
  deps: TutorApiDeps,
  args: { profile: Profile; today: ISODate; history: AssistantMessage[]; userText: string },
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
  const { messages, catalog, gateway } = assembleAssistantRequest(
    args.profile,
    args.today,
    args.history,
    args.userText,
  )
  const res = await askTutor(deps, { messages, gateway })
  if (!res.ok) {
    if (res.reason === 'usage_limit') return { kind: 'capped', text: CAPPED }
    if (res.reason === 'not_entitled') return { kind: 'offline', text: NOT_ENTITLED }
    if (res.reason === 'gateway_disabled') return { kind: 'offline', text: GATEWAY_DISABLED }
    return { kind: 'offline', text: NAPPING }
  }
  const { text, action } = parseAction(res.text, catalog)
  return { kind: 'reply', text: text || res.text, action, source: 'api' }
}
