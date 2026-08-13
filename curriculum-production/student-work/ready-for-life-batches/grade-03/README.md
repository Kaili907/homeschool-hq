# Ready for Life — Grade 3 batch

Scope: **Grade 3 Ready for Life only.** This directory owns
`curriculum-production/student-work/ready-for-life-batches/grade-03/**`
exclusively. It is a self-contained corpus (own schema copies, own tooling,
own tests) so it can be authored and merged independently of sibling
per-grade batches and of the pre-existing `ready-for-life-full/` and
`ready-for-life-financial-literacy/` directories, which are read-only
reference material here, not modified by this batch.

## The derived inventory — re-derived from source, not assumed

The requested shape (36 Grade 3 Ready for Life lessons) was **not** trusted
blindly. It was re-derived directly from source and confirmed exact:

```
git show mac/g34-rfl-finlit-r1:curriculum-content/manuel-academy/1.0.0/grades/grade-3/courses/ready-for-life/lessons.jsonl | wc -l
# => 36
```

**36 lessons, exactly** — 6 units ("Taking Care of My Own Space", "Clothes
and Getting Ready", "Kitchen Helper Safety", "Body Signals and Fueling My
Day", "Time, Belongings, and Asking for Help", "Family Helper Capstone") of
6 lessons each, matching the course-guide scope-and-sequence table. Full
per-lesson inventory (`lessonId`, unit/day/phase/focus/title, stage,
provenance): [`inventory.json`](inventory.json), asserted against by
`tests/inventory.test.ts`, which also confirms **all 36 lessons are
authored** (this batch is the complete set, not a sample).

This task's instructions required failing loudly if the re-derived count
differed from the expected 36. It did not differ, so authoring proceeded.

## What this batch contains

**All 36 of 36 Grade 3 Ready for Life lessons are authored** — a complete
grade, not a sample:

- **2 lessons reused, not re-authored**: `swk-rfl-g3-u01-l02` ("the
  five-minute tidy") and `swk-rfl-g3-u03-l04` ("helper tools and adult-only
  tools") already existed, gate-passing and subagent-reviewed, in
  `../ready-for-life-full/packages/ready-for-life/grade-03/`. Their
  provenance and fit were verified against this batch's schema (byte-for-byte
  compatible — same schema version, same field shapes) before copying, per
  this task's instruction to reuse rather than create a second divergent
  version.
- **34 lessons newly authored**, one unit at a time by six independent
  authoring passes (one per unit, each blind to the others' output, so no
  lesson could be produced by copying a sibling unit's template). Every
  lesson's `objective`, `scenario`, `tasks`, `remediation`, and `extension`
  are lesson-specific — the source `lessons.jsonl` only varies a `focus`
  phrase across one boilerplate template (verified by inspecting the raw
  records), so nothing here was produced by substituting that phrase into
  fixed scaffolding. A dedicated duplicate/generic-content detector
  (`src/duplicateCheck.ts`, pairwise Jaccard content-word similarity across
  every `objective`/`scenario` pair in the corpus, plus a banned-generic-
  phrase and thin-objective check) found **zero** findings across all 36
  lessons (`tests/duplicate.test.ts`).

## Guardian-authority vs. learner-authority split

Per the Grade 3 course guide, real-world/guardian-observed tasks fall on
unit days 4-5 (units 1-5) and unit 6 days 4-6 — the capstone unit's
reflection is guardian-confirmed too. This batch matches that design
exactly:

- **13 lessons** are `completionAuthority: "guardian"` with
  `realWorldAction: true`, a full `signOff` block, specific `safetyNotes`,
  and a genuine equal-credit `simulationAlternative` for a learner without
  safe access to the real materials or adult availability that week.
- **23 lessons** are `completionAuthority: "learner"` — knowledge,
  planning, or low-stakes practice with no safety-critical, adult-supervised
  component, so no guardian sign-off is attached (attestation is reserved
  for lessons that genuinely need it, not applied uniformly).
- `tests/validate.test.ts` asserts every guardian-authority lesson lands
  exactly on a course-guide-designated real-world day (`*-l04`, `*-l05`, and
  `u06-l06`) — none was applied reflexively, none was skipped where the
  course design calls for it.

## Grade 3 bar

Every lesson was authored to: short sentences; concrete, one-action-at-a-time
directions; no shame language; no requirement to disclose private
family/health/income information; no purchase requirement; no photo, video,
or voice-recording proof requirement; and no assumption of a specific
parent configuration, transportation, pets, siblings, a two-parent home,
spending money, or specific household appliances. `src/validate.ts` checks
the photo/video/voice, purchase, and assumed-household-access rules by
pattern; `tests/validate.test.ts` runs it over the full corpus with zero
findings. Unit 4 ("Body Signals and Fueling My Day") carries the strictest
bar in the course — zero calorie/weight/body-size/diet/earned-food language
anywhere, including in rubric descriptors — and was authored and
independently checked against exactly that constraint.

## Infrastructure

Self-contained fork of `ready-for-life-full/`'s proven tooling, scoped to
grade 3 only:
- `schema/task-sheet.schema.json`, `schema/scoring-record.schema.json` —
  copied verbatim from `ready-for-life-full/schema/` (same contract, so
  this batch is trivially mergeable into that tree later).
- `src/types.ts`, `src/loadCorpus.ts`, `src/validate.ts`,
  `src/gateProjection.ts` — adapted 1:1 from the same sibling, with the
  shared gate import path adjusted for this directory's extra nesting
  level; `src/curriculum/production-quality` (repo root) is imported
  read-only, never modified.
- `src/schemaValidate.ts` — a hand-rolled runtime schema validator
  (mirroring both schema files' required fields, `additionalProperties:
  false`, enums, consts, and cross-field rules) added because no `ajv`
  dependency is installed anywhere in this repo — confirmed absent. This is
  an explicit "schema tests" step distinct from the TypeScript-cast-only
  guarantee `loadCorpus.ts` provides.
- `src/duplicateCheck.ts` — the mass-templating/generic-content detector
  described above; not present in the sibling corpora, added here because
  this task explicitly required duplicate/generic-content detection.
- `tests/` — `loadCorpus`, `gate`, `validate`, `schema`, `duplicate`,
  `attestation`, and `inventory` suites (7 files, 21 tests, all passing).

## Quality gate results

Run against the complete, final 36-lesson corpus:

```
npx vitest run --config curriculum-production/student-work/ready-for-life-batches/grade-03/tooling/vitest.config.mts
npx tsc --noEmit -p curriculum-production/student-work/ready-for-life-batches/grade-03/tooling/tsconfig.json
```

**Result: 7 test files, 21 tests, all passing. Typecheck: clean.**

1. **The real production-readiness gate**
   (`src/curriculum/production-quality`, imported read-only, not modified) —
   `tests/gate.test.ts`. Result: **READY**, zero `NOT_READY`, zero
   `NEEDS_HUMAN_REVIEW`, zero `MISSING_RUBRIC`, gap-summary total matches
   the actual 36-lesson corpus size.
2. **Local safety/privacy checks** — `tests/validate.test.ts`: no
   answer-bearing key leaks into any student-facing package; every
   `guardian`-authority package has correctly shaped sign-off; every
   `realWorldAction: true` package has a non-empty simulation/equal-credit
   alternative; no package requires an identifiable photo; no package
   matches a photo/video/voice-capture, required-purchase, or
   assumed-household-access pattern; every guardian-authority package lands
   on a course-guide-designated real-world day.
3. **Schema conformance** — `tests/schema.test.ts`: every package and
   scoring record validated against both schema files field-by-field.
4. **Duplicate/generic-content detection** — `tests/duplicate.test.ts`:
   zero near-duplicate objective/scenario pairs (Jaccard ≥ 0.55), zero
   generic-scaffold-phrase matches, zero thin (<6 content word) objectives.
5. **Attestation invariant** — `tests/attestation.test.ts`: a learner's own
   completion click can never certify a guardian-required task
   (`computeCompletionStatus` returns `RECORDED_PENDING_GUARDIAN_ATTESTATION`,
   never `CERTIFIED`, without a real adult attestation).
6. **Inventory integrity** — `tests/inventory.test.ts`: exactly 36 lessons,
   all grade 3, all released stage, all 6 units × 6 days present, and every
   inventory lesson has a corresponding authored package (complete
   coverage, not a partial sample).

### REQUIRES_FINAL_GATE_H3_RECHECK

Production Gate H3 is moving in parallel and has not evaluated this batch.
This result is explicitly marked for **mandatory re-check against
Production Gate H3** during convergence.

## Developmental/safety review

One subagent (this task's cap; run with no delegation capability, so the
single-reviewer constraint could not be silently bypassed) read all 36
authored lessons and their scoring records — the full corpus, not a
sample — against developmental appropriateness for an 8-9 year old,
no-shame language, prohibited-disclosure and purchase/photo/video/voice
checks, assumed-household-resource neutrality, guardian-authority
correctness against the course-guide's designated real-world days,
`simulationAlternative` genuine-equal-credit quality, Unit 4 health-policy
compliance, cross-lesson genericness, and rubric quality.

**Result: 36/36 PASS, 0 CONCERN.**

Three targeted content fixes were made ahead of the final pass, each
independently confirmed by re-reading the raw file before editing:

1. `swk-rfl-g3-u03-l02` (kitchen reset) — the safety scan originally had the
   learner personally check whether stove knobs/appliances were off, which
   contradicted the lesson's own safety note never to touch them. Reworded
   the package and scoring record throughout to an explicit look-only,
   never-touch scan, consistent with staying learner-authority on a
   non-guardian day.
2. `swk-rfl-g3-u04-l04` (eating a variety of foods) — the "Engagement
   without pressure" rubric dimension scored higher for including and
   trying an unfamiliar food, which is a soft earned-food/pressure pattern
   the governing health policy prohibits and which contradicted the
   lesson's own safety notes. Rewrote the dimension to score neutral
   naming/description of all four items regardless of familiarity, added a
   `lookFor` stating familiarity never affects the score, and removed
   value-coded "processed" language from the remediation text and a
   "least familiar" prompt.
3. `swk-rfl-g3-u05-l03` (tracking borrowed things) — the task was not
   completable for a learner with nothing currently borrowed, with no
   fallback (inconsistent with the built-in fallback already present in the
   next lesson, `u05-l04`). Added an explicit fallback path: log an item
   lent out or expected to borrow soon instead.

All three fixes were re-verified against the full test suite (still 7 test
files / 21 tests passing, see below) after editing.

## What remains

None — this batch delivers the complete 36-lesson Grade 3 Ready for Life
corpus this task requested. What remains is external to this batch:
convergence/merge into `ready-for-life-full/` alongside sibling per-grade
batches, and the mandatory Gate H3 re-check noted above.
