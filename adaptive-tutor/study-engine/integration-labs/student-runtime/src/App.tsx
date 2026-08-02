import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { BreakScreen } from "@study-ui/BreakScreen";
import { ComfortPanel } from "@study-ui/ComfortPanel";
import { JarvisCore, type JarvisVoiceMode } from "@study-ui/JarvisCore";
import {
  LearnerActions,
  type LearnerAction,
} from "@study-ui/LearnerActions";
import { ReflectionCheck } from "@study-ui/ReflectionCheck";
import { SegmentProgress } from "@study-ui/SegmentProgress";
import { SessionTimer } from "@study-ui/SessionTimer";
import { TeachingBoard } from "@study-ui/TeachingBoard";
import {
  LEARNING_SEGMENTS,
  SESSION_DEFINITIONS,
  type LearningSegmentId,
  type SegmentDefinition,
} from "@study-content";
import {
  allAdversarialProbesPass,
  runAdversarialProbes,
} from "./adversarial/probes";
import {
  canonicalSegmentId,
  createLocalSessionId,
  defaultParentPreferences,
} from "./catalog";
import { createResumeStore, type ResumeStore } from "./persistence/resumeStore";
import type {
  AdversarialProbeResult,
  ParentPreferenceInputV1,
  ResumeSummary,
  RuntimeSubjectId,
  RuntimeWorkspaceV1,
} from "./runtimeTypes";
import {
  applyParentPreferences,
  chooseBreakActivity,
  completeCheckIn,
  completeCurrentSegment,
  createRuntimeWorkspace,
  currentJarvisMessage,
  dismissRecovery,
  finishRuntimeSession,
  recoverAfterRefresh,
  recordLearnerSupportAction,
  requestBreak,
  resumeBreak,
  resumeSavedSession,
  saveAndExit,
  setReflectionValue,
  setResponseDraft,
  setTimerMode,
  setTranscriptOpen,
  submitCurrentResponse,
  tickRuntimeTimer,
  toggleTimer,
  validateResumeWorkspace,
  validateRuntimeWorkspaceIntegrity,
} from "./state/runtimeMachine";

type AppRoute = "home" | "session";

const CHECK_IN_OPTIONS = [
  {
    value: "ready",
    label: "Ready to begin",
    detail: "I can start with the warm-up.",
  },
  {
    value: "slow-start",
    label: "A slow start would help",
    detail: "Begin with one calm step.",
  },
  {
    value: "support-close",
    label: "Keep support close",
    detail: "Show hints and choices nearby.",
  },
] as const;

function hasSpeechInput() {
  if (typeof window === "undefined") return false;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
}

function hasSpeechOutput() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function BrandMark({ compact = false }: { readonly compact?: boolean }) {
  return (
    <div className="brand-mark" data-compact={compact}>
      <span className="brand-mark__symbol" aria-hidden="true">
        M
      </span>
      <span>
        <strong>Manuel Academy</strong>
        <small>Canonical student runtime lab</small>
      </span>
    </div>
  );
}

function IntegrationBadges() {
  return (
    <ul className="integration-badges" aria-label="Connected local packages">
      <li data-state="canonical">Card 1 · canonical v1</li>
      <li data-state="engine">Session 2 · live algorithms</li>
      <li data-state="ux">Session 3 · Study UX</li>
      <li data-state="policy">Card 5 · DEC-012 constraints</li>
      <li data-state="temporary">Session 6 · temporary bridge v2</li>
    </ul>
  );
}

function voiceModeFor(workspace: RuntimeWorkspaceV1): JarvisVoiceMode {
  if (workspace.parentPreferences.noAudio) return "no-audio";
  if (!hasSpeechOutput()) return "unavailable";
  return "available";
}

function TranscriptList({ workspace }: { readonly workspace: RuntimeWorkspaceV1 }) {
  return (
    <ol className="transcript-list">
      {workspace.transcript.map((entry) => (
        <li data-speaker={entry.speaker} key={entry.id}>
          <strong>{entry.speaker}</strong>
          <span>{entry.text}</span>
          <small>
            <span className="sr-only">Reason code: </span>
            {entry.reasonCode}
          </small>
        </li>
      ))}
    </ol>
  );
}

function AccessPanel({
  workspace,
  onWorkspace,
  onReset,
}: {
  readonly workspace: RuntimeWorkspaceV1;
  readonly onWorkspace: (workspace: RuntimeWorkspaceV1) => void;
  readonly onReset: () => void;
}) {
  const preferences = workspace.parentPreferences;
  const policy = workspace.durationPolicy;
  const manualReview = policy.status === "manual-review";
  const [accessNotice, setAccessNotice] = useState<string>();
  const setPreferences = (updates: Partial<ParentPreferenceInputV1>) => {
    onWorkspace(
      applyParentPreferences(workspace, {
        ...preferences,
        ...updates,
      }),
    );
  };
  const numberOrUndefined = (value: string) => {
    if (value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : undefined;
  };

  return (
    <div className="runtime-access-stack">
      <ComfortPanel
        onAudioChange={(mode) => setPreferences({ noAudio: mode === "off" })}
        onCaptionsChange={() =>
          setAccessNotice(
            "Captions stay on in this accessibility-first integration lab.",
          )
        }
        onMotionChange={(mode) =>
          setPreferences({ reducedMotion: mode !== "full" })
        }
        onResetDemo={onReset}
        onTextScaleChange={(scale) => setPreferences({ largeText: scale > 1 })}
        onTimerModeChange={(mode) => onWorkspace(setTimerMode(workspace, mode))}
        onTranscriptChange={(open) =>
          onWorkspace(setTranscriptOpen(workspace, open))
        }
        preferences={{
          captions: true,
          transcriptOpen: workspace.transcriptOpen,
          audioMode: preferences.noAudio ? "off" : "on",
          motionMode: preferences.reducedMotion ? "none" : "full",
          textScale: preferences.largeText ? 1.3 : 1,
        }}
        timerMode={preferences.timerMode}
      />
      {accessNotice ? (
        <p className="access-notice" role="status">
          {accessNotice}
        </p>
      ) : null}

      <details className="parent-settings">
        <summary aria-label="Parent and accommodation mock settings">
          <span className="desktop-action-label">
            Parent + accommodation mock settings
          </span>
          <span className="mobile-action-label" aria-hidden="true">
            Adult settings
          </span>
        </summary>
        <div className="parent-settings__body">
          <p>
            Local canonical controls resolved by the Card 5 constraint policy.
          </p>
          <label>
            <span>Parent hard maximum</span>
            <input
              inputMode="numeric"
              max={60}
              min={1}
              onChange={(event) =>
                setPreferences({
                  maximumDurationMinutes:
                    numberOrUndefined(event.target.value) ??
                    preferences.maximumDurationMinutes,
                })
              }
              type="number"
              value={preferences.maximumDurationMinutes}
            />
          </label>
          <div className="settings-row">
            <label>
              <span>Break minimum</span>
              <input
                min={1}
                onChange={(event) => {
                  const minimumMinutes =
                    numberOrUndefined(event.target.value) ??
                    preferences.breakRange.minimumMinutes;
                  setPreferences({
                    breakRange: {
                      minimumMinutes,
                      defaultMinutes: Math.max(
                        minimumMinutes,
                        preferences.breakRange.defaultMinutes,
                      ),
                      maximumMinutes: Math.max(
                        minimumMinutes,
                        preferences.breakRange.maximumMinutes,
                      ),
                    },
                  });
                }}
                type="number"
                value={preferences.breakRange.minimumMinutes}
              />
            </label>
            <label>
              <span>Break default</span>
              <input
                min={preferences.breakRange.minimumMinutes}
                onChange={(event) => {
                  const defaultMinutes =
                    numberOrUndefined(event.target.value) ??
                    preferences.breakRange.defaultMinutes;
                  setPreferences({
                    breakRange: {
                      ...preferences.breakRange,
                      defaultMinutes,
                      maximumMinutes: Math.max(
                        defaultMinutes,
                        preferences.breakRange.maximumMinutes,
                      ),
                    },
                  });
                }}
                type="number"
                value={preferences.breakRange.defaultMinutes}
              />
            </label>
            <label>
              <span>Break maximum</span>
              <input
                min={preferences.breakRange.defaultMinutes}
                onChange={(event) =>
                  setPreferences({
                    breakRange: {
                      ...preferences.breakRange,
                      maximumMinutes: Math.max(
                        preferences.breakRange.defaultMinutes,
                        numberOrUndefined(event.target.value) ??
                          preferences.breakRange.maximumMinutes,
                      ),
                    },
                  })
                }
                type="number"
                value={preferences.breakRange.maximumMinutes}
              />
            </label>
          </div>
          <label className="switch-row">
            <span>
              Required breaks
              <small>Insert the planned break without treating it as failure.</small>
            </span>
            <input
              checked={preferences.requiredBreaks}
              onChange={(event) =>
                setPreferences({ requiredBreaks: event.target.checked })
              }
              type="checkbox"
            />
          </label>
          <label className="switch-row">
            <span>
              Read aloud
              <small>Offer narration when audio is available.</small>
            </span>
            <input
              checked={preferences.readAloud}
              onChange={(event) =>
                setPreferences({ readAloud: event.target.checked })
              }
              type="checkbox"
            />
          </label>
          <label className="switch-row">
            <span>
              Speech input
              <small>Typing remains available when speech is unsupported.</small>
            </span>
            <input
              checked={preferences.speechInput}
              onChange={(event) =>
                setPreferences({ speechInput: event.target.checked })
              }
              type="checkbox"
            />
          </label>
          <label>
            <span>Parent manual override (optional minutes)</span>
            <input
              min={1}
              onChange={(event) =>
                setPreferences({
                  parentManualOverrideMinutes: numberOrUndefined(
                    event.target.value,
                  ),
                })
              }
              placeholder="None"
              type="number"
              value={preferences.parentManualOverrideMinutes ?? ""}
            />
          </label>
          <label>
            <span>Accommodation maximum (optional minutes)</span>
            <input
              min={1}
              onChange={(event) =>
                setPreferences({
                  accommodationMaximumMinutes: numberOrUndefined(
                    event.target.value,
                  ),
                })
              }
              placeholder="None"
              type="number"
              value={preferences.accommodationMaximumMinutes ?? ""}
            />
          </label>
          <div
            className="precedence-trace"
            data-state={manualReview ? "manual-review" : "resolved"}
            role="status"
          >
            <strong>
              {manualReview
                ? "No automatic duration target is active."
                : `Applied target: ${policy.targetMinutes} min`}
            </strong>
            <span>
              Card 5 constraint policy · DEC-012 · {policy.reasonCode}
            </span>
            <span>
              {manualReview
                ? "The constraints need an adult to review the plan. Your current work stays safe."
                : `Source: ${policy.candidateSource.replaceAll("-", " ")} · feasible range ${policy.feasibleMinimumMinutes}–${policy.feasibleMaximumMinutes} min`}
            </span>
          </div>
        </div>
      </details>
    </div>
  );
}

function AppHeader({
  workspace,
  onWorkspace,
  onSaveExit,
  onReset,
}: {
  readonly workspace?: RuntimeWorkspaceV1;
  readonly onWorkspace?: (workspace: RuntimeWorkspaceV1) => void;
  readonly onSaveExit?: () => void;
  readonly onReset: () => void;
}) {
  return (
    <header
      className="session-header runtime-header"
      data-session={workspace ? "true" : "false"}
    >
      <BrandMark compact={Boolean(workspace)} />
      {workspace ? (
        <div className="session-header__goal">
          <span>Today&apos;s goal</span>
          <strong>{SESSION_DEFINITIONS[workspace.subjectId].dailyGoal}</strong>
        </div>
      ) : (
        <div className="runtime-header__status" role="status">
          <span aria-hidden="true">●</span> Local save + integrity check ready
        </div>
      )}
      <div className="session-header__actions">
        {workspace && onSaveExit ? (
          <button className="save-exit-button" onClick={onSaveExit} type="button">
            Save &amp; exit
          </button>
        ) : null}
        {workspace && onWorkspace ? (
          <AccessPanel
            onReset={onReset}
            onWorkspace={onWorkspace}
            workspace={workspace}
          />
        ) : null}
      </div>
    </header>
  );
}

function HomeScreen({
  summaries,
  probes,
  notice,
  onStart,
  onResume,
  onRunProbes,
}: {
  readonly summaries: readonly ResumeSummary[];
  readonly probes: readonly AdversarialProbeResult[];
  readonly notice?: string;
  readonly onStart: (subjectId: RuntimeSubjectId) => void;
  readonly onResume: (summary: ResumeSummary) => void;
  readonly onRunProbes: () => void;
}) {
  return (
    <main className="runtime-home" id="main-content" tabIndex={-1}>
      {notice ? (
        <div className="runtime-notice" role="status">
          {notice}
        </div>
      ) : null}
      <section className="runtime-hero">
        <div>
          <p className="eyebrow">Card 7 · Student runtime</p>
          <h1>
            One canonical learning flow.
            <span> Every learner choice preserved.</span>
          </h1>
          <p>
            Session 2 algorithms and Session 3 Study UX now exchange validated,
            typed Card 1 records in this browser-only integration lab.
          </p>
          <IntegrationBadges />
        </div>
        <div className="runtime-hero__flow" aria-label="Canonical study flow">
          <span>Goal</span>
          <i aria-hidden="true">→</i>
          <span>Learn</span>
          <i aria-hidden="true">→</i>
          <span>Reflect</span>
          <i aria-hidden="true">→</i>
          <span>Review</span>
        </div>
      </section>

      {summaries.length > 0 ? (
        <section className="resume-section" aria-labelledby="resume-heading">
          <p className="eyebrow">Saved on this device</p>
          <h2 id="resume-heading">Resume the exact step</h2>
          <div className="resume-grid">
            {summaries.map((summary) => {
              const definition = SESSION_DEFINITIONS[summary.subjectId];
              const step =
                LEARNING_SEGMENTS.indexOf(summary.currentSegment) + 1;
              return (
                <article
                  className="resume-card"
                  key={`${summary.subjectId}:${summary.sessionId}`}
                >
                  <span className="resume-card__badge">
                    Integrity checked on open
                  </span>
                  <h3>Resume {definition.lessonTitle}</h3>
                  <p>
                    Return to {summary.currentSegment}, Step {step} of{" "}
                    {LEARNING_SEGMENTS.length}:{" "}
                    <strong>
                      {definition.segments[summary.currentSegment].navLabel}
                    </strong>
                    , with entered work, support state, and segment progress
                    intact.
                  </p>
                  <div className="resume-card__meta">
                    <span>{summary.completedSegmentCount} segments complete</span>
                    <span>Revision {summary.revision}</span>
                  </div>
                  <button
                    className="primary-button"
                    onClick={() => onResume(summary)}
                    type="button"
                  >
                    Resume exact step
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="session-picker" aria-labelledby="session-picker-title">
        <p className="eyebrow">Grade 5 demonstrations</p>
        <h2 id="session-picker-title">Choose today&apos;s session</h2>
        <div className="session-card-grid">
          {(["math", "reading"] as const).map((subjectId) => {
            const definition = SESSION_DEFINITIONS[subjectId];
            return (
              <article className="subject-card" data-subject={subjectId} key={subjectId}>
                <div className="subject-card__meta">
                  <span>Grade 5</span>
                  <span>{definition.estimatedMinutes} min starting target</span>
                </div>
                <p className="eyebrow">{definition.subject}</p>
                <h3>{definition.lessonTitle}</h3>
                <strong>{definition.dailyGoal}</strong>
                <p>{definition.goalDetail}</p>
                <ul>
                  <li>Retrieval + visual teaching</li>
                  <li>Guided + independent response</li>
                  <li>Reflection + local-time review</li>
                </ul>
                <button
                  className={subjectId === "math" ? "primary-button" : "secondary-button"}
                  onClick={() => onStart(subjectId)}
                  type="button"
                >
                  Start {subjectId === "math" ? "mathematics" : "reading"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="adversarial-console" aria-labelledby="adversarial-heading">
        <div>
          <p className="eyebrow">Safety + integrity lab</p>
          <h2 id="adversarial-heading">Seven attacks. Fixed, inspectable outcomes.</h2>
          <p>
            Run real local probes against canonical history, idempotency, privacy,
            versioning, language safety, pacing caps, and break protection.
          </p>
        </div>
        <button className="secondary-button" onClick={onRunProbes} type="button">
          Run adversarial probes
        </button>
        {probes.length > 0 ? (
          <ol className="probe-results" data-testid="adversarial-results">
            {probes.map((probe) => (
              <li data-state={probe.passed ? "pass" : "fail"} key={probe.id}>
                <span aria-hidden="true">{probe.passed ? "✓" : "!"}</span>
                <div>
                  <strong>
                    {probe.passed ? "Passed" : "Failed"} · {probe.label}
                  </strong>
                  <p>{probe.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <p className="local-only-note">
        Local prototype: no sign-in, database, cloud upload, calendar, or parent
        runtime integration. Entered work never leaves this browser lab.
      </p>
    </main>
  );
}

function CheckInScreen({
  workspace,
  onWorkspace,
}: {
  readonly workspace: RuntimeWorkspaceV1;
  readonly onWorkspace: (workspace: RuntimeWorkspaceV1) => void;
}) {
  const definition = SESSION_DEFINITIONS[workspace.subjectId];
  const [selection, setSelection] = useState(workspace.checkIn ?? "");
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <main className="check-in-main runtime-check-in" id="main-content" tabIndex={-1}>
      {workspace.showRecoveryNotice ? (
        <RecoveryNotice workspace={workspace} onWorkspace={onWorkspace} />
      ) : null}
      <section className="goal-card">
        <p className="eyebrow">Daily goal</p>
        <h1 ref={headingRef} tabIndex={-1}>
          {definition.dailyGoal}
        </h1>
        <p>{definition.goalDetail}</p>
        <div className="goal-card__meta">
          <span>Grade 5</span>
          <span>
            {workspace.durationPolicy.status === "manual-review"
              ? "Duration plan needs adult review"
              : `${workspace.durationPolicy.targetMinutes}-minute target`}
          </span>
          <span>{LEARNING_SEGMENTS.length} learning segments</span>
        </div>
      </section>
      <div className="check-in-grid">
        <form
          className="check-in-card"
          onSubmit={(event) => {
            event.preventDefault();
            if (selection) onWorkspace(completeCheckIn(workspace, selection));
          }}
        >
          <p className="eyebrow">Check-in</p>
          <h2>How are you arriving today?</h2>
          <p>Choose what feels closest. This never changes a score.</p>
          <fieldset className="check-in-options">
            <legend className="sr-only">Choose your check-in</legend>
            {CHECK_IN_OPTIONS.map((option) => (
              <label key={option.value}>
                <input
                  checked={selection === option.value}
                  name="check-in"
                  onChange={() => setSelection(option.value)}
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
          <p className="form-note">
            Segment progress begins after this check-in. The optional timer can
            be hidden at any time.
          </p>
        </form>
        <JarvisCore
          activity="idle"
          currentUtterance={currentJarvisMessage(workspace)}
          motionMode={workspace.parentPreferences.reducedMotion ? "none" : "full"}
          voiceMode={voiceModeFor(workspace)}
        />
      </div>
    </main>
  );
}

function ResponseControl({
  workspace,
  segment,
  onWorkspace,
}: {
  readonly workspace: RuntimeWorkspaceV1;
  readonly segment: SegmentDefinition;
  readonly onWorkspace: (workspace: RuntimeWorkspaceV1) => void;
}) {
  const response = workspace.responses[segment.id] ?? "";
  if (segment.responseKind === "reflection") {
    return (
      <>
        <h2>{segment.prompt}</h2>
        <ReflectionCheck
          onChange={(field, value) =>
            onWorkspace(setReflectionValue(workspace, field, value))
          }
          value={workspace.reflection}
        />
      </>
    );
  }
  if (segment.responseKind === "choice") {
    return (
      <fieldset className="response-options">
        <legend>{segment.prompt}</legend>
        <div className="response-options__grid">
          {segment.choices?.map((choice) => (
            <label key={choice.value}>
              <input
                checked={response === choice.value}
                name={`response-${segment.id}`}
                onChange={() =>
                  onWorkspace(
                    setResponseDraft(workspace, segment.id, choice.value),
                  )
                }
                type="radio"
                value={choice.value}
              />
              <span>
                <strong>{choice.label}</strong>
                {choice.detail ? <small>{choice.detail}</small> : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  const shared = {
    "aria-describedby": `${segment.id}-draft-note`,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onWorkspace(setResponseDraft(workspace, segment.id, event.target.value)),
    placeholder: segment.placeholder,
    value: response,
  };
  return (
    <label className="text-response">
      <span>{segment.prompt}</span>
      {segment.responseKind === "long-text" ? (
        <textarea {...shared} rows={5} />
      ) : (
        <input {...shared} inputMode="text" type="text" />
      )}
      <small id={`${segment.id}-draft-note`}>
        Saved locally as you type. Speech never submits automatically.
      </small>
    </label>
  );
}

function hasResponse(workspace: RuntimeWorkspaceV1, segment: SegmentDefinition) {
  if (segment.responseKind === "reflection") {
    return Boolean(
      workspace.reflection.confidence &&
        workspace.reflection.effort &&
        workspace.reflection.frustration,
    );
  }
  return (workspace.responses[segment.id] ?? "").trim().length > 0;
}

function handleLearnerAction(
  action: LearnerAction,
  workspace: RuntimeWorkspaceV1,
  onWorkspace: (workspace: RuntimeWorkspaceV1) => void,
) {
  onWorkspace(
    recordLearnerSupportAction(
      workspace,
      action,
      {
        speechInputAvailable: hasSpeechInput(),
        speechOutputAvailable: hasSpeechOutput(),
      },
      new Date().toISOString(),
    ),
  );
}

function RecoveryNotice({
  workspace,
  onWorkspace,
}: {
  readonly workspace: RuntimeWorkspaceV1;
  readonly onWorkspace: (workspace: RuntimeWorkspaceV1) => void;
}) {
  return (
    <section className="recovery-notice" role="status" aria-labelledby="recovery-title">
      <span className="recovery-notice__icon" aria-hidden="true">
        ↻
      </span>
      <div>
        <strong id="recovery-title" tabIndex={-1}>
          Your exact step was restored.
        </strong>
        <p>
          Entered work, support choices, and segment progress are intact. A
          technical interruption is separate from a learner break.
        </p>
      </div>
      <button
        className="text-button"
        onClick={() => onWorkspace(dismissRecovery(workspace))}
        type="button"
      >
        Got it
      </button>
    </section>
  );
}

function MissingMediaFallback({ segment }: { readonly segment: SegmentDefinition }) {
  return (
    <section
      aria-label="Visual teaching board text equivalent"
      className="missing-media"
      role="status"
    >
      <p className="eyebrow">Text equivalent ready</p>
      <h2>The visual or media is unavailable.</h2>
      <p>
        The same idea is shown in text: {segment.instruction} {segment.readAloudText}
      </p>
    </section>
  );
}

function LearningScreen({
  workspace,
  onWorkspace,
  onSaveExit,
  mediaMissing,
}: {
  readonly workspace: RuntimeWorkspaceV1;
  readonly onWorkspace: (workspace: RuntimeWorkspaceV1) => void;
  readonly onSaveExit: () => void;
  readonly mediaMissing: boolean;
}) {
  const definition = SESSION_DEFINITIONS[workspace.subjectId];
  const segment = definition.segments[workspace.currentSegment];
  const feedback = workspace.feedback[segment.id];
  const voiceInputAvailable =
    workspace.parentPreferences.speechInput && hasSpeechInput();
  const segmentHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const target = workspace.showRecoveryNotice
      ? document.getElementById("recovery-title")
      : segmentHeadingRef.current;
    window.requestAnimationFrame(() => target?.focus());
  }, [workspace.currentSegment, workspace.showRecoveryNotice]);

  useEffect(() => {
    if (!workspace.transcriptOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const activeElement = document.activeElement;
      if (
        !(activeElement instanceof HTMLElement) ||
        !activeElement.closest(".jarvis-core")
      ) {
        return;
      }
      event.preventDefault();
      onWorkspace(setTranscriptOpen(workspace, false));
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(".jarvis-core__transcript-toggle")
          ?.focus();
      });
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onWorkspace, workspace, workspace.transcriptOpen]);

  return (
    <>
      <SegmentProgress
        completedSegments={workspace.completedSegments}
        currentSegment={workspace.currentSegment}
        definition={definition}
      />
      <div className="runtime-timer-row">
        <SessionTimer
          onToggle={() => onWorkspace(toggleTimer(workspace))}
          timer={{
            ...workspace.timer,
            remainingSeconds: workspace.timer.remainingSeconds,
          }}
        />
        <span>
          <strong>{workspace.completedSegments.length} of 6</strong> learning
          segments complete
        </span>
      </div>
      <main className="learning-main" id="main-content" tabIndex={-1}>
        {workspace.showRecoveryNotice ? (
          <RecoveryNotice workspace={workspace} onWorkspace={onWorkspace} />
        ) : null}
        <div className="learning-layout">
          <section className="task-panel" aria-labelledby="segment-title">
            <div className="task-panel__step">
              <span>
                Canonical task reference ·{" "}
                {canonicalSegmentId(workspace.subjectId, segment.id)}
              </span>
              <span>{segment.navLabel}</span>
            </div>
            <p className="eyebrow">{segment.eyebrow}</p>
            <h1 id="segment-title" ref={segmentHeadingRef} tabIndex={-1}>
              {segment.title}
            </h1>
            <p className="task-panel__instruction">{segment.instruction}</p>
            {mediaMissing ? (
              <MissingMediaFallback segment={segment} />
            ) : (
              <TeachingBoard segment={segment} subjectId={workspace.subjectId} />
            )}
            <form
              className="response-card"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                if (feedback === "ready") {
                  onWorkspace(completeCurrentSegment(workspace));
                } else {
                  onWorkspace(submitCurrentResponse(workspace));
                }
              }}
            >
              <ResponseControl
                onWorkspace={onWorkspace}
                segment={segment}
                workspace={workspace}
              />
              {feedback ? (
                <div className="feedback-panel" data-state={feedback}>
                  <span aria-hidden="true">{feedback === "ready" ? "✓" : "↻"}</span>
                  <div>
                    <strong>
                      {feedback === "ready"
                        ? "Ready for the next step"
                        : "Support is ready"}
                    </strong>
                    <p>
                      {feedback === "ready"
                        ? currentJarvisMessage(workspace)
                        : `${segment.hint} Your work stays local while you try again.`}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="response-card__actions">
                <button
                  className="primary-button"
                  disabled={!hasResponse(workspace, segment)}
                  type="submit"
                >
                  {feedback === "ready"
                    ? segment.id === "exit-ticket"
                      ? "See session choices"
                      : "Continue"
                    : segment.responseKind === "reflection"
                      ? "Save check-in"
                      : "Check response"}
                </button>
                <span>
                  Entered work is local. Canonical evidence receives aggregates only.
                </span>
              </div>
            </form>
          </section>
          <aside
            aria-label="Learning support and session controls"
            className="learning-support"
          >
            <button
              className="direct-break-button"
              onClick={() =>
                handleLearnerAction("I need a break", workspace, onWorkspace)
              }
              type="button"
            >
              I need a break
            </button>
            <LearnerActions
              onAction={(action) =>
                handleLearnerAction(action, workspace, onWorkspace)
              }
              voiceInputAvailable={voiceInputAvailable}
            />
            <JarvisCore
              activity={feedback === "support" ? "thinking" : "idle"}
              currentUtterance={currentJarvisMessage(workspace)}
              motionMode={
                workspace.parentPreferences.reducedMotion ? "none" : "full"
              }
              onTranscriptOpenChange={(open) =>
                onWorkspace(setTranscriptOpen(workspace, open))
              }
              transcript={<TranscriptList workspace={workspace} />}
              transcriptOpen={workspace.transcriptOpen}
              voiceMode={voiceModeFor(workspace)}
            />
            {workspace.parentPreferences.speechInput &&
            !voiceInputAvailable ? (
              <p className="speech-fallback" role="status">
                Speech input is unavailable. Typing and every learner action remain
                ready.
              </p>
            ) : null}
            <button
              className="direct-save-button"
              onClick={onSaveExit}
              type="button"
            >
              Save and exit
            </button>
          </aside>
        </div>
      </main>
    </>
  );
}

function DecisionScreen({
  workspace,
  onWorkspace,
  onSaveExit,
  onContinue,
}: {
  readonly workspace: RuntimeWorkspaceV1;
  readonly onWorkspace: (workspace: RuntimeWorkspaceV1) => void;
  readonly onSaveExit: () => void;
  readonly onContinue: () => void;
}) {
  const definition = SESSION_DEFINITIONS[workspace.subjectId];
  const review = workspace.reviewRecords.at(-1);
  const focus = workspace.engineOutputs.focus;
  const manualReview = workspace.durationPolicy.status === "manual-review";
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <main className="decision-main" id="main-content" tabIndex={-1}>
      {workspace.showRecoveryNotice ? (
        <RecoveryNotice workspace={workspace} onWorkspace={onWorkspace} />
      ) : null}
      <SegmentProgress
        completedSegments={workspace.completedSegments}
        currentSegment="exit-ticket"
        definition={definition}
      />
      <div className="decision-grid">
        <section className="decision-card">
          <span className="decision-card__mark" aria-hidden="true">
            ✓
          </span>
          <p className="eyebrow">Exit ticket complete</p>
          <h1 ref={headingRef} tabIndex={-1}>
            Your canonical learning cycle is ready to save.
          </h1>
          <p>
            Segment completion is the progress authority. Breaks and technical
            interruptions remain separate, non-punitive events.
          </p>
          <div className="recommendation-grid">
            <article>
              <span>Review recommendation</span>
              <strong>{review?.nextReviewDate ?? "Pending"}</strong>
              <small>{review?.timeZone ?? "Learner-local time"}</small>
            </article>
            <article>
              <span>Pacing recommendation</span>
              <strong>
                {focus?.recommendation.replaceAll("_", " ") ?? "Insufficient data"}
              </strong>
              <small>
                {focus
                  ? `${focus.evidence.evaluatedComparableSessions} comparable ${
                      focus.evidence.evaluatedComparableSessions === 1
                        ? "session"
                        : "sessions"
                    }`
                  : "No automatic change"}
              </small>
            </article>
            <article>
              <span>Privacy boundary</span>
              <strong>Aggregate only</strong>
              <small>No name, email, or raw answer</small>
            </article>
          </div>
          {manualReview ? (
            <p
              className="manual-review-support"
              id="manual-review-support"
              role="status"
            >
              The Card 5 constraints need an adult to review the plan before
              another automatic block. Your work is safe, and you can take a
              break, save, or finish.
            </p>
          ) : null}
          <div className="decision-actions" aria-label="Break, continue, save, or finish">
            <button
              className="secondary-button"
              onClick={() => onWorkspace(requestBreak(workspace))}
              type="button"
            >
              Take a break
            </button>
            <button
              aria-describedby={
                manualReview ? "manual-review-support" : undefined
              }
              aria-disabled={manualReview}
              className="secondary-button"
              onClick={() => {
                if (!manualReview) onContinue();
              }}
              type="button"
            >
              {manualReview
                ? "Another lesson needs adult review"
                : "Continue with another lesson"}
            </button>
            <button className="secondary-button" onClick={onSaveExit} type="button">
              Save and exit
            </button>
            <button
              className="primary-button"
              onClick={() => onWorkspace(finishRuntimeSession(workspace))}
              type="button"
            >
              Finish for today
            </button>
          </div>
        </section>
        <JarvisCore
          activity="idle"
          currentUtterance={currentJarvisMessage(workspace)}
          motionMode={workspace.parentPreferences.reducedMotion ? "none" : "full"}
          onTranscriptOpenChange={(open) =>
            onWorkspace(setTranscriptOpen(workspace, open))
          }
          transcript={<TranscriptList workspace={workspace} />}
          transcriptOpen={workspace.transcriptOpen}
          voiceMode={voiceModeFor(workspace)}
        />
      </div>
    </main>
  );
}

function LimitScreen({
  workspace,
  onWorkspace,
  onSaveExit,
}: {
  readonly workspace: RuntimeWorkspaceV1;
  readonly onWorkspace: (workspace: RuntimeWorkspaceV1) => void;
  readonly onSaveExit: () => void;
}) {
  const manualReview = workspace.durationPolicy.status === "manual-review";
  return (
    <main className="limit-screen" id="main-content" tabIndex={-1}>
      <p className="eyebrow">
        {manualReview ? "Card 5 constraint review" : "Configured duration cap"}
      </p>
      <h1>
        {manualReview
          ? "This block has paused safely."
          : "The planned maximum is here."}
      </h1>
      <p>
        Your exact step and entered work are saved.{" "}
        {manualReview
          ? "No automatic extension is active while an adult reviews the plan."
          : "Stopping is part of the plan, not a failure."}
      </p>
      <div className="decision-actions">
        <button className="secondary-button" onClick={onSaveExit} type="button">
          Save and exit
        </button>
        <button
          className="primary-button"
          onClick={() => onWorkspace(finishRuntimeSession(workspace))}
          type="button"
        >
          Finish this session
        </button>
      </div>
    </main>
  );
}

function FinishedScreen({
  workspace,
  onHome,
}: {
  readonly workspace: RuntimeWorkspaceV1;
  readonly onHome: () => void;
}) {
  const review = workspace.reviewRecords.at(-1);
  return (
    <main className="finished-screen" id="main-content" tabIndex={-1}>
      <span className="finished-screen__mark" aria-hidden="true">
        ✓
      </span>
      <p className="eyebrow">Session complete</p>
      <h1>Your work is saved without raw-answer leakage.</h1>
      <p>
        {review
          ? `Review ${review.skillId} on ${review.nextReviewDate} in ${review.timeZone}.`
          : "The partial session is saved for adult review."}
      </p>
      <dl className="finish-details">
        <div>
          <dt>Canonical status</dt>
          <dd>{workspace.canonicalSession.status}</dd>
        </div>
        <div>
          <dt>Segment events</dt>
          <dd>
            {
              workspace.canonicalSession.eventLog.filter(
                (event) => event.type === "segment-completed",
              ).length
            }
          </dd>
        </div>
        <div>
          <dt>Technical interruptions</dt>
          <dd>{workspace.technicalInterruptionCount}</dd>
        </div>
      </dl>
      <button className="primary-button" onClick={onHome} type="button">
        Back to study console
      </button>
    </main>
  );
}

function SessionView({
  workspace,
  onWorkspace,
  onSaveExit,
  onContinue,
  onHome,
  mediaMissing,
}: {
  readonly workspace: RuntimeWorkspaceV1;
  readonly onWorkspace: (workspace: RuntimeWorkspaceV1) => void;
  readonly onSaveExit: () => void;
  readonly onContinue: () => void;
  readonly onHome: () => void;
  readonly mediaMissing: boolean;
}) {
  if (workspace.screen === "check-in") {
    return <CheckInScreen workspace={workspace} onWorkspace={onWorkspace} />;
  }
  if (workspace.screen === "learning") {
    return (
      <LearningScreen
        mediaMissing={mediaMissing}
        onSaveExit={onSaveExit}
        onWorkspace={onWorkspace}
        workspace={workspace}
      />
    );
  }
  if (workspace.screen === "break" && workspace.breakState) {
    const label =
      SESSION_DEFINITIONS[workspace.subjectId].segments[
        workspace.breakState.returnSegment
      ].navLabel;
    return (
      <>
        {workspace.breakState.adultReviewSuggested ? (
          <p className="break-review-note" role="status">
            This break remains approved and non-punitive. A repeated pattern may
            be shared for adult review.
          </p>
        ) : null}
        <BreakScreen
          breakState={{
            returnScreen: "learning",
            returnSegment: workspace.breakState.returnSegment,
            timerWasRunning: workspace.timer.running,
            activity: workspace.breakState.activity,
            returnCountdown: null,
          }}
          onChooseActivity={(activity) =>
            onWorkspace(chooseBreakActivity(workspace, activity))
          }
          onStartReturn={() => onWorkspace(resumeBreak(workspace))}
          segmentLabel={label}
        />
      </>
    );
  }
  if (workspace.screen === "decision") {
    return (
      <DecisionScreen
        onContinue={onContinue}
        onSaveExit={onSaveExit}
        onWorkspace={onWorkspace}
        workspace={workspace}
      />
    );
  }
  if (workspace.screen === "limit") {
    return (
      <LimitScreen
        onSaveExit={onSaveExit}
        onWorkspace={onWorkspace}
        workspace={workspace}
      />
    );
  }
  if (workspace.screen === "finished") {
    return <FinishedScreen onHome={onHome} workspace={workspace} />;
  }
  return (
    <main className="quarantine-screen" id="main-content" tabIndex={-1}>
      <p className="eyebrow">Safe local quarantine</p>
      <h1>This saved state could not be opened.</h1>
      <p>No source content was echoed. Start a new local session to continue.</p>
      <button className="primary-button" onClick={onHome} type="button">
        Return home
      </button>
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>("home");
  const [workspace, setWorkspace] = useState<RuntimeWorkspaceV1>();
  const [summaries, setSummaries] = useState<readonly ResumeSummary[]>([]);
  const [probes, setProbes] = useState<readonly AdversarialProbeResult[]>([]);
  const [notice, setNotice] = useState<string>();
  const [storageReady, setStorageReady] = useState(false);
  const breakHeadingRef = useRef<HTMLElement | null>(null);
  const mediaMissing =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("media") === "missing";

  const store: ResumeStore | undefined = useMemo(() => {
    try {
      return createResumeStore({ validateIntegrity: validateResumeWorkspace });
    } catch {
      return undefined;
    }
  }, []);

  const refreshSummaries = async () => {
    if (!store) return;
    try {
      setSummaries(await store.list());
      setStorageReady(true);
    } catch {
      setNotice("Local persistence is unavailable; the in-memory lab still works.");
    }
  };

  useEffect(() => {
    void refreshSummaries();
  }, [store]);

  useEffect(() => {
    const scale = workspace?.parentPreferences.largeText ? "130%" : "100%";
    document.documentElement.style.fontSize = scale;
    return () => {
      document.documentElement.style.fontSize = "100%";
    };
  }, [workspace?.parentPreferences.largeText]);

  useEffect(() => {
    if (!workspace || route !== "session" || workspace.screen !== "learning") return;
    const timer = window.setInterval(() => {
      setWorkspace((current) =>
        current ? tickRuntimeTimer(current, new Date().toISOString()) : current,
      );
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [route, workspace?.screen]);

  useEffect(() => {
    if (!workspace || !store) return;
    void store.save(workspace).catch(() => {
      setNotice("The latest in-memory state is safe, but local save needs attention.");
    });
  }, [workspace, store]);

  useEffect(() => {
    if (workspace?.screen !== "break") return;
    window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>(".break-screen h1");
      if (!heading) return;
      heading.setAttribute("tabindex", "-1");
      heading.focus();
      breakHeadingRef.current = heading;
    });
  }, [workspace?.screen]);

  useEffect(() => {
    const closeFocusedDisclosure = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLElement)) return;
      const disclosure = activeElement.closest<HTMLDetailsElement>(
        "details[open]",
      );
      if (!disclosure) return;
      event.preventDefault();
      disclosure.open = false;
      disclosure.querySelector<HTMLElement>("summary")?.focus();
    };
    document.addEventListener("keydown", closeFocusedDisclosure);
    return () =>
      document.removeEventListener("keydown", closeFocusedDisclosure);
  }, []);

  const resetAll = async () => {
    if (store) await store.clear();
    setWorkspace(undefined);
    setRoute("home");
    setSummaries([]);
    setProbes([]);
    setNotice("Local Session 7 data was reset.");
  };

  const startSubject = async (subjectId: RuntimeSubjectId) => {
    const at = new Date().toISOString();
    const next = createRuntimeWorkspace(
      subjectId,
      at,
      defaultParentPreferences(),
      createLocalSessionId(),
    );
    setWorkspace(next);
    setRoute("session");
    setNotice(undefined);
  };

  const resumeSummary = async (summary: ResumeSummary) => {
    if (!store) return;
    const loaded = await store.load({
      subjectId: summary.subjectId,
      sessionId: summary.sessionId,
      expectedRevision: summary.revision,
    });
    if (loaded.status !== "loaded") {
      setNotice(
        loaded.status === "quarantined"
          ? "An unsupported saved version was quarantined safely."
          : "The resume token was stale or could not be verified.",
      );
      await refreshSummaries();
      return;
    }
    const integrity = validateRuntimeWorkspaceIntegrity(loaded.workspace);
    if (!integrity.ok) {
      setNotice("The saved history was rejected and was not used.");
      return;
    }
    const next =
      loaded.workspace.canonicalSession.status === "paused"
        ? resumeSavedSession(loaded.workspace)
        : recoverAfterRefresh(loaded.workspace);
    setWorkspace(next);
    setRoute("session");
  };

  const handleSaveExit = async () => {
    if (!workspace) return;
    const saved = saveAndExit(workspace);
    setWorkspace(saved);
    if (store) await store.save(saved);
    setRoute("home");
    setNotice("Saved intentionally. Refresh any time, then resume the exact step.");
    await refreshSummaries();
  };

  const handleContinue = async () => {
    if (!workspace) return;
    const finished = finishRuntimeSession(workspace);
    setWorkspace(finished);
    if (store) await store.save(finished);
    setRoute("home");
    setNotice("Learning cycle saved. Choose the next short lesson when ready.");
    await refreshSummaries();
  };

  const handleHome = async () => {
    if (workspace?.screen === "finished" && store) {
      await store.clear({
        subjectId: workspace.subjectId,
        sessionId: workspace.canonicalSession.id,
      });
    }
    setWorkspace(undefined);
    setRoute("home");
    await refreshSummaries();
  };

  const runProbes = () => {
    const results = runAdversarialProbes();
    setProbes(results);
    setNotice(
      allAdversarialProbesPass(results)
        ? "All seven adversarial probes passed locally."
        : "One or more probes needs review.",
    );
  };

  const rootData = {
    "data-reduced-motion": workspace?.parentPreferences.reducedMotion
      ? "true"
      : "false",
    "data-large-text": workspace?.parentPreferences.largeText ? "true" : "false",
  };

  return (
    <div className="runtime-shell" {...rootData}>
      <AppHeader
        onReset={() => void resetAll()}
        onSaveExit={
          route === "session" &&
          workspace &&
          workspace.screen !== "finished" &&
          workspace.screen !== "break"
            ? () => void handleSaveExit()
            : undefined
        }
        onWorkspace={workspace ? setWorkspace : undefined}
        workspace={route === "session" ? workspace : undefined}
      />
      {route === "home" || !workspace ? (
        <HomeScreen
          notice={
            notice ??
            (storageReady ? undefined : "Preparing local integrity-checked saves…")
          }
          onResume={(summary) => void resumeSummary(summary)}
          onRunProbes={runProbes}
          onStart={(subjectId) => void startSubject(subjectId)}
          probes={probes}
          summaries={summaries.filter((summary) => summary.screen !== "finished")}
        />
      ) : (
        <SessionView
          mediaMissing={mediaMissing}
          onContinue={() => void handleContinue()}
          onHome={() => void handleHome()}
          onSaveExit={() => void handleSaveExit()}
          onWorkspace={setWorkspace}
          workspace={workspace}
        />
      )}
    </div>
  );
}
