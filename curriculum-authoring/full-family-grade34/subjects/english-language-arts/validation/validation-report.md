# Validation Report — Grades 3 and 4 English Language Arts

**Package:** `manuel-academy-grades-3-4-ela-authoring-v1`  
**Version:** 1.0.0  
**Date:** 2026-08-12  
**Overall:** **PASS** (50/50 checks)

Regenerate with `python3 tools/validate.py`.

| Check | Result | Details |
| --- | --- | --- |
| two-courses | PASS | ['ma-g3-english-language-arts', 'ma-g4-english-language-arts'] |
| grade-3-full-year | PASS | lessons=180, units=10, days/unit=18 |
| grade-4-full-year | PASS | lessons=180, units=10, days/unit=18 |
| thirty-six-week-model | PASS | [(3, 36, 180), (4, 36, 180)] |
| stable-unique-lesson-refs | PASS | 360 refs, 360 unique |
| lesson-ref-pattern | PASS | all 360 match ^ma-g[34]-english-language-arts-uNN-lNN$ |
| lesson-ref-matches-fields | PASS | grade, unit, and day encoded in every ref match the record |
| grade-3-course-days-contiguous | PASS | 1..180 with no gap or repeat |
| grade-4-course-days-contiguous | PASS | 1..180 with no gap or repeat |
| grade-3-schedule-exact-coverage | PASS | scheduled=180, unique=180, lessons=180, weeks=1..36, unscheduled=0, scheduled-but-missing=0 |
| grade-4-schedule-exact-coverage | PASS | scheduled=180, unique=180, lessons=180, weeks=1..36, unscheduled=0, scheduled-but-missing=0 |
| unit-lesson-and-assessment-integrity | PASS | all 20 units list exactly their 18 lessons and a resolvable assessment |
| index-consistency | PASS | unit-index=20, lesson-index=360 |
| grade-3-no-invented-standards | PASS | 42 codes used, all in the verified catalog |
| grade-3-standards-coverage-complete | PASS | all 42 catalog codes reach at least one lesson or unit |
| grade-3-excluded-codes-absent | PASS | none of ['3.RF.1', '3.RF.2', '3.RL.8', '3.W.9'] appear anywhere |
| grade-3-standards-map-nonempty | PASS | standards-map resolves 42 codes to lessons |
| grade-4-no-invented-standards | PASS | 44 codes used, all in the verified catalog |
| grade-4-standards-coverage-complete | PASS | all 44 catalog codes reach at least one lesson or unit |
| grade-4-excluded-codes-absent | PASS | none of ['4.RF.1', '4.RF.2', '4.RF.3b', '4.RL.8'] appear anywhere |
| grade-4-standards-map-nonempty | PASS | standards-map resolves 44 codes to lessons |
| unit-declares-every-code-its-days-cite | PASS | every day-level code is declared on its unit |
| text-bank-units-match-anchor-usage | PASS | every anchor text declares the unit it anchors |
| standards-code-format | PASS | every code matches <grade>.<strand>.<number>[letter] |
| lesson-required-fields | PASS | all 360 lessons carry every v1.1 required field |
| lesson-depth | PASS | all lessons carry 3+ objectives, 5+ flow segments, 1+ standards, 5+ tutor routes |
| lesson-flow-segments-distinct | PASS | no lesson repeats the same instructional move in two segments |
| accessibility-depth | PASS | every lesson carries 5+ accessibility provisions |
| accessibility-required-paths | PASS | every lesson states a text-only path, read-aloud capability, a no-audio path, and a private presentation alternative |
| no-required-learner-voice-or-video | PASS | no lesson requires learner voice or video; captions and transcripts required when media exists |
| media-optional-with-fallback | PASS | media optional with a readable fallback on all 360 lessons |
| text-provenance-resolves | PASS | every lesson names a text with a resolvable id, matching source type, and a rights statement |
| public-domain-referenced-not-reproduced | PASS | 17 public-domain works are references with creator, year, and rationale; none is reproduced |
| original-text-bank-integrity | PASS | 17 Grade 3 and 18 Grade 4 original texts, each with a rights statement and substantive length |
| public-domain-metadata-complete | PASS | every public-domain reference carries title, creator, first-publication year, and rationale |
| student-authorship-on-every-lesson | PASS | all 360 lessons carry the authorship rule stating what the tutor must not do |
| fixed-answer-protection-on-every-lesson | PASS | all 360 lessons restrict fixed-answer keys to scorer-visible only |
| tutor-does-not-touch-assessed-draft | PASS | every revision lesson instructs the tutor to model on a sample, never on the learner's assessed draft |
| assessed-days-are-independent | PASS | 20 assessed lessons (one per unit), all marked independent |
| multi-occasion-mastery | PASS | all 360 lessons require 2+ occasions, independent evidence, and 3+ evidence types, and record that guided success is not mastery |
| guided-and-independent-evidence-per-unit | PASS | every unit produces both guided and independent evidence |
| no-raw-essay-persistence-requirement | PASS | no lesson requires retaining a learner's raw essay or extended response text |
| assessment-integrity | PASS | all 20 assessments split guided from independent evidence, require 2+ occasions, protect fixed answers, require student authorship, bound persistence, and balance points |
| writing-progression | PASS | Grade 3 covers opinion, informative, narrative and revision with no W.9 (which begins at Grade 4); Grade 4 adds W.9a and W.9b, the evidence-from-texts standard new at this grade |
| reading-progression | PASS | foundational decoding present at both grades and heavier at Grade 3 as the standards require (3.RF.3 on 21 lessons vs 4.RF.3 on 4); fluency retained at both (3.RF.4 on 13, 4.RF.4 on 10); Grade 4 adds structure, firsthand/secondhand, and author's reasoning |
| grades-independently-authored | PASS | different 18-day arcs; 180 and 180 distinct daily foci with zero overlap; no shared unit title; no shared text |
| not-derived-from-grade-5 | PASS | no unit title, no standards code, and neither 18-day arc is shared with the frozen Grade 5 ELA course |
| adaptive-english-boundary | PASS | Grade 3 records no band match and runs on static help; Grade 4 records band match for a future adapter; no lesson modifies the frozen package |
| package-self-contained | PASS | 50 files, all under curriculum-authoring/full-family-grade34/subjects/english-language-arts/ |
| lessons-conform-to-schema-v1_1 | PASS | all 360 lessons validate against schemas/lesson.schema.json |

## Interpretation

A PASS verifies structural completeness, unique and stable lesson references, exact schedule coverage, two-way standards coverage against a verified Michigan code catalog with no invented codes, required lesson fields, accessibility paths, text provenance and copyright boundaries, assessment integrity, the guided-versus-independent evidence split, multi-occasion mastery, the no-raw-essay persistence boundary, the Adaptive English boundary, and that the two grades are independently authored rather than derived from Grade 5.

It does not claim state approval, accreditation, licensure, transcript credit, an individual learner's proficiency, runtime integration with the Study engine, or third-party media production.
