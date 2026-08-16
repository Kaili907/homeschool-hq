import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mapLearnerMaterialToStudySegments } from '../../../../src/study/family-pilot/final-app/learner-response/mapping.ts'
import { LearnerResponseRuntime } from '../../../../src/study/family-pilot/final-app/learner-response/runtime.ts'
import { createRichLessonRenderModel } from '../../../../src/study/family-pilot/lesson-player/renderModel.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../../../..')
const manifest = readJson(path.join(here, 'manifest.json'))
const schema = readJson(path.join(here, 'science-director-sample.schema.json'))
const sampleDir = path.join(here, 'samples')
const sampleFiles = readdirSync(sampleDir).filter((name) => name.endsWith('.json')).sort()
const expectedGrades = [3, 4, 5, 7, 8, 9, 10, 11, 12]
const reviewTitles = [
  'WHAT YOU LEARNED',
  'EVIDENCE YOU USED',
  'HOW YOU DID',
  'WHAT TO PRACTICE',
  'REVIEW THIS LESSON',
  'COURSE PROGRESS',
  'NEXT ACTION',
]
const interactive = new Set(['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'])
const canonicalRoot = path.join(repo, 'curriculum-production/final/science/packages')

class MemorySampleResponseStore {
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

function validateSchema(value, rule, pointer = '$') {
  if (rule.type === 'object') {
    assert(value && typeof value === 'object' && !Array.isArray(value), `${pointer} must be an object`)
  } else if (rule.type === 'array') {
    assert(Array.isArray(value), `${pointer} must be an array`)
  } else if (rule.type) {
    assert.equal(typeof value, rule.type, `${pointer} must be ${rule.type}`)
  }
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

function canonicalLessons() {
  const byRef = new Map()
  for (const course of readdirSync(canonicalRoot)) {
    const file = path.join(canonicalRoot, course, 'work-packages.jsonl')
    for (const line of readFileSync(file, 'utf8').trim().split('\n')) {
      const lesson = JSON.parse(line)
      byRef.set(lesson.lesson_id, lesson)
    }
  }
  return byRef
}

function allStringEntries(value, pointer = '$', entries = []) {
  if (typeof value === 'string') entries.push({ pointer, value })
  else if (Array.isArray(value)) value.forEach((item, index) => allStringEntries(item, `${pointer}[${index}]`, entries))
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => allStringEntries(item, `${pointer}.${key}`, entries))
  return entries
}

function substantiveCopy(sample) {
  return sample.sections.slice(0, -reviewTitles.length).flatMap((section) => [section.body, ...(section.items ?? []).map((item) => item.prompt)])
    .filter((text) => typeof text === 'string' && text.length >= 80)
}

function sampleText(sample) {
  return allStringEntries(sample).map((entry) => entry.value).join(' ')
}

function responseValue(item) {
  if (item.responseType === 'CHOICE') return item.choices[0].choiceRef
  if (item.responseType === 'NUMERIC') return '1'
  return 'evidence-based learner response'
}

async function proveResponseRuntime(sample) {
  const context = Object.freeze({
    lessonRef: sample.lessonRef,
    studentRef: `sample:student:g${sample.grade}`,
    assignmentRef: `sample:assignment:g${sample.grade}`,
    attemptRef: `sample:attempt:g${sample.grade}`,
  })
  const runtime = new LearnerResponseRuntime(sample, context, new MemorySampleResponseStore(), undefined, () => new Date('2026-08-16T12:00:00.000Z'))
  let savedCount = 0
  for (const ordinal of [1, 2, 3]) {
    const segmentRef = `${sample.lessonRef}:segment:${ordinal}`
    let view = await runtime.open(ordinal, segmentRef)
    while (view.item && !view.canCompleteSegment) {
      assert(interactive.has(view.item.responseType), `${sample.lessonRef} exposed a required unsupported response`)
      const result = await runtime.submit({
        lessonRef: sample.lessonRef,
        sectionRef: view.item.sectionRef,
        itemRef: view.item.itemRef,
        segmentRef,
        value: responseValue(view.item),
      })
      assert.equal(result.status, 'saved', `${sample.lessonRef} response did not save`)
      assert.equal(result.assessmentStatus, 'PENDING_ASSESSMENT', `${sample.lessonRef} browser claimed assessment authority`)
      savedCount += 1
      view = await runtime.open(ordinal, segmentRef)
    }
    assert.equal(view.canCompleteSegment, true, `${sample.lessonRef} segment did not complete after required responses`)
  }
  assert(savedCount >= 3, `${sample.lessonRef} needs meaningful response evidence`)
  return savedCount
}

assert.equal(manifest.sampleCount, 9)
assert.equal(manifest.productionCurriculumChanged, false)
assert.equal(manifest.legacyFallbackRequired, false)
assert.equal(sampleFiles.length, 9)
assert.deepEqual(manifest.samples.map((sample) => sample.grade).sort((a, b) => a - b), expectedGrades)

const canonical = canonicalLessons()
const heldCopies = new Map()
const results = []

for (const manifestEntry of manifest.samples) {
  const file = path.join(here, manifestEntry.path)
  const sample = readJson(file)
  validateSchema(sample, schema)
  assert.equal(sample.grade, manifestEntry.grade)
  assert.equal(sample.courseId, manifestEntry.courseId)
  assert.equal(sample.lessonRef, manifestEntry.lessonRef)
  assert.deepEqual(sample.standards, manifestEntry.standard)
  assert.equal(sample.phenomenonOrContext, manifestEntry.phenomenonOrContext)

  const authority = canonical.get(sample.lessonRef)
  assert(authority, `${sample.lessonRef} is not a canonical Science lesson`)
  assert.equal(authority.course_id, sample.courseId)
  assert.equal(authority.grade, sample.grade)
  assert.equal(authority.title, sample.title)
  assert.deepEqual(authority.standards, sample.standards)
  assert.deepEqual(authority.source, {
    commit: manifestEntry.canonicalSource.commit,
    lineage: manifestEntry.canonicalSource.lineage,
    path: manifestEntry.canonicalSource.path,
    record_id: manifestEntry.canonicalSource.recordId,
  })
  assert(authority.scientific_correctness_authority?.relationships?.length, `${sample.lessonRef} lacks canonical correctness authority`)

  const sectionRefs = sample.sections.map((section) => section.sectionRef)
  assert.equal(new Set(sectionRefs).size, sectionRefs.length, `${sample.lessonRef} has duplicate section refs`)
  const sectionsWithItems = sample.sections.filter((section) => section.items?.length)
  for (const section of sectionsWithItems) {
    for (const item of section.items) {
      assert(interactive.has(item.responseKind) || item.itemKind === 'worked-example', `${item.itemRef} lacks a supported response control`)
      if (item.responseKind === 'CHOICE') assert((item.choices ?? []).length >= 2, `${item.itemRef} needs visible choices`)
    }
  }
  for (const entry of allStringEntries(sample)) {
    if (entry.value.includes('?')) assert(/\.sections\[\d+\]\.items\[\d+\]\.prompt$/.test(entry.pointer), `${sample.lessonRef} has a learner question without an item response control at ${entry.pointer}`)
  }

  const feedbackSections = sample.sections.filter((section) => section.feedbackFor)
  assert(feedbackSections.length >= 3, `${sample.lessonRef} lacks sufficient scientific feedback`)
  for (const feedback of feedbackSections) {
    assert.equal(feedback.sectionKind, 'remediation', `${feedback.sectionRef} must map to read-only Practice feedback`)
    assert(!feedback.items?.length, `${feedback.sectionRef} feedback must not request another response`)
    const targetIndex = sample.sections.findIndex((section) => section.items?.some((item) => item.itemRef === feedback.feedbackFor))
    assert(targetIndex >= 0, `${feedback.sectionRef} has an unresolved feedback target`)
    assert(sample.sections.indexOf(feedback) > targetIndex, `${feedback.sectionRef} leaks before its learner response`)
  }

  const lastTitles = sample.sections.slice(-reviewTitles.length).map((section) => section.title)
  assert.deepEqual(lastTitles, reviewTitles, `${sample.lessonRef} lesson review is incomplete or out of order`)
  assert(sample.sections.at(-3).items?.some((item) => interactive.has(item.responseKind)), `${sample.lessonRef} review lacks response evidence`)
  assert(/pending assessment/i.test(sample.sections.at(-5).body), `${sample.lessonRef} how-you-did overclaims mastery`)

  const serialized = JSON.stringify(sample)
  assert(!/(correctAnswer|answerKey|scoringKey|rubricKey|acceptedResponse)/i.test(serialized), `${sample.lessonRef} leaks protected answer authority`)
  assert(!/(format\"\s*:\s*\"markdown|legacyFallback)/i.test(serialized), `${sample.lessonRef} requests a legacy or markdown path`)
  assert(!sample.activitySteps && !serialized.includes('ACTIVITY_EVIDENCE'), `${sample.lessonRef} unexpectedly requires a physical activity`)
  for (const section of sample.sections.filter((candidate) => candidate.data)) {
    assert(section.data.tableLabel, `${section.sectionRef} data lacks an accessible table label`)
    assert((section.data.columns ?? []).length >= 2, `${section.sectionRef} data lacks labeled columns`)
    assert((section.data.rows ?? []).length >= 2, `${section.sectionRef} data lacks rows`)
  }

  const projection = mapLearnerMaterialToStudySegments(sample)
  assert(projection.segments.some((segment) => segment.items.some((item) => item.required)), `${sample.lessonRef} has no actual learner response`)
  assert(!projection.segments.some((segment) => segment.items.some((item) => item.responseType === 'ACTIVITY_EVIDENCE')), `${sample.lessonRef} maps desk content to an activity attestation`)
  const renderModel = createRichLessonRenderModel(sample)
  assert.equal(renderModel.mode, 'rich', `${sample.lessonRef} fell back to legacy presentation`)
  assert(renderModel.pages.some((page) => page.kind === 'data' || page.kind === 'reference'), `${sample.lessonRef} lacks a rich data/model component`)
  assert(renderModel.pages.every((page) => page.pageRef && page.progressRef), `${sample.lessonRef} has an invalid player page`)
  const savedResponses = await proveResponseRuntime(sample)

  for (const copy of substantiveCopy(sample)) {
    const normalized = copy.toLowerCase().replace(/\s+/g, ' ').trim()
    assert(!heldCopies.has(normalized), `${sample.lessonRef} duplicates substantive copy from ${heldCopies.get(normalized)}`)
    heldCopies.set(normalized, sample.lessonRef)
  }

  results.push({
    grade: sample.grade,
    lessonRef: sample.lessonRef,
    richMode: renderModel.mode,
    pages: renderModel.pages.length,
    savedResponses,
    feedbackSections: feedbackSections.length,
    canonicalCorrectnessRelationships: authority.scientific_correctness_authority.relationships.length,
    reviewPresent: true,
  })
}

const requiredAccuracySignals = new Map([
  [3, [/repeated observations/i, /conditions stay the same/i]],
  [4, [/source/i, /surroundings/i, /energy.*transfer/i]],
  [5, [/earth rotates/i, /shadow.*away from.*light source/i]],
  [7, [/higher temperature to lower temperature/i, /system boundary/i]],
  [8, [/greater mass produces less acceleration/i, /net force/i]],
  [9, [/heritable variation/i, /population.*across generations/i]],
  [10, [/coefficients/i, /subscripts are never/i, /same number of atoms/i]],
  [11, [/fnet = ma/i, /net force.*not one selected force/i]],
  [12, [/physical laws/i, /scenario uncertainty/i, /quantified range/i]],
])
for (const entry of manifest.samples) {
  const sample = readJson(path.join(here, entry.path))
  const text = sampleText(sample)
  for (const signal of requiredAccuracySignals.get(sample.grade)) assert(signal.test(text), `${sample.lessonRef} misses accuracy signal ${signal}`)
}

console.log(JSON.stringify({
  status: 'PASS',
  revision: manifest.revision,
  sampleCount: results.length,
  grades: results.map((result) => result.grade),
  checks: {
    schema: true,
    canonicalScienceMapping: true,
    canonicalCorrectnessAuthority: true,
    richStudyPlayer: true,
    actualLearnerResponses: true,
    feedback: true,
    lessonReview: true,
    noDuplicateSubstantiveCopy: true,
    noAnswerAuthorityLeakage: true,
    noLegacyFallback: true,
    accessibleDataLabels: true,
    physicalActivityNotRequired: true,
  },
  samples: results,
}, null, 2))
