# Methodology

## Evidence standard

The review did not accept the source audit’s label as proof. A lesson was
classified as a real conflict only when two reviewed requirements could not
both be satisfied. A difficult, multi-occasion, real-world, or transfer task
was not itself treated as a conflict.

Classifications are mutually exclusive and use the highest applicable layer:

- `SCORING_AUTHORITY_CONFLICT`: incompatible statements occur inside the paired
  adult `RUBRIC` authority.
- `CONTENT_TRANSFER_CONFLICT`: learner-visible task and equal-credit completion
  paths conflict, but the adult guide does not contain the same direct
  contradiction.
- `METADATA_CONFLICT_ONLY`: only non-operative metadata conflicts.
- `PROGRESSION_RISK`: the conflict can directly produce or block Study
  progression under the current runtime.
- `FALSE_POSITIVE`: the positional audit flag has no direct semantic conflict.
- `UNKNOWN`: evidence is insufficient for a conclusive decision.

Severity mapping is High for adult scoring ambiguity, Moderate for
learner-visible content contradiction, and Informational for a false positive.
No security severity is assigned.

## Scope and identity

The 216 input lessons are every final PE `lesson-task-card` in grades 9–12 whose
lesson ID ends in `l07` through `l12`. Unit assessments and all first-pass
lessons are excluded, matching the source audit predicate exactly.

For each row the review resolves:

- learner task item: `<lessonRef>#student-task` in the structured browser
  projection;
- server generic assessment item: `<lessonRef>#production-evidence`;
- paired final task card and scoring guide;
- admitted production binding and completion authority;
- canonical HS source family and final projection family.

## Architecture trace

The paired scoring guide schema declares itself the parent/teacher scoring
authority and fixes `scoringAuthority` to `RUBRIC`. The learner task-card schema
describes `completionCriteria` as student-facing content and forbids adult
scoring fields from entering it.

The browser projection includes `studentTask`, `completionCriteria`, PE
adaptations, activity steps, and safety/stop rules. It excludes the scoring
guide and its locator. The server production-item resolver loads the guide,
classifies PE as `constructed-rubric-review`, and returns `review-required`
rather than calculating a rubric score.

The current final learner-response integration supplies no assessor. It saves
required responses locally, permits a segment to complete once each response
exists, and adapts Manuel Academy activity lessons to Study with
`masteryAuthority: completion-only`. The admitted binding independently says
`completionAuthority: LEARNER_AUTHORITY`.

These facts establish that conflicting rubric prose can affect an adult’s
eventual judgment, but cannot currently create an automated PE score, Tutor
mastery decision, or scoring-dependent progression block.

## Limitations

- The review is static and local. It did not inspect hosted data or production
  configuration.
- It did not observe an adult reviewer applying a rubric.
- It did not repair or regenerate curriculum.
- The source depth-audit deliverables were uncommitted in their own worktree at
  review time. The defining predicate and 216 count were independently
  reproduced from the final corpus rather than copied as authority.
