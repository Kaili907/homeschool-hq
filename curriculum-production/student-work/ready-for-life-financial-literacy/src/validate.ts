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
  // completionAuthority === 'learner'
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

/** Every realWorldAction:true package must offer a non-null simulation/safe alternative. */
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

const CREDENTIAL_REQUEST_PATTERNS: RegExp[] = [
  /\benter your (real |actual )?(bank account|card|credit card|debit card|routing) number\b/i,
  /\benter your (real |actual )?(password|pin|ssn|social security)\b/i,
  /\bwhat is your (real |actual |family'?s )?(bank account|card|credit card|password|pin|ssn|social security)\b/i,
  /\btype (your|in your) (real |actual )?(password|pin|account number|card number|ssn|social security)\b/i,
]

/**
 * Lints every student-facing string in the corpus for language that would
 * itself constitute requesting a real financial credential from a learner.
 * This is a content lint over authored text, not a claim about runtime
 * behavior; it is the reason financialSafety.neverRequestsRealCredentials
 * can be asserted rather than merely declared.
 *
 * Fictional scam-message text is deliberately authored inside single quotes
 * throughout this corpus (e.g. 'Enter your card number here to claim it')
 * precisely so learners can practice recognizing real scam phrasing; that
 * quoted example text is stripped before matching so teaching a scam pattern
 * is never itself flagged as making the request.
 */
export function lintNoRealCredentialRequests(entry: CorpusEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  // Only a quote preceded by whitespace/start-of-string is treated as an
  // opening quote (e.g. "Message A: 'Hi ...'"); this deliberately excludes
  // contraction/possessive apostrophes like "item's", which are never
  // preceded by whitespace, so those are left untouched rather than
  // mismatched against an unrelated quote elsewhere in the same string.
  const stripQuotedExamples = (s: string) => s.replace(/(^|\s)'[^']*'/g, '$1')
  const serialized = stripQuotedExamples(JSON.stringify(entry.pkg)) + stripQuotedExamples(JSON.stringify(entry.scoring))
  for (const pattern of CREDENTIAL_REQUEST_PATTERNS) {
    pushIf(
      issues,
      pattern.test(serialized),
      'no-real-credential-request',
      entry.pkg.packageId,
      `content matches a real-credential-request pattern: ${pattern}`,
    )
  }
  return issues
}

/** financial-literacy packages must declare the two safety flags; ready-for-life packages must not carry them (not applicable). */
export function validateFinancialSafetyFlag(entry: CorpusEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { pkg } = entry
  if (pkg.lessonRef.subject === 'financial-literacy') {
    pushIf(
      issues,
      pkg.financialSafety?.neverRequestsRealCredentials !== true || pkg.financialSafety?.noIndividualizedAdvice !== true,
      'financial-safety-flag',
      pkg.packageId,
      'financial-literacy package missing financialSafety.neverRequestsRealCredentials / noIndividualizedAdvice',
    )
  }
  return issues
}

/** financial-literacy is always fictional; a real financial-literacy scenario would be a scope violation. */
export function validateFinLitAlwaysFictional(entry: CorpusEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { pkg } = entry
  if (pkg.lessonRef.subject === 'financial-literacy') {
    pushIf(issues, pkg.isFictionalSimulation !== true, 'finlit-always-fictional', pkg.packageId, 'financial-literacy package is not marked isFictionalSimulation')
    pushIf(issues, pkg.realWorldAction !== false, 'finlit-always-fictional', pkg.packageId, 'financial-literacy package has realWorldAction true')
    pushIf(issues, pkg.completionAuthority !== 'learner', 'finlit-always-fictional', pkg.packageId, 'financial-literacy package has a non-learner completionAuthority')
  }
  return issues
}

export function validateEntry(entry: CorpusEntry): ValidationIssue[] {
  return [
    ...validateNoAnswerLeakage(entry),
    ...validateAttestationShape(entry),
    ...validateSimulationAlternative(entry),
    ...lintNoRealCredentialRequests(entry),
    ...validateFinancialSafetyFlag(entry),
    ...validateFinLitAlwaysFictional(entry),
  ]
}

export function validateCorpus(entries: readonly CorpusEntry[]): ValidationIssue[] {
  return entries.flatMap(validateEntry)
}
