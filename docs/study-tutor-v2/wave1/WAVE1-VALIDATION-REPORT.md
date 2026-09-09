# Manuel Academy Study Tutor V2 — Wave 1 Validation Report

## Validation identity

- Validation time: 2026-08-14 EDT (-0400)
- Runtime: Node 22.23.2
- Session: STUDY-TUTOR-V2-W1-09R5 — Final Wave 1 Approval-Decision Reconvergence
- Worktree: `/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/tutor-v2-w1-09-reconvergence-r5`
- Branch: `mac/tutor-v2-w1-reconvergence-r5`
- Failed W1-09 SHA: `16a86d2f5364ade5744bbe4dc5b7f8b82f396a1d`
- W1-B1 provider-boundary repair SHA: `d7aa9720b8096205acc0b63d21a895d8fc16de6f`
- W1-09R2 SHA: `2c8716ed5db5bb824fc92533615295f0b163f7b2`
- W1-B2 structural anti-answer repair SHA: `9f0b66be0b7f86b2004f05137ef9892d2a3ef09a`
- W1-09R3 SHA: `7435f820dc9e141d8a113b4d7f853044e36ba51d`
- W1-B3 reviewed-content privacy repair SHA: `cf7ee7265c812a86b708b0e8cf2a33e6370e753d`
- W1-09R4 candidate SHA: `6f90d351d759c697788b6489bd465d954ce52184`
- Attempted W1-10R4 review: custody invalid; not acceptance evidence
- Starting W1-B4 approval-decision structural repair SHA: `cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841`
- Final W1-09R5 SHA: intentionally recorded after commit in the session return; it is not self-referenced by a checksummed artifact.

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
| W1-09R3 candidate | `7435f820dc9e141d8a113b4d7f853044e36ba51d` | Rejected by W1-10R3; not an accepted Wave 1 release |
| Reviewed-content privacy repair | `cf7ee7265c812a86b708b0e8cf2a33e6370e753d` | Canonical remote exact; direct parent is W1-09R3 |
| W1-09R4 candidate | `6f90d351d759c697788b6489bd465d954ce52184` | Superseded by the approval-decision repair; not an accepted Wave 1 release |
| Approval-decision structural repair | `cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841` | Canonical remote exact; direct parent is W1-09R4; repair scope audited to two files |

W1-03 through W1-07 were imported into W1-08 as commits `4cf4bda1`, `7a1a12cf`, `c7156bc3`, `42c91482`, and `5a6a191c`. The unrepaired W1-04 through W1-07 lane trees remain byte-for-byte exact. Provider-port source retains W1-B1 and anti-answer source retains W1-B2. The bridge and bridge integration suite match W1-B4 exactly, and the B3-owned privacy bridge source outside the audited two-file B4 repair scope still matches W1-B3 exactly. The B4 delta against W1-09R4 is confined to `study-engine/bridges/tutor-v2/reviewed-content.ts` and `study-engine/tests/tutor-v2-bridge/integration.test.ts`. W1-09R5 authored no B1, B2, B3, or B4 repair-source change; every R5 path is convergence-owned.

## Detached-review blockers and repair history

The original W1-09 report stated that only a canonical provider-safe projection reached the provider port. W1-10 disproved that statement for candidate `16a86d2f...`: the bridge validated a minimized projection but passed the full mutable `TutorRequest` to `provider.execute()`, and `TutorProviderPort` structurally accepted that full request. This exposed `StudyAuthorityContext`, including authorization and policy references, and let a conforming malicious provider attempt to replace or mutate `allowedActions`, grounding refs/digests, `assessmentPhase`, hint ceiling, age-stage/safety bindings, and then return output evaluated against mutated authority. The exact phase-downgrade response `The correct answer is 4.` was part of the blocking exploit class. W1-10 therefore held Wave 1. That finding remains part of the release history and the failed candidate is not accepted.

Repair `d7aa9720...` structurally changed the port to `execute(request: ProviderExecutionRequest)`, with no `StudyAuthorityContext` member. Before provider execution, the bridge now deep-clones and deep-freezes the trusted invocation, full Study request, memory, age profile, minimized context, and provider execution envelope. All post-provider action, grounding, assessment, answer, hint, age, and safety policy uses the detached trusted Study snapshot. Provider response interaction binding is also checked against that original authority.

W1-09R2 verified the repair rather than rewriting it. Its convergence-owned 13-case suite permanently exercises provider visibility, replacement and in-place mutation, the exact direct-answer exploit, deep equality, forged binding, safe mutation-throw fallback, and a legitimate minimized provider.

Detached W1-10R2 then found a second blocker. Active-assessment answer protection still depended on a finite set of lexical regular expressions, so semantically equivalent instructions including `Use 4 as the response.`, `Put 4 in the box.`, and `Your response should be 4.` could cross while the trusted phase remained `active-graded-or-mastery-check`. Expanding the regex list was rejected as the architectural solution because no finite phrase vocabulary can establish semantic equivalence or prove arbitrary provider prose answer-safe.

W1-B2 repaired the boundary structurally: during an active graded/mastery check, provider-authored `explain`, `hint`, `ask-check`, `show-example`, and `reteach` actions are rejected by action shape regardless of wording. Lexical detection remains defense in depth only. Study-authorized structured controls (`check-prerequisite`, `suggest-break`, `escalate`, and `return-to-lesson`) remain eligible under normal policy. This intentionally removes provider-authored free-form tutoring during an active assessment; richer assessment-time tutoring requires a separately reviewed structured mechanism. No answer key is supplied to Tutor or provider.

W1-09R3 verified B1 and B2 without changing either repair. Its permanent convergence suite has 15 action/prose structural attacks, a 20-item phrase matrix including the three W1-10R2 bypasses and multilingual/Unicode variants, four structured-control regressions, non-active functional regressions, Study-owned completed-review permission tests, answer-field rejection, and provider answer-authority exclusion. These are aggregate hard gates; no soft evaluation score can compensate for failure.

Detached W1-10R3 found a third blocker: privacy admission still accepted arbitrary prose unless a finite lexical `RULES` list happened to recognize it. Eight classes crossed that lexical boundary: cross-child private content, diagnostic inference, psychological labels, personality judgments, parent credentials, service credentials, adult private notes, and paraphrased raw-provider/private material. Keyword expansion was rejected because an open-ended denylist cannot establish that arbitrary content was reviewed, cannot bind approval to exact context, and fails under paraphrase.

W1-B3 replaced lexical admission as the root boundary with exact Study-owned reviewed-content provenance. Approval binds purpose, household/learner/session/interaction/lesson scope, subject/concept/stage context, source ref, content kind, SHA-256 digest, action kind, and grounding refs. Raw candidate text never enters the authority request. The port and decisions are cloned and exact-validated, provider cannot receive or supply the authority, and authority absence/failure/malformed decisions fail closed. Lexical scanning remains defense in depth after provenance. Raw learner free-form attempts are not disclosed to the provider in Wave 1.

W1-09R4 independently reconverged B1, B2, and B3. Its new permanent 78-case privacy suite contains 16 historical blocker variants, 21 additional provenance gates, 10 approval-authority attacks, 15 free-form output cases, and 16 structured-control cases. A temporary untracked copy sets the lexical `RULES` array to empty, recompiles, and reruns all 78 cases; the same suite remains fail-closed. Exact reviewed provider prose works outside active assessment, while B2 still rejects that exact reviewed prose during an active graded/mastery check.

### W1-10R4 custody incident

The detached W1-10R4 review cannot serve as Wave 1 acceptance evidence. The reviewer modified the canonical detached review worktree, which broke custody of that review. This report does not portray that review as a valid final rereview, and no acceptance ruling is derived from it.

Two facts are recorded separately and both are true. The canonical W1-09R4 branch itself was never modified; `6f90d351...` remains exact on `origin/mac/tutor-v2-w1-reconvergence-r4`. And before termination, that review independently reproduced a real fail-open path, which is recorded here on its technical merits rather than as an acceptance ruling.

The reproduced blocker was real. `isApproved()` normalized the untrusted `ReviewedTutorContentAuthorityPort` result with `structuredClone(rawDecision)` and then validated the normalized copy. Normalization runs before validation, so a malformed decision could be laundered into a valid-looking approval: `structuredClone` invokes accessors, so a getter-backed `status`/`approvalRef` pair materialized as plain approved data; it discards a custom prototype, so a prototype-bearing object became a plain object; and it drops non-enumerable and Symbol keys, so hidden-key decisions normalized clean. The exact-key check then ran against the laundered copy and admitted the approval. Both the provider-input and learner-output admission paths were affected.

W1-B4 repaired the root cause by parsing the raw authority result before any normalization or property access. The pipeline rejects null, non-object, and array candidates; requires the prototype to be exactly `Object.prototype`; enumerates every own key with `Reflect.ownKeys`; rejects Symbol keys and any unexpected own key whether enumerable or not; requires own data descriptors for every expected field, so accessor-backed and setter-backed fields are rejected without being invoked; reads `status`, `approvalRef`, and `code` only from those validated descriptors; validates `approvalRef` with the canonical `OpaqueReferenceSchema`; and constructs a fresh frozen internal decision. Any inspection exception, including a hostile Proxy trap, is an authority failure. `Object.keys` alone is no longer the security boundary.

W1-09R5 verified B4 rather than rewriting it, and reconverged B1, B2, and B3 alongside it. Its new permanent 67-case approval-decision suite covers the raw-decision root invariant, 10 accessor attacks, 2 hostile-thenable attacks, 6 prototype attacks, 5 hidden-key attacks, 3 hostile-reflection attacks, 15 malformed value shapes, 6 legitimate-decision regressions, the 8 W1-10R4 historical blocker cases, 8 provider-input and 4 provider-output end-to-end malformed-approval cases, 6 composition attacks, and failure-data minimization. Measured getter side-effect count is zero. The `await` performed on the authority result still probes `then` at the language level, which is inherent to supporting asynchronous authorities; that probe is inside the fail-closed boundary and is covered by explicit hostile-thenable cases.

`WAVE_1_COMPLETE = false`. Detached W1-10R5 final independent rereview of the exact W1-09R5 commit is still required.

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
- Reviewed-content privacy provenance: PASS. Unknown free-form input/output fails without exact Study approval regardless of lexical appearance. Content/ref/digest/context mutation, authority failure, provider self-approval, and cross-child/cross-context replay fail closed. Lexical matching is defense in depth only.
- Approval-decision structural validation: PASS after repair. The untrusted authority decision is structurally validated before normalization or property access. Accessor-backed, setter-backed, custom-prototype, class-instance, null-prototype, inherited-field, non-enumerable, Symbol-key, and hostile-reflection decisions all fail closed, and getter side-effect count is zero. Malformed approvals prevent provider execution on input and withhold provider prose on output; exact legitimate approved and rejected decisions still behave normally. Failure-data minimization was checked across every persistence surface this seam actually has — the learner-facing result, its reviewed fallback, evidence, and provider-failure detail, plus session memory and the event ledger. The raw malformed decision, accessor-carried data, hidden authority metadata, novel provider prose, and injected credential strings appear in none of them. The bridge emits no telemetry envelope and no runtime log at this seam, so there is no further surface to inspect and none is claimed.
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

W1-B2 changed deterministic policy behavior, not serialized contracts. W1-B3 adds a bridge-internal TypeScript authority port whose request/decision are not serialized or sent to the provider, so creating a public JSON schema would incorrectly widen the boundary. W1-B4 changed only how that same bridge-internal decision is parsed; `ReviewedTutorContentApprovalDecision` remains non-serialized, is never sent to the provider, and appears in no schema source symbol, so no serialized contract is affected and no schema was invented for it. Schema generation and drift checks therefore correctly retain 23 schemas. `ProviderExecutionRequest` remains a stable, runtime-validated serialized boundary. Schema/runtime parity is 13/13: valid request/proposal/provider values pass both runtime and generated validation, while unknown fields, version mismatch, invalid action, Study-authority contamination, answer-authority fields, transcripts, unknown security fields, and raw provider contamination fail closed.

## Release evidence package

`adaptive-tutor/tutor-v2-release/` contains:

- `MANIFEST.json` — canonical Wave 1 manifest and required status statements;
- `PROVENANCE.json` — exact SHAs, W1-08 integration commits, patch IDs, and provenance rulings;
- `FOUNDATION-EVALUATION.json` — freshly recomputed 128-scenario summary;
- `PROVIDER-BOUNDARY-RECONVERGENCE.json` — failed-candidate, W1-10 HOLD, repair, structural-ruling, and 13 permanent hard-gate evidence;
- `STRUCTURAL-ANTI-ANSWER-RECONVERGENCE.json` — W1-09R2, W1-10R2 HOLD, B2 repair, structural rule, phrase matrix, and regression evidence;
- `REVIEWED-CONTENT-PRIVACY-RECONVERGENCE.json` — W1-09R3, W1-10R3 HOLD, B3 repair, provenance rule, separated privacy counts, and regex-neutralized requirement;
- `APPROVAL-DECISION-STRUCTURAL-VALIDATION-RECONVERGENCE.json` — W1-09R4, the invalid W1-10R4 review custody incident, the real reproduced blocker, the B4 repair, the validation pipeline, separated approval-decision counts, and the B4 invariants;
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
| W1-B3 bridge reviewed-content privacy selection | 50/50 PASS |
| W1-10R3 historical privacy blockers | 16/16 PASS |
| W1-09R4 additional privacy provenance | 21/21 PASS |
| W1-09R4 approval-authority attacks | 10/10 PASS |
| W1-09R4 free-form output provenance | 15/15 PASS |
| W1-09R4 structured-control privacy | 16/16 PASS |
| W1-09R4 reviewed-content privacy hard gate | 78/78 PASS |
| W1-09R4 regex-neutralized privacy hard gate | 78/78 PASS in temporary copy with `RULES=[]` |
| W1-09R5 approval-decision root invariant | 1/1 PASS |
| W1-09R5 accessor attacks | 10/10 PASS |
| W1-09R5 hostile-thenable attacks | 2/2 PASS |
| W1-09R5 prototype attacks | 6/6 PASS |
| W1-09R5 hidden-key attacks | 5/5 PASS |
| W1-09R5 hostile-reflection attacks | 3/3 PASS |
| W1-09R5 malformed value shapes | 15/15 PASS |
| W1-09R5 legitimate-decision regression | 6/6 PASS |
| W1-10R4 historical approval blockers | 8/8 PASS |
| W1-09R5 provider-input malformed approval | 8/8 PASS |
| W1-09R5 provider-output malformed approval | 4/4 PASS |
| W1-09R5 approval-decision composition attacks | 6/6 PASS |
| W1-09R5 approval failure-data minimization | 1/1 PASS |
| W1-09R5 approval-decision structural hard gate | 67/67 PASS |
| W1-B4 bridge approval-decision selection | 41/41 PASS |
| W1-09R5 cross-slice convergence total | 253/253 PASS |
| Repaired bridge integration | 209/209 PASS |
| W1-07 harness self-tests | 8/8 PASS |
| W1-07 foundation corpus | 128/128 PASS; 0 fail; `FOUNDATION_GATE_PASS`; `releaseReady: false` |
| Tutor Core v0.2 | Typecheck PASS; 21/21 tests; isolated build PASS; smoke PASS |
| Study Core Bridge 1.0.1 | 35/36 PASS; 0 fail; 1 external-archive checksum test skipped |
| V2 schemas | 23 schemas + inventory generated; drift check PASS |
| W1-09R5 release evidence | 10 artifacts generated; drift/checksum check PASS |
| W1-09R5 aggregate gate | PASS with inherited findings; 4 hard-gate families PASS |

The deterministic W1-07 foundation corpus still has 128 scenarios across 32 primary categories and all 12 original hard-gate dimensions. All 128 passed. It discovered none of the four detached-review blockers, and this report does not claim otherwise. The permanent security layers are reported separately: 13 provider-boundary adversarial cases, 53 structural anti-answer cases (including the 20-item phrase matrix), 78 reviewed-content privacy-provenance cases, and 67 approval-decision structural-validation cases. The aggregate gate enforces these as four separately named, hard, non-compensable families: `PROVIDER_AUTHORITY_BOUNDARY`, `STRUCTURAL_ACTIVE_ASSESSMENT_ANTI_ANSWER`, `REVIEWED_CONTENT_PRIVACY_PROVENANCE`, and `APPROVAL_DECISION_STRUCTURAL_VALIDATION`. No soft evaluation score can compensate for a failure in any of them. The evaluation is fixture-based and did not call a live model.

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
git rev-parse origin/mac/tutor-v2-w1-reconvergence-r3
git rev-parse origin/mac/tutor-v2-w1-privacy-provenance-repair-r3
git rev-parse origin/mac/tutor-v2-w1-reconvergence-r4
git rev-parse origin/mac/tutor-v2-w1-approval-decision-repair-r4
git rev-parse cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841^
git merge-base --is-ancestor 7baf8dfbc27168708ed4cf504285a1838d7345f6 HEAD
git merge-base --is-ancestor 660de6a445ca66b8de5136a6ee388804346dce4b HEAD
git merge-base --is-ancestor f79271ac2cc57e9128ee61774a4f082c35c6fa77 HEAD
git show --pretty=format: <accepted-or-integrated-sha> | git patch-id --stable
git diff --quiet <accepted-lane-sha> HEAD -- <lane-owned-paths>
git diff --quiet d7aa9720b8096205acc0b63d21a895d8fc16de6f HEAD -- adaptive-tutor/core/v2/providers
git diff --quiet 9f0b66be0b7f86b2004f05137ef9892d2a3ef09a HEAD -- adaptive-tutor/core/v2/policy/anti-answer
git diff --quiet cf7ee7265c812a86b708b0e8cf2a33e6370e753d HEAD -- adaptive-tutor/study-engine/bridges/tutor-v2 adaptive-tutor/study-engine/tests/tutor-v2-bridge ':(exclude)adaptive-tutor/study-engine/bridges/tutor-v2/reviewed-content.ts' ':(exclude)adaptive-tutor/study-engine/tests/tutor-v2-bridge/integration.test.ts'
git diff --quiet cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841 HEAD -- adaptive-tutor/study-engine/bridges/tutor-v2 adaptive-tutor/study-engine/tests/tutor-v2-bridge
git diff --name-only 6f90d351d759c697788b6489bd465d954ce52184..cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841
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
node --test scripts/tutor-v2/.dist/tests/tutor-v2-convergence/reviewed-content-privacy-provenance-adversarial.test.js
node --test scripts/tutor-v2/.dist/tests/tutor-v2-convergence/approval-decision-structural-validation-adversarial.test.js
node --test --test-name-pattern='<b4-approval-decision-selection>' study-engine/tests/tutor-v2-bridge/.test-dist/study-engine/tests/tutor-v2-bridge/integration.test.js
temporary copy: set bridge privacy RULES=[]; compile; rerun 78-case privacy-provenance suite
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
git diff --name-only cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841
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

The four historical `SESSION6_*_ZIP` archives are not mounted. The exact archive checksum test therefore skipped. A reconstructed copy from the checked-in frozen vendor source built successfully; its frozen 248-file Tutor Core v0.2 manifest verified exactly; and 35 Study Core Bridge tests passed with zero failures. This live-tree evidence does not replace the unavailable archive checksum evidence. W1-10R5 must carry the limitation.

### Wave 1 functional/privacy constraints

Unrestricted novel provider-generated learner-facing prose is disabled. Provider prose must match exact Study-reviewed content, and raw learner free-form attempts are not disclosed to the provider by default. Structured non-free-form response values may remain usable under their closed contracts. Active graded/mastery phases independently prohibit all five provider free-form teaching actions even when their prose is privacy-reviewed. Richer generative dialogue is future work requiring separately reviewed privacy and safety architecture.

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
- `PRIVACY_SECURITY_REQUIRES_REVIEWED_PROVENANCE = true`
- `LEXICAL_PRIVACY_MATCHING_IS_DEFENSE_IN_DEPTH_ONLY = true`
- `RAW_LEARNER_FREE_FORM_ATTEMPT_PROVIDER_DISCLOSURE_ALLOWED = false`
- `UNREVIEWED_PROVIDER_FREE_FORM_LEARNER_OUTPUT_ALLOWED = false`
- `CROSS_CHILD_REVIEW_APPROVAL_REUSE_ALLOWED = false`
- `APPROVAL_DECISIONS_VALIDATED_BEFORE_NORMALIZATION = true`
- `APPROVAL_ACCESSORS_ALLOWED = false`
- `APPROVAL_CUSTOM_PROTOTYPES_ALLOWED = false`
- `MALFORMED_APPROVAL_FAILS_CLOSED = true`
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

`WAVE1_R5_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS`

Wave 1 is not complete. Detached W1-10R5 final independent rereview of the exact W1-09R5 commit remains required, and the attempted W1-10R4 review is not acceptance evidence.
