import { describe, expect, it } from "vitest";
import { runAdversarialProbes } from "../../../integration-labs/student-runtime/src/adversarial/probes";
import {
  completeCheckIn,
  createRuntimeWorkspace,
  validateRuntimeWorkspaceIntegrity,
} from "../../../integration-labs/student-runtime/src/state/runtimeMachine";

const AT = "2026-07-28T14:00:00.000Z";

describe("student runtime smoke", () => {
  it("creates a canonical math workspace and advances the check-in", () => {
    const workspace = createRuntimeWorkspace("math", AT);
    expect(validateRuntimeWorkspaceIntegrity(workspace)).toEqual({ ok: true });
    const learning = completeCheckIn(workspace, "ready", AT);
    expect(learning.screen).toBe("learning");
    expect(validateRuntimeWorkspaceIntegrity(learning)).toEqual({ ok: true });
  });

  it("passes every adversarial demonstration", () => {
    const probes = runAdversarialProbes();
    expect(probes).toHaveLength(7);
    expect(probes.every((probe) => probe.passed)).toBe(true);
  });
});

