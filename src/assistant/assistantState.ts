import type { AssistantMessage, AssistantSession, AssistantState, ISODate, Profile } from '../types'

/**
 * MJ HS-assistant state — pure helpers over the additive optional `Profile.assistant`
 * field (see types.ts). Every write returns a new Profile so it composes under the
 * functional-update rule (CLAUDE.md rule 6). Modeled on MT-2's tutor-chat state, but
 * with its OWN call log + cap (default 40, vs the tutor's 20) and its own transcripts.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const RETAIN_MS = 60 * DAY_MS // transcripts + call log auto-prune after 60 days

/** Default per-girl daily assistant-call cap (Dad-editable in Grown-Ups). */
export const DEFAULT_ASSISTANT_CAP = 40

/** Default assistant name when Dad hasn't set one. */
export const DEFAULT_ASSISTANT_NAME = 'Jarvis'

const monthOf = (day: string) => day.slice(0, 7)

/** Local YYYY-MM-DD for an epoch-ms (matches appState.isoToday's local-calendar rule). */
function isoDayOf(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function defaultAssistantState(): AssistantState {
  return { calls: [], sessions: [] }
}

export function getAssistantState(p: Profile): AssistantState {
  return p.assistant ?? defaultAssistantState()
}

// ---------- per-girl config ----------

export function assistantName(p: Profile): string {
  const n = p.assistant?.name?.trim()
  return n && n.length > 0 ? n : DEFAULT_ASSISTANT_NAME
}

export function assistantPersona(p: Profile): string {
  return p.assistant?.persona?.trim() ?? ''
}

export function assistantDailyCap(p: Profile): number {
  return p.assistant?.dailyCap ?? DEFAULT_ASSISTANT_CAP
}

function patchAssistant(p: Profile, patch: Partial<AssistantState>): Profile {
  return { ...p, assistant: { ...getAssistantState(p), ...patch } }
}

export function setAssistantName(p: Profile, name: string): Profile {
  return patchAssistant(p, { name: name.trim() || undefined })
}

export function setAssistantPersona(p: Profile, persona: string): Profile {
  return patchAssistant(p, { persona: persona.trim() || undefined })
}

export function setAssistantDailyCap(p: Profile, n: number): Profile {
  return patchAssistant(p, { dailyCap: Math.max(0, Math.floor(n)) })
}

// ---------- daily / monthly cap (backed by the assistant call log) ----------

/** Real Anthropic calls made on `day` (YYYY-MM-DD), from the call log. */
export function callsOnDay(p: Profile, day: string): number {
  const start = Date.parse(`${day}T00:00:00`)
  const end = start + DAY_MS
  return getAssistantState(p).calls.filter((ts) => ts >= start && ts < end).length
}

/** Real Anthropic calls in `day`'s month — the month-to-date meter. */
export function callsInMonth(p: Profile, day: string): number {
  const m = monthOf(day)
  return getAssistantState(p).calls.filter((ts) => monthOf(isoDayOf(ts)) === m).length
}

/** True once she's used up the day's cap — checked BEFORE each real call. */
export function atDailyCap(p: Profile, day: string): boolean {
  return callsOnDay(p, day) >= assistantDailyCap(p)
}

// ---------- persistence: record a call, upsert a transcript, prune (all functional) ----------

function prune(p: Profile, nowTs: number): Pick<AssistantState, 'calls' | 'sessions'> {
  const cutoff = nowTs - RETAIN_MS
  const st = getAssistantState(p)
  return {
    calls: st.calls.filter((ts) => ts >= cutoff),
    sessions: st.sessions.filter((s) => s.startedTs >= cutoff),
  }
}

/** Log one real Anthropic call at `ts` (drives the cap + meter). Prunes old entries. */
export function recordAssistantCall(p: Profile, ts: number): Profile {
  const pruned = prune(p, ts)
  return { ...p, assistant: { ...getAssistantState(p), ...pruned, calls: [...pruned.calls, ts] } }
}

export function newAssistantSession(id: string, ts: number, day: ISODate): AssistantSession {
  return { id, day, startedTs: ts, messages: [] }
}

export function appendAssistantMessage(session: AssistantSession, msg: AssistantMessage): AssistantSession {
  return { ...session, messages: [...session.messages, msg] }
}

/** Insert or replace a transcript by id, then prune to the 60-day window. */
export function saveAssistantSession(p: Profile, session: AssistantSession, nowTs: number): Profile {
  const pruned = prune(p, nowTs)
  const without = pruned.sessions.filter((s) => s.id !== session.id)
  return { ...p, assistant: { ...getAssistantState(p), ...pruned, sessions: [...without, session] } }
}

/** Transcripts newest-first, for the Grown-Ups assistant view. */
export function recentAssistantSessions(p: Profile): AssistantSession[] {
  return [...getAssistantState(p).sessions].sort((a, b) => b.startedTs - a.startedTs)
}
