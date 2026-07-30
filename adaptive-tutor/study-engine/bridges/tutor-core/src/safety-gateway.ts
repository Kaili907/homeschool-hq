import {
  BRIDGE_CONTRACT_VERSION,
  type LearnerSafeProjectionV1,
  type SafetyCategory,
} from "./contracts.ts";
import { isRFC3339 } from "./validation.ts";

export const URGENT_SAFETY_CLASSIFICATION_VERSION = 1 as const;

export type UrgentSafetyCategory =
  | "self-harm-or-immediate-danger"
  | "abuse-or-neglect-disclosure";

export type UrgentSafetyClassificationOutcome =
  | "urgent"
  | "uncertain"
  | "clear"
  | "invalid";

interface UrgentRule {
  readonly ruleId: string;
  readonly category: UrgentSafetyCategory;
  readonly patterns: readonly RegExp[];
  readonly adultSummaryCode: string;
}

interface ReviewedDeterministicAssessment {
  readonly outcome: Exclude<UrgentSafetyClassificationOutcome, "invalid">;
  readonly categories: readonly UrgentSafetyCategory[];
  readonly ruleIds: readonly string[];
  readonly summaryCodes: readonly string[];
}

export interface UrgentSafetyClassificationV1 {
  readonly classificationVersion: typeof URGENT_SAFETY_CLASSIFICATION_VERSION;
  readonly classifierVersion: string;
  readonly outcome: UrgentSafetyClassificationOutcome;
  readonly categories: readonly UrgentSafetyCategory[];
  /**
   * Opaque reviewed codes only. Disclosure excerpts and matched text are
   * prohibited.
   */
  readonly reasonCodes: readonly string[];
}

export interface UrgentSafetyClassifierRequestV1 {
  readonly classificationVersion: typeof URGENT_SAFETY_CLASSIFICATION_VERSION;
  /**
   * Transient normalized input. A classifier may inspect it but must neither
   * log nor return it.
   */
  readonly normalizedTransientText: string;
  readonly deterministicAssessment: {
    readonly outcome: Exclude<UrgentSafetyClassificationOutcome, "invalid">;
    readonly categories: readonly UrgentSafetyCategory[];
    readonly ruleIds: readonly string[];
  };
}

export interface UrgentSafetyClassifierPort {
  readonly classifierVersion: string;
  classify(
    request: UrgentSafetyClassifierRequestV1,
  ): UrgentSafetyClassificationV1;
}

export type UrgentSafetyGatewayConfiguration =
  | {
      readonly mode: "production";
      /**
       * Mandatory in production. A missing, throwing, or malformed classifier
       * fails closed.
       */
      readonly classifier: UrgentSafetyClassifierPort;
      readonly permitTtlMs?: number;
    }
  | {
      readonly mode: "local-demo";
      readonly classifier?: UrgentSafetyClassifierPort;
      readonly permitTtlMs?: number;
    };

export interface PreCoreProcessingPermitV1 {
  /**
   * Opaque, single-use capability. Only the gateway can register one. Object
   * copies and caller-constructed values are not capabilities.
   */
  readonly contract: "study-core-bridge.pre-core-permit.v1";
}

export interface PreCorePermitContext {
  readonly eventId: string;
  readonly sessionId: string;
  readonly occurredAt: string;
}

interface RegisteredPermitContext extends PreCorePermitContext {
  readonly expiresAtEpochMs: number;
}

const PRE_CORE_PERMITS = new WeakMap<object, RegisteredPermitContext>();
const DEFAULT_PERMIT_TTL_MS = 60_000;
const MIN_PERMIT_TTL_MS = 1;
const MAX_PERMIT_TTL_MS = 5 * 60_000;
const MAX_TRANSIENT_INPUT_LENGTH = 4_000;

const CAREGIVER_ROLE =
  String.raw`(?:mom|mother|mum|dad|daddy|father|parent|step[- ]?(?:mom|mother|dad|father)|guardian|caregiver|foster[- ]?parent|uncle|aunt|grand(?:ma|mother|pa|father)|babysitter|teacher|coach|counselor|older[- ]?(?:brother|sister|sibling)|adult(?:\s+at\s+home)?)`;

/**
 * Reviewed deterministic high-confidence rules. They are intentionally
 * broader than a phrase list while remaining first-person and context aware.
 */
const URGENT_RULES: readonly UrgentRule[] = [
  {
    ruleId: "bridge-direct-self-harm-danger-v2",
    category: "self-harm-or-immediate-danger",
    patterns: [
      /\bi\s+(?:really\s+)?(?:want|wanna|need|plan)\s+to\s+(?:die|kil+l|hurt|harm)\s*(?:my\s*self|myself|me)?\b/i,
      /\bi\s+(?:feel\s+like|am|m)\s+(?:kil+ing|hurting|harming)\s+(?:my\s*self|myself)\b/i,
      /\bi(?:'m|m|\s+am)\s+(?:gonna|going|planning|about)\s+to\s+(?:kil+l|hurt|harm)\s+(?:my\s*self|myself)\b/i,
      /\bi\s+(?:will|shall)\s+(?:kil+l|hurt|harm)\s+(?:my\s*self|myself)\b/i,
      /\bi(?:'m|m|\s+am)\s+suicidal\b/i,
      /\b(?:end|ending)\s+my\s+life\b/i,
      /\bi\s+(?:do\s+not|don'?t)\s+want\s+to\s+(?:be\s+alive|live|wake\s+up)\b/i,
      /\bi\s+(?:cannot|can'?t)\s+keep\s+(?:my\s*self|myself)\s+safe\b/i,
      /\bi\s+(?:took|swallowed|ate|drank)\s+(?:a\s+)?(?:bunch|lot|lots|handful|too\s+many)\s+of?\s*(?:pills?|tablets?|medicine|medication)\b/i,
      /\bi\s+(?:took|swallowed)\s+(?:all|extra)\s+(?:the|my)?\s*(?:pills?|tablets?|medicine|medication)\b/i,
      /\bi\s+(?:took|swallowed)\s+(?:[1-9]\d{1,2}|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty)\s+(?:pills?|tablets?)\b/i,
      /\bi\s+(?:overdosed|over\s*dosed)\b/i,
      /\bi(?:'m|m|\s+am)\s+(?:in\s+immediate\s+danger|not\s+safe\s+right\s+now)\b/i,
      /\b(?:someone|they|he|she|an\s+adult)\s+(?:has|have)\s+a\s+(?:gun|knife|weapon)\s+(?:and\s+)?(?:is\s+)?(?:trying|threatening|going)\s+to\s+hurt\s+me\b/i,
      /\b(?:suicid(?:e|al)|self[- ]?harm)\b.*\b(?:me|myself|i(?:'m|\s+am)?)\b/i,
    ],
    adultSummaryCode: "urgent-learner-safety-support-needed",
  },
  {
    ruleId: "bridge-direct-abuse-neglect-v2",
    category: "abuse-or-neglect-disclosure",
    patterns: [
      new RegExp(
        String.raw`\bmy\s+${CAREGIVER_ROLE}\s+(?:hit+s?|hitz|beat+s?|hurt+s?|kick+s?|punch(?:es)?|slap+s?|burn+s?|threatens?)\s+me\b`,
        "i",
      ),
      new RegExp(
        String.raw`\bmy\s+${CAREGIVER_ROLE}\s+(?:is|keeps?)\s+(?:hitting|beating|hurting|kicking|punching|slapping|burning|threatening)\s+me\b`,
        "i",
      ),
      new RegExp(
        String.raw`\bmy\s+${CAREGIVER_ROLE}\s+(?:touch(?:es|ed)?|tuch(?:es|ed)?|gropes?)\s+me\b`,
        "i",
      ),
      new RegExp(
        String.raw`\b${CAREGIVER_ROLE}\s+(?:hit+s?|hitz|beat+s?|hurt+s?|kick+s?|punch(?:es)?|slap+s?|burn+s?|touch(?:es|ed)?|tuch(?:es|ed)?|gropes?|threatens?)\s+me\b`,
        "i",
      ),
      new RegExp(
        String.raw`\b(?:my\s+)?${CAREGIVER_ROLE}\s+(?:does\s+not|doesn'?t|won'?t|will\s+not|never)\s+(?:feed|give\s+food\s+to)\s+me\b`,
        "i",
      ),
      new RegExp(
        String.raw`\b(?:my\s+)?${CAREGIVER_ROLE}\s+(?:does\s+not|doesn'?t|won'?t|will\s+not|never)\s+let\s+me\s+eat\b`,
        "i",
      ),
      /\bi(?:'m|m|\s+am)\s+(?:being\s+)?(?:abused|neglected|beaten|starved)\b/i,
      /\b(?:no\s+one|nobody)\s+(?:feeds|takes\s+care\s+of)\s+me\b/i,
      /\bi(?:'m|m|\s+am)\s+(?:scared|scard|afraid|terrified)\s+(?:to\s+go|of\s+going)\s+home\b/i,
      /\bi(?:'m|m|\s+am)\s+(?:unsafe|not\s+safe)\s+at\s+home\b/i,
      /\bsomeone\s+at\s+home\s+(?:hit+s?|hurt+s?|touch(?:es)?|tuch(?:es)?|threatens?)\s+me\b/i,
    ],
    adultSummaryCode: "urgent-safeguarding-review-needed",
  },
] as const;

const UNCERTAIN_RULES: readonly UrgentRule[] = [
  {
    ruleId: "bridge-uncertain-self-harm-danger-v2",
    category: "self-harm-or-immediate-danger",
    patterns: [
      /\bi\s+(?:sometimes\s+)?wish\s+i\s+(?:were\s+not|wasn'?t)\s+(?:here|alive)\b/i,
      /\bi\s+(?:sometimes\s+)?feel\s+like\s+(?:disappearing|not\s+waking\s+up)\b/i,
      /\bwhat\s+if\s+i\s+(?:wanted|tried)\s+to\s+(?:die|hurt\s+myself|kil+l\s+myself)\b/i,
      /\bi\s+(?:might|may|could)\s+(?:hurt|harm|kil+l)\s+(?:myself|my\s*self)\b/i,
      /\bi\s+was\s+(?:just\s+)?joking\s+about\s+(?:dying|suicide|hurting\s+myself|kil+ing\s+myself)\b/i,
      /\bmy\s+(?:friend|classmate|sibling|brother|sister)\s+(?:wants?\s+to\s+die|might\s+hurt\s+(?:themself|themselves|himself|herself))\b/i,
    ],
    adultSummaryCode: "uncertain-learner-safety-support-review",
  },
  {
    ruleId: "bridge-uncertain-safeguarding-v2",
    category: "abuse-or-neglect-disclosure",
    patterns: [
      /\bi\s+(?:do\s+not|don'?t)\s+(?:feel\s+)?safe\s+at\s+home\b/i,
      /\bi(?:'m|m|\s+am)\s+(?:scared|afraid|uncomfortable)\s+(?:around|with)\s+(?:an\s+adult|someone|my\s+\w+)\b/i,
      /\bi\s+think\s+(?:someone|an\s+adult|they|he|she)\s+(?:may|might|could)\s+hurt\s+me\b/i,
      /\b(?:an\s+adult|someone|my\s+\w+)\s+(?:makes|made)\s+me\s+(?:feel\s+)?(?:unsafe|uncomfortable|scared)\b/i,
      /\bi\s+(?:sometimes|often)\s+(?:do\s+not|don'?t)\s+(?:get|have)\s+(?:food|anything\s+to\s+eat)\b/i,
    ],
    adultSummaryCode: "uncertain-safeguarding-review-needed",
  },
] as const;

const CLEAR_CONTEXT_PATTERNS: readonly RegExp[] = [
  /\b(?:the|a)\s+(?:character|author|narrator|protagonist)\s+(?:says?|said|writes?|wrote|thinks?|thought|asks?|asked|describes?|described)\b/i,
  /\bwhat\s+does\s+(?:suicide|self[- ]?harm|abuse|neglect)\s+mean\b/i,
  /\b(?:suicide|self[- ]?harm|abuse|neglect)\s+prevention\b/i,
  /\b(?:research|history|lesson|class|report)\s+(?:on|about)\s+(?:suicide|self[- ]?harm|abuse|neglect)\b/i,
];

const PERSONAL_REALITY_OVERRIDES: readonly RegExp[] = [
  /\b(?:this|it)\s+(?:is|was)\s+(?:really\s+)?happening\s+to\s+me\b/i,
  /\bthis\s+is\s+(?:not|isn'?t)\s+(?:a\s+)?(?:story|joke|example|hypothetical)\b/i,
  /\bin\s+real\s+life\b/i,
  /\bi\s+need\s+help\s+(?:now|today|at\s+home)\b/i,
];

const FALSE_POSITIVE_PATTERNS: readonly RegExp[] = [
  /\b(?:die|dying)\s+(?:laughing|of\s+laughter|from\s+embarrassment)\b/i,
  /\b(?:homework|assignment|test|game|exercise)\s+is\s+kil+ing\s+me\b/i,
  /\bkil+l\s+(?:the\s+)?(?:process|program|task|server|app|engine)\b/i,
  /\bdead\s+(?:tired|battery|link|end)\b/i,
  /\b(?:hit+s?|touch(?:es)?)\s+(?:the\s+)?(?:baseball|ball|keyboard|screen|paint|wall)\b/i,
  /\b(?:feed|feeds|feeding)\s+(?:the\s+)?(?:dog|cat|pet|fish|bird)\b/i,
];

export interface PreCoreGatewayContext {
  readonly eventId: string;
  readonly sessionId: string;
  readonly occurredAt: string;
}

export interface UrgentAdultReviewHookV1 {
  readonly contract: "study-core-bridge.adult-review-hook.v1";
  readonly contractVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly hookId: string;
  readonly idempotencyKey: string;
  readonly sessionId: string;
  readonly sourceEventId: string;
  readonly occurredAt: string;
  readonly canonicalStudyCategory: "student-support";
  readonly urgency: "urgent" | "uncertain";
  readonly categories: readonly UrgentSafetyCategory[];
  readonly ruleIds: readonly string[];
  readonly summaryCodes: readonly string[];
  readonly deliveryStatus: "proposed-not-delivered";
  readonly matchedTextIncluded: false;
  readonly rawTextIncluded: false;
  readonly directIdentifiersIncluded: false;
}

interface StopForAdultReviewResult {
  readonly continueToTutorCore: false;
  readonly mustStopAcademicFlow: true;
  readonly adultReviewRequired: true;
  readonly learner: LearnerSafeProjectionV1;
  readonly adultHook: UrgentAdultReviewHookV1;
  readonly classification: UrgentSafetyClassificationV1;
  readonly rawTextStored: false;
  readonly matchedTextStored: false;
  readonly diagnosisMade: false;
}

export type PreCoreUrgentSafetyResult =
  | {
      readonly status: "continue-to-tutor-core";
      readonly continueToTutorCore: true;
      readonly rawTextStored: false;
      readonly classification: UrgentSafetyClassificationV1;
      readonly permit: PreCoreProcessingPermitV1;
    }
  | (StopForAdultReviewResult & {
      readonly status: "stop-for-urgent-adult-review";
    })
  | (StopForAdultReviewResult & {
      readonly status: "stop-for-uncertain-adult-review";
    })
  | {
      readonly status: "stop-invalid-input";
      readonly continueToTutorCore: false;
      readonly mustStopAcademicFlow: true;
      readonly adultReviewRequired: true;
      readonly learner: LearnerSafeProjectionV1;
      readonly classification: UrgentSafetyClassificationV1;
      readonly reasonCode:
        | "urgent-gateway-input-limit"
        | "urgent-gateway-invalid-context"
        | "urgent-gateway-invalid-classifier";
      readonly rawTextStored: false;
      readonly matchedTextStored: false;
      readonly diagnosisMade: false;
    };

export type PreCorePermitConsumptionResult =
  | { readonly status: "consumed" }
  | {
      readonly status: "rejected";
      readonly reason:
        | "missing-or-replayed"
        | "context-mismatch"
        | "expired";
    };

const URGENT_LEARNER_MESSAGE: LearnerSafeProjectionV1 = {
  messageCode: "lesson-paused-get-trusted-adult",
  message:
    "The lesson is paused. Please get a trusted adult who can help right now. You are not in trouble.",
  mayContinue: false,
  adultReviewPending: true,
};

const UNCERTAIN_LEARNER_MESSAGE: LearnerSafeProjectionV1 = {
  messageCode: "lesson-paused-adult-check-in",
  message:
    "The lesson is paused while a trusted adult checks in. You are not in trouble.",
  mayContinue: false,
  adultReviewPending: true,
};

const INVALID_LEARNER_MESSAGE: LearnerSafeProjectionV1 = {
  messageCode: "lesson-paused-input-check",
  message:
    "The lesson is paused while a trusted adult helps check what happened. You are not in trouble.",
  mayContinue: false,
  adultReviewPending: true,
};

function validOpaqueId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function normalizeTransientText(value: string): string | undefined {
  try {
    const normalized = value
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\u2060\uFEFF]/gu, "")
      .replace(/[\u2018\u2019\u02BC]/gu, "'")
      .replace(/[\u2010-\u2015\u2212]/gu, "-")
      .replace(/\s+/gu, " ")
      .trim()
      .toLowerCase();
    if (normalized.length === 0 || normalized.length > MAX_TRANSIENT_INPUT_LENGTH) {
      return undefined;
    }
    // Collapse simple punctuation or spacing obfuscation inside letter runs.
    return normalized
      .replace(/(?<=[a-z])(?:[.*_~-]+)(?=[a-z])/gu, "")
      .replace(/[.!?;,:/\\()[\]{}]+/gu, " ")
      .replace(/\bk\s+i\s+l\s+l\b/gu, "kill")
      .replace(/\bd\s+i\s+e\b/gu, "die")
      .replace(/\bh\s+u\s+r\s+t\b/gu, "hurt")
      .replace(/\bt\s+o\s+u\s+c\s+h(?:e\s+s)?\b/gu, "touches")
      .replace(/\s+/gu, " ")
      .trim();
  } catch {
    return undefined;
  }
}

function clearlyAcademicOrStoryContext(text: string): boolean {
  return (
    CLEAR_CONTEXT_PATTERNS.some((pattern) => pattern.test(text)) &&
    !PERSONAL_REALITY_OVERRIDES.some((pattern) => pattern.test(text))
  );
}

function matchesRules(
  rules: readonly UrgentRule[],
  normalizedText: string,
): readonly UrgentRule[] {
  return rules.filter((rule) =>
    rule.patterns.some((pattern) => pattern.test(normalizedText)),
  );
}

function reviewedDeterministicLayer(
  normalizedText: string,
): ReviewedDeterministicAssessment {
  if (clearlyAcademicOrStoryContext(normalizedText)) {
    return {
      outcome: "clear",
      categories: [],
      ruleIds: ["bridge-reviewed-academic-story-context-v2"],
      summaryCodes: [],
    };
  }
  const urgent = matchesRules(URGENT_RULES, normalizedText);
  if (urgent.length > 0) {
    return {
      outcome: "urgent",
      categories: unique(urgent.map((rule) => rule.category)),
      ruleIds: unique(urgent.map((rule) => rule.ruleId)),
      summaryCodes: unique(urgent.map((rule) => rule.adultSummaryCode)),
    };
  }
  const uncertain = matchesRules(UNCERTAIN_RULES, normalizedText);
  if (uncertain.length > 0) {
    return {
      outcome: "uncertain",
      categories: unique(uncertain.map((rule) => rule.category)),
      ruleIds: unique(uncertain.map((rule) => rule.ruleId)),
      summaryCodes: unique(uncertain.map((rule) => rule.adultSummaryCode)),
    };
  }
  if (FALSE_POSITIVE_PATTERNS.some((pattern) => pattern.test(normalizedText))) {
    return {
      outcome: "clear",
      categories: [],
      ruleIds: ["bridge-reviewed-idiom-technical-context-v2"],
      summaryCodes: [],
    };
  }
  return {
    outcome: "clear",
    categories: [],
    ruleIds: ["bridge-reviewed-no-safety-signal-v2"],
    summaryCodes: [],
  };
}

const LOCAL_DETERMINISTIC_CLASSIFIER: UrgentSafetyClassifierPort = {
  classifierVersion: "bridge-reviewed-deterministic-v2",
  classify(request) {
    return {
      classificationVersion: URGENT_SAFETY_CLASSIFICATION_VERSION,
      classifierVersion: "bridge-reviewed-deterministic-v2",
      outcome: request.deterministicAssessment.outcome,
      categories: request.deterministicAssessment.categories,
      reasonCodes: request.deterministicAssessment.ruleIds,
    };
  },
};

function validCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(value)
  );
}

function validClassification(
  value: unknown,
  expectedClassifierVersion: string,
): value is UrgentSafetyClassificationV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = new Set([
    "classificationVersion",
    "classifierVersion",
    "outcome",
    "categories",
    "reasonCodes",
  ]);
  if (Object.keys(record).some((key) => !allowedKeys.has(key))) {
    return false;
  }
  const validOutcomes: readonly unknown[] = [
    "urgent",
    "uncertain",
    "clear",
    "invalid",
  ];
  const validCategories: readonly unknown[] = [
    "self-harm-or-immediate-danger",
    "abuse-or-neglect-disclosure",
  ];
  const categoriesAreValid =
    Array.isArray(record.categories) &&
    record.categories.length <= 2 &&
    record.categories.every((category) => validCategories.includes(category)) &&
    new Set(record.categories).size === record.categories.length;
  const reasonCodesAreValid =
    Array.isArray(record.reasonCodes) &&
    record.reasonCodes.length >= 1 &&
    record.reasonCodes.length <= 16 &&
    record.reasonCodes.every(validCode) &&
    new Set(record.reasonCodes).size === record.reasonCodes.length;
  const outcomeSemanticsAreValid =
    (record.outcome === "urgent" || record.outcome === "uncertain")
      ? Array.isArray(record.categories) && record.categories.length >= 1
      : Array.isArray(record.categories) && record.categories.length === 0;
  return (
    record.classificationVersion === URGENT_SAFETY_CLASSIFICATION_VERSION &&
    record.classifierVersion === expectedClassifierVersion &&
    validCode(record.classifierVersion) &&
    validOutcomes.includes(record.outcome) &&
    categoriesAreValid &&
    reasonCodesAreValid &&
    outcomeSemanticsAreValid
  );
}

function severity(outcome: UrgentSafetyClassificationOutcome): number {
  switch (outcome) {
    case "invalid":
      return 3;
    case "urgent":
      return 2;
    case "uncertain":
      return 1;
    case "clear":
      return 0;
  }
}

function classifyTransientText(
  normalizedText: string,
  configuration: UrgentSafetyGatewayConfiguration,
): {
  readonly classification: UrgentSafetyClassificationV1;
  readonly deterministic: ReviewedDeterministicAssessment;
} | undefined {
  const deterministic = reviewedDeterministicLayer(normalizedText);
  const classifier =
    configuration.mode === "production"
      ? configuration.classifier
      : configuration.classifier ?? LOCAL_DETERMINISTIC_CLASSIFIER;
  if (
    typeof classifier !== "object" ||
    classifier === null ||
    !validCode(classifier.classifierVersion) ||
    typeof classifier.classify !== "function"
  ) {
    return undefined;
  }
  try {
    const classified = classifier.classify({
      classificationVersion: URGENT_SAFETY_CLASSIFICATION_VERSION,
      normalizedTransientText: normalizedText,
      deterministicAssessment: {
        outcome: deterministic.outcome,
        categories: deterministic.categories,
        ruleIds: deterministic.ruleIds,
      },
    });
    if (!validClassification(classified, classifier.classifierVersion)) {
      return undefined;
    }
    // The production layer may escalate but may never downgrade a reviewed
    // deterministic urgent or uncertain signal.
    const selectedOutcome =
      severity(classified.outcome) >= severity(deterministic.outcome)
        ? classified.outcome
        : deterministic.outcome;
    return {
      deterministic,
      classification: {
        classificationVersion: URGENT_SAFETY_CLASSIFICATION_VERSION,
        classifierVersion: classified.classifierVersion,
        outcome: selectedOutcome,
        categories:
          selectedOutcome === "clear"
            ? []
            : unique([...deterministic.categories, ...classified.categories]),
        reasonCodes: unique([
          ...deterministic.ruleIds,
          ...classified.reasonCodes,
        ]),
      },
    };
  } catch {
    return undefined;
  }
}

function invalidClassification(
  reasonCode: string,
): UrgentSafetyClassificationV1 {
  return {
    classificationVersion: URGENT_SAFETY_CLASSIFICATION_VERSION,
    classifierVersion: "bridge-gateway-validation-v2",
    outcome: "invalid",
    categories: [],
    reasonCodes: [reasonCode],
  };
}

function stopInvalid(
  reasonCode:
    | "urgent-gateway-input-limit"
    | "urgent-gateway-invalid-context"
    | "urgent-gateway-invalid-classifier",
): PreCoreUrgentSafetyResult {
  return {
    status: "stop-invalid-input",
    continueToTutorCore: false,
    mustStopAcademicFlow: true,
    adultReviewRequired: true,
    learner: INVALID_LEARNER_MESSAGE,
    classification: invalidClassification(reasonCode),
    reasonCode,
    rawTextStored: false,
    matchedTextStored: false,
    diagnosisMade: false,
  };
}

/**
 * Runs on transient learner text before AdaptiveTutorEngine.submit().
 *
 * Architecture:
 * Unicode/whitespace normalization -> reviewed deterministic rules ->
 * classifier port -> structured classification -> stop/continue.
 *
 * The production configuration requires an injected classifier. Omission of a
 * configuration intentionally selects the deterministic local/demo fallback
 * for backwards-compatible tests and offline development.
 */
export function evaluatePreCoreUrgentSafety(
  transientLearnerText: string,
  context: PreCoreGatewayContext,
  configuration: UrgentSafetyGatewayConfiguration = { mode: "local-demo" },
): PreCoreUrgentSafetyResult {
  if (
    typeof context !== "object" ||
    context === null ||
    !validOpaqueId(context.eventId) ||
    !validOpaqueId(context.sessionId) ||
    !isRFC3339(context.occurredAt)
  ) {
    return stopInvalid("urgent-gateway-invalid-context");
  }
  if (
    typeof transientLearnerText !== "string" ||
    transientLearnerText.length > MAX_TRANSIENT_INPUT_LENGTH
  ) {
    return stopInvalid("urgent-gateway-input-limit");
  }
  const normalizedText = normalizeTransientText(transientLearnerText);
  if (normalizedText === undefined) {
    return stopInvalid("urgent-gateway-input-limit");
  }
  if (
    typeof configuration !== "object" ||
    configuration === null ||
    (configuration.mode !== "production" &&
      configuration.mode !== "local-demo") ||
    (configuration.mode === "production" &&
      !("classifier" in configuration))
  ) {
    return stopInvalid("urgent-gateway-invalid-classifier");
  }
  const classified = classifyTransientText(normalizedText, configuration);
  if (classified === undefined) {
    return stopInvalid("urgent-gateway-invalid-classifier");
  }
  const { classification, deterministic } = classified;
  if (classification.outcome === "invalid") {
    return stopInvalid("urgent-gateway-invalid-classifier");
  }
  if (
    classification.outcome === "urgent" ||
    classification.outcome === "uncertain"
  ) {
    const uncertain = classification.outcome === "uncertain";
    const categories =
      classification.categories.length > 0
        ? classification.categories
        : deterministic.categories;
    const ruleIds = unique([
      ...deterministic.ruleIds,
      ...classification.reasonCodes,
    ]);
    return {
      status: uncertain
        ? "stop-for-uncertain-adult-review"
        : "stop-for-urgent-adult-review",
      continueToTutorCore: false,
      mustStopAcademicFlow: true,
      adultReviewRequired: true,
      learner: uncertain
        ? UNCERTAIN_LEARNER_MESSAGE
        : URGENT_LEARNER_MESSAGE,
      adultHook: {
        contract: "study-core-bridge.adult-review-hook.v1",
        contractVersion: BRIDGE_CONTRACT_VERSION,
        hookId: `adult-review-${context.eventId}`,
        idempotencyKey: `urgent-safety:${context.eventId}:v2`,
        sessionId: context.sessionId,
        sourceEventId: context.eventId,
        occurredAt: context.occurredAt,
        canonicalStudyCategory: "student-support",
        urgency: uncertain ? "uncertain" : "urgent",
        categories,
        ruleIds,
        summaryCodes:
          deterministic.summaryCodes.length > 0
            ? deterministic.summaryCodes
            : [
                uncertain
                  ? "uncertain-classifier-review-needed"
                  : "urgent-classifier-review-needed",
              ],
        deliveryStatus: "proposed-not-delivered",
        matchedTextIncluded: false,
        rawTextIncluded: false,
        directIdentifiersIncluded: false,
      },
      classification,
      rawTextStored: false,
      matchedTextStored: false,
      diagnosisMade: false,
    };
  }

  const configuredTtl = configuration.permitTtlMs ?? DEFAULT_PERMIT_TTL_MS;
  if (
    !Number.isSafeInteger(configuredTtl) ||
    configuredTtl < MIN_PERMIT_TTL_MS ||
    configuredTtl > MAX_PERMIT_TTL_MS
  ) {
    return stopInvalid("urgent-gateway-invalid-classifier");
  }
  const permit = Object.freeze({
    contract: "study-core-bridge.pre-core-permit.v1" as const,
  });
  PRE_CORE_PERMITS.set(permit, {
    eventId: context.eventId,
    sessionId: context.sessionId,
    occurredAt: context.occurredAt,
    expiresAtEpochMs: Date.now() + configuredTtl,
  });
  return {
    status: "continue-to-tutor-core",
    continueToTutorCore: true,
    rawTextStored: false,
    classification,
    permit,
  };
}

export function getBridgeUrgentCategoryCoverage(): readonly SafetyCategory[] {
  return unique(URGENT_RULES.map((rule) => rule.category));
}

/**
 * Atomically consumes the permit. Registered capabilities are revoked before
 * context and expiry validation, so a mismatch cannot be retried with altered
 * context. Object copies were never registered and therefore fail.
 */
export function consumePreCoreProcessingPermit(
  permit: PreCoreProcessingPermitV1,
  context: PreCorePermitContext,
): PreCorePermitConsumptionResult {
  if (typeof permit !== "object" || permit === null) {
    return { status: "rejected", reason: "missing-or-replayed" };
  }
  const registered = PRE_CORE_PERMITS.get(permit);
  if (registered === undefined) {
    return { status: "rejected", reason: "missing-or-replayed" };
  }
  PRE_CORE_PERMITS.delete(permit);
  if (
    registered.eventId !== context.eventId ||
    registered.sessionId !== context.sessionId ||
    registered.occurredAt !== context.occurredAt
  ) {
    return { status: "rejected", reason: "context-mismatch" };
  }
  if (Date.now() > registered.expiresAtEpochMs) {
    return { status: "rejected", reason: "expired" };
  }
  return { status: "consumed" };
}
