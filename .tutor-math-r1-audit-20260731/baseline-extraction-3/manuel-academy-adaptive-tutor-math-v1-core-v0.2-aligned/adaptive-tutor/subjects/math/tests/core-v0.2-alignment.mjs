import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  adaptSequenceToTutorProgramV02,
  adaptVisualBoardCommandV02,
  coreGradeBandV02,
  mediaFallbackV02,
  visualInventoryV02,
} from '../core-v0.2-adapter.ts'
import {
  adultEscalationV02,
  createAdaptiveFlowTraceV02,
  evaluateCrossSessionMasteryV02,
  resolveMediaFallbackV02,
  routeInterventionV02,
} from '../runtime-v0.2.ts'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'))
const sequences = await Promise.all(manifest.orderedLessons.map(async (entry) =>
  JSON.parse(await readFile(join(root, entry.path, 'sequence.json'), 'utf8'))))
const valid = JSON.parse(
  await readFile(join(root, 'fixtures/core-v0.2/valid-runtime-fixtures.json'), 'utf8'),
)
const invalid = JSON.parse(
  await readFile(join(root, 'fixtures/core-v0.2/invalid-runtime-fixtures.json'), 'utf8'),
)
const expectedTraces = JSON.parse(
  await readFile(join(root, 'traces/core-v0.2-adaptive-flow.json'), 'utf8'),
)

test('Grade 5 is represented directly in every Core v0.2 grade band', () => {
  for (const sequence of sequences) {
    const band = coreGradeBandV02(sequence)
    assert.ok(band.min <= 5 && band.max >= 5)
    assert.equal('coreGrade' in band, false)
  }
})

test('all four sequences produce contract-shaped Core v0.2 programs', () => {
  const programs = sequences.map(adaptSequenceToTutorProgramV02)
  assert.equal(programs.length, 4)
  for (const program of programs) {
    assert.equal(program.subject, 'math')
    assert.equal(program.locale, 'en-US')
    assert.equal(program.diagnosticItems.length, 6)
    assert.equal(program.guidedPractice.items.length, 6)
    assert.equal(program.independentMastery.items.length, 6)
    assert.equal(program.reassessmentItems.length, 6)
    assert.equal(program.independentMastery.singleAnswerCanEstablishMastery, false)
    assert.equal(program.independentMastery.placementDecisionAllowed, false)
  }
})

test('assessment adapter preserves privacy and delayed-answer boundaries', () => {
  for (const program of sequences.map(adaptSequenceToTutorProgramV02)) {
    const items = [
      ...program.diagnosticItems,
      ...program.guidedPractice.items,
      ...program.independentMastery.items,
      ...program.reassessmentItems,
    ]
    for (const item of items) {
      assert.equal(item.noCameraRequired, true)
      assert.equal(item.identifyingInformationRequested, false)
      assert.match(item.directions, /one question/i)
      if (item.kind === 'multiple-choice') {
        assert.ok(item.options.every((option) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(option.id)))
      } else {
        assert.ok(item.acceptedAnswers.length > 0)
      }
    }
  }
})

test('all 20 visuals have Core v0.2 adapter support and preserve alt text', () => {
  const inventory = sequences.flatMap(visualInventoryV02)
  assert.equal(inventory.length, 20)
  assert.equal(inventory.filter((item) => item.support === 'adapter-native-number-line').length, 4)
  assert.equal(inventory.filter((item) => item.support === 'adapter-native-fraction').length, 2)
  assert.equal(inventory.filter((item) => item.support === 'adapter-structured-step').length, 4)
  assert.equal(inventory.filter((item) => item.support === 'adapter-text-fallback').length, 10)
  for (const sequence of sequences) {
    for (const source of sequence.visualExplanationPlan.boards) {
      const adapted = adaptVisualBoardCommandV02(source)
      assert.ok(adapted.commands.length > 0)
      assert.ok(adapted.commands.some((command) =>
        String(command.ariaLabel).includes(source.altText.slice(0, 80))))
    }
  }
})

test('missing media and unavailable voice keep the lesson operational', () => {
  const fallback = mediaFallbackV02(sequences[0])
  const resolved = resolveMediaFallbackV02(valid.capabilities, fallback)
  assert.equal(resolved.visualMode, 'text-alternative')
  assert.equal(resolved.voiceMode, 'displayed-text')
  assert.equal(resolved.captionsVisible, true)
  assert.equal(resolved.transcriptAvailable, true)
  assert.equal(resolved.lessonMayContinue, true)
})

test('mastery requires repeated evidence across at least two sessions', () => {
  const strong = evaluateCrossSessionMasteryV02(valid.crossSessionEvidence)
  assert.equal(strong.mastered, true)
  assert.equal(strong.distinctSessionCount, 2)
  assert.equal(strong.placementDecisionAllowed, false)
  const weak = evaluateCrossSessionMasteryV02(invalid.insufficientMasteryEvidence)
  assert.equal(weak.mastered, false)
  assert.match(weak.uncertaintyStatement, /uncertain/i)
})

test('reteaching, prerequisite remediation, and adult escalation are explicit', () => {
  assert.equal(routeInterventionV02({
    prerequisiteMisses: 2,
    repeatedMisconceptionSignals: 0,
    uncertainty: 0.4,
    repeatedCycles: 0,
    persistentDifficultyCycleLimit: 2,
  }), 'prerequisite-remediation')
  const escalation = adultEscalationV02({
    repeatedCycles: 2,
    persistentDifficultyCycleLimit: 2,
  })
  assert.equal(escalation.escalationRecommended, true)
  assert.equal(escalation.expectedInput, 'adult-review')
  assert.equal(escalation.diagnosticClaimMade, false)
})

test('delivered adaptive traces cover advance, reteach, prerequisite, and review', () => {
  const actualAdvance = createAdaptiveFlowTraceV02(sequences[0], 'advance')
    .map((event) => event.phase)
  const actualReteach = createAdaptiveFlowTraceV02(sequences[0], 'reteach-prerequisite')
    .map((event) => event.phase)
  const actualEscalation = createAdaptiveFlowTraceV02(sequences[0], 'persistent-escalation')
    .map((event) => event.phase)
  assert.deepEqual(actualAdvance, expectedTraces.advance)
  assert.deepEqual(actualReteach, expectedTraces.reteachPrerequisite)
  assert.deepEqual(actualEscalation, expectedTraces.persistentEscalation)
})
