import type {
  AdaptiveTutorEnginePort,
  CoreProgramValidationResult,
  CoreV02RuntimeAdapter,
  SubjectRegistrationInput,
  TutorPhase,
} from './types'

export const TEST_SUBJECT_ID = 'test-subject'
export const TEST_PROGRAM_ID = 'test-program'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function makeProgram(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: TEST_PROGRAM_ID,
    version: '1.0.0',
    subject: 'general',
    gradeBand: { min: 4, max: 6, label: 'Grades 4–6' },
    schemaValid: true,
    semanticGraphValid: true,
    safety: {
      uncertaintyStatement: 'This is instructional evidence, not a diagnosis.',
      noCameraRequired: true,
      identifyingInformationRequested: false,
      placementDecisionAllowed: false,
      supportsTeacherOverride: true,
    },
    mediaFallback: {
      missingVisualText: 'Read the displayed step.',
      missingAudioText: 'Read the displayed words.',
      captionsAlwaysVisible: true,
      transcriptAlwaysAvailable: true,
      lessonMayContinueWithoutMedia: true,
    },
    ...overrides,
  }
}

export function makeDescriptor(
  loader: SubjectRegistrationInput['loader'] = () => makeProgram(),
  overrides: Partial<SubjectRegistrationInput> = {},
): SubjectRegistrationInput {
  return {
    subjectId: TEST_SUBJECT_ID,
    displayName: 'Test Subject',
    packageVersion: '1.0.0',
    compatibleCoreContractVersion: '0.2.0',
    provenance: {
      kind: 'frozen-artifact',
      artifactName: 'test-subject.zip',
      sha256: 'a'.repeat(64),
    },
    programs: [{
      programId: TEST_PROGRAM_ID,
      displayName: 'Test Program',
      programVersion: '1.0.0',
      coreSubject: 'general',
      gradeBand: { min: 4, max: 6, label: 'Grades 4–6' },
    }],
    requiredCapabilities: [
      'core-runtime-validation',
      'keyboard-input',
      'displayed-text',
      'adult-review',
    ],
    optionalMediaCapabilities: ['audio', 'image'],
    loaderEntryPoint: 'load-test-program',
    loader,
    availability: { status: 'available' },
    ...overrides,
  }
}

export function makeResponse(options: {
  readonly id?: string
  readonly phase?: TutorPhase
  readonly expectedInput?: 'none' | 'continue' | 'answer' | 'adult-review'
  readonly assessment?: boolean
  readonly alternate?: boolean
  readonly message?: string
  readonly boardCommands?: readonly unknown[]
  readonly schemaValid?: boolean
} = {}): Record<string, unknown> {
  const message = options.message ?? 'Try this one useful step.'
  return {
    id: options.id ?? 'response-001',
    phase: options.phase ?? 'assessment',
    learnerMessage: message,
    spokenTurn: {
      text: message,
      fallbackText: message,
    },
    boardCommands: options.boardCommands ?? [],
    assessmentItem: options.assessment === false
      ? null
      : {
          prompt: 'What is the next step?',
          correctOptionIds: ['SECRET_CORRECT_OPTION'],
          acceptedAnswers: ['SECRET_ACCEPTED_ANSWER'],
          correctOrder: ['SECRET_CORRECT_ORDER'],
        },
    expectedInput: options.expectedInput ?? 'answer',
    uncertaintyStatement: 'This is limited instructional evidence, not a diagnosis.',
    alternateExplanationAvailable: options.alternate ?? true,
    escalationReason: null,
    schemaValidResponse: options.schemaValid ?? true,
  }
}

export function makeReview(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    skillId: 'test-skill',
    evidence: [{ source: 'diagnostic', itemCount: 1, meanScore: 0.5, note: 'One check.' }],
    strengths: ['Kept trying.'],
    needsSupport: ['Use another representation.'],
    suggestedNextSteps: ['Review with an adult.'],
    persistentDifficulty: false,
    escalationRecommended: false,
    uncertaintyStatement: 'This review does not make a diagnosis or placement decision.',
    diagnosticClaimMade: false,
    highStakesPlacementDecisionMade: false,
    identifyingInformationRequested: false,
    schemaValidReview: true,
    ...overrides,
  }
}

export class TestEngine implements AdaptiveTutorEnginePort {
  count = 0
  readonly program: unknown
  startResponse: unknown = makeResponse()
  submitResponse: unknown = makeResponse({
    id: 'response-submit',
    phase: 'identify-missing-concept',
    expectedInput: 'continue',
    assessment: false,
  })
  continueResponse: unknown = makeResponse({
    id: 'response-continue',
    phase: 'teach-visually',
    expectedInput: 'answer',
    assessment: false,
  })
  alternateResponse: unknown = makeResponse({
    id: 'response-alternate',
    phase: 'teach-visually',
    expectedInput: 'answer',
    assessment: false,
  })
  review: unknown = makeReview()

  constructor(program: unknown) {
    this.program = program
  }

  start(): unknown {
    this.count += 1
    return this.startResponse
  }

  submit(_input: unknown): unknown {
    this.count += 1
    return this.submitResponse
  }

  continue(): unknown {
    this.count += 1
    return this.continueResponse
  }

  requestAlternateExplanation(): unknown {
    this.count += 1
    return this.alternateResponse
  }

  getSnapshot(): unknown {
    return { count: this.count, transcript: ['PRIVATE_TRANSCRIPT'] }
  }

  getReview(): unknown {
    return this.review
  }
}

export interface TestCoreControls {
  readonly adapter: CoreV02RuntimeAdapter
  readonly constructedPrograms: unknown[]
  readonly engines: TestEngine[]
  readonly calls: {
    programValidation: number
    inputValidation: number
    responseValidation: number
    reviewValidation: number
    construction: number
  }
}

function pass(value: unknown): CoreProgramValidationResult {
  return { ok: true, value }
}

function fail(path = '/'): CoreProgramValidationResult {
  return { ok: false, issues: [{ path, message: 'Invalid test value.', value: 'PRIVATE_VALUE' }] }
}

export function makeCoreAdapter(options: {
  readonly createEngine?: (program: unknown) => TestEngine
  readonly validatorIssue?: { readonly path: string; readonly message: string; readonly value: unknown }
} = {}): TestCoreControls {
  const constructedPrograms: unknown[] = []
  const engines: TestEngine[] = []
  const calls = {
    programValidation: 0,
    inputValidation: 0,
    responseValidation: 0,
    reviewValidation: 0,
    construction: 0,
  }
  const adapter: CoreV02RuntimeAdapter = {
    contractVersion: '0.2.0',
    validateProgram: (candidate) => {
      calls.programValidation += 1
      if (!isRecord(candidate)) return fail()
      if (options.validatorIssue) {
        return { ok: false, issues: [options.validatorIssue] }
      }
      const band = candidate.gradeBand
      if (
        candidate.schemaValid !== true ||
        candidate.semanticGraphValid !== true ||
        typeof candidate.id !== 'string' ||
        typeof candidate.version !== 'string' ||
        typeof candidate.subject !== 'string' ||
        !isRecord(band) ||
        typeof band.min !== 'number' ||
        typeof band.max !== 'number' ||
        typeof band.label !== 'string'
      ) return fail('/program')
      return pass(candidate)
    },
    validateLearnerInput: (candidate) => {
      calls.inputValidation += 1
      return isRecord(candidate) &&
        typeof candidate.raw === 'string' &&
        candidate.raw.length <= 2000
        ? pass(candidate)
        : fail('/raw')
    },
    validateTutorResponse: (candidate) => {
      calls.responseValidation += 1
      return isRecord(candidate) && candidate.schemaValidResponse === true
        ? pass(candidate)
        : fail('/response')
    },
    validateAdultReview: (candidate) => {
      calls.reviewValidation += 1
      return isRecord(candidate) && candidate.schemaValidReview === true
        ? pass(candidate)
        : fail('/review')
    },
    createEngine: (program) => {
      calls.construction += 1
      constructedPrograms.push(program)
      const engine = options.createEngine?.(program) ?? new TestEngine(program)
      engines.push(engine)
      return engine
    },
  }
  return { adapter, constructedPrograms, engines, calls }
}
