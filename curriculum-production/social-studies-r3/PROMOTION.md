# Social Studies R3 — promotion rules

`promotion-rules.json` is the machine-readable authority. This page explains it.

Promotion moves a lesson from *the approved model* to *admitted production
content*. It is authoring work held to a gate, not a mechanical copy of a
Director sample.

## The gate

A complete R3 production lesson satisfies all three:

1. `schema/social-studies-lesson-model.schema.json` — the shared lesson model.
2. `schema/social-studies-r3-production-envelope.schema.json` — the production fields.
3. `rhythm.orderedRule` in `promotion-rules.json` — the ordered teaching rhythm.

Each of the nine frozen R2 samples satisfies (1) and (3) and fails (2) for
exactly seven reasons. That is the whole gap between an approved sample and a
production lesson, and the verifier asserts it is exactly that:

| Gap | Why it exists |
| --- | --- |
| `sampleStatus` present | `DIRECTOR_REVIEW_ONLY` is a review marker. Promotion removes it; a production lesson is not a Director sample. |
| `productionStatus` missing | Lifecycle state. Only `PRODUCTION_ADMITTED` may be referenced by an admission manifest. |
| `provenance` missing | Pins the approved model and the frozen approval manifest, so a later change to the freeze is detectable rather than silent. |
| `runtimeReadiness` missing | Reuses the existing final-package vocabulary. `PENDING_SOURCE_ATTACHMENT` keeps launch and scoring disabled without making the course unready. |
| `sourceReview` missing | Records the human source verification the R2 bar assumed but never wrote down. |
| `courseProgress` missing | A sample states it awards no course credit. A production lesson states its real course day. |
| `lessonReview` missing | The runtime `LearnerLessonReview` the render model surfaces. It carries the COURSE PROGRESS and NEXT ACTION ruling. |

## Preconditions

Checked per lesson before promotion:

- **model-schema** — validates clean against the model schema.
- **rhythm-order** — satisfies the nine ordered rhythm steps.
- **canonical-mapping-agreement** — `lessonRef`, `title`, and `standards`
  reproduce the canonical student-work package exactly. The canonical package is
  read-only.
- **response-type-subset** — every `responseKind` is an existing
  `LEARNER_RESPONSE_TYPES` value. Social Studies uses `CHOICE` and
  `CONSTRUCTED_RESPONSE`.
- **rich-player-projection** — `createRichLessonRenderModel` returns `mode: rich`
  with no legacy fallback.
- **section-kind-classifies** — every authored `sectionKind` classifies into the
  canonical `RichLessonSectionKind` union. The authored vocabulary never outruns
  what the player can render.
- **no-browser-answer-authority** — no key anywhere names an answer, correctness
  flag, solution, score, scoring rule, or rubric answer.
- **course-progress-day** — `courseProgress.day` equals
  `(unit - 1) * 12 + lesson` derived from `lessonRef`, out of 108.
- **no-substantive-duplication** — no substantive learner-facing string is copied
  from a frozen sample or another R3 lesson. A shared rhythm is not shared copy.
- **recorded-source-review** — `sourceReview` names a role, a date, and the records
  each excerpt, title, date, and citation was checked against.
- **instructional-feedback** — every learner-response item carries
  `feedback.correct` and `feedback.incorrect`. The incorrect branch explains the
  reasoning and names the next move; it is never a bare verdict. Worked-example
  items carry none, because looking at an example is not a response.
- **next-action-ruling** — `lessonReview.nextAction` is a DTO enum value, and a
  mid-unit production lesson uses `Continue required work`.

## The transform

Remove `sampleStatus`. Add `productionStatus`, `provenance`, `runtimeReadiness`,
`sourceReview`, `courseProgress`, and `lessonReview`. Rewrite the final review's
`course_progress` so it states the lesson's real course position instead of the
sample's no-credit notice; the verifier rejects the sample phrasing and requires
`day N of 108`.

## Answer keys

Social Studies has no answer keys. Scoring authority lives in each canonical
package's rubric and acceptable-answer criteria, not in a `.key.json`. Every
feedback string is therefore hand-authored per item; there is no key to derive
from, and no shared `commonErrors` boilerplate to inherit.

## What the machine cannot decide

Two rules are enforced only in part, and the rest is human judgment. Both are
marked in `promotion-rules.json`.

- **A modeled case must differ from the learner's own task.** The automated check
  proves the modeled prompt is not a copy of the guided or independent prompts.
  Whether the modeled case is genuinely a different clause, dataset, or network
  is a review judgment.
- **Sources must be real.** A schema can require a citation to be present and
  well-formed; it cannot confirm the document says what the lesson claims. That
  is why `sourceReview` records *who* verified it and *against what*, and why
  `noInventedQuoteTitleOrUrl` is an attestation by a named role rather than a
  computed fact.

## Human authority

Promotion is not automatic. The verifier reports; it never admits. Admission
requires a recorded human source review on each lesson.

A lesson may reach `READY_FOR_GATE` on the repository's verified source registry
alone, recording `reviewedByRole: PENDING_HUMAN_SOURCE_REVIEW`. That is the honest
state for a lesson whose sources are registry-verified but which no person has yet
signed off. The verifier rejects that role for `PRODUCTION_ADMITTED`, so the pending
marker cannot quietly become an admission. Any change to the model
itself requires Director re-approval — the R2 freeze is the model authority until
then.

## Forbidden

See `forbidden` in `promotion-rules.json`. In short: never edit the frozen
samples, the approvals manifest, the Director review gallery, the freeze
verifier, or the canonical student-work packages; never write R3 content outside
this root; never introduce a second lesson model, engine, runtime, or
learner-response authority; never put answer or scoring authority in learner
material; never invent a quotation, title, creator, date, or URL, or attribute
words to a real person they did not say; never present simulated evidence as
real; never author grade 6.
