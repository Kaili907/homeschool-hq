export const STUDY_SAFETY_SCHEMA_VERSION = 1 as const

export type SafetyClassification = 'urgent' | 'uncertain' | 'clear' | 'invalid'
export type SafetyCategory =
  | 'self-harm-or-immediate-danger'
  | 'abuse-or-neglect-disclosure'

export type SafetyReasonCode = string

export interface StudySafetyClassificationRequestV1 {
  readonly schemaVersion: typeof STUDY_SAFETY_SCHEMA_VERSION
  /** A caller-generated opaque identifier used only for server idempotency. */
  readonly requestId: string
  /** A subject selector only. The server independently derives all authority. */
  readonly studentRef:
    | { readonly kind: 'academy-student-id'; readonly value: string }
    | { readonly kind: 'legacy-profile-id'; readonly value: string }
  readonly sessionId: string
  /** Transient: never persisted by the browser adapter or adult-review proposal. */
  readonly transientText: string
}

export interface LearnerSafeSafetyResultV1 {
  readonly messageCode:
    | 'study-safety-clear'
    | 'lesson-paused-get-trusted-adult'
    | 'lesson-paused-adult-check-in'
    | 'lesson-paused-input-check'
  readonly message: string
  readonly mayContinue: boolean
  readonly adultHelpState: 'not-needed' | 'proposed-not-delivered' | 'not-confirmed'
  readonly emergencyGuidanceCode: 'none' | 'seek-local-emergency-help-if-immediate-danger'
}

export interface StudySafetyClassificationResponseV1 {
  readonly schemaVersion: typeof STUDY_SAFETY_SCHEMA_VERSION
  readonly classification: SafetyClassification
  readonly learner: LearnerSafeSafetyResultV1
  readonly continueToTutorCore: boolean
}

export interface UrgentSafetyClassifierRequestV1 {
  readonly classificationVersion: 1
  readonly normalizedTransientText: string
  readonly deterministicAssessment: {
    readonly outcome: Exclude<SafetyClassification, 'invalid'>
    readonly categories: readonly SafetyCategory[]
    readonly ruleIds: readonly SafetyReasonCode[]
  }
}

/** Provider-neutral asynchronous host implementation of the frozen bridge port. */
export interface ServerUrgentSafetyClassifierPort {
  readonly classifierVersion: string
  classify(
    request: UrgentSafetyClassifierRequestV1,
  ): Promise<{
    readonly classificationVersion: 1
    readonly classifierVersion: string
    readonly outcome: SafetyClassification
    readonly categories: readonly SafetyCategory[]
    readonly reasonCodes: readonly SafetyReasonCode[]
  }>
}

export type StudySafetyMonitoringEventName =
  | 'study_safety.classifier_unavailable'
  | 'study_safety.classifier_malformed_response'
  | 'study_safety.classification_urgent'
  | 'study_safety.classification_uncertain'
  | 'study_safety.outbox_backlog'
  | 'study_safety.delivery_repeated_failure'
  | 'study_safety.proposal_duplicate'
  | 'study_safety.recipient_resolution_failure'
  | 'study_safety.request_unauthorized'
  | 'study_safety.request_rate_limited'
  | 'study_safety.provider_timeout'
  | 'study_safety.circuit_breaker_open'

export interface StudySafetyMonitoringEventV1 {
  readonly schemaVersion: 1
  readonly eventId: string
  readonly name: StudySafetyMonitoringEventName
  readonly severity: 'info' | 'warning' | 'critical'
  readonly occurredAt: string
  readonly code: string
  readonly householdRef?: string
  readonly studentRef?: string
  readonly proposalRef?: string
  readonly attemptCount?: number
}
