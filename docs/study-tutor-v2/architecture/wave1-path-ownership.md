# Wave 1 path ownership

## Freeze rule

This map is the Wave 1 merge-conflict boundary. A session may add or edit only its listed paths. Directory ownership includes tests/fixtures beneath that directory. A path not listed here is unowned for Wave 1 and requires a later explicit work order.

No session may modify Tutor Core 0.2 implementation/contracts/schema semantics or Study Core Bridge 1.0.1 in place. W1-09 alone may make additive shared-barrel/package exposure for V2; it also owns generated V2 schemas and convergence artifacts. W1-10 is detached read-only review and owns no files.

## Exact ownership

| Session | Owned paths | Required output boundary |
|---|---|---|
| W1-01 — Architecture Inventory + Authority Map | `docs/study-tutor-v2/architecture/**` | These eight architecture documents only |
| W1-02 — Canonical Tutor V2 Contracts | `adaptive-tutor/core/v2/contracts/**` | Closed, provider-neutral contracts and contract-local tests/fixtures; no shared barrel edits |
| W1-03 — Provider Port | `adaptive-tutor/core/v2/provider/**` | Provider-neutral port, candidate/result/failure adapters, minimized context, provider-local tests |
| W1-04 — Authority Policy | `adaptive-tutor/core/v2/policy/**` | Invocation, action, grounding, anti-answer, authority, safety-composition and fallback policy validators |
| W1-05 — Age Adaptation + Memory | `adaptive-tutor/core/v2/age/**`; `adaptive-tutor/core/v2/memory/**` | Subject-neutral age/presentation policy plus ephemeral-memory implementation and tests |
| W1-06 — Evidence + Privacy | `adaptive-tutor/core/v2/evidence/**`; `adaptive-tutor/core/v2/privacy/**` | Minimized evidence projection, redaction/allowlists, privacy contamination tests |
| W1-07 — Evaluation Harness | `adaptive-tutor/core/v2/evals/**` | Deterministic/adversarial contract, grounding, anti-answer, safety, privacy, provider-failure, and subject/age fixtures |
| W1-08 — Study Bridge | `adaptive-tutor/study-engine/bridges/tutor-v2/**` | Additive V2 Study adapter; one-way Study invocation/action validation; no production web imports |
| W1-09 — Wave 1 Convergence | `adaptive-tutor/core/v2/index.ts`; `adaptive-tutor/core/index.ts`; `adaptive-tutor/json-schema/v2/**`; `adaptive-tutor/MANIFEST.json`; `adaptive-tutor/package.json`; `adaptive-tutor/tests/tutor-v2-convergence/**` | Shared exports, generated common V2 artifacts, manifest/package exposure, cross-slice convergence tests only |
| W1-10 — Detached Review | none (read-only) | Review the exact W1-09 convergence SHA; no repairs in the review branch |

## Shared-artifact rules

1. W1-02 defines canonical contract source types but does not export them from `adaptive-tutor/core/index.ts` and does not generate shared JSON schemas.
2. W1-03 through W1-07 import W1-02 contracts by their owned source paths until W1-09 creates the shared V2 barrel.
3. Each parallel slice keeps its implementation, unit tests, fixtures, and internal barrel under its own directory.
4. W1-08 may expose its own bridge-local `index.ts` because that file lies inside its directory. It may not edit a parent/shared barrel.
5. W1-09 performs mechanical convergence and cross-slice verification; it must not silently redesign a slice contract. A semantic defect returns to the owning session or is recorded as a blocker.
6. Existing `adaptive-tutor/json-schema/*.schema.json` files remain Tutor Core 0.2 history. All V2 generated schemas live under `adaptive-tutor/json-schema/v2/**`.
7. No Wave 1 session owns `src/**`, `netlify/**`, database migrations, production configuration, deployment files, or hosted services.

## Non-overlap check

The owned directory prefixes are disjoint. The only parent/child relationship is the W1-09 root barrel `adaptive-tutor/core/v2/index.ts` beside, not inside, the W1-02–W1-07 owned directories. W1-09's `adaptive-tutor/core/index.ts`, package, manifest, schema output, and convergence tests are not owned by another session.
