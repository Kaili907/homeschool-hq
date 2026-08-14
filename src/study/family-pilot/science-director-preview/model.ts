import type { FinalLearnerMaterialSection, FinalLearnerProductionMaterial } from '../../../curriculum/final-app-data'

export const SCIENCE_DIRECTOR_SAMPLE_LESSON_REF = 'ma-g3-science-u01-l02' as const
export const SCIENCE_DIRECTOR_SAMPLE_TITLE = 'Concept model A: testable questions' as const

export type ScienceSampleStage = 'NOTICE' | 'LEARN' | 'MODEL' | 'GUIDED' | 'INDEPENDENT' | 'MASTERY' | 'REMEDIATION'

export interface ScienceSampleStep {
  readonly stage: ScienceSampleStage
  readonly shortLabel: string
  readonly section: FinalLearnerMaterialSection
}

export interface ScienceSamplePresentation {
  readonly overview: FinalLearnerMaterialSection
  readonly steps: readonly ScienceSampleStep[]
  readonly safetyReference: FinalLearnerMaterialSection
}

const STEP_DEFINITIONS: readonly Readonly<{
  prefix: string
  stage: ScienceSampleStage
  shortLabel: string
}>[] = Object.freeze([
  { prefix: '1. ', stage: 'NOTICE', shortLabel: 'Notice' },
  { prefix: '2. ', stage: 'LEARN', shortLabel: 'Learn' },
  { prefix: '3. ', stage: 'MODEL', shortLabel: 'Worked model' },
  { prefix: '4. ', stage: 'GUIDED', shortLabel: 'Guided practice' },
  { prefix: '5. ', stage: 'INDEPENDENT', shortLabel: 'Independent' },
  { prefix: '6. ', stage: 'MASTERY', shortLabel: 'Fresh mastery' },
  { prefix: '7. ', stage: 'REMEDIATION', shortLabel: 'Different explanation' },
])

export function createScienceSamplePresentation(material: FinalLearnerProductionMaterial): ScienceSamplePresentation {
  if (material.lessonRef !== SCIENCE_DIRECTOR_SAMPLE_LESSON_REF) throw new Error('Science sample lesson identity mismatch.')
  if (material.title !== SCIENCE_DIRECTOR_SAMPLE_TITLE) throw new Error('Science sample title mismatch.')
  if (material.format !== 'markdown' || !material.sections?.length) throw new Error('Science sample requires its real projected Markdown sections.')
  if (!material.markdown.includes('Science Director sample R1')) throw new Error('Science sample provenance marker is missing.')

  const overview = material.sections.find((section) => section.sectionKind === 'lesson-overview')
  const safetyReference = material.sections.find((section) => section.title.startsWith('Science safety policy reference'))
  const steps = STEP_DEFINITIONS.map((definition) => {
    const section = material.sections?.find((candidate) => candidate.title.startsWith(definition.prefix))
    if (!section) throw new Error(`Science sample section is missing: ${definition.prefix}`)
    return Object.freeze({ stage: definition.stage, shortLabel: definition.shortLabel, section })
  })
  if (!overview || !safetyReference) throw new Error('Science sample overview or safety reference is missing.')

  const items = steps.flatMap((step) => step.section.items ?? [])
  if (items.length !== 7 || new Set(items.map((item) => item.itemRef)).size !== 7) {
    throw new Error('Science sample response-item projection is incomplete.')
  }
  const mastery = steps.find((step) => step.stage === 'MASTERY')!
  if (/testable question is|Question\s*->\s*Plan|Worked scientific reasoning/i.test(mastery.section.body ?? '')) {
    throw new Error('Fresh mastery repeats answer-bearing teaching support.')
  }
  return Object.freeze({ overview, steps: Object.freeze(steps), safetyReference })
}
