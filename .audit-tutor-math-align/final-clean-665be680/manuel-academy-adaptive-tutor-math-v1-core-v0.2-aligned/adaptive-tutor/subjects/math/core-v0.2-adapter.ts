import type {
  AdaptiveMathSequence,
  AssessmentItem,
  VisualBoardCommand,
} from './types.js'

export type CoreAssessmentPurpose =
  | 'diagnostic'
  | 'guided-practice'
  | 'independent-mastery'
  | 'reassessment'

export interface CoreGradeBand {
  min: number
  max: number
  label: string
}

export interface CoreAssessmentItem {
  id: string
  skillId: string
  purpose: CoreAssessmentPurpose
  subject: 'math'
  gradeBand: CoreGradeBand
  locale: 'en-US'
  prompt: string
  maxAttempts: number
  estimatedSeconds: number
  tags: string[]
  noCameraRequired: true
  identifyingInformationRequested: false
  kind: 'multiple-choice' | 'short-answer'
  [key: string]: unknown
}

export type CoreVisualBoardCommand = Record<string, unknown> & {
  id: string
  kind: string
  durationMs: number
  ariaLabel: string
}

export interface AdaptedVisual {
  sourceId: string
  sourceKind: string
  support:
    | 'adapter-native-number-line'
    | 'adapter-native-fraction'
    | 'adapter-structured-step'
    | 'adapter-text-fallback'
  commands: CoreVisualBoardCommand[]
}

export interface CoreSpokenTurn {
  id: string
  text: string
  locale: 'en-US'
  pace: 'slow' | 'normal' | 'brisk'
  emphasisTokens: string[]
  canInterrupt: boolean
  requireLearnerResponse: boolean
  fallbackText: string
  captionsRequired: true
  transcriptRequired: true
  claimsHumanIdentity: false
}

export interface CoreTutorResponse {
  id: string
  phase:
    | 'assessment'
    | 'identify-missing-concept'
    | 'teach-visually'
    | 'guided-practice'
    | 'independent-attempt'
    | 'reassess'
    | 'advance'
    | 'reteach'
    | 'escalated'
  skillId: string
  learnerMessage: string
  spokenTurn: CoreSpokenTurn
  boardCommands: CoreVisualBoardCommand[]
  assessmentItem: CoreAssessmentItem | null
  expectedInput: 'none' | 'continue' | 'answer' | 'adult-review'
  oneUsefulStepOnly: true
  givesFinalGradedAnswer: false
  asksLearnerToParticipate: boolean
  uncertaintyStatement: string
  confidence: null
  alternateExplanationAvailable: boolean
  escalationReason: string | null
  jarvisClaimsHumanIdentity: false
}

export interface CoreTutorProgram {
  id: string
  version: string
  title: string
  subject: 'math'
  gradeBand: CoreGradeBand
  locale: 'en-US'
  targetSkillId: string
  skillGraph: Record<string, unknown>
  diagnosticItems: CoreAssessmentItem[]
  misconceptions: Record<string, unknown>[]
  teachingSequences: Array<{
    misconceptionId: string
    turns: CoreTutorResponse[]
  }>
  guidedPractice: Record<string, unknown>
  independentMastery: Record<string, unknown>
  reassessmentItems: CoreAssessmentItem[]
  mediaFallback: CoreMediaFallback
  persistentDifficultyCycleLimit: number
}

export interface CoreMediaFallback {
  missingVisualText: string
  missingAudioText: string
  visualAlternativeCommandsAllowed: true
  captionsAlwaysVisible: true
  transcriptAlwaysAvailable: true
  lessonMayContinueWithoutMedia: true
}

const UNCERTAINTY =
  'This is a working instructional hypothesis based on limited evidence, not a diagnosis or placement decision.'

function bounded(value: string, maximum: number): string {
  const text = value.trim()
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`
}

function stableId(value: string, fallback = 'math-item'): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
  if (normalized.length >= 3) return normalized
  return fallback
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().replace(/,/g, '')
  const mixed = normalized.match(/^(-?\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) {
    const denominator = Number(mixed[3])
    if (denominator > 0) return Number(mixed[1]) + Number(mixed[2]) / denominator
  }
  const fraction = normalized.match(/^(-?\d+)\/(\d+)$/)
  if (fraction) {
    const denominator = Number(fraction[2])
    if (denominator > 0) return Number(fraction[1]) / denominator
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function fractionValue(value: unknown): { numerator: number; denominator: number } | undefined {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+)\/(\d+)$/)
    if (!match) return undefined
    const numerator = Number(match[1])
    const denominator = Number(match[2])
    if (denominator < 1 || numerator > 100 || denominator > 100) return undefined
    return { numerator, denominator }
  }
  const item = record(value)
  const numerator = numberValue(item.numerator)
  const denominator = numberValue(item.denominator)
  if (
    numerator === undefined ||
    denominator === undefined ||
    !Number.isInteger(numerator) ||
    !Number.isInteger(denominator) ||
    numerator < 0 ||
    numerator > 100 ||
    denominator < 1 ||
    denominator > 100
  ) return undefined
  return { numerator, denominator }
}

function payloadSummary(payload: Record<string, unknown>): string {
  const serialized = JSON.stringify(payload)
  return serialized === '{}' ? 'No additional visual data.' : bounded(serialized, 700)
}

function textFallback(command: VisualBoardCommand): CoreVisualBoardCommand[] {
  const description = bounded(
    `${command.altText} Visual instructions: ${payloadSummary(record(command.payload))}`,
    1200,
  )
  return [
    {
      id: stableId(`${command.id}-text`),
      kind: 'add-text',
      text: description,
      region: 'center',
      emphasis: 'normal',
      durationMs: 0,
      ariaLabel: bounded(command.altText, 500),
    },
    {
      id: stableId(`${command.id}-announce`),
      kind: 'aria-announce',
      text: bounded(command.altText, 800),
      priority: 'polite',
      durationMs: 0,
      ariaLabel: bounded(command.altText, 500),
    },
  ]
}

function numberLine(command: VisualBoardCommand): CoreVisualBoardCommand[] | undefined {
  const payload = record(command.payload)
  const candidates = [
    payload.min,
    payload.max,
    payload.start,
    payload.end,
    payload.estimateFrom,
    payload.estimateTo,
    payload.startApprox,
    payload.endApprox,
  ].map(numberValue).filter((value): value is number => value !== undefined)
  const marks = Array.isArray(payload.marks)
    ? payload.marks.map(numberValue).filter((value): value is number => value !== undefined)
    : []
  const all = [...candidates, ...marks]
  if (all.length < 2) return undefined
  const min = Math.min(...all)
  const max = Math.max(...all)
  if (!(max > min)) return undefined
  const explicitStep = [
    payload.step,
    payload.jumpSize,
    payload.subtract,
    payload.subtractApprox,
  ].map(numberValue).find((value) => value !== undefined && value > 0)
  const sorted = [...new Set(all)].sort((left, right) => left - right)
  const smallestDifference = sorted
    .slice(1)
    .map((value, index) => value - sorted[index])
    .filter((value) => value > 0)
    .sort((left, right) => left - right)[0]
  const step = explicitStep ?? smallestDifference ?? (max - min)
  return [{
    id: stableId(`${command.id}-number-line`),
    kind: 'draw-number-line',
    min,
    max,
    step,
    highlightedValues: sorted.slice(0, 30),
    durationMs: 0,
    ariaLabel: bounded(command.altText, 500),
  }]
}

function fractionCommands(command: VisualBoardCommand): CoreVisualBoardCommand[] | undefined {
  const payload = record(command.payload)
  const sourceValues: unknown[] = []
  if (payload.first !== undefined) sourceValues.push(payload.first)
  if (payload.second !== undefined) sourceValues.push(payload.second)
  if (Array.isArray(payload.fractions)) sourceValues.push(...payload.fractions)
  if (Array.isArray(payload.renamed)) sourceValues.push(...payload.renamed)
  const fractions = sourceValues
    .map(fractionValue)
    .filter((value): value is { numerator: number; denominator: number } => value !== undefined)
    .slice(0, 8)
  if (fractions.length === 0) return undefined
  const commands = fractions.map((fraction, index): CoreVisualBoardCommand => ({
    id: stableId(`${command.id}-fraction-${index + 1}`),
    kind: 'draw-fraction',
    numerator: fraction.numerator,
    denominator: fraction.denominator,
    label: `${fraction.numerator}/${fraction.denominator}`,
    representation: 'bar',
    durationMs: 0,
    ariaLabel: bounded(
      `${command.altText} Fraction ${index + 1}: ${fraction.numerator}/${fraction.denominator}.`,
      500,
    ),
  }))
  if (fractions.length >= 2) {
    commands.push({
      id: stableId(`${command.id}-compare`),
      kind: 'compare',
      leftLabel: `${fractions[0].numerator}/${fractions[0].denominator}`,
      rightLabel: `${fractions[1].numerator}/${fractions[1].denominator}`,
      relationship: 'part-whole',
      durationMs: 0,
      ariaLabel: bounded(command.altText, 500),
    })
  }
  return commands
}

function stepCommands(command: VisualBoardCommand): CoreVisualBoardCommand[] | undefined {
  const payload = record(command.payload)
  const explicitValues = [payload.steps, payload.nodes, payload.multiples]
    .find(Array.isArray)
  const values = Array.isArray(explicitValues) && explicitValues.length > 0
    ? explicitValues
    : Object.entries(payload).map(([key, value]) =>
      `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
  if (values.length === 0) return undefined
  const commands = values.slice(0, 49).map((value, index): CoreVisualBoardCommand => ({
    id: stableId(`${command.id}-step-${index + 1}`),
    kind: 'reveal-step',
    stepNumber: index + 1,
    text: bounded(String(value), 800),
    durationMs: 0,
    ariaLabel: bounded(`${command.altText} Step ${index + 1}: ${String(value)}`, 500),
  }))
  commands.push({
    id: stableId(`${command.id}-announce`),
    kind: 'aria-announce',
    text: bounded(command.altText, 800),
    priority: 'polite',
    durationMs: 0,
    ariaLabel: bounded(command.altText, 500),
  })
  return commands
}

export function adaptVisualBoardCommandV02(command: VisualBoardCommand): AdaptedVisual {
  if (command.kind === 'number-line') {
    const commands = numberLine(command)
    if (commands) {
      return {
        sourceId: command.id,
        sourceKind: command.kind,
        support: 'adapter-native-number-line',
        commands,
      }
    }
  }
  if (command.kind === 'fraction-bar') {
    const commands = fractionCommands(command)
    if (commands) {
      return {
        sourceId: command.id,
        sourceKind: command.kind,
        support: 'adapter-native-fraction',
        commands,
      }
    }
  }
  if (command.kind === 'step-diagram') {
    const commands = stepCommands(command)
    if (commands) {
      return {
        sourceId: command.id,
        sourceKind: command.kind,
        support: 'adapter-structured-step',
        commands,
      }
    }
  }
  return {
    sourceId: command.id,
    sourceKind: command.kind,
    support: 'adapter-text-fallback',
    commands: textFallback(command),
  }
}

export function coreGradeBandV02(sequence: AdaptiveMathSequence): CoreGradeBand {
  return {
    min: sequence.gradeBand.minimum,
    max: sequence.gradeBand.maximum,
    label: `Grades ${sequence.gradeBand.minimum}–${sequence.gradeBand.maximum}`,
  }
}

export function adaptAssessmentItemV02(
  item: AssessmentItem,
  sequence: AdaptiveMathSequence,
  purpose: CoreAssessmentPurpose,
  idSuffix = '',
): CoreAssessmentItem {
  const id = stableId(`${item.id}${idSuffix}`)
  const common = {
    id,
    skillId: sequence.skillIds[0],
    purpose,
    subject: 'math' as const,
    gradeBand: coreGradeBandV02(sequence),
    locale: 'en-US' as const,
    prompt: bounded(item.prompt, 2500),
    directions: 'Answer the one question shown. Explain your reasoning before any answer is discussed.',
    maxAttempts: purpose === 'guided-practice' ? 2 : 1,
    estimatedSeconds: item.type === 'open-response' ? 180 : 120,
    tags: [
      stableId(String(item.representation), 'math-representation'),
      stableId(String(item.difficultyBand), 'math-difficulty'),
      'math-core-v0-2-adapter',
    ],
    noCameraRequired: true as const,
    identifyingInformationRequested: false as const,
  }
  if (item.type === 'multiple-choice') {
    const options = (item.choices ?? []).map((choice) => ({
      id: stableId(`${id}-option-${choice.id}`),
      text: bounded(choice.text, 500),
      accessibleLabel: bounded(choice.text, 500),
    }))
    const correct = stableId(`${id}-option-${item.correctChoiceId ?? ''}`)
    return {
      ...common,
      kind: 'multiple-choice',
      options,
      correctOptionIds: [correct],
      allowMultiple: false,
      shuffle: false,
    }
  }
  const acceptedAnswers = [
    ...(item.acceptableEvidence ?? []),
    item.reasoning,
  ].filter((value, index, values) => value.trim() && values.indexOf(value) === index)
    .slice(0, 30)
    .map((value) => bounded(value, 300))
  return {
    ...common,
    kind: 'short-answer',
    acceptedAnswers,
    caseSensitive: false,
    trimWhitespace: true,
    normalization: 'basic-text',
  }
}

function spokenTurn(id: string, text: string, requireLearnerResponse: boolean): CoreSpokenTurn {
  return {
    id: stableId(`${id}-spoken`),
    text: bounded(text, 2500),
    locale: 'en-US',
    pace: 'normal',
    emphasisTokens: [],
    canInterrupt: true,
    requireLearnerResponse,
    fallbackText: bounded(text, 2500),
    captionsRequired: true,
    transcriptRequired: true,
    claimsHumanIdentity: false,
  }
}

function teachingTurn(
  sequence: AdaptiveMathSequence,
  misconceptionIndex: number,
  message: string,
): CoreTutorResponse {
  const targetSkillId = sequence.skillIds[0]
  const boards = sequence.visualExplanationPlan.boards
  const board = boards[misconceptionIndex % boards.length]
  const step = sequence.modes.showMe.steps[
    misconceptionIndex % sequence.modes.showMe.steps.length
  ]
  const learnerMessage = bounded(`${message} ${step.prompt}`, 3000)
  const id = stableId(`${sequence.sequenceId}-teach-${misconceptionIndex + 1}`)
  return {
    id,
    phase: 'teach-visually',
    skillId: targetSkillId,
    learnerMessage,
    spokenTurn: spokenTurn(id, learnerMessage, true),
    boardCommands: adaptVisualBoardCommandV02(board).commands,
    assessmentItem: null,
    expectedInput: 'answer',
    oneUsefulStepOnly: true,
    givesFinalGradedAnswer: false,
    asksLearnerToParticipate: true,
    uncertaintyStatement: UNCERTAINTY,
    confidence: null,
    alternateExplanationAvailable: true,
    escalationReason: null,
    jarvisClaimsHumanIdentity: false,
  }
}

export function mediaFallbackV02(sequence: AdaptiveMathSequence): CoreMediaFallback {
  const instructions = sequence.noMediaFallback.instructions.join(' ')
  return {
    missingVisualText: bounded(
      `The visual is unavailable. ${instructions}`,
      1600,
    ),
    missingAudioText: bounded(
      `Voice is unavailable. Read the displayed prompt and transcript instead. ${instructions}`,
      1600,
    ),
    visualAlternativeCommandsAllowed: true,
    captionsAlwaysVisible: true,
    transcriptAlwaysAvailable: true,
    lessonMayContinueWithoutMedia: true,
  }
}

export function adaptSequenceToTutorProgramV02(
  sequence: AdaptiveMathSequence,
): CoreTutorProgram {
  const gradeBand = coreGradeBandV02(sequence)
  const targetSkillId = sequence.skillIds[0]
  const diagnosticItems = sequence.diagnostic.items.map((item) =>
    adaptAssessmentItemV02(item, sequence, 'diagnostic'))
  const guidedItems = sequence.guidedPractice.items.map((item) =>
    adaptAssessmentItemV02(item, sequence, 'guided-practice'))
  const independentItems = sequence.independentMasteryCheck.items.map((item) =>
    adaptAssessmentItemV02(item, sequence, 'independent-mastery'))
  const reassessmentItems = sequence.independentMasteryCheck.items.map((item) =>
    adaptAssessmentItemV02(item, sequence, 'reassessment', '-reassess'))
  const misconceptions = sequence.misconceptions.map((misconception) => ({
    id: stableId(misconception.id),
    skillId: targetSkillId,
    label: bounded(misconception.label, 160),
    learnerSafeDescription: bounded(misconception.firstResponse, 800),
    distinguishingEvidence: misconception.distinguishingEvidence.map((evidence, index) => ({
      tag: stableId(`${misconception.id}-signal-${index + 1}`),
      direction: 'supports',
      weight: 0.8,
      explanation: bounded(evidence, 600),
    })),
    alternateExplanations: misconception.likelyEvidence.slice(0, 20)
      .map((evidence) => bounded(evidence, 600)),
    minimumEvidenceCount: 2,
    escalationAfterRepeatedCycles: 2,
  }))
  const teachingSequences = sequence.misconceptions.map((misconception, index) => ({
    misconceptionId: stableId(misconception.id),
    turns: [teachingTurn(sequence, index, misconception.firstResponse)],
  }))
  teachingSequences.push({
    misconceptionId: 'default',
    turns: [teachingTurn(
      sequence,
      sequence.misconceptions.length,
      'I do not have enough evidence to name one exact misconception, so we will try a neutral visual step.',
    )],
  })
  const hintSteps = sequence.modes.showMe.steps.slice(0, 5)
  return {
    id: stableId(sequence.sequenceId),
    version: sequence.version,
    title: sequence.title,
    subject: 'math',
    gradeBand,
    locale: 'en-US',
    targetSkillId,
    skillGraph: {
      id: stableId(`${sequence.sequenceId}-skill-graph`),
      version: sequence.version,
      nodes: sequence.skillIds.map((skillId, index) => ({
        id: skillId,
        title: bounded(sequence.objectives[index] ?? sequence.title, 160),
        description: bounded(sequence.summary, 1200),
        subject: 'math',
        gradeBand,
        observableEvidence: [
          bounded(sequence.objectives[index] ?? sequence.objectives[0], 500),
        ],
      })),
      edges: [],
    },
    diagnosticItems,
    misconceptions,
    teachingSequences,
    guidedPractice: {
      id: stableId(`${sequence.sequenceId}-guided`),
      skillId: targetSkillId,
      items: guidedItems,
      hintLadder: hintSteps.map((step, index) => ({
        level: index + 1,
        prompt: bounded(step.hint, 1200),
        revealsAnswer: false,
        visualSupportCommandIds: [stableId(step.visualCommandId)],
      })),
      maxSupportedAttemptsPerItem: 2,
      askLearnerToExplain: true,
      alternateExplanationAllowed: true,
      feedbackPolicy: 'after-second-attempt',
    },
    independentMastery: {
      id: stableId(`${sequence.sequenceId}-mastery`),
      skillId: targetSkillId,
      items: independentItems,
      minimumEvidenceCount: 5,
      minimumDistinctContexts: 2,
      minimumMeanScore: 0.8,
      maximumUncertainty: 0.4,
      reassessmentRequired: true,
      singleAnswerCanEstablishMastery: false,
      supportsTeacherOverride: true,
      placementDecisionAllowed: false,
    },
    reassessmentItems,
    mediaFallback: mediaFallbackV02(sequence),
    persistentDifficultyCycleLimit: 2,
  }
}

export function visualInventoryV02(sequence: AdaptiveMathSequence): AdaptedVisual[] {
  return sequence.visualExplanationPlan.boards.map(adaptVisualBoardCommandV02)
}
