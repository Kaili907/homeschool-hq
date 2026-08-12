import type { LessonContentBlock } from './types'

/**
 * A measurable (not authoritative) signal that a content block reads as a
 * templated scaffold — the unit/lesson title interpolated into generic
 * boilerplate — rather than student-ready instruction. This is a heuristic
 * for routing to human review, not a substitute for human curriculum review.
 */
export interface ContentSpecificitySignal {
  /** False when there was no text to evaluate — nothing to flag either way. */
  readonly evaluated: boolean
  readonly sufficientlySpecific: boolean
  readonly reasons: readonly string[]
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'is', 'are', 'this', 'that', 'will', 'students', 'student', 'lesson', 'unit',
])

const GENERIC_SCAFFOLD_PHRASES = [
  /in this lesson,?\s+students will\s+/i,
  /complete the .*\bworksheet\b/i,
  /review the (key )?concepts? (from|of) this (unit|lesson)/i,
  /practice (the )?skills? (learned|covered) in this (unit|lesson)/i,
  /students will learn about/i,
  /this (lesson|unit) covers/i,
]

const MIN_WORDS_FOR_CONFIDENCE = 25
const MIN_UNIQUE_CONTENT_WORDS = 8

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function assessContentSpecificity(
  block: LessonContentBlock | undefined,
  title: string,
): ContentSpecificitySignal {
  if (!block?.present || !block.text || block.text.trim().length === 0) {
    return { evaluated: false, sufficientlySpecific: true, reasons: [] }
  }

  const text = block.text.trim()
  const reasons: string[] = []

  if (GENERIC_SCAFFOLD_PHRASES.some((pattern) => pattern.test(text))) {
    reasons.push('matches a known generic scaffold phrase')
  }

  const words = tokenize(text)
  if (words.length < MIN_WORDS_FOR_CONFIDENCE) {
    reasons.push(
      `content is only ${words.length} words, below the ${MIN_WORDS_FOR_CONFIDENCE}-word confidence floor`,
    )
  }

  const titleWords = new Set(tokenize(title))
  const uniqueContentWords = new Set(
    words.filter((word) => !STOPWORDS.has(word) && !titleWords.has(word)),
  )
  if (uniqueContentWords.size < MIN_UNIQUE_CONTENT_WORDS) {
    reasons.push(
      `only ${uniqueContentWords.size} distinct words beyond the title and common stopwords — reads as the title interpolated into generic text`,
    )
  }

  return {
    evaluated: true,
    sufficientlySpecific: reasons.length === 0,
    reasons,
  }
}
