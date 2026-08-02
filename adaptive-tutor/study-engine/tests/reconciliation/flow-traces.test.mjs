import test from "node:test";
import assert from "node:assert/strict";
import { readJson } from "../../reconciliation/probes/validate-reconciliation.mjs";

function allEvents(trace) {
  return trace.steps.flatMap((step) => step.events ?? []);
}

test("fourteen traces exist in required order", async () => {
  const record = await readJson("flow-traces.v1.json");
  assert.deepEqual(
    record.traces.map((trace) => trace.title),
    [
      "New math lesson",
      "Student-requested water break",
      "Exact resume after refresh",
      "Technical interruption",
      "Exit ticket",
      "Retrieval failure",
      "Reteaching",
      "Same-day review recommendation",
      "Review-queue creation",
      "Calendar placement",
      "Review result returned to engine",
      "Parent rejects duration increase",
      "Parent adds accommodation",
      "Romeo assignment linked to tutoring support"
    ]
  );
});

test("trace events are canonical, stable, and sequence-local", async () => {
  const record = await readJson("flow-traces.v1.json");
  const mapping = await readJson("enum-event-mappings.v1.json");
  const forbiddenUnderscoreEvents = new Set([
    "session_started",
    "check_in_completed",
    "prior_retrieval_completed",
    "review_scheduled",
    "technical_interruption"
  ]);
  for (const trace of record.traces) {
    const ids = new Set();
    let prior = -1;
    for (const event of allEvents(trace)) {
      assert.ok(!forbiddenUnderscoreEvents.has(event.type), `${trace.traceId}:${event.type}`);
      assert.match(event.type, /^[a-z]+(?:-[a-z]+)*$/);
      assert.ok(!ids.has(event.id), event.id);
      ids.add(event.id);
      assert.ok(event.sequence > prior, `${trace.traceId}: sequence`);
      prior = event.sequence;
    }
  }
  assert.match(mapping.rules.persistedSessionVocabulary, /Session 1/);
});

test("review scheduling is never represented as a session event", async () => {
  const record = await readJson("flow-traces.v1.json");
  for (const trace of record.traces) {
    assert.equal(
      allEvents(trace).some((event) => event.type === "review-scheduled"),
      false,
      trace.traceId
    );
  }
});
