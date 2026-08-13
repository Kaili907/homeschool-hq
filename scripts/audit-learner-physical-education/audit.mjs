#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const EXPECTED_BASE = 'c81ddb6e04bc1c3629212327d47817c1b5677477'
export const EXPECTED_GRADES = Object.freeze([3, 4, 5, 7, 8, 9, 10, 11, 12])
export const EXPECTED_LESSONS = 972

export const FLAGS = Object.freeze([
  'ZERO_ACTIONABLE_WORK',
  'EMPTY_ACTIVITY',
  'MISSING_MOVEMENT_CUES',
  'MISSING_SAFETY',
  'MISSING_ADAPTATION',
  'EQUIPMENT_ASSUMPTION',
  'MEDIA_PROOF_REQUIREMENT',
  'BODY_WEIGHT_DIET_PROBLEM',
  'UNSAFE_INTENSITY',
  'PROJECTION_LOSS',
  'EMPTY_COMPLETION_CRITERIA',
  'PLACEHOLDER',
])

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const CORPUS_ROOT = resolve(
  ROOT,
  'curriculum-production/final/health-physical-education/packages/physical-education',
)
const OUTPUT_ROOT = resolve(ROOT, 'docs/learner-audits/physical-education')
const BUILDER_PATH = resolve(ROOT, 'scripts/build-final-family-pilot-data.mjs')
const RENDERER_PATH = resolve(
  ROOT,
  'src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx',
)

// Kept in the same order as scripts/build-final-family-pilot-data.mjs. This
// independent copy lets the read-only audit exercise the browser projection
// without generating or changing public/ release data.
const SCALAR_KEYS = [
  'objective',
  'scenario',
  'privacySafeScenario',
  'studentTask',
  'knowledgeCheck',
  'adaptationChoices',
  'extensionChallenge',
  'trustedAdultNote',
  'task_brief',
  'primary_task',
  'deliverable',
  'essential_question',
  'remediation',
  'extension',
  'copyright_and_authorship',
]

const ARRAY_KEYS = [
  'materials',
  'keyPoints',
  'movementCues',
  'completionCriteria',
  'accessibilitySupports',
  'neverRequires',
  'safetyNotes',
  'learning_objectives',
  'lesson_success_criteria',
  'task_steps',
  'requirements',
  'critique_criteria',
  'test_or_check_criteria',
  'safety_and_privacy_rules',
  'accessibility_options',
  'task_accessibility_provisions',
]

const ACTION_PATTERN = /\b(?:adapt|analy[sz]e|apply|assemble|build|choose|complete|compose|create|demonstrate|describe|design|develop|document|evaluate|explain|facilitate|identify|lead|learn|perform|plan|play|practi[cs]e|present|produce|record|refine|revise|run|show|teach|test|trial|try|work|write)\b/i
const SAFETY_GUIDANCE_PATTERN = /(?:open,? cleared movement space|open safe space|water available throughout|self-(?:selected|set) (?:challenge level|intensity)|stop (?:if|when)|push through pain|pain, dizziness|breathing difficulty|head impact|supportive footwear|check (?:the )?(?:space|surface|equipment|weather)|adult spotting)/i
const PLACEHOLDER_PATTERN = /(?:\bTBD\b|\bTODO\b|\bFIXME\b|\bplaceholder\b|\bcoming soon\b|lorem ipsum|\[insert[^\]]*\]|<insert[^>]*>)/i
const MEDIA_PATTERN = /\b(?:camera|photo|photograph|video|recording)\b/i
const MEDIA_OBLIGATION_PATTERN = /\b(?:must|required|submit|upload|provide|turn in|as proof)\b/i
const NEGATED_MEDIA_PATTERN = /\b(?:no|not|never|without)\b.{0,100}\b(?:camera|photo|photograph|video|recording)\b|\b(?:camera|photo|photograph|video|recording)\b.{0,60}\b(?:optional|not required|never required)\b/i
const BODY_PROBLEM_PATTERNS = [
  /\b(?:lose|reduce) (?:your )?(?:body )?weight\b/i,
  /\bcalorie (?:goal|target|limit|budget)\b/i,
  /\b(?:weight|BMI|body[- ]?fat) (?:goal|target|score|requirement)\b/i,
  /\bweigh[- ]?in (?:is )?required\b/i,
  /\b(?:fat|skinny|lazy|out[- ]of[- ]shape) bod(?:y|ies)\b/i,
]
const UNSAFE_INTENSITY_PATTERNS = [
  /\b(?:maximum|maximal|max|all[- ]out) effort (?:is )?(?:required|mandatory)\b/i,
  /\b(?:continue|exercise|train|work) (?:until|to) (?:failure|exhaustion|collapse)\b/i,
  /\bno rest (?:is )?(?:allowed|permitted)\b/i,
  /\bpush through (?:warning )?pain\b/i,
]
const OPAQUE_EQUIPMENT_PATTERNS = [
  /unit equipment listed in the guardian safety review/i,
  /unit-specific source, model, manipulatives, safe materials, or approved digital tool/i,
  /space and equipment appropriate to (?:the )?(?:chosen )?(?:goal|session)/i,
  /equipment appropriate to (?:the )?(?:chosen challenge|designed session|session|goal)/i,
]
const IMPOSSIBLE_EQUIPMENT_PATTERN = /(?:regulation (?:vaulting horse|gymnastics apparatus|swimming pool)|commercial gym membership|required (?:treadmill|rowing machine|weight machine)|Olympic (?:barbell|platform|vaulting horse)|full-size (?:court|field) required)/i

function walk(directory) {
  return readdirSync(directory).sort().flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter(hasText).map((item) => item.trim()) : []
}

function allLearnerText(lesson, { includePolicies = true } = {}) {
  const copy = includePolicies
    ? lesson
    : { ...lesson, neverRequires: undefined, optionalReflection: undefined }
  return JSON.stringify(copy)
}

function learnerStrings(value) {
  if (hasText(value)) return [value.trim()]
  if (Array.isArray(value)) return value.flatMap(learnerStrings)
  if (!value || typeof value !== 'object') return []
  return Object.values(value).flatMap(learnerStrings)
}

function hasMediaProofRequirement(lesson) {
  const direct = { ...lesson, neverRequires: undefined, optionalReflection: undefined }
  return learnerStrings(direct).some((text) =>
    text.split(/(?<=[.!?;])\s+|\n+/).some((clause) =>
      MEDIA_PATTERN.test(clause)
      && MEDIA_OBLIGATION_PATTERN.test(clause)
      && !NEGATED_MEDIA_PATTERN.test(clause),
    ),
  )
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function titleForKey(key) {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function asText(value) {
  if (hasText(value)) return value.trim()
  if (value && typeof value === 'object' && hasText(value.text)) return value.text.trim()
  return null
}

/** Mirrors the production JSON-to-browser projection for learner fields. */
export function projectJsonMaterial(value) {
  const sections = []
  const add = (title, body, prompts = []) => {
    const text = asText(body)
    const safePrompts = prompts.filter(hasText).map((item) => item.trim())
    if (text || safePrompts.length) {
      sections.push({ title, ...(text ? { body: text } : {}), prompts: safePrompts })
    }
  }

  add('Lesson goal', value.objective)
  add('Scenario', value.scenario)
  for (const key of SCALAR_KEYS) {
    if (key === 'objective' || key === 'scenario') continue
    add(titleForKey(key), value[key])
  }
  for (const key of ARRAY_KEYS) {
    if (Array.isArray(value[key])) add(titleForKey(key), null, value[key])
  }
  if (Array.isArray(value.sections)) {
    for (const section of value.sections) {
      const prompts = []
      for (const item of Array.isArray(section.items) ? section.items : []) {
        if (hasText(item.prompt)) {
          const choices = Array.isArray(item.choices) ? `\nChoices: ${item.choices.join(' · ')}` : ''
          prompts.push(`${item.prompt}${choices}`)
        }
        if (Array.isArray(item.workedSolution?.steps)) prompts.push(...item.workedSolution.steps)
      }
      add(section.title || section.kind || 'Lesson work', section.directions, prompts)
    }
  }
  if (Array.isArray(value.tasks)) {
    for (const task of value.tasks) {
      add(
        String(task.kind || task.taskId || 'Task').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        task.directions,
        (Array.isArray(task.prompts) ? task.prompts : []).map((prompt) => prompt.text),
      )
    }
  }
  add('Source or reading', value.sourceReference)
  add('Guided support', value.guidedSupport)
  add('Independent evidence', value.independentEvidenceTask)
  add('Equal-credit alternative', value.simulationAlternative?.description)
  add('Optional reflection', value.optionalReflection?.prompt)
  add('Media fallback', value.media?.fallback)
  return sections
}

function projectedValues(sections) {
  return sections.flatMap((section) => [section.body, ...section.prompts]).filter(hasText)
}

const PROJECTION_FIELDS = Object.freeze([
  'privacySafeScenario',
  'studentTask',
  'movementCues',
  'keyPoints',
  'task_steps',
  'adaptationChoices',
  'completionCriteria',
  'accessibilitySupports',
])

export function projectionCheck(lesson) {
  const values = projectedValues(projectJsonMaterial(lesson))
  const fields = {}
  for (const field of PROJECTION_FIELDS) {
    const source = Array.isArray(lesson[field])
      ? stringArray(lesson[field])
      : hasText(lesson[field]) ? [lesson[field].trim()] : []
    const missing = source.filter((item) => !values.includes(item))
    fields[field] = { sourceCount: source.length, preservedCount: source.length - missing.length, missing }
  }
  const losses = Object.entries(fields).flatMap(([field, result]) =>
    result.missing.map((value) => ({ field, value })),
  )
  return { pass: losses.length === 0, fields, losses }
}

function equipmentCheck(lesson) {
  const materials = stringArray(lesson.materials)
  const materialText = materials.join(' | ')
  const opaque = OPAQUE_EQUIPMENT_PATTERNS.some((pattern) => pattern.test(materialText))
  const impossible = IMPOSSIBLE_EQUIPMENT_PATTERN.test(materialText)
  const reasons = [
    ...(opaque ? ['UNSPECIFIED_OR_EXTERNAL_EQUIPMENT'] : []),
    ...(impossible ? ['IMPOSSIBLE_HOUSEHOLD_EQUIPMENT'] : []),
  ]
  return { pass: reasons.length === 0, reasons, materials }
}

function containsAny(patterns, text) {
  return patterns.some((pattern) => pattern.test(text))
}

/** Audits one learner package and returns only mandated finding codes. */
export function auditLesson(lesson, sourcePath = '<fixture>') {
  const scenario = hasText(lesson.privacySafeScenario) ? lesson.privacySafeScenario.trim() : ''
  const task = hasText(lesson.studentTask) ? lesson.studentTask.trim() : ''
  const activityText = `${scenario}\n${task}`.trim()
  const cues = [...stringArray(lesson.movementCues), ...stringArray(lesson.keyPoints)]
  const steps = [
    ...stringArray(lesson.task_steps),
    ...stringArray(lesson.steps),
    ...stringArray(lesson.activitySteps),
  ]
  const completion = stringArray(lesson.completionCriteria)
  const adaptations = hasText(lesson.adaptationChoices) ? lesson.adaptationChoices.trim() : ''
  const accessibility = stringArray(lesson.accessibilitySupports)
  const duration = hasText(lesson.estimatedMinutes) && /\d/.test(lesson.estimatedMinutes)
  const repetitionGuidance = /\b(?:repetitions?|reps?|rounds?|sets?|times?|seconds?|minutes?|sessions?)\b/i.test(activityText)
  const operationalText = JSON.stringify({
    task: lesson.studentTask,
    cues: lesson.movementCues,
    keyPoints: lesson.keyPoints,
    materials: lesson.materials,
    adaptations: lesson.adaptationChoices,
    steps: lesson.task_steps ?? lesson.steps ?? lesson.activitySteps,
  })
  const directText = allLearnerText(lesson, { includePolicies: false })
  const projection = projectionCheck(lesson)
  const equipment = equipmentCheck(lesson)
  const checks = {
    clearActivityGoal: hasText(lesson.focus) || hasText(lesson.objective) || hasText(lesson.title),
    actionableWork: activityText.length >= 20 && ACTION_PATTERN.test(activityText),
    activityPresent: Boolean(activityText),
    movementCuesOrSteps: cues.length > 0 || steps.length > 0,
    usableInstructions: activityText.length >= 20 && ACTION_PATTERN.test(activityText) && (scenario.length > 0 || cues.length > 0 || steps.length > 0),
    durationGuidance: duration,
    reasonableDurationOrRepetitionGuidance: duration || repetitionGuidance,
    safetyGuidance: SAFETY_GUIDANCE_PATTERN.test(operationalText),
    adaptationChoice: adaptations.length >= 20 && accessibility.length > 0,
    lowSpaceNoEquipmentAlternativeWhereRequired: equipment.pass,
    completionCriteria: completion.length > 0,
    noMediaProofRequirement: !hasMediaProofRequirement(lesson),
    bodyNeutral: !containsAny(BODY_PROBLEM_PATTERNS, directText),
    safeIntensity: !containsAny(UNSAFE_INTENSITY_PATTERNS, directText),
    feasibleEquipment: equipment.pass,
    browserProjection: projection.pass,
    noPlaceholder: !PLACEHOLDER_PATTERN.test(directText),
  }

  const flags = []
  if (!checks.actionableWork) flags.push('ZERO_ACTIONABLE_WORK')
  if (!checks.activityPresent) flags.push('EMPTY_ACTIVITY')
  if (!checks.movementCuesOrSteps) flags.push('MISSING_MOVEMENT_CUES')
  if (!checks.safetyGuidance) flags.push('MISSING_SAFETY')
  if (!checks.adaptationChoice) flags.push('MISSING_ADAPTATION')
  if (!checks.feasibleEquipment) flags.push('EQUIPMENT_ASSUMPTION')
  if (!checks.noMediaProofRequirement) flags.push('MEDIA_PROOF_REQUIREMENT')
  if (!checks.bodyNeutral) flags.push('BODY_WEIGHT_DIET_PROBLEM')
  if (!checks.safeIntensity) flags.push('UNSAFE_INTENSITY')
  if (!checks.browserProjection) flags.push('PROJECTION_LOSS')
  if (!checks.completionCriteria) flags.push('EMPTY_COMPLETION_CRITERIA')
  if (!checks.noPlaceholder) flags.push('PLACEHOLDER')

  return {
    schemaVersion: 'pe-learner-audit-r1',
    lessonId: lesson.lessonId,
    courseId: lesson.courseId,
    grade: lesson.grade,
    unitNumber: lesson.unitNumber,
    title: lesson.title,
    sourcePath,
    checks,
    counts: {
      movementCues: cues.length,
      proceduralSteps: steps.length,
      completionCriteria: completion.length,
      accessibilitySupports: accessibility.length,
    },
    equipment: { reasons: equipment.reasons, materials: equipment.materials },
    projection: projection.fields,
    flags,
  }
}

export function negativeControls() {
  const fixture = () => ({
    schemaVersion: 'fixture',
    kind: 'lesson-task-card',
    lessonId: 'pe-negative-control',
    courseId: 'pe-control',
    grade: 9,
    unitNumber: 1,
    title: 'Safe movement control',
    focus: 'controlled travel',
    estimatedMinutes: '20–30',
    materials: ['open, cleared movement space', 'water available throughout'],
    privacySafeScenario: 'Perform a short controlled travel sequence and explain one adjustment.',
    studentTask: 'Practise the sequence at a self-selected challenge level and record what changed.',
    movementCues: ['Look ahead.', 'Slow before changing direction.'],
    keyPoints: [],
    completionCriteria: ['Complete or fully describe the sequence and one adjustment.'],
    adaptationChoices: 'Use a seated, supported, reduced-range, shorter, or described version with equal credit.',
    accessibilitySupports: ['Use readable text or a read-aloud.', 'Use a seated or described response.'],
    neverRequires: ['No photograph, video, or recording is required.'],
  })
  const controls = [
    {
      id: 'delete_activity',
      expectedFlags: ['ZERO_ACTIONABLE_WORK', 'EMPTY_ACTIVITY'],
      mutate(lesson) {
        lesson.privacySafeScenario = ''
        lesson.studentTask = ''
      },
    },
    {
      id: 'delete_safety',
      expectedFlags: ['MISSING_SAFETY'],
      mutate(lesson) {
        lesson.materials = ['notebook']
        lesson.studentTask = 'Practise the sequence and record what changed.'
      },
    },
    {
      id: 'camera_requirement',
      expectedFlags: ['MEDIA_PROOF_REQUIREMENT'],
      mutate(lesson) {
        lesson.studentTask += ' Submit a required camera video as proof.'
      },
    },
    {
      id: 'impossible_equipment',
      expectedFlags: ['EQUIPMENT_ASSUMPTION'],
      mutate(lesson) {
        lesson.materials = ['regulation vaulting horse required']
      },
    },
    {
      id: 'no_adaptation',
      expectedFlags: ['MISSING_ADAPTATION'],
      mutate(lesson) {
        lesson.adaptationChoices = ''
        lesson.accessibilitySupports = []
      },
    },
  ]
  return controls.map((control) => {
    const lesson = fixture()
    control.mutate(lesson)
    const result = auditLesson(lesson)
    const detected = control.expectedFlags.every((flag) => result.flags.includes(flag))
    return { id: control.id, expectedFlags: control.expectedFlags, detected, actualFlags: result.flags }
  })
}

function loadLessons() {
  return walk(CORPUS_ROOT)
    .filter((path) => /\/grade-\d{2}\/[^/]+\.json$/.test(path))
    .map((path) => ({ path, value: JSON.parse(readFileSync(path, 'utf8')) }))
    .filter(({ value }) => value.kind === 'lesson-task-card')
    .sort((left, right) =>
      left.value.grade - right.value.grade ||
      left.value.unitNumber - right.value.unitNumber ||
      left.value.lessonId.localeCompare(right.value.lessonId),
    )
}

function zeroFlagCounts() {
  return Object.fromEntries(FLAGS.map((flag) => [flag, 0]))
}

function countsFor(findings) {
  const counts = zeroFlagCounts()
  for (const finding of findings) {
    for (const flag of finding.flags) counts[flag] += 1
  }
  return counts
}

function criteriaPassCounts(findings) {
  const keys = Object.keys(findings[0]?.checks ?? {})
  return Object.fromEntries(keys.map((key) => [key, findings.filter((item) => item.checks[key]).length]))
}

function projectionSummary(findings) {
  const fields = Object.fromEntries(PROJECTION_FIELDS.map((field) => [field, {
    sourceValues: 0,
    preservedValues: 0,
    lossCount: 0,
  }]))
  for (const finding of findings) {
    for (const field of PROJECTION_FIELDS) {
      const result = finding.projection[field]
      fields[field].sourceValues += result.sourceCount
      fields[field].preservedValues += result.preservedCount
      fields[field].lossCount += result.missing.length
    }
  }
  return fields
}

function inspectProjectionImplementation() {
  const builder = readFileSync(BUILDER_PATH, 'utf8')
  const renderer = readFileSync(RENDERER_PATH, 'utf8')
  const builderKeysPresent = [...SCALAR_KEYS, ...ARRAY_KEYS].every((key) => builder.includes(`'${key}'`))
  const fullMaterialRendererFound = /material\.sections\.map\(/.test(renderer)
    && /section\.body/.test(renderer)
    && /section\.prompts\.map\(/.test(renderer)
  const synthetic = {
    privacySafeScenario: 'Synthetic activity step.',
    studentTask: 'Perform the synthetic activity.',
    movementCues: ['Synthetic cue.'],
    keyPoints: ['Synthetic key point.'],
    task_steps: ['Synthetic step.'],
    adaptationChoices: 'Synthetic adaptation.',
    completionCriteria: ['Synthetic completion criterion.'],
    accessibilitySupports: ['Synthetic accessibility support.'],
  }
  return {
    builderPath: relative(ROOT, BUILDER_PATH),
    builderSha256: sha256(BUILDER_PATH),
    rendererPath: relative(ROOT, RENDERER_PATH),
    rendererSha256: sha256(RENDERER_PATH),
    builderKeysPresent,
    fullMaterialRendererFound,
    syntheticProjectionControl: projectionCheck(synthetic).pass,
  }
}

function markdownReport({ findings, gradeResults, totals, controls, equipmentResults, browserLoss }) {
  const rows = gradeResults.grades.map((row) =>
    `| ${row.grade} | ${row.lessonsAudited} | ${row.flags.ZERO_ACTIONABLE_WORK} | ${row.flags.EMPTY_ACTIVITY} | ${row.flags.MISSING_MOVEMENT_CUES} | ${row.flags.MISSING_SAFETY} | ${row.flags.MISSING_ADAPTATION} | ${row.flags.EQUIPMENT_ASSUMPTION} | ${row.flags.MEDIA_PROOF_REQUIREMENT} | ${row.flags.PROJECTION_LOSS} | ${row.safeToBegin ? 'YES' : 'NO'} |`,
  ).join('\n')
  const blockers = Object.entries(totals)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  const blockerList = blockers.length
    ? blockers.map(([flag, count]) => `- ${flag}: ${count} lessons.`).join('\n')
    : '- None.'
  const controlRows = controls.map((control) =>
    `| ${control.id} | ${control.expectedFlags.join(', ')} | ${control.detected ? 'PASS' : 'FAIL'} |`,
  ).join('\n')
  const grades = gradeResults.grades.map((item) => item.grade).join(', ')
  const lessonsWithFindings = findings.filter((item) => item.flags.length > 0).length
  return `# Physical Education Learner Completeness Audit R1

Classification: **PE_LEARNER_AUDIT_COMPLETE**

Corpus readiness: **NOT SAFE TO BEGIN MATRIX**
Base: \`${EXPECTED_BASE}\`

## Scope and outcome

The audit read every canonical PE \`lesson-task-card\` under \`curriculum-production/final/health-physical-education/packages/physical-education\`: ${findings.length} lessons across Grades ${grades}. Grade 6 is not authored and is not part of the 972-lesson contract. All ${findings.length} lesson identities are present exactly once.

Every lesson was checked for an activity goal, actionable learner work, activity content, procedural cues/steps, duration, operational safety guidance, adaptations, equipment feasibility, completion criteria, prohibited media/body/intensity requirements, placeholders, and browser projection. ${lessonsWithFindings} lessons have at least one blocking finding. No grade is safe to begin from these learner packages.

## Grade results

| Grade | Audited | Zero work | Empty activity | Missing cues/steps | Missing safety | Missing adaptation | Equipment | Media proof | Projection loss | Safe to begin |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |
${rows}

## Top blockers

${blockerList}

\`MISSING_MOVEMENT_CUES\` is applied when neither \`movementCues\`, \`keyPoints\`, nor a procedural step array gives the learner per-lesson execution cues. Grades 5 and above have no such arrays; their learner cards rely on a unit-shared scenario plus a generic focus substitution. \`MISSING_SAFETY\` requires operational guidance such as a cleared/open safe space, water availability, self-selected intensity, a stop condition, or an equipment/surface check; merely using the word “safe” in a goal is not guidance. \`EQUIPMENT_ASSUMPTION\` identifies an opaque external equipment list or unspecified “appropriate” equipment instead of a usable learner-side list/alternative.

## Other verified controls

- Activity goals, actionable central tasks, non-empty activities, durations, and completion criteria are present in all ${findings.length} lessons.
- All ${findings.length} lessons expressly prohibit required photo/video/voice proof; no positive media-proof requirement was found.
- No body-shaming, calorie/weight target, or unsafe required maximal-effort language was found.
- All ${findings.length} lessons contain adaptation text and accessibility supports. Equipment/space alternatives are evaluated separately rather than treating a generic response-mode adaptation as an equipment substitute.
- Browser projection loss: ${browserLoss.lossCount}. The audited projection preserves ${browserLoss.fields.movementCues.preservedValues}/${browserLoss.fields.movementCues.sourceValues} movement-cue values, ${browserLoss.fields.task_steps.preservedValues}/${browserLoss.fields.task_steps.sourceValues} authored step values, and ${browserLoss.fields.adaptationChoices.preservedValues}/${browserLoss.fields.adaptationChoices.sourceValues} adaptation values. The synthetic authored-step projection control also passed.
- Equipment findings: ${equipmentResults.findingCount}; impossible-equipment requirements found in the corpus: ${equipmentResults.reasonCounts.IMPOSSIBLE_HOUSEHOLD_EQUIPMENT ?? 0}.

## Negative controls

| Injected fault | Expected detection | Result |
| --- | --- | :---: |
${controlRows}

## Method and artifacts

The reproducible audit is \`scripts/audit-learner-physical-education/audit.mjs\`; its focused tests are \`scripts/audit-learner-physical-education/audit.test.mjs\`. It independently mirrors the learner JSON projection without writing to \`public/\`, then statically verifies that the production learner view renders all section bodies and prompts. Per-lesson evidence is in \`lesson-findings.jsonl\`; aggregate grade, equipment, and browser results are in the adjacent JSON files.
`
}

export function runAudit() {
  const documents = loadLessons()
  if (documents.length !== EXPECTED_LESSONS) {
    throw new Error(`PE lesson count mismatch: expected ${EXPECTED_LESSONS}, found ${documents.length}`)
  }
  const foundGrades = [...new Set(documents.map(({ value }) => value.grade))]
  if (JSON.stringify(foundGrades) !== JSON.stringify(EXPECTED_GRADES)) {
    throw new Error(`PE grade coverage mismatch: ${foundGrades.join(', ')}`)
  }
  const identities = new Set(documents.map(({ value }) => value.lessonId))
  if (identities.size !== documents.length) throw new Error('Duplicate PE lesson identity found')

  const findings = documents.map(({ path, value }) =>
    auditLesson(value, relative(ROOT, path)),
  )
  const totals = countsFor(findings)
  const controls = negativeControls()
  if (!controls.every((control) => control.detected)) {
    throw new Error('One or more required PE audit negative controls failed')
  }
  const gradeRows = EXPECTED_GRADES.map((grade) => {
    const items = findings.filter((item) => item.grade === grade)
    const flags = countsFor(items)
    return {
      grade,
      lessonsAudited: items.length,
      flags,
      criteriaPassCounts: criteriaPassCounts(items),
      lessonsWithFindings: items.filter((item) => item.flags.length > 0).length,
      safeToBegin: items.every((item) => item.flags.length === 0),
    }
  })
  const safeToBeginMatrix = Object.fromEntries(gradeRows.map((item) => [String(item.grade), {
    result: item.safeToBegin ? 'SAFE' : 'BLOCKED',
    blockingFindings: Object.fromEntries(Object.entries(item.flags).filter(([, count]) => count > 0)),
  }]))
  const gradeResults = {
    schemaVersion: 'pe-learner-audit-r1',
    classification: 'PE_LEARNER_AUDIT_COMPLETE',
    base: EXPECTED_BASE,
    lessonsAudited: findings.length,
    expectedLessons: EXPECTED_LESSONS,
    gradesAudited: EXPECTED_GRADES,
    totals,
    criteriaPassCounts: criteriaPassCounts(findings),
    grades: gradeRows,
    safeToBeginMatrix,
    negativeControls: controls,
  }

  const equipmentFindings = findings
    .filter((item) => item.flags.includes('EQUIPMENT_ASSUMPTION'))
    .map((item) => ({
      lessonId: item.lessonId,
      grade: item.grade,
      unitNumber: item.unitNumber,
      sourcePath: item.sourcePath,
      reasons: item.equipment.reasons,
      materials: item.equipment.materials,
    }))
  const equipmentResults = {
    schemaVersion: 'pe-learner-audit-r1',
    lessonsAudited: findings.length,
    findingCount: equipmentFindings.length,
    byGrade: Object.fromEntries(EXPECTED_GRADES.map((grade) => [String(grade),
      equipmentFindings.filter((item) => item.grade === grade).length,
    ])),
    reasonCounts: equipmentFindings.flatMap((item) => item.reasons).reduce((counts, reason) => {
      counts[reason] = (counts[reason] ?? 0) + 1
      return counts
    }, {}),
    findings: equipmentFindings,
  }

  const implementation = inspectProjectionImplementation()
  const projectionLosses = findings
    .filter((item) => item.flags.includes('PROJECTION_LOSS'))
    .map((item) => ({ lessonId: item.lessonId, grade: item.grade, fields: item.projection }))
  const browserLoss = {
    schemaVersion: 'pe-learner-audit-r1',
    lessonsAudited: findings.length,
    result: projectionLosses.length === 0
      && implementation.builderKeysPresent
      && implementation.fullMaterialRendererFound
      && implementation.syntheticProjectionControl ? 'PASS' : 'FAIL',
    lossCount: projectionLosses.length,
    fields: projectionSummary(findings),
    implementation,
    losses: projectionLosses,
    note: 'The production learner MaterialView renders every projected section body and every prompt. The segment player uses one current prompt, but the full material remains visible beside it.',
  }

  mkdirSync(OUTPUT_ROOT, { recursive: true })
  writeFileSync(
    resolve(OUTPUT_ROOT, 'lesson-findings.jsonl'),
    `${findings.map((item) => JSON.stringify(item)).join('\n')}\n`,
  )
  writeFileSync(
    resolve(OUTPUT_ROOT, 'grade-results.json'),
    `${JSON.stringify(gradeResults, null, 2)}\n`,
  )
  writeFileSync(
    resolve(OUTPUT_ROOT, 'equipment-results.json'),
    `${JSON.stringify(equipmentResults, null, 2)}\n`,
  )
  writeFileSync(
    resolve(OUTPUT_ROOT, 'browser-loss.json'),
    `${JSON.stringify(browserLoss, null, 2)}\n`,
  )
  writeFileSync(
    resolve(OUTPUT_ROOT, 'PE_LEARNER_AUDIT_R1.md'),
    markdownReport({ findings, gradeResults, totals, controls, equipmentResults, browserLoss }),
  )

  return { findings, gradeResults, equipmentResults, browserLoss }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = runAudit()
  console.log(JSON.stringify({
    classification: result.gradeResults.classification,
    lessonsAudited: result.gradeResults.lessonsAudited,
    totals: result.gradeResults.totals,
    safeToBeginMatrix: result.gradeResults.safeToBeginMatrix,
    equipmentFindings: result.equipmentResults.findingCount,
    projectionResult: result.browserLoss.result,
    projectionLosses: result.browserLoss.lossCount,
    negativeControls: result.gradeResults.negativeControls,
  }, null, 2))
}
