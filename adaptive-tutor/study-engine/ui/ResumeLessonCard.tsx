import type { SessionDefinition } from "../prototype/src/content";
import { segmentStep, type StudySession } from "../prototype/src/sessionStore";

export interface ResumeLessonCardProps {
  readonly definition: SessionDefinition;
  readonly session: StudySession;
  readonly onResume: () => void;
}

export function ResumeLessonCard({
  definition,
  session,
  onResume,
}: ResumeLessonCardProps) {
  const segment = definition.segments[session.currentSegment];
  const resumePoint =
    session.screen === "check-in"
      ? "your check-in before Step 1"
      : session.screen === "decision"
        ? "your break, continue, or finish choices"
        : `Step ${segmentStep(session.currentSegment)} of 6: ${segment.navLabel}`;
  return (
    <article className="resume-card">
      <span className="resume-card__badge">Saved on this device</span>
      <p className="eyebrow">{definition.subject}</p>
      <h3>Resume {definition.lessonTitle}</h3>
      <p>
        Return to <strong>{resumePoint}</strong>. Your answer and progress are still here.
      </p>
      <div className="resume-card__meta">
        <span>{session.completedSegments.length} learning segments complete</span>
        <span>{session.technicalInterruptionCount} technical interruptions recorded</span>
      </div>
      <button className="primary-button" onClick={onResume} type="button">
        Resume exact step
      </button>
    </article>
  );
}

export default ResumeLessonCard;
