import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactCandidateNames,
  artifactDirectory,
  formatMissingArtifacts,
  resolveArtifactCandidate,
  resolveArtifactSet
} from "../../reconciliation/artifact-resolver.mjs";
import {
  applyParentPrecedence,
  handleVersion,
  isOpaqueId,
  projectLearner,
  validateEvent
} from "../../reconciliation/compatibility-probe.mjs";
import {
  auditRawEntries,
  crossPackageFileCollisions,
  extractEntry,
  findEntry,
  readZip,
  sha256Bytes
} from "../../reconciliation/zip-audit.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const reconciliation = path.resolve(here, "../../reconciliation");
const studyEngine = path.resolve(reconciliation, "..");
const manifest = JSON.parse(await readFile(path.join(reconciliation, "reconciliation-manifest.json")));
const traces = JSON.parse(await readFile(path.join(reconciliation, "flow-traces.json")));
const artifactMap = JSON.parse(await readFile(path.join(reconciliation, "artifact-map.json")));
const mappings = JSON.parse(await readFile(path.join(reconciliation, "exact-mappings.json")));
const correctedZipPath = process.env.STUDY_RECON_PACKAGE?.trim()
  ? path.resolve(process.env.STUDY_RECON_PACKAGE)
  : undefined;
const artifactResolution = await resolveArtifactSet(artifactMap);
const artifactsAvailable = artifactResolution.missing.length === 0;
if (!artifactsAvailable) {
  console.error(formatMissingArtifacts(artifactResolution));
  process.exitCode = 2;
}
const sourceZips = artifactsAvailable
  ? await Promise.all(artifactResolution.resolved.map(async (artifact) => ({
      ...artifact,
      zip: await readZip(artifact.path)
    })))
  : [];
const sourceTest = artifactsAvailable ? test : test.skip;

async function listPackageTextFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listPackageTextFiles(entryPath));
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() !== ".zip") {
      output.push(entryPath);
    }
  }
  return output;
}

test("artifact map contains relative filenames only", () => {
  assert.equal(artifactMap.schemaVersion, 2);
  for (const artifact of artifactMap.artifacts) {
    assert.equal("path" in artifact, false, artifact.id);
    for (const filename of artifactCandidateNames(artifact)) {
      assert.equal(path.win32.isAbsolute(filename), false, filename);
      assert.equal(path.posix.isAbsolute(filename), false, filename);
      assert.equal(filename.includes("\\"), false, filename);
      assert.equal(filename.split("/").includes(".."), false, filename);
    }
  }
});

test("artifact directory uses environment override with relative fallback", () => {
  assert.equal(artifactDirectory({
    env: {},
    cwd: "/workspace",
    pathApi: path.posix
  }), "/workspace/artifacts");
  assert.equal(artifactDirectory({
    env: { STUDY_ARTIFACT_DIR: "source-zips" },
    cwd: "/workspace",
    pathApi: path.posix
  }), "/workspace/source-zips");
  assert.equal(artifactDirectory({
    env: { STUDY_ARTIFACT_DIR: "D:\\source-zips" },
    cwd: "C:\\workspace",
    pathApi: path.win32
  }), "D:\\source-zips");
});

test("Windows and POSIX resolution select the same intended filenames", () => {
  for (const artifact of artifactMap.artifacts) {
    const windows = resolveArtifactCandidate(
      "C:\\study\\artifacts", artifact.filename, path.win32
    );
    const posix = resolveArtifactCandidate(
      "/study/artifacts", artifact.filename, path.posix
    );
    assert.equal(path.win32.basename(windows), artifact.filename);
    assert.equal(path.posix.basename(posix), artifact.filename);
  }
});

test("missing artifacts produce one concise controlled error", async () => {
  const result = await resolveArtifactSet(artifactMap, {
    directory: path.resolve("missing-artifacts"),
    accessFile: async () => {
      const error = new Error("file unavailable");
      error.code = "ENOENT";
      throw error;
    }
  });
  const message = formatMissingArtifacts(result);
  assert.equal(result.missing.length, 5);
  assert.match(message, /Missing 5 required Study artifacts/);
  for (const artifact of artifactMap.artifacts) assert.ok(message.includes(artifact.filename));
  assert.match(message, /STUDY_ARTIFACT_DIR/);
  assert.equal(message.includes("ENOENT"), false);
  assert.equal(message.includes("node:fs"), false);
});

test("missing-artifact preflight exits cleanly without raw filesystem output", async () => {
  const emptyDirectory = await mkdtemp(path.join(tmpdir(), "study-r2-missing-"));
  try {
    const result = spawnSync(process.execPath, [
      path.join(reconciliation, "artifact-resolver.mjs")
    ], {
      cwd: emptyDirectory,
      env: { ...process.env, STUDY_ARTIFACT_DIR: emptyDirectory },
      encoding: "utf8"
    });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, 2);
    assert.match(output, /Missing 5 required Study artifacts/);
    for (const artifact of artifactMap.artifacts) assert.ok(output.includes(artifact.filename));
    assert.equal(output.includes("ENOENT"), false);
    assert.equal(output.includes("node:fs"), false);
  } finally {
    await rm(emptyDirectory, { recursive: true, force: true });
  }
});

test("package text contains no embedded personal home-directory path", async () => {
  const roots = [
    reconciliation,
    path.join(studyEngine, "docs", "reconciliation"),
    path.join(studyEngine, "tests", "reconciliation")
  ];
  const patterns = [
    new RegExp(`[A-Za-z]:[\\\\/]${"Users"}[\\\\/]`, "i"),
    new RegExp(`/${"Users"}/[^/\\s]+/`),
    new RegExp(`/${"home"}/[^/\\s]+/`)
  ];
  const findings = [];
  for (const root of roots) {
    for (const file of await listPackageTextFiles(root)) {
      const text = await readFile(file, "utf8");
      if (patterns.some((pattern) => pattern.test(text))) findings.push(file);
    }
  }
  assert.deepEqual(findings, []);
});

sourceTest("all five source ZIP checksums pass exactly", () => {
  assert.equal(artifactResolution.directory,
    path.resolve(process.env.STUDY_ARTIFACT_DIR || "artifacts"));
  assert.equal(manifest.artifacts.length, 5);
  for (const artifact of sourceZips) {
    assert.equal(sha256Bytes(artifact.zip.bytes), artifact.expectedSha256, artifact.id);
  }
  assert.equal(manifest.artifacts.find((x) => x.id === "tutor-core-v0.2").manifestHashesPassed, 248);
});

sourceTest("all source ZIP central-directory paths are safe and unique", () => {
  for (const artifact of sourceZips) {
    const audit = auditRawEntries(artifact.zip);
    assert.deepEqual(audit.duplicatePaths, [], artifact.id);
    assert.deepEqual(audit.caseCollisions, [], artifact.id);
    assert.deepEqual(audit.traversalPaths, [], artifact.id);
    assert.deepEqual(audit.absolutePaths, [], artifact.id);
    assert.deepEqual(audit.nulPaths, [], artifact.id);
    assert.deepEqual(audit.symlinks, [], artifact.id);
  }
});

sourceTest("every source file remains inside its assigned ownership", () => {
  for (const artifact of sourceZips) {
    const files = artifact.zip.entries.filter((entry) => !entry.directory);
    const outside = files.filter((entry) =>
      !artifact.allowedFilePrefixes.some((prefix) =>
        entry.name.replaceAll("\\", "/").startsWith(prefix)));
    assert.deepEqual(outside.map((entry) => entry.name), [], artifact.id);
  }
});

sourceTest("cross-package final file paths do not collide", () => {
  assert.deepEqual(crossPackageFileCollisions(
    sourceZips.map(({ id, zip }) => ({ id, zip }))
  ), []);
});

test("ownership report remains audit-only and sources remain frozen", () => {
  assert.equal(manifest.package.productionMerge, false);
  assert.equal(manifest.package.finalAssembly, false);
  assert.equal(manifest.artifacts.every((artifact) => artifact.frozen === true), true);
});

sourceTest("Session 1 canonical state, event, resume and privacy contracts are present", () => {
  const s1 = sourceZips.find((artifact) => artifact.id === "session-1-study-contracts").zip;
  const sessionText = extractEntry(s1, findEntry(
    s1, "adaptive-tutor/study-engine/contracts/study-session.ts"
  )).toString("utf8");
  const privateText = extractEntry(s1, findEntry(
    s1, "adaptive-tutor/study-engine/contracts/parent-teacher-private.ts"
  )).toString("utf8");
  for (const value of [
    "planned", "active", "paused", "approved-break", "student-requested-break",
    "technical-interruption", "completed", "abandoned", "responseDraftRef",
    "technical-interruption-started", "technical-interruption-ended"
  ]) assert.ok(sessionText.includes(`'${value}'`) || sessionText.includes(value), value);
  assert.ok(privateText.includes("'authorized-adults-only'"));
});

sourceTest("S2 provisional Tutor directive is not a Tutor Core wire contract", () => {
  const s2 = sourceZips.find((artifact) => artifact.id === "session-2-study-engine").zip;
  const core = sourceZips.find((artifact) => artifact.id === "tutor-core-v0.2").zip;
  const s2Text = extractEntry(s2, findEntry(
    s2, "adaptive-tutor/study-engine/engine/adapters/provisional-contracts.ts"
  )).toString("utf8");
  const coreText = extractEntry(core, findEntry(
    core,
    "manuel-academy-adaptive-tutor-core-v0.2/adaptive-tutor/core/contracts/tutor-response.ts"
  )).toString("utf8");
  assert.ok(s2Text.includes("instructionDirective"));
  assert.equal(coreText.includes("instructionDirective"), false);
});

test("exact enum mappings preserve one canonical authority", () => {
  assert.equal(mappings.enumMappings.gradeBand["S2.elementary"], "S1.elementary-3-5");
  assert.equal(mappings.enumMappings.gradeBand["S2.middle_school"], "S1.middle-6-8");
  assert.equal(mappings.enumMappings.timer["S4.false"], "no-lossless-target");
  assert.equal(mappings.enumMappings.reviewInterval["S2.0"], "S1.same-day");
  assert.equal(mappings.enumMappings.notMapped["S2.correct|reteach"],
    "not a Tutor Core wire enum; retire");
});

test("every provisional version has an explicit retirement disposition", () => {
  assert.ok(mappings.versionMappings.filter((item) =>
    item.source.includes("S2") || item.source.includes("S3") || item.source.includes("S4")
  ).every((item) => item.disposition.startsWith("retire")));
});

test("underscore events map or explicitly drop without becoming canonical", () => {
  const completion = mappings.eventMappings.find((item) =>
    item.source.includes("guided_practice_completed"));
  assert.ok(completion.targets.includes("S1.segment-completed"));
  const save = mappings.eventMappings.find((item) =>
    item.source.includes("intentional_save_exit"));
  assert.deepEqual(save.targets, []);
  assert.match(save.rule, /checkpoint/);
});

test("event mapping requires namespaced event name, opaque IDs and semver", () => {
  const seen = new Set();
  const good = {
    eventId: "A7mQ2xZ9pL4vN8kR",
    streamId: "S8dF4gH2jK7lP9qW",
    name: "study_session.started",
    version: "1.0.0"
  };
  assert.deepEqual(validateEvent(good, seen), { valid: true, errors: [] });
  assert.ok(validateEvent(good, seen).errors.includes("duplicateEventId"));
  assert.equal(validateEvent({ ...good, eventId: "lesson-one" }, new Set()).valid, false);
});

test("unknown or unsupported versions quarantine", () => {
  assert.equal(handleVersion({ version: "1.2.3" }).accepted, true);
  assert.equal(handleVersion({ version: "2.0.0" }).quarantineRequired, true);
  assert.equal(handleVersion({ version: "unknown" }).quarantineRequired, true);
});

sourceTest("Session 1 version inspection rejects future versions without fallback", () => {
  const s1 = sourceZips.find((artifact) => artifact.id === "session-1-study-contracts").zip;
  const text = extractEntry(s1, findEntry(
    s1, "adaptive-tutor/study-engine/contracts/versioning.ts"
  )).toString("utf8");
  assert.ok(text.includes("unsupported-future-version"));
  assert.ok(text.includes("unsupported-older-version"));
  assert.ok(text.includes("missing-version"));
});

test("canonical session state vocabulary is exact and non-duplicated", () => {
  assert.deepEqual(manifest.canonical.sessionStates, [
    "planned", "active", "paused", "approved-break", "student-requested-break",
    "technical-interruption", "completed", "abandoned"
  ]);
  assert.equal(new Set(manifest.canonical.eventTypes).size, 17);
});

test("all required flow/state traces are present", () => {
  assert.equal(traces.traces.length, 15);
  for (const trace of traces.traces) {
    assert.ok(trace.inputContract);
    assert.ok(trace.transitions.length >= 2);
    assert.ok(Array.isArray(trace.canonicalEvents));
    assert.ok(trace.decisionAuthority.length >= 1);
    assert.ok(trace.finalState);
  }
});

test("resume trace protects exact position and duplicate prevention", () => {
  const trace = traces.traces.find((x) => x.id === "exact-resume-after-refresh");
  assert.equal(trace.evidenceStatus, "blocked-current-packages");
  assert.ok(trace.sidecarActions.some((value) => value.includes("responseDraftRef")));
  assert.ok(trace.canonicalEvents.includes("session-resumed"));
});

sourceTest("Session 3 local recovery is not mistaken for canonical raw-data persistence", () => {
  const s3 = sourceZips.find((artifact) => artifact.id === "session-3-study-ux").zip;
  const text = extractEntry(s3, findEntry(
    s3, "adaptive-tutor/study-engine/prototype/src/sessionStore.ts"
  )).toString("utf8");
  assert.ok(text.includes("localStorage"));
  assert.ok(text.includes("transcript"));
  assert.ok(text.includes("answers"));
  assert.ok(text.includes("hydrateWorkspace"));
});

test("parent precedence: safety then accommodation then hard maximum", () => {
  const result = applyParentPrecedence({
    gradeBandDefault: 40,
    engineRecommendation: 50,
    parentManualOverride: 45,
    parentHardMaximum: 35,
    requiredAccommodation: { maximumDuration: 30 },
    safetyMaximum: 25,
    minimumDuration: 10
  });
  assert.deepEqual(result, {
    status: "applied",
    duration: 25,
    reasons: ["required_accommodation", "safety_limit"]
  });
});

test("conflicting minimum routes to manual review", () => {
  assert.equal(applyParentPrecedence({
    gradeBandDefault: 20,
    requiredAccommodation: { maximumDuration: 10 },
    minimumDuration: 15
  }).status, "manual_review");
});

test("learner projection excludes PII, raw content and adult-private fields", () => {
  const projected = projectLearner({
    status: "active",
    adultPrivateNote: "private",
    rawAnswer: "answer",
    rawTranscript: "transcript",
    emailAddress: "learner@example.com",
    legalName: "Example",
    diagnosis: "unsupported",
    hiddenBehaviorScore: 1
  });
  assert.deepEqual(projected, { status: "active" });
});

sourceTest("Tutor Core safety routing mismatch is supported by exact runtime evidence", () => {
  const core = sourceZips.find((artifact) => artifact.id === "tutor-core-v0.2").zip;
  const rules = extractEntry(core, findEntry(
    core,
    "manuel-academy-adaptive-tutor-core-v0.2/adaptive-tutor/core/safety/rules.ts"
  )).toString("utf8");
  const contract = extractEntry(core, findEntry(
    core,
    "manuel-academy-adaptive-tutor-core-v0.2/adaptive-tutor/core/contracts/safety.ts"
  )).toString("utf8");
  assert.ok(contract.includes("self-harm-or-immediate-danger"));
  assert.ok(contract.includes("abuse-or-neglect-disclosure"));
  assert.equal(rules.includes("category: 'self-harm-or-immediate-danger'"), false);
  assert.equal(rules.includes("category: 'abuse-or-neglect-disclosure'"), false);
});

sourceTest("Tutor Core raw transcript cannot cross the canonical Study boundary", () => {
  const core = sourceZips.find((artifact) => artifact.id === "tutor-core-v0.2").zip;
  const engine = extractEntry(core, findEntry(
    core,
    "manuel-academy-adaptive-tutor-core-v0.2/adaptive-tutor/core/engine/adaptive-tutor-engine.ts"
  )).toString("utf8");
  assert.ok(engine.includes("transcript"));
  assert.ok(engine.includes("getSnapshot"));
  assert.equal(manifest.requiredPersistenceRules.rawLearnerResponsesPersisted, false);
  assert.equal(manifest.requiredPersistenceRules.rawTranscriptsPersisted, false);
});

test("Session 4 private note bodies retire to canonical authorized private records", () => {
  const mapping = mappings.fieldMappings.find((item) =>
    item.source === "S4.ParentControlState.privateNotes/actionLog.body");
  assert.equal(mapping.target, "S1.ParentTeacherPrivateRecord.notes");
  assert.equal(mapping.disposition, "required-private-adapter");
});

sourceTest("Romeo adapter is credential-free and remains a sidecar authority", () => {
  const s4 = sourceZips.find((artifact) => artifact.id === "session-4-study-integrations").zip;
  const text = extractEntry(s4, findEntry(
    s4, "adaptive-tutor/study-engine/integrations/romeo/types.ts"
  )).toString("utf8");
  assert.ok(text.includes("Credential-free external-assignment contract"));
  assert.equal(/\b(password|accessToken|sessionCookie|apiKey)\s*:/u.test(text), false);
  assert.equal(mappings.fieldMappings.find((item) =>
    item.source === "S4.RomeoVirtualAcademyAssignment").disposition, "sidecar-authority");
});

test("low accuracy and retrieval failure lead to reteaching, not labeling", () => {
  const trace = traces.traces.find((x) => x.id === "retrieval-failure");
  assert.ok(trace.sidecarActions.some((value) => value.includes("reteach")));
  assert.match(trace.parentVisible, /no label/);
});

test("approved water break is not treated as failure", () => {
  const trace = traces.traces.find((x) => x.id === "student-water-break");
  assert.equal(trace.finalState, "active");
  assert.match(trace.parentVisible, /never learner failure/);
});

test("opaque IDs reject human-readable permanent labels", () => {
  assert.equal(isOpaqueId("attention-problem-child"), false);
  assert.equal(isOpaqueId("A7mQ2xZ9pL4vN8kR"), true);
});

test("timezone trace requires learner-local date and household IANA timezone", () => {
  const trace = traces.traces.find((x) => x.id === "same-day-review-recommendation");
  const actions = trace.sidecarActions.join(" ");
  assert.match(actions, /learner-local date/);
  assert.match(actions, /IANA zone/);
});

test("package paths are portable and ownership-confined", async () => {
  const allowed = [
    "adaptive-tutor/study-engine/reconciliation/",
    "adaptive-tutor/study-engine/docs/reconciliation/",
    "adaptive-tutor/study-engine/tests/reconciliation/"
  ];
  if (correctedZipPath) {
    const corrected = await readZip(correctedZipPath);
    const audit = auditRawEntries(corrected);
    assert.deepEqual(audit.backslashPaths, []);
    assert.deepEqual(audit.absolutePaths, []);
    assert.deepEqual(audit.traversalPaths, []);
    assert.deepEqual(audit.duplicatePaths, []);
    assert.deepEqual(audit.caseCollisions, []);
    assert.deepEqual(audit.symlinks, []);
    assert.deepEqual(corrected.entries.filter((entry) =>
      !allowed.some((prefix) => entry.name.startsWith(prefix))
    ).map((entry) => entry.name), []);
    return;
  }
  const roots = [
    reconciliation,
    path.join(studyEngine, "docs", "reconciliation"),
    path.join(studyEngine, "tests", "reconciliation")
  ];
  const names = [];
  for (const root of roots) {
    for (const file of await listPackageTextFiles(root)) {
      names.push(`adaptive-tutor/study-engine/${
        path.relative(studyEngine, file).split(path.sep).join("/")
      }`);
    }
  }
  assert.equal(names.every((name) => !name.includes("\\") && !name.includes("../")), true);
  assert.equal(new Set(names).size, names.length);
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, names.length);
  assert.deepEqual(names.filter((name) =>
    !allowed.some((prefix) => name.startsWith(prefix))
  ), []);
});
