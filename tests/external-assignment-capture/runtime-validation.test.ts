import { describe, expect, it } from "vitest";
import { EXTERNAL_ASSIGNMENT_FIELDS } from "../../external-learning/capture/types.js";
import {
  assertCalendarDate,
  assertCredentialFree,
  normalizeHttpsUrl,
  validateAttachmentMetadata,
  validateDueValue,
  validateExternalAssignmentRecord,
  validateExtractionResult,
} from "../../external-learning/capture/validation.js";
import {
  cloneJson,
  makeAttachment,
  makeConfirmedAssignment,
  makeExtraction,
} from "./fixtures.js";

describe("external capture runtime validation", () => {
  it("accepts representative extraction and confirmed assignment records", () => {
    const extraction = validateExtractionResult(makeExtraction());
    const assignment = validateExternalAssignmentRecord(
      makeConfirmedAssignment(),
    );

    expect(extraction.ok).toBe(true);
    expect(assignment.ok).toBe(true);
  });

  it("rejects an unsupported schema version", () => {
    const extraction = cloneJson(makeExtraction()) as unknown as Record<
      string,
      unknown
    >;
    extraction.schemaVersion = "external-assignment-capture.v999";

    const result = validateExtractionResult(extraction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "$.schemaVersion",
          code: "enum",
        }),
      );
    }
  });

  it("rejects confidence outside the closed 0..1 interval", () => {
    const extraction = cloneJson(makeExtraction()) as unknown as {
      overallConfidence: number;
      fields: Record<string, { confidence: number }>;
    };
    extraction.overallConfidence = 1.01;
    extraction.fields.title.confidence = -0.01;

    const result = validateExtractionResult(extraction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((entry) => entry.path)).toEqual(
        expect.arrayContaining([
          "$.overallConfidence",
          "$.fields.title.confidence",
        ]),
      );
    }
  });

  it("requires a proposal record for every assignment field", () => {
    const extraction = cloneJson(makeExtraction()) as unknown as {
      fields: Record<string, unknown>;
    };
    delete extraction.fields.rubric;

    const result = validateExtractionResult(extraction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "$.fields.rubric",
          code: "required",
        }),
      );
    }
  });

  it("requires source evidence on every proposed field", () => {
    const extraction = cloneJson(makeExtraction()) as unknown as {
      fields: {
        title: {
          evidence: unknown[];
        };
      };
    };
    extraction.fields.title.evidence = [];

    const result = validateExtractionResult(extraction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "$.fields.title.evidence",
          code: "required",
        }),
      );
    }
  });

  it("rejects an extraction that attempts to bypass confirmation", () => {
    const extraction = cloneJson(makeExtraction()) as unknown as Record<
      string,
      unknown
    >;
    extraction.requiresFieldByFieldConfirmation = false;

    const result = validateExtractionResult(extraction);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "$.requiresFieldByFieldConfirmation",
          code: "invariant",
        }),
      );
    }
  });

  it("rejects a forged persisted record without complete confirmation audit", () => {
    const assignment = cloneJson(makeConfirmedAssignment()) as unknown as {
      confirmation: {
        allFieldsReviewed: boolean;
        fields: Record<string, unknown>;
      };
    };
    assignment.confirmation.allFieldsReviewed = false;
    delete assignment.confirmation.fields.instructions;

    const result = validateExternalAssignmentRecord(assignment);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((entry) => entry.path)).toEqual(
        expect.arrayContaining([
          "$.confirmation.allFieldsReviewed",
          "$.confirmation.fields.instructions",
        ]),
      );
    }
  });

  it("validates attachment hashes, sizes, purposes, and upload actors", () => {
    const attachment = {
      ...makeAttachment(),
      sha256: "not-a-hash",
      byteSize: -1,
      purpose: "transcript",
      uploadedBy: {
        actorRef: "provider-actor",
        role: "provider_adapter",
      },
    };

    const result = validateAttachmentMetadata(attachment);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((entry) => entry.path)).toEqual(
        expect.arrayContaining([
          "$.sha256",
          "$.byteSize",
          "$.purpose",
          "$.uploadedBy.role",
        ]),
      );
    }
  });

  it.each([
    [
      {
        kind: "date",
        localDate: "2026-02-29",
        timeZone: "America/New_York",
      },
      "$.due.localDate",
    ],
    [
      {
        kind: "local_date_time",
        localDate: "2026-08-03",
        localTime: "25:00",
        timeZone: "America/New_York",
      },
      "$.due.localTime",
    ],
    [
      {
        kind: "date",
        localDate: "2026-08-03",
        timeZone: "Eastern Time",
      },
      "$.due.timeZone",
    ],
    [
      {
        kind: "instant",
        dueAt: "2026-08-03T15:30:00",
        timeZone: "America/New_York",
      },
      "$.due.dueAt",
    ],
  ])("rejects invalid due value %# at %s", (due, expectedPath) => {
    const result = validateDueValue(due);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.path).toBe(expectedPath);
    }
  });

  it("accepts leap day only in a leap year", () => {
    expect(() => assertCalendarDate("2028-02-29", "date")).not.toThrow();
    expect(() => assertCalendarDate("2026-02-29", "date")).toThrow();
  });

  it("rejects credential-shaped keys recursively and safely handles cycles", () => {
    const cyclic: Record<string, unknown> = { safe: "assignment" };
    cyclic.self = cyclic;

    expect(() => assertCredentialFree(cyclic)).not.toThrow();
    expect(() =>
      assertCredentialFree({
        assignment: {
          metadata: {
            refreshToken: "opaque-value",
          },
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "credential_material",
        path: "$.assignment.metadata.refreshToken",
      }),
    );
  });

  it.each([
    "http://school.example/assignment",
    "https://student:secret@school.example/assignment",
  ])("rejects an unsafe or credential-bearing URL: %s", (url) => {
    expect(() => normalizeHttpsUrl(url, "sourceUrl")).toThrow();
  });

  it.each([
    "https://school.example/assignment?token=secret",
    "https://school.example/assignment?api_key=secret",
    "https://school.example/assignment?password=secret",
  ])("rejects a credential-bearing query parameter: %s", (url) => {
    expect(() => normalizeHttpsUrl(url, "sourceUrl")).toThrowError(
      expect.objectContaining({ code: "credential_material" }),
    );
  });

  it("keeps the field list stable for schema consumers", () => {
    expect(EXTERNAL_ASSIGNMENT_FIELDS).toEqual([
      "title",
      "course",
      "section",
      "originalAssignmentReference",
      "due",
      "instructions",
      "rubric",
      "estimatedDurationMinutes",
      "sourceUrl",
    ]);
  });
});
