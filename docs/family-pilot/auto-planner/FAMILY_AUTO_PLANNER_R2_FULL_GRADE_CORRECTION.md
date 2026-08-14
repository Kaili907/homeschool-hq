# Family Auto Planner R2 — Full-Grade Correction

Status: corrected and verified against the canonical admitted Family Pilot release. Dashboard and App routing remain intentionally unchanged.

## R1 root cause

R1's reported Grades 5/7/8 boundary was a stale Family Pilot coverage assumption, not a limitation in the grade-neutral selection loop.

The old, separate Family Pilot curriculum path still contains a release-scoped `PILOT_GRADES = ['5', '7', '8']` in `src/curriculum/family-pilot/source.node.ts`, a matching `GRADE_ORDER` in `src/study/family-pilot/catalog-runtime/provider.ts`, and generated browser chunks for only those 30 courses. R1 documentation repeated that obsolete scope.

The Auto Planner itself had already been pointed at the newer final curriculum runtime through `autoPlannerCatalogFromFinalRuntime`, but two coverage gaps allowed the stale conclusion:

1. `FamilyAutoPlannerCatalogPort` could not enumerate grades admitted by its runtime. The coordinator gated working grades through the global `ACADEMY_GRADES` projection instead of the connected admitted catalog.
2. R1's all-grade planner test used synthetic bundles. It did not exercise the adapter and coordinator against `curriculum-release-admitted/family-pilot-r1/runtime/runtime-manifest.json`, so it did not prove the real 90-course matrix.

This was not caused by course selection, working-level resolution, curriculum admission, schedule contracts, or a need for separate grade planners. The admitted manifest already contained nine grades, ten subjects per grade, 90 courses, and 8,292 lessons.

## R2 correction

R2 keeps one planner and the existing architecture:

- `FamilyAutoPlannerCatalogPort.listGrades()` exposes the grades present in the connected admitted release.
- `autoPlannerCatalogFromFinalRuntime` derives those string grade tokens directly from `FinalCurriculumRuntime.listGrades()`.
- The coordinator loads course bundles only for currently authorized working grades that the admitted runtime reports.
- Subject cadence stays in `FamilyAutoPlannerSubjectPlanV1`; no subject or grade gets another planning engine.
- Nominal grade, subject working levels, course progress, assignments, assessments, and safety holds remain read-only inputs to selection.

The final runtime is the stronger source: its grade list is derived from the admitted runtime manifest and filtered through canonical curriculum grade authority. R2 does not add another manually maintained planner grade list.

## Canonical coverage

| Grade | Admitted subjects | R2 route |
| --- | ---: | --- |
| 3 | 10 | Verified |
| 4 | 10 | Verified |
| 5 | 10 | Verified |
| 7 | 10 | Verified |
| 8 | 10 | Verified |
| 9 | 10 | Verified |
| 10 | 10 | Verified |
| 11 | 10 | Verified |
| 12 | 10 | Verified |

The ten canonical subjects at every admitted grade are mathematics, English language arts, science, social studies, health, physical education, ready for life, technology, arts and music, and financial literacy.

For every one of the 90 real manifest combinations, the R2 integration suite proves canonical course resolution, first-lesson selection, completion progression to the next lesson, and repeated-call duplicate prevention.

## Grade 6 behavior

Grade 6 remains intentionally absent. A nominal Grade 6 learner with no authorized working level receives:

- `status: NEEDS_PLAN_SETUP`
- `reason: WORKING_GRADE_UNSUPPORTED`
- no item and no materialization

The planner never substitutes Grade 5 or Grade 7. If existing authority explicitly sets a supported subject working level—for example, Grade 5 mathematics—the planner routes that subject to the admitted Grade 5 course while leaving nominal Grade 6 unchanged.

## Regression boundaries

R2 changes only catalog admission discovery and verification. The R1 decision and coordination paths for idempotency, same-day caps, carry-forward, manual overrides, assessment gates, safety holds, school-local dates, IndexedDB, offline materialized work, multi-student isolation, course completion, and school-day exceptions remain intact and are rerun.

No Dashboard component, `App.tsx` route, `dashboardPort`, Study lifecycle, Tutor implementation, AI planning, or mastery inference is changed.
