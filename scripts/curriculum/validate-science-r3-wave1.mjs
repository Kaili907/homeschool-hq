/**
 * Science R3 Wave 1 validator.
 *
 * Proves the authored Wave 1 lessons against the frozen Director R2 model:
 * schema conformance, canonical Grade 3 Science mapping, the approved
 * NOTICE -> LEARN -> MODEL -> YOUR TURN -> FEEDBACK -> APPLY -> REVIEW rhythm,
 * real response controls through the real runtime and render model, the
 * seven-part lesson review, no answer-authority leakage, and no reuse of
 * substantive copy from the 36-sample freeze.
 *
 * Run from the repository root:
 *
 *   node --disable-warning=ExperimentalWarning \
 *     --experimental-transform-types \
 *     --experimental-loader ./docs/curriculum-quality/science/director-samples-r2/ts-loader-hook.mjs \
 *     ./scripts/curriculum/validate-science-r3-wave1.mjs
 *
 * The loader hook is reused read-only from the frozen R2 directory so this
 * validator resolves the exact same TypeScript Rich Study modules the frozen
 * samples were proved against. Nothing under docs/curriculum-quality is written.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mapLearnerMaterialToStudySegments } from '../../src/study/family-pilot/final-app/learner-response/mapping.ts'
import { LearnerResponseRuntime } from '../../src/study/family-pilot/final-app/learner-response/runtime.ts'
import { createRichLessonRenderModel } from '../../src/study/family-pilot/lesson-player/renderModel.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')

const waveRoot = path.join(repo, 'curriculum-production/wave-1/science/grade-03')
const manifestPath = path.join(waveRoot, 'GRADE-3-SCIENCE-WAVE-1.manifest.json')
const frozenDir = path.join(repo, 'docs/curriculum-quality/science/director-samples-r2')
const schemaPath = path.join(frozenDir, 'science-director-sample.schema.json')
const approvalPath = path.join(repo, 'curriculum/approvals/director-samples-r2-approved.json')
const canonicalPath = path.join(repo, 'curriculum-production/final/science/packages/ma-g3-science/work-packages.jsonl')

const REVIEW_TITLES = [
  'WHAT YOU LEARNED',
  'EVIDENCE YOU USED',
  'HOW YOU DID',
  'WHAT TO PRACTICE',
  'REVIEW THIS LESSON',
  'COURSE PROGRESS',
  'NEXT ACTION',
]
const RHYTHM = ['NOTICE', 'LEARN', 'MODEL', 'YOUR TURN', 'FEEDBACK', 'APPLY', 'REVIEW']
const INTERACTIVE = new Set(['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'])
const SUBSTANTIVE_MIN = 80

/** Test double for the LearnerResponseStore port. The runtime under test is the real one. */
class MemoryStore {
  #records = []
  async list(context) {
    return this.#records.filter((record) => record.lessonRef === context.lessonRef && record.studentRef === context.studentRef &&
      record.assignmentRef === context.assignmentRef && record.attemptRef === context.attemptRef)
  }
  async save(record) {
    this.#records = [...this.#records.filter((candidate) => candidate.itemRef !== record.itemRef), record]
  }
  async commitAssessment(_pending, assessed) {
    await this.save(assessed)
    return { status: 'accepted', record: assessed }
  }
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function validateSchema(value, rule, pointer = '$') {
  if (rule.type === 'object') assert(value && typeof value === 'object' && !Array.isArray(value), `${pointer} must be an object`)
  else if (rule.type === 'array') assert(Array.isArray(value), `${pointer} must be an array`)
  else if (rule.type) assert.equal(typeof value, rule.type, `${pointer} must be ${rule.type}`)
  if ('const' in rule) assert.deepEqual(value, rule.const, `${pointer} must equal schema const`)
  if (rule.enum) assert(rule.enum.includes(value), `${pointer} must be in schema enum`)
  if (typeof value === 'string') {
    if (rule.minLength) assert(value.length >= rule.minLength, `${pointer} is too short`)
    if (rule.pattern) assert(new RegExp(rule.pattern).test(value), `${pointer} does not match schema pattern`)
  }
  if (Array.isArray(value)) {
    if (rule.minItems) assert(value.length >= rule.minItems, `${pointer} has too few items`)
    if (rule.items) value.forEach((item, index) => validateSchema(item, rule.items, `${pointer}[${index}]`))
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of rule.required ?? []) assert(key in value, `${pointer}.${key} is required`)
    for (const [key, childRule] of Object.entries(rule.properties ?? {})) {
      if (key in value) validateSchema(value[key], childRule, `${pointer}.${key}`)
    }
  }
}

function allStringEntries(value, pointer = '$', entries = []) {
  if (typeof value === 'string') entries.push({ pointer, value })
  else if (Array.isArray(value)) value.forEach((item, index) => allStringEntries(item, `${pointer}[${index}]`, entries))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => allStringEntries(item, `${pointer}.${key}`, entries))
  return entries
}

function substantiveCopy(lesson) {
  return lesson.sections
    .flatMap((section) => [section.body, section.directions, ...(section.items ?? []).flatMap((item) => [item.prompt, ...(item.workedSolution?.steps ?? [])])])
    .filter((text) => typeof text === 'string' && text.length >= SUBSTANTIVE_MIN)
}

function normalize(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function canonicalLessons() {
  const byRef = new Map()
  for (const line of readFileSync(canonicalPath, 'utf8').trim().split('\n')) {
    const record = JSON.parse(line)
    byRef.set(record.lesson_id, record)
  }
  return byRef
}

function responseValue(item) {
  if (item.responseType === 'CHOICE') return item.choices[0].choiceRef
  if (item.responseType === 'NUMERIC') return '31'
  return 'A learner response grounded in the supplied records.'
}

async function proveResponseRuntime(lesson) {
  const context = Object.freeze({
    lessonRef: lesson.lessonRef,
    studentRef: `wave1:student:g${lesson.grade}`,
    assignmentRef: `wave1:assignment:g${lesson.grade}`,
    attemptRef: `wave1:attempt:g${lesson.grade}`,
  })
  const runtime = new LearnerResponseRuntime(lesson, context, new MemoryStore(), undefined, () => new Date('2026-08-18T12:00:00.000Z'))
  const savedTypes = []
  for (const ordinal of [1, 2, 3]) {
    const segmentRef = `${lesson.lessonRef}:segment:${ordinal}`
    let view = await runtime.open(ordinal, segmentRef)
    let guard = 0
    while (view.item && !view.canCompleteSegment) {
      assert(guard++ < 50, `${lesson.lessonRef} segment ${ordinal} did not converge`)
      assert(INTERACTIVE.has(view.item.responseType), `${lesson.lessonRef} exposed a required unsupported response control`)
      const result = await runtime.submit({
        lessonRef: lesson.lessonRef,
        sectionRef: view.item.sectionRef,
        itemRef: view.item.itemRef,
        segmentRef,
        value: responseValue(view.item),
      })
      assert.equal(result.status, 'saved', `${lesson.lessonRef} response did not save`)
      assert.equal(result.assessmentStatus, 'PENDING_ASSESSMENT', `${lesson.lessonRef} browser claimed assessment authority`)
      savedTypes.push(view.item.responseType)
      view = await runtime.open(ordinal, segmentRef)
    }
    assert.equal(view.canCompleteSegment, true, `${lesson.lessonRef} segment ${ordinal} never completed`)
  }
  assert(savedTypes.length >= 3, `${lesson.lessonRef} needs meaningful response evidence`)
  return savedTypes
}

// ---------------------------------------------------------------------------
// 1. The freeze is intact. Nothing here may edit an approved artifact.
// ---------------------------------------------------------------------------
const approval = readJson(approvalPath)
const frozenScience = approval.samples.filter((entry) => entry.subject === 'Science')
assert.equal(approval.sampleCount, 36, 'the R2 approval manifest must still hold 36 samples')
assert.equal(frozenScience.length, 9, 'the R2 approval manifest must still hold 9 Science samples')
for (const entry of frozenScience) {
  assert.equal(sha256(path.join(repo, entry.samplePath)), entry.contentHash, `frozen sample ${entry.sampleId} was modified`)
  assert.equal(entry.approvalStatus, 'DIRECTOR_APPROVED_FOR_PRODUCTION', `${entry.sampleId} lost its approval status`)
}

// ---------------------------------------------------------------------------
// 2. The manifest describes the whole canonical course, with one lesson authored.
// ---------------------------------------------------------------------------
const manifest = readJson(manifestPath)
const canonical = canonicalLessons()
assert.equal(manifest.revision, 'SCIENCE_R3_WAVE_1')
assert.equal(manifest.grade, 3)
assert.equal(manifest.courseId, 'ma-g3-science')
assert.equal(manifest.productionCurriculumChanged, false)
assert.equal(manifest.frozenArtifactsChanged, false)
assert.equal(manifest.legacyFallbackRequired, false)
assert.equal(manifest.playerContract.previewWritesLearnerProgress, false)
assert.deepEqual(manifest.lessonReviewModel, REVIEW_TITLES)
assert.equal(manifest.lessonCount, canonical.size, 'the manifest must cover every canonical lesson')
assert.equal(manifest.lessons.length, canonical.size)
assert.equal(manifest.lessonCount, 108, 'Grade 3 Science is a 108-lesson course')
assert.deepEqual(manifest.lessons.map((entry) => entry.lessonRef), [...canonical.keys()], 'manifest lesson order must follow the canonical sequence')
for (const entry of manifest.lessons) {
  const authority = canonical.get(entry.lessonRef)
  assert(authority, `${entry.lessonRef} is not a canonical Grade 3 Science lesson`)
  assert.equal(entry.title, authority.title, `${entry.lessonRef} title drifted from the canonical sequence`)
  assert.deepEqual(entry.standards, authority.standards, `${entry.lessonRef} standards drifted from the canonical sequence`)
  assert.equal(entry.unitNumber, authority.unit_number)
  assert.equal(entry.dayInUnit, authority.day_in_unit)
  assert.equal(entry.courseDay, authority.course_day)
  assert.deepEqual(entry.canonicalSource, {
    commit: authority.source.commit, lineage: authority.source.lineage,
    path: authority.source.path, recordId: authority.source.record_id,
  }, `${entry.lessonRef} canonical provenance drifted`)
  assert(['AUTHORED_PENDING_DIRECTOR_APPROVAL', 'NOT_AUTHORED'].includes(entry.authoringStatus))
}
const authoredEntries = manifest.lessons.filter((entry) => entry.authoringStatus !== 'NOT_AUTHORED')
assert.equal(authoredEntries.length, 1, 'Wave 1 authors exactly one reference lesson')
assert.equal(manifest.authoredLessonCount, 1)
assert.equal(manifest.notAuthoredLessonCount, canonical.size - 1)
assert.deepEqual(manifest.authoredLessonRefs, authoredEntries.map((entry) => entry.lessonRef))
assert.notEqual(authoredEntries[0].lessonRef, 'ma-g3-science-u02-l03', 'the reference lesson must not be the frozen Director sample')
assert.equal(manifest.units.length, 9)
assert.equal(manifest.units.reduce((total, unit) => total + unit.lessonCount, 0), canonical.size)
assert.equal(manifest.units.reduce((total, unit) => total + unit.authoredLessonCount, 0), 1)

const lessonFiles = readdirSync(path.join(waveRoot, 'lessons')).filter((name) => name.endsWith('.json')).sort()
assert.equal(lessonFiles.length, 1, 'the lessons directory must hold exactly the authored lessons')

// ---------------------------------------------------------------------------
// 3. Frozen substantive copy, held for the anti-template check.
// ---------------------------------------------------------------------------
const frozenCopy = new Map()
for (const file of readdirSync(path.join(frozenDir, 'samples')).filter((name) => name.endsWith('.json'))) {
  const sample = readJson(path.join(frozenDir, 'samples', file))
  for (const copy of substantiveCopy(sample)) frozenCopy.set(normalize(copy), sample.lessonRef)
}

// ---------------------------------------------------------------------------
// 4. Every authored lesson.
// ---------------------------------------------------------------------------
const schema = readJson(schemaPath)
const heldCopy = new Map()
const results = []

for (const entry of authoredEntries) {
  const lesson = readJson(path.join(repo, entry.lessonPath))
  validateSchema(lesson, schema)

  // Canonical mapping carried from the sequence, not invented.
  const authority = canonical.get(lesson.lessonRef)
  assert.equal(lesson.title, authority.title, `${lesson.lessonRef} title must match the canonical sequence`)
  assert.equal(lesson.courseId, authority.course_id)
  assert.equal(lesson.grade, authority.grade)
  assert.equal(lesson.subject, authority.subject)
  assert.deepEqual(lesson.standards, authority.standards)
  assert.deepEqual(lesson.standards, entry.standards)
  assert.equal(lesson.lessonRef, entry.lessonRef)
  assert(authority.scientific_correctness_authority?.relationships?.length, `${lesson.lessonRef} lacks canonical correctness authority`)
  assert.equal(lesson.phenomenonOrContext, entry.phenomenonOrContext, `${lesson.lessonRef} phenomenon drifted from the manifest`)
  assert.deepEqual(lesson.instructionalRhythm, RHYTHM, `${lesson.lessonRef} does not declare the approved Science rhythm`)

  // Refs are unique and stable.
  const sectionRefs = lesson.sections.map((section) => section.sectionRef)
  assert.equal(new Set(sectionRefs).size, sectionRefs.length, `${lesson.lessonRef} has duplicate section refs`)
  const itemRefs = lesson.sections.flatMap((section) => (section.items ?? []).map((item) => item.itemRef))
  assert.equal(new Set(itemRefs).size, itemRefs.length, `${lesson.lessonRef} has duplicate item refs`)

  // The approved rhythm is present, in order, ahead of the review block.
  const bodyTitles = lesson.sections.slice(0, -REVIEW_TITLES.length).map((section) => section.title)
  let cursor = -1
  for (const beat of RHYTHM.slice(0, -1)) {
    const found = bodyTitles.findIndex((title, index) => index > cursor && title.startsWith(beat))
    assert(found > cursor, `${lesson.lessonRef} is missing the ${beat} beat in rhythm order`)
    cursor = found
  }

  // Every question lives on an item that has a real response control.
  for (const section of lesson.sections) {
    for (const item of section.items ?? []) {
      assert(INTERACTIVE.has(item.responseKind) || item.itemKind === 'worked-example', `${item.itemRef} lacks a supported response control`)
      if (item.responseKind === 'CHOICE') assert((item.choices ?? []).length >= 2, `${item.itemRef} needs visible choices`)
      if (item.itemKind === 'worked-example') assert((item.workedSolution?.steps ?? []).length >= 3, `${item.itemRef} worked example must show its reasoning`)
    }
  }
  for (const stringEntry of allStringEntries(lesson)) {
    if (stringEntry.value.includes('?')) {
      assert(/\.sections\[\d+\]\.items\[\d+\]\.prompt$/.test(stringEntry.pointer),
        `${lesson.lessonRef} asks a question with nowhere to answer it at ${stringEntry.pointer}`)
    }
  }

  // Feedback is instructional, read-only, and gated behind the response it answers.
  const feedbackSections = lesson.sections.filter((section) => section.feedbackFor)
  assert(feedbackSections.length >= 3, `${lesson.lessonRef} lacks sufficient scientific feedback`)
  for (const feedback of feedbackSections) {
    assert.equal(feedback.sectionKind, 'remediation', `${feedback.sectionRef} must map to read-only Practice feedback`)
    assert(!feedback.items?.length, `${feedback.sectionRef} feedback must not request another response`)
    assert(feedback.body.length >= 120, `${feedback.sectionRef} feedback must be instructional, not a verdict`)
    const targetIndex = lesson.sections.findIndex((section) => section.items?.some((item) => item.itemRef === feedback.feedbackFor))
    assert(targetIndex >= 0, `${feedback.sectionRef} has an unresolved feedback target`)
    assert(lesson.sections.indexOf(feedback) > targetIndex, `${feedback.sectionRef} leaks before its learner response`)
  }

  // The seven-part lesson review.
  assert.deepEqual(lesson.sections.slice(-REVIEW_TITLES.length).map((section) => section.title), REVIEW_TITLES,
    `${lesson.lessonRef} lesson review is incomplete or out of order`)
  assert(lesson.sections.at(-3).items?.some((item) => INTERACTIVE.has(item.responseKind)), `${lesson.lessonRef} review lacks response evidence`)
  assert(/pending assessment/i.test(lesson.sections.at(-5).body), `${lesson.lessonRef} how-you-did overclaims mastery`)
  for (const key of Object.keys(lesson.lessonReview)) assert(lesson.lessonReview[key], `${lesson.lessonRef} lesson review key ${key} is empty`)

  // No answer authority, no legacy path, no physical-activity requirement.
  const serialized = JSON.stringify(lesson)
  assert(!/(correctAnswer|answerKey|answerIndex|expectedAnswer|acceptedAnswers|solutionKey|scoringKey|rubricKey|acceptedResponse)/i.test(serialized),
    `${lesson.lessonRef} leaks protected answer authority`)
  assert(!/(format"\s*:\s*"markdown|legacyFallback)/i.test(serialized), `${lesson.lessonRef} requests a legacy or markdown path`)
  assert(!lesson.activitySteps && !serialized.includes('ACTIVITY_EVIDENCE'), `${lesson.lessonRef} unexpectedly requires a physical activity`)

  // Data is labelled and accessible.
  const dataSections = lesson.sections.filter((section) => section.data)
  assert(dataSections.length >= 1, `${lesson.lessonRef} anchors no phenomenon in real data`)
  for (const section of dataSections) {
    assert(section.data.tableLabel, `${section.sectionRef} data lacks an accessible table label`)
    assert((section.data.columns ?? []).length >= 2, `${section.sectionRef} data lacks labeled columns`)
    assert((section.data.rows ?? []).length >= 2, `${section.sectionRef} data lacks rows`)
    for (const row of section.data.rows) {
      assert.equal(row.split('|').length, section.data.columns.length, `${section.sectionRef} row does not fill every column: ${row}`)
    }
    assert(/instructional|example|model output/i.test(section.data.note ?? ''), `${section.sectionRef} must label constructed data as instructional`)
  }

  // The real runtime, the real render model, the real player projection.
  const projection = mapLearnerMaterialToStudySegments(lesson)
  const required = projection.segments.flatMap((segment) => segment.items).filter((item) => item.required)
  assert(required.length >= 3, `${lesson.lessonRef} collects too little learner-response evidence`)
  assert(projection.segments.every((segment) => segment.items.length), `${lesson.lessonRef} left a Study segment empty`)
  assert(projection.segments.find((segment) => segment.role === 'REFLECT').items.some((item) => item.required),
    `${lesson.lessonRef} review collects no evidence`)
  assert(!required.some((item) => item.responseType === 'ACTIVITY_EVIDENCE'), `${lesson.lessonRef} maps desk content to an activity attestation`)
  const taught = projection.segments.find((segment) => segment.role === 'LEARN').items
  assert(taught.every((item) => item.instructionalExample), `${lesson.lessonRef} must keep TAUGHT distinct from PRACTICED`)

  const renderModel = createRichLessonRenderModel(lesson)
  assert.equal(renderModel.mode, 'rich', `${lesson.lessonRef} fell back to legacy presentation`)
  assert(renderModel.pages.some((page) => page.kind === 'data'), `${lesson.lessonRef} lacks a rich data component`)
  assert(renderModel.pages.some((page) => page.kind === 'worked-example'), `${lesson.lessonRef} lacks a labelled worked example`)
  assert(renderModel.pages.some((page) => page.kind === 'mastery-check'), `${lesson.lessonRef} lacks a review response page`)
  assert(renderModel.pages.every((page) => page.pageRef && page.progressRef), `${lesson.lessonRef} has an invalid player page`)

  const savedTypes = await proveResponseRuntime(lesson)
  assert.deepEqual([...new Set(savedTypes)].sort(), [...entry.responseTypes].sort(), `${lesson.lessonRef} response types drifted from the manifest`)
  assert.equal(required.length, entry.requiredResponseCount, `${lesson.lessonRef} required-response count drifted from the manifest`)
  assert.equal(feedbackSections.length, entry.feedbackSectionCount, `${lesson.lessonRef} feedback-section count drifted from the manifest`)
  assert.equal(lesson.sections.length, entry.sectionCount, `${lesson.lessonRef} section count drifted from the manifest`)

  // Anti-template: no substantive copy reused from the freeze or another Wave 1 lesson.
  for (const copy of substantiveCopy(lesson)) {
    const key = normalize(copy)
    assert(!frozenCopy.has(key), `${lesson.lessonRef} reuses substantive copy from frozen sample ${frozenCopy.get(key)}`)
    assert(!heldCopy.has(key), `${lesson.lessonRef} duplicates substantive copy from ${heldCopy.get(key)}`)
    heldCopy.set(key, lesson.lessonRef)
  }

  results.push({
    lessonRef: lesson.lessonRef,
    grade: lesson.grade,
    title: lesson.title,
    sections: lesson.sections.length,
    richMode: renderModel.mode,
    pages: renderModel.pages.length,
    requiredResponses: required.length,
    savedResponses: savedTypes.length,
    responseTypes: [...new Set(savedTypes)],
    feedbackSections: feedbackSections.length,
    dataSections: dataSections.length,
    canonicalCorrectnessRelationships: authority.scientific_correctness_authority.relationships.length,
  })
}

console.log(JSON.stringify({
  status: 'PASS',
  revision: manifest.revision,
  course: manifest.course,
  courseLessonCount: manifest.lessonCount,
  authoredLessonCount: results.length,
  checks: {
    r2FreezeIntact: true,
    manifestCoversCanonicalCourse: true,
    canonicalScienceMapping: true,
    canonicalCorrectnessAuthority: true,
    approvedScienceRhythm: true,
    everyQuestionHasAResponseControl: true,
    responseGatedInstructionalFeedback: true,
    sevenPartLessonReview: true,
    taughtDistinctFromPracticed: true,
    richStudyPlayer: true,
    realLearnerResponseRuntime: true,
    noAnswerAuthorityLeakage: true,
    noLegacyFallback: true,
    labelledInstructionalData: true,
    noCopyReusedFromFreeze: true,
  },
  lessons: results,
}, null, 2))
