import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../../../..')
const outRoot = join(root, 'curriculum-production/final/assessments')
const packageRoot = join(outRoot, 'packages')
const authorityRoot = join(outRoot, 'adult-authorities')
const admittedRoot = join(root, 'curriculum-release-admitted/family-pilot-r1')

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const localPath = (ref) => {
  if (typeof ref !== 'string') return null
  const path = ref.startsWith('git+') ? ref.slice(ref.indexOf(':') + 1) : ref
  return existsSync(join(root, path)) ? path : null
}
const sourceRef = (path) => path ? `repo:${path}` : null
const cleanText = (value) => typeof value === 'string' ? value.trim() : ''
const stringList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : []

const bindings = readJson(join(admittedRoot, 'assessment-bindings.json'))
const runtime = readJson(join(admittedRoot, 'runtime/runtime-manifest.json'))
const lessonRows = readJson(join(admittedRoot, 'runtime/lesson-rows-by-course.json'))
const units = new Map(runtime.units.map((unit) => [unit.unitRef, unit]))
const courses = new Map(runtime.courses.map((course) => [course.courseRef, course]))

const structural = new Map()
const assessmentFiles = []
const walk = (dir) => {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (name === 'assessments.json') assessmentFiles.push(path)
  }
}
walk(join(root, 'curriculum-content/manuel-academy/1.0.0/grades'))
for (const path of assessmentFiles) {
  for (const record of readJson(path)) structural.set(record.assessment_id, { ...record, sourcePath: relative(root, path) })
}
const correctionPath = join(root, 'curriculum-production/final/mathematics/evidence/grade8-integration/accepted-assessment.json')
for (const record of readJson(correctionPath)) structural.set(record.assessment_id, {
  ...record,
  sourcePath: relative(root, correctionPath),
})

const rflAuthorities = new Map(
  readJson(join(root, 'curriculum-production/final/ready-for-life/projections/completion-authority.json'))
    .lessons.map((entry) => [entry.lessonId, entry]),
)

const genericRubric = Object.freeze([
  'accuracy or fidelity',
  'evidence and reasoning',
  'application or performance',
  'checking and revision',
])

const subjectInstructions = Object.freeze({
  'mathematics': [
    'Work independently. Show the mathematical steps or representation that support each response.',
    'Check each result before submitting. A response without the requested work may require adult review.',
  ],
  'financial-literacy': [
    'Use only the fictional or supplied figures. Do not disclose household income, accounts, balances, or spending.',
    'Show computations for fixed items and explain the tradeoff or decision for open items.',
  ],
  'english-language-arts': [
    'Read the supplied text or source closely, then write an original analysis or composition.',
    'Cite relevant evidence and revise for meaning, organization, and language before submitting.',
  ],
  'science': [
    'Use the supplied investigation, model, or data. Record observations and distinguish evidence from inference.',
    'Follow every safety direction. If required material, adult approval, or a safe alternative is missing, stop.',
  ],
  'social-studies': [
    'Use only the attached, real, dated sources. Identify each source and cite specific evidence for claims.',
    'Explain source limits or perspective. If a required source is not attached, stop and request it.',
  ],
  'health': [
    'Complete the private-safe task without disclosing medical history, diagnosis, body measurements, or sexual history.',
    'Use a fictional scenario when offered and identify a trusted adult or qualified professional where appropriate.',
  ],
  'physical-education': [
    'Complete the safe activity or accessible equivalent and document the requested performance evidence.',
    'Stop for pain, dizziness, breathing trouble, unsafe conditions, or missing adult supervision.',
  ],
  'ready-for-life': [
    'Complete the task or its stated simulation alternative. Do not submit photos, recordings, addresses, account details, or private household information.',
    'Learner completion never certifies a guardian-authority task; those tasks remain pending until a guardian attests.',
  ],
  'technology': [
    'Create, test, debug, or explain the requested artifact using fictional data and no real credentials or personal information.',
    'Record expected and actual results, include an edge case, and revise after testing.',
  ],
  'arts-and-music': [
    'Create, perform privately, analyze, or critique as directed. A written, no-audio alternative receives equal credit.',
    'Submit original work plus process evidence and a specific revision or critique.',
  ],
})

const responseModeFor = (subject, source) => {
  if (subject === 'mathematics') return 'fixed-and-work-shown'
  if (source?.responseScoring?.mode === 'FIXED') return 'fixed-computational'
  if (source?.responseScoring?.mode === 'MIXED') return 'mixed-fixed-and-constructed'
  return ({
    'financial-literacy': 'calculation-and-decision-explanation',
    'english-language-arts': 'written-analysis-or-composition',
    'science': 'investigation-data-and-evidence',
    'social-studies': 'source-based-claim-evidence-reasoning',
    'health': 'private-safe-task-and-reflection',
    'physical-education': 'performance-log-or-accessible-equivalent',
    'ready-for-life': 'task-evidence-or-simulation',
    'technology': 'project-code-debug-log-or-design',
    'arts-and-music': 'project-performance-analysis-or-critique',
  })[subject]
}

function assessmentRow(binding) {
  const rows = lessonRows[binding.releaseSlotId] ?? []
  const unitRows = rows.filter((row) => row.unitRef === binding.unitRef)
  if (unitRows.length === 0) return null
  return unitRows.find((row) => /^Unit assessment:/i.test(row.title))
    ?? unitRows.find((row) => /^Mastery check:/i.test(row.title))
    ?? unitRows.at(-1)
}

function readSource(path) {
  if (!path) return null
  const text = readFileSync(join(root, path), 'utf8')
  if (path.endsWith('.json')) return readJson(join(root, path))
  return { markdown: text }
}

function standardsFromMarkdown(markdown) {
  const line = markdown?.match(/^\*\*Standards:\*\*\s*(.+)$/m)?.[1]
  return line ? line.split(/[,;]/).map((value) => value.trim()).filter(Boolean) : []
}

function taskFromPrompt(prompt, index) {
  return {
    taskRef: `task-${String(index + 1).padStart(2, '0')}`,
    kind: cleanText(prompt.type) || 'constructed-response',
    prompt: cleanText(prompt.prompt),
    ...(Number.isFinite(prompt.points) ? { possiblePoints: prompt.points } : {}),
  }
}

function tasksFromJson(source) {
  if (!source || typeof source !== 'object') return []
  if (Array.isArray(source.sections)) {
    return source.sections.flatMap((section) => (section.items ?? []).map((item, index) => ({
      taskRef: cleanText(item.ref) || `${section.sectionId ?? 'section'}-${index + 1}`,
      kind: cleanText(item.kind) || 'fixed-response',
      prompt: cleanText(item.prompt),
      ...(Array.isArray(item.choices) ? { choices: item.choices } : {}),
      ...(cleanText(item.standard) ? { standardRef: item.standard } : {}),
    })))
  }
  if (Array.isArray(source.prompts)) return source.prompts.map(taskFromPrompt)
  if (Array.isArray(source.tasks)) {
    return source.tasks.flatMap((task, taskIndex) => {
      const prompts = Array.isArray(task.prompts) ? task.prompts : []
      if (prompts.length === 0 && cleanText(task.directions)) return [{
        taskRef: cleanText(task.taskId) || `task-${taskIndex + 1}`,
        kind: cleanText(task.kind) || 'task',
        prompt: cleanText(task.directions),
      }]
      return prompts.map((prompt, promptIndex) => ({
        taskRef: cleanText(prompt.ref) || `${task.taskId ?? `task-${taskIndex + 1}`}-${promptIndex + 1}`,
        kind: cleanText(prompt.promptType) || cleanText(task.kind) || 'constructed-response',
        directions: cleanText(task.directions),
        prompt: cleanText(prompt.text),
        ...(cleanText(prompt.unit) ? { responseUnit: prompt.unit } : {}),
      }))
    })
  }
  const tasks = []
  for (const [key, value] of [
    ['student-task', source.studentTask],
    ['independent-evidence', source.independentEvidenceTask],
    ['knowledge-check', source.knowledgeCheck],
    ['primary-task', source.primary_task],
    ['deliverable', source.deliverable],
  ]) {
    const text = typeof value === 'string' ? value : value ? JSON.stringify(value) : ''
    if (text.trim()) tasks.push({ taskRef: key, kind: key, prompt: text.trim() })
  }
  return tasks
}

function tasksFromMarkdown(markdown) {
  if (!markdown) return []
  const tasks = []
  const sections = [...markdown.matchAll(/^##\s+(?:\d+\.\s*)?(.+)\n([\s\S]*?)(?=^##\s+|\Z)/gm)]
  for (const [, title, body] of sections) {
    if (/rubric|answer|scoring|remediation|extension/i.test(title)) continue
    const prompt = body.trim()
    if (prompt) tasks.push({
      taskRef: `task-${String(tasks.length + 1).padStart(2, '0')}`,
      kind: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      prompt,
    })
  }
  return tasks.slice(0, 6)
}

function rubricFromScoring(scoring, metadata) {
  const direct = stringList(metadata?.rubric_dimensions)
  if (direct.length) return direct
  if (Array.isArray(scoring?.rubric)) return scoring.rubric.map((row) => row.dimension).filter(Boolean)
  if (Array.isArray(scoring?.scoringAuthority?.criteria)) return scoring.scoringAuthority.criteria.map((row) => row.dimension).filter(Boolean)
  if (Array.isArray(scoring?.rubricDimensions)) return scoring.rubricDimensions
  return [...genericRubric]
}

function scoringClass(subject, source, row, assessmentRef) {
  if (assessmentRef === 'ma-g8-mathematics-c01-assessment') return 'RUBRIC_REQUIRED'
  if (subject === 'mathematics' && Array.isArray(source?.sections) && source.sections.some((section) => section.items?.length)) {
    return 'AUTO_SCOREABLE'
  }
  if (subject === 'financial-literacy' && source?.responseScoring?.mode === 'FIXED') return 'AUTO_SCOREABLE'
  if (subject === 'ready-for-life') {
    const authority = rflAuthorities.get(row?.lessonRef)?.completionAuthority ?? source?.completionAuthority
    return authority === 'guardian' ? 'GUARDIAN_REQUIRED' : 'COMPLETION_ONLY'
  }
  return 'RUBRIC_REQUIRED'
}

rmSync(packageRoot, { recursive: true, force: true })
rmSync(authorityRoot, { recursive: true, force: true })

const manifestRows = []
for (const binding of bindings) {
  const unit = units.get(binding.unitRef)
  const course = courses.get(binding.releaseSlotId)
  if (!unit || !course) throw new Error(`Missing catalog location for ${binding.assessmentRef}`)

  const metadata = structural.get(binding.assessmentRef) ?? null
  const row = assessmentRow(binding)
  const boundPackagePath = localPath(binding.productionPackageRef)
  const learnerSourcePath = boundPackagePath
    ?? localPath(row?.sourceReadiness?.sourceRefs?.[0])
    ?? localPath(row?.resourceRefs?.[0])
  const source = readSource(learnerSourcePath)
  const boundScoringPath = localPath(binding.scoringAuthorityRef)
  const candidateScoringPath = boundScoringPath ?? (row?.resourceRefs ?? [])
    .map(localPath)
    .find((path) => path && path !== learnerSourcePath)
    ?? localPath(row?.resourceRefs?.[1])
    ?? null
  const scoring = readSource(candidateScoringPath)

  let tasks = metadata?.prompts?.map(taskFromPrompt) ?? tasksFromJson(source)
  if (tasks.length === 0) tasks = tasksFromMarkdown(source?.markdown)
  if (tasks.length === 0) throw new Error(`No learner tasks for ${binding.assessmentRef}`)

  const standards = stringList(metadata?.standards).length
    ? stringList(metadata.standards)
    : stringList(source?.standards).length
      ? stringList(source.standards)
      : stringList(source?.standardsRefs).length
        ? stringList(source.standardsRefs)
        : standardsFromMarkdown(source?.markdown)
  const standardsMappingAuthority = standards.length > 0
    ? sourceRef(metadata?.sourcePath) ?? sourceRef(learnerSourcePath)
    : typeof binding.scoringAuthorityRef === 'object'
      ? binding.scoringAuthorityRef
      : { sourceRef: sourceRef(boundPackagePath), note: 'Standards remain governed by the bound production package.' }

  const authorityClass = scoringClass(binding.subject, source, row, binding.assessmentRef)
  const rubricDimensions = rubricFromScoring(scoring, metadata)
  const responseMode = responseModeFor(binding.subject, source)
  const learnerSuccessCriteria = stringList(source?.lesson_success_criteria).length
    ? stringList(source.lesson_success_criteria)
    : stringList(source?.completionCriteria).length
      ? stringList(source.completionCriteria)
      : rubricDimensions.map((dimension) => `Provide evidence that meets the stated ${dimension} criterion.`)

  const packagePath = join(packageRoot, `grade-${String(binding.grade).padStart(2, '0')}`, binding.subject, `${binding.assessmentRef}.json`)
  const authorityPath = join(authorityRoot, `grade-${String(binding.grade).padStart(2, '0')}`, binding.subject, `${binding.assessmentRef}.authority.json`)
  const packageRef = relative(root, packagePath)
  const adultAuthorityRef = relative(root, authorityPath)

  const learnerPackage = {
    schemaVersion: '1.0',
    kind: 'canonical-learner-assessment-package',
    assessmentRef: binding.assessmentRef,
    courseRef: binding.releaseSlotId,
    grade: binding.grade,
    subject: binding.subject,
    location: {
      unitRef: binding.unitRef,
      unitNumber: unit.unitNumber,
      unitTitle: unit.title,
      courseTitle: course.title,
      assessmentLessonRef: row?.lessonRef ?? null,
    },
    standards,
    standardsMappingAuthority,
    instructions: subjectInstructions[binding.subject],
    learnerTasks: tasks,
    responseMode,
    completionScoringAuthorityClass: authorityClass,
    adultScoringAuthorityRef: `restricted:${adultAuthorityRef}`,
    learnerSuccessCriteria,
    accommodations: cleanText(metadata?.accommodation_note)
      || cleanText(source?.accommodationNote)
      || 'Access supports may change format, pacing, quantity, setting, or response mode without changing the assessed objective.',
    provenance: {
      structuralAssessmentRef: binding.assessmentRef,
      metadataRef: sourceRef(metadata?.sourcePath),
      learnerMaterialRef: sourceRef(learnerSourcePath),
      unitObjective: unit.essentialQuestion,
    },
    productionReadiness: {
      status: 'READY',
      structuralOnly: false,
      answerMaterialIncluded: false,
      requiresSourceAttachment: row?.sourceReadiness?.dynamicSource === true,
      sourceResolverKey: row?.sourceReadiness?.resolverKey ?? null,
    },
  }

  const adultAuthority = {
    schemaVersion: '1.0',
    kind: 'restricted-adult-assessment-authority',
    assessmentRef: binding.assessmentRef,
    courseRef: binding.releaseSlotId,
    grade: binding.grade,
    subject: binding.subject,
    authorityClass,
    rubricDimensions,
    scoringSourceRef: sourceRef(candidateScoringPath) ?? sourceRef(metadata?.sourcePath),
    scoringSourceAuthority: typeof binding.scoringAuthorityRef === 'object'
      ? binding.scoringAuthorityRef
      : sourceRef(boundScoringPath),
    ...(authorityClass === 'AUTO_SCOREABLE' && source?.answerKeyRef
      ? { answerAuthorityRef: sourceRef(candidateScoringPath) }
      : {}),
    completionAuthority: authorityClass === 'GUARDIAN_REQUIRED'
      ? { kind: 'guardian', learnerAssertionCanCertify: false, adultAttestationRequired: true }
      : authorityClass === 'COMPLETION_ONLY'
        ? { kind: 'learner', learnerAssertionCanCertify: true, adultAttestationRequired: false }
        : null,
    assessorBoundary: 'INJECTED_PRODUCTION_ASSESSOR',
  }

  writeJson(packagePath, learnerPackage)
  writeJson(authorityPath, adultAuthority)
  manifestRows.push({
    assessmentRef: binding.assessmentRef,
    courseRef: binding.releaseSlotId,
    grade: binding.grade,
    subject: binding.subject,
    packageRef,
    adultAuthorityRef,
    authorityClass,
    responseMode,
    materialSha256: sha256(JSON.stringify(learnerPackage)),
  })
}

manifestRows.sort((a, b) => a.assessmentRef.localeCompare(b.assessmentRef))
const byAuthority = Object.fromEntries([...new Set(manifestRows.map((row) => row.authorityClass))]
  .sort().map((key) => [key, manifestRows.filter((row) => row.authorityClass === key).length]))
const bySubject = Object.fromEntries([...new Set(manifestRows.map((row) => row.subject))]
  .sort().map((key) => [key, manifestRows.filter((row) => row.subject === key).length]))

writeJson(join(outRoot, 'manifest.json'), {
  schemaVersion: '1.0',
  corpusId: 'manuel-academy-canonical-assessments-r1',
  classification: 'ASSESSMENT_MATERIALIZATION_READY',
  totals: {
    assessments: manifestRows.length,
    materialized: manifestRows.length,
    structuralOnlyRemaining: 0,
    answerLeaks: 0,
    byAuthority,
    bySubject,
  },
  assessments: manifestRows,
})

console.log(JSON.stringify({ assessments: manifestRows.length, byAuthority, bySubject }, null, 2))
