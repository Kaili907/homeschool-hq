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

function buildProtectedCodeCase(lesson) {
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
      symptom: 'The supplied two-control case should report 1 missing label, but the unchanged program reports 0.',
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
      symptom: 'The supplied calls should finish at 5, but the unchanged program finishes at 3.',
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
      symptom: 'The all-negative test should return -2, but the unchanged program returns 0.',
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
      symptom: 'The supplied update sequence should finish at 4, but the unchanged program finishes at 2.',
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
      symptom: 'The supplied records should produce 6, but the unchanged program produces -6.',
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
    symptom: 'The main input should retain all three steps, but the unchanged program returns check > save.',
    target: 'Repair the initial index, explain the sequence invariant, and rerun all three tests.',
    passing: 'Iteration begins at index 0; all three tests retain every step in order.',
  }
}

/**
 * MODEL lessons are complete worked examples, so their fixtures must remain
 * instructional without becoming answer keys for protected work elsewhere in
 * the same course payload. These cases teach the same underlying ideas as the
 * protected families above, but deliberately change the program structure,
 * data, defect, repair, and expected output.
 */
function buildWorkedCodeCase(lesson) {
  const id = identifierFor(lesson.lesson_id)
  const focus = lesson.focus.toLowerCase()
  if (/html|semantic structure|layout|responsive|forms? and validation/.test(focus)) {
    return {
      starterCode: `const ${id}_images = [\n  { file: "map.png", alternateText: "" },\n  { file: "logo.png", alternateText: "School logo" }\n];\n\nfunction filesNeedingDescriptions(images) {\n  const missing = [];\n  for (const image of images) {\n    if (image.file.trim().length === 0) missing.push(image.file);\n  }\n  return missing;\n}\n\nconsole.log(filesNeedingDescriptions(${id}_images));`,
      inputs: ['map.png with an empty alternateText value', 'logo.png with alternateText "School logo"', '[]'],
      expectedSummary: 'The procedure must return the file names of images with missing alternate text; the supplied images must return map.png.',
      safetyCheck: 'The procedure must read alternateText without changing either image record, and an empty list must return an empty list.',
      tests: [
        { input: 'the two supplied image records', expected: '["map.png"]' },
        { input: '[]', expected: '[]' },
        { input: '[{ file: "icon.png", alternateText: "Menu" }]', expected: '[]' },
      ],
      observed: 'The condition inspects the file name, so an image with a missing description is not added to the result.',
      symptom: 'The supplied image records should return map.png, but the unchanged program returns an empty list.',
      target: 'Change the condition to inspect the description field, explain why a file name is not alternative text, and rerun all three tests.',
      passing: 'The loop tests image.alternateText before adding image.file; the three tests return ["map.png"], [], and [].',
    }
  }
  if (/object|class|encapsulation|inheritance|module|interface|state and data flow/.test(focus)) {
    return {
      starterCode: `class ${id}_Inventory {\n  constructor(stock) { this.stock = stock; }\n  remove(quantity) { this.stock = quantity; }\n}\n\nconst inventory = new ${id}_Inventory(12);\ninventory.remove(4);\nconsole.log(inventory.stock);`,
      inputs: ['starting stock 12', 'remove(4)', 'remove(0)'],
      expectedSummary: 'Removing 4 items from a stock of 12 must leave exactly 8 items.',
      safetyCheck: 'Removing 0 must preserve the stock, and each call may change only this inventory instance.',
      tests: [
        { input: 'start 12; remove(4)', expected: '8' },
        { input: 'start 9; remove(0)', expected: '9' },
        { input: 'start 7; remove(2); remove(1)', expected: '4' },
      ],
      observed: 'The method replaces the stock with the requested quantity, so removing 4 from 12 leaves 4 instead of 8.',
      symptom: 'Removing 4 from 12 should leave 8, but the unchanged program leaves 4.',
      target: 'Rewrite remove so it subtracts the requested quantity from stored stock, explain the state transition, and rerun all three tests.',
      passing: 'The remove method assigns this.stock - quantity back to this.stock; the tests return 8, 9, and 4.',
    }
  }
  if (/graph|traversal|search|sort|recursion|complexity|correctness|invariant|greedy|dynamic programming|heuristic/.test(focus)) {
    return {
      starterCode: `const ${id}_scores = [3, 8, 5];\n\nfunction totalScores(scores) {\n  let total = 1;\n  for (const score of scores) total += score;\n  return total;\n}\n\nconsole.log(totalScores(${id}_scores));`,
      inputs: ['[3, 8, 5]', '[]', '[-2, 2]'],
      expectedSummary: 'The procedure must return the sum of the supplied scores; the main input must return 16.',
      safetyCheck: 'The running-total invariant must be true before the first item, so an empty list must return the additive identity.',
      tests: [
        { input: '[3, 8, 5]', expected: '16' },
        { input: '[]', expected: '0' },
        { input: '[-2, 2]', expected: '0' },
      ],
      observed: 'The running total starts with an extra point, so every result is one too large and the empty-list test returns 1.',
      symptom: 'The supplied scores should total 16, but the unchanged program returns 17.',
      target: 'Choose the additive identity for the initial running total, state the invariant, and rerun all three tests.',
      passing: 'Starting total at 0 removes the extra point; the tests return 16, 0, and 0.',
    }
  }
  if (/concurr|race|thread|process|cache|profil|performance|memory model|resource limit|reliability|failure/.test(focus)) {
    return {
      starterCode: `const ${id}_jobs = [\n  { name: "A", seconds: 3 },\n  { name: "B", seconds: 2 },\n  { name: "C", seconds: 4 }\n];\n\nfunction elapsedTimes(jobs) {\n  const times = [];\n  for (const job of jobs) times.push(job.seconds);\n  return times;\n}\n\nconsole.log(elapsedTimes(${id}_jobs));`,
      inputs: ['jobs A:3, B:2, C:4', '[]', 'jobs D:5'],
      expectedSummary: 'The result must show cumulative elapsed time after each job; the supplied jobs must return [3, 5, 9].',
      safetyCheck: 'Each elapsed value must include all earlier jobs, while an empty queue must return an empty list.',
      tests: [
        { input: 'jobs A:3, B:2, C:4', expected: '[3, 5, 9]' },
        { input: '[]', expected: '[]' },
        { input: 'job D:5', expected: '[5]' },
      ],
      observed: 'The loop records each job duration by itself, so earlier work is discarded and the result is [3, 2, 4].',
      symptom: 'The supplied queue should return [3, 5, 9], but the unchanged program returns [3, 2, 4].',
      target: 'Introduce an elapsed accumulator, update it for each job, and record that accumulated value after every update.',
      passing: 'An elapsed variable starts at 0, adds each job.seconds, and is pushed after each addition; the tests return [3, 5, 9], [], and [5].',
    }
  }
  if (/query|schema|database|array|list\b|dictionar|stack|queue|record|data type|type conversion/.test(focus)) {
    return {
      starterCode: `const ${id}_readings = [12, 19, 7, 22];\n\nfunction countWarm(readings) {\n  let count = 0;\n  for (const reading of readings) count += reading;\n  return count;\n}\n\nconsole.log(countWarm(${id}_readings));`,
      inputs: ['[12, 19, 7, 22]', '[]', '[18, 17]'],
      expectedSummary: 'The procedure must count readings of at least 18; the supplied readings must return 2.',
      safetyCheck: 'Each qualifying record contributes exactly one to the count, and an empty list must return 0.',
      tests: [
        { input: '[12, 19, 7, 22]', expected: '2' },
        { input: '[]', expected: '0' },
        { input: '[18, 17]', expected: '1' },
      ],
      observed: 'The loop adds every reading value instead of counting only qualifying records, so it returns 60 instead of 2.',
      symptom: 'The supplied readings should produce a count of 2, but the unchanged program produces 60.',
      target: 'Add a threshold decision and increment the count by one only when a reading qualifies, then rerun all three tests.',
      passing: 'The loop uses if (reading >= 18) count += 1; the tests return 2, 0, and 1.',
    }
  }
  return {
    starterCode: `const ${id}_words = ["red", "green", "blue"];\n\nfunction reverseWords(words) {\n  const reversed = [];\n  for (let position = words.length - 1; position > 0; position -= 1) {\n    reversed.push(words[position]);\n  }\n  return reversed.join(" / ");\n}\n\nconsole.log(reverseWords(${id}_words));`,
    inputs: ['["red", "green", "blue"]', '[]', '["solo"]'],
    expectedSummary: 'The procedure must return every word in reverse order; the main input must return blue / green / red.',
    safetyCheck: 'An empty list must return an empty string, and a one-word list must retain its word.',
    tests: [
      { input: '["red", "green", "blue"]', expected: 'blue / green / red' },
      { input: '[]', expected: 'empty string' },
      { input: '["solo"]', expected: 'solo' },
    ],
    observed: 'The loop stops while position is still 0, so the first word is omitted and the main input returns blue / green.',
    symptom: 'The main input should retain all three words in reverse order, but the unchanged program omits red.',
    target: 'Repair the loop boundary so position 0 is processed, explain the inclusive lower bound, and rerun all three tests.',
    passing: 'The loop continues while position >= 0; all three tests retain every word in reverse order.',
  }
}

const PRE_ATTEMPT_SUPPORT_BY_MODE = Object.freeze({
  PROBE: 'Before editing, record the unchanged output and identify which stated rule is first contradicted. Do not look for or request a finished repair.',
  GUIDED: 'Trace the value that controls the failing behavior and mark the first step where actual and expected state diverge. Use that location to propose your own smallest edit.',
  GUIDED_B: 'Trace the value that controls the failing behavior and mark the first step where actual and expected state diverge. Use that location to propose your own smallest edit.',
  BUILD: 'Use the three tests to isolate one defect region, then choose and justify the smallest edit that satisfies the specification without weakening a boundary test.',
  CORRECT: 'Preserve the original run and repair attempt in the defect log. Compare the earliest divergent state with the specification before proposing a revised repair.',
  DEMONSTRATE: 'Run and record the unchanged program, then diagnose and repair it independently from the specification and tests. No solution or worked repair is included in learner material.',
})

function codeFixture(lesson, grade, mode) {
  const isInstructionalModel = mode === 'MODEL'
  const codeCase = isInstructionalModel
    ? buildWorkedCodeCase(lesson)
    : buildProtectedCodeCase(lesson)
  const preAttemptSupport = PRE_ATTEMPT_SUPPORT_BY_MODE[mode]
  if (!isInstructionalModel && !preAttemptSupport) {
    throw new Error(`${lesson.lesson_id}: CODE_OR_DEBUG activity has no attempt-safe support policy for ${mode}`)
  }

  const activitySetup = {
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
      observed_failure: isInstructionalModel ? codeCase.observed : codeCase.symptom,
      target: isInstructionalModel
        ? codeCase.target
        : 'Use the specification, unchanged run, and test table to locate the first divergent state or control-flow decision; explain the evidence before choosing an edit.',
      ...(isInstructionalModel
        ? {
            passing_change: codeCase.passing,
            solution_status: 'INSTRUCTIONAL_WORKED_EXAMPLE',
          }
        : {
            pre_attempt_support: preAttemptSupport,
            solution_status: 'WITHHELD_UNTIL_PROTECTED_EVIDENCE',
          }),
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

  return {
    activitySetup,
    trustedSolutionReference: {
      authority: 'ADULT_TRUSTED_AUTHORITY',
      learner_visibility: isInstructionalModel
        ? 'ALSO_SHOWN_AS_NON_PENALTY_INSTRUCTIONAL_EXAMPLE'
        : 'NEVER_BEFORE_PROTECTED_EVIDENCE',
      review_timing: isInstructionalModel
        ? 'DURING_INSTRUCTIONAL_MODEL'
        : 'AFTER_PROTECTED_EVIDENCE_OR_ADULT_REVIEW_ONLY',
      exact_repair: codeCase.passing,
      validation_tests: codeCase.tests,
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

export function buildTechnologyActivityMaterials({ lesson, taskType, grade, mode }) {
  return CODE_OR_DEBUG.test(`${lesson.focus} ${lesson.title}`)
    ? codeFixture(lesson, grade, mode)
    : { activitySetup: artifactSetup(lesson, taskType, grade), trustedSolutionReference: null }
}

export const technologyActivityRequiresCode = (lesson) => CODE_OR_DEBUG.test(`${lesson.focus} ${lesson.title}`)
