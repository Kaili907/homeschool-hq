import type { PrerequisiteSkillGraph, StableId } from "../contracts/index.js";

export interface SkillGraphValidation {
  valid: boolean;
  errors: string[];
  topologicalOrder: StableId[];
}

export function validateSkillGraph(graph: PrerequisiteSkillGraph): SkillGraphValidation {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (nodeIds.size !== graph.nodes.length) errors.push("Skill node IDs must be unique.");

  const adjacency = new Map<StableId, StableId[]>();
  const indegree = new Map<StableId, number>();
  for (const id of nodeIds) {
    adjacency.set(id, []);
    indegree.set(id, 0);
  }

  const edgeKeys = new Set<string>();
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.prerequisiteSkillId)) {
      errors.push(`Unknown prerequisite skill: ${edge.prerequisiteSkillId}`);
      continue;
    }
    if (!nodeIds.has(edge.dependentSkillId)) {
      errors.push(`Unknown dependent skill: ${edge.dependentSkillId}`);
      continue;
    }
    if (edge.prerequisiteSkillId === edge.dependentSkillId) {
      errors.push(`Skill ${edge.prerequisiteSkillId} cannot depend on itself.`);
      continue;
    }
    const key = `${edge.prerequisiteSkillId}->${edge.dependentSkillId}`;
    if (edgeKeys.has(key)) errors.push(`Duplicate prerequisite edge: ${key}`);
    edgeKeys.add(key);
    adjacency.get(edge.prerequisiteSkillId)?.push(edge.dependentSkillId);
    indegree.set(edge.dependentSkillId, (indegree.get(edge.dependentSkillId) ?? 0) + 1);
  }

  const queue = [...nodeIds].filter((id) => indegree.get(id) === 0).sort();
  const order: StableId[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    order.push(current);
    for (const dependent of adjacency.get(current) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) queue.push(dependent);
    }
    queue.sort();
  }

  if (order.length !== nodeIds.size) errors.push("Prerequisite graph contains a cycle.");
  return { valid: errors.length === 0, errors, topologicalOrder: order };
}

export function getMissingPrerequisites(
  graph: PrerequisiteSkillGraph,
  skillId: StableId,
  demonstratedSkillIds: ReadonlySet<StableId>,
): StableId[] {
  return graph.edges
    .filter(
      (edge) =>
        edge.dependentSkillId === skillId &&
        edge.strength === "required" &&
        !demonstratedSkillIds.has(edge.prerequisiteSkillId),
    )
    .map((edge) => edge.prerequisiteSkillId);
}
