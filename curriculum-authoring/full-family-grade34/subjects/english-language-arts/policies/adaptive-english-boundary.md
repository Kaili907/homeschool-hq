# Adaptive English Boundary

## The artifact

| Artifact | SHA-256 | Band |
| --- | --- | --- |
| a5-adaptive-english-mvp-v0.2.0-20260216.zip | 474645929e9be3194601c0535d641dab55e8e79b7e10bbf00b3e667908874035 | approximately Grades 4-6 |

This package **references** that artifact. It does not embed it, copy it, rename it, extend it, rebuild it, duplicate its content, or modify it in any way. The reference matches the entry already recorded in `curriculum-content/manuel-academy/1.0.0/standards/standards-reference.md` and `curriculum-manifest.json`.

## Grade 4

Grade 4 sits inside the Adaptive English band. Grade 4 lessons therefore record `adaptive_english_band_match: true` and note that compatible intervention capability **may** be exposed through a future adapter.

No adapter is implemented, mounted, wired, or required by this package. The field is a declaration of compatibility, not an integration. Grade 4 is fully teachable today with no adaptive package present, because `static_help_sufficient` is true on every Grade 4 lesson.

## Grade 3

Grade 3 sits **below** the Adaptive English band. Grade 3 lessons record `adaptive_english_band_match: false`.

Grade 3 operates fully through static help. Every Grade 3 lesson supplies:

- a worked example or explicit model in the mini-lesson segment;
- a guided phase with prompting that fades within the session;
- a dedicated reteach phase that re-represents the idea rather than repeating it;
- seven scripted adaptive tutor routes covering decoding barriers, prerequisite gaps, unsupported answers, correct-but-low-confidence, repeated error patterns, text-too-hard, and mastery evidence;
- an extension path for learners who are ahead.

None of that depends on the adaptive package. A Grade 3 learner who needs more support gets it from the lesson, not from an overlay that was not built for this grade.

## Why the band matters

Routing a Grade 3 learner into an intervention calibrated for Grades 4-6 would misdiagnose ordinary Grade 3 development as a deficit and would deliver practice at the wrong level. The band mismatch is recorded on every Grade 3 lesson specifically so that a future adapter cannot silently pick these lessons up.

## What a future adapter would have to respect

Any later adapter work is out of scope for this package, and would still be bound by everything here: the tutor may not author assessed responses, fixed answers stay scorer-visible only, guided evidence stays separate from independent evidence, mastery still requires two independent occasions, the accessibility guarantees still hold, and the frozen artifact still is not modified.
