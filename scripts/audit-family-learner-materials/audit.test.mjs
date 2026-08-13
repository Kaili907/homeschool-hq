import test from 'node:test'
import assert from 'node:assert/strict'
import {
  auditSyntheticAssessment,
  auditSyntheticLesson,
  crossGradeDuplicateGroups,
  hashText,
} from './audit-lib.mjs'

function codes(result) {
  return result.findings.map((finding) => finding.code)
}

function mathValue(sections) {
  return {
    lessonRef: { title: 'Synthetic concept build', phase: 'Concept build' },
    blueprint: { phase: 'Concept build' },
    sections,
  }
}

test('negative control: empty mastery section is blocking', () => {
  const result = auditSyntheticLesson({
    subject: 'mathematics',
    value: mathValue([
      { kind: 'independent-practice', title: 'Independent practice', directions: 'Solve.', items: [{ kind: 'constructed-response', prompt: 'Solve 2 + 2.' }] },
      { kind: 'mastery-check', title: 'Mastery check', directions: 'Show what you know.', items: [] },
    ]),
  })
  assert.ok(codes(result).includes('EMPTY_MASTERY_CHECK'))
})

test('negative control: generic meta-task is zero actionable learner work', () => {
  const result = auditSyntheticLesson({
    subject: 'english-language-arts',
    value: {
      lessonRef: { title: 'Launch and baseline', phase: 'Launch and baseline' },
      studentTask: { present: true, text: "Today's focus: reading." },
      independentEvidenceTask: { present: true, text: "Learner completes a new application of today's lesson and records both the result and reasoning." },
    },
  })
  assert.equal(result.actionableClassification, 'ZERO_ACTIONABLE_WORK_BLOCKER')
  assert.ok(codes(result).includes('GENERIC_META_TASK_WITHOUT_EXECUTABLE_SUBJECT_WORK'))
})

test('negative control: multiple-choice options lose structural identity', () => {
  const result = auditSyntheticLesson({
    subject: 'mathematics',
    value: mathValue([{ kind: 'independent-practice', title: 'Practice', directions: 'Choose.', items: [{ kind: 'multiple-choice', prompt: 'Which is four?', choices: ['3', '4', '5'] }] }]),
  })
  assert.ok(codes(result).includes('CHOICES_FLATTENED_TO_DISPLAY_TEXT'))
  assert.equal(result.sourceStructure.choiceItemCount, 1)
  assert.equal(result.browserStructure.choiceItemCount, 0)
})

test('negative control: a contract that requires task steps fails when steps are missing', () => {
  const result = auditSyntheticLesson({
    subject: 'technology',
    value: {
      lesson_title: 'Build a safe model',
      phase: 'Project build',
      primary_task: 'Create and test a paper model.',
      taskStepsRequired: true,
      task_steps: [],
      test_or_check_criteria: ['The model is tested.'],
    },
  })
  assert.ok(codes(result).includes('TASK_STEPS_MISSING'))
})

test('negative control: adult answer/scoring fields in projected learner material are detected', () => {
  const result = auditSyntheticLesson({
    subject: 'health',
    value: { title: 'Health task', studentTask: 'Explain the safest choice.', knowledgeCheck: 'Name one reason.' },
    projectedMaterial: {
      materialRef: 'synthetic',
      lessonRef: 'synthetic-lesson',
      title: 'Health task',
      subject: 'health',
      format: 'structured',
      sections: [{ title: 'Task', prompts: ['Explain the safest choice.'], correctAnswer: 'Adult-only answer' }],
    },
  })
  assert.ok(codes(result).includes('ADULT_SCORING_OR_ANSWER_LEAK'))
})

test('negative control: strict placeholder residue is detected', () => {
  const result = auditSyntheticLesson({
    subject: 'technology',
    value: {
      lesson_title: 'Project',
      phase: 'Project build',
      primary_task: 'TODO: replace this with a real project task.',
      task_steps: ['Make a draft.'],
      test_or_check_criteria: ['Check the draft.'],
    },
  })
  assert.ok(codes(result).includes('PLACEHOLDER_OR_TEMPLATE_RESIDUE'))
})

test('negative control: missing assessment learner material is empty and unusable', () => {
  const result = auditSyntheticAssessment({ learnerMaterial: null })
  assert.equal(result.learnerMaterialExists, false)
  assert.equal(result.emptyAssessmentMaterial, true)
  assert.equal(result.usableLearnerMaterial, false)
})

test('negative control: source/browser item-count mismatch is observable', () => {
  const result = auditSyntheticLesson({
    subject: 'mathematics',
    value: mathValue([{ kind: 'instructional-example', title: 'Example', directions: 'Read.', items: [{ kind: 'worked-example', prompt: 'See 2 + 2.', workedSolution: { steps: ['Add two.', 'Get four.'] } }] }]),
  })
  assert.notEqual(result.sourceStructure.itemCount, result.browserStructure.itemCount)
})

test('negative control: exact learner task copied across grades forms a progression group', () => {
  const actionableTextHash = hashText('identical learner task')
  const groups = crossGradeDuplicateGroups([
    { grade: 5, actionableTextHash },
    { grade: 10, actionableTextHash },
  ])
  assert.deepEqual(groups, [{ hash: actionableTextHash, grades: [5, 10], count: 2 }])
})
