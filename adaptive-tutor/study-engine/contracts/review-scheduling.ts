import type {
  ContractHeader,
  EvidenceId,
  ISODate,
  ISODateTime,
  RetrievalAttemptId,
  ReviewId,
  SkillId,
  StudentId,
  SubjectId,
} from './common.ts'

export type ReviewInterval =
  | { readonly id: 'same-day'; readonly days: 0 }
  | { readonly id: 'one-day'; readonly days: 1 }
  | { readonly id: 'three-day'; readonly days: 3 }
  | { readonly id: 'seven-day'; readonly days: 7 }
  | { readonly id: 'fourteen-day'; readonly days: 14 }
  | { readonly id: 'thirty-day'; readonly days: 30 }
  | { readonly id: 'custom'; readonly days: number }

export interface RetrievalAttempt {
  readonly id: RetrievalAttemptId
  readonly attemptedAt: ISODateTime
  readonly reviewDate: ISODate
  readonly correctCount: number
  readonly attemptedCount: number
  readonly hintCount: number
  readonly independence: 'independent' | 'minimal-support' | 'guided' | 'full-support'
  readonly evidenceId: EvidenceId
}

export interface IntervalAdjustment {
  readonly adjustedAt: ISODateTime
  readonly action: 'interval-expansion' | 'interval-contraction' | 'interval-maintained'
  readonly from: ReviewInterval
  readonly to: ReviewInterval
  readonly basisEvidenceIds: readonly EvidenceId[]
}

export interface ReteachingTrigger {
  readonly status: 'not-triggered' | 'triggered'
  readonly reason: 'repeated-retrieval-difficulty' | 'retention-decline' | 'adult-request'
  readonly basisEvidenceIds: readonly EvidenceId[]
}

export interface PrerequisiteRemediationTrigger {
  readonly status: 'not-triggered' | 'triggered'
  readonly reason: 'confirmed-prerequisite-gap' | 'adult-request'
  readonly prerequisiteSkillIds: readonly SkillId[]
  readonly basisEvidenceIds: readonly EvidenceId[]
}

export interface StudentSkillReview
  extends ContractHeader<'student-skill-review', ReviewId> {
  readonly studentId: StudentId
  readonly subjectId: SubjectId
  readonly skillId: SkillId
  readonly timeZone: string
  readonly retrievalAttempts: readonly RetrievalAttempt[]
  readonly currentInterval: ReviewInterval
  readonly nextReviewDate: ISODate
  readonly intervalAdjustments: readonly IntervalAdjustment[]
  readonly reteachingTrigger?: ReteachingTrigger
  readonly prerequisiteRemediationTrigger?: PrerequisiteRemediationTrigger
}

