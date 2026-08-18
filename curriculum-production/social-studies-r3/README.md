# Social Studies Production R3 — framework

Status: `FRAMEWORK_ONLY`

R3 is the step from *an approved model* to *production learner-facing lessons*.
This round builds the contract, the promotion gate, and the validator. **No R3
lesson has been authored, and this framework admits nothing.**

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
| `lessons/` | Where authored R3 lessons will land. Currently empty. |

## Two schemas, deliberately

The model schema and the production envelope are separate files because they
answer different questions.

The model is shared with the frozen samples, so it must not acquire production
fields — a Director-approved sample has to keep validating against it unchanged.
The envelope is what a sample does *not* have, so a review sample can never pass
as production content by accident.

A complete R3 production lesson satisfies **both** schemas **and** the ordered
rhythm rule. Each of the nine frozen samples satisfies the model schema and the
rhythm rule, and fails the envelope for exactly six reasons: five missing
production fields and one `sampleStatus` marker that promotion must remove. That
gap is the gate, and the verifier asserts it is exactly that — no wider, no
narrower.

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
