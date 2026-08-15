import assert from "node:assert/strict";
import test from "node:test";
import { wave2Fixture } from "./wave2-fixtures.js";
import {
  authorize,
  composeWithCounters,
  counters,
  requirePending,
  setCurrentAssistance,
} from "./wave2-r2-test-support.js";

test("GLOBAL_ADAPTIVE_ALLOWED_ACTIONS is non-compensable for hint, repair, reteach, and intervention", async () => {
  const narrow = wave2Fixture();
  authorize(narrow, ["return-to-lesson", "escalate"]);
  setCurrentAssistance(narrow, "independent");
  const narrowCalls = counters();
  const narrowResult = requirePending(await composeWithCounters(narrow, narrowCalls));
  assert.equal(narrowCalls.hint, 0);
  assert.equal(narrowCalls.repair, 0);
  assert.equal(narrowCalls.reteach, 0);
  assert.equal(narrowCalls.intervention, 1);
  assert.equal(narrowResult.hint.status, "no-hint");
  assert.equal(narrowResult.repair.status, "withheld");
  assert.equal(narrowResult.reteach.status, "withheld");
  assert.equal(narrowResult.intervention.actionKind, "escalate");

  for (const action of ["hint", "check-prerequisite", "reteach"] as const) {
    const input = wave2Fixture();
    authorize(input, input.studyAuthority.allowedActions.filter((value) => value !== action));
    if (action === "hint") setCurrentAssistance(input, "independent");
    const calls = counters();
    const result = requirePending(await composeWithCounters(input, calls));
    if (action === "hint") {
      assert.equal(calls.hint, 0);
      assert.equal(result.hint.status, "no-hint");
    } else if (action === "check-prerequisite") {
      assert.equal(calls.repair, 0);
      assert.equal(result.repair.status, "withheld");
    } else {
      assert.equal(calls.reteach, 0);
      assert.equal(result.reteach.status, "withheld");
    }
  }

  const authorized = wave2Fixture();
  const calls = counters();
  const result = requirePending(await composeWithCounters(authorized, calls));
  assert.equal(calls.hint, 1);
  assert.equal(calls.repair, 1);
  assert.equal(calls.reteach, 1);
  assert.equal(result.hint.status, "recommended");
  assert.equal(result.repair.status, "proposed");
  assert.equal(result.reteach.status, "proposed");
  assert.ok(
    result.intervention.actionKind === null ||
      authorized.studyAuthority.allowedActions.includes(result.intervention.actionKind),
  );
});
