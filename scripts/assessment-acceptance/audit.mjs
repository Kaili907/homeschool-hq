import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const ASSESSMENT_ROOT = resolve(ROOT, 'curriculum-production/final/assessments')
const EXPECTED_SUBJECT_COUNTS = Object.freeze({
  'arts-and-music': 54,
  'english-language-arts': 90,
  'financial-literacy': 59,
  health: 54,
  mathematics: 91,
  'physical-education': 81,
  'ready-for-life': 54,
  science: 81,
  'social-studies': 81,
  technology: 54,
})
const EXPECTED_AUTHORITY_COUNTS = Object.freeze({
  AUTO_SCOREABLE: 90,
  RUBRIC_REQUIRED: 555,
  GUARDIAN_REQUIRED: 25,
  COMPLETION_ONLY: 29,
})
const FORBIDDEN_LEARNER_KEYS = new Set([
  'answer', 'answers', 'answerKey', 'answerKeyRef', 'answerAuthorityRef', 'correctAnswer',
  'correctChoice', 'answerIndex', 'expectedAnswer', 'solution', 'solutions', 'scoringGuide',
])

function read(path) {
  return readFileSync(resolve(ROOT, path), 'utf8')
}

function json(path) {
  return JSON.parse(read(path))
}

function localRepoRef(reference) {
  return typeof reference === 'string' && reference.startsWith('repo:')
    ? reference.slice('repo:'.length)
    : null
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function increment(record, key) {
  record[key] = (record[key] ?? 0) + 1
}

function sameCounts(actual, expected) {
  return JSON.stringify(Object.fromEntries(Object.entries(actual).sort())) ===
    JSON.stringify(Object.fromEntries(Object.entries(expected).sort()))
}

function forbiddenPaths(value, path = '$') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => forbiddenPaths(item, `${path}[${index}]`))
  }
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => [
    ...(FORBIDDEN_LEARNER_KEYS.has(key) ? [`${path}.${key}`] : []),
    ...forbiddenPaths(child, `${path}.${key}`),
  ])
}

function countBrowserAssessmentPackages() {
  const output = resolve(ROOT, 'public/family-pilot-final/2.0.0')
  if (!existsSync(output)) return null
  const files = [resolve(output, 'manifest.json')]
  const courseRoot = resolve(output, 'courses')
  if (existsSync(courseRoot)) {
    files.push(...readdirSync(courseRoot).filter((name) => name.endsWith('.json'))
      .map((name) => resolve(courseRoot, name)))
  }
  let count = 0
  for (const file of files) {
    const serialized = readFileSync(file, 'utf8')
    count += serialized.match(/canonical-learner-assessment-package/g)?.length ?? 0
  }
  return count
}

export function auditAssessmentAcceptance() {
  const manifest = json('curriculum-production/final/assessments/manifest.json')
  const admitted = json('curriculum-release-admitted/family-pilot-r1/assessment-bindings.json')
  const rflCompletion = json('curriculum-production/final/ready-for-life/projections/completion-authority.json')
  const rflByLesson = new Map(rflCompletion.lessons.map((row) => [row.lessonId, row]))
  const admittedByRef = new Map(admitted.map((row) => [row.assessmentRef, row]))
  const failures = []
  const subjectCounts = {}
  const authorityCounts = {}
  let answerLeaks = 0
  let learnerMaterial = 0
  let responseModes = 0
  let authorityPaths = 0
  let structuralOnly = 0
  let dynamicSources = 0

  if (manifest.assessments.length !== 699) failures.push(`manifest total ${manifest.assessments.length}`)
  if (admitted.length !== 699) failures.push(`admitted total ${admitted.length}`)
  if (new Set(manifest.assessments.map((row) => row.assessmentRef)).size !== 699) failures.push('duplicate assessmentRef')

  for (const row of manifest.assessments) {
    const binding = admittedByRef.get(row.assessmentRef)
    if (!binding) {
      failures.push(`${row.assessmentRef}: not admitted`)
      continue
    }
    if (!existsSync(resolve(ROOT, row.packageRef)) || !existsSync(resolve(ROOT, row.adultAuthorityRef))) {
      failures.push(`${row.assessmentRef}: package or authority missing`)
      continue
    }
    const learner = json(row.packageRef)
    const adult = json(row.adultAuthorityRef)
    increment(subjectCounts, learner.subject)
    increment(authorityCounts, learner.completionScoringAuthorityClass)

    const materialOk = learner.schemaVersion === '1.0' &&
      learner.kind === 'canonical-learner-assessment-package' &&
      learner.assessmentRef === row.assessmentRef && learner.assessmentRef === binding.assessmentRef &&
      learner.courseRef === binding.releaseSlotId && learner.grade === binding.grade &&
      learner.subject === binding.subject && learner.location?.unitRef === binding.unitRef &&
      Array.isArray(learner.instructions) && learner.instructions.length > 0 &&
      learner.instructions.every((item) => typeof item === 'string' && item.trim()) &&
      Array.isArray(learner.learnerTasks) && learner.learnerTasks.length > 0 &&
      learner.learnerTasks.every((task) => task.taskRef?.trim() && task.prompt?.trim()) &&
      new Set(learner.learnerTasks.map((task) => task.taskRef)).size === learner.learnerTasks.length &&
      Array.isArray(learner.learnerSuccessCriteria) && learner.learnerSuccessCriteria.length > 0
    if (materialOk) learnerMaterial += 1
    else failures.push(`${row.assessmentRef}: incomplete learner material`)

    if (typeof learner.responseMode === 'string' && learner.responseMode.trim()) responseModes += 1
    else failures.push(`${row.assessmentRef}: response mode missing`)

    const expectedRestrictedRef = `restricted:${row.adultAuthorityRef}`
    const authorityOk = learner.adultScoringAuthorityRef === expectedRestrictedRef &&
      adult.kind === 'restricted-adult-assessment-authority' &&
      adult.assessmentRef === learner.assessmentRef && adult.courseRef === learner.courseRef &&
      adult.grade === learner.grade && adult.subject === learner.subject &&
      adult.authorityClass === learner.completionScoringAuthorityClass &&
      adult.assessorBoundary === 'INJECTED_PRODUCTION_ASSESSOR' &&
      Array.isArray(adult.rubricDimensions) && adult.rubricDimensions.length > 0
    if (authorityOk) authorityPaths += 1
    else failures.push(`${row.assessmentRef}: authority mismatch`)

    if (learner.productionReadiness?.structuralOnly !== false || learner.productionReadiness?.status !== 'READY') {
      structuralOnly += 1
      failures.push(`${row.assessmentRef}: structural-only or not ready`)
    }
    if (learner.productionReadiness?.answerMaterialIncluded !== false) {
      failures.push(`${row.assessmentRef}: answer custody not explicitly excluded`)
    }
    const leaks = forbiddenPaths(learner)
    answerLeaks += leaks.length
    if (leaks.length) failures.push(`${row.assessmentRef}: ${leaks.join(', ')}`)
    if (row.materialSha256 !== sha256(JSON.stringify(learner))) failures.push(`${row.assessmentRef}: digest mismatch`)

    const className = learner.completionScoringAuthorityClass
    const sourcePath = localRepoRef(learner.provenance?.learnerMaterialRef)
    if (!sourcePath || !existsSync(resolve(ROOT, sourcePath))) failures.push(`${row.assessmentRef}: learner source missing`)
    if (className === 'AUTO_SCOREABLE') {
      if (learner.subject !== 'mathematics') failures.push(`${row.assessmentRef}: unexpected auto-score subject`)
      const source = sourcePath?.endsWith('.json') ? json(sourcePath) : null
      const hasFixedItems = source?.sections?.some((section) => Array.isArray(section.items) && section.items.length > 0)
      const answerPath = localRepoRef(adult.answerAuthorityRef)
      if (!hasFixedItems || !answerPath || !existsSync(resolve(ROOT, answerPath))) {
        failures.push(`${row.assessmentRef}: auto-score authority is not independently supported`)
      }
    } else if (adult.answerAuthorityRef !== undefined) {
      failures.push(`${row.assessmentRef}: non-auto assessment exposes an answer authority field`)
    }
    if (className === 'RUBRIC_REQUIRED' && learner.subject === 'mathematics' &&
        learner.assessmentRef !== 'ma-g8-mathematics-c01-assessment') {
      failures.push(`${row.assessmentRef}: unexpected rubric math assessment`)
    }
    if (className === 'GUARDIAN_REQUIRED' || className === 'COMPLETION_ONLY') {
      const sourceAuthority = rflByLesson.get(learner.location.assessmentLessonRef)
      const expected = sourceAuthority?.completionAuthority === 'guardian' ? 'GUARDIAN_REQUIRED' : 'COMPLETION_ONLY'
      if (learner.subject !== 'ready-for-life' || !sourceAuthority || expected !== className) {
        failures.push(`${row.assessmentRef}: completion authority classification mismatch`)
      }
      if (className === 'GUARDIAN_REQUIRED' &&
          (adult.completionAuthority?.learnerAssertionCanCertify !== false ||
           adult.completionAuthority?.adultAttestationRequired !== true)) {
        failures.push(`${row.assessmentRef}: guardian authority is learner-certifiable`)
      }
      if (className === 'COMPLETION_ONLY' &&
          (adult.completionAuthority?.learnerAssertionCanCertify !== true ||
           adult.completionAuthority?.adultAttestationRequired !== false)) {
        failures.push(`${row.assessmentRef}: completion-only authority mismatch`)
      }
    }
    if (learner.productionReadiness?.requiresSourceAttachment === true) {
      dynamicSources += 1
      if (!learner.productionReadiness.sourceResolverKey) failures.push(`${row.assessmentRef}: dynamic resolver key missing`)
    }
  }

  if (!sameCounts(subjectCounts, EXPECTED_SUBJECT_COUNTS)) failures.push('subject counts differ from acceptance contract')
  if (!sameCounts(authorityCounts, EXPECTED_AUTHORITY_COUNTS)) failures.push('authority counts differ from acceptance contract')
  if (manifest.totals.structuralOnlyRemaining !== 0) failures.push('manifest structural-only total is nonzero')
  if (manifest.totals.answerLeaks !== 0) failures.push('manifest answer-leak total is nonzero')

  const browserTypes = read('src/curriculum/final-app-data/types.ts')
  const browserRuntime = read('src/curriculum/final-app-data/runtime.ts')
  const browserBuild = read('scripts/build-final-family-pilot-data.mjs')
  const controller = read('src/study/family-pilot/final-app/controller.ts')
  const app = read('src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx')
  const assessmentWorkflow = read('src/study/family-pilot/final-app/assessment/workflow.ts')
  const browserAssessmentPackages = countBrowserAssessmentPackages()
  const blockers = []

  if (!/getAssessment/.test(browserTypes) || !/getAssessment/.test(browserRuntime) ||
      !/canonical-learner-assessment-package/.test(browserBuild) || browserAssessmentPackages === 0) {
    blockers.push({
      code: 'BROWSER_ASSESSMENT_DTO_UNAVAILABLE',
      detail: 'The browser build/catalog emits and loads lesson materials only; it exposes no canonical assessment package loader.',
    })
  }
  if (!/createAssessmentWorkflowAdapter/.test(controller) && !/createAssessmentWorkflowAdapter/.test(app)) {
    blockers.push({
      code: 'ASSIGNMENT_SCHEDULE_ASSESSMENT_LAUNCH_UNWIRED',
      detail: 'The production Family Pilot controller/UI never constructs the assessment workflow; assignment and schedule launches remain lessonRef-only.',
    })
  }
  if (/assessed\.status === 'SCORED' \? 'SCORING_COMPLETE'/.test(assessmentWorkflow) &&
      !/completionScoringAuthorityClass === 'RUBRIC_REQUIRED'[\s\S]{0,400}assessed\.status/.test(assessmentWorkflow)) {
    blockers.push({
      code: 'RUBRIC_FALSE_AUTO_SCORE_GUARD_MISSING',
      detail: 'A RUBRIC_REQUIRED submission is accepted as SCORING_COMPLETE when the injected assessor returns SCORED.',
    })
  }
  if (!/AssessmentCatalogPort/.test(controller) && !/ProductionAssessmentAssessor/.test(controller)) {
    blockers.push({
      code: 'CANONICAL_SCORING_REVIEW_PATH_UNWIRED',
      detail: 'No production catalog or assessor implementation connects canonical assessmentRef packages to the scoring/review service.',
    })
  }

  return Object.freeze({
    status: blockers.length || failures.length ? 'BLOCKED' : 'PASS',
    total: manifest.assessments.length,
    subjectCounts: Object.freeze(subjectCounts),
    authorityCounts: Object.freeze(authorityCounts),
    learnerMaterial,
    responseModes,
    authorityPaths,
    structuralOnly,
    answerLeaks,
    dynamicSources,
    browserAssessmentPackages,
    failures: Object.freeze(failures),
    blockers: Object.freeze(blockers),
    classification: blockers.length || failures.length ? 'BLOCKED' : 'ASSESSMENT_ACCEPTANCE_READY',
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(auditAssessmentAcceptance(), null, 2))
}
