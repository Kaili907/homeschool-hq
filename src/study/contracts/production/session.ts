import type { StudyCheckpointRecord } from '../persistence/types'

export const STUDY_SESSION_SEMANTICS_SCHEMA_VERSION = 2 as const

export type StudyProductionSessionState =
  | 'active'
  | 'paused'
  | 'approved-break'
  | 'student-requested-break'
  | 'technical-interruption'
  | 'completed'
  | 'abandoned'

export type StudyProductionTransitionType =
  | 'segment-started'
  | 'segment-completed'
  | 'pause-started'
  | 'session-resumed'
  | 'break-requested'
  | 'break-started'
  | 'break-ended'
  | 'technical-interruption-started'
  | 'technical-interruption-ended'
  | 'session-completed'
  | 'session-abandoned'

export type StudyProductionLastTransitionType =
  | 'session-started'
  | StudyProductionTransitionType

export interface StudyProductionCurriculumBinding {
  readonly schemaVersion: 1
  readonly status: 'bound'
  readonly releaseId: string
  readonly packageId: string
  readonly releaseVersion: string
  readonly curriculumManifestSha256: string
}

export interface StudyProductionEffectiveSettings {
  readonly timerMode: 'visible' | 'hidden' | 'count_up' | 'count_down'
  readonly maximumWorkMinutes: number
  readonly breakMinimumMinutes: number
  readonly breakMaximumMinutes: number
  readonly minimumBreakCount: number
  readonly requiredBreakIntervalMinutes: number
  readonly reducedMotion: boolean
  readonly noAudio: boolean
  readonly largeText: boolean
  readonly readAloud: boolean
  readonly speechInputAllowed: boolean
}

export interface StudyProductionSessionProjection {
  readonly schemaVersion: typeof STUDY_SESSION_SEMANTICS_SCHEMA_VERSION
  readonly status: 'begun' | 'resumable' | 'closed' | 'stored'
  readonly sessionId: string
  readonly state: StudyProductionSessionState
  readonly revision: number
  readonly acceptedAt: string
  readonly updatedAt: string
  readonly lessonId: string
  readonly subjectId: string
  readonly studyPlanId: string | null
  readonly intendedLocalDate: string
  readonly currentSegmentId: string | null
  readonly completedAt: string | null
  readonly lastTransition: {
    readonly type: StudyProductionLastTransitionType
    readonly acceptedAt: string
  }
  readonly curriculumBinding: StudyProductionCurriculumBinding
  readonly effectiveSettings: StudyProductionEffectiveSettings
}

export interface StudyProductionResumeProjection extends StudyProductionSessionProjection {
  readonly status: 'resumable' | 'closed'
  readonly checkpoint: StudyCheckpointRecord | null
}

export interface StudyProductionBeginRequest {
  readonly idempotencyKey: string
  readonly lessonId: string
  readonly subjectId: string
  readonly studyPlanId: string | null
  readonly intendedLocalDate: string
  readonly initialSegmentId: string
  readonly curriculumContext: {
    readonly releaseVersion: string
    readonly lessonRef: string
    readonly skillRefs: readonly string[]
  }
}

export interface StudyProductionResumeRequest {
  readonly sessionId: string
  readonly curriculumReleaseVersion: string
}

export interface StudyProductionTransitionRequest extends StudyProductionResumeRequest {
  readonly expectedRevision: number
  readonly idempotencyKey: string
  readonly transition: {
    readonly type: StudyProductionTransitionType
    readonly segmentId: string | null
  }
}

export interface StudyProductionCheckpointRequest extends StudyProductionResumeRequest {
  readonly expectedRevision: number
  readonly mutationId: string
  readonly checkpoint: StudyCheckpointRecord
}

export type StudyProductionBindingReason =
  | 'curriculum-release-missing'
  | 'curriculum-release-unsupported'
  | 'curriculum-release-unavailable'
  | 'curriculum-release-mismatch'
  | 'legacy-curriculum-binding-ambiguous'
  | 'study-session-unavailable'

export type StudyProductionSettingsUnavailableReason =
  | 'admin_defaults_unavailable'
  | 'safety_constraints_unavailable'
  | 'required_settings_unavailable'
  | 'authoritative_source_unavailable'

export type StudyProductionManualReviewReason =
  | 'malformed_admin_default'
  | 'malformed_guardian_setting'
  | 'malformed_accommodation'
  | 'malformed_safety_constraint'
  | 'work_duration_conflict'
  | 'break_duration_conflict'

export type StudyProductionSettingsSource =
  | 'admin_default'
  | 'guardian'
  | 'accommodation'
  | 'safety'

export type StudyProductionUnavailableResponse =
  | {
      readonly schemaVersion: 1
      readonly status: 'unavailable' | 'manual-review'
      readonly reasonCode: StudyProductionBindingReason
    }
  | {
      readonly schemaVersion: 2
      readonly status: 'unavailable'
      readonly reasonCode: StudyProductionSettingsUnavailableReason
    }
  | {
      readonly schemaVersion: 2
      readonly status: 'manual_review'
      readonly reasonCodes: readonly StudyProductionManualReviewReason[]
      readonly sourceCategories: readonly StudyProductionSettingsSource[]
    }

export interface StudyProductionIdempotencyCollision {
  readonly schemaVersion: 2
  readonly status: 'idempotency-collision'
}

export interface StudyProductionRevisionConflict {
  readonly schemaVersion: 2
  readonly status: 'revision-conflict'
  readonly currentRevision: number
  readonly currentState: StudyProductionSessionState
}

export interface StudyProductionInvalidTransition {
  readonly schemaVersion: 2
  readonly status: 'invalid-transition'
  readonly currentRevision: number
  readonly currentState: StudyProductionSessionState
  readonly transitionType: StudyProductionTransitionType | 'checkpoint'
}

export interface StudyProductionCheckpointRead {
  readonly schemaVersion: 2
  readonly status: 'found' | 'not-found' | 'integrity-failed'
  readonly sessionRevision: number
  readonly currentState: StudyProductionSessionState
  readonly curriculumBinding: StudyProductionCurriculumBinding
  readonly checkpoint: StudyCheckpointRecord | null
}

export interface StudyProductionCheckpointStored {
  readonly schemaVersion: 2
  readonly status: 'stored'
  readonly checkpointRevision: number
  readonly sessionRevision: number
  readonly currentState: StudyProductionSessionState
  readonly curriculumBinding: StudyProductionCurriculumBinding
}

export interface StudyProductionCheckpointConflict {
  readonly schemaVersion: 2
  readonly status: 'revision-conflict'
  readonly currentCheckpointRevision: number
  readonly sessionRevision: number
  readonly currentState: StudyProductionSessionState
}

export interface StudyProductionInvalidCheckpoint {
  readonly schemaVersion: 2
  readonly status: 'invalid-checkpoint'
  readonly reasonCode: 'malformed-event' | 'stale-checkpoint' | 'idempotency-collision'
}

export type StudyProductionBeginResponse =
  | (StudyProductionSessionProjection & { readonly status: 'begun' })
  | StudyProductionUnavailableResponse
  | StudyProductionIdempotencyCollision

export type StudyProductionResumeResponse =
  | StudyProductionResumeProjection
  | StudyProductionUnavailableResponse

export type StudyProductionTransitionResponse =
  | (StudyProductionSessionProjection & { readonly status: 'stored' })
  | StudyProductionUnavailableResponse
  | StudyProductionIdempotencyCollision
  | StudyProductionRevisionConflict
  | StudyProductionInvalidTransition

export type StudyProductionCheckpointReadResponse =
  | StudyProductionCheckpointRead
  | StudyProductionUnavailableResponse

export type StudyProductionCheckpointResponse =
  | StudyProductionCheckpointStored
  | StudyProductionCheckpointConflict
  | StudyProductionInvalidCheckpoint
  | StudyProductionInvalidTransition
  | StudyProductionUnavailableResponse
  | StudyProductionIdempotencyCollision

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const RELEASE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256 = /^[0-9a-f]{64}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[0-9:.]+(?:Z|[+-]\d{2}:\d{2})$/
const TUTOR_STATE_REF = /^tutor-state:[A-Za-z0-9][A-Za-z0-9._:/-]{0,113}$/
const DRAFT_REF = /^draft:[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/
const SESSION_STATES = new Set<StudyProductionSessionState>([
  'active', 'paused', 'approved-break', 'student-requested-break',
  'technical-interruption', 'completed', 'abandoned',
])
const LAST_TRANSITIONS = new Set<StudyProductionLastTransitionType>([
  'session-started', 'segment-started', 'segment-completed', 'pause-started',
  'session-resumed', 'break-requested', 'break-started', 'break-ended',
  'technical-interruption-started', 'technical-interruption-ended',
  'session-completed', 'session-abandoned',
])
const TRANSITIONS = new Set<StudyProductionTransitionType>(
  [...LAST_TRANSITIONS].filter((value) => value !== 'session-started') as StudyProductionTransitionType[],
)
const BINDING_REASONS = new Set<StudyProductionBindingReason>([
  'curriculum-release-missing', 'curriculum-release-unsupported',
  'curriculum-release-unavailable', 'curriculum-release-mismatch',
  'legacy-curriculum-binding-ambiguous', 'study-session-unavailable',
])
const SETTINGS_UNAVAILABLE_REASONS = new Set<StudyProductionSettingsUnavailableReason>([
  'admin_defaults_unavailable', 'safety_constraints_unavailable',
  'required_settings_unavailable', 'authoritative_source_unavailable',
])
const MANUAL_REASONS = new Set<StudyProductionManualReviewReason>([
  'malformed_admin_default', 'malformed_guardian_setting',
  'malformed_accommodation', 'malformed_safety_constraint',
  'work_duration_conflict', 'break_duration_conflict',
])
const SETTINGS_SOURCES = new Set<StudyProductionSettingsSource>([
  'admin_default', 'guardian', 'accommodation', 'safety',
])
const TIMER_MODES = new Set<StudyProductionEffectiveSettings['timerMode']>([
  'visible', 'hidden', 'count_up', 'count_down',
])
const TUTOR_PHASES = new Set([
  'assessment', 'identify-missing-concept', 'teach-visually',
  'guided-practice', 'independent-attempt', 'reassess',
  'advance', 'reteach', 'escalated',
])
const INTERRUPTION_STATES = new Set(['none', 'active', 'recovering'])
const INTERRUPTION_CATEGORIES = new Set([
  'none', 'network-unavailable', 'device-power', 'application-restart',
  'audio-unavailable', 'input-unavailable', 'unknown-technical',
])

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  const candidate = record(value)
  if (!candidate) return null
  const actual = Object.keys(candidate)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
    ? candidate
    : null
}

function safeRef(value: unknown): value is string {
  return typeof value === 'string' && SAFE_REF.test(value)
}

function safeInteger(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum
}

function isoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
}

function uniqueSafeRefs(value: unknown, maximum: number): value is string[] {
  return Array.isArray(value) && value.length <= maximum &&
    value.every(safeRef) && new Set(value).size === value.length
}

function stringMembers<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  maximum: number,
  allowEmpty = false,
): value is T[] {
  return Array.isArray(value) && value.length <= maximum &&
    (allowEmpty || value.length > 0) && value.every((item) => allowed.has(item)) &&
    new Set(value).size === value.length
}

function parseBinding(value: unknown): StudyProductionCurriculumBinding | null {
  const candidate = exact(value, [
    'schemaVersion', 'status', 'releaseId', 'packageId', 'releaseVersion',
    'curriculumManifestSha256',
  ])
  if (!candidate || candidate.schemaVersion !== 1 || candidate.status !== 'bound' ||
      typeof candidate.releaseId !== 'string' || !UUID.test(candidate.releaseId) ||
      !safeRef(candidate.packageId) || typeof candidate.releaseVersion !== 'string' ||
      !RELEASE_VERSION.test(candidate.releaseVersion) ||
      typeof candidate.curriculumManifestSha256 !== 'string' ||
      !SHA256.test(candidate.curriculumManifestSha256)) return null
  return Object.freeze({
    schemaVersion: 1,
    status: 'bound',
    releaseId: candidate.releaseId,
    packageId: candidate.packageId,
    releaseVersion: candidate.releaseVersion,
    curriculumManifestSha256: candidate.curriculumManifestSha256,
  })
}

function parseSettings(value: unknown): StudyProductionEffectiveSettings | null {
  const candidate = exact(value, [
    'timerMode', 'maximumWorkMinutes', 'breakMinimumMinutes',
    'breakMaximumMinutes', 'minimumBreakCount', 'requiredBreakIntervalMinutes',
    'reducedMotion', 'noAudio', 'largeText', 'readAloud', 'speechInputAllowed',
  ])
  if (!candidate || !TIMER_MODES.has(candidate.timerMode as StudyProductionEffectiveSettings['timerMode'])) {
    return null
  }
  const numberKeys = [
    'maximumWorkMinutes', 'breakMinimumMinutes', 'breakMaximumMinutes',
    'minimumBreakCount', 'requiredBreakIntervalMinutes',
  ] as const
  const booleanKeys = [
    'reducedMotion', 'noAudio', 'largeText', 'readAloud', 'speechInputAllowed',
  ] as const
  if (numberKeys.some((key) => !safeInteger(candidate[key]) || (candidate[key] as number) > 1_440) ||
      booleanKeys.some((key) => typeof candidate[key] !== 'boolean') ||
      (candidate.breakMinimumMinutes as number) > (candidate.breakMaximumMinutes as number)) return null
  return Object.freeze({
    timerMode: candidate.timerMode as StudyProductionEffectiveSettings['timerMode'],
    maximumWorkMinutes: candidate.maximumWorkMinutes as number,
    breakMinimumMinutes: candidate.breakMinimumMinutes as number,
    breakMaximumMinutes: candidate.breakMaximumMinutes as number,
    minimumBreakCount: candidate.minimumBreakCount as number,
    requiredBreakIntervalMinutes: candidate.requiredBreakIntervalMinutes as number,
    reducedMotion: candidate.reducedMotion as boolean,
    noAudio: candidate.noAudio as boolean,
    largeText: candidate.largeText as boolean,
    readAloud: candidate.readAloud as boolean,
    speechInputAllowed: candidate.speechInputAllowed as boolean,
  })
}

function parseCheckpoint(value: unknown): StudyCheckpointRecord | null {
  const candidate = exact(value, [
    'contract', 'contractVersion', 'checkpointId', 'revision', 'createdAt',
    'updatedAt', 'sessionId', 'lessonId', 'segmentId', 'safeInstructionalCursor',
    'completedSegmentIds', 'perSegmentActiveTime', 'pausedSeconds', 'breakSeconds',
    'protectedDraftRef', 'protectedTutorStateRef', 'lastAcceptedEventId',
    'eventVersion', 'tutorInteractionRef', 'technicalInterruption',
    'rawAnswerIncluded', 'transcriptIncluded',
  ])
  if (!candidate || candidate.contract !== 'study-core-bridge.recovery-checkpoint.v1' ||
      candidate.contractVersion !== 1 || candidate.eventVersion !== 1 ||
      candidate.rawAnswerIncluded !== false || candidate.transcriptIncluded !== false ||
      !safeRef(candidate.checkpointId) || !safeInteger(candidate.revision, 1) ||
      !isoTimestamp(candidate.createdAt) || !isoTimestamp(candidate.updatedAt) ||
      Date.parse(candidate.updatedAt) < Date.parse(candidate.createdAt) ||
      !safeRef(candidate.sessionId) || !safeRef(candidate.lessonId) ||
      !safeRef(candidate.segmentId) || !uniqueSafeRefs(candidate.completedSegmentIds, 512) ||
      !safeInteger(candidate.pausedSeconds) || !safeInteger(candidate.breakSeconds) ||
      (candidate.protectedDraftRef !== null &&
        (typeof candidate.protectedDraftRef !== 'string' || !DRAFT_REF.test(candidate.protectedDraftRef))) ||
      typeof candidate.protectedTutorStateRef !== 'string' ||
      !TUTOR_STATE_REF.test(candidate.protectedTutorStateRef) ||
      (candidate.lastAcceptedEventId !== null && !safeRef(candidate.lastAcceptedEventId)) ||
      !safeRef(candidate.tutorInteractionRef)) return null

  const cursor = exact(candidate.safeInstructionalCursor, [
    'tutorPhase', 'cycleNumber', 'currentItemId', 'currentItemIndex', 'teachingTurnIndex',
  ])
  if (!cursor || !TUTOR_PHASES.has(cursor.tutorPhase as string) ||
      !safeInteger(cursor.cycleNumber) || !safeInteger(cursor.currentItemIndex) ||
      !safeInteger(cursor.teachingTurnIndex) ||
      (cursor.currentItemId !== null && !safeRef(cursor.currentItemId))) return null

  if (!Array.isArray(candidate.perSegmentActiveTime) || candidate.perSegmentActiveTime.length > 512) return null
  const segmentTimes: Array<{ readonly segmentId: string; readonly activeSeconds: number }> = []
  const segmentIds = new Set<string>()
  for (const entry of candidate.perSegmentActiveTime) {
    const item = exact(entry, ['segmentId', 'activeSeconds'])
    if (!item || !safeRef(item.segmentId) || !safeInteger(item.activeSeconds) || segmentIds.has(item.segmentId)) {
      return null
    }
    segmentIds.add(item.segmentId)
    segmentTimes.push(Object.freeze({ segmentId: item.segmentId, activeSeconds: item.activeSeconds }))
  }

  const interruption = exact(candidate.technicalInterruption, [
    'status', 'interruptionId', 'category', 'startedAt',
  ])
  if (!interruption || !INTERRUPTION_STATES.has(interruption.status as string) ||
      !INTERRUPTION_CATEGORIES.has(interruption.category as string)) return null
  const noInterruption = interruption.status === 'none' && interruption.category === 'none' &&
    interruption.interruptionId === null && interruption.startedAt === null
  const activeInterruption = ['active', 'recovering'].includes(interruption.status as string) &&
    interruption.category !== 'none' && safeRef(interruption.interruptionId) &&
    isoTimestamp(interruption.startedAt)
  if (!noInterruption && !activeInterruption) return null

  if (JSON.stringify(candidate).length > 32_768) return null
  return Object.freeze({
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: candidate.checkpointId,
    revision: candidate.revision,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
    sessionId: candidate.sessionId,
    lessonId: candidate.lessonId,
    segmentId: candidate.segmentId,
    safeInstructionalCursor: Object.freeze({
      tutorPhase: cursor.tutorPhase as string,
      cycleNumber: cursor.cycleNumber as number,
      currentItemId: cursor.currentItemId as string | null,
      currentItemIndex: cursor.currentItemIndex as number,
      teachingTurnIndex: cursor.teachingTurnIndex as number,
    }),
    completedSegmentIds: Object.freeze([...(candidate.completedSegmentIds as string[])]) as unknown as string[],
    perSegmentActiveTime: Object.freeze(segmentTimes) as unknown as Array<{
      segmentId: string
      activeSeconds: number
    }>,
    pausedSeconds: candidate.pausedSeconds,
    breakSeconds: candidate.breakSeconds,
    protectedDraftRef: candidate.protectedDraftRef as string | null,
    protectedTutorStateRef: candidate.protectedTutorStateRef,
    lastAcceptedEventId: candidate.lastAcceptedEventId as string | null,
    eventVersion: 1,
    tutorInteractionRef: candidate.tutorInteractionRef,
    technicalInterruption: Object.freeze({
      status: interruption.status as 'none' | 'active' | 'recovering',
      interruptionId: interruption.interruptionId as string | null,
      category: interruption.category as string,
      startedAt: interruption.startedAt as string | null,
    }),
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
}

function parseUnavailable(value: unknown): StudyProductionUnavailableResponse | null {
  const binding = exact(value, ['schemaVersion', 'status', 'reasonCode'])
  if (binding?.schemaVersion === 1 &&
      (binding.status === 'unavailable' || binding.status === 'manual-review') &&
      BINDING_REASONS.has(binding.reasonCode as StudyProductionBindingReason)) {
    return Object.freeze({
      schemaVersion: 1,
      status: binding.status,
      reasonCode: binding.reasonCode as StudyProductionBindingReason,
    })
  }
  if (binding?.schemaVersion === 2 && binding.status === 'unavailable' &&
      SETTINGS_UNAVAILABLE_REASONS.has(binding.reasonCode as StudyProductionSettingsUnavailableReason)) {
    return Object.freeze({
      schemaVersion: 2,
      status: 'unavailable',
      reasonCode: binding.reasonCode as StudyProductionSettingsUnavailableReason,
    })
  }
  const manual = exact(value, ['schemaVersion', 'status', 'reasonCodes', 'sourceCategories'])
  if (manual?.schemaVersion === 2 && manual.status === 'manual_review' &&
      stringMembers(manual.reasonCodes, MANUAL_REASONS, 6) &&
      stringMembers(manual.sourceCategories, SETTINGS_SOURCES, 4, true)) {
    return Object.freeze({
      schemaVersion: 2,
      status: 'manual_review',
      reasonCodes: Object.freeze([...manual.reasonCodes]),
      sourceCategories: Object.freeze([...manual.sourceCategories]),
    })
  }
  return null
}

function parseCollision(value: unknown): StudyProductionIdempotencyCollision | null {
  const candidate = exact(value, ['schemaVersion', 'status'])
  return candidate?.schemaVersion === 2 && candidate.status === 'idempotency-collision'
    ? Object.freeze({ schemaVersion: 2, status: 'idempotency-collision' })
    : null
}

function parseSession(
  value: unknown,
  statuses: readonly StudyProductionSessionProjection['status'][],
): StudyProductionSessionProjection | null {
  const candidate = exact(value, [
    'schemaVersion', 'status', 'sessionId', 'state', 'revision', 'acceptedAt',
    'updatedAt', 'lessonId', 'subjectId', 'studyPlanId', 'intendedLocalDate',
    'currentSegmentId', 'completedAt', 'lastTransition', 'curriculumBinding',
    'effectiveSettings',
  ])
  if (!candidate || candidate.schemaVersion !== 2 ||
      !statuses.includes(candidate.status as StudyProductionSessionProjection['status']) ||
      !safeRef(candidate.sessionId) || !SESSION_STATES.has(candidate.state as StudyProductionSessionState) ||
      !safeInteger(candidate.revision, 1) || !isoTimestamp(candidate.acceptedAt) ||
      !isoTimestamp(candidate.updatedAt) || Date.parse(candidate.updatedAt) < Date.parse(candidate.acceptedAt) ||
      !safeRef(candidate.lessonId) || !safeRef(candidate.subjectId) ||
      (candidate.studyPlanId !== null && !safeRef(candidate.studyPlanId)) ||
      typeof candidate.intendedLocalDate !== 'string' || !ISO_DATE.test(candidate.intendedLocalDate) ||
      (candidate.currentSegmentId !== null && !safeRef(candidate.currentSegmentId)) ||
      (candidate.completedAt !== null && !isoTimestamp(candidate.completedAt))) return null
  if ((candidate.status === 'closed') !==
      (candidate.state === 'completed' || candidate.state === 'abandoned')) return null
  if (candidate.state === 'completed' && candidate.completedAt === null) return null
  if (candidate.state !== 'completed' && candidate.completedAt !== null) return null

  const lastTransition = exact(candidate.lastTransition, ['type', 'acceptedAt'])
  const binding = parseBinding(candidate.curriculumBinding)
  const settings = parseSettings(candidate.effectiveSettings)
  if (!lastTransition || !LAST_TRANSITIONS.has(lastTransition.type as StudyProductionLastTransitionType) ||
      !isoTimestamp(lastTransition.acceptedAt) || !binding || !settings) return null
  return Object.freeze({
    schemaVersion: 2,
    status: candidate.status as StudyProductionSessionProjection['status'],
    sessionId: candidate.sessionId,
    state: candidate.state as StudyProductionSessionState,
    revision: candidate.revision,
    acceptedAt: candidate.acceptedAt,
    updatedAt: candidate.updatedAt,
    lessonId: candidate.lessonId,
    subjectId: candidate.subjectId,
    studyPlanId: candidate.studyPlanId as string | null,
    intendedLocalDate: candidate.intendedLocalDate,
    currentSegmentId: candidate.currentSegmentId as string | null,
    completedAt: candidate.completedAt as string | null,
    lastTransition: Object.freeze({
      type: lastTransition.type as StudyProductionLastTransitionType,
      acceptedAt: lastTransition.acceptedAt,
    }),
    curriculumBinding: binding,
    effectiveSettings: settings,
  })
}

function parseRevisionConflict(value: unknown): StudyProductionRevisionConflict | null {
  const candidate = exact(value, ['schemaVersion', 'status', 'currentRevision', 'currentState'])
  if (!candidate || candidate.schemaVersion !== 2 || candidate.status !== 'revision-conflict' ||
      !safeInteger(candidate.currentRevision, 1) ||
      !SESSION_STATES.has(candidate.currentState as StudyProductionSessionState)) return null
  return Object.freeze({
    schemaVersion: 2,
    status: 'revision-conflict',
    currentRevision: candidate.currentRevision,
    currentState: candidate.currentState as StudyProductionSessionState,
  })
}

function parseInvalidTransition(value: unknown): StudyProductionInvalidTransition | null {
  const candidate = exact(value, [
    'schemaVersion', 'status', 'currentRevision', 'currentState', 'transitionType',
  ])
  const transition = candidate?.transitionType
  if (!candidate || candidate.schemaVersion !== 2 || candidate.status !== 'invalid-transition' ||
      !safeInteger(candidate.currentRevision, 1) ||
      !SESSION_STATES.has(candidate.currentState as StudyProductionSessionState) ||
      (transition !== 'checkpoint' && !TRANSITIONS.has(transition as StudyProductionTransitionType))) return null
  return Object.freeze({
    schemaVersion: 2,
    status: 'invalid-transition',
    currentRevision: candidate.currentRevision,
    currentState: candidate.currentState as StudyProductionSessionState,
    transitionType: transition as StudyProductionTransitionType | 'checkpoint',
  })
}

export function parseStudyProductionBeginResponse(value: unknown): StudyProductionBeginResponse | null {
  return parseSession(value, ['begun']) as StudyProductionBeginResponse | null ??
    parseUnavailable(value) ?? parseCollision(value)
}

export function parseStudyProductionResumeResponse(value: unknown): StudyProductionResumeResponse | null {
  const candidate = record(value)
  if (candidate && Object.hasOwn(candidate, 'checkpoint')) {
    const { checkpoint: rawCheckpoint, ...withoutCheckpoint } = candidate
    const session = parseSession(withoutCheckpoint, ['resumable', 'closed'])
    const checkpoint = parseCheckpoint(rawCheckpoint)
    if (session && (rawCheckpoint === null || checkpoint)) {
      return Object.freeze({ ...session, checkpoint }) as StudyProductionResumeProjection
    }
  }
  return parseUnavailable(value)
}

export function parseStudyProductionTransitionResponse(value: unknown): StudyProductionTransitionResponse | null {
  return parseSession(value, ['stored']) as StudyProductionTransitionResponse | null ??
    parseUnavailable(value) ?? parseCollision(value) ??
    parseRevisionConflict(value) ?? parseInvalidTransition(value)
}

export function parseStudyProductionCheckpointReadResponse(
  value: unknown,
): StudyProductionCheckpointReadResponse | null {
  const unavailable = parseUnavailable(value)
  if (unavailable) return unavailable
  const candidate = exact(value, [
    'schemaVersion', 'status', 'sessionRevision', 'currentState',
    'curriculumBinding', 'checkpoint',
  ])
  if (!candidate || candidate.schemaVersion !== 2 ||
      !['found', 'not-found', 'integrity-failed'].includes(candidate.status as string) ||
      !safeInteger(candidate.sessionRevision, 1) ||
      !SESSION_STATES.has(candidate.currentState as StudyProductionSessionState)) return null
  const binding = parseBinding(candidate.curriculumBinding)
  const checkpoint = parseCheckpoint(candidate.checkpoint)
  if (!binding || (candidate.status === 'found' ? !checkpoint : candidate.checkpoint !== null)) return null
  return Object.freeze({
    schemaVersion: 2,
    status: candidate.status as StudyProductionCheckpointRead['status'],
    sessionRevision: candidate.sessionRevision,
    currentState: candidate.currentState as StudyProductionSessionState,
    curriculumBinding: binding,
    checkpoint,
  })
}

export function parseStudyProductionCheckpointResponse(
  value: unknown,
): StudyProductionCheckpointResponse | null {
  const unavailable = parseUnavailable(value)
  if (unavailable) return unavailable
  const collision = parseCollision(value)
  if (collision) return collision
  const invalidTransition = parseInvalidTransition(value)
  if (invalidTransition) return invalidTransition

  const stored = exact(value, [
    'schemaVersion', 'status', 'checkpointRevision', 'sessionRevision',
    'currentState', 'curriculumBinding',
  ])
  if (stored?.schemaVersion === 2 && stored.status === 'stored' &&
      safeInteger(stored.checkpointRevision, 1) && safeInteger(stored.sessionRevision, 1) &&
      SESSION_STATES.has(stored.currentState as StudyProductionSessionState)) {
    const binding = parseBinding(stored.curriculumBinding)
    if (binding) return Object.freeze({
      schemaVersion: 2,
      status: 'stored',
      checkpointRevision: stored.checkpointRevision,
      sessionRevision: stored.sessionRevision,
      currentState: stored.currentState as StudyProductionSessionState,
      curriculumBinding: binding,
    })
  }

  const conflict = exact(value, [
    'schemaVersion', 'status', 'currentCheckpointRevision', 'sessionRevision', 'currentState',
  ])
  if (conflict?.schemaVersion === 2 && conflict.status === 'revision-conflict' &&
      safeInteger(conflict.currentCheckpointRevision) && safeInteger(conflict.sessionRevision, 1) &&
      SESSION_STATES.has(conflict.currentState as StudyProductionSessionState)) {
    return Object.freeze({
      schemaVersion: 2,
      status: 'revision-conflict',
      currentCheckpointRevision: conflict.currentCheckpointRevision,
      sessionRevision: conflict.sessionRevision,
      currentState: conflict.currentState as StudyProductionSessionState,
    })
  }

  const invalid = exact(value, ['schemaVersion', 'status', 'reasonCode'])
  if (invalid?.schemaVersion === 2 && invalid.status === 'invalid-checkpoint' &&
      ['malformed-event', 'stale-checkpoint', 'idempotency-collision'].includes(invalid.reasonCode as string)) {
    return Object.freeze({
      schemaVersion: 2,
      status: 'invalid-checkpoint',
      reasonCode: invalid.reasonCode as StudyProductionInvalidCheckpoint['reasonCode'],
    })
  }
  return null
}

export function parseStudyCheckpointDraft(value: unknown): StudyCheckpointRecord | null {
  return parseCheckpoint(value)
}

export function isStudyProductionSafeRef(value: unknown): value is string {
  return safeRef(value)
}

export function isStudyProductionReleaseVersion(value: unknown): value is string {
  return typeof value === 'string' && RELEASE_VERSION.test(value)
}

export function isStudyProductionLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}
