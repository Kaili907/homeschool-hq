import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runDeterministicDemonstrations } from "../../runtime/src/demonstrations.ts";
import { inspectRuntimeHealth } from "../../runtime/src/health.ts";
import { InMemoryAcceptedEventLedger } from "../../runtime/src/ledger.ts";
import * as runtimePublic from "../../runtime/src/index.ts";
import {
  runSafeTutorBridge,
  type SafeTutorBridgeResult,
} from "../../runtime/src/tutor-bridge.ts";
import { bridgeRequest, clearOutputSafety, localDemoSafety } from "./helpers.ts";

describe("Session 9 public composition", () => {
  test("publishes the umbrella and accepted component versions", () => {
    const health = inspectRuntimeHealth();
    expect(health.release.version).toBe("1.0.0-rc.1");
    expect(health.components).toMatchObject({
      tutorCore: "0.2.0",
      tutorCoreBridge: "1.0.1",
      tutorCoreBridgeContract: 1,
      studentRuntime: "0.7.2",
      calendarParentRuntime: "0.8.1",
    });
    expect(health.release.mode).toBe("portable-non-production");
    expect(health.limitations.join(" ")).toMatch(/not production persistence/i);
  });

  test("does not expose low-level or provisional bridge authorities", () => {
    expect(runtimePublic).not.toHaveProperty(
      "executeLocalDemoStudyCoreBridgeCycle",
    );
    expect(runtimePublic).not.toHaveProperty("adaptFrozenTutorCoreResult");
    expect(runtimePublic).not.toHaveProperty("resolveParentObligation");
    expect(runtimePublic).not.toHaveProperty("ROMEO_DEC_018_RECONCILIATION");
  });

  test("package exports contain only controlled public surfaces", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { exports: Record<string, string> };
    expect(Object.keys(packageJson.exports)).toEqual([
      ".",
      "./student",
      "./calendar",
      "./parent",
      "./review",
      "./tutor-bridge",
      "./checkpoint",
      "./outbox",
      "./safety",
      "./adult-review",
      "./romeo",
      "./health",
    ]);
    expect(JSON.stringify(packageJson.exports)).not.toMatch(
      /vendor|provisional|internal|session6-bridge\.v2/i,
    );
  });

  test("runs all ten deterministic release demonstrations", async () => {
    const traces = await runDeterministicDemonstrations();
    expect(traces).toHaveLength(10);
    expect(new Set(traces.map(({ id }) => id)).size).toBe(10);
    expect(traces.every(({ status }) => status === "pass")).toBe(true);
    const serialized = JSON.stringify(traces);
    expect(serialized).not.toContain("I want to hurt myself.");
    expect(serialized).not.toContain("I might hurt myself.");
    expect(serialized).not.toMatch(/rawAnswerIncluded["']?\s*:\s*true/i);
    expect(serialized).not.toMatch(/transcriptIncluded["']?\s*:\s*true/i);
  });

  test("produces byte-stable deterministic traces on replay", async () => {
    const first = JSON.stringify(await runDeterministicDemonstrations());
    const second = JSON.stringify(await runDeterministicDemonstrations());
    expect(second).toBe(first);
  });

  test("clear academic input reaches Core exactly once and the ledger", async () => {
    const ledger = new InMemoryAcceptedEventLedger();
    const result = await runSafeTutorBridge(bridgeRequest(), {
      eventLedger: ledger,
      safety: localDemoSafety,
      outputSafety: clearOutputSafety,
    });
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.coreSubmitInvocations).toBe(1);
    expect(ledger.size).toBe(1);
    expect(JSON.stringify(result.minimizedProjection)).not.toMatch(
      /rawAnswer|rawResponse|rawTranscript/i,
    );
    expect(result.recommendation.masteryDecisionMade).toBe(false);
    expect(result.recommendation.pacingDecisionMade).toBe(false);
  });

  test("identical event replay produces no second projection or outbox", async () => {
    const ledger = new InMemoryAcceptedEventLedger();
    const input = bridgeRequest();
    const first = await runSafeTutorBridge(input, {
      eventLedger: ledger,
      safety: localDemoSafety,
      outputSafety: clearOutputSafety,
    });
    const replay = await runSafeTutorBridge(input, {
      eventLedger: ledger,
      safety: localDemoSafety,
      outputSafety: clearOutputSafety,
    });
    expect(first.status).toBe("accepted");
    expect(replay.status).toBe("stopped-or-quarantined");
    if (replay.status !== "stopped-or-quarantined") return;
    expect(replay.result.status).toBe("duplicate-ignored");
    if (replay.result.status === "duplicate-ignored") {
      expect(replay.result.outboxProposals).toEqual([]);
    }
    expect(ledger.size).toBe(1);
  });

  test("event-ID collision is quarantined without downstream proposals", async () => {
    const ledger = new InMemoryAcceptedEventLedger();
    await ledger.appendAcceptedEvent(
      "session:final-assembly:001",
      "event:final-assembly:001",
      1,
      "preexisting-different-event-digest",
    );
    const collision = await runSafeTutorBridge(bridgeRequest(), {
      eventLedger: ledger,
      safety: localDemoSafety,
      outputSafety: clearOutputSafety,
    });
    expect(collision.status).toBe("stopped-or-quarantined");
    if (collision.status !== "stopped-or-quarantined") return;
    expect(collision.result.status).toBe("quarantined");
    if (collision.result.status === "quarantined") {
      expect(collision.result.quarantine.reasonCode).toBe(
        "event-id-collision",
      );
      expect(collision.result.outboxProposals).toEqual([]);
    }
  });

  test("accepted public result has a single bridge authority identity", async () => {
    const result: SafeTutorBridgeResult = await runSafeTutorBridge(
      bridgeRequest({ requestId: "event:authority:001" }),
      {
        eventLedger: new InMemoryAcceptedEventLedger(),
        safety: localDemoSafety,
        outputSafety: clearOutputSafety,
      },
    );
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") return;
    expect(result.bridgeVersion).toBe("1.0.1");
    expect(result.bridgeContractVersion).toBe(1);
    expect(result.directive).toMatch(/continue|reteach/);
  });
});
