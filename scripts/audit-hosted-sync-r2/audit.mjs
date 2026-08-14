import { readFile } from 'node:fs/promises'
import {
  exampleHostedStudySyncV1,
  serializeHostedStudySyncV1,
} from './hosted-sync-boundary.mjs'

const root = new URL('../../', import.meta.url)

const sources = {
  syncTypes: await readFile(new URL('src/sync/types.ts', root), 'utf8'),
  syncEngine: await readFile(new URL('src/sync/engine.ts', root), 'utf8'),
  syncProvenance: await readFile(new URL('src/sync/provenance.ts', root), 'utf8'),
  appTypes: await readFile(new URL('src/types.ts', root), 'utf8'),
  finalState: await readFile(new URL('src/study/family-pilot/final-app/state.ts', root), 'utf8'),
  finalBackup: await readFile(new URL('src/study/family-pilot/final-app/backup.ts', root), 'utf8'),
  responseStore: await readFile(new URL('src/study/family-pilot/final-app/learner-response/store.ts', root), 'utf8'),
  finalApp: await readFile(new URL('src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx', root), 'utf8'),
  app: await readFile(new URL('src/App.tsx', root), 'utf8'),
}

const checks = {
  proposedSerializerAcceptsMinimumDto: Boolean(serializeHostedStudySyncV1(exampleHostedStudySyncV1())),
  localPinDigestPresent: /readonly pinDigests:/.test(sources.finalState),
  localRawResponsePersistencePresent: /FAMILY_PILOT_LEARNER_RESPONSES_KEY/.test(sources.responseStore),
  portableBackupCarriesAppState: /readonly appState: FinalFamilyPilotAppStateV1/.test(sources.finalBackup),
  portableBackupCarriesDurableStudyDocuments: /readonly studyDocuments:/.test(sources.finalBackup),
  portableBackupExcludesResponseStore: !/FAMILY_PILOT_LEARNER_RESPONSES_KEY|BrowserLearnerResponseStore/.test(sources.finalBackup),
  legacyCloudRowsCarryWholeProfile: /data: Profile/.test(sources.syncTypes) && /data: local\[id\]/.test(sources.syncEngine),
  legacyCloudValidatorAcceptsPlaintextPin: /text\(value\.pin, 64\)/.test(sources.syncProvenance),
  legacyCloudValidatorAcceptsTutorChats: /optional\(value\.tutorChats, validateTutorChats\)/.test(sources.syncProvenance),
  legacyCloudValidatorAcceptsAssistantTranscripts: /optional\(value\.assistant, validateAssistant\)/.test(sources.syncProvenance),
  appStateCarriesParentPin: /parentPin: string/.test(sources.appTypes),
  legacySyncHookRunsBeforeFamilyPilotRoute:
    sources.app.indexOf('const sync = useSync(state, setState)') !== -1 &&
    sources.app.indexOf('const sync = useSync(state, setState)') < sources.app.indexOf("screen.kind === 'familyPilot'"),
  responseImplementationUsesLocalStorage: /new BrowserLearnerResponseStore\(window\.localStorage\)/.test(sources.finalApp),
  responseUiClaimsIndexedDb: /Saved in IndexedDB/.test(sources.finalApp),
}

const blockers = []
if (checks.legacyCloudRowsCarryWholeProfile && checks.legacyCloudValidatorAcceptsPlaintextPin) {
  blockers.push('LEGACY_PROFILE_SYNC_ACCEPTS_PLAINTEXT_PIN')
}
if (checks.legacyCloudRowsCarryWholeProfile && checks.legacyCloudValidatorAcceptsTutorChats) {
  blockers.push('LEGACY_PROFILE_SYNC_ACCEPTS_TUTOR_TRANSCRIPTS_AND_ANSWER_MATERIAL')
}
if (checks.legacyCloudRowsCarryWholeProfile && checks.legacyCloudValidatorAcceptsAssistantTranscripts) {
  blockers.push('LEGACY_PROFILE_SYNC_ACCEPTS_ASSISTANT_TRANSCRIPTS_AND_PERSONA')
}
if (checks.legacySyncHookRunsBeforeFamilyPilotRoute) {
  blockers.push('LEGACY_SYNC_HOOK_EXECUTES_ON_THE_FAMILY_PILOT_APP_PATH')
}
if (checks.responseImplementationUsesLocalStorage && checks.responseUiClaimsIndexedDb) {
  blockers.push('LEARNER_RESPONSE_STORAGE_NOTICE_DISAGREES_WITH_IMPLEMENTATION')
}
blockers.push('PROPOSED_R2_SERIALIZER_IS_TEST_ONLY_AND_NOT_YET_THE_PRODUCTION_PRE_NETWORK_GATE')

const result = {
  audit: 'HOSTED SYNC SECURITY + PRIVACY AUDIT R2',
  base: '7baf8dfbc27168708ed4cf504285a1838d7345f6',
  hostedContact: false,
  checks,
  blockers,
  classification: blockers.length === 0 ? 'HOSTED_SYNC_SECURITY_R2_READY' : 'BLOCKED',
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
