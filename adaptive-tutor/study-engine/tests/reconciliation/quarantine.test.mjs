import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCommand,
  makeQuarantineRecord,
  versionDisposition
} from "../../reconciliation/probes/quarantine.mjs";

test("version gate distinguishes missing, invalid, older, future, and unknown kind", () => {
  const known = new Set(["study-session"]);
  assert.equal(versionDisposition({}, known), "missing-version");
  assert.equal(
    versionDisposition({ schemaVersion: "1", kind: "study-session" }, known),
    "invalid-version"
  );
  assert.equal(
    versionDisposition({ schemaVersion: 0, kind: "study-session" }, known),
    "unsupported-older-version"
  );
  assert.equal(
    versionDisposition({ schemaVersion: 2, kind: "study-session" }, known),
    "unsupported-future-version"
  );
  assert.equal(
    versionDisposition({ schemaVersion: 1, kind: "future-kind" }, known),
    "unknown-kind"
  );
});

test("quarantine metadata never reflects the raw body", () => {
  const record = makeQuarantineRecord(
    {
      schemaVersion: 2,
      kind: "study-session",
      privateNote: "PRIVATE-NOTE-SENTINEL"
    },
    "unsupported-future-version",
    "2026-07-28T00:00:00Z"
  );
  assert.equal(JSON.stringify(record).includes("PRIVATE-NOTE-SENTINEL"), false);
  assert.equal(Object.hasOwn(record, "payload"), false);
});

test("append is contiguous, idempotent, conflict-detecting, and CAS-protected", () => {
  const initial = {
    sessionId: "session:test",
    revision: 0,
    events: [],
    appliedCommands: {}
  };
  const command = {
    commandVersion: "manuel-academy.study-command.v1",
    idempotencyKey: "command:test:1",
    expectedRevision: 0,
    events: [
      {
        id: "event:test:001",
        sessionId: "session:test",
        sequence: 1,
        type: "session-planned"
      }
    ]
  };
  const first = appendCommand(initial, command);
  assert.equal(first.disposition, "appended");
  assert.equal(first.state.revision, 1);
  assert.equal(appendCommand(first.state, command).disposition, "replayed-no-op");
  assert.equal(
    appendCommand(first.state, {
      ...command,
      events: [{ ...command.events[0], type: "session-started" }]
    }).reasonCode,
    "idempotency-conflict"
  );
  assert.equal(
    appendCommand(first.state, {
      ...command,
      idempotencyKey: "command:test:2",
      expectedRevision: 0
    }).reasonCode,
    "aggregate.stale-revision"
  );
});
