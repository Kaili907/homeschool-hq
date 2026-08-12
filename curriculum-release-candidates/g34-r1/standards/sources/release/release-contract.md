# Grades 3/4 Curriculum Release Contract

**Package (working) id:** `manuel-academy-grades-3-4-curriculum-v1`
**Status:** `authoring-root-established` — no subject content authored yet.
**Authored on:** 2026-08-12
**Owns:** `curriculum-authoring/full-family-grade34/release/**` only.
**Does not own:** `curriculum-authoring/full-family-grade34/subjects/**` (created independently by six parallel subject-builder sessions) and does not touch `curriculum-content/manuel-academy/1.0.0/**` (the completed, frozen Grades 5/7/8 canonical release).

This document is the controlling contract for adding Grades 3 and 4 to Manuel Academy. It does not contain lesson, unit, or course content. It defines the shape subject lanes must produce, the standards each lane must verify against, and the checks a convergence session will run before Grades 3/4 can be merged into the canonical package.

## Grade model

Target grades: **3, 4** only. This release does not modify the app's canonical Grade union (`grade: integerSchema({minimum: 1, maximum: 12})` in [`src/curriculum-authoring/v2/contracts.ts`](../../../../src/curriculum-authoring/v2/contracts.ts) already permits grades 3–4 at the schema layer — no code change needed there). Host-grade integration (routing, catalog, enrollment, identity) is explicitly out of scope for this session and is owned by a later convergence session, matching the precedent set by [`integration/SESSION-CURR-1-CODEX-IMPORT-CARD.md`](../../../../curriculum-content/manuel-academy/1.0.0/integration/SESSION-CURR-1-CODEX-IMPORT-CARD.md) for Grades 5/7/8.

## Subjects and course count

10 subjects × 2 grades = **20 courses total**. See [`course-matrix.json`](course-matrix.json) for the authoritative list, course IDs, and per-subject standards-framework references.

```
mathematics
english-language-arts
science
social-studies
health
physical-education
ready-for-life
technology-computer-science
arts-music
financial-literacy
```

**Naming note (convergence item, not resolved here):** the canonical 1.0.0 package's subject enum (both `curriculum-content/manuel-academy/1.0.0/schemas/lesson.schema.json` and `src/curriculum-authoring/v2/contracts.ts`) uses `technology` and `arts-and-music`, not `technology-computer-science` and `arts-music`. This release uses the subject slugs specified in the Grades 3/4 program brief as-is. A convergence session must either (a) extend the canonical subject enum with these two slugs, or (b) remap them to the existing canonical slugs. This release contract does not decide that question and does not modify the canonical enum.

## Contracts inherited from the Grades 5/7/8 canonical release

Read from `curriculum-content/manuel-academy/1.0.0/` and preserved wherever age-appropriate for 8–10 year olds:

| Canonical source | Preserved as |
| --- | --- |
| `curriculum-manifest.json` | Shape mirrored in the eventual grade34 manifest (package_id, grades, school_year, counts, subjects, entry_points, boundaries). Counts are **not** pre-filled — see [Deliverables](#deliverables). |
| `standards/standards-reference.md` | Structure mirrored in [`standards-reference.md`](standards-reference.md); Michigan remains the jurisdictional focus. |
| `schemas/lesson.schema.json` | Structure mirrored in a **new**, grade34-scoped [`lesson-schema.json`](lesson-schema.json) (grade enum `[3, 4]`, lesson-id pattern `^ma-g(3\|4)-...`). The 1.0.0 file itself is not edited. |
| `policies/instruction-mastery-accessibility-safety.md` | Adopted unchanged in substance for Grades 3/4 — see [Policy adoption](#policy-adoption-not-a-rewrite). |
| `integration/SESSION-CURR-1-CODEX-IMPORT-CARD.md` | Pattern mirrored for the eventual grade34 integration card (written at convergence time, once subject counts are known — not authored here). |
| `validation/validation-report.md` | Pattern mirrored by [`validate-grade34.mjs`](validate-grade34.mjs), which runs the equivalent checks once subject content exists. |

## Policy adoption (not a rewrite)

The instructional, mastery, accessibility, privacy, Ready-for-Life/health, physical-education, sensitive-history, technology/AI, and financial-education policy commitments in `policies/instruction-mastery-accessibility-safety.md` apply to Grades 3/4 without modification. Subject lanes must author to that policy, not a relaxed or age-adjusted variant of it — the policy is already written to protect younger learners (no-shame language, no calorie/weight/body-size scoring, no required photo/voice, guided-vs-independent mastery evidence, keyboard/caption/alt-text/text-fallback accessibility). Where a lane believes a Grade 3/4-specific accommodation is warranted (e.g., shorter independent work blocks, simplified response modes), that is a **within-lane authoring decision**, not a policy change, and does not require a change to this release contract.

## School year and schedule

36 weeks, 180 instructional days per course — identical to the canonical release. See [`validation-contract.md`](validation-contract.md) for the schedule-coverage check.

## Study Engine / Family Pilot compatibility

Grade 3/4 curriculum must remain usable through the **existing** Study Engine, Family Pilot assignments, schedule, checkpoint/pause/resume, and Parent Hub. This release does not create a second Study Engine contract, a second schedule model, or a second assignment model. Any subject-lane content that cannot be represented by the existing lesson/unit/course/schedule shapes is a blocker for that lane, not a reason to fork the runtime contract.

## Deliverables in this directory

| File | Purpose |
| --- | --- |
| [`release-contract.md`](release-contract.md) | This document. |
| [`standards-reference.md`](standards-reference.md) | Official Michigan Department of Education sources for Grades 3/4, per subject, with verification status. |
| [`lesson-schema.json`](lesson-schema.json) | Grade34-scoped lesson schema, structurally mirroring `curriculum-content/manuel-academy/1.0.0/schemas/lesson.schema.json`. |
| [`course-matrix.json`](course-matrix.json) | The 20-course matrix: course IDs, grade, subject, standards-framework ref, and planned path. Unit/lesson counts are `null` — subject lanes report them. |
| [`authoring-boundaries.md`](authoring-boundaries.md) | What this session did and did not do; what each subject lane owns. |
| [`validation-contract.md`](validation-contract.md) | The validator's required checks, mapped to the same categories the 5/7/8 `validation-report.md` used. |
| [`validate-grade34.mjs`](validate-grade34.mjs) | Runnable validator implementing the validation contract, callable once subject lanes exist. |
| [`validate-grade34.test.ts`](validate-grade34.test.ts) | Vitest coverage for the validator against synthetic fixtures (no real subject content exists yet). |
| [`vitest.config.mjs`](vitest.config.mjs) | Scoped test-runner config for `validate-grade34.test.ts`, deliberately not merged into the shared root `vite.config.ts` (this session owns `release/**` only). Run with `npx vitest run --config curriculum-authoring/full-family-grade34/release/vitest.config.mjs` from the repo root. |

## Explicit non-goals of this session

- No subject, unit, lesson, or assessment content is authored here.
- No directories under `curriculum-authoring/full-family-grade34/subjects/**` are created here.
- No file under `curriculum-content/manuel-academy/1.0.0/**` is modified.
- No change to the app's canonical Grade union, routing, catalog, or identity system.
- No final lesson/unit counts are asserted — they are unknown until subject lanes report them.
- No invented standards codes. Where an exact Michigan standard code could not be verified against an official source in this session, it is marked `UNVERIFIED` rather than guessed. See `standards-reference.md`.
