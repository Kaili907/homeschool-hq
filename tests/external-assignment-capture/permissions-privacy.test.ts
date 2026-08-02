import { describe, expect, it } from "vitest";
import {
  type ExternalCaptureAction,
  type ExternalCaptureActor,
  type ManualAssignmentIntakeInput,
} from "../../external-learning/capture/types.js";
import {
  assertExternalCapturePermission,
  externalCapturePermission,
} from "../../external-learning/capture/permissions.js";
import { confirmExtractionProposal } from "../../external-learning/capture/confirmation.js";
import {
  createManualExtractionProposal,
  extractDocumentAssignmentProposal,
} from "../../external-learning/capture/extraction.js";
import {
  applyCourseSectionMapping,
  confirmCourseSectionMapping,
} from "../../external-learning/capture/mapping.js";
import {
  LEARNER_REF,
  OTHER_LEARNER_REF,
  cloneJson,
  makeConfirmationInput,
  makeDocumentIntake,
  makeExtraction,
  makeManualIntake,
  outOfScopeParentActor,
  parentActor,
  parentWithoutApprovalActor,
  providerActor,
  studentActor,
} from "./fixtures.js";

describe("role and learner-scope permissions", () => {
  const allowedByRole: Readonly<
    Record<ExternalCaptureActor["role"], readonly ExternalCaptureAction[]>
  > = {
    parent: [
      "create_intake",
      "confirm_extraction",
      "schedule_assignment",
      "submit_evidence",
      "review_evidence",
      "mark_complete",
      "configure_provider",
    ],
    student: [
      "create_intake",
      "confirm_extraction",
      "submit_evidence",
    ],
    provider_adapter: ["apply_provider_update"],
    system: ["mark_complete", "apply_provider_update"],
  };

  const actors: Readonly<Record<ExternalCaptureActor["role"], ExternalCaptureActor>> =
    {
      parent: parentActor,
      student: studentActor,
      provider_adapter: providerActor,
      system: {
        actorRef: "host-system",
        role: "system",
        learnerRefs: [],
      },
    };

  const actions: readonly ExternalCaptureAction[] = [
    "create_intake",
    "confirm_extraction",
    "schedule_assignment",
    "submit_evidence",
    "review_evidence",
    "mark_complete",
    "apply_provider_update",
    "configure_provider",
  ];

  for (const role of Object.keys(actors) as ExternalCaptureActor["role"][]) {
    for (const action of actions) {
      const expected = allowedByRole[role].includes(action);
      it(`${role} ${expected ? "may" : "may not"} ${action}`, () => {
        expect(
          externalCapturePermission(actors[role], action, LEARNER_REF).allowed,
        ).toBe(expected);
      });
    }
  }

  it.each([
    "create_intake",
    "confirm_extraction",
    "schedule_assignment",
    "submit_evidence",
    "review_evidence",
    "mark_complete",
    "configure_provider",
  ] satisfies ExternalCaptureAction[])(
    "denies out-of-scope family actor action %s",
    (action) => {
      expect(
        externalCapturePermission(
          outOfScopeParentActor,
          action,
          LEARNER_REF,
        ),
      ).toMatchObject({
        allowed: false,
        reason: expect.stringContaining("not authorized for this learner"),
      });
    },
  );

  it("denies an out-of-scope provider adapter even at the provider boundary", () => {
    const adapter: ExternalCaptureActor = {
      ...providerActor,
      learnerRefs: [OTHER_LEARNER_REF],
    };

    expect(
      externalCapturePermission(
        adapter,
        "apply_provider_update",
        LEARNER_REF,
      ).allowed,
    ).toBe(false);
  });

  it("requires an explicit parent evidence-approval capability", () => {
    expect(
      externalCapturePermission(
        parentWithoutApprovalActor,
        "review_evidence",
        LEARNER_REF,
      ),
    ).toMatchObject({
      allowed: false,
      reason: expect.stringContaining("review permission"),
    });
  });

  it("requires an explicit provider-configuration capability", () => {
    const parentWithoutConfiguration: ExternalCaptureActor = {
      ...parentActor,
      canConfigureProviders: false,
    };

    expect(
      externalCapturePermission(
        parentWithoutConfiguration,
        "configure_provider",
        LEARNER_REF,
      ).allowed,
    ).toBe(false);
  });

  it("enforces learner scope when confirming extracted fields", () => {
    expect(() =>
      confirmExtractionProposal(
        makeExtraction(),
        makeConfirmationInput({ reviewedBy: outOfScopeParentActor }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "permission_denied",
        path: "permission.confirm_extraction",
      }),
    );
  });

  it("exposes a throwing permission guard for integration boundaries", () => {
    expect(() =>
      assertExternalCapturePermission(
        studentActor,
        "schedule_assignment",
        LEARNER_REF,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "permission_denied",
        path: "permission.schedule_assignment",
      }),
    );
  });
});

describe("course mapping authorization", () => {
  const mappingInput = {
    mappingId: "mapping-earth-science",
    learnerRef: LEARNER_REF,
    providerId: "romeo_virtual_academy",
    externalCourse: {
      displayName: "Earth Science",
      externalCourseRef: "course-earth-science",
    },
    externalSection: {
      displayName: "Section A",
      externalSectionRef: "section-a",
    },
    target: {
      courseRef: "manuel-earth-science",
      sectionRef: "manuel-section-a",
      displayName: "Manuel Academy Earth Science",
    },
    confirmedBy: parentActor,
    confirmedAt: "2026-07-28T15:00:00-04:00",
  } as const;

  it("allows only an in-scope parent to confirm a course/section mapping", () => {
    const mapping = confirmCourseSectionMapping(mappingInput);

    expect(mapping).toMatchObject({
      status: "confirmed",
      confirmedByParentRef: parentActor.actorRef,
      providerId: "romeo_virtual_academy",
      learnerRef: LEARNER_REF,
    });
  });

  it("denies student mapping confirmation", () => {
    expect(() =>
      confirmCourseSectionMapping({
        ...mappingInput,
        confirmedBy: studentActor,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "permission_denied",
        path: "permission.schedule_assignment",
      }),
    );
  });

  it("will not apply a mapping belonging to another learner", () => {
    const mapping = confirmCourseSectionMapping(mappingInput);

    expect(() =>
      applyCourseSectionMapping(
        {
          ...confirmExtractionProposal(
            makeExtraction(),
            makeConfirmationInput(),
          ),
          learnerRef: OTHER_LEARNER_REF,
        },
        mapping,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "provider_mismatch",
        path: "courseMapping",
      }),
    );
  });
});

describe("credential exclusion and data minimization", () => {
  it.each([
    {
      schoolPassword: "hunter2",
    },
    {
      nested: {
        accessToken: "provider-token",
      },
    },
    {
      values: {
        instructions: {
          format: "plain_text",
          text: "Password: hunter2",
        },
      },
    },
  ])("rejects credential-bearing manual input %#", (injected) => {
    const input = {
      ...makeManualIntake(),
      ...injected,
    } as unknown as ManualAssignmentIntakeInput;

    expect(() => createManualExtractionProposal(input)).toThrowError(
      expect.objectContaining({ code: "credential_material" }),
    );
  });

  it("strips credential lines from OCR before building values, excerpts, or warnings", () => {
    const secrets = [
      "romeo.student@example.test",
      "hunter2",
      "phoenix-secret-123",
      "bearer-token-secret",
    ];
    const result = extractDocumentAssignmentProposal(
      makeDocumentIntake({
        content: {
          state: "available",
          method: "ocr",
          text: [
            `Username: ${secrets[0]}`,
            `Password: ${secrets[1]}`,
            `School password is ${secrets[2]}`,
            `Access token = ${secrets[3]}`,
            "Assignment Title: Safe assignment title",
            "Course: Literature",
            "Assignment ID: LIT-SAFE-001",
            "Instructions: Read chapter 4.",
          ].join("\n"),
        },
      }),
    );
    const serialized = JSON.stringify(result);

    expect(result.status).toBe("proposal_ready");
    expect(result.fields.title.value).toBe("Safe assignment title");
    expect(result.warnings.join(" ")).toMatch(/discarded|removed/i);
    for (const secret of secrets) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("does not echo a password when credentials are the only readable text", () => {
    const result = extractDocumentAssignmentProposal(
      makeDocumentIntake({
        content: {
          state: "available",
          method: "ocr",
          text: "School password is unique-secret-value",
        },
      }),
    );

    expect(result.status).toBe("manual_entry_required");
    expect(result.fallback.nextStep).toBe("manual_entry");
    expect(JSON.stringify(result)).not.toContain("unique-secret-value");
  });

  it("rejects credential material embedded in attachment metadata", () => {
    const input = cloneJson(makeManualIntake()) as unknown as {
      attachments: Array<Record<string, unknown>>;
    };
    input.attachments = [
      {
        ...input.attachments?.[0],
        attachmentId: "unsafe-attachment",
        purpose: "intake_source",
        fileName: "password=hunter2.png",
        mediaType: "image/png",
        byteSize: 10,
        sha256: "a".repeat(64),
        uploadedAt: "2026-07-28T14:00:00-04:00",
        uploadedBy: {
          actorRef: parentActor.actorRef,
          role: "parent",
        },
        availability: "available",
      },
    ];

    expect(() =>
      createManualExtractionProposal(
        input as unknown as ManualAssignmentIntakeInput,
      ),
    ).toThrowError(
      expect.objectContaining({ code: "credential_material" }),
    );
  });
});
