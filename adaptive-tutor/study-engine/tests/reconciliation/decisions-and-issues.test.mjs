import test from "node:test";
import assert from "node:assert/strict";
import { readJson, validateReconciliation } from "../../reconciliation/probes/validate-reconciliation.mjs";

test("machine reconciliation package validates", async () => {
  const result = await validateReconciliation();
  assert.equal(result.status, "PASS");
  assert.equal(result.decisionCount, 26);
  assert.ok(result.issueCount >= 30);
});

test("every requested decision topic appears exactly once", async () => {
  const record = await readJson("canonical-decisions.v1.json");
  const topics = record.decisions.map((entry) => entry.topic);
  assert.equal(new Set(topics).size, topics.length);
  for (const fragment of [
    "Package IDs",
    "Stable opaque",
    "Grade bands",
    "subject, skill, and task",
    "Session states",
    "Event versioning",
    "Segment IDs",
    "Timer modes",
    "Learning-evidence",
    "Mastery",
    "Recommendation",
    "override precedence",
    "Accessibility",
    "Review intervals",
    "IANA timezone",
    "Calendar block",
    "Review queue",
    "Romeo",
    "Adult-private",
    "PII",
    "Validation result",
    "Persistence seam",
    "Functional sidecar",
    "Unsupported-version",
    "Node and browser",
    "Core-change"
  ]) {
    assert.ok(topics.some((topic) => topic.includes(fragment)), fragment);
  }
});

test("no issue uses an unapproved classification", async () => {
  const issues = await readJson("issues.v1.json");
  const allowed = new Set(issues.allowedClassifications);
  for (const issue of issues.issues) {
    assert.ok(allowed.has(issue.classification), issue.issueId);
  }
});
