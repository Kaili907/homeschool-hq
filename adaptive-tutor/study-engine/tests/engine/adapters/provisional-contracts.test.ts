import { describe, expect, it } from "vitest";
import {
  adaptProvisionalSessionContext,
  adaptTutorCoreOutcome,
  mapProvisionalGradeBandToFocus,
  PROVISIONAL_CONTRACT_VERSIONS,
} from "../../../engine/adapters/index.js";

const sessionContext = {
  schemaVersion: PROVISIONAL_CONTRACT_VERSIONS.sessionContext,
  sessionRef: "session-001",
  gradeBand: "middle",
  subjectKey: "math",
  taskTypeKey: "retrieval",
  timeZone: "America/New_York",
} as const;

describe("provisional contract adapters", () => {
  it("allowlists only privacy-minimal session fields", () => {
    const result = adaptProvisionalSessionContext({
      ...sessionContext,
      studentName: "Private Student",
      email: "private@example.com",
      diagnosis: "sensitive",
      transcript: "raw learning conversation",
    });

    expect(result).toEqual({ ok: true, value: sessionContext });
    expect(JSON.stringify(result)).not.toMatch(
      /Private Student|private@example|sensitive|raw learning conversation/,
    );
  });

  it.each([
    [{ ...sessionContext, schemaVersion: "future.v9" }, "unsupported_version"],
    [{ ...sessionContext, gradeBand: "college" }, "invalid_field"],
    [{ ...sessionContext, subjectKey: "math homework for Jane" }, "invalid_field"],
    [{ ...sessionContext, timeZone: "Not/A_Zone" }, "invalid_field"],
    [null, "invalid_shape"],
  ] as const)("rejects an incompatible context", (source, code) => {
    expect(adaptProvisionalSessionContext(source)).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code }),
      }),
    );
  });

  it("maps an authoritative tutor-core directive to an orchestrator event", () => {
    const result = adaptTutorCoreOutcome(
      {
        schemaVersion: PROVISIONAL_CONTRACT_VERSIONS.tutorCoreOutcome,
        sessionRef: "session-001",
        occurredAt: "2026-07-28T14:00:00-04:00",
        instructionDirective: "reteach",
        misconceptionDetails: "not forwarded",
      },
      "session-001",
    );

    expect(result).toEqual({
      ok: true,
      value: {
        type: "confidence_check_completed",
        at: "2026-07-28T14:00:00-04:00",
        coreDirective: "reteach",
      },
    });
    expect(JSON.stringify(result)).not.toContain("misconceptionDetails");
  });

  it("rejects cross-session, unzoned, and non-core directives", () => {
    const base = {
      schemaVersion: PROVISIONAL_CONTRACT_VERSIONS.tutorCoreOutcome,
      sessionRef: "session-001",
      occurredAt: "2026-07-28T14:00:00-04:00",
      instructionDirective: "correct",
    };

    expect(adaptTutorCoreOutcome(base, "session-002")).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "session_mismatch" }),
      }),
    );
    expect(
      adaptTutorCoreOutcome(
        { ...base, occurredAt: "2026-07-28T14:00:00" },
        "session-001",
      ),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "invalid_field" }),
      }),
    );
    expect(
      adaptTutorCoreOutcome(
        { ...base, occurredAt: "2026-02-31T14:00:00-04:00" },
        "session-001",
      ),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "invalid_field" }),
      }),
    );
    expect(
      adaptTutorCoreOutcome(
        { ...base, instructionDirective: "mastered" },
        "session-001",
      ),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "invalid_field" }),
      }),
    );
  });

  it("returns fixed errors that do not echo rejected source data", () => {
    const secret = "student-secret@example.com";
    const result = adaptProvisionalSessionContext({
      ...sessionContext,
      schemaVersion: secret,
    });

    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it.each([
    ["elementary", "elementary"],
    ["middle", "middle_school"],
    ["high", "high_school"],
  ] as const)("maps provisional grade band %s to focus band %s", (from, to) => {
    expect(mapProvisionalGradeBandToFocus(from)).toBe(to);
  });
});
