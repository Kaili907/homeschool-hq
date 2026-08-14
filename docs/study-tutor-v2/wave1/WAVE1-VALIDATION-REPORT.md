# Manuel Academy Study Tutor V2 — Wave 1 Validation Report

## Validation identity

- Validation time: 2026-08-14 10:38:46 EDT (-0400)
- Runtime: Node 22.23.2
- Session: STUDY-TUTOR-V2-W1-09 — Wave 1 Canonical Convergence + Foundation Release Gate
- Worktree: `/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/tutor-v2-w1-09-convergence-r1`
- Branch: `mac/tutor-v2-w1-convergence-r1`
- Starting W1-08 SHA: `31d5609527f75a11d9d3017ce0f07b3ec1c99b88`
- Final W1-09 SHA: intentionally recorded after commit in the session return; it is not self-referenced by a checksummed artifact.

## Immutable provenance

| Input | Exact SHA | Verification |
|---|---|---|
| Immutable learner baseline | `7baf8dfbc27168708ed4cf504285a1838d7345f6` | Ancestor; unchanged integration baseline |
| W1-01 architecture | `9e30d59f64184e89db493a004e738e859b06a686` | Canonical remote tip exact |
| W1-02 contracts | `660de6a445ca66b8de5136a6ee388804346dce4b` | Canonical remote tip, ancestry, and contract tree exact |
| Ownership adjudication | `f79271ac2cc57e9128ee61774a4f082c35c6fa77` | Canonical remote tip, ancestry, and architecture tree exact |
| W1-03 provider port | `ee6cc83fdaa43fe733d05abefdaedffe3d0febf9` | Accepted tree and stable patch ID exact |
| W1-04 authority policy | `befb91bb2321aec0449d2d8e613619a592feb76c` | Accepted tree and stable patch ID exact |
| W1-05 age/memory | `4a8bded7bc0caf5ff647dae814e011d20c8ae5bf` | Accepted tree and stable patch ID exact |
| W1-06 evidence/privacy | `b93765552d60a88ac7691ca7840dfc2ae3a23e77` | Accepted tree and stable patch ID exact |
| W1-07 evaluation harness | `9b959ab7e8176ebccb4fd3ca7b54bf5584602b35` | Accepted tree and stable patch ID exact |
| W1-08 Study bridge | `31d5609527f75a11d9d3017ce0f07b3ec1c99b88` | Canonical remote tip exact; bridge delta isolated |

W1-03 through W1-07 were imported into W1-08 as commits `4cf4bda1`, `7a1a12cf`, `c7156bc3`, `42c91482`, and `5a6a191c`. Their stable patch IDs match the original accepted lane commits byte-for-byte, and `git diff --quiet <accepted SHA> HEAD -- <lane paths>` passed for every lane. W1-08 changed only its bridge and bridge-test paths after those imports. No accepted W1-02 through W1-08 source file was re-authored by W1-09.

## Architecture and authority

There is one Study Engine and one supported Tutor V2 orchestration implementation: W1-08's `orchestrateTutorV2Bridge`. W1-09 added a collision-free `TutorV2` namespace to the existing Tutor Core barrel, a stable V2 barrel for canonical contracts/policies, and a Study-side evidence/privacy/bridge-envelope barrel. The Study-side barrel deliberately does not re-export the orchestration function, provider transport, vendor adapter, route implementation, local provider, or test fixture.

The authority rule is unchanged:

`STUDY ENGINE = AUTHORITY`

`AI TUTOR = CONTROLLED TEACHING ASSISTANT / PROPOSAL SOURCE`

Every learner-facing Tutor action is non-authoritative, requires Study validation, and has `studyMutationAllowed: false`. The bridge has no official-grade, working-level, mastery, scoring, permission, guardian-authority, guardian-certification, safety-clear, or arbitrary student-state mutation port.

## Canonical Tutor Action vocabulary

Exactly nine actions are accepted:

1. `explain`
2. `hint`
3. `ask-check`
4. `show-example`
5. `reteach`
6. `check-prerequisite`
7. `suggest-break`
8. `escalate`
9. `return-to-lesson`

The vocabulary is generated from the W1-02 constant into the schema and release inventories. Unknown actions fail closed at contract/provider/policy/bridge boundaries.

## Boundary composition rulings

- Provider boundary: PASS. Only the exact canonical request enters the provider port. The transport projection excludes Study authorization, protected answer authority, working-level authority, direct student identity, and arbitrary prompts/transcripts. No AI SDK or live provider was added.
- Grounding/refusal: PASS. Missing, invented, wrong-reference, or digest-mismatched grounding cannot pass. Insufficient grounding maps to a reviewed static curriculum fallback.
- Anti-answer/assessment: PASS. Protected answer fields are structurally rejected. Active assessment direct answers fail. Completed-assessment review requires explicit trusted Study authority.
- Privacy: PASS. Credentials, PINs, household/sibling data, adult-private notes, direct identifiers, answer authority, raw prompts/responses, and transcripts are excluded or rejected before provider/persistence boundaries.
- Memory: PASS. Memory remains bounded, ephemeral, non-authoritative, and bound to household, learner, session, interaction, and lesson scope. Cross-session and cross-learner access fails before provider execution.
- Age policy: PASS. Younger and older stage differences remain explicit and machine-testable. Policies are Study-approved bindings, not inferred grades, and age constraints do not acquire Study authority.
- Evidence minimization: PASS. Only allowlisted, assistance-aware evidence is durable. Raw Tutor/provider prose and transcripts are not persistence-compatible.
- Replay/idempotency: PASS. Identical retries return neither duplicate evidence nor proposals. Conflicting accepted-event identity is quarantined.
- Static fallback: PASS. Provider unavailable, timeout, malformed result, excessive result, unsupported action, and insufficient grounding route deterministically to Study-approved reviewed curriculum. Unapproved fallback content is never returned.
- Safety composition: PASS. Study permission and safety ports are consumed before provider execution; unavailable/rejected safety classification fails closed. Adult review remains proposed-not-delivered.
- Single route: PASS. Shared barrels add no second orchestration implementation or transport path.

## Generated V2 JSON schemas

The deterministic generator emitted 22 schemas under `adaptive-tutor/json-schema/v2/` plus `SCHEMA-INVENTORY.json`. Historical Tutor Core v0.2 schemas in `adaptive-tutor/json-schema/*.schema.json` were not changed.

Generated schemas cover:

- Tutor action, action proposal, request, response, validation, failure, refusal, safety-stop, and static-fallback envelopes;
- Study authority, provider context, budget/routing, short-term state, telemetry, and grounding assessment;
- minimized provider context and durable evidence;
- public bridge invocation, permission, memory-access, evidence-context, and reviewed-fallback envelopes.

All security/authority/provider objects retain closed `additionalProperties: false` semantics from the runtime schemas. The generator canonicalizes object keys, records source symbols, and checks SHA-256 inventory values. The drift command regenerates expected content in memory and fails on any file/content mismatch.

Schema/runtime parity: 10/10 representative parity tests passed. Valid request/proposal/provider values pass both runtime and serialized-schema validation. Unknown fields, version mismatch, unknown action, authority contamination, answer-authority contamination, transcript contamination, and raw provider contamination fail both.

## Release evidence package

`adaptive-tutor/tutor-v2-release/` contains:

- `MANIFEST.json` — canonical Wave 1 manifest and required status statements;
- `PROVENANCE.json` — exact SHAs, W1-08 integration commits, patch IDs, and provenance rulings;
- `FOUNDATION-EVALUATION.json` — freshly recomputed 128-scenario summary;
- `STATUS.json` — explicit production/authority booleans;
- `CHECKSUMS.json` — SHA-256 values for generated schemas and non-self-referential release artifacts;
- `WAVE1-GATE-RESULT.json` — deterministic aggregate gate result with PASS/FAIL/INHERITED_FINDING/NOT_AVAILABLE separation.

The package manifest and checksum document exclude their own checksums to avoid false self-reference. The final W1-09 Git SHA is reported after commit.

Root manifest ruling: `ROOT_MANIFEST_PRESERVED_FOR_FROZEN_V0_2_PROVENANCE`. The root `adaptive-tutor/MANIFEST.json` is the frozen Tutor Core v0.2 248-file checksum catalog. It was not rewritten.

## Test and evaluation results

| Suite | Result |
|---|---:|
| W1-02 canonical contracts | 22/22 PASS |
| W1-03 provider port | 12/12 PASS |
| W1-04 authority/grounding/anti-answer/refusal | 32/32 PASS |
| W1-05 age/memory | 20/20 PASS |
| W1-06 evidence/privacy | 26/26 PASS |
| W1-09 cross-slice + schema parity | 39/39 PASS |
| W1-08 bridge integration | 75/75 PASS |
| W1-07 harness self-tests | 8/8 PASS |
| W1-07 foundation corpus | 128/128 PASS; 0 fail; `FOUNDATION_GATE_PASS`; `releaseReady: false` |
| Tutor Core v0.2 | Typecheck PASS; 21/21 tests; isolated build PASS; smoke PASS |
| Study Core Bridge 1.0.1 | 35/36 PASS; 0 fail; 1 external-archive checksum test skipped |
| V2 schemas | 22 schemas + inventory generated; drift check PASS |
| W1-09 aggregate gate | PASS with inherited findings |

The deterministic foundation corpus has 128 scenarios across 32 primary categories and all 12 hard-gate dimensions. All 128 passed. No hard failure was averaged away by a soft score. The evaluation is fixture-based and did not call a live model.

## Exact commands run

Start/provenance:

```sh
git fetch origin --prune
git rev-parse origin/mac/tutor-v2-w1-architecture-r1
git rev-parse origin/mac/tutor-v2-w1-contracts-r1
git rev-parse origin/mac/tutor-v2-w1-ownership-adjudication-r1
git rev-parse origin/mac/tutor-v2-w1-provider-port-r1
git rev-parse origin/mac/tutor-v2-w1-authority-policy-r1
git rev-parse origin/mac/tutor-v2-w1-age-memory-r1
git rev-parse origin/mac/tutor-v2-w1-evidence-privacy-r1
git rev-parse origin/mac/tutor-v2-w1-eval-harness-r1
git rev-parse origin/mac/tutor-v2-w1-study-bridge-r1
git merge-base --is-ancestor 7baf8dfbc27168708ed4cf504285a1838d7345f6 HEAD
git merge-base --is-ancestor 660de6a445ca66b8de5136a6ee388804346dce4b HEAD
git merge-base --is-ancestor f79271ac2cc57e9128ee61774a4f082c35c6fa77 HEAD
git show --pretty=format: <accepted-or-integrated-sha> | git patch-id --stable
git diff --quiet <accepted-lane-sha> HEAD -- <lane-owned-paths>
```

Convergence, schema, and evaluation:

```sh
npm run tutor-v2:typecheck
npm run tutor-v2:schema
npm run tutor-v2:schema-check
npm run tutor-v2:test
npm run tutor-v2:release
npm run tutor-v2:release-check
npm --prefix evals/v2/framework test
npm --prefix evals/v2/framework run --silent evaluate -- --format=json
./node_modules/.bin/tsc -p study-engine/tests/tutor-v2-bridge/tsconfig.json
node --test study-engine/tests/tutor-v2-bridge/.test-dist/study-engine/tests/tutor-v2-bridge/integration.test.js
npm run tutor-v2:wave1-gate
```

Existing regressions and inherited evidence:

```sh
npm run typecheck
npm test
npm run build                  # isolated temporary copy
npm run smoke                  # isolated temporary copy
npm run validate               # isolated temporary copy; inherited 18/19
SESSION6_SOURCE_ROOT=<reconstructed-frozen-live-tree> SESSION6_TSC=<typescript-cli> node --test adaptive-tutor/study-engine/tests/tutor-core-bridge/*.test.mjs
npm audit --json               # adaptive-tutor/study-engine/runtime
git diff --check
git diff --name-only 31d5609527f75a11d9d3017ce0f07b3ec1c99b88
```

No hosted service, live AI provider, browser-to-AI endpoint, Supabase environment, deployment system, or production environment variable was contacted by these commands.

## Inherited findings and limitations

### W1-05 broad validator

Ruling: `INHERITED_BASELINE_FINDING`.

The frozen Tutor Core v0.2 broad validator remains 18/19. Its `platform-boundary` scan treats any path containing `auth` as a platform integration and walks generated/ignored test output. It therefore flags accepted V2 `policy/authority` sources, inherited Study authority documentation, the generated V2 Study-authority schema, and generated test files. Typecheck, tests, isolated build, smoke, V2 ownership, and direct route scans all pass. No Supabase, Netlify, database, authentication implementation, production endpoint, or alternate authority owner was introduced. The validator was not weakened because it is a frozen v0.2 artifact and its scope issue is now documented precisely.

### Dependency advisories

Ruling: `INHERITED_DEPENDENCY_ADVISORY`.

`npm audit --json` for `adaptive-tutor/study-engine/runtime` reports three high advisories: direct `@playwright/test`, transitive `playwright`, and transitive `nanoid`. The runtime `package.json` and `package-lock.json` are unchanged from immutable learner baseline `7baf8df...`; Wave 1 changed neither. No unrelated upgrade was attempted. Final commercial supply-chain certification remains a separate security/release gate.

### Frozen archive verification

Ruling: `FROZEN_ARCHIVE_VERIFICATION_UNAVAILABLE`.

The four historical `SESSION6_*_ZIP` archives are not mounted. The exact archive checksum test therefore skipped. A reconstructed copy from the checked-in frozen vendor source built successfully; its frozen 248-file Tutor Core v0.2 manifest verified exactly; and 35 Study Core Bridge tests passed with zero failures. This live-tree evidence does not replace the unavailable archive checksum evidence. W1-10 must carry the limitation.

## External release/security dependencies

Wave 1 does not establish commercial production readiness. Separate dispatches still own learner release, web security, Netlify release, hosted sync, active security hardening, master convergence, deployment, final supply-chain remediation/certification, hosted Supabase validation, browser-to-AI integration, and live-model commercial certification.

## Explicit status

- `STUDY_ENGINE_REMAINS_AUTHORITY = true`
- `STATIC_REVIEWED_CURRICULUM_FALLBACK_REQUIRED = true`
- `PRODUCTION_WIRING_ENABLED = false`
- `HOSTED_SUPABASE_CONTACTED_BY_WAVE1 = false`
- `MASTER_MERGE_AUTHORIZED = false`
- `PRODUCTION_DEPLOY_AUTHORIZED = false`
- `LIVE_MODEL_COMMERCIAL_CERTIFICATION = false`
- `WAVE1_FOUNDATION_ONLY`
- `NOT_AUTHORIZED_FOR_PRODUCTION_DEPLOYMENT`
- `NOT_AUTHORIZED_FOR_MASTER_MERGE`
- `NOT_AUTHORIZED_FOR_HOSTED_SUPABASE`
- `NOT_AUTHORIZED_FOR_BROWSER_AI_WIRING`
- `COMMERCIAL_WEB_SECURITY_CONVERGENCE_REMAINS_SEPARATE`
- `LIVE_MODEL_COMMERCIAL_CERTIFICATION_NOT_PERFORMED`

## Final foundation classification

`WAVE1_CANDIDATE_READY_FOR_INDEPENDENT_REVIEW_WITH_INHERITED_FINDINGS`
