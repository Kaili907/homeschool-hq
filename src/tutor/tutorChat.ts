import type { Grade, NeedsDadFlag, Profile, TutorChat, TutorMessage } from '../types'
import type { SkillId } from '../skills'
import { DEFAULT_DAILY_CAP, MAX_EXCHANGES } from './tutorEngine'

/**
 * MT-2 tutor-chat state — pure helpers over the additive optional Profile fields
 * (tutorChats / tutorCalls / tutorDailyCap). Every write returns a new Profile so
 * it composes under the functional-update rule (CLAUDE.md rule 6).
 */

const DAY_MS = 24 * 60 * 60 * 1000
const RETAIN_MS = 60 * DAY_MS // transcripts + call log auto-prune after 60 days

const monthOf = (day: string) => day.slice(0, 7)

export interface TutorChatContext {
  skillId: SkillId
  grade: Grade
  problem: string
  correctAnswer: string
  herAnswer: string
}

export function newTutorChat(ctx: TutorChatContext, id: string, ts: number, day: string): TutorChat {
  return {
    id,
    skillId: ctx.skillId,
    grade: ctx.grade,
    day,
    startedTs: ts,
    problem: ctx.problem,
    correctAnswer: ctx.correctAnswer,
    herAnswer: ctx.herAnswer,
    messages: [],
  }
}

export function appendMessage(chat: TutorChat, msg: TutorMessage): TutorChat {
  return { ...chat, messages: [...chat.messages, msg] }
}

/** Kid turns so far — one "exchange" per kid message; MAX_EXCHANGES gates the chat. */
export const kidTurns = (chat: TutorChat): number => chat.messages.filter((m) => m.role === 'kid').length

export const atExchangeLimit = (chat: TutorChat): boolean => kidTurns(chat) >= MAX_EXCHANGES

// ---------- daily / monthly cap (backed by tutorCalls timestamps) ----------

export const dailyCap = (p: Profile): number => p.tutorDailyCap ?? DEFAULT_DAILY_CAP

export function setDailyCap(p: Profile, n: number): Profile {
  return { ...p, tutorDailyCap: Math.max(0, Math.floor(n)) }
}

/** Real Anthropic calls made on `day` (YYYY-MM-DD), from the call log. */
export function callsOnDay(p: Profile, day: string): number {
  const start = Date.parse(`${day}T00:00:00`)
  const end = start + DAY_MS
  return (p.tutorCalls ?? []).filter((ts) => ts >= start && ts < end).length
}

/** Real Anthropic calls in `day`'s month — the month-to-date meter. */
export function callsInMonth(p: Profile, day: string): number {
  const m = monthOf(day)
  return (p.tutorCalls ?? []).filter((ts) => monthOf(isoDayOf(ts)) === m).length
}

/** True once she's used up the day's cap — checked BEFORE each real call. */
export const atDailyCap = (p: Profile, day: string): boolean => callsOnDay(p, day) >= dailyCap(p)

/** Local YYYY-MM-DD for an epoch-ms (matches appState.isoToday's local-calendar rule). */
function isoDayOf(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- persistence: record a call, upsert a transcript, prune (all functional) ----------

function prune(p: Profile, nowTs: number): Pick<Profile, 'tutorChats' | 'tutorCalls'> {
  const cutoff = nowTs - RETAIN_MS
  return {
    tutorChats: (p.tutorChats ?? []).filter((c) => c.startedTs >= cutoff),
    tutorCalls: (p.tutorCalls ?? []).filter((ts) => ts >= cutoff),
  }
}

/** Log one real Anthropic call at `ts` (drives the cap + meter). Prunes old entries. */
export function recordCall(p: Profile, ts: number): Profile {
  const pruned = prune(p, ts)
  return { ...p, ...pruned, tutorCalls: [...(pruned.tutorCalls ?? []), ts] }
}

/** Insert or replace a transcript by id, then prune to the 60-day window. */
export function saveChat(p: Profile, chat: TutorChat, nowTs: number): Profile {
  const pruned = prune(p, nowTs)
  const without = (pruned.tutorChats ?? []).filter((c) => c.id !== chat.id)
  return { ...p, ...pruned, tutorChats: [...without, chat] }
}

/** Transcripts newest-first, for the Grown-Ups "Tutor chats" view. */
export function recentChats(p: Profile): TutorChat[] {
  return [...(p.tutorChats ?? [])].sort((a, b) => b.startedTs - a.startedTs)
}

// ---------- Needs-Dad flag raised from a tutor chat (reuses the MT-1 flag surface) ----------

/**
 * Raise a Needs-Dad flag for this question's skill from a tutor chat (6-exchange
 * close-out or concerning content). Reuses profile.tutorFlags so it appears in the
 * existing parent dashboard and gates the skill in practice. No-op if already flagged.
 */
export function flagFromTutor(p: Profile, skillId: SkillId, reason: string, day: string): Profile {
  if (p.tutorFlags?.[skillId]) return p
  const flag: NeedsDadFlag = { since: day, reason, sessionCount: 0, weekCount: 0 }
  return { ...p, tutorFlags: { ...p.tutorFlags, [skillId]: flag } }
}
