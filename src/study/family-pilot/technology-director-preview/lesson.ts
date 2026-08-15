import lessonText from '../../../../curriculum-production/student-work/technology-arts-lessons/packages/technology/grade-10/ma-g10-technology-u02-l05.task-package.json?raw'
import type { LearnerMaterialDto } from '../final-app/learner-response'

export const TECHNOLOGY_DIRECTOR_LESSON_REF = 'ma-g10-technology-u02-l05' as const
export const TECHNOLOGY_DIRECTOR_LESSON_TITLE = 'Mastery check: algorithms, efficiency, and correctness' as const

export type CodeTest = Readonly<{
  input: string
  expected: string
  observed?: string
}>

export type ResponseStageId = 'guided' | 'independent' | 'mastery' | 'fresh'

export type RemediationRoute = Readonly<{
  trigger_id: string
  learner_signal: string
  title: string
  alternate_teaching: string
  analogue_task: string
  contrast_check: string
  original_protected_solution_exposed: false
}>

export type TechnologyLessonPackage = Readonly<{
  lesson_id: string
  lesson_title: string
  estimated_minutes: string
  essential_question: string
  learning_objectives: readonly string[]
  lesson_success_criteria: readonly string[]
  presentation_and_privacy: { readonly sandbox_and_credentials_note: string }
  learner_experience: {
    readonly experience_version: string
    readonly static_complete: true
    readonly tutor_required: false
    readonly sequence_policy: string
    readonly learning_targets: readonly string[]
    readonly concept_teaching: {
      readonly ref: string
      readonly title: string
      readonly entry_check: string
      readonly explanation: readonly string[]
      readonly key_terms: readonly { readonly term: string; readonly definition: string }[]
      readonly application_check: readonly string[]
    }
    readonly worked_example: {
      readonly ref: string
      readonly kind: 'WORKED_EXAMPLE_CODE'
      readonly relationship_to_protected_tasks: 'ANALOGOUS_NON_TARGET'
      readonly evidence_eligible: false
      readonly title: string
      readonly goal: string
      readonly starter_code: string
      readonly public_observation: string
      readonly annotations: readonly { readonly move: string; readonly reasoning: string }[]
      readonly completed_code: string
      readonly correctness_and_efficiency: string
      readonly transfer_prompt: string
    }
    readonly guided_task: {
      readonly ref: string
      readonly title: string
      readonly goal: string
      readonly starter_code: string
      readonly public_tests: readonly CodeTest[]
      readonly prompts: readonly string[]
      readonly immediate_check: string
      readonly support_fade: string
    }
    readonly independent_creation: {
      readonly ref: string
      readonly title: string
      readonly starter_code: string
      readonly specification: readonly string[]
      readonly public_tests: readonly string[]
      readonly evidence_requirements: readonly string[]
      readonly support: string
      readonly solution_status: string
    }
    readonly mastery_debug: {
      readonly ref: string
      readonly title: string
      readonly starter_code: string
      readonly specification: readonly string[]
      readonly observed_symptom: string
      readonly public_tests: readonly string[]
      readonly debug_log_template: readonly string[]
      readonly hint_ceiling: string
      readonly available_hint: string
      readonly solution_status: string
      readonly post_evidence_review: string
    }
    readonly remediation_routes: readonly RemediationRoute[]
    readonly fresh_mastery_check: {
      readonly ref: string
      readonly title: string
      readonly starter_code: string
      readonly specification: string
      readonly observed_symptom: string
      readonly public_tests: readonly string[]
      readonly evidence_requirements: string
      readonly hint_ceiling: string
      readonly solution_status: string
    }
  }
}>

const parsed = JSON.parse(lessonText) as TechnologyLessonPackage

if (parsed.lesson_id !== TECHNOLOGY_DIRECTOR_LESSON_REF || parsed.lesson_title !== TECHNOLOGY_DIRECTOR_LESSON_TITLE) {
  throw new Error('Technology Director preview lesson provenance did not match the pinned sample.')
}
if (!parsed.learner_experience.static_complete || parsed.learner_experience.tutor_required) {
  throw new Error('Technology Director preview requires a complete static learner experience.')
}

export const TECHNOLOGY_DIRECTOR_LESSON = Object.freeze(parsed)

const experience = TECHNOLOGY_DIRECTOR_LESSON.learner_experience

export const RESPONSE_STAGE = Object.freeze({
  guided: {
    sectionRef: `${TECHNOLOGY_DIRECTOR_LESSON_REF}#guided-practice`,
    itemRef: experience.guided_task.ref,
    sectionKind: 'guided-practice',
    title: experience.guided_task.title,
    prompt: experience.guided_task.prompts.join('\n'),
  },
  independent: {
    sectionRef: `${TECHNOLOGY_DIRECTOR_LESSON_REF}#independent-creation`,
    itemRef: experience.independent_creation.ref,
    sectionKind: 'independent-creation',
    title: experience.independent_creation.title,
    prompt: experience.independent_creation.evidence_requirements.join('\n'),
  },
  mastery: {
    sectionRef: `${TECHNOLOGY_DIRECTOR_LESSON_REF}#mastery-debug`,
    itemRef: experience.mastery_debug.ref,
    sectionKind: 'mastery-debug',
    title: experience.mastery_debug.title,
    prompt: experience.mastery_debug.debug_log_template.join('\n'),
  },
  fresh: {
    sectionRef: `${TECHNOLOGY_DIRECTOR_LESSON_REF}#mastery-fresh-check`,
    itemRef: experience.fresh_mastery_check.ref,
    sectionKind: 'mastery-fresh-check',
    title: experience.fresh_mastery_check.title,
    prompt: experience.fresh_mastery_check.evidence_requirements,
  },
} as const)

export const TECHNOLOGY_DIRECTOR_RESPONSE_MATERIAL: LearnerMaterialDto = Object.freeze({
  lessonRef: TECHNOLOGY_DIRECTOR_LESSON_REF,
  title: TECHNOLOGY_DIRECTOR_LESSON_TITLE,
  format: 'structured',
  sections: Object.values(RESPONSE_STAGE).map((stage) => Object.freeze({
    sectionRef: stage.sectionRef,
    kind: stage.sectionKind,
    title: stage.title,
    items: [Object.freeze({
      itemRef: stage.itemRef,
      prompt: stage.prompt,
      responseKind: 'CONSTRUCTED_RESPONSE' as const,
    })],
  })),
})
