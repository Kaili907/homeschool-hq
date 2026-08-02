import {
  type CreateStudySessionInput,
  SESSION_PHASES,
  type SessionEvent,
  SessionTransitionError,
  type SessionPhase,
  type StudySessionState,
} from "./types.js";

const OPAQUE_SESSION_REF = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const OFFSET_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SESSION_PHASE_SET: ReadonlySet<string> = new Set(SESSION_PHASES);

const EXPECTED_EVENT: Readonly<
  Record<Exclude<SessionPhase, "finished">, SessionEvent["type"]>
> = {
  check_in: "check_in_completed",
  retrieve_prior_knowledge: "prior_retrieval_completed",
  teach_visually: "visual_teaching_completed",
  guided_practice: "guided_practice_completed",
  independent_attempt: "independent_attempt_completed",
  confidence_check: "confidence_check_completed",
  correct_or_reteach: "core_instruction_completed",
  schedule_future_review: "review_scheduled",
  break_continue_or_finish: "pacing_disposition_recorded",
  on_break: "break_resume_confirmed",
};

const ALLOWED_NEXT_PHASES: Readonly<
  Record<Exclude<SessionPhase, "finished">, readonly SessionPhase[]>
> = {
  check_in: ["retrieve_prior_knowledge"],
  retrieve_prior_knowledge: ["teach_visually"],
  teach_visually: ["guided_practice"],
  guided_practice: ["independent_attempt"],
  independent_attempt: ["confidence_check"],
  confidence_check: ["correct_or_reteach"],
  correct_or_reteach: ["schedule_future_review"],
  schedule_future_review: ["break_continue_or_finish"],
  break_continue_or_finish: ["on_break", "check_in", "finished"],
  on_break: ["check_in"],
};

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap =
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function readOffsetTimestamp(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = OFFSET_TIMESTAMP.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseOffsetTimestamp(value: string): number {
  const timestamp = readOffsetTimestamp(value);
  if (timestamp === null) {
    throw new SessionTransitionError(
      "invalid_timestamp",
      "Session timestamps must be real ISO 8601 instants with an explicit UTC offset.",
    );
  }
  return timestamp;
}

function isSessionPhase(value: unknown): value is SessionPhase {
  return typeof value === "string" && SESSION_PHASE_SET.has(value);
}

function invalidState(): never {
  throw new SessionTransitionError(
    "invalid_state",
    "Study session state failed its integrity check.",
  );
}

function assertStateIntegrity(state: StudySessionState): void {
  if (
    typeof state !== "object" ||
    state === null ||
    state.schemaVersion !== "provisional-study-session.v1" ||
    typeof state.sessionRef !== "string" ||
    !OPAQUE_SESSION_REF.test(state.sessionRef) ||
    !isSessionPhase(state.phase) ||
    !Number.isSafeInteger(state.cycleNumber) ||
    state.cycleNumber < 1 ||
    !Array.isArray(state.history) ||
    readOffsetTimestamp(state.startedAt) === null ||
    readOffsetTimestamp(state.lastEventAt) === null
  ) {
    invalidState();
  }

  let expectedFrom: SessionPhase = "check_in";
  let expectedCycleNumber = 1;
  let previousInstant = readOffsetTimestamp(state.startedAt)!;
  let observedCoreHandoff = false;

  for (const transition of state.history) {
    if (
      typeof transition !== "object" ||
      transition === null ||
      !isSessionPhase(transition.from) ||
      !isSessionPhase(transition.to)
    ) {
      invalidState();
    }
    const from: SessionPhase = transition.from;
    const to: SessionPhase = transition.to;
    if (from === "finished") {
      invalidState();
    }
    if (
      from !== expectedFrom ||
      transition.event !== EXPECTED_EVENT[from] ||
      !ALLOWED_NEXT_PHASES[from].includes(to)
    ) {
      invalidState();
    }
    const instant = readOffsetTimestamp(transition.at);
    if (instant === null || instant < previousInstant) {
      invalidState();
    }
    if (transition.event === "confidence_check_completed") {
      observedCoreHandoff = true;
    }
    if (
      transition.to === "check_in" &&
      (from === "break_continue_or_finish" || from === "on_break")
    ) {
      expectedCycleNumber += 1;
    }
    if (transition.to === "finished" && transition !== state.history.at(-1)) {
      invalidState();
    }
    expectedFrom = to;
    previousInstant = instant;
  }

  const lastTransition = state.history.at(-1);
  const phaseMatchesHistory =
    lastTransition === undefined
      ? state.phase === "check_in" && state.lastEventAt === state.startedAt
      : lastTransition.to === state.phase &&
        lastTransition.at === state.lastEventAt;
  const statusMatchesPhase =
    (state.phase === "finished" && state.status === "finished") ||
    (state.phase === "on_break" && state.status === "on_break") ||
    (state.phase !== "finished" &&
      state.phase !== "on_break" &&
      state.status === "active");
  const coreRequired =
    state.phase === "correct_or_reteach" ||
    state.phase === "schedule_future_review" ||
    state.phase === "break_continue_or_finish" ||
    state.phase === "on_break" ||
    state.phase === "finished";
  const validCoreDirective =
    state.coreDirective === "correct" || state.coreDirective === "reteach";

  if (
    !phaseMatchesHistory ||
    !statusMatchesPhase ||
    state.cycleNumber !== expectedCycleNumber ||
    (coreRequired && (!observedCoreHandoff || !validCoreDirective))
  ) {
    invalidState();
  }
}

function assertCalendarDate(value: string): void {
  if (!CALENDAR_DATE.test(value)) {
    throw new SessionTransitionError(
      "invalid_review_date",
      "Review dates must use the calendar-date form YYYY-MM-DD.",
    );
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new SessionTransitionError(
      "invalid_review_date",
      "Review date is not a real calendar date.",
    );
  }
}

function nextPhaseFor(
  state: StudySessionState,
  event: SessionEvent,
): {
  readonly phase: SessionPhase;
  readonly cycleNumber: number;
  readonly status: StudySessionState["status"];
} {
  switch (state.phase) {
    case "check_in":
      return {
        phase: "retrieve_prior_knowledge",
        cycleNumber: state.cycleNumber,
        status: "active",
      };
    case "retrieve_prior_knowledge":
      return {
        phase: "teach_visually",
        cycleNumber: state.cycleNumber,
        status: "active",
      };
    case "teach_visually":
      return {
        phase: "guided_practice",
        cycleNumber: state.cycleNumber,
        status: "active",
      };
    case "guided_practice":
      return {
        phase: "independent_attempt",
        cycleNumber: state.cycleNumber,
        status: "active",
      };
    case "independent_attempt":
      return {
        phase: "confidence_check",
        cycleNumber: state.cycleNumber,
        status: "active",
      };
    case "confidence_check":
      return {
        phase: "correct_or_reteach",
        cycleNumber: state.cycleNumber,
        status: "active",
      };
    case "correct_or_reteach":
      return {
        phase: "schedule_future_review",
        cycleNumber: state.cycleNumber,
        status: "active",
      };
    case "schedule_future_review":
      return {
        phase: "break_continue_or_finish",
        cycleNumber: state.cycleNumber,
        status: "active",
      };
    case "break_continue_or_finish": {
      if (
        event.type !== "pacing_disposition_recorded" ||
        event.disposition === "finish"
      ) {
        return {
          phase: "finished",
          cycleNumber: state.cycleNumber,
          status: "finished",
        };
      }
      if (event.disposition === "break") {
        return {
          phase: "on_break",
          cycleNumber: state.cycleNumber,
          status: "on_break",
        };
      }
      return {
        phase: "check_in",
        cycleNumber: state.cycleNumber + 1,
        status: "active",
      };
    }
    case "on_break":
      return {
        phase: "check_in",
        cycleNumber: state.cycleNumber + 1,
        status: "active",
      };
    case "finished":
      return {
        phase: "finished",
        cycleNumber: state.cycleNumber,
        status: "finished",
      };
  }
}

export function createStudySession(
  input: CreateStudySessionInput,
): StudySessionState {
  if (!OPAQUE_SESSION_REF.test(input.sessionRef)) {
    throw new SessionTransitionError(
      "invalid_session_ref",
      "sessionRef must be an opaque 1-64 character reference.",
    );
  }
  parseOffsetTimestamp(input.startedAt);

  return {
    schemaVersion: "provisional-study-session.v1",
    sessionRef: input.sessionRef,
    phase: "check_in",
    status: "active",
    cycleNumber: 1,
    startedAt: input.startedAt,
    lastEventAt: input.startedAt,
    history: [],
  };
}

export function allowedEventFor(
  state: StudySessionState,
): SessionEvent["type"] | null {
  return state.phase === "finished" ? null : EXPECTED_EVENT[state.phase];
}

export function advanceStudySession(
  state: StudySessionState,
  event: SessionEvent,
): StudySessionState {
  assertStateIntegrity(state);
  if (state.phase === "finished") {
    throw new SessionTransitionError(
      "session_finished",
      "A finished study session cannot be advanced.",
    );
  }

  const expected = EXPECTED_EVENT[state.phase];
  if (event.type !== expected) {
    throw new SessionTransitionError(
      "invalid_transition",
      `Phase ${state.phase} accepts only ${expected}.`,
    );
  }

  const eventInstant = parseOffsetTimestamp(event.at);
  const lastInstant = parseOffsetTimestamp(state.lastEventAt);
  if (eventInstant < lastInstant) {
    throw new SessionTransitionError(
      "event_before_session",
      "Session events must be chronological.",
    );
  }

  if (event.type === "review_scheduled") {
    assertCalendarDate(event.reviewDate);
  }
  if (
    event.type === "confidence_check_completed" &&
    event.coreDirective !== "correct" &&
    event.coreDirective !== "reteach"
  ) {
    throw new SessionTransitionError(
      "invalid_core_directive",
      "Instructional direction must come from the tutor core as correct or reteach.",
    );
  }
  if (
    event.type === "pacing_disposition_recorded" &&
    event.disposition !== "break" &&
    event.disposition !== "continue" &&
    event.disposition !== "finish"
  ) {
    throw new SessionTransitionError(
      "invalid_disposition",
      "Pacing disposition must be break, continue, or finish.",
    );
  }

  const next = nextPhaseFor(state, event);
  const transition = {
    at: event.at,
    event: event.type,
    from: state.phase,
    to: next.phase,
  } as const;

  return {
    ...state,
    phase: next.phase,
    cycleNumber: next.cycleNumber,
    status: next.status,
    lastEventAt: event.at,
    ...(event.type === "confidence_check_completed"
      ? { coreDirective: event.coreDirective }
      : {}),
    ...(event.type === "review_scheduled"
      ? { scheduledReviewDate: event.reviewDate }
      : {}),
    ...(event.type === "pacing_disposition_recorded"
      ? { lastDisposition: event.disposition }
      : {}),
    history: [...state.history, transition],
  };
}

export function replayStudySession(
  input: CreateStudySessionInput,
  events: readonly SessionEvent[],
): StudySessionState {
  return events.reduce(advanceStudySession, createStudySession(input));
}
