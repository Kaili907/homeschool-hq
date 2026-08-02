import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  StudyPlanId,
  VersionedReference,
} from "../../contracts/common.js";
import {
  ROMEO_ASSIGNMENT_SCHEMA_VERSION,
  ROMEO_DEC_018_RECONCILIATION,
  ROMEO_RUNTIME_BOUNDARY,
  RomeoRuntimeError,
  normalizeRomeoAssignment,
  projectRomeoAssignmentForPublic,
  projectRomeoAssignmentToCalendar,
  updateRomeoAssignment,
  type RomeoAssignmentInput,
  type RomeoAssignmentUpdate,
  type RomeoCalendarSchedule,
} from "../../integration-labs/calendar-parent-runtime/romeo-runtime.js";

const SUPPORT_STUDY_PLAN = {
  id: "plan/two-step-equations:v1" as StudyPlanId,
  revision: 3,
} as const satisfies VersionedReference<StudyPlanId>;

const COMPLETE_INPUT = {
  schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
  externalAssignmentId: "rva-algebra-204",
  hostLaunchRef: "host-launch:romeo:rva-algebra-204",
  title: "  Solving Two-Step Equations  ",
  course: "  Algebra I  ",
  dueDate: "2026-07-31",
  estimatedDurationMinutes: 35.125,
  completionState: "in_progress",
  parentEnteredProgress: {
    completedUnits: 2,
    totalUnits: 6,
    updatedAt: "2026-07-28T08:20:00-04:00",
  },
  studentEnteredProgress: {
    completedUnits: 3,
    totalUnits: 6,
    updatedAt: "2026-07-28T09:10:00-04:00",
  },
  linkedManuelAcademyTutoring: {
    targetType: "lesson",
    targetId: "lesson-two-step-equations",
    title: "  Two-step equations tutoring  ",
    supportStudyPlanId: SUPPORT_STUDY_PLAN,
  },
  resumeNote: "  Resume with question 7.  ",
  externalUrlReference:
    "https://academy.example.invalid/assignments/rva-algebra-204",
  lastCheckedAt: "2026-07-28T09:15:00-04:00",
  sourceMode: "manual",
} as const satisfies RomeoAssignmentInput;

const SCHEDULE = {
  internalBlockId: "calendar-rva-algebra-204",
  learnerRef: "learner-romeo-runtime",
  householdTimeZone: "America/New_York",
  scheduledLocalStart: "2026-07-29T10:00",
  createdAt: "2026-07-28T13:20:00Z",
  required: true,
} as const satisfies RomeoCalendarSchedule;

const CARD_5_DECISIONS = JSON.parse(
  readFileSync(
    new URL(
      "../../reconciliation/canonical-decisions.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  readonly decisions: readonly {
    readonly decisionId: string;
    readonly status: string;
    readonly classification: string;
    readonly decision: Readonly<Record<string, unknown>>;
  }[];
};

const CARD_5_VALIDATION = JSON.parse(
  readFileSync(
    new URL(
      "../../reconciliation/validation-result.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  readonly status: string;
  readonly assemblyAuthorized: boolean;
};

function expectRomeoCode(
  action: () => unknown,
  code: RomeoRuntimeError["code"],
): void {
  expect(action).toThrowError(
    expect.objectContaining<Partial<RomeoRuntimeError>>({ code }),
  );
}

describe("credential-free Romeo assignment normalization", () => {
  it("normalizes all supported metadata while preserving stable IDs and separate progress", () => {
    const assignment = normalizeRomeoAssignment(COMPLETE_INPUT);

    expect(assignment).toEqual({
      schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
      provider: "romeo_virtual_academy",
      externalAssignmentId: "rva-algebra-204",
      hostLaunchRef: "host-launch:romeo:rva-algebra-204",
      title: "Solving Two-Step Equations",
      course: "Algebra I",
      dueDate: "2026-07-31",
      estimatedDurationMinutes: 35.13,
      completionState: "in_progress",
      parentEnteredProgress: {
        completedUnits: 2,
        totalUnits: 6,
        updatedAt: "2026-07-28T08:20:00-04:00",
      },
      studentEnteredProgress: {
        completedUnits: 3,
        totalUnits: 6,
        updatedAt: "2026-07-28T09:10:00-04:00",
      },
      linkedManuelAcademyTutoring: {
        targetType: "lesson",
        targetId: "lesson-two-step-equations",
        title: "Two-step equations tutoring",
        supportStudyPlanId: SUPPORT_STUDY_PLAN,
      },
      resumeNote: "Resume with question 7.",
      externalUrlReference:
        "https://academy.example.invalid/assignments/rva-algebra-204",
      lastCheckedAt: "2026-07-28T09:15:00-04:00",
      sourceMode: "manual",
    });
    expect(assignment.parentEnteredProgress).not.toBe(
      assignment.studentEnteredProgress,
    );
  });

  it.each(["skill", "lesson"] as const)(
    "links an opaque canonical Manuel Academy %s without deriving its ID",
    (targetType) => {
      const assignment = normalizeRomeoAssignment({
        ...COMPLETE_INPUT,
        linkedManuelAcademyTutoring: {
          targetType,
          targetId: `canonical-${targetType}-42`,
          title: `${targetType} support`,
          supportStudyPlanId: SUPPORT_STUDY_PLAN,
        },
      });

      expect(assignment.linkedManuelAcademyTutoring).toEqual({
        targetType,
        targetId: `canonical-${targetType}-42`,
        title: `${targetType} support`,
        supportStudyPlanId: SUPPORT_STUDY_PLAN,
      });
    },
  );

  it("requires the DEC-018 support plan fallback to be a versioned StudyPlanId reference", () => {
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          linkedManuelAcademyTutoring: {
            ...COMPLETE_INPUT.linkedManuelAcademyTutoring,
            supportStudyPlanId: {
              id: "plan/two-step-equations:v1" as StudyPlanId,
              revision: 0,
            },
          },
        }),
      "invalid_tutoring_link",
    );
    const missingSupportVersion = {
      ...COMPLETE_INPUT,
      linkedManuelAcademyTutoring: {
        targetType: "skill",
        targetId: "skill:two-step-equations",
        title: "Two-step equations support",
      },
    };
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment(
          missingSupportVersion as unknown as RomeoAssignmentInput,
        ),
      "invalid_tutoring_link",
    );
  });

  it("requires real dates, explicit-offset timestamps, valid progress, and declared source modes", () => {
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          dueDate: "2026-02-30",
        }),
      "invalid_due_date",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          lastCheckedAt: "2026-07-28T09:15:00",
        }),
      "invalid_timestamp",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          studentEnteredProgress: {
            completedUnits: 7,
            totalUnits: 6,
            updatedAt: "2026-07-28T09:10:00-04:00",
          },
        }),
      "invalid_progress",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          sourceMode: "automatic-login",
        } as unknown as RomeoAssignmentInput),
      "invalid_source_mode",
    );
  });

  it("requires schema v1 and distinct opaque non-URI launch and assignment references", () => {
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          schemaVersion: 2,
        } as unknown as RomeoAssignmentInput),
      "unsupported_version",
    );
    const withoutVersion = { ...COMPLETE_INPUT } as Record<
      string,
      unknown
    >;
    delete withoutVersion.schemaVersion;
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment(
          withoutVersion as unknown as RomeoAssignmentInput,
        ),
      "unsupported_version",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          hostLaunchRef: COMPLETE_INPUT.externalAssignmentId,
        }),
      "invalid_launch_reference",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          hostLaunchRef:
            "https://academy.example.invalid/assignments/rva-algebra-204",
        }),
      "invalid_launch_reference",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          title:
            "Open https://academy.example.invalid/assignment",
        }),
      "invalid_url",
    );
  });

  it("recursively rejects credential keys, URL user information, and credential-like URL parameters", () => {
    for (const extensions of [
      { otp: "123456" },
      { mfaCode: "123456" },
      { authorizationCode: "do-not-store" },
      { oauthCode: "do-not-store" },
      { csrfToken: "do-not-store" },
      { sessionId: "do-not-store" },
      { sessionToken: "do-not-store" },
      { totp: "123456" },
      { verificationCode: "123456" },
      { recoveryCode: "do-not-store" },
      { samlResponse: "do-not-store" },
      { ssoTicket: "do-not-store" },
      { magicLink: "https://academy.example.invalid/auth" },
    ]) {
      expectRomeoCode(
        () =>
          normalizeRomeoAssignment({
            ...COMPLETE_INPUT,
            extensions,
          } as RomeoAssignmentInput & {
            extensions: Record<string, unknown>;
          }),
        "credential_material",
      );
    }
    for (const resumeNote of [
      "PIN: 1234",
      "OTP: 123456",
      "TOTP: 123456",
      "Verification code: 123456",
      "Recovery code: do-not-store",
      "SAML response: do-not-store",
      "SSO ticket: do-not-store",
      "Magic link: https://academy.example.invalid/auth",
    ]) {
      expectRomeoCode(
        () =>
          normalizeRomeoAssignment({
            ...COMPLETE_INPUT,
            resumeNote,
          }),
        "credential_material",
      );
    }
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          extensions: {
            harmless: [
              {
                session: {
                  refresh_token: "must-not-enter-runtime",
                },
              },
            ],
          },
        } as RomeoAssignmentInput & {
          extensions: {
            harmless: readonly [
              { session: { refresh_token: string } },
            ];
          };
        }),
      "credential_material",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          externalUrlReference:
            "https://student:secret@academy.example.invalid/assignment",
        }),
      "credential_material",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          externalUrlReference:
            "https://academy.example.invalid/assignment?X-Amz-Credential=secret",
        }),
      "credential_material",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          resumeNote:
            "Reference https://academy.example.invalid/assignment?access_token=secret",
        }),
      "credential_material",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          resumeNote: "Romeo password: hunter2",
        }),
      "credential_material",
    );
    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          externalUrlReference:
            "http://academy.example.invalid/assignment",
        }),
      "invalid_url",
    );
  });

  it("handles a cyclic extension object without weakening recursive credential rejection", () => {
    const extension: Record<string, unknown> = {};
    extension.self = extension;
    extension.nested = { apiKey: "must-not-enter-runtime" };

    expectRomeoCode(
      () =>
        normalizeRomeoAssignment({
          ...COMPLETE_INPUT,
          extension,
        } as RomeoAssignmentInput & {
          extension: Record<string, unknown>;
        }),
      "credential_material",
    );
  });
});

describe("Romeo resume and completion updates", () => {
  it("updates completion and resume metadata without combining parent and student reports", () => {
    const original = normalizeRomeoAssignment(COMPLETE_INPUT);
    const completed = updateRomeoAssignment(original, {
      schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
      externalAssignmentId: "rva-algebra-204",
      completionState: "completed",
      studentEnteredProgress: {
        completedUnits: 6,
        totalUnits: 6,
        updatedAt: "2026-07-28T10:00:00-04:00",
      },
      resumeNote: "Assignment complete; tutoring link remains available.",
      lastCheckedAt: "2026-07-28T10:01:00-04:00",
      sourceMode: "browser-assisted-reference",
    });

    expect(completed).toMatchObject({
      externalAssignmentId: "rva-algebra-204",
      completionState: "completed",
      parentEnteredProgress: {
        completedUnits: 2,
        totalUnits: 6,
      },
      studentEnteredProgress: {
        completedUnits: 6,
        totalUnits: 6,
      },
      linkedManuelAcademyTutoring: {
        targetType: "lesson",
        targetId: "lesson-two-step-equations",
        supportStudyPlanId: SUPPORT_STUDY_PLAN,
      },
      resumeNote:
        "Assignment complete; tutoring link remains available.",
      lastCheckedAt: "2026-07-28T10:01:00-04:00",
      sourceMode: "browser-assisted-reference",
    });

    const repeated = updateRomeoAssignment(completed, {
      schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
      externalAssignmentId: "rva-algebra-204",
      completionState: "completed",
      studentEnteredProgress: {
        completedUnits: 6,
        totalUnits: 6,
        updatedAt: "2026-07-28T10:00:00-04:00",
      },
      resumeNote: "Assignment complete; tutoring link remains available.",
      lastCheckedAt: "2026-07-28T10:01:00-04:00",
      sourceMode: "browser-assisted-reference",
    });
    expect(repeated).toBe(completed);
  });

  it("rejects ID changes, stale observations, and conflicting observations at one timestamp", () => {
    const original = normalizeRomeoAssignment(COMPLETE_INPUT);

    expectRomeoCode(
      () =>
        updateRomeoAssignment(original, {
          schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
          externalAssignmentId: "different-assignment",
          lastCheckedAt: "2026-07-28T09:20:00-04:00",
        }),
      "identity_conflict",
    );
    expectRomeoCode(
      () =>
        updateRomeoAssignment(original, {
          schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
          completionState: "completed",
          lastCheckedAt: "2026-07-28T09:14:59-04:00",
        }),
      "stale_update",
    );
    expectRomeoCode(
      () =>
        updateRomeoAssignment(original, {
          schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
          completionState: "completed",
          lastCheckedAt: original.lastCheckedAt,
        }),
      "update_conflict",
    );
  });

  it("rejects credential material at any nesting depth of an update", () => {
    const original = normalizeRomeoAssignment(COMPLETE_INPUT);
    const credentialSmugglingUpdate = {
      schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
      lastCheckedAt: "2026-07-28T09:20:00-04:00",
      extensions: {
        importContext: {
          session: {
            accessToken: "must-not-enter-runtime",
          },
        },
      },
    } as RomeoAssignmentUpdate & {
      readonly extensions: {
        readonly importContext: {
          readonly session: {
            readonly accessToken: string;
          };
        };
      };
    };

    expectRomeoCode(
      () =>
        updateRomeoAssignment(
          original,
          credentialSmugglingUpdate,
      ),
      "credential_material",
    );
    expect(original).toEqual(
      normalizeRomeoAssignment(COMPLETE_INPUT),
    );
  });
});

describe("Card 5 DEC-018 reconciliation parity", () => {
  it("matches the approved-with-required-change decision and retains its assembly blocker", () => {
    const decision = CARD_5_DECISIONS.decisions.find(
      ({ decisionId }) => decisionId === "DEC-018",
    );

    expect(decision).toMatchObject({
      decisionId: "DEC-018",
      status: "approved-with-required-change",
      classification: "REQUIRED BEFORE FINAL ASSEMBLY",
      decision: {
        stableIdentity: [
          "provider=romeo_virtual_academy",
          "externalAssignmentRef",
        ],
        progressRule: expect.stringContaining(
          "parent and student entered progress separate",
        ),
        supportRule: expect.stringContaining(
          "VersionedReference<StudyPlanId>",
        ),
        dueDateRule: expect.stringContaining(
          "Do not synthesize dueAt midnight",
        ),
        credentialRule: expect.stringContaining(
          "credential-bearing URL",
        ),
      },
    });
    expect(CARD_5_VALIDATION).toEqual(
      expect.objectContaining({
        status: "PASS_WITH_BLOCKER",
        assemblyAuthorized: false,
      }),
    );
    expect(ROMEO_DEC_018_RECONCILIATION).toEqual(
      expect.objectContaining({
        decisionId: "DEC-018",
        reconciled: true,
        validationStatus: "PASS_WITH_BLOCKER",
        productionApproved: false,
        finalAssemblyAuthorized: false,
        supportReference:
          "VersionedReference<StudyPlanId>",
        blockedProbe: "TC-P18",
      }),
    );
  });

  it("keeps the adapter URL and resume body private while projecting only opaque launch identity", () => {
    const assignment = normalizeRomeoAssignment(COMPLETE_INPUT);
    const publicProjection =
      projectRomeoAssignmentForPublic(assignment);
    const calendarProjection =
      projectRomeoAssignmentToCalendar(assignment, SCHEDULE);
    const prohibitedUri =
      "https://academy.example.invalid/assignments/rva-algebra-204";
    const privateResume = "Resume with question 7.";

    expect(assignment).toMatchObject({
      schemaVersion: 1,
      externalAssignmentId: "rva-algebra-204",
      hostLaunchRef: "host-launch:romeo:rva-algebra-204",
      dueDate: "2026-07-31",
      externalUrlReference: prohibitedUri,
      resumeNote: privateResume,
      completionState: "in_progress",
      parentEnteredProgress: {
        completedUnits: 2,
        totalUnits: 6,
      },
      studentEnteredProgress: {
        completedUnits: 3,
        totalUnits: 6,
      },
      linkedManuelAcademyTutoring: {
        targetType: "lesson",
        targetId: "lesson-two-step-equations",
        supportStudyPlanId: SUPPORT_STUDY_PLAN,
      },
    });
    expect(publicProjection).toMatchObject({
      schemaVersion: 1,
      externalAssignmentId: "rva-algebra-204",
      hostLaunchRef: "host-launch:romeo:rva-algebra-204",
      dueDate: "2026-07-31",
      resumeNoteAvailable: true,
      parentEnteredProgress: {
        completedUnits: 2,
        totalUnits: 6,
      },
      studentEnteredProgress: {
        completedUnits: 3,
        totalUnits: 6,
      },
    });
    expect(
      publicProjection.parentEnteredProgress,
    ).not.toBe(publicProjection.studentEnteredProgress);
    expect(publicProjection.dueDate).not.toContain("T");
    expect(publicProjection).not.toHaveProperty("dueAt");
    expect(
      publicProjection.linkedManuelAcademyTutoring,
    ).not.toHaveProperty("state");
    expect(JSON.stringify(publicProjection)).not.toContain(
      prohibitedUri,
    );
    expect(JSON.stringify(publicProjection)).not.toContain(
      privateResume,
    );

    expect(calendarProjection).toMatchObject({
      hostLaunchRef: "host-launch:romeo:rva-algebra-204",
      block: {
        sourceIdentity: {
          source: "romeo_virtual_academy",
          externalItemId: "rva-algebra-204",
        },
        scheduledLocalStart: "2026-07-29T10:00",
      },
    });
    expect(calendarProjection.block).not.toHaveProperty("dueAt");
    expect(JSON.stringify(calendarProjection)).not.toContain(
      prohibitedUri,
    );
    expect(JSON.stringify(calendarProjection)).not.toContain(
      privateResume,
    );
  });
});

describe("idempotent Romeo calendar projection", () => {
  it(
    "forwards Card 5 explicit-offset placement through a DST overlap",
    () => {
      const assignment = normalizeRomeoAssignment(COMPLETE_INPUT);
      const projection = projectRomeoAssignmentToCalendar(
        assignment,
        {
          ...SCHEDULE,
          internalBlockId: "calendar-rva-algebra-204-dst",
          scheduledLocalStart: "2026-11-01T01:30",
          scheduledStart: "2026-11-01T06:30:00Z",
          intendedLocalDate: "2026-11-01",
        },
      );

      expect(projection.block).toMatchObject({
        householdTimeZone: "America/New_York",
        scheduledLocalStart: "2026-11-01T01:30",
        scheduledStartInstant: "2026-11-01T06:30:00Z",
        intendedLocalDate: "2026-11-01",
        placementSource: "explicit-offset",
      });
    },
  );

  it("creates one canonical custom block and preserves the first accepted internal ID on retries", () => {
    const assignment = normalizeRomeoAssignment(COMPLETE_INPUT);
    const first = projectRomeoAssignmentToCalendar(
      assignment,
      SCHEDULE,
    );
    const repeated = projectRomeoAssignmentToCalendar(
      assignment,
      {
        ...SCHEDULE,
        internalBlockId: "host-retried-with-another-id",
        scheduledLocalStart: "2026-07-30T11:30",
        createdAt: "2026-07-28T13:25:00Z",
      },
      first.blocks,
    );

    expect(first).toMatchObject({
      action: "created",
      created: true,
      block: {
        internalBlockId: "calendar-rva-algebra-204",
        learnerRef: "learner-romeo-runtime",
        sourceIdentity: {
          source: "romeo_virtual_academy",
          externalItemId: "rva-algebra-204",
        },
        blockType: "romeo_virtual_academy_activity",
        canonicalTask: {
          taskType: "custom",
          customTaskTypeId: "romeo-virtual-academy-activity",
        },
        title: "Solving Two-Step Equations",
        subject: "Algebra I",
        estimatedDurationMinutes: 35.13,
      },
    });
    expect(first.block.segments).toEqual([
      expect.objectContaining({
        segmentId: "romeo-assignment-work",
        required: true,
        estimatedMinutes: 35.13,
      }),
    ]);
    expect(repeated).toMatchObject({
      action: "idempotent",
      created: false,
      block: {
        internalBlockId: "calendar-rva-algebra-204",
        scheduledLocalStart: "2026-07-29T10:00",
      },
    });
    expect(repeated.blocks).toHaveLength(1);
  });

  it("performs normalization, update, and projection without making a network request", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const assignment = normalizeRomeoAssignment({
        ...COMPLETE_INPUT,
        sourceMode: "approved-import",
      });
      const updated = updateRomeoAssignment(assignment, {
        schemaVersion: ROMEO_ASSIGNMENT_SCHEMA_VERSION,
        resumeNote: "Resume at the second worked example.",
        lastCheckedAt: "2026-07-28T09:20:00-04:00",
      });
      projectRomeoAssignmentToCalendar(updated, SCHEDULE);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(ROMEO_RUNTIME_BOUNDARY).toEqual(
        expect.objectContaining({
          credentialsRequested: false,
          credentialsStored: false,
          automaticLogin: false,
          scraping: false,
          networkRequests: false,
          persistence: false,
          productionSync: false,
        }),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
