import { describe, expect, it } from "vitest";
import {
  confirmProviderAssignmentUpdate,
  detectExternalAssignmentDuplicate,
  externalAssignmentDedupeKey,
  reconcileProviderAssignmentUpdate,
} from "../../external-learning/capture/identity.js";
import { assessScheduleAgainstDue } from "../../external-learning/capture/lifecycle.js";
import {
  LEARNER_REF,
  OTHER_LEARNER_REF,
  makeConfirmedAssignment,
  makeProviderUpdate,
  parentActor,
  providerActor,
} from "./fixtures.js";

describe("duplicate detection", () => {
  it("uses provider plus original source reference as the exact identity", () => {
    const assignment = makeConfirmedAssignment();

    expect(detectExternalAssignmentDuplicate(assignment, [assignment])).toEqual({
      kind: "exact",
      existingAssignmentId: assignment.assignmentId,
      dedupeKey: externalAssignmentDedupeKey(
        assignment.provider.providerId,
        assignment.originalAssignmentReference,
      ),
    });
  });

  it("scopes exact identity to the learner", () => {
    const existing = makeConfirmedAssignment();
    const candidate = {
      ...existing,
      learnerRef: OTHER_LEARNER_REF,
    };

    expect(detectExternalAssignmentDuplicate(candidate, [existing])).toEqual({
      kind: "none",
      dedupeKey: externalAssignmentDedupeKey(
        candidate.provider.providerId,
        candidate.originalAssignmentReference,
      ),
    });
  });

  it("flags a possible duplicate when labels and due date match but the provider reference differs", () => {
    const existing = makeConfirmedAssignment();
    const candidate = {
      ...existing,
      assignmentId: "assignment-new",
      originalAssignmentReference: "RVA-ES-204-COPY",
      title: "  PLATE—TECTONICS   LAB ",
      externalCourse: {
        ...existing.externalCourse,
        displayName: "earth science",
      },
    };

    const result = detectExternalAssignmentDuplicate(candidate, [existing]);

    expect(result).toMatchObject({
      kind: "possible",
      existingAssignmentIds: [existing.assignmentId],
      reasons: expect.arrayContaining([
        expect.stringContaining("Provider reference differs"),
      ]),
    });
  });

  it("does not collapse assignments from different providers", () => {
    const existing = makeConfirmedAssignment();
    const candidate = {
      ...existing,
      provider: {
        ...existing.provider,
        providerId: "another_external_school",
        displayName: "Another external school",
      },
      originalAssignmentReference: "OTHER-204",
    };

    expect(detectExternalAssignmentDuplicate(candidate, [existing]).kind).toBe(
      "none",
    );
  });
});

describe("provider update reconciliation", () => {
  it("reports no change and advances sync metadata without changing confirmed values", () => {
    const assignment = makeConfirmedAssignment();
    const update = makeProviderUpdate({
      proposedFields: { title: assignment.title },
    });

    const result = reconcileProviderAssignmentUpdate(
      assignment,
      update,
      providerActor,
    );

    expect(result.status).toBe("no_change");
    expect(result.assignment.title).toBe(assignment.title);
    expect(result.assignment.providerSync).toMatchObject({
      state: "current",
      lastAttemptedAt: update.observedAt,
      lastSucceededAt: update.observedAt,
      providerRevision: update.providerRevision,
    });
  });

  it("turns changes to confirmed values into visible conflicts without overwriting", () => {
    const assignment = makeConfirmedAssignment();
    const update = makeProviderUpdate({
      proposedFields: {
        title: "Provider revised title",
        due: {
          kind: "date",
          localDate: "2026-08-04",
          timeZone: "America/New_York",
        },
      },
    });

    const result = reconcileProviderAssignmentUpdate(
      assignment,
      update,
      providerActor,
    );

    expect(result.status).toBe("conflict");
    expect(result.assignment.title).toBe(assignment.title);
    expect(result.assignment.due).toEqual(assignment.due);
    expect(result.assignment.providerSync.state).toBe("conflict");
    if (result.status === "conflict") {
      expect(result.conflicts).toEqual([
        expect.objectContaining({
          field: "title",
          currentValue: assignment.title,
          incomingValue: "Provider revised title",
          status: "requires_confirmation",
        }),
        expect.objectContaining({
          field: "due",
          currentValue: assignment.due,
          incomingValue: update.proposedFields.due,
          status: "requires_confirmation",
        }),
      ]);
    }
  });

  it("creates a proposal, not an automatic mutation, for a newly supplied optional value", () => {
    const assignment = makeConfirmedAssignment({
      externalSection: undefined,
    });
    const update = makeProviderUpdate({
      proposedFields: {
        section: {
          displayName: "New provider section",
          externalSectionRef: "new-section",
        },
      },
    });

    const result = reconcileProviderAssignmentUpdate(
      assignment,
      update,
      providerActor,
    );

    expect(result.status).toBe("proposal_ready");
    expect(result.assignment.externalSection).toBeUndefined();
    expect(result.assignment.providerSync.state).toBe("pending");
  });

  it("rejects stale provider observations and never rolls record time backward", () => {
    const assignment = makeConfirmedAssignment();
    const stale = makeProviderUpdate({
      observedAt: "2026-07-28T14:14:59-04:00",
    });

    expect(() =>
      reconcileProviderAssignmentUpdate(
        assignment,
        stale,
        providerActor,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_state",
        path: "observedAt",
      }),
    );
    expect(assignment.updatedAt).toBe("2026-07-28T14:15:00-04:00");
  });

  it("rejects a provider or original-reference mismatch", () => {
    const assignment = makeConfirmedAssignment();

    expect(() =>
      reconcileProviderAssignmentUpdate(
        assignment,
        makeProviderUpdate({ providerId: "other-provider" }),
        providerActor,
      ),
    ).toThrowError(expect.objectContaining({ code: "provider_mismatch" }));

    expect(() =>
      reconcileProviderAssignmentUpdate(
        assignment,
        makeProviderUpdate({
          originalAssignmentReference: "DIFFERENT-REFERENCE",
        }),
        providerActor,
      ),
    ).toThrowError(expect.objectContaining({ code: "identity_conflict" }));
  });

  it("forbids changing original provider identity through proposed fields", () => {
    expect(() =>
      reconcileProviderAssignmentUpdate(
        makeConfirmedAssignment(),
        makeProviderUpdate({
          proposedFields: {
            originalAssignmentReference: "DIFFERENT-REFERENCE",
          },
        }),
        providerActor,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "identity_conflict",
        path: "proposedFields.originalAssignmentReference",
      }),
    );
  });

  it("requires a human decision for every changed provider field", () => {
    const assignment = makeConfirmedAssignment();
    const update = makeProviderUpdate({
      proposedFields: {
        title: "Provider revised title",
        estimatedDurationMinutes: 60,
      },
    });

    expect(() =>
      confirmProviderAssignmentUpdate(assignment, update, {
        reviewedBy: parentActor,
        reviewedAt: "2026-07-29T10:00:00-04:00",
        decisions: {
          title: "accept_update",
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "confirmation_incomplete",
        path: "decisions.estimatedDurationMinutes",
      }),
    );
  });

  it("applies accepted update fields and retains explicitly protected fields", () => {
    const assignment = makeConfirmedAssignment();
    const update = makeProviderUpdate({
      proposedFields: {
        title: "Provider revised title",
        estimatedDurationMinutes: 60,
      },
    });

    const result = confirmProviderAssignmentUpdate(assignment, update, {
      reviewedBy: parentActor,
      reviewedAt: "2026-07-29T10:00:00-04:00",
      decisions: {
        title: "accept_update",
        estimatedDurationMinutes: "keep_confirmed",
      },
    });

    expect(result.assignment.title).toBe("Provider revised title");
    expect(result.assignment.estimatedDurationMinutes).toBe(45);
    expect(result.acceptedFields).toEqual(["title"]);
    expect(result.retainedFields).toEqual(["estimatedDurationMinutes"]);
    expect(result.assignment.originalAssignmentReference).toBe(
      assignment.originalAssignmentReference,
    );
    expect(result.assignment.providerSync.state).toBe("current");
  });

  it("rejects a review timestamp older than the provider observation", () => {
    const assignment = makeConfirmedAssignment();
    const update = makeProviderUpdate();

    expect(() =>
      confirmProviderAssignmentUpdate(assignment, update, {
        reviewedBy: parentActor,
        reviewedAt: "2026-07-29T08:59:59-04:00",
        decisions: { title: "accept_update" },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "invalid_state",
        path: "reviewedAt",
      }),
    );
  });
});

describe("time-zone, daylight-saving, and date-only behavior", () => {
  it("treats a date-only due value as the full local calendar day", () => {
    const due = {
      kind: "date",
      localDate: "2026-03-08",
      timeZone: "America/New_York",
    } as const;

    expect(
      assessScheduleAgainstDue("2026-03-09T03:59:00Z", due),
    ).toEqual({
      status: "on_or_before_due",
      dueKind: "date",
    });
    expect(
      assessScheduleAgainstDue("2026-03-09T04:00:00Z", due),
    ).toEqual({
      status: "after_due",
      dueKind: "date",
    });
  });

  it("compares local wall time correctly across the spring-forward boundary", () => {
    const due = {
      kind: "local_date_time",
      localDate: "2026-03-08",
      localTime: "03:00",
      timeZone: "America/New_York",
    } as const;

    expect(
      assessScheduleAgainstDue("2026-03-08T06:59:00Z", due).status,
    ).toBe("on_or_before_due");
    expect(
      assessScheduleAgainstDue("2026-03-08T07:01:00Z", due).status,
    ).toBe("after_due");
  });

  it("compares local wall time through the repeated fall-back hour", () => {
    const due = {
      kind: "local_date_time",
      localDate: "2026-11-01",
      localTime: "01:30",
      timeZone: "America/New_York",
    } as const;

    expect(
      assessScheduleAgainstDue("2026-11-01T05:15:00Z", due).status,
    ).toBe("on_or_before_due");
    expect(
      assessScheduleAgainstDue("2026-11-01T06:45:00Z", due).status,
    ).toBe("after_due");
  });

  it("compares instant due values by absolute time", () => {
    const due = {
      kind: "instant",
      dueAt: "2026-08-03T19:30:00Z",
      timeZone: "America/New_York",
    } as const;

    expect(
      assessScheduleAgainstDue("2026-08-03T15:30:00-04:00", due).status,
    ).toBe("on_or_before_due");
    expect(
      assessScheduleAgainstDue("2026-08-03T19:30:01Z", due).status,
    ).toBe("after_due");
  });

  it("reports no due date without manufacturing one", () => {
    expect(
      assessScheduleAgainstDue("2026-08-03T13:00:00-04:00", undefined),
    ).toEqual({ status: "no_due_date" });
  });
});
