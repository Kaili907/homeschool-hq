import type { Grade } from '../types'
import {
  CLOSEOUT_REPLY,
  DEFAULT_DAILY_CAP,
  isConcerning,
  MAX_EXCHANGES,
  NAPPING_REPLY,
  SCRIPTED_FLAG_REPLY,
} from './safety'

export {
  CLOSEOUT_REPLY,
  DEFAULT_DAILY_CAP,
  isConcerning,
  MAX_EXCHANGES,
  NAPPING_REPLY,
  SCRIPTED_FLAG_REPLY,
} from './safety'

/**
 * MT-2 tutor SAFETY engine — the load-bearing child-safety layer. Pure + fully
 * testable. Two guarantees hold regardless of what the model returns:
 *   1. the system prompt hard-codes the spec's constraints verbatim, and
 *   2. sanitizeReply() redacts any reply that leaks the final answer.
 * The scripted flag/close-out lines and caps live here so the UI can't drift.
 */

/** Shown in place of any model reply that leaked the answer. Never contains it. */
export const SAFE_REDACTION =
  "Good try — but I can't just give the answer! Here's a hint: what's the very next small step you could take?"

export interface TutorContext {
  grade: Grade
  problem: string
  correctAnswer: string
  herAnswer: string
}

/**
 * The hard-coded system prompt. The constraint sentences are copied verbatim from
 * the spec — they are child-safety rules, not suggestions. Only the per-question
 * facts (grade, problem, answers) are interpolated.
 */
export function buildSystemPrompt(ctx: TutorContext): string {
  const n = ctx.grade
  return [
    `You are a patient tutor for a grade-${n} student working this exact problem: ${ctx.problem}. Correct answer: ${ctx.correctAnswer}. Her answer: ${ctx.herAnswer}.`,
    `NEVER state the final answer. Guide with one question or one hint at a time.`,
    `Maximum 3 sentences per reply. Vocabulary appropriate for grade ${n}.`,
    `Warm, encouraging, zero sarcasm. If the student asks for the answer directly, cheerfully decline and offer the next-smallest hint.`,
    `If the student says anything unrelated to the problem, gently steer back. If she seems upset or says anything concerning, reply only: "${SCRIPTED_FLAG_REPLY}" and the app raises a parent flag.`,
  ].join('\n')
}

// ---------- answer-leak redaction (runs on EVERY model reply) ----------

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function presentationValue(value: string): string {
  let normalized = value.trim()
  const wrappers = [
    ['**', '**'],
    ['__', '__'],
    ['*', '*'],
    ['_', '_'],
    ['`', '`'],
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['‘', '’'],
  ]
  for (let pass = 0; pass < 5; pass += 1) {
    let next = normalized.replace(/[.!?…。！？]+$/u, '').trim()
    const wrapper = wrappers.find(
      ([open, close]) => next.length > open.length + close.length && next.startsWith(open) && next.endsWith(close),
    )
    if (wrapper) next = next.slice(wrapper[0].length, -wrapper[1].length).trim()
    if (next === normalized) break
    normalized = next
  }
  return normalized.toLowerCase()
}

/**
 * Redacts any model reply that leaks the correct answer. Returns the safe text and
 * whether a redaction happened. Multi-character / non-numeric answers are redacted
 * on any word-boundary occurrence; a bare single digit is only treated as a leak
 * when it's declared as the answer (so ordinary hints like "count by 2s" survive).
 */
export function sanitizeReply(reply: string, correctAnswer: string): { text: string; redacted: boolean } {
  const ans = correctAnswer.trim()
  if (!ans) return { text: reply, redacted: false }
  const esc = escapeRe(ans)
  const occurrence = new RegExp(`(^|[^\\w/$.])${esc}([^\\w/]|$)`, 'i')
  const answerOnly = presentationValue(reply) === presentationValue(ans)
  let leaked = answerOnly || occurrence.test(reply)
  if (leaked && !answerOnly && /^\d$/.test(ans)) {
    leaked = new RegExp(`\\b(is|are|equals?|answer|=)\\b[^.!?]*?(^|[^\\w])${esc}([^\\w]|$)`, 'i').test(reply)
  }
  return leaked ? { text: SAFE_REDACTION, redacted: true } : { text: reply, redacted: false }
}
