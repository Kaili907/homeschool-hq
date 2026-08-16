import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  CURRICULUM_ADMISSION_VERSION,
  CURRICULUM_METADATA_VERSION,
  buildCurriculumCapabilityRegistry,
  evaluateCurriculumAdmission,
  evaluateCurriculumAdmissionWithRegistry,
  type CurriculumAdmissionInput,
  type TutorCapabilityDeclaration,
  type TrustedCurriculumMetadata,
} from "./index.js";

type CompleteAdmissionInput = Omit<
  CurriculumAdmissionInput,
  "capabilityDeclaration"
> & {
  capabilityDeclaration: TutorCapabilityDeclaration;
};

function metadata(): TrustedCurriculumMetadata {
  return {
    metadataVersion: CURRICULUM_METADATA_VERSION,
    metadataKind: "accepted-curriculum-metadata",
    source: "accepted-curriculum-release",
    releaseRef: "family-pilot-r1",
    packageRef: "curriculum-package:family-pilot-r1",
    releaseVersion: "2.0.0",
    releaseDigest: `sha256:${"a".repeat(64)}`,
    reviewState: "reviewed",
    admissionState: "admitted",
    courses: [
      {
        courseRef: "ma-g3-tech-cs",
        subjectRef: "technology",
        grade: 3,
        unitRefs: ["ma-g3-tech-cs-u01", "ma-g3-tech-cs-u02"],
        lessonBindings: [
          { lessonRef: "ma-g3-tech-cs-u01-l01", unitRef: "ma-g3-tech-cs-u01" },
          { lessonRef: "ma-g3-tech-cs-u02-l01", unitRef: "ma-g3-tech-cs-u02" },
        ],
      },
      {
        courseRef: "ma-g5-mathematics",
        subjectRef: "mathematics",
        grade: 5,
        unitRefs: ["ma-g5-mathematics-u01"],
        lessonBindings: [
          {
            lessonRef: "ma-g5-mathematics-u01-l01",
            unitRef: "ma-g5-mathematics-u01",
          },
        ],
      },
      {
        courseRef: "ma-g5-technology",
        subjectRef: "technology",
        grade: 5,
        unitRefs: ["ma-g5-technology-u01"],
        lessonBindings: [
          {
            lessonRef: "ma-g5-technology-u01-l01",
            unitRef: "ma-g5-technology-u01",
          },
        ],
      },
      {
        courseRef: "academy-g7-orbital-design",
        subjectRef: "orbital-design",
        grade: 7,
        unitRefs: ["orbital-design-u01"],
        lessonBindings: [
          { lessonRef: "orbital-design-u01-l01", unitRef: "orbital-design-u01" },
        ],
      },
    ],
  };
}

function validInput(): CompleteAdmissionInput {
  return {
    inputKind: "curriculum-tutor-admission",
    request: {
      requestVersion: CURRICULUM_ADMISSION_VERSION,
      requestKind: "curriculum-tutor-admission-request",
      capabilityRef: "guided-instruction",
      courseRef: "ma-g3-tech-cs",
      subjectRef: "technology",
      unitRef: "ma-g3-tech-cs-u01",
      lessonRef: "ma-g3-tech-cs-u01-l01",
      nominalGrade: 8,
      officialWorkingLevel: 3,
      assessmentPhase: "instruction-or-practice",
      actionFamily: "guided-support",
    },
    studyAuthorityScope: {
      scopeKind: "study-curriculum-tutor-authority",
      authorityRef: "authority:curriculum-wave3",
      learnerScopeRef: "learner-scope:learner-a",
      sessionRef: "session:wave3-001",
      curriculumReleaseRef: "family-pilot-r1",
      courseRef: "ma-g3-tech-cs",
      subjectRef: "technology",
      unitRef: "ma-g3-tech-cs-u01",
      lessonRef: "ma-g3-tech-cs-u01-l01",
      nominalGrade: 8,
      officialWorkingLevel: 3,
      allowedActionFamilies: ["guided-support", "reviewed-static"],
      curriculumAssignmentAllowed: false,
      officialWorkingLevelMutationAllowed: false,
    },
    capabilityDeclaration: {
      declarationKind: "reviewed-tutor-capability",
      declarationRef: "capability-review:guided-instruction-v1",
      capabilityRef: "guided-instruction",
      reviewState: "reviewed",
      admissionState: "admitted",
      deliveryMode: "free-form-instruction",
      supportedCourseRefs: [],
      supportedSubjectRefs: ["technology"],
      allowedAssessmentPhases: [
        "instruction-or-practice",
        "completed-assessment-review",
        "non-graded-review",
      ],
      allowedActionFamilies: ["guided-support"],
      unsupportedOutcome: "static-only",
    },
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function record(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function assertDecision(
  input: unknown,
  status: "admitted" | "refused" | "static-only",
  reason: string,
): void {
  const decision = evaluateCurriculumAdmission(metadata(), input);
  assert.equal(decision.status, status);
  assert.equal(decision.reason, reason);
}

test("admits a reviewed capability using official working level, not nominal grade", () => {
  const decision = evaluateCurriculumAdmission(metadata(), validInput());
  assert.deepEqual(decision, {
    scope: "curriculum-tutor-admission-only",
    curriculumAssignmentAllowed: false,
    curriculumMutationAllowed: false,
    nominalGradeMutationAllowed: false,
    officialWorkingLevelMutationAllowed: false,
    studyAuthorityMutationAllowed: false,
    releaseRef: "family-pilot-r1",
    courseRef: "ma-g3-tech-cs",
    subjectRef: "technology",
    unitRef: "ma-g3-tech-cs-u01",
    lessonRef: "ma-g3-tech-cs-u01-l01",
    nominalGrade: 8,
    officialWorkingLevel: 3,
    capabilityRef: "guided-instruction",
    actionFamily: "guided-support",
    status: "admitted",
    reason: "curriculum-capability-admitted",
    tutorInvocationAllowed: true,
    freeFormInstructionAllowed: true,
    staticCurriculumAllowed: true,
  });
});

test("uses arbitrary curriculum metadata identifiers without a subject enum", () => {
  const input = validInput();
  input.request.courseRef = "academy-g7-orbital-design";
  input.request.subjectRef = "orbital-design";
  input.request.unitRef = "orbital-design-u01";
  input.request.lessonRef = "orbital-design-u01-l01";
  input.request.officialWorkingLevel = 7;
  input.studyAuthorityScope.courseRef = input.request.courseRef;
  input.studyAuthorityScope.subjectRef = input.request.subjectRef;
  input.studyAuthorityScope.unitRef = input.request.unitRef;
  input.studyAuthorityScope.lessonRef = input.request.lessonRef;
  input.studyAuthorityScope.officialWorkingLevel = 7;
  input.capabilityDeclaration.supportedSubjectRefs = ["orbital-design"];
  assertDecision(input, "admitted", "curriculum-capability-admitted");
});

test("refuses unknown courses before Tutor capability evaluation", () => {
  const input = validInput();
  input.request.courseRef = "ma-g6-mathematics";
  input.request.subjectRef = "mathematics";
  input.request.unitRef = null;
  input.request.lessonRef = null;
  input.request.officialWorkingLevel = 6;
  input.studyAuthorityScope.courseRef = input.request.courseRef;
  input.studyAuthorityScope.subjectRef = input.request.subjectRef;
  input.studyAuthorityScope.unitRef = null;
  input.studyAuthorityScope.lessonRef = null;
  input.studyAuthorityScope.officialWorkingLevel = 6;
  record(input).capabilityDeclaration = null;
  assertDecision(input, "refused", "unknown-course");
});

test("does not invent an unavailable Grade 6 working level", () => {
  const input = validInput();
  input.request.courseRef = "ma-g5-mathematics";
  input.request.subjectRef = "mathematics";
  input.request.unitRef = null;
  input.request.lessonRef = null;
  input.request.officialWorkingLevel = 6;
  input.studyAuthorityScope.courseRef = input.request.courseRef;
  input.studyAuthorityScope.subjectRef = input.request.subjectRef;
  input.studyAuthorityScope.unitRef = null;
  input.studyAuthorityScope.lessonRef = null;
  input.studyAuthorityScope.officialWorkingLevel = 6;
  assertDecision(input, "refused", "official-working-level-unavailable");
});

test("refuses a course whose subject does not match canonical metadata", () => {
  const input = validInput();
  input.request.subjectRef = "mathematics";
  input.studyAuthorityScope.subjectRef = "mathematics";
  assertDecision(input, "refused", "course-subject-mismatch");
});

test("refuses an existing course at a different official working level", () => {
  const input = validInput();
  input.request.officialWorkingLevel = 5;
  input.studyAuthorityScope.officialWorkingLevel = 5;
  assertDecision(input, "refused", "course-working-level-mismatch");
});

test("requires exact unit and lesson membership", () => {
  const missingUnit = validInput();
  missingUnit.request.unitRef = "ma-g3-tech-cs-u99";
  missingUnit.request.lessonRef = null;
  missingUnit.studyAuthorityScope.unitRef = missingUnit.request.unitRef;
  missingUnit.studyAuthorityScope.lessonRef = null;
  assertDecision(missingUnit, "refused", "unknown-unit");

  const missingLesson = validInput();
  missingLesson.request.lessonRef = "ma-g3-tech-cs-u01-l99";
  missingLesson.studyAuthorityScope.lessonRef = missingLesson.request.lessonRef;
  assertDecision(missingLesson, "refused", "unknown-lesson");

  const wrongUnit = validInput();
  wrongUnit.request.unitRef = "ma-g3-tech-cs-u02";
  wrongUnit.studyAuthorityScope.unitRef = wrongUnit.request.unitRef;
  assertDecision(wrongUnit, "refused", "lesson-unit-mismatch");

  const noUnit = validInput();
  noUnit.request.unitRef = null;
  noUnit.studyAuthorityScope.unitRef = null;
  assertDecision(noUnit, "refused", "lesson-requires-unit");
});

test("fails closed without a reviewed capability declaration", () => {
  const nullDeclaration = validInput();
  record(nullDeclaration).capabilityDeclaration = null;
  assertDecision(
    nullDeclaration,
    "refused",
    "missing-reviewed-capability-declaration",
  );

  const missingDeclaration = validInput();
  delete record(missingDeclaration).capabilityDeclaration;
  assertDecision(
    missingDeclaration,
    "refused",
    "missing-reviewed-capability-declaration",
  );

  const pending = validInput();
  pending.capabilityDeclaration.reviewState = "not-reviewed";
  assertDecision(pending, "refused", "capability-declaration-not-reviewed");
});

test("routes unsupported reviewed capabilities according to their declaration", () => {
  const staticFallback = validInput();
  staticFallback.capabilityDeclaration.supportedSubjectRefs = ["mathematics"];
  assertDecision(
    staticFallback,
    "static-only",
    "unsupported-tutor-capability-static-only",
  );

  const refusal = validInput();
  refusal.capabilityDeclaration.supportedSubjectRefs = ["mathematics"];
  refusal.capabilityDeclaration.unsupportedOutcome = "refuse";
  assertDecision(refusal, "refused", "unsupported-tutor-capability");
});

test("allows no free-form instructional Tutor during active assessment", () => {
  const input = validInput();
  input.request.assessmentPhase = "active-graded-or-mastery-check";
  input.capabilityDeclaration.allowedAssessmentPhases.push(
    "active-graded-or-mastery-check",
  );
  assertDecision(input, "static-only", "active-assessment-static-only");
  const decision = evaluateCurriculumAdmission(metadata(), input);
  assert.equal(decision.freeFormInstructionAllowed, false);
  assert.equal(decision.tutorInvocationAllowed, false);
});

test("honors a reviewed static-only capability declaration", () => {
  const input = validInput();
  input.capabilityDeclaration.admissionState = "static-only";
  input.capabilityDeclaration.deliveryMode = "reviewed-static";
  assertDecision(input, "static-only", "capability-static-only");
});

test("refuses a capability or curriculum release explicitly not admitted", () => {
  const capability = validInput();
  capability.capabilityDeclaration.admissionState = "refused";
  assertDecision(capability, "refused", "tutor-capability-refused");

  const curriculum = metadata();
  curriculum.admissionState = "not-admitted";
  assert.equal(
    evaluateCurriculumAdmission(curriculum, validInput()).reason,
    "curriculum-release-not-admitted",
  );
});

test("refuses an action family outside Study authority even if Tutor declares it", () => {
  const input = validInput();
  input.request.actionFamily = "unrestricted-instruction";
  input.capabilityDeclaration.allowedActionFamilies = ["unrestricted-instruction"];
  assertDecision(input, "refused", "action-family-not-authorized");
});

test("refuses cross-scope reuse and authority-bearing request fields", () => {
  const crossScope = validInput();
  crossScope.request.lessonRef = "ma-g3-tech-cs-u02-l01";
  assertDecision(crossScope, "refused", "study-authority-scope-mismatch");

  for (const [field, value] of Object.entries({
    assignCurriculum: "ma-g5-mathematics",
    alterOfficialWorkingLevel: 12,
    curriculumAssignmentAllowed: true,
  })) {
    const input = validInput();
    record(input.request)[field] = value;
    const decision = evaluateCurriculumAdmission(metadata(), input);
    assert.equal(decision.status, "refused");
    assert.equal(decision.curriculumAssignmentAllowed, false);
    assert.equal(decision.officialWorkingLevelMutationAllowed, false);
  }
});

test("rejects ambiguous or malformed curriculum and capability metadata", () => {
  const duplicateCourse = metadata();
  duplicateCourse.courses.push(clone(duplicateCourse.courses[0]!));
  assert.equal(buildCurriculumCapabilityRegistry(duplicateCourse).status, "rejected");
  assertDecision(validInput(), "admitted", "curriculum-capability-admitted");
  assert.equal(
    evaluateCurriculumAdmission(duplicateCourse, validInput()).reason,
    "invalid-curriculum-metadata",
  );

  const duplicateCapabilityScope = validInput();
  duplicateCapabilityScope.capabilityDeclaration.supportedSubjectRefs = [
    "technology",
    "technology",
  ];
  assertDecision(
    duplicateCapabilityScope,
    "refused",
    "invalid-capability-declaration",
  );

  const forgedRegistry = {
    coverage: {
      releaseRef: "family-pilot-r1",
      packageRef: "curriculum-package:family-pilot-r1",
      releaseVersion: "2.0.0",
      releaseDigest: `sha256:${"a".repeat(64)}`,
      reviewState: "reviewed" as const,
      admissionState: "admitted" as const,
      grades: [3],
      subjectRefs: ["technology"],
      courseRefs: ["ma-g3-tech-cs"],
      counts: { courses: 1, units: 1, lessons: 1 },
    },
    getCourse: () => metadata().courses[0],
    hasWorkingLevel: () => true,
    hasUnit: () => true,
    lessonUnit: () => "ma-g3-tech-cs-u01",
  };
  assert.equal(
    evaluateCurriculumAdmissionWithRegistry(forgedRegistry, validInput()).reason,
    "invalid-curriculum-metadata",
  );
});

test("does not mutate curriculum, authority, or capability inputs", () => {
  const curriculum = metadata();
  const input = validInput();
  const beforeCurriculum = clone(curriculum);
  const beforeInput = clone(input);
  evaluateCurriculumAdmission(curriculum, input);
  assert.deepEqual(curriculum, beforeCurriculum);
  assert.deepEqual(input, beforeInput);
});

interface RuntimeManifest {
  releaseVersion: string;
  courses: Array<{
    courseRef: string;
    grade: number;
    subject: string;
  }>;
}

interface RuntimeLessonRow {
  lessonRef: string;
  unitRef: string;
}

test("coverage matches the current admitted canonical curriculum metadata", () => {
  const releaseRoot = resolve(
    process.cwd(),
    "../curriculum-release-admitted/family-pilot-r1",
  );
  const manifest = JSON.parse(
    readFileSync(resolve(releaseRoot, "runtime/runtime-manifest.json"), "utf8"),
  ) as RuntimeManifest;
  const rowsByCourse = JSON.parse(
    readFileSync(resolve(releaseRoot, "runtime/lesson-rows-by-course.json"), "utf8"),
  ) as Record<string, RuntimeLessonRow[]>;
  const canonicalMetadata: TrustedCurriculumMetadata = {
    metadataVersion: CURRICULUM_METADATA_VERSION,
    metadataKind: "accepted-curriculum-metadata",
    source: "accepted-curriculum-release",
    releaseRef: "family-pilot-r1",
    packageRef: "curriculum-package:family-pilot-r1",
    releaseVersion: manifest.releaseVersion,
    releaseDigest: `sha256:${"a".repeat(64)}`,
    reviewState: "reviewed",
    admissionState: "admitted",
    courses: manifest.courses.map((course) => {
      const rows = rowsByCourse[course.courseRef] ?? [];
      return {
        courseRef: course.courseRef,
        subjectRef: course.subject,
        grade: course.grade,
        unitRefs: [...new Set(rows.map((row) => row.unitRef))],
        lessonBindings: rows.map((row) => ({
          lessonRef: row.lessonRef,
          unitRef: row.unitRef,
        })),
      };
    }),
  };
  const result = buildCurriculumCapabilityRegistry(canonicalMetadata);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.deepEqual(result.registry.coverage.counts, {
    courses: 90,
    units: 698,
    lessons: 8292,
  });
  assert.deepEqual(result.registry.coverage.grades, [3, 4, 5, 7, 8, 9, 10, 11, 12]);
  assert.equal(result.registry.coverage.grades.includes(6), false);
  assert.deepEqual(result.registry.coverage.subjectRefs, [
    "arts-and-music",
    "english-language-arts",
    "financial-literacy",
    "health",
    "mathematics",
    "physical-education",
    "ready-for-life",
    "science",
    "social-studies",
    "technology",
  ]);
  assert.ok(result.registry.getCourse("ma-g3-tech-cs"));
  assert.ok(result.registry.getCourse("ma-g12-technology"));
  assert.equal(result.registry.getCourse("ma-g6-mathematics"), undefined);
  assert.equal(
    result.registry.lessonUnit("ma-g9-science", "ma-hs9-biology-u01-l01"),
    "ma-hs9-biology-u01",
  );
});
