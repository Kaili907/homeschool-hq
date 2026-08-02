# Tutor Core Compatibility Matrix

Verdict: **BLOCKED**.

The actual Manuel Academy Adaptive Tutor Core v0.2 package was not accessible. Therefore no package identity, hash, export, enum, payload, runtime, peer dependency, or compatibility mapping is approved. `src/tutor/**` is legacy application code and was not substituted. Handoff summaries were not used to reconstruct the package.

| Boundary | Verified Wave 1 side | Actual Core v0.2 | Decision |
|---|---|---|---|
| Manifest/hash/exports | No Core manifest in four verified ZIPs | UNVERIFIED | BLOCKER |
| Runtime/peer dependencies | Node 24.14.1; npm 11.11.0; React 19.2.8; TS 5.8.3; Vite 6.4.3; Vitest 4.1.10; Playwright 1.62.0 | UNVERIFIED | Direct import unapproved |
| Stable IDs/correlation | S1 byte-preserving branded IDs | UNVERIFIED | Probe wrong-session and byte preservation |
| Mastery | S1 categorical; S2 numeric/boolean | UNVERIFIED | BLOCKER; no inferred transform |
| Misconceptions | S2 provisional adapter discards detail | UNVERIFIED | Preserve opaque outcome ref; approved low-detail projection only |
| Prerequisites | S1 structured; S2 boolean | UNVERIFIED | BLOCKER; no collapse/expansion |
| Uncertainty | S1 insufficient-evidence vs S2 inconclusive/null | UNVERIFIED | BLOCKER |
| Correct/reteach | S2 guesses two values | UNVERIFIED | Retire guessed Core DTO |
| Pacing outcome | S2 guesses success/inconclusive | UNVERIFIED | Must be explicit Core projection |
| Reteaching | S2 local enum | UNVERIFIED | Required before assembly |
| Tutoring safety | S1 has bounded intervention evidence, no command protocol | UNVERIFIED | BLOCKER |
| Visual board | S3 hard-coded `SegmentDefinition` board | UNVERIFIED | Add validated command interpreter and accessible equivalent |
| Spoken turns/captions | S3 current-utterance/caption UI | UNVERIFIED | Plain validated DTO plus fallback |
| Transcript | S3 accepts transcript text/`ReactNode`; S1 excludes body | UNVERIFIED | Reference-only Study Engine projection |
| Adult review | S1 category/status/basis refs | UNVERIFIED | BLOCKER |
| Review priority/kind | S4 provisional enums assume Core authority | UNVERIFIED | No integration inference |
| Romeo support | S4 untyped string | UNVERIFIED | Use `StudyPlanId` unless real Core provides a more specific ref |
| Version quarantine | S1 canonical quarantine | UNVERIFIED | Required at Core seam |
| Node/browser split | S2 ES2022/no-DOM; S3 browser React ESM | UNVERIFIED | Dependency-neutral JSON sidecar is safe |

## Twenty blocked compatibility probes

| ID | Probe | Status |
|---|---|---|
| TC-P00 | Archive safety, inventory, SHA-256 | NOT RUN — missing artifact |
| TC-P01 | Manifest ID/version/module/exports/engines/dependencies/peers | NOT RUN |
| TC-P02 | Isolated Node ESM import without side effects | NOT RUN |
| TC-P03 | Vite browser build and duplicate-React detection | NOT RUN |
| TC-P04 | Supported version and old/future/unknown quarantine | NOT RUN |
| TC-P05 | Opaque ID, wrong-session, and timestamp integrity | NOT RUN |
| TC-P06 | Exhaustive mastery mapping and unknown values | NOT RUN |
| TC-P07 | Misconception preservation/minimization | NOT RUN |
| TC-P08 | Prerequisite and uncertainty without boolean collapse | NOT RUN |
| TC-P09 | Correction/reteaching directive mapping | NOT RUN |
| TC-P10 | Safety refusal/escalation/adult-review precedence | NOT RUN |
| TC-P11 | Board command validation, quarantine, text equivalent | NOT RUN |
| TC-P12 | Spoken-turn/caption equivalence and audio fallback | NOT RUN |
| TC-P13 | Transcript-reference-only projection and exclusion fuzzing | NOT RUN |
| TC-P14 | Adult-review evidence basis/reference | NOT RUN |
| TC-P15 | Core-authorized review kind/priority projection | NOT RUN |
| TC-P16 | Duplicate/out-of-order/replay/conflict behavior | NOT RUN |
| TC-P17 | Refresh/resume without duplicate Core invocation | NOT RUN |
| TC-P18 | Romeo support reference resolution/lifecycle | NOT RUN |
| TC-P19 | TypeScript compile in Node and browser configurations | NOT RUN |

Machine form: [`tutor-core-compatibility.v1.json`](../../reconciliation/tutor-core-compatibility.v1.json).

