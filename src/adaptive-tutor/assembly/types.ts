export const CORE_V02_CONTRACT_VERSION = '0.2.0' as const

export type CoreV02ContractVersion = typeof CORE_V02_CONTRACT_VERSION

export type CoreSubject =
  | 'math'
  | 'english'
  | 'science'
  | 'social-studies'
  | 'general'

export interface CoreGradeBand {
  readonly min: number
  readonly max: number
  readonly label: string
}

export type RequiredTutorCapability =
  | 'core-runtime-validation'
  | 'keyboard-input'
  | 'displayed-text'
  | 'adult-review'

export type OptionalMediaCapability = 'audio' | 'image' | 'video'

export type SubjectArtifactProvenance =
  | {
      readonly kind: 'frozen-artifact'
      readonly artifactName: string
      readonly sha256: string
    }
  | {
      readonly kind: 'build'
      readonly repositoryId: string
      readonly revision: string
      readonly buildId: string
    }

export interface TutorProgramDescriptor {
  readonly programId: string
  readonly displayName: string
  readonly programVersion: string
  readonly coreSubject: CoreSubject
  readonly gradeBand: CoreGradeBand
}

export interface TutorProgramLoadRequest {
  readonly subjectId: string
  readonly programId: string
}

/** Subject code is untrusted until the returned value passes frozen Core validation. */
export type TutorProgramLoader = (
  request: Readonly<TutorProgramLoadRequest>,
) => unknown | Promise<unknown>

export type SubjectAvailability =
  | { readonly status: 'available' }
  | {
      readonly status: 'unavailable'
      readonly failure: {
        readonly code: string
        readonly safeMessage: string
      }
    }

export interface SubjectRegistrationInput {
  readonly subjectId: string
  readonly displayName: string
  readonly packageVersion: string
  readonly compatibleCoreContractVersion: CoreV02ContractVersion
  readonly provenance: SubjectArtifactProvenance
  readonly programs: readonly TutorProgramDescriptor[]
  readonly requiredCapabilities: readonly RequiredTutorCapability[]
  readonly optionalMediaCapabilities: readonly OptionalMediaCapability[]
  readonly loaderEntryPoint: string
  readonly loader: TutorProgramLoader
  readonly availability: SubjectAvailability
}

export interface RegisteredSubjectSummary {
  readonly subjectId: string
  readonly displayName: string
  readonly packageVersion: string
  readonly compatibleCoreContractVersion: CoreV02ContractVersion
  readonly provenance: SubjectArtifactProvenance
  readonly programs: readonly TutorProgramDescriptor[]
  readonly requiredCapabilities: readonly RequiredTutorCapability[]
  readonly optionalMediaCapabilities: readonly OptionalMediaCapability[]
  readonly loaderEntryPoint: string
  readonly availability: SubjectAvailability
}

export interface SafeValidationIssue {
  readonly path: string
  readonly message: string
}

export type AssemblyFailureStage =
  | 'registry'
  | 'loader'
  | 'validation'
  | 'assembly'
  | 'launch'
  | 'renderer'

export type AssemblyFailureCode =
  | 'MALFORMED_DESCRIPTOR'
  | 'UNVALIDATED_REGISTRY'
  | 'DUPLICATE_SUBJECT_ID'
  | 'DUPLICATE_PROGRAM_ID'
  | 'UNSUPPORTED_CORE_VERSION'
  | 'LOADER_UNAVAILABLE'
  | 'UNKNOWN_SUBJECT'
  | 'UNKNOWN_PROGRAM'
  | 'SUBJECT_UNAVAILABLE'
  | 'SUBJECT_LOADER_FAILED'
  | 'PROGRAM_SNAPSHOT_FAILED'
  | 'CORE_VALIDATOR_FAILED'
  | 'CORE_VALIDATOR_SUBSTITUTED_VALUE'
  | 'CORE_VALIDATION_FAILED'
  | 'PROGRAM_ID_MISMATCH'
  | 'PROGRAM_VERSION_MISMATCH'
  | 'PROGRAM_SUBJECT_MISMATCH'
  | 'PROGRAM_GRADE_BAND_MISMATCH'
  | 'ENGINE_CONSTRUCTION_FAILED'
  | 'ENGINE_OPERATION_FAILED'
  | 'RUNTIME_INVALID_STATE'
  | 'RUNTIME_INPUT_INVALID'
  | 'RUNTIME_OUTPUT_INVALID'
  | 'RUNTIME_RESET_FAILED'
  | 'RUNTIME_DISPOSED'
  | 'NO_ACTIVE_PROFILE'
  | 'PROFILE_GRADE_UNSUPPORTED'
  | 'GRADE_OUTSIDE_PROGRAM_BAND'
  | 'STALE_LAUNCH'
  | 'RENDER_RESPONSE_INVALID'

export interface AssemblyFailure {
  readonly stage: AssemblyFailureStage
  readonly code: AssemblyFailureCode
  readonly safeMessage: string
  readonly subjectId?: string
  readonly programId?: string
  readonly issues?: readonly SafeValidationIssue[]
}

export type AssemblyResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: AssemblyFailure }

export type CoreProgramValidationResult =
  | { readonly ok: true; readonly value: unknown }
  | {
      readonly ok: false
      readonly issues: readonly {
        readonly path: string
        readonly message: string
        readonly value?: unknown
      }[]
    }

export interface AdaptiveTutorEnginePort {
  start(): unknown
  submit(input: unknown): unknown
  continue(): unknown
  requestAlternateExplanation(): unknown
  getSnapshot(): unknown
  getReview(): unknown
}

export type TutorPhase =
  | 'assessment'
  | 'identify-missing-concept'
  | 'teach-visually'
  | 'guided-practice'
  | 'independent-attempt'
  | 'reassess'
  | 'advance'
  | 'reteach'
  | 'escalated'

export type TutorExpectedInput = 'none' | 'continue' | 'answer' | 'adult-review'

/** Child-safe projection. Assessment answer keys and Core internals are excluded. */
export interface ValidatedTutorResponse {
  readonly id: string
  readonly phase: TutorPhase
  readonly learnerMessage: string
  readonly spokenTurn: {
    readonly text: string
    readonly fallbackText: string
  }
  readonly boardCommands: readonly unknown[]
  readonly assessmentPrompt: string | null
  readonly expectedInput: TutorExpectedInput
  readonly uncertaintyStatement: string
  readonly alternateExplanationAvailable: boolean
  readonly escalationReason: string | null
}

export interface ValidatedAdultReview {
  readonly skillId: string
  readonly evidence: readonly {
    readonly source: string
    readonly itemCount: number
    readonly meanScore: number
    readonly note: string
  }[]
  readonly strengths: readonly string[]
  readonly needsSupport: readonly string[]
  readonly suggestedNextSteps: readonly string[]
  readonly persistentDifficulty: boolean
  readonly escalationRecommended: boolean
  readonly uncertaintyStatement: string
  readonly diagnosticClaimMade: false
  readonly highStakesPlacementDecisionMade: false
  readonly identifyingInformationRequested: false
}

/**
 * Host adapter around the exact, externally supplied frozen Core v0.2 exports.
 * The host never executes subject data before `validateProgram` succeeds.
 */
export interface CoreV02RuntimeAdapter {
  readonly contractVersion: CoreV02ContractVersion
  /** Must combine TutorProgramSchema validation with Core validateSkillGraph. */
  validateProgram(candidate: unknown): CoreProgramValidationResult
  validateLearnerInput(candidate: unknown): CoreProgramValidationResult
  validateTutorResponse(candidate: unknown): CoreProgramValidationResult
  validateAdultReview(candidate: unknown): CoreProgramValidationResult
  createEngine(program: unknown): AdaptiveTutorEnginePort
}
