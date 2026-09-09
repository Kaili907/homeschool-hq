import { validateExact } from "../../v2/contracts/validation.js";
import { CurriculumCourseMetadataSchema, TrustedCurriculumMetadataSchema, } from "./contracts.js";
const COMPILED_REGISTRIES = new WeakSet();
export function isCompiledCurriculumCapabilityRegistry(value) {
    return typeof value === "object" && value !== null && COMPILED_REGISTRIES.has(value);
}
function duplicates(values) {
    return new Set(values).size !== values.length;
}
function validateMetadataInBoundedSegments(metadataInput) {
    if (metadataInput === null ||
        typeof metadataInput !== "object" ||
        Array.isArray(metadataInput) ||
        Object.getPrototypeOf(metadataInput) !== Object.prototype) {
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
    if (Object.keys(descriptors).length !== expectedKeys.length ||
        expectedKeys.some((key) => {
            const descriptor = descriptors[key];
            return !descriptor || descriptor.get !== undefined || descriptor.set !== undefined;
        })) {
        return undefined;
    }
    const courses = descriptors.courses?.value;
    if (!Array.isArray(courses) ||
        Object.getPrototypeOf(courses) !== Array.prototype ||
        courses.length === 0 ||
        courses.length > 500) {
        return undefined;
    }
    const header = Object.fromEntries(expectedKeys.map((key) => [
        key,
        key === "courses" ? [courses[0]] : descriptors[key]?.value,
    ]));
    if (validateExact(TrustedCurriculumMetadataSchema, header).status === "rejected") {
        return undefined;
    }
    for (let index = 0; index < courses.length; index += 1) {
        if (!Object.hasOwn(courses, index) ||
            validateExact(CurriculumCourseMetadataSchema, courses[index]).status === "rejected") {
            return undefined;
        }
    }
    return metadataInput;
}
function structurallyConsistent(metadata) {
    if (duplicates(metadata.courses.map((course) => course.courseRef)))
        return false;
    return metadata.courses.every((course) => {
        if (duplicates(course.unitRefs))
            return false;
        if (duplicates(course.lessonBindings.map((binding) => binding.lessonRef)))
            return false;
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
export function buildCurriculumCapabilityRegistry(metadataInput) {
    let metadata;
    try {
        metadata = validateMetadataInBoundedSegments(metadataInput);
    }
    catch {
        metadata = undefined;
    }
    if (!metadata || !structurallyConsistent(metadata)) {
        return { status: "rejected", reason: "invalid-curriculum-metadata" };
    }
    const courses = new Map();
    const units = new Map();
    const lessons = new Map();
    const workingLevels = new Set();
    for (const sourceCourse of metadata.courses) {
        const course = {
            ...sourceCourse,
            unitRefs: [...sourceCourse.unitRefs],
            lessonBindings: sourceCourse.lessonBindings.map((binding) => ({ ...binding })),
        };
        Object.freeze(course.unitRefs);
        for (const binding of course.lessonBindings)
            Object.freeze(binding);
        Object.freeze(course.lessonBindings);
        Object.freeze(course);
        courses.set(course.courseRef, course);
        units.set(course.courseRef, new Set(course.unitRefs));
        lessons.set(course.courseRef, new Map(course.lessonBindings.map((binding) => [binding.lessonRef, binding.unitRef])));
        workingLevels.add(`${course.subjectRef}\u0000${course.grade}`);
    }
    const grades = [...new Set(metadata.courses.map((course) => course.grade))].sort((left, right) => left - right);
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
            lessons: metadata.courses.reduce((sum, course) => sum + course.lessonBindings.length, 0),
        }),
    });
    const registry = Object.freeze({
        coverage,
        getCourse: (courseRef) => courses.get(courseRef),
        hasWorkingLevel: (subjectRef, grade) => workingLevels.has(`${subjectRef}\u0000${grade}`),
        hasUnit: (courseRef, unitRef) => units.get(courseRef)?.has(unitRef) ?? false,
        lessonUnit: (courseRef, lessonRef) => lessons.get(courseRef)?.get(lessonRef),
    });
    COMPILED_REGISTRIES.add(registry);
    return {
        status: "ready",
        registry,
    };
}
export const createCurriculumCapabilityRegistry = buildCurriculumCapabilityRegistry;
