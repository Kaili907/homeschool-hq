import test from 'node:test'
import assert from 'node:assert/strict'
import { runAudit } from './audit.mjs'
import { inspectAssessment, inspectLesson, syntheticMaterial } from './lib.mjs'

function binding(subject, overrides = {}) {
  return {
    lessonRef: `fixture-${subject}`,
    courseRef: `fixture-${subject}-course`,
    grade: 9,
    subject,
    sourceReadinessKind: 'STATIC_READY',
    sourceRuntimeState: 'READY',
    ...overrides,
  }
}

function inspect(subject, options = {}) {
  return inspectLesson({
    binding: binding(subject, options.binding),
    value: options.value ?? {},
    markdown: options.markdown ?? null,
    material: options.material ?? syntheticMaterial(options.projected),
    runtimeRow: options.runtimeRow ?? {},
    scoring: options.scoring ?? null,
    scienceRecord: options.scienceRecord ?? null,
  })
}

function has(result, code) {
  assert.ok(result.findingCodes.includes(code), `${code} not found in ${result.findingCodes.join(', ')}`)
}

test('full population gate inspects exactly 8,292 lessons and 699 assessments and passes the convergence release', () => {
  const report = runAudit({ build: true, quiet: true })
  assert.deepEqual(report.counts, { courses: 90, lessons: 8292, assessments: 699 })
  assert.equal(report.releaseReady, true)
  assert.equal(report.lessonGate.ready, 8292)
  assert.equal(report.assessmentGate.ready, 699)
  assert.equal(report.matrix.length, 90)
})

test('negative control: zero actionable normal Math lesson', () => {
  const result = inspect('mathematics', {
    value: { sections: [{ kind: 'independent-practice', items: [{ ref: 'item-1', kind: 'multiple-choice', itemType: 'strategy-habit', prompt: 'Which strategy habit?', choices: ['A', 'B'] }] }] },
    projected: { itemRef: 'item-1', responseKind: 'choice', choices: ['A', 'B'] },
  })
  has(result, 'ZERO_ACTIONABLE_NORMAL_LESSON')
})

test('negative controls: empty required practice and mastery', () => {
  const result = inspect('mathematics', {
    value: { sections: [
      { kind: 'independent-practice', title: 'Independent practice', items: [] },
      { kind: 'mastery-check', title: 'Mastery check', items: [] },
    ] },
  })
  has(result, 'EMPTY_REQUIRED_PRACTICE')
  has(result, 'EMPTY_REQUIRED_MASTERY')
})

test('negative control: empty required writing activity', () => {
  const result = inspect('english-language-arts', {
    value: {
      lessonRef: { grade: 7, phase: 'Performance task build' },
      independentEvidenceTask: { text: "Learner completes a new application of today's lesson." },
    },
  })
  has(result, 'EMPTY_REQUIRED_ACTIVITY')
})

test('negative controls: missing required ELA reading and source', () => {
  const result = inspect('english-language-arts', {
    value: { independentEvidenceTask: { text: 'Write a claim using evidence from the assigned passage.' }, sourceReference: { refs: [{ title: 'Absent passage' }] } },
  })
  has(result, 'MISSING_REQUIRED_READING')
  has(result, 'MISSING_REQUIRED_SOURCE')
})

test('negative control: missing Science data', () => {
  const result = inspect('science', {
    markdown: '**Q1.** What did the absent data show?',
    scienceRecord: { grade: 9, course_id: 'ma-hs9-biology', unit_number: 1, work_type: 'STUDENT_WORK_SHEET', materials: [] },
    projected: { itemRef: 'Q1', responseKind: 'text' },
  })
  has(result, 'MISSING_REQUIRED_DATA')
})

test('negative control: missing Science investigation materials', () => {
  const result = inspect('science', {
    markdown: '**Q1.** Record the result.',
    scienceRecord: { grade: 5, course_id: 'ma-g5-science', unit_number: 1, work_type: 'INVESTIGATION_DATA_SHEET', materials: ['unit-specific source, model, manipulatives, safe materials'], safety_brief: { read_before_touching: true, stop_conditions: ['stop'] } },
    projected: { itemRef: 'Q1', responseKind: 'text' },
  })
  has(result, 'MISSING_REQUIRED_MATERIALS')
  has(result, 'EMPTY_REQUIRED_ACTIVITY')
})

test('negative control: strict placeholder/template shell', () => {
  const result = inspect('technology', {
    value: { primary_task: 'TODO: insert the real task.', work_mode: 'PROBE', task_type: 'digital_citizenship_and_safety' },
  })
  has(result, 'PLACEHOLDER_TEMPLATE_SHELL')
})

test('negative control: flattened structured choices', () => {
  const result = inspect('mathematics', {
    value: { sections: [{ kind: 'independent-practice', items: [{ ref: 'item-1', kind: 'multiple-choice', prompt: 'Choose.', choices: ['A', 'B'] }] }] },
    material: { format: 'structured', sections: [{ title: 'Work', prompts: ['Choose. Choices: A · B'] }] },
  })
  has(result, 'FLATTENED_STRUCTURED_CHOICES')
})

test('negative control: lost itemRef', () => {
  const result = inspect('financial-literacy', {
    value: { tasks: [{ prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', text: 'What is the total?' }] }] },
    material: syntheticMaterial({ itemRef: 'wrong-ref', responseKind: 'text' }),
  })
  has(result, 'LOST_ITEM_REF')
})

test('negative controls: responseKind none and unsupported required response', () => {
  const result = inspect('ready-for-life', {
    value: { tasks: [{ prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Explain your plan.' }] }] },
    projected: { itemRef: 't1-p1', responseKind: 'none' },
  })
  has(result, 'RESPONSE_KIND_NONE')
  has(result, 'UNSUPPORTED_REQUIRED_RESPONSE')
})

test('negative control: adult answer/scoring locator leaks into learner runtime row', () => {
  const result = inspect('ready-for-life', {
    value: { tasks: [{ prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Explain.' }] }] },
    projected: { itemRef: 't1-p1', responseKind: 'text' },
    runtimeRow: { resourceRefs: ['git+abc:curriculum/scoring/item.scoring.json'] },
  })
  has(result, 'ADULT_ANSWER_SCORING_LEAK')
})

test('negative control: unsafe pending Social Studies source state', () => {
  const result = inspect('social-studies', {
    binding: { sourceReadinessKind: 'DYNAMIC_SOURCE_REQUIRED', sourceRuntimeState: 'PENDING_SOURCE_ATTACHMENT' },
    markdown: '## 3. Independent response\n\nExplain the evidence.\n\n## 4. Rubric',
  })
  has(result, 'UNSAFE_SOURCE_STATE')
})

test('positive control: a dynamic Social source remains safely blocked until its complete attachment contract is satisfied', () => {
  const result = inspect('social-studies', {
    binding: {
      sourceReadinessKind: 'DYNAMIC_SOURCE_REQUIRED',
      sourceRuntimeState: 'PENDING_SOURCE_ATTACHMENT',
      sourceReadinessContract: {
        lessonLaunch: 'BLOCKED_PENDING_SOURCE',
        becomesRunnableWhen: 'ATTACHED_SATISFIED',
      },
    },
    markdown: '## 3. Independent response\n\nExplain the evidence.\n\n## 4. Rubric',
    projected: { itemRef: 'independent-response', responseKind: 'CONSTRUCTED_RESPONSE' },
  })
  assert.equal(result.findingCodes.includes('UNSAFE_SOURCE_STATE'), false)
})

test('positive control: authoritative DISABLED launch token is also fail-closed for a pending dynamic Social source', () => {
  const result = inspect('social-studies', {
    binding: {
      sourceReadinessKind: 'DYNAMIC_SOURCE_REQUIRED',
      sourceRuntimeState: 'PENDING_SOURCE_ATTACHMENT',
      sourceReadinessContract: {
        lessonLaunch: 'DISABLED',
        becomesRunnableWhen: 'ATTACHED_SATISFIED',
      },
    },
    markdown: '## 3. Independent response\n\nExplain the evidence.\n\n## 4. Rubric',
    projected: { itemRef: 'independent-response', responseKind: 'CONSTRUCTED_RESPONSE' },
  })
  assert.equal(result.findingCodes.includes('UNSAFE_SOURCE_STATE'), false)
})

test('negative controls: missing assessment material and workflow', () => {
  const result = inspectAssessment({ assessmentRef: 'missing', releaseSlotId: 'course', grade: 9, subject: 'science', state: 'STRUCTURAL_ONLY', productionPackageRef: null }, process.cwd(), false)
  assert.deepEqual(result.findingCodes, ['MISSING_ASSESSMENT_LEARNER_MATERIAL', 'ASSESSMENT_WORKFLOW_MISSING'])
})

test('negative control: unrunnable Technology code task', () => {
  const result = inspect('technology', {
    value: { primary_task: 'Debug the supplied program.', work_mode: 'INVESTIGATE', task_type: 'debugging_and_testing' },
  })
  has(result, 'UNRUNNABLE_TECHNOLOGY_TASK')
})

test('negative controls: missing PE movement cues, safety, and feasible equipment', () => {
  const result = inspect('physical-education', {
    value: {
      studentTask: 'Perform the activity.',
      privacySafeScenario: 'Move in the space.',
      materials: ['unit equipment listed in the guardian safety review'],
      movementCues: [], keyPoints: [], completionCriteria: ['Complete it.'],
    },
  })
  has(result, 'MISSING_PE_MOVEMENT_CUES')
  has(result, 'MISSING_PE_SAFETY')
  has(result, 'UNSAFE_PE_EQUIPMENT_ASSUMPTION')
})

test('negative control: missing Arts model/scaffold', () => {
  const result = inspect('arts-and-music', {
    value: { primary_task: 'Compare the supplied model and create a response.', work_mode: 'MODEL_A', materials: ['paper', 'pencil'] },
  })
  has(result, 'MISSING_ARTS_MODEL_OR_SCAFFOLD')
})

test('negative control: Financial Literacy answer disclosure before the task', () => {
  const result = inspect('financial-literacy', {
    value: { tasks: [{ prompts: [{ ref: 't1-p1', promptType: 'fixed-numeric', text: 'What remains?' }] }] },
    material: {
      format: 'structured',
      sections: [
        { title: 'Remediation', body: 'The correct result is $6.00.', prompts: [] },
        { title: 'Work', prompts: [], items: [{ itemRef: 't1-p1', responseKind: 'text', choices: [] }] },
      ],
    },
    scoring: { scoringAuthority: { items: [{ ref: 't1-p1', answer: '$6.00' }] } },
  })
  has(result, 'FINLIT_ANSWER_DISCLOSURE')
})

test('subject-aware positive controls do not require PE, Arts, or RFL to look like Math', () => {
  const pe = inspect('physical-education', {
    value: {
      studentTask: 'Practise a controlled travel sequence and name one adjustment.',
      privacySafeScenario: 'Check an open cleared movement space, keep water available, and stop if pain or dizziness begins.',
      materials: ['open, cleared movement space', 'water available throughout'],
      movementCues: ['Look ahead.', 'Slow before turning.'],
      completionCriteria: ['Complete or describe the adapted sequence.'],
    },
    material: syntheticMaterial({ itemRef: 'student-task', responseKind: 'text' }),
  })
  const arts = inspect('arts-and-music', {
    value: { primary_task: 'Create a rhythm, document one revision, and explain the artistic choice.', work_mode: 'CREATE', materials: ['paper', 'pencil'] },
    material: syntheticMaterial({ itemRef: 'primary-task', responseKind: 'text' }),
  })
  const rfl = inspect('ready-for-life', {
    value: { tasks: [{ prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Write a fictional plan and explain one tradeoff.' }] }] },
    material: syntheticMaterial({ itemRef: 't1-p1', responseKind: 'text' }),
  })
  for (const result of [pe, arts, rfl]) {
    assert.equal(result.findingCodes.includes('EMPTY_REQUIRED_PRACTICE'), false)
    assert.equal(result.findingCodes.includes('EMPTY_REQUIRED_MASTERY'), false)
    assert.equal(result.findingCodes.includes('ZERO_ACTIONABLE_NORMAL_LESSON'), false)
  }
})

test('positive controls recognize repaired Science, Technology, PE, and ELA execution contracts', () => {
  const science = inspect('science', {
    markdown: '**Q1.** Explain what E1 supports.',
    scienceRecord: {
      grade: 3,
      work_type: 'STUDENT_WORK_SHEET',
      materials: ['this complete learner sheet'],
      executable_content: {
        inputs_complete: true,
        materials_complete: true,
        placeholder_free: true,
        bound_task: { question: 'What does E1 support?', steps: ['Read.', 'Cite.', 'Revise.'] },
        supplied_evidence: { rows: [{}, {}, {}] },
      },
      assurances: { executable_alternative_present: true },
    },
    projected: { itemRef: 'Q1', responseKind: 'CONSTRUCTED_RESPONSE' },
  })
  const technology = inspect('technology', {
    value: {
      primary_task: 'Use the complete supplied case and record the checks.',
      work_mode: 'MODEL',
      task_type: 'debugging_and_testing',
      activity_setup: {
        central_input: { starter_code: 'const value = 1;' },
        expected_behavior_and_specification: ['a', 'b', 'c', 'd'],
        test_cases: [{}, {}, {}],
        execution_method: { primary: 'browser', manual: 'paper' },
        debugging_target: { target: 'repair the loop' },
        equal_credit_alternative: { method: 'paper trace' },
      },
    },
    projected: { itemRef: 'primary-task', responseKind: 'ACTIVITY_EVIDENCE' },
  })
  const pe = inspect('physical-education', {
    value: {
      studentTask: 'Complete or describe the controlled sequence.',
      materials: ['No specialized equipment is required.'],
      movementCues: ['Look ahead.', 'Slow before turning.'],
      safetyRules: ['Check the space and use a self-selected challenge level.'],
      stoppingRules: ['Stop if pain, dizziness, or breathing difficulty begins.'],
      completionCriteria: ['Name the cue and the safety check.'],
    },
    projected: { itemRef: 'student-task', responseKind: 'ACTIVITY_EVIDENCE' },
  })
  const ela = inspect('english-language-arts', {
    value: { independentEvidenceTask: { text: 'Write a claim and support it with one exact detail.' } },
    material: {
      format: 'structured',
      sourceMetadata: { selectionInstructions: 'A'.repeat(260) },
      sections: [{ title: 'Independent evidence', items: [{ itemRef: 'independent-evidence', responseKind: 'CONSTRUCTED_RESPONSE' }] }],
    },
  })
  for (const result of [science, technology, pe, ela]) assert.deepEqual(result.findingCodes, [])
})
