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
const socialSourceRegistry = (await readJson(
  new URL('../curriculum-production/final/social-studies/verified-static-sources.json', import.meta.url),
)).sources
const bindings = (await readFile(new URL('production-bindings.jsonl', ADMITTED), 'utf8'))
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))

function packagePath(ref) {
  const separator = ref.indexOf(':')
  if (!ref.startsWith('git+') || separator < 0) throw new Error(`Invalid production package ref: ${ref}`)
  const relative = ref.slice(separator + 1)
  if (relative.includes('/answer-key') || relative.includes('/scoring-guide')) {
    throw new Error(`Adult material cannot be used as a learner package: ${ref}`)
  }
  return new URL(relative, ROOT)
}

const bindingsByCourse = new Map()
for (const binding of bindings) {
  const bucket = bindingsByCourse.get(binding.courseRef) ?? []
  bucket.push(binding)
  bindingsByCourse.set(binding.courseRef, bucket)
}

await rm(OUTPUT, { recursive: true, force: true })
await mkdir(new URL('courses/', OUTPUT), { recursive: true })
const projectionStats = createProjectionStats()

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
  const payload = JSON.stringify({ courseRef: course.courseRef, lessons: safeRows, bindings: safeBindings, materials })
  if (/answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex|answer[-_]keys?|\/scoring\/|scoring[-_]guide|teacher[-_]guide/i.test(payload)) {
    throw new Error(`Learner payload for ${course.courseRef} contains an adult/scoring field`)
  }
  await writeFile(new URL(`courses/${course.courseRef}.json`, OUTPUT), payload)
}

await writeFile(
  new URL('manifest.json', OUTPUT),
  JSON.stringify({
    releaseId: releaseManifest.releaseId,
    classification: releaseManifest.classification,
    admissionStatus: releaseManifest.admissionStatus,
    counts: releaseManifest.counts,
    productionBindings: bindings.length,
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
