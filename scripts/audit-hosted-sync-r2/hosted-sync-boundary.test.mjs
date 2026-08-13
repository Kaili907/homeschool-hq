import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  FORBIDDEN_SYNC_FIELD_FAMILIES_V1,
  HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1,
  HostedSyncBoundaryError,
  exampleHostedStudySyncV1,
  serializeHostedStudySyncV1,
  validateHostedStudySyncV1,
} from './hosted-sync-boundary.mjs'

const root = new URL('../../', import.meta.url)

function clone() {
  return structuredClone(exampleHostedStudySyncV1())
}

function expectRejected(candidate, expectedPath) {
  assert.throws(
    () => serializeHostedStudySyncV1(candidate),
    (error) => error instanceof HostedSyncBoundaryError &&
      ['FORBIDDEN_FIELD', 'UNALLOWLISTED_FIELD', 'SENSITIVE_VALUE'].includes(error.code) &&
      error.path === expectedPath,
  )
}

test('versioned allowlist is explicit, frozen, unique, and deny-by-default', () => {
  assert.equal(Object.isFrozen(HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1), true)
  assert.equal(new Set(HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1).size, HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1.length)
  assert.equal(Object.isFrozen(FORBIDDEN_SYNC_FIELD_FAMILIES_V1), true)
  const valid = clone()
  const first = serializeHostedStudySyncV1(valid)
  const second = serializeHostedStudySyncV1(structuredClone(valid))
  assert.equal(first, second)
  assert.equal(validateHostedStudySyncV1(valid).ok, true)

  const unknown = clone()
  unknown.learners[0].debug = true
  expectRejected(unknown, '$.learners[0].debug')

  const sparse = clone()
  sparse.learners[0].assignments.length = 2
  expectRejected(sparse, '$.learners[0].assignments')
})

const requiredMutants = [
  ['PIN', 'rawPin', '4826'],
  ['bearer', 'studyBearer', 'Bearer study-secret-token'],
  ['Tutor transcript', 'tutorTranscript', 'learner and Tutor raw turns'],
  ['answerIndex', 'answerIndex', 2],
  ['correctAnswer', 'correctAnswer', 'B'],
  ['answerKeyRef', 'answerKeyRef', 'answer-key:math-u1'],
  ['scoring locator', 'scoringLocator', '/restricted/scoring/math-u1'],
  ['private notes', 'privateNotes', 'adult-only note body'],
]

for (const [label, field, value] of requiredMutants) {
  test(`rejects required mutant: ${label}`, () => {
    const candidate = clone()
    candidate.learners[0].assignments[0][field] = value
    expectRejected(candidate, `$.learners[0].assignments[0].${field}`)
  })
}

const additionalNeverSyncMutants = [
  ['audio', 'audioBlob', 'base64-audio'],
  ['emotional label', 'emotionalLabel', 'anxious'],
  ['personality inference', 'personalityInference', 'introverted'],
  ['diagnostic inference', 'diagnosticInference', 'possible condition'],
  ['service-role credential', 'serviceRoleCredential', 'service-role-secret'],
  ['raw learner response', 'responseText', 'learner prose'],
  ['safety reason label', 'reasonCode', 'tutor-concerning-content'],
]

for (const [label, field, value] of additionalNeverSyncMutants) {
  test(`rejects additional never-sync field: ${label}`, () => {
    const candidate = clone()
    candidate.learners[0].entryBlocks[0][field] = value
    expectRejected(candidate, `$.learners[0].entryBlocks[0].${field}`)
  })
}

test('rejects credential text even when hidden inside an allowlisted text field', () => {
  const candidate = clone()
  candidate.learners[0].assignments[0].title = 'Bearer abc.def.ghi'
  expectRejected(candidate, '$.learners[0].assignments[0].title')
})

test('cloud boundary rejects entire local/backup documents instead of stripping them', async () => {
  const finalStateSource = await readFile(new URL('src/study/family-pilot/final-app/state.ts', root), 'utf8')
  const portableBackupSource = await readFile(new URL('src/study/family-pilot/final-app/backup.ts', root), 'utf8')
  const durableSource = await readFile(new URL('src/study/family-pilot/durable-ports/schema.ts', root), 'utf8')

  assert.match(finalStateSource, /readonly pinDigests:/)
  assert.match(portableBackupSource, /readonly appState: FinalFamilyPilotAppStateV1/)
  assert.match(portableBackupSource, /readonly studyDocuments:/)
  assert.doesNotMatch(portableBackupSource, /FAMILY_PILOT_LEARNER_RESPONSES_KEY|BrowserLearnerResponseStore/)
  assert.match(durableSource, /readonly parentSettings:/)
  assert.match(durableSource, /readonly events:/)

  for (const localShape of [
    { schemaVersion: 1, pinDigests: { avery: 'deadbeef' } },
    { backupSchemaVersion: 1, appState: {}, studyDocuments: [] },
    { schemaVersion: 1, parentSettings: {}, events: [] },
  ]) {
    assert.equal(validateHostedStudySyncV1(localShape).ok, false)
  }
})

test('audit detects that legacy Profile/AppState cloud sync is forbidden for Family Pilot reuse', async () => {
  const typesSource = await readFile(new URL('src/sync/types.ts', root), 'utf8')
  const engineSource = await readFile(new URL('src/sync/engine.ts', root), 'utf8')
  const provenanceSource = await readFile(new URL('src/sync/provenance.ts', root), 'utf8')
  const appTypesSource = await readFile(new URL('src/types.ts', root), 'utf8')
  const appSource = await readFile(new URL('src/App.tsx', root), 'utf8')

  assert.match(typesSource, /data: Profile/)
  assert.match(engineSource, /data: local\[id\]/)
  assert.match(provenanceSource, /text\(value\.pin, 64\)/)
  assert.match(provenanceSource, /optional\(value\.tutorChats, validateTutorChats\)/)
  assert.match(provenanceSource, /optional\(value\.assistant, validateAssistant\)/)
  assert.match(appTypesSource, /parentPin: string/)
  assert.match(appTypesSource, /the exact problem, correct answer, and her answer/)
  assert.ok(appSource.indexOf('const sync = useSync(state, setState)') < appSource.indexOf("screen.kind === 'familyPilot'"))
})

test('local response bodies are durable but absent from portable backup and cloud allowlist', async () => {
  const responseStore = await readFile(new URL('src/study/family-pilot/final-app/learner-response/store.ts', root), 'utf8')
  const portableBackup = await readFile(new URL('src/study/family-pilot/final-app/backup.ts', root), 'utf8')
  const finalApp = await readFile(new URL('src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx', root), 'utf8')
  assert.match(responseStore, /this\.storage\.setItem\(FAMILY_PILOT_LEARNER_RESPONSES_KEY, JSON\.stringify\(next\)\)/)
  assert.doesNotMatch(portableBackup, /learner-response|FAMILY_PILOT_LEARNER_RESPONSES_KEY/)
  assert.match(finalApp, /new BrowserLearnerResponseStore\(window\.localStorage\)/)
  assert.match(finalApp, /Saved in IndexedDB/)
  assert.equal(HOSTED_STUDY_SYNC_FIELD_ALLOWLIST_V1.some((path) => /response|transcript|audio|pin/i.test(path)), false)
})
