# Learner release quality policy

## Decision rule

A release is learner-ready only when the permanent gate reports zero blockers across the exact admitted population: 8,292 lessons, 699 assessments, 90 courses, nine supported grades, and ten subjects. A file path, checksum, production binding, or previous subject gate is evidence of custody—not evidence that a learner can start and complete the work.

The gate fails closed on population drift, unreadable bindings, missing generated learner payloads, and every code listed in `scripts/audit-learner-release/rules.mjs`. There are no accepted-baseline counts and no allowlist for current defects.

## Two-layer validation

Every lesson is checked twice:

1. Source sufficiency: the production learner package must contain the real task, promised practice/activity, required source/data/materials, and subject-specific safety/scaffold.
2. Learner delivery: the built browser payload must preserve item identity, choice structure, response kind, and learner-safe boundaries. The mounted path must support required evidence rather than replacing it with a completion-only Continue action.

Assessment records are independently checked for actionable learner material and an actual final-app assessment workflow. Lesson-level scoring fallbacks do not materialize an assessment.

## Subject-aware floor

- Math requires substantive problems, worked instruction where promised, and nonempty promised practice/mastery sections.
- ELA requires the actual assigned reading/source and a concrete evidence/writing task.
- Science requires a bound model, case, data set, or executable investigation plus materials and safe/equal-credit routes.
- Social Studies requires learner-available source identity/content; pending dynamic attachments remain blocked.
- Health requires safe, private, actionable instruction and evidence without diagnostic/private-disclosure overreach.
- PE is validated as movement work: activity, movement cues/steps, safety, feasible equipment/no-equipment alternative, adaptation, and completion criteria.
- Ready for Life is validated as a life-skill task with the declared completion authority and equal-credit simulation where required.
- Financial Literacy preserves fixed/judgment modes, parameters, choices, and scoring separation; it must never disclose an answer before work.
- Technology requires the central model/problem/artifact/environment and a runnable starter or complete paper specification for code/debug work.
- Arts/Music is validated as create/perform/respond work with critique criteria and the actual model/scaffold/reference on source-dependent days.

PE, Arts/Music, and Ready for Life are never required to contain Math-style guided practice or fixed-answer mastery checks.

## Evidence and maintenance

`current-base-report.json` and the grade × subject matrix are deterministic snapshots of the audited base. Maintainers must run `npm run audit:learner-release` for the candidate release and `npm run test:learner-release-gate` for mutation controls. Updating a report cannot make a failing exit code pass.

`npm run audit:family-pilot-launch` invokes this gate before the legacy launch audit. A learner-quality failure therefore prevents the established launch command from reaching an approval result.
