import type { Question, Visual } from '../types'

/** A cell in a vertical-arithmetic grid: row 0 = top operand, col 0 = leftmost. */
export interface CellRef {
  row: number
  col: number
}

/** One annotation drawn ON a column-arithmetic digit (the borrow slash, carried 1…). */
export interface CellAnnotation {
  cell: CellRef
  text: string
  /** how to draw it: carry above, borrow slash + new value, decremented source, brought-down digit. */
  kind: 'carry' | 'borrow' | 'borrowFrom' | 'bringDown' | 'note'
}

/**
 * MT-1V per-step visual. Numbers ALWAYS come from the live question (via the viz
 * helpers), never placeholders — same interpolation rule as the spoken text.
 */
export type VizStep =
  | {
      // flagship: vertical arithmetic with borrows/carries drawn on the digits.
      kind: 'column'
      op: '+' | '−' | '×' | '÷'
      /** operand rows, top-to-bottom, as digit strings (already right-alignable). */
      rows: string[]
      /** the answer row shown under the rule (omitted while still working). */
      result?: string
      /** cells to emphasize for the current step. */
      highlights?: CellRef[]
      annotations?: CellAnnotation[]
    }
  | {
      kind: 'numberLine'
      min: number
      max: number
      marks?: number[]
      point?: number
      jumps?: { from: number; to: number; label?: string }[]
    }
  | { kind: 'fractionBar'; parts: number; shaded: number; compare?: { parts: number; shaded: number } }
  | { kind: 'array'; rows: number; cols: number; highlightRows?: number }
  | { kind: 'equationLedger'; lines: { left: string; right: string; op?: string }[]; activeLine: number }
  /** reuse an existing question Visual (clock / rect / ratioTable / coordGrid / fraction / angle). */
  | { kind: 'reuse'; visual: Visual }

/**
 * MT-1 scripted walkthrough. One ordered array of steps per question, built from
 * the question's ACTUAL generated numbers (see the explainers). `say` is the
 * spoken + always-displayed line; `show` is an optional substring of the prompt
 * to highlight while that step is on screen; `viz` (MT-1V) is an optional picture
 * rendered above the step text.
 */
export interface ExplainStep {
  say: string
  show?: string
  viz?: VizStep
}

export interface Explanation {
  steps: ExplainStep[]
}

/** An explainer turns a concrete question into its walkthrough. */
export type Explainer = (q: Question) => Explanation

/**
 * MT-1V distractor-aware diagnosis. Given the question and the index she chose,
 * returns a kind, specific first line naming the error pattern — or null when her
 * wrong answer matches no known pattern (then the walkthrough opens with concept).
 */
export type Diagnoser = (q: Question, chosenIndex: number) => string | null

/** Shared step builder — accepts `viz` and drops falsy entries so explainers read as a list. */
export const steps = (
  ...s: (ExplainStep | false | null | undefined)[]
): Explanation => ({ steps: s.filter(Boolean) as ExplainStep[] })

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
