import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROMEO_VIRTUAL_ACADEMY_PROVIDER } from "../../external-learning/capture/adapters.js";
import { ExternalAssignmentCapture } from "../../app/features/external-assignment-capture/ExternalAssignmentCapture.js";
import {
  PROPOSAL_FIELD_ORDER,
  duplicateFixture,
  evidenceFixture,
  evidenceReviewFixture,
  makeExtractedFixture,
  makeManualFixture,
} from "../../app/features/external-assignment-capture/fixtures.js";

describe("parent/student confirmation UI contract", () => {
  it("starts every extracted field unconfirmed with confidence and visible source evidence", () => {
    const proposal = makeExtractedFixture(
      new File(["fixture"], "romeo-directions.pdf", {
        type: "application/pdf",
      }),
      "student",
      "America/New_York",
    );

    expect(proposal.providerId).toBe(
      ROMEO_VIRTUAL_ACADEMY_PROVIDER.providerId,
    );
    expect(proposal.providerKind).toBe("provisional-adapter");
    expect(proposal.originalProviderIdentity).toBe("Romeo Virtual Academy");
    expect(proposal.fields.map((field) => field.key)).toEqual(
      PROPOSAL_FIELD_ORDER,
    );
    for (const field of proposal.fields) {
      expect(field.confirmed).toBe(false);
      expect(field.confidence).not.toBeNull();
      expect(field.confidence).toBeGreaterThanOrEqual(0);
      expect(field.confidence).toBeLessThanOrEqual(1);
      expect(field.sourceEvidence.length).toBeGreaterThan(0);
      expect(field.sourceEvidence[0]?.excerpt.length).toBeGreaterThan(0);
    }
    expect(proposal.sourceAttachments[0]).toMatchObject({
      fileName: "romeo-directions.pdf",
      mediaType: "application/pdf",
      storageStatus: "browser-only",
    });
  });

  it("treats manual values as human-entered but still unconfirmed", () => {
    const proposal = makeManualFixture(
      "parent",
      "America/New_York",
      "romeo",
    );

    expect(proposal.providerId).toBe(
      ROMEO_VIRTUAL_ACADEMY_PROVIDER.providerId,
    );
    expect(proposal.extractionStatus).toBe("manual");
    expect(proposal.sourceAttachments).toEqual([]);
    for (const field of proposal.fields) {
      expect(field.confirmed).toBe(false);
      expect(field.confidence).toBeNull();
      expect(field.sourceEvidence).toEqual([
        expect.objectContaining({
          kind: "manual-entry",
          excerpt: expect.stringContaining("entered directly by the parent"),
        }),
      ]);
    }
  });

  it("keeps the non-Romeo manual path provider-neutral", () => {
    const proposal = makeManualFixture(
      "student",
      "America/Chicago",
      "other",
    );

    expect(proposal.providerId).not.toBe(
      ROMEO_VIRTUAL_ACADEMY_PROVIDER.providerId,
    );
    expect(proposal.providerKind).toBe("manual");
    expect(proposal.createdByRole).toBe("student");
  });

  it("models exact duplicates, provider updates, and conflicts as decisions rather than automatic overwrites", () => {
    const proposal = makeExtractedFixture(
      new File(["fixture"], "assignment.pdf", {
        type: "application/pdf",
      }),
      "parent",
      "America/New_York",
    );

    expect(duplicateFixture("exact", proposal).kind).toBe("exact-duplicate");
    expect(duplicateFixture("provider-update", proposal)).toMatchObject({
      kind: "provider-update",
      existingAssignmentId: expect.any(String),
      changedFields: [
        expect.objectContaining({
          field: "dueDate",
          existingValue: expect.any(String),
          proposedValue: expect.any(String),
        }),
      ],
    });
    expect(duplicateFixture("conflict", proposal)).toMatchObject({
      kind: "conflict",
      conflicts: expect.arrayContaining([
        expect.objectContaining({ field: "dueDate" }),
        expect.objectContaining({ field: "instructions" }),
      ]),
    });
  });

  it("keeps submitted evidence awaiting a parent and distinguishes approve from return", () => {
    const submission = evidenceFixture();

    expect(submission.status).toBe("awaiting-parent");
    expect(
      evidenceReviewFixture({
        assignmentId: "assignment-001",
        evidenceId: submission.evidenceId,
        reviewerRole: "parent",
        reviewedAt: "2026-08-03T16:30:00-04:00",
        result: { decision: "approve" },
      }).assignmentStatus,
    ).toBe("complete");
    expect(
      evidenceReviewFixture({
        assignmentId: "assignment-001",
        evidenceId: submission.evidenceId,
        reviewerRole: "parent",
        reviewedAt: "2026-08-03T16:30:00-04:00",
        result: {
          decision: "return",
          reason: "Please attach the labeled second page.",
        },
      }).assignmentStatus,
    ).toBe("evidence-returned");
  });

  it("renders explicit privacy and access-control guardrails without a password field", () => {
    const markup = renderToStaticMarkup(
      createElement(ExternalAssignmentCapture, {
        initialRole: "parent",
        studentDisplayName: "Test learner",
      }),
    );
    const normalized = markup.toLocaleLowerCase("en-US");

    expect(normalized).toContain(
      "never ask for or store a student’s external-school password",
    );
    expect(normalized).toContain("does not bypass school access controls");
    expect(normalized).toContain(
      "does not claim direct romeo synchronization",
    );
    expect(normalized).not.toContain('type="password"');
  });
});
