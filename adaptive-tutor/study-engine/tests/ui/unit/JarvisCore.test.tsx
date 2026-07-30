import { JarvisCore } from "../../../ui/JarvisCore";
import { render, screen, userEvent } from "../../../prototype/src/testSupport";

describe("JarvisCore", () => {
  it("exposes speaking, caption, transcript, fallback, and motion state accessibly", async () => {
    const user = userEvent.setup();
    let open = false;
    const { rerender } = render(
      <JarvisCore
        activity="speaking"
        currentUtterance="Split every fourth into two equal pieces."
        motionMode="minimal"
        onTranscriptOpenChange={(next) => {
          open = next;
        }}
        transcript={<p>Transcript content</p>}
        transcriptOpen={open}
        voiceMode="no-audio"
      />,
    );

    expect(
      screen.getByRole("img", { name: /Jarvis visual core. Speaking./i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Split every fourth into two equal pieces.")).toBeVisible();
    expect(screen.getByText(/Audio is off/i)).toBeVisible();
    expect(screen.getByText("Jarvis").closest("section")).toHaveAttribute(
      "data-motion",
      "minimal",
    );

    await user.click(screen.getByRole("button", { name: "Show transcript" }));
    expect(open).toBe(true);
    rerender(
      <JarvisCore
        currentUtterance="Caption"
        motionMode="none"
        onTranscriptOpenChange={(next) => {
          open = next;
        }}
        transcript={<p>Transcript content</p>}
        transcriptOpen={open}
        voiceMode="unavailable"
      />,
    );
    expect(screen.getByRole("region", { name: "Session transcript" })).toHaveTextContent(
      "Transcript content",
    );
    expect(screen.getByText(/Voice is unavailable on this device/i)).toBeVisible();
  });
});
