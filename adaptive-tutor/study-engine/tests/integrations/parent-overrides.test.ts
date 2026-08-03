import { describe, expect, it } from "vitest";
import {
  ParentControlError,
  applyParentControlEvent,
  createParentDashboardDemoModel,
  getRecommendationDecision,
  type ParentControlEvent,
  type ParentDashboardModel,
} from "../../parent/index.js";

const AT = "2026-07-28T12:00:00-04:00";

function apply(
  model: ParentDashboardModel,
  event: ParentControlEvent,
): ParentDashboardModel {
  return applyParentControlEvent(model, event);
}

describe("parent overrides", () => {
  it("accepts or rejects the evidence-backed recommendation explicitly", () => {
    const initial = createParentDashboardDemoModel();
    const accepted = apply(initial, {
      type: "recommendation_accepted",
      recommendationRef: "recommendation:math-duration-01",
      at: AT,
    });
    const rejected = apply(initial, {
      type: "recommendation_rejected",
      recommendationRef: "recommendation:math-duration-01",
      at: AT,
    });

    expect(
      getRecommendationDecision(
        accepted.controls,
        "recommendation:math-duration-01",
      )?.decision,
    ).toBe("accepted");
    expect(accepted.controls.maximumWorkDurationMinutes).toBe(22);
    expect(accepted.controls.breakDurationMinutes).toBe(5);

    expect(
      getRecommendationDecision(
        rejected.controls,
        "recommendation:math-duration-01",
      )?.decision,
    ).toBe("rejected");
    expect(rejected.controls.maximumWorkDurationMinutes).toBe(25);
  });

  it("keeps a later explicit parent duration authoritative", () => {
    const accepted = apply(createParentDashboardDemoModel(), {
      type: "recommendation_accepted",
      recommendationRef: "recommendation:math-duration-01",
      at: AT,
    });
    const overridden = apply(accepted, {
      type: "maximum_work_duration_set",
      minutes: 30,
      at: "2026-07-28T12:01:00-04:00",
    });

    expect(overridden.controls.maximumWorkDurationMinutes).toBe(30);
    expect(overridden.controls.revision).toBe(2);
    expect(overridden.controls.actionLog.map(({ type }) => type)).toEqual([
      "recommendation_accepted",
      "maximum_work_duration_set",
    ]);
  });

  it("applies every non-recommendation parent control without mutating the input", () => {
    const initial = createParentDashboardDemoModel();
    const events: readonly ParentControlEvent[] = [
      {
        type: "maximum_work_duration_set",
        minutes: 24,
        at: AT,
      },
      {
        type: "break_duration_set",
        minutes: 6,
        at: "2026-07-28T12:01:00-04:00",
      },
      {
        type: "timers_hidden_set",
        hidden: true,
        at: "2026-07-28T12:02:00-04:00",
      },
      {
        type: "accommodation_added",
        accommodationRef: "accommodation:written-steps-01",
        action: "Offer written directions before the first example.",
        studentMessage: "You can use the written steps whenever they help.",
        at: "2026-07-28T12:03:00-04:00",
      },
      {
        type: "incomplete_work_rescheduled",
        blockRef: "block:fractions-01",
        startsAt: "2026-07-29T13:30:00-04:00",
        reason: "Parent chose tomorrow after lunch.",
        at: "2026-07-28T12:04:00-04:00",
      },
      {
        type: "interruption_marked",
        interruptionRef: "interruption:technical-01",
        kind: "technical",
        blockRef: "block:fractions-01",
        occurredAt: "2026-07-28T10:25:00-04:00",
        at: "2026-07-28T12:05:00-04:00",
      },
      {
        type: "private_note_added",
        noteRef: "note:parent-01",
        body: "Use paper fraction circles before the next guided example.",
        at: "2026-07-28T12:06:00-04:00",
      },
      {
        type: "review_requested",
        requestRef: "request:tutor-01",
        audience: "tutor",
        subjectRef: "skill:add-unlike-denominators",
        reason: "Please review the fraction model before independent practice.",
        at: "2026-07-28T12:07:00-04:00",
      },
    ];

    const result = events.reduce(apply, initial);

    expect(result.controls).toMatchObject({
      revision: 8,
      maximumWorkDurationMinutes: 24,
      breakDurationMinutes: 6,
      timersHidden: true,
    });
    expect(result.controls.accommodations).toHaveLength(1);
    expect(result.controls.incompleteWorkReschedules).toHaveLength(1);
    expect(result.controls.interruptions).toHaveLength(1);
    expect(result.controls.privateNotes).toEqual([
      expect.objectContaining({ visibility: "parent_only" }),
    ]);
    expect(result.controls.reviewRequests).toEqual([
      expect.objectContaining({ audience: "tutor", status: "requested" }),
    ]);

    expect(initial.controls.revision).toBe(0);
    expect(initial.controls.accommodations).toEqual([]);
    expect(initial.controls.actionLog).toEqual([]);
  });

  it("rejects unsafe, unsupported, or ambiguous parent writes", () => {
    const initial = createParentDashboardDemoModel();

    expect(() =>
      apply(initial, {
        type: "maximum_work_duration_set",
        minutes: 0,
        at: AT,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ParentControlError>>({
        code: "invalid_duration",
      }),
    );

    expect(() =>
      apply(initial, {
        type: "timers_hidden_set",
        hidden: true,
        at: "2026-07-28T12:00:00",
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ParentControlError>>({
        code: "invalid_timestamp",
      }),
    );

    expect(() =>
      apply(initial, {
        type: "accommodation_added",
        accommodationRef: "accommodation:unsafe-01",
        action: "Use webcam monitoring throughout math.",
        studentMessage: "The camera will check your work.",
        at: AT,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ParentControlError>>({
        code: "unsafe_data_request",
      }),
    );

    expect(() =>
      apply(initial, {
        type: "accommodation_added",
        accommodationRef: "accommodation:language-01",
        action: "Offer a written checklist.",
        studentMessage: "You are a lazy failure.",
        at: AT,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ParentControlError>>({
        code: "invalid_text",
      }),
    );

    expect(() =>
      apply(initial, {
        type: "recommendation_accepted",
        recommendationRef: "recommendation:not-in-snapshot",
        at: AT,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ParentControlError>>({
        code: "unknown_recommendation",
      }),
    );

    expect(() =>
      apply(initial, {
        type: "incomplete_work_rescheduled",
        blockRef: "block:not-resumable",
        startsAt: "2026-07-29T13:30:00-04:00",
        reason: "Move it.",
        at: AT,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ParentControlError>>({
        code: "unknown_resumable_work",
      }),
    );
  });
});
