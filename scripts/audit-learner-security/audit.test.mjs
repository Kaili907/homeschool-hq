import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EXPECTED_ASSESSMENTS,
  EXPECTED_LESSONS,
  REPAIR_SHAS,
  bundleTextEvidence,
  endpointControlEvidence,
  scanLearnerValue,
  sourcePrivacyEvidence,
} from './audit.mjs'

const safeHandler = `
  assertExactObject(value, ['releaseId', 'assignmentRef', 'lessonRef', 'sectionRef', 'itemRef'])
  parseOperationRequest(operation, body.request)
  readStudySessionBearer(event)
  boundedJsonResponse(200, outcome.result)
`

const safeResolver = `
  createTrustedStudySessionVerifier()
  function trustedSourcePath(reference) {
    const candidate = resolve(workspaceRoot, reference)
    if (candidate !== root && !candidate.startsWith(root)) throw new Error('authority_locator_escape')
  }
  trustedSourcePath(binding.productionPackageRef)
  trustedSourcePath(binding.scoringAuthorityRef)
  if (lessonId(packageValue) !== input.lessonRef || lessonId(scoring) !== input.lessonRef) return null
  section.items.find((candidate) => candidate?.ref === itemRef)
  assertLearnerSafe(learnerProjection(resolved))
  const resultKind = 'guardian-attestation-required'
  return { status: 'pending-guardian-attestation' }
  if (bound.session.sessionRef !== assignmentRef || bound.session.lessonRef !== lessonRef) return denied
`

const safePrivacySources = Object.freeze({
  app: 'if (p.pin === input) {}',
  types: 'pin: string; parentPin: string; tutorChats?: TutorChat[]',
  engine: 'function pendingRows() { return { data: local[id] } }',
  syncConfig: 'function backupLocalForHousehold(state) { JSON.stringify(state) }',
  syncWorkflow: 'const rows = pendingRows(local)',
  tutor: 'correctAnswer: string; messages: Message[]; return { tutorChats: chats }',
  studyIdentity: 'let sessionReference = null; function clear() { sessionReference = null }',
  finalBackup: 'return { appState: app.state }',
  finalState: 'readonly pinDigests: Record<string, string>',
  journal: 'localStorage.setItem(key, privateText)',
})

test('release census and repair SHA controls are pinned', () => {
  assert.equal(EXPECTED_LESSONS, 8292)
  assert.equal(EXPECTED_ASSESSMENTS, 699)
  assert.equal(REPAIR_SHAS.length, 14)
  assert.ok(REPAIR_SHAS.every((sha) => /^[0-9a-f]{40}$/.test(sha)))
})

for (const key of ['correctAnswer', 'answerIndex', 'expectedAnswer', 'answerKeyRef']) {
  test(`mutant: learner ${key} is killed`, () => {
    assert.equal(scanLearnerValue({ lesson: { [key]: 'secret' } }).answerLeaks.length, 1)
  })
}

for (const [label, value] of [
  ['scoring key', { scoringAuthorityRef: 'opaque' }],
  ['answer-key path', { resource: 'curriculum-production/final/math/answer-keys/x.json' }],
  ['scoring path', { resource: 'curriculum-production/final/math/scoring/x.json' }],
  ['adult assessment locator', { adultScoringAuthorityRef: 'restricted:curriculum-production/final/assessments/adult-authorities/x.json' }],
]) {
  test(`mutant: ${label} is killed`, () => {
    assert.ok(scanLearnerValue(value).scoringLocatorLeaks.length > 0)
  })
}

for (const [label, value] of [
  ['Supabase secret', 'sb_secret_abcdefghijklmnop'],
  ['service-role credential', `service_role='abcdefghijklmnop'`],
  ['private key', '-----BEGIN PRIVATE KEY-----'],
]) {
  test(`mutant: ${label} is killed`, () => {
    assert.equal(scanLearnerValue({ value }).secretFindings.length, 1)
  })
}

test('safe learner material has no false positive', () => {
  assert.deepEqual(scanLearnerValue({ prompt: 'Explain how you checked your work.', choices: ['A', 'B'] }), {
    answerLeaks: [], scoringLocatorLeaks: [], secretFindings: [],
  })
})

for (const key of Object.keys(endpointControlEvidence(safeHandler, safeResolver))) {
  test(`mutant: endpoint loses ${key}`, () => {
    let handler = safeHandler
    let resolver = safeResolver
    switch (key) {
      case 'exactRequestShape': handler = handler.replace('assertExactObject', 'acceptObject'); break
      case 'callerExpectedAnswerRejected': handler += `\nconst allowed = 'expectedAnswer'`; break
      case 'trustedBindingLocatorsOnly': resolver = resolver.replace('binding.scoringAuthorityRef', 'request.scoringAuthorityRef'); break
      case 'filesystemContainment': resolver = resolver.replace("throw new Error('authority_locator_escape')", 'return candidate'); break
      case 'packageLessonBinding': resolver = resolver.replace('lessonId(packageValue) !== input.lessonRef || ', ''); break
      case 'scoringLessonBinding': resolver = resolver.replace(' || lessonId(scoring) !== input.lessonRef', ''); break
      case 'itemBinding': resolver = resolver.replace('section.items.find((candidate) => candidate?.ref === itemRef)', 'section.items[0]'); break
      case 'learnerProjectionGuard': resolver = resolver.replace('assertLearnerSafe(learnerProjection(resolved))', 'learnerProjection(resolved)'); break
      case 'resultOmitsAnswer': handler = handler.replace('outcome.result', 'outcome.answer'); break
      case 'verifiedStudentSession': resolver = resolver.replace('createTrustedStudySessionVerifier()', 'trustCaller()'); break
      case 'exactAssignmentAuthority': resolver = resolver.replace('bound.session.sessionRef !== assignmentRef || ', ''); break
      case 'guardianAuthorityPreserved': resolver = resolver.replace("status: 'pending-guardian-attestation'", "status: 'correct'"); break
      default: assert.fail(`unhandled endpoint control ${key}`)
    }
    assert.equal(endpointControlEvidence(handler, resolver)[key], false)
  })
}

test('endpoint safe fixture satisfies every control', () => {
  assert.ok(Object.values(endpointControlEvidence(safeHandler, safeResolver)).every(Boolean))
})

for (const [label, source, field] of [
  ['answer authority', 'const correctAnswer = resolveExpected(); const answerIndex = 2', 'adultMaterial'],
  ['Node fs', `import fs from 'fs'`, 'nodeRuntimeLeak'],
  ['fake IndexedDB', 'createFakeIndexedDb()', 'fakeIndexedDb'],
  ['local development port', `fetch('http://localhost:9999')`, 'localDevelopmentPort'],
  ['credential', `const key = 'sb_secret_abcdefghijklmnop'`, 'credentialLiteral'],
]) {
  test(`mutant: bundle ${label} is killed`, () => {
    assert.equal(bundleTextEvidence(source)[field], true)
  })
}

test('admin denylist token is not mistaken for answer authority', () => {
  const source = 'new Set(["messages","conversation","transcript","tutorChats","correctAnswer"])'
  assert.equal(bundleTextEvidence(source).adultMaterial, false)
})

test('privacy evidence catches PIN persistence, tutor upload, and unsafe backups', () => {
  const evidence = sourcePrivacyEvidence(safePrivacySources)
  assert.equal(evidence.pinFindings.length, 4)
  assert.equal(evidence.tutorPrivacy.length, 2)
  assert.equal(evidence.backupFindings.length, 4)
  assert.deepEqual(evidence.bearerFindings, [])
  assert.deepEqual(evidence.privateLearnerNoteFindings, [])
})

test('mutant: persisted Study bearer is killed', () => {
  const sources = { ...safePrivacySources, studyIdentity: 'localStorage.setItem("study", sessionReference)' }
  assert.deepEqual(sourcePrivacyEvidence(sources).bearerFindings, ['study-bearer-in-browser-storage'])
})

test('mutant: uploaded private learner journal is killed', () => {
  const sources = { ...safePrivacySources, syncWorkflow: 'privateJournalText; pendingRows(local)' }
  assert.deepEqual(sourcePrivacyEvidence(sources).privateLearnerNoteFindings, ['private-learner-note-upload'])
})
