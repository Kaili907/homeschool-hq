import assert from "node:assert/strict";
import test from "node:test";
import {
  composeWave2AdaptiveIntelligence,
  InMemoryWave2ReplayLedger,
} from "../../study-engine/tutor-v2/adaptive/index.js";
import { wave2Fixture } from "./wave2-fixtures.js";

const canonical = {
  eventRef: "event:invalid-wave2-request",
  fallbackRef: "fallback:reviewed-static-wave2",
  reviewedContentRefs: ["content:reviewed-static-wave2"],
} as const;

async function compose(input: unknown) {
  return composeWave2AdaptiveIntelligence(input, {
    replayLedger: new InMemoryWave2ReplayLedger(),
  });
}

function assertCanonical(result: Awaited<ReturnType<typeof compose>>): void {
  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status !== "reviewed-static-fallback") throw new Error("Expected fallback");
  assert.equal(result.eventRef, canonical.eventRef);
  assert.equal(result.fallbackRef, canonical.fallbackRef);
  assert.deepEqual(result.reviewedContentRefs, canonical.reviewedContentRefs);
  const serialized = JSON.stringify(result);
  for (const attacker of ["attacker-selected", "provider-selected", "unreviewed"]) {
    assert.equal(serialized.includes(attacker), false, attacker);
  }
}

test("TRUSTED_INVALID_REQUEST_FALLBACK never reads invalid authority or fallback selectors", async () => {
  const fixture = wave2Fixture();
  await assertCanonical(await compose({
    ...fixture,
    studyAuthority: { ...fixture.studyAuthority, eventRef: "event:attacker-selected" },
    reviewedStaticFallback: {
      fallbackRef: "fallback:provider-selected",
      reviewedContentRefs: ["content:provider-selected-unreviewed"],
      nestedFallbackMetadata: {
        fallbackRef: "fallback:attacker-selected",
        reviewedContentRefs: ["content:attacker-selected-unreviewed"],
      },
    },
  }));

  let getterCalls = 0;
  const authority = { ...fixture.studyAuthority } as Record<string, unknown>;
  Object.defineProperty(authority, "eventRef", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "event:attacker-selected";
    },
  });
  await assertCanonical(await compose({ ...fixture, studyAuthority: authority }));
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const proxy = new Proxy(wave2Fixture(), {
    getPrototypeOf() {
      proxyCalls += 1;
      throw new Error("hostile proxy");
    },
  });
  await assertCanonical(await compose(proxy));
  assert.equal(proxyCalls, 1);
});
