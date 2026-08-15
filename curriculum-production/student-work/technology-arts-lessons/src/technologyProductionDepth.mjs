/**
 * Curriculum-wide Technology teaching depth.
 *
 * Every generated learner experience contains explicit concept teaching, an
 * analogous (never target-identical) worked model, guided work with a stated
 * fade, protected independent evidence, debugging/revision reasoning, a fresh
 * mastery check, and remediation that changes representation. Exact protected
 * resolutions are returned separately for the restricted scoring guide.
 */

const CODE_TASK_TYPES = new Set(['debugging_and_testing', 'programming_and_logic'])
const MASTERY_MODES = new Set(['DEMONSTRATE', 'ASSESS', 'SYNTHESIZE'])
const CREATION_MODES = new Set(['APPLY', 'BUILD', 'INCREMENT'])
const ANALYSIS_MODES = new Set(['PROBE', 'MODEL', 'MODEL_A', 'MODEL_B', 'INVESTIGATE'])

const FAMILY = {
  debugging_and_testing: {
    lessonType: 'code_debug',
    title: 'Evidence before edits',
    terms: [
      ['symptom', 'The observable difference between specified and actual behavior.'],
      ['hypothesis', 'A proposed cause that predicts what a trace or controlled change will show.'],
      ['first divergence', 'The earliest state where execution stops matching the expected state.'],
      ['regression check', 'A rerun of earlier passing cases after a change.'],
    ],
    secondaryLens: 'Use a state table before touching the artifact: expected state, actual state, first divergence, cause hypothesis, one controlled revision, and a complete rerun.',
  },
  programming_and_logic: {
    lessonType: 'algorithms',
    title: 'Specification, state, and correctness',
    terms: [
      ['precondition', 'What must be true about an input before the procedure is required to work.'],
      ['invariant', 'A claim about partial state that remains true as the procedure advances.'],
      ['boundary case', 'A smallest, largest, empty, tied, or edge-shaped permitted input.'],
      ['complexity', 'How time or extra storage grows as the input grows.'],
    ],
    secondaryLens: 'Trace one state change at a time, connect the partial state to the specification, and count the operation that repeats as input size grows.',
  },
  interface_and_accessibility: {
    lessonType: 'design',
    title: 'Design claims need observable access checks',
    terms: [
      ['user need', 'A goal or barrier grounded in a supplied user situation.'],
      ['constraint', 'A limit the design must respect.'],
      ['affordance', 'A cue that helps a person understand what action is possible.'],
      ['access check', 'An observable test of whether a person can perceive, understand, navigate, or operate the design.'],
    ],
    secondaryLens: 'Move from a labelled user need to a design choice, then to an observable access check; preference alone is not evidence.',
  },
  data_and_evidence: {
    lessonType: 'data',
    title: 'From rows to warranted claims',
    terms: [
      ['record', 'One complete case or row in a dataset.'],
      ['transformation', 'A documented change made to data before analysis.'],
      ['provenance', 'Where a value came from and how it was produced.'],
      ['uncertainty', 'What the evidence does not establish or measures only approximately.'],
    ],
    secondaryLens: 'Keep raw values, transformations, and claims separate. Every claim must point to rows or fields, and every limitation must name what the table cannot establish.',
  },
  systems_and_hardware: {
    lessonType: 'analysis',
    title: 'Follow evidence across a system boundary',
    terms: [
      ['component', 'A named part with a defined responsibility.'],
      ['state', 'The information a component holds at a particular moment.'],
      ['interface', 'The boundary where one component sends or receives information.'],
      ['fault isolation', 'Using observations to narrow a failure to the smallest supported location.'],
    ],
    secondaryLens: 'Trace input, processing, storage, and output in order. Locate the first boundary whose observed state differs from its specified state before proposing a repair.',
  },
  digital_citizenship_and_safety: {
    lessonType: 'digital_citizenship_safety',
    title: 'Pause, minimize, verify, and document',
    terms: [
      ['data minimization', 'Collecting or sharing only what a stated purpose actually needs.'],
      ['permission', 'Clear authorization for a specific action and scope.'],
      ['verification', 'Checking a claim through evidence independent of the claim itself.'],
      ['escalation', 'Stopping and involving a trusted adult or responsible authority when risk exceeds the learner’s role.'],
    ],
    secondaryLens: 'Separate the stated purpose from the information or action requested, choose the least-exposing safe response, and record which printed detail supports the decision.',
  },
  design_and_prototyping: {
    lessonType: 'creation_project',
    title: 'Requirements become testable design decisions',
    terms: [
      ['requirement', 'A capability or condition the finished artifact must satisfy.'],
      ['prototype', 'A limited representation built to answer a design question.'],
      ['success criterion', 'An observable condition written before building.'],
      ['iteration', 'A documented change made because a check produced evidence.'],
    ],
    secondaryLens: 'Translate each supplied need into a requirement, make the smallest prototype that can test it, and preserve before/after evidence for one revision.',
  },
  applied_project: {
    lessonType: 'creation_project',
    title: 'Build, check, explain, revise',
    terms: [
      ['intent', 'What the artifact is meant to accomplish.'],
      ['criterion', 'A specific condition used to judge the artifact.'],
      ['evidence', 'An observation, trace, or comparison that another reader can inspect.'],
      ['trade-off', 'A benefit accepted together with a concrete cost or limitation.'],
    ],
    secondaryLens: 'Write intent and criteria first, create one reviewable artifact, test it against the criteria, and make one evidence-driven revision while keeping both versions.',
  },
}

function profileFor(taskType) {
  return FAMILY[taskType] ?? FAMILY.applied_project
}

function lessonTypeFor(taskType, mode) {
  if (MASTERY_MODES.has(mode)) return 'review_mastery'
  if (mode === 'CORRECT' || mode === 'RETEACH') return 'debugging_revision'
  if (CREATION_MODES.has(mode)) return 'creation_project'
  if (ANALYSIS_MODES.has(mode) && !CODE_TASK_TYPES.has(taskType)) return 'analysis'
  return profileFor(taskType).lessonType
}

function conceptExplanation({ focus, taskType, grade }) {
  const profile = profileFor(taskType)
  if (grade <= 5) {
    return [
      `${focus} is about making a clear choice and showing why it works. First name what the result should do. Then point to the step, label, or fact that supports your choice.`,
      `A check is different from a guess. Write what you expect before you try it. Compare what happened with what you expected. If they differ, circle the first place they stop matching.`,
      `A fix needs a reason. Change one thing that your evidence supports, try the same checks again, and keep the old and new work. That record shows your thinking even when the first try was wrong.`,
      `${profile.secondaryLens} You may use paper, objects, labelled drawings, or precise steps when a computer is not the best tool.`,
    ]
  }
  return [
    `${focus} is treated here as a relationship among a specification, inspectable evidence, and a justified decision. A result is not secure merely because it looks plausible: the learner must state what should be true, identify evidence that bears on it, and explain why the evidence supports the claim.`,
    `${profile.secondaryLens} This keeps observation separate from interpretation and prevents a preferred answer from being rewritten as evidence after the fact.`,
    `Verification begins before execution or review. Record an expected result or pass condition, include a normal and boundary or stress case, compare actual with expected, and interpret every mismatch. After revision, rerun the complete relevant set so a local fix does not hide a regression elsewhere.`,
    `Correctness and quality require a limitation statement. Name what the supplied case, trace, dataset, or prototype cannot establish, then describe the additional evidence that would settle that point. For creation work, also name a viable alternative and the concrete clarity, access, time, storage, privacy, or reliability trade-off.`,
  ]
}

function keyTerms(taskType) {
  return profileFor(taskType).terms.map(([term, definition]) => ({ term, definition }))
}

function codeWorkedExample(lessonId, grade) {
  const elementary = grade <= 5
  return {
    ref: `${lessonId}#worked-analogue-count-ready`,
    kind: elementary ? 'WORKED_EXAMPLE_PSEUDOCODE' : 'WORKED_EXAMPLE_CODE',
    relationship_to_protected_tasks: 'ANALOGOUS_NON_TARGET',
    evidence_eligible: false,
    title: 'Worked analogue: count ready cards without skipping evidence',
    goal: 'Return the number of fictional cards whose ready field is true.',
    starter_code: `function countReady(cards) {
  let total = 0;
  for (const card of cards) {
    if (card.ready) total += 2;
  }
  return total;
}`,
    public_observation: 'For [{ready: true}, {ready: false}, {ready: true}], expected is 2 but actual is 4. For [], expected and actual are both 0.',
    annotations: [
      { move: 'Specify', reasoning: 'Each ready card contributes exactly one to the count; a non-ready card contributes zero.' },
      { move: 'Predict', reasoning: 'After the first ready card, total should be 1. Write that state before tracing.' },
      { move: 'Inspect', reasoning: 'The first iteration changes total from 0 to 2, so the first divergence is the state update, not the loop boundary or return.' },
      { move: 'Revise', reasoning: 'Change the ready-card update so it adds one. This predicts totals 1, 1, and 2 across the three iterations.' },
      { move: 'Verify', reasoning: 'The mixed case returns 2, [] returns 0, and three ready cards return 3. All expected and actual results match.' },
    ],
    completed_code: `function countReady(cards) {
  let total = 0;
  for (const card of cards) {
    if (card.ready) total += 1;
  }
  return total;
}`,
    correctness_and_efficiency: 'After each iteration, total equals the number of ready cards in the prefix already examined. The invariant begins true for the empty prefix, one iteration maintains it, and termination covers the whole list. Time is O(n) and extra space is O(1).',
    transfer_prompt: 'On the protected task, identify its own first divergent state. Do not copy this update: the protected fixture uses a different data shape and defect.',
    difference_from_protected_task: 'This model counts object flags and repairs an over-large accumulator update. The protected task uses different inputs, behavior, identifiers, and a separately withheld resolution.',
  }
}

const NON_CODE_WORKED = {
  interface_and_accessibility: {
    title: 'Worked analogue: a readable two-action weather card',
    case: 'Fictional user Rowan uses only a keyboard and enlarges text to 200%. A paper weather card has icon-only controls and puts status in pale color alone.',
    annotations: [
      'Need: Rowan must identify status and activate both controls without a pointer.',
      'Evidence: the supplied card has no text status and no stated keyboard order.',
      'Revision: add a status word beside the visual mark, label both controls, and number the focus order.',
      'Check: at 200% size, a reader can name the status and reach both controls in the numbered order without color or dragging.',
      'Limitation: a paper trace predicts access but does not replace later assistive-technology testing.',
    ],
  },
  data_and_evidence: {
    title: 'Worked analogue: a four-row seed-count table',
    case: 'A fictional table records seed counts of 4, 6, 6, and “about 10.” The last value is an estimate; one 6 is copied from another row rather than observed.',
    annotations: [
      'Separate direct counts, estimates, and copied claims before calculating.',
      'A defensible summary reports the two direct values and labels the other values by provenance.',
      'Do not average unlike-quality values without disclosing the decision.',
      'Check the revision by tracing every summary value back to one labelled row.',
      'The table cannot establish why the counts differ or represent a larger population.',
    ],
  },
  systems_and_hardware: {
    title: 'Worked analogue: isolate a save-message mismatch',
    case: 'A fictional log shows input “Save copy,” processing validates the name, storage records draft-03.txt, but the output message still says draft-02.txt.',
    annotations: [
      'The input, processing, and storage observations match their specifications.',
      'The first mismatch appears at the output boundary, so replacing storage is unsupported.',
      'Revise the output state source so it reads the stored name.',
      'Rerun normal save, renamed save, and empty-name rejection checks.',
      'The log isolates a boundary but cannot prove the internal cause without an implementation trace.',
    ],
  },
  digital_citizenship_and_safety: {
    title: 'Worked analogue: minimize a fictional club timer',
    case: 'A paper-only club timer needs a made-up activity label and duration. Its draft form also asks for an exact birth date and contact list even though neither supports timing.',
    annotations: [
      'State the purpose first: label and time a fictional activity.',
      'Match each requested field to that purpose; the date and contacts have no supplied justification.',
      'Choose the least-exposing response: omit unrelated fields and keep the case offline.',
      'Check by confirming every retained field has a stated function.',
      'Escalate rather than supplying information if a real tool demands unrelated data or sign-in.',
    ],
  },
  design_and_prototyping: {
    title: 'Worked analogue: turn a need into a testable locker label',
    case: 'A fictional shared supply locker needs labels readable from two steps away, usable without color, and replaceable without remaking the whole sign.',
    annotations: [
      'Translate the needs into three requirements before sketching.',
      'Prototype large text plus a distinct shape and a replaceable paper slot.',
      'Check distance, no-color identification, and label replacement separately.',
      'Revise the smallest failing feature and preserve both sketches.',
      'A paper prototype cannot establish long-term durability; name that limitation.',
    ],
  },
  applied_project: {
    title: 'Worked analogue: revise a three-step homework token board',
    case: 'A fictional paper board should record a made-up task in three actions. The first sketch needs five actions and uses tiny labels.',
    annotations: [
      'Write the three-action and readable-label criteria before revising.',
      'Trace each action and mark the two that do not advance the goal.',
      'Combine those steps and enlarge the labels in a second sketch.',
      'Rerun the same action count and readability check on both versions.',
      'Keep the first version so the evidence-driven change is visible.',
    ],
  },
}

function nonCodeWorkedExample(lessonId, taskType) {
  const source = NON_CODE_WORKED[taskType] ?? NON_CODE_WORKED.applied_project
  return {
    ref: `${lessonId}#worked-analogue-${taskType.replaceAll('_', '-')}`,
    kind: 'WORKED_EXAMPLE_ANNOTATED_CASE',
    relationship_to_protected_tasks: 'ANALOGOUS_NON_TARGET',
    evidence_eligible: false,
    title: source.title,
    complete_analogue_case: source.case,
    annotations: source.annotations.map((reasoning, index) => ({ step: index + 1, reasoning })),
    completed_model: source.annotations.join(' '),
    transfer_prompt: 'Use the same evidence discipline on the protected task, but make a new decision from its different printed labels. Do not copy this model as the protected response.',
    difference_from_protected_task: 'The worked model uses a different fictional setting, facts, labels, decision, and check. None of its completed claims answers the protected central input.',
  }
}

function guidedTask({ lesson, taskType, activitySetup }) {
  if (activitySetup.activity_kind === 'CODE_OR_DEBUG') {
    return {
      ref: `${lesson.lesson_id}#guided-tally-open`,
      title: 'Guided practice: trace before changing a new state update',
      starter_code: `function tallyOpen(items) {
  let open = 0;
  for (const item of items) {
    if (item.status === "open") open = 1;
  }
  return open;
}`,
      specification: 'Return the number of fictional items whose status is exactly "open".',
      public_tests: ['[open, closed, open] → 2', '[] → 0', '[closed] → 0'],
      prompts: [
        'Write the expected open value after each item before tracing.',
        'Circle the first row where open no longer equals the number of open items examined.',
        'State a falsifiable cause and the rows one change should affect.',
        'Make one justified change, rerun every case, and interpret the evidence.',
      ],
      immediate_check: 'The first cue names the invariant and state column. It does not name the corrected statement.',
      support_fade: 'Prompts identify the state and evidence order here. The protected independent task supplies only its specification, public checks, and a location/evidence cue; the fresh check permits term or instruction clarification only.',
      solution_status: 'WITHHELD_FROM_LEARNER_SURFACES',
    }
  }

  const centralTitle = activitySetup.central_input.title
  return {
    ref: `${lesson.lesson_id}#guided-evidence-bridge`,
    title: 'Guided practice: claim → printed evidence → check',
    alternate_case: `A separate fictional practice card about ${lesson.focus} contains labels P1, P2, and P3. P1 states the intended purpose, P2 states a constraint, and P3 records an observed mismatch. It is not the protected case titled "${centralTitle}."`,
    prompts: [
      'Restate P1 as a criterion without adding facts.',
      'Use P2 to reject one tempting but invalid response.',
      'Use P3 to propose a revision and write an observable pass condition.',
      'Name one conclusion the three labels cannot support.',
    ],
    immediate_check: `A complete guided response has one claim about ${lesson.focus}, the exact supporting label, one check, and one limitation.`,
    support_fade: 'The guided card names the purpose/constraint/mismatch roles. In protected work, the learner must locate those roles independently in the supplied central input; the fresh check offers only term or instruction clarification.',
    solution_status: 'WITHHELD_FROM_LEARNER_SURFACES',
  }
}

function independentTask({ lesson, mode, activitySetup }) {
  const testSummary = activitySetup.test_cases.map((test) => `${test.input} → ${test.expected}`)
  return {
    ref: `${lesson.lesson_id}#protected-independent`,
    role: MASTERY_MODES.has(mode) ? 'MASTERY_EVIDENCE' : 'INDEPENDENT_LESSON_EVIDENCE',
    freshness: 'FRESH_FROM_WORKED_AND_GUIDED_FIXTURES',
    title: `Independent ${activitySetup.activity_kind === 'CODE_OR_DEBUG' ? 'construction/debug' : 'analysis/design'}: ${lesson.focus}`,
    central_input_ref: 'activity_setup.central_input',
    specification: activitySetup.expected_behavior_and_specification,
    public_checks: testSummary,
    evidence_requirements: activitySetup.activity_kind === 'CODE_OR_DEBUG'
      ? [
          'Complete corrected code or precise line-by-line pseudocode authored by the learner.',
          'Expected-before-actual results for every public case plus one learner-designed boundary or deliberate-break case.',
          'A symptom → hypothesis → first divergent evidence → predicted change → test → interpretation → full rerun log.',
          'A state invariant or equivalent partial-progress claim connected to termination and the returned result.',
          'A time/space or reliability trade-off against one viable alternative.',
        ]
      : [
          'At least three claims, each linked to an exact printed row, card, requirement, or scenario detail.',
          'One feasible learner-authored revision, design, or decision made only from the supplied fictional case.',
          'An observable pass condition written before judging the revision or decision.',
          'One limitation, missing fact, or trade-off stated without inventing evidence.',
          'A before/after or claim/check record showing how evidence changed the work.',
        ],
    support: 'TERM_OR_INSTRUCTION_CLARIFICATION; one location/evidence cue may identify where to inspect but may not select the decision or give the resolution.',
    solution_status: 'WITHHELD_FROM_LEARNER_SURFACES',
  }
}

function debuggingReasoning(activitySetup) {
  const noun = activitySetup.activity_kind === 'CODE_OR_DEBUG' ? 'program state' : 'claim or design state'
  return {
    title: 'Use the six-move evidence cycle',
    required_moves: [
      'Symptom: record expected versus actual without explaining it away.',
      `Hypothesis: state one falsifiable cause about the ${noun} before revising.`,
      'Inspection: identify the first trace row or printed detail that bears on the hypothesis.',
      'Predicted effect: state what one controlled change should alter and what it should leave unchanged.',
      'Test and interpretation: compare actual with the prediction and mark the hypothesis supported, rejected, or not fully tested.',
      'Verification: rerun all relevant checks and record any new limitation or next hypothesis.',
    ],
    anti_guessing_rule: 'A working final artifact without a pre-change hypothesis and inspectable evidence is incomplete debugging/revision evidence.',
  }
}

function freshCheck({ lesson, taskType, activitySetup }) {
  if (activitySetup.activity_kind === 'CODE_OR_DEBUG') {
    return {
      learner: {
        ref: `${lesson.lesson_id}#fresh-total-label-lengths`,
        role: 'FRESH_MASTERY_OR_REMEDIATION_CHECK',
        freshness: 'DIFFERENT_FIXTURE_AND_DEFECT_FROM_WORKED_GUIDED_AND_PROTECTED_TASKS',
        title: 'Fresh transfer: total fictional label lengths',
        starter_code: `function totalLabelLengths(labels) {
  let total = 0;
  for (const label of labels) {
    total = label.length;
  }
  return total;
}`,
        specification: 'Return the sum of the character counts of every supplied fictional label; preserve the input.',
        observed_symptom: '["oak", "map"] should return 6 but returns 3.',
        public_tests: ['["oak", "map"] → 6', '[] → 0', '["cedar"] → 5'],
        evidence_requirements: 'Submit a new six-move log, corrected code or precise pseudocode, every public rerun, a prefix-state invariant, and time/extra-space reasoning.',
        hint_ceiling: 'TERM_OR_INSTRUCTION_CLARIFICATION',
        solution_status: 'WITHHELD_FROM_LEARNER_SURFACES',
      },
      adult: {
        task_ref: `${lesson.lesson_id}#fresh-total-label-lengths`,
        root_cause: 'The loop replaces total with the current label length instead of accumulating the current length with prior lengths.',
        decisive_resolution: 'Update total with total + label.length on each iteration.',
        reference_implementation: `function totalLabelLengths(labels) {
  let total = 0;
  for (const label of labels) total = total + label.length;
  return total;
}`,
        accepted_invariant: 'After each iteration, total equals the sum of the lengths of exactly the prefix already examined.',
        expected_results: ['["oak", "map"] → 6', '[] → 0', '["cedar"] → 5'],
      },
    }
  }

  const profile = profileFor(taskType)
  return {
    learner: {
      ref: `${lesson.lesson_id}#fresh-northstar-case`,
      role: 'FRESH_MASTERY_OR_REMEDIATION_CHECK',
      freshness: 'DIFFERENT_FIXTURE_FROM_WORKED_GUIDED_AND_PROTECTED_TASKS',
      title: `Fresh transfer: Northstar card for ${lesson.focus}`,
      complete_case: 'A new fictional Northstar card supplies purpose N1, constraint N2, two observations N3–N4, and an unsuccessful first revision N5. No outside facts are needed or permitted.',
      task: `Use ${profile.secondaryLens.toLowerCase()} Produce two evidence-linked claims, one revised decision or design, an observable pass condition, and one limitation.`,
      evidence_requirements: 'Submit the label-to-claim map, the revised artifact or decision, expected-versus-observed check evidence, and the limitation. Do not reuse the worked model wording.',
      hint_ceiling: 'TERM_OR_INSTRUCTION_CLARIFICATION',
      solution_status: 'WITHHELD_FROM_LEARNER_SURFACES',
    },
    adult: {
      task_ref: `${lesson.lesson_id}#fresh-northstar-case`,
      accepted_evidence_model: [
        'Each claim cites N1–N5 and stays within what that label supports.',
        'The revision addresses N5 while continuing to respect N1 and N2.',
        'The pass condition is observable and could disconfirm the learner’s preferred revision.',
        'The limitation names an unresolved question rather than inventing an answer.',
      ],
      decisive_resolution: 'Accept multiple responses that satisfy all four evidence conditions; no single wording, layout, or decision is required.',
    },
  }
}

function remediationRoutes({ lesson, taskType, activitySetup }) {
  const code = activitySetup.activity_kind === 'CODE_OR_DEBUG'
  return [
    {
      trigger_id: 'claim-not-connected-to-partial-state',
      learner_signal: code
        ? 'My explanation repeats the final goal but does not describe what is true partway through execution.'
        : 'My conclusion names the topic but does not connect to exact printed evidence.',
      title: code ? 'Different representation: token-and-box state walk' : 'Different representation: evidence cards and arrows',
      alternate_teaching: code
        ? 'Represent each variable or collection with a labelled box and move one token per executed step. After every move, write one sentence that must still be true. This makes partial state visible without showing the protected repair.'
        : 'Copy each printed fact onto a separate card. Draw an arrow from a fact to a claim only when the fact would make that claim more or less credible. Unconnected claims must be revised or removed.',
      analogue_task: code
        ? 'Walk through a three-step fictional counter with tokens and state what is true after steps one and two; do not use the protected identifiers or inputs.'
        : `Use four new cards about a fictional library sign to build a fact → claim → check map for ${lesson.focus}; do not use the protected case.`,
      return_check: 'Complete the fresh mastery check with teaching materials closed. The original protected solution remains withheld.',
      original_protected_solution_exposed: false,
    },
    {
      trigger_id: 'revision-before-evidence',
      learner_signal: 'I changed or chose something before recording the mismatch and a testable reason.',
      title: 'Different routine: the six-box evidence ladder',
      alternate_teaching: 'Use six boxes in order: expected/actual, first divergence or decisive detail, hypothesis, predicted effect, one revision, rerun interpretation. Do not enter the revision box until the first four constrain what the change is meant to test.',
      analogue_task: `Apply the six boxes to a separate fictional clock-card mismatch related to ${lesson.focus}. Stop after the prediction, explain what result would reject the hypothesis, then finish the check.`,
      return_check: 'Complete the fresh mastery check independently. A correct but low-confidence response receives confirmation tied to evidence, not automatic reteaching.',
      original_protected_solution_exposed: false,
    },
  ]
}

function applicationChecks(taskType) {
  const profile = profileFor(taskType)
  return [
    `Can you explain ${profile.title.toLowerCase()} in your own words using a new fictional example?`,
    'Did you write expected behavior or a pass condition before running, tracing, or judging the result?',
    'Can another reader trace each conclusion to a state row, printed fact, requirement, or observation?',
    'Did you name a boundary, stress case, missing fact, or limitation instead of assuming it away?',
  ]
}

export function buildTechnologyProductionDepth({ lesson, mode, taskType, grade, activitySetup, adultSolution }) {
  const profile = profileFor(taskType)
  const workedExample = activitySetup.activity_kind === 'CODE_OR_DEBUG'
    ? codeWorkedExample(lesson.lesson_id, grade)
    : nonCodeWorkedExample(lesson.lesson_id, taskType)
  const fresh = freshCheck({ lesson, taskType, activitySetup })

  return {
    lessonType: lessonTypeFor(taskType, mode),
    learnerExperience: {
      experience_version: 'technology-production-depth-r1',
      static_complete: true,
      tutor_required: false,
      lesson_type: lessonTypeFor(taskType, mode),
      sequence_policy: 'Concept teaching, the analogous model, and guided practice precede protected independent evidence. Protected and fresh resolutions are absent from learner material and remain adult-only.',
      learning_targets: [
        ...lesson.learning_objectives,
        `Explain the evidence chain used to make or evaluate a result about ${lesson.focus}.`,
        'Transfer the reasoning to a fresh case without a completed target response in view.',
      ],
      concept_teaching: {
        ref: `${lesson.lesson_id}#concept-${taskType.replaceAll('_', '-')}`,
        title: `${profile.title}: ${lesson.focus}`,
        entry_check: `Before reading, write one prediction about ${lesson.focus} and one observation that could show the prediction is wrong. This readiness record is no-penalty evidence.`,
        explanation: conceptExplanation({ focus: lesson.focus, taskType, grade }),
        key_terms: keyTerms(taskType),
        application_check: applicationChecks(taskType),
      },
      worked_example: workedExample,
      guided_task: guidedTask({ lesson, taskType, activitySetup }),
      independent_task: independentTask({ lesson, mode, activitySetup }),
      debugging_reasoning: debuggingReasoning(activitySetup),
      remediation_routes: remediationRoutes({ lesson, taskType, activitySetup }),
      fresh_mastery_check: fresh.learner,
    },
    trustedSolutionReference: {
      authority: 'ADULT_TRUSTED_AUTHORITY',
      learner_visibility: 'NEVER',
      review_timing: 'TRUSTED_ADULT_REVIEW_AFTER_REQUIRED_INDEPENDENT_EVIDENCE_IS_SAVED',
      lesson_type: lessonTypeFor(taskType, mode),
      protected_task: {
        task_ref: `${lesson.lesson_id}#protected-independent`,
        ...adultSolution,
      },
      fresh_mastery_check: fresh.adult,
      remediation_authority: {
        selection_rule: 'Choose the smallest alternate route from observable evidence; do not repeat the original task or expose its protected resolution.',
        mastery_reconsideration: 'Reconsider mastery only from the fresh independent record under the same criteria. A worked or guided response is instruction, not mastery evidence.',
      },
    },
  }
}
