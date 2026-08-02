import { inspectRuntimeHealth, type RuntimeHealth } from '../../adaptive-tutor/study-engine/runtime/src/health.ts'

export const ACCEPTED_STUDY_RUNTIME_VERSIONS = Object.freeze({
  release: '1.0.0-rc.1',
  tutorCore: '0.2.0',
  tutorCoreStatus: 'frozen',
  tutorCoreBridge: '1.0.1',
  tutorCoreBridgeContract: 1,
  studentRuntime: '0.7.2',
  calendarParentRuntime: '0.8.1',
  studySchemaVersion: 1,
  bridgeContractVersion: 1,
})

export function assertAcceptedStudyRuntime(health: RuntimeHealth = inspectRuntimeHealth()): RuntimeHealth {
  const expected = ACCEPTED_STUDY_RUNTIME_VERSIONS
  const actual = health.components
  if (
    health.release.version !== expected.release ||
    health.release.mode !== 'portable-non-production' ||
    actual.tutorCore !== expected.tutorCore ||
    actual.tutorCoreStatus !== expected.tutorCoreStatus ||
    actual.tutorCoreBridge !== expected.tutorCoreBridge ||
    actual.tutorCoreBridgeContract !== expected.tutorCoreBridgeContract ||
    actual.studentRuntime !== expected.studentRuntime ||
    actual.calendarParentRuntime !== expected.calendarParentRuntime ||
    health.compatibility.studySchemaVersion !== expected.studySchemaVersion ||
    health.compatibility.bridgeContractVersion !== expected.bridgeContractVersion
  ) {
    throw new Error('Unsupported Study Runtime or bridge version; integration quarantined before port access.')
  }
  return health
}
