# Authority map

## Rule

**Study Engine is the authority. AI Tutor is a controlled teaching assistant. There is exactly one Study Engine.**

“Owner” means the component allowed to decide and durably apply the state. “Tutor permission” means the narrow proposal or rendering work Tutor V2 may perform after Study invokes it. A Tutor output has no effect until deterministic Study-side validation accepts it.

| Concern | Authoritative owner | Current source-backed boundary | Tutor V2 permission | Prohibited Tutor behavior |
|---|---|---|---|---|
| Assignment | Study assignment/planning authority, under authorized adult policy | `study-plan.ts`; verified runtime `calendar:read`; Family Pilot plan is legacy only | Explain the currently assigned task | Create, replace, reorder, complete, or persist an assignment |
| Sequencing | Canonical Study plan/session orchestrator | ordered plan segments and Study session events | Recommend one prerequisite or request a Study-approved transition | Run its own lesson/session state machine or advance the learner |
| Progress | Study session projection and server lifecycle RPC | `study-session.ts`; `verified-academic-runtime.js` | Return minimized reason-coded evidence for Study consideration | Write progress, fabricate completion, or maintain a competing progress record |
| Checkpoints | Study persistence/checkpoint CAS authority | verified runtime checkpoint read/CAS; bridge safe cursor + protected sidecar pattern | Supply a bounded opaque correlation/action reference if the contract permits | Store raw response, transcript, prompt, answer, provider state, or write a checkpoint |
| Learner response custody | Study assessment/safety operation; protected review port only when required | `production-item-assessment.js`; safety service; protected rubric-review port | Receive only the minimum transient text needed for the approved teaching action, after pre-safety and never as memory | Persist, fingerprint, log, replay, or send unrestricted response/history to a provider |
| Assessment scoring | Server-side production item resolver/assessment service | `production-item-resolver.js` resolves trusted content and scores supported types | Explain approved evidence without seeing a key; ask a non-graded guiding question | Receive answer keys/scoring paths, score official work, or override `review-required` |
| Mastery interpretation | Canonical Study evidence/mastery policy | `learning-evidence.ts`; Study evidence classifier/policy | Provide a non-authoritative observation/recommendation | Declare mastery, promotion, placement, grade, or durable remediation state |
| Working level | Authorized learner-profile/guardian policy applied by Study | `workingLevel.ts`; `effectiveSettings.ts`; parent-control authority | Recommend a prerequisite or temporary presentation adjustment | Change official working level, grade band, accommodation, or parent control |
| Guardian authority | Server-verified relationship and permission graph | adult-review recipient authorization; production identity/capability boundary | None; consume only an allowed policy projection | Infer guardian identity, accept caller claims, choose recipients, or act as guardian |
| Safety | Production Study safety boundary | `study-safety-classify.js`; `_shared/study-safety/**` | No authority; invocation/output pass the boundary and Tutor may emit only fixed allowed safe actions | Downgrade, bypass, diagnose, continue on non-clear, or claim an adult notification succeeded |
| Adult review state | Study adult-review proposal/outbox/delivery/receipt state machine | `adult-review/operations/stateMachine.ts`; recipient and receipt authorization | Propose a minimized reason code via a closed action | Select recipient/route, send, mark delivered/received, or expose adult-private content |
| Tutor invocation | Study orchestrator/policy gate | future W1-08 adapter entered from verified Study runtime; no production wiring in Wave 1 | Execute only when passed a valid, current, versioned invocation | Self-invoke, run from local demo paths, or call a provider outside the Study gate |
| Explanation | Tutor V2 proposes; Study validators authorize/render | frozen prompt/response patterns are historical input | Propose one bounded explanation grounded to allowed curriculum references | Expose answers, unsupported facts, identity claims, diagnoses, or ungrounded content |
| Hint | Tutor V2 proposes; Study validators authorize/render | anti-answer rules and response schema patterns | Propose a hint that advances one useful step without completing graded work | Reveal/fill the final graded answer or transform hidden answer authority into a hint |
| Prerequisite recommendation | Tutor V2 proposes; Study policy decides | frozen skill-graph method is advisory history; canonical Study plan owns sequence | Return a reason-coded prerequisite recommendation against allowed references | Alter the plan, mastery, working level, or claim the prerequisite is assigned |
| Parent explanation | Study/adult projection authority; Tutor draft optional only if explicitly contracted | private adult contracts and review delivery state | At most propose minimized parent-safe wording from an approved summary | Read private notes/raw responses, contact a parent, or claim delivery/receipt |
| Provider call | Server-side Tutor V2 provider port under Study invocation | existing Anthropic gateway infrastructure is wrap-only | Submit an independently minimized `ProviderContext`; treat output as untrusted | Expose Study authority object, IDs, keys, answer authority, raw history, credentials, or accept raw text directly |
| Provider failure fallback | Study orchestration and deterministic Tutor policy | Family Pilot static fallback is a pattern, not authority | Return a typed failure; allow Study to select curriculum-authored fallback | Retry without policy/accounting, improvise an answer, mutate state, or fail open |

## Context separation

`StudyAuthorityContext` and `ProviderContext` are distinct contracts and distinct values.

### StudyAuthorityContext

Server-derived, versioned, current for exactly one invocation, and sufficient for deterministic policy enforcement. It may contain opaque session/interaction references, allowed curriculum grounding references, subject-neutral learner stage/presentation policy, approved aggregate evidence, safety clearance reference, and relevant policy versions. It does not contain provider credentials, answer keys, guardian identity, unrestricted learner identity, adult-private notes, raw history, or a database handle.

### ProviderContext

Constructed only after Tutor policy selects a provider call. It contains the smallest provider-neutral teaching prompt needed for one candidate action, coarse age/presentation policy, an allowlisted grounding excerpt/reference, and no durable authority. It must be safe to discard. It must not be a renamed or serialized `StudyAuthorityContext`.

## Effect rule

A Tutor proposal becomes a Study effect only through this sequence:

1. validate contract version and exact shape;
2. verify invocation is current and bound to the expected Study interaction;
3. validate action kind against the closed action set;
4. validate curriculum grounding/reference allowlist;
5. validate anti-answer and assessment separation;
6. validate age/presentation, privacy, and output safety policy;
7. select accepted action or deterministic fallback;
8. let Study alone append events, update projections/checkpoints, or propose adult review.

Failure at any step creates no Tutor-authored state mutation.
