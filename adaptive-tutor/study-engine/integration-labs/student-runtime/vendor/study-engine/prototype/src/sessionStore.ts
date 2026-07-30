import {
  LEARNING_SEGMENTS,
  SESSION_DEFINITIONS,
  getNextSegment,
  type LearningSegmentId,
  type SubjectId,
} from "./content";

export const STORAGE_KEY = "manuel-academy.study-ux.prototype.v1";
export const WORKSPACE_VERSION = "study-ux.workspace.v1" as const;

export type TimerMode = "visible" | "minimal" | "hidden";
export type MotionMode = "full" | "minimal" | "none";
export type AudioMode = "on" | "off";
export type SessionScreen = "check-in" | "learning" | "decision" | "break";
export type SessionStatus = "active" | "saved" | "finished";
export type PauseReason = "learner" | "break" | "technical" | null;
export type ReflectionField = "confidence" | "effort" | "frustration";
export type PacingDecision = "break" | "continue" | "finish";

export interface TimerState {
  readonly mode: TimerMode;
  readonly initialSeconds: number;
  readonly remainingSeconds: number;
  readonly running: boolean;
  readonly goalReached: boolean;
  readonly pauseReason: PauseReason;
}

export interface ReflectionState {
  readonly confidence?: string;
  readonly effort?: string;
  readonly frustration?: string;
}

export interface BreakState {
  readonly returnScreen: Exclude<SessionScreen, "break">;
  readonly returnSegment: LearningSegmentId;
  readonly timerWasRunning: boolean;
  readonly activity?: string;
  readonly returnCountdown: number | null;
}

export type StudyUxEventType =
  | "session_started"
  | "check_in_completed"
  | "segment_completed"
  | "break_requested"
  | "break_returned"
  | "timer_goal_reached"
  | "technical_interruption"
  | "intentional_save_exit"
  | "pacing_decision";

export interface StudyUxEvent {
  readonly id: string;
  readonly type: StudyUxEventType;
  readonly at: string;
  readonly segment?: LearningSegmentId;
  readonly detail?: string;
}

export interface TranscriptEntry {
  readonly id: string;
  readonly speaker: "Jarvis" | "Learner";
  readonly text: string;
  readonly at: string;
}

export interface StudySession {
  readonly sessionId: string;
  readonly subjectId: SubjectId;
  readonly status: SessionStatus;
  readonly screen: SessionScreen;
  readonly currentSegment: LearningSegmentId;
  readonly completedSegments: readonly LearningSegmentId[];
  readonly answers: Partial<Record<LearningSegmentId, string>>;
  readonly reflection: ReflectionState;
  readonly checkIn?: string;
  readonly feedback: Partial<Record<LearningSegmentId, "success" | "retry">>;
  readonly timer: TimerState;
  readonly breakState?: BreakState;
  readonly events: readonly StudyUxEvent[];
  readonly transcript: readonly TranscriptEntry[];
  readonly cleanExit: boolean;
  readonly runtimeId: string;
  readonly startedAt: string;
  readonly lastSavedAt: string;
  readonly technicalInterruptionCount: number;
  readonly showRecoveryNotice: boolean;
  readonly lastPacingDecision?: PacingDecision;
}

export interface StudyPreferences {
  readonly captions: boolean;
  readonly transcriptOpen: boolean;
  readonly audioMode: AudioMode;
  readonly motionMode: MotionMode;
  readonly textScale: 1 | 1.15 | 1.3;
}

export interface StudyWorkspace {
  readonly version: typeof WORKSPACE_VERSION;
  readonly activeSessionId?: SubjectId;
  readonly sessions: Partial<Record<SubjectId, StudySession>>;
  readonly preferences: StudyPreferences;
  readonly dayFinished: boolean;
}

export type StudyAction =
  | { readonly type: "start_or_resume"; readonly subjectId: SubjectId; readonly at: string }
  | { readonly type: "set_check_in_draft"; readonly value: string; readonly at: string }
  | { readonly type: "complete_check_in"; readonly value: string; readonly at: string }
  | {
      readonly type: "set_answer";
      readonly segment: LearningSegmentId;
      readonly value: string;
      readonly at: string;
    }
  | {
      readonly type: "set_reflection";
      readonly field: ReflectionField;
      readonly value: string;
      readonly at: string;
    }
  | {
      readonly type: "set_feedback";
      readonly segment: LearningSegmentId;
      readonly value: "success" | "retry";
      readonly at: string;
    }
  | { readonly type: "complete_segment"; readonly segment: LearningSegmentId; readonly at: string }
  | { readonly type: "request_break"; readonly at: string; readonly eventId: string }
  | { readonly type: "choose_break_activity"; readonly activity: string; readonly at: string }
  | { readonly type: "start_return_countdown"; readonly at: string }
  | { readonly type: "tick_return_countdown"; readonly at: string }
  | { readonly type: "toggle_timer"; readonly at: string }
  | { readonly type: "tick_timer"; readonly at: string }
  | { readonly type: "set_timer_mode"; readonly mode: TimerMode; readonly at: string }
  | { readonly type: "set_caption_mode"; readonly enabled: boolean }
  | { readonly type: "set_transcript_open"; readonly open: boolean }
  | { readonly type: "set_audio_mode"; readonly mode: AudioMode }
  | { readonly type: "set_motion_mode"; readonly mode: MotionMode }
  | { readonly type: "set_text_scale"; readonly scale: 1 | 1.15 | 1.3 }
  | { readonly type: "save_and_exit"; readonly at: string }
  | {
      readonly type: "record_pacing_decision";
      readonly decision: PacingDecision;
      readonly at: string;
    }
  | {
      readonly type: "add_transcript";
      readonly entry: TranscriptEntry;
    }
  | { readonly type: "dismiss_recovery" }
  | { readonly type: "reset_demo" };

const DEFAULT_PREFERENCES: StudyPreferences = {
  captions: true,
  transcriptOpen: false,
  audioMode: "on",
  motionMode: "full",
  textScale: 1,
};

export const RUNTIME_ID = createRuntimeId();

export function createRuntimeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `runtime-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyWorkspace(): StudyWorkspace {
  return {
    version: WORKSPACE_VERSION,
    sessions: {},
    preferences: DEFAULT_PREFERENCES,
    dayFinished: false,
  };
}

export function createSession(
  subjectId: SubjectId,
  at: string,
  runtimeId = RUNTIME_ID,
): StudySession {
  const definition = SESSION_DEFINITIONS[subjectId];
  return {
    sessionId: `${subjectId}-prototype-session`,
    subjectId,
    status: "active",
    screen: "check-in",
    currentSegment: "warm-up",
    completedSegments: [],
    answers: {},
    reflection: {},
    feedback: {},
    timer: {
      mode: "visible",
      initialSeconds: definition.estimatedMinutes * 60,
      remainingSeconds: definition.estimatedMinutes * 60,
      running: false,
      goalReached: false,
      pauseReason: null,
    },
    events: [
      {
        id: `session:${subjectId}`,
        type: "session_started",
        at,
      },
    ],
    transcript: [],
    cleanExit: false,
    runtimeId,
    startedAt: at,
    lastSavedAt: at,
    technicalInterruptionCount: 0,
    showRecoveryNotice: false,
  };
}

function activeSession(state: StudyWorkspace): StudySession | undefined {
  return state.activeSessionId ? state.sessions[state.activeSessionId] : undefined;
}

function updateActiveSession(
  state: StudyWorkspace,
  update: (session: StudySession) => StudySession,
): StudyWorkspace {
  const session = activeSession(state);
  if (!session || !state.activeSessionId) return state;
  const next = update(session);
  if (next === session) return state;
  return {
    ...state,
    sessions: {
      ...state.sessions,
      [state.activeSessionId]: next,
    },
  };
}

function appendEvent(session: StudySession, event: StudyUxEvent): StudySession {
  if (session.events.some((existing) => existing.id === event.id)) return session;
  return {
    ...session,
    events: [...session.events, event],
  };
}

function withLastSaved(session: StudySession, at: string): StudySession {
  return {
    ...session,
    lastSavedAt: at,
  };
}

export function studyReducer(state: StudyWorkspace, action: StudyAction): StudyWorkspace {
  switch (action.type) {
    case "start_or_resume": {
      const existing = state.sessions[action.subjectId];
      if (existing?.status === "finished") return state;
      const session = existing
        ? {
            ...existing,
            status: "active" as const,
            cleanExit: false,
            runtimeId: RUNTIME_ID,
            lastSavedAt: action.at,
            timer: {
              ...existing.timer,
              running: false,
              pauseReason: existing.timer.goalReached ? null : existing.timer.pauseReason,
            },
          }
        : createSession(action.subjectId, action.at);
      return {
        ...state,
        activeSessionId: action.subjectId,
        sessions: {
          ...state.sessions,
          [action.subjectId]: session,
        },
        dayFinished: false,
      };
    }

    case "set_check_in_draft":
      return updateActiveSession(state, (session) => {
        if (session.screen !== "check-in") return session;
        return withLastSaved(
          {
            ...session,
            checkIn: action.value,
          },
          action.at,
        );
      });

    case "complete_check_in":
      return updateActiveSession(state, (session) => {
        if (session.screen !== "check-in") return session;
        const next = appendEvent(
          {
            ...session,
            screen: "learning",
            checkIn: action.value,
            timer: {
              ...session.timer,
              running: true,
              pauseReason: null,
            },
          },
          {
            id: `check-in:${session.sessionId}`,
            type: "check_in_completed",
            at: action.at,
          },
        );
        return withLastSaved(next, action.at);
      });

    case "set_answer":
      return updateActiveSession(state, (session) =>
        withLastSaved(
          {
            ...session,
            answers: {
              ...session.answers,
              [action.segment]: action.value,
            },
            feedback: {
              ...session.feedback,
              [action.segment]: undefined,
            },
          },
          action.at,
        ),
      );

    case "set_reflection":
      return updateActiveSession(state, (session) =>
        withLastSaved(
          {
            ...session,
            reflection: {
              ...session.reflection,
              [action.field]: action.value,
            },
          },
          action.at,
        ),
      );

    case "set_feedback":
      return updateActiveSession(state, (session) =>
        withLastSaved(
          {
            ...session,
            feedback: {
              ...session.feedback,
              [action.segment]: action.value,
            },
          },
          action.at,
        ),
      );

    case "complete_segment":
      return updateActiveSession(state, (session) => {
        if (session.currentSegment !== action.segment || session.screen !== "learning") {
          return session;
        }
        const alreadyCompleted = session.completedSegments.includes(action.segment);
        const nextSegment = getNextSegment(action.segment);
        const nextEvent = appendEvent(session, {
          id: `complete:${session.sessionId}:${action.segment}`,
          type: "segment_completed",
          segment: action.segment,
          at: action.at,
        });
        return withLastSaved(
          {
            ...nextEvent,
            completedSegments: alreadyCompleted
              ? session.completedSegments
              : [...session.completedSegments, action.segment],
            currentSegment: nextSegment ?? action.segment,
            screen: nextSegment ? "learning" : "decision",
            timer: {
              ...session.timer,
              running: nextSegment ? session.timer.running : false,
              pauseReason: nextSegment ? session.timer.pauseReason : "learner",
            },
          },
          action.at,
        );
      });

    case "request_break":
      return updateActiveSession(state, (session) => {
        if (session.screen === "break") return session;
        const next = appendEvent(
          {
            ...session,
            screen: "break",
            breakState: {
              returnScreen: session.screen,
              returnSegment: session.currentSegment,
              timerWasRunning: session.timer.running,
              returnCountdown: null,
            },
            timer: {
              ...session.timer,
              running: false,
              pauseReason: "break",
            },
          },
          {
            id: action.eventId,
            type: "break_requested",
            segment: session.currentSegment,
            at: action.at,
          },
        );
        return withLastSaved(next, action.at);
      });

    case "choose_break_activity":
      return updateActiveSession(state, (session) => {
        if (!session.breakState) return session;
        return withLastSaved(
          {
            ...session,
            breakState: {
              ...session.breakState,
              activity: action.activity,
            },
          },
          action.at,
        );
      });

    case "start_return_countdown":
      return updateActiveSession(state, (session) => {
        if (!session.breakState?.activity) return session;
        return withLastSaved(
          {
            ...session,
            breakState: {
              ...session.breakState,
              returnCountdown: 5,
            },
          },
          action.at,
        );
      });

    case "tick_return_countdown":
      return updateActiveSession(state, (session) => {
        const breakState = session.breakState;
        if (!breakState || breakState.returnCountdown === null) return session;
        if (breakState.returnCountdown > 1) {
          return withLastSaved(
            {
              ...session,
              breakState: {
                ...breakState,
                returnCountdown: breakState.returnCountdown - 1,
              },
            },
            action.at,
          );
        }
        const eventId = `break-returned:${session.events.filter((event) => event.type === "break_returned").length + 1}`;
        const next = appendEvent(
          {
            ...session,
            screen: breakState.returnScreen,
            currentSegment: breakState.returnSegment,
            breakState: undefined,
            timer: {
              ...session.timer,
              running: breakState.timerWasRunning && !session.timer.goalReached,
              pauseReason: breakState.timerWasRunning ? null : "learner",
            },
          },
          {
            id: eventId,
            type: "break_returned",
            segment: breakState.returnSegment,
            at: action.at,
          },
        );
        return withLastSaved(next, action.at);
      });

    case "toggle_timer":
      return updateActiveSession(state, (session) => {
        if (session.screen === "break" || session.timer.goalReached) return session;
        const running = !session.timer.running;
        return withLastSaved(
          {
            ...session,
            timer: {
              ...session.timer,
              running,
              pauseReason: running ? null : "learner",
            },
          },
          action.at,
        );
      });

    case "tick_timer":
      return updateActiveSession(state, (session) => {
        if (!session.timer.running || session.timer.remainingSeconds <= 0) return session;
        const remainingSeconds = Math.max(0, session.timer.remainingSeconds - 1);
        const goalReached = remainingSeconds === 0;
        const base = {
          ...session,
          timer: {
            ...session.timer,
            remainingSeconds,
            running: goalReached ? false : session.timer.running,
            goalReached,
            pauseReason: goalReached ? null : session.timer.pauseReason,
          },
        };
        const next = goalReached
          ? appendEvent(base, {
              id: `timer-goal:${session.sessionId}`,
              type: "timer_goal_reached",
              segment: session.currentSegment,
              at: action.at,
            })
          : base;
        return withLastSaved(next, action.at);
      });

    case "set_timer_mode":
      return updateActiveSession(state, (session) =>
        withLastSaved(
          {
            ...session,
            timer: {
              ...session.timer,
              mode: action.mode,
            },
          },
          action.at,
        ),
      );

    case "set_caption_mode":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          captions: action.enabled,
        },
      };

    case "set_transcript_open":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          transcriptOpen: action.open,
        },
      };

    case "set_audio_mode":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          audioMode: action.mode,
        },
      };

    case "set_motion_mode":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          motionMode: action.mode,
        },
      };

    case "set_text_scale":
      return {
        ...state,
        preferences: {
          ...state.preferences,
          textScale: action.scale,
        },
      };

    case "save_and_exit": {
      const session = activeSession(state);
      if (!session || !state.activeSessionId) return state;
      const next = appendEvent(
        {
          ...session,
          status: "saved",
          cleanExit: true,
          timer: {
            ...session.timer,
            running: false,
            pauseReason: "learner",
          },
        },
        {
          id: `save-exit:${session.sessionId}:${session.events.filter((event) => event.type === "intentional_save_exit").length + 1}`,
          type: "intentional_save_exit",
          segment: session.currentSegment,
          at: action.at,
        },
      );
      return {
        ...state,
        activeSessionId: undefined,
        sessions: {
          ...state.sessions,
          [state.activeSessionId]: withLastSaved(next, action.at),
        },
      };
    }

    case "record_pacing_decision": {
      const session = activeSession(state);
      if (!session || !state.activeSessionId || session.screen !== "decision") return state;
      if (action.decision === "break") {
        return studyReducer(state, {
          type: "request_break",
          at: action.at,
          eventId: `break-requested:${session.sessionId}:${session.events.filter((event) => event.type === "break_requested").length + 1}`,
        });
      }
      const next = appendEvent(
        {
          ...session,
          status: "finished",
          cleanExit: true,
          lastPacingDecision: action.decision,
          timer: {
            ...session.timer,
            running: false,
            pauseReason: null,
          },
        },
        {
          id: `pacing:${session.sessionId}`,
          type: "pacing_decision",
          at: action.at,
          detail: action.decision,
        },
      );
      return {
        ...state,
        activeSessionId: undefined,
        sessions: {
          ...state.sessions,
          [state.activeSessionId]: withLastSaved(next, action.at),
        },
        dayFinished: action.decision === "finish",
      };
    }

    case "add_transcript":
      return updateActiveSession(state, (session) => {
        if (session.transcript.some((entry) => entry.id === action.entry.id)) return session;
        return {
          ...session,
          transcript: [...session.transcript, action.entry],
          lastSavedAt: action.entry.at,
        };
      });

    case "dismiss_recovery":
      return updateActiveSession(state, (session) => ({
        ...session,
        showRecoveryNotice: false,
      }));

    case "reset_demo":
      return createEmptyWorkspace();

    default:
      return state;
  }
}

export function hydrateWorkspace(
  storage: Pick<Storage, "getItem"> | undefined = browserStorage(),
  runtimeId = RUNTIME_ID,
  at = new Date().toISOString(),
): StudyWorkspace {
  if (!storage) return createEmptyWorkspace();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyWorkspace();
    const parsed = JSON.parse(raw) as StudyWorkspace;
    if (parsed.version !== WORKSPACE_VERSION || typeof parsed.sessions !== "object") {
      return createEmptyWorkspace();
    }

    let activeSessionId = parsed.activeSessionId;
    const sessions: Partial<Record<SubjectId, StudySession>> = {
      ...parsed.sessions,
    };
    if (activeSessionId) {
      const session = sessions[activeSessionId];
      if (!session || session.status !== "active") {
        activeSessionId = undefined;
      } else if (!session.cleanExit && session.runtimeId !== runtimeId) {
        const eventId = `technical:${session.sessionId}:${session.runtimeId}`;
        const alreadyRecorded = session.events.some((event) => event.id === eventId);
        const interrupted = appendEvent(
          {
            ...session,
            runtimeId,
            cleanExit: false,
            showRecoveryNotice: true,
            technicalInterruptionCount:
              session.technicalInterruptionCount + (alreadyRecorded ? 0 : 1),
            timer: {
              ...session.timer,
              running: false,
              pauseReason: "technical",
            },
            lastSavedAt: at,
          },
          {
            id: eventId,
            type: "technical_interruption",
            segment: session.currentSegment,
            at,
            detail: "Refresh, browser close, or connection interruption",
          },
        );
        sessions[activeSessionId] = interrupted;
      }
    }

    return {
      ...parsed,
      activeSessionId,
      sessions,
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...parsed.preferences,
      },
      dayFinished: Boolean(parsed.dayFinished),
    };
  } catch {
    return createEmptyWorkspace();
  }
}

export function persistWorkspace(
  state: StudyWorkspace,
  storage: Pick<Storage, "setItem"> | undefined = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The prototype remains usable when storage is blocked; the UI surfaces
    // persistence availability separately.
  }
}

export function getActiveSession(state: StudyWorkspace): StudySession | undefined {
  return activeSession(state);
}

export function segmentStep(segment: LearningSegmentId): number {
  return LEARNING_SEGMENTS.indexOf(segment) + 1;
}

export function segmentCompletionEventCount(
  session: StudySession,
  segment: LearningSegmentId,
): number {
  return session.events.filter(
    (event) => event.type === "segment_completed" && event.segment === segment,
  ).length;
}

export function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
