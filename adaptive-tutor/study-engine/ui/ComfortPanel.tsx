import type {
  AudioMode,
  MotionMode,
  StudyPreferences,
  TimerMode,
} from "../prototype/src/sessionStore";

export interface ComfortPanelProps {
  readonly preferences: StudyPreferences;
  readonly timerMode?: TimerMode;
  readonly onCaptionsChange: (enabled: boolean) => void;
  readonly onTranscriptChange: (open: boolean) => void;
  readonly onAudioChange: (mode: AudioMode) => void;
  readonly onMotionChange: (mode: MotionMode) => void;
  readonly onTextScaleChange: (scale: 1 | 1.15 | 1.3) => void;
  readonly onTimerModeChange?: (mode: TimerMode) => void;
  readonly onResetDemo: () => void;
}

export function ComfortPanel({
  preferences,
  timerMode,
  onCaptionsChange,
  onTranscriptChange,
  onAudioChange,
  onMotionChange,
  onTextScaleChange,
  onTimerModeChange,
  onResetDemo,
}: ComfortPanelProps) {
  return (
    <details className="comfort-panel">
      <summary>Comfort &amp; access</summary>
      <div className="comfort-panel__body">
        <fieldset>
          <legend>On-screen support</legend>
          <label className="switch-row">
            <span>
              Captions
              <small>Show Jarvis’s current words.</small>
            </span>
            <input
              checked={preferences.captions}
              onChange={(event) => onCaptionsChange(event.target.checked)}
              type="checkbox"
            />
          </label>
          <label className="switch-row">
            <span>
              Transcript
              <small>Keep the session conversation open.</small>
            </span>
            <input
              checked={preferences.transcriptOpen}
              onChange={(event) => onTranscriptChange(event.target.checked)}
              type="checkbox"
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Audio</legend>
          <div className="segmented-control">
            {(["on", "off"] as const).map((mode) => (
              <label key={mode}>
                <input
                  checked={preferences.audioMode === mode}
                  name="audio-mode"
                  onChange={() => onAudioChange(mode)}
                  type="radio"
                />
                <span>{mode === "on" ? "Voice on" : "No audio"}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Motion</legend>
          <div className="segmented-control">
            {(["full", "minimal", "none"] as const).map((mode) => (
              <label key={mode}>
                <input
                  checked={preferences.motionMode === mode}
                  name="motion-mode"
                  onChange={() => onMotionChange(mode)}
                  type="radio"
                />
                <span>{mode === "full" ? "Subtle" : mode === "minimal" ? "Minimal" : "None"}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {timerMode && onTimerModeChange ? (
          <fieldset>
            <legend>Optional timer display</legend>
            <div className="segmented-control">
              {(["visible", "minimal", "hidden"] as const).map((mode) => (
                <label key={mode}>
                  <input
                    checked={timerMode === mode}
                    name="timer-mode"
                    onChange={() => onTimerModeChange(mode)}
                    type="radio"
                  />
                  <span>{mode[0].toUpperCase() + mode.slice(1)}</span>
                </label>
              ))}
            </div>
            <p className="field-help">Progress above always tracks learning segments, not time.</p>
          </fieldset>
        ) : null}

        <fieldset>
          <legend>Text size</legend>
          <div className="segmented-control">
            {(
              [
                [1, "Default"],
                [1.15, "Large"],
                [1.3, "Larger"],
              ] as const
            ).map(([scale, label]) => (
              <label key={scale}>
                <input
                  checked={preferences.textScale === scale}
                  name="text-scale"
                  onChange={() => onTextScaleChange(scale)}
                  type="radio"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button className="danger-text-button" onClick={onResetDemo} type="button">
          Reset local prototype data
        </button>
      </div>
    </details>
  );
}

export default ComfortPanel;
