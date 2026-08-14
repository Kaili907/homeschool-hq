# Science learner depth audit R1

Audit status: **COMPLETE**

Curriculum-depth finding: **NOT READY FOR DEPTH ACCEPTANCE**

Pinned base: `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

Audit branch: `mac/science-depth-audit-r1`

This is a read-only audit. It changes no lesson, assessment, scoring authority,
safety rule, generator, or runtime binding. All committed additions in this
branch are audit evidence under this directory.

## Scope and authority

The admitted Family Pilot release contains 972 active Science lesson bindings.
The audit independently loaded all 972 final Science work packages and proved
that the lesson-ID set exactly equals the admitted Science binding set. The
universe covers nine courses and Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12.
Grade 6 is not admitted and is not silently counted.

The release also binds 81 Science unit-assessment packages. They are inspected
as linked assessment/authority evidence, but they are not added to the 972
lesson count.

## Decision

The corpus is structurally complete and unusually strong on learner-visible
safety, evidence provenance, adult-only scientific correctness authority,
rubrics, and remediation routing. It does not yet provide sufficient learner
depth to support the production-ready label as an instructional judgment.

The blocking pattern is not a missing item count. It is a mismatch between what
the lesson phases claim to do and what the learner actually receives:

1. All 162 `Concept model A/B` lessons ask the learner to build a model, but
   none contains a worked example, worked model, demonstration, or equivalent
   instructional payload.
2. Every lesson prints a short science brief and then repeats the same sentences
   exactly as its evidence table. Each topic's brief/case/evidence payload is
   reused in a second lesson: 486 distinct payloads, each appearing twice.
3. The assessment and independent-mastery phases keep the accepted science
   statements and the deliberately false candidate claim on the learner sheet.
   That supports practice, but it weakens independent mastery evidence because
   the answer-bearing relationships remain visible.
4. Grades 3–8 have no learner-facing physical investigation route in the active
   packages. Their 90 data-sheet lessons are document-evidence inquiries. High
   School has 36 actual Investigation-phase labs; the same 36 unit lab/model
   payloads are reused on Performance-task day, yielding 72 route occurrences.
5. Age-band rendering is inverted in volume. Grade 3 learner sheets average
   2,944 audit-token words, including about 1,008 words of safety content;
   High School averages 2,839 and about 734 respectively. The issue is not that
   Science must meet a numeric quota. It is that Grade 3 receives the longest,
   densest recurring policy surface while still lacking the promised worked
   teaching object.
6. Tutor-facing prose is extensive, but machine-actionable tutor metadata is
   not ready. All 972 packages have expected-reasoning maps, remediation routes,
   and mastery rules; none has the checked structured fields for prerequisite
   IDs, misconception codes, response schema, attempt-history evidence, or
   next-lesson routing.

## Lesson-type distinction

This analytical classification is exhaustive and mutually exclusive. The raw
authoring phase remains in `lesson-evidence.csv`.

| Audit type | Source phases | Lessons | Depth finding |
| --- | --- | ---: | --- |
| Concept | Launch/diagnostic, Concept model A/B, Guided practice A/B | 405 | Briefs and guided evidence routines exist; worked teaching objects do not. |
| Inquiry/investigation | K–8 Investigation or close reading | 45 | Complete document-evidence inquiry; no empirical/hands-on route. |
| Lab/activity | High School Investigation | 36 | Executable H4 physical route plus model-data alternative and strong safety. |
| Review | Synthesis and review | 81 | Coherent evidence synthesis, but the same answer-bearing brief remains visible. |
| Remediation | Reteach/varied practice and Correction/reflection | 162 | Clear adult routes; prompts and examples remain generic. |
| Mastery | Independent application A | 81 | Fresh-evidence language exists, but the supplied brief/case prevents clean independence. |
| Assessment/project | Performance task build and Unit assessment | 162 | Checkable evidence/product language exists; task inputs are heavily templated and assessments remain cued. |

## Dimension findings

| Dimension | Judgment | Corpus-wide evidence |
| --- | --- | --- |
| Concept explanation | **Mixed** | All 972 have a 3- or 4-row science brief. The statements are generally accurate relationships, but they are short content-key extracts rather than developed explanations with mechanisms, examples, misconceptions, and conceptual progression. |
| Worked/model examples | **Blocking gap** | 0/162 Concept-model lessons and 0/972 total lessons contain a worked-example payload. The 72 High School model-data tables are investigation alternatives, not worked examples for the concept phases. |
| Scientific vocabulary | **Gap** | Scientific terms appear throughout the briefs, but 0/972 packages have a structured vocabulary/glossary field, pronunciation support, morphology support, or an explicit term-to-example scaffold. |
| Guided reasoning | **Mixed** | Guided phases and adult expected-reasoning maps exist. Guidance is a static evidence-order routine; it does not show a worked line of reasoning, reveal support gradually, or branch on learner response. |
| Independent questions | **Weak mastery evidence** | Independent and mastery language appears, but the learner still sees the accepted relationships, duplicate evidence table, and candidate error. Independence is therefore procedural rather than answer-independent. |
| Data/table/graph interpretation | **Gap outside High School investigations** | All 972 show a table, but most tables contain prose assertions. Only 72 lessons contain a numeric/categorical model table, representing 36 unique High School datasets repeated twice. A graph action is explicitly requested in 31 lessons. |
| Investigation/lab instructions | **Mixed** | 90 Grades 3–8 routes are safe, executable document inquiries. High School has 36 genuine lab-phase routes with materials, safe order, stop conditions, disposal, and an equal-credit model route. Performance-task day reuses each unit's lab/model route. |
| Evidence-based explanation | **Strong** | All 972 require claims tied to named evidence, limitations, provenance, checking, and revision; all 972 have per-question expected-reasoning metadata. |
| Mastery evidence | **Blocking gap** | All 972 state a multi-occasion mastery rule, but the lesson package has no attempt/date evidence contract. Unit-assessment prompts remain supplied-answer tasks, and the linked adult assessment authorities have no completion authority. |
| Remediation | **Mixed/strong** | Every lesson has 5 or 6 adult routes and a student-visible stuck path. The routes are primarily focus substitution into the same signal set and do not identify topic-specific misconceptions with stable codes. |
| Age-appropriate language | **Gap** | Grade 3 sheets are longer than the High School family on average, and the recurring Grade 3 safety section alone averages about 1,008 words. Elementary phrasing is sometimes simplified, but the document architecture and policy load are not elementary-sized. |
| Lab/activity safety | **Strong correctness; mixed usability** | All 972 have learner-visible safety and equal-credit paths. The committed Science safety validator passes. The full emergency/prohibition floor appears even on desk lessons, reducing signal-to-noise for young learners. |
| Question variety | **Mixed** | The corpus uses 14 question-kind sequences. Every lesson also repeats the same four cross-cutting question roles—essential question, evidence quality, limitation, provenance—for 3,888 instances. Variety exists by label more than by task form. |
| Duplicate templates | **Blocking gap** | There are 13 phase-direction strings for 972 lessons; 486 science case payloads each occur exactly twice; all 36 High School model datasets occur exactly twice; the brief and evidence table are identical in all 972 lessons. |
| Engineering language | **Mixed** | Broad engineering/design language reaches 278 lessons and 60 lesson focuses. Criteria, constraints, trade-offs, and design iteration are present, especially in capstones, but many tasks remain claim-evidence worksheets rather than build-test-redesign experiences. |
| Answer authority/leakage | **Mixed with assessment blocker** | Adult correctness sheets remain separate in all 972 learner files, and no adult-key heading leaks. However, learner briefs are generated from accepted authority relationships, the evidence table repeats them verbatim, and the candidate claim is generated from a disqualifying error. That is appropriate for instruction but not for independent assessment. |
| Tutor metadata readiness | **Human-usable, automation-incomplete** | All packages have objective-indexed expected reasoning, routes, and mastery prose. None has any of the six checked structured tutor fields. Of 81 bound assessment packages, only 27 have a metadata reference and none has a completion authority. |

## Linked assessment findings

All 81 Science assessment bindings are `BOUND`, all learner packages say
`READY`, and none embeds answer material. The authority separation is real.
However:

- 27 packages use the canonical seven-task shape; 54 use a six-section
  projection of the Science learner sheet.
- Only 27/81 carry a non-null `metadataRef`.
- None of the 81 learner assessment JSON payloads embeds a science brief,
  bound evidence table, Evidence IDs, or model-output dataset. Each points to
  the Unit-assessment lesson sheet through `learnerMaterialRef`, so concrete
  Science input depends on that linked material rather than the bound
  assessment package standing alone.
- All 81 adult authorities declare `INJECTED_PRODUCTION_ASSESSOR`, but
  `completionAuthority` is null in every record.

This is not answer leakage from the restricted adult file. It is an authority
and package-completeness ambiguity that must be resolved before the assessment
can serve as mastery evidence.

## Generator families

Four observable generator/source families drive the active corpus:

| Family | Courses | Lessons | Family anchor |
| --- | --- | ---: | --- |
| `g34-k8-elementary` | Grades 3–4 Science | 216 | `ma-g3-science-u01-l02` |
| `canonical-k8-elementary` | Grade 5 Science | 108 | `ma-g5-science-u01-l02` |
| `canonical-k8-middle` | Grades 7–8 Science | 216 | `ma-g7-science-u01-l07` |
| `h4-high-school` | Biology, Chemistry, Physics, Earth/Space/Environmental | 432 | `ma-hs10-chemistry-u01-l07` |

The renderer then applies the same 13 phase-direction templates and a small set
of objective-question shapes across those families.

## Recommended representative sample lesson

Use **`ma-g3-science-u01-l02` — Concept model A: testable questions** as the
single representative depth sample for any later repair session.

It is the highest-leverage sample because it exposes the shared core failure in
the youngest band: the objective promises an explicit worked example or model,
the learner package contains neither, the science brief is repeated as the
evidence table, and the 2,851-word sheet devotes 1,008 words to safety before a
seven-question evidence routine. A successful repair of this sample would need
to demonstrate actual concept teaching, vocabulary support, guided-to-
independent release, age-appropriate surface design, and protected assessment
authority without weakening safety. The High School lab anchor above should be
used only as a secondary safety/data regression check.

## Recommendations for a later repair branch

These are recommendations only; no repair is included here.

1. Add a real learner-facing worked phenomenon/example/model to each concept
   family, then make guided work refer to that object and remove it for the
   independent/mastery task.
2. Separate instruction, practice, and assessment authority. Assessment should
   ship a fresh phenomenon, case, dataset, or design brief without printing the
   accepted relationships or the disqualifying-error source beside it.
3. Add empirical K–8 inquiry where scientifically and safely appropriate;
   retain document inquiry as an equal-credit route, not as the only route.
4. Add explicit vocabulary metadata with definitions and examples calibrated
   by band, without turning Science into a Math-style item-count gate.
5. Layer safety presentation so universal policy remains available while the
   first learner view foregrounds only today's hazards, controls, supervision,
   stop conditions, and disposal.
6. Add stable tutor metadata for prerequisites, misconceptions, response
   evidence, mastery occasions/dates, and deterministic next-step routing.
7. Make the 81 bound assessment packages self-contained or define and test a
   runtime contract that resolves their linked learner material and completion
   authority unambiguously.

## Evidence files

- `summary.json` — deterministic corpus totals and distributions.
- `lesson-evidence.csv` — one row for each of the 972 active lessons.
- `assessment-evidence.csv` — one row for each of the 81 linked assessments.
- `course-summary.csv` — course-level rollup.
- `generator-family-summary.csv` — generator/source-family rollup.
- `audit.py` — reproducible read-only evidence extractor.
- `methodology.md` — scope, definitions, checks, and limitations.
- `verification.md` — recorded integrity/gate results for this audit run.
