import type {
  AgeBand,
  AnswerWithheldSafetyEvent,
  EmergencyLanguageSafetyEvent,
  EscalationLevel,
  ParentNotification,
  SafetyClassification,
  SafetyEvent,
  SafetySeverity,
  TutorAccessDecision,
  WithheldReason,
} from './contracts.ts'
import { AI_SAFETY_SCHEMA_VERSION } from './contracts.ts'

export const AI_SAFETY_POLICY_VERSION = 'manuel-ai-safety-1.0'

export interface PolicyEvaluationInput {
  readonly text: string
  readonly ageBand: AgeBand
  readonly direction: 'student-to-tutor' | 'tutor-to-student'
  /** Pass the result of evaluateTutorAccess before a session/turn. */
  readonly accessDecision?: TutorAccessDecision
  /** Set only after a deterministic answer-leak check in the tutor adapter. */
  readonly answerLeakDetected?: boolean
}

export interface AllowedPolicyDecision {
  readonly action: 'allow'
}

export interface WithheldPolicyDecision {
  readonly action: 'withhold'
  readonly classification: SafetyClassification
  readonly severity: SafetySeverity
  readonly escalation: EscalationLevel
  readonly withheldReason: WithheldReason
  readonly studentExplanation: string
  readonly parentSummary: string
  readonly canContinueLearning: boolean
}

export interface EscalatedPolicyDecision {
  readonly action: 'pause-and-escalate'
  readonly classification:
    | 'potential-self-harm'
    | 'potential-immediate-danger'
    | 'potential-abuse-or-unsafe-situation'
  readonly severity: 'critical'
  readonly escalation: 'human-safety-review'
  readonly withheldReason: 'safety-concern'
  readonly studentExplanation: string
  readonly parentSummary: string
  readonly canContinueLearning: false
}

export type PolicyDecision =
  | AllowedPolicyDecision
  | WithheldPolicyDecision
  | EscalatedPolicyDecision

export const SAFETY_CLASSIFICATION_DEFAULTS: Readonly<
  Record<SafetyClassification, { readonly severity: SafetySeverity; readonly escalation: EscalationLevel }>
> = {
  'answer-integrity': { severity: 'info', escalation: 'record-for-parent' },
  'academic-integrity': { severity: 'low', escalation: 'record-for-parent' },
  'age-inappropriate-content': { severity: 'moderate', escalation: 'parent-review' },
  'dangerous-activity': { severity: 'high', escalation: 'urgent-parent-attention' },
  'harassment-or-hate': { severity: 'moderate', escalation: 'parent-review' },
  'medical-boundary': { severity: 'low', escalation: 'record-for-parent' },
  'legal-boundary': { severity: 'low', escalation: 'record-for-parent' },
  'potential-self-harm': { severity: 'critical', escalation: 'human-safety-review' },
  'potential-immediate-danger': { severity: 'critical', escalation: 'human-safety-review' },
  'potential-abuse-or-unsafe-situation': {
    severity: 'critical',
    escalation: 'human-safety-review',
  },
  'privacy-or-personal-data': { severity: 'moderate', escalation: 'parent-review' },
  'prompt-injection': { severity: 'low', escalation: 'record-for-parent' },
  'restricted-subject': { severity: 'info', escalation: 'record-for-parent' },
  'sexual-content': { severity: 'high', escalation: 'urgent-parent-attention' },
  'violent-content': { severity: 'high', escalation: 'urgent-parent-attention' },
  'student-report': { severity: 'moderate', escalation: 'parent-review' },
  'student-block': { severity: 'moderate', escalation: 'parent-review' },
  'model-policy-failure': { severity: 'high', escalation: 'human-safety-review' },
  'access-control': { severity: 'info', escalation: 'record-for-parent' },
}

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function emergencyClassification(
  text: string,
): EscalatedPolicyDecision['classification'] | undefined {
  const value = normalize(text)
  const selfHarmPatterns = [
    /\b(?:i|i'm|im)\s+(?:really\s+)?(?:want|plan|intend|need)\s+to\s+(?:die|kill myself|end my life|hurt myself)\b/,
    /\b(?:i|i'm|im)\s+(?:am\s+)?(?:going to|gonna|might|will)\s+(?:kill myself|hurt myself|end my life)\b/,
    /\b(?:i|i've|ive)\s+(?:been\s+)?(?:cutting|hurting)\s+myself\b/,
    /\bi\s+cannot\s+keep\s+myself\s+safe\b/,
  ]
  if (selfHarmPatterns.some((pattern) => pattern.test(value))) {
    return 'potential-self-harm'
  }
  const immediateDangerPatterns = [
    /\bi(?:'m| am)?\s+in\s+(?:immediate\s+)?danger\b/,
    /\bsomeone\s+is\s+(?:trying\s+to|going\s+to)\s+(?:hurt|kill)\s+me\b/,
    /\bi\s+cannot\s+get\s+away\s+from\s+someone\b/,
    /\bsomeone\s+has\s+a\s+(?:gun|weapon)\s+(?:here|near me)\b/,
  ]
  if (immediateDangerPatterns.some((pattern) => pattern.test(value))) {
    return 'potential-immediate-danger'
  }
  const unsafeSituationPatterns = [
    /\bi(?:'m| am)?\s+not\s+safe\s+(?:at\s+home|with\s+(?:my\s+)?(?:parent|guardian|adult|teacher|coach))\b/,
    /\b(?:someone|an adult|my (?:parent|guardian|teacher|coach))\s+(?:hits|hurts|threatens)\s+me\b/,
    /\b(?:someone|an adult)\s+(?:touched|touches)\s+me\s+(?:and|in a way)\s+(?:i|it)\s+(?:didn't|did not|dont|don't)\s+(?:like|want|feel safe)\b/,
  ]
  if (unsafeSituationPatterns.some((pattern) => pattern.test(value))) {
    return 'potential-abuse-or-unsafe-situation'
  }
  return undefined
}

const contentRules: readonly {
  readonly classification: SafetyClassification
  readonly withheldReason: WithheldReason
  readonly pattern: RegExp
  readonly parentSummary: string
}[] = [
  {
    classification: 'dangerous-activity',
    withheldReason: 'harmful-instructions',
    pattern:
      /\b(?:how (?:do|can|would) (?:i|you)|steps? to|instructions? (?:for|to))\s+(?:make (?:a )?(?:bomb|explosive|poison)|poison someone|hide a weapon|break into)\b/i,
    parentSummary: 'The tutor withheld instructions that could enable a dangerous activity.',
  },
  {
    classification: 'violent-content',
    withheldReason: 'harmful-instructions',
    pattern:
      /\b(?:best way to|how (?:do|can) i|tell me how to)\s+(?:hurt|attack|kill)\s+(?:someone|a person|them)\b/i,
    parentSummary: 'The tutor withheld instructions for harming another person.',
  },
  {
    classification: 'sexual-content',
    withheldReason: 'age-inappropriate',
    pattern:
      /\b(?:show|write|describe|make)\s+(?:me\s+)?(?:explicit|pornographic|sexual)\s+(?:content|story|picture|scene)\b/i,
    parentSummary: 'The tutor withheld age-inappropriate sexual content.',
  },
  {
    classification: 'harassment-or-hate',
    withheldReason: 'harmful-instructions',
    pattern:
      /\b(?:write|make|give me)\s+(?:a\s+)?(?:hateful|racist|sexist|homophobic)\s+(?:message|joke|insult|post)\b/i,
    parentSummary: 'The tutor withheld hateful or harassing content.',
  },
  {
    classification: 'medical-boundary',
    withheldReason: 'human-review-required',
    pattern:
      /\b(?:diagnose me|what medicine should i take|how much (?:medicine|medication) should i take|should i stop taking (?:my )?(?:medicine|medication))\b/i,
    parentSummary: 'The tutor declined a request for personal medical guidance.',
  },
  {
    classification: 'legal-boundary',
    withheldReason: 'human-review-required',
    pattern:
      /\b(?:can i sue|should i sue|give me legal advice|what should i tell (?:the police|a judge)|is it legal for me to)\b/i,
    parentSummary: 'The tutor declined a request for personal legal guidance.',
  },
  {
    classification: 'privacy-or-personal-data',
    withheldReason: 'privacy-request',
    pattern:
      /\b(?:keep (?:this|it) secret from (?:my )?(?:parent|guardian)|don't tell (?:my )?(?:parent|guardian)|promise (?:this|it) is private|what is (?:their|my) (?:password|home address|phone number))\b/i,
    parentSummary: 'The tutor explained the parent-review and safety-exception privacy boundary.',
  },
  {
    classification: 'prompt-injection',
    withheldReason: 'prompt-injection',
    pattern:
      /\b(?:ignore (?:all|your|the) (?:previous|safety|system) (?:rules|instructions)|reveal (?:your|the) system prompt|turn (?:off|disable) (?:the )?safety|pretend (?:the )?safety rules)\b/i,
    parentSummary: 'The tutor ignored an attempt to bypass its safety instructions.',
  },
  {
    classification: 'academic-integrity',
    withheldReason: 'direct-answer-request',
    pattern:
      /\b(?:write (?:my|this) (?:essay|report) for me|do (?:my|this) (?:test|quiz|homework) for me|complete (?:my|this) assignment)\b/i,
    parentSummary: 'The tutor declined to complete assessed work for the student.',
  },
] as const

const directAnswerPattern =
  /\b(?:just\s+)?(?:give|tell|show)\s+me\s+(?:the\s+)?(?:final\s+)?answer\b|\bwhat(?:'s| is)\s+the\s+answer\b/i

const accessReasonToWithheld: Readonly<
  Record<Exclude<TutorAccessDecision, { allowed: true }>['reason'], WithheldReason>
> = {
  'permission-disabled': 'permission-disabled',
  'restricted-subject': 'restricted-subject',
  'outside-allowed-time': 'outside-allowed-time',
  'daily-session-limit': 'daily-session-limit',
  'session-time-limit': 'session-time-limit',
  'voice-input-disabled': 'voice-input-disabled',
  'student-blocked': 'student-blocked',
}

function ageAppropriateEmergencyExplanation(ageBand: AgeBand): string {
  if (ageBand === 'under-8') {
    return 'I’m glad you told me. Please stop and get a trusted grown-up with you now. I will pause the tutor so a grown-up can review this safety concern.'
  }
  if (ageBand === '8-12') {
    return 'I’m glad you told me. I can’t safely handle this by myself. Please pause and get a trusted adult with you now; this safety concern needs an authorized human review.'
  }
  return 'Thank you for saying this. I’m pausing the tutor because this may be an urgent safety concern. Please get a trusted adult with you now; an authorized human needs to review the concern.'
}

export function refusalExplanation(reason: WithheldReason, ageBand: AgeBand): string {
  const young = ageBand === 'under-8'
  switch (reason) {
    case 'direct-answer-request':
    case 'answer-leak-detected':
      return young
        ? 'I can’t give the answer, but I can help with one small hint.'
        : 'I can’t provide the final answer, but I can help you work through the next small step.'
    case 'restricted-subject':
      return young
        ? 'The tutor is not turned on for this subject. Ask your grown-up what you can use.'
        : 'Tutor access is not enabled for this subject. An authorized parent can review the setting.'
    case 'outside-allowed-time':
      return young
        ? 'It is not tutor time right now. You can come back during your allowed time.'
        : 'This is outside your allowed tutor hours. You can return during an allowed session window.'
    case 'daily-session-limit':
      return young
        ? 'You used all of today’s tutor turns. You can ask a grown-up or come back another day.'
        : 'You reached today’s tutor-session limit. Ask an authorized parent if you need another option.'
    case 'session-time-limit':
      return young
        ? 'This tutor time is finished. Take a break or ask a grown-up for help.'
        : 'This session reached its time limit. Save your place and use another approved learning option.'
    case 'permission-disabled':
      return young
        ? 'The tutor is turned off right now. Ask your grown-up for another way to get help.'
        : 'Tutor access is disabled in your learning settings. An authorized parent can review it.'
    case 'voice-input-disabled':
      return young
        ? 'Voice is turned off, but you can type if the tutor is available.'
        : 'Voice input is disabled. You can use text tutoring when access is available.'
    case 'privacy-request':
      return young
        ? 'I can’t promise a secret. A parent can review tutor chats, and a safety concern may be shared with a trusted grown-up.'
        : 'I can’t promise that tutor messages are private. An authorized parent can review chats, and safety concerns may be shared for human review.'
    case 'harmful-instructions':
      return young
        ? 'I can’t help with something that could hurt a person. I can help with a safe learning question.'
        : 'I can’t provide instructions that could harm someone. I can help with a safe, educational version of the topic.'
    case 'age-inappropriate':
      return young
        ? 'I can’t show that. Let’s choose a safe learning topic.'
        : 'I can’t provide that content. I can help with an age-appropriate educational topic instead.'
    case 'prompt-injection':
      return young
        ? 'I have to keep the safety rules on. Let’s go back to learning.'
        : 'I can’t disable or reveal protected safety instructions. We can continue with the learning task.'
    case 'student-blocked':
      return young
        ? 'You blocked the tutor. It will stay stopped until you or a trusted grown-up reviews it.'
        : 'Your tutor block is active. Tutoring will remain stopped until the block is reviewed.'
    case 'human-review-required':
      return young
        ? 'I can’t give personal medical or legal advice. Please ask a trusted grown-up.'
        : 'I can explain general educational information, but I can’t provide personal medical or legal advice. Ask a trusted adult or qualified professional.'
    case 'safety-concern':
      return ageAppropriateEmergencyExplanation(ageBand)
    case 'history-unavailable':
      return 'Tutor history is unavailable right now. No missing conversation details will be guessed.'
  }
}

function withheld(
  ageBand: AgeBand,
  classification: SafetyClassification,
  withheldReason: WithheldReason,
  parentSummary: string,
  canContinueLearning = true,
): WithheldPolicyDecision {
  const defaults = SAFETY_CLASSIFICATION_DEFAULTS[classification]
  return {
    action: 'withhold',
    classification,
    severity: defaults.severity,
    escalation: defaults.escalation,
    withheldReason,
    studentExplanation: refusalExplanation(withheldReason, ageBand),
    parentSummary,
    canContinueLearning,
  }
}

/**
 * Pure policy evaluation. It returns classifications and safe explanations but
 * never echoes or stores the input text.
 */
export function evaluateSafetyPolicy(input: PolicyEvaluationInput): PolicyDecision {
  if (input.accessDecision && !input.accessDecision.allowed) {
    const reason = accessReasonToWithheld[input.accessDecision.reason]
    const classification =
      input.accessDecision.reason === 'restricted-subject'
        ? 'restricted-subject'
        : 'access-control'
    return withheld(
      input.ageBand,
      classification,
      reason,
      `Tutor access was denied by the ${input.accessDecision.reason} control.`,
      false,
    )
  }

  const boundedText = input.text.slice(0, 20_000)
  const emergency = emergencyClassification(boundedText)
  if (input.direction === 'student-to-tutor' && emergency) {
    return {
      action: 'pause-and-escalate',
      classification: emergency,
      severity: 'critical',
      escalation: 'human-safety-review',
      withheldReason: 'safety-concern',
      studentExplanation: ageAppropriateEmergencyExplanation(input.ageBand),
      parentSummary:
        'The local policy detected possible urgent safety language. The tutor paused without making a diagnosis or contacting an external service.',
      canContinueLearning: false,
    }
  }

  if (input.direction === 'tutor-to-student' && input.answerLeakDetected) {
    return withheld(
      input.ageBand,
      'answer-integrity',
      'answer-leak-detected',
      'A tutor answer was withheld because a deterministic output check detected the final answer.',
    )
  }

  for (const rule of contentRules) {
    if (rule.pattern.test(boundedText)) {
      return withheld(
        input.ageBand,
        rule.classification,
        rule.withheldReason,
        rule.parentSummary,
      )
    }
  }

  if (input.direction === 'student-to-tutor' && directAnswerPattern.test(boundedText)) {
    return withheld(
      input.ageBand,
      'answer-integrity',
      'direct-answer-request',
      'The tutor declined a request for the final answer and offered guided help.',
    )
  }

  return { action: 'allow' }
}

export interface PolicyEventContext {
  readonly eventId: string
  readonly sessionId: string
  readonly studentId: string
  readonly subjectId: string
  readonly occurredAt: string
  readonly evidenceRefs?: readonly string[]
  readonly detector?: SafetyEvent['detector']
}

export function materializePolicyEvent(
  decision: Exclude<PolicyDecision, AllowedPolicyDecision>,
  context: PolicyEventContext,
): AnswerWithheldSafetyEvent | EmergencyLanguageSafetyEvent {
  const common = {
    schemaVersion: AI_SAFETY_SCHEMA_VERSION,
    createdAt: context.occurredAt,
    eventId: context.eventId,
    sessionId: context.sessionId,
    studentId: context.studentId,
    subjectId: context.subjectId,
    occurredAt: context.occurredAt,
    classification: decision.classification,
    severity: decision.severity,
    escalation: decision.escalation,
    summary: decision.parentSummary,
    evidenceRefs: context.evidenceRefs ?? [],
    detector: context.detector ?? 'local-policy',
    parentVisible: true as const,
    rawMicrophoneRecordingStored: false as const,
  }
  if (decision.action === 'pause-and-escalate') {
    return {
      ...common,
      kind: 'emergency-language-event',
      classification: decision.classification,
      severity: 'critical',
      escalation: 'human-safety-review',
      sessionAction: 'pause-and-seek-trusted-adult',
      responseProtocol: 'trusted-adult-now-and-authorized-human-review',
      hotlineInformationProvided: false,
      emergencyServicesContacted: false,
    }
  }
  return {
    ...common,
    kind: 'answer-withheld-event',
    withheldReason: decision.withheldReason,
    studentExplanation: decision.studentExplanation,
    canContinueLearning: decision.canContinueLearning,
  }
}

export function createParentNotification(
  event: SafetyEvent,
  input: {
    readonly notificationId: string
    readonly recipientActorId: string
    readonly createdAt: string
  },
): ParentNotification | undefined {
  if (event.escalation === 'none') return undefined
  const urgency =
    event.escalation === 'human-safety-review' ||
    event.escalation === 'urgent-parent-attention'
      ? 'urgent'
      : event.escalation === 'parent-review'
        ? 'prompt'
        : 'when-convenient'
  return {
    kind: 'parent-notification',
    schemaVersion: AI_SAFETY_SCHEMA_VERSION,
    createdAt: input.createdAt,
    notificationId: input.notificationId,
    eventId: event.eventId,
    studentId: event.studentId,
    recipientActorId: input.recipientActorId,
    channel: 'in-app',
    urgency,
    title: urgency === 'urgent' ? 'Tutor safety review needed' : 'Tutor safety event',
    summary: event.summary,
    includedData: ['session-metadata', 'safe-event-summary', 'timeline-reference'],
    includesRawTranscript: false,
    status: 'pending',
  }
}

/**
 * Defense-in-depth check for generated emergency copy and seeded fixtures.
 * It catches invented hotline numbers and claims that an external service was
 * contacted. It is not a substitute for the fixed response templates above.
 */
export function containsProhibitedEmergencyClaim(text: string): boolean {
  return /\b(?:9-?1-?1|9-?8-?8|hotline|emergency services (?:were|have been|are being) contacted|we (?:called|contacted) (?:the police|an ambulance|emergency services))\b/i.test(
    text,
  )
}
