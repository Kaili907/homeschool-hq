# Manuel Academy — Ready for Life & Financial Literacy Student Work

Student-facing task sheets and separately-stored parent/adult scoring records
for a representative slice of the Ready for Life (RFL) and Financial Literacy
(FinLit) courses, spanning grades 3, 4, 5, 7, 8, and a representative high
school grade (9).

See `corpus-manifest.json` for exact scope and what is not yet covered.

## What is here

```
curriculum-production/student-work/ready-for-life-financial-literacy/
  corpus-manifest.json        scope, counts, and what is not yet covered
  schema/                     JSON Schema for the task sheet and scoring record
  packages/{subject}/grade-XX/    student-facing task sheets — no answers, no rubric criteria
  scoring/{subject}/grade-XX/     parent/adult-only answer keys and rubrics
  src/                         types, corpus loader, validators, gate projection
  tests/                       vitest suite exercising the real validators and the real
                                src/curriculum/production-quality gate against this corpus
  tooling/                     standalone vitest + tsconfig, not wired into root config
```

The task sheet and scoring record are separate files on purpose, the same
separation the mathematics student-work package (`curriculum-production/
student-work/mathematics/`) established. A learner-facing renderer loads only
`packages/…`, so it cannot expose an answer, rubric criterion, or attestation
mechanics even by mistake.

## The attestation rule this package exists to enforce

> A learner click alone may never certify an adult-observed task.

This is not new policy invented here. It is the existing, real
`study-integration.json` `sign_off` contract already shipped for the grade
3/4 courses (`certifying_actor: "household-authorized guardian"`,
`student_self_report: "recorded-but-not-certifying"`), referencing the real
runtime contracts at `src/study/types.ts :: StudyLessonPlan.masteryAuthority`
and `src/study/family-pilot/parent/actions.ts :: acknowledgeReview`. Grades
5, 7, 8, and 9 do not ship a structured `study-integration.json` file, but
every one of their lesson records states the identical policy in prose
(`"Guardian visibility is required for heat, knives or sharp tools,
appliances, chemicals, medication, transportation, online accounts, or
unfamiliar hazards"`; the grade 9 records add outright: `"Completing a
lesson step never certifies a real-world adult-supervised task; guardian
sign-off is recorded separately before such a task counts as evidence"`).
This package formalizes that same rule into a structured `completionAuthority`
/ `signOff` field on every package, for every grade band, rather than
inventing a different one.

`src/validate.ts :: computeCompletionStatus` is the enforcement point: a
`completionAuthority: "guardian"` package can never reach `CERTIFIED` from a
`LearnerAssertion` alone — only a distinct `AdultAttestation`, sourced from a
household-authorized guardian, can certify it.
`tests/attestation.test.ts` proves this against every guardian-authority
package in the real, authored corpus, not a single hand-picked example.

Every `realWorldAction: true` package also carries a non-null
`simulationAlternative`, so a learner without safe access to the real
materials, adult, or setting still has a way to complete the lesson (the
"simulation alternatives" requirement).

## Financial Literacy safety

Every financial-literacy package is `isFictionalSimulation: true`,
`realWorldAction: false`, and `completionAuthority: "learner"` — no
financial-literacy lesson ever asks for, or depends on, a real account,
balance, or purchase. `financialSafety.neverRequestsRealCredentials` and
`.noIndividualizedAdvice` are asserted on every financial-literacy package,
and `src/validate.ts :: lintNoRealCredentialRequests` scans authored text for
patterns that would themselves request a real bank account, card, PIN,
password, or SSN. Several lessons (G3 "keeping money information private",
G5 "fraud and password safety", G8 "identity theft and cybersecurity", HS9
"verifying a request independently") teach learners to *recognize and refuse*
exactly these requests using fictional example messages; the lint strips
quoted fictional example text before matching so that teaching the pattern is
never itself flagged as making the request.

No lesson gives individualized financial advice — every task works a stated,
fictional scenario with fixed inputs (Sam's $10.00, Priya's $8.00 allowance,
Theo's $84.00 goal) rather than the learner's own real finances.

## Scoring authority

- **Financial Literacy** always uses `ANSWER_KEY`, matching
  `src/curriculum/production-quality`'s requirement that
  `MATH_STRUCTURED_FINLIT` lessons carry a fixed answer key. Numeric items
  are independently recomputed (`verification.method: "recomputed"`) from
  the item's own stated scenario values; short/extended-response items carry
  an asserted model answer and the specific criteria an acceptable response
  must meet (`verification.method: "asserted-fixed-value"`).
- **Ready for Life** uses `RUBRIC` or `SCORING_JUDGMENT`, matching
  `ARTS_RFL_PE_PROJECT`'s rubric/judgment authority. Every rubric carries the
  same non-diagnostic guard used across the rest of this monorepo: *"Do not
  infer effort, motivation, diagnosis, or character from an error."*

## Content specificity

`src/curriculum/production-quality/specificity.ts` is a real, shared
heuristic that routes templated-looking scaffolds (title interpolated into
generic boilerplate, under 25 words, fewer than 8 distinct content words) to
human review. The source `curriculum-content` lesson records are
templated placeholders by design (e.g. an RFL lesson literally titled
"Application or project: handwashing a small item" whose generated
`student_activity` field reads "Learner completes a new application of
handwashing a small item…" verbatim) — they were never meant to ship
directly to a learner. Every package authored here replaces that scaffold
with genuinely specific, concrete task content, and `tests/
specificity.test.ts` runs the real heuristic against every authored
objective, scenario, remediation, extension, and combined task block to
verify that, rather than asserting it.

## Production Quality Gate

`src/gateProjection.ts` projects this corpus into the shared,
curriculum-branch-agnostic `LessonProductionInput` contract from
`src/curriculum/production-quality` (added in this monorepo's `aee3e51`,
merged separately from this branch and imported read-only here — nothing in
`src/curriculum/production-quality` was modified to make this corpus pass)
and calls the real `evaluateCourseProductionReadiness`.

Result as of this branch: **both `ready-for-life` and `financial-literacy`
course-level statuses are `READY`** — every one of the 24 authored lessons
reaches `READY` with zero `NOT_READY` and zero `NEEDS_HUMAN_REVIEW` results.
`tests/gate.test.ts` asserts this against the live gate code, not a cached
or hand-written summary.

## Known limitations

This is a vertical slice, not full-course coverage. See `corpus-manifest.json`
`notCovered` for exact numbers: each source course has 36 lessons (72 for
grade-8 financial-literacy), and only 2 per course are built here. HS grades
10-12 are not covered; grade 9 stands in as the representative HS band.
Extending coverage to the remaining lessons is mechanical repetition of the
pattern already established and validated here (author task sheet + scoring
record following schema/, run the same validators and gate), not open design
work — it was not attempted here rather than being faked.

Grades 5, 7, 8, and 9 do not have a structured `study-integration.json`
guardian sign-off file the way grades 3/4 do; this package's `completionAuthority`
/ `signOff` fields extend the same real, cited policy to those grades based on
their lesson records' own prose statement of an identical rule, but a
structured `study-integration.json` for those grades does not exist upstream
and was not created here (out of scope: this package owns
`curriculum-production/student-work/ready-for-life-financial-literacy/**`
only, not `curriculum-content/**`).

## Regenerating / extending

This corpus is hand-authored, not procedurally generated (life-skills and
financial-literacy task content does not admit the same seeded-generator
approach the mathematics student-work package uses for arithmetic items). To
add a lesson: author a `packages/{subject}/grade-XX/*.package.json` matching
`schema/task-sheet.schema.json`, a matching
`scoring/{subject}/grade-XX/*.scoring.json` matching
`schema/scoring-record.schema.json`, then rerun the tests below — `loadCorpus.ts`
picks up every `*.package.json` under `packages/` automatically.

## Tests

```bash
npx vitest run --config curriculum-production/student-work/ready-for-life-financial-literacy/tooling/vitest.config.mts
```

```bash
npx tsc --noEmit -p curriculum-production/student-work/ready-for-life-financial-literacy/tooling/tsconfig.json
```

The repository's root vitest and tsconfig only cover `src/`, `tests/`,
`scripts/`, `supabase/`, and `netlify/`. This directory ships its own configs
rather than modifying shared configuration that this branch does not own.
