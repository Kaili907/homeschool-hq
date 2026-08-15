# Admin Dashboard Session 1: grade-authority convergence

## Custody and contracts

- Exact base: `0e2e0ba3c90e6cdc6af3db82e5d2dfb6c8c6fc38`
- Canonical source ref: `origin/mac/canonical-grade-authority-r1`
- Verified canonical source SHA: `77646008467f60e5fb1a101455d11fa5d9a1802e`
- Academy curriculum-supported grades: `3, 4, 5, 7, 8, 9, 10, 11, 12`
- Nominal profile grades: `3, 4, 5, 6, 7, 8, 9, 10, 11, 12`

Grade 6 is intentionally nominal-only. Curriculum support is a runtime
capability vocabulary, not evidence that the current immutable release ships
usable content for every supported grade. Per-grade host flags and later
content-source sessions still control delivery.

## Working-grade rule

`Profile.grade` remains nominal. `workingLevels[subject]` is an optional,
curriculum-supported subject override. Resolution uses the override first,
otherwise the nominal grade only when it is curriculum-supported. Unsupported
resolution returns `null`; a forced unsupported assignment throws. Assignment
and clearing never rewrite `Profile.grade`. Enrollment reconciliation removes
only stale course IDs and preserves lesson and assessment history.

## Identifier grammar

The canonical module owns course, unit, lesson, and assessment construction and
parsing:

- `ma-g<grade>-<subject>`
- `ma-g<grade>-<subject>-u##`
- `ma-g<grade>-<subject>-u##-l##`
- `ma-g<grade>-<subject>-u##-assessment`
- route/ref token: `grade-<grade>`

The supported alternation is emitted longest-first
(`10|11|12|3|4|5|7|8|9`), so Grades 10-12 cannot truncate to Grade 1.

## Files migrated

- `src/curriculum/grade-authority/**`
- `src/types.ts`
- `src/academy/featureFlag.ts`
- `src/academy/academyRoute.ts`
- `src/academy/workingLevel.ts`
- `src/components/hub/AcademyLevelsPanel.tsx`
- `src/study/contracts/production/content.ts`
- `netlify/functions/_shared/study-content/resolver.js`
- `src/sync/provenance.ts`
- focused tests beside those consumers

Minimal nominal-grade compatibility edits were required in `src/components/Picker.tsx`,
`src/missions.ts`, `src/vite-env.d.ts`, and
`supabase/academy-profile-contract.fixtures.ts`. They add exhaustive Grade 9/11
handling or update a formerly-invalid Grade 9 fixture; they do not redesign UI.

`src/curriculum/family-pilot/source.node.ts` from the canonical source branch is
not present in this final-RC base, so no nonexistent/older Family Pilot tree was
transplanted. The current family-facing Academy level selector is canonicalized.

## Repository inventory classification

### A. Owned and fixed this session

Shared types, Academy feature flags/routes/working levels, the family-facing
level selector, Study learner-content validation, server lesson-context parsing,
sync nominal/Academy validation, course-ID authorization, and necessary
Grade 9/11 exhaustiveness sites listed above.

### B. Admin Dashboard Session 2 target

- `src/admin/curriculum/contracts.ts`
- `src/admin/curriculum/readModel.ts`
- `src/admin/curriculum/httpSource.ts`
- `src/admin/curriculum/CurriculumBrowser.tsx` and curriculum studio/browser
  tests that still model the current v1 package as Grades 5/7/8

### C. Admin Dashboard Session 3 target

- `src/admin/curriculum-validation/model.ts` grade and ID regexes
- `src/components/admin/CurriculumStandardsReviewWorkspace.tsx` grade filter
- `src/admin/curriculum-standards-review/knownEvidence.ts`
- `netlify/functions/_shared/admin-curriculum-integrity.js` active grade-count
  aggregation for future release shapes

### D. Admin Dashboard Session 5 target

No active grade-authority hardcode identified for this session.

### E. Admin Dashboard Session 6 target

No active grade-authority hardcode identified for this session.

### F. Historical/version or immutable-release literal retained

- All occurrences of `manuel-academy-grades-5-7-8-curriculum-v1`
- `curriculum-content/manuel-academy/1.0.0/**` schemas and validation artifacts
- `scripts/build-curriculum.mjs` and `tests/curriculum-content.test.js`
- Grade-directory loops in `src/curriculum-authoring/v2/v1Importer.node.ts`
- Grade-numbered generator filenames and coverage documentation

### G. Other subsystem requiring later decision

- `netlify/functions/_shared/anthropic-policy.js` nominal tutor whitelist
- `src/curriculum/parser.ts` Family Pilot document vocabulary
- reading-fluency `ReadingGrade` and selector vocabulary

### H. False positive or typed-safe construction

PIN-pad digit lists, unit/item numbers, standards labels, and grade-token
template interpolation whose input is already an `AcademyGrade`.

## Tests and downstream consumers

Focused functional gate: 11 files / 130 tests passed. Final expanded Academy,
Study, sync, and family-facing regression gate: 36 files / 463 tests passed.
Typecheck and production build passed. The broad repository run passed
5,314/5,325 tests; its 11 failures are checkout-byte/CRLF-sensitive Admin CSS,
frozen-migration hash, or custody-manifest assertions outside this session's
files. No in-scope grade/runtime test failed.

Sessions 2 and 3 should import this authority rather than create another grade
list. Sessions 4-6 may consume the nominal/working distinction as needed, but
must not infer delivered content merely from curriculum support.
