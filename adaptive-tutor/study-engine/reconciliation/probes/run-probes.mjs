import assert from "node:assert/strict";
import { resolveDurationPolicy } from "./policy.mjs";
import {
  appendCommand,
  makeQuarantineRecord,
  versionDisposition
} from "./quarantine.mjs";
import { validateReconciliation } from "./validate-reconciliation.mjs";

const results = [];
function probe(id, fn) {
  try {
    fn();
    results.push({ id, status: "PASS" });
  } catch (error) {
    results.push({ id, status: "FAIL", message: error.message });
  }
}

probe("RP-01-hard-cap-before-hold", () => {
  const result = resolveDurationPolicy({
    policyVersion: 1,
    integrityValid: true,
    actorAuthorized: true,
    safety: { minimumMinutes: 5, maximumMinutes: 60 },
    accommodations: [],
    adultHardMaximums: [{ active: true, minutes: 20 }],
    manualOverride: { active: true, mode: "hold" },
    currentMinutes: 30,
    gradeBandDefaultMinutes: 25
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.targetMinutes, 20);
});

probe("RP-02-accommodation-clamps-manual-target", () => {
  const result = resolveDurationPolicy({
    policyVersion: 1,
    integrityValid: true,
    actorAuthorized: true,
    safety: { minimumMinutes: 5, maximumMinutes: 60 },
    accommodations: [{ active: true, maximumMinutes: 15 }],
    adultHardMaximums: [{ active: true, minutes: 20 }],
    manualOverride: { active: true, mode: "target", targetMinutes: 25 },
    currentMinutes: 20,
    gradeBandDefaultMinutes: 25
  });
  assert.equal(result.targetMinutes, 15);
});

probe("RP-03-infeasible-constraints-manual-review", () => {
  const result = resolveDurationPolicy({
    policyVersion: 1,
    integrityValid: true,
    actorAuthorized: true,
    safety: { minimumMinutes: 5, maximumMinutes: 60 },
    accommodations: [
      { active: true, minimumMinutes: 25 },
      { active: true, maximumMinutes: 15 }
    ],
    adultHardMaximums: [],
    currentMinutes: 20,
    gradeBandDefaultMinutes: 20
  });
  assert.equal(result.status, "manual-review");
  assert.equal(result.targetMinutes, null);
});

probe("RP-04-rejected-recommendation-not-applied", () => {
  const result = resolveDurationPolicy({
    policyVersion: 1,
    integrityValid: true,
    actorAuthorized: true,
    safety: { minimumMinutes: 5, maximumMinutes: 60 },
    accommodations: [],
    adultHardMaximums: [],
    recommendation: { state: "rejected", targetMinutes: 35 },
    establishedTargetMinutes: 20,
    currentMinutes: 20,
    gradeBandDefaultMinutes: 25
  });
  assert.equal(result.source, "established-target");
  assert.equal(result.targetMinutes, 20);
});

probe("RP-05-version-quarantine", () => {
  assert.equal(versionDisposition({ kind: "study-session" }), "missing-version");
  assert.equal(
    versionDisposition({ schemaVersion: 2, kind: "study-session" }),
    "unsupported-future-version"
  );
  const record = makeQuarantineRecord(
    { schemaVersion: 2, kind: "study-session", secret: "never-log-body" },
    "unsupported-future-version",
    "2026-07-28T00:00:00Z"
  );
  assert.equal(Object.hasOwn(record, "payload"), false);
  assert.match(record.payloadSha256, /^[A-F0-9]{64}$/);
});

probe("RP-06-command-replay-and-conflict", () => {
  const initial = {
    sessionId: "session:probe",
    revision: 0,
    events: [],
    appliedCommands: {}
  };
  const command = {
    commandVersion: "manuel-academy.study-command.v1",
    idempotencyKey: "probe:append:1",
    expectedRevision: 0,
    events: [
      {
        id: "event:probe:001",
        sessionId: "session:probe",
        sequence: 1,
        type: "session-planned"
      }
    ]
  };
  const first = appendCommand(initial, command);
  assert.equal(first.disposition, "appended");
  const replay = appendCommand(first.state, command);
  assert.equal(replay.disposition, "replayed-no-op");
  const conflict = appendCommand(first.state, {
    ...command,
    events: [{ ...command.events[0], type: "session-started" }]
  });
  assert.equal(conflict.reasonCode, "idempotency-conflict");
});

const packageValidation = await validateReconciliation();
results.push({ id: "RP-07-reconciliation-package", status: packageValidation.status });

const failed = results.filter((result) => result.status !== "PASS");
process.stdout.write(
  `${JSON.stringify(
    {
      status: failed.length === 0 ? "PASS" : "FAIL",
      passed: results.length - failed.length,
      failed: failed.length,
      results,
      packageValidation
    },
    null,
    2
  )}\n`
);
if (failed.length > 0) process.exitCode = 1;
