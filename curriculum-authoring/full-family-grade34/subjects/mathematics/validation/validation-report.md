# Grade 3 and Grade 4 Mathematics - Validation Report

**Package:** `manuel-academy-grade34-mathematics`  
**Version:** 1.0.0  
**Date:** 2026-08-12  
**Overall:** **PASS**

| Check | Result | Details |
| --- | --- | --- |
| two-courses | PASS | grades [3, 4] |
| lessons-per-course-180 | PASS | g3=180, g4=180 |
| ten-units-of-18-days | PASS | g3=10 units, g4=10 units |
| full-36-week-schedule | PASS | g3: weeks=36 rows=180 all-5-day=True; g4: weeks=36 rows=180 all-5-day=True |
| unique-lesson-ids | PASS | 360 ids, 360 unique |
| unique-unit-and-course-ids | PASS | 20 units, 2 courses |
| unique-segment-ids | PASS | 1800 segments, 1800 unique |
| schedule-covers-every-lesson-exactly-once | PASS | g3: scheduled=180 lessons=180 resolve-once=True; g4: scheduled=180 lessons=180 resolve-once=True |
| course-days-contiguous-1-180 | PASS | both grades |
| schedule-course-day-agreement | PASS | 360 rows checked |
| lesson-schema-conformance | PASS | 360 lessons validated |
| no-invented-standards-codes | PASS | all codes verified against the Michigan catalog |
| domain-ceilings-respected | PASS | no code exceeds its verified domain ceiling |
| standards-coverage-complete | PASS | g3: 25/25; g4: 28/28 |
| every-standard-reaches-independent-evidence | PASS | g3: 25/25; g4: 28/28 |
| unit-progression-contiguous-and-ordered | PASS | 10 ordered 18-day blocks per grade |
| unit-manifest-lesson-refs-resolve | PASS | 20 unit manifests checked |
| assessment-alignment | PASS | 20 assessments; standards subset of their unit; prompts aligned |
| multi-occasion-mastery | PASS | every unit: 4 independent-evidence days on separate days + assessment + reassessment |
| single-response-cannot-establish-mastery | PASS | all 360 lessons carry the rule; guided success is never flagged as independent evidence |
| reassessment-requires-fresh-items | PASS | 20 assessments |
| no-duplicate-grade5-content | PASS | zero overlap with Grade 5 across focus, lesson title, objective, activity, unit title, and performance task |
| grade5-source-present-and-read-only | PASS | Grade 5 mathematics read as reference only; this package writes nothing outside its own path |
| no-raw-learner-response-persistence-requirement | PASS | all 360 lessons declare raw responses not-required and list them as do-not-persist |
| study-adaptable-lesson-structure | PASS | all 360 lessons resumable by segment with 5+ addressable segments and no runtime dependency |
| accessibility-and-safety-depth | PASS | 5+ accommodations and 2+ safety notes on all lessons |
| media-optional-with-text-fallback | PASS | all 360 lessons |
| no-camera-photo-or-voice-requirement | PASS | every lesson states no camera and no voice input is required; no requiring phrase found |
| grade3-functional-without-adaptive-match | PASS | 180 Grade 3 lessons: every route resolves to static-lesson-fallback; zero adaptive dependency |
| grade4-adaptive-markers-only-where-aligned | PASS | aligned units [1, 2, 3, 4, 5, 6, 7]; units [8, 9, 10] carry no marker; all sequence ids exist in the frozen manifest |
| frozen-adaptive-package-referenced-not-modified | PASS | adaptive-tutor/subjects/math present and declared reference-only |
| projects-and-practice-complete | PASS | 10 projects (last is the capstone) and 10 practice sets per grade |
| mastery-evidence-refs-resolve | PASS | 120 evidence occasions resolve to real lessons |
| manifest-counts-agree | PASS | {"3": 25, "4": 28} |
| standards-map-agrees | PASS | G3 25/25, G4 28/28 |
| ownership-boundary | PASS | curriculum-authoring/full-family-grade34/subjects/mathematics |
| no-scripted-help-on-unsupported-days | PASS | 100 independent-evidence and assessment lessons carry observe-and-defer routes only |
| access-supports-guaranteed-on-unsupported-days | PASS | every unsupported lesson carries an explicit access-support route |
| misconceptions-authored-per-day-not-rotated | PASS | 20 units: every day carries an authored misconception, every misconception is used, and no unit uses a modulo rotation |
| topic-standards-valid-and-in-unit | PASS | 121 authored topic-to-standard mappings |
| assessment-prompt-standards-match-their-topic | PASS | 80 topic-bound prompts tagged from the authored topic mapping, not a slice of the unit list |
| assessment-error-prompt-shows-work-not-the-answer | PASS | 20 error-analysis prompts present concrete erroneous work and never name the error |
| connection-prompts-authored | PASS | 20 authored connection prompts |
| lesson-titles-do-not-stutter | PASS | 360 titles read as phase plus a distinct mathematical target |

## Interpretation

A PASS verifies structural completeness, identifier uniqueness, schedule resolution, standards coverage against the verified Michigan catalog, unit progression, assessment alignment, multi-occasion mastery, separation from Grade 5 content, privacy posture, and Study adaptability.

It does not claim state approval, accreditation, licensure, automatic credit, production-host integration, or that any individual learner has demonstrated proficiency.

