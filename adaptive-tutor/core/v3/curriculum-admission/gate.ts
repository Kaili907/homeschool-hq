import { validateExact } from "../../v2/contracts/validation.js";
import {
  CurriculumAdmissionInputSchema,
  type CurriculumAdmissionDecision,
  type CurriculumAdmissionInput,
  type CurriculumAdmissionReason,
  type CurriculumTutorAuthorityExclusions,
  type TutorCapabilityDeclaration,
  type TrustedCurriculumMetadata,
} from "./contracts.js";
import {
  buildCurriculumCapabilityRegistry,
  isCompiledCurriculumCapabilityRegistry,
  type CompiledCurriculumCapabilityRegistry,
} from "./registry.js";

const ACTIVE_ASSESSMENT = "active-graded-or-mastery-check" as const;

const AUTHORITY_EXCLUSIONS: CurriculumTutorAuthorityExclusions = Object.freeze({
  scope: "curriculum-tutor-admission-only",
  curriculumAssignmentAllowed: false,
  curriculumMutationAllowed: false,
  nominalGradeMutationAllowed: false,
  officialWorkingLevelMutationAllowed: false,
  studyAuthorityMutationAllowed: false,
});

type RefusalReason = Extract<
  CurriculumAdmissionReason,
  | "invalid-admission-input"
  | "invalid-curriculum-metadata"
  | "curriculum-release-not-admitted"
  | "unknown-course"
  | "course-subject-mismatch"
  | "unknown-unit"
  | "lesson-requires-unit"
  | "unknown-lesson"
  | "lesson-unit-mismatch"
  | "official-working-level-unavailable"
  | "course-working-level-mismatch"
  | "study-authority-scope-mismatch"
  | "action-family-not-authorized"
  | "missing-reviewed-capability-declaration"
  | "capability-declaration-not-reviewed"
  | "invalid-capability-declaration"
  | "unsupported-tutor-capability"
  | "tutor-capability-refused"
>;

function refusal(reason: RefusalReason): CurriculumAdmissionDecision {
  return {
    ...AUTHORITY_EXCLUSIONS,
    status: "refused",
    reason,
    tutorInvocationAllowed: false,
    freeFormInstructionAllowed: false,
    staticCurriculumAllowed: false,
  };
}

function boundDecision(
  registry: CompiledCurriculumCapabilityRegistry,
  input: CurriculumAdmissionInput,
) {
  const { request } = input;
  return {
    ...AUTHORITY_EXCLUSIONS,
    releaseRef: registry.coverage.releaseRef,
    courseRef: request.courseRef,
    subjectRef: request.subjectRef,
    unitRef: request.unitRef,
    lessonRef: request.lessonRef,
    nominalGrade: request.nominalGrade,
    officialWorkingLevel: request.officialWorkingLevel,
    capabilityRef: request.capabilityRef,
    actionFamily: request.actionFamily,
  } as const;
}

function staticOnly(
  registry: CompiledCurriculumCapabilityRegistry,
  input: CurriculumAdmissionInput,
  reason:
    | "capability-static-only"
    | "unsupported-tutor-capability-static-only"
    | "active-assessment-static-only",
): CurriculumAdmissionDecision {
  return {
    ...boundDecision(registry, input),
    status: "static-only",
    reason,
    tutorInvocationAllowed: false,
    freeFormInstructionAllowed: false,
    staticCurriculumAllowed: true,
  };
}

function duplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function declarationIsConsistent(declaration: TutorCapabilityDeclaration): boolean {
  return !(
    duplicates(declaration.supportedCourseRefs) ||
    duplicates(declaration.supportedSubjectRefs) ||
    duplicates(declaration.allowedAssessmentPhases) ||
    duplicates(declaration.allowedActionFamilies) ||
    (declaration.admissionState === "static-only" &&
      declaration.deliveryMode !== "reviewed-static")
  );
}

function requestMatchesScope(input: CurriculumAdmissionInput): boolean {
  const { request, studyAuthorityScope: scope } = input;
  return (
    request.courseRef === scope.courseRef &&
    request.subjectRef === scope.subjectRef &&
    request.unitRef === scope.unitRef &&
    request.lessonRef === scope.lessonRef &&
    request.nominalGrade === scope.nominalGrade &&
    request.officialWorkingLevel === scope.officialWorkingLevel
  );
}

function unsupportedCapability(
  registry: CompiledCurriculumCapabilityRegistry,
  input: CurriculumAdmissionInput,
  declaration: TutorCapabilityDeclaration,
): CurriculumAdmissionDecision {
  return declaration.unsupportedOutcome === "static-only"
    ? staticOnly(registry, input, "unsupported-tutor-capability-static-only")
    : refusal("unsupported-tutor-capability");
}

function classifyInvalidInput(input: unknown): RefusalReason {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const declaration = (input as Record<string, unknown>).capabilityDeclaration;
    if (declaration === null || declaration === undefined) {
      return "missing-reviewed-capability-declaration";
    }
  }
  return "invalid-admission-input";
}

function evaluateWithRegistryUnchecked(
  registry: CompiledCurriculumCapabilityRegistry,
  inputValue: unknown,
): CurriculumAdmissionDecision {
  const validation = validateExact(CurriculumAdmissionInputSchema, inputValue);
  if (validation.status === "rejected") return refusal(classifyInvalidInput(inputValue));

  const input = validation.value;
  const { request, studyAuthorityScope: scope, capabilityDeclaration: declaration } = input;

  if (duplicates(scope.allowedActionFamilies)) return refusal("invalid-admission-input");
  if (
    scope.curriculumReleaseRef !== registry.coverage.releaseRef ||
    !requestMatchesScope(input)
  ) {
    return refusal("study-authority-scope-mismatch");
  }
  if (
    registry.coverage.reviewState !== "reviewed" ||
    registry.coverage.admissionState !== "admitted"
  ) {
    return refusal("curriculum-release-not-admitted");
  }

  const course = registry.getCourse(request.courseRef);
  if (!course) return refusal("unknown-course");
  if (course.subjectRef !== request.subjectRef) return refusal("course-subject-mismatch");
  if (!registry.hasWorkingLevel(request.subjectRef, request.officialWorkingLevel)) {
    return refusal("official-working-level-unavailable");
  }
  if (course.grade !== request.officialWorkingLevel) {
    return refusal("course-working-level-mismatch");
  }
  if (request.lessonRef !== null && request.unitRef === null) {
    return refusal("lesson-requires-unit");
  }
  if (request.unitRef !== null && !registry.hasUnit(course.courseRef, request.unitRef)) {
    return refusal("unknown-unit");
  }
  if (request.lessonRef !== null) {
    const unitRef = registry.lessonUnit(course.courseRef, request.lessonRef);
    if (unitRef === undefined) return refusal("unknown-lesson");
    if (unitRef !== request.unitRef) return refusal("lesson-unit-mismatch");
  }
  if (!scope.allowedActionFamilies.includes(request.actionFamily)) {
    return refusal("action-family-not-authorized");
  }
  if (declaration === null) return refusal("missing-reviewed-capability-declaration");
  if (!declarationIsConsistent(declaration)) {
    return refusal("invalid-capability-declaration");
  }
  if (declaration.reviewState !== "reviewed") {
    return refusal("capability-declaration-not-reviewed");
  }
  if (declaration.capabilityRef !== request.capabilityRef) {
    return refusal("unsupported-tutor-capability");
  }
  if (declaration.admissionState === "refused") {
    return refusal("tutor-capability-refused");
  }
  if (
    declaration.admissionState === "static-only" ||
    declaration.deliveryMode === "reviewed-static"
  ) {
    return staticOnly(registry, input, "capability-static-only");
  }
  if (
    request.assessmentPhase === ACTIVE_ASSESSMENT &&
    declaration.deliveryMode === "free-form-instruction"
  ) {
    return staticOnly(registry, input, "active-assessment-static-only");
  }

  const supportsCurriculum =
    declaration.supportedCourseRefs.includes(request.courseRef) ||
    declaration.supportedSubjectRefs.includes(request.subjectRef);
  if (
    !supportsCurriculum ||
    !declaration.allowedAssessmentPhases.includes(request.assessmentPhase) ||
    !declaration.allowedActionFamilies.includes(request.actionFamily)
  ) {
    return unsupportedCapability(registry, input, declaration);
  }

  return {
    ...boundDecision(registry, input),
    status: "admitted",
    reason: "curriculum-capability-admitted",
    tutorInvocationAllowed: true,
    freeFormInstructionAllowed: true,
    staticCurriculumAllowed: true,
  };
}

export function evaluateCurriculumAdmissionWithRegistry(
  registry: CompiledCurriculumCapabilityRegistry,
  input: unknown,
): CurriculumAdmissionDecision {
  try {
    if (!isCompiledCurriculumCapabilityRegistry(registry)) {
      return refusal("invalid-curriculum-metadata");
    }
    return evaluateWithRegistryUnchecked(registry, input);
  } catch {
    return refusal("invalid-admission-input");
  }
}

/** Convenience boundary for callers that have not precompiled release metadata. */
export function evaluateCurriculumAdmission(
  curriculumMetadata: TrustedCurriculumMetadata | unknown,
  input: unknown,
): CurriculumAdmissionDecision {
  try {
    const compilation = buildCurriculumCapabilityRegistry(curriculumMetadata);
    if (compilation.status === "rejected") return refusal(compilation.reason);
    return evaluateWithRegistryUnchecked(compilation.registry, input);
  } catch {
    return refusal("invalid-curriculum-metadata");
  }
}

export const evaluateCurriculumTutorAdmission = evaluateCurriculumAdmission;
