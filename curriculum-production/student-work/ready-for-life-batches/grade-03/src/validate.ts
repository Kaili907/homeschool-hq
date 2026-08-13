import type { CorpusEntry, CompletionAuthority, SignOff, TaskSheetPackage } from './types.ts'

export interface ValidationIssue {
  readonly rule: string
  readonly packageId: string
  readonly detail: string
}

/**
 * A learner's own completion click. This is the ONLY thing a learner-driven
 * UI can ever produce on its own — it is never sufficient by itself to
 * certify a guardian-required task.
 */
export interface LearnerAssertion {
  readonly completed: true
  readonly timestampIso: string
}

/**
 * A household-authorized guardian's certification of a real-world task,
 * captured through a guardian-facing surface, never a learner-facing one.
 */
export interface AdultAttestation {
  readonly certifyingActor: 'household-authorized guardian'
  readonly observedTaskDescription: string
  readonly timestampIso: string
}

export type CompletionStatus = 'CERTIFIED' | 'RECORDED_PENDING_GUARDIAN_ATTESTATION' | 'NOT_STARTED'

/**
 * The attestation invariant this whole package exists to enforce: a task
 * whose package.completionAuthority is 'guardian' can NEVER reach CERTIFIED
 * from a learner assertion alone. Only a real AdultAttestation object,
 * distinct from the learner's own click, can certify it.
 */
export function computeCompletionStatus(
  pkg: Pick<TaskSheetPackage, 'completionAuthority'>,
  learnerAssertion: LearnerAssertion | null,
  adultAttestation: AdultAttestation | null,
): CompletionStatus {
  if (pkg.completionAuthority === 'guardian') {
    return adultAttestation !== null ? 'CERTIFIED' : 'RECORDED_PENDING_GUARDIAN_ATTESTATION'
  }
  return learnerAssertion !== null ? 'CERTIFIED' : 'NOT_STARTED'
}

function pushIf(issues: ValidationIssue[], condition: boolean, rule: string, packageId: string, detail: string) {
  if (condition) issues.push({ rule, packageId, detail })
}

const ANSWER_BEARING_KEYS = ['answer', 'answerIndex', 'solutionReasoning', 'commonErrors', 'scoringAuthority', 'criteria']

/** No answer-bearing field may appear anywhere in a student-facing package. */
export function validateNoAnswerLeakage(entry: CorpusEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const serialized = JSON.stringify(entry.pkg)
  for (const key of ANSWER_BEARING_KEYS) {
    pushIf(
      issues,
      serialized.includes(`"${key}"`),
      'no-answer-leakage',
      entry.pkg.packageId,
      `student-facing package contains answer-bearing key "${key}"`,
    )
  }
  return issues
}

/**
 * The attestation shape invariant at rest: 'guardian' packages must carry a
 * real sign-off block with the non-certifying learner-self-report marker;
 * 'learner' packages must carry no sign-off block at all.
 */
export function validateAttestationShape(entry: CorpusEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { pkg } = entry
  const authority: CompletionAuthority = pkg.completionAuthority

  if (authority === 'guardian') {
    pushIf(issues, pkg.signOff === null, 'attestation-shape', pkg.packageId, 'completionAuthority is guardian but signOff is null')
    if (pkg.signOff !== null) {
      const signOff = pkg.signOff as SignOff
      pushIf(
        issues,
        signOff.studentSelfReport !== 'recorded-but-not-certifying',
        'attestation-shape',
        pkg.packageId,
        'guardian signOff must mark studentSelfReport as recorded-but-not-certifying',
      )
      pushIf(
        issues,
        signOff.certifyingActor !== 'household-authorized guardian',
        'attestation-shape',
        pkg.packageId,
        'guardian signOff must name a household-authorized guardian as certifyingActor',
      )
      pushIf(issues, signOff.identifiablePhotoRequired !== false, 'attestation-shape', pkg.packageId, 'guardian signOff must not require an identifiable photo')
    }
    pushIf(issues, pkg.realWorldAction !== true, 'attestation-shape', pkg.packageId, 'completionAuthority is guardian but realWorldAction is not true')
  } else {
    pushIf(issues, pkg.signOff !== null, 'attestation-shape', pkg.packageId, 'completionAuthority is learner but signOff is non-null')
  }
  return issues
}

/** Every realWorldAction:true package must offer a non-null simulation/equal-credit alternative. */
export function validateSimulationAlternative(entry: CorpusEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { pkg } = entry
  if (pkg.realWorldAction) {
    pushIf(
      issues,
      pkg.simulationAlternative === null || pkg.simulationAlternative.description.trim().length === 0,
      'simulation-alternative-required',
      pkg.packageId,
      'realWorldAction is true but simulationAlternative is missing or empty',
    )
  }
  return issues
}

/** No package may require a photograph, video, or voice recording, or ask a learner to purchase anything. */
const PHOTO_VIDEO_VOICE_PATTERNS: RegExp[] = [
  /\btake a (photo|picture|video)\b/i,
  /\brecord (a |your )?(video|voice|audio)\b/i,
  /\bupload (a |your )?(photo|picture|video|recording)\b/i,
]
const PURCHASE_PATTERNS: RegExp[] = [/\bbuy\b/i, /\bpurchase\b/i, /\border online\b/i]

export function validateNoPhotoVideoVoiceOrPurchase(entry: CorpusEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const serialized = JSON.stringify(entry.pkg)
  for (const pattern of PHOTO_VIDEO_VOICE_PATTERNS) {
    pushIf(issues, pattern.test(serialized), 'no-photo-video-voice', entry.pkg.packageId, `content matches a photo/video/voice-capture pattern: ${pattern}`)
  }
  for (const pattern of PURCHASE_PATTERNS) {
    pushIf(issues, pattern.test(serialized), 'no-required-purchase', entry.pkg.packageId, `content matches a purchase-requiring pattern: ${pattern}`)
  }
  return issues
}

/** Materials/tasks must not assume every household has the same resources, transportation, or family structure. */
const ASSUMED_ACCESS_PATTERNS: RegExp[] = [
  /\byour (mom|dad|mother|father)\b/i,
  /\bask your parents\b/i,
  /\bdrive to\b/i,
  /\byour own (car|vehicle|bedroom)\b/i,
  /\byour (siblings|brother|sister)\b/i,
  /\byour pet\b/i,
]

export function validateNoAssumedAccess(entry: CorpusEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const serialized = JSON.stringify(entry.pkg)
  for (const pattern of ASSUMED_ACCESS_PATTERNS) {
    pushIf(
      issues,
      pattern.test(serialized),
      'no-assumed-household-access',
      entry.pkg.packageId,
      `content assumes a specific household/transportation/resource shape: ${pattern}`,
    )
  }
  return issues
}

export function validateEntry(entry: CorpusEntry): ValidationIssue[] {
  return [
    ...validateNoAnswerLeakage(entry),
    ...validateAttestationShape(entry),
    ...validateSimulationAlternative(entry),
    ...validateNoPhotoVideoVoiceOrPurchase(entry),
    ...validateNoAssumedAccess(entry),
  ]
}

export function validateCorpus(entries: readonly CorpusEntry[]): ValidationIssue[] {
  return entries.flatMap(validateEntry)
}
