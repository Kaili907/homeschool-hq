import { SessionTimer } from "../../../ui/SessionTimer";
import type { TimerState } from "../../../prototype/src/sessionStore";
import { render, screen } from "../../../prototype/src/testSupport";

const baseTimer: TimerState = {
  mode: "visible",
  initialSeconds: 600,
  remainingSeconds: 487,
  running: true,
  goalReached: false,
  pauseReason: null,
};

describe("SessionTimer", () => {
  it("supports visible, minimal, and truly hidden time-value modes", () => {
    const { rerender } = render(<SessionTimer onToggle={() => undefined} timer={baseTimer} />);
    expect(screen.getByTestId("visible-timer")).toHaveTextContent("08:07");

    rerender(
      <SessionTimer
        onToggle={() => undefined}
        timer={{ ...baseTimer, mode: "minimal" }}
      />,
    );
    expect(screen.getByTestId("minimal-timer")).not.toHaveTextContent("08:07");
    expect(
      screen.getByRole("img", { name: /time values are hidden/i }),
    ).toBeInTheDocument();

    rerender(
      <SessionTimer
        onToggle={() => undefined}
        timer={{ ...baseTimer, mode: "hidden" }}
      />,
    );
    expect(screen.getByTestId("hidden-timer")).not.toHaveTextContent("08:07");
    expect(screen.getByRole("button", { name: "Pause optional timer" })).toBeEnabled();
  });

  it("does not threaten to end the lesson when the time goal is reached", () => {
    render(
      <SessionTimer
        onToggle={() => undefined}
        timer={{
          ...baseTimer,
          goalReached: true,
          remainingSeconds: 0,
          running: false,
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Keep going at your pace");
    expect(screen.queryByText(/time.?s up/i)).not.toBeInTheDocument();
  });
});
