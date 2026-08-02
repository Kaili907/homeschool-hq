import {
  EXTERNAL_CAPTURE_SCHEMA_VERSION,
  ExternalCaptureError,
  type CourseMappingResolution,
  type CourseSectionMapping,
  type ExternalAssignmentRecord,
  type ExternalCaptureActor,
  type ExternalCourseIdentity,
  type ExternalSectionIdentity,
  type ManuelCourseTarget,
} from "./types.js";
import { assertExternalCapturePermission } from "./permissions.js";
import {
  assertOffsetTimestamp,
  assertOpaqueReference,
  normalizeVisibleText,
  validateCourseSectionMapping,
} from "./validation.js";

export interface ConfirmCourseSectionMappingInput {
  readonly mappingId: string;
  readonly learnerRef: string;
  readonly providerId: string;
  readonly externalCourse: ExternalCourseIdentity;
  readonly externalSection?: ExternalSectionIdentity;
  readonly target: ManuelCourseTarget;
  readonly confirmedBy: ExternalCaptureActor;
  readonly confirmedAt: string;
}

function normalizeLabel(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sameOptionalLabel(
  left: ExternalSectionIdentity | undefined,
  right: ExternalSectionIdentity | undefined,
): boolean {
  if (!left || !right) return !left && !right;
  return normalizeLabel(left.displayName) === normalizeLabel(right.displayName);
}

export function confirmCourseSectionMapping(
  input: ConfirmCourseSectionMappingInput,
): CourseSectionMapping {
  assertExternalCapturePermission(
    input.confirmedBy,
    "schedule_assignment",
    input.learnerRef,
  );
  assertOpaqueReference(input.mappingId, "mappingId");
  assertOpaqueReference(input.providerId, "providerId");
  assertOpaqueReference(input.target.courseRef, "target.courseRef");
  if (input.target.sectionRef) {
    assertOpaqueReference(input.target.sectionRef, "target.sectionRef");
  }
  normalizeVisibleText(
    input.externalCourse.displayName,
    "externalCourse.displayName",
    160,
  );
  if (input.externalCourse.externalCourseRef) {
    assertOpaqueReference(
      input.externalCourse.externalCourseRef,
      "externalCourse.externalCourseRef",
    );
  }
  if (input.externalSection) {
    normalizeVisibleText(
      input.externalSection.displayName,
      "externalSection.displayName",
      160,
    );
    if (input.externalSection.externalSectionRef) {
      assertOpaqueReference(
        input.externalSection.externalSectionRef,
        "externalSection.externalSectionRef",
      );
    }
  }
  normalizeVisibleText(input.target.displayName, "target.displayName", 160);
  assertOffsetTimestamp(input.confirmedAt, "confirmedAt");

  const mapping: CourseSectionMapping = {
    schemaVersion: EXTERNAL_CAPTURE_SCHEMA_VERSION,
    mappingId: input.mappingId,
    learnerRef: input.learnerRef,
    providerId: input.providerId,
    externalCourse: input.externalCourse,
    ...(input.externalSection
      ? { externalSection: input.externalSection }
      : {}),
    target: input.target,
    status: "confirmed",
    confirmedByParentRef: input.confirmedBy.actorRef,
    confirmedAt: input.confirmedAt,
    revision: 0,
  };
  const validation = validateCourseSectionMapping(mapping);
  if (!validation.ok) {
    const first = validation.issues[0];
    throw new ExternalCaptureError(
      first.code === "credential_material"
        ? "credential_material"
        : "invalid_input",
      first.message,
      first.path,
    );
  }
  return mapping;
}

export function resolveCourseSectionMapping(
  learnerRef: string,
  providerId: string,
  externalCourse: ExternalCourseIdentity,
  externalSection: ExternalSectionIdentity | undefined,
  mappings: readonly CourseSectionMapping[],
): CourseMappingResolution {
  const scoped = mappings.filter(
    (mapping) =>
      mapping.learnerRef === learnerRef &&
      mapping.providerId === providerId &&
      mapping.status === "confirmed",
  );
  if (
    externalCourse.externalCourseRef &&
    externalSection?.externalSectionRef
  ) {
    const exact = scoped.filter(
      (mapping) =>
        mapping.externalCourse.externalCourseRef ===
          externalCourse.externalCourseRef &&
        mapping.externalSection?.externalSectionRef ===
          externalSection.externalSectionRef,
    );
    if (exact.length === 1) {
      return {
        status: "matched",
        mapping: exact[0],
        matchBasis: "stable_course_and_section_refs",
      };
    }
    if (exact.length > 1) return { status: "ambiguous", candidates: exact };
  }
  if (externalCourse.externalCourseRef) {
    const courseMatches = scoped.filter(
      (mapping) =>
        mapping.externalCourse.externalCourseRef ===
          externalCourse.externalCourseRef &&
        (!externalSection ||
          !mapping.externalSection ||
          sameOptionalLabel(mapping.externalSection, externalSection)),
    );
    if (courseMatches.length === 1) {
      return {
        status: "matched",
        mapping: courseMatches[0],
        matchBasis: "stable_course_ref",
      };
    }
    if (courseMatches.length > 1) {
      return { status: "ambiguous", candidates: courseMatches };
    }
  }
  const labelMatches = scoped.filter(
    (mapping) =>
      normalizeLabel(mapping.externalCourse.displayName) ===
        normalizeLabel(externalCourse.displayName) &&
      sameOptionalLabel(mapping.externalSection, externalSection),
  );
  if (labelMatches.length === 1) {
    return {
      status: "matched",
      mapping: labelMatches[0],
      matchBasis: "confirmed_normalized_labels",
    };
  }
  if (labelMatches.length > 1) {
    return { status: "ambiguous", candidates: labelMatches };
  }
  return {
    status: "unmapped",
    providerId,
    externalCourse,
    ...(externalSection ? { externalSection } : {}),
  };
}

export function applyCourseSectionMapping(
  assignment: ExternalAssignmentRecord,
  mapping: CourseSectionMapping,
): ExternalAssignmentRecord {
  if (Date.parse(mapping.confirmedAt) < Date.parse(assignment.updatedAt)) {
    throw new ExternalCaptureError(
      "invalid_state",
      "A stale course mapping cannot roll the assignment revision backward.",
      "courseMapping.confirmedAt",
    );
  }
  if (
    assignment.learnerRef !== mapping.learnerRef ||
    assignment.provider.providerId !== mapping.providerId
  ) {
    throw new ExternalCaptureError(
      "provider_mismatch",
      "Course mapping does not belong to this learner/provider.",
      "courseMapping",
    );
  }
  const resolution = resolveCourseSectionMapping(
    assignment.learnerRef,
    assignment.provider.providerId,
    assignment.externalCourse,
    assignment.externalSection,
    [mapping],
  );
  if (resolution.status !== "matched") {
    throw new ExternalCaptureError(
      "identity_conflict",
      "Course mapping does not match the assignment's confirmed course/section.",
      "courseMapping",
    );
  }
  return {
    ...assignment,
    courseMapping: mapping,
    revision: assignment.revision + 1,
    updatedAt: mapping.confirmedAt,
  };
}
