export const LEARNER_RESPONSE_TYPES = Object.freeze([
  'NONE',
  'READ',
  'CHOICE',
  'TEXT',
  'NUMERIC',
  'CONSTRUCTED_RESPONSE',
  'ACTIVITY_EVIDENCE',
  'RUBRIC_REVIEW_PENDING',
  'GUARDIAN_ATTESTATION',
] as const)

export type LearnerResponseType = typeof LEARNER_RESPONSE_TYPES[number]
export type LearnerStudySegmentRole = 'LEARN' | 'PRACTICE' | 'REFLECT'
export type LearnerEvidenceMode = 'SUPPORTED' | 'INDEPENDENT' | 'MASTERY' | 'COMPLETION'

export interface LearnerResponseChoice {
  readonly choiceRef: string
  readonly label: string
}

export interface LearnerResponseItem {
  readonly lessonRef: string
  readonly sectionRef: string
  readonly itemRef: string
  readonly segmentRole: LearnerStudySegmentRole
  readonly responseType: LearnerResponseType
  readonly evidenceMode: LearnerEvidenceMode | null
  readonly title: string
  readonly instruction?: string
  readonly prompt?: string
  readonly example?: string
  readonly choices: readonly LearnerResponseChoice[]
  readonly required: boolean
  readonly instructionalExample: boolean
}

export interface LearnerResponseStudySegment {
  readonly role: LearnerStudySegmentRole
  readonly items: readonly LearnerResponseItem[]
}

export interface LearnerResponseLesson {
  readonly lessonRef: string
  readonly title: string
  readonly segments: readonly LearnerResponseStudySegment[]
}

export interface LearnerResponseAttemptContext {
  readonly lessonRef: string
  readonly studentRef: string
  readonly assignmentRef: string
  readonly attemptRef: string
}

export type LearnerResponseValue =
  | { readonly kind: 'CHOICE'; readonly choiceRef: string }
  | { readonly kind: 'TEXT' | 'NUMERIC' | 'CONSTRUCTED_RESPONSE' | 'ACTIVITY_EVIDENCE'; readonly text: string }

export interface LearnerResponseRecord extends LearnerResponseAttemptContext {
  readonly schemaVersion: 1
  readonly sectionRef: string
  readonly itemRef: string
  readonly segmentRef: string
  readonly responseType: Exclude<LearnerResponseType, 'NONE' | 'READ' | 'RUBRIC_REVIEW_PENDING' | 'GUARDIAN_ATTESTATION'>
  readonly evidenceMode: LearnerEvidenceMode | null
  readonly response: LearnerResponseValue
  readonly status: 'PENDING_ASSESSMENT' | 'ASSESSED'
  readonly savedAt: string
  readonly assessment: LearnerAssessmentReceipt | null
}

export interface LearnerAssessmentReceipt {
  readonly assessmentRef: string
  readonly assessorRef: string
  readonly assessedAt: string
  readonly decision: 'CORRECT' | 'INCORRECT' | 'PARTIAL' | 'REVIEW_REQUIRED'
}

/** The only scoring seam. The learner runtime contains no key or scoring rule. */
export interface LearnerResponseAssessor {
  readonly assessorRef: string
  assess(record: LearnerResponseRecord): Promise<LearnerAssessmentReceipt>
}

export interface LearnerResponseStore {
  list(context: LearnerResponseAttemptContext): Promise<readonly LearnerResponseRecord[]>
  save(record: LearnerResponseRecord): Promise<void>
}

export interface LearnerResponsePresentation {
  readonly segmentRole: LearnerStudySegmentRole
  readonly segmentRef: string
  readonly item: LearnerResponseItem | null
  readonly answeredItemRefs: readonly string[]
  readonly requiredItemRefs: readonly string[]
  readonly canCompleteSegment: boolean
  readonly pendingAssessmentCount: number
}

export type LearnerResponseSubmissionResult =
  | {
      readonly status: 'saved'
      readonly record: LearnerResponseRecord
      readonly assessmentStatus: 'PENDING_ASSESSMENT' | 'ASSESSED'
    }
  | {
      readonly status: 'rejected'
      readonly reason: 'wrong-lesson' | 'lost-section-ref' | 'lost-item-ref' | 'wrong-item' | 'wrong-response-kind' | 'empty-response' | 'invalid-choice' | 'storage-unavailable'
      readonly message: string
    }

export interface LearnerResponseSubmission {
  readonly lessonRef: string
  readonly sectionRef: string
  readonly itemRef: string
  readonly segmentRef: string
  readonly value: string
}

/**
 * Local fixture/compatibility DTO. It accepts the current safe browser
 * projection and the richer section/item form without importing another
 * session's moving contracts.
 */
export interface LearnerMaterialDto {
  readonly lessonRef: string
  readonly title: string
  readonly subject?: string
  readonly format: 'structured' | 'markdown'
  readonly markdown?: string
  readonly sections?: readonly LearnerMaterialSectionDto[]
  readonly essentialQuestion?: string
  readonly lessonGoal?: string
  readonly keyPoints?: readonly string[]
  readonly vocabulary?: readonly (string | { readonly term: string; readonly definition?: string })[]
  readonly materials?: readonly string[]
  readonly safetyRules?: readonly string[]
  readonly stoppingRules?: readonly string[]
  readonly successCriteria?: readonly string[]
  readonly movementCues?: readonly string[]
  readonly activitySteps?: readonly string[]
  readonly technique?: string
  readonly spaceSetup?: string
  readonly accessibleAdaptation?: string
  readonly noEquipmentAlternative?: string
  readonly commonErrorToWatchFor?: string
  readonly equipmentRequirements?: unknown
  readonly simulationAlternative?: unknown
  readonly activitySetup?: unknown
  readonly learnerResource?: unknown
  readonly sourceMetadata?: unknown
  readonly rubricCriteria?: readonly unknown[]
}

export interface LearnerMaterialSectionDto {
  readonly sectionRef?: string
  readonly sectionId?: string
  readonly kind?: string
  readonly sectionKind?: string
  readonly title: string
  readonly body?: string
  readonly directions?: string
  readonly prompts?: readonly string[]
  readonly items?: readonly LearnerMaterialItemDto[]
  readonly vocabulary?: readonly (string | { readonly term: string; readonly definition?: string })[]
  readonly source?: unknown
  readonly data?: unknown
  readonly map?: unknown
  readonly image?: unknown
  readonly reference?: unknown
}

export interface LearnerMaterialItemDto {
  readonly itemRef?: string
  readonly ref?: string
  readonly kind?: string
  readonly itemKind?: string
  readonly itemType?: string
  readonly prompt?: string
  readonly responseType?: string
  readonly responseKind?: LearnerResponseType
  readonly choices?: readonly (string | { readonly id?: string; readonly ref?: string; readonly label: string })[]
  readonly workedSolution?: { readonly steps?: readonly string[] }
  readonly explanation?: string
  readonly source?: unknown
  readonly data?: unknown
  readonly map?: unknown
  readonly image?: unknown
  readonly reference?: unknown
}
