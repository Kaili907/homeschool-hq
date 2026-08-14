import { mapLearnerMaterialToStudySegments } from '../final-app/learner-response'
import type { LearnerMaterialDto, LearnerResponseItem } from '../final-app/learner-response'
import type { ElementaryMathPresentationStep, ElementaryMathStage } from './types'

function stageFor(item: LearnerResponseItem): ElementaryMathStage {
  if (item.example) return 'EXAMPLE'
  if (item.responseType === 'READ') return 'LEARN'
  if (item.evidenceMode === 'SUPPORTED') return 'GUIDED'
  if (item.evidenceMode === 'MASTERY') return 'MASTERY'
  return 'INDEPENDENT'
}

/** Pure presentation projection. It does not score, store, or mutate material. */
export function createElementaryMathPresentation(material: LearnerMaterialDto): readonly ElementaryMathPresentationStep[] {
  const lesson = mapLearnerMaterialToStudySegments(material)
  const items = lesson.segments.flatMap((segment) => segment.items)
  const stages = items.map(stageFor)
  const totals = new Map<ElementaryMathStage, number>()
  for (const stage of stages) totals.set(stage, (totals.get(stage) ?? 0) + 1)
  const positions = new Map<ElementaryMathStage, number>()
  return Object.freeze(items.map((item, index) => {
    const stage = stages[index]!
    const position = (positions.get(stage) ?? 0) + 1
    positions.set(stage, position)
    return Object.freeze({ stage, item, position, total: totals.get(stage)! })
  }))
}
