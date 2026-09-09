import { Type, type Static } from "../../schema/typebox.js";
import {
  ISODateTimeSchema,
  OpaqueReferenceSchema,
} from "../contracts/primitives.js";
import { validateExact } from "../contracts/validation.js";

export const ACADEMIC_MISCONCEPTION_REGISTRY_VERSION = 1 as const;
export const ACADEMIC_MISCONCEPTION_EVIDENCE_VERSION = 1 as const;
export const ACADEMIC_MISCONCEPTION_MATCHER_VERSION = 1 as const;
export const MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS = 64;
export const MAXIMUM_REVIEWED_INSTRUCTIONAL_RESPONSES = 12;
export const MAXIMUM_PREREQUISITE_CONCEPTS = 12;
export const MAXIMUM_ACADEMIC_MISCONCEPTION_CODE_LENGTH = 96;

export const AcademicMisconceptionCodeSchema = Type.String({
  minLength: 8,
  maxLength: MAXIMUM_ACADEMIC_MISCONCEPTION_CODE_LENGTH,
  pattern: "^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){2,7}$",
});
export type AcademicMisconceptionCode = Static<
  typeof AcademicMisconceptionCodeSchema
>;

export const ReviewedAcademicMisconceptionCodeSchema = Type.String({
  minLength: 8,
  maxLength: MAXIMUM_ACADEMIC_MISCONCEPTION_CODE_LENGTH,
  pattern:
    "^(?!.*(?:^|_)(?:ANXIETY|ANXIOUS|AUTISM|BEHAVIOR|BEHAVIOUR|CHILD|CONDITION|DEPRESSION|DIAGNOSIS|DIAGNOSTIC|DISORDER|DYSLEXIA|EMOTION|EMOTIONAL|IQ|LAZY|LEARNER|MOTIVATION|PERSONALITY|PSYCHOLOGICAL|STUDENT|STUPID|TRAIT|UNMOTIVATED)(?:_|$))(?:ART|ARTS|COMPUTER|ELA|ENGLISH|FINANCIAL|FINLIT|HEALTH|MATH|MUSIC|PE|PHYSICAL|READY|RFL|SCIENCE|SOCIAL|TECHNOLOGY)(?:_[A-Z0-9]+){2,7}$",
  $id: "TutorV2ReviewedAcademicMisconceptionCode",
});

export const AcademicMisconceptionReferenceSchema = Type.String({
  minLength: 16,
  maxLength: 160,
  pattern: "^misconception:[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$",
  $id: "TutorV2AcademicMisconceptionReference",
});

export const StudyMisconceptionReviewReferenceSchema = Type.String({
  minLength: 14,
  maxLength: 160,
  pattern: "^study-review:[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$",
  $id: "TutorV2StudyMisconceptionReviewReference",
});

export const AcademicEvidenceSourceKindSchema = Type.Union([
  Type.Literal("selected-response-classification"),
  Type.Literal("worked-step-classification"),
  Type.Literal("constructed-response-rubric"),
  Type.Literal("prerequisite-check"),
  Type.Literal("teacher-reviewed-academic-observation"),
]);
export type AcademicEvidenceSourceKind = Static<
  typeof AcademicEvidenceSourceKindSchema
>;

export const AcademicEvidenceFindingSchema = Type.Union([
  Type.Literal("consistent-with-misconception-code"),
  Type.Literal("inconsistent-with-misconception-code"),
]);
export type AcademicEvidenceFinding = Static<
  typeof AcademicEvidenceFindingSchema
>;

export const MisconceptionEvidenceRequirementsSchema = Type.Object(
  {
    minimumSupportingEvidenceCount: Type.Integer({ minimum: 2, maximum: 16 }),
    minimumDistinctOpportunityCount: Type.Integer({ minimum: 2, maximum: 16 }),
    maximumEvidenceAgeDays: Type.Integer({ minimum: 1, maximum: 365 }),
    acceptedSourceKinds: Type.Array(AcademicEvidenceSourceKindSchema, {
      minItems: 1,
      maxItems: 5,
    }),
  },
  { additionalProperties: false, $id: "TutorV2MisconceptionEvidenceRequirements" },
);
export type MisconceptionEvidenceRequirements = Static<
  typeof MisconceptionEvidenceRequirementsSchema
>;

export const AcademicMisconceptionEntrySchema = Type.Object(
  {
    version: Type.Literal(ACADEMIC_MISCONCEPTION_REGISTRY_VERSION),
    misconceptionRef: OpaqueReferenceSchema,
    conceptRef: OpaqueReferenceSchema,
    academicMisconceptionCode: AcademicMisconceptionCodeSchema,
    reviewApprovalRef: OpaqueReferenceSchema,
    reviewedInstructionalResponseRefs: Type.Array(OpaqueReferenceSchema, {
      minItems: 1,
      maxItems: MAXIMUM_REVIEWED_INSTRUCTIONAL_RESPONSES,
    }),
    prerequisiteConceptRefs: Type.Array(OpaqueReferenceSchema, {
      maxItems: MAXIMUM_PREREQUISITE_CONCEPTS,
    }),
    evidenceRequirements: MisconceptionEvidenceRequirementsSchema,
  },
  { additionalProperties: false, $id: "TutorV2AcademicMisconceptionEntry" },
);
export type AcademicMisconceptionEntry = Static<
  typeof AcademicMisconceptionEntrySchema
>;

export const StudyApprovedAcademicEvidenceSchema = Type.Object(
  {
    evidenceVersion: Type.Literal(ACADEMIC_MISCONCEPTION_EVIDENCE_VERSION),
    evidenceKind: Type.Literal("study-approved-structured-academic-evidence"),
    evidenceRef: OpaqueReferenceSchema,
    opportunityRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    instructionalContextRef: OpaqueReferenceSchema,
    conceptRef: OpaqueReferenceSchema,
    academicMisconceptionCode: AcademicMisconceptionCodeSchema,
    sourceKind: AcademicEvidenceSourceKindSchema,
    finding: AcademicEvidenceFindingSchema,
    observedAt: ISODateTimeSchema,
    approvalKind: Type.Literal("study-approved"),
    approvalRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false, $id: "TutorV2StudyApprovedAcademicEvidence" },
);
export type StudyApprovedAcademicEvidence = Static<
  typeof StudyApprovedAcademicEvidenceSchema
>;

export const AcademicMisconceptionMatchRequestSchema = Type.Object(
  {
    matcherVersion: Type.Literal(ACADEMIC_MISCONCEPTION_MATCHER_VERSION),
    scopeKind: Type.Literal("trusted-study-academic-evidence-scope"),
    learnerScopeRef: OpaqueReferenceSchema,
    instructionalContextRef: OpaqueReferenceSchema,
    conceptRef: OpaqueReferenceSchema,
    academicMisconceptionCode: AcademicMisconceptionCodeSchema,
    evaluatedAt: ISODateTimeSchema,
    evidence: Type.Array(StudyApprovedAcademicEvidenceSchema, {
      maxItems: MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS,
    }),
  },
  { additionalProperties: false, $id: "TutorV2AcademicMisconceptionMatchRequest" },
);
export type AcademicMisconceptionMatchRequest = Static<
  typeof AcademicMisconceptionMatchRequestSchema
>;

export const AcademicMisconceptionSignalStatusSchema = Type.Union([
  Type.Literal("no-signal"),
  Type.Literal("insufficient-evidence"),
  Type.Literal("possible-misconception"),
  Type.Literal("conflicting-evidence"),
]);
export type AcademicMisconceptionSignalStatus = Static<
  typeof AcademicMisconceptionSignalStatusSchema
>;

export const AcademicMisconceptionReasonCodeSchema = Type.Union([
  Type.Literal("INVALID_MATCH_REQUEST"),
  Type.Literal("UNKNOWN_MISCONCEPTION_CODE"),
  Type.Literal("WRONG_CONCEPT"),
  Type.Literal("CROSS_LEARNER_EVIDENCE"),
  Type.Literal("CROSS_CONTEXT_EVIDENCE"),
  Type.Literal("CROSS_CONCEPT_EVIDENCE"),
  Type.Literal("CROSS_CODE_EVIDENCE"),
  Type.Literal("FUTURE_EVIDENCE_EXCLUDED"),
  Type.Literal("STALE_EVIDENCE_EXCLUDED"),
  Type.Literal("DUPLICATE_EVIDENCE_EXCLUDED"),
  Type.Literal("UNACCEPTED_EVIDENCE_KIND"),
  Type.Literal("MINIMUM_SUPPORTING_EVIDENCE_NOT_MET"),
  Type.Literal("MINIMUM_DISTINCT_OPPORTUNITIES_NOT_MET"),
  Type.Literal("EVIDENCE_IDENTITY_CONFLICT"),
  Type.Literal("SUPPORTING_AND_CONTRADICTING_EVIDENCE"),
  Type.Literal("NO_ACADEMIC_SIGNAL"),
  Type.Literal("NO_SUPPORTING_EVIDENCE"),
]);
export type AcademicMisconceptionReasonCode = Static<
  typeof AcademicMisconceptionReasonCodeSchema
>;

export const AcademicMisconceptionEvidenceSummarySchema = Type.Object(
  {
    submittedEvidenceCount: Type.Integer({
      minimum: 0,
      maximum: MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS,
    }),
    eligibleEvidenceCount: Type.Integer({
      minimum: 0,
      maximum: MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS,
    }),
    supportingEvidenceCount: Type.Integer({
      minimum: 0,
      maximum: MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS,
    }),
    contradictingEvidenceCount: Type.Integer({
      minimum: 0,
      maximum: MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS,
    }),
    distinctSupportingOpportunityCount: Type.Integer({
      minimum: 0,
      maximum: MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS,
    }),
    staleEvidenceCount: Type.Integer({
      minimum: 0,
      maximum: MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS,
    }),
    futureEvidenceCount: Type.Integer({
      minimum: 0,
      maximum: MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS,
    }),
    duplicateEvidenceCount: Type.Integer({
      minimum: 0,
      maximum: MAXIMUM_MISCONCEPTION_EVIDENCE_ITEMS,
    }),
  },
  { additionalProperties: false, $id: "TutorV2AcademicMisconceptionEvidenceSummary" },
);
export type AcademicMisconceptionEvidenceSummary = Static<
  typeof AcademicMisconceptionEvidenceSummarySchema
>;

const NullableOpaqueReferenceSchema = Type.Union([
  OpaqueReferenceSchema,
  Type.Null(),
]);
const NullableAcademicMisconceptionCodeSchema = Type.Union([
  AcademicMisconceptionCodeSchema,
  Type.Null(),
]);

const SERIALIZED_SIGNAL_AUTHORITY_FIELDS = {
  possibleInstructionalSignalOnly: Type.Literal(true),
  authoritativeDiagnosis: Type.Literal(false),
  authoritativeMasteryState: Type.Literal(false),
  durableLearnerClassificationAllowed: Type.Literal(false),
} as const;

const SerializedPossibleAcademicMisconceptionSignalSchema = Type.Object(
  {
    status: Type.Literal("possible-misconception"),
    misconceptionRef: AcademicMisconceptionReferenceSchema,
    academicMisconceptionCode: ReviewedAcademicMisconceptionCodeSchema,
    ...SERIALIZED_SIGNAL_AUTHORITY_FIELDS,
  },
  { additionalProperties: false },
);

const SerializedNonPossibleAcademicMisconceptionSignalSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("no-signal"),
      Type.Literal("insufficient-evidence"),
      Type.Literal("conflicting-evidence"),
    ]),
    misconceptionRef: Type.Null(),
    academicMisconceptionCode: Type.Null(),
    ...SERIALIZED_SIGNAL_AUTHORITY_FIELDS,
  },
  { additionalProperties: false },
);

/**
 * Serialization-ready misconception projection for the Wave 2 decision packet.
 * A possible signal carries only a registry-bound opaque reference and bounded
 * academic policy code. Every other status suppresses both identifiers.
 */
export const SerializedAcademicMisconceptionSignalSchema = Type.Union(
  [
    SerializedPossibleAcademicMisconceptionSignalSchema,
    SerializedNonPossibleAcademicMisconceptionSignalSchema,
  ],
  { $id: "TutorV2SerializedAcademicMisconceptionSignal" },
);
export type SerializedAcademicMisconceptionSignal = Static<
  typeof SerializedAcademicMisconceptionSignalSchema
>;

export const AcademicMisconceptionSignalResultSchema = Type.Object(
  {
    matcherVersion: Type.Literal(ACADEMIC_MISCONCEPTION_MATCHER_VERSION),
    status: AcademicMisconceptionSignalStatusSchema,
    misconceptionRef: NullableOpaqueReferenceSchema,
    conceptRef: NullableOpaqueReferenceSchema,
    academicMisconceptionCode: NullableAcademicMisconceptionCodeSchema,
    reviewedInstructionalResponseRefs: Type.Array(OpaqueReferenceSchema, {
      maxItems: MAXIMUM_REVIEWED_INSTRUCTIONAL_RESPONSES,
    }),
    prerequisiteConceptRefs: Type.Array(OpaqueReferenceSchema, {
      maxItems: MAXIMUM_PREREQUISITE_CONCEPTS,
    }),
    evidenceSummary: AcademicMisconceptionEvidenceSummarySchema,
    reasonCodes: Type.Array(AcademicMisconceptionReasonCodeSchema, {
      maxItems: 17,
    }),
    possibleInstructionalSignalOnly: Type.Literal(true),
    authoritativeDiagnosis: Type.Literal(false),
    authoritativeMasteryState: Type.Literal(false),
    durableLearnerClassificationAllowed: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV2AcademicMisconceptionSignalResult" },
);
export type AcademicMisconceptionSignalResult = Static<
  typeof AcademicMisconceptionSignalResultSchema
>;

export type AcademicMisconceptionRegistryCreationResult =
  | { readonly status: "ready"; readonly registry: AcademicMisconceptionRegistry }
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_MISCONCEPTION_ENTRY"
        | "DUPLICATE_MISCONCEPTION_REF"
        | "DUPLICATE_MISCONCEPTION_CODE";
      readonly entryIndex: number;
    };

export type SerializedAcademicMisconceptionSignalReviewResult =
  | {
      readonly status: "accepted";
      readonly signal: SerializedAcademicMisconceptionSignal;
    }
  | {
      readonly status: "rejected";
      readonly code:
        | "INVALID_SERIALIZED_SIGNAL"
        | "UNKNOWN_MISCONCEPTION_REF"
        | "MISMATCHED_MISCONCEPTION_CODE";
    };

export interface AcademicMisconceptionRegistry {
  readonly version: typeof ACADEMIC_MISCONCEPTION_REGISTRY_VERSION;
  readonly entryCount: number;
  match(candidate: unknown): AcademicMisconceptionSignalResult;
  reviewSerializedSignal(
    candidate: unknown,
  ): SerializedAcademicMisconceptionSignalReviewResult;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const EMPTY_SUMMARY: AcademicMisconceptionEvidenceSummary = {
  submittedEvidenceCount: 0,
  eligibleEvidenceCount: 0,
  supportingEvidenceCount: 0,
  contradictingEvidenceCount: 0,
  distinctSupportingOpportunityCount: 0,
  staleEvidenceCount: 0,
  futureEvidenceCount: 0,
  duplicateEvidenceCount: 0,
};

const REASON_CODE_ORDER: readonly AcademicMisconceptionReasonCode[] = [
  "INVALID_MATCH_REQUEST",
  "UNKNOWN_MISCONCEPTION_CODE",
  "WRONG_CONCEPT",
  "CROSS_LEARNER_EVIDENCE",
  "CROSS_CONTEXT_EVIDENCE",
  "CROSS_CONCEPT_EVIDENCE",
  "CROSS_CODE_EVIDENCE",
  "EVIDENCE_IDENTITY_CONFLICT",
  "SUPPORTING_AND_CONTRADICTING_EVIDENCE",
  "FUTURE_EVIDENCE_EXCLUDED",
  "STALE_EVIDENCE_EXCLUDED",
  "DUPLICATE_EVIDENCE_EXCLUDED",
  "UNACCEPTED_EVIDENCE_KIND",
  "MINIMUM_SUPPORTING_EVIDENCE_NOT_MET",
  "MINIMUM_DISTINCT_OPPORTUNITIES_NOT_MET",
  "NO_ACADEMIC_SIGNAL",
  "NO_SUPPORTING_EVIDENCE",
];

function hasUniqueItems(items: readonly string[]): boolean {
  return new Set(items).size === items.length;
}

function isSemanticallyValidEntry(entry: AcademicMisconceptionEntry): boolean {
  const requirements = entry.evidenceRequirements;
  return (
    validateExact(
      ReviewedAcademicMisconceptionCodeSchema,
      entry.academicMisconceptionCode,
    ).status === "accepted" &&
    validateExact(
      AcademicMisconceptionReferenceSchema,
      entry.misconceptionRef,
    ).status === "accepted" &&
    validateExact(
      StudyMisconceptionReviewReferenceSchema,
      entry.reviewApprovalRef,
    ).status === "accepted" &&
    requirements.minimumDistinctOpportunityCount <=
      requirements.minimumSupportingEvidenceCount &&
    hasUniqueItems(entry.reviewedInstructionalResponseRefs) &&
    hasUniqueItems(entry.prerequisiteConceptRefs) &&
    !entry.prerequisiteConceptRefs.includes(entry.conceptRef) &&
    hasUniqueItems(requirements.acceptedSourceKinds)
  );
}

function evidenceIdentityEqual(
  left: StudyApprovedAcademicEvidence,
  right: StudyApprovedAcademicEvidence,
): boolean {
  return (
    left.evidenceVersion === right.evidenceVersion &&
    left.evidenceKind === right.evidenceKind &&
    left.evidenceRef === right.evidenceRef &&
    left.opportunityRef === right.opportunityRef &&
    left.learnerScopeRef === right.learnerScopeRef &&
    left.instructionalContextRef === right.instructionalContextRef &&
    left.conceptRef === right.conceptRef &&
    left.academicMisconceptionCode === right.academicMisconceptionCode &&
    left.sourceKind === right.sourceKind &&
    left.finding === right.finding &&
    left.observedAt === right.observedAt &&
    left.approvalKind === right.approvalKind &&
    left.approvalRef === right.approvalRef
  );
}

interface ResultFields {
  readonly status: AcademicMisconceptionSignalStatus;
  readonly entry: AcademicMisconceptionEntry | null;
  readonly conceptRef: string | null;
  readonly academicMisconceptionCode: string | null;
  readonly evidenceSummary: AcademicMisconceptionEvidenceSummary;
  readonly reasonCodes: readonly AcademicMisconceptionReasonCode[];
  readonly includeInstructionalResponseRefs?: boolean;
}

function result(fields: ResultFields): AcademicMisconceptionSignalResult {
  return {
    matcherVersion: ACADEMIC_MISCONCEPTION_MATCHER_VERSION,
    status: fields.status,
    misconceptionRef: fields.entry?.misconceptionRef ?? null,
    conceptRef: fields.conceptRef,
    academicMisconceptionCode: fields.academicMisconceptionCode,
    reviewedInstructionalResponseRefs: fields.includeInstructionalResponseRefs
      ? [...(fields.entry?.reviewedInstructionalResponseRefs ?? [])]
      : [],
    prerequisiteConceptRefs: fields.includeInstructionalResponseRefs
      ? [...(fields.entry?.prerequisiteConceptRefs ?? [])]
      : [],
    evidenceSummary: { ...fields.evidenceSummary },
    reasonCodes: [...new Set(fields.reasonCodes)].sort(
      (left, right) =>
        REASON_CODE_ORDER.indexOf(left) - REASON_CODE_ORDER.indexOf(right),
    ),
    possibleInstructionalSignalOnly: true,
    authoritativeDiagnosis: false,
    authoritativeMasteryState: false,
    durableLearnerClassificationAllowed: false,
  };
}

function matchEntry(
  entry: AcademicMisconceptionEntry,
  request: AcademicMisconceptionMatchRequest,
): AcademicMisconceptionSignalResult {
  const submittedEvidenceCount = request.evidence.length;
  const scopeReasons: AcademicMisconceptionReasonCode[] = [];
  const addScopeReason = (
    condition: boolean,
    code: AcademicMisconceptionReasonCode,
  ): void => {
    if (condition && !scopeReasons.includes(code)) scopeReasons.push(code);
  };

  for (const evidence of request.evidence) {
    addScopeReason(
      evidence.learnerScopeRef !== request.learnerScopeRef,
      "CROSS_LEARNER_EVIDENCE",
    );
    addScopeReason(
      evidence.instructionalContextRef !== request.instructionalContextRef,
      "CROSS_CONTEXT_EVIDENCE",
    );
    addScopeReason(
      evidence.conceptRef !== request.conceptRef,
      "CROSS_CONCEPT_EVIDENCE",
    );
    addScopeReason(
      evidence.academicMisconceptionCode !==
        request.academicMisconceptionCode,
      "CROSS_CODE_EVIDENCE",
    );
  }
  if (scopeReasons.length > 0) {
    return result({
      status: "insufficient-evidence",
      entry,
      conceptRef: request.conceptRef,
      academicMisconceptionCode: request.academicMisconceptionCode,
      evidenceSummary: { ...EMPTY_SUMMARY, submittedEvidenceCount },
      reasonCodes: scopeReasons,
    });
  }

  const evaluatedAtMs = Date.parse(request.evaluatedAt);
  const maximumAgeMs =
    entry.evidenceRequirements.maximumEvidenceAgeDays * DAY_MS;
  const acceptedSourceKinds = new Set(
    entry.evidenceRequirements.acceptedSourceKinds,
  );
  const evidenceByRef = new Map<string, StudyApprovedAcademicEvidence>();
  const supportingOpportunityRefs = new Set<string>();
  const informationalReasons: AcademicMisconceptionReasonCode[] = [];
  let eligibleEvidenceCount = 0;
  let supportingEvidenceCount = 0;
  let contradictingEvidenceCount = 0;
  let staleEvidenceCount = 0;
  let futureEvidenceCount = 0;
  let duplicateEvidenceCount = 0;
  let evidenceIdentityConflict = false;

  const addReason = (code: AcademicMisconceptionReasonCode): void => {
    if (!informationalReasons.includes(code)) informationalReasons.push(code);
  };

  for (const evidence of request.evidence) {
    const previous = evidenceByRef.get(evidence.evidenceRef);
    if (previous) {
      if (evidenceIdentityEqual(previous, evidence)) {
        duplicateEvidenceCount += 1;
        addReason("DUPLICATE_EVIDENCE_EXCLUDED");
      } else {
        evidenceIdentityConflict = true;
      }
      continue;
    }
    evidenceByRef.set(evidence.evidenceRef, evidence);

    const observedAtMs = Date.parse(evidence.observedAt);
    if (observedAtMs > evaluatedAtMs) {
      futureEvidenceCount += 1;
      addReason("FUTURE_EVIDENCE_EXCLUDED");
      continue;
    }
    if (evaluatedAtMs - observedAtMs > maximumAgeMs) {
      staleEvidenceCount += 1;
      addReason("STALE_EVIDENCE_EXCLUDED");
      continue;
    }
    if (!acceptedSourceKinds.has(evidence.sourceKind)) {
      addReason("UNACCEPTED_EVIDENCE_KIND");
      continue;
    }

    eligibleEvidenceCount += 1;
    if (evidence.finding === "consistent-with-misconception-code") {
      supportingEvidenceCount += 1;
      supportingOpportunityRefs.add(evidence.opportunityRef);
    } else {
      contradictingEvidenceCount += 1;
    }
  }

  const evidenceSummary: AcademicMisconceptionEvidenceSummary = {
    submittedEvidenceCount,
    eligibleEvidenceCount,
    supportingEvidenceCount,
    contradictingEvidenceCount,
    distinctSupportingOpportunityCount: supportingOpportunityRefs.size,
    staleEvidenceCount,
    futureEvidenceCount,
    duplicateEvidenceCount,
  };

  if (evidenceIdentityConflict) {
    return result({
      status: "conflicting-evidence",
      entry,
      conceptRef: request.conceptRef,
      academicMisconceptionCode: request.academicMisconceptionCode,
      evidenceSummary,
      reasonCodes: ["EVIDENCE_IDENTITY_CONFLICT", ...informationalReasons],
    });
  }
  if (supportingEvidenceCount > 0 && contradictingEvidenceCount > 0) {
    return result({
      status: "conflicting-evidence",
      entry,
      conceptRef: request.conceptRef,
      academicMisconceptionCode: request.academicMisconceptionCode,
      evidenceSummary,
      reasonCodes: [
        "SUPPORTING_AND_CONTRADICTING_EVIDENCE",
        ...informationalReasons,
      ],
    });
  }

  const enoughSupportingEvidence =
    supportingEvidenceCount >=
    entry.evidenceRequirements.minimumSupportingEvidenceCount;
  const enoughDistinctOpportunities =
    supportingOpportunityRefs.size >=
    entry.evidenceRequirements.minimumDistinctOpportunityCount;
  if (enoughSupportingEvidence && enoughDistinctOpportunities) {
    return result({
      status: "possible-misconception",
      entry,
      conceptRef: request.conceptRef,
      academicMisconceptionCode: request.academicMisconceptionCode,
      evidenceSummary,
      reasonCodes: informationalReasons,
      includeInstructionalResponseRefs: true,
    });
  }

  if (supportingEvidenceCount === 0) {
    if (eligibleEvidenceCount === 0 && submittedEvidenceCount > 0) {
      return result({
        status: "insufficient-evidence",
        entry,
        conceptRef: request.conceptRef,
        academicMisconceptionCode: request.academicMisconceptionCode,
        evidenceSummary,
        reasonCodes: informationalReasons,
      });
    }
    return result({
      status: "no-signal",
      entry,
      conceptRef: request.conceptRef,
      academicMisconceptionCode: request.academicMisconceptionCode,
      evidenceSummary,
      reasonCodes: [
        eligibleEvidenceCount > 0
          ? "NO_SUPPORTING_EVIDENCE"
          : "NO_ACADEMIC_SIGNAL",
        ...informationalReasons,
      ],
    });
  }

  const thresholdReasons = [...informationalReasons];
  if (!enoughSupportingEvidence) {
    thresholdReasons.push("MINIMUM_SUPPORTING_EVIDENCE_NOT_MET");
  }
  if (!enoughDistinctOpportunities) {
    thresholdReasons.push("MINIMUM_DISTINCT_OPPORTUNITIES_NOT_MET");
  }
  return result({
    status: "insufficient-evidence",
    entry,
    conceptRef: request.conceptRef,
    academicMisconceptionCode: request.academicMisconceptionCode,
    evidenceSummary,
    reasonCodes: thresholdReasons,
  });
}

export function createAcademicMisconceptionRegistry(
  candidates: readonly unknown[],
): AcademicMisconceptionRegistryCreationResult {
  const entriesByCode = new Map<string, AcademicMisconceptionEntry>();
  const entriesByRef = new Map<string, AcademicMisconceptionEntry>();
  const misconceptionRefs = new Set<string>();

  for (const [entryIndex, candidate] of candidates.entries()) {
    const validation = validateExact(AcademicMisconceptionEntrySchema, candidate);
    if (
      validation.status === "rejected" ||
      !isSemanticallyValidEntry(validation.value)
    ) {
      return {
        status: "rejected",
        code: "INVALID_MISCONCEPTION_ENTRY",
        entryIndex,
      };
    }
    if (misconceptionRefs.has(validation.value.misconceptionRef)) {
      return {
        status: "rejected",
        code: "DUPLICATE_MISCONCEPTION_REF",
        entryIndex,
      };
    }
    if (entriesByCode.has(validation.value.academicMisconceptionCode)) {
      return {
        status: "rejected",
        code: "DUPLICATE_MISCONCEPTION_CODE",
        entryIndex,
      };
    }
    misconceptionRefs.add(validation.value.misconceptionRef);
    entriesByRef.set(
      validation.value.misconceptionRef,
      structuredClone(validation.value),
    );
    entriesByCode.set(
      validation.value.academicMisconceptionCode,
      structuredClone(validation.value),
    );
  }

  return {
    status: "ready",
    registry: {
      version: ACADEMIC_MISCONCEPTION_REGISTRY_VERSION,
      entryCount: entriesByCode.size,
      reviewSerializedSignal(
        candidate: unknown,
      ): SerializedAcademicMisconceptionSignalReviewResult {
        const validation = validateExact(
          SerializedAcademicMisconceptionSignalSchema,
          candidate,
        );
        if (validation.status === "rejected") {
          return { status: "rejected", code: "INVALID_SERIALIZED_SIGNAL" };
        }
        if (validation.value.status !== "possible-misconception") {
          return { status: "accepted", signal: structuredClone(validation.value) };
        }
        const entry = entriesByRef.get(validation.value.misconceptionRef);
        if (entry === undefined) {
          return { status: "rejected", code: "UNKNOWN_MISCONCEPTION_REF" };
        }
        if (
          entry.academicMisconceptionCode !==
          validation.value.academicMisconceptionCode
        ) {
          return {
            status: "rejected",
            code: "MISMATCHED_MISCONCEPTION_CODE",
          };
        }
        return { status: "accepted", signal: structuredClone(validation.value) };
      },
      match(candidate: unknown): AcademicMisconceptionSignalResult {
        const validation = validateExact(
          AcademicMisconceptionMatchRequestSchema,
          candidate,
        );
        if (
          validation.status === "rejected" ||
          !Number.isFinite(Date.parse(validation.value.evaluatedAt)) ||
          validation.value.evidence.some((evidence) =>
            !Number.isFinite(Date.parse(evidence.observedAt)),
          )
        ) {
          return result({
            status: "insufficient-evidence",
            entry: null,
            conceptRef: null,
            academicMisconceptionCode: null,
            evidenceSummary: EMPTY_SUMMARY,
            reasonCodes: ["INVALID_MATCH_REQUEST"],
          });
        }

        const entry = entriesByCode.get(
          validation.value.academicMisconceptionCode,
        );
        if (!entry) {
          return result({
            status: "insufficient-evidence",
            entry: null,
            conceptRef: validation.value.conceptRef,
            academicMisconceptionCode: null,
            evidenceSummary: {
              ...EMPTY_SUMMARY,
              submittedEvidenceCount: validation.value.evidence.length,
            },
            reasonCodes: ["UNKNOWN_MISCONCEPTION_CODE"],
          });
        }
        if (entry.conceptRef !== validation.value.conceptRef) {
          return result({
            status: "insufficient-evidence",
            entry,
            conceptRef: validation.value.conceptRef,
            academicMisconceptionCode:
              validation.value.academicMisconceptionCode,
            evidenceSummary: {
              ...EMPTY_SUMMARY,
              submittedEvidenceCount: validation.value.evidence.length,
            },
            reasonCodes: ["WRONG_CONCEPT"],
          });
        }
        return matchEntry(entry, validation.value);
      },
    },
  };
}
