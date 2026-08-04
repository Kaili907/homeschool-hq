# SESSION CURR-1 — Import Grades 5, 7, and 8 Curriculum v1

You are integrating a Director-authored Manuel Academy curriculum package into the authoritative `homeschool-hq` repository. Start with a read-only preflight. Do not merge, deploy, contact hosted services, apply migrations, or modify frozen artifacts without separate explicit authorization.

## Input artifact

- Filename: `manuel-academy-grades-5-7-8-curriculum-v1.zip`
- Expected SHA-256: `<USE AUTHORITATIVE HASH FROM BUILD-SUMMARY.json>`
- Curriculum version: `1.0.0`
- Grades: 5, 7, 8
- Courses: 30
- Lesson blueprints: 2,736

## Frozen artifacts to preserve by exact identity

- `a5-grade5-math-20260216.zip` — `85969c6bf9c983a70f8e57fd7553f4153cbb8d6c0e177250be5ca5ee8dbe9bc1`
- `a5-adaptive-english-mvp-v0.2.0-20260216.zip` — `474645929e9be3194601c0535d641dab55e8e79b7e10bbf00b3e667908874035`
- `a5-ready-for-life-v1.zip` — `cc27e17d73838207af3fb43a3543bb3f59f990b5b6769fed1411ca2e1e05526c`

The curriculum package references these baselines but does not contain or replace them.

## Required agents

Use at least five specialists in parallel:

1. Artifact custody and manifest verification
2. Curriculum schema and content import
3. Grade identity, routing, catalog, and schedule integration
4. Tutor/Study Engine/mastery adapter integration
5. Accessibility, privacy, safety, and adversarial validation

A coordinating agent must reconcile findings and own the final handoff.

## Preflight

1. Identify the authoritative repository, default branch, current branch, worktrees, and active ownership conflicts.
2. Verify the input ZIP hash, ZIP integrity, safe paths, uniqueness, `MANIFEST.json`, and `SHA256SUMS.txt` before extraction.
3. Read `README.md`, `curriculum-manifest.json`, `validation/validation-report.md`, `standards/standards-reference.md`, and this card.
4. Confirm the canonical grade model supports Grades 5, 7, and 8. Do not silently create a parallel identity authority.
5. Identify existing course, lesson, assignment, mastery, calendar, progress, parent, and tutor schemas. Use explicit adapters; do not duplicate authorities.
6. If another session owns overlapping files, stop and report the collision.

## Integration requirements

- Import all 30 course manifests, all units, all assessments, and all 2,736 lesson records with stable IDs.
- Preserve the 36-week schedules and allow parent/teacher pacing changes without rewriting source curriculum.
- Validate every lesson against `schemas/lesson.schema.json`.
- Keep media optional and preserve text/transcript/alt-text fallbacks.
- Preserve no-photo, no-voice, no-private-disclosure, and no-real-credential paths.
- Apply the canonical mastery rule: one answer cannot establish mastery; guided evidence and independent evidence remain distinguishable.
- Integrate Grade 5 frozen math and English artifacts only through verified adapters and exact-artifact custody.
- Integrate the frozen Ready for Life v1 baseline without rewriting its lesson content.
- Keep adult-private notes and sensitive reflections out of learner and general parent projections.
- Do not allow the tutor to complete graded work or reveal fixed-assessment answers.
- Preserve guardian visibility for safety-critical Ready for Life, science, health, and physical-activity tasks.
- Do not award Grade 8 personal-finance credit merely because the package was imported. Track whether the published high-school expectations were delivered and whether the individual learner demonstrated proficiency so the applicable Michigan credit rule can be applied.

## Required tests

- ZIP and manifest custody
- schema validation for 2,736 lessons
- unique/stable IDs and exact course/unit/lesson counts
- schedule references and exact lesson coverage
- Grade 5, Grade 7, and Grade 8 routing and identity
- course catalog and enrollment
- segment-level resume and no duplicate completion
- mastery evidence and reassessment
- parent projection and private-data exclusion
- no-media, no-audio, keyboard, captions, alt text, contrast, reduced-motion, and mobile rendering
- safety and guardian-visibility rules
- financial-data and credential exclusion
- source/AI academic-integrity boundaries
- frozen-artifact byte custody
- full repository typecheck, tests, build, and browser walkthroughs appropriate to the host

## Stop conditions

Stop and report `BLOCKED` rather than guessing if artifact custody fails, the grade identity boundary is unresolved, frozen artifacts are unavailable or mismatched, schema ownership conflicts, another workstream owns overlapping files, or the host cannot represent the privacy/safety requirements.

## Final handoff

Report branch, baseline, tip SHA, exact changed files, adapters added, counts imported, all test commands and results, browser evidence, remaining blockers, and whether the branch was pushed. Do not merge or deploy. End with:

`SESSION CURR-1 — CURRICULUM IMPORT HANDOFF`
