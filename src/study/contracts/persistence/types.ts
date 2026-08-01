export type StudyId = string
export type Uuid = string

export interface StudySessionRecord {
  id: StudyId
  schemaVersion: 1
  studentId: Uuid
  lessonId: StudyId
  subjectId: StudyId
  studyPlanId: StudyId | null
  state:
    | 'planned'
    | 'active'
    | 'paused'
    | 'approved_break'
    | 'student_requested_break'
    | 'technical_interruption'
    | 'completed'
    | 'abandoned'
  startedAt: string | null
  completedAt: string | null
  intendedLocalDate: string
  revision?: number
}

export interface StudyCheckpointRecord {
  contract: 'study-core-bridge.recovery-checkpoint.v1'
  contractVersion: 1
  checkpointId: StudyId
  revision: number
  createdAt: string
  updatedAt: string
  sessionId: StudyId
  lessonId: StudyId
  segmentId: StudyId
  safeInstructionalCursor: {
    tutorPhase: string
    cycleNumber: number
    currentItemId: StudyId | null
    currentItemIndex: number
    teachingTurnIndex: number
  }
  completedSegmentIds: StudyId[]
  perSegmentActiveTime: Array<{ segmentId: StudyId; activeSeconds: number }>
  pausedSeconds: number
  breakSeconds: number
  protectedDraftRef: string | null
  protectedTutorStateRef: string
  lastAcceptedEventId: StudyId | null
  eventVersion: 1
  tutorInteractionRef: StudyId
  technicalInterruption: {
    status: 'none' | 'active' | 'recovering'
    interruptionId: StudyId | null
    category: string
    startedAt: string | null
  }
  rawAnswerIncluded: false
  transcriptIncluded: false
}

export interface StudyReviewRecord {
  id: StudyId
  studentId: Uuid
  skillId: StudyId
  sourceSessionId: StudyId | null
  reviewKind: 'spaced' | 'reteach' | 'prerequisite' | 'manual'
  dueAt: string
  intendedLocalDate: string
  priority: number
  state: 'scheduled' | 'available' | 'in_progress' | 'completed' | 'cancelled'
  attemptCount: number
  intervalDays: number
  reteachingRequired: boolean
  prerequisiteRemediationRequired: boolean
}

export interface StudyCalendarBlockRecord {
  id: StudyId
  studentId: Uuid
  blockType: 'lesson' | 'review' | 'resume' | 'break' | 'assessment'
  sourceReference: StudyId
  scheduledStart: string
  intendedLocalDate: string
  explicitOffset: number
  durationMinutes: number
  completionUnits: number
  requiredUnits: number
  resumeSessionId: StudyId | null
  resumeSegmentId: StudyId | null
  state: 'scheduled' | 'available' | 'in_progress' | 'completed' | 'cancelled'
}

export interface StudyParentSettingsRecord {
  studentId: Uuid
  timerMode: 'visible' | 'hidden' | 'count_up' | 'count_down'
  maximumWorkMinutes: number
  breakMinimumMinutes: number
  breakMaximumMinutes: number
  requiredBreaks: number
  reducedMotion: boolean
  noAudio: boolean
  largeText: boolean
  readAloud: boolean
  speechInputAllowed: boolean
  parentOverride: boolean
}

export interface EncryptedEnvelope {
  kmsKeyReference: StudyId
  wrappedDataKeyBase64: string
  nonceBase64: string
  authenticationTagBase64: string
  keyedIntegrityTagBase64: string
}

export interface ProtectedWorkWrite extends EncryptedEnvelope {
  id: StudyId
  revision: number
  sessionId: StudyId
  checkpointId: StudyId | null
  encryptedPayloadBase64: string
  expiresAt: string
}

export interface AdultNoteWrite extends EncryptedEnvelope {
  noteId: StudyId
  studentId: Uuid
  expectedRevision: number
  category: 'instructional' | 'accommodation' | 'follow_up' | 'administrative'
  encryptedBodyBase64: string
  expiresAt: string
}

export type StoredResult =
  | { status: 'stored'; revision: number }
  | { status: 'revision-conflict'; currentRevision: number }
  | { status: 'idempotency-collision' }

export type EventAppendResult =
  | { status: 'appended' }
  | { status: 'duplicate-ignored' }
  | { status: 'idempotency-collision' }
