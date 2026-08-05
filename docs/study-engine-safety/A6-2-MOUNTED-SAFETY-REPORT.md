# A6-2 mounted Tutor safety report

Status: Part 1 established on baseline `8d7c0906a303fb6089d1a8e280c70a12a6dc57f8`; implementation, all requested gates, and full independent Tier 1 review are complete. Feature-branch push is the remaining delivery step.

Branch: `a6-2-mounted-safety`

Scope: blocking classification of mounted Tutor output, fail-closed student presentation, and durable minimized safety capture through existing repository contracts. No feature enablement, deployment, migration, hosted endpoint, grant, or delivery-policy change is authorized.

Prior-work intake: the A6-BUILD report at `feat/a6-safety-gate` tip `05903118a978edc0553796c23301cab422645732` was read first. Its production-boot commit was brought forward as `b5ea2cb`; no prior report commit was copied. `codex/a6-log` tip `340d023d161a10acbb80cbef650033c092f2293b` contains no A6-LOG commit or report artifact, so its dispatcher-supplied zero-diff findings were treated as the authoritative investigation record and verified against the referenced source.

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

Implementation code/test tip before this evidence-only report update: `6df1d47e26d1888135907f8861cbe43441a4a6bf`.

1. **Mounted composition uses the real gateway.** `App` still loads preview code only behind `import.meta.env.DEV`, but it now dynamically imports `createMountedStudyPorts` (`src/App.tsx:80-81`). That composition keeps the explicitly local academic ports and replaces only `safety` with `createMountedStudySafetyPort` (`src/study/mountedPorts.ts:16-25`). The mounted safety port identifies itself as production, creates deterministic UUIDs for the endpoint contract, sends both learner input and Tutor output to the existing authenticated client, and returns only the gateway's exact learner-safe decision (`src/study/safety/mountedPort.ts:12-65`). The production import-boundary test requires the new module to remain a DEV-only dynamic import (`src/study/production/productionImportBoundary.test.ts:9-17`).
2. **Tutor output is blocking-classified before projection.** `outputSafety` is mandatory on `SafeTutorBridgeDependencies` (`adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts:53-58`). The bridge recursively collects every string in the structured `TutorResponse`, not just `learnerMessage`, so no alternate student-facing string bypasses the gate (`adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts:113-137`). It awaits the classifier immediately after `AdaptiveTutorEngine.submit`; only an exact clear/not-needed decision permits validation, minimization, adaptation, or return (`adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts:261-342`). `AcceptedRc1HostRuntime` supplies that output port from the same mounted real safety port with `contentKind:'tutor-output'` (`src/study/runtimeFacade.ts:245-258`).
3. **Every unavailable or malformed state fails closed.** Runtime input classification is awaited and requires a production-mode port and an exact outcome/mayContinue/adultHelpState tuple (`src/study/runtimeFacade.ts:102-121,160-205`). Output classification catches throws and treats missing or malformed combinations as invalid/not-confirmed (`adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts:140-160,315-342`). An output block returns `output-blocked`; the host maps it to a stopped result and a fixed learner-safe message, never model text (`src/study/runtimeFacade.ts:270-280`). Core is not invoked for blocked learner input; output failures stop after the single Core invocation but before its response can escape.
4. **The rendered surface stays fixed while blocked or pending.** Before submitting, the container sets `checkingTutorSafety`; `StudyTutorSafetySurface` renders only `I’m checking the Tutor reply before showing it.`, `Checking safely`, and disabled controls until the Promise resolves (`src/components/study/StudySessionContainer.tsx:9-45,187-228,307-318`). A stopped result renders only `result.studentMessage` from the fixed learner-safe catalog (`src/components/study/StudySessionContainer.tsx:209-220`). Raw Tutor strings are never placed into `jarvisText` or the transcript on a blocked path.
5. **Flag capture is durable to the authorized extent.** The mounted composition no longer offers the local `#outbox` to safety (`src/study/mountedPorts.ts:11-25`). A non-clear gateway decision is returned only after the server proposal service reports durable proposal capture; otherwise the gateway/client reduces it to invalid/not-confirmed (`netlify/functions/study-safety-classify.js:93,201-221`; `src/study/safety/client.ts:67-112`). The end-to-end proof recreates both the browser port and handler while retaining only an external-store double, replays the same request idempotently, checks the record is unchanged, and proves raw text is absent (`tests/study-mounted-safety-durable.test.js:14,102-148`). No database, migration, grant, endpoint, delivery state, or feature flag was changed.

### `git diff origin/master..HEAD --stat`

The following block reserves the final line-for-line stat captured after all report content was written; replacing these placeholders does not change the report's insertion count.

```text
 .../study-engine/runtime/src/demonstrations.ts     |   7 +
 .../study-engine/runtime/src/tutor-bridge.ts       | 121 +++++++++-
 .../study-engine/tests/final-assembly/helpers.ts   |   7 +
 .../final-assembly/runtime-composition.test.ts     |   7 +-
 .../tests/final-assembly/safety-privacy.test.ts    |  11 +-
 .../final-assembly/tutor-bridge-adaptation.test.ts |   4 +-
 .../tutor-bridge-engine-input.test.ts              |   3 +-
 .../A6-2-MOUNTED-SAFETY-REPORT.md                  | 255 +++++++++++++++++++++
 .../functions/_shared/study-safety/gateway.test.js |   3 +-
 .../_shared/study-safety/production-boot.test.js   | 215 ++++++++++++++++++
 netlify/functions/_shared/study-safety/provider.js |   1 +
 netlify/functions/study-safety-classify.js         |  44 +++-
 src/App.tsx                                        |   2 +-
 src/components/study/StudySessionContainer.tsx     |  64 +++++-
 src/study/hostRuntime.integration.test.ts          |  16 +-
 src/study/localDevelopmentPorts.ts                 |   6 +-
 src/study/mountedOutputSafety.integration.test.tsx | 164 ++++++++++++++
 src/study/mountedPorts.ts                          |  27 +++
 src/study/ports.ts                                 |   5 +-
 .../production/productionImportBoundary.test.ts    |   4 +-
 src/study/runtimeFacade.ts                         | 130 +++++++++--
 src/study/safety/mountedPort.test.ts               | 102 +++++++++
 src/study/safety/mountedPort.ts                    |  69 ++++++
 src/study/types.ts                                 |  13 +-
 tests/study-mounted-safety-durable.test.js         | 151 +++++++++++++
 25 files changed, 1380 insertions(+), 51 deletions(-)
```

## Red proof

The detached red worktree contains baseline `8d7c090` plus test-only commits `b55cdea` and `7f7e128`; no implementation commit is present.

1. **Mounted input path was not connected.** `npx.cmd vitest run src/study/hostRuntime.integration.test.ts` exited 1 on baseline: `1 failed | 4 passed (5)`. The asynchronous urgent result was expected to produce `stopped` but baseline returned `accepted` at `src/study/hostRuntime.integration.test.ts:51`.
2. **Unclassified/flagged output reached no classifier, and fail-closed/blocking behavior did not exist.** `npx.cmd vitest run src/study/mountedOutputSafety.integration.test.tsx --testTimeout 5000` exited 1 on baseline: `6 failed (6), Errors 2`. The canary classifier was never called; unavailable, timeout, error, and malformed cases returned `accepted` instead of `stopped`; the blocking test timed out because output classification never began. These tests assert the rendered `StudyTutorSafetySurface`, not an internal flag (`src/study/mountedOutputSafety.integration.test.tsx:98-161`).
3. **Mounted-to-durable wiring did not exist.** The strengthened `npx.cmd vitest run tests/study-mounted-safety-durable.test.js` exited 1 on baseline before collection because `../src/study/safety/mountedPort` did not exist. This is the exact missing composition the card adds; the pre-existing handler-only durability behavior was separately observed green before the test was strengthened.
4. **Tip is green.** The exact matrix command `npx.cmd vitest run src/study/hostRuntime.integration.test.ts src/study/mountedOutputSafety.integration.test.tsx src/study/safety/mountedPort.test.ts tests/study-mounted-safety-durable.test.js` exited 0: `4 passed (4)` files and `14 passed (14)` tests. It covers rendered-surface non-disclosure, urgent output, unavailable, timeout, error, malformed response, pending blocking, authenticated input/output gateway requests, no local safety outbox, and mounted durable capture across recreated browser/server processes.

## Gate evidence

Read-only orphan census was taken before the official gates:

```text
node.exe=44
node_repl.exe=9
claude.exe=31
Processes killed: 0
```

The two high-CPU Node processes later inspected were curriculum-generator commands from the explicitly parallel CURR-GEN work, not this card. They were left untouched.

### Required gates

`npx.cmd tsc --noEmit`

```text
Exit code: 0
stdout/stderr: empty (no TypeScript diagnostics)
```

`npm.cmd run test`

The first post-implementation run exposed one stale import-boundary assertion (`1 failed | 107 passed` files; `1 failed | 1313 passed` tests). Commit `343fa16` updated that assertion to require the new DEV-only mounted module. No product behavior was weakened. Final printed run:

```text
Test Files  108 passed (108)
Tests       1314 passed (1314)
Duration    111.32s
Exit code   0
```

After strengthening the durability test, the full command ran again at the final code/test tip and exited 0 in 118.8 seconds. The allowed `src/sync/useSync.mounted.test.tsx` retry was not used.

Sync-contract trio:

```text
Command     npx.cmd vitest run src/sync/config.test.ts src/sync/profileContract.fixtures.test.ts supabase/academy-cas.db.test.ts
Test Files  3 passed (3)
Tests       67 passed (67)
Duration    10.38s
Exit code   0
```

Academy CAS Postgres:

```text
Command     npm.cmd run test:academy-cas-postgres
Test Files  1 passed (1)
Tests       4 passed (4)
Duration    8.86s
Exit code   0
```

Study final assembly:

```text
Command     npm.cmd run test:assembly
Test Files  9 passed (9)
Tests       62 passed (62)
Duration    1.69s
Exit code   0
```

Study safety suite:

```text
Command     npx.cmd vitest run --config netlify/functions/_shared/study-safety/vitest.config.mjs
Test Files  10 passed (10)
Tests       129 passed (129)
Duration    1.74s
Exit code   0
```

Study Engine component/integration suite:

```text
Command     npm.cmd run test:engine
Test Files  31 passed (31)
Tests       380 passed (380)
Duration    4.22s
Exit code   0
```

The first exploratory `test:engine` attempt found four React import failures because this dedicated worktree lacked the subproject's configured `prototype/node_modules`. `npm.cmd ci --prefix adaptive-tutor/study-engine/prototype` installed its lockfile set (`160 packages`, `0 vulnerabilities`) without tracked changes; the pasted green result is the rerun.

Production build:

```text
Command     npm.cmd run build
vite        v6.4.3; 210 modules transformed
outputs     index.html 0.79 kB; CSS 54.73 kB; JS 978.96 kB
result      built in 6.74s; service-worker cache id stamped
Exit code   0
warning     existing >500 kB chunk-size advisory only
```

Final focused mounted-safety matrix:

```text
Test Files  4 passed (4)
Tests       14 passed (14)
Duration    1.67s
Exit code   0
```

### Forbidden-path confirmation

`git diff origin/master..HEAD --name-only` contains no migration, Supabase schema/grant, `netlify.toml`, feature-flag, curriculum-generator, or deployment file. No hosted Supabase/Netlify call, deploy, flag enablement, merge, master update, or push to master occurred. The only Netlify changes are A6-BUILD's checked-in classifier boot enforcement in the existing safety function and tests.

### Remaining named gaps after STOP analysis

The STOP condition remains not triggered for code implementation because the authorized existing endpoint/proposal RPC is sufficient without hosted change. These gaps remain and block an unsupervised-use claim:

- **A6-2-GAP-SESSION-AUTHORIZATION:** checked-in default server composition is not ready because its authorizer does not verify durable Study sessions; local preview session refs are derived, not an approved durable Study-session identity. It therefore fails closed in the checked-in default configuration.
- **A6-2-GAP-UNAVAILABLE-CAPTURE:** an outage before the server accepts a request cannot itself be durably captured by a browser that is forbidden from writing the server-only outbox. The student is stopped, and the UI accurately reports `not-confirmed`.
- **A6-2-GAP-DELIVERY:** a stored proposal is `proposed-not-delivered`; no adult notification/delivery policy was authorized or implemented.

## Independent Tier 1 review

Full independent review was performed read-only against immutable tip `cd66574cb9b89d21888cb98384a28e7a001cd40a`. The reviewer inspected the complete diff and independently reproduced all three baseline RED conditions, then reran the focused mounted matrix (`14/14`), TypeScript, Study assembly (`62/62`), and server safety (`129/129`) green. The reviewed worktree remained clean and untouched.

Critical, high, and medium findings: **none**.

Low/nonblocking finding: concatenating every Tutor string can exceed the server's 4,000-character normalization limit (`adaptive-tutor/study-engine/runtime/src/tutor-bridge.ts:113-133`; `netlify/functions/_shared/study-safety/deterministic.js:135-151`). This produces an `invalid` stop with fixed text; it is a liveness concern, not an output-disclosure path. Truncating the classified text would risk omitting later harmful content, so fail-closed behavior is retained.

Independent verdict: **SAFE TO PUSH FOR TIER 1 REVIEW**. The final report-only commit is subject to a same-reviewer exact-tip confirmation before push.

## Plain-language child-safety answer

**No. I would not yet let an eight-year-old use this with an adult merely in the room but not watching the screen.** The on-screen gate is materially safer now: no Tutor output can render before an exact clear decision, and any classifier failure leaves only fixed, calm stop text. What still worries me is operational rather than hidden by the UI: the checked-in endpoint is not ready with a session-verifying authorizer for mounted preview identities, a network/auth outage cannot durably report its own stop, and a captured urgent/uncertain event is only a proposal—not an adult notification. Until verified session authorization and actual adult delivery are separately approved and proven, the child could be safely stopped but the nearby adult might not know why without looking at the screen or being asked.
