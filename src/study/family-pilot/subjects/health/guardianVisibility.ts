import type { HealthGuardianVisibility, HealthLesson, HealthUnit } from './types'

/**
 * Guardian visibility markers for Health.
 *
 * Every lesson's own `parent_or_guardian_visibility` field already tells a
 * guardian what to expect (target, completion state, evidence type, next
 * step — never raw reflections, raw answers, or diagnosis language). What
 * this module adds is the "is this a safety-critical unit" judgment call the
 * curriculum leaves to the integration layer: units that touch trusted-adult
 * support, boundaries/consent, bullying/harassment, substances, or
 * reproductive/sexual health should carry a guardian-confirmation marker
 * even when the lesson itself completes normally.
 *
 * The classifier is intentionally biased toward over-flagging: a nutrition
 * lesson wrongly marked safety-critical costs nothing but an extra guardian
 * note, while a boundaries-or-substances lesson wrongly left unmarked would
 * be the failure mode that matters.
 */

// Deliberately no bare 'safety': that single word substring-matches ordinary
// phrases like "food safety" or "allergy ... safety" in nutrition topics,
// which would flag nearly every unit and dilute the marker. Specific
// safety-themed compounds are listed explicitly instead, so a unit whose
// only brush with "safety" is an allergy/food-safety topic still gets
// flagged (that's a real safety topic), without a future unrelated mention
// of the bare word "safety" over-triggering.
const SAFETY_CRITICAL_KEYWORDS: readonly string[] = [
  'trusted',
  'boundary',
  'boundaries',
  'help-seeking',
  'emergency',
  'bullying',
  'report',
  'poison',
  'food safety',
  'food-safety',
  'online safety',
  'home safety',
  'recreation safety',
  'safety plan',
  'first-response',
  'crisis',
  'consent',
  'harassment',
  'substance',
  'drug',
  'alcohol',
  'nicotine',
  'cannabis',
  'medication',
  'overdose',
  'reproductive',
  'pregnancy',
  'coercion',
  'refusal',
  'confidentiality',
  'warning sign',
  'tell an adult',
  'adult support',
]

function containsSafetyCriticalKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return SAFETY_CRITICAL_KEYWORDS.some((keyword) => lower.includes(keyword))
}

export function isSafetyCriticalUnit(unit: HealthUnit): boolean {
  return containsSafetyCriticalKeyword(unit.title) || unit.topics.some((topic) => containsSafetyCriticalKeyword(topic))
}

/**
 * Derives the guardian-facing marker for one lesson. `unit` must be the
 * lesson's own unit (see getUnitForLesson in lookup.ts) — callers own that
 * pairing so this function stays pure and does not need a full catalog.
 */
export function deriveGuardianVisibility(lesson: HealthLesson, unit: HealthUnit): HealthGuardianVisibility {
  const safetyCritical = isSafetyCriticalUnit(unit)
  return {
    lessonId: lesson.lessonId,
    unitId: unit.unitId,
    summary: lesson.parentOrGuardianVisibility,
    safetyCritical,
    requiresGuardianConfirmation: safetyCritical,
  }
}
