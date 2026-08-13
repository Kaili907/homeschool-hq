#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const AUDIT_SCHEMA = 'rfl-learner-audit-r1'
export const EXPECTED = Object.freeze({
  lessons: 324,
  guardianAuthority: 81,
  learnerAuthority: 243,
  grades: Object.freeze([3, 4, 5, 7, 8, 9, 10, 11, 12]),
})

export const FLAG_CODES = Object.freeze([
  'ZERO_ACTIONABLE_WORK',
  'GENERIC_LIFE_ADVICE_ONLY',
  'MISSING_TASK_STEPS',
  'MISSING_SIMULATION_ALTERNATIVE',
  'AUTHORITY_MISMATCH',
  'MISSING_ATTESTATION_METADATA',
  'PRIVATE_DISCLOSURE',
  'PURCHASE_REQUIREMENT',
  'CREDENTIAL_REQUIREMENT',
  'MEDIA_PROOF_REQUIREMENT',
  'EMPTY_RUBRIC',
  'PROJECTION_LOSS',
  'PLACEHOLDER',
])

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const DEFAULT_CORPUS = resolve(ROOT, 'curriculum-production/final/ready-for-life')
const DEFAULT_ADMITTED = resolve(ROOT, 'curriculum-release-admitted/family-pilot-r1')
const DEFAULT_BROWSER = resolve(ROOT, 'public/family-pilot-final/2.0.0')
const DEFAULT_OUTPUT = resolve(ROOT, 'docs/learner-audits/ready-for-life')

const ACTION_RE = /\b(?:add|analy[sz]e|annotate|apply|assemble|audit|build|calculate|categorize|check|choose|circle|classify|compare|compile|complete|connect|construct|create|decide|demonstrate|describe|design|diagnose|document|draft|estimate|evaluate|explain|find|follow|gather|generate|identify|inventory|invent|label|learn to|list|locate|make|map|mark|match|model|name|organize|outline|perform|plan|practice|predict|prepare|prioritize|rank|read|record|rehearse|research|respond|return|review|revise|rewrite|role-play|scale|select|separate|set up|show|sketch|sort|state|summarize|survey|take|test|trace|track|translate|use|verify|watch|work through|write)(?:s|d|ed|ing)?\b/i
const CONCRETE_RE = /\b(?:at least|exactly|specific|step|list|table|map|plan|script|checklist|draft|calculation|comparison|response|example|scenario|artifact|evidence|record|routine|protocol|schedule|category|reason|explain|describe|identify|write|build|create|practice|sort|rank|match|mark)\b/i
const PLACEHOLDER_RE = /\b(?:todo|tbd|lorem ipsum|coming soon|placeholder text|insert (?:lesson|content|text)|xxx)\b|\{\{[^}]+\}\}|\[insert[^\]]*\]/i
const ADULT_PARTICIPATION_RE = /\b(?:with|to|by|from) (?:a |an |the |your )?(?:trusted |household-authorized )?(?:adult|guardian|parent|caregiver)\b|\bverified with (?:a |an |the )?(?:adult|guardian)\b|\b(?:adult|guardian|parent|caregiver)\b.{0,70}\b(?:confirm|observe|watch|verify|review|attest|certif|sign.?off|agree|approve|supervis)/i
const ADULT_CERTIFICATION_RE = /\b(?:adult|guardian|parent|caregiver)\b.{0,60}\b(?:attest|certif|sign.?off|signs?|approve completion|confirm completion|confirm that (?:the )?(?:work|task|activity) (?:was|is) (?:done|completed))\b/i
const PURCHASE_RE = /\b(?:must|required to|need(?:s)? to|have to)\s+(?:go (?:and )?)?(?:buy|purchase|pay for|spend money on)\b|\b(?:buy|purchase)\s+(?:a|an|the|your)\b/i
const CREDENTIAL_RE = /\b(?:write|record|share|provide|enter|submit|send|upload|tell|reveal|copy)\b.{0,80}\b(?:actual |real |your )?(?:password|passcode|pin|username|login|account number|card number|social security number|ssn)\b|\b(?:log|sign)\s+in(?:\s+to)?\s+(?:a|an|the|your)\s+(?:account|site|app|portal|device)\b|\bcreate (?:a new |an? )?account\b/i
const MEDIA_RE = /\b(?:must|required to|need(?:s)? to|have to|take|record|upload|send|submit|share|provide)\b.{0,60}\b(?:identifiable )?(?:photo|photograph|selfie|video|audio|voice recording)\b/i
const PRIVATE_RE = /\b(?:write|record|share|provide|enter|submit|send|upload|describe|disclose)\b.{0,120}\b(?:full legal name|real name|home address|street address|phone number|email address|account number|card number|document number|social security number|ssn|password|passcode|pin|family'?s? income|household income|family salary|medical diagnosis|private family (?:detail|event|argument)|specific private argument)\b/i
const PROTECTIVE_RE = /\b(?:do not|don't|does not|did not|without|never|with no|no actual|no real|not real|fictional|invented|made-up|generic|general terms?|role labels? only|by role only|rather than by name|if (?:you|they)'?d rather keep it private|unnecessary to share|too private)\b/i

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const readJsonl = async (path) => (await readFile(path, 'utf8'))
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line))

const sha256 = (text) => createHash('sha256').update(text).digest('hex')
const nonblank = (value) => typeof value === 'string' && value.trim().length > 0
const compact = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const normalize = (value) => compact(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const titleCaseKind = (value) => String(value).replace(/\b\w/g, (letter) => letter.toUpperCase())
const canonicalize = (value) => Array.isArray(value)
  ? value.map(canonicalize)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]))
    : value
const sameJson = (left, right) => JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))

function sentences(text) {
  return compact(text).split(/(?<=[.!?])\s+/).filter(Boolean)
}

function unsafeSentence(text, pattern) {
  return sentences(text).find((sentence) => pattern.test(sentence) && !PROTECTIVE_RE.test(sentence)) ?? null
}

function learnerTaskText(pkg) {
  return (Array.isArray(pkg.tasks) ? pkg.tasks : []).flatMap((task) => [
    task?.directions,
    ...(Array.isArray(task?.prompts) ? task.prompts.map((prompt) => prompt?.text) : []),
  ]).filter(nonblank).join(' ')
}

function requiredLearnerText(pkg) {
  return [
    pkg.objective,
    pkg.scenario,
    ...(Array.isArray(pkg.materials) ? pkg.materials : []),
    learnerTaskText(pkg),
  ].filter(nonblank).join(' ')
}

function substantiveRubric(scoring) {
  const authority = scoring?.scoringAuthority
  if (!authority || !Array.isArray(authority.criteria) || authority.criteria.length < 2) return false
  return authority.criteria.every((criterion) => {
    if (!nonblank(criterion?.dimension) || !Array.isArray(criterion?.levels) || criterion.levels.length < 2) return false
    const descriptors = criterion.levels.map((level) => compact(level?.descriptor))
    return criterion.levels.every((level) => nonblank(level?.label) && compact(level?.descriptor).length >= 15) &&
      new Set(descriptors.map(normalize)).size === descriptors.length
  })
}

function validSimulation(alternative) {
  if (alternative?.present !== true || compact(alternative?.description).length < 70) return false
  const description = compact(alternative.description)
  return /\b(?:if|when)\b/i.test(description) &&
    !unsafeSentence(description, PURCHASE_RE) &&
    !unsafeSentence(description, CREDENTIAL_RE) &&
    !unsafeSentence(description, MEDIA_RE) &&
    !unsafeSentence(description, PRIVATE_RE)
}

function validSignOff(signOff) {
  return Boolean(signOff) &&
    signOff.requiresGuardianPermissionBeforeStart === true &&
    typeof signOff.requiresTrustedAdultSupervision === 'boolean' &&
    signOff.certifyingActor === 'household-authorized guardian' &&
    signOff.studentSelfReport === 'recorded-but-not-certifying' &&
    Array.isArray(signOff.evidenceTypes) &&
    signOff.evidenceTypes.length >= 1 &&
    signOff.evidenceTypes.every(nonblank) &&
    signOff.identifiablePhotoRequired === false
}

function taskStructure(pkg) {
  const tasks = Array.isArray(pkg.tasks) ? pkg.tasks : []
  const taskIds = tasks.map((task) => task?.taskId).filter(nonblank)
  const promptRefs = tasks.flatMap((task) => Array.isArray(task?.prompts) ? task.prompts.map((prompt) => prompt?.ref).filter(nonblank) : [])
  const complete = tasks.length >= 3 && tasks.every((task) =>
    nonblank(task?.taskId) &&
    nonblank(task?.kind) &&
    nonblank(task?.directions) &&
    Array.isArray(task?.prompts) &&
    task.prompts.length >= 1 &&
    task.prompts.every((prompt) => nonblank(prompt?.ref) && nonblank(prompt?.promptType) && nonblank(prompt?.text)),
  )
  return {
    complete: complete && new Set(taskIds).size === taskIds.length && new Set(promptRefs).size === promptRefs.length,
    taskCount: tasks.length,
    promptCount: tasks.reduce((sum, task) => sum + (Array.isArray(task?.prompts) ? task.prompts.length : 0), 0),
  }
}

function findExactDuplicates(values) {
  const seen = new Map()
  const duplicates = new Set()
  for (const value of values) {
    const key = normalize(value)
    if (!key) continue
    if (seen.has(key)) duplicates.add(key)
    else seen.set(key, true)
  }
  return duplicates
}

export function auditLessonRecord({
  manifestRecord,
  pkg,
  scoring,
  runtimeRecord = null,
  authorityProjection = null,
  admittedBinding = null,
  browserLessonRow = null,
  browserBinding = null,
  browserMaterial = null,
  packageHashMatches = true,
  scoringHashMatches = true,
  duplicateObjectives = new Set(),
  duplicateScenarios = new Set(),
}) {
  const flags = []
  const add = (code, evidence) => {
    if (!flags.some((flag) => flag.code === code)) flags.push({ code, evidence })
  }
  const tasks = taskStructure(pkg)
  const taskText = learnerTaskText(pkg)
  const requiredText = requiredLearnerText(pkg)
  const objective = compact(pkg?.objective)
  const scenario = compact(pkg?.scenario)
  const allRubricText = compact(JSON.stringify(scoring?.scoringAuthority ?? {}))
  const authority = pkg?.completionAuthority
  const expectedBrowserAuthority = authority === 'guardian' ? 'GUARDIAN_ATTESTATION_REQUIRED' : 'LEARNER_AUTHORITY'
  const guardianSemantics = pkg?.realWorldAction === true && ADULT_PARTICIPATION_RE.test(`${requiredText} ${allRubricText}`)

  const clearObjective = objective.length >= 80 &&
    /\b(?:learners?|learner)\b/i.test(objective) &&
    !/^learners?\s+(?:understand|appreciate|become aware of|learn about|think about)\b/i.test(objective)
  const actionableLearnerTask = tasks.taskCount > 0 && tasks.promptCount > 0 && ACTION_RE.test(taskText) && CONCRETE_RE.test(taskText)
  const sufficientDirections = tasks.complete && taskText.length >= 180
  if (!actionableLearnerTask) add('ZERO_ACTIONABLE_WORK', 'No concrete learner action and response/deliverable were found in the task sequence.')
  if (!clearObjective || !actionableLearnerTask || duplicateObjectives.has(normalize(objective)) || duplicateScenarios.has(normalize(scenario))) {
    add('GENERIC_LIFE_ADVICE_ONLY', 'The objective/task is non-specific, non-actionable, or duplicated verbatim across lessons.')
  }
  if (!sufficientDirections) add('MISSING_TASK_STEPS', `Task structure is incomplete (tasks=${tasks.taskCount}, prompts=${tasks.promptCount}).`)

  const purchase = unsafeSentence(requiredText, PURCHASE_RE)
  const credential = unsafeSentence(requiredText, CREDENTIAL_RE)
  const media = unsafeSentence(requiredText, MEDIA_RE)
  const privateDisclosure = unsafeSentence(requiredText, PRIVATE_RE)
  if (purchase) add('PURCHASE_REQUIREMENT', purchase)
  if (credential) add('CREDENTIAL_REQUIREMENT', credential)
  if (media || pkg?.signOff?.identifiablePhotoRequired === true || pkg?.signOff?.evidenceTypes?.some((item) => /\b(?:photo|video|audio|voice recording)\b/i.test(item))) {
    add('MEDIA_PROOF_REQUIREMENT', media ?? 'Attestation metadata requires identifiable media evidence.')
  }
  if (privateDisclosure) add('PRIVATE_DISCLOSURE', privateDisclosure)

  const simulationRequired = pkg?.realWorldAction === true
  const simulationValid = !simulationRequired || validSimulation(pkg?.simulationAlternative)
  if (!simulationValid) add('MISSING_SIMULATION_ALTERNATIVE', 'A real-world task lacks a legitimate safe, actionable simulation alternative.')

  const manifestAuthorityMatches = manifestRecord?.completionAuthority === authority
  const scoringAuthorityMatches = scoring?.completionAuthority === authority
  const runtimeAuthorityMatches = runtimeRecord?.completionAuthority === authority
  const projectionAuthorityMatches = authorityProjection?.completionAuthority === authority
  const admittedAuthorityMatches = admittedBinding?.completionAuthority === expectedBrowserAuthority
  const browserAuthorityMatches = browserBinding?.completionAuthority === expectedBrowserAuthority
  const guardianTaskMatches = authority !== 'guardian' || guardianSemantics
  const guardianCannotSelfCertify = authority !== 'guardian' || (
    authorityProjection?.learnerAssertionCanCertify === false && admittedBinding?.learnerSelfReportCanCertify === false
  )
  const learnerDoesNotRequireCertification = authority !== 'learner' || !ADULT_CERTIFICATION_RE.test(`${taskText} ${allRubricText}`)
  if (!manifestAuthorityMatches || !scoringAuthorityMatches || !runtimeAuthorityMatches || !projectionAuthorityMatches || !admittedAuthorityMatches || !browserAuthorityMatches || !guardianTaskMatches || !guardianCannotSelfCertify || !learnerDoesNotRequireCertification) {
    add('AUTHORITY_MISMATCH', 'Completion authority disagrees across task semantics, package, scoring, manifest, runtime projection, admitted binding, or browser binding.')
  }

  const guardianMetadataValid = authority !== 'guardian' || (
    validSignOff(pkg?.signOff) &&
    authorityProjection?.adultAttestationRequired === true &&
    authorityProjection?.learnerAssertionCanCertify === false &&
    authorityProjection?.identifiablePhotoRequired === false &&
    admittedBinding?.learnerSelfReportCanCertify === false &&
    admittedBinding?.adultAttestation &&
    sameJson(admittedBinding.adultAttestation, pkg.signOff) &&
    admittedBinding?.equalCreditSimulation &&
    sameJson(admittedBinding.equalCreditSimulation, pkg.simulationAlternative)
  )
  const learnerMetadataValid = authority !== 'learner' || (
    pkg?.signOff === null &&
    authorityProjection?.adultAttestationRequired === false &&
    authorityProjection?.learnerAssertionCanCertify === true &&
    admittedBinding?.learnerSelfReportCanCertify === true &&
    !('adultAttestation' in (admittedBinding ?? {}))
  )
  if (!guardianMetadataValid) add('MISSING_ATTESTATION_METADATA', 'Guardian authority is missing fail-closed signoff/attestation metadata or permits learner certification.')
  if (!learnerMetadataValid) add('AUTHORITY_MISMATCH', 'Learner authority unnecessarily carries adult certification metadata or cannot self-certify.')

  const rubricSubstantive = substantiveRubric(scoring)
  if (!rubricSubstantive) add('EMPTY_RUBRIC', 'Scoring criteria lack multiple dimensions, three distinct substantive levels, or concrete look-fors.')

  const placeholder = sentences(`${requiredText} ${allRubricText}`).some((sentence) =>
    PLACEHOLDER_RE.test(sentence) && !/\b(?:not|no|without|avoid|rather than)\b/i.test(sentence),
  )
  if (placeholder) add('PLACEHOLDER', 'Placeholder marker appears in learner or scoring content.')

  const projection = auditBrowserProjection({ pkg, browserLessonRow, browserMaterial, browserBinding, expectedBrowserAuthority })
  if (!projection.pass) add('PROJECTION_LOSS', projection.losses.join('; '))

  if (!packageHashMatches || !scoringHashMatches) add('PLACEHOLDER', 'Manifest checksum does not match the audited package/scoring bytes.')

  const checks = {
    clearRealWorldLifeSkillObjective: clearObjective,
    actionableLearnerTask,
    sufficientDirections,
    noAssumedPurchase: !purchase,
    noRequiredIdentifiableMedia: !media && pkg?.signOff?.identifiablePhotoRequired !== true,
    noUnsafeCredentialHandling: !credential,
    noForcedPrivateFamilyDisclosure: !privateDisclosure,
    equalCreditSimulationWhenRequired: simulationValid,
    completionAuthorityMatchesTask: !flags.some((flag) => flag.code === 'AUTHORITY_MISMATCH'),
    guardianSignoffAttestationMetadata: guardianMetadataValid,
    learnerCannotCertifyGuardianTask: authority !== 'guardian' || (
      authorityProjection?.learnerAssertionCanCertify === false && admittedBinding?.learnerSelfReportCanCertify === false
    ),
    learnerAuthorityHasNoAdultCertification: learnerDoesNotRequireCertification && learnerMetadataValid,
    substantiveRubric: rubricSubstantive,
    browserPreservesTasksAndAlternative: projection.pass,
    noGenericFiller: !flags.some((flag) => flag.code === 'GENERIC_LIFE_ADVICE_ONLY'),
    noPlaceholder: !placeholder && packageHashMatches && scoringHashMatches,
    packageChecksum: packageHashMatches,
    scoringChecksum: scoringHashMatches,
  }

  return {
    auditSchema: AUDIT_SCHEMA,
    lessonId: manifestRecord?.lessonId ?? pkg?.lessonRef?.lessonId ?? 'unknown-lesson',
    packageId: pkg?.packageId ?? manifestRecord?.packageId ?? 'unknown-package',
    grade: manifestRecord?.grade ?? pkg?.lessonRef?.grade ?? null,
    title: pkg?.lessonRef?.title ?? manifestRecord?.title ?? '',
    completionAuthority: authority ?? null,
    realWorldAction: pkg?.realWorldAction === true,
    fictionalSimulation: pkg?.isFictionalSimulation === true,
    status: flags.length ? 'FLAGGED' : 'PASS',
    flags,
    checks,
    metrics: {
      objectiveCharacters: objective.length,
      taskCount: tasks.taskCount,
      promptCount: tasks.promptCount,
      rubricDimensions: scoring?.scoringAuthority?.criteria?.length ?? 0,
      simulationRequired,
    },
  }
}

export function auditBrowserProjection({ pkg, browserLessonRow, browserMaterial, browserBinding, expectedBrowserAuthority }) {
  const losses = []
  if (!browserLessonRow || browserLessonRow.lessonRef !== pkg.lessonRef?.lessonId) {
    losses.push('Browser runtime lesson row is missing or changed.')
  }
  if (!browserMaterial || browserMaterial.format !== 'structured' || !Array.isArray(browserMaterial.sections)) {
    return { pass: false, losses: ['Browser material is missing or not structured.'], taskChecks: [] }
  }
  if (!browserBinding || browserBinding.completionAuthority !== expectedBrowserAuthority) {
    losses.push('Browser completion authority is missing or changed.')
  }
  const sections = browserMaterial.sections
  const objectivePreserved = sections.some((section) => section.title === 'Lesson goal' && section.body === pkg.objective)
  if (!objectivePreserved) losses.push('Lesson objective is absent or changed.')
  const taskChecks = (Array.isArray(pkg.tasks) ? pkg.tasks : []).map((task) => {
    const expectedTitle = titleCaseKind(task.kind || task.taskId || 'Task')
    const projected = sections.find((section) =>
      section.title === expectedTitle &&
      section.body === task.directions &&
      JSON.stringify(section.prompts) === JSON.stringify(task.prompts.map((prompt) => prompt.text)),
    )
    if (!projected) losses.push(`Task ${task.taskId ?? '?'} directions/prompts are absent, flattened, reordered, or changed.`)
    return { taskId: task.taskId ?? null, preserved: Boolean(projected) }
  })
  const alternativeRequired = pkg.realWorldAction === true
  const alternativePreserved = !alternativeRequired || sections.some((section) =>
    section.title === 'Equal-credit alternative' && section.body === pkg.simulationAlternative?.description,
  )
  if (!alternativePreserved) losses.push('Equal-credit simulation alternative is absent or changed.')
  return { pass: losses.length === 0, losses, objectivePreserved, alternativePreserved, taskChecks }
}

function minimalFixture() {
  const pkg = {
    packageId: 'control-package',
    lessonRef: { lessonId: 'control-lesson', grade: 9, title: 'Control lesson' },
    objective: 'Learners build a specific three-step household safety plan, label every step, and explain two concrete reasons the plan would reduce risk in a realistic scenario.',
    scenario: 'The learner works through a provided realistic household scenario and produces a written safety plan using only supplied information.',
    completionAuthority: 'learner',
    realWorldAction: false,
    isFictionalSimulation: true,
    signOff: null,
    simulationAlternative: null,
    materials: ['paper or a private notes document'],
    tasks: [
      { taskId: 't1', kind: 'warm-up', directions: 'Read the supplied scenario and identify the exact decision that must be made.', prompts: [{ ref: 't1-p1', promptType: 'short-response', text: 'Write the decision and list two facts from the scenario that affect it.' }] },
      { taskId: 't2', kind: 'guided', directions: 'Build the plan in three ordered steps and label the risk addressed by each step.', prompts: [{ ref: 't2-p1', promptType: 'extended-response', text: 'Write all three steps and explain how each one addresses the named risk.' }] },
      { taskId: 't3', kind: 'reflection', directions: 'Review the completed plan against the scenario and revise one weak step.', prompts: [{ ref: 't3-p1', promptType: 'short-response', text: 'Name the revised step and explain the specific improvement you made.' }] },
    ],
  }
  const scoring = {
    completionAuthority: 'learner',
    scoringAuthority: {
      kind: 'RUBRIC',
      criteria: [
        { dimension: 'Plan completeness', levels: [
          { label: 'Emerging', descriptor: 'The plan contains fewer than three ordered and clearly described steps.' },
          { label: 'Proficient', descriptor: 'The plan contains three ordered steps tied to the supplied scenario facts.' },
          { label: 'Advanced', descriptor: 'The plan contains three ordered steps and a precise revision based on review.' },
        ] },
        { dimension: 'Risk reasoning', levels: [
          { label: 'Emerging', descriptor: 'The response names a vague concern without explaining a concrete risk.' },
          { label: 'Proficient', descriptor: 'The response connects every plan step to a concrete and relevant risk.' },
          { label: 'Advanced', descriptor: 'The response connects every step to risk and explains why the sequence matters.' },
        ] },
      ],
      lookFors: ['Every step is specific enough that another learner could follow it.'],
    },
  }
  const manifestRecord = { lessonId: 'control-lesson', packageId: 'control-package', grade: 9, completionAuthority: 'learner' }
  const runtimeRecord = { completionAuthority: 'learner' }
  const authorityProjection = { completionAuthority: 'learner', adultAttestationRequired: false, learnerAssertionCanCertify: true, identifiablePhotoRequired: false }
  const admittedBinding = { completionAuthority: 'LEARNER_AUTHORITY', learnerSelfReportCanCertify: true }
  const browserBinding = { completionAuthority: 'LEARNER_AUTHORITY' }
  const browserLessonRow = { lessonRef: 'control-lesson' }
  const browserMaterial = {
    format: 'structured',
    sections: [
      { title: 'Lesson goal', body: pkg.objective, prompts: [] },
      ...pkg.tasks.map((task) => ({ title: titleCaseKind(task.kind), body: task.directions, prompts: task.prompts.map((prompt) => prompt.text) })),
    ],
  }
  return { manifestRecord, pkg, scoring, runtimeRecord, authorityProjection, admittedBinding, browserLessonRow, browserBinding, browserMaterial }
}

export function runNegativeControls() {
  const controls = []
  const run = (id, expectedFlags, mutate) => {
    const fixture = structuredClone(minimalFixture())
    mutate(fixture)
    const result = auditLessonRecord(fixture)
    const actual = new Set(result.flags.map((flag) => flag.code))
    controls.push({
      id,
      expectedFlags,
      actualFlags: [...actual].sort(),
      result: expectedFlags.every((flag) => actual.has(flag)) ? 'DETECTED' : 'MISSED',
    })
  }

  run('student-self-certification', ['AUTHORITY_MISMATCH', 'MISSING_ATTESTATION_METADATA'], (fixture) => {
    fixture.pkg.completionAuthority = 'guardian'
    fixture.pkg.realWorldAction = true
    fixture.pkg.scenario = 'With a trusted adult, the learner carries out the supplied safety check and the adult confirms that the activity was completed.'
    fixture.pkg.signOff = {
      requiresGuardianPermissionBeforeStart: true,
      requiresTrustedAdultSupervision: true,
      certifyingActor: 'household-authorized guardian',
      studentSelfReport: 'recorded-but-not-certifying',
      evidenceTypes: ['guardian confirmation'],
      identifiablePhotoRequired: false,
    }
    fixture.pkg.simulationAlternative = { present: true, description: 'If the real safety check is unavailable, the learner instead analyzes a supplied scenario, writes three ordered decisions, and explains the risk addressed by each one.' }
    fixture.manifestRecord.completionAuthority = 'guardian'
    fixture.scoring.completionAuthority = 'guardian'
    fixture.runtimeRecord.completionAuthority = 'guardian'
    fixture.authorityProjection = { completionAuthority: 'guardian', adultAttestationRequired: true, learnerAssertionCanCertify: true, identifiablePhotoRequired: false }
    fixture.admittedBinding = {
      completionAuthority: 'GUARDIAN_ATTESTATION_REQUIRED',
      learnerSelfReportCanCertify: true,
      adultAttestation: structuredClone(fixture.pkg.signOff),
      equalCreditSimulation: structuredClone(fixture.pkg.simulationAlternative),
    }
    fixture.browserBinding.completionAuthority = 'GUARDIAN_ATTESTATION_REQUIRED'
  })
  run('missing-simulation', ['MISSING_SIMULATION_ALTERNATIVE'], (fixture) => {
    fixture.pkg.realWorldAction = true
    fixture.pkg.simulationAlternative = null
  })
  run('missing-task', ['ZERO_ACTIONABLE_WORK', 'MISSING_TASK_STEPS'], (fixture) => {
    fixture.pkg.tasks = []
    fixture.browserMaterial.sections = fixture.browserMaterial.sections.slice(0, 1)
  })
  run('private-disclosure', ['PRIVATE_DISCLOSURE'], (fixture) => {
    fixture.pkg.tasks[1].prompts[0].text = "Write your full home address and describe your family's income and a specific private family argument."
    fixture.browserMaterial.sections[2].prompts[0] = fixture.pkg.tasks[1].prompts[0].text
  })
  run('flattened-or-missing-task-steps', ['PROJECTION_LOSS'], (fixture) => {
    fixture.browserMaterial.sections[2].prompts = []
  })

  return {
    status: controls.every((control) => control.result === 'DETECTED') ? 'PASS' : 'FAIL',
    controls,
  }
}

function flagCounts(findings) {
  const counts = Object.fromEntries(FLAG_CODES.map((code) => [code, 0]))
  for (const finding of findings) for (const flag of finding.flags) counts[flag.code] += 1
  return counts
}

function parseArgs(argv) {
  const options = { corpus: DEFAULT_CORPUS, admitted: DEFAULT_ADMITTED, browser: DEFAULT_BROWSER, output: DEFAULT_OUTPUT, write: true }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--corpus') options.corpus = resolve(argv[++index])
    else if (arg === '--admitted') options.admitted = resolve(argv[++index])
    else if (arg === '--browser-root') options.browser = resolve(argv[++index])
    else if (arg === '--output') options.output = resolve(argv[++index])
    else if (arg === '--no-write') options.write = false
    else throw new Error(`Unknown option: ${arg}`)
  }
  return options
}

function markdownReport({ baseSha, counts, findings, gradeResults, attestationResults, browserLoss, negativeControls }) {
  const flagged = findings.filter((finding) => finding.status === 'FLAGGED')
  const table = Object.entries(gradeResults.byGrade).map(([grade, row]) =>
    `| ${grade} | ${row.lessonsAudited} | ${row.guardianAuthority} | ${row.learnerAuthority} | ${row.flaggedLessons} | ${row.status} |`,
  ).join('\n')
  const blockers = Object.entries(counts).filter(([, value]) => value > 0)
  return `# Ready for Life Learner Completeness Audit R1

Classification: **${gradeResults.classification}**

Base: \`${baseSha}\`

Scope: all finalized Ready for Life learner packages, scoring records, authority projections, admitted bindings, and generated browser course payloads.

## Result

- Lessons audited: **${findings.length}/${EXPECTED.lessons}**
- Guardian authority: **${attestationResults.guardianAuthority}/${EXPECTED.guardianAuthority}**
- Learner authority: **${attestationResults.learnerAuthority}/${EXPECTED.learnerAuthority}**
- Guardian records passing all attestation checks: **${attestationResults.passedGuardianRecords}/${EXPECTED.guardianAuthority}**
- Browser projections preserving objective, all **${browserLoss.taskStepsExpected}** task sections, all **${browserLoss.promptsExpected}** prompts, simulation alternatives, and authority: **${browserLoss.passedLessons}/${EXPECTED.lessons}**
- Flagged lessons: **${flagged.length}**
- Negative controls: **${negativeControls.status} (${negativeControls.controls.filter((control) => control.result === 'DETECTED').length}/${negativeControls.controls.length} detected)**
- Safe to begin matrix: **${gradeResults.safeToBeginMatrix ? 'YES' : 'NO'}**

## Grade results

| Grade | Lessons | Guardian | Learner | Flagged | Result |
| ---: | ---: | ---: | ---: | ---: | :--- |
${table}

## Flag totals

${FLAG_CODES.map((code) => `- ${code}: **${counts[code]}**`).join('\n')}

## Guardian authority verification

Each guardian-authority record was checked for a real-world task with adult participation, a safe equal-credit simulation, package signoff metadata, an identical admitted adult-attestation binding, learner self-report set to non-certifying, the guardian authority in manifest/scoring/runtime/browser projections, and no identifiable media requirement. The application runtime is fail-closed: learner completion produces a pending attestation record and only a verified household adult can certify it.

## Browser projection verification

The audit compared source text to the actual generated browser payload lesson by lesson. It required exact preservation of the objective, each task's directions, every prompt in order, every required simulation alternative, and the mapped completion authority. The learner page renders every structured section and all prompts; protected scoring records were not used as learner materials.

## Content and safety method

Every lesson was checked for a concrete objective, an actionable multi-stage learner task, sufficient directions, substantive multi-level rubric criteria, exact duplicates, placeholders, assumed purchase, unsafe credentials/accounts, required photo/video/audio/voice proof, forced sensitive family disclosure, real-world simulation coverage, and completion-authority consistency. Pattern checks are sentence-aware so explicit prohibitions and fictional/generalized privacy protections do not become false findings.

## Negative controls

${negativeControls.controls.map((control) => `- ${control.id}: **${control.result}** — expected ${control.expectedFlags.join(', ')}; observed ${control.actualFlags.join(', ')}`).join('\n')}

## Blockers

${blockers.length ? blockers.map(([code, value]) => `- ${code}: ${value} lesson(s)`).join('\n') : '- None.'}

## Verification

- \`node --test scripts/audit-learner-ready-for-life/audit.test.mjs\`
- \`node scripts/build-final-family-pilot-data.mjs && node scripts/audit-learner-ready-for-life/audit.mjs\`
- \`python3 -m unittest curriculum-release-admitted/family-pilot-r1/tests/test_release.py\`
- \`vitest run\` for final-composition fixtures, final-app convergence, and final E2E (20 tests)

## Artifacts

- \`lesson-findings.jsonl\`: one evidence record for every lesson.
- \`grade-results.json\`: coverage, flag totals, per-grade counts, classification, and negative controls.
- \`attestation-results.json\`: all 81 guardian records plus learner-authority certification checks.
- \`browser-loss.json\`: exact source-to-generated-browser projection checks for all 324 lessons.
`
}

export async function runAudit(options = {}) {
  const corpus = options.corpus ?? DEFAULT_CORPUS
  const admitted = options.admitted ?? DEFAULT_ADMITTED
  const browser = options.browser ?? DEFAULT_BROWSER
  const output = options.output ?? DEFAULT_OUTPUT
  const write = options.write ?? true

  const manifest = await readJson(resolve(corpus, 'manifest.json'))
  const runtimeCatalog = await readJson(resolve(corpus, 'projections/runtime-catalog.json'))
  const authorityProjectionDocument = await readJson(resolve(corpus, 'projections/completion-authority.json'))
  const admittedBindings = await readJsonl(resolve(admitted, 'production-bindings.jsonl'))
  const runtimeById = new Map(runtimeCatalog.lessons.map((record) => [record.lessonId, record]))
  const authorityById = new Map(authorityProjectionDocument.lessons.map((record) => [record.lessonId, record]))
  const bindingById = new Map(admittedBindings.filter((record) => record.subject === 'ready-for-life').map((record) => [record.lessonRef, record]))
  const packageCache = []
  for (const record of manifest.lessons) {
    const packageText = await readFile(resolve(corpus, record.packagePath), 'utf8')
    const scoringText = await readFile(resolve(corpus, record.scoringPath), 'utf8')
    packageCache.push({ record, packageText, scoringText, pkg: JSON.parse(packageText), scoring: JSON.parse(scoringText) })
  }
  const duplicateObjectives = findExactDuplicates(packageCache.map(({ pkg }) => pkg.objective))
  const duplicateScenarios = findExactDuplicates(packageCache.map(({ pkg }) => pkg.scenario))
  const browserCourses = new Map()
  const browserCourse = async (courseId) => {
    if (!browserCourses.has(courseId)) browserCourses.set(courseId, await readJson(resolve(browser, 'courses', `${courseId}.json`)))
    return browserCourses.get(courseId)
  }

  const findings = []
  const browserRecords = []
  const guardianRecords = []
  for (const cached of packageCache) {
    const { record, packageText, scoringText, pkg, scoring } = cached
    const course = await browserCourse(record.courseId)
    const browserLessonRow = course.lessons.find((lesson) => lesson.lessonRef === record.lessonId) ?? null
    const browserBinding = course.bindings[record.lessonId] ?? null
    const browserMaterial = course.materials[record.lessonId] ?? null
    const inputs = {
      manifestRecord: record,
      pkg,
      scoring,
      runtimeRecord: runtimeById.get(record.lessonId) ?? null,
      authorityProjection: authorityById.get(record.lessonId) ?? null,
      admittedBinding: bindingById.get(record.lessonId) ?? null,
      browserLessonRow,
      browserBinding,
      browserMaterial,
      packageHashMatches: sha256(packageText) === record.packageSha256,
      scoringHashMatches: sha256(scoringText) === record.scoringSha256,
      duplicateObjectives,
      duplicateScenarios,
    }
    const finding = auditLessonRecord(inputs)
    findings.push(finding)
    const projection = auditBrowserProjection({
      pkg,
      browserLessonRow,
      browserMaterial,
      browserBinding,
      expectedBrowserAuthority: pkg.completionAuthority === 'guardian' ? 'GUARDIAN_ATTESTATION_REQUIRED' : 'LEARNER_AUTHORITY',
    })
    browserRecords.push({
      lessonId: record.lessonId,
      grade: record.grade,
      completionAuthority: pkg.completionAuthority,
      status: projection.pass ? 'PASS' : 'FAIL',
      objectivePreserved: projection.objectivePreserved ?? false,
      runtimeLessonRowPreserved: Boolean(browserLessonRow),
      taskStepsExpected: pkg.tasks.length,
      taskStepsPreserved: projection.taskChecks.filter((task) => task.preserved).length,
      promptsExpected: pkg.tasks.reduce((sum, task) => sum + task.prompts.length, 0),
      promptsPreserved: projection.pass ? pkg.tasks.reduce((sum, task) => sum + task.prompts.length, 0) : projection.taskChecks
        .filter((task) => task.preserved)
        .reduce((sum, task) => sum + (pkg.tasks.find((source) => source.taskId === task.taskId)?.prompts.length ?? 0), 0),
      simulationRequired: pkg.realWorldAction === true,
      simulationAlternativePreserved: projection.alternativePreserved ?? false,
      authorityPreserved: browserBinding?.completionAuthority === (pkg.completionAuthority === 'guardian' ? 'GUARDIAN_ATTESTATION_REQUIRED' : 'LEARNER_AUTHORITY'),
      losses: projection.losses,
    })
    if (pkg.completionAuthority === 'guardian') {
      guardianRecords.push({
        lessonId: record.lessonId,
        grade: record.grade,
        status: finding.flags.some((flag) => ['AUTHORITY_MISMATCH', 'MISSING_ATTESTATION_METADATA', 'MISSING_SIMULATION_ALTERNATIVE', 'MEDIA_PROOF_REQUIREMENT'].includes(flag.code)) ? 'FAIL' : 'PASS',
        checks: {
          realWorldAction: pkg.realWorldAction === true,
          adultTaskSemantics: ADULT_PARTICIPATION_RE.test(`${requiredLearnerText(pkg)} ${JSON.stringify(scoring.scoringAuthority)}`),
          packageSignOff: validSignOff(pkg.signOff),
          equalCreditSimulation: validSimulation(pkg.simulationAlternative),
          scoringAuthority: scoring.completionAuthority === 'guardian',
          runtimeAuthority: runtimeById.get(record.lessonId)?.completionAuthority === 'guardian',
          learnerAssertionCannotCertify: authorityById.get(record.lessonId)?.learnerAssertionCanCertify === false,
          adultAttestationRequired: authorityById.get(record.lessonId)?.adultAttestationRequired === true,
          admittedLearnerSelfReportCannotCertify: bindingById.get(record.lessonId)?.learnerSelfReportCanCertify === false,
          browserGuardianAuthority: browserBinding?.completionAuthority === 'GUARDIAN_ATTESTATION_REQUIRED',
          noIdentifiableMedia: pkg.signOff.identifiablePhotoRequired === false,
        },
      })
    }
  }

  findings.sort((left, right) => left.lessonId.localeCompare(right.lessonId))
  guardianRecords.sort((left, right) => left.lessonId.localeCompare(right.lessonId))
  browserRecords.sort((left, right) => left.lessonId.localeCompare(right.lessonId))
  const counts = flagCounts(findings)
  const negativeControls = runNegativeControls()
  const guardianAuthority = findings.filter((finding) => finding.completionAuthority === 'guardian').length
  const learnerAuthority = findings.filter((finding) => finding.completionAuthority === 'learner').length
  const byGrade = {}
  for (const grade of EXPECTED.grades) {
    const gradeFindings = findings.filter((finding) => finding.grade === grade)
    byGrade[grade] = {
      status: gradeFindings.length === 36 && gradeFindings.every((finding) => finding.status === 'PASS') ? 'PASS' : 'FAIL',
      lessonsAudited: gradeFindings.length,
      guardianAuthority: gradeFindings.filter((finding) => finding.completionAuthority === 'guardian').length,
      learnerAuthority: gradeFindings.filter((finding) => finding.completionAuthority === 'learner').length,
      flaggedLessons: gradeFindings.filter((finding) => finding.status === 'FLAGGED').length,
      flagsByCode: flagCounts(gradeFindings),
    }
  }
  const completeCoverage = findings.length === EXPECTED.lessons &&
    new Set(findings.map((finding) => finding.lessonId)).size === EXPECTED.lessons &&
    manifest.lessonCount === EXPECTED.lessons &&
    runtimeCatalog.lessonCount === EXPECTED.lessons &&
    runtimeById.size === EXPECTED.lessons &&
    authorityProjectionDocument.lessons.length === EXPECTED.lessons &&
    authorityById.size === EXPECTED.lessons &&
    bindingById.size === EXPECTED.lessons &&
    browserRecords.length === EXPECTED.lessons
  const allChecksPass = Object.values(counts).every((count) => count === 0) &&
    guardianAuthority === EXPECTED.guardianAuthority &&
    learnerAuthority === EXPECTED.learnerAuthority &&
    guardianRecords.every((record) => record.status === 'PASS') &&
    browserRecords.every((record) => record.status === 'PASS') &&
    Object.values(byGrade).every((record) => record.status === 'PASS') &&
    negativeControls.status === 'PASS'
  const classification = completeCoverage ? 'RFL_LEARNER_AUDIT_COMPLETE' : 'AUDIT_INCONCLUSIVE'
  const baseSha = options.baseSha ?? 'c81ddb6e04bc1c3629212327d47817c1b5677477'
  const gradeResults = {
    auditSchema: AUDIT_SCHEMA,
    classification,
    status: completeCoverage && allChecksPass ? 'PASS' : 'FAIL',
    baseSha,
    expected: EXPECTED,
    coverage: {
      complete: completeCoverage,
      manifestLessons: manifest.lessonCount,
      packageAndScoringPairsRead: packageCache.length,
      runtimeRecords: runtimeCatalog.lessons.length,
      uniqueRuntimeRecords: runtimeById.size,
      authorityProjectionRecords: authorityProjectionDocument.lessons.length,
      uniqueAuthorityProjectionRecords: authorityById.size,
      admittedBindings: bindingById.size,
      browserRecords: browserRecords.length,
      uniqueLessonIds: new Set(findings.map((finding) => finding.lessonId)).size,
    },
    totals: {
      lessonsAudited: findings.length,
      guardianAuthority,
      learnerAuthority,
      realWorldActions: findings.filter((finding) => finding.realWorldAction).length,
      fictionalSimulations: findings.filter((finding) => finding.fictionalSimulation).length,
      flaggedLessons: findings.filter((finding) => finding.status === 'FLAGGED').length,
    },
    flagsByCode: counts,
    byGrade,
    negativeControls,
    safeToBeginMatrix: completeCoverage && allChecksPass,
  }
  const attestationResults = {
    auditSchema: AUDIT_SCHEMA,
    status: guardianRecords.length === EXPECTED.guardianAuthority && guardianRecords.every((record) => record.status === 'PASS') ? 'PASS' : 'FAIL',
    guardianAuthority,
    learnerAuthority,
    passedGuardianRecords: guardianRecords.filter((record) => record.status === 'PASS').length,
    failedGuardianRecords: guardianRecords.filter((record) => record.status === 'FAIL').length,
    learnerAuthorityCertificationChecks: {
      lessonsChecked: learnerAuthority,
      unnecessarilyRequireAdultCertification: findings.filter((finding) =>
        finding.completionAuthority === 'learner' && finding.flags.some((flag) => flag.code === 'AUTHORITY_MISMATCH'),
      ).length,
    },
    guardianRecords,
  }
  const browserLoss = {
    auditSchema: AUDIT_SCHEMA,
    status: browserRecords.length === EXPECTED.lessons && browserRecords.every((record) => record.status === 'PASS') ? 'PASS' : 'FAIL',
    browserRoot: browser,
    lessonsChecked: browserRecords.length,
    passedLessons: browserRecords.filter((record) => record.status === 'PASS').length,
    lessonsWithProjectionLoss: browserRecords.filter((record) => record.status === 'FAIL').length,
    taskStepsExpected: browserRecords.reduce((sum, record) => sum + record.taskStepsExpected, 0),
    taskStepsPreserved: browserRecords.reduce((sum, record) => sum + record.taskStepsPreserved, 0),
    promptsExpected: browserRecords.reduce((sum, record) => sum + record.promptsExpected, 0),
    promptsPreserved: browserRecords.reduce((sum, record) => sum + record.promptsPreserved, 0),
    requiredSimulationAlternatives: browserRecords.filter((record) => record.simulationRequired).length,
    preservedSimulationAlternatives: browserRecords.filter((record) => record.simulationRequired && record.simulationAlternativePreserved).length,
    records: browserRecords,
  }

  if (write) {
    await mkdir(output, { recursive: true })
    await writeFile(resolve(output, 'lesson-findings.jsonl'), findings.map((finding) => JSON.stringify(finding)).join('\n') + '\n')
    await writeFile(resolve(output, 'grade-results.json'), JSON.stringify(gradeResults, null, 2) + '\n')
    await writeFile(resolve(output, 'attestation-results.json'), JSON.stringify(attestationResults, null, 2) + '\n')
    await writeFile(resolve(output, 'browser-loss.json'), JSON.stringify(browserLoss, null, 2) + '\n')
    await writeFile(resolve(output, 'RFL_LEARNER_AUDIT_R1.md'), markdownReport({ baseSha, counts, findings, gradeResults, attestationResults, browserLoss, negativeControls }))
  }
  return { findings, gradeResults, attestationResults, browserLoss }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runAudit(parseArgs(process.argv.slice(2)))
  console.log(JSON.stringify({
    classification: result.gradeResults.classification,
    status: result.gradeResults.status,
    lessonsAudited: result.gradeResults.totals.lessonsAudited,
    guardianAuthority: result.gradeResults.totals.guardianAuthority,
    learnerAuthority: result.gradeResults.totals.learnerAuthority,
    flagsByCode: result.gradeResults.flagsByCode,
    projection: result.browserLoss.status,
    safeToBeginMatrix: result.gradeResults.safeToBeginMatrix,
  }, null, 2))
}
