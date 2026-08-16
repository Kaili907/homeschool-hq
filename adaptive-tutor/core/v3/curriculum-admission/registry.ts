import { validateExact } from "../../v2/contracts/validation.js";
import {
  CurriculumCourseMetadataSchema,
  TrustedCurriculumMetadataSchema,
  type CurriculumCourseMetadata,
  type TrustedCurriculumMetadata,
} from "./contracts.js";

export interface CurriculumCoverage {
  readonly releaseRef: string;
  readonly packageRef: string;
  readonly releaseVersion: string;
  readonly releaseDigest: string;
  readonly reviewState: "reviewed" | "not-reviewed";
  readonly admissionState: "admitted" | "not-admitted";
  readonly grades: readonly number[];
  readonly subjectRefs: readonly string[];
  readonly courseRefs: readonly string[];
  readonly counts: {
    readonly courses: number;
    readonly units: number;
    readonly lessons: number;
  };
}

export interface CompiledCurriculumCapabilityRegistry {
  readonly coverage: CurriculumCoverage;
  readonly getCourse: (courseRef: string) => CurriculumCourseMetadata | undefined;
  readonly hasWorkingLevel: (subjectRef: string, grade: number) => boolean;
  readonly hasUnit: (courseRef: string, unitRef: string) => boolean;
  readonly lessonUnit: (courseRef: string, lessonRef: string) => string | undefined;
}

export type CurriculumRegistryCompilation =
  | {
      readonly status: "ready";
      readonly registry: CompiledCurriculumCapabilityRegistry;
    }
  | {
      readonly status: "rejected";
      readonly reason: "invalid-curriculum-metadata";
    };

const COMPILED_REGISTRIES = new WeakSet<object>();

export function isCompiledCurriculumCapabilityRegistry(
  value: unknown,
): value is CompiledCurriculumCapabilityRegistry {
  return typeof value === "object" && value !== null && COMPILED_REGISTRIES.has(value);
}

function duplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function validateMetadataInBoundedSegments(
  metadataInput: unknown,
): TrustedCurriculumMetadata | undefined {
  if (
    metadataInput === null ||
    typeof metadataInput !== "object" ||
    Array.isArray(metadataInput) ||
    Object.getPrototypeOf(metadataInput) !== Object.prototype
  ) {
    return undefined;
  }

  const descriptors = Object.getOwnPropertyDescriptors(metadataInput);
  const expectedKeys = [
    "metadataVersion",
    "metadataKind",
    "source",
    "releaseRef",
    "packageRef",
    "releaseVersion",
    "releaseDigest",
    "reviewState",
    "admissionState",
    "courses",
  ];
  if (
    Object.keys(descriptors).length !== expectedKeys.length ||
    expectedKeys.some((key) => {
      const descriptor = descriptors[key];
      return !descriptor || descriptor.get !== undefined || descriptor.set !== undefined;
    })
  ) {
    return undefined;
  }

  const courses = descriptors.courses?.value;
  if (
    !Array.isArray(courses) ||
    Object.getPrototypeOf(courses) !== Array.prototype ||
    courses.length === 0 ||
    courses.length > 500
  ) {
    return undefined;
  }

  const header = Object.fromEntries(
    expectedKeys.map((key) => [
      key,
      key === "courses" ? [courses[0]] : descriptors[key]?.value,
    ]),
  );
  if (validateExact(TrustedCurriculumMetadataSchema, header).status === "rejected") {
    return undefined;
  }
  for (let index = 0; index < courses.length; index += 1) {
    if (
      !Object.hasOwn(courses, index) ||
      validateExact(CurriculumCourseMetadataSchema, courses[index]).status === "rejected"
    ) {
      return undefined;
    }
  }

  return metadataInput as TrustedCurriculumMetadata;
}

function structurallyConsistent(metadata: TrustedCurriculumMetadata): boolean {
  if (duplicates(metadata.courses.map((course) => course.courseRef))) return false;

  return metadata.courses.every((course) => {
    if (duplicates(course.unitRefs)) return false;
    if (duplicates(course.lessonBindings.map((binding) => binding.lessonRef))) return false;
    const units = new Set(course.unitRefs);
    return course.lessonBindings.every((binding) => units.has(binding.unitRef));
  });
}

/**
 * Compiles release metadata supplied by the accepted curriculum boundary.
 * Review/admission remain registry data checked by the admission gate. Subject
 * and course identifiers remain data; no subject vocabulary or grade sequence
 * is embedded in Tutor code.
 */
export function buildCurriculumCapabilityRegistry(
  metadataInput: unknown,
): CurriculumRegistryCompilation {
  let metadata: TrustedCurriculumMetadata | undefined;
  try {
    metadata = validateMetadataInBoundedSegments(metadataInput);
  } catch {
    metadata = undefined;
  }
  if (!metadata || !structurallyConsistent(metadata)) {
    return { status: "rejected", reason: "invalid-curriculum-metadata" };
  }
  const courses = new Map<string, CurriculumCourseMetadata>();
  const units = new Map<string, ReadonlySet<string>>();
  const lessons = new Map<string, ReadonlyMap<string, string>>();
  const workingLevels = new Set<string>();

  for (const sourceCourse of metadata.courses) {
    const course: CurriculumCourseMetadata = {
      ...sourceCourse,
      unitRefs: [...sourceCourse.unitRefs],
      lessonBindings: sourceCourse.lessonBindings.map((binding) => ({ ...binding })),
    };
    Object.freeze(course.unitRefs);
    for (const binding of course.lessonBindings) Object.freeze(binding);
    Object.freeze(course.lessonBindings);
    Object.freeze(course);
    courses.set(course.courseRef, course);
    units.set(course.courseRef, new Set(course.unitRefs));
    lessons.set(
      course.courseRef,
      new Map(course.lessonBindings.map((binding) => [binding.lessonRef, binding.unitRef])),
    );
    workingLevels.add(`${course.subjectRef}\u0000${course.grade}`);
  }

  const grades = [...new Set(metadata.courses.map((course) => course.grade))].sort(
    (left, right) => left - right,
  );
  const subjectRefs = [...new Set(metadata.courses.map((course) => course.subjectRef))].sort();
  const courseRefs = metadata.courses.map((course) => course.courseRef).sort();
  const coverage = Object.freeze({
    releaseRef: metadata.releaseRef,
    packageRef: metadata.packageRef,
    releaseVersion: metadata.releaseVersion,
    releaseDigest: metadata.releaseDigest,
    reviewState: metadata.reviewState,
    admissionState: metadata.admissionState,
    grades: Object.freeze(grades),
    subjectRefs: Object.freeze(subjectRefs),
    courseRefs: Object.freeze(courseRefs),
    counts: Object.freeze({
      courses: metadata.courses.length,
      units: metadata.courses.reduce((sum, course) => sum + course.unitRefs.length, 0),
      lessons: metadata.courses.reduce(
        (sum, course) => sum + course.lessonBindings.length,
        0,
      ),
    }),
  });

  const registry: CompiledCurriculumCapabilityRegistry = Object.freeze({
    coverage,
    getCourse: (courseRef: string) => courses.get(courseRef),
    hasWorkingLevel: (subjectRef: string, grade: number) =>
      workingLevels.has(`${subjectRef}\u0000${grade}`),
    hasUnit: (courseRef: string, unitRef: string) =>
      units.get(courseRef)?.has(unitRef) ?? false,
    lessonUnit: (courseRef: string, lessonRef: string) =>
      lessons.get(courseRef)?.get(lessonRef),
  });
  COMPILED_REGISTRIES.add(registry);

  return {
    status: "ready",
    registry,
  };
}

export const createCurriculumCapabilityRegistry = buildCurriculumCapabilityRegistry;
