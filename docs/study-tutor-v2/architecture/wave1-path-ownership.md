# Wave 1 path ownership

## Authority and freeze rule

This adjudicated map is the authoritative Wave 1 merge-conflict boundary. It records the later explicit dispatch work orders that superseded the proposed directory locations in the original W1-01 map. The provenance and exact lane-delta evidence are recorded in [`wave1-path-ownership-adjudication-r1.md`](./wave1-path-ownership-adjudication-r1.md).

A session may add or edit only its listed paths. Directory ownership includes tests/fixtures beneath that directory. A path not listed here is unowned for Wave 1 and requires a later explicit work order. Ownership is narrow: a listed child namespace does not confer ownership over its parent or sibling namespaces.

No session may modify Tutor Core 0.2 implementation/contracts/schema semantics or Study Core Bridge 1.0.1 in place. W1-09 alone may make additive shared-barrel/package exposure for V2; it also owns generated V2 schemas and convergence artifacts. W1-10 is detached read-only review and owns no files.

## Exact adjudicated ownership

| Session | Owned paths | Required output boundary |
|---|---|---|
| W1-01 — Architecture Inventory + Authority Map | `docs/study-tutor-v2/architecture/**` | Original architecture and provenance documentation |
| W1-02 — Canonical Tutor V2 Contracts | `adaptive-tutor/core/v2/contracts/**` | Closed, provider-neutral contracts and contract-local tests/fixtures; no shared barrel edits |
| W1-03 — Provider Port | `adaptive-tutor/core/v2/providers/**` | Provider-neutral port, adapters, routing, local/testing providers, and provider-local tests |
| W1-04 — Authority Policy | `adaptive-tutor/core/v2/policy/authority/**`; `adaptive-tutor/core/v2/policy/grounding/**`; `adaptive-tutor/core/v2/policy/anti-answer/**`; `adaptive-tutor/core/v2/policy/refusal/**` | Authority, grounding, anti-answer, and refusal policy implementation/tests only; no ownership of unrelated future `policy/**` namespaces |
| W1-05 — Age Adaptation + Memory | `adaptive-tutor/core/v2/policy/age/**`; `adaptive-tutor/core/v2/memory/**` | Subject-neutral age/presentation policy plus ephemeral-memory implementation and tests |
| W1-06 — Evidence + Privacy | `adaptive-tutor/study-engine/tutor-v2/evidence/**`; `adaptive-tutor/study-engine/tutor-v2/privacy/**` | Study persistence/provider-context evidence projection, minimization, redaction/allowlists, and privacy tests |
| W1-07 — Evaluation Harness | `adaptive-tutor/evals/v2/framework/**`; `adaptive-tutor/evals/v2/corpus/foundation/**` | Evaluation framework and foundation corpus outside production Tutor Core |
| W1-08 — Study Bridge | `adaptive-tutor/study-engine/bridges/tutor-v2/**`; `adaptive-tutor/study-engine/tests/tutor-v2-bridge/**` | New additive V2 Study adapter and bridge-local tests; no production web imports |
| W1-09 — Wave 1 Convergence | `adaptive-tutor/core/v2/index.ts`; `adaptive-tutor/core/index.ts`; `adaptive-tutor/study-engine/tutor-v2/index.ts`; `adaptive-tutor/json-schema/v2/**`; `adaptive-tutor/scripts/tutor-v2/**`; `adaptive-tutor/tutor-v2-release/**`; `adaptive-tutor/tests/tutor-v2-convergence/**`; `adaptive-tutor/package.json`; `adaptive-tutor/MANIFEST.json`; `docs/study-tutor-v2/wave1/**` | Mechanical convergence, shared exports, generated V2 artifacts, release evidence, manifest/package exposure, and cross-slice verification only |
| W1-10 — Detached Review | none (read-only) | Review the exact W1-09 convergence SHA; no repairs in the review branch |

## Provenance and shared-artifact rules

1. W1-02 defines canonical contract source types but does not export them from `adaptive-tutor/core/index.ts` and does not generate shared JSON schemas.
2. W1-03 through W1-07 import W1-02 contracts by their owned source paths until W1-09 creates the shared V2 barrel.
3. Each parallel slice keeps its implementation, unit tests, fixtures, and internal barrel under only the adjudicated child namespaces listed above.
4. W1-08 owns only newly authored bridge implementation and bridge-test paths. Accepted W1-03 through W1-07 history imported during integration remains separately provenance-accounted and is not W1-08-authored source.
5. W1-08 may expose its own bridge-local `index.ts` because that file lies inside its directory. It may not edit a parent/shared barrel.
6. W1-09 may read all accepted Tutor V2 sources and performs mechanical convergence and cross-slice verification. It must not silently redesign accepted lane implementations, and it does not own W1-08's bridge implementation directory. A semantic defect returns to the owning session or is recorded as a blocker.
7. Existing `adaptive-tutor/json-schema/*.schema.json` files remain Tutor Core 0.2 history. All V2 generated schemas live under `adaptive-tutor/json-schema/v2/**`.
8. No Wave 1 session owns `src/**`, `netlify/**`, `supabase/**`, curriculum production or admitted release paths, database migrations, production configuration, deployment files, active release/security files, or hosted services.

## Non-overlap check

The W1-01 through W1-08 directory prefixes are mutually disjoint. W1-04 owns four named `policy` children and W1-05 owns the separate `policy/age` child; neither owns their shared `policy` parent. W1-06's two `study-engine/tutor-v2` children are disjoint from W1-08's `study-engine/bridges/tutor-v2` and `study-engine/tests/tutor-v2-bridge` trees. W1-07 is isolated under `evals/v2`.

W1-09's deliberate convergence files and directories are also disjoint from all lane ownership: `core/v2/index.ts` and `study-engine/tutor-v2/index.ts` are exact files adjacent to, not inside, lane-owned child directories; `core/index.ts`, the V2 schema/scripts/release/convergence-test trees, package/manifest files, and `docs/study-tutor-v2/wave1/**` are not owned by another session. W1-10 owns no paths. Therefore no path is assigned to more than one Wave 1 session.
