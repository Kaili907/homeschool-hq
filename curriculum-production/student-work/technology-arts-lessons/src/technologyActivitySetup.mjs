/**
 * Complete, inline activity inputs for Technology/CS lessons.
 *
 * A task package must be executable from the package itself. Nothing here
 * relies on a teacher later supplying a worksheet, model, dataset, account,
 * paid application, or external service. Code activities use plain
 * JavaScript plus an equal-credit hand-trace; other activities use a fully
 * printed fictional case plus a paper-first method.
 */

const CODE_OR_DEBUG =
  /algorithm|program|code|debug|function|loop|conditional|variable|pseudocode|trace|recursion|sorting|searching|query|schema|array|list\b|dictionar|stack|queue|data type|operator|selection|iteration|sequence|\bevents?\b|decomposition|object|class|encapsulation|inheritance|module|branch|merge|conflict|refactor|automated test|concurr|race condition|cache|profil|memory model|process|thread|graph|traversal|dynamic programming|heuristic|complexity|correctness|invariant|procedure|html|formulas?\b/i

function identifierFor(lessonId) {
  return lessonId.replace(/[^a-z0-9]+/gi, '_')
}

function buildCodeCase(lesson) {
  const id = identifierFor(lesson.lesson_id)
  const focus = lesson.focus.toLowerCase()
  if (/html|semantic structure|layout|responsive|forms? and validation/.test(focus)) {
    return {
      starterCode: `const ${id}_controls = [\n  { text: "Save", label: "" },\n  { text: "Cancel", label: "Cancel" }\n];\n\nfunction countMissingLabels(controls) {\n  return controls.filter((control) => control.text.trim().length === 0).length;\n}\n\nconsole.log(countMissingLabels(${id}_controls));`,
      inputs: ['{ text: "Save", label: "" }', '{ text: "Cancel", label: "Cancel" }', '[]'],
      expectedSummary: 'The function must count controls whose label is empty; the supplied two-control input must return 1.',
      safetyCheck: 'The function must inspect the label field, must not alter the controls, and must return 0 for an empty list.',
      tests: [
        { input: 'the two supplied controls', expected: '1' },
        { input: '[]', expected: '0' },
        { input: '[{ text: "Go", label: "Go" }]', expected: '0' },
      ],
      observed: 'The code checks visible text instead of the label field, so it reports 0 missing labels when one label is missing.',
      target: 'Change the field used by the filter, explain why visible text and an accessible label are separate data, and rerun all three tests.',
      passing: 'The filter checks control.label; the three tests return 1, 0, and 0.',
    }
  }
  if (/object|class|encapsulation|inheritance|module|interface|state and data flow/.test(focus)) {
    return {
      starterCode: `class ${id}_Counter {\n  constructor() { this.value = 0; }\n  add(amount) { this.value = amount; }\n}\n\nconst counter = new ${id}_Counter();\ncounter.add(2);\ncounter.add(3);\nconsole.log(counter.value);`,
      inputs: ['starting state 0', 'add(2)', 'add(3)'],
      expectedSummary: 'The object must preserve its state and add each amount; after add(2) and add(3), the exact value must be 5.',
      safetyCheck: 'Each method call must change only the counter instance state, and adding 0 must leave the state unchanged.',
      tests: [
        { input: 'start 0; add(2); add(3)', expected: '5' },
        { input: 'start 0; add(0)', expected: '0' },
        { input: 'start 0; add(-1); add(4)', expected: '3' },
      ],
      observed: 'The add method replaces the stored state instead of composing the new amount with the prior state, so the supplied calls end at 3 instead of 5.',
      target: 'Repair the state update inside add, explain the role of the existing instance value, and rerun all three tests.',
      passing: 'The update combines this.value with amount; the three tests return 5, 0, and 3.',
    }
  }
  if (/graph|traversal|search|sort|recursion|complexity|correctness|invariant|greedy|dynamic programming|heuristic/.test(focus)) {
    return {
      starterCode: `const ${id}_values = [4, 7, 2];\n\nfunction greatest(values) {\n  let best = 0;\n  for (const value of values) {\n    if (value > best) best = value;\n  }\n  return best;\n}\n\nconsole.log(greatest(${id}_values));`,
      inputs: ['[4, 7, 2]', '[-5, -2, -9]', '[6]'],
      expectedSummary: 'The algorithm must return the greatest member of a nonempty list; the supplied list must return 7.',
      safetyCheck: 'The invariant is that best equals the greatest value examined so far, including when every value is negative.',
      tests: [
        { input: '[4, 7, 2]', expected: '7' },
        { input: '[-5, -2, -9]', expected: '-2' },
        { input: '[6]', expected: '6' },
      ],
      observed: 'Starting best at 0 violates the stated invariant for an all-negative list, so the second test incorrectly returns 0.',
      target: 'Choose an initialization supported by the nonempty-list specification, state the loop invariant, and rerun all three tests.',
      passing: 'Initializing best from values[0] makes the invariant true before iteration; the tests return 7, -2, and 6.',
    }
  }
  if (/concurr|race|thread|process|cache|profil|performance|memory model|resource limit|reliability|failure/.test(focus)) {
    return {
      starterCode: `const ${id}_deltas = [3, -1, 2];\n\nfunction applyUpdates(start, deltas) {\n  let current = start;\n  for (const delta of deltas) {\n    current = start + delta;\n  }\n  return current;\n}\n\nconsole.log(applyUpdates(0, ${id}_deltas));`,
      inputs: ['start 0 with deltas [3, -1, 2]', 'start 5 with deltas []', 'start 1 with deltas [2, 2]'],
      expectedSummary: 'Updates must compose in order from the latest state; start 0 with deltas 3, -1, and 2 must finish at 4.',
      safetyCheck: 'An empty update list must preserve the start value, and no update may recompute from stale start state.',
      tests: [
        { input: 'applyUpdates(0, [3, -1, 2])', expected: '4' },
        { input: 'applyUpdates(5, [])', expected: '5' },
        { input: 'applyUpdates(1, [2, 2])', expected: '5' },
      ],
      observed: 'Each update recomputes from the original start value, discarding earlier updates, so the supplied case returns 2 instead of 4.',
      target: 'Replace the stale-state dependency with the current state, explain the update order, and rerun all three tests.',
      passing: 'Each assignment uses current + delta; the tests return 4, 5, and 5.',
    }
  }
  if (/query|schema|database|array|list\b|dictionar|stack|queue|record|data type|type conversion/.test(focus)) {
    return {
      starterCode: `const ${id}_records = [\n  { label: "Maple", value: 4, active: true },\n  { label: "River", value: 7, active: false },\n  { label: "Cedar", value: 2, active: true }\n];\n\nfunction summarize(records) {\n  return records.filter((record) => record.active).reduce((total, record) => total - record.value, 0);\n}\n\nconsole.log(summarize(${id}_records));`,
      inputs: ['Maple: value 4, active true', 'River: value 7, active false', 'Cedar: value 2, active true'],
      expectedSummary: 'The query must select active records and total their values; the supplied records must return 6.',
      safetyCheck: 'Inactive records must not affect the result, and an empty record list must return 0.',
      tests: [
        { input: 'the three supplied records', expected: '6' },
        { input: '[]', expected: '0' },
        { input: '[{ label: "Elm", value: 5, active: false }]', expected: '0' },
      ],
      observed: 'The selection is correct, but the aggregation subtracts each selected value, so the supplied records return -6 instead of 6.',
      target: 'Repair the aggregation operator, explain the selected rows and accumulator state, and rerun all three tests.',
      passing: 'The reducer uses total + record.value; the tests return 6, 0, and 0.',
    }
  }
  return {
    starterCode: `const ${id}_steps = ["open", "check", "save"];\n\nfunction runSteps(steps) {\n  const completed = [];\n  for (let index = 1; index < steps.length; index += 1) {\n    completed.push(steps[index]);\n  }\n  return completed.join(" > ");\n}\n\nconsole.log(runSteps(${id}_steps));`,
    inputs: ['["open", "check", "save"]', '[]', '["start"]'],
    expectedSummary: 'The procedure must execute every supplied step in order; the main input must return open > check > save.',
    safetyCheck: 'An empty step list must return an empty string, and a one-step list must retain that step.',
    tests: [
      { input: '["open", "check", "save"]', expected: 'open > check > save' },
      { input: '[]', expected: 'empty string' },
      { input: '["start"]', expected: 'start' },
    ],
    observed: 'Iteration begins at index 1, so the first instruction is silently skipped and the main input returns check > save.',
    target: 'Repair the initial index, explain the sequence invariant, and rerun all three tests.',
    passing: 'Iteration begins at index 0; all three tests retain every step in order.',
  }
}

function codeFixture(lesson, grade) {
  const codeCase = buildCodeCase(lesson)

  return {
    activity_kind: 'CODE_OR_DEBUG',
    central_input: {
      title: `Inline ${lesson.focus} code case`,
      purpose: `Use this exact fictional case to investigate ${lesson.focus}; no other file, model, dataset, or account is needed.`,
      starter_code_language: 'JavaScript (ECMAScript 2020-compatible)',
      starter_code: codeCase.starterCode,
      input_data: codeCase.inputs,
    },
    expected_behavior_and_specification: [
      codeCase.expectedSummary,
      codeCase.safetyCheck,
      `The submitted explanation must connect the observed control flow or data state to ${lesson.focus}, not merely state the final number.`,
      grade >= 8
        ? 'The boundary test must be completed and its actual result compared explicitly with the expected result.'
        : 'The smallest test case must be tried and its actual result compared with the expected result.',
    ],
    execution_method: {
      primary: 'No-install browser method: open any browser developer console, paste the complete starter code, press Enter, and record the output or exact error text.',
      local_optional: 'If Node.js is already installed, save the unchanged snippet as activity.js and run `node activity.js`; installing Node.js is not required.',
      no_computer_required: 'The hand-trace route below is a complete execution method and earns identical credit.',
    },
    test_cases: codeCase.tests,
    debugging_target: {
      observed_failure: codeCase.observed,
      target: codeCase.target,
      passing_change: codeCase.passing,
      scope_note: `Diagnosing the state, control-flow, or data defect and connecting the repair to ${lesson.focus} is the central evidence.`,
    },
    equal_credit_alternative: {
      method: 'Paper or notes-app simulation; this earns exactly the same score as running code.',
      steps: [
        'Make one row for each statement or loop check and copy the starting input exactly.',
        'Record every variable, object field, selected item, and output after that step.',
        'Circle the first row where the actual state stops matching the specification.',
        'Apply the one repair named in your explanation and trace all three tests again.',
      ],
      evidence_to_submit: 'The completed trace, the one-line corrected condition, and an expected-versus-actual table for all three tests.',
    },
  }
}

function dataFixture(lesson) {
  return {
    title: `Inline fictional evidence table for ${lesson.focus}`,
    purpose: `Use every row below; the table is the entire dataset for the task and contains no real person or location.`,
    columns: ['case', 'category', 'value', 'source_note'],
    rows: [
      ['Maple', 'A', 4, 'direct count recorded twice'],
      ['River', 'B', 7, 'estimate with a range of 6 to 8'],
      ['Cedar', 'A', 2, 'direct count recorded once'],
      ['Harbor', 'B', 7, 'copied claim with no supporting observation'],
    ],
  }
}

function safetyFixture(lesson) {
  return {
    title: `Inline fictional decision case for ${lesson.focus}`,
    purpose: 'Classify and revise this case without opening a site, contacting anyone, signing in, or using real personal information.',
    scenario: [
      'A fictional app called Pebble Planner asks for a display nickname, exact birth date, home address, and contact list before showing a simple homework timer.',
      'Its notice says the nickname is needed to label the timer, but gives no reason for collecting an address or contacts.',
      'A fictional message then pressures the learner to reveal a sign-in secret immediately or lose the timer.',
    ],
    decision_options: [
      'A: supply every requested item',
      'B: stop, share no information, save a description of the message, and ask a trusted adult',
      'C: invent an address but reveal a sign-in secret',
    ],
  }
}

function systemsFixture(lesson) {
  return {
    title: `Inline paper system for ${lesson.focus}`,
    purpose: 'Use the labelled parts and event log below; no device, account, network, or special application is required.',
    labelled_parts: [
      'Input card I1: the user selects Save',
      'Process card P1: the application checks the file name',
      'Storage card S1: Folder/Practice receives a copy named draft-02.txt',
      'Output card O1: the screen reports Saved as draft-02.txt',
    ],
    event_log: [
      '09:00 — draft-01.txt exists in Folder/Practice',
      '09:02 — user selects Save As and enters draft-02.txt',
      '09:03 — storage card records draft-02.txt',
      '09:04 — output card reports success',
    ],
  }
}

function designFixture(lesson) {
  return {
    title: `Inline design brief for ${lesson.focus}`,
    purpose: 'Design only for the fictional learner described here; no interview, public post, account, camera, or outside tester is needed.',
    fictional_user: 'Kai uses a keyboard, sometimes enlarges text to 200%, and wants a three-step way to track completed reading sessions without entering a name or location.',
    required_features: [
      'Add one reading session in at most three actions.',
      'Show completion using both a word and a visual mark, not color alone.',
      'Remain understandable at 200% text size.',
      'Store only a fictional book label and a completed/not-completed value.',
    ],
    fixed_constraint: 'The prototype is a labelled paper sketch or local file; it is never published and collects no real personal data.',
  }
}

function artifactFixture(lesson, taskType) {
  const focus = `${lesson.focus} ${lesson.title}`.toLowerCase()
  if (/privacy|permission|passphrase|website|trusted adult|kind|unsafe|digital foot|screen time|source|misinformation|copyright|ai output|phish|social engineering|attack|encryption|authentication|authorization|security|incident|vulnerab|threat|risk|law|rights|ethic|accountability|licen|attribution|personal information/.test(focus)) {
    return safetyFixture(lesson)
  }
  if (/data|chart|table|spreadsheet|correlation|machine learning|study design|evidence|encoding|counting|sorting|fact|uncertainty|model limitations/.test(focus)) {
    return dataFixture(lesson)
  }
  if (/hardware|software|device|file|folder|typing|keyboard|mouse|trackpad|storage|memory|network|routing|protocol|internet|processor|operating system|backup|input and output|input output/.test(focus)) {
    return systemsFixture(lesson)
  }
  if (taskType === 'data_and_evidence') return dataFixture(lesson)
  if (taskType === 'digital_citizenship_and_safety') return safetyFixture(lesson)
  if (taskType === 'systems_and_hardware') return systemsFixture(lesson)
  return designFixture(lesson)
}

function artifactSetup(lesson, taskType, grade) {
  return {
    activity_kind: 'ANALYSIS_OR_DESIGN',
    central_input: artifactFixture(lesson, taskType),
    expected_behavior_and_specification: [
      `The response must apply ${lesson.focus} to at least three labelled details from the supplied central input.`,
      'Every conclusion must identify the exact row, card, requirement, or scenario sentence that supports it.',
      'The response must include one concrete revision or decision and explain the check that would show whether it worked.',
      grade >= 8
        ? 'The response must name one limitation or trade-off and explain why the available evidence does not settle it.'
        : 'The response must name one thing the supplied case does not tell you instead of guessing.',
    ],
    execution_method: {
      primary: 'Paper-first method: copy the short labels, annotate them, and complete the response in a notebook or any notes app. No download, installation, account, or internet access is needed.',
      local_optional: 'A locally available word processor, spreadsheet, drawing tool, or slide editor may be used, but no particular brand or paid feature is required.',
      check_path: 'Use the numbered specification and the package test/check criteria as a checklist; a parent or tutor can verify the cited labels without needing subject software.',
    },
    test_cases: [
      { input: 'the complete supplied central input', expected: 'three or more evidence-linked observations' },
      { input: 'the proposed revision or decision', expected: 'one stated check with an observable pass condition' },
      { input: 'the strongest competing interpretation', expected: 'one limitation, unknown, or trade-off stated without inventing facts' },
    ],
    debugging_target: {
      observed_failure: 'An unsupported answer names the lesson topic but cites no labelled detail and has no observable way to check the proposed change.',
      target: 'Replace unsupported claims with evidence-linked claims, then add one pass/fail check for the proposed revision or decision.',
      passing_change: 'A reader can trace every conclusion to a printed label in the central input and can perform the stated check without outside materials.',
    },
    equal_credit_alternative: {
      method: 'A handwritten, typed, spoken-to-a-scribe, or labelled-diagram response earns identical credit when it addresses the same specification.',
      steps: [
        'Label three facts from the central input.',
        `Explain how each fact connects to ${lesson.focus}.`,
        'State one revision or decision and its observable pass condition.',
        'Name one limitation or missing fact without searching for outside information.',
      ],
      evidence_to_submit: 'Three labelled evidence links, the revision or decision, the pass condition, and the limitation or missing fact.',
    },
  }
}

export function buildTechnologyActivitySetup({ lesson, taskType, grade }) {
  return CODE_OR_DEBUG.test(`${lesson.focus} ${lesson.title}`)
    ? codeFixture(lesson, grade)
    : artifactSetup(lesson, taskType, grade)
}

export const technologyActivityRequiresCode = (lesson) => CODE_OR_DEBUG.test(`${lesson.focus} ${lesson.title}`)
