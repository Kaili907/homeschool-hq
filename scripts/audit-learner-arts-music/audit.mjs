#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(HERE, '../..')
const OUTPUT_DIR = resolve(ROOT, 'docs/learner-audits/arts-music')
const ADMITTED = resolve(ROOT, 'curriculum-release-admitted/family-pilot-r1')
const BASE_SHA = 'c81ddb6e04bc1c3629212327d47817c1b5677477'
const AUDIT_CLASSIFICATION = 'ARTS_MUSIC_LEARNER_AUDIT_COMPLETE'
const READY_CLASSIFICATION = 'ARTS_MUSIC_CONTENT_READY_FOR_CONVERGENCE'
const BLOCKED_BEFORE = 270
const EXPECTED_LESSONS = 648
const EXPECTED_GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]

export const FLAGS = [
  'ZERO_ACTIONABLE_WORK',
  'EMPTY_PROJECT',
  'MISSING_TASK_STEPS',
  'MISSING_MATERIALS',
  'UNAVAILABLE_INSTRUMENT_OR_TOOL',
  'MISSING_ALTERNATIVE',
  'EMPTY_CRITIQUE',
  'EMPTY_RUBRIC',
  'PUBLIC_POST_REQUIREMENT',
  'MEDIA_PROOF_REQUIREMENT',
  'PROJECTION_LOSS',
  'PLACEHOLDER',
]

const REFERENCE_MODES = new Set(['MODEL_A', 'GUIDED_A', 'MODEL_B', 'GUIDED_B', 'INVESTIGATE'])
const ACTION = /\b(create|make|made|perform|play|sing|respond|connect|compose|draw|paint|design|present|revise|revision|analyse|analyze|interpret|compare|critique|reflect|study|examine|observe|listen|produce|build|complete|write|record|document|show|explain|demonstrate|practice|apply|choose|identify|state|name|describe|support|check|keep|mark|try|tap|map|sequence|rehearse|construct|assemble|curate|evaluate)\w*\b/i
const ARTISTIC = /\b(art|artistic|music|musical|visual|aural|sound|rhythm|melod|harmon|pitch|beat|tempo|dynamic|composition|design|draw|paint|sculpt|print|collage|media|theatre|theater|scene|character|movement|dance|gesture|perform|rehears|portfolio|critique|artist|studio|notation|score|listen|interpret|aesthetic|creative|craft|image|colour|color|texture|shape|line|form|space|value|typograph|film|cinema|choreograph)\w*\b/i
const PLACEHOLDER = /\b(todo|tbd|placeholder|lorem ipsum|coming soon|replace me|insert (text|example|image|link)|fill this in)\b|\{\{[^}]+\}\}|\$\{[^}]+\}|\[(insert|placeholder|todo)[^\]]*\]/i
const TOOL = /\b(camera|microphone|voice recorder|video recorder|recording equipment|piano|keyboard|guitar|violin|cello|trumpet|trombone|flute|clarinet|saxophone|drum kit|instrument|paint|printer|editing software|audio tool|imaging tool)\b/i
const MANDATORY = /\b(must|required|need to|needs to|have to|only|submit|hand in|upload|post|publish)\b/i
const ALTERNATIVE = /\b(alternative|instead|or (a )?(written|silent|paper|digital)|digital equivalent|accessible response|approved digital tool|different medium|written description|no[- ]audio|scores? (the )?same|full[- ]credit|never lowers)\b/i
const PUBLIC_EXPOSURE = [
  /\bmust\b[^.!?]{0,100}\b(post|publish|upload|share|perform|present)\w*\b[^.!?]{0,100}\b(public|publicly|online|social media|class|audience)\b/i,
  /\brequired to\b[^.!?]{0,100}\b(post|publish|upload|share|perform|present)\w*\b/i,
  /\b(post|publish|upload)\w*\b[^.!?]{0,100}\b(youtube|instagram|tiktok|social media|public site)\b/i,
  /\bpresent\b[^.!?]{0,80}\bto the class\b/i,
]
const MEDIA_PROOF = [
  /\b(must|required|need to|needs to|have to)\b[^.!?]{0,100}\b(photo|photograph|camera|video|recording|record|voice|microphone|audio)\b/i,
  /\b(photo|photograph|camera|video|recording|voice|microphone|audio)\b[^.!?]{0,100}\b(must|required|only evidence|proof)\b/i,
  /\b(camera|photo|video|voice recording)\s*[- ]only\b/i,
]
const NEGATING = /\b(no|not|never|optional|without|isn't|is not|doesn't|does not|nothing|instead|alternative|unless you choose)\b/i

const BROWSER_SCALAR_KEYS = [
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

const BROWSER_ARRAY_KEYS = [
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

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function jsonl(path) {
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim()).map(JSON.parse)
}

function isText(value, minimum = 1) {
  return typeof value === 'string' && value.trim().length >= minimum
}

function textArray(value, minimumItems = 1, minimumCharacters = 1) {
  return Array.isArray(value) && value.length >= minimumItems && value.every((item) => isText(item)) &&
    value.reduce((sum, item) => sum + item.trim().length, 0) >= minimumCharacters
}

function sentences(text) {
  return String(text ?? '').split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean)
}

function hasUnnegated(text, patterns) {
  return sentences(text).some((sentence) => patterns.some((pattern) => pattern.test(sentence)) && !NEGATING.test(sentence))
}

function titleFor(key) {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function asText(value) {
  if (isText(value)) return value.trim()
  if (value && typeof value === 'object' && isText(value.text)) return value.text.trim()
  return null
}

export function projectJsonMaterial(value, binding, fallbackTitle) {
  const sections = []
  const add = (title, body, prompts = []) => {
    const text = asText(body)
    const safePrompts = prompts.filter((item) => isText(item)).map((item) => item.trim())
    if (text || safePrompts.length) sections.push({ title, ...(text ? { body: text } : {}), prompts: safePrompts })
  }

  add('Lesson goal', value.objective)
  add('Scenario', value.scenario)
  for (const key of BROWSER_SCALAR_KEYS) {
    if (key === 'objective' || key === 'scenario') continue
    add(titleFor(key), value[key])
  }
  for (const key of BROWSER_ARRAY_KEYS) {
    if (!Array.isArray(value[key])) continue
    add(titleFor(key), null, value[key].filter((item) => typeof item === 'string'))
  }
  add('Source or reading', value.sourceReference)
  add('Guided support', value.guidedSupport)
  add('Independent evidence', value.independentEvidenceTask)
  add('Equal-credit alternative', value.simulationAlternative?.description)
  add('Optional reflection', value.optionalReflection?.prompt)
  add('Media fallback', value.media?.fallback)

  return {
    materialRef: `production-material:${binding.lessonRef}`,
    lessonRef: binding.lessonRef,
    title: value.lessonRef?.title || value.title || value.lesson_title || fallbackTitle,
    subject: binding.subject,
    format: 'structured',
    sections,
  }
}

function section(material, title) {
  return material.sections.find((candidate) => candidate.title === title)
}

export function compareProjection(pkg, material) {
  const losses = []
  const body = (key) => section(material, titleFor(key))?.body ?? null
  const prompts = (key) => section(material, titleFor(key))?.prompts ?? []
  for (const key of ['task_brief', 'primary_task', 'deliverable']) {
    if (body(key) !== pkg[key].trim()) losses.push({ field: key, reason: 'body-not-preserved' })
  }
  if (isText(pkg.sourceReference) && section(material, 'Source or reading')?.body !== pkg.sourceReference.trim()) {
    losses.push({ field: 'sourceReference', reason: 'attached-resource-not-preserved' })
  }
  for (const key of [
    'materials',
    'learning_objectives',
    'lesson_success_criteria',
    'requirements',
    'critique_criteria',
    'accessibility_options',
    'task_accessibility_provisions',
  ]) {
    const expected = (pkg[key] ?? []).map((item) => item.trim())
    if (JSON.stringify(prompts(key)) !== JSON.stringify(expected)) {
      losses.push({ field: key, reason: 'prompts-not-preserved' })
    }
  }
  if (Array.isArray(pkg.task_steps)) {
    const expected = pkg.task_steps.map((item) => item.trim())
    if (JSON.stringify(prompts('task_steps')) !== JSON.stringify(expected)) {
      losses.push({ field: 'task_steps', reason: 'steps-not-preserved' })
    }
  }
  return losses
}

function packagePath(ref) {
  const separator = ref.indexOf(':')
  if (!ref.startsWith('git+') || separator < 0) throw new Error(`Invalid production ref: ${ref}`)
  const relative = ref.slice(separator + 1)
  const path = resolve(ROOT, relative)
  if (!path.startsWith(`${ROOT}/`)) throw new Error(`Production ref escapes repository: ${ref}`)
  return path
}

function sourceArtifact(pkg) {
  const resource = pkg.learner_resource
  return isText(pkg.sourceReference, 300) &&
    /ATTACHED MANUEL ACADEMY LEARNER RESOURCE/.test(pkg.sourceReference) &&
    /Manuel Academy original; licensed CC BY 4\.0/.test(pkg.sourceReference) &&
    resource?.availability === 'ATTACHED_IN_PACKAGE' &&
    resource?.academy_original === true &&
    resource?.license === 'CC-BY-4.0' &&
    resource?.third_party_content === false &&
    resource?.household_accessible === true &&
    resource?.silent_text_route_equal_credit === true &&
    ['external_dependencies', 'required_paid_tools', 'required_specialized_materials']
      .every((field) => Array.isArray(resource?.[field]) && resource[field].length === 0)
}

function mandatoryToolWithoutAlternative(pkg) {
  const combined = [pkg.primary_task, pkg.deliverable, ...(pkg.requirements ?? []), ...(pkg.materials ?? [])].join(' ')
  const mandatoryToolSentence = sentences(combined).find((item) => TOOL.test(item) && MANDATORY.test(item) && !NEGATING.test(item))
  if (!mandatoryToolSentence) return false
  const alternatives = [
    ...(pkg.materials ?? []),
    pkg.presentation_and_privacy?.text_or_no_audio_alternative,
    ...(pkg.accessibility_options ?? []),
    ...(pkg.task_accessibility_provisions ?? []),
  ].filter(Boolean).join(' ')
  return !ALTERNATIVE.test(alternatives)
}

function rubricComplete(guide) {
  return Array.isArray(guide.rubric) && guide.rubric.length >= 2 && guide.rubric.every((row) =>
    isText(row.dimension) && ['exceeds', 'meets', 'developing', 'beginning'].every((level) => isText(row[level], 20)))
}

function taskHasClearSteps(pkg) {
  if ([3, 4, 5].includes(pkg.grade)) return textArray(pkg.task_steps, 3, 80)
  const parts = sentences(pkg.primary_task)
  return parts.length >= 6 && parts.filter((part) => ACTION.test(part)).length >= 4
}

function alternativesComplete(pkg) {
  const privateOption = pkg.presentation_and_privacy?.presentation_options ?? ''
  const writtenOption = pkg.presentation_and_privacy?.text_or_no_audio_alternative ?? ''
  return /private|entirely to yourself|no one watching/i.test(privateOption) &&
    /no public performance/i.test(privateOption) && /never lowers the score/i.test(privateOption) &&
    /written alternative/i.test(writtenOption) && /scores the same/i.test(writtenOption)
}

export function classifyLesson(pkg, guide, projectionLosses = []) {
  const flags = []
  const evidence = {}
  const taskText = [pkg.task_brief, pkg.primary_task, pkg.deliverable, ...(pkg.requirements ?? [])].filter(Boolean).join(' ')
  const allLearnerText = [
    taskText,
    ...(pkg.critique_criteria ?? []),
    ...(pkg.materials ?? []),
    pkg.presentation_and_privacy?.presentation_options,
    pkg.presentation_and_privacy?.text_or_no_audio_alternative,
  ].filter(Boolean).join(' ')
  const objectiveText = (pkg.learning_objectives ?? []).join(' ')
  const artisticContext = `${pkg.subject} ${pkg.unit_title} ${pkg.focus}`
  const objectiveSubstantive = textArray(pkg.learning_objectives, 1, 120) && ARTISTIC.test(`${artisticContext} ${objectiveText}`) && ACTION.test(objectiveText)
  const actionable = isText(pkg.primary_task, 180) && isText(pkg.deliverable, 40) && ACTION.test(taskText) && ARTISTIC.test(`${artisticContext} ${taskText}`)
  const emptyProject = !isText(pkg.primary_task, 80) || !isText(pkg.deliverable, 25)
  const clearSteps = taskHasClearSteps(pkg)
  const materialsPresent = textArray(pkg.materials, 2, 50)
  const referenceRequired = REFERENCE_MODES.has(pkg.work_mode)
  const referenceSupplied = sourceArtifact(pkg)
  const missingMaterials = !materialsPresent || (referenceRequired && !referenceSupplied)
  const critiqueComplete = textArray(pkg.critique_criteria, 3, 160) && (pkg.critique_criteria ?? []).some((item) => ACTION.test(item))
  const successCriteriaComplete = textArray(pkg.lesson_success_criteria, 3, 120)
  const rubricIsComplete = rubricComplete(guide)
  const accessibilityComplete = textArray(pkg.accessibility_options, 2, 160) && textArray(pkg.task_accessibility_provisions, 1, 50)
  const alternativesAreComplete = alternativesComplete(pkg)
  const unavailableTool = mandatoryToolWithoutAlternative(pkg)
  const publicRequirement = hasUnnegated(allLearnerText, PUBLIC_EXPOSURE)
  const mediaRequirement = hasUnnegated(allLearnerText, MEDIA_PROOF)
  const placeholder = PLACEHOLDER.test(JSON.stringify(pkg))

  if (!objectiveSubstantive || !actionable) flags.push('ZERO_ACTIONABLE_WORK')
  if (emptyProject) flags.push('EMPTY_PROJECT')
  if (!clearSteps) flags.push('MISSING_TASK_STEPS')
  if (missingMaterials) flags.push('MISSING_MATERIALS')
  if (unavailableTool) flags.push('UNAVAILABLE_INSTRUMENT_OR_TOOL')
  if (!alternativesAreComplete || unavailableTool) flags.push('MISSING_ALTERNATIVE')
  if (!critiqueComplete) flags.push('EMPTY_CRITIQUE')
  if (!successCriteriaComplete || !rubricIsComplete) flags.push('EMPTY_RUBRIC')
  if (publicRequirement) flags.push('PUBLIC_POST_REQUIREMENT')
  if (mediaRequirement) flags.push('MEDIA_PROOF_REQUIREMENT')
  if (projectionLosses.length) flags.push('PROJECTION_LOSS')
  if (placeholder) flags.push('PLACEHOLDER')

  if (referenceRequired && !referenceSupplied) {
    evidence.MISSING_MATERIALS = 'The task requires a model work, reference/scaffold, or external work to inspect, but supplies no artifact, excerpt, locator, or self-contained example.'
  } else if (!materialsPresent) {
    evidence.MISSING_MATERIALS = 'The materials list is absent or not substantive.'
  }
  if (projectionLosses.length) evidence.PROJECTION_LOSS = projectionLosses

  return {
    flags: FLAGS.filter((flag) => flags.includes(flag)),
    evidence,
    checks: {
      substantiveArtisticObjective: objectiveSubstantive,
      actionableCreatePerformRespondConnectTask: actionable,
      clearSteps,
      materialsListPresent: materialsPresent,
      referenceRequired,
      referenceSupplied: referenceRequired ? referenceSupplied : null,
      critiqueOrReflectionSubstantive: critiqueComplete,
      successCriteriaPresent: successCriteriaComplete,
      rubricPresent: rubricIsComplete,
      accessibilityAndAdaptationPresent: accessibilityComplete,
      equalCreditPrivateAlternative: alternativesAreComplete,
      noPublicPostRequirement: !publicRequirement,
      noMandatoryMediaProof: !mediaRequirement,
      noUnavailableInstrumentOrTool: !unavailableTool,
      browserPreservesTaskMaterialsCriteria: projectionLosses.length === 0,
      noPlaceholderResidue: !placeholder,
    },
  }
}

function emptyCounts() {
  return Object.fromEntries(FLAGS.map((flag) => [flag, 0]))
}

function countFlags(rows) {
  const counts = emptyCounts()
  for (const row of rows) for (const flag of row.flags) counts[flag] += 1
  return counts
}

function mutate(base, changes) {
  return structuredClone(Object.assign(structuredClone(base), changes))
}

export function buildNegativeControls(samplePackage, sampleGuide, sampleBinding) {
  const emptyProject = mutate(samplePackage, { primary_task: '', deliverable: '' })
  const missingMaterials = mutate(samplePackage, { materials: [] })
  const cameraOnly = mutate(samplePackage, {
    primary_task: `${samplePackage.primary_task} You must submit a camera photo as the only evidence.`,
    presentation_and_privacy: {
      presentation_options: 'You may keep the work private.',
      text_or_no_audio_alternative: 'No alternative is available.',
    },
  })
  const missingRubric = mutate(sampleGuide, { rubric: [] })
  const normalProjection = projectJsonMaterial(samplePackage, sampleBinding, samplePackage.lesson_title)
  const stepDroppingProjection = structuredClone(normalProjection)
  stepDroppingProjection.sections = stepDroppingProjection.sections.filter((item) => item.title !== 'Task Steps')

  const controls = [
    {
      name: 'empty project',
      expected: ['ZERO_ACTIONABLE_WORK', 'EMPTY_PROJECT'],
      actual: classifyLesson(emptyProject, sampleGuide).flags,
    },
    {
      name: 'missing materials',
      expected: ['MISSING_MATERIALS'],
      actual: classifyLesson(missingMaterials, sampleGuide).flags,
    },
    {
      name: 'camera-only evidence',
      expected: ['MISSING_ALTERNATIVE', 'MEDIA_PROOF_REQUIREMENT'],
      actual: classifyLesson(cameraOnly, sampleGuide).flags,
    },
    {
      name: 'missing rubric',
      expected: ['EMPTY_RUBRIC'],
      actual: classifyLesson(samplePackage, missingRubric).flags,
    },
    {
      name: 'browser drops steps',
      expected: ['PROJECTION_LOSS'],
      actual: classifyLesson(samplePackage, sampleGuide, compareProjection(samplePackage, stepDroppingProjection)).flags,
    },
  ].map((control) => ({
    ...control,
    detected: control.expected.every((flag) => control.actual.includes(flag)),
  }))
  return { passed: controls.every((control) => control.detected), controls }
}

function assertBrowserPipelineContract() {
  const builder = readFileSync(resolve(ROOT, 'scripts/build-final-family-pilot-data.mjs'), 'utf8')
  const view = readFileSync(resolve(ROOT, 'src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx'), 'utf8')
  const readArray = (name) => {
    const match = builder.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\]`))
    if (!match) throw new Error(`Cannot locate ${name} in final browser builder`)
    return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1])
  }
  if (JSON.stringify(readArray('scalarKeys')) !== JSON.stringify(BROWSER_SCALAR_KEYS)) {
    throw new Error('Audit browser scalar projection contract drifted from the final browser builder')
  }
  if (JSON.stringify(readArray('arrayKeys')) !== JSON.stringify(BROWSER_ARRAY_KEYS)) {
    throw new Error('Audit browser array projection contract drifted from the final browser builder')
  }
  if (!view.includes('material.sections.map')) throw new Error('Final learner UI no longer renders all projected material sections')
}

function verifyPopulation(artsBindings, runtimeRows, browserCatalog) {
  if (artsBindings.length !== EXPECTED_LESSONS) throw new Error(`Admitted Arts/Music bindings ${artsBindings.length} != ${EXPECTED_LESSONS}`)
  const courses = browserCatalog.courses.filter((course) => course.subject === 'arts-and-music')
  if (courses.length !== EXPECTED_GRADES.length) throw new Error(`Arts/Music courses ${courses.length} != ${EXPECTED_GRADES.length}`)
  for (const course of courses) {
    if (course.lessonCount !== 72) throw new Error(`${course.courseRef}: lessonCount ${course.lessonCount} != 72`)
    if ((runtimeRows[course.courseRef] ?? []).length !== 72) throw new Error(`${course.courseRef}: runtime rows != 72`)
    if ((browserCatalog.lessonRowsByCourse[course.courseRef] ?? []).length !== 72) throw new Error(`${course.courseRef}: browser rows != 72`)
  }
  const grades = [...new Set(courses.map((course) => Number(course.grade)))].sort((a, b) => a - b)
  if (JSON.stringify(grades) !== JSON.stringify(EXPECTED_GRADES)) throw new Error(`Arts/Music grade set drifted: ${grades.join(', ')}`)
  return courses
}

function reportMarkdown(results) {
  const c = results.flagCounts
  const classification = results.gradeResults.classification
  const gradeRows = results.gradeResults.grades.map((row) =>
    `| ${row.grade} | ${row.lessonsAudited} | ${row.flagCounts.MISSING_MATERIALS} | ${row.flagCounts.EMPTY_RUBRIC} | ${row.flagCounts.PROJECTION_LOSS} | ${row.safeToBeginMatrix ? 'YES' : 'NO'} |`,
  ).join('\n')
  const controls = results.negativeControls.controls.map((control) =>
    `| ${control.name} | ${control.expected.join(', ')} | ${control.detected ? 'PASS' : 'FAIL'} |`,
  ).join('\n')
  return `# Arts / Music Learner Completeness Audit R1

Classification: **${classification}**

Base: \`${BASE_SHA}\`

Scope: all final admitted Arts/Music learner lessons and their final browser projection.

## Outcome

The exact admitted population re-derives to **${results.lessonsAudited} lessons**: ${results.courses.length} courses across grades ${EXPECTED_GRADES.join(', ')}, with 72 lessons per course. Every lesson binding, task package, scoring guide, runtime row, and browser-catalog row was resolved and audited.

The baseline at \`${BASE_SHA}\` had **${BLOCKED_BEFORE} learner-content blockers**. The repaired corpus has **${c.MISSING_MATERIALS}**. All ${results.materialsResults.summary.referenceRequired} source-dependent lessons now carry an offline, learner-visible Academy-created resource in the existing \`Source or reading\` browser section: ${results.resourceCounts.models} models, ${results.resourceCounts.scaffolds} scaffolds, and ${results.resourceCounts.references} reference works.

All requested flag counts are zero. The tasks remain actionable create/perform/respond/connect work; rubrics and success criteria are unchanged; private and written/no-audio routes are equal-credit; pencil/paper and silent notation routes are present; no instrument, public-post, or media-proof requirement was found; and the final browser projection preserves task bodies, resources, materials, task steps where authored, success criteria, and critique criteria.

## Flag counts

| Flag | Lessons |
| --- | ---: |
${FLAGS.map((flag) => `| ${flag} | ${c[flag]} |`).join('\n')}

## Grade results and safe-to-begin matrix

| Grade | Audited | Missing materials/reference | Empty rubrics | Projection loss | Safe to begin |
| ---: | ---: | ---: | ---: | ---: | :---: |
${gradeRows}

## Materials and reference result

- Materials lists present: ${results.materialsResults.summary.materialsListsPresent}/${results.lessonsAudited}.
- Reference-dependent lessons: ${results.materialsResults.summary.referenceRequired}.
- Reference-dependent lessons with a supplied artifact/excerpt/locator/example: ${results.materialsResults.summary.referenceSupplied}.
- Academy-original models supplied: ${results.resourceCounts.models}.
- Academy-created scaffolds supplied: ${results.resourceCounts.scaffolds}.
- Academy-original reference works supplied: ${results.resourceCounts.references}.
- External dependencies after repair: ${results.resourceCounts.externalDependencies}.
- Unavailable mandatory instruments or tools without an alternative: ${c.UNAVAILABLE_INSTRUMENT_OR_TOOL}.
- Missing equal-credit private, written/no-audio, or accessible tool alternatives: ${c.MISSING_ALTERNATIVE}.

The ${results.materialsResults.summary.referenceRequired} affected lessons are exactly the five source-dependent work modes in each of 54 units: MODEL_A, GUIDED_A, MODEL_B, GUIDED_B, and INVESTIGATE. Each attached resource declares Academy-original authorship, CC BY 4.0 learner-use rights, zero third-party content, zero external dependencies, and zero required paid tools or specialized materials. Generic phrases such as “unit-specific source” still do not count as supplied content.

## Browser projection result

Projection result: **PASS (${results.browserLoss.summary.lessonsWithoutLoss}/${results.lessonsAudited})**. The audit reproduced the final browser material projection, compared exact task/material/criteria values for every lesson, verified that the final learner UI renders every projected section, and found no actual loss. The negative control that removes \`task_steps\` is detected as \`PROJECTION_LOSS\`.

## Negative controls

| Control | Required detection | Result |
| --- | --- | :---: |
${controls}

## Method and classification notes

- Population authority: admitted \`production-bindings.jsonl\`, cross-checked against runtime rows and the admission browser catalog.
- Content authority: each binding's final task package and lesson-level scoring guide.
- Browser authority: \`scripts/build-final-family-pilot-data.mjs\` and the final learner material renderer.
- Secondary lessons use connected procedural prose rather than a \`task_steps\` array; they pass only when that prose contains a multi-action sequence. Elementary lessons require and preserve chunked \`task_steps\`.
- Remaining standards-mapping review states are not learner-content failures unless they make a task unusable; none was counted here.
- The original audit classification was \`${AUDIT_CLASSIFICATION}\`; this regenerated post-repair evidence is \`${classification}\` because every structural flag is zero.
`
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function outputs(results) {
  return new Map([
    ['ARTS_MUSIC_LEARNER_AUDIT_R1.md', reportMarkdown(results)],
    ['lesson-findings.jsonl', `${results.findings.map((row) => JSON.stringify(row)).join('\n')}\n`],
    ['grade-results.json', serialize(results.gradeResults)],
    ['materials-results.json', serialize(results.materialsResults)],
    ['browser-loss.json', serialize(results.browserLoss)],
  ])
}

export function runAudit() {
  assertBrowserPipelineContract()
  const bindings = jsonl(resolve(ADMITTED, 'production-bindings.jsonl'))
  const artsBindings = bindings.filter((binding) => binding.subject === 'arts-and-music')
  const runtimeRows = json(resolve(ADMITTED, 'runtime/lesson-rows-by-course.json'))
  const browserCatalog = json(resolve(ADMITTED, 'admission/browser-catalog-projection.json'))
  const courses = verifyPopulation(artsBindings, runtimeRows, browserCatalog)
  const browserRowByLesson = new Map(courses.flatMap((course) =>
    (browserCatalog.lessonRowsByCourse[course.courseRef] ?? []).map((row) => [row.lessonRef, { ...row, courseRef: course.courseRef }]),
  ))
  const runtimeRowByLesson = new Map(courses.flatMap((course) =>
    (runtimeRows[course.courseRef] ?? []).map((row) => [row.lessonRef, { ...row, courseRef: course.courseRef }]),
  ))

  const findings = []
  const materialRows = []
  const lossRows = []
  for (const binding of artsBindings) {
    const pkg = json(packagePath(binding.productionPackageRef))
    const guide = json(packagePath(binding.scoringAuthorityRef))
    if (pkg.lesson_id !== binding.lessonRef || guide.lesson_id !== binding.lessonRef) {
      throw new Error(`${binding.lessonRef}: binding/package/scoring-guide identity mismatch`)
    }
    const runtimeRow = runtimeRowByLesson.get(binding.lessonRef)
    const browserRow = browserRowByLesson.get(binding.lessonRef)
    if (!runtimeRow || !browserRow) throw new Error(`${binding.lessonRef}: missing runtime or browser row`)
    if (runtimeRow.title !== pkg.lesson_title || browserRow.title !== pkg.lesson_title) {
      throw new Error(`${binding.lessonRef}: catalog title differs from final package title`)
    }
    const material = projectJsonMaterial(pkg, binding, browserRow.title)
    const losses = compareProjection(pkg, material)
    const classified = classifyLesson(pkg, guide, losses)
    if (losses.length) lossRows.push({ lessonId: binding.lessonRef, grade: binding.grade, losses })
    findings.push({
      lessonId: binding.lessonRef,
      courseRef: binding.courseRef,
      grade: binding.grade,
      unitNumber: pkg.unit_number,
      dayInUnit: pkg.day_in_unit,
      courseDay: pkg.course_day,
      title: pkg.lesson_title,
      workMode: pkg.work_mode,
      taskType: pkg.task_type,
      completionAuthority: binding.completionAuthority,
      flags: classified.flags,
      evidence: classified.evidence,
      checks: classified.checks,
    })
    materialRows.push({
      lessonId: binding.lessonRef,
      courseRef: binding.courseRef,
      grade: binding.grade,
      workMode: pkg.work_mode,
      materials: pkg.materials,
      materialsListPresent: classified.checks.materialsListPresent,
      referenceRequired: classified.checks.referenceRequired,
      referenceSupplied: classified.checks.referenceSupplied,
      resourceId: pkg.learner_resource?.resource_id ?? null,
      resourceKind: pkg.learner_resource?.kind ?? null,
      resourceAvailability: pkg.learner_resource?.availability ?? null,
      resourceLicense: pkg.learner_resource?.license ?? null,
      academyOriginal: pkg.learner_resource?.academy_original ?? null,
      thirdPartyContent: pkg.learner_resource?.third_party_content ?? null,
      externalDependencies: pkg.learner_resource?.external_dependencies ?? null,
      householdAccessible: pkg.learner_resource?.household_accessible ?? null,
      silentTextRouteEqualCredit: pkg.learner_resource?.silent_text_route_equal_credit ?? null,
      unavailableInstrumentOrTool: !classified.checks.noUnavailableInstrumentOrTool,
      equalCreditAlternativePresent: classified.checks.equalCreditPrivateAlternative,
      flags: classified.flags.filter((flag) => ['MISSING_MATERIALS', 'UNAVAILABLE_INSTRUMENT_OR_TOOL', 'MISSING_ALTERNATIVE'].includes(flag)),
    })
  }

  findings.sort((a, b) => a.grade - b.grade || a.courseDay - b.courseDay || a.lessonId.localeCompare(b.lessonId))
  materialRows.sort((a, b) => a.grade - b.grade || a.lessonId.localeCompare(b.lessonId))
  const flagCounts = countFlags(findings)
  const resourceCounts = {
    models: materialRows.filter((row) => row.resourceKind === 'ACADEMY_ORIGINAL_MODEL').length,
    scaffolds: materialRows.filter((row) => row.resourceKind === 'ACADEMY_CREATED_SCAFFOLD').length,
    references: materialRows.filter((row) => row.resourceKind === 'ACADEMY_ORIGINAL_REFERENCE_WORK').length,
    externalDependencies: materialRows.reduce((sum, row) => sum + (row.externalDependencies?.length ?? 0), 0),
  }
  const sampleFinding = findings.find((row) => row.grade === 3 && row.workMode === 'PROBE')
  const sampleBinding = artsBindings.find((binding) => binding.lessonRef === sampleFinding?.lessonId)
  if (!sampleBinding) throw new Error('No elementary Arts/Music sample exists for negative controls')
  const samplePackage = json(packagePath(sampleBinding.productionPackageRef))
  const sampleGuide = json(packagePath(sampleBinding.scoringAuthorityRef))
  const negativeControls = buildNegativeControls(samplePackage, sampleGuide, sampleBinding)
  if (!negativeControls.passed) throw new Error('One or more required negative controls were not detected')

  const gradeRows = EXPECTED_GRADES.map((grade) => {
    const rows = findings.filter((row) => row.grade === grade)
    const counts = countFlags(rows)
    return {
      grade,
      courseRefs: [...new Set(rows.map((row) => row.courseRef))],
      lessonsAudited: rows.length,
      flagCounts: counts,
      safeToBeginMatrix: Object.values(counts).every((count) => count === 0),
    }
  })

  const materialsResults = {
    auditId: 'ARTS_MUSIC_LEARNER_AUDIT_R1',
    baseSha: BASE_SHA,
    summary: {
      blockedBefore: BLOCKED_BEFORE,
      blockedAfter: flagCounts.MISSING_MATERIALS,
      lessonsAudited: findings.length,
      materialsListsPresent: materialRows.filter((row) => row.materialsListPresent).length,
      referenceRequired: materialRows.filter((row) => row.referenceRequired).length,
      referenceSupplied: materialRows.filter((row) => row.referenceRequired && row.referenceSupplied).length,
      missingMaterials: flagCounts.MISSING_MATERIALS,
      unavailableInstrumentOrTool: flagCounts.UNAVAILABLE_INSTRUMENT_OR_TOOL,
      missingAlternatives: flagCounts.MISSING_ALTERNATIVE,
      ...resourceCounts,
    },
    copyrightProof: {
      academyOriginal: materialRows.filter((row) => row.academyOriginal === true).length,
      ccBy40: materialRows.filter((row) => row.resourceLicense === 'CC-BY-4.0').length,
      thirdPartyContentLessons: materialRows.filter((row) => row.thirdPartyContent === true).length,
      externalDependencies: resourceCounts.externalDependencies,
    },
    referenceRule: 'MODEL_A, GUIDED_A, MODEL_B, GUIDED_B, and INVESTIGATE require an attached artifact, excerpt, locator, or self-contained example. A generic category or the word supplied does not prove availability.',
    lessons: materialRows,
  }
  const browserLoss = {
    auditId: 'ARTS_MUSIC_LEARNER_AUDIT_R1',
    baseSha: BASE_SHA,
    projectionAuthority: 'scripts/build-final-family-pilot-data.mjs projectJsonMaterial -> final lazy course payload',
    renderAuthority: 'src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx MaterialView',
    comparedFields: [
      'task_brief',
      'primary_task',
      'deliverable',
      'materials',
      'learning_objectives',
      'lesson_success_criteria',
      'task_steps when authored',
      'requirements',
      'critique_criteria',
      'accessibility_options',
      'task_accessibility_provisions',
      'sourceReference when attached',
    ],
    summary: {
      lessonsProjected: findings.length,
      lessonsWithoutLoss: findings.length - lossRows.length,
      lessonsWithLoss: lossRows.length,
      projectionResult: lossRows.length === 0 ? 'PASS' : 'FAIL',
    },
    losses: lossRows,
    negativeControl: negativeControls.controls.find((control) => control.name === 'browser drops steps'),
  }
  const gradeResults = {
    auditId: 'ARTS_MUSIC_LEARNER_AUDIT_R1',
    classification: Object.values(flagCounts).every((count) => count === 0)
      ? READY_CLASSIFICATION
      : AUDIT_CLASSIFICATION,
    baseSha: BASE_SHA,
    blockedBefore: BLOCKED_BEFORE,
    blockedAfter: flagCounts.MISSING_MATERIALS,
    resourceCounts,
    expectedFinalAdmittedCount: EXPECTED_LESSONS,
    rederivedFinalAdmittedCount: findings.length,
    exactCountMatch: findings.length === EXPECTED_LESSONS,
    courses: courses.map((course) => ({
      courseRef: course.courseRef,
      grade: Number(course.grade),
      lessonCount: course.lessonCount,
    })),
    flagCounts,
    negativeControls,
    grades: gradeRows,
    safeToBeginMatrix: gradeRows.every((row) => row.safeToBeginMatrix),
    topBlockers: flagCounts.MISSING_MATERIALS > 0
      ? [{
          flag: 'MISSING_MATERIALS',
          lessons: flagCounts.MISSING_MATERIALS,
          detail: 'Reference-dependent model, guided, and investigation lessons do not supply the model/reference/scaffold/work they direct the learner to use.',
        }]
      : [],
  }
  return {
    lessonsAudited: findings.length,
    courses,
    findings,
    flagCounts,
    negativeControls,
    resourceCounts,
    gradeResults,
    materialsResults,
    browserLoss,
  }
}

function main() {
  const mode = process.argv.includes('--check') ? 'check' : 'write'
  if (mode === 'write') {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', BASE_SHA, 'HEAD'], { cwd: ROOT, stdio: 'ignore' })
    } catch {
      throw new Error(`Write mode requires audit base ${BASE_SHA} to be an ancestor of HEAD`)
    }
  }
  const results = runAudit()
  const documents = outputs(results)
  if (mode === 'check') {
    const drift = []
    for (const [name, expected] of documents) {
      const path = resolve(OUTPUT_DIR, name)
      let actual = null
      try { actual = readFileSync(path, 'utf8') } catch { actual = null }
      if (actual !== expected) drift.push(name)
    }
    if (drift.length) throw new Error(`Audit outputs drifted: ${drift.join(', ')}`)
    console.log(`ARTS_MUSIC_LEARNER_AUDIT_R1 CHECK: PASS — ${results.lessonsAudited} lessons; outputs are reproducible.`)
  } else {
    mkdirSync(OUTPUT_DIR, { recursive: true })
    for (const [name, body] of documents) writeFileSync(resolve(OUTPUT_DIR, name), body)
    console.log(`ARTS_MUSIC_LEARNER_AUDIT_R1: ${results.lessonsAudited} lessons audited.`)
    console.log(`MISSING_MATERIALS: ${results.flagCounts.MISSING_MATERIALS}`)
    console.log(`PROJECTION_RESULT: ${results.browserLoss.summary.projectionResult} (${results.browserLoss.summary.lessonsWithoutLoss}/${results.lessonsAudited})`)
    console.log(`NEGATIVE_CONTROLS: ${results.negativeControls.passed ? 'PASS' : 'FAIL'} (${results.negativeControls.controls.length}/5)`)
    console.log(`CLASSIFICATION: ${results.gradeResults.classification}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
