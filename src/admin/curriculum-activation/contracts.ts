export const CURRICULUM_ACTIVATION_SCHEMA_VERSION = 1 as const
export const CURRICULUM_ACTIVATION_READ_CAPABILITY = 'curriculum:read' as const
export const CURRICULUM_ACTIVATION_MANAGE_CAPABILITY = 'releases:manage' as const

export type CurriculumPointerTransitionKind = 'activation' | 'rollback'

export interface CurriculumActivationPointer {
  readonly releaseVersion: string
  readonly revision: number
  readonly transitionKind: 'migration_seed' | CurriculumPointerTransitionKind
  readonly bindingMode: 'registry_only' | 'default_authority'
  readonly transitionedAt: string
}

export interface CurriculumActivationCandidate {
  readonly releaseVersion: string
  readonly status: 'published'
  readonly registeredAt: string
  readonly artifactState: 'available' | 'unavailable'
  readonly eligible: boolean
  readonly previouslyActive: boolean
  readonly active: boolean
}

export interface CurriculumActivationHistoryEntry {
  readonly pointerRevision: number
  readonly previousReleaseVersion: string | null
  readonly newReleaseVersion: string
  readonly transitionKind: 'migration_seed' | CurriculumPointerTransitionKind
  readonly reasonCode: 'release.activated' | 'release.rolled_back' | null
  readonly correlationId: string | null
  readonly transitionedAt: string
}

export interface CurriculumActivationStatus {
  readonly schemaVersion: typeof CURRICULUM_ACTIVATION_SCHEMA_VERSION
  readonly environment: 'production'
  readonly authority: 'default_current_curriculum'
  readonly existingLearnersRepinned: false
  readonly pointer: CurriculumActivationPointer
  readonly candidates: readonly CurriculumActivationCandidate[]
  readonly history: readonly CurriculumActivationHistoryEntry[]
  readonly historyTruncated: boolean
}

export interface CurriculumActivationTransitionResult {
  readonly state: 'transitioned' | 'no_op'
  readonly transitionKind: CurriculumPointerTransitionKind
  readonly previousReleaseVersion: string
  readonly newReleaseVersion: string
  readonly pointerRevision: number
  readonly correlationId: string
}

export interface CurriculumActivationMutationResult extends CurriculumActivationStatus {
  readonly transition: CurriculumActivationTransitionResult
  readonly replayed: boolean
}

export interface CurriculumActivationInput {
  readonly targetReleaseVersion: string
  readonly expectedPointerRevision: number
  readonly transitionKind: CurriculumPointerTransitionKind
  readonly reasonCode: 'release.activated' | 'release.rolled_back'
  readonly idempotencyKey: string
}

export interface CurriculumActivationSource {
  read(): Promise<CurriculumActivationStatus>
  transition(input: CurriculumActivationInput): Promise<CurriculumActivationMutationResult>
}

export class CurriculumActivationError extends Error {
  readonly code:
    | 'unauthenticated'
    | 'forbidden'
    | 'invalid'
    | 'not-found'
    | 'conflict'
    | 'unavailable'
  readonly reason?:
    | 'pointer-conflict'
    | 'idempotency-conflict'
    | 'target-not-published'
    | 'artifacts-unavailable'
    | 'kind-conflict'

  constructor(code: CurriculumActivationError['code'], reason?: CurriculumActivationError['reason']) {
    super(code)
    this.name = 'CurriculumActivationError'
    this.code = code
    this.reason = reason
  }
}
