import { formatTimer, type TimerState } from "../prototype/src/sessionStore";

export interface SessionTimerProps {
  readonly timer: TimerState;
  readonly onToggle: () => void;
}

export function SessionTimer({ timer, onToggle }: SessionTimerProps) {
  if (timer.goalReached) {
    return (
      <div className="session-timer session-timer--goal" role="status">
        <span className="session-timer__goal-mark" aria-hidden="true">
          ✓
        </span>
        <span>
          Time goal reached
          <small>Keep going at your pace.</small>
        </span>
      </div>
    );
  }

  const toggleLabel = timer.running ? "Pause optional timer" : "Resume optional timer";
  const pausedText =
    timer.pauseReason === "technical"
      ? "Timer paused after recovery"
      : timer.running
        ? "Timer running"
        : "Timer paused";

  if (timer.mode === "hidden") {
    return (
      <div className="session-timer session-timer--hidden" data-testid="hidden-timer">
        <span aria-hidden="true">Timer hidden</span>
        <span className="sr-only">{pausedText}. Time values are hidden.</span>
        <button className="icon-button" type="button" onClick={onToggle} aria-label={toggleLabel}>
          <span aria-hidden="true">{timer.running ? "Ⅱ" : "▶"}</span>
        </button>
      </div>
    );
  }

  const fractionRemaining =
    timer.initialSeconds > 0 ? timer.remainingSeconds / timer.initialSeconds : 0;
  const ringStyle = {
    "--timer-progress": `${Math.max(0, Math.min(1, fractionRemaining)) * 360}deg`,
  } as React.CSSProperties;

  if (timer.mode === "minimal") {
    return (
      <div className="session-timer session-timer--minimal" data-testid="minimal-timer">
        <span
          className="session-timer__ring"
          style={ringStyle}
          role="img"
          aria-label={`Optional timer. ${pausedText}. Time values are hidden.`}
        >
          <span aria-hidden="true">{timer.running ? "" : "Ⅱ"}</span>
        </span>
        <button className="text-button" type="button" onClick={onToggle} aria-label={toggleLabel}>
          {timer.running ? "Pause" : "Resume"}
        </button>
      </div>
    );
  }

  return (
    <div className="session-timer" data-testid="visible-timer">
      <span className="session-timer__ring" style={ringStyle} aria-hidden="true">
        <span className="session-timer__digits">{formatTimer(timer.remainingSeconds)}</span>
      </span>
      <span className="session-timer__copy">
        <small>Optional focus timer</small>
        <strong>{pausedText}</strong>
      </span>
      <button className="icon-button" type="button" onClick={onToggle} aria-label={toggleLabel}>
        <span aria-hidden="true">{timer.running ? "Ⅱ" : "▶"}</span>
      </button>
    </div>
  );
}

export default SessionTimer;
