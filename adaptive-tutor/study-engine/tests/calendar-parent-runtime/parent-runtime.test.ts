import { describe, expect, it } from "vitest";
import {
  ParentRuntimeError,
  applyParentControlAction,
  buildMobileParentViewModel,
  createParentRuntimeState,
  type ParentAccommodation,
  type ParentControlAction,
  type ParentRuntimeState,
} from "../../integration-labs/calendar-parent-runtime/parent-runtime.js";
import {
  CARD5_POLICY_ID,
  CARD5_POLICY_VERSION,
} from "../../integration-labs/calendar-parent-runtime/card5-duration-policy.js";
import {
  PrivacyBoundaryError,
  auditParentRecommendationProjection,
  auditPrivateNoteIsolation,
  createAdultPrivateRecord,
  projectAuthorizedAdultPrivateNotes,
  projectParentRecommendation,
  writeAdultPrivateNote,
  type AdultPrivateAuthorization,
  type ParentSafeRecommendation,
} from "../../integration-labs/calendar-parent-runtime/privacy.js";

const PARENT = {
  role: "parent",
  actorId: "adult:parent-card8",
} as const;
const TEACHER = {
  role: "teacher",
  actorId: "adult:teacher-card8",
} as const;
const STUDENT_REF = "student:calendar-parent-lab";
const PRIVATE_RECORD_REF = "private:calendar-parent-lab";
const BASE_AT = "2026-07-28T08:00:00-04:00";

function safeRecommendation(input: {
  readonly recommendationId: string;
  readonly direction: "increase" | "maintain" | "decrease";
  readonly summary: string;
  readonly maximum?: number;
  readonly breakMinutes?: number;
}): ParentSafeRecommendation {
  return projectParentRecommendation({
    recommendationId: input.recommendationId,
    createdAt: "2026-07-28T07:45:00-04:00",
    direction: input.direction,
    summary: input.summary,
    ...(input.maximum === undefined
      ? {}
      : { suggestedMaximumWorkDurationMinutes: input.maximum }),
    ...(input.breakMinutes === undefined
      ? {}
      : { suggestedBreakDurationMinutes: input.breakMinutes }),
    evidence: [
      {
        evidenceId: `evidence:${input.recommendationId}`,
        description:
          "Three recent work blocks reached their planned stopping points.",
        observedAt: "2026-07-28T07:40:00-04:00",
        source: "completed-work",
      },
    ],
  }).recommendation;
}

function runtime(
  overrides: Partial<Parameters<typeof createParentRuntimeState>[0]> = {},
): ParentRuntimeState {
  return createParentRuntimeState({
    controlSetId: "controls:calendar-parent-lab",
    studentRef: STUDENT_REF,
    gradeBand: "middle-6-8",
    privateRecordRef: PRIVATE_RECORD_REF,
    at: BASE_AT,
    gradeBandDefault: {
      maximumWorkDurationMinutes: 30,
      breakDurationMinutes: 5,
      timersHidden: false,
    },
    knownIncompleteBlockIds: ["block:partial-fractions"],
    ...overrides,
  });
}

describe("Card 8 parent runtime", () => {
  it("demonstrates all ten controls while routing private-note text to a separate authorized record", () => {
    const accepted = safeRecommendation({
      recommendationId: "recommendation:maintain-20",
      direction: "maintain",
      summary: "Keep the current shorter math blocks.",
      maximum: 20,
      breakMinutes: 6,
    });
    const rejected = safeRecommendation({
      recommendationId: "recommendation:increase-35",
      direction: "increase",
      summary: "Consider a longer work block next week.",
      maximum: 35,
      breakMinutes: 5,
    });

    const actions: readonly ParentControlAction[] = [
      {
        type: "accept-recommendation",
        eventId: "event:01-accept",
        recommendationId: accepted.recommendationId,
        at: "2026-07-28T08:01:00-04:00",
        actor: PARENT,
        expectedRevision: 0,
      },
      {
        type: "reject-recommendation",
        eventId: "event:02-reject",
        recommendationId: rejected.recommendationId,
        at: "2026-07-28T08:02:00-04:00",
        actor: PARENT,
        expectedRevision: 1,
      },
      {
        type: "set-maximum-work-duration",
        eventId: "event:03-maximum",
        minutes: 24,
        scope: "hard-maximum",
        reason: "Keep work blocks within the family schedule.",
        at: "2026-07-28T08:03:00-04:00",
        actor: PARENT,
        expectedRevision: 2,
      },
      {
        type: "set-break-duration",
        eventId: "event:04-break",
        minutes: 7,
        reason: "Allow time to move and get water.",
        at: "2026-07-28T08:04:00-04:00",
        actor: PARENT,
        expectedRevision: 3,
      },
      {
        type: "set-timers-hidden",
        eventId: "event:05-timer",
        hidden: true,
        reason: "Show only progress milestones.",
        at: "2026-07-28T08:05:00-04:00",
        actor: PARENT,
        expectedRevision: 4,
      },
      {
        type: "add-accommodation",
        eventId: "event:06-accommodation",
        accommodationId: "accommodation:short-sections",
        required: true,
        functionalDescription:
          "Use twelve-minute sections with a movement break between sections.",
        studentMessage:
          "You can work in a shorter section and take the planned movement break.",
        source: "parent",
        maximumWorkDurationMinutes: 12,
        breakDurationMinutes: 8,
        timersHidden: true,
        at: "2026-07-28T08:06:00-04:00",
        actor: PARENT,
        expectedRevision: 5,
      },
      {
        type: "reschedule-incomplete-work",
        eventId: "event:07-reschedule",
        rescheduleId: "reschedule:partial-fractions",
        blockId: "block:partial-fractions",
        originalStartAt: "2026-07-28T09:00:00-04:00",
        replacementStartAt: "2026-07-29T09:30:00-04:00",
        reason: "Continue after tomorrow's breakfast.",
        at: "2026-07-28T08:07:00-04:00",
        actor: PARENT,
        expectedRevision: 6,
      },
      {
        type: "mark-interruption",
        eventId: "event:08-interruption",
        interruptionId: "interruption:internet",
        kind: "technical",
        blockId: "block:partial-fractions",
        occurredAt: "2026-07-28T07:58:00-04:00",
        at: "2026-07-28T08:08:00-04:00",
        actor: PARENT,
        expectedRevision: 7,
      },
      {
        type: "add-private-note",
        eventId: "event:09-private-note",
        noteId: "private-note:paper-model",
        category: "instructional",
        body: "PRIVATE-SENTINEL-CARD8: place the paper fraction model beside tomorrow's lesson.",
        at: "2026-07-28T08:09:00-04:00",
        actor: PARENT,
        expectedRevision: 8,
      },
      {
        type: "request-adult-review",
        eventId: "event:10-review-request",
        requestId: "review-request:fraction-model",
        audience: "tutor",
        subjectRef: "skill:add-unlike-denominators",
        reason:
          "Please review the visual fraction step before independent work.",
        basisEvidenceIds: ["evidence:fraction-guided-step"],
        at: "2026-07-28T08:10:00-04:00",
        actor: PARENT,
        expectedRevision: 9,
      },
    ];

    let state = runtime({ recommendations: [accepted, rejected] });
    let privateRecord = createAdultPrivateRecord({
      recordId: PRIVATE_RECORD_REF,
      studentRef: STUDENT_REF,
      at: BASE_AT,
    });
    const authorization: AdultPrivateAuthorization = {
      actor: PARENT,
      studentRef: STUDENT_REF,
      canReadPrivateNotes: true,
      canWritePrivateNotes: true,
    };

    for (const action of actions) {
      const outcome = applyParentControlAction(state, action);
      state = outcome.state;
      if (outcome.adultPrivateWrite !== undefined) {
        privateRecord = writeAdultPrivateNote(
          privateRecord,
          outcome.adultPrivateWrite,
          authorization,
        );
      }
    }

    expect(state.revision).toBe(10);
    expect(state.actionLog.map(({ type }) => type)).toEqual(
      actions.map(({ type }) => type),
    );
    expect(
      state.actionLog.map(
        ({ expectedRevision, appliedFromRevision, resultingRevision }) => ({
          expectedRevision,
          appliedFromRevision,
          resultingRevision,
        }),
      ),
    ).toEqual(
      Array.from({ length: 10 }, (_, revision) => ({
        expectedRevision: revision,
        appliedFromRevision: revision,
        resultingRevision: revision + 1,
      })),
    );
    expect(
      state.recommendationDecisions.map(({ decision }) => decision),
    ).toEqual(["accepted", "rejected"]);
    expect(state.recommendations).toHaveLength(2);
    expect(state.parentHardMaximumWorkDurationMinutes).toBe(24);
    expect(state.parentManualOverride).toMatchObject({
      breakDurationMinutes: 7,
      timersHidden: true,
    });
    expect(state.accommodations).toHaveLength(1);
    expect(state.incompleteWorkReschedules).toHaveLength(1);
    expect(state.interruptions).toEqual([
      expect.objectContaining({ kind: "technical" }),
    ]);
    expect(state.reviewRequests).toEqual([
      expect.objectContaining({ audience: "tutor", status: "open" }),
    ]);

    const publicSerialized = JSON.stringify(state);
    expect(publicSerialized).not.toContain("PRIVATE-SENTINEL-CARD8");
    expect(auditPrivateNoteIsolation(state, privateRecord)).toEqual([]);
    expect(
      projectAuthorizedAdultPrivateNotes(privateRecord, authorization).notes[0]
        ?.body,
    ).toContain("PRIVATE-SENTINEL-CARD8");
    expect(
      projectAuthorizedAdultPrivateNotes(privateRecord, authorization).notes[0]
        ?.audience,
    ).toBe("parent-only");
  });

  it("rejects stale concurrent adult overrides instead of using implicit last-write-wins", () => {
    const first = applyParentControlAction(runtime(), {
      type: "set-maximum-work-duration",
      eventId: "event:concurrent-parent-target",
      expectedRevision: 0,
      minutes: 20,
      scope: "manual-override",
      reason: "Use a twenty-minute work section for the current plan.",
      at: "2026-07-28T08:01:00-04:00",
      actor: PARENT,
    });
    const staleTeacherAction: ParentControlAction = {
      type: "set-maximum-work-duration",
      eventId: "event:concurrent-teacher-target",
      expectedRevision: 0,
      minutes: 16,
      scope: "manual-override",
      reason: "Use a sixteen-minute work section for the current plan.",
      at: "2026-07-28T08:02:00-04:00",
      actor: TEACHER,
    };

    expect(() =>
      applyParentControlAction(first.state, staleTeacherAction),
    ).toThrowError(
      expect.objectContaining<Partial<ParentRuntimeError>>({
        code: "stale-revision",
        message: expect.stringContaining("Refresh and review"),
      }),
    );
    expect(first.state).toMatchObject({
      revision: 1,
      parentManualOverride: {
        maximumWorkDurationMinutes: 20,
      },
      effectiveSettings: {
        maximumWorkDurationMinutes: 20,
      },
    });
    expect(first.state.actionLog).toHaveLength(1);

    expect(() =>
      applyParentControlAction(first.state, {
        type: "set-maximum-work-duration",
        eventId: "event:missing-revision-teacher-target",
        minutes: 16,
        scope: "manual-override",
        reason: "Use a sixteen-minute work section for the current plan.",
        at: "2026-07-28T08:02:00-04:00",
        actor: TEACHER,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ParentRuntimeError>>({
        code: "stale-revision",
        message: expect.stringContaining("no implicit last-write-wins"),
      }),
    );

    const current = applyParentControlAction(first.state, {
      ...staleTeacherAction,
      eventId: "event:current-teacher-target",
      expectedRevision: 1,
      at: "2026-07-28T08:03:00-04:00",
    }).state;
    expect(current).toMatchObject({
      revision: 2,
      parentManualOverride: {
        maximumWorkDurationMinutes: 16,
      },
      manualDurationOverride: {
        overrideId: "event:current-teacher-target",
        setBy: TEACHER,
      },
      effectiveSettings: {
        maximumWorkDurationMinutes: 16,
      },
    });
    expect(
      current.actionLog.map(
        ({ expectedRevision, appliedFromRevision, resultingRevision }) => ({
          expectedRevision,
          appliedFromRevision,
          resultingRevision,
        }),
      ),
    ).toEqual([
      {
        expectedRevision: 0,
        appliedFromRevision: 0,
        resultingRevision: 1,
      },
      {
        expectedRevision: 1,
        appliedFromRevision: 1,
        resultingRevision: 2,
      },
    ]);
  });

  it("uses Card 5 candidate selection and clamps through every required constraint", () => {
    const recommendation = safeRecommendation({
      recommendationId: "recommendation:engine-35",
      direction: "increase",
      summary: "Consider a thirty-five-minute work block.",
      maximum: 35,
      breakMinutes: 6,
    });
    const accommodations: readonly ParentAccommodation[] = [
      {
        accommodationId: "accommodation:required-14",
        enabled: true,
        required: true,
        functionalDescription:
          "Keep work sections at fourteen minutes or less.",
        studentMessage:
          "Your stopping point is available within fourteen minutes.",
        source: "teacher",
        addedAt: BASE_AT,
        maximumWorkDurationMinutes: 14,
        breakDurationMinutes: 7,
      },
      {
        accommodationId: "accommodation:required-8-to-12",
        enabled: true,
        required: true,
        functionalDescription:
          "Use work sections from eight to twelve minutes.",
        studentMessage: "Your section has a clear stopping point.",
        source: "school-plan",
        addedAt: BASE_AT,
        minimumWorkDurationMinutes: 8,
        maximumWorkDurationMinutes: 12,
        breakDurationMinutes: 8,
        timersHidden: true,
      },
    ];
    const initial = runtime({
      recommendations: [recommendation],
      safetyLimit: {
        constraintId: "safety:duration",
        minimumWorkDurationMinutes: 5,
        maximumWorkDurationMinutes: 60,
      },
      accommodations,
      adultHardMaximums: [
        {
          hardMaximumId: "hard-maximum:parent",
          active: true,
          minutes: 18,
          setAt: BASE_AT,
          reason: "Parent maximum.",
          setBy: PARENT,
        },
        {
          hardMaximumId: "hard-maximum:teacher",
          active: true,
          minutes: 15,
          setAt: BASE_AT,
          reason: "Teacher maximum.",
          setBy: {
            role: "teacher",
            actorId: "adult:teacher-card8",
          },
        },
      ],
      parentManualOverride: {
        maximumWorkDurationMinutes: 25,
        breakDurationMinutes: 7,
        timersHidden: false,
      },
    });
    const state = applyParentControlAction(initial, {
      type: "accept-recommendation",
      eventId: "event:precedence-accept",
      recommendationId: recommendation.recommendationId,
      at: "2026-07-28T08:11:00-04:00",
      actor: PARENT,
    }).state;

    const workTrace = state.effectiveSettings.traces.maximumWorkDurationMinutes;
    expect(workTrace).toMatchObject({
      policyId: CARD5_POLICY_ID,
      policyVersion: CARD5_POLICY_VERSION,
      status: "resolved",
      reasonCode: "policy.resolved",
      source: "manual-override",
      candidateMinutes: 25,
      targetMinutes: 12,
      lowerBound: 8,
      upperBound: 12,
      applied: ["hard-clamp", "upper-bound", "lower-bound"],
    });
    expect(workTrace.winner).toMatchObject({
      source: "manual-override",
      value: 12,
    });
    expect(workTrace.winner.reason).toContain("clamped by");
    expect(
      workTrace.candidateProvenance.map(
        ({ source, referenceId, eligible }) => ({
          source,
          referenceId,
          eligible,
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "manual-override",
          eligible: true,
        }),
        {
          source: "accepted-engine-recommendation",
          referenceId: recommendation.recommendationId,
          eligible: true,
        },
      ]),
    );
    expect(
      workTrace.appliedConstraints
        .filter(({ active }) => active)
        .map(({ constraintId }) => constraintId),
    ).toEqual(
      expect.arrayContaining([
        "safety:duration",
        "accommodation:required-14",
        "accommodation:required-8-to-12",
        "hard-maximum:parent",
        "hard-maximum:teacher",
      ]),
    );
    expect(
      workTrace.appliedConstraints.find(
        ({ constraintId, kind }) =>
          constraintId === "accommodation:required-8-to-12" &&
          kind === "maximum",
      )?.binding,
    ).toBe(true);
    expect(state.adultHardMaximums).toEqual(initial.adultHardMaximums);
    expect(state.parentHardMaximumWorkDurationMinutes).toBe(15);
    expect(state.effectiveSettings.maximumWorkDurationMinutes).toBe(12);
    expect(state.effectiveSettings.breakDurationMinutes).toBe(8);
    expect(
      state.effectiveSettings.traces.breakDurationMinutes.winner.source,
    ).toBe("required-accommodation");
    expect(state.effectiveSettings.timersHidden).toBe(true);
    expect(state.effectiveSettings.traces.timersHidden.winner.source).toBe(
      "required-accommodation",
    );
  });

  it("returns manual-review with no automatic target for infeasible required constraints", () => {
    const state = runtime({
      safetyLimit: {
        constraintId: "safety:infeasible-test",
        minimumWorkDurationMinutes: 5,
        maximumWorkDurationMinutes: 60,
      },
      accommodations: [
        {
          accommodationId: "accommodation:minimum-25",
          enabled: true,
          required: true,
          functionalDescription:
            "Use a work section of at least twenty-five minutes.",
          studentMessage: "An adult will review the next section length.",
          source: "school-plan",
          addedAt: BASE_AT,
          minimumWorkDurationMinutes: 25,
        },
        {
          accommodationId: "accommodation:maximum-15",
          enabled: true,
          required: true,
          functionalDescription: "Keep a work section within fifteen minutes.",
          studentMessage: "An adult will review the next section length.",
          source: "school-plan",
          addedAt: BASE_AT,
          maximumWorkDurationMinutes: 15,
        },
      ],
    });
    const trace = state.effectiveSettings.traces.maximumWorkDurationMinutes;

    expect(trace).toMatchObject({
      policyId: CARD5_POLICY_ID,
      status: "manual-review",
      reasonCode: "policy.infeasible-constraints",
      targetMinutes: null,
      lowerBound: 25,
      upperBound: 15,
      applied: ["constraint-intersection-empty"],
      winner: {
        source: "manual-review",
        label: "Manual review required",
        value: null,
      },
    });
    expect(state.effectiveSettings.maximumWorkDurationMinutes).toBeNull();
    expect(buildMobileParentViewModel(state).durationPolicy).toMatchObject({
      status: "manual-review",
      reasonCode: "policy.infeasible-constraints",
      lowerBound: 25,
      upperBound: 15,
    });
  });

  it.each([
    {
      name: "unsupported version",
      context: { policyVersion: 2 },
      reasonCode: "policy.unsupported-version",
    },
    {
      name: "failed integrity",
      context: { integrityValid: false },
      reasonCode: "policy.integrity-failed",
    },
    {
      name: "unauthorized actor",
      context: { actorAuthorized: false },
      reasonCode: "policy.actor-unauthorized",
    },
  ] as const)(
    "quarantines $name without inventing a duration",
    ({ context, reasonCode }) => {
      const state = runtime({ durationPolicyContext: context });
      const trace = state.effectiveSettings.traces.maximumWorkDurationMinutes;

      expect(trace).toMatchObject({
        policyId: CARD5_POLICY_ID,
        policyVersion: CARD5_POLICY_VERSION,
        status: "quarantine",
        reasonCode,
        targetMinutes: null,
        winner: {
          source: "quarantine",
          value: null,
        },
      });
      expect(state.effectiveSettings.maximumWorkDurationMinutes).toBeNull();
    },
  );

  it("retains a rejected increase as history while the parent decision stays effective", () => {
    const recommendation = safeRecommendation({
      recommendationId: "recommendation:increase-history",
      direction: "increase",
      summary: "Consider increasing the work block.",
      maximum: 40,
    });
    const initial = runtime({
      recommendations: [recommendation],
      parentHardMaximumWorkDurationMinutes: 20,
    });
    const hardMaximumsBefore = initial.adultHardMaximums;
    const state = applyParentControlAction(initial, {
      type: "reject-recommendation",
      eventId: "event:reject-history",
      recommendationId: recommendation.recommendationId,
      at: "2026-07-28T08:12:00-04:00",
      actor: PARENT,
    }).state;

    expect(state.recommendations).toContainEqual(recommendation);
    expect(state.recommendationDecisions).toEqual([
      expect.objectContaining({
        recommendationId: recommendation.recommendationId,
        decision: "rejected",
      }),
    ]);
    expect(state.effectiveSettings.maximumWorkDurationMinutes).toBe(20);
    expect(state.activeRecommendationId).toBeUndefined();
    expect(state.adultHardMaximums).toEqual(hardMaximumsBefore);
    expect(
      state.effectiveSettings.traces.maximumWorkDurationMinutes.candidateProvenance.find(
        ({ source }) => source === "accepted-engine-recommendation",
      ),
    ).toMatchObject({
      referenceId: recommendation.recommendationId,
      eligible: false,
    });

    const language = JSON.stringify({
      decision: state.recommendationDecisions[0]?.displayMessage,
      log: state.actionLog[0]?.message,
    });
    expect(language).toContain("remains");
    expect(language).not.toMatch(
      /\b(blame|refused|uncooperative|ignored advice|bad choice|failure)\b/i,
    );
  });

  it("scopes rejection to its RecommendationId without suppressing an accepted recommendation", () => {
    const accepted = safeRecommendation({
      recommendationId: "recommendation:accepted-scope",
      direction: "maintain",
      summary: "Use an eighteen-minute work section.",
      maximum: 18,
    });
    const rejected = safeRecommendation({
      recommendationId: "recommendation:rejected-scope",
      direction: "increase",
      summary: "Consider a longer work section.",
      maximum: 36,
    });
    const initial = runtime({ recommendations: [accepted, rejected] });
    const withAcceptance = applyParentControlAction(initial, {
      type: "accept-recommendation",
      eventId: "event:accept-scoped-recommendation",
      recommendationId: accepted.recommendationId,
      expectedRevision: 0,
      at: "2026-07-28T08:12:00-04:00",
      actor: PARENT,
    }).state;
    const state = applyParentControlAction(withAcceptance, {
      type: "reject-recommendation",
      eventId: "event:reject-other-recommendation",
      recommendationId: rejected.recommendationId,
      expectedRevision: 1,
      at: "2026-07-28T08:13:00-04:00",
      actor: PARENT,
    }).state;

    expect(state.activeRecommendationId).toBe(accepted.recommendationId);
    expect(state.effectiveSettings.maximumWorkDurationMinutes).toBe(18);
    expect(state.recommendationDecisions).toEqual([
      expect.objectContaining({
        recommendationId: accepted.recommendationId,
        decision: "accepted",
      }),
      expect.objectContaining({
        recommendationId: rejected.recommendationId,
        decision: "rejected",
      }),
    ]);
    expect(
      buildMobileParentViewModel(state).recommendationCards,
    ).toEqual([
      expect.objectContaining({
        recommendationId: accepted.recommendationId,
        decision: "accepted",
      }),
      expect.objectContaining({
        recommendationId: rejected.recommendationId,
        decision: "rejected",
      }),
    ]);
  });

  it("applies a shorter required accommodation, hidden timer, and longer break without diagnosis language", () => {
    const state = applyParentControlAction(
      runtime({ parentHardMaximumWorkDurationMinutes: 25 }),
      {
        type: "add-accommodation",
        eventId: "event:add-functional-support",
        accommodationId: "accommodation:functional-support",
        required: true,
        functionalDescription:
          "Use ten-minute sections and offer a movement break after each section.",
        studentMessage:
          "You can pause at the ten-minute stopping point and take your planned break.",
        source: "parent",
        maximumWorkDurationMinutes: 10,
        breakDurationMinutes: 8,
        timersHidden: true,
        at: "2026-07-28T08:13:00-04:00",
        actor: PARENT,
      },
    ).state;

    expect(state.effectiveSettings).toMatchObject({
      maximumWorkDurationMinutes: 10,
      breakDurationMinutes: 8,
      timersHidden: true,
    });
    expect(JSON.stringify(state.accommodations)).not.toMatch(
      /\b(diagnos|adhd|autis|medical condition)\b/i,
    );

    expect(() =>
      applyParentControlAction(runtime(), {
        type: "add-accommodation",
        eventId: "event:unsafe-accommodation",
        accommodationId: "accommodation:unsafe",
        required: true,
        functionalDescription:
          "Use a medical diagnosis to label future calendar blocks.",
        studentMessage: "A shorter section is available.",
        source: "parent",
        at: "2026-07-28T08:14:00-04:00",
        actor: PARENT,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ParentRuntimeError>>({
        code: "invalid-text",
      }),
    );
  });

  it("uses typed accommodation effects and never parses description text into constraints", () => {
    const state = runtime({
      accommodations: [
        {
          accommodationId: "accommodation:text-is-not-a-constraint",
          enabled: true,
          required: true,
          functionalDescription:
            "Offer a five-minute check-in before the next work section.",
          studentMessage: "A check-in is available before the next section.",
          source: "school-plan",
          addedAt: BASE_AT,
        },
        {
          accommodationId: "accommodation:optional-typed-effect",
          enabled: true,
          required: false,
          functionalDescription:
            "A shorter optional section is available when selected.",
          studentMessage: "You may choose the shorter optional section.",
          source: "parent",
          addedAt: BASE_AT,
          maximumWorkDurationMinutes: 7,
          breakDurationMinutes: 12,
          timersHidden: true,
        },
      ],
    });

    expect(state.effectiveSettings).toMatchObject({
      maximumWorkDurationMinutes: 30,
      breakDurationMinutes: 5,
      timersHidden: false,
    });
    expect(() =>
      runtime({
        accommodations: [
          {
            accommodationId: "accommodation:unsafe-preloaded-text",
            enabled: true,
            required: true,
            functionalDescription:
              "Attach a medical diagnosis to each calendar block.",
            studentMessage: "A shorter section is available.",
            source: "school-plan",
            addedAt: BASE_AT,
          },
        ],
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ParentRuntimeError>>({
        code: "invalid-text",
      }),
    );
  });

  it("allow-lists recommendation fields and neutralizes unsafe summary or evidence text", () => {
    const result = projectParentRecommendation({
      recommendationId: "recommendation:privacy",
      createdAt: "2026-07-28T07:45:00-04:00",
      direction: "decrease",
      summary:
        "Student email: learner@example.com; diagnosis: ADHD; raw answer follows.",
      suggestedMaximumWorkDurationMinutes: 12,
      evidence: [
        {
          evidenceId: "evidence:privacy",
          description:
            "Verbatim transcript and hidden behavioral score were attached.",
          observedAt: "2026-07-28T07:40:00-04:00",
          source: "review-result",
          rawResponse: "sensitive response value",
        },
      ],
      studentName: "Sensitive Name",
      email: "learner@example.com",
      rawAnswer: "sensitive answer value",
      transcript: "sensitive transcript value",
      diagnosisText: "sensitive diagnosis value",
      hiddenBehaviorScore: 99,
    });

    expect(result.privacyReport.excludedSensitivePaths).toEqual(
      expect.arrayContaining([
        "recommendation.diagnosisText",
        "recommendation.email",
        "recommendation.evidence[0].rawResponse",
        "recommendation.hiddenBehaviorScore",
        "recommendation.rawAnswer",
        "recommendation.studentName",
        "recommendation.transcript",
      ]),
    );
    expect(result.privacyReport.neutralizedTextPaths).toEqual([
      "recommendation.evidence[0].description",
      "recommendation.summary",
    ]);
    expect(auditParentRecommendationProjection(result.recommendation)).toEqual(
      [],
    );
    const serialized = JSON.stringify(result.recommendation);
    expect(serialized).not.toMatch(
      /Sensitive Name|learner@example\.com|sensitive answer|sensitive transcript|ADHD|hidden behavioral score/i,
    );
  });

  it("requires explicit matching authorization for the adult-private projection", () => {
    const record = createAdultPrivateRecord({
      recordId: PRIVATE_RECORD_REF,
      studentRef: STUDENT_REF,
      at: BASE_AT,
    });
    const write = {
      recordId: PRIVATE_RECORD_REF,
      studentRef: STUDENT_REF,
      noteId: "private-note:authorization",
      author: PARENT,
      category: "schedule" as const,
      body: "Keep this schedule detail within the authorized adult record.",
      at: "2026-07-28T08:15:00-04:00",
    };
    const authorized: AdultPrivateAuthorization = {
      actor: PARENT,
      studentRef: STUDENT_REF,
      canReadPrivateNotes: true,
      canWritePrivateNotes: true,
    };
    const withNote = writeAdultPrivateNote(record, write, authorized);

    expect(
      projectAuthorizedAdultPrivateNotes(withNote, authorized).notes,
    ).toHaveLength(1);
    expect(() =>
      projectAuthorizedAdultPrivateNotes(withNote, {
        ...authorized,
        canReadPrivateNotes: false,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<PrivacyBoundaryError>>({
        code: "unauthorized-private-read",
      }),
    );
    expect(() =>
      writeAdultPrivateNote(
        withNote,
        { ...write, noteId: "private-note:second" },
        {
          ...authorized,
          studentRef: "student:different",
        },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<PrivacyBoundaryError>>({
        code: "private-record-mismatch",
      }),
    );
  });

  it("builds a mobile-safe card model with ten controls and no private body", () => {
    const recommendation = safeRecommendation({
      recommendationId: "recommendation:mobile",
      direction: "maintain",
      summary:
        "Maintain short sections while the current parent-visible evidence remains applicable.",
      maximum: 18,
    });
    const state = applyParentControlAction(
      runtime({ recommendations: [recommendation] }),
      {
        type: "set-timers-hidden",
        eventId: "event:mobile-hide-timer",
        hidden: true,
        reason: "Use progress milestones on the narrow parent view.",
        at: "2026-07-28T08:16:00-04:00",
        actor: PARENT,
      },
    ).state;
    const viewModel = buildMobileParentViewModel(state);

    expect(viewModel.layout).toEqual({
      baselineColumns: 1,
      usesDataTables: false,
      wrapsLongText: true,
    });
    expect(viewModel.availableControls).toHaveLength(10);
    expect(
      viewModel.availableControls.every(
        (control) =>
          control.minimumTouchTargetPixels === 44 &&
          control.fullWidthOnNarrowScreens,
      ),
    ).toBe(true);
    expect(viewModel.effectiveSettings.timerPresentation).toBe("hidden");
    expect(viewModel.privateNotes).toEqual({
      recordRef: PRIVATE_RECORD_REF,
      access: "authorized-adults-only",
      bodyIncluded: false,
    });
    expect(JSON.stringify(viewModel)).not.toMatch(/\bbody\s*:/i);
  });

  it("ignores duplicate event IDs deterministically", () => {
    const action: ParentControlAction = {
      type: "set-break-duration",
      eventId: "event:idempotent-break",
      minutes: 9,
      reason: "Use the same break setting after a retry.",
      at: "2026-07-28T08:17:00-04:00",
      actor: PARENT,
      expectedRevision: 0,
    };
    const first = applyParentControlAction(runtime(), action);
    const second = applyParentControlAction(first.state, action);

    expect(first.duplicateIgnored).toBe(false);
    expect(second.duplicateIgnored).toBe(true);
    expect(second.state).toBe(first.state);
    expect(second.state.revision).toBe(1);
    expect(second.state.actionLog).toHaveLength(1);
  });
});
