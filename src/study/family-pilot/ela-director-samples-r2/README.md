# ELA Director Samples R2

This isolated namespace contains nine learner-facing English Language Arts
sample fixtures for Director review. It does not replace, import into, or
rewrite the production ELA corpus.

Each sample uses the existing structured `LearnerMaterialDto` contract. The
same `createRichLessonRenderModel` projection used by the Rich Study Player
turns each fixture into `LEARN`, `PRACTICE`, and `REFLECT` pages. No sample uses
the markdown/legacy presentation path.

## Controlling learner flow

1. `WELCOME / PURPOSE`
2. Short instruction and vocabulary
3. `EXAMPLE / LET'S LOOK AT ONE` with visible reasoning on a distinct microtext
4. A complete Academy-original reading or editing source
5. `YOUR TURN` guided response
6. Feedback released on the next practice page
7. Independent constructed response
8. Process feedback and a fresh revision response surface
9. `PARENT REVIEW` for human judgment of constructed writing
10. Seven explicit review pages ending in `NEXT ACTION`

Fixed-choice feedback explains why each option does or does not fit. Longer
writing is saved as pending evidence and is never assigned an invented browser
score. The worked example is structurally separate from protected learner work,
and no answer, correct-choice, scoring, or solution field is present.

## Readability progression

The machine-readable `manifest.json` records instruction length, sentence
complexity, vocabulary load, passage length, expected written response, and
scaffolding for every grade. Grades 3–5 use short screens and concrete checks;
Grades 7–8 add inference and multi-part evidence reasoning; Grades 9–12 use
sustained literary, editorial, rhetorical, and multi-source analysis with
progressively faded scaffolding.

## Accessibility and runtime boundary

The fixtures rely on the shared Rich Study Player, whose existing presentation
provides labeled native controls, keyboard operation, visible focus, a skip
link, readable line length, large controls, forced-color support, and
non-color-only text status. The samples have no Tutor dependency and add no
Tutor runtime, application route, cloud work, database work, or deployment
surface.
