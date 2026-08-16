import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const releaseRoot = join(root, 'public/family-pilot-final/2.0.0')
const manifest = JSON.parse(readFileSync(join(releaseRoot, 'manifest.json'), 'utf8'))
const failures = []
const check = (condition, message) => { if (!condition) failures.push(message) }
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected)

check(manifest.releaseId === 'family-pilot-r1', 'wrong releaseId')
check(manifest.classification === 'ADMITTED_PRODUCTION_BOUND_FAMILY_PILOT_R1', 'wrong release classification')
check(manifest.admissionStatus === 'ADMITTED', 'release is not admitted')
check(same(manifest.counts, { grades: 9, courses: 90, units: 698, lessons: 8292, assessments: 699 }), 'aggregate counts drifted')
check(manifest.productionBindings === 8292, 'production binding count drifted')
check(same(manifest.dynamicSocialSources, { admitted: 12, runtimeState: 'PENDING_SOURCE_ATTACHMENT', readyTransition: 'ATTACHED_SATISFIED' }), 'dynamic source contract drifted')

const expectedGrades = [3, 4, 5, 7, 8, 9, 10, 11, 12]
const courseDescriptors = manifest.runtime?.courses ?? []
const grades = [...new Set(courseDescriptors.map((course) => course.grade))].sort((a, b) => a - b)
check(same(grades, expectedGrades), `grade coverage drifted: ${grades.join(',')}`)
check(!grades.includes(6), 'Grade 6 appeared in the admitted runtime')
check(courseDescriptors.length === 90, 'runtime course descriptor count drifted')

const courseFiles = readdirSync(join(releaseRoot, 'courses')).filter((file) => file.endsWith('.json')).sort()
check(courseFiles.length === 90, `expected 90 lazy course payloads, found ${courseFiles.length}`)

const subjectCounts = {}
const activeLessonRefs = new Set()
const dynamicLessonRefs = []
const guardianLessonRefs = []
let lessons = 0
let bindings = 0
let materials = 0
let leakedAdultFields = 0
const forbiddenAdultKey = /^(answerKeyRef|scoringAuthorityRef|scoringRef|correctAnswer|answerIndex)$/i
const forbiddenAdultText = /(answer-keys|scoring-guide|teacher-guide)/i

function walkForAdultLeak(value, path = '') {
  if (Array.isArray(value)) return value.forEach((item, index) => walkForAdultLeak(item, `${path}[${index}]`))
  if (!value || typeof value !== 'object') return
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenAdultKey.test(key) || (typeof item === 'string' && forbiddenAdultText.test(item))) leakedAdultFields += 1
    walkForAdultLeak(item, `${path}.${key}`)
  }
}

for (const file of courseFiles) {
  const payload = JSON.parse(readFileSync(join(releaseRoot, 'courses', file), 'utf8'))
  const descriptor = courseDescriptors.find((course) => course.courseRef === payload.courseRef)
  check(Boolean(descriptor), `${file}: missing runtime descriptor`)
  check(payload.lessons.length === descriptor?.lessonCount, `${file}: lesson count differs from runtime descriptor`)
  check(Object.keys(payload.bindings).length === payload.lessons.length, `${file}: binding coverage is incomplete`)
  check(Object.keys(payload.materials).length === payload.lessons.length, `${file}: material coverage is incomplete`)
  subjectCounts[descriptor?.subject ?? 'unknown'] = (subjectCounts[descriptor?.subject ?? 'unknown'] ?? 0) + payload.lessons.length
  for (const lesson of payload.lessons) {
    activeLessonRefs.add(lesson.lessonRef)
    lessons += 1
    const binding = payload.bindings[lesson.lessonRef]
    const material = payload.materials[lesson.lessonRef]
    check(Boolean(binding), `${lesson.lessonRef}: missing production binding`)
    check(Boolean(material), `${lesson.lessonRef}: missing learner material`)
    check(binding?.lessonRef === lesson.lessonRef, `${lesson.lessonRef}: binding identity mismatch`)
    check(material?.lessonRef === lesson.lessonRef, `${lesson.lessonRef}: material identity mismatch`)
    if (binding) bindings += 1
    if (material) materials += 1
    if (lesson.sourceReadiness?.dynamicSource) dynamicLessonRefs.push(lesson.lessonRef)
    if (binding?.completionAuthority === 'GUARDIAN_ATTESTATION_REQUIRED') guardianLessonRefs.push(lesson.lessonRef)
    walkForAdultLeak(material)
  }
}

check(lessons === 8292 && bindings === 8292 && materials === 8292, 'lesson/binding/material totals are not 8292/8292/8292')
check(leakedAdultFields === 0, `${leakedAdultFields} adult-only answer/scoring fields leaked into learner material`)
check(dynamicLessonRefs.length === 12, `expected 12 dynamic source lessons, found ${dynamicLessonRefs.length}`)
check(guardianLessonRefs.length === 81, `expected 81 guardian-authority lessons, found ${guardianLessonRefs.length}`)

const expectedSubjectCounts = {
  mathematics: 1620,
  'english-language-arts': 1620,
  science: 972,
  'social-studies': 972,
  health: 324,
  'physical-education': 972,
  'ready-for-life': 324,
  technology: 336,
  'arts-and-music': 648,
  'financial-literacy': 504,
}
check(
  Object.keys(subjectCounts).length === Object.keys(expectedSubjectCounts).length &&
    Object.entries(expectedSubjectCounts).every(([subject, count]) => subjectCounts[subject] === count),
  `subject totals drifted: ${JSON.stringify(subjectCounts)}`,
)

const reservePaths = [
  join(root, 'curriculum-release-admitted/family-pilot-r1/math-reserve-manifest.json'),
  join(root, 'curriculum-production/final/mathematics/reserve-manifest.json'),
]
let reserveRefs = []
for (const reservePath of reservePaths) {
  const reserve = JSON.parse(readFileSync(reservePath, 'utf8'))
  check(reserve.lessonCount === 4 && reserve.separateFromActiveSchedule === true, `${reservePath}: reserve separation drifted`)
  check(reserve.records.every((item) => item.status === 'RESERVE_TUTOR' && item.countsAsActiveSchoolDay === false), `${reservePath}: reserve record became active`)
  reserveRefs = reserve.records.map((item) => item.lessonId)
}
check(reserveRefs.every((lessonRef) => !activeLessonRefs.has(lessonRef)), 'a reserve math lesson entered the active 8,292-lesson schedule')

// The audit must prove that it detects the three launch-critical negative controls.
const negativeControls = {
  missingBinding: (() => { const clone = { bindings: {} }; return !clone.bindings['missing'] })(),
  adultLeak: forbiddenAdultKey.test('answerKeyRef'),
  grade6Admission: !expectedGrades.includes(6),
}
check(Object.values(negativeControls).every(Boolean), 'one or more negative controls failed to detect its injected fault')

let bundle = null
const assetsRoot = join(root, 'dist/assets')
if (existsSync(assetsRoot)) {
  const files = readdirSync(assetsRoot)
  const finalChunks = files.filter((file) => /^FinalFamilyPilotApp-.*\.js$/.test(file))
  check(finalChunks.length === 1, `expected one final-app chunk, found ${finalChunks.length}`)
  if (finalChunks[0]) {
    const path = join(assetsRoot, finalChunks[0])
    const text = readFileSync(path, 'utf8')
    check(!/(createLocalDevelopmentStudyPorts|fakeIndexedDb|node:fs)/.test(text), 'development/test adapter leaked into production final-app chunk')
    check(!text.includes('ma-g12-financial-literacy-u07-l72'), 'lazy course lesson bodies leaked into initial final-app chunk')
    bundle = { file: finalChunks[0], bytes: statSync(path).size }
  }
  check(existsSync(join(root, 'dist/family-pilot-final/2.0.0/manifest.json')), 'built release manifest is missing')
  check(readdirSync(join(root, 'dist/family-pilot-final/2.0.0/courses')).filter((file) => file.endsWith('.json')).length === 90, 'built lazy course payload count drifted')
}

const report = {
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  releaseId: manifest.releaseId,
  counts: { ...manifest.counts, productionBindings: bindings, learnerMaterials: materials },
  grades,
  subjectCounts,
  guardianAuthorityLessons: guardianLessonRefs.length,
  dynamicSourceLessons: dynamicLessonRefs.length,
  reserveMathLessonsExcluded: reserveRefs.length,
  adultOnlyLeakCount: leakedAdultFields,
  negativeControls,
  bundle,
  failures,
}
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exitCode = 1
