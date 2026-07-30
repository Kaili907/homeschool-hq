import type { BreakState } from "../prototype/src/sessionStore";

export const BREAK_ACTIVITIES = [
  { id: "water", label: "Get water", guidance: "Take a few calm sips, then come back when ready." },
  {
    id: "walk",
    label: "Walk briefly",
    guidance: "Walk in your learning space for a minute. No screen needed.",
  },
  { id: "stretch", label: "Stretch", guidance: "Reach up, roll your shoulders, and loosen your hands." },
  {
    id: "look-away",
    label: "Look away from the screen",
    guidance: "Rest your eyes on something across the room.",
  },
  {
    id: "breathe",
    label: "Quiet breathing",
    guidance: "Breathe in gently, then let the breath out a little more slowly.",
  },
  {
    id: "movement",
    label: "Parent-configured movement",
    guidance: "Use the movement your family chose for study breaks.",
  },
] as const;

export interface BreakScreenProps {
  readonly breakState: BreakState;
  readonly segmentLabel: string;
  readonly onChooseActivity: (activity: string) => void;
  readonly onStartReturn: () => void;
}

export function BreakScreen({
  breakState,
  segmentLabel,
  onChooseActivity,
  onStartReturn,
}: BreakScreenProps) {
  const selected = BREAK_ACTIVITIES.find((activity) => activity.id === breakState.activity);

  return (
    <main className="break-screen" id="main-content" tabIndex={-1}>
      <div className="break-screen__orb" aria-hidden="true">
        <span />
      </div>
      <p className="eyebrow">Learning is paused</p>
      <h1>Take the break you need.</h1>
      <p className="break-screen__lead">
        Your work is saved. You will return to <strong>{segmentLabel}</strong> exactly where
        you left it.
      </p>

      {!selected ? (
        <>
          <fieldset className="break-choices">
            <legend>Choose a screen-free break</legend>
            <div className="break-choices__grid">
              {BREAK_ACTIVITIES.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => onChooseActivity(activity.id)}
                  type="button"
                >
                  {activity.label}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="break-screen__note">
            No entertainment links are included here. There is no penalty for taking another
            break later.
          </p>
        </>
      ) : (
        <section className="break-guidance" aria-labelledby="break-guidance-title">
          <span className="break-guidance__check" aria-hidden="true">
            ✓
          </span>
          <div>
            <p className="eyebrow">Your break</p>
            <h2 id="break-guidance-title">{selected.label}</h2>
            <p>{selected.guidance}</p>
          </div>
          {breakState.returnCountdown === null ? (
            <button className="primary-button" onClick={onStartReturn} type="button">
              I’m ready to return
            </button>
          ) : (
            <div className="return-countdown" role="status" aria-live="polite" aria-atomic="true">
              <strong>{breakState.returnCountdown}</strong>
              <span>Returning to {segmentLabel}</span>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default BreakScreen;
