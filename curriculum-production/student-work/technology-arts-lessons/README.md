# Technology/CS + Arts/Music — lesson-level student production materials

984 student-ready lesson task packages and 984 matching parent/tutor scoring
guides, one pair for **every authored lesson** across grades 3, 4, 5, 7, 8, 9,
10, 11, and 12 in both technology/computer science and arts/music.

This is the lesson-level expansion of the 108 unit-level packages in
[`../technology-arts`](../technology-arts). It is **not** those packages
re-cut six or twelve ways — see [Why each lesson differs](#why-each-lesson-differs).

| | |
| --- | --- |
| Lessons | 984 (336 technology, 648 arts/music) |
| Units covered | 108 |
| Courses | 18 (2 subjects × 9 grades) |
| Production Quality Gate | **984 READY**, 0 needs-review, 0 not-ready |
| Duplicate content check | **PASS** — 0 exact duplicates, max sibling similarity 0.4232 |
| Overlap with own unit task | 0.0761 max (5-gram Jaccard) |

## Layout

```
packages/{technology,arts-music}/grade-XX/<lesson_id>.task-package.json
scoring-guides/{technology,arts-music}/grade-XX/<lesson_id>.scoring-guide.json
schema/            JSON Schema for both file types
src/               course registry, phase archetypes, rubric sets, builder
tests/             duplicate check, policy validator, schema check
gate-report.{json,md}   Production Quality Gate output
duplicate-report.json   duplicate/near-duplicate measurements
manifest.json           provenance, totals, policy statements
```

## Why each lesson differs

Every authored lesson carries a `phase` — where it sits in the unit's arc —
and a `focus`, the specific idea for that day. The phase selects **the shape of
the work**; the focus supplies **its content**. So a launch day and a
correction day inside the same unit produce structurally different tasks, not
the same task with a different noun substituted.

Sixteen phases map to sixteen work-mode archetypes:

| Mode | Phase | What the student actually does |
| --- | --- | --- |
| `PROBE` | Launch and diagnostic | Records prior thinking and predictions before any instruction; wrong predictions cost nothing |
| `MODEL` | Explicit model | Traces a worked model step by step, then changes one thing and predicts the result |
| `MODEL_A` | Concept model A | Reduces a model to a stated rule, plus one conforming and one violating example |
| `MODEL_B` | Concept model B | Compares a second model against the first and names the selecting condition |
| `GUIDED` / `GUIDED_A` / `GUIDED_B` | Guided practice | Scaffolded cases with the scaffold fading within or across sessions |
| `APPLY` | Independent application A | Applies the idea unaided to a self-chosen case |
| `BUILD` | Application or project | Builds a working artifact against success conditions written first |
| `INVESTIGATE` | Investigation / close reading | Analyses an artifact or work the student did not make |
| `RETEACH` | Reteach and varied practice | Re-approaches the idea in a second representation or medium |
| `INCREMENT` | Performance task build | Advances the unit performance task by one reviewable increment |
| `DEMONSTRATE` | Mastery check | Independent demonstration with verification, no scaffold in view |
| `SYNTHESIZE` | Synthesis and review | Maps three-plus unit ideas and solves a problem needing two at once |
| `ASSESS` | Unit assessment | Summative task under stated conditions |
| `CORRECT` | Correction and reflection | Defect or revision log tracing symptom → cause → fix → passing check |

The rubric follows the same logic: each mode carries its own **dimension set**
(16 distinct sets), so a launch day is scored on prediction and honesty while a
build day is scored on testing and design justification. A lesson is never
scored against criteria its phase could not produce evidence for.

Each task also states a **grade-specific bar** for independence and
justification. That matters because some units are shared verbatim between
adjacent grade courses — grade 4 and grade 5 arts share several unit titles and
focus values outright — so the grade band is what separates those lessons.

## Subject guarantees

**Technology / CS.** Every lesson is a logic, code, debugging, analysis, or
design task with explicit success and check criteria (minimum four per
lesson). Every package now includes an `activity_setup` block containing the
complete central input, expected behavior/specification, available execution
method, three test cases, a concrete debugging target, and an equal-credit
paper/manual alternative. None waits for a teacher-supplied model, dataset,
starter file, account, or external service. All 87 code/debug activities carry
complete parseable JavaScript starter code and inline inputs; the same task can
be completed by hand-tracing for identical credit. Every
lesson prohibits real passwords, passphrases, API keys, credentials, access
tokens, precise locations, and real personal data, and prohibits signing into,
probing, scanning, or accessing any live, production, school, or third-party
system, or bypassing any filter, licence, access control, or terms of service.
No credential-shaped literal appears anywhere in the corpus.

Where an authored lesson's focus is itself an attack concept — grade 7 unit 5
covers `phishing and social engineering` — student-facing prose renders it
defensively ("recognising and defending against …") so no task reads as an
instruction to carry the attack out. The authored `focus`,
`learning_objectives`, and `lesson_success_criteria` fields keep the original
wording for provenance.

**Arts / Music.** Every lesson is creation, analysis, or portfolio work scored
by rubric. No lesson requires a public performance, exhibition, class
presentation, live audience, photograph, camera, or voice recording. Every
lesson states a private option that explicitly does not lower the score, and a
written/no-audio alternative that scores identically. Any material the student
did not create must be public domain, openly licensed, or a short cited
excerpt.

**Both.** Every lesson states that the graded submission must be the student's
own authorship, and that an adult or AI tool may explain, demonstrate, or give
feedback but must not produce any scored part of the work.

## Verification

```bash
node generate.mjs
```

```bash
node --experimental-strip-types tooling/run-ts.mjs run-gate.ts
```

```bash
node tests/duplicate-check.mjs
```

```bash
node tests/validate-corpus.mjs
```

```bash
node tests/schema-check.mjs
```

```bash
node tests/technology-actionability-audit.mjs
```

```bash
node tests/write-technology-checksums.mjs
```

`run-gate.ts` runs the shared repo gate at
`src/curriculum/production-quality` over all 984 lessons under the
`ARTS_RFL_PE_PROJECT` subject family. Before its READY result was accepted, the
gate was confirmed to reject twelve induced defects — stripped independent
work, stripped scoring authority, empty rubric, stripped remediation and
extension, unverified alignment, unverified safety status, missing safe
alternative, unverified source integrity, generic scaffold phrasing, and
sub-floor task text.

`tests/validate-corpus.mjs` re-derives its expectations from the source
`lessons.jsonl` rather than from the generator, so a generator bug cannot
validate itself. It checks coverage both ways (no authored lesson without
materials, no materials without an authored lesson), fidelity of phase, focus,
title, day, objectives, and success criteria against source, and the subject
policies above — including a credential-literal scan and a risk-term scan that
allows a term only inside a prohibiting or defensively-framed sentence.

`tests/technology-actionability-audit.mjs` independently audits the 336
generated Technology packages as delivered to learners. It writes
`technology-content-repair-evidence.json` and fails for a missing central
input, unrunnable tool path, incomplete starter code/input/specification/test,
missing debugging target, unequal fallback, placeholder shell, paid/account
dependency, credential-shaped literal, or privacy/security gap.

## Reading register

Grades 3–5 and grades 7–12 receive different registers of the same archetype.
The work demanded and the rubric are identical; the wording is not.

| | Grades 3–5 | Grades 7–12 |
| --- | --- | --- |
| Mean words/sentence | 9.6–9.9 | 23.3–24.5 |
| Task body | chunked into `task_steps`, one action per step | connected prose |
| Technology vocabulary | no pseudocode, trace table, boundary case, defect log, or root cause | full technical register |

This split exists because the first cut of this corpus read at the same level
in grade 3 as in grade 12 — a task a child cannot read is a task they cannot do.

## Accessibility

Each lesson carries its authored `accessibility_options` verbatim, plus
`task_accessibility_provisions` derived from what that particular task
demands: motor targets, aural or visual elements, studio materials,
performance targets, multi-session executive load, and external sources under
study. There are 150 distinct provision sets across the corpus.

Where the learning target is *itself* a motor act — keyboarding, mouse and
trackpad, instrument technique — an alternate input route is named explicitly
and scored identically. Adjusting "response mode" cannot remove a barrier when
the response mode is the thing being assessed. `tests/validate-corpus.mjs`
fails the build if such a lesson has no alternate route on record.

## Independent review

One accessibility/content reviewer examined the corpus: all 1,968 files parsed
programmatically, 112 lesson packages read in detail across all nine grades,
both subjects, and all sixteen work modes.

Passed cleanly: safety and privacy, tone and non-deficit framing, copyright
and sourcing, student authorship, and the no-camera/no-voice/no-public-
performance guarantee.

Fixed following the review: the flat reading level; CS jargon on grade 3–4
digital-citizenship topics; an anchor sentence that named an unrelated unit
topic as the lesson's own subject (~850 lessons); an arts launch rubric that
scored a prediction the arts task never requested (54 lessons); generic
accessibility support for grades 3–8; and broken grammar on the 133 lessons
whose authored focus is a gerund phrase.

## Known limitations

- **Grades 7–12 share one task body per work mode.** Differentiation across
  that band comes from the grade-specific expectation sentence and each
  lesson's own focus and closing check, not from distinct templates per grade.
  Grades 3–5 are a genuinely separate register.
- **200 lessons in grades 9–12 have a focus identical to their unit title**,
  because those units define six topics but contain twelve lessons. That is a
  property of the authored source, which lies outside this corpus's owned
  path. The lessons stay distinct by phase and work mode and the duplicate
  check passes, but their titles read redundantly.
- **A few high-school arts foci are planning concepts rather than makeable
  elements** (for example "materials rights and permissions planning"), so a
  make-a-piece archetype reads as a stretch on those days.
- **The grade 9 technology unit 2 performance task says "for a real user"**
  (authored upstream). The generated learner activity does not require an
  outside person: `activity_setup` supplies the complete fictional case and
  explicitly forbids waiting for an account, service, or other handout.
- **`safety_and_privacy.status` is `VERIFIED` on every scoring guide.** That
  records that the stated policy invariants are machine-enforced for that
  lesson — not that a human subject-matter reviewer signed off individually.

## Regenerating

Grades 3–4 and 9–12 read from sibling worktrees that are not merged into this
branch. Either check them out at the paths in `manifest.json`, or point the
generator elsewhere:

```bash
TECH_ARTS_G34_ROOT=/path/to/grade34/subjects TECH_ARTS_HS_ROOT=/path/to/hs/subjects node generate.mjs
```

`generate.mjs` clears `packages/` and `scoring-guides/` before writing, so a
lesson removed upstream cannot leave a stale package behind.
