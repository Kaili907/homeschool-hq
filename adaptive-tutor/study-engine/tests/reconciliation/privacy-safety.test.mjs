import test from "node:test";
import assert from "node:assert/strict";
import { readJson } from "../../reconciliation/probes/validate-reconciliation.mjs";

function visit(value, callback, path = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, callback, [...path, String(index)]));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      callback(key, item, [...path, key]);
      visit(item, callback, [...path, key]);
    }
  }
}

test("canonical trace event payloads contain no raw-content fields", async () => {
  const record = await readJson("flow-traces.v1.json");
  const forbiddenKeys = new Set([
    "rawAnswer",
    "answerText",
    "transcript",
    "transcriptBody",
    "privateNote",
    "privateNoteBody",
    "email",
    "credential",
    "token"
  ]);
  for (const trace of record.traces) {
    for (const step of trace.steps) {
      for (const event of step.events ?? []) {
        visit(event, (key) => {
          assert.equal(forbiddenKeys.has(key), false, `${trace.traceId}:${key}`);
        });
      }
    }
  }
});

test("adult-private, metadata, and Romeo risks are explicitly classified", async () => {
  const issues = await readJson("issues.v1.json");
  const byId = new Map(issues.issues.map((issue) => [issue.issueId, issue]));
  for (const id of [
    "PRIVATE-001",
    "PRIVATE-AUDIENCE-001",
    "PRIVACY-EXT-001",
    "PRIVACY-UI-001",
    "ROMEO-001",
    "REGISTRY-AUDIENCE-001"
  ]) {
    assert.ok(byId.has(id), id);
    assert.notEqual(byId.get(id).classification, "DOCUMENTATION ONLY", id);
  }
});

test("Tutor Core compatibility remains honest about every blocked probe", async () => {
  const core = await readJson("tutor-core-compatibility.v1.json");
  assert.equal(core.artifact.accessible, false);
  assert.equal(core.probes.length, 20);
  assert.ok(core.probes.every((probe) => probe.status.startsWith("NOT RUN")));
  assert.ok(core.matrix.some((row) => row.boundary === "tutoring-safety"));
  assert.ok(core.matrix.some((row) => row.boundary === "transcripts"));
});
