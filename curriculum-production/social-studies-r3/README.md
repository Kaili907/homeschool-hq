# Social Studies Production R3 — framework

Status: `REFERENCE_LESSON`

R3 is the step from *an approved model* to *production learner-facing lessons*.
The contract, the promotion gate, and the validator are in place, and **one Grade 3
reference lesson is authored**. It sits at `READY_FOR_GATE`. **Nothing is admitted:**
admission requires a named human source review.

The nine Director-approved Social Studies R2 samples are the model. They are
read-only inputs here: R3 never edits, moves, or re-statuses them.

## What R3 inherits

The R2 approval froze a teaching rhythm, a source-integrity boundary, and a
player contract. R3 restates them as machine-checkable rules rather than prose,
and proves the restatement is faithful by validating the nine frozen samples
against it.

The rhythm, in order:

```
QUESTION/CONTEXT -> BACKGROUND -> EVIDENCE -> MODEL THINKING -> YOUR TURN -> FEEDBACK -> REVIEW
```

Concretely: a question and its context; the background a learner actually needs;
readable source, map, timeline, artifact, or data evidence; a labeled `EXAMPLE`
that models complete reasoning on a *different* case; a real learner response
with support; feedback specific to the evidence and reasoning, never a bare
verdict; a fresh independent response with less support; and a final lesson
review carrying all seven required fields.

## Files

| File | Role |
| --- | --- |
| `schema/social-studies-lesson-model.schema.json` | The lesson model. Shared with the frozen R2 samples; describes the existing rich-study lesson contract. |
| `schema/social-studies-r3-production-envelope.schema.json` | The production-only fields. This is the promotion gate. |
| `promotion-rules.json` | Ordered rhythm rule, promotion preconditions, the R2→R3 transform, human authority, and the forbidden list. |
| `SOCIAL_STUDIES_PRODUCTION_R3.manifest.json` | Framework state, pinned input checksums, authored and admitted counts. |
| `PROMOTION.md` | How a lesson moves from the approved model to admitted production. |
| `VALIDATION.md` | What was actually run and what it reported. |
| `tools/schema-validator.mjs` | Minimal JSON Schema subset validator; the repository has no JSON Schema runtime dependency. |
| `tools/rhythm.mjs` | The ordered rhythm check, driven by `promotion-rules.json`. |
| `lessons/grade-03/ma-g3-social-studies-u08-l07.lesson.json` | The Grade 3 reference lesson. |

## The reference lesson

`ma-g3-social-studies-u08-l07` — *Investigation or close reading: the purpose of the
Michigan Constitution*. Unit 8, day 7, course day 91 of 108.

It was chosen because its canonical phase is *Investigation or close reading*, whose
task shape is "work with at least one primary source and one secondary source" — the
evidence spine the Social Studies rhythm is built on. It is already bound to three
`VERIFIED` records in the repository source registry: two 1835 Library of Congress
records of President Jackson transmitting Michigan's proposed constitution to the
House and the Senate, and the National Archives record for the U.S. Constitution,
which supplies the worked example's *different* case.

The registry stores metadata and links only (`quotationStored: false`), so the lesson
reproduces catalog titles — labeled as catalog titles, never as words spoken by a
person — and labels every plain-language restatement as a paraphrase. No document
text is reproduced and nothing is invented.

The learner work is reading a record like a historian: what it states, what it does
not state, and the difference between a fact and a guess.

## House style

The Director-approved Mathematics R3 reference lesson
(`mac/curriculum-math-production-r3` @ `e57ba1de`) is the R3 house style, and this
lesson matches its Grade 3 voice and section density: two worked-example items that
are never required, six required learner items, and hand-authored `feedback.correct`
and `feedback.incorrect` on every one.

Two places where the frozen Social Studies sources govern instead, per the Math
`CONTRACT.md` precedence rule that a frozen source wins:

- **Envelope shape.** The Math samples nest learner content under `learnerMaterial`;
  the frozen Social Studies R2 samples are flat, and this lesson stays flat.
- **Review model.** Math carries only the four-field DTO `lessonReview`. The frozen
  Social Studies samples carry the seven-field review the Common Lesson Contract
  requires. This lesson carries **both**: the seven-field review on the final
  `reflection` section, and the DTO `lessonReview` the render model surfaces.

The **COURSE PROGRESS / NEXT ACTION ruling** (Math `CONTRACT.md`, open questions 1
and 2) is applied to both surfaces: real course position instead of the review
samples' no-credit wording, and `nextAction: "Continue required work"` for a mid-unit
production lesson.

## Two schemas, deliberately

The model schema and the production envelope are separate files because they
answer different questions.

The model is shared with the frozen samples, so it must not acquire production
fields — a Director-approved sample has to keep validating against it unchanged.
The envelope is what a sample does *not* have, so a review sample can never pass
as production content by accident.

A complete R3 production lesson satisfies **both** schemas **and** the ordered
rhythm rule. Each of the nine frozen samples satisfies the model schema and the
rhythm rule, and fails the envelope. That
gap is the gate, and the verifier asserts it is exactly that — no wider, no
narrower. There are seven findings: six missing production fields and one
`sampleStatus` marker that promotion must remove.

## Source and neutrality boundary

Every lesson states its own evidence policy in `sourceIntegrity`. Historical
excerpts are short, public-domain, attributed, and contextualized. Paraphrases
are labeled as paraphrases. Simulated dossiers and datasets are labeled as
fictional practice evidence wherever they appear. Contested topics separate
statutory fact, implementation, political viewpoint, historical interpretation,
and opinion, and represent relevant supporting and critical perspectives fairly.

No quotation, title, creator, date, or URL is invented, and no words are
attributed to a real person they did not say. Where a genuine public-domain
source is unavailable, the lesson describes the source rather than fabricating
its text. `sourceReview` records the human who checked this and what they checked
it against; the schema cannot verify a citation, so it records who did.

## Boundaries

- All R3 output is written under this root.
- `curriculum-production/student-work/social-studies` is a read-only mapping
  authority. Canonical packages are never edited by lesson authoring.
- `schemaVersion` stays `manuel-academy.rich-study-lesson.v1`. R3 introduces no
  second lesson model, Study Engine, `LearnerResponseRuntime`, or local
  learner-response authority.
- Learner material carries no answer key, correctness flag, score, scoring rule,
  or rubric answer. Correctness is a trusted-assessment decision.
- Supported grades are 3, 4, 5, 7, 8, 9, 10, 11, and 12. Grade 6 does not exist.

## Verify

```sh
node scripts/curriculum/verify-social-studies-r3-framework.mjs
npx vitest run --project root-app src/study/family-pilot/lesson-player/socialStudiesProductionR3.test.ts
```

## Preview

`npm run dev`, then open `/curriculum-preview/social-studies-r3`. The route mounts the
real `FamilyPilotLessonPlayer` over a throwaway in-memory session. It writes no learner
progress, assignment, or cloud data, and it does not touch the frozen R2 gallery.
