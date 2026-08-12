import type { HostStudyLessonKind } from '../../../curriculumAdapter'

/**
 * The Study runtime only has two ELA-shaped host lesson kinds — 'reading'
 * and 'writing' (src/study/curriculumAdapter.ts HOST_STUDY_MAPPING) — so
 * every curriculum-content ELA lesson must resolve to exactly one of them.
 *
 * curriculum-content/manuel-academy/1.0.0's ELA course-guides describe one
 * fixed 18-phase instructional arc that repeats identically for every unit,
 * in every grade (confirmed: grade 5/7/8, all 30 units). This table is the
 * one place that arc is mapped to a Study subject, by what the phase actually
 * produces: phases that build or check comprehension of a given text route to
 * 'reading'; phases that plan, draft, revise, or publish learner work route
 * to 'writing'. It is a fixed lookup over curriculum-authored phase names,
 * not a guess from lesson content.
 */
const ELA_PHASE_STUDY_KIND: Readonly<Record<string, HostStudyLessonKind>> = {
  'Launch and diagnostic': 'reading',
  'Concept model A': 'reading',
  'Guided practice A': 'reading',
  'Independent application A': 'reading',
  'Investigation or close reading': 'reading',
  'Reteach and varied practice': 'reading',
  'Discussion or problem seminar': 'reading',
  'Skill consolidation': 'reading',
  'Transfer challenge': 'reading',
  'Assessment preparation': 'reading',
  'Unit assessment': 'reading',
  'Concept model B': 'writing',
  'Guided practice B': 'writing',
  'Concept model C': 'writing',
  'Performance task planning': 'writing',
  'Performance task build': 'writing',
  'Targeted correction': 'writing',
  'Publication, presentation, or reflection': 'writing',
}

export class ElaPhaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ElaPhaseError'
  }
}

/** Fails closed on an unrecognized phase instead of guessing a Study subject. */
export function classifyElaLessonKind(phase: string): HostStudyLessonKind {
  const kind = ELA_PHASE_STUDY_KIND[phase]
  if (!kind) throw new ElaPhaseError(`Unrecognized ELA lesson phase: ${phase}`)
  return kind
}
