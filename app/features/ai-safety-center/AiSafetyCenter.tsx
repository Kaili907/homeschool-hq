import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AiSafetyCenterProps,
  SafetyCenterAction,
  SafetyCenterActionResult,
  SafetyCenterBoundaryIssue,
  SafetyEvent,
} from "./contracts";
import {
  actionMatchesStudent,
  evaluateSafetyCenterAccess,
  roleMayDispatchAction,
  severityRank,
} from "./model";
import { formatDateTime } from "./format";
import {
  InlineNotice,
  SectionHeading,
  SeverityBadge,
  StatusBadge,
} from "./SafetyCenterCommon";
import {
  InstructionalHistoryPanel,
  SafetyEventsPanel,
} from "./SafetyCenterHistory";
import { ParentSafetyControls } from "./ParentSafetyControls";
import {
  ParentDataAndReview,
  StudentSafetyTools,
} from "./SafetyCenterOperations";
import "./ai-safety-center.css";

type ParentSection = "overview" | "history" | "safety" | "controls" | "data";
type StudentSection = "overview" | "history" | "safety" | "help";
type VisibleSection = ParentSection | StudentSection;

const PARENT_NAV: readonly {
  readonly id: ParentSection;
  readonly label: string;
  readonly shortLabel: string;
}[] = [
  { id: "overview", label: "Safety overview", shortLabel: "Overview" },
  { id: "history", label: "Tutor history", shortLabel: "History" },
  { id: "safety", label: "Safety events", shortLabel: "Events" },
  { id: "controls", label: "Tutor controls", shortLabel: "Controls" },
  { id: "data", label: "Data and review", shortLabel: "Data" },
];

const STUDENT_NAV: readonly {
  readonly id: StudentSection;
  readonly label: string;
  readonly shortLabel: string;
}[] = [
  { id: "overview", label: "My safety overview", shortLabel: "Overview" },
  { id: "history", label: "My tutor history", shortLabel: "History" },
  { id: "safety", label: "My safety notices", shortLabel: "Notices" },
  { id: "help", label: "Report or pause tutor", shortLabel: "Get help" },
];

function defaultSection(
  role: AiSafetyCenterProps["viewer"]["role"],
  requested: AiSafetyCenterProps["initialSection"],
): VisibleSection {
  const allowed =
    role === "parent"
      ? new Set<VisibleSection>(PARENT_NAV.map((item) => item.id))
      : new Set<VisibleSection>(STUDENT_NAV.map((item) => item.id));
  return requested && allowed.has(requested) ? requested : "overview";
}

function CollectionMetric({
  value,
  label,
  note,
  tone = "neutral",
}: {
  readonly value: string;
  readonly label: string;
  readonly note: string;
  readonly tone?: "neutral" | "accent" | "warning";
}) {
  return (
    <div className="masc-metric" data-tone={tone}>
      <span className="masc-metric-value">{value}</span>
      <strong>{label}</strong>
      <span>{note}</span>
    </div>
  );
}

function AccessDenied({
  issue,
  onClose,
}: {
  readonly issue: SafetyCenterBoundaryIssue;
  readonly onClose?: () => void;
}) {
  return (
    <div className="masc-root masc-access-denied">
      <main className="masc-access-card" aria-labelledby="access-denied-title">
        <span className="masc-access-mark" aria-hidden="true">
          !
        </span>
        <p className="masc-eyebrow">Access check</p>
        <h1 id="access-denied-title">Student information stays hidden</h1>
        <p>{issue.safeMessage}</p>
        <p>
          Return to the profile picker and sign in again. If this keeps
          happening, ask the account owner to verify the family relationship.
        </p>
        {onClose ? (
          <button className="masc-button" type="button" onClick={onClose}>
            Return
          </button>
        ) : null}
      </main>
    </div>
  );
}

function ParentOverview({
  studentName,
  data,
  openEventCount,
  urgentEventCount,
  recentEvents,
  setSection,
}: {
  readonly studentName: string;
  readonly data: AiSafetyCenterProps["data"];
  readonly openEventCount: number | null;
  readonly urgentEventCount: number | null;
  readonly recentEvents: readonly SafetyEvent[];
  readonly setSection: (section: VisibleSection) => void;
}) {
  const historyCount =
    data.instructionalHistory.status === "ready"
      ? data.instructionalHistory.items.length
      : null;
  const reviewCount =
    data.reviewQueue.status === "ready"
      ? data.reviewQueue.items.filter(
          (item) => item.status !== "resolved" && item.status !== "dismissed",
        ).length
      : null;

  return (
    <section aria-labelledby="overview-heading">
      <SectionHeading
        id="overview-heading"
        eyebrow="At a glance"
        title={`${studentName}'s AI safety overview`}
        description="Instructional history, safety events, and parent controls stay distinct so each record has a clear purpose."
      />

      <div className="masc-metric-grid">
        <CollectionMetric
          value={historyCount === null ? "—" : String(historyCount)}
          label="Tutor conversations"
          note={
            historyCount === null
              ? "History unavailable"
              : `Retained for ${data.permissions.retention.instructionalHistoryDays} days`
          }
          tone="accent"
        />
        <CollectionMetric
          value={openEventCount === null ? "—" : String(openEventCount)}
          label="Open safety events"
          note={
            urgentEventCount === null
              ? "Events unavailable"
              : `${urgentEventCount} need${urgentEventCount === 1 ? "s" : ""} a prompt check-in`
          }
          tone={urgentEventCount ? "warning" : "neutral"}
        />
        <CollectionMetric
          value={reviewCount === null ? "—" : String(reviewCount)}
          label="Human reviews"
          note={
            reviewCount === null
              ? "Queue unavailable"
              : "Awaiting or in review"
          }
        />
      </div>

      <div className="masc-overview-grid">
        <section className="masc-overview-card masc-overview-card-featured">
          <p className="masc-eyebrow">What parents can review</p>
          <h3>Clear visibility, one student at a time</h3>
          <ul className="masc-check-list">
            <li>Tutor conversation text and learning-help timeline</li>
            <li>Safety classifications and why an answer was withheld</li>
            <li>Notifications, review requests, and safety audit actions</li>
          </ul>
          <p className="masc-card-footnote">
            This view is scoped only to {studentName}. It has no sibling
            selector and rejects mixed-student data.
          </p>
          <button
            className="masc-button masc-button-light"
            type="button"
            onClick={() => setSection("history")}
          >
            Review tutor history
          </button>
        </section>

        <section className="masc-overview-card">
          <p className="masc-eyebrow">Privacy boundary</p>
          <h3>What this center does not need</h3>
          <ul className="masc-plain-list">
            <li>No raw microphone recordings</li>
            <li>No hidden behavior or attention score</li>
            <li>No sibling conversation data</li>
            <li>No unrelated personal details in notifications</li>
          </ul>
          <button
            className="masc-button masc-button-secondary"
            type="button"
            onClick={() => setSection("data")}
          >
            Manage data
          </button>
        </section>
      </div>

      <InlineNotice
        title="Tutor messages have a safety exception"
        tone="privacy"
      >
        <p>
          Parents can review tutor conversations and safety events. Anything
          entered inside a tutor conversation, including a reflection, follows
          that safety exception. Separate mindset journal text is not collected
          or reviewed by this safety center.
        </p>
      </InlineNotice>

      <section className="masc-recent-section" aria-labelledby="recent-heading">
        <div className="masc-subheading-row">
          <div>
            <p className="masc-eyebrow">Recent activity</p>
            <h3 id="recent-heading">Latest safety events</h3>
          </div>
          <button
            className="masc-text-button"
            type="button"
            onClick={() => setSection("safety")}
          >
            View all events
          </button>
        </div>
        {data.safetyEvents.status !== "ready" ? (
          <p className="masc-muted">
            Safety events are unavailable. This is not treated as “no events.”
          </p>
        ) : recentEvents.length === 0 ? (
          <p className="masc-muted">
            No safety events in the current retention window.
          </p>
        ) : (
          <ol className="masc-recent-events">
            {recentEvents.map((event) => (
              <li key={event.eventRef}>
                <SeverityBadge severity={event.severity} />
                <div>
                  <strong>{event.summary}</strong>
                  <time dateTime={event.occurredAt}>
                    {formatDateTime(event.occurredAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

function StudentOverview({
  studentName,
  data,
  recentEvents,
  setSection,
}: {
  readonly studentName: string;
  readonly data: AiSafetyCenterProps["data"];
  readonly recentEvents: readonly SafetyEvent[];
  readonly setSection: (section: VisibleSection) => void;
}) {
  return (
    <section aria-labelledby="student-overview-heading">
      <div className="masc-student-hero">
        <div>
          <p className="masc-eyebrow">Your tutor, your controls</p>
          <h2 id="student-overview-heading">
            Hi {studentName}. You can stop and speak up.
          </h2>
          <p>
            The tutor should help you learn, explain when it cannot answer, and
            never make you feel stuck with something uncomfortable.
          </p>
          <div className="masc-button-row">
            <button
              className="masc-button masc-button-light"
              type="button"
              onClick={() => setSection("help")}
            >
              Report or pause tutor
            </button>
            <button
              className="masc-button masc-button-ghost-light"
              type="button"
              onClick={() => setSection("history")}
            >
              See my history
            </button>
          </div>
        </div>
        <div className="masc-student-hero-mark" aria-hidden="true">
          <span>✓</span>
        </div>
      </div>

      <div className="masc-student-info-grid">
        <section className="masc-overview-card">
          <span className="masc-card-symbol" aria-hidden="true">
            1
          </span>
          <h3>The tutor should say why</h3>
          <p>
            It may hold back a final answer so you can learn, or stop when a
            request is not safe. It should use simple words and offer a safe
            next step.
          </p>
        </section>
        <section className="masc-overview-card">
          <span className="masc-card-symbol" aria-hidden="true">
            2
          </span>
          <h3>You can report anything</h3>
          <p>
            You can send a report without writing details. A parent or reviewer
            may read it so they can help.
          </p>
        </section>
        <section className="masc-overview-card">
          <span className="masc-card-symbol" aria-hidden="true">
            3
          </span>
          <h3>You can pause it now</h3>
          <p>
            Pausing stops new tutor help for you. Your history and report tools
            still work.
          </p>
        </section>
      </div>

      <InlineNotice title="What your parent can see" tone="privacy">
        <p>
          Your parent can review your tutor conversations and safety events.
          A reflection typed in a tutor conversation follows the same rule.
          Your separate mindset journal is not collected here. You are not in
          trouble for asking for help.
        </p>
      </InlineNotice>

      <section className="masc-recent-section" aria-labelledby="my-notices-heading">
        <div className="masc-subheading-row">
          <div>
            <p className="masc-eyebrow">Your record</p>
            <h3 id="my-notices-heading">Recent safety notices</h3>
          </div>
          <button
            className="masc-text-button"
            type="button"
            onClick={() => setSection("safety")}
          >
            View notices
          </button>
        </div>
        {data.safetyEvents.status !== "ready" ? (
          <p className="masc-muted">
            Notices are unavailable right now. Report and pause controls still
            work.
          </p>
        ) : recentEvents.length === 0 ? (
          <p className="masc-muted">
            No safety notices in the current retention window.
          </p>
        ) : (
          <ol className="masc-recent-events">
            {recentEvents.slice(0, 2).map((event) => (
              <li key={event.eventRef}>
                <SeverityBadge severity={event.severity} />
                <div>
                  <strong>{event.studentExplanation}</strong>
                  <time dateTime={event.occurredAt}>
                    {formatDateTime(event.occurredAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

export function AiSafetyCenter({
  viewer,
  student,
  data,
  onAction,
  onClose,
  onBoundaryViolation,
  initialSection,
}: AiSafetyCenterProps) {
  const access = useMemo(
    () => evaluateSafetyCenterAccess(viewer, student, data),
    [viewer, student, data],
  );
  const [section, setSectionState] = useState<VisibleSection>(() =>
    defaultSection(viewer.role, initialSection),
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    readonly tone: "positive" | "warning";
    readonly message: string;
    readonly requestRef?: string;
  } | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!access.allowed) onBoundaryViolation?.(access.issue);
  }, [access, onBoundaryViolation]);

  useEffect(() => {
    setSectionState(defaultSection(viewer.role, initialSection));
  }, [viewer.role, initialSection, student.studentRef]);

  const dispatchAction = useCallback(
    async (action: SafetyCenterAction): Promise<SafetyCenterActionResult> => {
      if (
        !access.allowed ||
        !actionMatchesStudent(action, student.studentRef) ||
        !roleMayDispatchAction(viewer.role, action)
      ) {
        const issue: SafetyCenterBoundaryIssue = {
          code: "action_not_authorized",
          safeMessage:
            "This action was not sent because the current role or student scope did not match.",
        };
        onBoundaryViolation?.(issue);
        setFeedback({ tone: "warning", message: issue.safeMessage });
        return { status: "rejected", message: issue.safeMessage };
      }

      setPendingAction(action.type);
      setFeedback(null);
      try {
        const result = await onAction(action);
        setFeedback({
          tone: result.status === "rejected" ? "warning" : "positive",
          message: result.message,
          ...(result.requestRef ? { requestRef: result.requestRef } : {}),
        });
        return result;
      } catch {
        const result: SafetyCenterActionResult = {
          status: "rejected",
          message:
            "The request could not be sent. Nothing was changed. Please try again.",
        };
        setFeedback({ tone: "warning", message: result.message });
        return result;
      } finally {
        setPendingAction(null);
      }
    },
    [
      access,
      onAction,
      onBoundaryViolation,
      student.studentRef,
      viewer.role,
    ],
  );

  if (!access.allowed) {
    return <AccessDenied issue={access.issue} onClose={onClose} />;
  }

  const isParent = viewer.role === "parent";
  const navItems = isParent ? PARENT_NAV : STUDENT_NAV;
  const safetyEvents =
    data.safetyEvents.status === "ready" ? data.safetyEvents.items : null;
  const openEventCount =
    safetyEvents?.filter(
      (event) =>
        event.status !== "resolved" && event.status !== "false_positive",
    ).length ?? null;
  const urgentEventCount =
    safetyEvents?.filter(
      (event) =>
        event.status !== "resolved" && severityRank(event.severity) >= 3,
    ).length ?? null;
  const recentEvents =
    safetyEvents === null
      ? []
      : [...safetyEvents]
          .sort((left, right) =>
            right.occurredAt.localeCompare(left.occurredAt),
          )
          .slice(0, 3);

  function setSection(next: VisibleSection): void {
    setSectionState(next);
    window.requestAnimationFrame(() => mainRef.current?.focus());
  }

  return (
    <div className="masc-root">
      <a className="masc-skip-link" href="#masc-main">
        Skip to safety center content
      </a>

      <header className="masc-topbar">
        <div className="masc-shell masc-topbar-inner">
          <div className="masc-brand">
            <span className="masc-brand-mark" aria-hidden="true">
              M
            </span>
            <div>
              <strong>Manuel Academy</strong>
              <span>AI Safety Center</span>
            </div>
          </div>
          <div className="masc-topbar-actions">
            <StatusBadge tone="accent">
              {isParent ? "Parent view" : "Student view"}
            </StatusBadge>
            {onClose ? (
              <button
                className="masc-button masc-button-ghost-light"
                type="button"
                onClick={onClose}
              >
                Done
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="masc-shell">
        <section className="masc-scope-banner" aria-label="Selected student">
          <div>
            <span className="masc-avatar" aria-hidden="true">
              {student.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <span>{isParent ? "Reviewing" : "Signed in as"}</span>
              <strong>{student.displayName}</strong>
              <span>{student.gradeLabel}</span>
            </div>
          </div>
          <p>
            <span className="masc-scope-lock" aria-hidden="true">
              ●
            </span>
            One-student scope verified
          </p>
        </section>

        <nav className="masc-nav" aria-label="AI safety center sections">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <span className="masc-nav-long">{item.label}</span>
              <span className="masc-nav-short">{item.shortLabel}</span>
            </button>
          ))}
        </nav>

        {feedback ? (
          <div
            className="masc-action-feedback"
            data-tone={feedback.tone}
            role={feedback.tone === "warning" ? "alert" : "status"}
          >
            <span aria-hidden="true">
              {feedback.tone === "positive" ? "✓" : "!"}
            </span>
            <div>
              <strong>
                {feedback.tone === "positive"
                  ? "Request received"
                  : "Request not completed"}
              </strong>
              <p>{feedback.message}</p>
              {feedback.requestRef ? (
                <span>Reference: {feedback.requestRef}</span>
              ) : null}
            </div>
            <button
              className="masc-text-button"
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss status message"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <main
          id="masc-main"
          ref={mainRef}
          className="masc-main"
          tabIndex={-1}
        >
          {section === "overview" &&
            (isParent ? (
              <ParentOverview
                studentName={student.displayName}
                data={data}
                openEventCount={openEventCount}
                urgentEventCount={urgentEventCount}
                recentEvents={recentEvents}
                setSection={setSection}
              />
            ) : (
              <StudentOverview
                studentName={student.displayName}
                data={data}
                recentEvents={recentEvents}
                setSection={setSection}
              />
            ))}

          {section === "history" ? (
            <InstructionalHistoryPanel
              role={viewer.role}
              studentRef={student.studentRef}
              data={data}
              onAction={dispatchAction}
              pendingAction={pendingAction}
            />
          ) : null}

          {section === "safety" ? (
            <SafetyEventsPanel
              role={viewer.role}
              studentRef={student.studentRef}
              data={data}
              onAction={dispatchAction}
              pendingAction={pendingAction}
            />
          ) : null}

          {section === "controls" && isParent ? (
            <ParentSafetyControls
              studentRef={student.studentRef}
              studentName={student.displayName}
              data={data}
              onAction={dispatchAction}
              pendingAction={pendingAction}
            />
          ) : null}

          {section === "data" && isParent ? (
            <ParentDataAndReview
              studentRef={student.studentRef}
              data={data}
              onAction={dispatchAction}
              pendingAction={pendingAction}
            />
          ) : null}

          {section === "help" && !isParent ? (
            <StudentSafetyTools
              studentRef={student.studentRef}
              studentName={student.displayName}
              data={data}
              onAction={dispatchAction}
              pendingAction={pendingAction}
            />
          ) : null}
        </main>

        <footer className="masc-footer">
          <p>
            Generated {formatDateTime(data.generatedAt)} · Safety center UI{" "}
            {data.schemaVersion}
          </p>
          <p>
            This interface supports learning and safety review. It does not
            provide medical, legal, or emergency services.
          </p>
        </footer>
      </div>
    </div>
  );
}
