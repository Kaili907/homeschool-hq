import { assessContentSpecificity } from './specificity'
import type { LessonContentBlock } from './types'

/**
 * Substance checks shared by every kind of scoring authority.
 *
 * The gate cannot prove an answer true or a rubric well-judged. What it can
 * do is refuse to call any authority substantive when there is nothing to
 * score against — empty, placeholder, filler — and report as doubt anything
 * the heuristics can only suspect, for a human to settle.
 */
export interface ScoringContentSubstanceSignal {
  /** Defects that make the block unusable as an authority at all — blocking. */
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

/** Content that is only a filler token, with no authority in it at all. */
const FILLER_ONLY =
  /^(?:(?:answer\s*key|rubric|criteria)\s*[:.\-–—]?\s*)?(?:n\/?a|none|tbc|placeholder|xxx+|\.{2,}|-{1,}|_{2,})[\s.!:;,\-–—]*$/i

/**
 * Phrases that defer the actual authority somewhere else. Legitimate keys and
 * rubrics do sometimes contain one of these for a single item, so these are
 * doubts, not defects.
 */
const DEFERRED_AUTHORITY_PHRASES: readonly RegExp[] = [
  /\bsee (?:the )?(?:teacher|instructor|parent|answer)'?s? (?:guide|manual|key|edition|packet|copy)\b/i,
  /\banswers? (?:will |may |can )?vary\b/i,
  /\banswers? (?:are |is )?(?:below|above|attached|on file|in the (?:back|appendix))\b/i,
  /\baccept any reasonable answer\b/i,
  // Authorities that say in plain English they are not finished yet. These
  // read as substantive prose to the specificity heuristic, so they need
  // naming.
  /\b(?:will|yet to) be (?:added|written|drafted|provided|supplied|completed|filled in)\b/i,
  /\b(?:pending|forthcoming|still (?:being |in )|in progress|to come)\b[^.]{0,40}\b(?:review|draft|drafted|written|prepared|solutions?|answers?)\b/i,
  /\b(?:answers?|solutions?|answer key)\b[^.]{0,40}\b(?:pending|forthcoming|to come|in progress|being (?:drafted|written|prepared))\b/i,
  /\b(?:draft only|not final|provisional|first pass)\b/i,
  /\bhave not been (?:checked|verified|reviewed|confirmed)\b/i,
]

/**
 * `emptyReason` is the caller's wording for "nothing was recorded", which
 * differs between an answer key and a rubric; everything else is shared.
 */
export function assessScoringContentSubstance(
  content: LessonContentBlock | undefined,
  title: string,
  labels: { readonly emptyReason: string; readonly placeholderReason: string; readonly fillerReason: string; readonly deferralReason: string },
): ScoringContentSubstanceSignal {
  const hollowReasons: string[] = []
  const doubtReasons: string[] = []

  const text = content?.text?.trim() ?? ''
  if (text.length === 0) {
    hollowReasons.push(labels.emptyReason)
    return { hollowReasons, doubtReasons }
  }

  const placeholder = PLACEHOLDER_MARKERS.find((pattern) => pattern.test(text))
  if (placeholder) {
    hollowReasons.push(`${labels.placeholderReason} (${placeholder.source})`)
  }
  if (FILLER_ONLY.test(text)) {
    hollowReasons.push(labels.fillerReason)
  }
  if (DEFERRED_AUTHORITY_PHRASES.some((pattern) => pattern.test(text))) {
    doubtReasons.push(labels.deferralReason)
  }

  const specificity = assessContentSpecificity({ present: true, text }, title)
  if (specificity.evaluated && !specificity.sufficientlySpecific) {
    doubtReasons.push(...specificity.reasons)
  }

  return { hollowReasons, doubtReasons }
}
