# Manuel Academy Study Tutor V2 — Wave 1 Validation Report

## Validation identity

- Validation time: 2026-08-14 12:08:25 EDT (-0400)
- Runtime: Node 22.23.2
- Session: STUDY-TUTOR-V2-W1-09R3 — Final Wave 1 Anti-Answer Repair Reconvergence
- Worktree: `/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/tutor-v2-w1-09-reconvergence-r3`
- Branch: `mac/tutor-v2-w1-reconvergence-r3`
- Failed W1-09 SHA: `16a86d2f5364ade5744bbe4dc5b7f8b82f396a1d`
- W1-B1 provider-boundary repair SHA: `d7aa9720b8096205acc0b63d21a895d8fc16de6f`
- W1-09R2 SHA: `2c8716ed5db5bb824fc92533615295f0b163f7b2`
- Starting W1-B2 structural anti-answer repair SHA: `9f0b66be0b7f86b2004f05137ef9892d2a3ef09a`
- Final W1-09R3 SHA: intentionally recorded after commit in the session return; it is not self-referenced by a checksummed artifact.

## Immutable provenance

| Input | Exact SHA | Verification |
|---|---|---|
| Immutable learner baseline | `7baf8dfbc27168708ed4cf504285a1838d7345f6` | Ancestor; unchanged integration baseline |
| W1-01 architecture | `9e30d59f64184e89db493a004e738e859b06a686` | Canonical remote tip exact |
| W1-02 contracts | `660de6a445ca66b8de5136a6ee388804346dce4b` | Canonical remote tip, ancestry, and contract tree exact |
| Ownership adjudication | `f79271ac2cc57e9128ee61774a4f082c35c6fa77` | Canonical remote tip, ancestry, and architecture tree exact |
| W1-03 provider port | `ee6cc83fdaa43fe733d05abefdaedffe3d0febf9` | Earlier accepted provenance; provider-owned tree was subsequently narrowed by the accepted blocker repair |
| W1-04 authority policy | `befb91bb2321aec0449d2d8e613619a592feb76c` | Accepted tree and stable patch ID exact |
| W1-05 age/memory | `4a8bded7bc0caf5ff647dae814e011d20c8ae5bf` | Accepted tree and stable patch ID exact |
| W1-06 evidence/privacy | `b93765552d60a88ac7691ca7840dfc2ae3a23e77` | Accepted tree and stable patch ID exact |
| W1-07 evaluation harness | `9b959ab7e8176ebccb4fd3ca7b54bf5584602b35` | Accepted tree and stable patch ID exact |
| W1-08 Study bridge | `31d5609527f75a11d9d3017ce0f07b3ec1c99b88` | Canonical remote tip exact; bridge delta isolated |
| Failed W1-09 candidate | `16a86d2f5364ade5744bbe4dc5b7f8b82f396a1d` | Rejected by W1-10; not an accepted Wave 1 release |
| Provider-boundary repair | `d7aa9720b8096205acc0b63d21a895d8fc16de6f` | Canonical remote exact; direct parent is the failed W1-09 SHA |
| W1-09R2 candidate | `2c8716ed5db5bb824fc92533615295f0b163f7b2` | Rejected by W1-10R2; not an accepted Wave 1 release |
| Structural anti-answer repair | `9f0b66be0b7f86b2004f05137ef9892d2a3ef09a` | Canonical remote exact; direct parent is W1-09R2 |

W1-03 through W1-07 were imported into W1-08 as commits `4cf4bda1`, `7a1a12cf`, `c7156bc3`, `42c91482`, and `5a6a191c`. The unrepaired W1-04 through W1-07 lane trees remain byte-for-byte exact. Provider and bridge source match W1-B1 exactly; anti-answer source and bridge tests match W1-B2 exactly. W1-09R3 authored no B1 or B2 repair-source change; all new changes are under convergence-owned paths.

## Detached-review blockers and repair history

The original W1-09 report stated that only a canonical provider-safe projection reached the provider port. W1-10 disproved that statement for candidate `16a86d2f...`: the bridge validated a minimized projection but passed the full mutable `TutorRequest` to `provider.execute()`, and `TutorProviderPort` structurally accepted that full request. This exposed `StudyAuthorityContext`, including authorization and policy references, and let a conforming malicious provider attempt to replace or mutate `allowedActions`, grounding refs/digests, `assessmentPhase`, hint ceiling, age-stage/safety bindings, and then return output evaluated against mutated authority. The exact phase-downgrade response `The correct answer is 4.` was part of the blocking exploit class. W1-10 therefore held Wave 1. That finding remains part of the release history and the failed candidate is not accepted.

Repair `d7aa9720...` structurally changed the port to `execute(request: ProviderExecutionRequest)`, with no `StudyAuthorityContext` member. Before provider execution, the bridge now deep-clones and deep-freezes the trusted invocation, full Study request, memory, age profile, minimized context, and provider execution envelope. All post-provider action, grounding, assessment, answer, hint, age, and safety policy uses the detached trusted Study snapshot. Provider response interaction binding is also checked against that original authority.

W1-09R2 verified the repair rather than rewriting it. Its convergence-owned 13-case suite permanently exercises provider visibility, replacement and in-place mutation, the exact direct-answer exploit, deep equality, forged binding, safe mutation-throw fallback, and a legitimate minimized provider.

Detached W1-10R2 then found a second blocker. Active-assessment answer protection still depended on a finite set of lexical regular expressions, so semantically equivalent instructions including `Use 4 as the response.`, `Put 4 in the box.`, and `Your response should be 4.` could cross while the trusted phase remained `active-graded-or-mastery-check`. Expanding the regex list was rejected as the architectural solution because no finite phrase vocabulary can establish semantic equivalence or prove arbitrary provider prose answer-safe.

W1-B2 repaired the boundary structurally: during an active graded/mastery check, provider-authored `explain`, `hint`, `ask-check`, `show-example`, and `reteach` actions are rejected by action shape regardless of wording. Lexical detection remains defense in depth only. Study-authorized structured controls (`check-prerequisite`, `suggest-break`, `escalate`, and `return-to-lesson`) remain eligible under normal policy. This intentionally removes provider-authored free-form tutoring during an active assessment; richer assessment-time tutoring requires a separately reviewed structured mechanism. No answer key is supplied to Tutor or provider.

W1-09R3 verified B1 and B2 without changing either repair. Its permanent convergence suite has 15 action/prose structural attacks, a 20-item phrase matrix including the three W1-10R2 bypasses and multilingual/Unicode variants, four structured-control regressions, non-active functional regressions, Study-owned completed-review permission tests, answer-field rejection, and provider answer-authority exclusion. These are aggregate hard gates; no soft evaluation score can compensate for failure.

`WAVE_1_COMPLETE = false`. Detached W1-10R3 independent rereview of the final W1-09R3 commit is still required.

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

- Provider boundary: PASS after repair. Only `ProviderExecutionRequest` enters the provider port. It contains the minimized provider context, short-term state, and budget/routing data; it contains no full Study request or Study authorization/policy authority. The transport projection also excludes protected answer authority, direct student identity, credentials, and arbitrary prompts/transcripts. No AI SDK or live provider was added.
- Grounding/refusal: PASS. Missing, invented, wrong-reference, or digest-mismatched grounding cannot pass. Insufficient grounding maps to a reviewed static curriculum fallback.
- Anti-answer/assessment: PASS. Protected answer fields are rejected. All five provider free-form action shapes fail during active assessment independent of wording. Completed-assessment review requires explicit trusted Study authority.
- Privacy: PASS. Credentials, PINs, household/sibling data, adult-private notes, direct identifiers, answer authority, raw prompts/responses, and transcripts are excluded or rejected before provider/persistence boundaries.
- Memory: PASS. Memory remains bounded, ephemeral, non-authoritative, and bound to household, learner, session, interaction, and lesson scope. Cross-session and cross-learner access fails before provider execution.
- Age policy: PASS. Younger and older stage differences remain explicit and machine-testable. Policies are Study-approved bindings, not inferred grades, and age constraints do not acquire Study authority.
- Evidence minimization: PASS. Only allowlisted, assistance-aware evidence is durable. Raw Tutor/provider prose and transcripts are not persistence-compatible.
- Replay/idempotency: PASS. Identical retries return neither duplicate evidence nor proposals. Conflicting accepted-event identity is quarantined.
- Static fallback: PASS. Provider unavailable, timeout, malformed result, excessive result, unsupported action, and insufficient grounding route deterministically to Study-approved reviewed curriculum. Unapproved fallback content is never returned.
- Safety composition: PASS. Study permission and safety ports are consumed before provider execution; unavailable/rejected safety classification fails closed. Adult review remains proposed-not-delivered.
- Single route: PASS. Shared barrels add no second orchestration implementation or transport path.

## Generated V2 JSON schemas

The deterministic generator emitted 23 schemas under `adaptive-tutor/json-schema/v2/` plus `SCHEMA-INVENTORY.json`. Historical Tutor Core v0.2 schemas in `adaptive-tutor/json-schema/*.schema.json` were not changed.

Generated schemas cover:

- Tutor action, action proposal, request, response, validation, failure, refusal, safety-stop, and static-fallback envelopes;
- Study authority, provider context, budget/routing, short-term state, telemetry, and grounding assessment;
- minimized provider context, provider execution request, and durable evidence;
- public bridge invocation, permission, memory-access, evidence-context, and reviewed-fallback envelopes.

All security/authority/provider objects retain closed `additionalProperties: false` semantics from the runtime schemas. The generator canonicalizes object keys, records source symbols, and checks SHA-256 inventory values. The drift command regenerates expected content in memory and fails on any file/content mismatch.

W1-B2 changed deterministic policy behavior, not serialized contracts. Schema generation and drift checks therefore correctly retain 23 schemas. `ProviderExecutionRequest` remains a stable, runtime-validated serialized boundary. Schema/runtime parity is 13/13: valid request/proposal/provider values pass both runtime and generated validation, while unknown fields, version mismatch, invalid action, Study-authority contamination, answer-authority fields, transcripts, unknown security fields, and raw provider contamination fail closed.

## Release evidence package

`adaptive-tutor/tutor-v2-release/` contains:

- `MANIFEST.json` — canonical Wave 1 manifest and required status statements;
- `PROVENANCE.json` — exact SHAs, W1-08 integration commits, patch IDs, and provenance rulings;
- `FOUNDATION-EVALUATION.json` — freshly recomputed 128-scenario summary;
- `PROVIDER-BOUNDARY-RECONVERGENCE.json` — failed-candidate, W1-10 HOLD, repair, structural-ruling, and 13 permanent hard-gate evidence;
- `STRUCTURAL-ANTI-ANSWER-RECONVERGENCE.json` — W1-09R2, W1-10R2 HOLD, B2 repair, structural rule, phrase matrix, and regression evidence;
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
| W1-04 policy plus W1-B2 anti-answer repair | 88/88 PASS |
| W1-05 age/memory | 20/20 PASS |
| W1-06 evidence/privacy | 26/26 PASS |
| W1-B1 repair-local provider-mutation adversarial | 12/12 PASS |
| W1-09R2 permanent provider-mutation adversarial | 13/13 PASS |
| W1-B2 bridge structural anti-answer selection | 13/13 PASS |
| W1-09R3 structural anti-answer convergence | 53/53 PASS |
| W1-09R3 action/prose structural attacks | 15/15 PASS |
| W1-09R3 phrase matrix | 20/20 PASS |
| W1-09R2 composition | 29/29 PASS |
| W1-09R2 schema/runtime parity | 13/13 PASS |
| W1-09R3 cross-slice convergence total | 108/108 PASS |
| Repaired bridge integration | 96/96 PASS |
| W1-07 harness self-tests | 8/8 PASS |
| W1-07 foundation corpus | 128/128 PASS; 0 fail; `FOUNDATION_GATE_PASS`; `releaseReady: false` |
| Tutor Core v0.2 | Typecheck PASS; 21/21 tests; isolated build PASS; smoke PASS |
| Study Core Bridge 1.0.1 | 35/36 PASS; 0 fail; 1 external-archive checksum test skipped |
| V2 schemas | 23 schemas + inventory generated; drift check PASS |
| W1-09R3 release evidence | 8 artifacts generated; drift/checksum check PASS |
| W1-09R3 aggregate gate | PASS with inherited findings |

The deterministic W1-07 foundation corpus still has 128 scenarios across 32 primary categories and all 12 original hard-gate dimensions. All 128 passed. It discovered neither detached-review blocker, and this report does not claim otherwise. The permanent security layers are reported separately: 13 provider-boundary adversarial cases and 53 structural anti-answer cases (including the 20-item phrase matrix). The evaluation is fixture-based and did not call a live model.

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
git rev-parse origin/mac/tutor-v2-w1-provider-boundary-repair-r1
git rev-parse origin/mac/tutor-v2-w1-reconvergence-r2
git rev-parse origin/mac/tutor-v2-w1-anti-answer-repair-r2
git rev-parse 9f0b66be0b7f86b2004f05137ef9892d2a3ef09a^
git merge-base --is-ancestor 7baf8dfbc27168708ed4cf504285a1838d7345f6 HEAD
git merge-base --is-ancestor 660de6a445ca66b8de5136a6ee388804346dce4b HEAD
git merge-base --is-ancestor f79271ac2cc57e9128ee61774a4f082c35c6fa77 HEAD
git show --pretty=format: <accepted-or-integrated-sha> | git patch-id --stable
git diff --quiet <accepted-lane-sha> HEAD -- <lane-owned-paths>
git diff --quiet d7aa9720b8096205acc0b63d21a895d8fc16de6f HEAD -- adaptive-tutor/core/v2/providers adaptive-tutor/study-engine/bridges/tutor-v2
git diff --quiet 9f0b66be0b7f86b2004f05137ef9892d2a3ef09a HEAD -- adaptive-tutor/core/v2/policy/anti-answer adaptive-tutor/study-engine/tests/tutor-v2-bridge
git diff --name-only 2c8716ed5db5bb824fc92533615295f0b163f7b2..9f0b66be0b7f86b2004f05137ef9892d2a3ef09a
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
node --test --test-name-pattern='W1-10 adversarial' study-engine/tests/tutor-v2-bridge/.test-dist/study-engine/tests/tutor-v2-bridge/integration.test.js
node --test scripts/tutor-v2/.dist/tests/tutor-v2-convergence/provider-boundary-adversarial.test.js
node --test scripts/tutor-v2/.dist/tests/tutor-v2-convergence/structural-anti-answer-adversarial.test.js
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
git diff --name-only 9f0b66be0b7f86b2004f05137ef9892d2a3ef09a
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

The four historical `SESSION6_*_ZIP` archives are not mounted. The exact archive checksum test therefore skipped. A reconstructed copy from the checked-in frozen vendor source built successfully; its frozen 248-file Tutor Core v0.2 manifest verified exactly; and 35 Study Core Bridge tests passed with zero failures. This live-tree evidence does not replace the unavailable archive checksum evidence. W1-10R3 must carry the limitation.

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
- `PROVIDER_RECEIVES_STUDY_AUTHORITY = false`
- `POST_PROVIDER_POLICY_USES_IMMUTABLE_STUDY_AUTHORITY = true`
- `ACTIVE_ASSESSMENT_PROVIDER_FREE_FORM_PROSE_ALLOWED = false`
- `ACTIVE_ASSESSMENT_ANSWER_SECURITY_IS_STRUCTURAL = true`
- `WAVE_1_COMPLETE = false`
- `FINAL_INDEPENDENT_REREVIEW_REQUIRED = true`
- `WAVE1_FOUNDATION_ONLY`
- `NOT_AUTHORIZED_FOR_PRODUCTION_DEPLOYMENT`
- `NOT_AUTHORIZED_FOR_MASTER_MERGE`
- `NOT_AUTHORIZED_FOR_HOSTED_SUPABASE`
- `NOT_AUTHORIZED_FOR_BROWSER_AI_WIRING`
- `COMMERCIAL_WEB_SECURITY_CONVERGENCE_REMAINS_SEPARATE`
- `LIVE_MODEL_COMMERCIAL_CERTIFICATION_NOT_PERFORMED`

## Final foundation classification

`WAVE1_R3_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS`
