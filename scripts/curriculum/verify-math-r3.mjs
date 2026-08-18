import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const r3Root = 'curriculum-production/final/mathematics/r3'
const RESPONSE_KINDS = ['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE']
const FORBIDDEN_KEY = /^(?:answer|answerKey|correctAnswer|scoring|scoringRule|acceptedChoiceOrdinal|accepted)$/i
const GENERIC_FEEDBACK = /^(?:\s*(?:try again|incorrect|wrong|nope|not quite|good job|great work|correct|nice work)[.!]*\s*)+$/i
const MIN_INCORRECT_FEEDBACK = 40

const failures = []
function check(condition, message) {
  if (!condition) failures.push(message)
  return condition
}
function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8'))
}
function forbiddenAnswerPaths(value, path) {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap((item, index) => forbiddenAnswerPaths(item, `${path}[${index}]`))
  return Object.entries(value).flatMap(([key, item]) => [
    ...(FORBIDDEN_KEY.test(key) ? [`${path}.${key}`] : []),
    ...forbiddenAnswerPaths(item, `${path}.${key}`),
  ])
}
/** The subject of a math prompt is its first number; later numbers are units or scale. */
function subjectNumber(prompt) {
  const match = (prompt ?? '').match(/\d[\d,]*/)
  return match ? match[0].replace(/,/g, '') : null
}

const manifest = readJson(`${r3Root}/manifest.json`)
const authority = readJson(`${r3Root}/${manifest.restrictedAssessmentAuthority}`)

check(manifest.namespace === 'production:mathematics:r3', 'manifest namespace is not production:mathematics:r3')
check(JSON.stringify(manifest.supportedGrades) === JSON.stringify([3, 4, 5, 7, 8, 9, 10, 11, 12]), 'manifest supportedGrades do not match the approved scope')
check(JSON.stringify(manifest.intentionallyUnsupportedGrades) === JSON.stringify([6]), 'Grade 6 must be explicitly excluded')
check(!manifest.lessons.some((lesson) => lesson.grade === 6), 'Grade 6 lesson present in manifest')
check(authority.browserImportAllowed === false, 'restricted assessment authority must not be browser-importable')
check(manifest.lessons.length === manifest.wave1.authoredLessonCount, 'manifest lesson rows disagree with wave1.authoredLessonCount')

for (const row of manifest.lessons) {
  const id = row.lessonRef
  const lesson = readJson(`${r3Root}/${row.file}`)
  const meta = lesson.productionMetadata
  const material = lesson.learnerMaterial
  const source = readJson(row.sourcePackage)

  // Provenance: the canonical corpus defines identity. R3 may not drift from it.
  check(lesson.namespace === 'production:mathematics:r3', `${id}: wrong namespace`)
  check(source.lessonRef.lessonId === id, `${id}: source package lessonId mismatch`)
  check(source.lessonRef.courseId === row.courseRef, `${id}: courseRef mismatch with canonical package`)
  check(source.lessonRef.grade === row.grade, `${id}: grade mismatch with canonical package`)
  check(source.lessonRef.unitNumber === meta.unitNumber, `${id}: unitNumber mismatch with canonical package`)
  check(JSON.stringify(source.standards) === JSON.stringify(row.standards), `${id}: standards mismatch with canonical package`)
  check(JSON.stringify(meta.standards) === JSON.stringify(row.standards), `${id}: lesson metadata standards disagree with manifest`)

  // C1 / surface
  check(material.lessonRef === id, `${id}: learnerMaterial.lessonRef is not the canonical lesson id`)
  check(material.format === 'structured', `${id}: format must be structured`)
  check(material.subject === 'mathematics', `${id}: subject must be mathematics`)

  const sections = material.sections ?? []
  const byKind = (kind) => sections.filter((section) => section.sectionKind === kind)
  const sectionRefs = sections.map((section) => section.sectionRef)
  check(new Set(sectionRefs).size === sectionRefs.length, `${id}: duplicate sectionRef`)
  const directions = sections.map((section) => section.directions?.trim()).filter(Boolean)
  check(new Set(directions).size === directions.length, `${id}: duplicate section directions`)

  // C2 / M1
  const teaching = byKind('teaching')
  check(teaching.length >= 1 && teaching.every((section) => section.body?.trim()), `${id}: C2 teaching section with a body is missing`)

  // C3 / C7
  const worked = byKind('worked-example')
  check(worked.length === 1, `${id}: C3 exactly one worked-example section is expected`)
  const workedItems = worked.flatMap((section) => section.items ?? [])
  check(workedItems.length >= 1, `${id}: C3 worked-example section has no items`)
  for (const item of workedItems) {
    check(!item.responseKind, `${id}: C3/C7 worked item ${item.itemRef} must not carry a response control`)
    check((item.workedSolution?.steps ?? []).length >= 2, `${id}: C3 worked item ${item.itemRef} needs reasoning steps`)
  }

  // C4 / C5 / M4 / M5
  const responseItems = sections.flatMap((section) => (section.items ?? []).filter((item) => item.responseKind))
  const itemRefs = sections.flatMap((section) => (section.items ?? []).map((item) => item.itemRef))
  check(new Set(itemRefs).size === itemRefs.length, `${id}: duplicate itemRef`)
  check(responseItems.length >= 1, `${id}: C4 lesson has no learner response items`)
  // C4: a prompt outside the worked example must lead somewhere the learner can respond.
  for (const section of sections) {
    if (section.sectionKind === 'worked-example') continue
    for (const item of section.items ?? []) {
      check(item.responseKind, `${id}: C4 ${item.itemRef} asks a question with no response control`)
    }
  }
  for (const item of responseItems) {
    check(RESPONSE_KINDS.includes(item.responseKind), `${id}: C4 ${item.itemRef} uses unsupported responseKind ${item.responseKind}`)
    check(item.prompt?.trim(), `${id}: C4 ${item.itemRef} has no prompt`)
    if (item.responseKind === 'CHOICE') check((item.choices ?? []).length >= 2, `${id}: C4 ${item.itemRef} is a CHOICE item without real choices`)
    const feedback = item.feedback ?? {}
    check(feedback.correct?.trim() && feedback.incorrect?.trim(), `${id}: C5 ${item.itemRef} is missing a feedback branch`)
    check(!GENERIC_FEEDBACK.test(feedback.incorrect ?? ''), `${id}: C5 ${item.itemRef} incorrect feedback is generic`)
    check((feedback.incorrect ?? '').length >= MIN_INCORRECT_FEEDBACK, `${id}: C5 ${item.itemRef} incorrect feedback is too thin to reteach`)
  }

  // C6 / M6 / C7
  check(byKind('independent-practice').some((section) => (section.items ?? []).some((item) => item.responseKind)), `${id}: C6 independent practice collects no response evidence`)
  check(byKind('remediation').some((section) => (section.items ?? []).some((item) => item.responseKind)), `${id}: M6 reteach section with a real response is missing`)
  check(byKind('mastery-check').some((section) => (section.items ?? []).some((item) => item.responseKind)), `${id}: C7 mastery check collects no response evidence`)

  // M3 / M8: the worked example and the first learner response stay distinct, on different numbers.
  const guided = byKind('guided-practice')[0]
  check(guided, `${id}: M3 guided YOUR TURN section is missing`)
  if (guided) {
    check(guided.sectionRef !== worked[0]?.sectionRef, `${id}: M3 worked example and YOUR TURN share a sectionRef`)
    const workedSubjects = new Set(workedItems.map((item) => subjectNumber(item.prompt)).filter(Boolean))
    const guidedSubject = subjectNumber((guided.items ?? [])[0]?.prompt)
    check(guidedSubject && !workedSubjects.has(guidedSubject), `${id}: M8 YOUR TURN reuses the worked-example number ${guidedSubject}`)
  }

  // C8
  const review = material.lessonReview ?? {}
  check((review.whatYouLearned ?? []).length >= 2, `${id}: C8 lessonReview.whatYouLearned is too thin`)
  check(review.courseProgress?.trim(), `${id}: C8 lessonReview.courseProgress is empty`)
  check(['Done for today', 'Continue required work', 'Keep learning / Work ahead', 'Waiting for Parent'].includes(review.nextAction), `${id}: C8 lessonReview.nextAction is outside the DTO enum`)
  check(/review this lesson/i.test(review.reviewActionLabel ?? ''), `${id}: C8 lessonReview.reviewActionLabel is missing`)

  // P1 / P2
  const leaked = forbiddenAnswerPaths(material, 'learnerMaterial')
  check(leaked.length === 0, `${id}: P1 answer or scoring authority leaked into learner material at ${leaked.join(', ')}`)
  const authorityRefs = (authority.lessons[id] ?? []).map((entry) => entry.itemRef).sort()
  check(JSON.stringify(authorityRefs) === JSON.stringify(responseItems.map((item) => item.itemRef).sort()), `${id}: P2 restricted authority does not cover exactly the required items`)

  console.log(`${id}: sections ${sections.length}, worked items ${workedItems.length}, response items ${responseItems.length}, authority entries ${authorityRefs.length}`)
}

if (failures.length) {
  console.error(`\n${failures.length} contract failure(s):`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`manifest: ${r3Root}/manifest.json`)
console.log(`wave 1 course: ${manifest.wave1.courseRef} (${manifest.wave1.authoredLessonCount} authored / ${manifest.wave1.totalLessonsInCourse} total)`)
console.log('grade 6: absent')
console.log('MATH_R3_CONTRACT_VERIFIED')
