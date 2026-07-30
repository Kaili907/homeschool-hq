export const LEARNER_ACTIONS = [
  "I need help",
  "Show me another way",
  "Talk me through it",
  "Let’s do one together",
  "Give me a different example",
  "This is too easy",
  "This is too hard",
  "I need a break",
  "Read this to me",
  "Let me answer aloud",
  "Continue independently",
] as const;

export type LearnerAction = (typeof LEARNER_ACTIONS)[number];

export interface LearnerActionsProps {
  readonly onAction: (action: LearnerAction) => void;
  readonly voiceInputAvailable: boolean;
}

export function LearnerActions({
  onAction,
  voiceInputAvailable,
}: LearnerActionsProps) {
  return (
    <details className="learner-actions">
      <summary>Choose how Jarvis can help</summary>
      <p className="learner-actions__intro">You are in control. Pick one, or keep working.</p>
      <div className="learner-actions__grid">
        {LEARNER_ACTIONS.map((action) => {
          const unavailable = action === "Let me answer aloud" && !voiceInputAvailable;
          return (
            <button
              className={action === "I need a break" ? "action-chip action-chip--break" : "action-chip"}
              data-action={action}
              key={action}
              onClick={() => onAction(action)}
              type="button"
            >
              {action}
              {unavailable ? <small> (typing is ready)</small> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}

export default LearnerActions;
