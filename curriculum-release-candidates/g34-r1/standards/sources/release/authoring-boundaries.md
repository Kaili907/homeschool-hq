# Authoring Boundaries — Grades 3/4 Release

## This session (`mac/g34-release-standards-r1`)

**Owns:** `curriculum-authoring/full-family-grade34/release/**` only.

**Did:**
- Verified no other branch (local `mac/g34-*`, remote `origin/win/*`) owns the `release/**` path before writing anything.
- Read the Grades 5/7/8 canonical contracts (`curriculum-manifest.json`, `standards/standards-reference.md`, `schemas/lesson.schema.json`, `policies/instruction-mastery-accessibility-safety.md`, the integration card, and the validation report) to determine what to preserve.
- Verified Michigan Department of Education standards sources for all 10 subjects via live web search (michigan.gov blocks direct fetch with HTTP 403; search-engine indexing was used instead — see `standards-reference.md` for the exact method and its limits).
- Wrote the release-level contract, standards reference, a grade34-scoped lesson schema, the 20-course matrix, this boundaries document, the validation contract, and a runnable validator with tests.

**Did not do:**
- Did not author any subject, unit, lesson, or assessment content.
- Did not create any directory under `curriculum-authoring/full-family-grade34/subjects/**`.
- Did not edit, move, or delete anything under `curriculum-content/manuel-academy/1.0.0/**`.
- Did not modify the app's canonical Grade union, routing, catalog, identity, or any production code path.
- Did not invent exact Michigan standard codes where they could not be verified against a live official source — those are marked `UNVERIFIED`/`human-review` in `standards-reference.md`.
- Did not decide the Financial Literacy Grade 3/4 standards-gap policy (see `standards-reference.md` Gap 1) — that decision belongs to convergence, informed by whichever subject lane authors that course.

## The six subject-builder sessions

Each owns exactly one `curriculum-authoring/full-family-grade34/subjects/<subject>/**` tree (per the coordination worktrees already present on disk: `mac-g34-math-r1`, `mac-g34-ela-r1`, `mac-g34-science-social-r1`, `mac-g34-health-pe-r1`, `mac-g34-rfl-finlit-r1`, `mac-g34-tech-arts-r1`, mapping to the 10 subjects in pairs). As of this session, none of those worktrees have created a `curriculum-authoring/` directory yet — this release session is the first to establish the family root.

Each subject lane is expected to:
- Create its own `subjects/<subject>/grade-3/` and `subjects/<subject>/grade-4/` course content, matching the course IDs in `course-matrix.json`.
- Validate every lesson against `lesson-schema.json` (or explain a deviation).
- Cite every standard against `standards-reference.md`, setting `mapping_status` honestly rather than defaulting to `canonical`.
- Report actual unit/lesson counts back for `course-matrix.json` and the eventual manifest — this release does not pre-assign counts.
- Not modify anything under `curriculum-authoring/full-family-grade34/release/**`.
- Not modify `curriculum-content/manuel-academy/1.0.0/**`.
- Not create a second Study Engine, schedule, or assignment contract — author into the existing shapes the Grades 5/7/8 release already integrates with.

## Convergence session (future, not this session)

Owns reconciling all subject lanes plus this release contract into a single mergeable package: writing the final manifest with real counts, resolving the `technology-computer-science`/`arts-music` vs. canonical `technology`/`arts-and-music` naming question, deciding the Financial Literacy standards-gap policy, extending host-grade integration (Grade union, routing, catalog), and running `validate-grade34.mjs` against the assembled content before any merge.
