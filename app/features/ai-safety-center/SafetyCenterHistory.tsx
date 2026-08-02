import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  CollectionState,
  IdentityRole,
  InstructionalSession,
  SafetyCenterActionResult,
  SafetyEvent,
} from "./contracts";
import {
  CATEGORY_LABEL,
  ESCALATION_LABEL,
  SPEAKER_LABEL,
  formatDate,
  formatDateTime,
  sentenceCase,
} from "./format";
import {
  collectSubjectOptions,
  filterInstructionalSessions,
  filterSafetyEvents,
  type SafetyCenterFilters,
} from "./model";
import type { SafetyCenterData, StudentRef } from "./contracts";
import {
  CollectionNotice,
  EmptyState,
  InlineNotice,
  SectionHeading,
  SeverityBadge,
  StatusBadge,
  type DispatchSafetyCenterAction,
} from "./SafetyCenterCommon";

const EMPTY_FILTERS: SafetyCenterFilters = {
  query: "",
  subjectRef: "",
  fromDate: "",
  toDate: "",
};

function HistoryFilters({
  filters,
  setFilters,
  subjects,
  resultCount,
  noun,
  idPrefix,
}: {
  readonly filters: SafetyCenterFilters;
  readonly setFilters: Dispatch<SetStateAction<SafetyCenterFilters>>;
  readonly subjects: readonly { readonly value: string; readonly label: string }[];
  readonly resultCount: number;
  readonly noun: string;
  readonly idPrefix: string;
}) {
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="masc-filters" aria-label={`${noun} filters`}>
      <div className="masc-field masc-filter-search">
        <label htmlFor={`${idPrefix}-search`}>Search</label>
        <input
          id={`${idPrefix}-search`}
          type="search"
          value={filters.query}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              query: event.target.value,
            }))
          }
          placeholder="Topic, message, or reason"
          autoComplete="off"
        />
      </div>
      <div className="masc-field">
        <label htmlFor={`${idPrefix}-subject`}>Subject</label>
        <select
          id={`${idPrefix}-subject`}
          value={filters.subjectRef}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              subjectRef: event.target.value,
            }))
          }
        >
          <option value="">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject.value} value={subject.value}>
              {subject.label}
            </option>
          ))}
        </select>
      </div>
      <div className="masc-field">
        <label htmlFor={`${idPrefix}-from`}>From</label>
        <input
          id={`${idPrefix}-from`}
          type="date"
          value={filters.fromDate}
          max={filters.toDate || undefined}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              fromDate: event.target.value,
            }))
          }
        />
      </div>
      <div className="masc-field">
        <label htmlFor={`${idPrefix}-to`}>To</label>
        <input
          id={`${idPrefix}-to`}
          type="date"
          value={filters.toDate}
          min={filters.fromDate || undefined}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              toDate: event.target.value,
            }))
          }
        />
      </div>
      <div className="masc-filter-summary">
        <span aria-live="polite">
          {resultCount} {resultCount === 1 ? noun : `${noun}s`}
        </span>
        {hasFilters ? (
          <button
            className="masc-text-button"
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

function useTutorPlayback(
  session: InstructionalSession | undefined,
  studentRef: StudentRef,
  onAction: DispatchSafetyCenterAction,
) {
  const [status, setStatus] = useState<
    "idle" | "requesting" | "speaking" | "unsupported" | "error"
  >("idle");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(
    () => () => {
      if (
        utteranceRef.current &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  useEffect(() => {
    setStatus("idle");
  }, [session?.sessionRef]);

  async function play(): Promise<void> {
    if (!session || session.playback !== "synthesized_from_text") return;

    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setStatus("unsupported");
      return;
    }

    const tutorText = session.turns
      .filter((turn) => turn.speaker === "tutor")
      .map((turn) => turn.text)
      .join(" ");

    if (!tutorText) {
      setStatus("unsupported");
      return;
    }

    setStatus("requesting");
    let result: SafetyCenterActionResult;
    try {
      result = await onAction({
        type: "playback_requested",
        studentRef,
        sessionRef: session.sessionRef,
      });
    } catch {
      setStatus("error");
      return;
    }

    if (result.status === "rejected") {
      setStatus("error");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(tutorText);
    utterance.rate = 0.92;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => {
      utteranceRef.current = null;
      setStatus("idle");
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setStatus("error");
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function stop(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setStatus("idle");
  }

  return { status, play, stop };
}

function SessionDetail({
  session,
  role,
  studentRef,
  onAction,
}: {
  readonly session: InstructionalSession;
  readonly role: IdentityRole;
  readonly studentRef: StudentRef;
  readonly onAction: DispatchSafetyCenterAction;
}) {
  const playback = useTutorPlayback(session, studentRef, onAction);

  return (
    <article
      className="masc-session-detail"
      aria-labelledby={`session-title-${session.sessionRef}`}
    >
      <header className="masc-detail-header">
        <div>
          <p className="masc-eyebrow">{session.subjectLabel}</p>
          <h3 id={`session-title-${session.sessionRef}`}>
            {session.topicLabel}
          </h3>
          <p>{session.summary}</p>
        </div>
        <StatusBadge
          tone={session.status === "completed" ? "positive" : "warning"}
        >
          {sentenceCase(session.status)}
        </StatusBadge>
      </header>

      <dl className="masc-meta-list">
        <div>
          <dt>Started</dt>
          <dd>{formatDateTime(session.startedAt)}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>
            {session.durationMinutes
              ? `${session.durationMinutes} minutes`
              : "Not recorded"}
          </dd>
        </div>
        <div>
          <dt>Safety events</dt>
          <dd>{session.linkedSafetyEventRefs.length}</dd>
        </div>
      </dl>

      <InlineNotice title="Text playback, not a recording" tone="privacy">
        <p>
          Tutor help is read from the saved text using this device. This
          interface has no field for a raw microphone recording.
        </p>
      </InlineNotice>

      <div className="masc-playback-row">
        {session.playback === "synthesized_from_text" ? (
          playback.status === "speaking" ? (
            <button
              className="masc-button masc-button-secondary"
              type="button"
              onClick={playback.stop}
            >
              Stop playback
            </button>
          ) : (
            <button
              className="masc-button masc-button-secondary"
              type="button"
              onClick={() => void playback.play()}
              disabled={playback.status === "requesting"}
            >
              {playback.status === "requesting"
                ? "Preparing playback…"
                : "Play tutor help"}
            </button>
          )
        ) : (
          <span className="masc-muted">Playback is not available.</span>
        )}
        <span className="masc-muted" role="status" aria-live="polite">
          {playback.status === "speaking"
            ? "Tutor help is playing."
            : playback.status === "unsupported"
              ? "Text-to-speech is not available on this device."
              : playback.status === "error"
                ? "Playback could not start."
                : ""}
        </span>
      </div>

      <section className="masc-detail-section" aria-labelledby="transcript-title">
        <div className="masc-subheading-row">
          <h4 id="transcript-title">Conversation transcript</h4>
          <span className="masc-muted">{session.turns.length} turns</span>
        </div>
        {session.turns.length === 0 ? (
          <p className="masc-muted">No transcript text was retained.</p>
        ) : (
          <ol className="masc-transcript">
            {session.turns.map((turn) => (
              <li key={turn.turnRef} data-speaker={turn.speaker}>
                <div className="masc-turn-label">
                  <strong>{SPEAKER_LABEL[turn.speaker]}</strong>
                  <time dateTime={turn.at}>{formatDateTime(turn.at)}</time>
                </div>
                <p>{turn.text}</p>
                {turn.source === "scripted" ? (
                  <span className="masc-source-label">
                    Safety-scripted response
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="masc-detail-section" aria-labelledby="timeline-title">
        <h4 id="timeline-title">Tutor-help timeline</h4>
        <ol className="masc-timeline">
          {session.timeline.map((item) => (
            <li key={item.timelineRef}>
              <span className="masc-timeline-dot" aria-hidden="true" />
              <div>
                <div className="masc-timeline-heading">
                  <strong>{item.label}</strong>
                  <time dateTime={item.at}>{formatDateTime(item.at)}</time>
                </div>
                {item.detail ? <p>{item.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {role === "student" ? (
        <p className="masc-student-reminder">
          You can report this conversation or pause the tutor from “Get help.”
        </p>
      ) : null}
    </article>
  );
}

export function InstructionalHistoryPanel({
  role,
  studentRef,
  data,
  onAction,
  pendingAction,
}: {
  readonly role: IdentityRole;
  readonly studentRef: StudentRef;
  readonly data: SafetyCenterData;
  readonly onAction: DispatchSafetyCenterAction;
  readonly pendingAction: string | null;
}) {
  const [filters, setFilters] = useState<SafetyCenterFilters>(EMPTY_FILTERS);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const subjects = useMemo(() => collectSubjectOptions(data), [data]);
  const history = data.instructionalHistory;
  const filtered =
    history.status === "ready"
      ? filterInstructionalSessions(history.items, filters)
      : [];
  const selected = filtered.find(
    (session) => session.sessionRef === selectedRef,
  );

  return (
    <section aria-labelledby="instructional-history-heading">
      <SectionHeading
        id="instructional-history-heading"
        eyebrow="Learning record"
        title="Instructional tutor history"
        description={
          role === "parent"
            ? "Search the selected student's learning conversations. Safety events remain in their own record."
            : "Review your own learning conversations. Safety notices are kept on a separate screen."
        }
      />

      {history.status !== "ready" ? (
        <CollectionNotice
          state={history}
          title="Tutor history"
          retryDisabled={pendingAction === "history_retry_requested"}
          onRetry={
            history.status === "unavailable" && history.retryable
              ? () =>
                  void onAction({
                    type: "history_retry_requested",
                    studentRef,
                    collection: "instructional_history",
                  })
              : undefined
          }
        />
      ) : (
        <>
          <HistoryFilters
            filters={filters}
            setFilters={setFilters}
            subjects={subjects}
            resultCount={filtered.length}
            noun="conversation"
            idPrefix="masc-history"
          />

          {history.items.length === 0 ? (
            <EmptyState
              title="No tutor conversations yet"
              detail="When this student uses the tutor, learning conversations will appear here according to the retention setting."
            />
          ) : filtered.length === 0 ? (
            <div className="masc-no-results" role="status">
              <h3>No conversations match these filters</h3>
              <p>Clear a filter or try a different search phrase.</p>
            </div>
          ) : (
            <div className="masc-history-layout">
              <div>
                <ol className="masc-session-list">
                  {filtered.map((session) => {
                    const selectedNow =
                      selected?.sessionRef === session.sessionRef;
                    return (
                      <li key={session.sessionRef}>
                        <button
                          type="button"
                          className="masc-session-card"
                          aria-pressed={selectedNow}
                          onClick={() => setSelectedRef(session.sessionRef)}
                        >
                          <span className="masc-session-card-topline">
                            <strong>{session.topicLabel}</strong>
                            <time dateTime={session.startedAt}>
                              {formatDate(session.startedAt)}
                            </time>
                          </span>
                          <span>{session.subjectLabel}</span>
                          <span className="masc-session-summary">
                            {session.summary}
                          </span>
                          <span className="masc-session-card-footer">
                            <span>
                              {session.durationMinutes
                                ? `${session.durationMinutes} min`
                                : "Length unavailable"}
                            </span>
                            <span>
                              {session.linkedSafetyEventRefs.length} safety{" "}
                              {session.linkedSafetyEventRefs.length === 1
                                ? "event"
                                : "events"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="masc-detail-column">
                {selected ? (
                  <SessionDetail
                    session={selected}
                    role={role}
                    studentRef={studentRef}
                    onAction={onAction}
                  />
                ) : (
                  <div className="masc-selection-prompt">
                    <span aria-hidden="true">→</span>
                    <h3>Choose a conversation</h3>
                    <p>
                      Open one item to see its transcript and tutor-help
                      timeline.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SafetyEventCard({
  event,
  role,
  studentRef,
  onAction,
  pendingAction,
}: {
  readonly event: SafetyEvent;
  readonly role: IdentityRole;
  readonly studentRef: StudentRef;
  readonly onAction: DispatchSafetyCenterAction;
  readonly pendingAction: string | null;
}) {
  const [context, setContext] = useState("");
  const [showReview, setShowReview] = useState(false);

  return (
    <article
      className="masc-event-card"
      data-severity={event.severity}
      aria-labelledby={`event-${event.eventRef}`}
    >
      <header>
        <div className="masc-event-badges">
          <SeverityBadge severity={event.severity} />
          <StatusBadge tone={event.status === "resolved" ? "positive" : "neutral"}>
            {sentenceCase(event.status)}
          </StatusBadge>
        </div>
        <time dateTime={event.occurredAt}>
          {formatDateTime(event.occurredAt)}
        </time>
      </header>
      <h3 id={`event-${event.eventRef}`}>{event.summary}</h3>
      <p className="masc-event-explanation">{event.studentExplanation}</p>

      {event.withheldReason ? (
        <div className="masc-withheld-reason">
          <span aria-hidden="true">↳</span>
          <div>
            <strong>Why the answer was withheld</strong>
            <p>
              {role === "student"
                ? event.withheldReason.studentExplanation
                : event.withheldReason.parentExplanation}
            </p>
          </div>
        </div>
      ) : null}

      {event.severity === "critical" ? (
        <InlineNotice
          title="A trusted adult should check in now"
          tone="critical"
        >
          <p>
            This safety center is not an emergency service. Follow your family
            or school safety plan and involve a trusted adult.
          </p>
        </InlineNotice>
      ) : null}

      <details className="masc-event-details">
        <summary>
          {role === "parent" ? "Classification details" : "More about this notice"}
        </summary>
        {role === "parent" ? (
          <>
            <dl className="masc-detail-list">
              <div>
                <dt>Category</dt>
                <dd>{CATEGORY_LABEL[event.category]}</dd>
              </div>
              <div>
                <dt>Escalation</dt>
                <dd>{ESCALATION_LABEL[event.escalation]}</dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd>{event.subjectLabel ?? "General tutor"}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{event.eventRef}</dd>
              </div>
            </dl>
            <p>{event.parentDetail}</p>
          </>
        ) : (
          <p>
            The tutor should explain the boundary in simple language and offer
            a safe next step. You can report it if the explanation felt wrong.
          </p>
        )}
      </details>

      {role === "parent" && event.status !== "resolved" ? (
        <div className="masc-review-actions">
          <button
            className="masc-button masc-button-secondary"
            type="button"
            onClick={() => setShowReview((current) => !current)}
            aria-expanded={showReview}
          >
            Add context or request review
          </button>
          {showReview ? (
            <div className="masc-review-form">
              <div className="masc-field">
                <label htmlFor={`review-context-${event.eventRef}`}>
                  Optional context
                </label>
                <textarea
                  id={`review-context-${event.eventRef}`}
                  value={context}
                  maxLength={1000}
                  onChange={(changeEvent) =>
                    setContext(changeEvent.target.value)
                  }
                  placeholder="Share only details needed to understand this event."
                />
                <span className="masc-field-help">
                  {context.length}/1000. Do not add unrelated personal details.
                </span>
              </div>
              <div className="masc-button-row">
                <button
                  className="masc-button"
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void onAction({
                      type: "human_review_requested",
                      studentRef,
                      eventRef: event.eventRef,
                      ...(context.trim()
                        ? { context: context.trim() }
                        : {}),
                    })
                  }
                >
                  Request human review
                </button>
                <button
                  className="masc-button masc-button-quiet"
                  type="button"
                  disabled={pendingAction !== null}
                  onClick={() =>
                    void onAction({
                      type: "false_positive_review_requested",
                      studentRef,
                      eventRef: event.eventRef,
                      ...(context.trim()
                        ? { context: context.trim() }
                        : {}),
                    })
                  }
                >
                  Flag possible false positive
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function SafetyEventsPanel({
  role,
  studentRef,
  data,
  onAction,
  pendingAction,
}: {
  readonly role: IdentityRole;
  readonly studentRef: StudentRef;
  readonly data: SafetyCenterData;
  readonly onAction: DispatchSafetyCenterAction;
  readonly pendingAction: string | null;
}) {
  const [filters, setFilters] = useState<SafetyCenterFilters>(EMPTY_FILTERS);
  const subjects = useMemo(() => collectSubjectOptions(data), [data]);
  const safetyEvents: CollectionState<SafetyEvent> = data.safetyEvents;
  const filtered =
    safetyEvents.status === "ready"
      ? filterSafetyEvents(safetyEvents.items, filters)
      : [];

  return (
    <section aria-labelledby="safety-events-heading">
      <SectionHeading
        id="safety-events-heading"
        eyebrow="Separate safety record"
        title="Safety events"
        description={
          role === "parent"
            ? "Review classifications, escalations, and withheld-answer reasons without mixing them into instructional progress."
            : "See when the tutor paused, withheld an answer, or asked an adult to help."
        }
      />

      <InlineNotice
        title={
          role === "parent"
            ? "Safety exceptions are visible"
            : "What parents can review"
        }
        tone="privacy"
      >
        {role === "parent" ? (
          <p>
            Parents can review tutor conversations and safety events for this
            student. Reflections entered inside a tutor conversation follow the
            same safety exception. Separate mindset journal text is not
            collected or reviewed by this safety center.
          </p>
        ) : (
          <p>
            Your parent can review tutor conversations and safety events.
            A reflection typed in a tutor conversation follows the same rule.
            Your separate mindset journal is not collected here. You are not in
            trouble for asking for help.
          </p>
        )}
      </InlineNotice>

      {safetyEvents.status !== "ready" ? (
        <CollectionNotice
          state={safetyEvents}
          title="Safety events"
          retryDisabled={pendingAction === "history_retry_requested"}
          onRetry={
            safetyEvents.status === "unavailable" && safetyEvents.retryable
              ? () =>
                  void onAction({
                    type: "history_retry_requested",
                    studentRef,
                    collection: "safety_events",
                  })
              : undefined
          }
        />
      ) : (
        <>
          <HistoryFilters
            filters={filters}
            setFilters={setFilters}
            subjects={subjects}
            resultCount={filtered.length}
            noun="event"
            idPrefix="masc-events"
          />
          {safetyEvents.items.length === 0 ? (
            <EmptyState
              title="No safety events in this retention window"
              detail="This is separate from the learning history. New events will appear here if the tutor withholds an answer, pauses, or escalates."
            />
          ) : filtered.length === 0 ? (
            <div className="masc-no-results" role="status">
              <h3>No safety events match these filters</h3>
              <p>Clear a filter or try a different search phrase.</p>
            </div>
          ) : (
            <div className="masc-event-list">
              {filtered.map((event) => (
                <SafetyEventCard
                  key={event.eventRef}
                  event={event}
                  role={role}
                  studentRef={studentRef}
                  onAction={onAction}
                  pendingAction={pendingAction}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
