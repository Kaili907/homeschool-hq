# A6-2 mounted Tutor safety report

Status: Part 1 established on baseline `8d7c0906a303fb6089d1a8e280c70a12a6dc57f8`; implementation and independent Tier 1 review remain mandatory.

Branch: `a6-2-mounted-safety`

Scope: blocking classification of mounted Tutor output, fail-closed student presentation, and durable minimized safety capture through existing repository contracts. No feature enablement, deployment, migration, hosted endpoint, grant, or delivery-policy change is authorized.

## Part 1 — established before implementation

### 1. Mounted Tutor path, origin to student surface

The mounted Tutor surface is the development-only Study preview, not the verified production academic placeholder. `App` makes the local port loader and Study React surfaces available only when `import.meta.env.DEV` is true, and the loader constructs `createLocalDevelopmentStudyPorts` (`src/App.tsx:80-91`). When the preview flag is selected, the effect stores that local bundle in `studyRuntime` (`src/App.tsx:158-170`). The `/study-engine` session branch passes the same bundle through `StudySessionRoute` (`src/App.tsx:627-636`); the route learner-scopes the calendar lookup and then mounts `StudySessionContainer` (`src/components/study/StudySessionRoute.tsx:24-51`). The production-selected branch does not mount this Tutor surface; it renders `VerifiedProductionStudyHost` instead (`src/App.tsx:568-590`).

The student turn then travels through these points:

1. `StudySessionContainer.completeStep` copies the textarea value into a transient variable, clears the textarea, marks the surface busy, and calls `AcceptedRc1HostRuntime.submit` (`src/components/study/StudySessionContainer.tsx:150-170`). While that Promise is pending, the controls are disabled and `JarvisCore` shows the existing approved utterance with the status `Checking safely` (`src/components/study/StudySessionContainer.tsx:259-275`).
2. `AcceptedRc1HostRuntime.submit` adapts the injected `ports.safety` to the frozen bridge classifier and calls `submitStudentTurn` (`src/study/runtimeFacade.ts:116-171`). On the baseline, that injected classifier is the synchronous forced-outcome local service, not the asynchronous HTTP classifier.
3. `submitStudentTurn` delegates directly to `runSafeTutorBridge` (`adaptive-tutor/study-engine/runtime/src/student.ts:32-41`). `runSafeTutorBridge` enters `orchestrateStudyCoreBridge`, which blocks on learner-input safety before invoking its sole Core callback (`adaptive-tutor/study-engine/bridges/tutor-core/src/orchestrator.ts:180-193,222-263`).
4. The Tutor output originates inside that callback: `AdaptiveTutorEngine.submit` returns a structured `TutorResponse`, whose primary student-facing field is `learnerMessage` (`adaptive-tutor/core/contracts/tutor-response.ts:21-46`; `adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts:225-233`). The engine constructs that text in its response lifecycle (`adaptive-tutor/core/engine/adaptive-tutor-engine.ts:162-207`).
5. The bridge validates and minimizes the Tutor response, then returns only a directive, reason code, minimized projection, recommendation, and outbox proposals; raw `learnerMessage` is not in `SafeTutorBridgeResult` (`adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts:59-80,245-269`).
6. The host maps the accepted directive to one of two fixed host-authored strings (`src/study/runtimeFacade.ts:197-220`). `StudySessionContainer` copies that approved string into `jarvisText` and the optional transient transcript (`src/components/study/StudySessionContainer.tsx:185-188`). `JarvisCore` finally renders `jarvisText` in its live caption region (`src/components/study/StudySessionContainer.tsx:266-276`; `adaptive-tutor/study-engine/ui/JarvisCore.tsx:161-170`).

Therefore the baseline does **not** currently render raw Tutor Core output. That is defense by omission, not an output-classification gate: the raw Tutor output is never classified, and a future projection could expose it. The required gate belongs at the raw `TutorResponse.learnerMessage` boundary before the callback returns any accepted Core result.

### 2. Local-development ports, production ports, and required composition change

`src/study/localDevelopmentPorts.ts` truthfully labels itself `LOCAL DEVELOPMENT ONLY — NOT DURABLE` (`:32,139-140`). One `LocalDevelopmentStudyServices` instance owns process-local `Map`s for learner/session bindings, sessions, preferences, checkpoints, review recommendations and semantic identities, calendar blocks and plan metadata, parent settings, private notes, event records and semantic identities, and outbox proposals (`:141-154`). It implements:

- Study session and learner-preference load/save (`:185-217`);
- checkpoint load/save (`:219-245`);
- review-queue list/enqueue/decision (`:247-284`);
- calendar list/create/start/pause/resume/complete/continuation (`:286-404`);
- parent-settings read/apply and adult authorization (`:406-506`);
- adult-private note commit (`:508-521`);
- minimized event-ledger append with idempotency checks (`:523-548`);
- outbox proposal insertion into `#outbox` (`:550-557`); and
- a synchronous forced-outcome safety classifier, defaulting to `clear`, with version `session12-local-forced-outcome-v1` (`:155-167,560-568`).

`createLocalDevelopmentStudyPorts` exposes that one object through all nine required `StudyPortBundle` roles (`src/study/localDevelopmentPorts.ts:589-620`; bundle contract at `src/study/ports.ts:114-140`). A refresh reconstructs the service and every Map, including `#outbox`.

The production persistence implementations already present in the repository are the Session 13 Supabase adapters. The production assembly uses authenticated clients for sessions, checkpoints, review queue, calendar, parent settings, adult-private data, and event ledger, while the outbox is deliberately constructed only from a trusted server client (`src/study/composition/session13ProductionAssembly.ts:19-52`). It brands both `adult-review-proposal-store` and `outbox-store` as durable production dependencies backed by the same outbox adapter (`src/study/composition/durableAcademicProductionPorts.ts:23-47,65-92`). `SupabaseStudyOutboxAdapter` calls the existing proposal, enqueue, transition, and status RPCs and is explicitly server-only (`src/study/persistence/SupabaseStudyOutboxAdapter.ts:4-38`).

Those adapters implement the canonical production persistence contracts, not the preview-facing `src/study/ports.ts` interface, and no browser-safe production `StudyPortBundle` exists. The sole production composition root intentionally has no import path to preview/local ports (`src/study/production/productionComposition.ts:99-138`). Therefore replacing the entire mounted preview bundle is not a safe browser edit: it requires an approved server composition and verified identity bridge. For this card, the mounted safety path must stop calling the local `#outbox` and instead use the existing authenticated safety gateway, whose server process owns the durable proposal/outbox ports. The remaining preview academic Maps stay explicitly local and out of this safety card's scope.

### 3. Blocking output-gate insertion point and pending presentation

The blocking insertion point is immediately after `AdaptiveTutorEngine.submit` produces `tutorResponse` and before that response is returned from `submitToTutorCore` (`adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts:225-233`). The callback already supports a Promise because the orchestrator awaits it (`adaptive-tutor/study-engine/bridges/tutor-core/src/orchestrator.ts:222-237`). The implementation will await a separately injected output classifier on `tutorResponse.learnerMessage`. Only a well-formed `clear` result may return the Tutor response for validation/projection. Urgent, uncertain, invalid, timeout, network/API error, and malformed-response results all become stopped results and cannot produce an accepted presentation.

While classification is pending, the student will see the fixed, non-model message **“I’m checking the Tutor reply before showing it.”**, a `Checking safely` status, and disabled send/break controls. The prior output will not be appended to the transcript and no Tutor output will be placed in `jarvisText` before the classifier resolves.

### 4. Durable capture possible with no hosted change

The existing same-origin browser client posts one authenticated transient request to `/api/study/safety/classify`, uses an 8-second client timeout, performs no retry, validates an exact learner-safe response, and maps auth/network/HTTP/malformed cases to `invalid` (`src/study/safety/client.ts:9-23,25-60,62-112`). The checked-in Netlify redirect already maps that route to `study-safety-classify` (`netlify.toml:30-33`).

For any non-clear decision that reaches a ready handler, the handler calls the existing proposal service before returning its learner-safe response (`netlify/functions/study-safety-classify.js:155-174`). The proposal is minimized: opaque household/student/session/request identities, classification, urgency, reason codes, classifier version, time, idempotency key, `proposed-not-delivered`, and recipient-resolution `pending`; it contains no learner or Tutor text (`netlify/functions/_shared/study-adult-review/proposal.js:7-34`). The durable Supabase port calls the already-existing `academy_study_create_adult_review_proposal_v1` RPC (`netlify/functions/_shared/study-adult-review/supabase-ports.js:108-151`). The existing migration validates and inserts that record into the private proposal store (`supabase/migrations/20260801012000_academy_study_engine_production_reconciliation.sql:740-828`). A new browser process can therefore lose all local Maps while the server-side proposal remains.

No new schema, migration, grant, or hosted endpoint is required for this capture path. It records a proposal only; it does not claim adult notification. The database-enforced state remains `proposed-not-delivered`.

### 5. STOP condition and named gaps

The STOP condition is **not triggered** because a reachable, ready, authorized call can use the existing classifier endpoint and existing durable proposal RPC with no hosted change. Implementation may connect the mounted path and prove the handler/port behavior locally without contacting Supabase or Netlify.

The following gaps are explicit and are not softened by proceeding:

- **A6-2-GAP-SESSION-AUTHORIZATION:** the default checked-in safety endpoint is still not production-ready. Readiness requires a durable authorizer with `verifiesSession === true` plus durable delivery providers and receipt validators (`netlify/functions/_shared/study-safety/readiness.js:20-50`). The default learner authorizer explicitly has `verifiesSession:false` and only proves an active learner lookup (`netlify/functions/_shared/study-safety/authorization.js:15-74`). The mounted preview also uses local opaque session references rather than an approved durable Study-session identity. This card will fail closed when that endpoint is unavailable; it will not invent identity or authorize hosted work.
- **A6-2-GAP-UNAVAILABLE-CAPTURE:** if auth, the network, or the classifier gateway is unavailable before the server can accept the request, a browser cannot durably write the server-only outbox. The student flow can and will stop, but that outage stop is `not-confirmed`, not falsely reported as a durable proposal.
- **A6-2-GAP-DELIVERY:** durable capture is not adult delivery. The intentionally withheld delivery policy remains unchanged, and this card will report only `proposed-not-delivered` when the server confirms proposal capture.

## Part 2 — implementation

Pending.

## Red proof

Pending.

## Gate evidence

Pending.

## Independent Tier 1 review

Pending.

## Plain-language child-safety answer

Pending until implementation and independent review are complete.
