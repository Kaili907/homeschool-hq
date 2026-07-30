# Adversarial Validation Agent Report

## Scope

This review attacked only the CARD 2 study-engine implementation owned by this
session. It did not modify tutor core, contracts, schemas, UI, integrations,
parent features, persistence, authentication, deployment, or any external
system.

The adversarial tests are in
`tests/engine/adversarial/`. They use deterministic fixtures and seeded hostile
loops; they do not require network access, a database, learner records, or
wall-clock time.

## Safety model tested

The engine is expected to fail closed or conservatively when evidence is sparse,
conflicting, malformed, non-comparable, or contaminated. A safe response means
one of the following, depending on the API:

- `insufficient_data`, `manual_review`, or an adult-review flag;
- a bounded `maintain`, `decrease`, break, resume, or finish action;
- `Insufficient evidence`;
- blocked practice;
- a typed validation error before any recommendation is produced.

The tests also require static, non-diagnostic output, no blame or permanent
attention claims, no punitive treatment of approved breaks, no unbounded
duration changes, no phase skipping, no tutor-core authority substitution, and
no reflection of accidental extra PII fields.

## Attack matrix

| Surface | Hostile cases |
| --- | --- |
| Focus | zero through four sessions; different subject/task; limited, interrupted, technical, or duration-incomparable records; 3/5 and 4/5 success; `too_long` conflict; all grade bands over durations 1–180; >10% policy; configured and parent caps; all parent override modes; NaN/infinity/negative/null; malformed evidence; deterministic replay; accidental PII |
| Evidence | technical signal combined with optimistic and rapid-answer signals; equal-rank fatigue/frustration conflict; rapid random-like answers; approved breaks; inconsistent attempt totals; invalid enums, booleans, ratios, and counts; seeded 250-case replay and privacy loop |
| Breaks | planned/requested/movement/water/screen-rest/reset paths; refusal; three-stage extension loop and hard stop; repeated-break escalation; approved-break neutrality; NaN/infinity; invalid history/policy/current break; malformed runtime booleans and collections; accidental PII |
| Review | retrieval failure plus otherwise perfect evidence; prerequisite gap plus repeated success; aggressive extension settings; maximum interval; NaN/infinity/out-of-range proportions; DST and cross-time-zone date boundaries; accidental PII |
| Interleaving | no attempts, missing prerequisite, low accuracy; configuration attempting to erase readiness floors; unmastered/unready/weak/difficulty-mismatched candidates; item counts 1–40; context-switch caps 0–8; 20 competing skills; negative rotation; deterministic replay; accidental PII |
| Orchestrator | every wrong first event; forged phase and history; locally invented core directive; impossible timestamp; full ordered cycle; finished-state mutation; deterministic replay; accidental PII |
| Adapters | version mismatch; session mismatch; invalid timestamp/directive; allowlist behavior; fixed errors that do not echo PII |
| Jarvis | required forbidden phrases; contractions and paraphrases; diagnostic, permanent, blaming, coercive, and punitive prompt injection; invalid runtime break label; >5-minute and >10% claimed “small” increase; all default templates; accidental extra PII fields |

## Weaknesses found and regression coverage

The first hostile run identified these concrete source weaknesses:

1. Common unsafe-language paraphrases bypassed the coach-language inspector.
2. An unknown break label rendered the word `undefined`.
3. A 100-minute duration delta could be described as a “small increase.”
4. Interleaving configuration could reduce all readiness thresholds to zero.
5. A forged orchestrator state could complete instruction without a tutor-core
   directive.
6. Malformed break booleans were silently reinterpreted.
7. Internally inconsistent attempt totals were not marked invalid.

Regression tests were added for every case. The lead agent and owning agents
hardened the relevant source rather than weakening the tests.

A second, broader pass added common modifier-based language injections, forged
history with a plausible directive, impossible calendar instants, malformed
break collections and nested flags, and invalid evidence enums/booleans. Those
cases are also retained as regression tests.

## Cases safely rejected, capped, or neutralized

- Fewer than five comparable focus sessions cannot cause an automatic change.
- Three successes out of five maintains duration; an increase requires at
  least four out of five and no `too_long` response.
- Focus increases stay within the 10% limit, grade-band step, configured cap,
  and parent cap.
- Invalid top-level focus data routes to `manual_review` with finite numeric
  output.
- Parent hold, reduction, review, and disabled-increase choices take priority.
- Approved breaks always have `countsAsFailure: false`.
- Extension requests stop at both the extension cap and total-break cap.
- Repeated approved breaks trigger adult review without revoking the immediate
  break.
- Conflicting evidence returns `Insufficient evidence`; a technical event
  contaminates optimistic inference.
- Rapid random-like answers are described only as possible disengagement, never
  a diagnosis.
- Retrieval failure and prerequisite gaps dominate high accuracy, independence,
  confidence, and success streaks; review returns to same-day support.
- Review extension and maximum-interval settings remain bounded.
- Date arithmetic remains stable at daylight-saving and cross-time-zone
  boundaries because due dates are calendar dates.
- Premature interleaving remains blocked, review candidates require explicit
  prior mastery, and context switches never exceed their cap.
- The orchestrator rejects out-of-order events, core-directive invention,
  phase-skipping state, and post-finish mutation.
- Provisional adapters allowlist output and return fixed errors without
  reflecting extra source data.
- Jarvis rejects prohibited, diagnostic, permanent-capacity, blaming, coercive,
  and punitive language as well as invalid or overly aggressive duration copy.

## Privacy validation

Hostile inputs included extra `studentName`, `email`, `birthdate`, `diagnosis`,
`transcript`, `rawAnswer`, and notes-like fields. Focus, evidence, break,
review, interleaving, orchestrator, adapter, and prompt outputs were serialized
and checked for both field names and sentinel values. The adapter allowlists its
minimal provisional shape. The tests use synthetic `.invalid` addresses only.

These checks verify non-reflection, not re-identification resistance. Opaque
references must still be created upstream and must not encode direct identity.

## Determinism

Deterministic checks include:

- 50 repeated focus recommendations over a seeded 75-session history;
- 250 seeded evidence classifications, each replayed twice;
- 50 interleaving replays with negative rotation;
- 50 complete orchestrator replays;
- fixed calendar-date and time-zone fixtures.

No test depends on current time, locale guessing, random system entropy, or
external state.

## Commands

Targeted adversarial suite:

```text
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/tests/engine/adversarial
```

Full owned engine suite:

```text
node node_modules/vitest/vitest.mjs run adaptive-tutor/study-engine/tests/engine
```

Typecheck:

```text
node node_modules/typescript/bin/tsc -p adaptive-tutor/study-engine/engine/tsconfig.json --noEmit
```

## Final result

Verification against the final source snapshot:

- Adversarial suite: **5 files passed, 67 tests passed, 0 failed**.
- Full owned engine suite after lead integration fixtures: **21 files passed,
  325 tests passed, 0 failed**.
- TypeScript: **passed with no diagnostics** using the engine `tsconfig.json`.

The final rerun confirmed that all weaknesses found during the first and second
hostile passes are rejected, capped, neutralized, or routed conservatively.

## Known limitations

- Regex-based output inspection is a defense-in-depth control, not a complete
  natural-language safety classifier. New learner-facing free-text surfaces
  must pass the same guard and receive adversarial review.
- The study engine trusts the tutor core’s authorized integration
  boundary for mastery and misconception decisions; it cannot authenticate the
  source by itself.
- Extra-field non-reflection does not make opaque identifiers anonymous if an
  upstream system embeds identity in them.
- Timing, accuracy, pause, and confidence signals can be noisy. The engine
  intentionally returns uncertainty or adult review rather than a diagnosis.
- Calendar dates avoid daylight-saving duration errors, but the upstream caller
  must supply the learner’s configured IANA time zone.
- Property-style loops are deterministic bounded matrices, not exhaustive proof
  over all JavaScript values.
