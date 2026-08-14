import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateLessonProductionReadiness } from '../src/lib/productionGate.mjs'

const base = () => ({
  lessonId: 'health-pe-h3-fixture',
  title: 'Private-safe decision and movement response',
  subjectFamily: 'ARTS_RFL_PE_PROJECT',
  independentWork: { present: true, text: 'Read the fictional scenario, choose a safe response, explain two reasons for the choice, and show how the plan can be adapted privately with an equal-status seated or spoken option.' },
  scoringAuthority: { kind: 'RUBRIC', content: { present: true, text: 'Meets: identifies the risk, chooses a safe response, supports it with two accurate reasons, and uses an adaptation that preserves the learning goal.' } },
  remediation: { present: true, text: 'Return to the modeled fictional example, name the risk cue, and choose from two safe response options before explaining the choice.' },
  extension: { present: true, text: 'Apply the same decision rule to a second fictional context and explain which details change the response.' },
  assessmentAlignment: 'ALIGNED',
  requiresSafetyOrPrivacyReview: true,
  safetyOrPrivacyStatus: 'VERIFIED',
  safeAlternative: { present: true, text: 'Use a fictional character, private written response, or equal-status seated movement path; no public performance or personal disclosure is required.' },
})

test('H3 admits substantive Health/PE rubric judgment work', () => {
  assert.equal(evaluateLessonProductionReadiness(base()).status, 'READY')
})

test('H3 projection refuses a synthesized fixed answer key for judgment work', () => {
  const lesson = base()
  lesson.scoringAuthority.kind = 'ANSWER_KEY'
  const result = evaluateLessonProductionReadiness(lesson)
  assert.equal(result.status, 'NOT_READY')
  assert.ok(result.codes.includes('MISSING_RUBRIC'))
})

test('H3 blocks a direct credential request and reviews a quoted one', () => {
  const direct = base()
  direct.independentWork.text += ' Enter your real password.'
  assert.ok(evaluateLessonProductionReadiness(direct).codes.includes('CREDENTIAL_REQUEST'))

  const quoted = base()
  quoted.independentWork.text += ' Analyze the message: “Enter your real password.”'
  const result = evaluateLessonProductionReadiness(quoted)
  assert.equal(result.status, 'NEEDS_HUMAN_REVIEW')
  assert.ok(result.codes.includes('CREDENTIAL_REQUEST_QUOTED'))
})

test('H3 fails closed when the verified private alternative is absent', () => {
  const lesson = base()
  lesson.safeAlternative = { present: false }
  const result = evaluateLessonProductionReadiness(lesson)
  assert.equal(result.status, 'NOT_READY')
  assert.ok(result.codes.includes('SAFETY_OR_PRIVACY_GAP'))
})

test('H3 fails closed when PE transfer semantics conflict', () => {
  const lesson = base()
  lesson.requiresTransferConsistency = true
  lesson.transferConsistencyStatus = 'CONFLICT'
  lesson.transferConsistencyFindings = ['LIVE_OPPONENT_VS_SOLO_AUTHORITY']
  const result = evaluateLessonProductionReadiness(lesson)
  assert.equal(result.status, 'NOT_READY')
  assert.ok(result.codes.includes('TRANSFER_AUTHORITY_CONFLICT'))
})
