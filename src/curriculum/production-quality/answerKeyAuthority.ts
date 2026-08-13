import { assessScoringContentSubstance } from './scoringContentSubstance'
import type { LessonContentBlock, ScoringAuthorityVerification } from './types'

/**
 * Answer-key checks the gate can honestly make.
 *
 * A generic gate cannot prove that "2 + 2 = 5" is false, and this module does
 * not pretend to. What it can do is refuse to call a key authoritative when
 * there is nothing to score against (empty, placeholder, deferral) and when
 * nobody has recorded how the key's correctness was established. Anything the
 * heuristics can only doubt is reported as doubt, for a human to settle.
 */

export interface AnswerKeyContentSignal {
  /** Defects that make the block unusable as a key at all — blocking. */
  readonly hollowReasons: readonly string[]
  /** Heuristic doubts about student-readiness — route to human review. */
  readonly doubtReasons: readonly string[]
}

const VERIFIED_METHODS: readonly ScoringAuthorityVerification['method'][] = [
  'INDEPENDENT_ORACLE',
  'SOURCE_AUTHORITY',
  'HUMAN_VERIFIED',
  'OTHER_VERIFIED_METHOD',
]

/** Enough words that the evidence names a method and what it was run against. */
const MIN_EVIDENCE_WORDS = 6

export function assessAnswerKeyContent(
  content: LessonContentBlock | undefined,
  title: string,
): AnswerKeyContentSignal {
  return assessScoringContentSubstance(content, title, {
    // Says only that no text was recorded — not that the author wrote nothing.
    // An ANSWER_KEY the gate cannot read is one it cannot vouch for either way.
    emptyReason:
      'no answer-key text is recorded, so there is nothing for the gate to score against',
    placeholderReason: 'answer key text still contains an authoring placeholder',
    fillerReason: 'answer key text is a filler token rather than an answer',
    deferralReason: 'answer key defers the actual answer elsewhere rather than stating it',
  })
}

export interface AnswerKeyAuthoritySignal {
  readonly verified: boolean
  /** Why the authority could not be established; empty when verified. */
  readonly reason: string
}

export function assessAnswerKeyAuthority(
  verification: ScoringAuthorityVerification | undefined,
): AnswerKeyAuthoritySignal {
  if (!verification) {
    return {
      verified: false,
      reason: 'no verification method is recorded, so the key\'s correctness rests on nothing the gate can see',
    }
  }
  if (!VERIFIED_METHODS.includes(verification.method)) {
    return {
      verified: false,
      reason: `verification method is recorded as ${verification.method}`,
    }
  }
  const evidence = verification.evidence?.trim() ?? ''
  if (evidence.length === 0) {
    return {
      verified: false,
      reason: `${verification.method} is declared with no supporting evidence, which is a claim rather than a verification`,
    }
  }
  const evidenceWords = evidence.split(/\s+/).filter(Boolean)
  if (evidenceWords.length < MIN_EVIDENCE_WORDS) {
    return {
      verified: false,
      reason: `${verification.method} evidence is only ${evidenceWords.length} words — too thin to tell what was checked against what`,
    }
  }
  return { verified: true, reason: '' }
}
