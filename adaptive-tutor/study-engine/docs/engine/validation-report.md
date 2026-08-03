# Session 2 study-engine validation report

## Result

The owned Study-Engine source, prompts, and tests pass the final local gates:

- **21 test files passed**
- **325 tests passed**
- **0 failed, skipped, or todo**
- **TypeScript strict typecheck passed with no diagnostics**
- **Adversarial suite: 5 files, 67 tests passed**

Commands:

```text
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/tests/engine
node node_modules/typescript/bin/tsc -p adaptive-tutor/study-engine/engine/tsconfig.json --noEmit
```

No network, database, authentication, identity, storage, deployment, Supabase,
or GitHub operation was used.

## Requirement coverage

| Requirement | Verification |
| --- | --- |
| Ordered session cycle | Valid full-cycle, break/resume, continue, finish, invalid transition, forged state/history, and deterministic replay tests |
| Tutor-core authority | Core directive required; invented directives, phase skipping, and forged instruction completion rejected |
| Focus recommendations | Exact five-value vocabulary, five comparable sessions, 4-of-5 increase threshold, grade bands, 10% bound, caps, overrides, sparse/conflicting data |
| Evidence classifier | All ten categories, supplied examples, sparse/conflicting/contaminated data, malformed signal rejection |
| Break workflow | All seven types, planned/requested/refused/resume/extend, repeated escalation, maximum session, loop bounds, approved-break neutrality |
| Review scheduling | Configurable 0/1/3/7/14/30 sequence, every required evidence input, failure/prerequisite precedence, caps |
| Time-zone safety | Real calendar-date validation, leap years, DST boundaries, cross-zone instant conversion, impossible-date rejection |
| Interleaving | Initial blocked, transition, mixed, mastered insertion, readiness floors, difficulty balance, context-switch caps |
| Jarvis prompts | All twelve moments, learner choice, duration bounds, safety guard, hostile context injection rejection |
| Privacy | Extra identity/contact/diagnosis/transcript/answer fields not reflected; fixed adapter errors |
| Determinism | Explicit timestamps, canonical ordering, seeded property matrices, repeated replay, fixed trace fixtures |
| Provisional contracts | Versioned local adapters, runtime allowlists, exact reconciliation report |

## Sample recommendation traces

Executable fixtures and documented outputs cover:

1. High-school `increase`: 40 to 44 minutes after four successful comparable
   sessions out of five, bounded by ten percent and a parent cap.
2. Conflicting duration feedback: `manual_review`, with no duration change.
3. High accuracy plus unexplained pauses: `Insufficient evidence`, with fatigue
   and interruption retained only as alternatives.
4. A third approved requested break: immediate water break remains approved,
   `countsAsFailure: false`, and adult review is flagged.
5. Retrieval failure: same-day review after reteaching, not a forced immediate
   retry.
6. Only two independent attempts: interleaving remains blocked despite high
   observed accuracy.
7. Tutor-core `reteach`: session routing records the directive without deriving
   it locally.

See `sample-session-traces.md` and
`tests/engine/traces/sample-traces.test.ts`.

## Unsafe or incorrect recommendations rejected

The adversarial agent deliberately attacked every engine surface. Passing
regressions now cover:

- focus increases from zero to four sessions, non-comparable padding, three of
  five successes, too-long feedback, malformed records, NaN/infinity, more than
  ten percent, grade-band overflow, configured caps, and parent overrides;
- blaming attention/focus language, direct and hedged diagnoses, fixed or
  permanent capacity claims, punitive break language, invalid prompt labels,
  injected unsafe context, and a 100-minute change described as small;
- malformed break booleans, flags, histories, and active-break shapes;
- extension requests beyond elapsed timers, extension caps, and total break
  caps;
- conflicting evidence, inconsistent attempt totals, invalid enums, invalid
  proportions, and diagnostic interpretations of rapid answers;
- optimistic retrieval fields combined with explicit failure or a prerequisite
  gap;
- review-extension settings above the safety maximum and invalid dates/zones;
- configuration attempts to reduce interleaving readiness evidence to zero,
  unmastered candidates, difficulty jumps, and excess context switches;
- orchestrator phase skipping, locally invented core outcomes, forged state and
  history, impossible timestamps, and post-finish mutation; and
- accidental direct identifiers or raw learning content reflected through
  output.

The detailed attack matrix is in
`adversarial-validation-agent-report.md`.

## Delegation record

- Focus Algorithm Agent: focus source, focused tests, and focus notes
- Break and Fatigue Agent: break/evidence source, tests, and notes
- Retrieval and Spacing Agent: review/interleaving source, tests, and notes
- Adversarial Validation Agent: five hostile suites and attack report
- Lead agent: orchestration, provisional adapters, safety guard, Jarvis
  templates, cross-engine traces, hardening integration, final gates, reports,
  and packaging

All delegated authoring was file-disjoint. Final integration and gates remained
with the lead agent.

## Contract assumptions

- Session references and skill keys are opaque and do not encode identity.
- Grade band is provided without exact age or birthdate.
- Subject and task comparability uses stable canonical keys.
- Tutor core supplies authoritative success, prerequisite, mastery,
  misconception, and reteaching outcomes.
- Parent overrides and caps arrive as already-authorized configuration.
- Instants use real ISO 8601 values with explicit offsets.
- Review due dates are learner-local `YYYY-MM-DD` calendar dates.
- The caller supplies the configured IANA time zone when converting an instant.
- Break history and review/interleaving progress state are supplied by the
  orchestrator or future integration layer.

See `provisional-adapter-report.md` for the exact ten-step reconciliation list.

## Known limitations

- No canonical Session 1 contract or core package was available for compile-time
  integration testing.
- Pure functions do not persist break history, review progress, or rotation
  state.
- Same-day review is a calendar date, not an exact retry time; orchestration
  must coordinate reteaching and breaks to avoid rapid loops.
- Regex language inspection is defense in depth, not a complete semantic safety
  proof. New learner-facing free text needs equivalent review.
- Evidence signals may be noisy. Ambiguous combinations intentionally return
  uncertainty or adult review.
- Focus comparability is normalized exact subject/task matching, without a
  fuzzy taxonomy.
- Interleaving uses abstract skill slots and a local bounded difficulty scale;
  tutor core must choose actual instructional items.
- IANA date conversion depends on the JavaScript runtime's `Intl` data.
- Parent/teacher review is a routing signal only; this package does not contact
  anyone.
- Non-reflection of extra fields does not make an upstream identifier anonymous
  if identity was embedded inside it.
