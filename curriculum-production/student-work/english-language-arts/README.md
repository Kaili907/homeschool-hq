# Manuel Academy — English Language Arts Student Work

Student-facing ELA work materials and a separately-stored teacher/parent
scoring guide, generated for every lesson in Grades 3, 4, 5, 7, 8, 9, 10, 11,
and 12 — 9 courses, 180 lessons each, 1,620 lessons total.

Sources (read-only; nothing here modifies them):
- Grades 5, 7, 8 — the canonical `curriculum-content/manuel-academy/1.0.0`
  course package in this repo.
- Grades 3, 4 — the `mac/g34-ela-r1` branch's authoring package.
- Grades 9, 10, 11, 12 — the `mac/hs912-ela-r1` branch's authoring package.

## What is here

```
curriculum-production/student-work/english-language-arts/
  README.md
  corpus-manifest.json          per-course lesson counts and source-integrity totals
  packages/grade-XX/            student projection, one file per lesson — no rubric/answers
  scoring-guides/grade-XX/      rubric, acceptable-answer criteria, mastery/authorship notes
  src/                          adapters, package/guide builders, gate projection
  tools/generate.mjs            regenerates the whole corpus from the three sources
  tests/                        vitest suite (unit tests + the production-quality gate)
  tooling/vitest.config.mjs     standalone vitest project (see "Running tests" below)
  validation/                   gate-report.json / gate-report.md (written by the tests)
```

Every lesson emits two files:

- `packages/grade-XX/{lesson_id}.package.json` — the student projection:
  `studentTask`, `sourceReference`, `guidedSupport`, `independentEvidenceTask`,
  `remediation`, `extension`.
- `scoring-guides/grade-XX/{lesson_id}.scoring.json` — the paired teacher/
  parent-only scoring guide: a rubric built from the lesson's own
  `success_criteria`, qualitative acceptable-answer criteria, mastery
  criteria, the authorship (no-ghostwriting) policy, and a `doNotUse`
  guardrail list.

These are separate files on purpose, the same reason
`curriculum-production/student-work/mathematics` keeps `packages/` and
`answer-keys/` apart: a learner-facing renderer that only ever loads
`packages/…` cannot expose scoring information even by accident.
`tools/generate.mjs` asserts this on every write — it throws if a package
JSON ever contains the string `"scoringAuthority"`, `"rubric"`,
`"acceptableAnswerCriteria"`, `"masteryCriteria"`, or `"doNotUse"` — and
`tests/lib.test.ts` re-checks it independently.

## No fixed answer keys, no ghostwritten essays

ELA scoring authority is `RUBRIC` for every one of the 1,620 lessons — never
`ANSWER_KEY`. Nothing here manufactures a single "correct" essay, response, or
short answer for open writing. `acceptableAnswerCriteria` describes what a
qualifying response contains (evidence tied to the text, the stated success
criteria, the lesson's mastery rule) — it is never itself a model answer, and
every scoring guide restates the no-ghostwriting authorship policy already
authored into the source lessons (falling back to a standard policy statement
on the canonical grade-5/7/8 lessons, which don't carry a per-lesson
`student_authorship` field of their own).

The one place a lesson legitimately has a closed/objective component is a
`fixed_answer: true` prompt on a unit-assessment day. The source assessment
records (`assessments.json`) don't yet ship the actual item text, options, or
key for these — only a placeholder noting a key exists and is scorer-only.
This generator does not invent one. The scoring guide instead states plainly
that the objective item bank for that prompt isn't authored yet, and the
independent-evidence task tells the student it will be delivered separately.
Inventing a plausible-looking key here would be worse than leaving the gap
visible.

## Copyright: source/text references are pointers, never reproductions

`sourceReference` never contains the body of a text. It's always an id,
title, author/creator, form, a normalized rights category
(`original` / `public_domain` / `rights_required` / `unknown`), and a note on
how to obtain the actual text — mirroring the policy already stated in the
source branches' own text banks (`original-text-bank.json`,
`public-domain-register.json`, `text-bank.json`): originals ship inside the
gated course package and nowhere else; public-domain and rights-required
works are referenced, never copied in.

Grades 5, 7, and 8 (the canonical package) don't yet ship a concrete anchor
text or text bank for any lesson. Rather than inventing a title, those 40
lesson-days across grades 3-4 that also lack a `text_reference` (and every
lesson in grades 5/7/8) get a `sourceReference` that names the standards and
topic and asks the facilitator to select a grade-appropriate text — exactly
the substitution path the g34/hs912 lesson records already describe.

## Source integrity

For every lesson that does ship a concrete text (grades 3, 4, 9, 10, 11, 12),
its `text_id` is cross-checked against that grade's own text bank
(`original-text-bank.json` + `public-domain-register.json` for grades 3-4,
`text-bank.json` per course for grades 9-12). `corpus-manifest.json` records
the result per course. Current corpus: 0 `GAP`s — every shipped text
reference resolves to a real bank entry. Grades 5/7/8 correctly show
`NOT_APPLICABLE` counts (no bank exists to check against, not a fabricated
pass).

## The production readiness gate

`tests/gate.test.ts` projects the generated corpus (not the raw source
lessons) through the existing, curriculum-branch-agnostic gate at
`src/curriculum/production-quality` (`evaluateCourseProductionReadiness`),
using `subjectFamily: 'ELA_SOCIAL_STUDIES'` — the family that requires a
rubric (with optional acceptable-answer criteria) rather than a fixed answer
key, and that is not held to Math/FinLit's guided-practice or worked-example
bar. It also writes `validation/gate-report.json` and `gate-report.md` as a
side effect of running.

Current result: **1,620 / 1,620 READY**, 0 `NEEDS_HUMAN_REVIEW`,
0 `NOT_READY`. Zero `NEEDS_HUMAN_REVIEW` from this automated heuristic gate is
not the same claim as "no human should look at this" — see the review note
below.

## Human review

A single ELA scoring/source reviewer (subagent) sampled 27+ lesson pairs
spread across all nine grades, including unit-assessment days, and checked
the generated JSON directly (not just the generator code) against the three
policies above.

**Result: all three PASS at both full-corpus (automated grep across all
1,620 packages) and close-read (sampled) level.** No fabricated answer key,
no ghostwritten response, no reproduced text body, and no scoring-guide key
was found in any student package.

**One quality defect was found and fixed before this commit.** The g34
source branch (grades 3-4) authors its `lesson_flow`/`adaptive_tutor_routes`
prose from templates like `"the vocabulary {focus} requires"` and
`"the smallest prerequisite {focus} depends on"`. Those read fine when
`focus` is a short noun phrase, but every grade 3-4 lesson's `focus` field is
actually a clause (median 9 words — e.g. `"what strong readers and writers
do, and a no-penalty baseline"`), so the source's own authored sentences read
as broken English (`"the vocabulary what strong readers and writers do, and
a no-penalty baseline requires"`). This is a source-branch authoring defect
this package does not own the fix for. It was present in 100% of grade 3 and
grade 4 lessons (360/360). Since the broken text contains an exact, known
literal substring — the source's own `focus` field — `repairFocusSubstitution`
in `src/lib.mjs` swaps that literal occurrence for `"today's lesson"`, which
fits the same grammatical slot in every observed template. `tests/lib.test.ts`
has a regression test locking this in. Verified zero remaining instances of
the broken construction across all 1,620 generated lessons after the fix.

## Regenerating

From the repository root:

```bash
node curriculum-production/student-work/english-language-arts/tools/generate.mjs
```

Deterministic: the same three source branches at the same commits produce
byte-identical output (no randomness, no timestamps, no network calls).

## Running tests

The repository's root `vite.config.ts` only includes `src/`, `tests/`,
`scripts/`, `supabase/`, and `netlify/` in its vitest projects, so this
directory ships its own standalone vitest config rather than editing shared
config this branch does not own (same approach as
`curriculum-production/student-work/mathematics/tooling`):

```bash
npx vitest run --config curriculum-production/student-work/english-language-arts/tooling/vitest.config.mjs
```

## Known limitation

The `fixed_answer: true` selected-response items referenced on unit-assessment
days across all 9 courses have no underlying item bank yet in any of the
three source branches (no options, no key — see "No fixed answer keys"
above). Authoring that item bank is source-curriculum work this branch does
not own; it's called out per-lesson in the scoring guide rather than
papered over.
