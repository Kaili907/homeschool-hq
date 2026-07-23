import type { Question } from '../types'

/**
 * MT-1 scripted walkthrough. One ordered array of steps per question, built from
 * the question's ACTUAL generated numbers (see the explainers). `say` is the
 * spoken + always-displayed line; `show` is an optional substring of the prompt
 * to highlight while that step is on screen.
 */
export interface ExplainStep {
  say: string
  show?: string
}

export interface Explanation {
  steps: ExplainStep[]
}

/** An explainer turns a concrete question into its walkthrough. */
export type Explainer = (q: Question) => Explanation

// ---------- parsing helpers (numbers come straight from the live question) ----------

/** The correct answer text, exactly as shown to the student. */
export const answerOf = (q: Question): string => q.choices[q.answerIndex]

/** All integers appearing in a string, in order (handles thousands separators & minus). */
export function ints(s: string): number[] {
  const cleaned = s.replace(/(\d),(\d)/g, '$1$2') // 1,234 -> 1234
  return (cleaned.match(/-?\d+/g) ?? []).map(Number)
}

/** All integers in the prompt. */
export const promptInts = (q: Question): number[] => ints(q.prompt)

/** A prompt trimmed of the trailing "= ?", the "❓", and newline tails, for quoting. */
export function cleanPrompt(q: Question): string {
  return q.prompt
    .replace(/\n[\s\S]*$/, '') // drop the second line ("What is the missing number?" etc.)
    .replace(/\s*=\s*\?\s*$/, '')
    .trim()
}
