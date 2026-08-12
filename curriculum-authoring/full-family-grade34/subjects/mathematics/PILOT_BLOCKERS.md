# PILOT_BLOCKERS - Grade 3 / Grade 4 Mathematics

What is **not** resolved by this authoring package. Nothing below prevents the
curriculum from being taught; the items marked BLOCKER prevent it from being
*shipped through the product* without work owned elsewhere.

## BLOCKER - owned by another session

### 1. The v1.0.0 lesson schema rejects Grade 3 and Grade 4

`curriculum-content/manuel-academy/1.0.0/schemas/lesson.schema.json` constrains
`grade` to `[5, 7, 8]` and `lesson_id` to `^ma-g(5|7|8)-...`. Every lesson in this
package fails that schema by construction.

This package ships its own profile at `schemas/lesson.schema.json`, which keeps all
v1 required fields and adds the Grade 3/4 fields. That is sufficient for local
validation, **but any release-side validator pointed at the v1.0.0 schema will
reject all 360 lessons.** Extending the release schema is outside this session's
ownership (`curriculum-authoring/full-family-grade34/subjects/mathematics/**` only)
and belongs to whoever owns `curriculum-content/` or `release/`.

### 2. No catalog or runtime registration

These courses are not registered in any course catalog, not wired into the Study
Engine, and not present in `curriculum-content/manuel-academy/*/course-index.json`.
The indexes in `indexes/` are package-local. A catalog/runtime session must import
them.

### 3. The `adaptive-math.v1` capability is declared, not implemented

`adaptive/adaptive-math-capability-map.json` declares the capability name and the
resolution order that Grade 4 units use. **No runtime currently resolves it.** This
is safe rather than broken: with no resolver, every route falls through to the
static fallback, which is the designed terminal state. But no learner will actually
reach the frozen intervention until a runtime implements capability lookup.

## SHOULD KNOW - decisions a pilot lead should confirm

### 4. `curriculum-authoring/` is a new tree with no cross-subject conventions yet

No sibling worktree has created `curriculum-authoring/` — this package establishes
the layout. There is no `full-family-grade34` package manifest spanning subjects, no
shared policy file at the family level, and no cross-subject daily schedule. The
36-week schedule here is **mathematics-only**, because cross-subject scheduling
would require writing outside this session's ownership. When other Grade 3/4
subjects land, a family-level schedule will need to reconcile them.

### 5. Assessments specify prompt types and points, not fixed numeric items

Each unit assessment defines eight prompts with types, points, standards, and a
concrete error-analysis stem drawn from the unit's misconception table — matching
the v1.0.0 Grade 5 assessment shape. It does **not** ship fixed numeric items or an
answer key with specific answers. Items are composed at teaching time from the unit
focus. If the pilot needs ready-to-print fixed forms with keys, that is additional
authoring.

### 6. Accessibility conformance is structural, not UI-verified

Every claim in `accessibility-no-media.md` is verified at the content level: media
optional everywhere, text fallback everywhere, static representations, no camera, no
voice, touch-sized tasks. **None of it has been tested against a rendered
interface** with an actual screen reader, keyboard-only navigation, or a real mobile
viewport, because no such interface exists in this package. A UI accessibility audit
is still required before an accessibility claim is made to families.

### 7. No licensed-educator sign-off

Content was authored against the verified MDE standards document and reviewed by a
second agent for grade-appropriateness and mathematical correctness. That is not the
same as review by a certified elementary mathematics educator. Treat this as
review-ready, not review-complete.

### 8. Standards document currency

The MDE mathematics standards document dates to Michigan's 2010 adoption and remains
the current document linked from the MDE Academic Standards page. If Michigan
revises its mathematics standards, `authoring/standards_catalog.py` is the single
place to remap, and `validate.py` will surface any code that stops existing.

### 9. Manipulatives are household-substitutable but not procurement-checked

Every unit's representation set is described so it can be built from paper, coins,
or household objects, and `accessibility-no-media.md` gives a text-only form for each.
No physical materials list has been costed or validated against a real household.
Grade 4 Unit 10 assumes access to a protractor; a folded-paper alternative is
described but is less precise for the 4.MD.6 whole-degree expectation.

### 10. Grade 3 and Grade 4 share one adult-facing register

The lesson-flow script, accommodation list, and safety notes are worded identically
in both grades once the focus phrase is substituted. Session length differs (30-45
minutes in Grade 3, 40-55 in Grade 4) and the mathematics is grade-distinct, but the
adult reading the Grade 3 script for an eight-year-old sees the same sentences as the
adult reading the Grade 4 script for a ten-year-old. This was raised in review and
deliberately not fixed here: rewriting 360 lesson scripts for developmental register
is a larger authoring pass than this session's scope, and the current wording is
accurate for both grades. A pilot lead who wants age-differentiated adult language
should treat it as its own task.

## NOT A BLOCKER - recorded so it is not re-litigated

- **Cadence.** 36 weeks x 5 days x 180 lessons matches the existing v1.0.0
  mathematics convention exactly. No deviation was needed, so none was taken and no
  justification is owed.
- **Grade 3 with no adaptive match.** This is the designed state, not a gap. All 180
  Grade 3 lessons declare `requires_adaptive_package: false` and resolve every route
  statically.
- **Grade 4 units 8, 9, 10 with no adaptive alignment.** The frozen package has no
  sequence covering decimals, measurement conversion, or angles. Asserting alignment
  there would be a false claim about the intervention's coverage.
