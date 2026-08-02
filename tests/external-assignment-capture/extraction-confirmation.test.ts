import { describe, expect, it } from "vitest";
import {
  EXTERNAL_ASSIGNMENT_FIELDS,
  type ConfirmationInput,
  type FieldConfirmationDecisions,
} from "../../external-learning/capture/types.js";
import { confirmExtractionProposal } from "../../external-learning/capture/confirmation.js";
import {
  createManualExtractionProposal,
  extractDocumentAssignmentProposal,
} from "../../external-learning/capture/extraction.js";
import { validateExtractionResult } from "../../external-learning/capture/validation.js";
import {
  LEARNER_REF,
  acceptAllDecisions,
  makeAttachment,
  makeConfirmationInput,
  makeDocumentIntake,
  makeExtraction,
  makeManualIntake,
  parentActor,
} from "./fixtures.js";

describe("manual and document assignment extraction", () => {
  it("turns manual values into proposals that still require explicit review", () => {
    const result = createManualExtractionProposal(makeManualIntake());

    expect(result.sourceKind).toBe("manual");
    expect(result.status).toBe("proposal_ready");
    expect(result.requiresFieldByFieldConfirmation).toBe(true);
    expect(result).not.toHaveProperty("assignmentId");
    expect(result).not.toHaveProperty("lifecycle");
    for (const field of EXTERNAL_ASSIGNMENT_FIELDS) {
      expect(result.fields[field]).toMatchObject({
        status: "proposed",
        confidence: 1,
      });
      expect(result.fields[field].evidence).toEqual([
        expect.objectContaining({
          method: "manual_entry",
          sourceLabel: "Manual entry by parent",
        }),
      ]);
    }
  });

  it("extracts a provider-neutral document proposal with per-field confidence and evidence", () => {
    const result = extractDocumentAssignmentProposal(makeDocumentIntake());

    expect(result.status).toBe("proposal_ready");
    expect(result.fields.title).toMatchObject({
      status: "proposed",
      value: "Plate Tectonics Lab",
    });
    expect(result.fields.due).toMatchObject({
      status: "proposed",
      value: {
        kind: "local_date_time",
        localDate: "2026-08-03",
        localTime: "15:30",
        timeZone: "America/New_York",
      },
    });
    expect(result.fields.instructions).toMatchObject({
      status: "proposed",
      value: {
        format: "plain_text",
        text: expect.stringContaining("Label each plate boundary."),
      },
    });
    expect(result.fields.rubric.status).toBe("proposed");
    expect(result.fields.estimatedDurationMinutes.value).toBe(45);
    expect(result.fields.sourceUrl.value).toBe(
      "https://school.example/assignments/RVA-ES-204",
    );

    for (const field of EXTERNAL_ASSIGNMENT_FIELDS) {
      const proposal = result.fields[field];
      expect(proposal.confidence).toBeGreaterThanOrEqual(0);
      expect(proposal.confidence).toBeLessThanOrEqual(1);
      if (proposal.status === "proposed") {
        expect(proposal.evidence.length).toBeGreaterThan(0);
        expect(proposal.evidence[0]).toMatchObject({
          attachmentId: "attachment-001",
          method: "ocr",
          sourceLabel: "romeo-assignment.png",
          excerpt: expect.any(String),
        });
      }
    }
    expect(result.warnings.join(" ")).toContain(
      "proposals until every field is confirmed",
    );
    expect(validateExtractionResult(result).ok).toBe(true);
  });

  it("does not silently invent a due time for a date-only source", () => {
    const intake = makeDocumentIntake({
      content: {
        state: "available",
        method: "embedded_document_text",
        text: [
          "Title: Read chapter 4",
          "Course: Literature",
          "Assignment ID: LIT-4",
          "Due: 2026-11-01",
        ].join("\n"),
      },
    });

    const result = extractDocumentAssignmentProposal(intake);

    expect(result.fields.due.value).toEqual({
      kind: "date",
      localDate: "2026-11-01",
      timeZone: "America/New_York",
    });
  });

  it("uses a missing-file fallback without fabricating assignment fields", () => {
    const result = extractDocumentAssignmentProposal(
      makeDocumentIntake({
        attachment: makeAttachment({ availability: "missing" }),
        content: {
          state: "missing",
          diagnostic: "Object was removed from temporary storage.",
        },
      }),
    );

    expect(result).toMatchObject({
      status: "manual_entry_required",
      overallConfidence: 0,
      fallback: {
        required: true,
        reason: "missing_file",
        nextStep: "manual_entry",
      },
    });
    for (const field of EXTERNAL_ASSIGNMENT_FIELDS) {
      expect(result.fields[field]).toMatchObject({
        status: "missing",
        confidence: 0,
        evidence: [],
      });
    }
  });

  it("marks every field unreadable and retains source identity for an unreadable image", () => {
    const result = extractDocumentAssignmentProposal(
      makeDocumentIntake({
        attachment: makeAttachment({ availability: "unreadable" }),
        content: {
          state: "unreadable",
          diagnostic: "Image has no usable contrast.",
        },
      }),
    );

    expect(result.fallback.reason).toBe("unreadable_image");
    for (const field of EXTERNAL_ASSIGNMENT_FIELDS) {
      expect(result.fields[field].status).toBe("unreadable");
      expect(result.fields[field].evidence).toEqual([
        expect.objectContaining({
          attachmentId: "attachment-001",
          sourceLabel: "romeo-assignment.png",
        }),
      ]);
    }
  });

  it.each([
    [
      "unsupported",
      "unsupported" as const,
      "unsupported_media",
    ],
    [
      "extractor unavailable",
      "extractor_unavailable" as const,
      "extractor_unavailable",
    ],
  ])(
    "offers manual entry when the input is %s",
    (_label, state, expectedReason) => {
      const attachment =
        state === "unsupported"
          ? makeAttachment({ availability: "unsupported" })
          : makeAttachment();
      const result = extractDocumentAssignmentProposal(
        makeDocumentIntake({
          attachment,
          content: { state },
        }),
      );

      expect(result.status).toBe("manual_entry_required");
      expect(result.fallback).toMatchObject({
        required: true,
        reason: expectedReason,
        nextStep: "manual_entry",
      });
    },
  );

  it("falls back to manual entry when no assignment fields can be found", () => {
    const result = extractDocumentAssignmentProposal(
      makeDocumentIntake({
        content: {
          state: "available",
          method: "ocr",
          text: " \n \t ",
        },
      }),
    );

    expect(result).toMatchObject({
      status: "manual_entry_required",
      fallback: {
        reason: "no_assignment_fields_found",
        nextStep: "manual_entry",
      },
    });
  });
});

describe("mandatory field-by-field confirmation", () => {
  it("refuses to persist when even one field decision is omitted", () => {
    const input = makeConfirmationInput() as unknown as {
      decisions: Record<string, unknown>;
    };
    delete input.decisions.rubric;

    expect(() =>
      confirmExtractionProposal(
        makeExtraction(),
        input as unknown as ConfirmationInput,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "confirmation_incomplete",
        path: "decisions",
      }),
    );
  });

  it("refuses to accept a missing proposal", () => {
    const extraction = createManualExtractionProposal(
      makeManualIntake({
        values: {
          title: "Manual fallback assignment",
          course: { displayName: "General Studies" },
          originalAssignmentReference: "MANUAL-001",
        },
      }),
    );
    const decisions: FieldConfirmationDecisions = {
      ...acceptAllDecisions(),
      section: { decision: "accept", field: "section" },
      due: { decision: "clear", field: "due" },
      instructions: { decision: "clear", field: "instructions" },
      rubric: { decision: "clear", field: "rubric" },
      estimatedDurationMinutes: {
        decision: "clear",
        field: "estimatedDurationMinutes",
      },
      sourceUrl: { decision: "clear", field: "sourceUrl" },
    };

    expect(() =>
      confirmExtractionProposal(
        extraction,
        makeConfirmationInput({ decisions }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "confirmation_incomplete",
        path: "decisions.section",
      }),
    );
  });

  it("allows explicit edits for missing required fields and explicit clears for optional fields", () => {
    const extraction = createManualExtractionProposal(
      makeManualIntake({
        captureId: "capture-empty-manual",
        values: {},
      }),
    );
    const decisions: FieldConfirmationDecisions = {
      title: {
        decision: "edit",
        field: "title",
        value: "Hand-entered assignment",
      },
      course: {
        decision: "edit",
        field: "course",
        value: { displayName: "General Studies" },
      },
      section: { decision: "clear", field: "section" },
      originalAssignmentReference: {
        decision: "edit",
        field: "originalAssignmentReference",
        value: "MANUAL-FALLBACK-001",
      },
      due: { decision: "clear", field: "due" },
      instructions: { decision: "clear", field: "instructions" },
      rubric: { decision: "clear", field: "rubric" },
      estimatedDurationMinutes: {
        decision: "clear",
        field: "estimatedDurationMinutes",
      },
      sourceUrl: { decision: "clear", field: "sourceUrl" },
    };

    const assignment = confirmExtractionProposal(
      extraction,
      makeConfirmationInput({ decisions }),
    );

    expect(assignment).toMatchObject({
      learnerRef: LEARNER_REF,
      title: "Hand-entered assignment",
      originalAssignmentReference: "MANUAL-FALLBACK-001",
      lifecycle: "confirmed",
      confirmation: {
        allFieldsReviewed: true,
      },
    });
    expect(assignment.provider.providerId).toBe(
      extraction.provider.providerId,
    );
    expect(assignment).not.toHaveProperty("due");
    expect(assignment).not.toHaveProperty("externalSection");
  });

  it("preserves proposal confidence and source evidence in the confirmation audit", () => {
    const extraction = makeExtraction();

    const assignment = confirmExtractionProposal(
      extraction,
      makeConfirmationInput(),
    );

    for (const field of EXTERNAL_ASSIGNMENT_FIELDS) {
      expect(assignment.confirmation.fields[field]).toMatchObject({
        field,
        decision: "accept",
        proposalConfidence: extraction.fields[field].confidence,
        proposalEvidence: extraction.fields[field].evidence,
        reviewedBy: {
          actorRef: parentActor.actorRef,
          role: "parent",
        },
      });
    }
  });

  it("rejects a required field being explicitly cleared", () => {
    const decisions: FieldConfirmationDecisions = {
      ...acceptAllDecisions(),
      originalAssignmentReference: {
        decision: "clear",
        field: "originalAssignmentReference",
      },
    };

    expect(() =>
      confirmExtractionProposal(
        makeExtraction(),
        makeConfirmationInput({ decisions }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "required_field_missing",
        path: "decisions.originalAssignmentReference",
      }),
    );
  });
});
