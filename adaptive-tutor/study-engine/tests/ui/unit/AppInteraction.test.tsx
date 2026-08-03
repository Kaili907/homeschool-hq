import { App } from "../../../prototype/src/App";
import { STORAGE_KEY } from "../../../prototype/src/sessionStore";
import { render, screen, userEvent } from "../../../prototype/src/testSupport";

describe("study session interaction", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it("moves from daily goal through check-in and the first completed learning segment", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("heading", { name: /Today’s goal/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Start mathematics" }));
    expect(screen.getByRole("heading", { name: /How are you arriving today/i })).toBeVisible();

    await user.click(screen.getByLabelText(/Ready to begin/i));
    await user.click(screen.getByRole("button", { name: "Begin warm-up" }));
    expect(screen.getAllByText("Step 1 of 6")).toHaveLength(2);

    await user.click(screen.getByLabelText(/Two of four equal parts/i));
    await user.click(screen.getByRole("button", { name: "Check my response" }));
    expect(screen.getByText("Ready for the next step")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getAllByText("Step 2 of 6")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Build an equivalent fraction" })).toBeVisible();
  });

  it("keeps typed work when the learner opens help and requests a break", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Start mathematics" }));
    await user.click(screen.getByLabelText(/Ready to begin/i));
    await user.click(screen.getByRole("button", { name: "Begin warm-up" }));

    await user.click(screen.getByText("Choose how Jarvis can help"));
    await user.click(screen.getByRole("button", { name: "I need a break" }));

    expect(screen.getByRole("heading", { name: "Take the break you need." })).toBeVisible();
    expect(screen.getByText(/work is saved/i)).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
