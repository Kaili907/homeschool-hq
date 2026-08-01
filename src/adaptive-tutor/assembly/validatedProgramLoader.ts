import {
  isValidatedSubjectRegistry,
  type AdaptiveTutorSubjectRegistry,
} from './subjectRegistry'
import type {
  AssemblyFailure,
  AssemblyResult,
  CoreGradeBand,
  CoreV02RuntimeAdapter,
  SafeValidationIssue,
  TutorProgramLoadRequest,
} from './types'

const validatedHandles = new WeakSet<object>()
const SAFE_CORE_PATH_SEGMENTS = new Set([
  'id', 'version', 'title', 'subject', 'gradeBand', 'min', 'max', 'label', 'locale',
  'targetSkillId', 'skillGraph', 'nodes', 'edges', 'fromSkillId', 'toSkillId',
  'relationship', 'diagnosticItems', 'misconceptions', 'teachingSequences',
  'misconceptionId', 'turns', 'guidedPractice', 'independentMastery',
  'reassessmentItems', 'mediaFallback', 'persistentDifficultyCycleLimit', 'kind',
  'skillId', 'purpose', 'prompt', 'directions', 'maxAttempts', 'estimatedSeconds',
  'tags', 'noCameraRequired', 'identifyingInformationRequested', 'options',
  'correctOptionIds', 'allowMultiple', 'shuffle', 'acceptedAnswers', 'caseSensitive',
  'trimWhitespace', 'normalization', 'correctOrder', 'orderedOptionIds', 'items',
  'hintLadder', 'level', 'visualSupportCommandIds', 'maxSupportedAttemptsPerItem',
  'askLearnerToExplain', 'alternateExplanationAllowed', 'feedbackPolicy',
  'minimumEvidenceCount', 'minimumDistinctContexts', 'minimumMeanScore',
  'maximumUncertainty', 'reassessmentRequired', 'singleAnswerCanEstablishMastery',
  'supportsTeacherOverride', 'placementDecisionAllowed', 'missingVisualText',
  'missingAudioText', 'visualAlternativeCommandsAllowed', 'captionsAlwaysVisible',
  'transcriptAlwaysAvailable', 'lessonMayContinueWithoutMedia', 'description',
  'observableEvidence', 'learnerSafeDescription', 'distinguishingEvidence',
  'alternateExplanations', 'escalationAfterRepeatedCycles', 'tag', 'direction',
  'weight', 'explanation', 'learnerMessage', 'spokenTurn', 'boardCommands',
  'assessmentItem', 'expectedInput', 'oneUsefulStepOnly', 'givesFinalGradedAnswer',
  'asksLearnerToParticipate', 'uncertaintyStatement', 'confidence',
  'alternateExplanationAvailable', 'escalationReason', 'jarvisClaimsHumanIdentity',
])

export interface ValidatedProgramHandle {
  readonly subjectId: string
  readonly programId: string
  readonly programVersion: string
  readonly coreSubject: string
  readonly gradeBand: CoreGradeBand
  readonly program: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeIssueText(value: unknown, fallback: string, maximum: number): string {
  if (typeof value !== 'string' || value.length === 0) return fallback
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, maximum)
}

function sanitizeIssues(
  issues: readonly { readonly path: string; readonly message: string }[],
): readonly SafeValidationIssue[] {
  return Object.freeze(
    issues.slice(0, 20).map((issue) =>
      Object.freeze({
        path: (() => {
          const candidate = safeIssueText(issue.path, '/', 240)
          if (!candidate.startsWith('/')) return '/'
          const segments = candidate.split('/').slice(1)
          return segments.every((segment) =>
            /^\d+$/.test(segment) || SAFE_CORE_PATH_SEGMENTS.has(segment))
            ? candidate
            : '/'
        })(),
        // Core issues also contain rejected values, and third-party validators
        // may interpolate them into messages. Keep the path actionable while
        // using a host-owned message that cannot disclose subject/child data.
        message: 'Tutor Core rejected the value at this path.',
      })),
  )
}

function failure(
  code: AssemblyFailure['code'],
  safeMessage: string,
  request: TutorProgramLoadRequest,
  stage: AssemblyFailure['stage'] = 'loader',
  issues?: readonly SafeValidationIssue[],
): AssemblyResult<never> {
  return {
    ok: false,
    failure: {
      stage,
      code,
      safeMessage,
      subjectId: request.subjectId,
      programId: request.programId,
      ...(issues ? { issues } : {}),
    },
  }
}

function deepFreeze(value: unknown, seen = new WeakSet<object>()): void {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return
  if (seen.has(value)) return
  seen.add(value)
  for (const child of Object.values(value)) deepFreeze(child, seen)
  Object.freeze(value)
}

function identityFailure(
  request: TutorProgramLoadRequest,
  code:
    | 'PROGRAM_ID_MISMATCH'
    | 'PROGRAM_VERSION_MISMATCH'
    | 'PROGRAM_SUBJECT_MISMATCH'
    | 'PROGRAM_GRADE_BAND_MISMATCH',
  safeMessage: string,
): AssemblyResult<never> {
  return failure(code, safeMessage, request, 'validation')
}

export async function loadValidatedProgram(
  registry: AdaptiveTutorSubjectRegistry,
  core: CoreV02RuntimeAdapter,
  request: Readonly<TutorProgramLoadRequest>,
): Promise<AssemblyResult<ValidatedProgramHandle>> {
  if (!isValidatedSubjectRegistry(registry)) {
    return failure(
      'UNVALIDATED_REGISTRY',
      'A validated host subject registry is required.',
      request,
      'registry',
    )
  }
  const resolved = registry.resolve(request.subjectId, request.programId)
  if (!resolved.ok) return resolved
  if (core.contractVersion !== resolved.value.subject.compatibleCoreContractVersion) {
    return failure(
      'UNSUPPORTED_CORE_VERSION',
      'The loaded Tutor Core contract is not compatible with this subject.',
      request,
      'validation',
    )
  }

  const frozenRequest = Object.freeze({
    subjectId: request.subjectId,
    programId: request.programId,
  })
  let source: unknown
  try {
    source = await resolved.value.loader(frozenRequest)
  } catch {
    return failure(
      'SUBJECT_LOADER_FAILED',
      'The tutor program could not be loaded.',
      request,
    )
  }

  let snapshot: unknown
  try {
    snapshot = structuredClone(source)
  } catch {
    return failure(
      'PROGRAM_SNAPSHOT_FAILED',
      'The tutor program could not be isolated for validation.',
      request,
    )
  }

  let validation: ReturnType<CoreV02RuntimeAdapter['validateProgram']>
  try {
    validation = core.validateProgram(snapshot)
  } catch {
    return failure(
      'CORE_VALIDATOR_FAILED',
      'Tutor Core could not validate the requested program.',
      request,
      'validation',
    )
  }
  if (!validation.ok) {
    return failure(
      'CORE_VALIDATION_FAILED',
      'The tutor program failed runtime validation.',
      request,
      'validation',
      sanitizeIssues(validation.issues),
    )
  }
  if (validation.value !== snapshot) {
    return failure(
      'CORE_VALIDATOR_SUBSTITUTED_VALUE',
      'Tutor Core validation returned a substituted program value.',
      request,
      'validation',
    )
  }
  if (!isRecord(validation.value)) {
    return failure(
      'CORE_VALIDATION_FAILED',
      'The validated tutor program has an invalid runtime shape.',
      request,
      'validation',
    )
  }

  const program = validation.value
  const descriptor = resolved.value.program
  if (program.id !== descriptor.programId) {
    return identityFailure(
      request,
      'PROGRAM_ID_MISMATCH',
      'The loaded program identifier does not match the registry.',
    )
  }
  if (program.version !== descriptor.programVersion) {
    return identityFailure(
      request,
      'PROGRAM_VERSION_MISMATCH',
      'The loaded program version does not match the registry.',
    )
  }
  if (program.subject !== descriptor.coreSubject) {
    return identityFailure(
      request,
      'PROGRAM_SUBJECT_MISMATCH',
      'The loaded program subject does not match the registry.',
    )
  }
  const band = program.gradeBand
  if (
    !isRecord(band) ||
    band.min !== descriptor.gradeBand.min ||
    band.max !== descriptor.gradeBand.max ||
    band.label !== descriptor.gradeBand.label ||
    typeof band.min !== 'number' ||
    typeof band.max !== 'number' ||
    !Number.isInteger(band.min) ||
    !Number.isInteger(band.max) ||
    band.min > band.max
  ) {
    return identityFailure(
      request,
      'PROGRAM_GRADE_BAND_MISMATCH',
      'The loaded program grade band does not match the registry.',
    )
  }

  deepFreeze(program)
  const handle: ValidatedProgramHandle = Object.freeze({
    subjectId: request.subjectId,
    programId: request.programId,
    programVersion: descriptor.programVersion,
    coreSubject: descriptor.coreSubject,
    gradeBand: descriptor.gradeBand,
    program,
  })
  validatedHandles.add(handle)
  return { ok: true, value: handle }
}

export function isValidatedProgramHandle(value: unknown): value is ValidatedProgramHandle {
  return isRecord(value) && validatedHandles.has(value)
}
