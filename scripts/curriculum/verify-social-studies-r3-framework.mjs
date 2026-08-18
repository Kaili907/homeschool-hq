/**
 * Verifies the Social Studies Production R3 framework.
 *
 * The framework is proven against the nine frozen Director-approved R2 samples:
 * they must satisfy the shared lesson model and the rhythm rule exactly, and they
 * must fail the production envelope for exactly the enumerated promotion gap. Any
 * authored R3 lesson is then held to the model, the envelope, the rhythm, and the
 * file-level preconditions.
 *
 * Rich Study Player projection and section-kind classification are proven by
 * src/study/family-pilot/lesson-player/socialStudiesProductionR3.test.ts, which can
 * import the player itself.
 *
 * This script reports. It admits nothing.
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { unsupportedKeywords, validate } from '../../curriculum-production/social-studies-r3/tools/schema-validator.mjs'
import { rhythmViolations } from '../../curriculum-production/social-studies-r3/tools/rhythm.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const r3Root = 'curriculum-production/social-studies-r3'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), 'utf8'))
}

function sha256(relativePath) {
  return createHash('sha256').update(readFileSync(resolve(repoRoot, relativePath))).digest('hex')
}

const manifest = readJson(`${r3Root}/SOCIAL_STUDIES_PRODUCTION_R3.manifest.json`)
const rules = readJson(manifest.contract.promotionRules.path)
const modelSchema = readJson(manifest.contract.lessonModelSchema.path)
const envelopeSchema = readJson(manifest.contract.productionEnvelopeSchema.path)
const reviewSchema = { ...modelSchema.$defs.lessonReview, $defs: modelSchema.$defs }
const approvals = readJson(manifest.modelInput.path)
const forbiddenAuthorityKey = new RegExp(
  rules.preconditions.find((rule) => rule.id === 'no-browser-answer-authority').forbiddenKeyPattern,
  'i',
)

// -- 1. The schemas stay inside what the validator implements ------------------

for (const [label, schema] of [['model', modelSchema], ['production envelope', envelopeSchema]]) {
  const unsupported = unsupportedKeywords(schema)
  assert(unsupported.length === 0, `The ${label} schema uses keywords the validator does not implement: ${unsupported.join(', ')}.`)
}

// -- 2. Pinned inputs still hash to what the manifest recorded -----------------

for (const pinned of [
  manifest.modelInput,
  manifest.contract.lessonModelSchema,
  manifest.contract.productionEnvelopeSchema,
  manifest.contract.promotionRules,
]) {
  const actual = sha256(pinned.path)
  assert(actual === pinned.sha256, `Checksum drift for ${pinned.path}: ${actual} != ${pinned.sha256}.`)
}

// -- 3. Scope invariants -------------------------------------------------------

assert(JSON.stringify(manifest.supportedGrades) === JSON.stringify(rules.supportedGrades), 'Manifest and promotion rules disagree on the supported grades.')
assert(!manifest.supportedGrades.includes(6) && manifest.grade6Excluded === true && rules.grade6Supported === false, 'Grade 6 must be absent and explicitly excluded.')
assert(manifest.contract.lessonSchemaVersion === modelSchema.properties.schemaVersion.const, 'Manifest and model schema disagree on the lesson model version.')
assert(manifest.contract.parallelEngineOrRuntimeIntroduced === false, 'R3 must not introduce a parallel engine or runtime.')
assert(manifest.humanAuthority.promotionIsAutomatic === false && rules.humanAuthority.promotionIsAutomatic === false, 'Promotion must not be automatic.')

// -- 4. The frozen model is untouched -----------------------------------------

const frozen = approvals.samples.filter((sample) => sample.subject === 'Social Studies')
assert(frozen.length === manifest.modelInput.socialStudiesSampleCount, `Expected ${manifest.modelInput.socialStudiesSampleCount} frozen Social Studies samples, found ${frozen.length}.`)
assert(approvals.approvalStatus === rules.modelAuthority.approvalStatus, 'The frozen approval status changed.')
for (const sample of frozen) {
  const actual = sha256(sample.samplePath)
  assert(actual === sample.contentHash, `Frozen sample changed: ${sample.samplePath}.`)
  assert(sample.samplePath.startsWith(manifest.storageBoundary.frozenModelRoot), `Frozen sample lives outside the model root: ${sample.samplePath}.`)
}

// -- 5. Rhythm rule ------------------------------------------------------------

function objectKeys(value) {
  if (Array.isArray(value)) return value.flatMap(objectKeys)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, nested]) => [key, ...objectKeys(nested)])
}

function itemsOf(section) {
  return section.items ?? []
}

const rhythmContext = { rules, reviewSchema }

for (const sample of frozen) {
  const lesson = readJson(sample.samplePath)
  const violations = validate(modelSchema, lesson)
  assert(violations.length === 0, `Frozen sample ${sample.sampleId} does not satisfy the model schema:\n  ${violations.map((v) => `${v.path}: ${v.message}`).join('\n  ')}`)
  const problems = rhythmViolations(lesson, rhythmContext)
  assert(problems.length === 0, `Frozen sample ${sample.sampleId} does not satisfy the rhythm rule:\n  ${problems.join('\n  ')}`)
}

// -- 6. The promotion gap is real and exactly as documented -------------------

const expectedGap = [
  ...rules.approvedSampleGap.missingProductionFields.map((field) => `missing required property "${field}"`),
  ...rules.approvedSampleGap.forbiddenCarryForward.map(() => 'value matches a forbidden schema'),
].sort()

for (const sample of frozen) {
  const lesson = readJson(sample.samplePath)
  const messages = validate(envelopeSchema, lesson).map((violation) => violation.message).sort()
  assert(
    JSON.stringify(messages) === JSON.stringify(expectedGap),
    `Frozen sample ${sample.sampleId} does not show the documented promotion gap.\n  expected: ${JSON.stringify(expectedGap)}\n  actual:   ${JSON.stringify(messages)}`,
  )
}

// -- 7. Authored R3 lessons ----------------------------------------------------

const lessonRoot = manifest.storageBoundary.lessonRoot
const lessonFiles = existsSync(resolve(repoRoot, lessonRoot))
  ? readdirSync(resolve(repoRoot, lessonRoot), { recursive: true, encoding: 'utf8' }).filter((entry) => entry.endsWith('.lesson.json')).sort()
  : []

assert(
  lessonFiles.length === manifest.lessons.authored,
  `Manifest reports ${manifest.lessons.authored} authored lesson(s); ${lessonFiles.length} found under ${lessonRoot}.`,
)
assert(manifest.lessons.admitted <= manifest.lessons.authored, 'More lessons are admitted than authored.')

const frozenStrings = new Set(
  frozen.flatMap((sample) => {
    const lesson = readJson(sample.samplePath)
    return (lesson.sections ?? []).flatMap((section) => [
      section.body,
      section.directions,
      ...itemsOf(section).map((item) => item.prompt),
    ])
  }).filter((value) => typeof value === 'string' && value.trim().length >= 60)
    .map((value) => value.toLowerCase().replaceAll(/\s+/g, ' ').trim()),
)

const feedbackRule = rules.preconditions.find((rule) => rule.id === 'instructional-feedback')
const genericFeedback = new RegExp(feedbackRule.genericFeedbackDenylistPattern, 'i')
const nextActionRule = rules.preconditions.find((rule) => rule.id === 'next-action-ruling')
const duplicationRule = rules.preconditions.find((rule) => rule.id === 'no-substantive-duplication')
const dayRule = rules.preconditions.find((rule) => rule.id === 'course-progress-day')
const rewriteRule = rules.transform.rewrite.find((entry) => entry.field.endsWith('course_progress'))
const forbiddenProgressPhrase = new RegExp(rewriteRule.forbiddenPhrasePattern, 'i')
const seenStrings = new Map()

for (const relative of lessonFiles) {
  const path = `${lessonRoot}/${relative}`
  const lesson = readJson(path)
  const label = lesson.lessonRef ?? relative

  for (const [schemaLabel, schema] of [['model', modelSchema], ['production envelope', envelopeSchema]]) {
    const violations = validate(schema, lesson)
    assert(violations.length === 0, `${label} fails the ${schemaLabel} schema:\n  ${violations.map((v) => `${v.path}: ${v.message}`).join('\n  ')}`)
  }

  const problems = rhythmViolations(lesson, rhythmContext)
  assert(problems.length === 0, `${label} fails the rhythm rule:\n  ${problems.join('\n  ')}`)

  assert(objectKeys(lesson).filter((key) => forbiddenAuthorityKey.test(key)).length === 0, `${label} carries browser answer or scoring authority.`)

  const canonical = readFileSync(resolve(repoRoot, lesson.canonicalLessonPath), 'utf8')
  assert(canonical.includes(`**Lesson ID:** \`${lesson.lessonRef}\``), `${label} does not match the canonical lesson identifier.`)
  assert(canonical.includes(`**Standards:** ${lesson.standards.join(', ')}`), `${label} does not reproduce the canonical standards line.`)
  assert(canonical.includes(`# ${lesson.title}`), `${label} does not reproduce the canonical lesson title.`)

  const [, unit, number] = lesson.lessonRef.match(/-u(\d{2})-l(\d{2})$/)
  const expectedDay = (Number(unit) - 1) * dayRule.lessonsPerUnit + Number(number)
  assert(lesson.courseProgress.day === expectedDay, `${label} states course day ${lesson.courseProgress.day}; the lesson reference gives ${expectedDay}.`)
  assert(lesson.courseProgress.totalDays === dayRule.lessonsPerUnit * dayRule.unitsPerCourse, `${label} states the wrong course length.`)

  // The COURSE PROGRESS ruling binds both review surfaces: the seven-field Social Studies
  // review and the runtime LearnerLessonReview the render model actually shows.
  for (const [surface, progress] of [
    ['review reference', lesson.sections.at(-1).reference.course_progress],
    ['lessonReview', lesson.lessonReview.courseProgress],
  ]) {
    assert(!forbiddenProgressPhrase.test(progress), `${label} still carries Director-sample no-credit language in ${surface} course progress.`)
    assert(progress.includes(`day ${expectedDay} of ${lesson.courseProgress.totalDays}`), `${label} ${surface} does not state its real course position.`)
  }
  assert(
    lesson.lessonReview.nextAction === nextActionRule.midUnitValue,
    `${label} states nextAction "${lesson.lessonReview.nextAction}"; the mid-unit ruling is "${nextActionRule.midUnitValue}".`,
  )

  // Instructional feedback on every learner-response item; none on worked examples.
  for (const section of lesson.sections ?? []) {
    for (const item of itemsOf(section)) {
      if (!item.responseKind) {
        assert(item.feedback === undefined, `${label} attaches feedback to worked example ${item.itemRef}; looking at an example is not a response.`)
        continue
      }
      assert(item.feedback, `${label} item ${item.itemRef} has no instructional feedback.`)
      assert(
        item.feedback.incorrect.length >= feedbackRule.minimumIncorrectFeedbackLength,
        `${label} item ${item.itemRef} incorrect feedback is shorter than ${feedbackRule.minimumIncorrectFeedbackLength} characters.`,
      )
      for (const branch of ['correct', 'incorrect']) {
        assert(!genericFeedback.test(item.feedback[branch]), `${label} item ${item.itemRef} ${branch} feedback is a generic verdict.`)
      }
    }
  }

  assert(
    lesson.productionStatus !== 'PRODUCTION_ADMITTED' || lesson.sourceReview.reviewedByRole !== 'PENDING_HUMAN_SOURCE_REVIEW',
    `${label} is marked PRODUCTION_ADMITTED without a named human source review.`,
  )

  assert(
    lesson.provenance.approvalManifestSha256 === manifest.modelInput.sha256,
    `${label} pins a different Director approval manifest than the R3 manifest.`,
  )

  for (const section of lesson.sections ?? []) {
    for (const text of [section.body, section.directions, ...itemsOf(section).map((item) => item.prompt)]) {
      if (typeof text !== 'string' || text.trim().length < duplicationRule.minimumComparedStringLength) continue
      const normalized = text.toLowerCase().replaceAll(/\s+/g, ' ').trim()
      assert(!frozenStrings.has(normalized), `${label} copies substantive learner copy from a frozen Director sample.`)
      assert(!seenStrings.has(normalized), `${label} duplicates substantive learner copy from ${seenStrings.get(normalized)}.`)
      seenStrings.set(normalized, label)
    }
  }
}

// -- Report --------------------------------------------------------------------

console.log(`manifest: ${r3Root}/SOCIAL_STUDIES_PRODUCTION_R3.manifest.json`)
console.log(`status: ${manifest.status}`)
console.log('grades: 3,4,5,7,8,9,10,11,12')
console.log('grade 6: absent')
console.log('pinned checksums: 4 matched')
console.log(`frozen Social Studies model samples: ${frozen.length} unchanged`)
console.log(`model schema: ${frozen.length}/${frozen.length} frozen samples validate`)
console.log(`rhythm rule (${rules.rhythm.orderedRule.length} steps): ${frozen.length}/${frozen.length} frozen samples satisfy`)
console.log(`promotion gap: ${expectedGap.length} findings per frozen sample, exactly as documented`)
console.log(`authored R3 lessons: ${lessonFiles.length}${lessonFiles.length ? ` (${lessonFiles.join(', ')})` : ''}`)
console.log(`admitted R3 lessons: ${manifest.lessons.admitted}`)
console.log('automatic promotion: disabled')
console.log('SOCIAL_STUDIES_R3_FRAMEWORK_VERIFIED')
