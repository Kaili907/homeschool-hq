import { assessContentSpecificity } from './specificity'
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

/**
 * Authoring markers, matched as authoring syntax rather than as vocabulary.
 * `TODO` is case-sensitive and `placeholder` only counts in bracket form,
 * because "the zero acts as a placeholder in the hundreds place" is ordinary
 * place-value language and "Todos los estudiantes" is ordinary Spanish — a
 * gate that fails those is a gate nobody keeps running.
 */
const PLACEHOLDER_MARKERS: readonly RegExp[] = [
  /\bTODOs?\b/,
  /\bTO-DOs?\b/,
  /\bto-?dos?\b\s*[:\-–—]/i,
  /\b(?:TBD|TBA)\b/,
  /\bfix\s?me\b/i,
  /[[<{]{1,2}\s*place\s?holder\s*[\]>}]{1,2}/i,
  /\bcoming soon\b/i,
  /\bto be (?:added|written|filled(?: in)?|provided|determined|completed)\b/i,
  /\bfill (?:this |these )?in later\b/i,
  /\blorem ipsum\b/i,
]

/** Content that is only a filler token, with no answer in it at all. */
const FILLER_ONLY =
  /^(?:answer\s*key\s*[:.\-–—]?\s*)?(?:n\/?a|none|tbc|placeholder|xxx+|\.{2,}|-{1,}|_{2,})[\s.!:;,\-–—]*$/i

/**
 * Phrases that defer the actual answer somewhere else. Legitimate keys do
 * sometimes contain one of these for a single item, so these are doubts, not
 * defects.
 */
const DEFERRED_AUTHORITY_PHRASES: readonly RegExp[] = [
  /\bsee (?:the )?(?:teacher|instructor|parent|answer)'?s? (?:guide|manual|key|edition|packet|copy)\b/i,
  /\banswers? (?:will |may |can )?vary\b/i,
  /\banswers? (?:are |is )?(?:below|above|attached|on file|in the (?:back|appendix))\b/i,
  /\baccept any reasonable answer\b/i,
  // Keys that say in plain English they are not finished yet. These read as
  // substantive prose to the specificity heuristic, so they need naming.
  /\b(?:will|yet to) be (?:added|written|drafted|provided|supplied|completed|filled in)\b/i,
  /\b(?:pending|forthcoming|still (?:being |in )|in progress|to come)\b[^.]{0,40}\b(?:review|draft|drafted|written|prepared|solutions?|answers?)\b/i,
  /\b(?:answers?|solutions?|answer key)\b[^.]{0,40}\b(?:pending|forthcoming|to come|in progress|being (?:drafted|written|prepared))\b/i,
  /\b(?:draft only|not final|provisional|first pass)\b/i,
  /\bhave not been (?:checked|verified|reviewed|confirmed)\b/i,
]

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
  const hollowReasons: string[] = []
  const doubtReasons: string[] = []

  const text = content?.text?.trim() ?? ''
  if (text.length === 0) {
    // Says only that no text was recorded — not that the author wrote nothing.
    // An ANSWER_KEY the gate cannot read is one it cannot vouch for either way.
    hollowReasons.push('no answer-key text is recorded, so there is nothing for the gate to score against')
    return { hollowReasons, doubtReasons }
  }

  const placeholder = PLACEHOLDER_MARKERS.find((pattern) => pattern.test(text))
  if (placeholder) {
    hollowReasons.push(`answer key text still contains an authoring placeholder (${placeholder.source})`)
  }
  if (FILLER_ONLY.test(text)) {
    hollowReasons.push('answer key text is a filler token rather than an answer')
  }

  const deferral = DEFERRED_AUTHORITY_PHRASES.find((pattern) => pattern.test(text))
  if (deferral) {
    doubtReasons.push('answer key defers the actual answer elsewhere rather than stating it')
  }

  const specificity = assessContentSpecificity({ present: true, text }, title)
  if (specificity.evaluated && !specificity.sufficientlySpecific) {
    doubtReasons.push(...specificity.reasons)
  }

  return { hollowReasons, doubtReasons }
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
