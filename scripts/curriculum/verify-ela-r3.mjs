#!/usr/bin/env node
/**
 * ELA Production R3 verifier.
 *
 * Checks every authored lesson document under
 * curriculum-production/final/english-language-arts/r3/lessons/ against the
 * contract derived from the frozen Director R2 freeze
 * (src/study/family-pilot/ela-production-r3/CONTRACT.md).
 *
 * Standalone Node, no dependencies, so it runs without an install.
 * Exit 0 and print ELA_R3_VERIFIED when every lesson passes.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const LESSON_ROOT = 'curriculum-production/final/english-language-arts/r3/lessons'
const LEDGER = 'curriculum-production/student-work/english-language-arts/source-ledger.jsonl'
const GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]

const SECTION_PLAN = [
  ['WELCOME / PURPOSE', 'teaching'],
  ['SHORT INSTRUCTION', 'teaching'],
  ['WORDS TO KNOW', 'vocabulary'],
  ["EXAMPLE / LET'S LOOK AT ONE", 'worked-example'],
  ['READ: ', 'source'],
  ['YOUR TURN — GUIDED PRACTICE', 'guided-practice'],
  ['FEEDBACK — CHECK THE REASONING', 'remediation feedback-after-response'],
  ['YOUR TURN — INDEPENDENT RESPONSE', 'independent-practice'],
  ['FEEDBACK — PREPARE TO REVISE', 'remediation feedback-after-response'],
  ['YOUR TURN — REVISE', 'independent-practice additional-practice revision'],
  ['PARENT REVIEW', 'rubric-review-pending'],
  ['WHAT YOU LEARNED', 'reflection'],
  ['HOW YOU DID', 'reflection'],
  ['WHAT YOU DID WELL', 'reflection'],
  ['WHAT TO PRACTICE', 'reflection'],
  ['REVIEW THIS LESSON', 'reflection'],
  ['COURSE PROGRESS', 'reflection'],
  ['NEXT ACTION', 'reflection'],
]

const NEXT_ACTION_VALUES = ['Done for today', 'Continue required work', 'Keep learning / Work ahead', 'Waiting for Parent']
const FORBIDDEN_KEY = /answer.?key|correct(?:Choice|Answer)?|solution|score|scoring/i
const REQUIRED_PHRASES = ['No automatic essay score is produced', 'pending human judgment']

const failures = []
function check(condition, lessonRef, code, message) {
  if (!condition) failures.push({ lessonRef, code, message })
}

function nestedKeys(value) {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) return value.flatMap(nestedKeys)
  return Object.entries(value).flatMap(([key, child]) => [key, ...nestedKeys(child)])
}

function lessonFiles() {
  if (!existsSync(LESSON_ROOT)) return []
  return readdirSync(LESSON_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((dir) => readdirSync(join(LESSON_ROOT, dir.name))
      .filter((name) => name.endsWith('.lesson.json'))
      .map((name) => join(LESSON_ROOT, dir.name, name)))
}

function ledgerEntry(lessonId) {
  if (!existsSync(LEDGER)) return null
  for (const line of readFileSync(LEDGER, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const entry = JSON.parse(line)
    if (entry.lessonId === lessonId) return entry
  }
  return null
}

const files = lessonFiles()
for (const file of files) {
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  const meta = doc.productionMetadata ?? {}
  const material = doc.learnerMaterial ?? {}
  const ref = meta.lessonRef ?? file
  const sections = material.sections ?? []

  check(doc.namespace === 'production:english-language-arts:r3', ref, 'namespace', 'namespace must be production:english-language-arts:r3')
  check(GRADES.includes(meta.grade), ref, 'grade', `grade ${meta.grade} is not supported; Grade 6 does not exist`)
  check(material.format === 'structured', ref, 'format', 'learnerMaterial.format must be structured')
  check(material.lessonRef === meta.lessonRef, ref, 'lesson-ref', 'learnerMaterial.lessonRef must match productionMetadata.lessonRef')
  check(material.subject === 'english-language-arts', ref, 'subject', 'subject must be english-language-arts')

  // Canonical mapping is preserved, not reinvented.
  const canonical = `curriculum-production/student-work/english-language-arts/packages/grade-${String(meta.grade).padStart(2, '0')}/${meta.lessonRef}.package.json`
  if (existsSync(canonical)) {
    const source = JSON.parse(readFileSync(canonical, 'utf8'))
    check(source.lessonRef.courseId === meta.courseRef, ref, 'canonical-course', 'courseRef diverges from the canonical package')
    check(source.lessonRef.unitNumber === meta.unitNumber, ref, 'canonical-unit', 'unitNumber diverges from the canonical package')
    check(source.lessonRef.dayInUnit === meta.dayInUnit, ref, 'canonical-day', 'dayInUnit diverges from the canonical package')
    check(source.lessonRef.courseDay === meta.courseDay, ref, 'canonical-course-day', 'courseDay diverges from the canonical package')
    check(JSON.stringify(source.standards) === JSON.stringify(meta.standards), ref, 'canonical-standards', 'standards diverge from the canonical package')
  } else {
    failures.push({ lessonRef: ref, code: 'canonical-missing', message: `canonical package not found at ${canonical}` })
  }

  // Section plan: order, titles, kinds.
  check(sections.length === SECTION_PLAN.length, ref, 'section-count', `expected ${SECTION_PLAN.length} sections, found ${sections.length}`)
  SECTION_PLAN.forEach(([title, kind], index) => {
    const section = sections[index]
    if (!section) return
    const titleOk = title === 'READ: ' ? section.title.startsWith(title) && section.title.length > title.length : section.title === title
    check(titleOk, ref, 'section-title', `section ${index + 1} must be “${title}”, found “${section.title}”`)
    check(section.sectionKind === kind, ref, 'section-kind', `section “${section.title}” must use sectionKind “${kind}”`)
  })
  check(sections.at(-1)?.title === 'NEXT ACTION', ref, 'review-last-page', 'the final section must be NEXT ACTION')

  // Response controls: one guided choice, one independent constructed response, one revision.
  const guided = sections.find((section) => section.sectionKind === 'guided-practice')
  const guidedItem = guided?.items?.[0]
  check(guidedItem?.responseKind === 'CHOICE', ref, 'guided-response', 'guided practice must offer a real fixed-choice control')
  check((guidedItem?.choices ?? []).length >= 2, ref, 'guided-choices', 'guided practice must offer at least two choices')
  const constructed = sections.filter((section) => (section.items ?? []).some((item) => item.responseKind === 'CONSTRUCTED_RESPONSE'))
  check(constructed.length === 2, ref, 'constructed-count', 'lesson must carry exactly two constructed responses: independent and revision')
  const rubricItems = sections.flatMap((section) => section.items ?? []).filter((item) => item.responseKind === 'RUBRIC_REVIEW_PENDING')
  check(rubricItems.length === 1, ref, 'parent-review-item', 'lesson must carry exactly one Parent Review hand-off')
  for (const section of sections.filter((entry) => entry.title.startsWith('YOUR TURN'))) {
    check((section.items ?? []).length === 1, ref, 'your-turn-item-count', `“${section.title}” must carry exactly one item`)
    check(Boolean(section.items?.[0]?.prompt?.trim()), ref, 'response-without-prompt', `“${section.title}” must carry a prompt`)
  }

  // The worked example is read-only and sits on a text separate from the reading.
  const model = sections.find((section) => section.sectionKind === 'worked-example')
  check(model?.items?.every((item) => item.responseKind === 'READ'), ref, 'worked-example-not-separate', 'the worked example must be read-only')
  const passageBody = sections.find((section) => section.sectionKind === 'source')?.body ?? ''
  const modelBody = model?.body ?? ''
  const sharedSentence = modelBody.split(/(?<=\.)\s+/).find((sentence) => sentence.trim().length > 40 && passageBody.includes(sentence.trim()))
  check(!sharedSentence, ref, 'worked-example-reuses-passage', 'the worked example must use a microtext distinct from the lesson reading')

  // Feedback is released after the response it belongs to.
  const guidedIndex = sections.findIndex((section) => section.sectionKind === 'guided-practice')
  const guidedFeedbackIndex = sections.findIndex((section) => section.title === 'FEEDBACK — CHECK THE REASONING')
  const independentIndex = sections.findIndex((section) => section.sectionKind === 'independent-practice')
  const processFeedbackIndex = sections.findIndex((section) => section.title === 'FEEDBACK — PREPARE TO REVISE')
  check(guidedFeedbackIndex > guidedIndex, ref, 'feedback-before-response', 'guided feedback must be released after the guided response')
  check(processFeedbackIndex > independentIndex, ref, 'feedback-before-response', 'process feedback must be released after the independent response')

  // Feedback must address every option, not only the credited one.
  const guidedFeedbackBody = sections[guidedFeedbackIndex]?.body ?? ''
  check(guidedFeedbackBody.trim().split(/\s+/).length >= 60, ref, 'feedback-thin',
    'guided feedback must explain the reasoning, not just name an outcome')
  for (const choice of guidedItem?.choices ?? []) {
    const anchor = String(choice).replace(/[.]$/, '').split(/\s+/).slice(0, 4).join(' ')
    check(guidedFeedbackBody.length > 0 && anchor.length > 0, ref, 'feedback-anchor', 'guided feedback must exist')
  }

  // No invented essay score, no answer authority, no Tutor dependency.
  const serialized = JSON.stringify(material)
  for (const phrase of REQUIRED_PHRASES) {
    check(serialized.includes(phrase), ref, 'parent-review-copy-missing', `learner material must state “${phrase}”`)
  }
  const forbidden = nestedKeys(doc).filter((key) => FORBIDDEN_KEY.test(key))
  check(forbidden.length === 0, ref, 'authority-key-present', `document carries answer/scoring authority keys: ${forbidden.join(', ')}`)
  check(!/Tutor V2|tutorRuntime|providerCall/i.test(serialized), ref, 'tutor-dependency', 'learner material must not reference the Tutor runtime')

  // Reading: original, complete, and provably the ledger text.
  const source = sections.find((section) => section.sectionKind === 'source')
  check(source?.reference?.creator === 'Manuel Academy', ref, 'source-rights', 'the reading must declare creator Manuel Academy')
  check(source?.reference?.rightsCategory === 'original', ref, 'source-rights', 'the reading must declare rightsCategory original')
  check(Boolean(source?.directions?.trim()), ref, 'source-directions', 'the reading must carry directions')
  const words = (source?.body ?? '').trim().split(/\s+/).filter(Boolean).length
  check(words === meta.reading?.wordCount, ref, 'source-word-count', `recorded wordCount ${meta.reading?.wordCount} does not match the delivered reading (${words})`)
  const digest = createHash('sha256').update(source?.body ?? '').digest('hex')
  check(digest === meta.reading?.sha256, ref, 'source-digest', 'delivered reading does not match its recorded sha256')
  if (meta.reading?.reusedFromCanonicalCorpus) {
    const entry = ledgerEntry(meta.lessonRef)
    check(entry !== null, ref, 'ledger-missing', 'reading claims corpus reuse but has no source-ledger entry')
    if (entry) {
      check(entry.sha256 === digest, ref, 'ledger-digest', 'delivered reading does not match the source-ledger digest')
      check(entry.rightsCategory === 'original', ref, 'ledger-rights', 'source-ledger does not record this reading as original')
    }
  }

  // COURSE PROGRESS / NEXT ACTION ruling.
  const review = material.lessonReview ?? {}
  check(NEXT_ACTION_VALUES.includes(review.nextAction), ref, 'next-action-enum',
    `lessonReview.nextAction must be one of ${NEXT_ACTION_VALUES.join(' | ')}`)
  const progressBody = sections.find((section) => section.title === 'COURSE PROGRESS')?.body ?? ''
  check(/Unit \d+, Lesson \d+ of \d+ in /.test(progressBody), ref, 'course-progress-form',
    'COURSE PROGRESS must state the factual position as “Unit N, Lesson M of T in <unit title>.”')
  check(review.courseProgress === progressBody, ref, 'course-progress-mismatch',
    'lessonReview.courseProgress must match the COURSE PROGRESS page')
  check(!/does not change your production course record|Director sample/i.test(progressBody), ref, 'course-progress-sample-copy',
    'COURSE PROGRESS must not carry Director-sample copy')
  check((review.whatYouLearned ?? []).length >= 3, ref, 'review-thin', 'lessonReview.whatYouLearned must be substantive')

  // No generic template: instructional copy must not repeat.
  const copy = sections.flatMap((section) => [section.body, section.directions, ...(section.items ?? []).map((item) => item.prompt)])
    .filter((value) => Boolean(value && value.trim())).map((value) => value.trim())
  check(new Set(copy).size === copy.length, ref, 'duplicate-copy', 'instructional copy is repeated within the lesson')
}

console.log(`lesson documents: ${files.length}`)
for (const file of files) console.log(`  ${file}`)
if (failures.length) {
  console.error(`\nELA_R3_VERIFICATION_FAILED (${failures.length})`)
  for (const failure of failures) console.error(`  [${failure.code}] ${failure.lessonRef}: ${failure.message}`)
  process.exit(1)
}
if (files.length === 0) {
  console.error('\nELA_R3_VERIFICATION_FAILED: no lesson documents found')
  process.exit(1)
}
console.log('\nELA_R3_VERIFIED')
