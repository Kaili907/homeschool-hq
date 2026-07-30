import { SegmentProgress } from "../../../ui/SegmentProgress";
import { SESSION_DEFINITIONS } from "../../../prototype/src/content";
import { render, screen, within } from "../../../prototype/src/testSupport";

describe("SegmentProgress", () => {
  it("tracks completed learning segments rather than elapsed time", () => {
    render(
      <SegmentProgress
        completedSegments={["warm-up"]}
        currentSegment="visual-lesson"
        definition={SESSION_DEFINITIONS.math}
      />,
    );

    expect(screen.getByText("Step 2 of 6")).toBeInTheDocument();
    const progress = screen.getByRole("navigation", {
      name: "Learning segment progress",
    });
    const warmUp = within(progress).getByText("Warm-up").closest("li");
    const visualLesson = within(progress).getByText("Visual lesson").closest("li");
    expect(warmUp).toHaveAttribute("data-state", "complete");
    expect(visualLesson).toHaveAttribute("aria-current", "step");
    expect(progress).not.toHaveTextContent("minutes");
  });
});
