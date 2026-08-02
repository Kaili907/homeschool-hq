import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type {
  MasteryState,
  SkillId,
  StudentId,
} from "../../../adaptive-learning/mastery/index.js";
import type {
  MasteryOverrideRequest,
  MasterySkillView,
} from "./model.js";
import { MasteryStatusBadge } from "./MasteryStatusBadge.js";
import {
  MASTERY_STATE_ORDER,
  getMasteryStatePresentation,
} from "./statusPresentation.js";
import {
  clampConfidenceScore,
  formatConfidencePercent,
  formatEvidenceKind,
  formatMasteryTimestamp,
} from "./formatting.js";

export interface ParentSkillDetailProps {
  readonly learnerName: string;
  readonly studentId: StudentId;
  readonly skill?: MasterySkillView;
  readonly onSelectSkill?: (skillId: SkillId) => void;
  readonly onRequestOverride?: (
    request: MasteryOverrideRequest,
  ) => void | Promise<void>;
  readonly now?: () => string;
}

function DetailQuestion({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="ma-parent-skill__question">
      <h3>{heading}</h3>
      {children}
    </section>
  );
}

function BlockingPrerequisites({
  skill,
  onSelectSkill,
}: {
  readonly skill: MasterySkillView;
  readonly onSelectSkill?: (skillId: SkillId) => void;
}) {
  const blockers = skill.prerequisites.filter(
    (prerequisite) => prerequisite.isBlocking,
  );

  if (blockers.length === 0) {
    return (
      <p>
        No prerequisite is currently blocking progress.
        {skill.prerequisites.length > 0
          ? " The prerequisite evidence is currently sufficient."
          : ""}
      </p>
    );
  }

  return (
    <ul className="ma-parent-skill__blockers">
      {blockers.map((blocker) => (
        <li key={blocker.skillId}>
          <MasteryStatusBadge state={blocker.state} compact />
          <strong>{blocker.title}</strong>
          {onSelectSkill ? (
            <button
              className="ma-mastery-button ma-mastery-button--quiet"
              type="button"
              onClick={() => onSelectSkill(blocker.skillId)}
            >
              Open prerequisite
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EvidenceTimeline({ skill }: { readonly skill: MasterySkillView }) {
  if (skill.evidence.length === 0) {
    return (
      <p>
        No performance evidence has been recorded. Completion by itself is not
        treated as mastery.
      </p>
    );
  }

  const evidence = [...skill.evidence].sort(
    (left, right) =>
      new Date(right.observedAt).getTime() -
      new Date(left.observedAt).getTime(),
  );

  return (
    <ol className="ma-evidence-timeline">
      {evidence.map((item) => (
        <li
          data-independent={
            item.kind === "independent_demonstration" || undefined
          }
          key={item.evidenceId}
        >
          <div className="ma-evidence-timeline__signal" aria-hidden="true" />
          <div>
            <div className="ma-evidence-timeline__topline">
              <strong>{item.title}</strong>
              <span>
                {item.kind === "independent_demonstration"
                  ? "Independent mastery evidence"
                  : item.independent
                    ? "Attempted without support"
                    : "Supported context"}{" "}
                · {formatEvidenceKind(item.kind)}
              </span>
            </div>
            <p>{item.summary}</p>
            <p className="ma-mastery-muted">
              {item.resultLabel ? `${item.resultLabel} · ` : ""}
              {item.sourceLabel} ·{" "}
              <time dateTime={item.observedAt}>
                {formatMasteryTimestamp(item.observedAt)}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function OverrideHistory({ skill }: { readonly skill: MasterySkillView }) {
  if (skill.overrideAudit.length === 0) {
    return <p className="ma-mastery-muted">No manual overrides recorded.</p>;
  }

  return (
    <ol className="ma-override-history">
      {skill.overrideAudit.map((entry) => (
        <li
          key={
            entry.auditEntryId ??
            `${entry.overrideId}:${entry.changedAt}:${entry.status}`
          }
        >
          <div className="ma-override-history__topline">
            <strong>
              {getMasteryStatePresentation(entry.previousState).label} →{" "}
              {getMasteryStatePresentation(entry.overrideState).label}
            </strong>
            <span data-status={entry.status}>{entry.status}</span>
          </div>
          <p>{entry.reason}</p>
          <p className="ma-mastery-muted">
            {entry.actorLabel} · {entry.actorRole} ·{" "}
            <time dateTime={entry.changedAt}>
              {formatMasteryTimestamp(entry.changedAt)}
            </time>
          </p>
        </li>
      ))}
    </ol>
  );
}

function OverrideForm({
  studentId,
  skill,
  onRequestOverride,
  now,
}: {
  readonly studentId: StudentId;
  readonly skill: MasterySkillView;
  readonly onRequestOverride?: (
    request: MasteryOverrideRequest,
  ) => void | Promise<void>;
  readonly now: () => string;
}) {
  const instanceId = useId();
  const [state, setState] = useState<MasteryState>(skill.state);
  const [actorRole, setActorRole] = useState<"parent" | "teacher">("parent");
  const [actorLabel, setActorLabel] = useState("");
  const [reason, setReason] = useState("");
  const [submissionState, setSubmissionState] = useState<
    "idle" | "submitting" | "complete" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setState(skill.state);
    setReason("");
    setSubmissionState("idle");
    setMessage("");
  }, [skill.skillId, skill.state]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!onRequestOverride) {
      setSubmissionState("error");
      setMessage("Connect the mastery override adapter before submitting.");
      return;
    }

    const trimmedActor = actorLabel.trim();
    const trimmedReason = reason.trim();
    if (trimmedActor.length < 2 || trimmedReason.length < 8) {
      setSubmissionState("error");
      setMessage("Add your name and a specific reason of at least 8 characters.");
      return;
    }

    setSubmissionState("submitting");
    setMessage("");

    try {
      await onRequestOverride({
        studentId,
        skillId: skill.skillId,
        overrideState: state,
        actorRole,
        actorLabel: trimmedActor,
        reason: trimmedReason,
        requestedAt: now(),
      });
      setSubmissionState("complete");
      setMessage("Override recorded with an audit entry.");
      setReason("");
    } catch {
      setSubmissionState("error");
      setMessage("The override could not be recorded. No change was made.");
    }
  };

  return (
    <form className="ma-override-form" onSubmit={submit}>
      <p>
        A manual decision is always labeled and audited. It does not create
        independent-performance evidence.
      </p>

      <div className="ma-override-form__grid">
        <label htmlFor={`${instanceId}-state`}>
          <span>Override state</span>
          <select
            id={`${instanceId}-state`}
            value={state}
            onChange={(event) =>
              setState(event.currentTarget.value as MasteryState)
            }
          >
            {MASTERY_STATE_ORDER.map((option) => (
              <option value={option} key={option}>
                {getMasteryStatePresentation(option).label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor={`${instanceId}-role`}>
          <span>Role</span>
          <select
            id={`${instanceId}-role`}
            value={actorRole}
            onChange={(event) =>
              setActorRole(event.currentTarget.value as "parent" | "teacher")
            }
          >
            <option value="parent">Parent or guardian</option>
            <option value="teacher">Teacher</option>
          </select>
        </label>
      </div>

      <label htmlFor={`${instanceId}-actor`}>
        <span>Your name</span>
        <input
          id={`${instanceId}-actor`}
          value={actorLabel}
          autoComplete="name"
          minLength={2}
          required
          onChange={(event) => setActorLabel(event.currentTarget.value)}
        />
      </label>

      <label htmlFor={`${instanceId}-reason`}>
        <span>Reason for this decision</span>
        <textarea
          id={`${instanceId}-reason`}
          value={reason}
          minLength={8}
          required
          rows={3}
          onChange={(event) => setReason(event.currentTarget.value)}
        />
      </label>

      <button
        className="ma-mastery-button ma-mastery-button--primary"
        type="submit"
        disabled={submissionState === "submitting"}
      >
        {submissionState === "submitting"
          ? "Recording override…"
          : "Record manual override"}
      </button>

      <p
        className="ma-override-form__status"
        data-state={submissionState}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </form>
  );
}

export function ParentSkillDetail({
  learnerName,
  studentId,
  skill,
  onSelectSkill,
  onRequestOverride,
  now = () => new Date().toISOString(),
}: ParentSkillDetailProps) {
  if (!skill) {
    return (
      <section className="ma-parent-skill ma-parent-skill--empty">
        <p className="ma-mastery-eyebrow">Detailed skill view</p>
        <h2>Choose a skill</h2>
        <p>
          Select a skill from the mastery map to inspect its prerequisites,
          evidence, confidence, and recommended next step.
        </p>
      </section>
    );
  }

  const confidence = clampConfidenceScore(skill.confidence.score);

  return (
    <article className="ma-parent-skill" aria-labelledby="parent-skill-heading">
      <header className="ma-parent-skill__header">
        <div>
          <p className="ma-mastery-eyebrow">
            {skill.subject} · {skill.gradeBand} · {learnerName}
          </p>
          <h2 id="parent-skill-heading">{skill.title}</h2>
          <p>{skill.description}</p>
        </div>
        <MasteryStatusBadge state={skill.state} />
      </header>

      <div className="ma-parent-skill__explanation" role="note">
        <strong>Why the system chose this state</strong>
        <ul>
          {skill.explanation.map((reason, index) => (
            <li key={`${index}:${reason}`}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="ma-parent-skill__questions">
        <DetailQuestion heading="What is the student learning?">
          <p>{skill.parentDescription ?? skill.description}</p>
        </DetailQuestion>

        <DetailQuestion heading="What prerequisite is blocking progress?">
          <BlockingPrerequisites
            skill={skill}
            onSelectSkill={onSelectSkill}
          />
        </DetailQuestion>

        <DetailQuestion heading="What evidence supports the current state?">
          <EvidenceTimeline skill={skill} />
        </DetailQuestion>

        <DetailQuestion heading="How confident is the system?">
          <div className="ma-confidence">
            <div className="ma-confidence__topline">
              <strong>
                {formatConfidencePercent(confidence)} ·{" "}
                {skill.confidence.level} confidence
              </strong>
              <span>{skill.evidence.length} evidence records</span>
            </div>
            <meter
              min={0}
              max={1}
              low={0.4}
              high={0.75}
              value={confidence}
              aria-label={`System confidence for ${skill.title}`}
            >
              {formatConfidencePercent(confidence)}
            </meter>
            <p>{skill.confidence.explanation}</p>
          </div>
        </DetailQuestion>

        <DetailQuestion heading="What should happen next?">
          <p className="ma-parent-skill__next-step">{skill.nextStep}</p>
        </DetailQuestion>

        <DetailQuestion heading="When did the student last demonstrate the skill independently?">
          <p className="ma-parent-skill__independent-date">
            {skill.lastIndependentDemonstrationAt ? (
              <time dateTime={skill.lastIndependentDemonstrationAt}>
                {formatMasteryTimestamp(
                  skill.lastIndependentDemonstrationAt,
                )}
              </time>
            ) : (
              "No independent demonstration has been recorded."
            )}
          </p>
        </DetailQuestion>
      </div>

      <details className="ma-parent-skill__override">
        <summary>Manual parent or teacher override</summary>
        <OverrideForm
          studentId={studentId}
          skill={skill}
          onRequestOverride={onRequestOverride}
          now={now}
        />
      </details>

      <details className="ma-parent-skill__audit">
        <summary>Override audit history ({skill.overrideAudit.length})</summary>
        <OverrideHistory skill={skill} />
      </details>
    </article>
  );
}
