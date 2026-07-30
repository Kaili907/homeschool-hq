import { BREAK_ACTIVITIES, BreakScreen } from "../../../ui/BreakScreen";
import type { BreakState } from "../../../prototype/src/sessionStore";
import { render, screen, userEvent } from "../../../prototype/src/testSupport";

const breakState: BreakState = {
  returnScreen: "learning",
  returnSegment: "guided-practice",
  timerWasRunning: true,
  returnCountdown: null,
};

describe("BreakScreen", () => {
  it("offers only safe screen-free examples and promises exact return", async () => {
    const user = userEvent.setup();
    let selected = "";
    const { rerender } = render(
      <BreakScreen
        breakState={breakState}
        onChooseActivity={(activity) => {
          selected = activity;
        }}
        onStartReturn={() => undefined}
        segmentLabel="Practice together"
      />,
    );

    for (const activity of BREAK_ACTIVITIES) {
      expect(screen.getByRole("button", { name: activity.label })).toBeVisible();
    }
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Practice together").parentElement).toHaveTextContent(
      "return to Practice together exactly where",
    );

    await user.click(screen.getByRole("button", { name: "Get water" }));
    expect(selected).toBe("water");
    rerender(
      <BreakScreen
        breakState={{ ...breakState, activity: selected }}
        onChooseActivity={() => undefined}
        onStartReturn={() => undefined}
        segmentLabel="Practice together"
      />,
    );
    expect(screen.getByRole("button", { name: "I’m ready to return" })).toBeVisible();
  });
});
