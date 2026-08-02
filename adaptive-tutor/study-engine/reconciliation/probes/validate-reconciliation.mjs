import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const probeDir = path.dirname(fileURLToPath(import.meta.url));
export const reconciliationRoot = path.resolve(probeDir, "..");
export const studyEngineRoot = path.resolve(reconciliationRoot, "..");

export const ALLOWED_CLASSIFICATIONS = new Set([
  "BLOCKER",
  "REQUIRED BEFORE FINAL ASSEMBLY",
  "SAFE ADAPTER",
  "DOCUMENTATION ONLY",
  "DEFERRED PRODUCTION CONCERN"
]);

export async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(reconciliationRoot, relativePath), "utf8"));
}

export async function listFilesRecursive(root) {
  const output = [];
  for (const name of await readdir(root)) {
    const absolute = path.join(root, name);
    const entry = await stat(absolute);
    if (entry.isDirectory()) output.push(...(await listFilesRecursive(absolute)));
    else output.push(absolute);
  }
  return output;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export async function validateReconciliation() {
  const decisions = await readJson("canonical-decisions.v1.json");
  const issues = await readJson("issues.v1.json");
  const mappings = await readJson("enum-event-mappings.v1.json");
  const traces = await readJson("flow-traces.v1.json");
  const core = await readJson("tutor-core-compatibility.v1.json");
  const requests = await readJson("core-change-requests.v1.json");
  const artifacts = await readJson("artifact-verification.v1.json");
  const diff = await readJson("field-diff-matrix.v1.json");
  const manifest = await readJson("reconciliation-manifest.v1.json");
  const validationResult = await readJson("validation-result.v1.json");
  const registryPlan = await readJson("schema-registry-plan.v1.json");

  requireCondition(decisions.schemaVersion === 1, "Decision schema version must be 1");
  requireCondition(decisions.decisions.length === 26, "Exactly 26 required decisions expected");
  for (const decision of decisions.decisions) {
    requireCondition(
      ALLOWED_CLASSIFICATIONS.has(decision.classification),
      `Invalid decision classification: ${decision.decisionId}`
    );
  }

  requireCondition(
    JSON.stringify(issues.allowedClassifications) ===
      JSON.stringify([...ALLOWED_CLASSIFICATIONS]),
    "Issue classification vocabulary differs from the required order"
  );
  const issueIds = new Set();
  for (const issue of issues.issues) {
    requireCondition(!issueIds.has(issue.issueId), `Duplicate issue: ${issue.issueId}`);
    issueIds.add(issue.issueId);
    requireCondition(
      ALLOWED_CLASSIFICATIONS.has(issue.classification),
      `Invalid issue classification: ${issue.issueId}`
    );
  }

  const requiredTraceTitles = [
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
  ];
  requireCondition(traces.traces.length === 14, "Exactly fourteen traces expected");
  requireCondition(
    JSON.stringify(traces.traces.map((trace) => trace.title)) ===
      JSON.stringify(requiredTraceTitles),
    "Trace titles/order differ from the required set"
  );
  requireCondition(
    new Set(traces.traces.map((trace) => trace.traceId)).size === 14,
    "Trace IDs must be unique"
  );

  requireCondition(
    mappings.rules.persistedSessionVocabulary.includes("Session 1"),
    "Session 1 event authority missing"
  );
  requireCondition(
    core.status === "blocked" &&
      core.artifact.accessible === false &&
      core.probes.every((probe) => probe.status.startsWith("NOT RUN")),
    "Missing Tutor Core must remain explicitly blocked"
  );
  requireCondition(
    requests.requests.every((request) =>
      ALLOWED_CLASSIFICATIONS.has(request.classification)
    ),
    "Core-change request classification invalid"
  );
  requireCondition(
    diff.rows.length >= 25 &&
      diff.rows.every((row) => ALLOWED_CLASSIFICATIONS.has(row.classification)),
    "Field diff matrix is incomplete or has an invalid classification"
  );
  requireCondition(
    artifacts.wave1Artifacts.length === 4 &&
      artifacts.wave1Artifacts.every(
        (artifact) => artifact.result === "PASS" && artifact.hashMatch === true
      ),
    "Four Wave 1 artifact hashes must pass"
  );
  requireCondition(
    manifest.finalAssemblyAuthorized === false &&
      manifest.productionIntegrationAuthorized === false,
    "Audit must not authorize production integration or final assembly"
  );
  requireCondition(
    manifest.specialistReviews.length === 5 &&
      manifest.specialistReviews.every((review) => review.status === "complete"),
    "All five required specialist reviews must be recorded complete"
  );
  requireCondition(
    validationResult.status === "PASS_WITH_BLOCKER" &&
      validationResult.assemblyAuthorized === false &&
      validationResult.results.some(
        (result) => result.checkId === "VAL-TUTOR-CORE" && result.status === "BLOCKED"
      ),
    "Validation result must preserve the Tutor Core blocker"
  );
  requireCondition(
    registryPlan.canonicalStudyEngineKinds.length === 7 &&
      registryPlan.canonicalStudyEngineKinds.some(
        (entry) =>
          entry.kind === "parent-teacher-private" &&
          entry.dataClass === "adult-private" &&
          entry.requiredCapability
      ),
    "Schema registry plan must preserve all seven roots and gate adult-private data"
  );

  return {
    status: "PASS",
    decisionCount: decisions.decisions.length,
    issueCount: issues.issues.length,
    traceCount: traces.traces.length,
    mappingCount:
      mappings.sessionEvents.length +
      mappings.gradeBands.length +
      mappings.calendarBlockTypes.length,
    fieldDiffRowCount: diff.rows.length,
    tutorCoreStatus: core.status,
    coreChangeRequestCount: requests.requests.length
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await validateReconciliation();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
