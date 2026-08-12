import type { SocialStudiesCatalog, SocialStudiesEvidenceMetadata, SocialStudiesLessonRef, SocialStudiesUnitRef } from './types'
import { getUnit } from './catalog'

/**
 * FF-M3 — source/evidence metadata projection. Every field here is copied
 * verbatim from the frozen curriculum source (units.json / lessons.jsonl);
 * nothing is generated, paraphrased, or cited beyond what is already on
 * disk. Do not invent historical sources or quotations — if a lesson needs
 * one that isn't here, that's a content gap to fix upstream, not something
 * this projection should paper over.
 */

const PRIMARY_SECONDARY_PATTERN = /primary source|secondary source|primary and secondary/i
const MAPS_SPATIAL_PATTERN = /\bmap\b|\bmaps\b|spatial/i

function unitFor(catalog: SocialStudiesCatalog, lesson: SocialStudiesLessonRef): SocialStudiesUnitRef | undefined {
  return getUnit(catalog, lesson.unitId)
}

export function lessonEvidence(
  catalog: SocialStudiesCatalog,
  lesson: SocialStudiesLessonRef,
): SocialStudiesEvidenceMetadata {
  const unit = unitFor(catalog, lesson)
  const unitTopics = unit?.topics ?? []
  return Object.freeze({
    lessonId: lesson.lessonId,
    focus: lesson.focus,
    essentialQuestion: lesson.essentialQuestion,
    standards: lesson.standards,
    materials: lesson.materials,
    unitTopics,
    performanceTask: unit?.performanceTask ?? '',
    citesPrimaryOrSecondarySources: unitTopics.some((topic) => PRIMARY_SECONDARY_PATTERN.test(topic)),
    citesMapsOrSpatialSources: unitTopics.some((topic) => MAPS_SPATIAL_PATTERN.test(topic)),
  })
}

export function unitEvidence(unit: SocialStudiesUnitRef): {
  readonly unitId: string
  readonly essentialQuestion: string
  readonly standards: readonly string[]
  readonly topics: readonly string[]
  readonly performanceTask: string
  readonly citesPrimaryOrSecondarySources: boolean
  readonly citesMapsOrSpatialSources: boolean
} {
  return Object.freeze({
    unitId: unit.unitId,
    essentialQuestion: unit.essentialQuestion,
    standards: unit.standards,
    topics: unit.topics,
    performanceTask: unit.performanceTask,
    citesPrimaryOrSecondarySources: unit.topics.some((topic) => PRIMARY_SECONDARY_PATTERN.test(topic)),
    citesMapsOrSpatialSources: unit.topics.some((topic) => MAPS_SPATIAL_PATTERN.test(topic)),
  })
}
