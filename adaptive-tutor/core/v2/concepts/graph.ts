import { Type, type Static } from "../../schema/typebox.js";
import { OpaqueReferenceSchema, type OpaqueReference } from "../contracts/primitives.js";
import {
  validateExact,
  type ExactValidationResult,
} from "../contracts/validation.js";

export const MAXIMUM_CONCEPT_NODES = 1_000;
export const MAXIMUM_PREREQUISITE_EDGES = 1_000;
export const MAXIMUM_CONTEXT_ADMISSIONS = 1_000;
export const DEFAULT_CONCEPT_TRAVERSAL_DEPTH = 32;
export const MAXIMUM_CONCEPT_TRAVERSAL_DEPTH = 64;

export type ConceptRef = OpaqueReference;

export const ConceptContextSchema = Type.Object(
  {
    subjectRef: OpaqueReferenceSchema,
    courseRef: OpaqueReferenceSchema,
    unitRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false },
);
export type ConceptContext = Static<typeof ConceptContextSchema>;

export const ConceptNodeSchema = Type.Object(
  {
    conceptRef: OpaqueReferenceSchema,
    context: ConceptContextSchema,
  },
  { additionalProperties: false },
);
export type ConceptNode = Static<typeof ConceptNodeSchema>;

export const ConceptPrerequisiteEdgeSchema = Type.Object(
  {
    prerequisiteConceptRef: OpaqueReferenceSchema,
    dependentConceptRef: OpaqueReferenceSchema,
  },
  { additionalProperties: false },
);
export type ConceptPrerequisiteEdge = Static<typeof ConceptPrerequisiteEdgeSchema>;

export const CrossContextBoundarySchema = Type.Union([
  Type.Literal("unit"),
  Type.Literal("course"),
  Type.Literal("subject"),
]);
export type CrossContextBoundary = Static<typeof CrossContextBoundarySchema>;

/**
 * An admission is deliberately edge-specific. A broad subject or course flag
 * cannot silently authorize unrelated graph relationships.
 */
export const ConceptContextAdmissionSchema = Type.Object(
  {
    admissionRef: OpaqueReferenceSchema,
    prerequisiteConceptRef: OpaqueReferenceSchema,
    dependentConceptRef: OpaqueReferenceSchema,
    maximumBoundary: CrossContextBoundarySchema,
  },
  { additionalProperties: false },
);
export type ConceptContextAdmission = Static<typeof ConceptContextAdmissionSchema>;

export const ConceptGraphSchema = Type.Object(
  {
    graphRef: OpaqueReferenceSchema,
    version: Type.String({ pattern: "^\\d+\\.\\d+\\.\\d+$" }),
    nodes: Type.Array(ConceptNodeSchema, {
      minItems: 1,
      maxItems: MAXIMUM_CONCEPT_NODES,
    }),
    edges: Type.Array(ConceptPrerequisiteEdgeSchema, {
      maxItems: MAXIMUM_PREREQUISITE_EDGES,
    }),
    metadata: Type.Object(
      {
        crossContextAdmissions: Type.Array(ConceptContextAdmissionSchema, {
          maxItems: MAXIMUM_CONTEXT_ADMISSIONS,
        }),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, $id: "TutorV2ConceptGraph" },
);
export type ConceptGraph = Static<typeof ConceptGraphSchema>;

export type ConceptGraphIssueCode =
  | "INVALID_GRAPH_CONTRACT"
  | "DUPLICATE_CONCEPT_REF"
  | "UNKNOWN_EDGE_NODE"
  | "SELF_EDGE"
  | "DUPLICATE_EDGE"
  | "DUPLICATE_ADMISSION_REF"
  | "DUPLICATE_EDGE_ADMISSION"
  | "UNKNOWN_ADMISSION_NODE"
  | "ADMISSION_WITHOUT_EDGE"
  | "UNAUTHORIZED_CROSS_CONTEXT_EDGE"
  | "CYCLE_DETECTED";

export interface ConceptGraphIssue {
  readonly path: string;
  readonly code: ConceptGraphIssueCode;
  readonly message: string;
  readonly conceptRefs: readonly ConceptRef[];
}

export type ConceptGraphValidationResult =
  | { readonly status: "accepted"; readonly graph: ConceptGraph }
  | {
      readonly status: "rejected";
      readonly code: "INVALID_CONCEPT_GRAPH";
      readonly issues: readonly ConceptGraphIssue[];
    };

export type ConceptGraphBuildResult =
  | { readonly status: "accepted"; readonly graph: ConceptPrerequisiteGraph }
  | {
      readonly status: "rejected";
      readonly code: "INVALID_CONCEPT_GRAPH";
      readonly issues: readonly ConceptGraphIssue[];
    };

export type ConceptRefsQueryResult =
  | { readonly status: "found"; readonly conceptRefs: readonly ConceptRef[] }
  | { readonly status: "not-found"; readonly conceptRefs: readonly [] }
  | {
      readonly status: "rejected";
      readonly code: "INVALID_QUERY" | "UNKNOWN_CONCEPT" | "MAX_DEPTH_EXCEEDED";
      readonly conceptRefs: readonly [];
    };

export interface ConceptTraversalOptions {
  readonly maxDepth?: number;
}

const EMPTY_REFS = Object.freeze([]) as readonly [];
const VALIDATED_GRAPH_TOKEN: unique symbol = Symbol("validated-concept-graph");
const BOUNDARY_RANK: Readonly<Record<CrossContextBoundary, number>> = Object.freeze({
  unit: 1,
  course: 2,
  subject: 3,
});

function edgeKey(prerequisiteConceptRef: string, dependentConceptRef: string): string {
  return `${prerequisiteConceptRef}\u0000${dependentConceptRef}`;
}

function compareRefs(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function requiredBoundary(
  prerequisite: ConceptNode,
  dependent: ConceptNode,
): CrossContextBoundary | null {
  if (prerequisite.context.subjectRef !== dependent.context.subjectRef) return "subject";
  if (prerequisite.context.courseRef !== dependent.context.courseRef) return "course";
  if (prerequisite.context.unitRef !== dependent.context.unitRef) return "unit";
  return null;
}

function detectCycle(
  nodes: ReadonlyMap<ConceptRef, ConceptNode>,
  dependentsByPrerequisite: ReadonlyMap<ConceptRef, readonly ConceptRef[]>,
): readonly ConceptRef[] | null {
  const state = new Map<ConceptRef, "visiting" | "visited">();
  const stack: ConceptRef[] = [];
  const stackIndex = new Map<ConceptRef, number>();

  const visit = (conceptRef: ConceptRef): readonly ConceptRef[] | null => {
    state.set(conceptRef, "visiting");
    stackIndex.set(conceptRef, stack.length);
    stack.push(conceptRef);

    for (const dependentRef of dependentsByPrerequisite.get(conceptRef) ?? EMPTY_REFS) {
      const dependentState = state.get(dependentRef);
      if (dependentState === "visiting") {
        const start = stackIndex.get(dependentRef);
        if (start === undefined) return [dependentRef, dependentRef];
        return [...stack.slice(start), dependentRef];
      }
      if (dependentState !== "visited") {
        const cycle = visit(dependentRef);
        if (cycle !== null) return cycle;
      }
    }

    stack.pop();
    stackIndex.delete(conceptRef);
    state.set(conceptRef, "visited");
    return null;
  };

  for (const conceptRef of [...nodes.keys()].sort(compareRefs)) {
    if (state.has(conceptRef)) continue;
    const cycle = visit(conceptRef);
    if (cycle !== null) return cycle;
  }
  return null;
}

function makeAdjacency(
  nodes: ReadonlyMap<ConceptRef, ConceptNode>,
  edges: readonly ConceptPrerequisiteEdge[],
): {
  readonly prerequisites: ReadonlyMap<ConceptRef, readonly ConceptRef[]>;
  readonly dependents: ReadonlyMap<ConceptRef, readonly ConceptRef[]>;
} {
  const prerequisites = new Map<ConceptRef, ConceptRef[]>();
  const dependents = new Map<ConceptRef, ConceptRef[]>();
  for (const conceptRef of nodes.keys()) {
    prerequisites.set(conceptRef, []);
    dependents.set(conceptRef, []);
  }
  for (const edge of edges) {
    if (
      edge.prerequisiteConceptRef === edge.dependentConceptRef ||
      !nodes.has(edge.prerequisiteConceptRef) ||
      !nodes.has(edge.dependentConceptRef)
    ) {
      continue;
    }
    prerequisites.get(edge.dependentConceptRef)?.push(edge.prerequisiteConceptRef);
    dependents.get(edge.prerequisiteConceptRef)?.push(edge.dependentConceptRef);
  }
  for (const refs of prerequisites.values()) refs.sort(compareRefs);
  for (const refs of dependents.values()) refs.sort(compareRefs);
  return { prerequisites, dependents };
}

/** Validates the complete graph and never returns a partially usable graph. */
export function validateConceptGraph(input: unknown): ConceptGraphValidationResult {
  let contract: ExactValidationResult<ConceptGraph>;
  try {
    contract = validateExact(ConceptGraphSchema, input);
  } catch {
    return {
      status: "rejected",
      code: "INVALID_CONCEPT_GRAPH",
      issues: [
        {
          path: "$",
          code: "INVALID_GRAPH_CONTRACT",
          message: "Graph input could not be safely inspected.",
          conceptRefs: EMPTY_REFS,
        },
      ],
    };
  }
  if (contract.status === "rejected") {
    return {
      status: "rejected",
      code: "INVALID_CONCEPT_GRAPH",
      issues: contract.issues.map((issue) => ({
        path: issue.path,
        code: "INVALID_GRAPH_CONTRACT" as const,
        message: issue.message,
        conceptRefs: EMPTY_REFS,
      })),
    };
  }

  const graph = contract.value;
  const issues: ConceptGraphIssue[] = [];
  const nodes = new Map<ConceptRef, ConceptNode>();

  graph.nodes.forEach((node, index) => {
    if (nodes.has(node.conceptRef)) {
      issues.push({
        path: `$/nodes/${index}/conceptRef`,
        code: "DUPLICATE_CONCEPT_REF",
        message: "Concept refs must be unique.",
        conceptRefs: [node.conceptRef],
      });
      return;
    }
    nodes.set(node.conceptRef, node);
  });

  const seenEdges = new Set<string>();
  graph.edges.forEach((edge, index) => {
    const key = edgeKey(edge.prerequisiteConceptRef, edge.dependentConceptRef);
    const refs = [edge.prerequisiteConceptRef, edge.dependentConceptRef] as const;
    if (edge.prerequisiteConceptRef === edge.dependentConceptRef) {
      issues.push({
        path: `$/edges/${index}`,
        code: "SELF_EDGE",
        message: "A concept cannot be its own prerequisite.",
        conceptRefs: refs,
      });
    }
    if (seenEdges.has(key)) {
      issues.push({
        path: `$/edges/${index}`,
        code: "DUPLICATE_EDGE",
        message: "Prerequisite edges must be unique.",
        conceptRefs: refs,
      });
    } else {
      seenEdges.add(key);
    }
    if (!nodes.has(edge.prerequisiteConceptRef) || !nodes.has(edge.dependentConceptRef)) {
      issues.push({
        path: `$/edges/${index}`,
        code: "UNKNOWN_EDGE_NODE",
        message: "Every edge endpoint must reference a declared concept node.",
        conceptRefs: refs,
      });
    }
  });

  const admissionsByEdge = new Map<string, ConceptContextAdmission>();
  const seenAdmissionRefs = new Set<string>();
  graph.metadata.crossContextAdmissions.forEach((admission, index) => {
    const key = edgeKey(admission.prerequisiteConceptRef, admission.dependentConceptRef);
    const path = `$/metadata/crossContextAdmissions/${index}`;
    const refs = [admission.prerequisiteConceptRef, admission.dependentConceptRef] as const;
    if (seenAdmissionRefs.has(admission.admissionRef)) {
      issues.push({
        path: `${path}/admissionRef`,
        code: "DUPLICATE_ADMISSION_REF",
        message: "Context admission refs must be unique.",
        conceptRefs: refs,
      });
    } else {
      seenAdmissionRefs.add(admission.admissionRef);
    }
    if (admissionsByEdge.has(key)) {
      issues.push({
        path,
        code: "DUPLICATE_EDGE_ADMISSION",
        message: "An edge may have at most one context admission.",
        conceptRefs: refs,
      });
    } else {
      admissionsByEdge.set(key, admission);
    }
    if (!nodes.has(admission.prerequisiteConceptRef) || !nodes.has(admission.dependentConceptRef)) {
      issues.push({
        path,
        code: "UNKNOWN_ADMISSION_NODE",
        message: "Every admission endpoint must reference a declared concept node.",
        conceptRefs: refs,
      });
    }
    if (!seenEdges.has(key)) {
      issues.push({
        path,
        code: "ADMISSION_WITHOUT_EDGE",
        message: "A context admission must name an existing prerequisite edge.",
        conceptRefs: refs,
      });
    }
  });

  graph.edges.forEach((edge, index) => {
    const prerequisite = nodes.get(edge.prerequisiteConceptRef);
    const dependent = nodes.get(edge.dependentConceptRef);
    if (!prerequisite || !dependent) return;
    const boundary = requiredBoundary(prerequisite, dependent);
    if (boundary === null) return;
    const admission = admissionsByEdge.get(
      edgeKey(edge.prerequisiteConceptRef, edge.dependentConceptRef),
    );
    if (!admission || BOUNDARY_RANK[admission.maximumBoundary] < BOUNDARY_RANK[boundary]) {
      issues.push({
        path: `$/edges/${index}`,
        code: "UNAUTHORIZED_CROSS_CONTEXT_EDGE",
        message: `Cross-${boundary} prerequisite edge lacks sufficient explicit metadata admission.`,
        conceptRefs: [edge.prerequisiteConceptRef, edge.dependentConceptRef],
      });
    }
  });

  const adjacency = makeAdjacency(nodes, graph.edges);
  const selfCycle = graph.edges.find(
    (edge) =>
      edge.prerequisiteConceptRef === edge.dependentConceptRef &&
      nodes.has(edge.prerequisiteConceptRef),
  );
  const cycle = selfCycle
    ? [selfCycle.prerequisiteConceptRef, selfCycle.dependentConceptRef]
    : detectCycle(nodes, adjacency.dependents);
  if (cycle !== null) {
    issues.push({
      path: "$/edges",
      code: "CYCLE_DETECTED",
      message: "Prerequisite relationships must form a directed acyclic graph.",
      conceptRefs: cycle,
    });
  }

  if (issues.length > 0) {
    return { status: "rejected", code: "INVALID_CONCEPT_GRAPH", issues };
  }
  return { status: "accepted", graph };
}

function resolveMaxDepth(options: ConceptTraversalOptions | undefined): number | null {
  const maxDepth = options?.maxDepth ?? DEFAULT_CONCEPT_TRAVERSAL_DEPTH;
  if (
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 0 ||
    maxDepth > MAXIMUM_CONCEPT_TRAVERSAL_DEPTH
  ) {
    return null;
  }
  return maxDepth;
}

function rejectedQuery(
  code: "INVALID_QUERY" | "UNKNOWN_CONCEPT" | "MAX_DEPTH_EXCEEDED",
): ConceptRefsQueryResult {
  return { status: "rejected", code, conceptRefs: EMPTY_REFS };
}

function foundQuery(refs: readonly ConceptRef[]): ConceptRefsQueryResult {
  return { status: "found", conceptRefs: Object.freeze([...refs]) };
}

/**
 * Immutable, query-only graph. Construction is private so malformed input
 * cannot acquire graph query authority.
 */
export class ConceptPrerequisiteGraph {
  readonly #nodes: ReadonlyMap<ConceptRef, ConceptNode>;
  readonly #prerequisites: ReadonlyMap<ConceptRef, readonly ConceptRef[]>;
  readonly #dependents: ReadonlyMap<ConceptRef, readonly ConceptRef[]>;
  readonly #topologicalOrder: readonly ConceptRef[];

  private constructor(token: typeof VALIDATED_GRAPH_TOKEN, graph: ConceptGraph) {
    if (token !== VALIDATED_GRAPH_TOKEN) {
      throw new TypeError("Concept graphs must be constructed through the validation boundary.");
    }
    const nodes = new Map<ConceptRef, ConceptNode>();
    for (const node of graph.nodes) nodes.set(node.conceptRef, node);
    const adjacency = makeAdjacency(nodes, graph.edges);
    this.#nodes = nodes;
    this.#prerequisites = adjacency.prerequisites;
    this.#dependents = adjacency.dependents;
    this.#topologicalOrder = Object.freeze(this.computeTopologicalOrder());
  }

  static build(input: unknown): ConceptGraphBuildResult {
    const validation = validateConceptGraph(input);
    if (validation.status === "rejected") return validation;
    return {
      status: "accepted",
      graph: new ConceptPrerequisiteGraph(VALIDATED_GRAPH_TOKEN, validation.graph),
    };
  }

  /** Stable Kahn ordering: lexicographically smallest available ref wins. */
  private computeTopologicalOrder(): ConceptRef[] {
    const indegree = new Map<ConceptRef, number>();
    for (const conceptRef of this.#nodes.keys()) {
      indegree.set(conceptRef, this.#prerequisites.get(conceptRef)?.length ?? 0);
    }
    const available = [...this.#nodes.keys()]
      .filter((conceptRef) => indegree.get(conceptRef) === 0)
      .sort(compareRefs);
    const ordered: ConceptRef[] = [];
    while (available.length > 0) {
      const conceptRef = available.shift();
      if (conceptRef === undefined) break;
      ordered.push(conceptRef);
      for (const dependentRef of this.#dependents.get(conceptRef) ?? EMPTY_REFS) {
        const remaining = (indegree.get(dependentRef) ?? 0) - 1;
        indegree.set(dependentRef, remaining);
        if (remaining === 0) {
          available.push(dependentRef);
          available.sort(compareRefs);
        }
      }
    }
    return ordered;
  }

  topologicalOrder(): readonly ConceptRef[] {
    return this.#topologicalOrder;
  }

  directPrerequisites(conceptRef: ConceptRef): ConceptRefsQueryResult {
    if (validateExact(OpaqueReferenceSchema, conceptRef).status === "rejected") {
      return rejectedQuery("INVALID_QUERY");
    }
    if (!this.#nodes.has(conceptRef)) return rejectedQuery("UNKNOWN_CONCEPT");
    return foundQuery(this.#prerequisites.get(conceptRef) ?? EMPTY_REFS);
  }

  transitivePrerequisites(
    conceptRef: ConceptRef,
    options?: ConceptTraversalOptions,
  ): ConceptRefsQueryResult {
    if (validateExact(OpaqueReferenceSchema, conceptRef).status === "rejected") {
      return rejectedQuery("INVALID_QUERY");
    }
    if (!this.#nodes.has(conceptRef)) return rejectedQuery("UNKNOWN_CONCEPT");
    const maxDepth = resolveMaxDepth(options);
    if (maxDepth === null) return rejectedQuery("INVALID_QUERY");

    const visited = new Set<ConceptRef>();
    let frontier: ConceptRef[] = [conceptRef];
    for (let depth = 0; frontier.length > 0; depth += 1) {
      const next = new Set<ConceptRef>();
      for (const currentRef of frontier) {
        for (const prerequisiteRef of this.#prerequisites.get(currentRef) ?? EMPTY_REFS) {
          if (!visited.has(prerequisiteRef)) {
            visited.add(prerequisiteRef);
            next.add(prerequisiteRef);
          }
        }
      }
      if (next.size === 0) break;
      if (depth >= maxDepth) return rejectedQuery("MAX_DEPTH_EXCEEDED");
      frontier = [...next].sort(compareRefs);
    }
    return foundQuery(this.#topologicalOrder.filter((ref) => visited.has(ref)));
  }

  minimalPrerequisiteChain(
    dependentConceptRef: ConceptRef,
    prerequisiteConceptRef: ConceptRef,
    options?: ConceptTraversalOptions,
  ): ConceptRefsQueryResult {
    if (
      validateExact(OpaqueReferenceSchema, dependentConceptRef).status === "rejected" ||
      validateExact(OpaqueReferenceSchema, prerequisiteConceptRef).status === "rejected"
    ) {
      return rejectedQuery("INVALID_QUERY");
    }
    if (!this.#nodes.has(dependentConceptRef) || !this.#nodes.has(prerequisiteConceptRef)) {
      return rejectedQuery("UNKNOWN_CONCEPT");
    }
    if (dependentConceptRef === prerequisiteConceptRef) {
      return { status: "not-found", conceptRefs: EMPTY_REFS };
    }
    const maxDepth = resolveMaxDepth(options);
    if (maxDepth === null) return rejectedQuery("INVALID_QUERY");

    const visited = new Set<ConceptRef>([dependentConceptRef]);
    let frontier: Array<{ readonly ref: ConceptRef; readonly reversePath: readonly ConceptRef[] }> = [
      { ref: dependentConceptRef, reversePath: [dependentConceptRef] },
    ];

    for (let depth = 0; frontier.length > 0; depth += 1) {
      if (
        depth >= maxDepth &&
        frontier.some(
          (candidate) => (this.#prerequisites.get(candidate.ref)?.length ?? 0) > 0,
        )
      ) {
        return rejectedQuery("MAX_DEPTH_EXCEEDED");
      }
      const next: Array<{
        readonly ref: ConceptRef;
        readonly reversePath: readonly ConceptRef[];
      }> = [];
      for (const candidate of frontier) {
        for (const prerequisiteRef of this.#prerequisites.get(candidate.ref) ?? EMPTY_REFS) {
          if (visited.has(prerequisiteRef)) continue;
          const reversePath = [...candidate.reversePath, prerequisiteRef];
          if (prerequisiteRef === prerequisiteConceptRef) {
            return foundQuery(reversePath.reverse());
          }
          visited.add(prerequisiteRef);
          next.push({ ref: prerequisiteRef, reversePath });
        }
      }
      if (next.length === 0) {
        return { status: "not-found", conceptRefs: EMPTY_REFS };
      }
      next.sort((left, right) => compareRefs(left.ref, right.ref));
      frontier = next;
    }
    return { status: "not-found", conceptRefs: EMPTY_REFS };
  }

  /** Advisory lookup only; it returns opaque concept refs, never curriculum assignments. */
  findPrerequisiteRepairPath(
    dependentConceptRef: ConceptRef,
    prerequisiteConceptRef: ConceptRef,
    options?: ConceptTraversalOptions,
  ): ConceptRefsQueryResult {
    return this.minimalPrerequisiteChain(
      dependentConceptRef,
      prerequisiteConceptRef,
      options,
    );
  }
}

export function buildConceptGraph(input: unknown): ConceptGraphBuildResult {
  return ConceptPrerequisiteGraph.build(input);
}
