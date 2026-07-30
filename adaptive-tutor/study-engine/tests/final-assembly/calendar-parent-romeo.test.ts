import {
  createAutomaticContinuation,
  createCalendarBlock,
  resolveLearnerLocalStart,
} from "../../runtime/src/calendar.ts";
import * as parentPublic from "../../runtime/src/parent.ts";
import {
  applyParentControlAction,
  createParentRuntimeState,
  resolveParentDurationDecision,
} from "../../runtime/src/parent.ts";
import * as romeoPublic from "../../runtime/src/romeo.ts";
import { assertRomeoCredentialFree } from "../../runtime/src/romeo.ts";

describe("calendar, parent precedence, and Romeo boundaries", () => {
  function parentState() {
    return createParentRuntimeState({
      controlSetId: "controls:verified",
      studentRef: "student:verified",
      gradeBand: "elementary-3-5",
      privateRecordRef: "private:verified",
      at: "2026-07-30T09:00:00-04:00",
      gradeBandDefault: {
        maximumWorkDurationMinutes: 25,
        breakDurationMinutes: 5,
        timersHidden: false,
      },
      durationPolicyContext: {
        policyVersion: 1,
        integrityValid: true,
        actorAuthorized: true,
        currentMinutes: 25,
      },
    });
  }

  test("rejects an invalid household time zone", () => {
    expect(() =>
      resolveLearnerLocalStart("2026-07-30T09:00", "Not/A_Zone"),
    ).toThrow();
  });

  test("rejects a DST spring-forward gap", () => {
    expect(() =>
      resolveLearnerLocalStart(
        "2026-03-08T02:30",
        "America/New_York",
        "earlier",
      ),
    ).toThrow(/does not exist/i);
  });

  test("resolves a DST overlap explicitly and deterministically", () => {
    const earlier = resolveLearnerLocalStart(
      "2026-11-01T01:30",
      "America/New_York",
      "earlier",
    );
    const later = resolveLearnerLocalStart(
      "2026-11-01T01:30",
      "America/New_York",
      "later",
    );
    expect(earlier).toBe("2026-11-01T05:30:00.000Z");
    expect(later).toBe("2026-11-01T06:30:00.000Z");
  });

  test("rejects a malformed DST disambiguation enum", () => {
    expect(() =>
      resolveLearnerLocalStart(
        "2026-11-01T01:30",
        "America/New_York",
        "middle" as never,
      ),
    ).toThrow(/earlier or later/i);
  });

  test("public calendar creation rejects the provisional wall-time fallback", () => {
    expect(() =>
      createCalendarBlock({
        internalBlockId: "block:missing-offset",
        learnerRef: "learner:001",
        sourceIdentity: {
          source: "manuel_academy",
          externalItemId: "lesson:001",
        },
        title: "Math",
        subject: "Math",
        blockType: "guided_practice",
        householdTimeZone: "America/New_York",
        scheduledLocalStart: "2026-07-30T09:00",
        createdAt: "2026-07-29T20:00:00Z",
        segments: [],
      } as never),
    ).toThrow(/explicit offset-bearing/i);
  });

  test("public continuation rejects missing explicit placement", () => {
    expect(() =>
      createAutomaticContinuation([], {
        originalInternalBlockId: "block:source",
        continuationInternalBlockId: "block:continuation",
        continuationKey: "2026-07-31-am",
        scheduledLocalStart: "2026-07-31T09:00",
        at: "2026-07-30T12:00:00Z",
      } as never),
    ).toThrow(/explicit offset-bearing/i);
  });

  test("DEC-012 intersects constraints, clamps, and records provenance", () => {
    const decision = resolveParentDurationDecision({
      policyVersion: 1,
      integrityValid: true,
      actorAuthorized: true,
      safety: {
        constraintId: "safety:duration",
        minimumMinutes: 5,
        maximumMinutes: 40,
      },
      accommodations: [
        {
          accommodationId: "accommodation:shorter-sections",
          active: true,
          maximumMinutes: 12,
        },
      ],
      adultHardMaximums: [
        { hardMaximumId: "parent:max", active: true, minutes: 20 },
      ],
      manualOverride: {
        overrideId: "override:target-25",
        active: true,
        mode: "target",
        targetMinutes: 25,
      },
      recommendation: {
        recommendationId: "engine:increase",
        state: "accepted",
        targetMinutes: 35,
      },
      currentMinutes: 20,
      gradeBandDefaultMinutes: 25,
    });
    expect(decision.finalEffectiveValue).toBe(12);
    expect(decision.winningSource).toBe("manual-override");
    expect(decision.bindingConstraints).toContain(
      "accommodation:shorter-sections",
    );
    expect(decision.manualReview).toBe(false);
    expect(decision.decisionHistory).toHaveLength(1);
  });

  test("infeasible constraints require manual review with no invented value", () => {
    const decision = resolveParentDurationDecision({
      policyVersion: 1,
      integrityValid: true,
      actorAuthorized: true,
      safety: {
        constraintId: "safety:min-20",
        minimumMinutes: 20,
      },
      accommodations: [
        {
          accommodationId: "accommodation:max-12",
          active: true,
          maximumMinutes: 12,
        },
      ],
      adultHardMaximums: [],
      currentMinutes: 15,
      gradeBandDefaultMinutes: 20,
    });
    expect(decision.manualReview).toBe(true);
    expect(decision.finalEffectiveValue).toBeNull();
    expect(decision.reasonCode).toBe("policy.infeasible-constraints");
  });

  test("successive manual decisions preserve complete numeric history", () => {
    const base = {
      policyVersion: 1,
      integrityValid: true,
      actorAuthorized: true,
      safety: { constraintId: "safety:normal", maximumMinutes: 45 },
      accommodations: [],
      adultHardMaximums: [],
      currentMinutes: 20,
      gradeBandDefaultMinutes: 25,
    } as const;
    const first = resolveParentDurationDecision({
      ...base,
      manualOverride: {
        overrideId: "override:first",
        active: true,
        mode: "target",
        targetMinutes: 25,
      },
    });
    const second = resolveParentDurationDecision(
      {
        ...base,
        manualOverride: {
          overrideId: "override:second",
          active: true,
          mode: "reduce",
          targetMinutes: 10,
        },
      },
      first.decisionHistory,
    );
    expect(second.decisionHistory).toEqual([
      expect.objectContaining({
        sequence: 1,
        candidateMinutes: 25,
        finalEffectiveValue: 25,
      }),
      expect.objectContaining({
        sequence: 2,
        candidateMinutes: 10,
        finalEffectiveValue: 10,
      }),
    ]);
  });

  test("omitted parent integrity and authorization gates fail closed", () => {
    expect(() =>
      createParentRuntimeState({
        controlSetId: "controls:001",
        studentRef: "student:001",
        gradeBand: "elementary-3-5",
        privateRecordRef: "private:001",
        at: "2026-07-30T09:00:00-04:00",
        gradeBandDefault: {
          maximumWorkDurationMinutes: 25,
          breakDurationMinutes: 5,
          timersHidden: false,
        },
      } as never),
    ).toThrow(/gates are required|Cannot read/i);
  });

  test("public parent controls reject credentials in allowed free text", () => {
    const state = parentState();
    expect(() =>
      applyParentControlAction(
        state,
        {
          type: "set-break-duration",
          eventId: "event:credential-smuggling",
          at: "2026-07-30T09:01:00-04:00",
          expectedRevision: 0,
          actor: { actorId: "parent:verified", role: "parent" },
          minutes: 8,
          reason: "password=secret",
        },
        {
          integrityValid: true,
          actorAuthorized: true,
          studentRef: "student:verified",
          actorId: "parent:verified",
          actorRole: "parent",
        },
      ),
    ).toThrow(/credentials/i);
  });

  test("private-note control requires the authorized private boundary", () => {
    const state = parentState();
    expect(() =>
      applyParentControlAction(
        state,
        {
          type: "add-private-note",
          eventId: "event:private-note",
          at: "2026-07-30T09:01:00-04:00",
          expectedRevision: 0,
          actor: { actorId: "parent:verified", role: "parent" },
          noteId: "note:verified",
          category: "instructional",
          body: "Use the visual fraction model.",
        },
        {
          integrityValid: true,
          actorAuthorized: true,
          studentRef: "student:verified",
          actorId: "parent:verified",
          actorRole: "parent",
        },
      ),
    ).toThrow(/adult-private record boundary/i);
  });

  test("competing parent and historical Romeo exports stay private", () => {
    expect(parentPublic).not.toHaveProperty("resolveParentObligation");
    expect(romeoPublic).not.toHaveProperty("ROMEO_DEC_018_RECONCILIATION");
  });

  test.each([
    { password: "secret" },
    { token: "secret" },
    { nested: { sessionCookie: "secret" } },
    { url: "https://example.invalid/?access_token=secret" },
  ])("Romeo rejects credential material: %o", (value) => {
    expect(() => assertRomeoCredentialFree(value)).toThrow();
  });
});
