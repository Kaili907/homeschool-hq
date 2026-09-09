# Current architecture inventory

## Executive finding

The repository has strong production Study authority boundaries, but it does not yet have a production Tutor V2 boundary. Three historical instructional implementations coexist:

- frozen Tutor Core 0.2 owns an internal instructional cycle and evaluates answers;
- Study Core Bridge 1.0.1 safely composes that frozen core into canonical Study projections, but preserves the historical claim that mastery is Tutor-owned;
- Family Pilot and integration-lab tutor paths are local/non-production and sometimes carry expected answers in browser or demo memory.

Tutor V2 must be additive. It must sit behind the production Study authority, accept minimized context, and return validated proposals. It must not promote any historical local runtime into a second Study Engine.

## Authority flow to preserve

```text
verified learner session
  -> production Study safety boundary
  -> canonical Study plan/session + server assessment authority
  -> minimized StudyAuthorityContext
  -> Tutor V2 controlled assistant (provider optional)
  -> closed TutorAction proposal
  -> deterministic action / grounding / privacy / safety validation
  -> Study Engine applies an allowed effect or deterministic fallback
  -> append-only Study event, checkpoint CAS, minimized evidence, review outbox
```

Raw learner responses follow the assessment/safety custody paths required for the immediate operation. They are not Tutor memory, event payloads, checkpoint data, or provider history.

## 1. Tutor Core 0.2

Primary sources:

- `adaptive-tutor/core/engine/adaptive-tutor-engine.ts`
- `adaptive-tutor/core/engine/assessment-evaluator.ts`
- `adaptive-tutor/core/engine/confidence-model.ts`
- `adaptive-tutor/core/engine/misconception-classifier.ts`
- `adaptive-tutor/core/contracts/**`
- `adaptive-tutor/core/prompts/templates.ts`
- `adaptive-tutor/core/safety/{guard,rules}.ts`
- `adaptive-tutor/core/review/create-review.ts`
- `adaptive-tutor/core/docs/engine-lifecycle.md`
- `adaptive-tutor/docs/{known-limitations,integration-guide}.md`

Current behavior:

- `AdaptiveTutorEngine` owns a deterministic diagnostic → teach → guided practice → independent practice → reassessment cycle and records attempts, observations, evidence, and a transcript in memory.
- `assessment-evaluator.ts` scores multiple-choice, sequencing, and short-answer items using answer-bearing `AssessmentItem` objects.
- confidence and misconception logic is conservative: at least three responses across two contexts are required for a stable estimate; placement is not allowed; diagnostic claims are prohibited.
- response contracts encode anti-answer and identity constraints, and prompt templates are provider-neutral teaching patterns.
- core safety is a useful academic-integrity/PII/diagnosis/disputed-grading guard, but its runtime regex rules do not implement the full urgent safety taxonomy declared by the schema.
- there is no production provider integration and no approved durable persistence contract. The integration guidance says snapshots remain in memory and raw identity/private or unrestricted history must not be sent to a model.

V2 consequence: preserve 0.2 as frozen history. Reuse teaching patterns and deterministic concepts through new V2 contracts, but do not let its assessment keys, transcript, mastery/advance decisions, or local safety guard become production authority.

## 2. Canonical Study Engine

Primary sources:

- `adaptive-tutor/study-engine/contracts/{study-plan,study-session,learning-evidence,focus-profile,parent-teacher-controls,parent-teacher-private,versioning}.ts`
- `adaptive-tutor/study-engine/schemas/**`
- `adaptive-tutor/study-engine/engine/{focus,breaks,interleaving,review,evidence}/**`
- `adaptive-tutor/study-engine/engine/orchestrator/**`
- `adaptive-tutor/study-engine/reconciliation/{reconciliation-manifest,exact-mappings,flow-traces}.json`

Current behavior:

- plans own ordered segments, task types, timing, response requirements, mastery criteria, prerequisite references, and parent-control references;
- sessions own lifecycle state, append-only events, resume points, and completion results;
- learning evidence is aggregate, conservative, and non-diagnostic; engagement is contextual rather than a diagnosis;
- focus, break, interleaving, review, and evidence algorithms are deterministic Study policies;
- private parent/teacher content has a separate authorized record instead of being embedded in learner-facing state;
- version inspection rejects missing, older, and unsupported future contracts rather than performing lossy migration.

The reconciliation manifest is decisive historical evidence: the provisional Study session orchestrator is retired as canonical authority; Tutor Core 0.2 is the frozen instructional component; raw answers and transcripts are excluded from persistence; accepted events must be append-only/idempotent; checkpoints use protected sidecars; private adult data remains isolated. The provisional orchestrator may remain for compatibility tests, not as another engine.

V2 consequence: this is the single learning authority. Tutor V2 consumes a projection of Study state; it does not duplicate plan, session, pacing, progress, mastery, review, or persistence state machines.

## 3. Study Core Bridge 1.0.1

Primary sources:

- `adaptive-tutor/study-engine/bridges/tutor-core/adapter-manifest.json`
- `adaptive-tutor/study-engine/bridges/tutor-core/src/{contracts,core-adapter,orchestrator,checkpoint,hooks,privacy,safety-gateway,schema-compatibility}.ts`

Current behavior:

- pins and validates frozen Tutor Core 0.2 output, brands verified wrappers with module-private identity, and freezes accepted values;
- runs urgent safety before the core, permits one core call, then validates and atomically accepts an event before projection/outbox effects;
- distinguishes duplicate event replay from same-ID/different-payload collision and uses deterministic idempotency keys;
- emits minimized canonical Study projections and proposals rather than raw learner text;
- keeps checkpoint cursors/version/CAS data separate from an opaque protected Tutor-state sidecar;
- rejects raw answers, responses, transcripts, credentials, identity fields, diagnoses, and adult-private notes at bridge boundaries;
- requires a production urgent-safety classifier; missing, malformed, throwing, or downgrade attempts fail closed.

The bridge manifest and mappings preserve a historical split in which Tutor Core owns assessment/mastery/misconception/prerequisite/confidence decisions. That split is incompatible with Tutor V2's Study-authority rule. Bridge 1.0.1 remains valuable compatibility evidence and a source of idempotency/privacy/safety patterns, but V2 requires a new adapter rather than mutation of the frozen bridge.

## 4. Learner runtimes

### Production verified learner runtime

Primary sources:

- `src/study/production/{productionComposition,verifiedRuntimeAdapter,lifecycleBoundary}.ts`
- `netlify/functions/study-academic-runtime.js`
- `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`

This is the current production authority surface. It gates on feature state, authenticated host session, selected-learner authorization, verified runtime branding, dependency readiness, capability, expiration, and lifecycle epoch. The server derives identity and release bindings, rejects caller-supplied authority, validates strict request/response shapes, and provides begin/resume/transition plus checkpoint read/CAS operations. Browser code sees only minimized projections and opaque authority.

V2 consequence: later wiring must enter through this production composition and server-verified lifecycle. Wave 1 adds no web route and no production import.

### Non-production release runtime

Primary sources:

- `adaptive-tutor/study-engine/runtime/src/**`
- `adaptive-tutor/study-engine/runtime/src/version.ts`

The packaged runtime declares `portable-non-production`. Its tutor bridge accepts `expectedAnswer`, adapts a frozen-core program, and composes local release demonstrations. It is audit evidence, not a production learner path.

### Integration labs and Family Pilot

Primary sources:

- `adaptive-tutor/study-engine/integration-labs/**`
- `src/study/family-pilot/learner-response/**`
- `src/study/family-pilot/assessment/**`
- `src/study/family-pilot/tutor/**`

These paths provide useful tests and UX patterns but remain local/browser-oriented. Examples include localStorage/IndexedDB persistence, synthetic learner IDs, locally supplied expected answers, browser-held correct answers, optional/offline assessors, in-memory transcripts, and a math-limited Tutor gateway. They must not be selected by production composition or imported by V2 production code.

## 5. Assessment and answer authority

Primary sources:

- `netlify/functions/production-item-resolver.js`
- `netlify/functions/production-item-assessment.js`
- their tests under `netlify/functions/**`

The server-only production item resolver is the current answer authority. It binds session, lesson, release, version, manifest hash, and verified student to admitted curriculum content; strips learner projections of answer/scoring fields; resolves trusted answers on the server; scores supported item types deterministically; routes rubric prose to protected adult review; and persists minimized evidence with `rawResponseIncluded: false`. The browser cannot supply answer indexes, expected answers, scoring paths, or release/student authority.

V2 consequence: Tutor V2 never receives answer keys or decides official correctness, score, mastery, or working level. Study assessment supplies only an approved phase/evidence summary after scoring. Anti-answer validation remains mandatory even when no key is present.

## 6. Safety boundary

Primary sources:

- `netlify/functions/study-safety-classify.js`
- `netlify/functions/_shared/study-safety/**`
- `adaptive-tutor/study-engine/bridges/tutor-core/src/safety-gateway.ts`

The deployed Study safety composition is the production boundary. It requires authentication, verified session authorization, production classifier configuration, durable limiting/monitoring, and adult proposal/outbox/recipient/delivery/receipt readiness. Deterministic classifications cannot be downgraded by a provider. Missing, invalid, or non-clear results stop academic continuation and use fixed learner-safe output. Classifier input is transient and adult-review proposals are minimized.

V2 consequence: safety runs before Tutor invocation and on Tutor output before rendering. Local Tutor Core rules may be defense-in-depth only; they cannot replace or bypass production Study safety. Provider or validator failure is non-clear and therefore fails closed.

## 7. Checkpoints, replay, and idempotency

Primary sources:

- `adaptive-tutor/study-engine/contracts/study-session.ts`
- `adaptive-tutor/study-engine/bridges/tutor-core/src/{checkpoint,orchestrator,hooks}.ts`
- `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`

Canonical Study state uses append-only accepted events, deterministic event identity/fingerprints, optimistic concurrency, and checkpoint compare-and-swap. Duplicate replay is distinct from an event-ID collision. Recoverable checkpoints contain bounded safe cursors and an opaque protected-sidecar reference, not learner text, answer keys, transcripts, provider prompts, or credentials.

V2 consequence: a `TutorAction` may be correlated to a Study interaction/event, but it is not a second event ledger. Durable Tutor evidence is minimized and written only through Study-owned ports. Replay must produce the same validation/fallback result for the same accepted inputs.

## 8. Adult review and guardian authority

Primary sources:

- `src/study/adult-review/operations/stateMachine.ts`
- `src/study/adult-review/recipients/authorization.ts`
- `src/study/adult-review/receipts/receiptDecision.ts`
- `netlify/functions/_shared/study-adult-review/proposal.js`
- `adaptive-tutor/study-engine/contracts/{parent-teacher-controls,parent-teacher-private}.ts`

Adult review distinguishes proposal, recipient authorization, outbox attempt, delivery, and verified receipt. Guardian relationships, permissions, routing revisions, and effective times are server-derived. `proposed-not-delivered` must never be represented to a learner as delivery or receipt. Tutor V2 may propose a reason-coded review through Study; it may not select recipients, send notifications, alter review state, or claim a guardian was contacted.

## 9. Working level and protective settings

Primary sources:

- `src/academy/workingLevel.ts`
- `src/study/effectiveSettings.ts`
- Study parent-control contracts and controllers

Working level is a per-subject learner-profile decision with explicit parent assignment in the current model. Effective settings apply deterministic precedence: administration default, guardian setting, accommodation, then safety constraint. Tutor V2 may recommend a prerequisite or instructional difficulty adjustment inside the current session; official working-level changes require authorized Study/guardian policy.

## 10. Provider gateway and fallback

Primary sources:

- `netlify/functions/anthropic.js`
- `netlify/functions/_shared/anthropic-policy.js`
- `src/study/family-pilot/tutor/{tutorBridge,staticFallback}.ts`

The existing gateway supplies useful server-side authentication, entitlement/quota, credential custody, attempt accounting, timeout handling, and output sanitation. Its current Tutor request is provider-specific and returns unstructured text; the browser-side family-pilot context can carry a correct answer and an in-memory transcript. It is therefore not an approved Tutor V2 action boundary.

V2 consequence: wrap reusable infrastructure behind a provider-neutral port. Provider context is minimized independently from Study authority context. The provider returns an untrusted candidate that must become a valid grounded closed action or be discarded. A curriculum-authored static fallback is selected deterministically by Study, never improvised by a failed provider call.

## Resulting V2 seam

The only approved new seam is:

```text
Study-owned invocation
  (StudyAuthorityContext, TutorRequest, policy versions)
      -> Tutor V2 adapter/provider port
      -> untrusted candidate
      -> deterministic validators
      -> TutorAction | fail-closed/static fallback
      -> Study-owned effect and evidence
```

No Tutor V2 component may import a browser/local authority, assessment key resolver, database client, guardian relationship store, event ledger writer, checkpoint writer, or notification delivery port.
