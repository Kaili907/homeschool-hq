import { Type } from "../../schema/typebox.js";
import { validateExact } from "../contracts/validation.js";
import {
  ADAPTIVE_ADMISSION_VERSION,
  ADAPTIVE_CAPABILITY_METADATA_VERSION,
  ADAPTIVE_FEATURES,
  StudyAdaptiveAdmissionInputSchema,
  type AdaptiveAdmissionDecision,
  type AdmissionRefusalReason,
  type TutorFeatureAuthorityExclusions,
} from "./contracts.js";

const JSON_OBJECT_BOUNDARY_SCHEMA = Type.Object({}, { additionalProperties: true });
const FEATURE_VOCABULARY = new Set<string>(ADAPTIVE_FEATURES);
const POLICY_CODE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const AUTHORITY_EXCLUSIONS: TutorFeatureAuthorityExclusions = Object.freeze({
  scope: "tutor-feature-permission-only",
  officialGradeMutationAllowed: false,
  workingLevelMutationAllowed: false,
  masteryDeclarationAllowed: false,
  curriculumMutationAllowed: false,
  permissionMutationAllowed: false,
  safetyClearanceAllowed: false,
  guardianAuthorityAllowed: false,
  answerAuthorityExposed: false,
});

function refusal(reason: AdmissionRefusalReason): AdaptiveAdmissionDecision {
  return {
    ...AUTHORITY_EXCLUSIONS,
    status: "refused",
    reason,
    tutorFeaturePermission: "denied",
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Classifies malformed or unknown inputs without trusting or echoing their
 * contents. The boundary check runs first, so these property reads cannot
 * invoke accessors or traverse custom prototypes.
 */
function classifyInvalidInput(input: unknown): AdmissionRefusalReason {
  if (validateExact(JSON_OBJECT_BOUNDARY_SCHEMA, input).status === "rejected") {
    return "insufficient-capability-metadata";
  }

  const root = asRecord(input);
  const request = asRecord(root?.request);
  const metadata = asRecord(root?.capabilityMetadata);

  if (
    request?.requestVersion !== ADAPTIVE_ADMISSION_VERSION ||
    metadata?.metadataVersion !== ADAPTIVE_CAPABILITY_METADATA_VERSION
  ) {
    return "insufficient-capability-metadata";
  }

  const feature = request.feature;
  if (typeof feature === "string" && !FEATURE_VOCABULARY.has(feature)) {
    return "adaptive-feature-not-admitted";
  }

  const actionFamily = request.actionFamily;
  if (
    typeof actionFamily !== "string" ||
    actionFamily.length < 3 ||
    actionFamily.length > 96 ||
    !POLICY_CODE.test(actionFamily)
  ) {
    return "unsupported-action-family";
  }

  const curriculumAdmission = metadata.curriculumAdmission;
  if (
    curriculumAdmission !== "admitted" &&
    curriculumAdmission !== "not-admitted"
  ) {
    return "curriculum-not-admitted";
  }

  const safetyAdmission = metadata.safetyAdmission;
  if (safetyAdmission !== "admitted" && safetyAdmission !== "restricted") {
    return "safety-restricted";
  }

  return "insufficient-capability-metadata";
}

/**
 * Makes a permission decision for one Tutor adaptive feature. The function is
 * pure, consumes only a closed Study-side metadata contract, and grants no
 * Study authority or mutation capability.
 */
function evaluateAdaptiveAdmissionUnchecked(input: unknown): AdaptiveAdmissionDecision {
  const validation = validateExact(StudyAdaptiveAdmissionInputSchema, input);
  if (validation.status === "rejected") {
    return refusal(classifyInvalidInput(input));
  }

  const { request, capabilityMetadata: metadata } = validation.value;

  const capabilityNames = metadata.capabilities.map((record) => record.feature);
  if (new Set(capabilityNames).size !== capabilityNames.length) {
    return refusal("insufficient-capability-metadata");
  }
  if (
    metadata.capabilities.some(
      (record) => new Set(record.actionFamilies).size !== record.actionFamilies.length,
    )
  ) {
    return refusal("insufficient-capability-metadata");
  }

  if (request.invocationBindingRef !== metadata.invocationBindingRef) {
    return refusal("insufficient-capability-metadata");
  }
  if (
    request.householdScopeRef !== metadata.householdScopeRef ||
    request.learnerScopeRef !== metadata.learnerScopeRef ||
    request.sessionRef !== metadata.sessionRef ||
    request.instructionalContextRef !== metadata.instructionalContextRef
  ) {
    return refusal("scope-binding-mismatch");
  }
  if (metadata.safetyAdmission !== "admitted") {
    return refusal("safety-restricted");
  }
  if (
    metadata.curriculumAdmission !== "admitted" ||
    request.curriculumBindingRef !== metadata.curriculumBindingRef
  ) {
    return refusal("curriculum-not-admitted");
  }
  if (request.subjectRef !== metadata.subjectRef) {
    return refusal("unsupported-subject-capability");
  }

  const capability = metadata.capabilities.find(
    (record) => record.feature === request.feature,
  );
  if (!capability) {
    return refusal("insufficient-capability-metadata");
  }
  if (capability.admission !== "admitted") {
    return refusal("adaptive-feature-not-admitted");
  }
  if (!capability.actionFamilies.includes(request.actionFamily)) {
    return refusal("unsupported-action-family");
  }
  if (
    capability.reviewedContent === "required" &&
    request.reviewedContentAdmission !== "admitted"
  ) {
    return refusal("reviewed-content-required");
  }

  return {
    ...AUTHORITY_EXCLUSIONS,
    status: "admitted",
    reason: "admitted",
    tutorFeaturePermission: "allowed",
    invocationBindingRef: request.invocationBindingRef,
    householdScopeRef: request.householdScopeRef,
    learnerScopeRef: request.learnerScopeRef,
    sessionRef: request.sessionRef,
    instructionalContextRef: request.instructionalContextRef,
    subjectRef: request.subjectRef,
    curriculumBindingRef: request.curriculumBindingRef,
    feature: request.feature,
    actionFamily: request.actionFamily,
  };
}

export function evaluateAdaptiveAdmission(input: unknown): AdaptiveAdmissionDecision {
  try {
    return evaluateAdaptiveAdmissionUnchecked(input);
  } catch {
    return refusal("insufficient-capability-metadata");
  }
}
