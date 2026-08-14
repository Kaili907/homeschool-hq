import lessonSource from '../../../../curriculum-production/student-work/technology-arts-lessons/packages/arts-music/grade-09/ma-g9-arts-and-music-u01-l02.task-package.json?raw'
import scoringSource from '../../../../curriculum-production/student-work/technology-arts-lessons/scoring-guides/arts-music/grade-09/ma-g9-arts-and-music-u01-l02.scoring-guide.json?raw'
import modelUrl from '../../../../curriculum-production/student-work/technology-arts-lessons/resources/arts-music/grade-09/ma-g9-arts-and-music-u01-l02.visual-hierarchy-model.svg?url'

export const ARTS_MUSIC_DIRECTOR_LESSON_REF = 'ma-g9-arts-and-music-u01-l02' as const

type TeachingBlock = Readonly<{ id: string; title: string; body: string }>
type TechniqueStep = Readonly<{ step: number; action: string; notice: string; why: string }>
type WorkBlock = Readonly<{
  id: string
  type: 'GUIDED_PRACTICE' | 'INDEPENDENT_CREATION' | 'REFLECTION' | 'CRITIQUE' | 'KNOWLEDGE_CHECK'
  title: string
  estimated_minutes: number
  prompt?: string
  prompts?: readonly string[]
  bounded_choice?: string
  observable_criterion?: string
  attempt_before_support?: string
  optional_cue?: string
  support_fade?: string
  objective_constraints?: readonly string[]
  learner_owned_choices?: readonly string[]
  permitted_support?: string
  protocol?: readonly string[]
  private_route?: string
  note?: string
}>
type RemediationPath = Readonly<{
  ref: string
  for_error_id: string
  different_instruction: string
  supported_attempt: string
  self_noticing_cue: string
  fresh_retry: string
}>

export type ArtsMusicDirectorLesson = Readonly<{
  lesson_id: typeof ARTS_MUSIC_DIRECTOR_LESSON_REF
  lesson_title: string
  grade: 9
  task_label: string
  estimated_minutes: string
  essential_question: string
  materials: readonly string[]
  sourceReference: string
  presentation_and_privacy: Readonly<{ presentation_options: string; text_or_no_audio_alternative: string }>
  r1_sample: Readonly<{
    lesson_type: 'VISUAL_ART_CONCEPT'
    phase: 'MODEL_A'
    learning_goal: string
    vocabulary: readonly Readonly<{ term: string; definition: string }>[]
    concept_instruction: readonly TeachingBlock[]
    technique_sequence: readonly TechniqueStep[]
    work_blocks: readonly WorkBlock[]
    remediation_paths: readonly RemediationPath[]
  }>
}>

export type ArtsMusicDirectorScoringGuide = Readonly<{
  rubric_ref: string
  objective_constraints: readonly string[]
  legitimate_variation: readonly string[]
  rubric: readonly Readonly<{
    dimension: string
    criterion_kind: 'OBJECTIVE' | 'JUDGMENT_BASED'
    exceeds: string
    meets: string
    developing: string
    beginning: string
  }>[]
}>

function parseJson<T>(source: string, label: string): T {
  try {
    return JSON.parse(source) as T
  } catch {
    throw new Error(`The ${label} could not be parsed for Director review.`)
  }
}

export const artsMusicDirectorLesson = parseJson<ArtsMusicDirectorLesson>(lessonSource, 'Arts/Music sample lesson')
export const artsMusicDirectorScoring = parseJson<ArtsMusicDirectorScoringGuide>(scoringSource, 'Arts/Music scoring guide')
export const artsMusicVisualHierarchyModelUrl = modelUrl

if (artsMusicDirectorLesson.lesson_id !== ARTS_MUSIC_DIRECTOR_LESSON_REF) {
  throw new Error('The Arts/Music Director preview resolved the wrong lesson.')
}

export function workBlock(type: WorkBlock['type']): WorkBlock {
  const block = artsMusicDirectorLesson.r1_sample.work_blocks.find((candidate) => candidate.type === type)
  if (!block) throw new Error(`The Arts/Music sample is missing ${type}.`)
  return block
}
