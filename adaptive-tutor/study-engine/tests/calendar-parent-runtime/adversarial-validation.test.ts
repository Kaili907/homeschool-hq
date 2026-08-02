import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { STUDY_TASK_TYPES } from "../../contracts/study-plan";
import { inspectContractVersion } from "../../contracts/versioning";
import { scheduleNextReview } from "../../engine/review/index";
import {
  CalendarRuntimeError,
  assertHouseholdTimeZone,
  createCalendarBlock,
  learnerLocalDate,
  mergeCalendarBlocks,
  resolveLearnerLocalStart,
  type CalendarBlock,
} from "../../integration-labs/calendar-parent-runtime/calendar-runtime.js";
import { deterministicScenarioTrace } from "../../integration-labs/calendar-parent-runtime/demo-scenarios.js";
import {
  applyParentControlAction,
  buildMobileParentViewModel,
  createParentRuntimeState,
} from "../../integration-labs/calendar-parent-runtime/parent-runtime.js";
import {
  PrivacyBoundaryError,
  auditParentRecommendationProjection,
  auditPrivateNoteIsolation,
  auditStudentPrivateNoteProjection,
  createAdultPrivateRecord,
  projectAuthorizedAdultPrivateOperationalEvents,
  projectAuthorizedAdultPrivateNotes,
  projectParentRecommendation,
  projectStudentPrivateNotes,
  writeAdultPrivateNote,
  type AdultPrivateAuthorization,
  type ParentSafeRecommendation,
} from "../../integration-labs/calendar-parent-runtime/privacy.js";
import {
  REVIEW_RUNTIME_SCHEMA_VERSION,
  ReviewRuntimeError,
  buildDailyReviewPlan,
  ingestEngineRecommendation,
  type EngineRecommendationEnvelope,
  type ReviewQueueEntry,
} from "../../integration-labs/calendar-parent-runtime/review-runtime.js";
import {
  ROMEO_ASSIGNMENT_SCHEMA_VERSION,
  ROMEO_RUNTIME_BOUNDARY,
  RomeoRuntimeError,
  assertRomeoCredentialFree,
  normalizeRomeoAssignment,
  projectRomeoAssignmentForPublic,
  updateRomeoAssignment,
  type RomeoAssignmentInput,
} from "../../integration-labs/calendar-parent-runtime/romeo-runtime.js";

const RUNTIME_DIRECTORY = fileURLToPath(
  new URL(
    "../../integration-labs/calendar-parent-runtime/",
    import.meta.url,
  ),
);

const PARENT = {
  role: "parent",
  actorId: "adult:privacy-auditor",
} as const;

function engineEnvelope(
  overrides: Partial<EngineRecommendationEnvelope> = {},
): EngineRecommendationEnvelope {
  return {
    queueEntryId: "queue:adversarial-001",
    sourceRecommendationId: "recommendation:adversarial-001",
    reviewId: "review:adversarial-001" as EngineRecommendationEnvelope["reviewId"],
    studentId:
      "student:opaque-adversarial" as EngineRecommendationEnvelope["studentId"],
    subjectId:
      "subject:mathematics" as EngineRecommendationEnvelope["subjectId"],
    skillId:
      "skill:fraction-equivalence" as EngineRecommendationEnvelope["skillId"],
    title: "Fraction equivalence retrieval",
    timeZone: "America/New_York",
    generatedAt: "2026-07-28T13:00:00.000Z",
    recommendation: scheduleNextReview({
      reviewedOn: "2026-07-28",
      state: { lastBaselineIndex: -1 },
    }),
    authorizedPriority: "high",
    estimatedMinutes: 8,
    basisEvidenceIds: [],
    sameDayPolicy: {
      cooldownMinutes: 30,
      latestLocalTime: "20:00",
    },
    ...overrides,
  };
}

function calendarBlock(
  internalBlockId: string,
  externalItemId: string,
): CalendarBlock {
  return createCalendarBlock({
    internalBlockId,
    learnerRef: "learner:opaque-adversarial",
    sourceIdentity: {
      source: "manuel_academy",
      externalItemId,
    },
    title: "Required math instruction",
    subject: "Mathematics",
    blockType: "guided_practice",
    householdTimeZone: "America/New_York",
    scheduledLocalStart: "2026-07-28T09:00",
    segments: [
      {
        segmentId: "segment:guided-001",
        title: "Guided practice",
        estimatedMinutes: 12,
        required: true,
      },
    ],
    createdAt: "2026-07-27T16:00:00.000Z",
  });
}

function romeoInput(): RomeoAssignmentInput {
  return {
    schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
    externalAssignmentId: "romeo:assignment-opaque-001",
    hostLaunchRef: "host-launch:romeo:assignment-opaque-001",
    title: "Romeo algebra practice",
    course: "Algebra I",
    dueDate: "2026-07-31",
    estimatedDurationMinutes: 24,
    completionState: "in_progress",
    parentEnteredProgress: {
      completedUnits: 2,
      totalUnits: 5,
      updatedAt: "2026-07-28T09:00:00-04:00",
    },
    studentEnteredProgress: {
      completedUnits: 3,
      totalUnits: 5,
      updatedAt: "2026-07-28T09:05:00-04:00",
    },
    linkedManuelAcademyTutoring: {
      targetType: "skill",
      targetId: "skill:linear-equations",
      title: "Linear-equation tutoring",
      supportStudyPlanId: {
        id: "study-plan:linear-equations" as NonNullable<
          RomeoAssignmentInput["linkedManuelAcademyTutoring"]
        >["supportStudyPlanId"]["id"],
        revision: 1,
      },
    },
    resumeNote: "Resume at problem four.",
    externalUrlReference:
      "https://academy.example.invalid/assignments/opaque-001",
    lastCheckedAt: "2026-07-28T09:10:00-04:00",
    sourceMode: "manual",
  };
}

function expectRomeoCredentialRejection(run: () => unknown): void {
  try {
    run();
    throw new Error("Expected credential material to be rejected.");
  } catch (error) {
    expect(error).toBeInstanceOf(RomeoRuntimeError);
    expect(error).toMatchObject({ code: "credential_material" });
  }
}

describe("canonical boundary conformance", () => {
  it("emits a current Session 1 review contract and only canonical study task types", () => {
    const adapted = ingestEngineRecommendation({
      envelope: engineEnvelope(),
      queueEntries: [],
    });

    expect(inspectContractVersion(adapted.canonicalReview)).toEqual({
      status: "current",
      schemaVersion: 1,
    });
    expect(adapted.canonicalReview).toMatchObject({
      kind: "student-skill-review",
      schemaVersion: 1,
      id: "review:adversarial-001",
      studentId: "student:opaque-adversarial",
      subjectId: "subject:mathematics",
      skillId: "skill:fraction-equivalence",
      timeZone: "America/New_York",
    });
    expect(adapted.queueEntry).toMatchObject({
      schemaVersion: REVIEW_RUNTIME_SCHEMA_VERSION,
      id: "queue:adversarial-001",
      sourceRecommendationId: "recommendation:adversarial-001",
      canonicalReviewId: adapted.canonicalReview.id,
      canonicalReviewRevision: adapted.canonicalReview.revision,
    });

    const block = calendarBlock("block:canonical-001", "lesson:canonical-001");
    expect(STUDY_TASK_TYPES).toContain(block.canonicalTask.taskType);
    for (const segment of block.segments) {
      expect(STUDY_TASK_TYPES).toContain(segment.canonicalTaskType);
    }
  });
});

describe("public recommendation privacy boundary", () => {
  it("omits hostile fields and neutralizes PII, raw-answer, transcript, diagnosis, and hidden-score text", () => {
    const rawAnswer = "The raw response was 4/9.";
    const transcript = "Verbatim transcript: learner disclosed a secret.";
    const diagnosis = "diagnosed with ADHD";
    const hiddenScore = "internal behavioral score 0.17";
    const email = "learner.private@example.com";

    const projected = projectParentRecommendation({
      recommendationId: "recommendation:privacy-001",
      createdAt: "2026-07-28T09:00:00-04:00",
      direction: "maintain",
      summary: `Student email: ${email}; ${diagnosis}; ${rawAnswer}`,
      rawAnswers: [rawAnswer],
      transcript,
      diagnosisText: diagnosis,
      hiddenBehaviorScore: 0.17,
      engineDebug: { hiddenScore },
      credentials: { username: "not-allowed", password: "not-allowed" },
      evidence: [
        {
          evidenceId: "evidence:privacy-001",
          description: transcript,
          observedAt: "2026-07-28T08:55:00-04:00",
          source: "review-result",
          studentEmail: email,
          rawResponse: rawAnswer,
          hiddenBehaviorScore: hiddenScore,
        },
      ],
    });

    const publicJson = JSON.stringify(projected.recommendation);
    for (const prohibited of [
      rawAnswer,
      transcript,
      diagnosis,
      hiddenScore,
      email,
      "not-allowed",
    ]) {
      expect(publicJson).not.toContain(prohibited);
    }
    expect(projected.privacyReport.excludedSensitivePaths).toEqual(
      expect.arrayContaining([
        "recommendation.credentials",
        "recommendation.diagnosisText",
        "recommendation.evidence[0].hiddenBehaviorScore",
        "recommendation.evidence[0].rawResponse",
        "recommendation.evidence[0].studentEmail",
        "recommendation.hiddenBehaviorScore",
        "recommendation.rawAnswers",
        "recommendation.transcript",
      ]),
    );
    expect(projected.privacyReport.ignoredNonContractPaths).toContain(
      "recommendation.engineDebug",
    );
    expect(projected.privacyReport.neutralizedTextPaths).toEqual([
      "recommendation.evidence[0].description",
      "recommendation.summary",
    ]);
    expect(auditParentRecommendationProjection(projected.recommendation)).toEqual(
      [],
    );
  });

  it("detects prohibited text if a caller bypasses the allow-list projector", () => {
    const tainted = {
      schemaVersion: "calendar-parent-runtime.parent-recommendation.v1",
      recommendationId: "recommendation:tainted-001",
      createdAt: "2026-07-28T09:00:00-04:00",
      direction: "increase",
      summary: "The learner was diagnosed with ADHD.",
      evidence: [],
    } as ParentSafeRecommendation;

    expect(auditParentRecommendationProjection(tainted)).toEqual([
      expect.objectContaining({
        code: "prohibited-text",
        path: "recommendation.summary",
      }),
    ]);
  });

  it("classifies separator variants and neutralizes response, transcript, diagnosis, and private-score aliases", () => {
    const projected = projectParentRecommendation({
      recommendationId: "recommendation:privacy-aliases",
      createdAt: "2026-07-28T09:10:00-04:00",
      direction: "maintain",
      summary: "Learner response: I selected option C.",
      "student_response": "I selected option C.",
      "answer-text": "Option C",
      guardian_email: "adult.private@example.com",
      home_address: "100 Private Lane",
      learner_birth_date: "2014-05-06",
      diagnostic_label: "dyslexia",
      private_engagement_index: 0.14,
      evidence: [
        {
          evidenceId: "evidence:privacy-aliases",
          description: "Transcript excerpt: the learner selected option C.",
          observedAt: "2026-07-28T09:05:00-04:00",
          source: "review-result",
        },
      ],
    });

    expect(projected.privacyReport.excludedSensitivePaths).toEqual([
      "recommendation.answer-text",
      "recommendation.diagnostic_label",
      "recommendation.guardian_email",
      "recommendation.home_address",
      "recommendation.learner_birth_date",
      "recommendation.private_engagement_index",
      "recommendation.student_response",
    ]);
    expect(projected.privacyReport.neutralizedTextPaths).toEqual([
      "recommendation.evidence[0].description",
      "recommendation.summary",
    ]);
    expect(projected.recommendation.summary).not.toContain("option C");
    expect(
      projected.recommendation.evidence[0]?.description,
    ).not.toContain("learner selected");
    expect(auditParentRecommendationProjection(projected.recommendation)).toEqual(
      [],
    );

    const bypassed = {
      ...projected.recommendation,
      student_response: "Option C",
    } as ParentSafeRecommendation;
    expect(auditParentRecommendationProjection(bypassed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "prohibited-field",
          path: "recommendation.student_response",
        }),
      ]),
    );

    const functional = projectParentRecommendation({
      recommendationId: "recommendation:functional-language",
      createdAt: "2026-07-28T09:15:00-04:00",
      direction: "maintain",
      summary: "Use a written response and a quiet workspace.",
      evidence: [],
    });
    expect(functional.recommendation.summary).toBe(
      "Use a written response and a quiet workspace.",
    );
    expect(functional.privacyReport.neutralizedTextPaths).toEqual([]);
  });
});

describe("adult-private projection authorization and isolation", () => {
  it("preserves parent-only audience without revealing it to teachers or tutors", () => {
    const empty = createAdultPrivateRecord({
      recordId: "private:adversarial-001",
      studentRef: "student:opaque-adversarial",
      at: "2026-07-28T09:00:00-04:00",
    });
    const authorized: AdultPrivateAuthorization = {
      actor: PARENT,
      studentRef: empty.studentRef,
      canReadPrivateNotes: true,
      canWritePrivateNotes: true,
    };
    const teacherAuthorization: AdultPrivateAuthorization = {
      actor: { role: "teacher", actorId: "adult:teacher-auditor" },
      studentRef: empty.studentRef,
      canReadPrivateNotes: true,
      canWritePrivateNotes: true,
    };
    const tutorAuthorization: AdultPrivateAuthorization = {
      actor: { role: "tutor", actorId: "adult:tutor-auditor" },
      studentRef: empty.studentRef,
      canReadPrivateNotes: true,
      canWritePrivateNotes: false,
    };
    const sharedBody =
      "Authorized adults may coordinate this instructional follow-up.";
    const withSharedNote = writeAdultPrivateNote(
      empty,
      {
        recordId: empty.recordId,
        studentRef: empty.studentRef,
        noteId: "private-note:shared-001",
        author: PARENT,
        category: "review",
        body: sharedBody,
        at: "2026-07-28T09:04:00-04:00",
        audience: "authorized-adults-only",
      },
      authorized,
    );
    const teacherBeforeParentOnly =
      projectAuthorizedAdultPrivateNotes(
        withSharedNote,
        teacherAuthorization,
      );
    const parentOnlyBody =
      "Parent-only context:\ndo not disclose this note to a teacher or tutor.";
    const written = writeAdultPrivateNote(
      withSharedNote,
      {
        recordId: empty.recordId,
        studentRef: empty.studentRef,
        noteId: "private-note:parent-only-001",
        author: PARENT,
        category: "schedule",
        body: parentOnlyBody,
        at: "2026-07-28T09:05:00-04:00",
        // A parent-authored action intentionally omits audience here.
      },
      authorized,
    );

    expect(written.notes.map(({ audience }) => audience)).toEqual([
      "authorized-adults-only",
      "parent-only",
    ]);
    expect(
      projectAuthorizedAdultPrivateNotes(written, authorized).notes.map(
        ({ body }) => body,
      ),
    ).toEqual([sharedBody, parentOnlyBody]);

    const teacherAfterParentOnly =
      projectAuthorizedAdultPrivateNotes(written, teacherAuthorization);
    const tutorProjection =
      projectAuthorizedAdultPrivateNotes(written, tutorAuthorization);
    expect(teacherAfterParentOnly).toEqual(teacherBeforeParentOnly);
    expect(teacherAfterParentOnly.notes.map(({ body }) => body)).toEqual([
      sharedBody,
    ]);
    expect(tutorProjection.notes.map(({ body }) => body)).toEqual([
      sharedBody,
    ]);
    expect(JSON.stringify({ teacherAfterParentOnly, tutorProjection })).not
      .toContain(parentOnlyBody);
    expect(JSON.stringify({ teacherAfterParentOnly, tutorProjection })).not
      .toContain("private-note:parent-only-001");

    const parentEvents =
      projectAuthorizedAdultPrivateOperationalEvents(written, authorized);
    const teacherEvents =
      projectAuthorizedAdultPrivateOperationalEvents(
        written,
        teacherAuthorization,
      );
    expect(parentEvents).toHaveLength(2);
    expect(teacherEvents).toEqual([
      {
        noteRef: "private-note:shared-001",
        category: "review",
        authorRef: PARENT.actorId,
        createdAt: "2026-07-28T09:04:00-04:00",
      },
    ]);
    expect(Object.keys(parentEvents[0] ?? {}).sort()).toEqual([
      "authorRef",
      "category",
      "createdAt",
      "noteRef",
    ]);
    expect(auditPrivateNoteIsolation(parentEvents, written)).toEqual([]);

    expect(() =>
      projectAuthorizedAdultPrivateNotes(written, {
        ...authorized,
        canReadPrivateNotes: false,
      }),
    ).toThrowError(PrivacyBoundaryError);
    expect(() =>
      projectAuthorizedAdultPrivateNotes(written, {
        ...authorized,
        studentRef: "student:different",
      }),
    ).toThrowError(PrivacyBoundaryError);
    expect(() =>
      writeAdultPrivateNote(
        written,
        {
          recordId: written.recordId,
          studentRef: written.studentRef,
          noteId: "private-note:wrong-author",
          author: { role: "teacher", actorId: "adult:not-authorized" },
          category: "other",
          body: "This write must not be accepted.",
          at: "2026-07-28T09:06:00-04:00",
        },
        authorized,
      ),
    ).toThrowError(PrivacyBoundaryError);
    expect(() =>
      writeAdultPrivateNote(
        written,
        {
          recordId: written.recordId,
          studentRef: written.studentRef,
          noteId: "private-note:teacher-parent-only",
          author: teacherAuthorization.actor,
          category: "other",
          body: "A teacher must not create a parent-only note.",
          at: "2026-07-28T09:07:00-04:00",
          audience: "parent-only",
        },
        teacherAuthorization,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "unauthorized-private-write" }),
    );

    const publicProjection = {
      recommendationId: "recommendation:public-only",
      summary: "Continue the current study setting.",
    };
    expect(auditPrivateNoteIsolation(publicProjection, written)).toEqual([]);
    expect(
      auditPrivateNoteIsolation(
        { ...publicProjection, parentOnlyBody },
        written,
      ),
    ).toEqual([
      expect.objectContaining({ code: "private-note-exposed" }),
    ]);

    const parentOnlyExcerpt = parentOnlyBody.slice(0, 36);
    expect(
      auditPrivateNoteIsolation({ parentOnlyExcerpt }, written),
    ).toEqual([
      expect.objectContaining({
        code: "private-note-exposed",
        path: "publicValue.parentOnlyExcerpt",
      }),
    ]);
    const cyclicPublicValue: {
      summary: string;
      self?: unknown;
    } = {
      summary: "Continue the current study setting.",
    };
    cyclicPublicValue.self = cyclicPublicValue;
    expect(() =>
      auditPrivateNoteIsolation(cyclicPublicValue, written),
    ).not.toThrow();
    expect(
      auditPrivateNoteIsolation(cyclicPublicValue, written),
    ).toEqual([]);
  });

  it("projects one frozen empty shape and rejects every student existence signal", () => {
    const empty = createAdultPrivateRecord({
      recordId: "private:student-boundary",
      studentRef: "student:opaque-adversarial",
      at: "2026-07-28T09:00:00-04:00",
    });
    const authorized: AdultPrivateAuthorization = {
      actor: PARENT,
      studentRef: empty.studentRef,
      canReadPrivateNotes: true,
      canWritePrivateNotes: true,
    };
    const privateBody =
      "Parent-only schedule detail that must remain in the private repository.";
    const written = writeAdultPrivateNote(
      empty,
      {
        recordId: empty.recordId,
        studentRef: empty.studentRef,
        noteId: "private-note:student-hidden",
        author: PARENT,
        category: "schedule",
        body: privateBody,
        at: "2026-07-28T09:05:00-04:00",
      },
      authorized,
    );

    const emptyStudentProjection = projectStudentPrivateNotes(empty);
    const populatedStudentProjection =
      projectStudentPrivateNotes(written);
    expect(populatedStudentProjection).toEqual({});
    expect(populatedStudentProjection).toBe(emptyStudentProjection);
    expect(Object.isFrozen(populatedStudentProjection)).toBe(true);
    expect(
      auditStudentPrivateNoteProjection(
        populatedStudentProjection,
        written,
      ),
    ).toEqual([]);

    const hostileStudentProjection = {
      hasPrivateNotes: true,
      noteRef: "private-note:student-hidden",
      category: "schedule",
      excerpt: privateBody.slice(0, 32),
    };
    const issues = auditStudentPrivateNoteProjection(
      hostileStudentProjection,
      written,
    );
    expect(issues.map(({ code }) => code)).toContain(
      "private-note-metadata-exposed",
    );
    expect(issues.map(({ code }) => code)).toContain(
      "private-note-exposed",
    );

    expect(
      auditStudentPrivateNoteProjection(
        { unrelated: "otherwise safe content" },
        written,
      ),
    ).toEqual([
      expect.objectContaining({
        code: "private-note-metadata-exposed",
        path: "studentPrivateProjection",
      }),
    ]);

    const cyclicStudentValue: {
      marker: boolean;
      self?: unknown;
    } = { marker: true };
    cyclicStudentValue.self = cyclicStudentValue;
    expect(() =>
      auditStudentPrivateNoteProjection(cyclicStudentValue, written),
    ).not.toThrow();
    expect(
      auditStudentPrivateNoteProjection(cyclicStudentValue, written),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "private-note-metadata-exposed",
          path: "studentPrivateProjection",
        }),
      ]),
    );
  });
});

describe("credential-free Romeo boundary", () => {
  it("rejects credential-shaped keys, containers, authorization strings, and URL channels", () => {
    const base = romeoInput();
    const hostileInputs: readonly unknown[] = [
      { ...base, password: "should-never-enter-runtime" },
      {
        ...base,
        extensions: {
          nested: { authToken: "should-never-enter-runtime" },
        },
      },
      { ...base, otp: "123456" },
      { ...base, pin: "1234" },
      { ...base, mfaCode: "123456" },
      { ...base, mfaToken: "should-never-enter-runtime" },
      { ...base, authorizationCode: "should-never-enter-runtime" },
      { ...base, authCode: "should-never-enter-runtime" },
      { ...base, oauthCode: "should-never-enter-runtime" },
      { ...base, csrfToken: "should-never-enter-runtime" },
      { ...base, sessionId: "should-never-enter-runtime" },
      { ...base, sessionToken: "should-never-enter-runtime" },
      { ...base, totp: "123456" },
      { ...base, verificationCode: "123456" },
      { ...base, recoveryCode: "should-never-enter-runtime" },
      { ...base, samlResponse: "should-never-enter-runtime" },
      { ...base, ssoTicket: "should-never-enter-runtime" },
      {
        ...base,
        magicLink: "https://academy.example.invalid/auth",
      },
      { ...base, resumeNote: "Bearer abcdefghijklmnop" },
      { ...base, resumeNote: "Romeo password: hunter2" },
      { ...base, resumeNote: "PIN: 1234" },
      { ...base, resumeNote: "OTP=123456" },
      { ...base, resumeNote: "MFA code: 123456" },
      { ...base, resumeNote: "authorization code: secret-value" },
      { ...base, resumeNote: "oauth_code=secret-value" },
      { ...base, resumeNote: "csrf-token: secret-value" },
      { ...base, resumeNote: "TOTP: 123456" },
      { ...base, resumeNote: "verification code: 123456" },
      { ...base, resumeNote: "recovery code: secret-value" },
      { ...base, resumeNote: "SAML response: secret-value" },
      { ...base, resumeNote: "SSO ticket: secret-value" },
      {
        ...base,
        resumeNote:
          "magic link: https://academy.example.invalid/auth",
      },
      {
        ...base,
        externalUrlReference:
          "https://username:password@academy.example.invalid/assignment",
      },
      {
        ...base,
        externalUrlReference:
          "https://academy.example.invalid/assignment?session=secret",
      },
      {
        ...base,
        externalUrlReference:
          "https://academy.example.invalid/assignment#access_token=secret",
      },
    ];

    for (const hostile of hostileInputs) {
      expectRomeoCredentialRejection(() =>
        normalizeRomeoAssignment(hostile as RomeoAssignmentInput),
      );
    }

    expectRomeoCredentialRejection(() =>
      assertRomeoCredentialFree(
        new Map<string, unknown>([
          ["safe", new Map([["clientSecret", "never-store"]])],
        ]),
      ),
    );
    expectRomeoCredentialRejection(() =>
      assertRomeoCredentialFree(
        new Set([{ safe: { sessionCookie: "never-store" } }]),
      ),
    );

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    cyclic.profile = { loginPassword: "never-store" };
    expectRomeoCredentialRejection(() =>
      assertRomeoCredentialFree(cyclic),
    );
  });

  it("keeps accepted metadata manual and rejects credential smuggling during updates", () => {
    const assignment = normalizeRomeoAssignment(romeoInput());
    expect(assignment).toMatchObject({
      schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
      provider: "romeo_virtual_academy",
      sourceMode: "manual",
      externalAssignmentId: "romeo:assignment-opaque-001",
      hostLaunchRef: "host-launch:romeo:assignment-opaque-001",
    });
    const publicProjection =
      projectRomeoAssignmentForPublic(assignment);
    expect(publicProjection).toMatchObject({
      schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
      externalAssignmentId: assignment.externalAssignmentId,
      hostLaunchRef: assignment.hostLaunchRef,
      resumeNoteAvailable: true,
      linkedManuelAcademyTutoring: {
        supportStudyPlanId: {
          id: "study-plan:linear-equations",
          revision: 1,
        },
      },
    });
    expect(publicProjection).not.toHaveProperty("externalUrlReference");
    expect(publicProjection).not.toHaveProperty("resumeNote");
    expect(JSON.stringify(publicProjection)).not.toContain(
      "Resume at problem four.",
    );
    expect(JSON.stringify(publicProjection)).not.toContain(
      "https://academy.example.invalid/assignments/opaque-001",
    );
    expect(ROMEO_RUNTIME_BOUNDARY).toEqual({
      provider: "romeo_virtual_academy",
      credentialsRequested: false,
      credentialsStored: false,
      automaticLogin: false,
      scraping: false,
      networkRequests: false,
      persistence: false,
      productionSync: false,
    });
    expect(() => assertRomeoCredentialFree(assignment)).not.toThrow();

    expectRomeoCredentialRejection(() =>
      updateRomeoAssignment(
        assignment,
        {
          schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
          lastCheckedAt: "2026-07-28T09:20:00-04:00",
          nested: { apiKey: "never-store" },
        } as unknown as Parameters<typeof updateRomeoAssignment>[1],
      ),
    );
  });
});

describe("duplicate queue and calendar identities", () => {
  it("idempotently replays one recommendation and rejects semantic queue duplicates", () => {
    const envelope = engineEnvelope();
    const first = ingestEngineRecommendation({
      envelope,
      queueEntries: [],
    });
    const replay = ingestEngineRecommendation({
      envelope,
      currentReview: first.canonicalReview,
      queueEntries: first.queueEntries,
    });

    expect(replay.canonicalAction).toBe("idempotent");
    expect(replay.queueAction).toBe("idempotent");
    expect(replay.queueEntries).toHaveLength(1);
    expect(replay.queueEntry.id).toBe(first.queueEntry.id);

    for (const conflictingReplay of [
      engineEnvelope({ estimatedMinutes: 9 }),
      engineEnvelope({
        sourceRecommendationId:
          "recommendation:adversarial-reused-queue-id",
      }),
      engineEnvelope({
        queueEntryId: "queue:adversarial-reused-source-id",
      }),
    ]) {
      expect(() =>
        ingestEngineRecommendation({
          envelope: conflictingReplay,
          currentReview: first.canonicalReview,
          queueEntries: first.queueEntries,
        }),
      ).toThrowError(
        expect.objectContaining({
          code: "identity-conflict",
        }),
      );
    }

    const semanticDuplicate: ReviewQueueEntry = {
      ...first.queueEntry,
      id: "queue:adversarial-duplicate",
      sourceRecommendationId: "recommendation:adversarial-duplicate",
    };
    expect(() =>
      buildDailyReviewPlan({
        planningDate: "2026-07-29",
        totalAvailableMinutes: 90,
        requiredInstructionMinutes: 60,
        limits: { maxItems: 3, maxMinutes: 20 },
        queueEntries: [first.queueEntry, semanticDuplicate],
      }),
    ).toThrowError(ReviewRuntimeError);
  });

  it("collapses repeat calendar imports and rejects one internal ID reused across sources", () => {
    const first = calendarBlock("block:first-accepted", "lesson:stable-001");
    const replay = calendarBlock("block:host-retry", "lesson:stable-001");
    const merged = mergeCalendarBlocks([first], [replay]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.internalBlockId).toBe("block:first-accepted");
    expect(merged[0]?.sourceIdentity.externalItemId).toBe("lesson:stable-001");

    const identityConflict = calendarBlock(
      "block:first-accepted",
      "lesson:different-source-record",
    );
    expect(() =>
      mergeCalendarBlocks([first], [identityConflict]),
    ).toThrowError(CalendarRuntimeError);

    const replayedAgain = mergeCalendarBlocks(merged, [replay, replay]);
    expect(replayedAgain).toHaveLength(1);
    expect(replayedAgain[0]?.sourceIdentity).toEqual(
      first.sourceIdentity,
    );
  });
});

describe("IANA time-zone and DST adversarial cases", () => {
  it("rejects spring-forward gaps and explicitly resolves both fall-back instants", () => {
    expect(() =>
      assertHouseholdTimeZone("Mars/Olympus_Mons"),
    ).toThrowError(
      expect.objectContaining({ code: "invalid_time_zone" }),
    );
    expect(
      resolveLearnerLocalStart(
        "2026-03-08T01:59",
        "America/New_York",
      ),
    ).toBe("2026-03-08T06:59:00.000Z");
    expect(() =>
      resolveLearnerLocalStart(
        "2026-03-08T02:30",
        "America/New_York",
      ),
    ).toThrowError(
      expect.objectContaining({ code: "nonexistent_local_time" }),
    );
    expect(
      resolveLearnerLocalStart(
        "2026-03-08T03:00",
        "America/New_York",
      ),
    ).toBe("2026-03-08T07:00:00.000Z");
    expect(
      resolveLearnerLocalStart(
        "2026-11-01T00:59",
        "America/New_York",
      ),
    ).toBe("2026-11-01T04:59:00.000Z");
    expect(
      resolveLearnerLocalStart(
        "2026-11-01T01:30",
        "America/New_York",
        "earlier",
      ),
    ).toBe("2026-11-01T05:30:00.000Z");
    expect(
      resolveLearnerLocalStart(
        "2026-11-01T01:30",
        "America/New_York",
        "later",
      ),
    ).toBe("2026-11-01T06:30:00.000Z");
    expect(
      resolveLearnerLocalStart(
        "2026-11-01T02:00",
        "America/New_York",
      ),
    ).toBe("2026-11-01T07:00:00.000Z");
    expect(
      learnerLocalDate(
        "2026-11-01T03:59:00.000Z",
        "America/New_York",
      ),
    ).toBe("2026-10-31");
    expect(
      learnerLocalDate(
        "2026-11-01T04:00:00.000Z",
        "America/New_York",
      ),
    ).toBe("2026-11-01");
  });

  it("is independent of the host process time zone", () => {
    const originalHostTimeZone = process.env.TZ;
    const evaluate = () => ({
      spring:
        resolveLearnerLocalStart(
          "2026-03-08T03:30",
          "America/New_York",
        ),
      overlap: resolveLearnerLocalStart(
        "2026-11-01T01:30",
        "America/New_York",
        "later",
      ),
      localDate: learnerLocalDate(
        "2026-07-29T01:00:00.000Z",
        "America/Los_Angeles",
      ),
    });

    try {
      process.env.TZ = "UTC";
      const underUtcHost = evaluate();
      process.env.TZ = "Pacific/Honolulu";
      const underHonoluluHost = evaluate();
      process.env.TZ = "Asia/Tokyo";
      const underTokyoHost = evaluate();

      expect(underHonoluluHost).toEqual(underUtcHost);
      expect(underTokyoHost).toEqual(underUtcHost);
      expect(underUtcHost).toEqual({
        spring: "2026-03-08T07:30:00.000Z",
        overlap: "2026-11-01T06:30:00.000Z",
        localDate: "2026-07-28",
      });
    } finally {
      if (originalHostTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalHostTimeZone;
      }
    }
  });
});

describe("deterministic traces and public browser boundary", () => {
  it("repeats scenario and recommendation traces byte-for-byte", () => {
    const scenarioTraceA = deterministicScenarioTrace();
    const scenarioTraceB = deterministicScenarioTrace();
    expect(JSON.stringify(scenarioTraceA)).toBe(
      JSON.stringify(scenarioTraceB),
    );

    const first = ingestEngineRecommendation({
      envelope: engineEnvelope(),
      queueEntries: [],
    });
    const second = ingestEngineRecommendation({
      envelope: engineEnvelope(),
      queueEntries: [],
    });
    expect(second.trace).toEqual(first.trace);
    expect(second.trace.map(({ sequence }) => sequence)).toEqual(
      second.trace.map((_, index) => index + 1),
    );
  });

  it("keeps browser-delivered runtime modules free of Node, network, storage, and nondeterministic APIs", () => {
    const publicSources = readdirSync(RUNTIME_DIRECTORY)
      .filter(
        (name) =>
          name.endsWith(".ts") &&
          !name.endsWith(".config.ts"),
      )
      .sort();
    expect(publicSources).toEqual(
      expect.arrayContaining([
        "app.ts",
        "calendar-runtime.ts",
        "demo-scenarios.ts",
        "parent-runtime.ts",
        "privacy.ts",
        "review-runtime.ts",
        "romeo-runtime.ts",
      ]),
    );

    for (const name of publicSources) {
      const source = readFileSync(join(RUNTIME_DIRECTORY, name), "utf8");
      expect(source, `${name} imports a Node-only module`).not.toMatch(
        /\b(?:from|import)\s*(?:\(|)\s*["'](?:node:|fs(?:\/|["'])|path(?:\/|["'])|child_process|crypto|os(?:\/|["'])|net(?:\/|["'])|tls(?:\/|["'])|https?(?:\/|["']))/,
      );
      expect(source, `${name} references a Node-only global`).not.toMatch(
        /\b(?:process\.|Buffer\b|__dirname\b|__filename\b|require\s*\(|Deno\b|Bun\b)/,
      );
      expect(source, `${name} performs network or persistent storage I/O`).not
        .toMatch(
          /\b(?:fetch\s*\(|XMLHttpRequest\b|WebSocket\b|EventSource\b|RTCPeerConnection\b|navigator\.(?:sendBeacon|credentials|storage)\b|localStorage\b|sessionStorage\b|indexedDB\b|CacheStorage\b|caches\.open\s*\(|showOpenFilePicker\s*\(|document\.cookie\b)/,
        );
      expect(source, `${name} introduces nondeterministic identity or time`).not
        .toMatch(
          /\b(?:Date\.now\s*\(|Math\.random\s*\(|randomUUID\s*\(|performance\.now\s*\(|crypto\.getRandomValues\s*\(|Temporal\.Now\b|new\s+Date\s*\(\s*\))/,
        );
    }
  });
});

describe("mobile parent view-model invariants", () => {
  it("stays single-column and touch-safe while excluding an adult-private note body", () => {
    const recommendation = projectParentRecommendation({
      recommendationId: "recommendation:mobile-001",
      createdAt: "2026-07-28T08:55:00-04:00",
      direction: "maintain",
      summary: "Continue the current work and break rhythm.",
      evidence: [],
    }).recommendation;
    const initial = createParentRuntimeState({
      controlSetId: "controls:mobile-adversarial",
      studentRef: "student:opaque-mobile",
      gradeBand: "middle-6-8",
      privateRecordRef: "private:mobile-adversarial",
      at: "2026-07-28T09:00:00-04:00",
      gradeBandDefault: {
        maximumWorkDurationMinutes: 30,
        breakDurationMinutes: 5,
        timersHidden: false,
      },
      recommendations: [recommendation],
    });
    const privateBody =
      "Adult-private note body that must not enter the mobile projection.";
    const outcome = applyParentControlAction(initial, {
      type: "add-private-note",
      eventId: "event:mobile-private-note",
      at: "2026-07-28T09:05:00-04:00",
      actor: PARENT,
      noteId: "note:mobile-private",
      category: "schedule",
      body: privateBody,
    });
    const mobile = buildMobileParentViewModel(outcome.state);
    const serialized = JSON.stringify({
      state: outcome.state,
      mobile,
    });

    expect(outcome.adultPrivateWrite?.body).toBe(privateBody);
    if (outcome.adultPrivateWrite === undefined) {
      throw new Error("The parent action did not route a private write.");
    }
    const privateRepositoryRecord = writeAdultPrivateNote(
      createAdultPrivateRecord({
        recordId: "private:mobile-adversarial",
        studentRef: "student:opaque-mobile",
        at: "2026-07-28T09:00:00-04:00",
      }),
      outcome.adultPrivateWrite,
      {
        actor: PARENT,
        studentRef: "student:opaque-mobile",
        canReadPrivateNotes: true,
        canWritePrivateNotes: true,
      },
    );
    expect(privateRepositoryRecord.notes[0]?.audience).toBe(
      "parent-only",
    );
    expect(serialized).not.toContain(privateBody);
    expect(mobile.layout).toEqual({
      baselineColumns: 1,
      usesDataTables: false,
      wrapsLongText: true,
    });
    expect(mobile.availableControls).toHaveLength(10);
    expect(
      new Set(mobile.availableControls.map(({ action }) => action)).size,
    ).toBe(10);
    for (const control of mobile.availableControls) {
      expect(control.minimumTouchTargetPixels).toBeGreaterThanOrEqual(44);
      expect(control.fullWidthOnNarrowScreens).toBe(true);
    }
    expect(mobile.privateNotes).toEqual({
      recordRef: "private:mobile-adversarial",
      access: "authorized-adults-only",
      bodyIncluded: false,
    });
  });
});

describe("explicit local toolchain dependencies", () => {
  it("declares and locks Node types, TypeScript, Vite, Vitest, and Playwright locally", () => {
    const manifest = JSON.parse(
      readFileSync(join(RUNTIME_DIRECTORY, "package.json"), "utf8"),
    ) as {
      readonly devDependencies?: Readonly<Record<string, string>>;
      readonly scripts?: Readonly<Record<string, string>>;
      readonly engines?: Readonly<Record<string, string>>;
    };
    const lockfile = JSON.parse(
      readFileSync(join(RUNTIME_DIRECTORY, "package-lock.json"), "utf8"),
    ) as {
      readonly packages?: Readonly<
        Record<
          string,
          {
            readonly devDependencies?: Readonly<Record<string, string>>;
            readonly version?: string;
            readonly dev?: boolean;
          }
        >
      >;
    };
    const tsconfig = JSON.parse(
      readFileSync(join(RUNTIME_DIRECTORY, "tsconfig.json"), "utf8"),
    ) as {
      readonly compilerOptions?: {
        readonly types?: readonly string[];
      };
    };

    const manifestSpec = manifest.devDependencies?.["@types/node"];
    const lockedRootSpec =
      lockfile.packages?.[""]?.devDependencies?.["@types/node"];
    const lockedPackage = lockfile.packages?.["node_modules/@types/node"];

    const declaredTools = {
      "@types/node": "^24.13.3",
      "playwright-core": "1.62.0",
      typescript: "5.8.3",
      vite: "6.4.3",
      vitest: "4.1.10",
    } as const;
    const lockedVersions = {
      "@types/node": "24.13.3",
      "playwright-core": "1.62.0",
      typescript: "5.8.3",
      vite: "6.4.3",
      vitest: "4.1.10",
    } as const;
    for (const [dependency, declaredSpec] of Object.entries(
      declaredTools,
    )) {
      expect(manifest.devDependencies?.[dependency]).toBe(declaredSpec);
      expect(
        lockfile.packages?.[""]?.devDependencies?.[dependency],
      ).toBe(declaredSpec);
      expect(
        lockfile.packages?.[`node_modules/${dependency}`],
      ).toMatchObject({
        dev: true,
        version:
          lockedVersions[
            dependency as keyof typeof lockedVersions
          ],
      });
    }

    expect(manifestSpec).toMatch(/^\^24\./);
    expect(lockedRootSpec).toBe(manifestSpec);
    expect(lockedPackage).toMatchObject({
      dev: true,
      version: expect.stringMatching(/^24\./),
    });
    expect(tsconfig.compilerOptions?.types).toContain("node");
    expect(manifest.engines?.node).toBe(">=24");
    expect(manifest.scripts).toMatchObject({
      build: expect.stringMatching(/^vite\b/),
      test: expect.stringMatching(/^vitest\b/),
      typecheck: expect.stringMatching(/^tsc\b/),
      screenshots: "node scripts/capture-screenshots.mjs",
    });

    const viteConfig = readFileSync(
      join(RUNTIME_DIRECTORY, "vite.config.ts"),
      "utf8",
    );
    const vitestConfig = readFileSync(
      join(RUNTIME_DIRECTORY, "vitest.config.ts"),
      "utf8",
    );
    const screenshotScript = readFileSync(
      join(
        RUNTIME_DIRECTORY,
        "scripts",
        "capture-screenshots.mjs",
      ),
      "utf8",
    );
    expect(viteConfig).toContain('from "vite"');
    expect(vitestConfig).toContain('from "vitest/config"');
    expect(screenshotScript).toContain(
      'from "playwright-core"',
    );
  });
});
