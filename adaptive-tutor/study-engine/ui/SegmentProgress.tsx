import {
  LEARNING_SEGMENTS,
  SEGMENT_INDEX,
  type LearningSegmentId,
  type SessionDefinition,
} from "../prototype/src/content";

export interface SegmentProgressProps {
  readonly definition: SessionDefinition;
  readonly currentSegment: LearningSegmentId;
  readonly completedSegments: readonly LearningSegmentId[];
}

export function SegmentProgress({
  definition,
  currentSegment,
  completedSegments,
}: SegmentProgressProps) {
  const currentStep = SEGMENT_INDEX[currentSegment] + 1;

  return (
    <nav className="segment-progress" aria-label="Learning segment progress">
      <div className="segment-progress__summary">
        <span>Learning progress</span>
        <strong>
          Step {currentStep} of {LEARNING_SEGMENTS.length}
        </strong>
      </div>
      <ol
        aria-label="Segment status list; scroll horizontally on small screens"
        className="segment-progress__list"
        tabIndex={0}
      >
        {LEARNING_SEGMENTS.map((segment) => {
          const complete = completedSegments.includes(segment);
          const current = segment === currentSegment && !complete;
          const state = complete ? "complete" : current ? "current" : "upcoming";
          return (
            <li
              className="segment-progress__item"
              data-state={state}
              aria-current={current ? "step" : undefined}
              key={segment}
            >
              <span className="segment-progress__marker" aria-hidden="true">
                {complete ? "✓" : current ? "●" : "○"}
              </span>
              <span>{definition.segments[segment].navLabel}</span>
              <span className="sr-only">
                {complete ? ", completed" : current ? ", current segment" : ", not started"}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default SegmentProgress;
