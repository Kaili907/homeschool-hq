# W2-02 Subject-Neutral Concept Graph

## Contract

`ConceptGraphSchema` is the closed input contract. A graph contains:

- an opaque graph ref and semantic version;
- concept nodes identified only by opaque `conceptRef` values;
- separate opaque subject, course, and unit context refs for each node;
- directed prerequisite edges from `prerequisiteConceptRef` to
  `dependentConceptRef`; and
- edge-specific cross-context admissions in graph metadata.

Concept refs are never parsed for subject, course, grade, sequence, or learner
meaning. The graph carries no learner identity, attempts, responses, grades,
mastery state, working level, or lesson assignment. Closed schemas reject those
fields.

`buildConceptGraph(unknown)` is the only construction boundary. It returns a
query-only `ConceptPrerequisiteGraph` only after the whole graph passes contract,
identity, edge, context, and acyclicity validation. Rejection returns structured
issues and no partial graph.

## Validation and cycle ruling

Validation rejects:

- malformed or non-JSON-safe graph values;
- duplicate concept refs;
- unknown edge endpoints;
- self-edges;
- duplicate directed edges;
- invalid, duplicate, orphaned, or unknown-node admissions;
- context crossings without sufficient exact-edge admission; and
- every directed cycle, including self-cycles.

Cycle detection and all diagnostics use opaque refs. A cycle makes the complete
graph unavailable for queries.

## Deterministic queries

The query surface is read-only:

- `topologicalOrder()` uses Kahn ordering with the lexicographically smallest
  available opaque ref first.
- `directPrerequisites(ref)` returns lexicographically sorted direct refs.
- `transitivePrerequisites(ref, options)` returns the ancestor set in stable
  topological order.
- `minimalPrerequisiteChain(dependentRef, prerequisiteRef, options)` performs
  deterministic breadth-first search and returns the shortest chain from the
  prerequisite through the dependent. Lexicographic ref order resolves equal
  paths.
- `findPrerequisiteRepairPath(...)` is the advisory alias for the minimal chain
  query and returns only opaque concept refs.

Queries never return node metadata or learner data. Unknown or malformed refs
are rejected. A disconnected but known concept has an empty prerequisite result;
a requested relationship that does not exist returns `not-found`.

## Traversal bounds

Transitive and path queries default to 32 edges and accept an explicit bound
from 0 through 64. If the bound prevents a complete answer, the query rejects
with `MAX_DEPTH_EXCEEDED` and an empty ref list. It never returns a partial
repair chain or partial transitive set. Invalid bounds fail closed with
`INVALID_QUERY`.

Graph inputs are also bounded to 1,000 nodes, 1,000 edges, and 1,000 context
admissions.

## Context admission

Same-unit edges require no admission. Every exact edge that crosses unit,
course, or subject context requires metadata with a `maximumBoundary` at least
as broad as the crossing:

- `unit`: another unit in the same course and subject;
- `course`: another course in the same subject; or
- `subject`: another subject.

Admissions do not apply by pattern or transitively. They identify one exact
prerequisite/dependent edge and use an opaque admission ref. This prevents an
authorized relationship from silently widening the rest of the graph.

## Authority boundary

The graph informs Tutor recommendations only. It cannot:

- assign or reorder curriculum or lessons;
- change a grade or working level;
- decide, declare, or persist mastery;
- mutate Study sequencing; or
- cross context without graph metadata explicitly admitting the exact edge.

Consumers remain responsible for Study authority, learner evidence, and the
decision whether to act on an advisory repair path.

## Fixture coverage

The focused test suite covers simple chains, diamonds, multiple prerequisites,
cycles, self-cycles, disconnected multi-subject graphs, missing nodes, duplicate
refs and edges, deterministic ordering under permuted input, maximum-depth
protection, admitted cross-unit edges, rejected unauthorized cross-course and
cross-subject edges, admission integrity, unknown queries, malformed graphs, and
learner-field rejection. Fixtures use generic mathematics, science, language,
and arts concepts; no subject-specific algorithm is present.
