import {
  AdaptiveTutorEngine,
  evaluateAssessmentItem,
  type ParentTeacherReview,
  type TutorResponse,
  type VisualBoardCommand,
} from '../../adaptive-tutor/core/index.js'
import {
  coreChangeRequests,
  englishModules,
  integrationMatrix,
  validateEnglishModule,
  type EnglishModulePackage,
  type EnglishTutorMode,
  type ParentTeacherNotes,
} from '../../adaptive-tutor/subjects/english/src/index.js'

export const ENGLISH_MODE_LABELS: ReadonlyArray<{
  id: EnglishTutorMode
  label: string
}> = [
  { id: 'show-me', label: 'Show Me' },
  { id: 'talk-me-through-it', label: 'Talk Me Through It' },
  { id: 'lets-do-one-together', label: "Let's Do One Together" },
  { id: 'different-example', label: 'Different Example' },
]

export const adaptiveEnglishModules: readonly EnglishModulePackage[] = englishModules

const validationFailures = adaptiveEnglishModules.flatMap((module) =>
  validateEnglishModule(module).filter((check) => !check.passed),
)

if (validationFailures.length > 0) {
  throw new Error(
    `Frozen Adaptive English package failed host validation: ${validationFailures
      .map((failure) => `${failure.moduleId}/${failure.contract}: ${failure.detail}`)
      .join('; ')}`,
  )
}

if (coreChangeRequests.length > 0) {
  throw new Error('Adaptive English unexpectedly requires a Tutor Core change.')
}

export const adaptiveEnglishClassification = Object.freeze(
  integrationMatrix.reduce(
    (counts, entry) => {
      counts[entry.classification] += 1
      return counts
    },
    {
      PASS_DIRECT_CORE_V0_2: 0,
      PASS_PROVISIONAL_ADAPTER: 0,
      BLOCKED_CORE_CHANGE: 0,
      NOT_TESTED: 0,
    },
  ),
)

export interface EnglishReasoningReveal {
  itemId: string
  reasoning: string
  correct: boolean
}

export interface EnglishTutorSession {
  engine: AdaptiveTutorEngine
  coreResponse: TutorResponse
  supportMode: EnglishTutorMode | null
  selectedOptionId: string
  answerFeedback: string
  reasoningReveal: EnglishReasoningReveal | null
  writingDraft: string
  writingFeedback: string
  audioFallback: string
  transcriptOpen: boolean
}

export interface EnglishWorkspaceState {
  activeLessonId: string | null
  sessions: Record<string, EnglishTutorSession>
}

export interface EnglishAdultReview {
  profileId: string
  lessonId: string
  moduleName: string
  category: 'reading' | 'writing'
  coreReview: ParentTeacherReview
  subjectNotes: ParentTeacherNotes
}

export function createEnglishWorkspace(): EnglishWorkspaceState {
  return { activeLessonId: null, sessions: {} }
}

export function moduleById(lessonId: string): EnglishModulePackage {
  const module = adaptiveEnglishModules.find((candidate) => candidate.lessonId === lessonId)
  if (!module) throw new Error(`Unknown Adaptive English lesson: ${lessonId}`)
  return module
}

export function openEnglishModule(
  workspace: EnglishWorkspaceState,
  lessonId: string,
): EnglishWorkspaceState {
  if (workspace.sessions[lessonId]) return { ...workspace, activeLessonId: lessonId }
  const module = moduleById(lessonId)
  const engine = new AdaptiveTutorEngine(module.coreProgram, module.runtimeHooks)
  return {
    activeLessonId: lessonId,
    sessions: {
      ...workspace.sessions,
      [lessonId]: {
        engine,
        coreResponse: engine.start(),
        supportMode: null,
        selectedOptionId: '',
        answerFeedback: '',
        reasoningReveal: null,
        writingDraft: '',
        writingFeedback: '',
        audioFallback: module.coreProgram.mediaFallback.missingAudioText,
        transcriptOpen: false,
      },
    },
  }
}

export function updateActiveEnglishSession(
  workspace: EnglishWorkspaceState,
  update: (session: EnglishTutorSession, module: EnglishModulePackage) => EnglishTutorSession,
): EnglishWorkspaceState {
  const lessonId = workspace.activeLessonId
  if (!lessonId) return workspace
  const current = workspace.sessions[lessonId]
  if (!current) return workspace
  return {
    ...workspace,
    sessions: {
      ...workspace.sessions,
      [lessonId]: update(current, moduleById(lessonId)),
    },
  }
}

export function visibleEnglishResponse(
  session: EnglishTutorSession,
  module: EnglishModulePackage,
): TutorResponse {
  return session.supportMode
    ? module.coreV02Extension.modeResponses[session.supportMode]
    : session.coreResponse
}

export function chooseEnglishOption(
  session: EnglishTutorSession,
  selectedOptionId: string,
): EnglishTutorSession {
  return {
    ...session,
    selectedOptionId,
    answerFeedback: '',
    reasoningReveal: null,
  }
}

function reasoningFor(module: EnglishModulePackage, itemId: string): string {
  return (
    module.coreV02Extension.answerReasoning.find((entry) => entry.itemId === itemId)?.reasoning ??
    'Your attempt has been recorded. Compare your choice with the strategy before continuing.'
  )
}

export function submitEnglishChoice(
  session: EnglishTutorSession,
  module: EnglishModulePackage,
): EnglishTutorSession {
  const response = visibleEnglishResponse(session, module)
  const item = response.assessmentItem
  if (!item || !session.selectedOptionId) {
    return {
      ...session,
      answerFeedback: "Choose one response when you're ready.",
      reasoningReveal: null,
    }
  }

  const input = { raw: session.selectedOptionId, selectedOptionIds: [session.selectedOptionId] }
  const evaluation = evaluateAssessmentItem(item, input)
  const reasoningReveal = {
    itemId: item.id,
    reasoning: reasoningFor(module, item.id),
    correct: evaluation.isCorrect,
  }

  if (session.supportMode) {
    return {
      ...session,
      answerFeedback: evaluation.isCorrect
        ? 'That choice follows the strategy.'
        : 'That response is useful evidence. Try the smallest step again.',
      reasoningReveal,
    }
  }

  return {
    ...session,
    coreResponse: session.engine.submit(input),
    selectedOptionId: '',
    answerFeedback: evaluation.isCorrect
      ? 'That choice follows the strategy.'
      : 'That response gives us useful information, not a label.',
    reasoningReveal,
  }
}

export function continueEnglishSession(session: EnglishTutorSession): EnglishTutorSession {
  return {
    ...session,
    coreResponse: session.engine.continue(),
    supportMode: null,
    selectedOptionId: '',
    answerFeedback: '',
    reasoningReveal: null,
  }
}

export function requestEnglishSupport(
  session: EnglishTutorSession,
  mode: EnglishTutorMode,
): EnglishTutorSession {
  return {
    ...session,
    supportMode: mode,
    selectedOptionId: '',
    answerFeedback: '',
    reasoningReveal: null,
  }
}

export function returnToEnglishLesson(session: EnglishTutorSession): EnglishTutorSession {
  return {
    ...session,
    supportMode: null,
    selectedOptionId: '',
    answerFeedback: '',
    reasoningReveal: null,
  }
}

export function requestEnglishAlternate(session: EnglishTutorSession): EnglishTutorSession {
  return {
    ...session,
    coreResponse: session.engine.requestAlternateExplanation(),
    supportMode: null,
    selectedOptionId: '',
    answerFeedback: '',
    reasoningReveal: null,
  }
}

export function saveLearnerWriting(session: EnglishTutorSession): EnglishTutorSession {
  const hasWriting = session.writingDraft.trim().length > 0
  return {
    ...session,
    writingFeedback: hasWriting
      ? 'Your revision remains your wording. You make the final change, and this draft stays only in this open app session.'
      : "Write your own revision when you're ready; the tutor will not complete it for you.",
  }
}

export function createEnglishAdultReview(
  profileId: string,
  module: EnglishModulePackage,
  session: EnglishTutorSession,
): EnglishAdultReview {
  return {
    profileId,
    lessonId: module.lessonId,
    moduleName: module.completedModuleName,
    category: module.category,
    coreReview: session.engine.getReview(),
    subjectNotes: module.coreV02Extension.parentTeacherNotes,
  }
}

export function boardCommandText(command: VisualBoardCommand): string | null {
  switch (command.kind) {
    case 'clear-board':
    case 'set-title':
    case 'aria-announce':
      return null
    case 'add-text':
    case 'reveal-step':
      return command.text
    case 'show-sentence-parts':
      return `${command.sentence} — subject: ${command.subject}; predicate: ${command.predicate}`
    case 'highlight':
      return `Notice “${command.token}”: ${command.reason}`
    case 'compare':
      return `${command.leftLabel} ↔ ${command.rightLabel}`
    case 'draw-fraction':
      return `${command.label}: ${command.numerator}/${command.denominator}`
    case 'draw-number-line':
      return `Number line from ${command.min} to ${command.max}; highlighted: ${command.highlightedValues.join(', ')}`
    default:
      return (command as { ariaLabel?: string }).ariaLabel ?? 'Visual support is unavailable.'
  }
}
