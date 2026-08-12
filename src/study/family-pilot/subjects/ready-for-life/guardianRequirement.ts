import type { RflLessonRef } from './types'

/**
 * FULL-FAMILY-READY-FOR-LIFE-SAFETY — every Ready for Life lesson carries the
 * same course-wide guardian-visibility policy verbatim in safety_and_privacy
 * (confirmed: one distinct value across all 108 lessons), so that field alone
 * can't tell one lesson's hazard from another's. This module derives a
 * per-lesson hazard classification from the lesson's own topic (focus/title),
 * matched against the hazard categories the course's own policy names —
 * heat, sharp tools, appliances, chemicals, medication, transportation, and
 * online accounts — so lessons that actually touch one of those get a
 * guardian sign-off requirement gate; lessons that don't, don't.
 *
 * Keyword matching alone under-covers one real case: each grade's final
 * unit is an open-ended, family- or student-chosen capstone contribution
 * (unit title contains "Capstone"; see e.g. grade 5's own
 * performance_task, "Complete a multi-step family contribution..."). The
 * hazard there is decided at run time by whatever the family picks, not
 * named in the lesson's topic text, so no keyword list can catch it —
 * every lesson in a capstone unit is guardian-gated unconditionally,
 * independent of the keyword match below.
 */

export type RflHazardCategory =
  | 'heat'
  | 'sharp-tools'
  | 'appliances'
  | 'chemicals'
  | 'medication'
  | 'transportation'
  | 'online-accounts'
  | 'unfamiliar-hazard'
  | 'open-ended-capstone-task'

const HAZARD_KEYWORDS: Readonly<Record<Exclude<RflHazardCategory, 'open-ended-capstone-task'>, readonly string[]>> = {
  heat: ['heat', 'stove', 'oven', 'fire-safety', 'fire safety'],
  'sharp-tools': ['knife', 'knives', 'sharp tool', 'blade', 'tool identification', 'tool boundaries'],
  appliances: ['appliance', 'washer', 'dryer', 'utility'],
  chemicals: ['chemical', 'cleaning-product', 'cleaning product'],
  medication: ['medication', 'medicine'],
  transportation: ['transportation', 'route and schedule', 'vehicle', 'driving'],
  'online-accounts': [
    'account and password',
    'online account',
    'password safety',
    'subscriptions and in-app purchases',
    'reviews and scams',
  ],
  'unfamiliar-hazard': ['personal safety and check-ins'],
}

/** Phrases that name a hazard word only to say it's absent — stripped before
 * keyword matching so e.g. "simple no-heat preparation" doesn't flag the
 * `heat` category. */
const NEGATED_HAZARD_PHRASES: readonly RegExp[] = [/\bno[-\s]+heat\b/gi, /\bwithout\s+heat\b/gi]

/** The lesson's own hazard-relevant text: its focus and title only — not the
 * boilerplate safety_and_privacy sentence, which is identical on every
 * lesson and therefore not a per-lesson signal. Negated hazard phrases
 * (e.g. "no-heat") are stripped so a lesson about avoiding a hazard isn't
 * misread as one that involves it. */
function hazardHaystack(lesson: RflLessonRef): string {
  let haystack = `${lesson.focus} ${lesson.title}`.toLowerCase()
  for (const negated of NEGATED_HAZARD_PHRASES) {
    haystack = haystack.replace(negated, '')
  }
  return haystack
}

function isCapstoneUnit(lesson: RflLessonRef): boolean {
  return lesson.unitTitle.toLowerCase().includes('capstone')
}

export interface RflGuardianRequirement {
  /** Every Ready for Life lesson requires guardian visibility by course-wide
   * policy (safety_and_privacy is identical across all 108 lessons). */
  readonly guardianVisibilityRequired: true
  /** The verbatim course policy sentence describing what guardians must see. */
  readonly guardianVisibilitySummary: string
  /** Hazard categories this specific lesson's topic touches, derived from its
   * focus/title — empty when the lesson doesn't name a hazard from the
   * course's own guardian-visibility policy list. */
  readonly hazardCategories: readonly RflHazardCategory[]
  /** True only when hazardCategories is non-empty: this lesson's real-world
   * task may not be marked complete on student action alone — see
   * completionEvidence.ts. */
  readonly requiresGuardianSignoffBeforeCompletion: boolean
}

export function deriveGuardianRequirement(lesson: RflLessonRef): RflGuardianRequirement {
  const haystack = hazardHaystack(lesson)
  const keywordCategories = (
    Object.keys(HAZARD_KEYWORDS) as Exclude<RflHazardCategory, 'open-ended-capstone-task'>[]
  ).filter((category) => HAZARD_KEYWORDS[category].some((keyword) => haystack.includes(keyword)))
  const hazardCategories: RflHazardCategory[] = isCapstoneUnit(lesson)
    ? [...keywordCategories, 'open-ended-capstone-task']
    : keywordCategories
  return Object.freeze({
    guardianVisibilityRequired: true,
    guardianVisibilitySummary: lesson.parentOrGuardianVisibility,
    hazardCategories: Object.freeze(hazardCategories) as readonly RflHazardCategory[],
    requiresGuardianSignoffBeforeCompletion: hazardCategories.length > 0,
  })
}
