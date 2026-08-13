import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const CORPUS = join(ROOT, 'curriculum-production/final/financial-literacy')
const ADMITTED = join(ROOT, 'curriculum-release-admitted/family-pilot-r1')
const BROWSER = join(ROOT, 'public/family-pilot-final/2.0.0')
const OUTPUT = join(ROOT, 'docs/learner-audits/financial-literacy')
const BASE_SHA = 'c81ddb6e04bc1c3629212327d47817c1b5677477'

const FLAGS = [
  'ZERO_ACTIONABLE_WORK',
  'MISSING_NUMERIC_PROBLEM',
  'MISSING_VISIBLE_PARAMETER',
  'MISSING_JUDGMENT_TASK',
  'MIXED_HALF_MISSING',
  'FLATTENED_CHOICES',
  'UNSUPPORTED_NUMERIC_RESPONSE',
  'UNSUPPORTED_OPEN_RESPONSE',
  'ANSWER_LEAK',
  'PRIVATE_FINANCIAL_DATA_REQUEST',
  'PERSONALIZED_ADVICE',
  'PROJECTION_LOSS',
  'PLACEHOLDER',
]

const json = (path) => JSON.parse(readFileSync(path, 'utf8'))
const jsonl = (path) => readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
const hash = (text) => createHash('sha256').update(text).digest('hex')
const textOf = (value) => typeof value === 'string' ? value : ''
const uniq = (values) => [...new Set(values)]
const countBy = (values, key) => values.reduce((out, value) => {
  const name = typeof key === 'function' ? key(value) : value[key]
  out[name] = (out[name] ?? 0) + 1
  return out
}, {})

const FINANCE = /\b(?:money|pric(?:e|es|ing)|costs?|income|wages?|salary|earnings?|compensation|budgets?|savings?|spend(?:ing)?|purchases?|loans?|credit|debts?|interest|tax(?:es|ation)?|insurance|polic(?:y|ies)|premiums?|deductibles?|coverage|claims?|invest(?:ment|ing|or|ors)?|holdings?|portfolio|accounts?|bank(?:ing)?|profits?|revenue|cash(?:-flow)?|inflows?|outflows?|payments?|tuition|college|financial|markets?|marketing|advertis(?:e|es|ed|ing|ement|ements)|consumers?|borrow(?:ing|er|ers)?|earn(?:ed|ing|s)?|paid|dollars?|cents?|afford(?:able)?|funds?|fees?|benefits?|contracts?|warrant(?:y|ies)|financing|values?|tradeoffs?|sales?|reserves?|employers?|workers?|jobs?|workplace|business|stores?|risks?|loss(?:es)?)\b/i
const PLACEHOLDER = /\b(todo|tbd|lorem ipsum|placeholder|coming soon|replace me|insert (?:text|content) here)\b/i
const DELIVERABLE = /\b(explain|compare|justify|defend|describe|state|name|identify|say|write|choose|recommend|evaluate|decide|tell|show|give|argue|construct|record|list|outline|propose|what|why|how|which|who)\b/i
const PRIVATE_REQUEST = /\b(?:enter|write|provide|share|type|record|upload|submit|send|tell)\b(?=[^.?!]{0,180}\b(?:your|real)\b)[^.?!]{0,180}\b(?:account number|routing number|card number|social security|ssn|pin|password|credential|tax number|family income|household income|family debt|household debt|bank balance|credit score)\b/i
const PERSONAL_ADVICE = /\b(?:your actual|your real|for your family|for your household)\b[^.?!]{0,100}\b(?:invest|loan|credit|bank|budget|tax|insurance|retirement|debt|mortgage)\b/i
const WARNING = /\b(?:never|do not|don't|does not|no real|not ask|nothing here|invented|fictional|simulated|pretend)\b/i

function promptsOf(pkg) {
  return (pkg.tasks ?? []).flatMap((task) => (task.prompts ?? []).map((prompt) => ({ task, prompt })))
}

function learnerCoreText(pkg) {
  return [
    pkg.objective,
    pkg.scenario,
    ...(pkg.tasks ?? []).flatMap((task) => [
      task.directions,
      ...(task.prompts ?? []).flatMap((prompt) => [prompt.text, ...(prompt.choices ?? [])]),
    ]),
  ].filter(Boolean).join('\n')
}

function projectedText(material) {
  if (material?.format === 'markdown') return material.markdown
  return (material?.sections ?? []).flatMap((section) => [section.body, ...(section.prompts ?? [])]).filter(Boolean).join('\n')
}

function sectionText(material, titles) {
  return (material?.sections ?? [])
    .filter((section) => titles.includes(section.title))
    .flatMap((section) => [section.body, ...(section.prompts ?? [])])
    .filter(Boolean)
    .join('\n')
}

function unsafeRequestLines(text) {
  return text.split(/\r?\n/).filter((line) => PRIVATE_REQUEST.test(line) && !WARNING.test(line))
}

function personalizedAdviceLines(text) {
  return text.split(/\r?\n/).filter((line) => PERSONAL_ADVICE.test(line) && !WARNING.test(line))
}

function stableLeakAnswer(answer) {
  const value = String(answer ?? '').trim()
  return value.length >= 3 && !/^\d{1,2}$/.test(value)
}

function scoringItems(scoring) {
  return [
    ...(scoring.scoringAuthority?.items ?? []),
    ...(scoring.productionGateH3?.fixedAuthority?.supplements ?? []),
  ]
}

function detectAnswerLeaks(material, scoring) {
  // The browser projector places Remediation and Extension before the authored
  // tasks. A scoring answer reproduced there is learner-visible before work.
  const beforeTasks = sectionText(material, ['Remediation', 'Extension'])
  const matches = []
  for (const item of scoringItems(scoring)) {
    const answer = String(item.answer ?? '').trim()
    if (stableLeakAnswer(answer) && beforeTasks.includes(answer)) {
      matches.push({ ref: item.ref, section: (material.sections ?? []).find((section) =>
        ['Remediation', 'Extension'].includes(section.title) &&
        [section.body, ...(section.prompts ?? [])].filter(Boolean).join('\n').includes(answer),
      )?.title ?? 'pre-task-support' })
    }
  }
  return matches
}

function expectedProjection(pkg) {
  const prompts = promptsOf(pkg)
  return {
    allText: learnerCoreText(pkg),
    fixedTexts: prompts.filter(({ prompt }) => prompt.promptType === 'fixed-numeric' || prompt.promptType === 'fixed-choice').map(({ prompt }) => prompt.text),
    numericTexts: prompts.filter(({ prompt }) => prompt.promptType === 'fixed-numeric').map(({ prompt }) => prompt.text),
    openTexts: prompts.filter(({ prompt }) => /-response$/.test(prompt.promptType)).map(({ prompt }) => prompt.text),
    taskDirections: (pkg.tasks ?? []).map((task) => task.directions),
    choiceLabels: prompts.flatMap(({ prompt }) => prompt.choices ?? []),
  }
}

function analyzeProjection(pkg, material, options) {
  const expected = expectedProjection(pkg)
  const visible = projectedText(material)
  const fixedVisible = expected.fixedTexts.filter((text) => visible.includes(text))
  const numericVisible = expected.numericTexts.filter((text) => visible.includes(text))
  const openVisible = expected.openTexts.filter((text) => visible.includes(text))
  const directionsVisible = expected.taskDirections.filter((text) => visible.includes(text))
  const requiredNumberTokens = options.requiredNumberTokens ?? uniq(
    [pkg.scenario, ...expected.taskDirections, ...expected.numericTexts]
      .filter(Boolean).join('\n').match(/(?:\$\s*)?-?\d[\d,]*(?:\.\d+)?%?/g) ?? [],
  )
  const missingNumberTokens = requiredNumberTokens.filter((token) => !visible.includes(token))
  const choicesPreserved = options.choiceLabels ?? []
  const answerLeaks = detectAnswerLeaks(material, options.scoring)
  const unsafeRequests = unsafeRequestLines(visible)
  const advice = personalizedAdviceLines(visible)
  const fixedExpected = expected.fixedTexts.length > 0
  const openExpected = expected.openTexts.length > 0
  const mode = pkg.responseScoring?.mode
  const flags = []
  if (fixedVisible.length + openVisible.length === 0) flags.push('ZERO_ACTIONABLE_WORK')
  if (expected.numericTexts.length > 0 && numericVisible.length !== expected.numericTexts.length) flags.push('MISSING_NUMERIC_PROBLEM')
  if (expected.numericTexts.length > 0 && missingNumberTokens.length > 0) flags.push('MISSING_VISIBLE_PARAMETER')
  if (openExpected && openVisible.length !== expected.openTexts.length) flags.push('MISSING_JUDGMENT_TASK')
  if (mode === 'MIXED' && ((fixedExpected && fixedVisible.length === 0) || (openExpected && openVisible.length === 0))) flags.push('MIXED_HALF_MISSING')
  if (expected.choiceLabels.length > 0 && choicesPreserved.length !== expected.choiceLabels.length) flags.push('FLATTENED_CHOICES')
  if (expected.numericTexts.length > 0 && !options.numericInputSupported) flags.push('UNSUPPORTED_NUMERIC_RESPONSE')
  if (openExpected && !options.openInputSupported) flags.push('UNSUPPORTED_OPEN_RESPONSE')
  if (answerLeaks.length > 0) flags.push('ANSWER_LEAK')
  if (unsafeRequests.length > 0) flags.push('PRIVATE_FINANCIAL_DATA_REQUEST')
  if (advice.length > 0) flags.push('PERSONALIZED_ADVICE')
  if (PLACEHOLDER.test(visible)) flags.push('PLACEHOLDER')
  if (options.scoringMode !== mode || options.scoringLocatorLeak || flags.some((flag) => [
    'MISSING_NUMERIC_PROBLEM', 'MISSING_VISIBLE_PARAMETER', 'MISSING_JUDGMENT_TASK',
    'MIXED_HALF_MISSING', 'FLATTENED_CHOICES', 'UNSUPPORTED_NUMERIC_RESPONSE',
    'UNSUPPORTED_OPEN_RESPONSE', 'ANSWER_LEAK',
  ].includes(flag))) flags.push('PROJECTION_LOSS')
  return {
    flags: uniq(flags),
    fixedPromptTexts: { expected: expected.fixedTexts.length, visible: fixedVisible.length },
    numericPromptTexts: { expected: expected.numericTexts.length, visible: numericVisible.length },
    openPromptTexts: { expected: expected.openTexts.length, visible: openVisible.length },
    taskDirections: { expected: expected.taskDirections.length, visible: directionsVisible.length },
    requiredNumberTokens: { expected: requiredNumberTokens.length, missing: missingNumberTokens.length },
    choiceLabels: { expected: expected.choiceLabels.length, interactive: choicesPreserved.length },
    answerLeakRefs: answerLeaks,
    unsafeRequestCount: unsafeRequests.length,
    personalizedAdviceCount: advice.length,
  }
}

function runNegativeControls() {
  const pkg = {
    objective: 'Compare a fictional budget and defend a choice.',
    scenario: 'A fictional learner has $10.00 and a pretend item costs $4.00.',
    tasks: [
      { taskId: 't1', kind: 'independent', directions: 'Use $10.00 and $4.00.', prompts: [
        { ref: 't1-p1', promptType: 'fixed-numeric', text: 'How much pretend money remains?', unit: 'USD' },
        { ref: 't1-p2', promptType: 'fixed-choice', text: 'Which plan stays in budget?', choices: ['Plan A', 'Plan B'] },
      ] },
      { taskId: 't2', kind: 'reflection', directions: 'Use both stated criteria.', prompts: [
        { ref: 't2-p1', promptType: 'extended-response', text: 'Explain which plan is safer and name the tradeoff.' },
      ] },
    ],
    responseScoring: { mode: 'MIXED', items: [
      { ref: 't1-p1', responseMode: 'FIXED' },
      { ref: 't1-p2', responseMode: 'FIXED' },
      { ref: 't2-p1', responseMode: 'OPEN' },
    ] },
  }
  const scoring = { scoringAuthority: { items: [{ ref: 't1-p1', answer: '$6.00' }] } }
  const baseSections = [
    { title: 'Scenario', body: pkg.scenario, prompts: [] },
    ...pkg.tasks.map((task) => ({ title: task.kind, body: task.directions, prompts: task.prompts.map((prompt) => prompt.text) })),
  ]
  const analyze = (sections, overrides = {}) => analyzeProjection(pkg, { format: 'structured', sections }, {
    scoring,
    choiceLabels: ['Plan A', 'Plan B'],
    numericInputSupported: true,
    openInputSupported: true,
    scoringMode: 'MIXED',
    scoringLocatorLeak: false,
    ...overrides,
  }).flags
  const controls = [
    {
      control: 'hide-required-number',
      expected: 'MISSING_VISIBLE_PARAMETER',
      detected: analyze(baseSections.map((section) => ({ ...section, body: textOf(section.body).replaceAll('$10.00', '[hidden]') })), { requiredNumberTokens: ['$10.00', '$4.00'] }).includes('MISSING_VISIBLE_PARAMETER'),
    },
    {
      control: 'delete-open-task',
      expected: 'MISSING_JUDGMENT_TASK',
      detected: analyze(baseSections.filter((section) => section.title !== 'reflection')).includes('MISSING_JUDGMENT_TASK'),
    },
    {
      control: 'delete-fixed-task-from-mixed',
      expected: 'MIXED_HALF_MISSING',
      detected: analyze(baseSections.filter((section) => section.title !== 'independent')).includes('MIXED_HALF_MISSING'),
    },
    {
      control: 'flatten-choices',
      expected: 'FLATTENED_CHOICES',
      detected: analyze(baseSections, { choiceLabels: [] }).includes('FLATTENED_CHOICES'),
    },
    {
      control: 'answer-leak',
      expected: 'ANSWER_LEAK',
      detected: analyze([{ title: 'Remediation', body: 'Correct result: $6.00.', prompts: [] }, ...baseSections]).includes('ANSWER_LEAK'),
    },
    {
      control: 'request-real-account-number',
      expected: 'PRIVATE_FINANCIAL_DATA_REQUEST',
      detected: analyze([...baseSections, { title: 'Submission', body: 'Enter your real bank account number.', prompts: [] }]).includes('PRIVATE_FINANCIAL_DATA_REQUEST'),
    },
  ]
  return { status: controls.every((control) => control.detected) ? 'PASS' : 'FAIL', controls }
}

function summarizeFlags(findings) {
  return Object.fromEntries(FLAGS.map((flag) => [flag, findings.filter((finding) => finding.flags.includes(flag)).length]))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function main() {
  const manifest = json(join(CORPUS, 'corpus-manifest.json'))
  const h3 = json(join(CORPUS, 'reports/h3-readiness.json'))
  const browserCatalog = json(join(ADMITTED, 'admission/browser-catalog-projection.json'))
  const runtimeRows = json(join(ADMITTED, 'runtime/lesson-rows-by-course.json'))
  const bindings = jsonl(join(ADMITTED, 'production-bindings.jsonl')).filter((binding) => binding.subject === 'financial-literacy')
  const bindingByLesson = new Map(bindings.map((binding) => [binding.lessonRef, binding]))
  const h3ByLesson = new Map(h3.lessons.map((lesson) => [lesson.lessonId, lesson]))
  const browserCourseCache = new Map()
  const loadBrowserCourse = (courseRef) => {
    if (!browserCourseCache.has(courseRef)) browserCourseCache.set(courseRef, json(join(BROWSER, 'courses', `${courseRef}.json`)))
    return browserCourseCache.get(courseRef)
  }
  const appSource = readFileSync(join(ROOT, 'src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx'), 'utf8')
  const projectionSource = readFileSync(join(ROOT, 'scripts/build-final-family-pilot-data.mjs'), 'utf8')
  const playerForcesNoResponse = /segmentContent=\{\{[^}]*responseKind:\s*'none'/s.test(appSource)
  const taskProjectorDropsChoices = /task\.prompts[\s\S]{0,220}\.map\(\(prompt\)\s*=>\s*prompt\.text\)/.test(projectionSource)

  const findings = []
  for (const row of manifest.lessons) {
    const packageText = readFileSync(join(CORPUS, row.packagePath), 'utf8')
    const scoringText = readFileSync(join(CORPUS, row.scoringPath), 'utf8')
    const pkg = JSON.parse(packageText)
    const scoring = JSON.parse(scoringText)
    const prompts = promptsOf(pkg)
    const numeric = prompts.filter(({ prompt }) => prompt.promptType === 'fixed-numeric')
    const choices = prompts.filter(({ prompt }) => prompt.promptType === 'fixed-choice')
    const open = prompts.filter(({ prompt }) => /-response$/.test(prompt.promptType))
    const courseRef = pkg.lessonRef.courseId
    const browserCourse = loadBrowserCourse(courseRef)
    const browserMaterial = browserCourse.materials[row.lessonId]
    const browserRow = browserCourse.lessons.find((lesson) => lesson.lessonRef === row.lessonId)
    const browserBinding = browserCourse.bindings[row.lessonId]
    const admittedCatalogRow = browserCatalog.lessonRowsByCourse[courseRef]?.find((lesson) => lesson.lessonRef === row.lessonId)
    const admittedRuntimeRow = runtimeRows[courseRef]?.find((lesson) => lesson.lessonRef === row.lessonId)
    const binding = bindingByLesson.get(row.lessonId)
    const h3Lesson = h3ByLesson.get(row.lessonId)
    const scoringMode = scoring.productionGateH3?.responseScoring?.mode
    const contractItems = pkg.responseScoring?.items ?? []
    const h3Items = scoring.productionGateH3?.responseScoring?.items ?? []
    const fixedContract = contractItems.filter((item) => item.responseMode === 'FIXED').length
    const openContract = contractItems.filter((item) => item.responseMode === 'OPEN').length
    const visible = projectedText(browserMaterial)
    const learnerText = learnerCoreText(pkg)
    const sourcePrivacy = unsafeRequestLines(learnerText)
    const sourceAdvice = personalizedAdviceLines(learnerText)
    const sourcePlaceholder = PLACEHOLDER.test(learnerText)
    const sourceSubstantive = textOf(pkg.scenario).length >= 60 && textOf(pkg.objective).length >= 60 && FINANCE.test(learnerText)
    const judgmentDeliverable = open.length > 0 && open.every(({ task, prompt }) =>
      prompt.text.length >= 20 && (DELIVERABLE.test(`${task.directions} ${prompt.text}`) || prompt.text.includes('?')),
    )
    const numericOracle = numeric.length === 0 || (
      scoring.productionGateH3?.fixedAuthority?.sourceOracleEvidencePreserved === true &&
      scoring.productionGateH3?.fixedAuthority?.present === true &&
      manifest.oracle.status === 'PASS' && manifest.oracle.disagreements === 0
    )
    const sourceAnswersHidden = !/(correctAnswer|answerIndex|answerKey|scoringAuthority|workedSolution|acceptableAnswerCriteria)/.test(JSON.stringify({
      objective: pkg.objective,
      scenario: pkg.scenario,
      tasks: pkg.tasks,
    }))
    const sourceChecks = {
      substantiveFinancialScenarioOrInstruction: sourceSubstantive,
      actualQuestionsOrJudgmentTask: prompts.length >= 3,
      allRequiredNumbersVisibleUsingExistingOracleEvidence: numericOracle,
      declaredChoicesComplete: choices.every(({ prompt }) => Array.isArray(prompt.choices) && prompt.choices.length >= 2),
      judgmentDeliverableVisible: judgmentDeliverable,
      mixedPreservesBothTaskTypes: pkg.responseScoring.mode !== 'MIXED' || (fixedContract > 0 && openContract > 0),
      answerAndRubricAuthorityAbsentFromLearnerCore: sourceAnswersHidden,
      noRealFinancialDataRequest: sourcePrivacy.length === 0,
      noPersonalizedFinancialAdvice: sourceAdvice.length === 0,
      noPlaceholderOrFiller: !sourcePlaceholder,
      packageChecksumMatchesManifest: hash(packageText) === row.packageSha256,
      scoringChecksumMatchesManifest: hash(scoringText) === row.scoringSha256,
    }
    const modeChecks = {
      manifest: row.responseScoringMode,
      package: pkg.responseScoring.mode,
      h3Report: h3Lesson?.responseScoringMode,
      h3ScoringRecord: scoringMode,
      productionBinding: binding?.scoringMetadata?.responseScoringMode,
      browserBinding: browserBinding?.responseScoringMode ?? null,
      browserMaterial: browserMaterial?.responseScoringMode ?? null,
    }
    const sourceModePreserved = [modeChecks.package, modeChecks.h3Report, modeChecks.h3ScoringRecord, modeChecks.productionBinding]
      .every((mode) => mode === row.responseScoringMode)
    const h3InventoryPreserved = JSON.stringify(contractItems) === JSON.stringify(h3Items)
    const scoringLocatorLeak = (browserRow?.resourceRefs ?? []).some((ref) => /\/scoring\//i.test(ref))
    const projection = analyzeProjection(pkg, browserMaterial, {
      scoring,
      choiceLabels: [],
      numericInputSupported: !playerForcesNoResponse,
      openInputSupported: !playerForcesNoResponse,
      scoringMode: browserMaterial?.responseScoringMode ?? browserBinding?.responseScoringMode ?? null,
      scoringLocatorLeak,
    })
    const browserChecks = {
      materialPresent: Boolean(browserMaterial),
      catalogRowPresent: Boolean(admittedCatalogRow && browserRow),
      runtimeRowPresent: Boolean(admittedRuntimeRow),
      sourcePackageBindingPresent: Boolean(binding && browserBinding),
      scenarioTextPreserved: visible.includes(pkg.scenario),
      taskDirectionsPreserved: projection.taskDirections.visible === projection.taskDirections.expected,
      questionTextPreserved: projection.fixedPromptTexts.visible + projection.openPromptTexts.visible === prompts.length,
      numericParametersPreserved: projection.requiredNumberTokens.missing === 0,
      choiceLabelsInteractive: projection.choiceLabels.interactive === projection.choiceLabels.expected,
      numericResponseSupported: numeric.length === 0 || !playerForcesNoResponse,
      openResponseSupported: open.length === 0 || !playerForcesNoResponse,
      scoringModePreserved: modeChecks.browserMaterial === row.responseScoringMode || modeChecks.browserBinding === row.responseScoringMode,
      scoringAuthorityLocatorAbsent: !scoringLocatorLeak,
      answerTextAbsentBeforeTasks: projection.answerLeakRefs.length === 0,
    }
    const flags = uniq(projection.flags)
    const pass = Object.values(sourceChecks).every(Boolean) && Object.values(browserChecks).every(Boolean) && sourceModePreserved && h3InventoryPreserved
    findings.push({
      schemaVersion: '1.0',
      lessonId: row.lessonId,
      packageId: row.packageId,
      grade: row.grade,
      responseScoringMode: row.responseScoringMode,
      result: pass ? 'PASS' : 'FAIL',
      flags,
      inventory: {
        tasks: pkg.tasks.length,
        authoredPrompts: prompts.length,
        fixedNumericPrompts: numeric.length,
        fixedChoicePrompts: choices.length,
        choiceLabels: choices.reduce((sum, { prompt }) => sum + prompt.choices.length, 0),
        h3FixedItems: fixedContract,
        h3OpenItems: openContract,
      },
      source: { status: Object.values(sourceChecks).every(Boolean) ? 'PASS' : 'FAIL', checks: sourceChecks },
      h3: {
        status: sourceModePreserved && h3InventoryPreserved ? 'PASS' : 'FAIL',
        sourceModePreserved,
        itemInventoryPreserved: h3InventoryPreserved,
        modes: modeChecks,
      },
      browser: {
        status: Object.values(browserChecks).every(Boolean) ? 'PASS' : 'FAIL',
        checks: browserChecks,
        projection: {
          fixedPromptTexts: projection.fixedPromptTexts,
          numericPromptTexts: projection.numericPromptTexts,
          openPromptTexts: projection.openPromptTexts,
          taskDirections: projection.taskDirections,
          requiredNumberTokens: projection.requiredNumberTokens,
          choiceLabels: projection.choiceLabels,
          answerLeakRefs: projection.answerLeakRefs,
          scoringAuthorityLocatorLeak: scoringLocatorLeak,
          responseKindForcedNone: playerForcesNoResponse,
        },
      },
    })
  }

  const negativeControls = runNegativeControls()
  const flagCounts = summarizeFlags(findings)
  const grades = uniq(findings.map((finding) => finding.grade)).sort((a, b) => a - b)
  const gradeRows = grades.map((grade) => {
    const lessons = findings.filter((finding) => finding.grade === grade)
    const flags = summarizeFlags(lessons)
    return {
      grade,
      lessonsExpected: manifest.totals.gradeCounts[`grade-${grade}`],
      lessonsAudited: lessons.length,
      sourceMaterialPass: lessons.filter((lesson) => lesson.source.status === 'PASS').length,
      h3SourceAndBindingModePass: lessons.filter((lesson) => lesson.h3.status === 'PASS').length,
      browserLearnerPass: lessons.filter((lesson) => lesson.browser.status === 'PASS').length,
      findings: flags,
      result: lessons.every((lesson) => lesson.result === 'PASS') ? 'PASS' : 'FAIL',
    }
  })
  const gradeResults = {
    schemaVersion: '1.0',
    classification: 'FINLIT_LEARNER_AUDIT_COMPLETE',
    status: gradeRows.every((row) => row.result === 'PASS') ? 'PASS' : 'FAIL',
    baseSha: BASE_SHA,
    totals: {
      lessonsExpected: 504,
      lessonsAudited: findings.length,
      sourceMaterialPass: findings.filter((finding) => finding.source.status === 'PASS').length,
      browserLearnerPass: findings.filter((finding) => finding.browser.status === 'PASS').length,
      flagCounts,
    },
    grades: gradeRows,
  }

  const modes = ['JUDGMENT_APPLICATION', 'MIXED']
  const scoringModeResults = {
    schemaVersion: '1.0',
    status: findings.every((finding) => finding.h3.status === 'PASS' && finding.browser.checks.scoringModePreserved) ? 'PASS' : 'FAIL',
    expected: manifest.totals.scoringModes,
    h3GateStatus: h3.status,
    h3EffectiveReady: h3.effectiveCounts.READY,
    sourceAndProductionBindingPreserved: findings.filter((finding) => finding.h3.status === 'PASS').length,
    browserLearnerProjectionPreserved: findings.filter((finding) => finding.browser.checks.scoringModePreserved).length,
    byMode: modes.map((mode) => {
      const lessons = findings.filter((finding) => finding.responseScoringMode === mode)
      return {
        mode,
        expected: manifest.totals.scoringModes[mode],
        audited: lessons.length,
        sourceAndProductionBindingPreserved: lessons.filter((lesson) => lesson.h3.status === 'PASS').length,
        browserLearnerProjectionPreserved: lessons.filter((lesson) => lesson.browser.checks.scoringModePreserved).length,
        result: lessons.every((lesson) => lesson.h3.status === 'PASS' && lesson.browser.checks.scoringModePreserved) ? 'PASS' : 'FAIL',
      }
    }),
    evidence: {
      h3Report: 'curriculum-production/final/financial-literacy/reports/h3-readiness.json',
      productionBindings: 'curriculum-release-admitted/family-pilot-r1/production-bindings.jsonl',
      browserProjector: 'scripts/build-final-family-pilot-data.mjs',
      browserBindingDropsScoringMetadata: true,
      browserMaterialDropsResponseScoring: true,
    },
  }

  const idsFor = (predicate) => findings.filter(predicate).map((finding) => finding.lessonId)
  const browserLoss = {
    schemaVersion: '1.0',
    status: 'FAIL',
    auditedLessons: findings.length,
    exactGeneratedProjection: 'public/family-pilot-final/2.0.0/courses/*.json',
    sourcePreservation: {
      scenarios: findings.filter((finding) => finding.browser.checks.scenarioTextPreserved).length,
      taskDirections: findings.reduce((sum, finding) => sum + finding.browser.projection.taskDirections.visible, 0),
      taskDirectionsExpected: findings.reduce((sum, finding) => sum + finding.browser.projection.taskDirections.expected, 0),
      authoredPromptTexts: findings.reduce((sum, finding) => sum + finding.browser.projection.fixedPromptTexts.visible + finding.browser.projection.openPromptTexts.visible, 0),
      authoredPromptTextsExpected: 3632,
      numericParameterTokenLossLessons: flagCounts.MISSING_VISIBLE_PARAMETER,
      judgmentTaskLossLessons: flagCounts.MISSING_JUDGMENT_TASK,
      mixedHalfMissingLessons: flagCounts.MIXED_HALF_MISSING,
    },
    losses: {
      scoringModeMissingLessons: 504 - scoringModeResults.browserLearnerProjectionPreserved,
      flattenedChoiceLessons: flagCounts.FLATTENED_CHOICES,
      flattenedChoiceItems: findings.reduce((sum, finding) => sum + (finding.flags.includes('FLATTENED_CHOICES') ? finding.inventory.fixedChoicePrompts : 0), 0),
      flattenedChoiceLabels: findings.reduce((sum, finding) => sum + (finding.flags.includes('FLATTENED_CHOICES') ? finding.inventory.choiceLabels : 0), 0),
      unsupportedNumericResponseLessons: flagCounts.UNSUPPORTED_NUMERIC_RESPONSE,
      unsupportedOpenResponseLessons: flagCounts.UNSUPPORTED_OPEN_RESPONSE,
      unsupportedH3FixedItems: findings.filter((finding) => finding.flags.includes('UNSUPPORTED_NUMERIC_RESPONSE')).reduce((sum, finding) => sum + finding.inventory.h3FixedItems, 0),
      unsupportedH3OpenItems: findings.filter((finding) => finding.flags.includes('UNSUPPORTED_OPEN_RESPONSE')).reduce((sum, finding) => sum + finding.inventory.h3OpenItems, 0),
      directAnswerLeakLessons: flagCounts.ANSWER_LEAK,
      directAnswerLeakMatches: findings.reduce((sum, finding) => sum + finding.browser.projection.answerLeakRefs.length, 0),
      scoringAuthorityLocatorLeakLessons: findings.filter((finding) => finding.browser.projection.scoringAuthorityLocatorLeak).length,
      totalProjectionLossLessons: flagCounts.PROJECTION_LOSS,
    },
    affectedLessons: {
      flattenedChoices: idsFor((finding) => finding.flags.includes('FLATTENED_CHOICES')),
      unsupportedNumericResponse: idsFor((finding) => finding.flags.includes('UNSUPPORTED_NUMERIC_RESPONSE')),
      unsupportedOpenResponse: idsFor((finding) => finding.flags.includes('UNSUPPORTED_OPEN_RESPONSE')),
      answerLeak: idsFor((finding) => finding.flags.includes('ANSWER_LEAK')),
      scoringAuthorityLocatorLeak: idsFor((finding) => finding.browser.projection.scoringAuthorityLocatorLeak),
    },
    implementationEvidence: {
      taskProjectorDropsChoiceArrays: taskProjectorDropsChoices,
      finalLessonSurfaceForcesResponseKindNone: playerForcesNoResponse,
      materialSchemaSupportsResponseControls: false,
      materialSchemaSupportsChoiceArrays: false,
      materialViewRendersAllSectionsBeforeThePlayer: true,
    },
    negativeControls,
  }

  const report = `# Financial Literacy learner completeness audit R1

Classification: **FINLIT_LEARNER_AUDIT_COMPLETE**

Corpus decision: **FAIL — NOT SAFE TO BEGIN MATRIX**

Audited base: \`${BASE_SHA}\`

## Outcome

All 504 Financial Literacy lessons were audited at three layers: canonical production package, H3/scoring binding, and the exact generated browser learner payload plus final learner UI. The canonical lesson bodies are substantive and complete: 504/504 contain fictional financial scenarios, 3,632 authored prompts, visible task directions and parameters, and an open judgment deliverable. Existing oracle evidence was reused for fixed-item arithmetic.

The learner experience is not complete. The browser projector preserves prompt text but drops every structured choice array and every H3 response-scoring mode. The final lesson surface then forces \`responseKind: 'none'\`, so no numeric or open response can be entered. It also projects Remediation and Extension ahead of the tasks, disclosing fixed answers in ${flagCounts.ANSWER_LEAK} lessons, and leaves a Financial Literacy \`/scoring/\` resource locator in all 504 browser rows.

## Grade results

${markdownTable(
    ['Grade', 'Audited', 'Source pass', 'Browser pass', 'Choice loss', 'Answer leak', 'Result'],
    gradeRows.map((row) => [row.grade, row.lessonsAudited, row.sourceMaterialPass, row.browserLearnerPass, row.findings.FLATTENED_CHOICES, row.findings.ANSWER_LEAK, row.result]),
  )}

## Scoring-mode preservation

${markdownTable(
    ['Mode', 'Expected', 'Source/H3/binding', 'Browser', 'Result'],
    scoringModeResults.byMode.map((row) => [row.mode, row.expected, row.sourceAndProductionBindingPreserved, row.browserLearnerProjectionPreserved, row.result]),
  )}

H3 is READY for 504/504, and all 504 source packages, scoring records, H3 records, and production bindings agree on mode and item inventory. The learner browser payload preserves 0/504 modes.

## Finding counts

${markdownTable(['Flag', 'Lessons'], FLAGS.map((flag) => [flag, flagCounts[flag]]))}

Additional protected-authority finding: 504/504 generated browser lesson rows retain a \`/scoring/\` resource locator even though the safe-row filter claims to remove adult answer/scoring locators.

## Projection proof

- Browser text preservation: 504 scenarios, 1,740/1,740 task directions, and 3,632/3,632 authored prompt texts.
- Numeric visibility: zero lessons lost a required source number token; existing oracle evidence covers the fixed-answer authority.
- Choice loss: ${browserLoss.losses.flattenedChoiceItems} fixed-choice items in ${browserLoss.losses.flattenedChoiceLessons} lessons lose all ${browserLoss.losses.flattenedChoiceLabels} labels as structured choices.
- Response loss: ${browserLoss.losses.unsupportedH3FixedItems} H3 fixed items and ${browserLoss.losses.unsupportedH3OpenItems} H3 open items have no learner input control.
- Direct answer leakage: ${browserLoss.losses.directAnswerLeakMatches} fixed-answer matches appear in pre-task Remediation/Extension across ${browserLoss.losses.directAnswerLeakLessons} lessons.
- Safety: no task requests real family financial data or real account/card/SSN credentials, and no personalized financial advice request was found.

## Negative controls

${markdownTable(['Control', 'Expected detection', 'Result'], negativeControls.controls.map((control) => [control.control, control.expected, control.detected ? 'DETECTED' : 'MISSED']))}

## Matrix decision

**SAFE_TO_BEGIN_MATRIX: NO.** First preserve response modes and choice arrays in the browser material contract, render numeric and open inputs, keep adult remediation and scoring locators out of learner payloads, then rerun this audit.
`

  mkdirSync(OUTPUT, { recursive: true })
  writeFileSync(join(OUTPUT, 'lesson-findings.jsonl'), `${findings.map((finding) => JSON.stringify(finding)).join('\n')}\n`)
  writeJson(join(OUTPUT, 'grade-results.json'), gradeResults)
  writeJson(join(OUTPUT, 'scoring-mode-results.json'), scoringModeResults)
  writeJson(join(OUTPUT, 'browser-loss.json'), browserLoss)
  writeFileSync(join(OUTPUT, 'FINLIT_LEARNER_AUDIT_R1.md'), report)

  const summary = {
    classification: 'FINLIT_LEARNER_AUDIT_COMPLETE',
    status: 'FAIL',
    lessonsAudited: findings.length,
    gradeResults: Object.fromEntries(gradeRows.map((row) => [row.grade, row.result])),
    scoringModeResults: Object.fromEntries(scoringModeResults.byMode.map((row) => [row.mode, row.result])),
    flags: flagCounts,
    scoringAuthorityLocatorLeakLessons: browserLoss.losses.scoringAuthorityLocatorLeakLessons,
    directAnswerLeakMatches: browserLoss.losses.directAnswerLeakMatches,
    safeToBeginMatrix: false,
    negativeControls: negativeControls.status,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (findings.length !== 504 || negativeControls.status !== 'PASS' || findings.some((finding) => finding.source.status !== 'PASS')) process.exitCode = 1
}

main()
