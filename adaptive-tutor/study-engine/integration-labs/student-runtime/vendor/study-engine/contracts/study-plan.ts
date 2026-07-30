import type {
  ContractHeader,
  ControlSetId,
  EffectiveWorkBlockRange,
  FocusProfileId,
  GradeBand,
  LessonId,
  SegmentId,
  SkillId,
  StudentId,
  StudyPlanId,
  SubjectId,
  VersionedReference,
} from './common.ts'

export const STUDY_TASK_TYPES = [
  'direct-instruction',
  'worked-example',
  'guided-practice',
  'independent-practice',
  'retrieval-practice',
  'reading',
  'writing',
  'discussion',
  'problem-solving',
  'project-work',
  'mastery-check',
  'prerequisite-remediation',
  'reflection',
  'custom',
] as const

export type StudyTaskType = (typeof STUDY_TASK_TYPES)[number]

export const ACTIVE_RESPONSE_MODES = [
  'spoken-answer',
  'typed-answer',
  'selected-answer',
  'written-work',
  'drawn-model',
  'worked-step',
  'teach-back',
  'physical-response',
] as const

export type ActiveResponseMode = (typeof ACTIVE_RESPONSE_MODES)[number]
export type LoadLevel = 'low' | 'moderate' | 'high' | 'very-high'

export interface GradeBandStartingRange {
  readonly gradeBand: GradeBand
  readonly basis: 'grade-band-starting-range'
  readonly effectiveWorkBlockRange: EffectiveWorkBlockRange
  readonly reviewAfterEligibleSessions: number
}

export interface SubjectTimingProfile {
  readonly subjectId: SubjectId
  readonly effectiveWorkBlockRange: EffectiveWorkBlockRange
  readonly rationale?: string
}

export interface TaskTimingProfile {
  readonly taskType: StudyTaskType
  readonly customTaskTypeId?: string
  readonly effectiveWorkBlockRange: EffectiveWorkBlockRange
  readonly rationale?: string
}

export interface SegmentTiming {
  readonly minimumMinutes: number
  readonly plannedMinutes: number
  readonly maximumMinutes: number
}

export interface CognitiveLoadMetadata {
  readonly overallLevel: LoadLevel
  readonly novelty: LoadLevel
  readonly workingMemoryDemand: LoadLevel
  readonly interactionDemand: LoadLevel
  readonly supportLevel: LoadLevel
  readonly supportStrategies: readonly string[]
}

export interface ActiveResponseRequirement {
  readonly required: boolean
  readonly modes: readonly ActiveResponseMode[]
  readonly minimumResponseCount: number
  readonly maximumPassiveMinutes?: number
}

export interface BreakEligibility {
  readonly eligible: boolean
  readonly studentMayRequest: boolean
  readonly approvalRequired: boolean
  readonly availableAfterActiveMinutes?: number
  readonly recommendedBreakMinutes?: number
}

export interface MasteryCriterion {
  readonly minimumAccuracyPercent: number
  readonly minimumIndependentResponses: number
  readonly maximumHintCount?: number
}

export interface MasteryCheckRequirement {
  readonly required: boolean
  readonly skillIds: readonly SkillId[]
  readonly learningObjectiveIds: readonly string[]
  readonly minimumItemCount: number
  readonly criterion?: MasteryCriterion
}

export interface PrerequisiteReference {
  readonly skillId: SkillId
  readonly relationship: 'required' | 'supporting'
  readonly minimumOutcome: 'introduced' | 'progressing' | 'demonstrated' | 'retained'
  readonly onGap: 'remediate-before-segment' | 'embed-review' | 'request-adult-review'
}

export interface LessonSegment {
  readonly id: SegmentId
  readonly sequence: number
  readonly title: string
  readonly taskType: StudyTaskType
  readonly customTaskTypeId?: string
  readonly learningObjectiveIds: readonly string[]
  readonly timing: SegmentTiming
  readonly cognitiveLoad: CognitiveLoadMetadata
  readonly activeResponse: ActiveResponseRequirement
  readonly breakEligibility: BreakEligibility
  readonly masteryCheck: MasteryCheckRequirement
  readonly prerequisiteRefs: readonly PrerequisiteReference[]
  /**
   * Dependencies must refer to earlier segments. The explicit ordered sequence
   * remains the canonical presentation order.
   */
  readonly dependsOnSegmentIds: readonly SegmentId[]
}

export interface LessonStudyPlan
  extends ContractHeader<'lesson-study-plan', StudyPlanId> {
  readonly studentId: StudentId
  readonly lessonId: LessonId
  readonly subjectId: SubjectId
  readonly gradeBand: GradeBand
  readonly gradeBandStartingRanges: readonly GradeBandStartingRange[]
  readonly subjectTimingProfiles: readonly SubjectTimingProfile[]
  readonly taskTimingProfiles: readonly TaskTimingProfile[]
  readonly prerequisiteRefs: readonly PrerequisiteReference[]
  readonly segments: readonly LessonSegment[]
  readonly segmentSequence: readonly SegmentId[]
  readonly focusProfileRef?: VersionedReference<FocusProfileId>
  readonly controlsRef?: VersionedReference<ControlSetId>
}

