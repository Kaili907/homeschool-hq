import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { BreakScreen } from "../../ui/BreakScreen";
import { ComfortPanel } from "../../ui/ComfortPanel";
import { JarvisCore, type JarvisActivity, type JarvisVoiceMode } from "../../ui/JarvisCore";
import { LearnerActions, type LearnerAction } from "../../ui/LearnerActions";
import { ReflectionCheck } from "../../ui/ReflectionCheck";
import { ResumeLessonCard } from "../../ui/ResumeLessonCard";
import { SegmentProgress } from "../../ui/SegmentProgress";
import { SessionTimer } from "../../ui/SessionTimer";
import { TeachingBoard } from "../../ui/TeachingBoard";
import {
  LEARNING_SEGMENTS,
  SEGMENT_INDEX,
  SESSION_DEFINITIONS,
  type LearningSegmentId,
  type SegmentDefinition,
  type SubjectId,
} from "./content";
import {
  getActiveSession,
  hydrateWorkspace,
  persistWorkspace,
  segmentStep,
  studyReducer,
  type StudyAction,
  type StudyPreferences,
  type StudySession,
  type StudyWorkspace,
  type TranscriptEntry,
} from "./sessionStore";

const CHECK_IN_OPTIONS = [
  { value: "ready", label: "Ready to begin", detail: "I can start with the warm-up." },
  { value: "gentle", label: "I need a gentle start", detail: "Keep directions extra short." },
  { value: "low-energy", label: "My energy is low", detail: "Use a calm pace and easy breaks." },
  { value: "unsure", label: "I’m not sure yet", detail: "Let me settle in as we begin." },
] as const;

const HELP_RESPONSES: Record<
  Exclude<
    LearnerAction,
    | "Show me another way"
    | "Give me a different example"
    | "I need a break"
    | "Read this to me"
    | "Let me answer aloud"
  >,
  (segment: SegmentDefinition) => string
> = {
  "I need help": (segment) => segment.hint,
  "Talk me through it": (segment) =>
    `First, focus on one clue or relationship. Then test it against the whole problem. ${segment.hint}`,
  "Let’s do one together": (segment) =>
    `We can share the next move. I’ll point to the useful clue: ${segment.hint}`,
  "This is too easy": () =>
    "Thanks for telling me. Finish this quick check, and I’ll mark that you’re ready for more challenge.",
  "This is too hard": (segment) =>
    `Thanks for saying so. We can make the next move smaller. ${segment.hint}`,
  "Continue independently": () =>
    "You’ve got the controls. I’ll stay quiet and keep the help choices ready.",
};

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export function App() {
  const [workspace, dispatch] = useReducer(
    studyReducer,
    undefined,
    () => hydrateWorkspace(),
  );
  const workspaceRef = useRef(workspace);
  const activeSession = getActiveSession(workspace);
  const [storageAvailable] = useState(() => canUseLocalStorage());

  useEffect(() => {
    workspaceRef.current = workspace;
    persistWorkspace(workspace);
  }, [workspace]);

  useEffect(() => {
    const saveLatest = () => persistWorkspace(workspaceRef.current);
    window.addEventListener("beforeunload", saveLatest);
    return () => window.removeEventListener("beforeunload", saveLatest);
  }, []);

  const appStyle = {
    "--text-scale": workspace.preferences.textScale,
  } as CSSProperties;

  return (
    <div
      className="app-shell"
      data-motion={workspace.preferences.motionMode}
      data-testid="study-ux-app"
      style={appStyle}
    >
      {!storageAvailable ? (
        <div className="storage-warning" role="alert">
          Local recovery is unavailable in this browser. You can keep learning, but keep
          this page open so your current draft stays here.
        </div>
      ) : null}
      {activeSession ? (
        <SessionExperience
          dispatch={dispatch}
          preferences={workspace.preferences}
          session={activeSession}
        />
      ) : (
        <HomeScreen
          dispatch={dispatch}
          storageAvailable={storageAvailable}
          workspace={workspace}
        />
      )}
    </div>
  );
}

function HomeScreen({
  workspace,
  dispatch,
  storageAvailable,
}: {
  readonly workspace: StudyWorkspace;
  readonly dispatch: React.Dispatch<StudyAction>;
  readonly storageAvailable: boolean;
}) {
  const start = (subjectId: SubjectId) =>
    dispatch({ type: "start_or_resume", subjectId, at: nowIso() });

  return (
    <>
      <header className="home-header">
        <BrandMark />
        <div className="home-header__actions">
          <span className="local-save-status">
            <span aria-hidden="true">●</span>{" "}
            {storageAvailable ? "Local save ready" : "Memory only"}
          </span>
          <ComfortPanel
            onAudioChange={(mode) => dispatch({ type: "set_audio_mode", mode })}
            onCaptionsChange={(enabled) =>
              dispatch({ type: "set_caption_mode", enabled })
            }
            onMotionChange={(mode) => dispatch({ type: "set_motion_mode", mode })}
            onResetDemo={() => dispatch({ type: "reset_demo" })}
            onTextScaleChange={(scale) => dispatch({ type: "set_text_scale", scale })}
            onTranscriptChange={(open) =>
              dispatch({ type: "set_transcript_open", open })
            }
            preferences={workspace.preferences}
          />
        </div>
      </header>

      <main className="home-main" id="main-content" tabIndex={-1}>
        <section className="daily-hero" aria-labelledby="daily-heading">
          <div>
            <p className="eyebrow">Your learning console</p>
            <h1 id="daily-heading">
              Today’s goal: <span>one clear step at a time.</span>
            </h1>
            <p>
              Choose one short session. Your progress is based on completed learning
              segments—not minutes on a clock.
            </p>
          </div>
          <div className="daily-hero__signal" aria-label="Six learning segments">
            <strong>6</strong>
            <span>short learning segments</span>
          </div>
        </section>

        {workspace.dayFinished ? (
          <section className="day-finished" role="status">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>You chose to finish for today.</strong>
              <p>Your completed work is safe on this device.</p>
            </div>
          </section>
        ) : null}

        {(["math", "reading"] as const).map((subjectId) => {
          const session = workspace.sessions[subjectId];
          if (session?.status !== "saved") return null;
          return (
            <ResumeLessonCard
              definition={SESSION_DEFINITIONS[subjectId]}
              key={`resume-${subjectId}`}
              onResume={() => start(subjectId)}
              session={session}
            />
          );
        })}

        <section className="lesson-picker" aria-labelledby="lesson-picker-heading">
          <div className="section-heading">
            <p className="eyebrow">Daily goal</p>
            <h2 id="lesson-picker-heading">Choose today’s session</h2>
          </div>
          <div className="lesson-grid">
            {(["math", "reading"] as const).map((subjectId) => {
              const definition = SESSION_DEFINITIONS[subjectId];
              const session = workspace.sessions[subjectId];
              const completed = session?.status === "finished";
              const resumable = session?.status === "saved";
              return (
                <article className="lesson-card" data-subject={subjectId} key={subjectId}>
                  <div className="lesson-card__topline">
                    <span>{definition.gradeBand}</span>
                    <span>{definition.estimatedMinutes} min optional timer</span>
                  </div>
                  <p className="eyebrow">{definition.subject}</p>
                  <h3>{definition.lessonTitle}</h3>
                  <p className="lesson-card__goal">{definition.dailyGoal}</p>
                  <p>{definition.goalDetail}</p>
                  <ul aria-label={`${definition.subject} session includes`}>
                    <li>Short visual instruction</li>
                    <li>Practice together</li>
                    <li>Independent try + exit ticket</li>
                  </ul>
                  <button
                    className={subjectId === "math" ? "primary-button" : "secondary-button"}
                    disabled={completed}
                    onClick={() => start(subjectId)}
                    type="button"
                  >
                    {completed
                      ? "Session complete"
                      : resumable
                        ? "Resume session"
                        : `Start ${definition.subject.toLowerCase()}`}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="privacy-note">
          <span aria-hidden="true">⌁</span>
          <p>
            <strong>Local prototype:</strong> answers stay in this browser’s mock storage.
            There is no sign-in, account, database, or cloud upload.
          </p>
        </section>
      </main>
    </>
  );
}

function SessionExperience({
  session,
  preferences,
  dispatch,
}: {
  readonly session: StudySession;
  readonly preferences: StudyPreferences;
  readonly dispatch: React.Dispatch<StudyAction>;
}) {
  const definition = SESSION_DEFINITIONS[session.subjectId];
  const segment = definition.segments[session.currentSegment];
  const [jarvisMessage, setJarvisMessage] = useState(
    session.screen === "check-in"
      ? `Today’s goal is ${definition.dailyGoal} Tell me how you’re arriving.`
      : segment.instruction,
  );
  const [jarvisActivity, setJarvisActivity] = useState<JarvisActivity>("idle");
  const [runtimeVoiceFailed, setRuntimeVoiceFailed] = useState(false);
  const [voiceInputAvailable, setVoiceInputAvailable] = useState(false);
  const answerInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const speechTimerRef = useRef<number | null>(null);

  const speechAvailable = useMemo(() => {
    if (runtimeVoiceFailed || typeof window === "undefined") return false;
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }, [runtimeVoiceFailed]);

  useEffect(() => {
    setVoiceInputAvailable(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  useEffect(() => {
    if (!session.timer.running || session.screen === "break") return;
    const interval = window.setInterval(() => {
      dispatch({ type: "tick_timer", at: nowIso() });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [dispatch, session.screen, session.timer.running]);

  useEffect(() => {
    if (session.breakState?.returnCountdown === null || !session.breakState) return;
    const interval = window.setInterval(() => {
      dispatch({ type: "tick_return_countdown", at: nowIso() });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [dispatch, session.breakState]);

  useEffect(() => {
    const focusMain = window.requestAnimationFrame(() => {
      document.getElementById("main-content")?.focus();
    });
    return () => window.cancelAnimationFrame(focusMain);
  }, [session.currentSegment, session.screen]);

  useEffect(() => {
    if (session.screen === "learning") {
      setJarvisMessage(segment.instruction);
      setJarvisActivity("idle");
      dispatch({
        type: "add_transcript",
        entry: {
          id: `intro:${session.sessionId}:${segment.id}`,
          speaker: "Jarvis",
          text: `${segment.title}. ${segment.instruction}`,
          at: nowIso(),
        },
      });
    } else if (session.screen === "decision") {
      setJarvisMessage(
        "You completed all six learning segments. Choose a break, another lesson, or finish for today.",
      );
      setJarvisActivity("idle");
    }
  }, [
    dispatch,
    segment.id,
    segment.instruction,
    segment.title,
    session.screen,
    session.sessionId,
  ]);

  useEffect(
    () => () => {
      if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  const voiceMode: JarvisVoiceMode =
    preferences.audioMode === "off"
      ? "no-audio"
      : speechAvailable
        ? "available"
        : "unavailable";

  const addTranscript = (
    speaker: TranscriptEntry["speaker"],
    text: string,
    id = uniqueId(speaker.toLowerCase()),
  ) => {
    dispatch({
      type: "add_transcript",
      entry: { id, speaker, text, at: nowIso() },
    });
  };

  const announceJarvis = (text: string, speak = false) => {
    setJarvisMessage(text);
    addTranscript("Jarvis", text);

    if (!speak || preferences.audioMode === "off" || !speechAvailable) {
      setJarvisActivity("idle");
      return false;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.onstart = () => setJarvisActivity("speaking");
      utterance.onend = () => setJarvisActivity("idle");
      utterance.onerror = () => {
        setRuntimeVoiceFailed(true);
        setJarvisActivity("offline");
        setJarvisMessage(
          "Voice stopped working, but every instruction is still available as text.",
        );
      };
      window.speechSynthesis.speak(utterance);
      setJarvisActivity("speaking");
      if (speechTimerRef.current !== null) window.clearTimeout(speechTimerRef.current);
      speechTimerRef.current = window.setTimeout(
        () => setJarvisActivity("idle"),
        Math.max(1600, Math.min(5200, text.length * 42)),
      );
      return true;
    } catch {
      setRuntimeVoiceFailed(true);
      setJarvisActivity("offline");
      setJarvisMessage(
        "Voice is unavailable right now. Your work is safe, and the same guidance is on screen.",
      );
      return false;
    }
  };

  const requestBreak = () =>
    dispatch({
      type: "request_break",
      at: nowIso(),
      eventId: uniqueId(`break-requested:${session.sessionId}`),
    });

  const handleLearnerAction = (action: LearnerAction) => {
    addTranscript("Learner", action);

    if (action === "I need a break") {
      requestBreak();
      return;
    }
    if (action === "Show me another way") {
      announceJarvis(segment.anotherWay);
      return;
    }
    if (action === "Give me a different example") {
      announceJarvis(segment.differentExample);
      return;
    }
    if (action === "Read this to me") {
      const didSpeak = announceJarvis(segment.readAloudText, true);
      if (!didSpeak) {
        setJarvisMessage(
          preferences.audioMode === "off"
            ? "No-audio mode is on. The full instruction is available here and on the teaching board."
            : "Voice is unavailable on this device. The full instruction is available here and on the teaching board.",
        );
      }
      return;
    }
    if (action === "Let me answer aloud") {
      startVoiceAnswer({
        segment,
        input: answerInputRef.current,
        onUnavailable: () => {
          setJarvisActivity("offline");
          announceJarvis(
            "Voice answers are unavailable here. Your typed draft is ready, and nothing was lost.",
          );
          answerInputRef.current?.focus();
        },
        onListening: () => {
          setJarvisActivity("listening");
          setJarvisMessage("I’m listening. Say your answer, then review the words before continuing.");
        },
        onResult: (text) => {
          addTranscript("Learner", `Spoken draft: ${text}`);
          if (
            segment.responseKind === "short-text" ||
            segment.responseKind === "long-text"
          ) {
            dispatch({
              type: "set_answer",
              segment: segment.id,
              value: text,
              at: nowIso(),
            });
            announceJarvis(
              "I placed that spoken draft in the answer box. Review or edit it before you continue.",
            );
          } else {
            announceJarvis(
              `I heard “${text}.” Review the choices and select the one that matches what you said.`,
            );
          }
          answerInputRef.current?.focus();
        },
        onError: () => {
          setJarvisActivity("offline");
          announceJarvis(
            "I couldn’t capture that answer. Your typed work is still here, so you can continue without audio.",
          );
          answerInputRef.current?.focus();
        },
      });
      return;
    }

    announceJarvis(HELP_RESPONSES[action](segment));
  };

  if (session.screen === "break" && session.breakState) {
    return (
      <>
        <header className="break-header">
          <BrandMark />
          <span>Instructional time paused</span>
        </header>
        {session.showRecoveryNotice ? (
          <RecoveryNotice
            dispatch={dispatch}
            returnLabel={`${definition.segments[session.currentSegment].navLabel} break`}
            session={session}
          />
        ) : null}
        <BreakScreen
          breakState={session.breakState}
          onChooseActivity={(activity) =>
            dispatch({ type: "choose_break_activity", activity, at: nowIso() })
          }
          onStartReturn={() =>
            dispatch({ type: "start_return_countdown", at: nowIso() })
          }
          segmentLabel={
            session.breakState.returnScreen === "decision"
              ? "session choices"
              : definition.segments[session.currentSegment].navLabel
          }
        />
      </>
    );
  }

  return (
    <>
      <SessionHeader
        definition={definition}
        dispatch={dispatch}
        preferences={preferences}
        session={session}
      />

      {session.screen === "check-in" ? (
        <CheckInScreen
          definition={definition}
          dispatch={dispatch}
          jarvisMessage={jarvisMessage}
          preferences={preferences}
          session={session}
          voiceMode={voiceMode}
        />
      ) : session.screen === "decision" ? (
        <DecisionScreen
          definition={definition}
          dispatch={dispatch}
          jarvisMessage={jarvisMessage}
          preferences={preferences}
          session={session}
          voiceMode={voiceMode}
        />
      ) : (
        <main className="session-main" id="main-content" tabIndex={-1}>
          {session.showRecoveryNotice ? (
            <RecoveryNotice
              dispatch={dispatch}
              returnLabel={segment.navLabel}
              session={session}
            />
          ) : null}

          <SegmentProgress
            completedSegments={session.completedSegments}
            currentSegment={session.currentSegment}
            definition={definition}
          />

          <div className="session-toolbar">
            <SessionTimer
              onToggle={() => dispatch({ type: "toggle_timer", at: nowIso() })}
              timer={session.timer}
            />
            <p>
              <strong>{session.completedSegments.length} of 6</strong> learning segments
              complete
            </p>
          </div>

          <div className="study-grid">
            <aside className="jarvis-column" aria-label="Jarvis learning support">
              <JarvisCore
                activity={jarvisActivity}
                currentUtterance={
                  preferences.captions || voiceMode !== "available"
                    ? jarvisMessage
                    : "Captions are off. Turn them on in Comfort & access at any time."
                }
                motionMode={preferences.motionMode}
                onTranscriptOpenChange={(open) =>
                  dispatch({ type: "set_transcript_open", open })
                }
                statusText={
                  jarvisActivity === "speaking"
                    ? "Speaking — captions are available"
                    : undefined
                }
                transcript={<TranscriptList entries={session.transcript} />}
                transcriptOpen={preferences.transcriptOpen}
                voiceMode={voiceMode}
              />
              <LearnerActions
                onAction={handleLearnerAction}
                voiceInputAvailable={voiceInputAvailable}
              />
            </aside>

            <TaskPanel
              answerInputRef={answerInputRef}
              dispatch={dispatch}
              segment={segment}
              session={session}
              subjectId={session.subjectId}
              onJarvisMessage={announceJarvis}
            />
          </div>

          <SavedLearningDetails session={session} />
        </main>
      )}
    </>
  );
}

function SessionHeader({
  definition,
  session,
  preferences,
  dispatch,
}: {
  readonly definition: (typeof SESSION_DEFINITIONS)[SubjectId];
  readonly session: StudySession;
  readonly preferences: StudyPreferences;
  readonly dispatch: React.Dispatch<StudyAction>;
}) {
  return (
    <header className="session-header">
      <BrandMark compact />
      <div className="session-header__goal">
        <span>Today’s goal</span>
        <strong>{definition.dailyGoal}</strong>
      </div>
      <div className="session-header__actions">
        <button
          className="save-exit-button"
          onClick={() => dispatch({ type: "save_and_exit", at: nowIso() })}
          type="button"
        >
          Save &amp; exit
        </button>
        <ComfortPanel
          onAudioChange={(mode) => dispatch({ type: "set_audio_mode", mode })}
          onCaptionsChange={(enabled) => dispatch({ type: "set_caption_mode", enabled })}
          onMotionChange={(mode) => dispatch({ type: "set_motion_mode", mode })}
          onResetDemo={() => dispatch({ type: "reset_demo" })}
          onTextScaleChange={(scale) => dispatch({ type: "set_text_scale", scale })}
          onTimerModeChange={(mode) =>
            dispatch({ type: "set_timer_mode", mode, at: nowIso() })
          }
          onTranscriptChange={(open) =>
            dispatch({ type: "set_transcript_open", open })
          }
          preferences={preferences}
          timerMode={session.timer.mode}
        />
      </div>
    </header>
  );
}

function CheckInScreen({
  definition,
  session,
  preferences,
  voiceMode,
  jarvisMessage,
  dispatch,
}: {
  readonly definition: (typeof SESSION_DEFINITIONS)[SubjectId];
  readonly session: StudySession;
  readonly preferences: StudyPreferences;
  readonly voiceMode: JarvisVoiceMode;
  readonly jarvisMessage: string;
  readonly dispatch: React.Dispatch<StudyAction>;
}) {
  const [selection, setSelection] = useState(session.checkIn ?? "");

  return (
    <main className="check-in-main" id="main-content" tabIndex={-1}>
      {session.showRecoveryNotice ? (
        <RecoveryNotice
          dispatch={dispatch}
          returnLabel="your check-in"
          session={session}
        />
      ) : null}
      <section className="goal-card">
        <p className="eyebrow">Daily goal</p>
        <h1>{definition.dailyGoal}</h1>
        <p>{definition.goalDetail}</p>
        <div className="goal-card__meta">
          <span>{definition.gradeBand}</span>
          <span>{definition.estimatedMinutes}-minute optional timer</span>
          <span>6 learning segments</span>
        </div>
      </section>

      <div className="check-in-grid">
        <JarvisCore
          activity="idle"
          currentUtterance={jarvisMessage}
          motionMode={preferences.motionMode}
          voiceMode={voiceMode}
        />
        <form
          className="check-in-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selection) return;
            dispatch({ type: "complete_check_in", value: selection, at: nowIso() });
          }}
        >
          <p className="eyebrow">Check-in</p>
          <h2>How are you arriving today?</h2>
          <p>Choose what feels closest. This will not affect a score.</p>
          <fieldset className="check-in-options">
            <legend className="sr-only">Choose your check-in</legend>
            {CHECK_IN_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  checked={selection === option.value}
                  name="check-in"
                  onChange={() => {
                    setSelection(option.value);
                    dispatch({
                      type: "set_check_in_draft",
                      value: option.value,
                      at: nowIso(),
                    });
                  }}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <button className="primary-button" disabled={!selection} type="submit">
            Begin warm-up
          </button>
          <p className="form-note">The timer begins after this check-in and can be hidden.</p>
        </form>
      </div>
    </main>
  );
}

function TaskPanel({
  segment,
  session,
  subjectId,
  dispatch,
  onJarvisMessage,
  answerInputRef,
}: {
  readonly segment: SegmentDefinition;
  readonly session: StudySession;
  readonly subjectId: SubjectId;
  readonly dispatch: React.Dispatch<StudyAction>;
  readonly onJarvisMessage: (text: string, speak?: boolean) => boolean;
  readonly answerInputRef: React.MutableRefObject<
    HTMLInputElement | HTMLTextAreaElement | null
  >;
}) {
  const answer = session.answers[segment.id] ?? "";
  const feedback = session.feedback[segment.id];
  const reflectionComplete = Boolean(
    session.reflection.confidence &&
      session.reflection.effort &&
      session.reflection.frustration,
  );
  const responseReady =
    segment.responseKind === "reflection" ? reflectionComplete : answer.trim().length > 0;

  const validate = (event: FormEvent) => {
    event.preventDefault();
    if (!responseReady) return;

    let correct = true;
    if (segment.expectedAnswer) {
      correct = normalizeAnswer(answer) === normalizeAnswer(segment.expectedAnswer);
    } else if (segment.minLength) {
      correct = answer.trim().length >= segment.minLength;
    }

    dispatch({
      type: "set_feedback",
      segment: segment.id,
      value: correct ? "success" : "retry",
      at: nowIso(),
    });
    onJarvisMessage(correct ? segment.successMessage : segment.hint);
  };

  const continueToNext = () => {
    dispatch({
      type: "complete_segment",
      segment: segment.id,
      at: nowIso(),
    });
  };

  return (
    <section className="task-panel" aria-labelledby="segment-title">
      <div className="task-panel__step">
        <span>
          Step {segmentStep(segment.id)} of {LEARNING_SEGMENTS.length}
        </span>
        <span>{segment.navLabel}</span>
      </div>
      <p className="eyebrow">{segment.eyebrow}</p>
      <h1 id="segment-title">{segment.title}</h1>
      <p className="task-panel__instruction">{segment.instruction}</p>

      <TeachingBoard segment={segment} subjectId={subjectId} />

      <form className="response-card" onSubmit={validate}>
        {segment.responseKind === "reflection" ? (
          <>
            <h2>{segment.prompt}</h2>
            <ReflectionCheck
              onChange={(field, value) =>
                dispatch({ type: "set_reflection", field, value, at: nowIso() })
              }
              value={session.reflection}
            />
          </>
        ) : segment.responseKind === "choice" ? (
          <fieldset className="response-options">
            <legend>{segment.prompt}</legend>
            <div className="response-options__grid">
              {segment.choices?.map((choice) => {
                const id = `${segment.id}-${choice.value.replaceAll("/", "-")}`;
                return (
                  <label key={choice.value} htmlFor={id}>
                    <input
                      checked={answer === choice.value}
                      id={id}
                      name={`response-${segment.id}`}
                      onChange={() =>
                        dispatch({
                          type: "set_answer",
                          segment: segment.id,
                          value: choice.value,
                          at: nowIso(),
                        })
                      }
                      type="radio"
                      value={choice.value}
                    />
                    <span>
                      <strong>{choice.label}</strong>
                      {choice.detail ? <small>{choice.detail}</small> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <label className="text-response">
            <span>{segment.prompt}</span>
            {segment.responseKind === "long-text" ? (
              <textarea
                aria-describedby={`${segment.id}-draft-note`}
                onChange={(event) =>
                  dispatch({
                    type: "set_answer",
                    segment: segment.id,
                    value: event.target.value,
                    at: nowIso(),
                  })
                }
                placeholder={segment.placeholder}
                ref={(node) => {
                  answerInputRef.current = node;
                }}
                rows={5}
                value={answer}
              />
            ) : (
              <input
                aria-describedby={`${segment.id}-draft-note`}
                inputMode="text"
                onChange={(event) =>
                  dispatch({
                    type: "set_answer",
                    segment: segment.id,
                    value: event.target.value,
                    at: nowIso(),
                  })
                }
                placeholder={segment.placeholder}
                ref={(node) => {
                  answerInputRef.current = node;
                }}
                type="text"
                value={answer}
              />
            )}
            <small id={`${segment.id}-draft-note`}>
              Saved locally as you type. Voice drafts are never submitted automatically.
            </small>
          </label>
        )}

        {feedback ? (
          <div className="feedback-panel" data-state={feedback}>
            <span aria-hidden="true">{feedback === "success" ? "✓" : "↻"}</span>
            <div>
              <strong>{feedback === "success" ? "Ready for the next step" : "Try one more look"}</strong>
              <p>{feedback === "success" ? segment.successMessage : segment.hint}</p>
            </div>
          </div>
        ) : null}

        <div className="response-card__actions">
          {feedback === "success" ? (
            <button className="primary-button" onClick={continueToNext} type="button">
              {segment.id === "exit-ticket" ? "See session choices" : "Continue"}
            </button>
          ) : (
            <button className="primary-button" disabled={!responseReady} type="submit">
              {segment.responseKind === "reflection" ? "Save check-in" : "Check my response"}
            </button>
          )}
          <span>
            Your response is saved. You can pause or take a break before continuing.
          </span>
        </div>
      </form>
    </section>
  );
}

function DecisionScreen({
  definition,
  session,
  preferences,
  voiceMode,
  jarvisMessage,
  dispatch,
}: {
  readonly definition: (typeof SESSION_DEFINITIONS)[SubjectId];
  readonly session: StudySession;
  readonly preferences: StudyPreferences;
  readonly voiceMode: JarvisVoiceMode;
  readonly jarvisMessage: string;
  readonly dispatch: React.Dispatch<StudyAction>;
}) {
  return (
    <main className="decision-main" id="main-content" tabIndex={-1}>
      {session.showRecoveryNotice ? (
        <RecoveryNotice
          dispatch={dispatch}
          returnLabel="your session choices"
          session={session}
        />
      ) : null}
      <SegmentProgress
        completedSegments={session.completedSegments}
        currentSegment="exit-ticket"
        definition={definition}
      />
      <div className="decision-grid">
        <JarvisCore
          activity="idle"
          currentUtterance={jarvisMessage}
          motionMode={preferences.motionMode}
          onTranscriptOpenChange={(open) =>
            dispatch({ type: "set_transcript_open", open })
          }
          transcript={<TranscriptList entries={session.transcript} />}
          transcriptOpen={preferences.transcriptOpen}
          voiceMode={voiceMode}
        />
        <section className="decision-card">
          <span className="decision-card__mark" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">Exit ticket complete</p>
          <h1>You finished this learning cycle.</h1>
          <p>
            Your work is saved. Choose what your body and attention need next—there is no
            wrong choice.
          </p>
          <div className="decision-summary">
            <span>
              <strong>6 of 6</strong> learning segments
            </span>
            <span>
              <strong>{session.technicalInterruptionCount}</strong> technical interruptions
            </span>
            <span>
              <strong>{session.events.filter((event) => event.type === "break_returned").length}</strong>{" "}
              breaks returned from
            </span>
          </div>
          <div className="decision-actions" aria-label="Break, continue, or finish">
            <button
              className="secondary-button"
              onClick={() =>
                dispatch({
                  type: "record_pacing_decision",
                  decision: "break",
                  at: nowIso(),
                })
              }
              type="button"
            >
              Take a break
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                dispatch({
                  type: "record_pacing_decision",
                  decision: "continue",
                  at: nowIso(),
                })
              }
              type="button"
            >
              Continue with another lesson
            </button>
            <button
              className="primary-button"
              onClick={() =>
                dispatch({
                  type: "record_pacing_decision",
                  decision: "finish",
                  at: nowIso(),
                })
              }
              type="button"
            >
              Finish for today
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function RecoveryNotice({
  session,
  returnLabel,
  dispatch,
}: {
  readonly session: StudySession;
  readonly returnLabel: string;
  readonly dispatch: React.Dispatch<StudyAction>;
}) {
  return (
    <section className="recovery-notice" role="status" aria-labelledby="recovery-title">
      <span className="recovery-notice__icon" aria-hidden="true">
        ↻
      </span>
      <div>
        <strong id="recovery-title">Your exact step was restored.</strong>
        <p>
          We kept your work in {returnLabel}.{" "}
          {session.screen === "check-in"
            ? "The learning timer has not started."
            : "The optional timer is paused until you choose resume."}
        </p>
      </div>
      <button
        className="text-button"
        onClick={() => dispatch({ type: "dismiss_recovery" })}
        type="button"
      >
        Got it
      </button>
    </section>
  );
}

function TranscriptList({ entries }: { readonly entries: readonly TranscriptEntry[] }) {
  if (entries.length === 0) {
    return <p>No transcript entries yet. Instructions still appear on the teaching board.</p>;
  }
  return (
    <ol className="transcript-list">
      {entries.map((entry) => (
        <li data-speaker={entry.speaker} key={entry.id}>
          <strong>{entry.speaker}</strong>
          <span>{entry.text}</span>
        </li>
      ))}
    </ol>
  );
}

function SavedLearningDetails({ session }: { readonly session: StudySession }) {
  const currentCompletionCount = session.events.filter(
    (event) =>
      event.type === "segment_completed" && event.segment === session.currentSegment,
  ).length;
  return (
    <details className="saved-learning-details">
      <summary>Saved learning &amp; recovery details</summary>
      <dl>
        <div>
          <dt>Exact saved step</dt>
          <dd>
            Step {segmentStep(session.currentSegment)} — {session.currentSegment}
          </dd>
        </div>
        <div>
          <dt>Technical interruptions</dt>
          <dd data-testid="technical-interruption-count">
            {session.technicalInterruptionCount}
          </dd>
        </div>
        <div>
          <dt>Completion events for this step</dt>
          <dd data-testid="current-completion-event-count">{currentCompletionCount}</dd>
        </div>
        <div>
          <dt>Last local save</dt>
          <dd>{new Date(session.lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</dd>
        </div>
      </dl>
      <p>
        Learner breaks and technical interruptions are recorded separately. Repeated clicks
        cannot add the same segment completion twice.
      </p>
    </details>
  );
}

function BrandMark({ compact = false }: { readonly compact?: boolean }) {
  return (
    <div className="brand-mark" data-compact={compact}>
      <span className="brand-mark__symbol" aria-hidden="true">
        M
      </span>
      <span>
        <strong>Manuel Academy</strong>
        <small>Adaptive study console</small>
      </span>
    </div>
  );
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
}

function canUseLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  const probe = "manuel-academy.study-ux.storage-probe";
  try {
    window.localStorage.setItem(probe, "ready");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

interface SpeechRecognitionResultLike {
  readonly 0?: { readonly transcript?: string };
}

interface SpeechRecognitionEventLike {
  readonly results?: {
    readonly 0?: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function startVoiceAnswer({
  segment,
  input,
  onUnavailable,
  onListening,
  onResult,
  onError,
}: {
  readonly segment: SegmentDefinition;
  readonly input: HTMLInputElement | HTMLTextAreaElement | null;
  readonly onUnavailable: () => void;
  readonly onListening: () => void;
  readonly onResult: (text: string) => void;
  readonly onError: () => void;
}) {
  const Constructor = getSpeechRecognitionConstructor();
  if (!Constructor) {
    onUnavailable();
    return;
  }
  try {
    const recognition = new Constructor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript?.trim();
      if (text) onResult(text);
      else onError();
    };
    recognition.onerror = onError;
    recognition.onend = () => {
      input?.focus();
    };
    void segment;
    onListening();
    recognition.start();
  } catch {
    onError();
  }
}

export default App;
