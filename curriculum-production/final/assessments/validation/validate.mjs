import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../../../..')
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const manifest = readJson('curriculum-production/final/assessments/manifest.json')
const bindings = readJson('curriculum-release-admitted/family-pilot-r1/assessment-bindings.json')
const forbiddenLearnerKeys = new Set([
  'answer', 'answers', 'answerKey', 'answerKeyRef', 'answerAuthorityRef', 'correctAnswer',
  'correctChoice', 'answerIndex', 'expectedAnswer', 'solution', 'solutions', 'scoringGuide',
])

const fail = (message) => { throw new Error(message) }
const forbiddenPaths = (value, path = '$') => {
  if (Array.isArray(value)) return value.flatMap((item, index) => forbiddenPaths(item, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => [
    ...(forbiddenLearnerKeys.has(key) ? [`${path}.${key}`] : []),
    ...forbiddenPaths(child, `${path}.${key}`),
  ])
}

if (manifest.assessments.length !== 699) fail(`Expected 699 manifest rows; received ${manifest.assessments.length}`)
if (bindings.length !== 699) fail(`Expected 699 admitted bindings; received ${bindings.length}`)
if (new Set(manifest.assessments.map((row) => row.assessmentRef)).size !== 699) fail('Duplicate assessmentRef')
const bindingByRef = new Map(bindings.map((binding) => [binding.assessmentRef, binding]))
let answerLeaks = 0

for (const row of manifest.assessments) {
  const binding = bindingByRef.get(row.assessmentRef)
  if (!binding) fail(`Manifest record is not admitted: ${row.assessmentRef}`)
  if (!existsSync(resolve(root, row.packageRef))) fail(`Missing package: ${row.packageRef}`)
  if (!existsSync(resolve(root, row.adultAuthorityRef))) fail(`Missing adult authority: ${row.adultAuthorityRef}`)
  const learner = readJson(row.packageRef)
  const adult = readJson(row.adultAuthorityRef)
  if (learner.assessmentRef !== binding.assessmentRef || adult.assessmentRef !== binding.assessmentRef) fail(`Identity mismatch: ${row.assessmentRef}`)
  if (learner.courseRef !== binding.releaseSlotId || learner.subject !== binding.subject || learner.grade !== binding.grade) fail(`Wrong subject/course/grade: ${row.assessmentRef}`)
  if (learner.location?.unitRef !== binding.unitRef) fail(`Wrong unit: ${row.assessmentRef}`)
  if (!Array.isArray(learner.instructions) || learner.instructions.some((item) => !item.trim())) fail(`Missing instructions: ${row.assessmentRef}`)
  if (!Array.isArray(learner.learnerTasks) || learner.learnerTasks.length === 0) fail(`Empty assessment: ${row.assessmentRef}`)
  if (learner.learnerTasks.some((task) => !task.taskRef || !task.prompt)) fail(`Empty learner task: ${row.assessmentRef}`)
  if (!learner.responseMode || !learner.completionScoringAuthorityClass) fail(`Missing response/authority mode: ${row.assessmentRef}`)
  if (!Array.isArray(learner.learnerSuccessCriteria) || learner.learnerSuccessCriteria.length === 0) fail(`Missing success criteria: ${row.assessmentRef}`)
  if (learner.productionReadiness?.status !== 'READY' || learner.productionReadiness?.structuralOnly !== false) fail(`Structural-only package: ${row.assessmentRef}`)
  if (learner.productionReadiness?.answerMaterialIncluded !== false) fail(`Answer custody unspecified: ${row.assessmentRef}`)
  if (!Array.isArray(learner.standards) || (!learner.standards.length && !learner.standardsMappingAuthority)) fail(`Missing standards authority: ${row.assessmentRef}`)
  if (!String(learner.adultScoringAuthorityRef).startsWith('restricted:')) fail(`Adult authority is not restricted: ${row.assessmentRef}`)
  const leaked = forbiddenPaths(learner)
  answerLeaks += leaked.length
  if (leaked.length) fail(`Answer leak in ${row.assessmentRef}: ${leaked.join(', ')}`)
  if (adult.authorityClass !== learner.completionScoringAuthorityClass) fail(`Authority mismatch: ${row.assessmentRef}`)
  if (!Array.isArray(adult.rubricDimensions) || adult.rubricDimensions.length === 0) fail(`Missing rubric: ${row.assessmentRef}`)
  if (adult.assessorBoundary !== 'INJECTED_PRODUCTION_ASSESSOR') fail(`Scoring boundary mismatch: ${row.assessmentRef}`)
  if (adult.authorityClass === 'GUARDIAN_REQUIRED') {
    if (binding.subject !== 'ready-for-life') fail(`Guardian authority outside RFL: ${row.assessmentRef}`)
    if (adult.completionAuthority?.learnerAssertionCanCertify !== false || adult.completionAuthority?.adultAttestationRequired !== true) fail(`Learner can certify guardian assessment: ${row.assessmentRef}`)
  }
}

if (manifest.totals.structuralOnlyRemaining !== 0) fail('Structural-only total is not zero')
if (answerLeaks !== 0 || manifest.totals.answerLeaks !== 0) fail(`Answer leaks: ${answerLeaks}`)
console.log(JSON.stringify({
  classification: manifest.classification,
  assessments: manifest.assessments.length,
  materialized: manifest.totals.materialized,
  structuralOnlyRemaining: manifest.totals.structuralOnlyRemaining,
  answerLeaks,
  byAuthority: manifest.totals.byAuthority,
  bySubject: manifest.totals.bySubject,
}, null, 2))
