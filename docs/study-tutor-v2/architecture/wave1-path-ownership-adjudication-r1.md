# Wave 1 path ownership adjudication R1

## Decision

This document resolves a dispatch-level path-ownership provenance conflict in Wave 1. Later explicit dispatch work orders superseded the earlier proposed directory locations recorded by W1-01. The accepted lane commits followed those later assignments; the frozen W1-01 ownership document did not yet reflect them.

This adjudication makes the accepted lane paths authoritative Wave 1 ownership and authorizes W1-08 to treat those paths as valid when integrating the accepted W1-03 through W1-07 history. It does not rewrite, amend, rebase, merge, or otherwise change an accepted implementation commit.

This is a provenance correction, not semantic acceptance of unreviewed code. Each implementation still requires the review and convergence gates assigned by its work order.

## Immutable provenance

| Role | Session | Exact SHA |
|---|---|---|
| Original architecture and proposed ownership map | W1-01 | `9e30d59f64184e89db493a004e738e859b06a686` |
| Required common base | W1-02 | `660de6a445ca66b8de5136a6ee388804346dce4b` |
| Accepted Provider Port | W1-03 | `ee6cc83fdaa43fe733d05abefdaedffe3d0febf9` |
| Accepted Authority / Grounding / Anti-Answer | W1-04 | `befb91bb2321aec0449d2d8e613619a592feb76c` |
| Accepted Age Policy / Memory | W1-05 | `4a8bded7bc0caf5ff647dae814e011d20c8ae5bf` |
| Accepted Evidence / Privacy | W1-06 | `b93765552d60a88ac7691ca7840dfc2ae3a23e77` |
| Accepted Evaluation Harness | W1-07 | `9b959ab7e8176ebccb4fd3ca7b54bf5584602b35` |

After `git fetch origin --prune`, the canonical `origin/mac/tutor-v2-w1-*` refs for W1-03 through W1-07 resolved to the accepted SHAs above. Each accepted commit still has exact W1-02 SHA `660de6a445ca66b8de5136a6ee388804346dce4b` as its sole direct parent. No accepted implementation commit was rewritten.

## Original W1-01 proposed ownership

At W1-01 SHA `9e30d59f64184e89db493a004e738e859b06a686`, `wave1-path-ownership.md` proposed:

| Session | Original owned paths |
|---|---|
| W1-01 | `docs/study-tutor-v2/architecture/**` |
| W1-02 | `adaptive-tutor/core/v2/contracts/**` |
| W1-03 | `adaptive-tutor/core/v2/provider/**` |
| W1-04 | `adaptive-tutor/core/v2/policy/**` |
| W1-05 | `adaptive-tutor/core/v2/age/**`; `adaptive-tutor/core/v2/memory/**` |
| W1-06 | `adaptive-tutor/core/v2/evidence/**`; `adaptive-tutor/core/v2/privacy/**` |
| W1-07 | `adaptive-tutor/core/v2/evals/**` |
| W1-08 | `adaptive-tutor/study-engine/bridges/tutor-v2/**` |
| W1-09 | `adaptive-tutor/core/v2/index.ts`; `adaptive-tutor/core/index.ts`; `adaptive-tutor/json-schema/v2/**`; `adaptive-tutor/MANIFEST.json`; `adaptive-tutor/package.json`; `adaptive-tutor/tests/tutor-v2-convergence/**` |
| W1-10 | none (read-only) |

Those paths are preserved here as historical proposals. They are not retroactively presented as the locations used by the accepted lane commits.

## Adjudicated authoritative ownership

| Session | Authoritative owned paths | Reason for ruling |
|---|---|---|
| W1-01 | `docs/study-tutor-v2/architecture/**` | Retains ownership of original architecture and provenance documentation. |
| W1-02 | `adaptive-tutor/core/v2/contracts/**` | Unchanged canonical V2 contract boundary. |
| W1-03 | `adaptive-tutor/core/v2/providers/**` | Supersedes singular `provider/**`; the later Provider Port dispatch and accepted implementation use the plural `providers` namespace. |
| W1-04 | `adaptive-tutor/core/v2/policy/authority/**`; `adaptive-tutor/core/v2/policy/grounding/**`; `adaptive-tutor/core/v2/policy/anti-answer/**`; `adaptive-tutor/core/v2/policy/refusal/**` | Narrows the original broad `policy/**` proposal to the four policy namespaces actually assigned by the later dispatch and present in the accepted delta; unrelated future policy namespaces are excluded. |
| W1-05 | `adaptive-tutor/core/v2/policy/age/**`; `adaptive-tutor/core/v2/memory/**` | Supersedes `core/v2/age/**`; the later dispatch placed age adaptation under the policy namespace while retaining the memory boundary. |
| W1-06 | `adaptive-tutor/study-engine/tutor-v2/evidence/**`; `adaptive-tutor/study-engine/tutor-v2/privacy/**` | Supersedes the proposed Tutor-Core locations because the later dispatch classified evidence persistence and minimized provider context as Study-side boundaries rather than generic Tutor-Core primitives. |
| W1-07 | `adaptive-tutor/evals/v2/framework/**`; `adaptive-tutor/evals/v2/corpus/foundation/**` | Supersedes `core/v2/evals/**`; the later dispatch intentionally isolated evaluation tooling and its foundation corpus from production Tutor Core. |
| W1-08 | `adaptive-tutor/study-engine/bridges/tutor-v2/**`; `adaptive-tutor/study-engine/tests/tutor-v2-bridge/**` | Owns only new bridge implementation and bridge tests. Imported accepted W1-03 through W1-07 history remains separately provenance-accounted and is not W1-08-authored source. |
| W1-09 | `adaptive-tutor/core/v2/index.ts`; `adaptive-tutor/core/index.ts`; `adaptive-tutor/study-engine/tutor-v2/index.ts`; `adaptive-tutor/json-schema/v2/**`; `adaptive-tutor/scripts/tutor-v2/**`; `adaptive-tutor/tutor-v2-release/**`; `adaptive-tutor/tests/tutor-v2-convergence/**`; `adaptive-tutor/package.json`; `adaptive-tutor/MANIFEST.json`; `docs/study-tutor-v2/wave1/**` | Convergence-only ownership for exact shared barrels, generated schemas, scripts, release evidence, convergence tests, package/manifest exposure, and Wave 1 records. It may read all accepted Tutor V2 sources but may not redesign them or own W1-08's bridge directory. |
| W1-10 | none | Detached read-only review. |

## Exact accepted-lane delta evidence

The following is the exact output of `git diff --name-only 660de6a445ca66b8de5136a6ee388804346dce4b..<LANE_SHA>` after resolving and verifying each accepted SHA.

### W1-03 — `ee6cc83fdaa43fe733d05abefdaedffe3d0febf9`

```text
adaptive-tutor/core/v2/providers/local/deterministic-local-provider.ts
adaptive-tutor/core/v2/providers/local/index.ts
adaptive-tutor/core/v2/providers/ports/BOUNDARIES.md
adaptive-tutor/core/v2/providers/ports/adapter.ts
adaptive-tutor/core/v2/providers/ports/contracts.ts
adaptive-tutor/core/v2/providers/ports/index.ts
adaptive-tutor/core/v2/providers/ports/parser.ts
adaptive-tutor/core/v2/providers/ports/routing.ts
adaptive-tutor/core/v2/providers/ports/transport.ts
adaptive-tutor/core/v2/providers/testing/index.ts
adaptive-tutor/core/v2/providers/testing/provider-port.test.ts
adaptive-tutor/core/v2/providers/testing/scripted-provider.ts
```

Ruling: every changed path is under `adaptive-tutor/core/v2/providers/**`; W1-03 passes the amended ownership rule.

### W1-04 — `befb91bb2321aec0449d2d8e613619a592feb76c`

```text
adaptive-tutor/core/v2/policy/anti-answer/LIMITATIONS.md
adaptive-tutor/core/v2/policy/anti-answer/anti-answer.test.ts
adaptive-tutor/core/v2/policy/anti-answer/index.ts
adaptive-tutor/core/v2/policy/authority/authority.test.ts
adaptive-tutor/core/v2/policy/authority/index.ts
adaptive-tutor/core/v2/policy/grounding/grounding.test.ts
adaptive-tutor/core/v2/policy/grounding/index.ts
adaptive-tutor/core/v2/policy/refusal/index.ts
adaptive-tutor/core/v2/policy/refusal/refusal.test.ts
adaptive-tutor/core/v2/policy/refusal/test-support.ts
```

Ruling: every changed path is under one of the four named W1-04 policy children; W1-04 passes without receiving ownership of the broad `policy/**` parent.

### W1-05 — `4a8bded7bc0caf5ff647dae814e011d20c8ae5bf`

```text
adaptive-tutor/core/v2/memory/README.md
adaptive-tutor/core/v2/memory/index.ts
adaptive-tutor/core/v2/memory/session-memory.test.ts
adaptive-tutor/core/v2/memory/session-memory.ts
adaptive-tutor/core/v2/policy/age/README.md
adaptive-tutor/core/v2/policy/age/index.ts
adaptive-tutor/core/v2/policy/age/profile.test.ts
adaptive-tutor/core/v2/policy/age/profile.ts
```

Ruling: every changed path is under `core/v2/policy/age/**` or `core/v2/memory/**`; W1-05 passes the amended ownership rule.

### W1-06 — `b93765552d60a88ac7691ca7840dfc2ae3a23e77`

```text
adaptive-tutor/study-engine/tutor-v2/evidence/index.ts
adaptive-tutor/study-engine/tutor-v2/evidence/tutor-evidence.test.ts
adaptive-tutor/study-engine/tutor-v2/evidence/tutor-evidence.ts
adaptive-tutor/study-engine/tutor-v2/privacy/index.ts
adaptive-tutor/study-engine/tutor-v2/privacy/provider-context.test.ts
adaptive-tutor/study-engine/tutor-v2/privacy/provider-context.ts
adaptive-tutor/study-engine/tutor-v2/privacy/tsconfig.json
```

Ruling: every changed path is under the two named Study-side Tutor V2 children; W1-06 passes the amended ownership rule.

### W1-07 — `9b959ab7e8176ebccb4fd3ca7b54bf5584602b35`

```text
adaptive-tutor/evals/v2/corpus/foundation/README.md
adaptive-tutor/evals/v2/corpus/foundation/index.ts
adaptive-tutor/evals/v2/corpus/foundation/scenarios.ts
adaptive-tutor/evals/v2/framework/.gitignore
adaptive-tutor/evals/v2/framework/README.md
adaptive-tutor/evals/v2/framework/package.json
adaptive-tutor/evals/v2/framework/src/cli.ts
adaptive-tutor/evals/v2/framework/src/definition.ts
adaptive-tutor/evals/v2/framework/src/evaluator.ts
adaptive-tutor/evals/v2/framework/src/index.ts
adaptive-tutor/evals/v2/framework/src/reporters.ts
adaptive-tutor/evals/v2/framework/src/runner.ts
adaptive-tutor/evals/v2/framework/src/types.ts
adaptive-tutor/evals/v2/framework/tests/harness.test.ts
adaptive-tutor/evals/v2/framework/tsconfig.json
```

Ruling: every changed path is under `evals/v2/framework/**` or `evals/v2/corpus/foundation/**`; W1-07 passes the amended ownership rule.

## Updated non-overlap proof

The accepted lane path sets are pairwise disjoint:

- W1-03 is rooted at `core/v2/providers`.
- W1-04 is limited to four named children of `core/v2/policy`.
- W1-05 uses the separate `core/v2/policy/age` child and `core/v2/memory`.
- W1-06 is limited to the `study-engine/tutor-v2/evidence` and `study-engine/tutor-v2/privacy` children.
- W1-07 is limited to `evals/v2/framework` and `evals/v2/corpus/foundation`.
- W1-08 uses the separate `study-engine/bridges/tutor-v2` and `study-engine/tests/tutor-v2-bridge` trees.

No W1-03 through W1-08 prefix is equal to or a parent/child of another lane prefix. W1-09's deliberate convergence paths do not create shared ownership: its exact `core/v2/index.ts` and `study-engine/tutor-v2/index.ts` files are siblings of lane-owned child directories, and its other exact files/directories are outside all lane prefixes. W1-01's `docs/study-tutor-v2/architecture/**` and W1-09's `docs/study-tutor-v2/wave1/**` are sibling documentation trees. W1-10 owns nothing. Therefore the amended ownership map assigns no path to more than one session.

No Wave 1 session receives ownership of `src/**`, `netlify/**`, `supabase/**`, curriculum production, curriculum admitted release, deployment files, active release/security files, or hosted services.

## Isolation and immutability ruling

This adjudication modified only Tutor V2 architecture/provenance documentation on `mac/tutor-v2-w1-ownership-adjudication-r1`. It did not modify, advance, merge into, rebase, or replace `master`, any learner-release line, web-security line, Netlify-release line, hosted-sync line, or security-hardening branch. No production/release/security branch was modified, no deployment was performed, and no hosted Supabase service was contacted.

The accepted W1-03 through W1-07 commit objects and their file trees remain unchanged at the exact SHAs recorded above. The shared exact W1-02 ancestry remains unchanged. This adjudication changes documentation of ownership provenance only.
