import { existsSync, readFileSync } from 'node:fs'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import {
  ARTS_REFERENCE_MODES,
  BLOCKING_CODES,
  EXPECTED,
  SCIENCE_HS_EXTERNAL_ALTERNATIVE_UNITS,
  SUBJECT_RULES,
  TECHNOLOGY_CODE_TASKS,
  TECHNOLOGY_MISSING_INPUT_MODES,
} from './rules.mjs'

const STRICT_PLACEHOLDER = /(?:\bTODO\b|\bTBD\b|\bFIXME\b|lorem ipsum|\[placeholder\]|<placeholder>|\bcoming soon\b)/i
const PE_SAFETY = /(?:open,? cleared movement space|open safe space|water available throughout|self-(?:selected|set) (?:challenge level|intensity)|stop (?:if|when)|pain, dizziness|breathing difficulty|head impact|supportive footwear|check (?:the )?(?:space|surface|equipment|weather)|adult spotting)/i
const PE_OPAQUE_EQUIPMENT = /(?:unit equipment listed in the guardian safety review|unit-specific source, model, manipulatives, safe materials, or approved digital tool|space and equipment appropriate to (?:the )?(?:chosen )?(?:goal|session)|equipment appropriate to (?:the )?(?:chosen challenge|designed session|session|goal))/i
const PE_IMPOSSIBLE_EQUIPMENT = /(?:regulation (?:vaulting horse|gymnastics apparatus|swimming pool)|commercial gym membership|required (?:treadmill|rowing machine|weight machine)|Olympic (?:barbell|platform|vaulting horse)|full-size (?:court|field) required)/i
const ELA_GENERIC_TASK = /(?:completes a new application of today's lesson|complete the unit assessment evidence for today's lesson independently)/i
const ELA_PLACEHOLDER_TASK = /(?:completes a new application of today's lesson|complete the unit assessment evidence for today's lesson independently|delivered separately by your facilitator)/i
const GENERIC_SCIENCE_MATERIALS = /(?:unit-specific source, model, manipulatives, safe materials|printed or on-screen text, data table, or model for this lesson)/i
const ADULT_KEY = /^(?:answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex|answer_or_scoring_guidance|mastery_rule|adaptive_tutor_routes)$/i
const ADULT_LOCATOR = /(?:answer-keys|answer_key|scoring-guide|teacher-guide|\/scoring\/)/i

function text(value) {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object' && typeof value.text === 'string') return value.text.trim()
  return ''
}

function strings(value) {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (Array.isArray(value)) return value.flatMap(strings)
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(strings)
}

export function walk(value, visit, path = '$') {
  visit(value, path)
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, `${path}[${index}]`))
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walk(child, visit, `${path}.${key}`)
  }
}

export function adultLeakPaths(value) {
  const paths = []
  walk(value, (candidate, path) => {
    const key = path.split('.').at(-1)
    if (ADULT_KEY.test(key) || (typeof candidate === 'string' && ADULT_LOCATOR.test(candidate))) paths.push(path)
  })
  return paths
}

function add(findings, code, detail, evidence = {}) {
  if (!findings.some((finding) => finding.code === code)) findings.push({ code, detail, ...evidence })
}

function sourceItems(subject, value, markdown) {
  if (subject === 'mathematics') {
    return (value.sections ?? []).flatMap((section) => (section.items ?? []))
      .filter((item) => item.kind !== 'worked-example')
      .map((item) => ({ ref: item.ref, kind: item.kind, prompt: item.prompt, choices: item.choices ?? [] }))
  }
  if (subject === 'financial-literacy' || subject === 'ready-for-life') {
    return (value.tasks ?? []).flatMap((task) => (task.prompts ?? []).map((item) => ({
      ref: item.ref,
      kind: item.promptType,
      prompt: item.text,
      choices: item.choices ?? [],
    })))
  }
  if (subject === 'science') {
    return [...String(markdown).matchAll(/^\*\*Q(\d+)\.\*\*\s*([^\n]+)/gm)]
      .map((match) => ({ ref: `Q${match[1]}`, kind: 'text', prompt: match[2], choices: [] }))
  }
  if (subject === 'social-studies') {
    const body = String(markdown).match(
      /## 3\. Independent response\r?\n\r?\n([\s\S]*?)(?:\r?\n\r?\n## 4\.|$)/,
    )?.[1] ?? ''
    return body.trim() ? [{ ref: 'independent-response', kind: 'text', prompt: body, choices: [] }] : []
  }
  if (subject === 'english-language-arts') {
    const prompt = text(value.independentEvidenceTask)
    return prompt ? [{ ref: 'independent-evidence', kind: 'text', prompt, choices: [] }] : []
  }
  if (subject === 'health' || subject === 'physical-education') {
    return [
      { ref: 'student-task', kind: subject === 'physical-education' ? 'performance-or-text' : 'text', prompt: text(value.studentTask), choices: [] },
      { ref: 'knowledge-check', kind: 'text', prompt: text(value.knowledgeCheck), choices: [] },
    ].filter((item) => item.prompt)
  }
  const prompt = text(value.primary_task)
  return prompt ? [{ ref: 'primary-task', kind: 'artifact-or-text', prompt, choices: [] }] : []
}

function projectedItems(material) {
  const items = []
  walk(material, (candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return
    const itemRef = candidate.sourceItemRef ?? candidate.itemRef ?? candidate.ref
    const responseKind = candidate.responseKind ?? candidate.responseType
    if (typeof itemRef === 'string' && typeof responseKind === 'string') {
      items.push({ itemRef, responseKind, choices: candidate.choices ?? [] })
    }
  })
  return items
}

function sourceArtifact(value) {
  return [
    value.sourceReference,
    value.reference,
    value.references,
    value.example,
    value.examples,
    value.model_work,
    value.model_works,
    value.supplied_material,
    value.supplied_materials,
    value.source_excerpt,
  ].some((candidate) => strings(candidate).join(' ').length >= 20)
}

function mathematicsRules(value, findings) {
  const nonWorked = (value.sections ?? []).flatMap((section) => section.items ?? []).filter((item) => item.kind !== 'worked-example')
  for (const section of value.sections ?? []) {
    if ((section.items ?? []).length > 0) continue
    const label = `${section.kind ?? ''} ${section.title ?? ''}`
    if (/mastery/i.test(label)) add(findings, 'EMPTY_REQUIRED_MASTERY', 'promised mastery check contains zero items')
    if (/independent|practice/i.test(label)) add(findings, 'EMPTY_REQUIRED_PRACTICE', 'promised independent practice contains zero items')
  }
  if (nonWorked.length === 0 || nonWorked.every((item) => /strategy|habit/i.test(`${item.itemType ?? ''} ${item.prompt ?? ''}`))) {
    add(findings, 'ZERO_ACTIONABLE_NORMAL_LESSON', 'no substantive grade-level mathematics problem is present')
  }
}

function elaRules(value, material, findings) {
  const task = text(value.independentEvidenceTask)
  const sourceSections = material?.format === 'structured'
    ? (material.sections ?? []).filter((section) => /source|reading|passage|text/i.test(section.title ?? ''))
    : []
  const hasActualReading = sourceSections.some((section) => {
    const delivered = [section.body, ...(section.prompts ?? [])].filter(Boolean).join('\n').trim()
    return delivered.length >= 240 &&
      !/(?:choose a grade-appropriate text|does not ship a fixed anchor text|facilitator may substitute|assigned passage)/i.test(delivered)
  }) || String(material?.sourceMetadata?.selectionInstructions ?? '').trim().length >= 240
  if (!hasActualReading) {
    add(findings, 'MISSING_REQUIRED_READING', 'the assigned reading is not present in learner material')
    add(findings, 'MISSING_REQUIRED_SOURCE', 'source metadata/selection language is not an attached source')
  }
  if (!task || ELA_GENERIC_TASK.test(task)) add(findings, 'ZERO_ACTIONABLE_NORMAL_LESSON', 'the central ELA task is meta-language without the promised application/item')
  if (value.lessonRef?.grade && EXPECTED.grades.includes(value.lessonRef.grade) &&
      /^(?:Performance task planning|Performance task build|Publication, presentation, or reflection)$/.test(value.lessonRef.phase ?? '') &&
      ELA_GENERIC_TASK.test(task)) {
    add(findings, 'EMPTY_REQUIRED_ACTIVITY', 'the daily writing/performance deliverable is not named')
  }
  if (ELA_PLACEHOLDER_TASK.test(task)) add(findings, 'PLACEHOLDER_TEMPLATE_SHELL', 'generic ELA phase template has no bound learner item')
}

function scienceRules(value, markdown, findings) {
  const isDataSheet = value.work_type === 'INVESTIGATION_DATA_SHEET'
  const materials = (value.materials ?? []).join(' ')
  const executable = value.executable_content
  const concrete = executable?.inputs_complete === true && executable?.materials_complete === true &&
    executable?.placeholder_free === true && typeof executable?.bound_task?.question === 'string' &&
    Array.isArray(executable?.bound_task?.steps) && executable.bound_task.steps.length >= 3 &&
    Array.isArray(executable?.supplied_evidence?.rows) && executable.supplied_evidence.rows.length >= 3
  const missingAlternative = isDataSheet && !(
    executable?.equal_credit_route?.complete === true &&
    executable?.equal_credit_route?.same_scoring_ceiling === true &&
    value.assurances?.executable_alternative_present === true
  )
  if (!concrete) {
    add(findings, 'ZERO_ACTIONABLE_NORMAL_LESSON', 'science task is an unbound topic-substitution shell without a case, model, data set, or runnable investigation')
    add(findings, 'MISSING_REQUIRED_DATA', 'the learner package contains no bound case/model/data/prior work')
    add(findings, 'PLACEHOLDER_TEMPLATE_SHELL', 'science sheet substitutes the topic into a generic task shell')
  }
  if (isDataSheet && (!value.materials?.length || GENERIC_SCIENCE_MATERIALS.test(materials)) && !concrete) {
    add(findings, 'EMPTY_REQUIRED_ACTIVITY', 'investigation data sheet has no executable investigation route')
    add(findings, 'MISSING_REQUIRED_MATERIALS', 'investigation materials are generic or absent')
  }
  if (missingAlternative) add(findings, 'MISSING_REQUIRED_DATA', 'equal-credit route requires unresolved published input')
  const safety = value.safety_brief
  if (isDataSheet && (!safety?.read_before_touching || !(safety?.stop_conditions || safety?.stop_conditions_from_floor))) {
    add(findings, 'MISSING_PE_SAFETY', 'required student-visible investigation safety is incomplete')
  }
  if (/^\s*(?:expected result|observed result)\s*:/im.test(markdown)) {
    add(findings, 'ADULT_ANSWER_SCORING_LEAK', 'learner science sheet prestates the expected/observed result')
  }
}

function socialStudiesRules(binding, findings) {
  if (binding.sourceReadinessKind === 'DYNAMIC_SOURCE_REQUIRED') {
    const contract = binding.sourceReadinessContract
    if (binding.sourceRuntimeState !== 'PENDING_SOURCE_ATTACHMENT' ||
        !['BLOCKED_PENDING_SOURCE', 'DISABLED'].includes(contract?.lessonLaunch) ||
        contract?.becomesRunnableWhen !== 'ATTACHED_SATISFIED') {
      add(findings, 'UNSAFE_SOURCE_STATE', 'dynamic source does not fail closed on its complete attachment contract')
    }
    return
  }
  const metadata = binding.sourceMetadataProvenance
  if (binding.sourceRuntimeState !== 'READY' || metadata?.state !== 'VERIFIED_STATIC_METADATA' ||
      !Array.isArray(metadata?.sourceKeys) || metadata.sourceKeys.length === 0) {
    add(findings, 'MISSING_REQUIRED_SOURCE', binding.grade >= 9
      ? 'static source rests on unresolved metadata without learner-available source records'
      : 'verified static source identity/metadata is absent from learner material')
  }
}

function peRules(value, findings) {
  const cues = [...(value.movementCues ?? []), ...(value.keyPoints ?? []), ...(value.task_steps ?? [])].filter((item) => text(item))
  const operational = JSON.stringify({
    task: value.studentTask,
    scenario: value.privacySafeScenario,
    materials: value.materials,
    cues,
    safetyRules: value.safetyRules,
    stoppingRules: value.stoppingRules,
    spaceSetup: value.spaceSetup,
  })
  if (cues.length === 0) add(findings, 'MISSING_PE_MOVEMENT_CUES', 'physical activity has no movement cues or procedural steps')
  if (!PE_SAFETY.test(operational)) add(findings, 'MISSING_PE_SAFETY', 'physical activity lacks visible operational safety guidance')
  const materials = (value.materials ?? []).join(' ')
  if (PE_OPAQUE_EQUIPMENT.test(materials) || PE_IMPOSSIBLE_EQUIPMENT.test(materials)) {
    add(findings, 'UNSAFE_PE_EQUIPMENT_ASSUMPTION', 'equipment is unspecified/external or infeasible without an equal-credit no-equipment route')
    add(findings, 'MISSING_REQUIRED_MATERIALS', 'required PE equipment is not concretely available')
  }
}

function healthRules(value, _material, findings) {
  if ((!value.keyPoints || value.keyPoints.length === 0) && value.grade >= 5) {
    add(findings, 'PLACEHOLDER_TEMPLATE_SHELL', 'health lesson lacks instructional key points and uses phase scaffolding')
  }
}

function technologyRules(value, findings) {
  const missingInput = TECHNOLOGY_MISSING_INPUT_MODES.has(value.work_mode)
  const setup = value.activity_setup
  const completeSetup = setup?.central_input &&
    Array.isArray(setup?.expected_behavior_and_specification) && setup.expected_behavior_and_specification.length >= 4 &&
    Array.isArray(setup?.test_cases) && setup.test_cases.length >= 3 &&
    setup?.execution_method && setup?.debugging_target?.target && setup?.equal_credit_alternative
  if (missingInput && !completeSetup) {
    add(findings, 'ZERO_ACTIONABLE_NORMAL_LESSON', 'central model/problem/case/artifact/assessment instrument is referenced but not supplied')
    add(findings, 'MISSING_REQUIRED_MATERIALS', 'required technology model, problem, scaffold, or environment is absent')
    add(findings, 'PLACEHOLDER_TEMPLATE_SHELL', 'phase archetype was not instantiated with its central input')
    if (TECHNOLOGY_CODE_TASKS.has(value.task_type)) add(findings, 'UNRUNNABLE_TECHNOLOGY_TASK', 'code/debug task has no runnable starter or complete paper specification')
  } else if (value.work_mode === 'SYNTHESIZE' && !completeSetup) {
    add(findings, 'PLACEHOLDER_TEMPLATE_SHELL', 'required two-concept problem is absent although a partial concept map can begin')
  }
}

function artsRules(value, findings) {
  if (ARTS_REFERENCE_MODES.has(value.work_mode) && !sourceArtifact(value)) {
    add(findings, 'MISSING_ARTS_MODEL_OR_SCAFFOLD', 'model/guided/investigation task supplies no model, excerpt, locator, or self-contained scaffold')
    add(findings, 'MISSING_REQUIRED_MATERIALS', 'required Arts reference/model/scaffold is not delivered')
  }
}

function finlitAnswerDisclosure(value, scoring, material, findings) {
  const preTask = (material.sections ?? [])
    .filter((section) => ['Remediation', 'Extension'].includes(section.title))
    .flatMap((section) => [section.body, ...(section.prompts ?? [])]).filter(Boolean).join('\n')
  const scoringItems = [
    ...(scoring?.scoringAuthority?.items ?? []),
    ...(scoring?.productionGateH3?.fixedAuthority?.supplements ?? []),
  ]
  if (scoringItems.some((item) => {
    const answer = String(item.answer ?? '').trim()
    return answer.length >= 3 && !/^\d{1,2}$/.test(answer) && preTask.includes(answer)
  })) add(findings, 'FINLIT_ANSWER_DISCLOSURE', 'remediation/extension shown before tasks reproduces a fixed scoring answer')
}

export function inspectLesson({ binding, value, markdown, material, runtimeRow, scoring, scienceRecord }) {
  const findings = []
  const sourceValue = scienceRecord ?? value
  const items = sourceItems(binding.subject, sourceValue, markdown)
  const projected = projectedItems(material)
  const explicitRefs = items.filter((item) => item.ref && !['independent-evidence', 'student-task', 'knowledge-check', 'primary-task', 'independent-response'].includes(item.ref))

  if (items.length === 0) add(findings, 'ZERO_ACTIONABLE_NORMAL_LESSON', 'no actionable learner evidence item/task was found')
  if (explicitRefs.length && explicitRefs.some((item) => !projected.some((candidate) => candidate.itemRef === item.ref))) {
    add(findings, 'LOST_ITEM_REF', 'one or more authored item references do not survive the learner projection', { affectedItems: explicitRefs.length })
  }
  if (items.some((item) => item.choices.length) && !projected.some((item) => Array.isArray(item.choices) && item.choices.length)) {
    add(findings, 'FLATTENED_STRUCTURED_CHOICES', 'structured choice arrays are absent or flattened into display text')
  }
  if (items.length && (projected.length === 0 || projected.every((item) => item.responseKind === 'none'))) {
    add(findings, 'RESPONSE_KIND_NONE', 'answer-required learner work is mounted with responseKind none')
    add(findings, 'UNSUPPORTED_REQUIRED_RESPONSE', 'no supported learner response control is bound to required work')
  }

  const leaks = adultLeakPaths({ material, runtimeRow })
  if (leaks.length) add(findings, 'ADULT_ANSWER_SCORING_LEAK', 'adult answer/scoring field or locator enters the learner payload', { leakCount: leaks.length })
  if (STRICT_PLACEHOLDER.test(markdown ?? JSON.stringify(value))) add(findings, 'PLACEHOLDER_TEMPLATE_SHELL', 'strict authoring placeholder residue remains')

  switch (binding.subject) {
    case 'mathematics': mathematicsRules(value, findings); break
    case 'english-language-arts': elaRules(value, material, findings); break
    case 'science': scienceRules(sourceValue, markdown, findings); break
    case 'social-studies': socialStudiesRules(binding, findings); break
    case 'physical-education': peRules(value, findings); break
    case 'health': healthRules(value, material, findings); break
    case 'technology': technologyRules(value, findings); break
    case 'arts-and-music': artsRules(value, findings); break
    case 'financial-literacy': finlitAnswerDisclosure(value, scoring, material, findings); break
  }

  return {
    lessonRef: binding.lessonRef,
    courseRef: binding.courseRef,
    grade: binding.grade,
    subject: binding.subject,
    findingCodes: BLOCKING_CODES.filter((code) => findings.some((finding) => finding.code === code)),
    findings,
  }
}

export function inspectAssessment(assessment, root, workflowAvailable = false) {
  const productionPath = assessment.productionPackageRef ? resolveProductionRef(root, assessment.productionPackageRef) : null
  const materialExists = Boolean(productionPath && existsSync(productionPath))
  let actionable = false
  let adultLeakCount = 0
  if (materialExists) {
    const raw = readFileSync(productionPath, 'utf8')
    if (extname(productionPath) === '.json') {
      const parsed = JSON.parse(raw)
      adultLeakCount = adultLeakPaths(parsed).length
      walk(parsed, (candidate) => {
        if (candidate && typeof candidate === 'object' &&
            (typeof candidate.prompt === 'string' || typeof candidate.question === 'string' ||
             (typeof candidate.text === 'string' && /prompt|task|question/i.test(Object.keys(candidate).join(' '))))) actionable = true
      })
    } else {
      actionable = /\?|\b(?:write|solve|explain|perform|create|demonstrate)\b/i.test(raw)
      adultLeakCount = /(?:answer key|correct answer|scoring guide)/i.test(raw) ? 1 : 0
    }
  }
  const findingCodes = []
  if (!materialExists || !actionable) findingCodes.push('MISSING_ASSESSMENT_LEARNER_MATERIAL')
  if (!workflowAvailable) findingCodes.push('ASSESSMENT_WORKFLOW_MISSING')
  if (adultLeakCount > 0) findingCodes.push('ADULT_ANSWER_SCORING_LEAK')
  return {
    assessmentRef: assessment.assessmentRef,
    courseRef: assessment.releaseSlotId,
    grade: assessment.grade,
    subject: assessment.subject,
    state: assessment.state,
    materialExists,
    actionable,
    adultLeakCount,
    findingCodes,
  }
}

export function resolveProductionRef(root, ref) {
  const match = /^git\+[0-9a-f]{40}:(.+)$/.exec(ref)
  if (!match) throw new Error(`Unsupported production ref: ${ref}`)
  const rootPath = resolve(root)
  const path = resolve(rootPath, match[1])
  const repositoryRelativePath = relative(rootPath, path)
  if (
    repositoryRelativePath === '..' ||
    repositoryRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(repositoryRelativePath)
  ) {
    throw new Error(`Production ref escapes repository: ${ref}`)
  }
  return path
}

function countCodes(rows) {
  return Object.fromEntries(BLOCKING_CODES.map((code) => [code, rows.filter((row) => row.findingCodes.includes(code)).length]))
}

export function summarize({ lessons, assessments, courses }) {
  const cells = []
  for (const grade of EXPECTED.grades) {
    for (const subject of EXPECTED.subjects) {
      const lessonRows = lessons.filter((row) => row.grade === grade && row.subject === subject)
      const assessmentRows = assessments.filter((row) => row.grade === grade && row.subject === subject)
      const lessonCounts = countCodes(lessonRows)
      const assessmentCounts = countCodes(assessmentRows)
      const blockerCount = Object.values(lessonCounts).reduce((sum, count) => sum + count, 0) +
        Object.values(assessmentCounts).reduce((sum, count) => sum + count, 0)
      cells.push({
        grade,
        subject,
        courses: courses.filter((course) => course.grade === grade && course.subject === subject).length,
        lessons: lessonRows.length,
        assessments: assessmentRows.length,
        readyLessons: lessonRows.filter((row) => row.findingCodes.length === 0).length,
        readyAssessments: assessmentRows.filter((row) => row.findingCodes.length === 0).length,
        blockerCount,
        status: blockerCount === 0 ? 'READY' : 'BLOCKED',
        topCodes: BLOCKING_CODES.map((code) => [code, lessonCounts[code] + assessmentCounts[code]])
          .filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5)
          .map(([code, count]) => ({ code, count })),
      })
    }
  }
  const lessonCounts = countCodes(lessons)
  const assessmentCounts = countCodes(assessments)
  return {
    releaseReady: lessons.every((row) => row.findingCodes.length === 0) && assessments.every((row) => row.findingCodes.length === 0),
    counts: { courses: courses.length, lessons: lessons.length, assessments: assessments.length },
    lessonGate: {
      ready: lessons.filter((row) => row.findingCodes.length === 0).length,
      blocked: lessons.filter((row) => row.findingCodes.length > 0).length,
      failureCounts: lessonCounts,
    },
    assessmentGate: {
      ready: assessments.filter((row) => row.findingCodes.length === 0).length,
      blocked: assessments.filter((row) => row.findingCodes.length > 0).length,
      failureCounts: assessmentCounts,
    },
    subjectRules: SUBJECT_RULES,
    matrix: cells,
    samplesByCode: Object.fromEntries(BLOCKING_CODES.map((code) => [code,
      [...lessons, ...assessments].filter((row) => row.findingCodes.includes(code)).slice(0, 10)
        .map((row) => row.lessonRef ?? row.assessmentRef),
    ])),
  }
}

export function assertPopulation(summary) {
  for (const key of ['courses', 'lessons', 'assessments']) {
    if (summary.counts[key] !== EXPECTED[key]) throw new Error(`Population mismatch: ${key}=${summary.counts[key]}, expected ${EXPECTED[key]}`)
  }
}

export function syntheticMaterial({ itemRef = 'item-1', responseKind = 'text', choices = [] } = {}) {
  return { format: 'structured', sections: [{ title: 'Work', prompts: [], items: [{ itemRef, responseKind, choices }] }] }
}
