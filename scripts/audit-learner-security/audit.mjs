#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const EXPECTED_LESSONS = 8292
export const EXPECTED_ASSESSMENTS = 699

export const REPAIR_SHAS = Object.freeze([
  '4350673d80284066918120157c994672f92c1c53',
  'c8f5a6b6b9b18317f96b5e2f92d453bde0f0b2b9',
  '2d43cd014046ad6190d3bb0f672e3313897d63fd',
  'd78c4f39b6ff97eba830135068c01d21f0893f46',
  'd161efc876ad7563505897323f80fdb2cb11d5a4',
  '858fed9c55e49d03e6457cdf8bf3426dadbd1cd3',
  'dc2cee7fa16ea059218862d0dc42a2bee504269d',
  '9ab9860741566c2d02421fb36dc6c1eb0ddc9223',
  '1651f72f222c002a857506ac8537951a9a77e698',
  '520ce571e7a3e9dc8c60699cfae5f22ee10d56e2',
  '51792ba67bcc3ec79d35fd55063870b21da82d82',
  '1d594411fc969f523b76f340fa388a4c24a0b5a2',
  'f8406fca39c33ba08616ff8ff41a6a0452de47e4',
  'c759e23263078567ee47a9ac7bd1d34c1e98e119',
])

const ANSWER_KEY = /^(?:correctAnswer|answerIndex|expectedAnswer|answerKeyRef)$/i
const LOCATOR_KEY = /^(?:answerKeyRef|scoringAuthorityRef|scoringRef|adultScoringAuthorityRef|adultScoringGuide|teacherGuide|privateRemediationOracle)$/i
const LOCATOR_TEXT = /(?:\/(?:answer[-_]keys?|scoring|scoring[-_]guides?|teacher[-_]guides?)\/|restricted:curriculum-production\/final\/assessments\/adult-authorities\/)/i
const SECRET_TEXT = /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsb_secret_[A-Za-z0-9_-]{16,}|\bservice_role\s*[:=]\s*["'][A-Za-z0-9._-]{16,}["']|\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/
const LOCAL_PORT = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d{2,5}\b/i

async function filesUnder(directory, predicate = () => true) {
  const output = []
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile() && predicate(path)) output.push(path)
    }
  }
  await visit(directory)
  return output.sort()
}

function pushFinding(output, kind, file, pointer, value) {
  output.push({ kind, file, pointer, value: String(value).slice(0, 240) })
}

export function scanLearnerValue(value, file = '<memory>') {
  const answerLeaks = []
  const scoringLocatorLeaks = []
  const secretFindings = []
  const pending = [{ value, pointer: '$', suppressLocatorText: false }]
  while (pending.length) {
    const current = pending.pop()
    if (typeof current.value === 'string') {
      if (!current.suppressLocatorText && LOCATOR_TEXT.test(current.value)) pushFinding(scoringLocatorLeaks, 'locator-value', file, current.pointer, current.value)
      if (SECRET_TEXT.test(current.value)) pushFinding(secretFindings, 'credential-literal', file, current.pointer, '[redacted]')
      continue
    }
    if (!current.value || typeof current.value !== 'object') continue
    for (const [key, nested] of Object.entries(current.value)) {
      const pointer = `${current.pointer}.${key}`
      const locatorKey = LOCATOR_KEY.test(key)
      if (ANSWER_KEY.test(key)) pushFinding(answerLeaks, 'answer-key', file, pointer, key)
      if (locatorKey) pushFinding(scoringLocatorLeaks, 'locator-key', file, pointer, key)
      pending.push({ value: nested, pointer, suppressLocatorText: locatorKey })
    }
  }
  return { answerLeaks, scoringLocatorLeaks, secretFindings }
}

export function endpointControlEvidence(handlerSource, resolverSource) {
  return Object.freeze({
    exactRequestShape: /assertExactObject\(value,\s*\[/.test(handlerSource) && /parseOperationRequest/.test(handlerSource),
    callerExpectedAnswerRejected: !/["'](?:expectedAnswer|correctAnswer|answerIndex)["']/.test(handlerSource),
    trustedBindingLocatorsOnly: /binding\.productionPackageRef/.test(resolverSource) && /binding\.scoringAuthorityRef/.test(resolverSource),
    filesystemContainment: /candidate !== root/.test(resolverSource) && /candidate\.startsWith/.test(resolverSource) && /authority_locator_escape/.test(resolverSource),
    packageLessonBinding: /lessonId\(packageValue\) !== input\.lessonRef/.test(resolverSource),
    scoringLessonBinding: /lessonId\(scoring\) !== input\.lessonRef/.test(resolverSource),
    itemBinding: /itemRef/.test(resolverSource) && /find\(\(candidate\) => candidate\?\.(?:ref|sectionId) ===/.test(resolverSource),
    learnerProjectionGuard: /assertLearnerSafe\(learnerProjection\(resolved\)\)/.test(resolverSource),
    resultOmitsAnswer: /outcome\.result/.test(handlerSource) && /resultKind/.test(resolverSource),
    verifiedStudentSession: /createTrustedStudySessionVerifier/.test(resolverSource) && /readStudySessionBearer/.test(handlerSource),
    exactAssignmentAuthority: /bound\.session\.sessionRef !== assignmentRef/.test(resolverSource) && /bound\.session\.lessonRef !== lessonRef/.test(resolverSource),
    guardianAuthorityPreserved: /guardian-attestation-required/.test(resolverSource) && /status: 'pending-guardian-attestation'/.test(resolverSource),
  })
}

export function bundleTextEvidence(source) {
  const answerTokenCount = (source.match(/\b(?:correctAnswer|answerIndex|expectedAnswer)\b/g) ?? []).length
  const denylistOnly = answerTokenCount === 1 && /new Set\(\["messages","conversation","transcript","tutorChats"/.test(source)
  return Object.freeze({
    adultMaterial: answerTokenCount > 0 && !denylistOnly,
    nodeRuntimeLeak: /(?:node:fs|from\s*["']fs["']|\bprocess\.(?:env|cwd|versions)\b)/.test(source),
    fakeIndexedDb: /fakeIndexedDb|FakeIndexedDB|createFakeIndexed/i.test(source),
    localDevelopmentPort: LOCAL_PORT.test(source),
    credentialLiteral: SECRET_TEXT.test(source),
  })
}

export function sourcePrivacyEvidence(sources) {
  const { app, types, engine, syncConfig, syncWorkflow, tutor, studyIdentity, finalBackup, finalState, journal } = sources
  const pinFindings = []
  if (/\bpin:\s*string/.test(types) && /parentPin:\s*string/.test(types) && /profile\.pin|p\.pin/.test(app)) pinFindings.push('plaintext-learner-and-parent-pin-in-app-state')
  if (/function pendingRows/.test(engine) && /data:\s*local\[id\]/.test(engine) && /pin/.test(types)) pinFindings.push('profile-sync-uploads-plaintext-pin')
  if (/backupLocalForHousehold/.test(syncConfig) && /JSON\.stringify\(state\)/.test(syncConfig)) pinFindings.push('sync-safety-backup-includes-plaintext-pin')
  if (/appState:\s*app\.state/.test(finalBackup) && /pinDigests/.test(finalState)) pinFindings.push('portable-backup-includes-pin-digest')

  const tutorPrivacy = []
  if (/correctAnswer:\s*string/.test(tutor) && /messages:/.test(tutor) && /tutorChats:/.test(tutor)) tutorPrivacy.push('raw-tutor-transcript-and-answer-authority-persisted-in-profile')
  if (/data:\s*local\[id\]/.test(engine) && /tutorChats/.test(types)) tutorPrivacy.push('raw-tutor-conversation-uploaded-by-profile-sync')

  const bearerFindings = []
  const identityWithoutComments = studyIdentity.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  if (/(?:localStorage|sessionStorage)\.(?:setItem|getItem)\([^)]*sessionReference|sessionReference[^;\n]*(?:localStorage|sessionStorage)\.(?:setItem|getItem)/s.test(identityWithoutComments)) bearerFindings.push('study-bearer-in-browser-storage')
  if (/(?:URLSearchParams|location\.(?:search|hash)|history\.(?:pushState|replaceState))[^;\n]*sessionReference|sessionReference[^;\n]*(?:URLSearchParams|location\.(?:search|hash)|history\.(?:pushState|replaceState))/s.test(identityWithoutComments)) bearerFindings.push('study-bearer-in-url-or-history')

  const backupFindings = []
  if (pinFindings.includes('sync-safety-backup-includes-plaintext-pin')) backupFindings.push('plaintext-pin-in-sync-safety-backup')
  if (/JSON\.stringify\(state\)/.test(syncConfig) && /tutorChats/.test(types)) backupFindings.push('raw-tutor-transcript-in-sync-safety-backup')
  if (/JSON\.stringify\(state\)/.test(syncConfig) && /correctAnswer:\s*string/.test(tutor)) backupFindings.push('adult-answer-authority-in-sync-safety-backup')
  if (pinFindings.includes('portable-backup-includes-pin-digest')) backupFindings.push('pin-digest-in-portable-backup')

  const privateLearnerNoteFindings = []
  if (/privateJournalText|journal/.test(syncWorkflow) && /data:\s*local\[id\]/.test(engine)) privateLearnerNoteFindings.push('private-learner-note-upload')
  if (!/localStorage/.test(journal)) privateLearnerNoteFindings.push('private-journal-storage-control-missing')
  return { pinFindings, tutorPrivacy, bearerFindings, backupFindings, privateLearnerNoteFindings }
}

async function readSources(root) {
  const read = (path) => readFile(join(root, path), 'utf8')
  const entries = await Promise.all([
    'src/App.tsx', 'src/types.ts', 'src/sync/engine.ts', 'src/sync/config.ts',
    'src/sync/workflow.ts', 'src/tutor/tutorChat.ts', 'src/study/client/studyIdentityClient.ts',
    'src/study/family-pilot/final-app/backup.ts', 'src/study/family-pilot/final-app/state.ts',
    'src/mindset/journalStore.ts',
  ].map(read))
  return Object.fromEntries(['app', 'types', 'engine', 'syncConfig', 'syncWorkflow', 'tutor', 'studyIdentity', 'finalBackup', 'finalState', 'journal'].map((key, index) => [key, entries[index]]))
}

export async function auditAssembly(rootInput) {
  const root = resolve(rootInput)
  const publicRoot = join(root, 'public/family-pilot-final/2.0.0')
  const manifest = JSON.parse(await readFile(join(publicRoot, 'manifest.json'), 'utf8'))
  const courseFiles = await filesUnder(join(publicRoot, 'courses'), (path) => path.endsWith('.json'))
  const corpus = { lessons: 0, answerLeaks: [], scoringLocatorLeaks: [], secretFindings: [], finlitLessons: 0 }
  for (const file of courseFiles) {
    const value = JSON.parse(await readFile(file, 'utf8'))
    corpus.lessons += value.lessons.length
    if (value.courseRef.includes('financial-literacy')) corpus.finlitLessons += value.lessons.length
    const scan = scanLearnerValue(value.materials, relative(root, file))
    corpus.answerLeaks.push(...scan.answerLeaks)
    corpus.scoringLocatorLeaks.push(...scan.scoringLocatorLeaks)
    corpus.secretFindings.push(...scan.secretFindings)
  }

  const assessmentFiles = await filesUnder(join(root, 'curriculum-production/final/assessments/packages'), (path) => path.endsWith('.json'))
  const assessments = { count: assessmentFiles.length, answerLeaks: [], scoringLocatorLeaks: [], secretFindings: [] }
  for (const file of assessmentFiles) {
    const value = JSON.parse(await readFile(file, 'utf8'))
    const scan = scanLearnerValue(value, relative(root, file))
    assessments.answerLeaks.push(...scan.answerLeaks)
    assessments.scoringLocatorLeaks.push(...scan.scoringLocatorLeaks)
    assessments.secretFindings.push(...scan.secretFindings)
  }

  const finlitReport = JSON.parse(await readFile(join(root, 'curriculum-production/final/financial-literacy/reports/learner-security.json'), 'utf8'))
  const distFiles = await filesUnder(join(root, 'dist/assets'), (path) => path.endsWith('.js'))
  const bundle = { adultMaterialFiles: [], nodeRuntimeLeakFiles: [], fakeIndexedDbFiles: [], localDevelopmentPortFiles: [], credentialLiteralFiles: [] }
  for (const file of distFiles) {
    const evidence = bundleTextEvidence(await readFile(file, 'utf8'))
    for (const [key, list] of [
      ['adultMaterial', 'adultMaterialFiles'], ['nodeRuntimeLeak', 'nodeRuntimeLeakFiles'],
      ['fakeIndexedDb', 'fakeIndexedDbFiles'], ['localDevelopmentPort', 'localDevelopmentPortFiles'],
      ['credentialLiteral', 'credentialLiteralFiles'],
    ]) if (evidence[key]) bundle[list].push(`dist/assets/${basename(file)}`)
  }

  const handlerSource = await readFile(join(root, 'netlify/functions/production-item-assessment.js'), 'utf8')
  const resolverSource = await readFile(join(root, 'netlify/functions/production-item-resolver.js'), 'utf8')
  const endpoint = endpointControlEvidence(handlerSource, resolverSource)
  const privacy = sourcePrivacyEvidence(await readSources(root))
  const assessmentManifest = JSON.parse(await readFile(join(root, 'curriculum-production/final/assessments/manifest.json'), 'utf8'))
  const blockers = []
  if (corpus.lessons !== EXPECTED_LESSONS || manifest.counts.lessons !== EXPECTED_LESSONS) blockers.push('lesson-census-mismatch')
  if (assessments.count !== EXPECTED_ASSESSMENTS || assessmentManifest.totals.assessments !== EXPECTED_ASSESSMENTS) blockers.push('assessment-census-mismatch')
  if (corpus.answerLeaks.length + assessments.answerLeaks.length) blockers.push('learner-answer-leak')
  if (corpus.scoringLocatorLeaks.length + assessments.scoringLocatorLeaks.length) blockers.push('learner-scoring-locator-leak')
  if (corpus.secretFindings.length + assessments.secretFindings.length + bundle.credentialLiteralFiles.length) blockers.push('credential-secret-leak')
  if (finlitReport.directAnswerMatches.after !== 0 || corpus.finlitLessons !== 504) blockers.push('finlit-direct-answer-disclosure')
  if (!Object.values(endpoint).every(Boolean)) blockers.push('scoring-endpoint-control-gap')
  if (bundle.adultMaterialFiles.length || bundle.nodeRuntimeLeakFiles.length || bundle.fakeIndexedDbFiles.length || bundle.localDevelopmentPortFiles.length) blockers.push('production-bundle-security-gap')
  if (privacy.pinFindings.length) blockers.push('pin-persistence-or-upload')
  if (privacy.bearerFindings.length) blockers.push('study-bearer-persistence')
  if (privacy.tutorPrivacy.length || privacy.privateLearnerNoteFindings.length) blockers.push('learner-privacy-gap')
  if (privacy.backupFindings.length) blockers.push('backup-security-gap')

  return {
    schemaVersion: 1,
    base: 'c81ddb6e04bc1c3629212327d47817c1b5677477',
    repairShas: REPAIR_SHAS,
    lessonsScanned: corpus.lessons,
    assessmentsScanned: assessments.count,
    answerLeaks: { lessons: corpus.answerLeaks, assessments: assessments.answerLeaks },
    scoringLocatorLeaks: { lessons: corpus.scoringLocatorLeaks, assessments: assessments.scoringLocatorLeaks },
    secretFindings: [...corpus.secretFindings, ...assessments.secretFindings, ...bundle.credentialLiteralFiles],
    finlit: { lessonsScanned: corpus.finlitLessons, directPreTaskAnswerDisclosures: finlitReport.directAnswerMatches.after, scoringLocatorLeaks: corpus.scoringLocatorLeaks.filter((item) => item.file.includes('financial-literacy')) },
    endpoint,
    bundle,
    privacy,
    blockers,
    classification: blockers.length === 0 ? 'SECURITY_PRIVACY_ACCEPTANCE_READY' : 'BLOCKED',
  }
}

async function main() {
  const rootFlag = process.argv.indexOf('--root')
  const root = rootFlag >= 0 ? process.argv[rootFlag + 1] : process.cwd()
  const result = await auditAssembly(root)
  const display = process.argv.includes('--verbose') ? result : {
    ...result,
    answerLeaks: {
      lessons: result.answerLeaks.lessons.length,
      assessments: result.answerLeaks.assessments.length,
    },
    scoringLocatorLeaks: {
      lessons: result.scoringLocatorLeaks.lessons.length,
      assessments: result.scoringLocatorLeaks.assessments.length,
      assessmentSample: result.scoringLocatorLeaks.assessments.slice(0, 3),
    },
    secretFindings: result.secretFindings.length,
    finlit: { ...result.finlit, scoringLocatorLeaks: result.finlit.scoringLocatorLeaks.length },
  }
  process.stdout.write(`${JSON.stringify(display, null, 2)}\n`)
  if (result.classification === 'BLOCKED') process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
