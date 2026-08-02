import {
  PARENT_CONTROL_SCHEMA_VERSION,
  ParentControlError,
  type ParentControlEvent,
  type ParentControlState,
  type ParentDashboardModel,
  type RecommendationDecision,
} from "./contracts.js";

const OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const SAFE_REFERENCE = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const PROHIBITED_COLLECTION_LANGUAGE =
  /\b(webcam|camera monitoring|eye[ -]?tracking|gaze tracking|attention span|medical diagnosis|diagnosed with|adhd|autis(?:m|tic)|hidden behavior score|permanent label)\b/i;
const UNSUPPORTIVE_STUDENT_LANGUAGE =
  /\b(lazy|bad student|failure|failed again|cannot focus|can't focus|behind everyone)\b/i;

export function createParentControlState(
  overrides: Partial<
    Pick<
      ParentControlState,
      | "maximumWorkDurationMinutes"
      | "breakDurationMinutes"
      | "timersHidden"
    >
  > = {},
): ParentControlState {
  return {
    schemaVersion: PARENT_CONTROL_SCHEMA_VERSION,
    revision: 0,
    maximumWorkDurationMinutes: overrides.maximumWorkDurationMinutes ?? 25,
    breakDurationMinutes: overrides.breakDurationMinutes ?? 5,
    timersHidden: overrides.timersHidden ?? false,
    recommendationDecisions: [],
    accommodations: [],
    incompleteWorkReschedules: [],
    interruptions: [],
    privateNotes: [],
    reviewRequests: [],
    actionLog: [],
  };
}

export function getRecommendationDecision(
  state: ParentControlState,
  recommendationRef: string,
): RecommendationDecision | undefined {
  return state.recommendationDecisions.find(
    (item) => item.recommendationRef === recommendationRef,
  );
}

function assertTimestamp(value: string, field: string): void {
  if (!OFFSET_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new ParentControlError(
      "invalid_timestamp",
      `${field} must be an ISO 8601 timestamp with Z or an explicit offset.`,
    );
  }
}

function assertDuration(
  value: number,
  field: string,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ParentControlError(
      "invalid_duration",
      `${field} must be a whole number from ${minimum} to ${maximum} minutes.`,
    );
  }
}

function assertReference(value: string, field: string): void {
  if (!SAFE_REFERENCE.test(value)) {
    throw new ParentControlError(
      "invalid_reference",
      `${field} must be an opaque reference of 1 to 128 safe characters.`,
    );
  }
}

function normalizedText(
  value: string,
  field: string,
  maximumLength: number,
  options: { readonly studentFacing?: boolean } = {},
): string {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length === 0 || normalized.length > maximumLength) {
    throw new ParentControlError(
      "invalid_text",
      `${field} must be between 1 and ${maximumLength} characters.`,
    );
  }

  if (PROHIBITED_COLLECTION_LANGUAGE.test(normalized)) {
    throw new ParentControlError(
      "unsafe_data_request",
      `${field} must describe an actionable learning support without surveillance, diagnosis, or permanent labels.`,
    );
  }

  if (
    options.studentFacing &&
    UNSUPPORTIVE_STUDENT_LANGUAGE.test(normalized)
  ) {
    throw new ParentControlError(
      "invalid_text",
      `${field} must use supportive, non-labeling learner language.`,
    );
  }

  return normalized;
}

function replaceDecision(
  decisions: readonly RecommendationDecision[],
  next: RecommendationDecision,
): readonly RecommendationDecision[] {
  return [
    ...decisions.filter(
      ({ recommendationRef }) =>
        recommendationRef !== next.recommendationRef,
    ),
    next,
  ];
}

function withLog(
  previous: ParentControlState,
  event: ParentControlEvent,
  patch: Partial<Omit<ParentControlState, "schemaVersion" | "revision">>,
): ParentControlState {
  return {
    ...previous,
    ...patch,
    schemaVersion: PARENT_CONTROL_SCHEMA_VERSION,
    revision: previous.revision + 1,
    actionLog: [...previous.actionLog, event],
  };
}

/**
 * Applies one explicit parent decision using a functional, immutable update.
 * No calendar, profile, database, or identity state is mutated here.
 */
export function applyParentControlEvent(
  model: ParentDashboardModel,
  event: ParentControlEvent,
): ParentDashboardModel {
  assertTimestamp(event.at, "event.at");
  const previous = model.controls;

  switch (event.type) {
    case "recommendation_accepted": {
      assertReference(event.recommendationRef, "recommendationRef");
      const recommendation = model.snapshot.studyHabits.recommendation;
      if (recommendation.recommendationRef !== event.recommendationRef) {
        throw new ParentControlError(
          "unknown_recommendation",
          "The recommendation is not part of this minimized dashboard snapshot.",
        );
      }

      const decision: RecommendationDecision = {
        recommendationRef: event.recommendationRef,
        decision: "accepted",
        decidedAt: event.at,
      };
      const nextControls = withLog(previous, event, {
        recommendationDecisions: replaceDecision(
          previous.recommendationDecisions,
          decision,
        ),
        maximumWorkDurationMinutes:
          recommendation.suggestedMaximumWorkMinutes ??
          previous.maximumWorkDurationMinutes,
        breakDurationMinutes:
          recommendation.suggestedBreakMinutes ??
          previous.breakDurationMinutes,
      });
      return { ...model, controls: nextControls };
    }

    case "recommendation_rejected": {
      assertReference(event.recommendationRef, "recommendationRef");
      if (
        model.snapshot.studyHabits.recommendation.recommendationRef !==
        event.recommendationRef
      ) {
        throw new ParentControlError(
          "unknown_recommendation",
          "The recommendation is not part of this minimized dashboard snapshot.",
        );
      }

      const decision: RecommendationDecision = {
        recommendationRef: event.recommendationRef,
        decision: "rejected",
        decidedAt: event.at,
      };
      return {
        ...model,
        controls: withLog(previous, event, {
          recommendationDecisions: replaceDecision(
            previous.recommendationDecisions,
            decision,
          ),
        }),
      };
    }

    case "maximum_work_duration_set":
      assertDuration(event.minutes, "minutes", 5, 180);
      return {
        ...model,
        controls: withLog(previous, event, {
          maximumWorkDurationMinutes: event.minutes,
        }),
      };

    case "break_duration_set":
      assertDuration(event.minutes, "minutes", 1, 60);
      return {
        ...model,
        controls: withLog(previous, event, {
          breakDurationMinutes: event.minutes,
        }),
      };

    case "timers_hidden_set":
      return {
        ...model,
        controls: withLog(previous, event, {
          timersHidden: event.hidden,
        }),
      };

    case "accommodation_added": {
      assertReference(event.accommodationRef, "accommodationRef");
      const action = normalizedText(event.action, "action", 160);
      const studentMessage = normalizedText(
        event.studentMessage,
        "studentMessage",
        180,
        { studentFacing: true },
      );
      return {
        ...model,
        controls: withLog(previous, event, {
          accommodations: [
            ...previous.accommodations,
            {
              accommodationRef: event.accommodationRef,
              action,
              studentMessage,
              addedAt: event.at,
            },
          ],
        }),
      };
    }

    case "incomplete_work_rescheduled": {
      assertReference(event.blockRef, "blockRef");
      assertTimestamp(event.startsAt, "startsAt");
      if (
        !model.snapshot.today.resumableWork.some(
          ({ blockRef }) => blockRef === event.blockRef,
        )
      ) {
        throw new ParentControlError(
          "unknown_resumable_work",
          "Only work identified as resumable in this snapshot may be rescheduled.",
        );
      }
      if (Date.parse(event.startsAt) <= Date.parse(event.at)) {
        throw new ParentControlError(
          "invalid_timestamp",
          "startsAt must be later than the parent request timestamp.",
        );
      }
      const reason = normalizedText(event.reason, "reason", 180);
      return {
        ...model,
        controls: withLog(previous, event, {
          incompleteWorkReschedules: [
            ...previous.incompleteWorkReschedules,
            {
              blockRef: event.blockRef,
              startsAt: event.startsAt,
              reason,
              requestedAt: event.at,
            },
          ],
        }),
      };
    }

    case "interruption_marked": {
      assertReference(event.interruptionRef, "interruptionRef");
      if (event.blockRef !== undefined) {
        assertReference(event.blockRef, "blockRef");
      }
      assertTimestamp(event.occurredAt, "occurredAt");
      if (Date.parse(event.occurredAt) > Date.parse(event.at)) {
        throw new ParentControlError(
          "invalid_timestamp",
          "occurredAt cannot be later than the recorded event time.",
        );
      }
      return {
        ...model,
        controls: withLog(previous, event, {
          interruptions: [
            ...previous.interruptions,
            {
              interruptionRef: event.interruptionRef,
              kind: event.kind,
              blockRef: event.blockRef,
              occurredAt: event.occurredAt,
              recordedAt: event.at,
            },
          ],
        }),
      };
    }

    case "private_note_added": {
      assertReference(event.noteRef, "noteRef");
      const body = normalizedText(event.body, "body", 500);
      return {
        ...model,
        controls: withLog(previous, event, {
          privateNotes: [
            ...previous.privateNotes,
            {
              noteRef: event.noteRef,
              body,
              createdAt: event.at,
              visibility: "parent_only",
            },
          ],
        }),
      };
    }

    case "review_requested": {
      assertReference(event.requestRef, "requestRef");
      assertReference(event.subjectRef, "subjectRef");
      const reason = normalizedText(event.reason, "reason", 240);
      return {
        ...model,
        controls: withLog(previous, event, {
          reviewRequests: [
            ...previous.reviewRequests,
            {
              requestRef: event.requestRef,
              audience: event.audience,
              subjectRef: event.subjectRef,
              reason,
              requestedAt: event.at,
              status: "requested",
            },
          ],
        }),
      };
    }
  }
}
