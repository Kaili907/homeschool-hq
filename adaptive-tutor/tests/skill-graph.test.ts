import test from "node:test";
import assert from "node:assert/strict";
import { validateSkillGraph } from "../core/index.js";
import { mathTutorProgram } from "../examples/index.js";

test("prerequisite graph accepts acyclic demonstration graph", () => {
  const result = validateSkillGraph(mathTutorProgram.skillGraph);
  assert.equal(result.valid, true);
  assert.ok(result.topologicalOrder.includes("math-equivalent-fractions"));
});

test("prerequisite graph rejects cycles", () => {
  const graph = structuredClone(mathTutorProgram.skillGraph);
  graph.edges.push({
    prerequisiteSkillId: "math-equivalent-fractions",
    dependentSkillId: "math-fraction-parts",
    strength: "required",
    rationale: "Deliberate cycle for test.",
  });
  assert.equal(validateSkillGraph(graph).valid, false);
});
