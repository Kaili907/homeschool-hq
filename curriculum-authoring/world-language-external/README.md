# World Language — External Course Tracking Contract

**Lane:** `mac/world-language-external-r2`
**Date:** 2026-08-12
**Input:** `mac/world-language-decision-r1`, accepted as this lane's premise (Option 2 — source externally). `decision-record.md` still reads `OPEN` in tree — see [`external-course-contract.md`](external-course-contract.md) §1
**Owns:** `curriculum-authoring/world-language-external/**` only. No file outside this path
was modified. `src/**` is untouched; `ACADEMY_SUBJECTS` is unchanged.

## Headline

**No Japanese course was invented.** This lane delivers the contract for tracking a
*genuine external* world-language course — enrolment, evidence, completion, grade,
proficiency artifact, parent verification — with Japanese as the intended first language
and **no provider chosen or endorsed in code**.

The prior decision established that the internal Japanese material is elementary-only
(declared grades 3–4, zero authored lessons, ~40 contact hours) and is not a high-school
course. This contract **denies that material as evidence by rule**, not by convention.

`NOT_GRADUATION_COMPLETE` is unchanged. `MMC_WORLD_LANGUAGE` remains `NOT_COVERED`.

## Documents

| Document | Answers |
| --- | --- |
| [`external-course-contract.md`](external-course-contract.md) | The contract: fields, identifiers, lifecycle, and the 16 enforced rules |
| [`japanese-two-year-pathway.md`](japanese-two-year-pathway.md) | The recommended 4-semester / 2.0-credit Japanese pathway, and how to choose a provider without naming one |
| [`transcript-model.md`](transcript-model.md) | How an external course prints, and the three claims a transcript may never make |
| [`integration-requirements.md`](integration-requirements.md) | What final convergence must do to introduce an eleventh subject — 7 sites carrying the subject domain, only 1 of them typed |

## Machine-readable

| Path | What |
| --- | --- |
| [`schema/external-course.schema.json`](schema/external-course.schema.json) | one term of one external course |
| [`schema/external-pathway.schema.json`](schema/external-pathway.schema.json) | an ordered sequence in one language |
| [`examples/japanese-2yr-pathway.planned.json`](examples/japanese-2yr-pathway.planned.json) | the recommended pathway, `status: planned`, provider unselected |
| [`examples/external-course.template.json`](examples/external-course.template.json) | copy-and-fill template |
| [`validate-external-course.mjs`](validate-external-course.mjs) | structure + rules + self-test, zero dependencies |

```bash
node curriculum-authoring/world-language-external/validate-external-course.mjs
```

Reports `WORLD_LANGUAGE_EXTERNAL_CONTRACT_READY` or `BLOCKED`. It runs on plain node
because this worktree has no `node_modules`, and a contract that can only be checked after
an install is a contract nobody checks.

## The rules that carry the honesty

Twenty-five rules are enforced, each with a negative fixture in `--self-test` (36 fixtures —
several rules have more than one failure mode). Five matter most:

| Rule | Effect |
| --- | --- |
| **R4** | Credit cannot be awarded without a parent-verified provider transcript and a graded source. Credit follows evidence, never intent. |
| **R5** | A proficiency level cannot be claimed without an external score report. **Proficiency is measured, never inferred from hours.** |
| **R6** | The internal elementary Japanese plan cannot appear as evidence for high-school credit — by path, by name, and by `ma-g3-`/`ma-g4-` identifier. |
| **P4 + R12** | A Novice High claim requires both an artifact and 2.0 awarded credits — at pathway level and at record level, so validating a record alone is not a way around it. This is the substitution trap from `decision-record.md` §4a, made mechanical. |
| **R11 + P7** | Awarded credit cannot exceed what was requested, per term or across the pathway. `credit.awarded` is the only credit that prints, so it is the number that must not be free. |

## Why two credits

| Constraint | Applies to this family? | Figure |
| --- | --- | --- |
| MMC world language, post-substitution | 🟥 No — binds school boards | 0.5 cr |
| U-M (LSA) admission | ✅ Yes | **2 years, same language** |
| MSU college-prep curriculum | ✅ Yes | **2 years** |
| Novice High proficiency target | Adopted as a Manuel Academy design target | 2.0 cr (**~360 hrs is extrapolated, not an MDE figure** — see below) |

Michigan states the **Novice High** target. It publishes **no** hours-per-credit figure; the
~360-hour number is extrapolated from a Carnegie-style 180 hours per credit year and must not
be attributed to MDE (`standards-and-proficiency-gap.md` §5 and uncertainties 2, 3, 10).

Buying the 0.5-credit remainder satisfies a requirement that does not bind and misses both
that do. Full argument: [`japanese-two-year-pathway.md`](japanese-two-year-pathway.md) §1.

## What is still open

- **The provider.** Unselected by design; criteria in `japanese-two-year-pathway.md` §4.
- **Option A or B** for integration — eleventh `ACADEMY_SUBJECTS` member, or a separate
  external-coursework registry. This lane recommends B and fully specifies A.
- **GPA treatment** of external grades (`transcript-model.md` §5).
- Everything `decision-record.md` §5 left with the Director: the substitutions, the
  personal-finance displacement, and whether to rely on the MMC not binding.

## Standing

A records and integration contract. **Not a legal opinion, not a curriculum, not a
purchase.** Its entire purpose is that when a genuine external course is taken, the
transcript tells the truth about it — including the truth that Manuel Academy did not
write the language lessons.
