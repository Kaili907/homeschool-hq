import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SAMPLE_PATH = `${ROOT}/docs/curriculum-quality/ela/samples/director-r1/ma-g7-english-language-arts-u05-l03.lesson.json`
const PREVIEW_PATH = `${ROOT}/src/dev/ela-director-preview/samplePreviewData.generated.json`

function unique(values) {
  return new Set(values).size === values.length
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message)
}

function byRef(items, key) {
  return new Map(items.map((item) => [item[key], item]))
}

function countWords(text) {
  return text.match(/\b[A-Za-z]+(?:[’'-][A-Za-z]+)*\b/g)?.length ?? 0
}

export function validateElaDirectorSample(lesson) {
  requireCondition(lesson.lesson_id === 'ma-g7-english-language-arts-u05-l03', 'Unexpected lesson identity')
  requireCondition(lesson.lesson_profile === 'INFORMATIONAL_TEXT', 'Director sample must use the INFORMATIONAL_TEXT profile')
  requireCondition(lesson.tutor_manifest?.data_only === true, 'Tutor manifest must remain data-only')
  requireCondition(lesson.tutor_manifest?.lesson_id === lesson.lesson_id, 'Tutor manifest lesson identity mismatch')

  const learner = lesson.learner_content
  const textByRef = byRef(lesson.text_set, 'text_ref')
  const teachingByRef = byRef(learner.teaching_blocks, 'teaching_block_ref')
  const modelByRef = byRef(learner.models, 'model_ref')
  const checkByRef = byRef(learner.comprehension_checks, 'check_ref')
  const guidedByRef = byRef(learner.guided_tasks, 'task_ref')
  const independentByRef = byRef(learner.independent_tasks, 'task_ref')
  const remediationByRef = byRef(learner.remediation_routes, 'remediation_route_ref')
  const rubricRefs = new Set(lesson.protected_content.rubrics.flatMap((rubric) => [rubric.rubric_ref, rubric.learner_visible_ref]))
  const keyByRef = byRef(lesson.protected_content.question_keys, 'question_ref')

  for (const [label, items, key] of [
    ['text', lesson.text_set, 'text_ref'],
    ['teaching block', learner.teaching_blocks, 'teaching_block_ref'],
    ['model', learner.models, 'model_ref'],
    ['check', learner.comprehension_checks, 'check_ref'],
    ['guided task', learner.guided_tasks, 'task_ref'],
    ['independent task', learner.independent_tasks, 'task_ref'],
    ['remediation route', learner.remediation_routes, 'remediation_route_ref'],
  ]) {
    requireCondition(unique(items.map((item) => item[key])), `Duplicate ${label} reference`)
  }
  for (const text of lesson.text_set) {
    const declared = text.complexity_review.quantitative.word_count
    const actual = countWords(text.body_or_source_ref)
    requireCondition(declared === actual, `${text.text_ref} declares ${declared} words but contains ${actual}`)
    requireCondition(text.complexity_review.quantitative.metrics_are_advisory === true, `${text.text_ref} must mark quantitative metrics advisory`)
  }

  requireCondition([...textByRef.values()].some((text) => text.role === 'model'), 'A separate model text is required')
  requireCondition([...textByRef.values()].some((text) => text.role === 'guided'), 'A guided text is required')
  requireCondition([...textByRef.values()].some((text) => text.role === 'independent'), 'An independent text is required')
  requireCondition([...textByRef.values()].some((text) => text.role === 'transfer'), 'A fresh transfer text is required')

  for (const model of learner.models) {
    requireCondition(model.separate_from_protected_attempt === true, `${model.model_ref} is not declared separate from protected work`)
    for (const ref of model.text_refs) requireCondition(textByRef.get(ref)?.role === 'model', `${model.model_ref} must resolve only to model text`)
  }
  for (const task of learner.independent_tasks) {
    for (const ref of task.text_refs) requireCondition(textByRef.has(ref), `${task.task_ref} has unresolved text ${ref}`)
    requireCondition(task.independence_boundary.length > 80, `${task.task_ref} has an incomplete independence boundary`)
    requireCondition(keyByRef.has(task.protected_question_ref), `${task.task_ref} has unresolved protected authority`)
    requireCondition(rubricRefs.has(task.rubric_ref), `${task.task_ref} has unresolved rubric ${task.rubric_ref}`)
  }

  const manifest = lesson.tutor_manifest
  for (const ref of manifest.teaching_block_refs) requireCondition(teachingByRef.has(ref), `Unresolved Tutor teaching ref ${ref}`)
  for (const ref of manifest.model_refs) requireCondition(modelByRef.has(ref), `Unresolved Tutor model ref ${ref}`)
  for (const ref of manifest.check_refs) requireCondition(checkByRef.has(ref), `Unresolved Tutor check ref ${ref}`)
  for (const ref of manifest.guided_task_refs) requireCondition(guidedByRef.has(ref), `Unresolved Tutor guided ref ${ref}`)
  for (const ref of manifest.independent_task_refs) requireCondition(independentByRef.has(ref), `Unresolved Tutor independent ref ${ref}`)
  for (const ref of manifest.remediation_route_refs) requireCondition(remediationByRef.has(ref), `Unresolved Tutor remediation ref ${ref}`)
  for (const ref of manifest.rubric_refs) requireCondition(rubricRefs.has(ref), `Unresolved Tutor rubric ref ${ref}`)
  for (const refs of Object.values(manifest.text_refs_by_role)) {
    for (const ref of refs) requireCondition(textByRef.has(ref), `Unresolved Tutor text ref ${ref}`)
  }

  const mainTask = independentByRef.get('task.independent.workshop-analysis')
  const transferTask = independentByRef.get('task.transfer.creek-mastery')
  requireCondition(mainTask?.writing_requirement === 'short_constructed_response', 'Independent writing must be classified accurately')
  requireCondition(transferTask?.permitted_support_refs.length === 2, 'Fresh transfer may use access supports only')
  requireCondition(learner.revision_tasks.some((task) => task.substantive_change_required && task.before_after_evidence_required), 'A substantive before/after revision is required')
  requireCondition(learner.remediation_routes.some((route) => route.independent_recheck_ref && route.grade_level_transfer_ref), 'Remediation must recheck and return to grade-level transfer')
}

export function projectElaDirectorPreview(lesson) {
  const learner = lesson.learner_content
  const texts = byRef(lesson.text_set, 'text_ref')
  const tasks = byRef(learner.independent_tasks, 'task_ref')
  const models = byRef(learner.models, 'model_ref')
  const guided = byRef(learner.guided_tasks, 'task_ref')
  const teaching = byRef(learner.teaching_blocks, 'teaching_block_ref')

  const mainText = texts.get('text.independent.after-four')
  const transferText = texts.get('text.transfer.creek-lights')
  const recheckText = texts.get('text.transfer.courtyard-recheck')
  const model = models.get('model.water-station-think-aloud')
  const reteachModel = models.get('model.bridge-contrast-reteach')

  return {
    previewContract: 'ela-director-preview-r1',
    reviewStatus: 'PENDING_DIRECTOR_REVIEW',
    lesson: {
      lessonId: lesson.lesson_id,
      grade: lesson.grade,
      profile: lesson.lesson_profile,
      title: 'Guided practice A: reasoning and warrants',
      unit: 'Argument, Claims, and Reasoning',
      estimatedMinutes: '50–70',
      learningGoal: lesson.learning_goal,
      standards: lesson.standard_refs,
    },
    accessibility: {
      explanationExpectation: lesson.language_and_complexity.explanation_language_expectation,
      gradeLevelBasis: lesson.language_and_complexity.grade_level_complexity_basis,
      supports: lesson.language_and_complexity.scaffolding_plan.map(({ support_ref, support_type, construct_effect }) => ({ supportRef: support_ref, supportType: support_type, constructEffect: construct_effect })),
      burden: lesson.reading_burden,
    },
    directions: learner.directions,
    contextAndTeaching: learner.teaching_blocks.slice(0, 2),
    vocabulary: learner.vocabulary_support,
    model: {
      text: texts.get(model.text_refs[0]),
      prompt: model.prompt,
      thinkAloudSteps: model.think_aloud_steps,
      completedModelResponse: model.completed_model_response,
    },
    guidedPractice: {
      text: texts.get('text.guided.trail-bench'),
      comprehensionCheck: learner.comprehension_checks.find((check) => check.check_ref === 'check.guided-viewpoints'),
      tasks: [guided.get('task.guided.trail-claim-bridge'), guided.get('task.guided.trail-limit')],
    },
    independentPractice: {
      text: mainText,
      navigationCheck: learner.comprehension_checks.find((check) => check.check_ref === 'check.independent-navigation'),
      task: tasks.get('task.independent.workshop-analysis'),
      scaffolds: learner.writing_scaffolds,
      revision: learner.revision_tasks[0],
    },
    freshMastery: {
      text: transferText,
      task: tasks.get('task.transfer.creek-mastery'),
      evidenceDefinition: lesson.tutor_manifest.evidence_definitions.find((evidence) => evidence.evidence_id === 'evidence.transfer.creek'),
    },
    remediation: {
      trigger: 'Use only after an observable evidence-without-warrant or limited-sample overclaim pattern.',
      teaching: teaching.get('teach.bridge-test-reteach'),
      modelText: texts.get(reteachModel.text_refs[0]),
      model: reteachModel,
      guidedTask: guided.get('task.guided.bridge-repair'),
      recheckText,
      recheckTask: tasks.get('task.recheck.courtyard-bridge'),
      returnTaskRef: 'task.transfer.creek-mastery',
    },
    tutorReadiness: {
      dataOnly: lesson.tutor_manifest.data_only,
      skillIds: lesson.tutor_manifest.skill_ids,
      prerequisiteSkillIds: lesson.tutor_manifest.prerequisite_skill_ids,
      misconceptionIds: lesson.tutor_manifest.misconception_ids,
      evidenceDefinitions: lesson.tutor_manifest.evidence_definitions,
      contentInventory: {
        texts: lesson.text_set.length,
        teachingBlocks: learner.teaching_blocks.length,
        models: learner.models.length,
        checks: learner.comprehension_checks.length,
        guidedTasks: learner.guided_tasks.length,
        independentTasks: learner.independent_tasks.length,
        remediationRoutes: learner.remediation_routes.length,
      },
    },
    review: {
      contractSchema: 'docs/curriculum-quality/ela/ELA_LESSON_CONTRACT_R1.schema.json',
      canonicalSample: 'docs/curriculum-quality/ela/samples/director-r1/ma-g7-english-language-arts-u05-l03.lesson.json',
      humanReviewRef: mainText.complexity_review.human_review_ref,
      protectedAuthorityExcluded: true,
      protectedAuthorityNote: 'Protected source anchors, scoring reasoning, and adult rubrics are intentionally excluded from this browser projection. Review them in the canonical lesson file.',
    },
  }
}

export function assertPreviewHasNoProtectedAuthority(lesson, preview) {
  requireCondition(!Object.hasOwn(preview, 'protected_content'), 'Preview must not expose protected_content')
  const serialized = JSON.stringify(preview)
  for (const key of lesson.protected_content.question_keys) {
    requireCondition(!serialized.includes(key.scoring_basis), `Preview leaks scoring basis for ${key.question_ref}`)
    requireCondition(!serialized.includes(key.reasoning), `Preview leaks protected reasoning for ${key.question_ref}`)
    for (const anchor of key.source_anchors) {
      requireCondition(!serialized.includes(anchor.relevance), `Preview leaks source anchor for ${key.question_ref}`)
    }
  }
  for (const rubric of lesson.protected_content.rubrics) {
    requireCondition(!serialized.includes(JSON.stringify(rubric)), `Preview leaks protected rubric ${rubric.rubric_ref}`)
  }
}

async function main() {
  const lesson = JSON.parse(await readFile(SAMPLE_PATH, 'utf8'))
  validateElaDirectorSample(lesson)
  const preview = projectElaDirectorPreview(lesson)
  assertPreviewHasNoProtectedAuthority(lesson, preview)
  if (process.argv.includes('--check')) {
    const current = JSON.parse(await readFile(PREVIEW_PATH, 'utf8'))
    requireCondition(JSON.stringify(current) === JSON.stringify(preview), 'Generated Director preview data is stale; run npm run ela:director-preview:build')
    console.log('ELA Director sample semantic and preview-isolation checks passed.')
    return
  }
  await writeFile(PREVIEW_PATH, `${JSON.stringify(preview, null, 2)}\n`, 'utf8')
  console.log(`Generated ${PREVIEW_PATH}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}
