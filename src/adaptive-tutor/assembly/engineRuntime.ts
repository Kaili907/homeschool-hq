import { isValidatedProgramHandle, type ValidatedProgramHandle } from './validatedProgramLoader'
import type {
  AdaptiveTutorEnginePort,
  AssemblyFailure,
  AssemblyResult,
  CoreProgramValidationResult,
  CoreV02RuntimeAdapter,
  TutorExpectedInput,
  TutorPhase,
  ValidatedAdultReview,
  ValidatedTutorResponse,
} from './types'

export type TutorRuntimeStatus = 'ready' | 'active' | 'disposed'

export interface AdaptiveTutorRuntime {
  readonly launchId: string
  readonly subjectId: string
  readonly programId: string
  readonly status: TutorRuntimeStatus
  start(): AssemblyResult<ValidatedTutorResponse>
  submit(input: unknown): AssemblyResult<ValidatedTutorResponse>
  continueLesson(): AssemblyResult<ValidatedTutorResponse>
  requestAlternateExplanation(): AssemblyResult<ValidatedTutorResponse>
  getAdultReview(): AssemblyResult<ValidatedAdultReview>
  reset(): AssemblyResult<void>
  dispose(): void
}

export interface RuntimeAssemblyOptions {
  readonly createLaunchId?: () => string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepFreeze(value: unknown, seen = new WeakSet<object>()): void {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return
  if (seen.has(value)) return
  seen.add(value)
  for (const child of Object.values(value)) deepFreeze(child, seen)
  Object.freeze(value)
}

function runtimeFailure(
  code: AssemblyFailure['code'],
  safeMessage: string,
  handle: ValidatedProgramHandle,
): AssemblyResult<never> {
  return {
    ok: false,
    failure: {
      stage: 'assembly',
      code,
      safeMessage,
      subjectId: handle.subjectId,
      programId: handle.programId,
    },
  }
}

function defaultLaunchId(): string {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `tutor-launch-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function cloneAndValidate(
  candidate: unknown,
  validator: (value: unknown) => CoreProgramValidationResult,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  let snapshot: unknown
  try {
    snapshot = structuredClone(candidate)
  } catch {
    return { ok: false }
  }
  let validation: CoreProgramValidationResult
  try {
    validation = validator(snapshot)
  } catch {
    return { ok: false }
  }
  if (!validation.ok || validation.value !== snapshot) return { ok: false }
  deepFreeze(snapshot)
  return { ok: true, value: snapshot }
}

const PHASES = new Set<TutorPhase>([
  'assessment',
  'identify-missing-concept',
  'teach-visually',
  'guided-practice',
  'independent-attempt',
  'reassess',
  'advance',
  'reteach',
  'escalated',
])
const EXPECTED_INPUTS = new Set<TutorExpectedInput>([
  'none',
  'continue',
  'answer',
  'adult-review',
])

function projectTutorResponse(candidate: unknown): ValidatedTutorResponse | undefined {
  if (!isRecord(candidate) || !isRecord(candidate.spokenTurn)) return undefined
  const assessmentPrompt = candidate.assessmentItem === null
    ? null
    : isRecord(candidate.assessmentItem) && typeof candidate.assessmentItem.prompt === 'string'
      ? candidate.assessmentItem.prompt
      : undefined
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.phase !== 'string' ||
    !PHASES.has(candidate.phase as TutorPhase) ||
    typeof candidate.learnerMessage !== 'string' ||
    typeof candidate.spokenTurn.text !== 'string' ||
    typeof candidate.spokenTurn.fallbackText !== 'string' ||
    !Array.isArray(candidate.boardCommands) ||
    assessmentPrompt === undefined ||
    typeof candidate.expectedInput !== 'string' ||
    !EXPECTED_INPUTS.has(candidate.expectedInput as TutorExpectedInput) ||
    typeof candidate.uncertaintyStatement !== 'string' ||
    typeof candidate.alternateExplanationAvailable !== 'boolean' ||
    !(typeof candidate.escalationReason === 'string' || candidate.escalationReason === null)
  ) return undefined
  const projected: ValidatedTutorResponse = {
    id: candidate.id,
    phase: candidate.phase as TutorPhase,
    learnerMessage: candidate.learnerMessage,
    spokenTurn: Object.freeze({
      text: candidate.spokenTurn.text,
      fallbackText: candidate.spokenTurn.fallbackText,
    }),
    boardCommands: Object.freeze([...candidate.boardCommands]),
    assessmentPrompt,
    expectedInput: candidate.expectedInput as TutorExpectedInput,
    uncertaintyStatement: candidate.uncertaintyStatement,
    alternateExplanationAvailable: candidate.alternateExplanationAvailable,
    escalationReason: candidate.escalationReason,
  }
  deepFreeze(projected)
  return projected
}

function readStringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return undefined
  return Object.freeze([...value])
}

function projectAdultReview(candidate: unknown): ValidatedAdultReview | undefined {
  if (!isRecord(candidate) || !Array.isArray(candidate.evidence)) return undefined
  const evidence: Array<ValidatedAdultReview['evidence'][number]> = []
  for (const item of candidate.evidence) {
    if (
      !isRecord(item) ||
      typeof item.source !== 'string' ||
      typeof item.itemCount !== 'number' ||
      !Number.isInteger(item.itemCount) ||
      typeof item.meanScore !== 'number' ||
      typeof item.note !== 'string'
    ) return undefined
    evidence.push(Object.freeze({
      source: item.source,
      itemCount: item.itemCount,
      meanScore: item.meanScore,
      note: item.note,
    }))
  }
  const strengths = readStringList(candidate.strengths)
  const needsSupport = readStringList(candidate.needsSupport)
  const suggestedNextSteps = readStringList(candidate.suggestedNextSteps)
  if (
    typeof candidate.skillId !== 'string' ||
    !strengths ||
    !needsSupport ||
    !suggestedNextSteps ||
    typeof candidate.persistentDifficulty !== 'boolean' ||
    typeof candidate.escalationRecommended !== 'boolean' ||
    typeof candidate.uncertaintyStatement !== 'string' ||
    candidate.diagnosticClaimMade !== false ||
    candidate.highStakesPlacementDecisionMade !== false ||
    candidate.identifyingInformationRequested !== false
  ) return undefined
  const review: ValidatedAdultReview = {
    skillId: candidate.skillId,
    evidence: Object.freeze(evidence),
    strengths,
    needsSupport,
    suggestedNextSteps,
    persistentDifficulty: candidate.persistentDifficulty,
    escalationRecommended: candidate.escalationRecommended,
    uncertaintyStatement: candidate.uncertaintyStatement,
    diagnosticClaimMade: false,
    highStakesPlacementDecisionMade: false,
    identifyingInformationRequested: false,
  }
  deepFreeze(review)
  return review
}

export function assembleAdaptiveTutorRuntime(
  core: CoreV02RuntimeAdapter,
  handle: ValidatedProgramHandle,
  options: RuntimeAssemblyOptions = {},
): AssemblyResult<AdaptiveTutorRuntime> {
  if (!isValidatedProgramHandle(handle)) {
    return {
      ok: false,
      failure: {
        stage: 'assembly',
        code: 'CORE_VALIDATION_FAILED',
        safeMessage: 'A validated tutor program is required before engine construction.',
      },
    }
  }

  const constructEngine = (): AdaptiveTutorEnginePort | undefined => {
    const isolated = cloneAndValidate(handle.program, (candidate) =>
      core.validateProgram(candidate))
    if (!isolated.ok) return undefined
    try {
      return core.createEngine(isolated.value)
    } catch {
      return undefined
    }
  }

  let engine = constructEngine()
  if (!engine) {
    return runtimeFailure(
      'ENGINE_CONSTRUCTION_FAILED',
      'The tutor runtime could not be constructed.',
      handle,
    )
  }

  let status: TutorRuntimeStatus = 'ready'
  let expectedInput: TutorExpectedInput | undefined
  let lastResponse: ValidatedTutorResponse | undefined
  const invalidateRuntime = (): void => {
    status = 'disposed'
    expectedInput = undefined
    lastResponse = undefined
    engine = undefined
  }
  const invokeResponse = (
    operation: (active: AdaptiveTutorEnginePort) => unknown,
  ): AssemblyResult<ValidatedTutorResponse> => {
    if (status === 'disposed' || !engine) {
      return runtimeFailure('RUNTIME_DISPOSED', 'This tutor runtime is closed.', handle)
    }
    let raw: unknown
    try {
      raw = operation(engine)
    } catch {
      invalidateRuntime()
      return runtimeFailure(
        'ENGINE_OPERATION_FAILED',
        'The tutor could not complete that step.',
        handle,
      )
    }
    const validated = cloneAndValidate(raw, (candidate) =>
      core.validateTutorResponse(candidate))
    const response = validated.ok ? projectTutorResponse(validated.value) : undefined
    if (!response) {
      invalidateRuntime()
      return runtimeFailure(
        'RUNTIME_OUTPUT_INVALID',
        'Tutor Core returned an invalid response.',
        handle,
      )
    }
    status = 'active'
    expectedInput = response.expectedInput
    lastResponse = response
    return { ok: true, value: response }
  }

  const requireState = (allowed: readonly TutorExpectedInput[]): AssemblyResult<never> | undefined => {
    if (status === 'disposed' || !engine) {
      return runtimeFailure('RUNTIME_DISPOSED', 'This tutor runtime is closed.', handle)
    }
    if (status !== 'active' || !expectedInput || !allowed.includes(expectedInput)) {
      return runtimeFailure(
        'RUNTIME_INVALID_STATE',
        'That tutor action is not available at this step.',
        handle,
      )
    }
    return undefined
  }

  const runtime: AdaptiveTutorRuntime = {
    launchId: (options.createLaunchId ?? defaultLaunchId)(),
    subjectId: handle.subjectId,
    programId: handle.programId,
    get status() {
      return status
    },
    start: () => {
      if (status !== 'ready') {
        return runtimeFailure(
          status === 'disposed' ? 'RUNTIME_DISPOSED' : 'RUNTIME_INVALID_STATE',
          status === 'disposed'
            ? 'This tutor runtime is closed.'
            : 'This tutor runtime has already started.',
          handle,
        )
      }
      return invokeResponse((active) => active.start())
    },
    submit: (input) => {
      const stateFailure = requireState(['answer'])
      if (stateFailure) return stateFailure
      if (
        !lastResponse ||
        lastResponse.assessmentPrompt === null ||
        !['assessment', 'guided-practice', 'independent-attempt', 'reassess']
          .includes(lastResponse.phase)
      ) {
        return runtimeFailure(
          'RUNTIME_INVALID_STATE',
          'An answer cannot be submitted at this tutor step.',
          handle,
        )
      }
      const validatedInput = cloneAndValidate(input, (candidate) =>
        core.validateLearnerInput(candidate))
      if (!validatedInput.ok) {
        return runtimeFailure(
          'RUNTIME_INPUT_INVALID',
          'The learner response has an invalid format.',
          handle,
        )
      }
      return invokeResponse((active) => active.submit(validatedInput.value))
    },
    continueLesson: () => {
      if (
        status === 'disposed' ||
        !engine ||
        !lastResponse ||
        !(
          expectedInput === 'continue' ||
          (
            expectedInput === 'answer' &&
            lastResponse.phase === 'teach-visually' &&
            lastResponse.assessmentPrompt === null
          )
        )
      ) {
        return runtimeFailure(
          status === 'disposed' ? 'RUNTIME_DISPOSED' : 'RUNTIME_INVALID_STATE',
          status === 'disposed'
            ? 'This tutor runtime is closed.'
            : 'Continue is not available at this tutor step.',
          handle,
        )
      }
      return invokeResponse((active) => active.continue())
    },
    requestAlternateExplanation: () => {
      if (
        status === 'disposed' ||
        !engine ||
        !lastResponse ||
        !lastResponse.alternateExplanationAvailable ||
        !['identify-missing-concept', 'teach-visually', 'guided-practice', 'reteach']
          .includes(lastResponse.phase)
      ) {
        return runtimeFailure(
          status === 'disposed' ? 'RUNTIME_DISPOSED' : 'RUNTIME_INVALID_STATE',
          status === 'disposed'
            ? 'This tutor runtime is closed.'
            : 'An alternate explanation is not available at this tutor step.',
          handle,
        )
      }
      return invokeResponse((active) => active.requestAlternateExplanation())
    },
    getAdultReview: () => {
      const stateFailure = requireState(['adult-review'])
      if (stateFailure) return stateFailure
      let raw: unknown
      try {
        raw = engine?.getReview()
      } catch {
        invalidateRuntime()
        return runtimeFailure(
          'ENGINE_OPERATION_FAILED',
          'The adult review could not be created.',
          handle,
        )
      }
      const validated = cloneAndValidate(raw, (candidate) =>
        core.validateAdultReview(candidate))
      if (!validated.ok) {
        invalidateRuntime()
        return runtimeFailure(
          'RUNTIME_OUTPUT_INVALID',
          'Tutor Core returned an invalid adult review.',
          handle,
        )
      }
      const review = projectAdultReview(validated.value)
      if (!review) {
        invalidateRuntime()
        return runtimeFailure(
          'RUNTIME_OUTPUT_INVALID',
          'Tutor Core returned an invalid adult review.',
          handle,
        )
      }
      return { ok: true, value: review }
    },
    reset: () => {
      if (status === 'disposed') {
        return runtimeFailure('RUNTIME_DISPOSED', 'This tutor runtime is closed.', handle)
      }
      engine = undefined
      expectedInput = undefined
      lastResponse = undefined
      const replacement = constructEngine()
      if (!replacement) {
        status = 'disposed'
        return runtimeFailure(
          'RUNTIME_RESET_FAILED',
          'The tutor runtime could not be reset.',
          handle,
        )
      }
      engine = replacement
      status = 'ready'
      return { ok: true, value: undefined }
    },
    dispose: () => {
      status = 'disposed'
      expectedInput = undefined
      lastResponse = undefined
      engine = undefined
    },
  }
  return { ok: true, value: Object.freeze(runtime) }
}
