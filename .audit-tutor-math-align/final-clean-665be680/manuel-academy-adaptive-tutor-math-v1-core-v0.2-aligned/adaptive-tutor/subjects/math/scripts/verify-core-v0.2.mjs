import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

import {
  adaptSequenceToTutorProgramV02,
  visualInventoryV02,
} from '../core-v0.2-adapter.ts'
import {
  createAdaptiveFlowTraceV02,
  evaluateCrossSessionMasteryV02,
} from '../runtime-v0.2.ts'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const coreFlag = process.argv.indexOf('--core-root')
const suppliedRoot = coreFlag >= 0 ? process.argv[coreFlag + 1] : process.env.TUTOR_CORE_V0_2_ROOT
if (!suppliedRoot) {
  throw new Error('Provide --core-root <extracted Core v0.2 adaptive-tutor directory> or TUTOR_CORE_V0_2_ROOT.')
}
const coreRoot = isAbsolute(suppliedRoot) ? suppliedRoot : resolve(suppliedRoot)
const core = await import(pathToFileURL(join(coreRoot, 'dist/core/index.js')).href)
const {
  AssessmentItemSchema,
  GuidedPracticeContractSchema,
  IndependentMasteryContractSchema,
  MediaFallbackSchema,
  ParentTeacherReviewSchema,
  SpokenTurnSchema,
  TutorProgramSchema,
  TutorResponseSchema,
  VisualBoardCommandSchema,
  validateWithSchema,
  AdaptiveTutorEngine,
} = core

function mustPass(schema, value, label) {
  const result = validateWithSchema(schema, value)
  assert.equal(result.ok, true, `${label}: ${JSON.stringify(result.issues ?? [])}`)
}

function mustFail(schema, value, label) {
  const result = validateWithSchema(schema, value)
  assert.equal(result.ok, false, `${label} unexpectedly passed`)
}

const manifest = JSON.parse(await readFile(join(packageRoot, 'manifest.json'), 'utf8'))
const sequences = await Promise.all(manifest.orderedLessons.map(async (entry) =>
  JSON.parse(await readFile(join(packageRoot, entry.path, 'sequence.json'), 'utf8'))))
const programs = sequences.map(adaptSequenceToTutorProgramV02)

for (const program of programs) {
  mustPass(TutorProgramSchema, program, `${program.id}:TutorProgram`)
  for (const item of [
    ...program.diagnosticItems,
    ...program.guidedPractice.items,
    ...program.independentMastery.items,
    ...program.reassessmentItems,
  ]) mustPass(AssessmentItemSchema, item, `${item.id}:AssessmentItem`)
  mustPass(GuidedPracticeContractSchema, program.guidedPractice, `${program.id}:GuidedPractice`)
  mustPass(IndependentMasteryContractSchema, program.independentMastery, `${program.id}:IndependentMastery`)
  mustPass(MediaFallbackSchema, program.mediaFallback, `${program.id}:MediaFallback`)
  for (const sequence of program.teachingSequences) {
    for (const response of sequence.turns) {
      mustPass(TutorResponseSchema, response, `${response.id}:TutorResponse`)
      mustPass(SpokenTurnSchema, response.spokenTurn, `${response.id}:SpokenTurn`)
      for (const command of response.boardCommands) {
        mustPass(VisualBoardCommandSchema, command, `${command.id}:VisualBoardCommand`)
      }
    }
  }
}

for (const sequence of sequences) {
  for (const visual of visualInventoryV02(sequence)) {
    for (const command of visual.commands) {
      mustPass(VisualBoardCommandSchema, command, `${command.id}:VisualBoardCommand`)
    }
  }
}

const exemplar = programs[0]
const invalidProgram = structuredClone(exemplar)
invalidProgram.gradeBand.max = 13
mustFail(TutorProgramSchema, invalidProgram, 'grade-band-above-core-maximum')

const invalidAssessment = structuredClone(exemplar.diagnosticItems[0])
invalidAssessment.noCameraRequired = false
mustFail(AssessmentItemSchema, invalidAssessment, 'assessment-camera-required')

mustFail(VisualBoardCommandSchema, {
  id: 'invalid-visual',
  kind: 'place-value-chart',
  durationMs: 0,
  ariaLabel: 'Invalid unadapted visual.',
}, 'unsupported-visual-kind')

const invalidSpoken = structuredClone(exemplar.teachingSequences[0].turns[0].spokenTurn)
invalidSpoken.claimsHumanIdentity = true
mustFail(SpokenTurnSchema, invalidSpoken, 'spoken-turn-claims-human-identity')

const invalidMedia = structuredClone(exemplar.mediaFallback)
invalidMedia.lessonMayContinueWithoutMedia = false
mustFail(MediaFallbackSchema, invalidMedia, 'media-fallback-blocks-lesson')

function answerFor(item, correct) {
  if (item.kind === 'multiple-choice') {
    return {
      raw: '',
      selectedOptionIds: correct ? [...item.correctOptionIds] : [],
    }
  }
  return { raw: correct ? item.acceptedAnswers[0] : '__incorrect__' }
}

function runCoreAdvance(program) {
  const engine = new AdaptiveTutorEngine(program)
  const phases = [engine.start().phase]
  for (const item of program.diagnosticItems) phases.push(engine.submit(answerFor(item, true)).phase)
  phases.push(engine.continue().phase)
  phases.push(engine.continue().phase)
  for (const item of program.guidedPractice.items) phases.push(engine.submit(answerFor(item, true)).phase)
  for (const item of program.independentMastery.items) phases.push(engine.submit(answerFor(item, true)).phase)
  for (const item of program.reassessmentItems) phases.push(engine.submit(answerFor(item, true)).phase)
  assert.ok(phases.includes('assessment'))
  assert.ok(phases.includes('identify-missing-concept'))
  assert.ok(phases.includes('teach-visually'))
  assert.ok(phases.includes('guided-practice'))
  assert.ok(phases.includes('independent-attempt'))
  assert.ok(phases.includes('reassess'))
  assert.equal(phases.at(-1), 'advance')
  const review = engine.getReview()
  mustPass(ParentTeacherReviewSchema, review, `${program.id}:ParentTeacherReview`)
  assert.equal(review.diagnosticClaimMade, false)
  assert.equal(review.highStakesPlacementDecisionMade, false)
  assert.equal(review.identifyingInformationRequested, false)
  return phases
}

const coreAdvancePhases = runCoreAdvance(exemplar)

function runCorePersistentEscalation(program) {
  const engine = new AdaptiveTutorEngine(program)
  const phases = [engine.start().phase]
  for (const item of program.diagnosticItems) phases.push(engine.submit(answerFor(item, false)).phase)

  const teachAndPracticeCycle = () => {
    phases.push(engine.continue().phase)
    phases.push(engine.continue().phase)
    let guard = 0
    while (
      ['guided-practice', 'independent-attempt', 'reassess']
        .includes(engine.getSnapshot().phase) &&
      guard < 100
    ) {
      const phase = engine.getSnapshot().phase
      const item = phase === 'guided-practice'
        ? program.guidedPractice.items[engine.getSnapshot().currentItemIndex]
        : phase === 'independent-attempt'
          ? program.independentMastery.items[engine.getSnapshot().currentItemIndex]
          : program.reassessmentItems[engine.getSnapshot().currentItemIndex]
      phases.push(engine.submit(answerFor(item, false)).phase)
      guard += 1
    }
    assert.ok(guard < 100, 'persistent-flow guard was exhausted')
  }

  teachAndPracticeCycle()
  assert.equal(phases.at(-1), 'reteach')
  teachAndPracticeCycle()
  assert.equal(phases.at(-1), 'escalated')
  const review = engine.getReview()
  mustPass(ParentTeacherReviewSchema, review, `${program.id}:PersistentParentTeacherReview`)
  assert.equal(review.escalationRecommended, true)
  assert.equal(review.persistentDifficulty, true)
  assert.equal(review.diagnosticClaimMade, false)
  return phases
}

const corePersistentPhases = runCorePersistentEscalation(exemplar)
const validRuntime = JSON.parse(
  await readFile(join(packageRoot, 'fixtures/core-v0.2/valid-runtime-fixtures.json'), 'utf8'),
)
const mastery = evaluateCrossSessionMasteryV02(validRuntime.crossSessionEvidence)
assert.equal(mastery.mastered, true)
assert.equal(mastery.distinctSessionCount >= 2, true)

for (const scenario of ['advance', 'reteach-prerequisite', 'persistent-escalation']) {
  const trace = createAdaptiveFlowTraceV02(sequences[0], scenario)
  assert.ok(trace.every((event, index) => event.order === index + 1))
  assert.ok(trace.every((event) => event.uncertaintyStatement.length > 0))
}

console.log(JSON.stringify({
  status: 'PASS',
  coreVersion: '0.2.0',
  programsValidated: programs.length,
  sourceAssessmentItemsAdapted: sequences.reduce((sum, sequence) =>
    sum + sequence.diagnostic.items.length +
    sequence.guidedPractice.items.length +
    sequence.independentMasteryCheck.items.length, 0),
  emittedAssessmentContractsValidated: programs.reduce((sum, program) =>
    sum + program.diagnosticItems.length +
    program.guidedPractice.items.length +
    program.independentMastery.items.length +
    program.reassessmentItems.length, 0),
  sourceVisualCommandsAdapted: sequences.reduce((sum, sequence) =>
    sum + sequence.visualExplanationPlan.boards.length, 0),
  invalidFixturesRejected: 5,
  grade5DirectlySupported: programs.every((program) =>
    program.gradeBand.min <= 5 && program.gradeBand.max >= 5),
  coreAdvancePhases,
  corePersistentPhases,
  subjectTraceScenarios: 3,
}, null, 2))
