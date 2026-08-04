import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const modelSource = fs.readFileSync(path.join(here, '..', 'standalone-demo', 'model.js'), 'utf8')
const context = vm.createContext({})
vm.runInContext(modelSource, context, { filename: 'standalone-demo/model.js' })
const model = context.MathDemoModel

function answerCurrent(state, choiceId, reasoning) {
  const selected = model.selectAnswer(state, choiceId)
  const result = model.submitReasoning(selected, reasoning)
  assert.equal(result.error, null)
  return result.state
}

test('supported flow reaches guided practice, independent attempt, reassessment, and checkpoint', () => {
  let state = model.createDemoState()
  const phases = [state.phase]
  state = answerCurrent(state, 'thousands', 'I traced left through both zero columns.')
  phases.push(state.phase)
  state = model.continueFlow(state)
  phases.push(state.phase)
  state = model.continueFlow(state)
  phases.push(state.phase)
  state = answerCurrent(state, 'A', 'I regrouped across both zeros and subtracted by place.')
  phases.push(state.phase)
  state = model.continueFlow(state)
  phases.push(state.phase)
  state = answerCurrent(state, 'A', 'I preserved each place while regrouping across zeros.')
  phases.push(state.phase)
  state = model.continueFlow(state)
  phases.push(state.phase)
  state = answerCurrent(state, 'B', 'I added by place and regrouped every total of ten or more.')
  phases.push(state.phase)
  state = model.continueFlow(state)
  phases.push(state.phase)

  assert.deepEqual(phases, [
    'assessment',
    'reasoning-evidence',
    'teach-visually',
    'guided-practice',
    'guided-evidence',
    'independent-attempt',
    'independent-evidence',
    'reassess',
    'reassessment-evidence',
    'advance',
  ])
})

test('difficulty route identifies only a tentative misconception before visual reteaching', () => {
  let state = model.createDemoState()
  state = answerCurrent(state, 'ones', 'I started at the ones digit and stopped there.')
  assert.equal(state.phase, 'identify-missing-concept')
  assert.equal(state.attempt.feedbackClass, 'incorrect-supported-hypothesis')
  assert.equal(state.attempt.misconceptionSignal, 'math-mis-pv-borrow-zero')
  state = model.continueFlow(state)
  assert.equal(state.phase, 'teach-visually')
  state = model.continueFlow(state)
  assert.equal(state.phase, 'guided-practice')
})

test('correct plus explicit uncertainty is preserved and earns no confident evidence', () => {
  let state = model.createDemoState()
  state = answerCurrent(state, 'thousands', 'I am not sure; I guessed.')
  assert.equal(state.phase, 'uncertainty-clarification')
  assert.equal(state.attempt.correct, true)
  assert.equal(state.attempt.explicitlyUncertain, true)
  assert.equal(state.attempt.feedbackClass, 'correct-uncertain')
  assert.equal(state.confidentEvidenceCount, 0)
  assert.equal(state.evidenceTrace[0].feedbackClass, 'correct-uncertain')
})

test('narrow uncertainty cues avoid converting an explicit non-guess into uncertainty', () => {
  assert.equal(model.isExplicitlyUncertain("I'm unsure and picked at random."), true)
  assert.equal(model.isExplicitlyUncertain('I did not guess; I traced the trade from thousands.'), false)
  assert.equal(model.isExplicitlyUncertain('Do not guess; trace each place.'), false)
})

test('selection alone records no evidence and empty reasoning cannot advance', () => {
  let state = model.createDemoState()
  state = model.selectAnswer(state, 'thousands')
  assert.equal(state.evidenceTrace.length, 0)
  assert.equal(state.confidentEvidenceCount, 0)
  const result = model.submitReasoning(state, '   ')
  assert.equal(result.error, 'reasoning-required')
  assert.equal(result.state.phase, 'assessment')
  assert.equal(result.state.evidenceTrace.length, 0)
})

test('every new item resets reasoning and all attempt-specific state', () => {
  let state = model.createDemoState()
  state = answerCurrent(state, 'thousands', 'The first available unit is in the thousands place.')
  const assessmentEntry = state.evidenceTrace[0]
  state = model.continueFlow(state)
  state = model.continueFlow(state)

  assert.equal(state.phase, 'guided-practice')
  assert.equal(state.attempt.reasoning, '')
  assert.equal(state.attempt.selectedChoiceId, null)
  assert.equal(state.attempt.submitted, false)
  assert.equal(state.attempt.explicitlyUncertain, false)
  assert.equal(state.attempt.feedbackClass, 'unsubmitted')
  assert.equal(state.evidenceTrace[0].reasoning, assessmentEntry.reasoning)
  assert.equal(state.evidenceTrace[0].itemId, 'demo-pv-diagnostic-01')
})

test('old reasoning cannot be resubmitted for the next item', () => {
  let state = model.createDemoState()
  state = answerCurrent(state, 'thousands', 'Old assessment reasoning.')
  state = model.continueFlow(state)
  state = model.continueFlow(state)
  state = model.selectAnswer(state, 'A')
  const result = model.submitReasoning(state, state.attempt.reasoning)

  assert.equal(state.attempt.reasoning, '')
  assert.equal(result.error, 'reasoning-required')
  assert.equal(result.state.evidenceTrace.length, 1)
})

test('correct supported answers do not receive misconception feedback', () => {
  const item = model.ITEMS.guided
  const classification = model.classifyAttempt(item, 'A', 'I regrouped across zeros by place.')
  assert.equal(classification.feedbackClass, 'correct-supported')
  assert.equal(classification.misconceptionSignal, null)
})

test('a Different Example-style correct response changes phase instead of looping', () => {
  let state = model.createDemoState()
  state = answerCurrent(state, 'thousands', 'I traced left to the first nonzero place.')
  state = model.continueFlow(state)
  assert.equal(state.phase, 'teach-visually')
  state = model.continueFlow(state)
  assert.equal(state.phase, 'guided-practice')
  state = answerCurrent(state, 'A', 'I made equal base-ten trades before subtracting.')
  assert.equal(state.phase, 'guided-evidence')
  state = model.continueFlow(state)
  assert.equal(state.phase, 'independent-attempt')
  assert.equal(state.currentItemId, 'math-pv-m03')
})

test('uncertain or incorrect reassessment routes to bounded continued support', () => {
  let state = model.beginPhase(model.createDemoState(), model.PHASES.REASSESS)
  state = answerCurrent(state, 'B', 'I guessed because I am not sure.')
  assert.equal(state.phase, 'reassessment-evidence')
  state = model.continueFlow(state)
  assert.equal(state.phase, 'continued-support')
  assert.equal(state.currentItemId, null)
  assert.equal(state.attempt.reasoning, '')
})
