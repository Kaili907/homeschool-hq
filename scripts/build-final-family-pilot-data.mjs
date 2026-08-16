import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import {
  STRUCTURED_PROJECTION_VERSION,
  assertLearnerSafeMaterial,
  createProjectionStats,
  isLearnerSafeResourceRef,
  mergeProjectionStats,
  projectJsonLearnerMaterial,
  projectMarkdownLearnerMaterial,
} from './learner-projection/structured-projection-r1.mjs'

const ROOT = new URL('../', import.meta.url)
const ADMITTED = new URL('../curriculum-release-admitted/family-pilot-r1/', import.meta.url)
const OUTPUT = new URL('../public/family-pilot-final/2.0.0/', import.meta.url)

const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'))
const runtimeManifest = await readJson(new URL('runtime/runtime-manifest.json', ADMITTED))
const lessonRowsByCourse = await readJson(new URL('runtime/lesson-rows-by-course.json', ADMITTED))
const releaseManifest = await readJson(new URL('MANIFEST.json', ADMITTED))
const browserCatalogProjection = await readJson(new URL('admission/browser-catalog-projection.json', ADMITTED))
const socialSourceRegistry = (await readJson(
  new URL('../curriculum-production/final/social-studies/verified-static-sources.json', import.meta.url),
)).sources
const bindings = (await readFile(new URL('production-bindings.jsonl', ADMITTED), 'utf8'))
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
const assessmentBindings = await readJson(new URL('assessment-bindings.json', ADMITTED))

function packagePath(ref) {
  const separator = ref.indexOf(':')
  if (!ref.startsWith('git+') || separator < 0) throw new Error(`Invalid production package ref: ${ref}`)
  const relative = ref.slice(separator + 1)
  if (relative.includes('/answer-key') || relative.includes('/scoring-guide')) {
    throw new Error(`Adult material cannot be used as a learner package: ${ref}`)
  }
  return new URL(relative, ROOT)
}

function projectAssessmentPackage(pkg) {
  const projected = {
    schemaVersion: pkg.schemaVersion,
    kind: pkg.kind,
    assessmentRef: pkg.assessmentRef,
    courseRef: pkg.courseRef,
    grade: pkg.grade,
    subject: pkg.subject,
    location: pkg.location,
    standards: pkg.standards,
    instructions: pkg.instructions,
    learnerTasks: pkg.learnerTasks,
    responseMode: pkg.responseMode,
    completionScoringAuthorityClass: pkg.completionScoringAuthorityClass,
    learnerSuccessCriteria: pkg.learnerSuccessCriteria,
    accommodations: pkg.accommodations,
    productionReadiness: pkg.productionReadiness,
  }
  const serialized = JSON.stringify(projected)
  if (/answerKeyRef|answerAuthorityRef|adultScoringAuthorityRef|scoringAuthorityRef|correctAnswer|answerIndex|expectedAnswer|scoringGuide/i.test(serialized)) {
    throw new Error(`Learner assessment ${pkg.assessmentRef} contains adult scoring authority`)
  }
  return projected
}

const bindingsByCourse = new Map()
for (const binding of bindings) {
  const bucket = bindingsByCourse.get(binding.courseRef) ?? []
  bucket.push(binding)
  bindingsByCourse.set(binding.courseRef, bucket)
}
const assessmentBindingsByCourse = new Map()
for (const binding of assessmentBindings) {
  const bucket = assessmentBindingsByCourse.get(binding.releaseSlotId) ?? []
  bucket.push(binding)
  assessmentBindingsByCourse.set(binding.releaseSlotId, bucket)
}

await rm(OUTPUT, { recursive: true, force: true })
await mkdir(new URL('courses/', OUTPUT), { recursive: true })
const projectionStats = createProjectionStats()
const adminCourses = []
const adminUnits = []
const adminLessons = []
const adminAssessments = []

for (const course of runtimeManifest.courses) {
  const rows = lessonRowsByCourse[course.courseRef]
  const courseBindings = bindingsByCourse.get(course.courseRef) ?? []
  if (!Array.isArray(rows) || rows.length !== course.lessonCount || courseBindings.length !== course.lessonCount) {
    throw new Error(`Incomplete admitted course ${course.courseRef}`)
  }
  const rowByLesson = new Map(rows.map((row) => [row.lessonRef, row]))
  const safeRows = rows.map((row) => {
    const safeResourceRefs = row.resourceRefs.filter(isLearnerSafeResourceRef)
    projectionStats.adultResourceLocatorsRemoved += row.resourceRefs.length - safeResourceRefs.length
    return {
      ...row,
      // Adult answer/scoring resource locators are not needed to render or start
      // the learner lesson and therefore never enter its lazy browser payload.
      resourceRefs: [...new Set(safeResourceRefs)],
    }
  })
  const safeBindings = {}
  const materials = {}
  for (const binding of courseBindings) {
    const row = rowByLesson.get(binding.lessonRef)
    if (!row) throw new Error(`Binding ${binding.lessonRef} is missing its admitted lesson row`)
    const file = packagePath(binding.productionPackageRef)
    const raw = await readFile(file, 'utf8')
    const projected = extname(file.pathname) === '.json'
      ? projectJsonLearnerMaterial(JSON.parse(raw), binding, row.title, { socialSourceRegistry })
      : projectMarkdownLearnerMaterial(raw, binding, row.title, { socialSourceRegistry })
    const material = projected.material
    assertLearnerSafeMaterial(material)
    mergeProjectionStats(projectionStats, projected.stats)
    if (binding.scoringAuthorityRef) projectionStats.adultFieldsRemoved += 1
    if (binding.scoringMetadata) projectionStats.adultFieldsRemoved += 1
    safeBindings[binding.lessonRef] = {
      lessonRef: binding.lessonRef,
      courseRef: binding.courseRef,
      grade: binding.grade,
      subject: binding.subject,
      productionPackageRef: binding.productionPackageRef,
      productionSourceCommit: binding.productionSourceCommit,
      completionAuthority: binding.completionAuthority,
      sourceReadinessKind: binding.sourceReadinessKind,
      sourceRuntimeState: binding.sourceRuntimeState,
    }
    materials[binding.lessonRef] = material
  }
  const safeAssessmentBindings = {}
  const assessments = {}
  for (const binding of assessmentBindingsByCourse.get(course.courseRef) ?? []) {
    const pkg = JSON.parse(await readFile(packagePath(binding.productionPackageRef), 'utf8'))
    if (pkg.assessmentRef !== binding.assessmentRef || pkg.courseRef !== course.courseRef) {
      throw new Error(`Assessment binding identity mismatch: ${binding.assessmentRef}`)
    }
    safeAssessmentBindings[binding.assessmentRef] = {
      assessmentRef: binding.assessmentRef,
      courseRef: binding.releaseSlotId,
      unitRef: binding.unitRef,
      grade: binding.grade,
      subject: binding.subject,
      authorityClass: binding.authorityClass,
      responseMode: binding.responseMode,
      state: binding.state,
    }
    assessments[binding.assessmentRef] = projectAssessmentPackage(pkg)
  }
  const payload = JSON.stringify({
    courseRef: course.courseRef,
    lessons: safeRows,
    bindings: safeBindings,
    materials,
    assessmentBindings: safeAssessmentBindings,
    assessments,
  })
  if (/answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex|answer[-_]keys?|\/scoring\/|scoring[-_]guide|teacher[-_]guide/i.test(payload)) {
    throw new Error(`Learner payload for ${course.courseRef} contains an adult/scoring field`)
  }
  await writeFile(new URL(`courses/${course.courseRef}.json`, OUTPUT), payload)

  adminCourses.push({
    courseId: course.courseRef,
    grade: course.grade,
    subject: course.subject,
    title: course.title,
    days: course.days,
  })
  const courseUnits = browserCatalogProjection.units.filter((unit) => unit.courseRef === course.courseRef)
  for (const unit of courseUnits) {
    const assessment = unit.assessmentRef ? assessments[unit.assessmentRef] : undefined
    adminUnits.push({
      unitId: unit.unitRef,
      courseId: unit.courseRef,
      grade: Number(unit.grade),
      subject: unit.subject,
      unitNumber: unit.unitNumber,
      title: unit.title,
      days: unit.days,
      standards: assessment?.standards ?? [],
      essentialQuestion: unit.essentialQuestion,
      topics: [unit.title],
      lessonIds: unit.lessonRefs,
      ...(unit.assessmentRef ? { assessmentId: unit.assessmentRef } : {}),
    })
  }
  const unitByNumber = new Map(courseUnits.map((unit) => [unit.unitNumber, unit]))
  for (const row of safeRows) {
    const unit = unitByNumber.get(row.unitNumber)
    if (!unit) throw new Error(`Admin catalog unit is missing for ${row.lessonRef}`)
    adminLessons.push({
      lessonId: row.lessonRef,
      courseId: course.courseRef,
      grade: course.grade,
      subject: course.subject,
      courseDay: row.courseDay,
      unitNumber: row.unitNumber,
      unitTitle: unit.title,
      dayInUnit: row.dayInUnit,
      title: row.title,
      standards: [],
    })
  }
  for (const assessment of Object.values(assessments)) {
    adminAssessments.push({
      assessmentId: assessment.assessmentRef,
      courseId: assessment.courseRef,
      unitNumber: assessment.location.unitNumber,
      unitTitle: assessment.location.unitTitle,
      standards: assessment.standards,
    })
  }
}

const adminCatalog = {
  source: {
    packageId: releaseManifest.releaseId,
    version: releaseManifest.releaseVersion,
    authoredOn: '2026-08-13',
    status: releaseManifest.admissionStatus,
    lifecycle: 'published',
    validationStatus: 'passed',
  },
  grades: releaseManifest.supportedGrades,
  courses: adminCourses,
  units: adminUnits,
  lessons: adminLessons,
  assessments: adminAssessments,
}
for (const [key, expected] of Object.entries(releaseManifest.counts)) {
  const actual = key === 'grades' ? adminCatalog.grades.length : adminCatalog[key].length
  if (actual !== expected) throw new Error(`Admin catalog ${key} count ${actual} does not match admitted ${expected}`)
}
await writeFile(new URL('admin-curriculum-catalog.json', OUTPUT), JSON.stringify(adminCatalog))

await writeFile(
  new URL('manifest.json', OUTPUT),
  JSON.stringify({
    releaseId: releaseManifest.releaseId,
    classification: releaseManifest.classification,
    admissionStatus: releaseManifest.admissionStatus,
    counts: releaseManifest.counts,
    productionBindings: bindings.length,
    assessmentBindings: assessmentBindings.length,
    assessments: assessmentBindings.map((binding) => ({
      assessmentRef: binding.assessmentRef,
      courseRef: binding.releaseSlotId,
      unitRef: binding.unitRef,
      grade: binding.grade,
      subject: binding.subject,
      authorityClass: binding.authorityClass,
      responseMode: binding.responseMode,
    })),
    dynamicSocialSources: releaseManifest.dynamicSocialSources,
    structuredProjection: projectionStats,
    runtime: runtimeManifest,
  }),
)

console.log(JSON.stringify({
  status: 'PASS',
  projectionVersion: STRUCTURED_PROJECTION_VERSION,
  courses: runtimeManifest.courses.length,
  ...projectionStats,
}, null, 2))
