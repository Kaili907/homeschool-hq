import type {
  AnswerWithheldSafetyEvent,
  ConversationSessionMetadata,
  DataDeletionRequest,
  DataExportRequest,
  EmergencyLanguageSafetyEvent,
  HumanReviewItem,
  InstructionalHistoryRecord,
  ParentNotification,
  RetentionPolicy,
  SafetyAuditEvent,
  SafetyCenterStore,
  SafetyPrincipal,
  StudentReport,
  StudentTutorBlock,
  TutorPermissions,
} from './contracts.ts'
import { AI_SAFETY_SCHEMA_VERSION } from './contracts.ts'

export const FIXTURE_NOW = '2026-07-28T15:00:00.000Z'
export const STUDENT_A_ID = 'student-a'
export const STUDENT_B_ID = 'student-b'

export const studentAPrincipalFixture: SafetyPrincipal = {
  authenticated: true,
  actorId: 'student-actor-a',
  role: 'student',
  studentId: STUDENT_A_ID,
  authorizedStudentIds: [],
  permissions: ['history:read', 'safety-events:read', 'data:export'],
}

export const studentBPrincipalFixture: SafetyPrincipal = {
  authenticated: true,
  actorId: 'student-actor-b',
  role: 'student',
  studentId: STUDENT_B_ID,
  authorizedStudentIds: [],
  permissions: ['history:read', 'safety-events:read', 'data:export'],
}

export const parentAPrincipalFixture: SafetyPrincipal = {
  authenticated: true,
  actorId: 'parent-actor-a',
  role: 'parent',
  authorizedStudentIds: [STUDENT_A_ID],
  permissions: [
    'history:read',
    'safety-events:read',
    'permissions:manage',
    'reviews:read',
    'data:export',
    'data:delete',
    'notifications:acknowledge',
  ],
}

export const parentBothPrincipalFixture: SafetyPrincipal = {
  ...parentAPrincipalFixture,
  actorId: 'parent-actor-both',
  authorizedStudentIds: [STUDENT_A_ID, STUDENT_B_ID],
}

export const reviewerPrincipalFixture: SafetyPrincipal = {
  authenticated: true,
  actorId: 'reviewer-actor-1',
  role: 'reviewer',
  authorizedStudentIds: [STUDENT_A_ID],
  permissions: ['safety-events:read', 'reviews:read', 'reviews:resolve'],
}

export const studentASessionFixture: ConversationSessionMetadata = {
  kind: 'conversation-session',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-27T14:00:00.000Z',
  sessionId: 'session-a-math-1',
  studentId: STUDENT_A_ID,
  subject: { subjectId: 'math', displayName: 'Math' },
  ageBand: '8-12',
  channel: 'voice',
  startedAt: '2026-07-27T14:00:00.000Z',
  endedAt: '2026-07-27T14:15:00.000Z',
  status: 'completed',
  timeZone: 'America/New_York',
  policyVersion: 'manuel-ai-safety-1.0',
  transcriptMode: 'text-only',
  rawMicrophoneRecordingStored: false,
  parentReviewScope: 'authorized-parent-and-student',
  safetyExceptionApplies: true,
}

export const studentBSessionFixture: ConversationSessionMetadata = {
  kind: 'conversation-session',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-26T16:00:00.000Z',
  sessionId: 'session-b-science-1',
  studentId: STUDENT_B_ID,
  subject: { subjectId: 'science', displayName: 'Science' },
  ageBand: '13-17',
  channel: 'text',
  startedAt: '2026-07-26T16:00:00.000Z',
  endedAt: '2026-07-26T16:20:00.000Z',
  status: 'completed',
  timeZone: 'America/New_York',
  policyVersion: 'manuel-ai-safety-1.0',
  transcriptMode: 'text-only',
  rawMicrophoneRecordingStored: false,
  parentReviewScope: 'authorized-parent-and-student',
  safetyExceptionApplies: true,
}

export const studentAHistoryFixture: InstructionalHistoryRecord = {
  kind: 'instructional-history',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-27T14:15:00.000Z',
  historyId: 'history-a-math-1',
  sessionId: studentASessionFixture.sessionId,
  studentId: STUDENT_A_ID,
  subject: studentASessionFixture.subject,
  startedAt: studentASessionFixture.startedAt,
  endedAt: '2026-07-27T14:15:00.000Z',
  parentVisibleSummary: 'Practiced equivalent fractions with guided hints.',
  searchableKeywords: ['fractions', 'equivalent', 'math'],
  timeline: [
    {
      type: 'message',
      entryId: 'entry-a-1',
      at: '2026-07-27T14:01:00.000Z',
      sequence: 1,
      speaker: 'student',
      text: 'Can I have a hint for equivalent fractions?',
    },
    {
      type: 'tutor-help',
      entryId: 'entry-a-2',
      at: '2026-07-27T14:01:05.000Z',
      sequence: 2,
      helpKind: 'hint',
      displayText: 'Try multiplying the numerator and denominator by the same number.',
      playback: {
        mode: 'text-to-speech-on-demand',
        rawAudioStored: false,
      },
    },
    {
      type: 'answer-withheld',
      entryId: 'entry-a-3',
      at: '2026-07-27T14:02:00.000Z',
      sequence: 3,
      reason: 'direct-answer-request',
      explanation:
        'I can’t provide the final answer, but I can help you work through the next small step.',
      safetyEventId: 'event-a-withheld-1',
    },
  ],
  rawMicrophoneRecordingStored: false,
  retentionClass: 'instructional',
}

export const studentBHistoryFixture: InstructionalHistoryRecord = {
  kind: 'instructional-history',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-26T16:20:00.000Z',
  historyId: 'history-b-science-1',
  sessionId: studentBSessionFixture.sessionId,
  studentId: STUDENT_B_ID,
  subject: studentBSessionFixture.subject,
  startedAt: studentBSessionFixture.startedAt,
  endedAt: '2026-07-26T16:20:00.000Z',
  parentVisibleSummary: 'Reviewed how cells use energy.',
  searchableKeywords: ['cells', 'energy', 'science'],
  timeline: [
    {
      type: 'message',
      entryId: 'entry-b-1',
      at: '2026-07-26T16:01:00.000Z',
      sequence: 1,
      speaker: 'student',
      text: 'What does a mitochondrion do?',
    },
    {
      type: 'tutor-help',
      entryId: 'entry-b-2',
      at: '2026-07-26T16:01:05.000Z',
      sequence: 2,
      helpKind: 'question',
      displayText: 'Which cell process releases usable energy from food?',
      playback: { mode: 'text-only', rawAudioStored: false },
    },
  ],
  rawMicrophoneRecordingStored: false,
  retentionClass: 'instructional',
}

export const answerWithheldEventFixture: AnswerWithheldSafetyEvent = {
  kind: 'answer-withheld-event',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-27T14:02:00.000Z',
  eventId: 'event-a-withheld-1',
  sessionId: studentASessionFixture.sessionId,
  studentId: STUDENT_A_ID,
  subjectId: 'math',
  occurredAt: '2026-07-27T14:02:00.000Z',
  classification: 'answer-integrity',
  severity: 'info',
  escalation: 'record-for-parent',
  summary: 'The tutor declined a request for the final answer and offered guided help.',
  evidenceRefs: ['entry-a-3'],
  detector: 'local-policy',
  parentVisible: true,
  rawMicrophoneRecordingStored: false,
  withheldReason: 'direct-answer-request',
  studentExplanation:
    'I can’t provide the final answer, but I can help you work through the next small step.',
  canContinueLearning: true,
}

export const emergencyEventFixture: EmergencyLanguageSafetyEvent = {
  kind: 'emergency-language-event',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-28T14:30:00.000Z',
  eventId: 'event-a-emergency-1',
  sessionId: studentASessionFixture.sessionId,
  studentId: STUDENT_A_ID,
  subjectId: 'math',
  occurredAt: '2026-07-28T14:30:00.000Z',
  classification: 'potential-immediate-danger',
  severity: 'critical',
  escalation: 'human-safety-review',
  summary:
    'The local policy detected possible urgent safety language. The tutor paused without making a diagnosis or contacting an external service.',
  evidenceRefs: ['entry-a-safety-1'],
  detector: 'local-policy',
  parentVisible: true,
  rawMicrophoneRecordingStored: false,
  sessionAction: 'pause-and-seek-trusted-adult',
  responseProtocol: 'trusted-adult-now-and-authorized-human-review',
  hotlineInformationProvided: false,
  emergencyServicesContacted: false,
}

export const parentNotificationFixture: ParentNotification = {
  kind: 'parent-notification',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-28T14:30:01.000Z',
  notificationId: 'notification-a-1',
  eventId: emergencyEventFixture.eventId,
  studentId: STUDENT_A_ID,
  recipientActorId: parentAPrincipalFixture.actorId,
  channel: 'in-app',
  urgency: 'urgent',
  title: 'Tutor safety review needed',
  summary: emergencyEventFixture.summary,
  includedData: ['session-metadata', 'safe-event-summary', 'timeline-reference'],
  includesRawTranscript: false,
  status: 'pending',
}

export const studentReportFixture: StudentReport = {
  kind: 'student-report',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-27T14:10:00.000Z',
  reportId: 'report-a-1',
  studentId: STUDENT_A_ID,
  sessionId: studentASessionFixture.sessionId,
  createdByStudentId: STUDENT_A_ID,
  category: 'incorrect',
  targetEntryId: 'entry-a-2',
  status: 'submitted',
}

export const studentBlockFixture: StudentTutorBlock = {
  kind: 'student-tutor-block',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-28T14:35:00.000Z',
  blockId: 'block-a-1',
  studentId: STUDENT_A_ID,
  createdByStudentId: STUDENT_A_ID,
  sessionId: studentASessionFixture.sessionId,
  subjectId: 'math',
  scope: 'subject',
  reason: 'felt-unsafe',
  active: true,
}

export const tutorPermissionsFixture: TutorPermissions = {
  kind: 'tutor-permissions',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-01T12:00:00.000Z',
  permissionsId: 'permissions-a-1',
  studentId: STUDENT_A_ID,
  enabled: true,
  allowedSubjectIds: ['math', 'reading'],
  allowedSessionWindows: [
    {
      windowId: 'weekday-window-a',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      startLocalTime: '08:00',
      endLocalTime: '18:00',
      timeZone: 'America/New_York',
    },
  ],
  dailySessionLimit: 4,
  maximumSessionMinutes: 30,
  capabilities: {
    textTutoring: true,
    voiceInput: true,
    readAloud: true,
    externalLinks: false,
    fileUpload: false,
  },
  parentReviewMode: 'always-available-to-authorized-parent',
  studentPrivacyNotice: 'parent-review-with-safety-exceptions',
  voiceDataMode: 'transcript-only-no-raw-audio',
  updatedBy: { role: 'parent', actorId: parentAPrincipalFixture.actorId },
  updatedAt: '2026-07-01T12:00:00.000Z',
}

export const retentionPolicyFixture: RetentionPolicy = {
  kind: 'retention-policy',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-01T12:00:00.000Z',
  policyId: 'retention-a-1',
  studentId: STUDENT_A_ID,
  instructionalHistoryDays: 60,
  safetyEventDays: 180,
  auditHistoryDays: 365,
  preserveOpenHumanReviews: true,
  rawMicrophoneRecordingRetentionDays: 0,
  updatedBy: { role: 'parent', actorId: parentAPrincipalFixture.actorId },
  updatedAt: '2026-07-01T12:00:00.000Z',
}

export const exportRequestFixture: DataExportRequest = {
  kind: 'data-export-request',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: FIXTURE_NOW,
  requestId: 'export-a-1',
  studentId: STUDENT_A_ID,
  requestedBy: { role: 'parent', actorId: parentAPrincipalFixture.actorId },
  requestedAt: FIXTURE_NOW,
  scope: 'all-safety-center-data',
  format: 'json',
  status: 'requested',
}

export const deletionRequestFixture: DataDeletionRequest = {
  kind: 'data-deletion-request',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: FIXTURE_NOW,
  requestId: 'deletion-a-1',
  studentId: STUDENT_A_ID,
  requestedBy: { role: 'student', actorId: studentAPrincipalFixture.actorId },
  requestedAt: FIXTURE_NOW,
  scope: 'all-eligible-data',
  status: 'awaiting-parent-confirmation',
}

export const humanReviewFixture: HumanReviewItem = {
  kind: 'human-review-item',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-28T14:30:01.000Z',
  reviewId: 'review-a-1',
  eventId: emergencyEventFixture.eventId,
  sessionId: emergencyEventFixture.sessionId,
  studentId: STUDENT_A_ID,
  priority: 'urgent',
  status: 'queued',
  queuedAt: '2026-07-28T14:30:01.000Z',
  history: [
    {
      actionId: 'review-action-a-1',
      at: '2026-07-28T14:30:01.000Z',
      actor: { role: 'system', actorId: 'safety-system' },
      action: 'queued',
      reasonCode: 'potential-immediate-danger',
    },
  ],
  resolution: 'pending',
}

export const auditFixture: SafetyAuditEvent = {
  kind: 'safety-audit-event',
  schemaVersion: AI_SAFETY_SCHEMA_VERSION,
  createdAt: '2026-07-28T14:30:01.000Z',
  auditId: 'audit-a-1',
  studentId: STUDENT_A_ID,
  at: '2026-07-28T14:30:01.000Z',
  actor: { actorId: 'safety-system', role: 'system' },
  action: 'review-queued',
  targetType: 'review',
  targetId: humanReviewFixture.reviewId,
  outcome: 'completed',
  reasonCode: 'critical-policy-event',
}

export const safetyCenterStoreFixture: SafetyCenterStore = {
  historyAvailability: 'available',
  sessions: [studentASessionFixture, studentBSessionFixture],
  instructionalHistory: [studentAHistoryFixture, studentBHistoryFixture],
  safetyEvents: [answerWithheldEventFixture, emergencyEventFixture],
  notifications: [parentNotificationFixture],
  reports: [studentReportFixture],
  blocks: [studentBlockFixture],
  auditEvents: [auditFixture],
  reviewItems: [humanReviewFixture],
  exportRequests: [exportRequestFixture],
  deletionRequests: [deletionRequestFixture],
}

export const validContractFixtures = {
  conversationSession: studentASessionFixture,
  safetyEvents: [answerWithheldEventFixture, emergencyEventFixture],
  parentNotification: parentNotificationFixture,
  tutorPermissions: tutorPermissionsFixture,
  retentionPolicy: retentionPolicyFixture,
  dataRequests: [exportRequestFixture, deletionRequestFixture],
} as const
