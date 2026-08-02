import { describe, expect, it } from "vitest";
import {
  buildExternalScheduleHandoff,
  externalAssignmentCompletionGate,
  linkExternalAssignmentToSchedule,
  markExternalAssignmentComplete,
  reviewCompletionEvidence,
  submitCompletionEvidence,
} from "../../external-learning/capture/lifecycle.js";
import { validateExternalAssignmentRecord } from "../../external-learning/capture/validation.js";
import {
  defaultEvidenceRequirement,
  makeAttachment,
  makeConfirmedAssignment,
  makeEvidenceAttachment,
  makeEvidenceInput,
  makeSchedulePlacement,
  makeScheduledAssignment,
  parentActor,
  parentWithoutApprovalActor,
  studentActor,
} from "./fixtures.js";

describe("schedule integration boundary", () => {
  it("builds a handoff that preserves provider identity, original reference, due semantics, and attachments", () => {
    const assignment = makeConfirmedAssignment({
      intakeAttachments: [makeAttachment()],
    });

    const handoff = buildExternalScheduleHandoff(
      assignment,
      makeSchedulePlacement(),
    );

    expect(handoff).toMatchObject({
      assignmentId: assignment.assignmentId,
      learnerRef: assignment.learnerRef,
      sourceProviderId: assignment.provider.providerId,
      sourceProviderDisplayName: assignment.provider.displayName,
      originalAssignmentReference: assignment.originalAssignmentReference,
      title: assignment.title,
      due: assignment.due,
      attachmentIds: ["attachment-001"],
      evidenceRequired: true,
      parentApprovalRequired: true,
    });
    expect(handoff.dedupeKey).toContain(
      encodeURIComponent(assignment.originalAssignmentReference),
    );
  });

  it("requires the host to return an opaque calendar entry reference", () => {
    expect(() =>
      linkExternalAssignmentToSchedule(
        makeConfirmedAssignment(),
        makeSchedulePlacement(),
        "",
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        path: "calendarEntryRef",
      }),
    );
  });

  it("permits only an in-scope parent to schedule confirmed work", () => {
    expect(() =>
      buildExternalScheduleHandoff(
        makeConfirmedAssignment(),
        makeSchedulePlacement({ requestedBy: studentActor }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "permission_denied",
        path: "permission.schedule_assignment",
      }),
    );
  });

  it("does not schedule the same record twice", () => {
    expect(() =>
      buildExternalScheduleHandoff(
        makeScheduledAssignment(),
        makeSchedulePlacement(),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_state",
        path: "lifecycle",
      }),
    );
  });
});

describe("completion evidence requirements", () => {
  it("blocks completion before scheduling", () => {
    const gate = externalAssignmentCompletionGate(makeConfirmedAssignment());

    expect(gate).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining(["not_scheduled", "evidence_missing"]),
    });
  });

  it("blocks completion while required evidence or approval is missing", () => {
    const assignment = makeScheduledAssignment();

    expect(externalAssignmentCompletionGate(assignment)).toEqual({
      allowed: false,
      reasons: ["evidence_missing", "parent_approval_missing"],
    });
    expect(() =>
      markExternalAssignmentComplete(
        assignment,
        parentActor,
        "2026-08-03T17:00:00-04:00",
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "approval_required",
        path: "lifecycle",
      }),
    );
  });

  it("enforces attachment count, purpose, availability, media type, and note policy", () => {
    const assignment = makeScheduledAssignment(
      {},
      {
        ...defaultEvidenceRequirement,
        minimumAttachmentCount: 2,
        acceptedMediaTypes: ["image/png"],
        noteRequired: true,
      },
    );

    expect(() =>
      submitCompletionEvidence(
        assignment,
        makeEvidenceInput({ attachments: [makeEvidenceAttachment()] }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "evidence_required",
        path: "attachments",
      }),
    );

    const validPng = makeEvidenceAttachment({
      attachmentId: "evidence-png",
      mediaType: "image/png",
    });
    const wrongPurpose = makeEvidenceAttachment({
      attachmentId: "evidence-wrong-purpose",
      purpose: "intake_source",
      mediaType: "image/png",
    });
    expect(() =>
      submitCompletionEvidence(
        assignment,
        makeEvidenceInput({
          attachments: [validPng, wrongPurpose],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "evidence_required",
        path: "attachments[1]",
      }),
    );

    const unavailable = makeEvidenceAttachment({
      attachmentId: "evidence-unavailable",
      availability: "unreadable",
      mediaType: "image/png",
    });
    expect(() =>
      submitCompletionEvidence(
        assignment,
        makeEvidenceInput({
          attachments: [validPng, unavailable],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "evidence_required",
        path: "attachments[1]",
      }),
    );

    const wrongMedia = makeEvidenceAttachment({
      attachmentId: "evidence-pdf",
      mediaType: "application/pdf",
    });
    expect(() =>
      submitCompletionEvidence(
        assignment,
        makeEvidenceInput({
          attachments: [validPng, wrongMedia],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        path: "attachments[1].mediaType",
      }),
    );

    const secondPng = makeEvidenceAttachment({
      attachmentId: "evidence-png-2",
      mediaType: "image/png",
    });
    expect(() =>
      submitCompletionEvidence(
        assignment,
        makeEvidenceInput({
          attachments: [validPng, secondPng],
          note: undefined,
        }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "evidence_required",
        path: "note",
      }),
    );
  });

  it("allows a student to submit, but requires a parent to approve before completion", () => {
    const scheduled = makeScheduledAssignment();
    const submitted = submitCompletionEvidence(
      scheduled,
      makeEvidenceInput(),
    );

    expect(submitted.lifecycle).toBe("evidence_pending");
    expect(submitted.evidence[0]).toMatchObject({
      status: "pending_parent_approval",
      submittedBy: {
        actorRef: studentActor.actorRef,
        role: "student",
      },
    });
    expect(() =>
      reviewCompletionEvidence(
        submitted,
        "evidence-submission-001",
        {
          reviewedBy: studentActor,
          decidedAt: "2026-08-03T16:30:00-04:00",
          decision: "approve",
        },
      ),
    ).toThrowError(expect.objectContaining({ code: "permission_denied" }));

    const approved = reviewCompletionEvidence(
      submitted,
      "evidence-submission-001",
      {
        reviewedBy: parentActor,
        decidedAt: "2026-08-03T16:30:00-04:00",
        decision: "approve",
        note: "The work meets the assignment requirements.",
      },
    );

    expect(approved.lifecycle).toBe("approved");
    expect(approved.evidence[0]).toMatchObject({
      revision: 1,
      status: "approved",
      review: {
        decision: "approve",
        parentRef: parentActor.actorRef,
        reviewedEvidenceRevision: 0,
      },
    });
    expect(externalAssignmentCompletionGate(approved)).toEqual({
      allowed: true,
      reasons: [],
    });

    const completed = markExternalAssignmentComplete(
      approved,
      parentActor,
      "2026-08-03T17:00:00-04:00",
    );
    expect(completed).toMatchObject({
      lifecycle: "completed",
      completedAt: "2026-08-03T17:00:00-04:00",
    });
    expect(validateExternalAssignmentRecord(completed).ok).toBe(true);
  });

  it("requires the configured parent approval capability", () => {
    const submitted = submitCompletionEvidence(
      makeScheduledAssignment(),
      makeEvidenceInput(),
    );

    expect(() =>
      reviewCompletionEvidence(
        submitted,
        "evidence-submission-001",
        {
          reviewedBy: parentWithoutApprovalActor,
          decidedAt: "2026-08-03T16:30:00-04:00",
          decision: "approve",
        },
      ),
    ).toThrowError(expect.objectContaining({ code: "permission_denied" }));
  });

  it("requires a reason when a parent returns evidence", () => {
    const submitted = submitCompletionEvidence(
      makeScheduledAssignment(),
      makeEvidenceInput(),
    );

    expect(() =>
      reviewCompletionEvidence(
        submitted,
        "evidence-submission-001",
        {
          reviewedBy: parentActor,
          decidedAt: "2026-08-03T16:30:00-04:00",
          decision: "return",
        },
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_input",
        path: "note",
      }),
    );
  });

  it("rejects credential material in evidence and parent-review notes", () => {
    const scheduled = makeScheduledAssignment();
    expect(() =>
      submitCompletionEvidence(
        scheduled,
        makeEvidenceInput({ note: "School password: do-not-store" }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "credential_material",
      }),
    );

    const submitted = submitCompletionEvidence(
      scheduled,
      makeEvidenceInput(),
    );
    expect(() =>
      reviewCompletionEvidence(
        submitted,
        "evidence-submission-001",
        {
          reviewedBy: parentActor,
          decidedAt: "2026-08-03T16:30:00-04:00",
          decision: "return",
          note: "Password: do-not-store",
        },
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "credential_material",
        path: "note",
      }),
    );
  });

  it("supports return, corrected resubmission, approval, and completion", () => {
    const firstSubmission = submitCompletionEvidence(
      makeScheduledAssignment(),
      makeEvidenceInput(),
    );
    const returned = reviewCompletionEvidence(
      firstSubmission,
      "evidence-submission-001",
      {
        reviewedBy: parentActor,
        decidedAt: "2026-08-03T16:30:00-04:00",
        decision: "return",
        note: "Please include the labeled second page.",
      },
    );

    expect(returned.lifecycle).toBe("evidence_returned");
    expect(externalAssignmentCompletionGate(returned)).toMatchObject({
      allowed: false,
      reasons: expect.arrayContaining([
        "evidence_returned",
        "evidence_missing",
        "parent_approval_missing",
      ]),
    });

    const resubmitted = submitCompletionEvidence(
      returned,
      makeEvidenceInput({
        evidenceId: "evidence-submission-002",
        submittedAt: "2026-08-03T16:45:00-04:00",
        attachments: [
          makeEvidenceAttachment({
            attachmentId: "corrected-evidence-attachment",
          }),
        ],
        note: "Added the labeled second page.",
      }),
    );
    const approved = reviewCompletionEvidence(
      resubmitted,
      "evidence-submission-002",
      {
        reviewedBy: parentActor,
        decidedAt: "2026-08-03T16:55:00-04:00",
        decision: "approve",
      },
    );
    const completed = markExternalAssignmentComplete(
      approved,
      parentActor,
      "2026-08-03T17:00:00-04:00",
    );

    expect(completed.evidence.map((entry) => entry.status)).toEqual([
      "returned",
      "approved",
    ]);
    expect(completed.lifecycle).toBe("completed");
  });

  it("does not require a separate review when the configured policy does not require parent approval", () => {
    const requirement = {
      ...defaultEvidenceRequirement,
      parentApprovalRequired: false,
    };
    const submitted = submitCompletionEvidence(
      makeScheduledAssignment({}, requirement),
      makeEvidenceInput(),
    );

    expect(submitted.lifecycle).toBe("approved");
    expect(submitted.evidence[0].status).toBe("approved");
    expect(
      markExternalAssignmentComplete(
        submitted,
        parentActor,
        "2026-08-03T17:00:00-04:00",
      ).lifecycle,
    ).toBe("completed");
  });

  it("permits completion after scheduling when evidence is explicitly not required", () => {
    const assignment = makeScheduledAssignment(
      {},
      {
        required: false,
        minimumAttachmentCount: 0,
        acceptedMediaTypes: [],
        noteRequired: false,
        parentApprovalRequired: false,
      },
    );

    expect(externalAssignmentCompletionGate(assignment)).toEqual({
      allowed: true,
      reasons: [],
    });
    expect(
      markExternalAssignmentComplete(
        assignment,
        parentActor,
        "2026-08-03T17:00:00-04:00",
      ).lifecycle,
    ).toBe("completed");
  });

  it("rejects duplicate evidence submission identifiers", () => {
    const submitted = submitCompletionEvidence(
      makeScheduledAssignment(),
      makeEvidenceInput(),
    );
    const returned = reviewCompletionEvidence(
      submitted,
      "evidence-submission-001",
      {
        reviewedBy: parentActor,
        decidedAt: "2026-08-03T16:30:00-04:00",
        decision: "return",
        note: "Please retry.",
      },
    );

    expect(() =>
      submitCompletionEvidence(returned, makeEvidenceInput()),
    ).toThrowError(
      expect.objectContaining({
        code: "identity_conflict",
        path: "evidenceId",
      }),
    );
  });

  it("rejects a forged completed record that does not satisfy evidence policy", () => {
    const forged = {
      ...makeScheduledAssignment(),
      lifecycle: "completed",
      completedAt: "2026-08-03T17:00:00-04:00",
    };

    const result = validateExternalAssignmentRecord(forged);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "$.lifecycle",
          code: "invariant",
        }),
      );
    }
  });

  it("does not let a student mark an otherwise approvable assignment complete", () => {
    const requirement = {
      required: false,
      minimumAttachmentCount: 0,
      acceptedMediaTypes: [],
      noteRequired: false,
      parentApprovalRequired: false,
    } as const;
    const assignment = makeScheduledAssignment({}, requirement);

    expect(() =>
      markExternalAssignmentComplete(
        assignment,
        studentActor,
        "2026-08-03T17:00:00-04:00",
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "permission_denied",
        path: "permission.mark_complete",
      }),
    );
  });
});
