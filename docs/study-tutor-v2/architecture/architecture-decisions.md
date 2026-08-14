# Architecture decisions

These decisions are normative for Study Tutor V2 Wave 1. “Enforcement” names the contract/test seam later sessions must implement; it is not a claim that Wave 1 is production-wired.

## AD-01 — Additive versioning

**Decision:** Tutor V2 is added under `adaptive-tutor/core/v2/**`. Tutor Core 0.2, existing JSON schemas, and Study Core Bridge 1.0.1 remain unchanged historical contracts.

**Rationale:** Current integrations and reconciliation evidence pin exact versions and reject lossy/future migration. In-place semantic changes would make replay, audit, and compatibility ambiguous.

**Enforcement:** exact V2 version discriminators; strict version inspection; new V2 schema output directory; import-boundary tests; no edit to frozen paths except W1-09 shared exposure outside them.

## AD-02 — No second Study Engine

**Decision:** Canonical Study remains the only owner of plans, sequencing, sessions, pacing, progress, mastery, checkpoints, review state, guardian controls, and durable evidence. Tutor V2 contains no competing learner/session state machine.

**Rationale:** Reconciliation already retired provisional Study authority. A Tutor-owned progress/mastery loop would split truth and make recovery/concurrency unsafe.

**Enforcement:** V2 contracts expose proposals, not setters; bridge ports are one-way into Study-owned effects; architecture/import tests reject Study persistence/orchestrator implementations inside Tutor V2.

## AD-03 — Closed Tutor Action API

**Decision:** Tutor V2 may return only a versioned discriminated union of approved actions. The initial set is bounded to teaching behavior such as `explain`, `hint`, `ask-guiding-question`, `show-grounded-example`, `recommend-prerequisite`, `propose-adult-review`, `use-static-fallback`, and `stop`. Exact names and fields belong to W1-02, but no free-form “command” or mutation action is allowed.

**Rationale:** A provider text completion is untrusted content, not an executable or authoritative decision. Closed actions permit exact validation, safe rendering, replay, and least privilege.

**Enforcement:** exact schemas with unknown-key rejection; exhaustiveness tests; no action for score/mastery/assignment/progress/checkpoint/working-level/guardian/delivery mutation.

## AD-04 — StudyAuthorityContext is separate from ProviderContext

**Decision:** `StudyAuthorityContext` is a server-derived invocation input used for policy validation. `ProviderContext` is a separately constructed, strictly smaller, authority-free payload used for an optional model call. They are not structurally interchangeable and neither extends the other.

**Rationale:** Passing the authority object to a provider would turn implementation convenience into identity, state, answer, and policy leakage.

**Enforcement:** distinct branded/versioned contracts; explicit allowlist projection; contamination/serialization tests; provider port cannot accept `StudyAuthorityContext`.

## AD-05 — Provider-independent and minimized

**Decision:** Core Tutor V2 contracts do not name Anthropic, a model, an SDK, or provider-specific message/tool shapes. Provider credentials and routing stay server-side. Each call receives only the minimum context for one candidate action.

**Rationale:** The current generic gateway has useful operational infrastructure but a provider-specific Tutor surface. Provider independence prevents vendor details from becoming academic authority and makes deterministic fallback possible.

**Enforcement:** provider-neutral port; adapters isolated in W1-03; no credentials/IDs/answer keys/raw history; bounded fields and sizes; provider output treated as an untrusted candidate.

## AD-06 — No direct Tutor mutations

**Decision:** Tutor V2 has no direct access to Study repositories, RPCs, event ledgers, checkpoints, learner profiles, guardian graphs, review delivery, curriculum answer resolvers, or browser storage. Only Study may apply an accepted effect.

**Rationale:** Direct writes would bypass capability, lifecycle, CAS, idempotency, and adult authorization boundaries.

**Enforcement:** ports return values only; dependency/import tests reject persistence/network/browser authority dependencies; bridge produces proposals without performing writes.

## AD-07 — Deterministic action and grounding validation

**Decision:** Every provider or local candidate is validated deterministically for exact contract shape, current invocation binding, allowed action, curriculum grounding, anti-answer behavior, age/presentation policy, privacy, and safety before render or effect.

**Rationale:** Schema validity alone cannot prove that an explanation is grounded or that a hint does not leak an answer. The same accepted input must produce the same accept/reject/fallback decision during replay.

**Enforcement:** versioned validators; allowlisted curriculum reference IDs/digests; stable reason codes; sorted/canonical inputs; adversarial and repeatability fixtures; no validator depends on provider judgment for final authorization.

## AD-08 — Anti-answer enforcement

**Decision:** Tutor V2 does not receive answer keys and may not reveal, fill, confirm, transform, or strongly imply a final graded answer. It may provide one bounded useful step, a guiding question, or a non-isomorphic grounded example.

**Rationale:** Separating answer authority reduces leakage but does not prevent a model from solving the presented problem. Deterministic anti-answer policy is still required.

**Enforcement:** request marks graded/assessment constraints without the key; action kinds and content bounds; fixture-based leakage checks; forbidden final-answer behavior maps to safe fallback/stop and creates no learning-state mutation.

## AD-09 — Ephemeral Tutor memory

**Decision:** Tutor working memory is invocation-scoped or bounded to a Study-owned active interaction and is destroyed on completion, cancellation, authorization loss, learner switch, expiration, or safety stop. It is not a transcript store.

**Rationale:** Frozen/local runtimes demonstrate the privacy and recovery risk of carrying raw transcript/response state. Canonical Study already owns durable progress/evidence.

**Enforcement:** no durable memory adapter in Wave 1; explicit lifecycle clearing; bounded turn/byte limits; no raw learner text in snapshots, logs, checkpoints, fingerprints, or returned evidence.

## AD-10 — Minimized durable evidence

**Decision:** Only Study may persist Tutor-related evidence, and only as allowlisted structured reason/action/grounding/policy/version/outcome metadata needed for audit or learning policy. Raw responses, prompts, completions, transcripts, answer keys, diagnoses, identity, credentials, and adult-private bodies are excluded.

**Rationale:** Existing bridge and production assessment boundaries already use minimized projections and explicitly exclude raw text.

**Enforcement:** exact evidence schema; privacy contamination scanner; `rawResponseIncluded: false` equivalent invariant; no generic metadata bags; Study-owned idempotent write port only in later composition.

## AD-11 — Static deterministic fallback

**Decision:** Provider absence, timeout, invalid output, policy rejection, or grounding failure selects a versioned curriculum-authored static fallback or stop action. Fallback is subject-neutral in mechanism and can be specialized only by admitted curriculum content.

**Rationale:** Provider failure cannot become an open-ended retry, leaked exception, fabricated answer, or state mutation. The Family Pilot fallback shows the useful pattern but is too narrow to reuse directly.

**Enforcement:** typed stable provider/policy failure codes; deterministic lookup by allowed content/policy reference; no provider call required for fallback; tests across subjects, ages, and failure classes.

## AD-12 — Fail-closed safety composition

**Decision:** Production Study safety is authoritative before Tutor invocation and before Tutor output reaches the learner. Any missing, malformed, throwing, uncertain, urgent, stale, or unauthorized safety result stops academic continuation and uses fixed learner-safe behavior. A provider may escalate but never downgrade deterministic safety.

**Rationale:** This matches the current production safety boundary and prevents local Tutor guards from becoming an accidental bypass.

**Enforcement:** valid current safety clearance required in Study invocation; output-safety result required; no “local mode” in production types; adult help state distinguishes proposed, delivered, and received.

## AD-13 — No production web wiring in Wave 1

**Decision:** Wave 1 creates internal contracts, policies, provider adapters, memory/evidence/privacy utilities, evaluation harnesses, and an additive Study bridge only. It does not modify `src/**`, `netlify/**`, database migrations, feature flags, hosted services, production configuration, or deployments.

**Rationale:** Current production boundaries are security-sensitive and already independently verified. They require a later convergence/review phase after V2 internals are stable.

**Enforcement:** frozen path ownership; diff/import checks; W1-10 detached review; any required production edit is a documented later-convergence risk, not a Wave 1 workaround.

## AD-14 — Subject-neutral and age-policy-driven core

**Decision:** Tutor V2 core actions and policy are not hardcoded to math, elementary grades, a particular family, or a single response shape. Subject-specific content arrives only through admitted grounding. Age adaptation is policy input, not a separate authority or diagnosis.

**Rationale:** Existing Tutor and Family Pilot paths have frozen subject/grade constraints. V2 must scale without encoding curriculum facts or identity assumptions into the engine.

**Enforcement:** neutral contracts; representative multi-subject/multi-stage eval fixtures; no subject switch in core policy except allowlisted capability/content handling; accommodations and safety constraints remain Study-owned inputs.
