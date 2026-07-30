import {
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { applyParentControlEvent, getRecommendationDecision } from "./controls.js";
import {
  createParentDashboardDemoModel,
} from "./demo-data.js";
import {
  ParentControlError,
  type ParentControlEvent,
  type ParentDashboardModel,
  type ParentVisibleEvidence,
} from "./contracts.js";
import { PARENT_DASHBOARD_CSS } from "./styles.js";

interface ParentDashboardPrototypeProps {
  readonly initialModel?: ParentDashboardModel;
  readonly includeStyles?: boolean;
  readonly now?: () => string;
}

interface ViewState {
  readonly model: ParentDashboardModel;
  readonly statusMessage: string;
}

function Metric({
  value,
  label,
}: {
  readonly value: number;
  readonly label: string;
}) {
  return (
    <div className="ma-metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function InsightGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="ma-insight-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function EvidenceList({
  evidence,
}: {
  readonly evidence: readonly ParentVisibleEvidence[];
}) {
  return (
    <ul className="ma-evidence-list">
      {evidence.map((item) => (
        <li key={item.evidenceRef}>
          {item.description}{" "}
          <span className="ma-subtle">
            ({item.source.replaceAll("_", " ")})
          </span>
        </li>
      ))}
    </ul>
  );
}

function safeEventRef(prefix: string, timestamp: string): string {
  return `${prefix}:${timestamp.replace(/[^0-9]/g, "")}`;
}

function visibleMinutes(hidden: boolean, minutes: number): string {
  return hidden ? "Time hidden by parent" : `${minutes} minutes`;
}

export function ParentDashboardPrototype({
  initialModel = createParentDashboardDemoModel(),
  includeStyles = true,
  now = () => new Date().toISOString(),
}: ParentDashboardPrototypeProps) {
  const [view, setView] = useState<ViewState>({
    model: initialModel,
    statusMessage: "",
  });
  const [maximumMinutes, setMaximumMinutes] = useState(
    String(initialModel.controls.maximumWorkDurationMinutes),
  );
  const [breakMinutes, setBreakMinutes] = useState(
    String(initialModel.controls.breakDurationMinutes),
  );
  const [accommodationAction, setAccommodationAction] = useState(
    "Offer written directions before the first example.",
  );
  const [accommodationMessage, setAccommodationMessage] = useState(
    "You can use the written steps whenever they help.",
  );
  const [rescheduleAt, setRescheduleAt] = useState(
    "2026-07-29T13:30:00-04:00",
  );
  const [privateNote, setPrivateNote] = useState("");
  const [reviewReason, setReviewReason] = useState(
    "Please review the fraction-model step before the next assignment.",
  );

  const { model } = view;
  const { snapshot, controls } = model;
  const recommendation = snapshot.studyHabits.recommendation;
  const decision = getRecommendationDecision(
    controls,
    recommendation.recommendationRef,
  );

  const submitControl = (
    event: ParentControlEvent,
    successMessage: string,
  ): void => {
    setView((previous) => {
      try {
        return {
          model: applyParentControlEvent(previous.model, event),
          statusMessage: successMessage,
        };
      } catch (error) {
        const message =
          error instanceof ParentControlError
            ? error.message
            : "The mock could not apply that parent control.";
        return { ...previous, statusMessage: message };
      }
    });
  };

  const handleSubmit =
    (callback: () => void) => (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      callback();
    };

  return (
    <>
      {includeStyles ? <style>{PARENT_DASHBOARD_CSS}</style> : null}
      <main className="ma-parent-dashboard">
        <div className="ma-dashboard-shell">
          <header className="ma-dashboard-header">
            <p className="ma-section-kicker">Manuel Academy prototype</p>
            <h1>Parent study insights</h1>
            <p>
              {snapshot.learnerLabel} · {snapshot.today.date} ·{" "}
              {snapshot.zoneId}
            </p>
            <p>
              Every recommendation below includes visible evidence. These are
              current learning observations, not permanent learner labels.
            </p>
          </header>

          <div className="ma-dashboard-grid">
            <section
              className="ma-dashboard-card"
              data-section="today"
              aria-labelledby="parent-today-heading"
            >
              <p className="ma-section-kicker">Today</p>
              <h2 id="parent-today-heading">TODAY</h2>

              <div className="ma-metric-grid" aria-label="Today summary">
                <Metric
                  value={snapshot.today.scheduledBlocks.length}
                  label="Scheduled blocks"
                />
                <Metric
                  value={snapshot.today.completedBlocks.length}
                  label="Completed blocks"
                />
                <Metric
                  value={snapshot.today.skillsReviewed.length}
                  label="Skills reviewed"
                />
                <Metric
                  value={snapshot.today.breaksTaken.length}
                  label="Breaks taken"
                />
                <Metric
                  value={snapshot.today.resumableWork.length}
                  label="Resumable work"
                />
                <Metric
                  value={snapshot.today.assignmentsNeedingSupport.length}
                  label="Assignments needing support"
                />
              </div>

              <InsightGroup title="Scheduled blocks">
                <ul className="ma-insight-list">
                  {snapshot.today.scheduledBlocks.map((block) => (
                    <li key={block.blockRef}>
                      <strong>{block.title}</strong> · {block.subject} ·{" "}
                      {block.status.replaceAll("_", " ")}
                      <div className="ma-subtle">
                        Estimated:{" "}
                        {visibleMinutes(
                          controls.timersHidden,
                          block.estimatedMinutes,
                        )}
                        {block.actualMinutes === undefined
                          ? ""
                          : ` · Actual: ${visibleMinutes(
                              controls.timersHidden,
                              block.actualMinutes,
                            )}`}
                      </div>
                    </li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Completed blocks">
                <ul className="ma-insight-list">
                  {snapshot.today.completedBlocks.map((block) => (
                    <li key={block.blockRef}>{block.title}</li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Skills reviewed">
                <ul className="ma-insight-list">
                  {snapshot.today.skillsReviewed.map((skill) => (
                    <li key={skill.skillRef}>
                      <strong>{skill.label}</strong> ·{" "}
                      {skill.reviewKind.replaceAll("_", " ")}
                      <EvidenceList evidence={skill.evidence} />
                    </li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Breaks taken">
                <ul className="ma-insight-list">
                  {snapshot.today.breaksTaken.map((item) => (
                    <li key={item.breakRef}>
                      Approved break ·{" "}
                      {visibleMinutes(
                        controls.timersHidden,
                        item.durationMinutes,
                      )}{" "}
                      · {item.context}
                    </li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Resumable work">
                {snapshot.today.resumableWork.map((item) => (
                  <article className="ma-progress-note" key={item.blockRef}>
                    <strong>{item.title}</strong>
                    <p>
                      {item.completedSegments} of {item.totalSegments} sections
                      complete
                    </p>
                    <p>
                      Estimated time remaining:{" "}
                      {visibleMinutes(
                        controls.timersHidden,
                        item.estimatedMinutesRemaining,
                      )}
                    </p>
                    <p>Resume at: {item.resumeAt}</p>
                    <p>{item.studentMessage}</p>
                  </article>
                ))}
              </InsightGroup>

              <InsightGroup title="Assignments needing support">
                <ul className="ma-insight-list">
                  {snapshot.today.assignmentsNeedingSupport.map((item) => (
                    <li key={item.assignmentRef}>
                      <strong>{item.title}</strong> · {item.course}
                      <div>{item.supportReason}</div>
                    </li>
                  ))}
                </ul>
              </InsightGroup>
            </section>

            <section
              className="ma-dashboard-card"
              data-section="learning"
              aria-labelledby="parent-learning-heading"
            >
              <p className="ma-section-kicker">Learning</p>
              <h2 id="parent-learning-heading">LEARNING</h2>

              <InsightGroup title="Mastered skills">
                <ul className="ma-insight-list">
                  {snapshot.learning.masteredSkills.map((item) => (
                    <li key={item.skillRef}>
                      <strong>{item.label}</strong>
                      <EvidenceList evidence={item.evidence} />
                    </li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Developing skills">
                <ul className="ma-insight-list">
                  {snapshot.learning.developingSkills.map((item) => (
                    <li key={item.skillRef}>
                      <strong>{item.label}</strong>
                      <EvidenceList evidence={item.evidence} />
                    </li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Prerequisite gaps">
                <ul className="ma-insight-list">
                  {snapshot.learning.prerequisiteGaps.map((item) => (
                    <li key={item.skillRef}>
                      <strong>{item.label}</strong>
                      <EvidenceList evidence={item.evidence} />
                    </li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Upcoming reviews">
                <ul className="ma-insight-list">
                  {snapshot.learning.upcomingReviews.map((item) => (
                    <li key={item.reviewRef}>
                      {item.skillLabel} · {item.priority.replaceAll("_", " ")}
                    </li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Repeated misconceptions">
                <ul className="ma-insight-list">
                  {snapshot.learning.repeatedMisconceptions.map((item) => (
                    <li key={item.insightRef}>
                      <strong>{item.observation}</strong>
                      <div className="ma-subtle">
                        Observed {item.occurrences} times
                      </div>
                      <EvidenceList evidence={item.evidence} />
                      <div>{item.supportiveNextStep}</div>
                    </li>
                  ))}
                </ul>
              </InsightGroup>
            </section>

            <section
              className="ma-dashboard-card"
              data-section="study-habits"
              aria-labelledby="parent-habits-heading"
            >
              <p className="ma-section-kicker">Study habits</p>
              <h2 id="parent-habits-heading">STUDY HABITS</h2>

              {snapshot.studyHabits.currentEffectiveWorkBlockRanges.map(
                (range) => (
                  <p className="ma-habit-range" key={range.subject}>
                    {range.displayText}
                  </p>
                ),
              )}

              <InsightGroup title="Best-performing task lengths">
                <ul className="ma-insight-list">
                  {snapshot.studyHabits.bestPerformingTaskLengths.map((item) => (
                    <li key={item.taskKind}>
                      <strong>{item.taskKind}</strong> · {item.minimumMinutes}–
                      {item.maximumMinutes} minutes
                      <EvidenceList evidence={item.evidence} />
                    </li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Subjects that benefit from shorter sections">
                <ul className="ma-insight-list">
                  {snapshot.studyHabits.subjectsBenefitingFromShorterSections.map(
                    (item) => (
                      <li key={item.subject}>
                        <strong>{item.subject}</strong> · suggested{" "}
                        {item.suggestedSectionMinutes}-minute sections
                        <EvidenceList evidence={item.evidence} />
                      </li>
                    ),
                  )}
                </ul>
              </InsightGroup>

              <InsightGroup title="Approved breaks">
                <ul className="ma-insight-list">
                  {snapshot.studyHabits.approvedBreaks.map((item) => (
                    <li key={item.breakRef}>
                      {visibleMinutes(
                        controls.timersHidden,
                        item.durationMinutes,
                      )}{" "}
                      · {item.context}
                    </li>
                  ))}
                </ul>
              </InsightGroup>

              <InsightGroup title="Suggested increase, maintain, or decrease">
                <div className="ma-recommendation">
                  <strong>
                    Recommendation: {recommendation.direction}
                  </strong>
                  <p>{recommendation.summary}</p>
                  <h3>Evidence supporting the recommendation</h3>
                  <EvidenceList evidence={recommendation.evidence} />
                  <div className="ma-recommendation-actions">
                    <button
                      type="button"
                      data-control="accept-recommendation"
                      onClick={() =>
                        submitControl(
                          {
                            type: "recommendation_accepted",
                            recommendationRef:
                              recommendation.recommendationRef,
                            at: now(),
                          },
                          "Recommendation accepted. Parent settings remain editable.",
                        )
                      }
                    >
                      Accept recommendation
                    </button>
                    <button
                      type="button"
                      data-tone="secondary"
                      data-control="reject-recommendation"
                      onClick={() =>
                        submitControl(
                          {
                            type: "recommendation_rejected",
                            recommendationRef:
                              recommendation.recommendationRef,
                            at: now(),
                          },
                          "Recommendation rejected. No suggested duration was applied.",
                        )
                      }
                    >
                      Reject recommendation
                    </button>
                  </div>
                  <p className="ma-subtle">
                    Parent decision: {decision?.decision ?? "pending"}
                  </p>
                </div>
              </InsightGroup>
            </section>
          </div>

          <section
            className="ma-control-panel"
            aria-labelledby="parent-controls-heading"
          >
            <p className="ma-section-kicker">Parent controls</p>
            <h2 id="parent-controls-heading">PARENT CONTROLS</h2>
            <p>
              Each action updates only this in-memory demonstration and emits a
              provisional control event for a future approved integration.
            </p>

            <div className="ma-control-grid">
              <form
                className="ma-control"
                onSubmit={handleSubmit(() =>
                  submitControl(
                    {
                      type: "maximum_work_duration_set",
                      minutes: Number(maximumMinutes),
                      at: now(),
                    },
                    "Maximum work duration updated.",
                  ),
                )}
              >
                <label htmlFor="maximum-work-duration">
                  Set maximum work duration
                </label>
                <input
                  id="maximum-work-duration"
                  inputMode="numeric"
                  min="5"
                  max="180"
                  type="number"
                  value={maximumMinutes}
                  onChange={(event) => setMaximumMinutes(event.target.value)}
                />
                <button
                  type="submit"
                  data-control="set-maximum-work-duration"
                >
                  Save maximum
                </button>
              </form>

              <form
                className="ma-control"
                onSubmit={handleSubmit(() =>
                  submitControl(
                    {
                      type: "break_duration_set",
                      minutes: Number(breakMinutes),
                      at: now(),
                    },
                    "Break duration updated.",
                  ),
                )}
              >
                <label htmlFor="break-duration">Set break duration</label>
                <input
                  id="break-duration"
                  inputMode="numeric"
                  min="1"
                  max="60"
                  type="number"
                  value={breakMinutes}
                  onChange={(event) => setBreakMinutes(event.target.value)}
                />
                <button type="submit" data-control="set-break-duration">
                  Save break
                </button>
              </form>

              <div className="ma-control">
                <label
                  className="ma-inline-control"
                  htmlFor="hide-dashboard-timers"
                >
                  <input
                    id="hide-dashboard-timers"
                    type="checkbox"
                    checked={controls.timersHidden}
                    data-control="hide-timers"
                    onChange={(event) =>
                      submitControl(
                        {
                          type: "timers_hidden_set",
                          hidden: event.target.checked,
                          at: now(),
                        },
                        event.target.checked
                          ? "Timers hidden."
                          : "Timers shown.",
                      )
                    }
                  />
                  Hide timers
                </label>
                <p className="ma-subtle">
                  Hides time values from this prototype without deleting
                  schedule records.
                </p>
              </div>

              <form
                className="ma-control"
                onSubmit={handleSubmit(() => {
                  const at = now();
                  submitControl(
                    {
                      type: "accommodation_added",
                      accommodationRef: safeEventRef("accommodation", at),
                      action: accommodationAction,
                      studentMessage: accommodationMessage,
                      at,
                    },
                    "Accommodation added with supportive learner language.",
                  );
                })}
              >
                <label htmlFor="accommodation-action">Add accommodation</label>
                <input
                  id="accommodation-action"
                  value={accommodationAction}
                  onChange={(event) =>
                    setAccommodationAction(event.target.value)
                  }
                />
                <label htmlFor="accommodation-student-message">
                  Supportive student message
                </label>
                <input
                  id="accommodation-student-message"
                  value={accommodationMessage}
                  onChange={(event) =>
                    setAccommodationMessage(event.target.value)
                  }
                />
                <button type="submit" data-control="add-accommodation">
                  Add accommodation
                </button>
              </form>

              <form
                className="ma-control"
                onSubmit={handleSubmit(() =>
                  submitControl(
                    {
                      type: "incomplete_work_rescheduled",
                      blockRef:
                        snapshot.today.resumableWork[0]?.blockRef ??
                        "block:unavailable",
                      startsAt: rescheduleAt,
                      reason: "Parent rescheduled incomplete work.",
                      at: now(),
                    },
                    "Incomplete work rescheduled in the mock boundary.",
                  ),
                )}
              >
                <label htmlFor="reschedule-incomplete">
                  Reschedule incomplete work
                </label>
                <select
                  id="reschedule-incomplete"
                  defaultValue={snapshot.today.resumableWork[0]?.blockRef}
                >
                  {snapshot.today.resumableWork.map((item) => (
                    <option key={item.blockRef} value={item.blockRef}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <label htmlFor="reschedule-at">
                  New start (ISO timestamp with offset)
                </label>
                <input
                  id="reschedule-at"
                  value={rescheduleAt}
                  onChange={(event) => setRescheduleAt(event.target.value)}
                />
                <button
                  type="submit"
                  data-control="reschedule-incomplete-work"
                >
                  Reschedule
                </button>
              </form>

              <div className="ma-control">
                <fieldset>
                  <legend>Mark interruption</legend>
                  <p className="ma-subtle">
                    Records only an outside or technical interruption category.
                  </p>
                  <div className="ma-interruption-actions">
                    {(["outside", "technical"] as const).map((kind) => (
                      <button
                        type="button"
                        data-control={`mark-${kind}-interruption`}
                        key={kind}
                        onClick={() => {
                          const at = now();
                          submitControl(
                            {
                              type: "interruption_marked",
                              interruptionRef: safeEventRef(
                                `interruption-${kind}`,
                                at,
                              ),
                              kind,
                              blockRef:
                                snapshot.today.resumableWork[0]?.blockRef,
                              occurredAt: at,
                              at,
                            },
                            `${kind[0].toUpperCase()}${kind.slice(
                              1,
                            )} interruption marked.`,
                          );
                        }}
                      >
                        {kind === "outside"
                          ? "Outside interruption"
                          : "Technical interruption"}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <form
                className="ma-control"
                onSubmit={handleSubmit(() => {
                  const at = now();
                  submitControl(
                    {
                      type: "private_note_added",
                      noteRef: safeEventRef("private-note", at),
                      body: privateNote,
                      at,
                    },
                    "Private note saved to the parent-only mock collection.",
                  );
                  setPrivateNote("");
                })}
              >
                <label htmlFor="private-note">Add private note</label>
                <textarea
                  id="private-note"
                  value={privateNote}
                  onChange={(event) => setPrivateNote(event.target.value)}
                />
                <button type="submit" data-control="add-private-note">
                  Save private note
                </button>
                <p className="ma-subtle">
                  Parent only. Note contents never appear in learner-facing
                  output.
                </p>
              </form>

              <form
                className="ma-control"
                onSubmit={(event) => event.preventDefault()}
              >
                <label htmlFor="review-reason">
                  Request teacher or tutor review
                </label>
                <textarea
                  id="review-reason"
                  value={reviewReason}
                  onChange={(event) => setReviewReason(event.target.value)}
                />
                <div className="ma-review-actions">
                  {(["teacher", "tutor"] as const).map((audience) => (
                    <button
                      type="button"
                      data-control={`request-${audience}-review`}
                      key={audience}
                      onClick={() => {
                        const at = now();
                        submitControl(
                          {
                            type: "review_requested",
                            requestRef: safeEventRef(
                              `${audience}-review`,
                              at,
                            ),
                            audience,
                            subjectRef: "skill:add-unlike-denominators",
                            reason: reviewReason,
                            at,
                          },
                          `${
                            audience[0].toUpperCase() + audience.slice(1)
                          } review requested.`,
                        );
                      }}
                    >
                      Request {audience} review
                    </button>
                  ))}
                </div>
              </form>
            </div>

            <div className="ma-control-summary">
              <strong>Current parent settings</strong>
              <div>
                Maximum work duration:{" "}
                {controls.maximumWorkDurationMinutes} minutes · Break:{" "}
                {controls.breakDurationMinutes} minutes · Timers:{" "}
                {controls.timersHidden ? "hidden" : "shown"}
              </div>
              <div>
                Accommodations: {controls.accommodations.length} · Reschedules:{" "}
                {controls.incompleteWorkReschedules.length} · Interruptions:{" "}
                {controls.interruptions.length} · Private notes:{" "}
                {controls.privateNotes.length} · Review requests:{" "}
                {controls.reviewRequests.length}
              </div>
            </div>
            <p className="ma-status" role="status" aria-live="polite">
              {view.statusMessage}
            </p>
          </section>
        </div>
      </main>
    </>
  );
}

export function ParentDashboardDemoPage({
  initialModel,
}: {
  readonly initialModel?: ParentDashboardModel;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <title>Manuel Academy Parent Study Insights Prototype</title>
      </head>
      <body>
        <ParentDashboardPrototype initialModel={initialModel} />
      </body>
    </html>
  );
}
