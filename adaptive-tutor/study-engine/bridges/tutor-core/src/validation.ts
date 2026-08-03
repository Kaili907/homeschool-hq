import {
  BRIDGE_CONTRACT_VERSION,
  STUDY_TASK_TYPES,
  TUTOR_CORE_PACKAGE,
  TUTOR_CORE_VERSION,
  TUTOR_EVENT_KINDS,
  TUTOR_PHASES,
  type BridgeValidationResult,
  type PrivacyActionCode,
  type QuarantineReasonCode,
  type QuarantineRecordV1,
  type TutorBridgeEventV1,
} from "./contracts.ts";

const STUDY_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
export const TUTOR_STABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RFC3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE =
  /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/;
const CREDENTIAL =
  /\b(?:password|passcode|api[-_ ]?key|access[-_ ]?token|secret|authorization)\b\s*[:=]\s*\S+/i;
const CREDENTIAL_URL =
  /https?:\/\/(?:[^/\s:@]+:[^/\s@]+@|[^\s?#]+[?&](?:token|key|password|secret)=)/i;
const DIAGNOSIS =
  /\b(?:diagnos(?:e|ed|is)|adhd|autis(?:m|tic)|dyslexi(?:a|c)|learning disability)\b/i;

const SAFE_MESSAGES: Readonly<Record<QuarantineReasonCode, string>> = {
  "unsupported-package": "The source package is not supported by this bridge.",
  "unsupported-package-version":
    "The Tutor Core package version is not supported by this bridge.",
  "unsupported-contract-version":
    "The bridge contract version is not supported.",
  "unsupported-event-version": "The event version is not supported.",
  "unsupported-event-kind": "The event kind is not supported.",
  "malformed-event": "The event did not match the approved bridge contract.",
  "unknown-field": "The event contains an unapproved field.",
  "invalid-identifier": "The event contains an invalid opaque identifier.",
  "unmapped-identifier":
    "A required identifier does not have an approved mapping.",
  "invalid-date": "The event contains an invalid date or timestamp.",
  "invalid-time-zone": "The household time zone is invalid.",
  "credential-detected":
    "Credential-like content was rejected without being retained.",
  "diagnosis-language-detected":
    "Diagnosis language was rejected without being retained.",
  "unsafe-private-content":
    "Adult-private content was excluded from this boundary.",
  "invalid-authority-claim":
    "The event attempted to claim authority outside its source boundary.",
  "stale-checkpoint": "The recovery checkpoint is stale.",
  "checkpoint-session-mismatch":
    "The recovery checkpoint belongs to a different session.",
  "duplicate-event": "The event was already accepted and was ignored.",
  "event-id-collision":
    "The event identifier was previously accepted with different content.",
  "impossible-date": "The event date is outside the accepted range.",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const requiredSet = new Set(required);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key)) &&
    [...requiredSet].every((key) => Object.hasOwn(value, key))
  );
}

function hasUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const set = new Set(allowed);
  return Object.keys(value).some((key) => !set.has(key));
}

function isStudyId(value: unknown): value is string {
  return typeof value === "string" && STUDY_ID.test(value);
}

export function isTutorStableId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 120 &&
    TUTOR_STABLE_ID.test(value)
  );
}

export function isRFC3339(value: unknown): value is string {
  if (typeof value !== "string" || !RFC3339.test(value)) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const date = value.slice(0, 10);
  const calendar = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(calendar.valueOf()) &&
    calendar.toISOString().slice(0, 10) === date
  );
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

export function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 100) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function numberIn(
  value: unknown,
  minimum: number,
  maximum: number,
  integer = false,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum &&
    (!integer || Number.isInteger(value))
  );
}

function idArray(value: unknown, minimum = 0): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length >= minimum &&
    value.length <= 100 &&
    value.every(isStudyId) &&
    new Set(value).size === value.length
  );
}

function quarantine(
  reasonCode: QuarantineReasonCode,
  source: QuarantineRecordV1["source"],
  receivedAt: string,
  eventId?: string,
): BridgeValidationResult<never> {
  return {
    status: "quarantined",
    quarantine: {
      contract: "study-core-bridge.quarantine.v1",
      contractVersion: BRIDGE_CONTRACT_VERSION,
      quarantineId: `quarantine-${eventId && isStudyId(eventId) ? eventId : "unidentified"}`,
      reasonCode,
      source,
      ...(eventId && isStudyId(eventId) ? { eventId } : {}),
      receivedAt,
      payloadStored: false,
      rawTextStored: false,
      safeMessage: SAFE_MESSAGES[reasonCode],
    },
  };
}

function validateStudyContext(value: unknown): QuarantineReasonCode | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "studentId",
      "sessionId",
      "lessonId",
      "segmentId",
      "subjectId",
      "skillId",
      "taskType",
      "gradeBand",
      "learnerLocalDate",
      "householdTimeZone",
    ])
  ) {
    return isRecord(value) ? "unknown-field" : "malformed-event";
  }
  if (
    ![
      value.studentId,
      value.sessionId,
      value.lessonId,
      value.segmentId,
      value.subjectId,
      value.skillId,
    ].every(isStudyId)
  ) {
    return "invalid-identifier";
  }
  if (
    typeof value.taskType !== "string" ||
    !(STUDY_TASK_TYPES as readonly string[]).includes(value.taskType) ||
    !["elementary-3-5", "middle-6-8", "high-9-12"].includes(
      String(value.gradeBand),
    )
  ) {
    return "malformed-event";
  }
  if (!isISODate(value.learnerLocalDate)) return "invalid-date";
  if (!isIanaTimeZone(value.householdTimeZone)) return "invalid-time-zone";
  return null;
}

function validateAssessment(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "source",
      "outcome",
      "correctCount",
      "attemptedCount",
      "meanScore",
      "independentResponseCount",
      "distinctContextCount",
      "evidenceIds",
    ])
  ) {
    return false;
  }
  const source = String(value.source);
  const outcome = String(value.outcome);
  return (
    [
      "diagnostic",
      "guided-practice",
      "independent-attempt",
      "reassessment",
      "teacher-observation",
    ].includes(source) &&
    ["correct", "partial", "incorrect", "unscored"].includes(outcome) &&
    numberIn(value.correctCount, 0, 10_000, true) &&
    numberIn(value.attemptedCount, 1, 10_000, true) &&
    value.correctCount <= value.attemptedCount &&
    numberIn(value.meanScore, 0, 1) &&
    numberIn(value.independentResponseCount, 0, 10_000, true) &&
    numberIn(value.distinctContextCount, 0, 10_000, true) &&
    idArray(value.evidenceIds, 1)
  );
}

function validateConfidence(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "value",
      "uncertainty",
      "lowerBound",
      "upperBound",
      "evidenceCount",
      "effectiveEvidence",
      "distinctContextCount",
      "band",
      "placementDecisionAllowed",
    ])
  ) {
    return false;
  }
  return (
    numberIn(value.value, 0, 1) &&
    numberIn(value.uncertainty, 0, 1) &&
    numberIn(value.lowerBound, 0, 1) &&
    numberIn(value.upperBound, 0, 1) &&
    value.lowerBound <= value.value &&
    value.value <= value.upperBound &&
    numberIn(value.evidenceCount, 0, 10_000, true) &&
    numberIn(value.effectiveEvidence, 0, 10_000) &&
    numberIn(value.distinctContextCount, 0, 10_000, true) &&
    [
      "very-low",
      "low",
      "developing",
      "strong",
      "insufficient-evidence",
    ].includes(String(value.band)) &&
    value.placementDecisionAllowed === false
  );
}

function validateMisconception(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "selectedMisconceptionId",
      "status",
      "probability",
      "uncertainty",
      "evidenceCount",
      "doNotDiagnose",
    ])
  ) {
    return false;
  }
  return (
    (value.selectedMisconceptionId === null ||
      isTutorStableId(value.selectedMisconceptionId)) &&
    ["possible", "probable", "unlikely", "insufficient-evidence"].includes(
      String(value.status),
    ) &&
    numberIn(value.probability, 0, 1) &&
    numberIn(value.uncertainty, 0, 1) &&
    numberIn(value.evidenceCount, 0, 10_000, true) &&
    value.doNotDiagnose === true
  );
}

function validatePrerequisite(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "prerequisiteSkillIds",
      "status",
      "evidenceIds",
      "nextAction",
      "tutorGraphValidated",
    ])
  ) {
    return false;
  }
  const skills = value.prerequisiteSkillIds;
  const evidence = value.evidenceIds;
  const status = String(value.status);
  if (
    !idArray(skills) ||
    !idArray(evidence) ||
    ![
      "none-observed",
      "suspected",
      "confirmed",
      "insufficient-evidence",
    ].includes(status) ||
    !["none", "collect-more-evidence", "remediate", "adult-review"].includes(
      String(value.nextAction),
    ) ||
    value.tutorGraphValidated !== true
  ) {
    return false;
  }
  if (status === "suspected" && (skills.length < 1 || evidence.length < 1)) {
    return false;
  }
  if (status === "confirmed" && (skills.length < 1 || evidence.length < 2)) {
    return false;
  }
  return true;
}

function validateSafety(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "category",
      "severity",
      "mustEscalateToAdult",
      "mustStopAcademicFlow",
      "responseRuleIds",
    ])
  ) {
    return false;
  }
  return (
    [
      "academic-integrity",
      "identifying-information",
      "medical-or-disability-diagnosis",
      "disputed-grading",
      "persistent-difficulty",
      "high-stakes-placement",
      "self-harm-or-immediate-danger",
      "abuse-or-neglect-disclosure",
      "unsupported-subject-risk",
    ].includes(String(value.category)) &&
    ["inform", "redirect", "escalate", "urgent-escalation"].includes(
      String(value.severity),
    ) &&
    typeof value.mustEscalateToAdult === "boolean" &&
    typeof value.mustStopAcademicFlow === "boolean" &&
    idArray(value.responseRuleIds)
  );
}

function validateSpokenTurn(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "id",
      "text",
      "locale",
      "pace",
      "emphasisTokens",
      "canInterrupt",
      "requireLearnerResponse",
      "fallbackText",
      "captionsRequired",
      "transcriptRequired",
      "claimsHumanIdentity",
    ])
  ) {
    return false;
  }
  return (
    isTutorStableId(value.id) &&
    typeof value.text === "string" &&
    value.text.length >= 1 &&
    value.text.length <= 2500 &&
    typeof value.locale === "string" &&
    /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value.locale) &&
    ["slow", "normal", "brisk"].includes(String(value.pace)) &&
    Array.isArray(value.emphasisTokens) &&
    value.emphasisTokens.every(
      (token) => typeof token === "string" && token.length <= 100,
    ) &&
    typeof value.canInterrupt === "boolean" &&
    typeof value.requireLearnerResponse === "boolean" &&
    typeof value.fallbackText === "string" &&
    value.fallbackText.length >= 1 &&
    value.fallbackText.length <= 2500 &&
    value.captionsRequired === true &&
    value.transcriptRequired === true &&
    value.claimsHumanIdentity === false
  );
}

function validateNarration(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      [
        "id",
        "locale",
        "text",
        "audioUri",
        "captions",
        "voiceRequired",
        "mediaRequired",
      ],
      ["transcript"],
    )
  ) {
    return false;
  }
  return (
    isTutorStableId(value.id) &&
    typeof value.locale === "string" &&
    /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value.locale) &&
    typeof value.text === "string" &&
    value.text.length >= 1 &&
    value.text.length <= 10_000 &&
    (value.audioUri === null ||
      (typeof value.audioUri === "string" && value.audioUri.length <= 1000)) &&
    Array.isArray(value.captions) &&
    value.captions.length >= 1 &&
    value.captions.length <= 500 &&
    value.captions.every((cue) => {
      if (
        !isRecord(cue) ||
        !hasExactKeys(cue, ["id", "startMs", "endMs", "text", "speaker"])
      ) {
        return false;
      }
      return (
        isTutorStableId(cue.id) &&
        numberIn(cue.startMs, 0, Number.MAX_SAFE_INTEGER, true) &&
        numberIn(cue.endMs, 1, Number.MAX_SAFE_INTEGER, true) &&
        cue.endMs > cue.startMs &&
        typeof cue.text === "string" &&
        cue.text.length >= 1 &&
        cue.text.length <= 1000 &&
        ["jarvis", "learner", "narrator"].includes(String(cue.speaker))
      );
    }) &&
    (value.transcript === undefined || Array.isArray(value.transcript)) &&
    value.voiceRequired === false &&
    value.mediaRequired === false
  );
}

function validateMedia(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "voiceAvailable",
      "voiceReason",
      "visualAvailable",
      "visualReason",
    ]) &&
    typeof value.voiceAvailable === "boolean" &&
    ["available", "missing-api", "disabled", "error"].includes(
      String(value.voiceReason),
    ) &&
    typeof value.visualAvailable === "boolean" &&
    [
      "available",
      "missing-media",
      "unsupported-command",
      "error",
    ].includes(String(value.visualReason))
  );
}

function privacyActionsFor(
  value: Record<string, unknown> | undefined,
): readonly PrivacyActionCode[] | QuarantineReasonCode {
  if (!value) return [];
  const allowed = [
    "rawAnswer",
    "rawLearnerResponse",
    "rawTranscript",
    "learnerName",
    "email",
    "phone",
    "credential",
    "credentialUrl",
    "diagnosisLanguage",
    "adultPrivateNote",
  ] as const;
  if (hasUnknownKeys(value, allowed)) return "unknown-field";
  if (value.credential !== undefined || value.credentialUrl !== undefined) {
    return "credential-detected";
  }
  if (value.diagnosisLanguage !== undefined) {
    return "diagnosis-language-detected";
  }
  const actions: PrivacyActionCode[] = [];
  if (value.rawAnswer !== undefined) actions.push("raw-answer-removed");
  if (value.rawLearnerResponse !== undefined)
    actions.push("raw-response-removed");
  if (value.rawTranscript !== undefined)
    actions.push("raw-transcript-removed");
  if (value.learnerName !== undefined) actions.push("name-removed");
  if (value.email !== undefined) actions.push("email-removed");
  if (value.phone !== undefined) actions.push("phone-removed");
  if (value.adultPrivateNote !== undefined)
    actions.push("adult-private-note-removed");
  return actions;
}

function scanCredentialOrDiagnosis(
  value: unknown,
): "credential-detected" | "diagnosis-language-detected" | null {
  const active = new WeakSet<object>();
  const visit = (entry: unknown): ReturnType<typeof scanCredentialOrDiagnosis> => {
    if (typeof entry === "string") {
      if (CREDENTIAL.test(entry) || CREDENTIAL_URL.test(entry)) {
        return "credential-detected";
      }
      if (DIAGNOSIS.test(entry)) return "diagnosis-language-detected";
      return null;
    }
    if (typeof entry !== "object" || entry === null) return null;
    if (active.has(entry)) return "credential-detected";
    active.add(entry);
    const values = Array.isArray(entry)
      ? entry
      : Object.values(entry as Record<string, unknown>);
    for (const child of values) {
      const finding = visit(child);
      if (finding) return finding;
    }
    active.delete(entry);
    return null;
  };
  return visit(value);
}

function collectIncidentalPiiActions(value: unknown): PrivacyActionCode[] {
  const actions = new Set<PrivacyActionCode>();
  const active = new WeakSet<object>();
  const visit = (entry: unknown): void => {
    if (typeof entry === "string") {
      if (EMAIL.test(entry)) actions.add("email-removed");
      if (PHONE.test(entry)) actions.add("phone-removed");
      return;
    }
    if (typeof entry !== "object" || entry === null || active.has(entry)) return;
    active.add(entry);
    const values = Array.isArray(entry)
      ? entry
      : Object.values(entry as Record<string, unknown>);
    values.forEach(visit);
    active.delete(entry);
  };
  visit(value);
  return [...actions];
}

export function validateTutorBridgeEvent(
  input: unknown,
  options: {
    readonly receivedAt?: string;
    readonly maximumFutureSkewMs?: number;
  } = {},
): BridgeValidationResult<TutorBridgeEventV1> {
  const receivedAt = options.receivedAt ?? new Date().toISOString();
  const futureSkew = options.maximumFutureSkewMs ?? 5 * 60 * 1000;
  if (!isRecord(input)) {
    return quarantine("malformed-event", "tutor-core", receivedAt);
  }
  const candidateId =
    typeof input.eventId === "string" ? input.eventId : undefined;
  const topKeys = [
    "contract",
    "contractVersion",
    "packageName",
    "packageVersion",
    "eventVersion",
    "eventId",
    "occurredAt",
    "kind",
    "study",
    "tutor",
  ] as const;
  if (!hasExactKeys(input, topKeys)) {
    return quarantine(
      hasUnknownKeys(input, topKeys) ? "unknown-field" : "malformed-event",
      "tutor-core",
      receivedAt,
      candidateId,
    );
  }
  if (input.packageName !== TUTOR_CORE_PACKAGE) {
    return quarantine(
      "unsupported-package",
      "tutor-core",
      receivedAt,
      candidateId,
    );
  }
  if (input.packageVersion !== TUTOR_CORE_VERSION) {
    return quarantine(
      "unsupported-package-version",
      "tutor-core",
      receivedAt,
      candidateId,
    );
  }
  if (
    input.contract !== "study-core-bridge.tutor-event.v1" ||
    input.contractVersion !== BRIDGE_CONTRACT_VERSION
  ) {
    return quarantine(
      "unsupported-contract-version",
      "tutor-core",
      receivedAt,
      candidateId,
    );
  }
  if (input.eventVersion !== BRIDGE_CONTRACT_VERSION) {
    return quarantine(
      "unsupported-event-version",
      "tutor-core",
      receivedAt,
      candidateId,
    );
  }
  if (
    typeof input.kind !== "string" ||
    !(TUTOR_EVENT_KINDS as readonly string[]).includes(input.kind)
  ) {
    return quarantine(
      "unsupported-event-kind",
      "tutor-core",
      receivedAt,
      candidateId,
    );
  }
  if (!isStudyId(input.eventId)) {
    return quarantine(
      "invalid-identifier",
      "tutor-core",
      receivedAt,
      candidateId,
    );
  }
  if (!isRFC3339(input.occurredAt)) {
    return quarantine(
      "invalid-date",
      "tutor-core",
      receivedAt,
      input.eventId,
    );
  }
  const occurred = Date.parse(input.occurredAt);
  const received = Date.parse(receivedAt);
  if (
    !Number.isFinite(received) ||
    occurred > received + futureSkew ||
    occurred < Date.UTC(2000, 0, 1)
  ) {
    return quarantine(
      "impossible-date",
      "tutor-core",
      receivedAt,
      input.eventId,
    );
  }
  const studyProblem = validateStudyContext(input.study);
  if (studyProblem) {
    return quarantine(
      studyProblem,
      "study-engine",
      receivedAt,
      input.eventId,
    );
  }
  if (
    !isRecord(input.tutor) ||
    !hasExactKeys(
      input.tutor,
      ["phase", "tutorInteractionId", "programId"],
      [
        "responseId",
        "assessment",
        "confidence",
        "misconception",
        "prerequisite",
        "safety",
        "boardCommands",
        "spokenTurn",
        "narration",
        "media",
        "privacyContamination",
      ],
    )
  ) {
    return quarantine(
      isRecord(input.tutor) ? "unknown-field" : "malformed-event",
      "tutor-core",
      receivedAt,
      input.eventId,
    );
  }
  if (
    typeof input.tutor.phase !== "string" ||
    !(TUTOR_PHASES as readonly string[]).includes(input.tutor.phase) ||
    !isTutorStableId(input.tutor.tutorInteractionId) ||
    !isTutorStableId(input.tutor.programId) ||
    (input.tutor.responseId !== undefined &&
      !isTutorStableId(input.tutor.responseId))
  ) {
    return quarantine(
      "malformed-event",
      "tutor-core",
      receivedAt,
      input.eventId,
    );
  }

  const componentChecks = [
    input.tutor.assessment === undefined ||
      validateAssessment(input.tutor.assessment),
    input.tutor.confidence === undefined ||
      validateConfidence(input.tutor.confidence),
    input.tutor.misconception === undefined ||
      validateMisconception(input.tutor.misconception),
    input.tutor.prerequisite === undefined ||
      validatePrerequisite(input.tutor.prerequisite),
    input.tutor.safety === undefined || validateSafety(input.tutor.safety),
    input.tutor.spokenTurn === undefined ||
      validateSpokenTurn(input.tutor.spokenTurn),
    input.tutor.narration === undefined ||
      validateNarration(input.tutor.narration),
    input.tutor.media === undefined || validateMedia(input.tutor.media),
    input.tutor.boardCommands === undefined ||
      Array.isArray(input.tutor.boardCommands),
  ];
  if (componentChecks.some((valid) => !valid)) {
    return quarantine(
      "malformed-event",
      "tutor-core",
      receivedAt,
      input.eventId,
    );
  }

  const requiredComponent: Partial<Record<string, string>> = {
    "assessment-result": "assessment",
    "confidence-estimate": "confidence",
    "misconception-result": "misconception",
    "prerequisite-result": "prerequisite",
    "safety-decision": "safety",
  };
  const component = requiredComponent[input.kind];
  if (component && input.tutor[component] === undefined) {
    return quarantine(
      "malformed-event",
      "tutor-core",
      receivedAt,
      input.eventId,
    );
  }

  const unsafeContent = scanCredentialOrDiagnosis({
    spokenTurn: input.tutor.spokenTurn,
    narration: input.tutor.narration,
    boardCommands: input.tutor.boardCommands,
  });
  if (unsafeContent) {
    return quarantine(
      unsafeContent,
      "tutor-core",
      receivedAt,
      input.eventId,
    );
  }
  const contamination = input.tutor.privacyContamination;
  if (
    contamination !== undefined &&
    !isRecord(contamination)
  ) {
    return quarantine(
      "malformed-event",
      "tutor-core",
      receivedAt,
      input.eventId,
    );
  }
  const actionsOrProblem = privacyActionsFor(contamination);
  if (typeof actionsOrProblem === "string") {
    return quarantine(
      actionsOrProblem,
      "tutor-core",
      receivedAt,
      input.eventId,
    );
  }
  const privacyActions = [
    ...new Set([
      ...actionsOrProblem,
      ...collectIncidentalPiiActions({
        spokenTurn: input.tutor.spokenTurn,
        narration: input.tutor.narration,
        boardCommands: input.tutor.boardCommands,
      }),
      ...(input.tutor.narration &&
      Object.hasOwn(input.tutor.narration, "transcript")
        ? (["raw-transcript-removed"] as const)
        : []),
    ]),
  ];
  const safeTutor = {
    phase: input.tutor.phase,
    tutorInteractionId: input.tutor.tutorInteractionId,
    programId: input.tutor.programId,
    ...(input.tutor.responseId !== undefined
      ? { responseId: input.tutor.responseId }
      : {}),
    ...(input.tutor.assessment !== undefined
      ? { assessment: input.tutor.assessment }
      : {}),
    ...(input.tutor.confidence !== undefined
      ? { confidence: input.tutor.confidence }
      : {}),
    ...(input.tutor.misconception !== undefined
      ? { misconception: input.tutor.misconception }
      : {}),
    ...(input.tutor.prerequisite !== undefined
      ? { prerequisite: input.tutor.prerequisite }
      : {}),
    ...(input.tutor.safety !== undefined ? { safety: input.tutor.safety } : {}),
  };
  const safeEvent = {
    contract: input.contract,
    contractVersion: input.contractVersion,
    packageName: input.packageName,
    packageVersion: input.packageVersion,
    eventVersion: input.eventVersion,
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    kind: input.kind,
    study: input.study,
    tutor: safeTutor,
  } as TutorBridgeEventV1;
  return {
    status: "accepted",
    value: safeEvent,
    privacyActions,
  };
}

export function quarantineUnsupportedStudyVersion(
  value: unknown,
  receivedAt = new Date().toISOString(),
): BridgeValidationResult<never> {
  if (!isRecord(value) || !Object.hasOwn(value, "schemaVersion")) {
    return quarantine(
      "unsupported-contract-version",
      "study-engine",
      receivedAt,
    );
  }
  return quarantine(
    value.schemaVersion === 1
      ? "malformed-event"
      : "unsupported-contract-version",
    "study-engine",
    receivedAt,
    typeof value.id === "string" ? value.id : undefined,
  );
}

export function textContainsEmail(value: string): boolean {
  return EMAIL.test(value);
}

export function textContainsPhone(value: string): boolean {
  return PHONE.test(value);
}

export function textContainsCredential(value: string): boolean {
  return CREDENTIAL.test(value) || CREDENTIAL_URL.test(value);
}

export function textContainsDiagnosisLanguage(value: string): boolean {
  return DIAGNOSIS.test(value);
}

export function makeQuarantineRecord(
  reasonCode: QuarantineReasonCode,
  source: QuarantineRecordV1["source"],
  receivedAt: string,
  eventId?: string,
): QuarantineRecordV1 {
  const result = quarantine(reasonCode, source, receivedAt, eventId);
  if (result.status !== "quarantined") {
    throw new Error("Quarantine construction failed.");
  }
  return result.quarantine;
}
