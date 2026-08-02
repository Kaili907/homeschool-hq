import { useEffect, useMemo, useState } from "react";
import type {
  HumanReviewQueueItem,
  InstructionalSession,
  RetentionSettings,
  SafetyAuditEntry,
  SafetyCenterData,
  StudentRef,
  StudentReportCategory,
} from "./contracts";
import { formatDateTime, sentenceCase } from "./format";
import {
  CollectionNotice,
  EmptyState,
  InlineNotice,
  SectionHeading,
  StatusBadge,
  type DispatchSafetyCenterAction,
} from "./SafetyCenterCommon";

function RetentionControls({
  studentRef,
  data,
  onAction,
  pendingAction,
}: {
  readonly studentRef: StudentRef;
  readonly data: SafetyCenterData;
  readonly onAction: DispatchSafetyCenterAction;
  readonly pendingAction: string | null;
}) {
  const [retention, setRetention] = useState<RetentionSettings>(
    data.permissions.retention,
  );

  useEffect(() => {
    setRetention(data.permissions.retention);
  }, [data.permissions.retention]);

  const changed =
    retention.instructionalHistoryDays !==
      data.permissions.retention.instructionalHistoryDays ||
    retention.safetyEventDays !==
      data.permissions.retention.safetyEventDays ||
    retention.auditHistoryDays !==
      data.permissions.retention.auditHistoryDays;

  return (
    <section className="masc-settings-card" aria-labelledby="retention-heading">
      <div className="masc-settings-card-heading">
        <div>
          <p className="masc-card-number" aria-hidden="true">
            01
          </p>
          <h3 id="retention-heading">Data retention</h3>
        </div>
      </div>
      <p className="masc-card-intro">
        Keep only what is needed for learning and safety. Shorter settings
        remove eligible records sooner.
      </p>
      <div className="masc-form-grid masc-form-grid-three">
        <div className="masc-field">
          <label htmlFor="masc-instruction-retention">
            Instructional history
          </label>
          <select
            id="masc-instruction-retention"
            value={retention.instructionalHistoryDays}
            onChange={(event) =>
              setRetention((current) => ({
                ...current,
                instructionalHistoryDays: Number(event.target.value) as
                  | 7
                  | 30
                  | 60
                  | 90,
              }))
            }
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        <div className="masc-field">
          <label htmlFor="masc-safety-retention">Safety events</label>
          <select
            id="masc-safety-retention"
            value={retention.safetyEventDays}
            onChange={(event) =>
              setRetention((current) => ({
                ...current,
                safetyEventDays: Number(event.target.value) as
                  | 90
                  | 180
                  | 365,
              }))
            }
          >
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>365 days</option>
          </select>
        </div>
        <div className="masc-field">
          <label htmlFor="masc-audit-retention">Audit history</label>
          <select
            id="masc-audit-retention"
            value={retention.auditHistoryDays}
            onChange={(event) =>
              setRetention((current) => ({
                ...current,
                auditHistoryDays: Number(event.target.value) as
                  | 180
                  | 365
                  | 730,
              }))
            }
          >
            <option value={180}>180 days</option>
            <option value={365}>365 days</option>
            <option value={730}>730 days</option>
          </select>
        </div>
      </div>
      <InlineNotice title="Active review hold" tone="privacy">
        <p>
          A record connected to an active safety review may be held until the
          review is resolved. A deletion request reports what was deleted and
          what remains on hold.
        </p>
      </InlineNotice>
      <button
        className="masc-button"
        type="button"
        disabled={!changed || pendingAction !== null}
        onClick={() =>
          void onAction({
            type: "retention_update_requested",
            studentRef,
            expectedRevision: data.permissions.revision,
            retention,
          })
        }
      >
        {pendingAction === "retention_update_requested"
          ? "Saving…"
          : "Save retention"}
      </button>
    </section>
  );
}

function ExportControls({
  studentRef,
  onAction,
  pendingAction,
}: {
  readonly studentRef: StudentRef;
  readonly onAction: DispatchSafetyCenterAction;
  readonly pendingAction: string | null;
}) {
  const [includeInstruction, setIncludeInstruction] = useState(true);
  const [includeSafety, setIncludeSafety] = useState(true);
  const [includeAudit, setIncludeAudit] = useState(true);
  const include = [
    ...(includeInstruction ? (["instructional_history"] as const) : []),
    ...(includeSafety ? (["safety_events"] as const) : []),
    ...(includeAudit ? (["audit_history"] as const) : []),
  ];

  return (
    <section className="masc-settings-card" aria-labelledby="export-heading">
      <div className="masc-settings-card-heading">
        <div>
          <p className="masc-card-number" aria-hidden="true">
            02
          </p>
          <h3 id="export-heading">Export a copy</h3>
        </div>
      </div>
      <p className="masc-card-intro">
        Export only this selected student's eligible records. Raw microphone
        audio is not part of this interface.
      </p>
      <fieldset className="masc-toggle-list">
        <legend className="masc-sr-only">Choose records to export</legend>
        <label className="masc-switch-row masc-switch-row-compact">
          <span>Instructional history</span>
          <input
            type="checkbox"
            checked={includeInstruction}
            onChange={(event) => setIncludeInstruction(event.target.checked)}
          />
        </label>
        <label className="masc-switch-row masc-switch-row-compact">
          <span>Safety events</span>
          <input
            type="checkbox"
            checked={includeSafety}
            onChange={(event) => setIncludeSafety(event.target.checked)}
          />
        </label>
        <label className="masc-switch-row masc-switch-row-compact">
          <span>Safety audit history</span>
          <input
            type="checkbox"
            checked={includeAudit}
            onChange={(event) => setIncludeAudit(event.target.checked)}
          />
        </label>
      </fieldset>
      <button
        className="masc-button"
        type="button"
        disabled={include.length === 0 || pendingAction !== null}
        onClick={() =>
          void onAction({
            type: "export_requested",
            studentRef,
            include,
          })
        }
      >
        {pendingAction === "export_requested"
          ? "Preparing request…"
          : "Request export"}
      </button>
    </section>
  );
}

function DeletionControls({
  studentRef,
  onAction,
  pendingAction,
}: {
  readonly studentRef: StudentRef;
  readonly onAction: DispatchSafetyCenterAction;
  readonly pendingAction: string | null;
}) {
  const [scope, setScope] = useState<
    "instructional_history" | "eligible_safety_records" | "all_eligible_records"
  >("instructional_history");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <section
      className="masc-settings-card masc-danger-card"
      aria-labelledby="deletion-heading"
    >
      <div className="masc-settings-card-heading">
        <div>
          <p className="masc-card-number" aria-hidden="true">
            03
          </p>
          <h3 id="deletion-heading">Request deletion</h3>
        </div>
      </div>
      <p className="masc-card-intro">
        This creates a tracked request; it does not silently erase active-review
        records or pretend a missing record was deleted.
      </p>
      <div className="masc-field">
        <label htmlFor="masc-delete-scope">Records</label>
        <select
          id="masc-delete-scope"
          value={scope}
          onChange={(event) => {
            setScope(
              event.target.value as
                | "instructional_history"
                | "eligible_safety_records"
                | "all_eligible_records",
            );
            setConfirmed(false);
          }}
        >
          <option value="instructional_history">
            Instructional history only
          </option>
          <option value="eligible_safety_records">
            Eligible safety records
          </option>
          <option value="all_eligible_records">All eligible records</option>
        </select>
      </div>
      <label className="masc-confirm-row">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>
          I understand that active safety reviews may remain temporarily on
          hold.
        </span>
      </label>
      <button
        className="masc-button masc-button-danger"
        type="button"
        disabled={!confirmed || pendingAction !== null}
        onClick={async () => {
          const result = await onAction({
            type: "deletion_requested",
            studentRef,
            scope,
          });
          if (result.status !== "rejected") setConfirmed(false);
        }}
      >
        {pendingAction === "deletion_requested"
          ? "Submitting…"
          : "Submit deletion request"}
      </button>
    </section>
  );
}

function ReviewQueue({
  data,
}: {
  readonly data: SafetyCenterData;
}) {
  if (data.reviewQueue.status !== "ready") {
    return (
      <CollectionNotice
        state={data.reviewQueue}
        title="Human-review queue"
      />
    );
  }

  if (data.reviewQueue.items.length === 0) {
    return (
      <EmptyState
        title="No items awaiting human review"
        detail="Review requests and possible false positives will appear here with their current status."
      />
    );
  }

  return (
    <ol className="masc-review-queue">
      {data.reviewQueue.items.map((item: HumanReviewQueueItem) => (
        <li key={item.reviewRef}>
          <div className="masc-review-queue-topline">
            <div>
              <strong>{item.reasonLabel}</strong>
              <span>{item.reviewRef}</span>
            </div>
            <StatusBadge
              tone={
                item.status === "resolved" || item.status === "dismissed"
                  ? "positive"
                  : "warning"
              }
            >
              {sentenceCase(item.status)}
            </StatusBadge>
          </div>
          <p>{item.expectedNextStep}</p>
          <div className="masc-review-meta">
            <time dateTime={item.requestedAt}>
              Requested {formatDateTime(item.requestedAt)}
            </time>
            {item.falsePositiveRequest ? (
              <span>
                False-positive review:{" "}
                {sentenceCase(item.falsePositiveRequest.status)}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function AuditHistory({ data }: { readonly data: SafetyCenterData }) {
  if (data.auditHistory.status !== "ready") {
    return (
      <CollectionNotice
        state={data.auditHistory}
        title="Safety audit history"
      />
    );
  }

  if (data.auditHistory.items.length === 0) {
    return (
      <EmptyState
        title="No audit entries in this window"
        detail="Permission changes, safety actions, exports, and deletion requests will be recorded here."
      />
    );
  }

  return (
    <ol className="masc-audit-list">
      {[...data.auditHistory.items]
        .sort((left, right) => right.at.localeCompare(left.at))
        .map((item: SafetyAuditEntry) => (
          <li key={item.auditRef}>
            <span className="masc-audit-dot" aria-hidden="true" />
            <div>
              <div className="masc-audit-heading">
                <strong>{sentenceCase(item.action)}</strong>
                <time dateTime={item.at}>{formatDateTime(item.at)}</time>
              </div>
              <p>{item.summary}</p>
              <span className="masc-muted">
                By {sentenceCase(item.actor)} · {item.auditRef}
              </span>
            </div>
          </li>
        ))}
    </ol>
  );
}

export function ParentDataAndReview({
  studentRef,
  data,
  onAction,
  pendingAction,
}: {
  readonly studentRef: StudentRef;
  readonly data: SafetyCenterData;
  readonly onAction: DispatchSafetyCenterAction;
  readonly pendingAction: string | null;
}) {
  return (
    <section aria-labelledby="data-review-heading">
      <SectionHeading
        id="data-review-heading"
        eyebrow="Privacy & accountability"
        title="Data, review, and audit"
        description="Control retention, request a scoped export or deletion, and follow human-review activity."
      />
      <div className="masc-operations-grid">
        <RetentionControls
          studentRef={studentRef}
          data={data}
          onAction={onAction}
          pendingAction={pendingAction}
        />
        <ExportControls
          studentRef={studentRef}
          onAction={onAction}
          pendingAction={pendingAction}
        />
        <DeletionControls
          studentRef={studentRef}
          onAction={onAction}
          pendingAction={pendingAction}
        />
      </div>

      <section className="masc-panel-block" aria-labelledby="review-queue-heading">
        <div className="masc-panel-block-heading">
          <div>
            <p className="masc-eyebrow">Human review</p>
            <h3 id="review-queue-heading">Review queue</h3>
          </div>
          <p>
            Parents can add context or flag a possible false positive from the
            Safety events screen. Review status appears here.
          </p>
        </div>
        <ReviewQueue data={data} />
      </section>

      <section className="masc-panel-block" aria-labelledby="audit-heading">
        <div className="masc-panel-block-heading">
          <div>
            <p className="masc-eyebrow">Append-only view</p>
            <h3 id="audit-heading">Safety audit history</h3>
          </div>
          <p>
            This view contains safety and permission actions, not the student's
            instructional progress record.
          </p>
        </div>
        <AuditHistory data={data} />
      </section>
    </section>
  );
}

const REPORT_OPTIONS: readonly {
  readonly value: StudentReportCategory;
  readonly label: string;
}[] = [
  {
    value: "scary-or-upsetting",
    label: "Something made me uncomfortable",
  },
  { value: "incorrect", label: "The tutor was incorrect or unfair" },
  {
    value: "privacy-concern",
    label: "Personal information was used or shared",
  },
  {
    value: "unhelpful",
    label: "The tutor did not explain why it stopped",
  },
  { value: "inappropriate", label: "The response was inappropriate" },
  { value: "other", label: "Something else" },
];

export function StudentSafetyTools({
  studentRef,
  studentName,
  data,
  onAction,
  pendingAction,
}: {
  readonly studentRef: StudentRef;
  readonly studentName: string;
  readonly data: SafetyCenterData;
  readonly onAction: DispatchSafetyCenterAction;
  readonly pendingAction: string | null;
}) {
  const [category, setCategory] = useState<StudentReportCategory>(
    "scary-or-upsetting",
  );
  const [sessionRef, setSessionRef] = useState("");
  const [details, setDetails] = useState("");
  const [paused, setPaused] = useState(
    data.studentSafety.tutorPausedByStudent,
  );

  useEffect(() => {
    setPaused(data.studentSafety.tutorPausedByStudent);
  }, [data.studentSafety.tutorPausedByStudent]);

  const sessions = useMemo<readonly InstructionalSession[]>(
    () =>
      data.instructionalHistory.status === "ready"
        ? [...data.instructionalHistory.items].sort((left, right) =>
            right.startedAt.localeCompare(left.startedAt),
          )
        : [],
    [data.instructionalHistory],
  );

  return (
    <section aria-labelledby="student-help-heading">
      <SectionHeading
        id="student-help-heading"
        eyebrow="Your safety tools"
        title="Report or pause the tutor"
        description={`${studentName}, you can use these controls at any time. You do not have to write an explanation to send a report.`}
      />

      <InlineNotice title="Get a trusted adult now if you need help" tone="critical">
        <p>
          This screen is not an emergency service. Pausing or reporting the
          tutor does not replace telling a trusted adult or following your
          family safety plan.
        </p>
      </InlineNotice>

      <div className="masc-student-tools-grid">
        <form
          className="masc-student-tool-card"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await onAction({
              type: "student_report_submitted",
              studentRef,
              category,
              ...(sessionRef ? { sessionRef } : {}),
              ...(details.trim() ? { details: details.trim() } : {}),
            });
            if (result.status !== "rejected") {
              setDetails("");
              setSessionRef("");
            }
          }}
        >
          <span className="masc-tool-icon" aria-hidden="true">
            ?
          </span>
          <h3>Tell us what happened</h3>
          <p>
            A parent or reviewer may read the report so they can help. Share
            only what is needed.
          </p>
          <div className="masc-field">
            <label htmlFor="masc-report-category">What went wrong?</label>
            <select
              id="masc-report-category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as StudentReportCategory)
              }
            >
              {REPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="masc-field">
            <label htmlFor="masc-report-session">
              Conversation (optional)
            </label>
            <select
              id="masc-report-session"
              value={sessionRef}
              onChange={(event) => setSessionRef(event.target.value)}
              disabled={sessions.length === 0}
            >
              <option value="">
                {sessions.length === 0
                  ? "No conversation list available"
                  : "Choose a conversation"}
              </option>
              {sessions.map((session) => (
                <option key={session.sessionRef} value={session.sessionRef}>
                  {formatDateTime(session.startedAt)} · {session.topicLabel}
                </option>
              ))}
            </select>
          </div>
          <div className="masc-field">
            <label htmlFor="masc-report-details">
              Anything else? (optional)
            </label>
            <textarea
              id="masc-report-details"
              maxLength={1000}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="You can leave this blank."
            />
            <span className="masc-field-help">{details.length}/1000</span>
          </div>
          <button
            className="masc-button"
            type="submit"
            disabled={pendingAction !== null}
          >
            {pendingAction === "student_report_submitted"
              ? "Sending…"
              : "Send report"}
          </button>
        </form>

        <section className="masc-student-tool-card" aria-labelledby="pause-heading">
          <span className="masc-tool-icon" aria-hidden="true">
            ‖
          </span>
          <h3 id="pause-heading">Pause the tutor</h3>
          <p>
            This stops new tutor help for you. Your parent can turn it back on
            after checking in.
          </p>
          {paused ? (
            <div className="masc-paused-state" role="status">
              <StatusBadge tone="warning">Tutor paused</StatusBadge>
              <p>You can still view your history and send a report.</p>
            </div>
          ) : (
            <button
              className="masc-button masc-button-danger"
              type="button"
              disabled={pendingAction !== null}
              onClick={async () => {
                const result = await onAction({
                  type: "tutor_pause_requested",
                  studentRef,
                  source: "student_block",
                });
                if (result.status !== "rejected") setPaused(true);
              }}
            >
              {pendingAction === "tutor_pause_requested"
                ? "Pausing…"
                : "Pause tutor now"}
            </button>
          )}
          <p className="masc-field-help">
            This button does not delete your conversations or send an emergency
            alert.
          </p>
        </section>
      </div>
    </section>
  );
}
