# Manuel Academy — Mathematics Student Work

Student-facing mathematics work materials and separately-stored parent/teacher
answer keys, generated for every completed Mathematics lesson in Grades 5, 7, 8,
9, 10, 11, and 12.

Grades 3 and 4 are **not** included: that Mathematics authoring branch is still
moving, so no materials are produced for it yet.

## What is here

```
curriculum-production/student-work/mathematics/
  corpus-manifest.json          counts by grade and course, and answer-authority totals
  schema/                       JSON Schema for both artefacts
  packages/grade-XX/            student projection, one file per lesson — NO answers
  answer-keys/grade-XX/         answers, checking reasoning, common errors
  src/                          generators, emitter, validators
  src/hs/                       authored item generators for grades 9-12
  tests/                        vitest suite
  tooling/                      runner, vitest config, tsconfig
```

The two projections are separate files on purpose. A learner-facing renderer
loads only `packages/…`, so it cannot expose an answer even by mistake. A
validator enforces this: no graded item may carry `answerIndex`, `given`,
`solutionReasoning`, `commonErrors`, or any other answer-bearing field, and the
serialized package must not contain those keys at all.

Worked examples are the deliberate exception. An instructional example shows its
own solution to the learner — that is what makes it instructional — so it is
marked `kind: "worked-example"` and has no answer-key entry.

## Package structure

Each lesson produces one package whose sections are chosen from the **lesson's
authored phase**, not from a single template. The eighteen phases in the course
cycle map to eighteen different compositions:

| Phase | Profile | Shape |
| --- | --- | --- |
| Launch and diagnostic | `diagnostic-launch` | 1 example, 5 low-difficulty probes, 2 mastery |
| Concept model A / B / C | `concept-model-*` | 1–2 examples, guided, independent, mastery |
| Guided practice A / B | `guided-practice-*` | heavy guided support, fading |
| Independent application A | `independent-application` | 1 example, 8 independent, 3 mastery |
| Investigation, Seminar | `investigation`, `problem-seminar` | reasoning and justification, extension work |
| Reteach, Targeted correction | `reteach`, `targeted-correction` | two-format examples, error-pattern practice |
| Skill consolidation, Assessment preparation | `consolidation`, `assessment-preparation` | volume and fluency |
| Performance task planning / build | `performance-*` | modelling choice, then execution |
| Transfer challenge | `transfer` | unfamiliar contexts, hardest items |
| Unit assessment | `unit-assessment` | 12 mastery items, no support |
| Publication / reflection | `publication-reflection` | explanation and reflection |

Within a unit, item types rotate by the lesson's `dayInUnit`, so two
concept-model days in the same unit exercise different content rather than the
same questions with different numbers.

## Answer authority

Every fixed-answer item has a deterministic authoritative answer. How that
answer is established is recorded per item in `verification.method`:

- **`recomputed`** — an oracle in `src/hs/` recalculated the answer from the
  item's own generation parameters, on a code path that does not reuse the code
  that built the item. `makeHsUnitBank` runs this oracle on every generated item
  and **throws** if the two disagree, so a wrong answer cannot reach the corpus.
  This covers all of grades 9–12.
- **`generator-authority`** — the answer comes from a canonical curriculum
  generator in `src/curriculum/`, whose arithmetic is independently verified by
  its own oracle test suite (named in `verification.oracle`). Those generators
  and their oracles already existed; they are not re-implemented here. This
  covers grades 5, 7, and 8.

No answer is accepted merely because a language model produced it.

`given` records the item's generation parameters so a reviewer can re-derive the
answer without running any of this code.

## Checking a student's work

`solutionReasoning` is about **this** item, using this item's numbers.

`referenceExample` is a **different problem**: the canonical generators store one
authored teaching example per item type rather than per item, so that example
demonstrates the method but does not solve the item beside it. It is named
`referenceExample` precisely so no renderer can present it as the item's
solution.

## Regenerating

From this directory:

```bash
node tooling/run.mjs src/generateCorpus.ts .
```

Generation is deterministic: seeds derive from the corpus version and lesson id,
so the same inputs reproduce the corpus byte for byte. The script validates
every package as it writes it and exits non-zero if any check fails.

## Tests

```bash
npx vitest run --config tooling/vitest.config.mts
```

```bash
npx tsc --noEmit -p tooling/tsconfig.json
```

The repository's root vitest and tsconfig only cover `src/`, `tests/`,
`scripts/`, `supabase/`, and `netlify/`. This directory ships its own configs
rather than modifying shared configuration that this branch does not own.

## Validators

`src/validate.ts` runs on every emitted lesson:

- `lessonRef-exists` — the package's lesson id matches an authored lesson record
- `course-identity` — course id, grade, and unit number match the source
- `standards-match-source` — package standards are exactly the lesson's standards
- `item-standard-in-lesson` — every item tests a standard the lesson claims
  (a sub-standard such as `8.EE.8a` counts as covering its parent `8.EE.8`)
- `question-refs-unique` — no duplicate refs within a package
- `answer-refs-resolve` — every key entry maps to a graded item, and each
  multiple-choice `answerIndex` points at the keyed answer
- `no-missing-key-for-fixed-answer-item` — every graded item has an answer
- `no-answer-leakage` — no answer-bearing field on any graded item
- `difficulty-retained` — every item carries a difficulty of 1, 2, or 3
- `distinct-prompts` / `distinct-choices` — no repeated question or option

## Review findings

A mathematics accuracy reviewer independently worked 84 sampled items spanning
every grade. **No keyed answer was wrong**, and every multiple-choice
`answerIndex` pointed at its keyed answer. The defects it found were in
distractor construction and prompt rendering, and were addressed as follows.

Fixed in this branch:

- Distractors equal in value to the answer but written differently (`√576`
  beside `24`, `32/40` beside `4/5`). `src/numericForm.ts` now parses integers,
  fractions, and radicals and rejects any draw whose distractor pool contains
  the answer's value in another form; `no-equivalent-distractors` enforces it on
  every emitted item. The reviewer found this defect in a canonical Grade 8 unit,
  and the new guard immediately caught the same mistake in this branch's own
  Grade 9 radical item, which had offered the unsimplified `√radicand`.
- A Grade 10 transformation item gave only one vertex, which could not
  distinguish a 180° rotation from a translation. It now gives two vertices, and
  the reasoning shows explicitly why no translation fits.
- A Grade 11 rational-expression prompt was missing parentheses around its
  numerator, so it parsed wrongly as written.
- A Grade 11 conditional-probability item drew its distractors from unrelated
  scenarios, making it solvable by topic-matching alone. Its distractors are now
  wrong readings of the item's own scenario.
- A Grade 11 trigonometric item rendered its period as `2π/2` instead of `π`.

Open, in source curricula this branch does not own:

- The Grade 8 scientific-notation generator samples exponents without a realism
  constraint, producing physically absurd magnitudes (an "8 × 10³ metre" cell).
  The arithmetic is correct; the context is not.
- A Grade 7 probability generator renders a simulated count into the prompt
  without recording it in the item's parameters, so that item cannot be
  re-derived from `given` alone.

## Known limitations

**Grade 5, 7, and 8 solution reasoning does not derive the answer.** Those
generators expose their parameters but no per-item derivation, and their authored
worked example belongs to the item *type* rather than the item. The answer key
therefore states the item's own quantities, names the method and the reference
example that demonstrates it, and says plainly that the answer is asserted from a
test-verified generator rather than derived in place. Grades 9-12, whose
generators are authored here, ship genuine step-by-step derivations. Closing this
gap means writing a per-item-type oracle for each of the 276 canonical item
types; that work was not attempted here rather than being faked.

Grade 7 emits 168 instructional examples rather than 180. Twelve of its lessons
fall in phases calling for two worked examples, but the canonical Grade 7 units
that back them ship a single authored teaching example shared across all their
item types — there is no second distinct example to show. Rather than print the
same example twice on one worksheet, the emitter shows the one the unit has.
Adding a second example per item type to those canonical units would resolve it;
that is source-curriculum work and is out of scope for this branch.
