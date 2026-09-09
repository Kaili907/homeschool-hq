import assert from "node:assert/strict";
import test from "node:test";
import {
  MAXIMUM_CONCEPT_TRAVERSAL_DEPTH,
  buildConceptGraph,
  validateConceptGraph,
  type ConceptContext,
  type ConceptGraph,
  type ConceptPrerequisiteEdge,
} from "./index.js";

const mathContext = {
  subjectRef: "subject:mathematics",
  courseRef: "course:generic-math",
  unitRef: "unit:foundations",
} as const satisfies ConceptContext;

const scienceContext = {
  subjectRef: "subject:science",
  courseRef: "course:generic-science",
  unitRef: "unit:observation",
} as const satisfies ConceptContext;

const languageContext = {
  subjectRef: "subject:language",
  courseRef: "course:generic-language",
  unitRef: "unit:communication",
} as const satisfies ConceptContext;

const artsContext = {
  subjectRef: "subject:arts",
  courseRef: "course:generic-arts",
  unitRef: "unit:composition",
} as const satisfies ConceptContext;

function node(conceptRef: string, context: ConceptContext = mathContext) {
  return { conceptRef, context };
}

function edge(
  prerequisiteConceptRef: string,
  dependentConceptRef: string,
): ConceptPrerequisiteEdge {
  return { prerequisiteConceptRef, dependentConceptRef };
}

function fixture(
  refs: readonly string[],
  edges: readonly ConceptPrerequisiteEdge[],
  options: {
    readonly contexts?: Readonly<Record<string, ConceptContext>>;
    readonly admissions?: ConceptGraph["metadata"]["crossContextAdmissions"];
  } = {},
): ConceptGraph {
  return {
    graphRef: "concept-graph:generic-fixture",
    version: "1.0.0",
    nodes: refs.map((ref) => node(ref, options.contexts?.[ref] ?? mathContext)),
    edges: [...edges],
    metadata: { crossContextAdmissions: options.admissions ?? [] },
  };
}

function acceptedGraph(input: unknown) {
  const result = buildConceptGraph(input);
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") throw new Error("Expected accepted graph fixture.");
  return result.graph;
}

function issueCodes(input: unknown): readonly string[] {
  const result = validateConceptGraph(input);
  assert.equal(result.status, "rejected");
  if (result.status !== "rejected") return [];
  return result.issues.map((issue) => issue.code);
}

test("simple chain returns direct, transitive, and minimal prerequisite refs", () => {
  const graph = acceptedGraph(
    fixture(
      ["concept:observe", "concept:classify", "concept:explain"],
      [edge("concept:observe", "concept:classify"), edge("concept:classify", "concept:explain")],
    ),
  );

  assert.deepEqual(graph.topologicalOrder(), [
    "concept:observe",
    "concept:classify",
    "concept:explain",
  ]);
  assert.deepEqual(graph.directPrerequisites("concept:explain"), {
    status: "found",
    conceptRefs: ["concept:classify"],
  });
  assert.deepEqual(graph.transitivePrerequisites("concept:explain"), {
    status: "found",
    conceptRefs: ["concept:observe", "concept:classify"],
  });
  assert.deepEqual(
    graph.findPrerequisiteRepairPath("concept:explain", "concept:observe"),
    {
      status: "found",
      conceptRefs: ["concept:observe", "concept:classify", "concept:explain"],
    },
  );
});

test("diamond graph chooses a deterministic minimal prerequisite chain", () => {
  const graph = acceptedGraph(
    fixture(
      ["concept:source", "concept:branch-b", "concept:branch-c", "concept:target"],
      [
        edge("concept:source", "concept:branch-c"),
        edge("concept:branch-c", "concept:target"),
        edge("concept:source", "concept:branch-b"),
        edge("concept:branch-b", "concept:target"),
      ],
    ),
  );

  assert.deepEqual(graph.directPrerequisites("concept:target"), {
    status: "found",
    conceptRefs: ["concept:branch-b", "concept:branch-c"],
  });
  assert.deepEqual(graph.findPrerequisiteRepairPath("concept:target", "concept:source"), {
    status: "found",
    conceptRefs: ["concept:source", "concept:branch-b", "concept:target"],
  });
});

test("multiple prerequisites are returned in deterministic ref order", () => {
  const refs = ["concept:compose", "concept:rhythm", "concept:tone", "concept:notation"];
  const graph = acceptedGraph(
    fixture(
      refs,
      [
        edge("concept:tone", "concept:compose"),
        edge("concept:notation", "concept:compose"),
        edge("concept:rhythm", "concept:compose"),
      ],
      { contexts: Object.fromEntries(refs.map((ref) => [ref, artsContext])) },
    ),
  );
  assert.deepEqual(graph.directPrerequisites("concept:compose"), {
    status: "found",
    conceptRefs: ["concept:notation", "concept:rhythm", "concept:tone"],
  });
});

test("cycle is detected and no query graph is returned", () => {
  const input = fixture(
    ["concept:a", "concept:b", "concept:c"],
    [edge("concept:a", "concept:b"), edge("concept:b", "concept:c"), edge("concept:c", "concept:a")],
  );
  assert.ok(issueCodes(input).includes("CYCLE_DETECTED"));
  assert.equal(buildConceptGraph(input).status, "rejected");
});

test("self-cycle is rejected as a self-edge and a cycle", () => {
  const input = fixture(["concept:self"], [edge("concept:self", "concept:self")]);
  const codes = issueCodes(input);
  assert.ok(codes.includes("SELF_EDGE"));
  assert.ok(codes.includes("CYCLE_DETECTED"));
});

test("disconnected subject-neutral nodes remain deterministically ordered", () => {
  const input = fixture(
    ["concept:write", "concept:measure", "concept:observe"],
    [],
    {
      contexts: {
        "concept:write": languageContext,
        "concept:measure": mathContext,
        "concept:observe": scienceContext,
      },
    },
  );
  assert.deepEqual(acceptedGraph(input).topologicalOrder(), [
    "concept:measure",
    "concept:observe",
    "concept:write",
  ]);
});

test("edge with a missing node is rejected", () => {
  const input = fixture(
    ["concept:declared"],
    [edge("concept:missing", "concept:declared")],
  );
  assert.ok(issueCodes(input).includes("UNKNOWN_EDGE_NODE"));
});

test("duplicate concept ref is rejected", () => {
  const input = fixture(["concept:repeat", "concept:repeat"], []);
  assert.ok(issueCodes(input).includes("DUPLICATE_CONCEPT_REF"));
});

test("duplicate prerequisite edge is rejected", () => {
  const duplicate = edge("concept:foundation", "concept:application");
  const input = fixture(
    ["concept:foundation", "concept:application"],
    [duplicate, duplicate],
  );
  assert.ok(issueCodes(input).includes("DUPLICATE_EDGE"));
});

test("topological and prerequisite ordering do not depend on input order", () => {
  const refs = ["concept:a", "concept:b", "concept:c", "concept:d"];
  const edges = [
    edge("concept:a", "concept:c"),
    edge("concept:b", "concept:c"),
    edge("concept:c", "concept:d"),
  ];
  const first = acceptedGraph(fixture(refs, edges));
  const second = acceptedGraph(fixture([...refs].reverse(), [...edges].reverse()));

  assert.deepEqual(first.topologicalOrder(), second.topologicalOrder());
  assert.deepEqual(
    first.transitivePrerequisites("concept:d"),
    second.transitivePrerequisites("concept:d"),
  );
  assert.deepEqual(
    first.findPrerequisiteRepairPath("concept:d", "concept:a"),
    second.findPrerequisiteRepairPath("concept:d", "concept:a"),
  );
});

test("max-depth protection rejects partial traversal results", () => {
  const graph = acceptedGraph(
    fixture(
      ["concept:a", "concept:b", "concept:c", "concept:d"],
      [
        edge("concept:a", "concept:b"),
        edge("concept:b", "concept:c"),
        edge("concept:c", "concept:d"),
      ],
    ),
  );
  assert.deepEqual(graph.transitivePrerequisites("concept:d", { maxDepth: 2 }), {
    status: "rejected",
    code: "MAX_DEPTH_EXCEEDED",
    conceptRefs: [],
  });
  assert.deepEqual(
    graph.findPrerequisiteRepairPath("concept:d", "concept:a", { maxDepth: 2 }),
    { status: "rejected", code: "MAX_DEPTH_EXCEEDED", conceptRefs: [] },
  );
  assert.deepEqual(graph.transitivePrerequisites("concept:d", { maxDepth: 3 }), {
    status: "found",
    conceptRefs: ["concept:a", "concept:b", "concept:c"],
  });
  assert.deepEqual(
    graph.transitivePrerequisites("concept:d", {
      maxDepth: MAXIMUM_CONCEPT_TRAVERSAL_DEPTH + 1,
    }),
    { status: "rejected", code: "INVALID_QUERY", conceptRefs: [] },
  );
});

test("explicit metadata admits an exact cross-unit relationship", () => {
  const prerequisiteRef = "concept:recognize-pattern";
  const dependentRef = "concept:apply-pattern";
  const input = fixture(
    [prerequisiteRef, dependentRef],
    [edge(prerequisiteRef, dependentRef)],
    {
      contexts: {
        [prerequisiteRef]: mathContext,
        [dependentRef]: { ...mathContext, unitRef: "unit:applications" },
      },
      admissions: [
        {
          admissionRef: "context-admission:pattern-units",
          prerequisiteConceptRef: prerequisiteRef,
          dependentConceptRef: dependentRef,
          maximumBoundary: "unit",
        },
      ],
    },
  );
  assert.equal(buildConceptGraph(input).status, "accepted");
});

test("explicit metadata can admit exact cross-course and cross-subject relationships", () => {
  const prerequisiteRef = "concept:interpret-evidence";
  const dependentRef = "concept:communicate-evidence";
  const relationship = edge(prerequisiteRef, dependentRef);
  const admissionBase = {
    admissionRef: "context-admission:evidence-transfer",
    prerequisiteConceptRef: prerequisiteRef,
    dependentConceptRef: dependentRef,
  } as const;
  const crossCourse = fixture([prerequisiteRef, dependentRef], [relationship], {
    contexts: {
      [prerequisiteRef]: languageContext,
      [dependentRef]: { ...languageContext, courseRef: "course:advanced-language" },
    },
    admissions: [{ ...admissionBase, maximumBoundary: "course" }],
  });
  const crossSubject = fixture([prerequisiteRef, dependentRef], [relationship], {
    contexts: {
      [prerequisiteRef]: languageContext,
      [dependentRef]: scienceContext,
    },
    admissions: [{ ...admissionBase, maximumBoundary: "subject" }],
  });

  assert.equal(buildConceptGraph(crossCourse).status, "accepted");
  assert.equal(buildConceptGraph(crossSubject).status, "accepted");
});

test("unauthorized cross-course and cross-subject relationships are rejected", () => {
  const prerequisiteRef = "concept:read-source";
  const dependentRef = "concept:evaluate-source";
  const crossCourse = fixture(
    [prerequisiteRef, dependentRef],
    [edge(prerequisiteRef, dependentRef)],
    {
      contexts: {
        [prerequisiteRef]: languageContext,
        [dependentRef]: { ...languageContext, courseRef: "course:advanced-language" },
      },
    },
  );
  const crossSubject = fixture(
    [prerequisiteRef, dependentRef],
    [edge(prerequisiteRef, dependentRef)],
    {
      contexts: {
        [prerequisiteRef]: languageContext,
        [dependentRef]: scienceContext,
      },
      admissions: [
        {
          admissionRef: "context-admission:insufficient-course-only",
          prerequisiteConceptRef: prerequisiteRef,
          dependentConceptRef: dependentRef,
          maximumBoundary: "course",
        },
      ],
    },
  );

  assert.ok(issueCodes(crossCourse).includes("UNAUTHORIZED_CROSS_CONTEXT_EDGE"));
  assert.ok(issueCodes(crossSubject).includes("UNAUTHORIZED_CROSS_CONTEXT_EDGE"));
});

test("admission metadata must name a real edge and unique admission refs", () => {
  const input = fixture(["concept:a", "concept:b", "concept:c"], [edge("concept:a", "concept:b")], {
    admissions: [
      {
        admissionRef: "context-admission:duplicate",
        prerequisiteConceptRef: "concept:a",
        dependentConceptRef: "concept:c",
        maximumBoundary: "unit",
      },
      {
        admissionRef: "context-admission:duplicate",
        prerequisiteConceptRef: "concept:b",
        dependentConceptRef: "concept:c",
        maximumBoundary: "unit",
      },
    ],
  });
  const codes = issueCodes(input);
  assert.ok(codes.includes("ADMISSION_WITHOUT_EDGE"));
  assert.ok(codes.includes("DUPLICATE_ADMISSION_REF"));
});

test("unknown and malformed query refs fail closed", () => {
  const graph = acceptedGraph(fixture(["concept:known"], []));
  assert.deepEqual(graph.directPrerequisites("concept:unknown"), {
    status: "rejected",
    code: "UNKNOWN_CONCEPT",
    conceptRefs: [],
  });
  assert.deepEqual(graph.directPrerequisites("not-an-opaque-ref"), {
    status: "rejected",
    code: "INVALID_QUERY",
    conceptRefs: [],
  });
});

test("malformed graph and learner data fields fail closed", () => {
  const withLearnerIdentity = {
    ...fixture(["concept:safe"], []),
    learnerRef: "learner:private",
  };
  assert.ok(issueCodes(withLearnerIdentity).includes("INVALID_GRAPH_CONTRACT"));

  const cyclic: Record<string, unknown> = { graphRef: "concept-graph:cyclic-input" };
  cyclic.self = cyclic;
  assert.ok(issueCodes(cyclic).includes("INVALID_GRAPH_CONTRACT"));

  const hostile = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error("hostile reflection");
      },
    },
  );
  assert.doesNotThrow(() => validateConceptGraph(hostile));
  assert.ok(issueCodes(hostile).includes("INVALID_GRAPH_CONTRACT"));
});
