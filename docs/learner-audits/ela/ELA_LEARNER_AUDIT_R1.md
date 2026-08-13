# ELA learner completeness audit R1

Classification: **ELA_LEARNER_AUDIT_COMPLETE**

Learner launch ruling: **DO_NOT_BEGIN_YET for Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12**

Base audited: `c81ddb6e04bc1c3629212327d47817c1b5677477`

ELA production source commit bound by the admitted release: `00374a8dc26eddfac2cf52aec5661deff760ddbb`

## Executive finding

All **1,620/1,620** ELA lessons were traced from the production student-work package through the final slot, admitted binding, admitted runtime row, reconstructed production browser projection, and mounted Lesson Player path. The release is not learner-complete.

Every ELA package tells the learner to use an assigned passage, assigned text, or unit-specific source. Every admitted ELA binding nevertheless declares `STATIC_READY/READY`, while **0/1,620** browser materials contain an actual passage or attached selected source. Per the audit rule, that is a blocker.

The browser build also converts ELA's typed task objects to section body prose with **0 structured prompts in 1,620/1,620 lessons**. The final host then passes only `section.prompts[0]` and hard-codes `responseKind: 'none'` with a no-op submit callback. Thus **0/1,620** lessons have a supported learner response capture/persistence path, even though all ask the learner to produce reading, writing, language, discussion, or assessment evidence.

## Counts

| Finding | Lessons |
|---|---:|
| MISSING_READING | 1620 |
| MISSING_SOURCE | 1620 |
| EMPTY_QUESTIONS | 0 |
| EMPTY_WRITING_TASK | 90 |
| EMPTY_RUBRIC | 0 |
| ZERO_ACTIONABLE_WORK | 510 |
| FLATTENED_QUESTION_STRUCTURE | 1620 |
| UNSUPPORTED_WRITING_RESPONSE | 1620 |
| PLACEHOLDER | 530 |
| COPYRIGHT_SOURCE_PROBLEM | 752 |
| ANSWER_OR_SCORING_LEAK | 0 |
| CROSS_GRADE_TEMPLATE_COLLAPSE | 830 |

`EMPTY_RUBRIC` is zero because every admitted lesson has a separate, nonempty adult scoring guide. The browser correctly leaks none of those adult scoring fields. However, it also projects no learner-visible success criteria; that is recorded as browser loss rather than falsely calling the source rubric empty.

## Grade rulings

| Grade | Audited | Ruling | Missing reading | Zero actionable | Empty writing task | Cross-grade copy |
|---:|---:|---|---:|---:|---:|---:|
| 3 | 180 | DO_NOT_BEGIN_YET | 180 | 0 | 0 | 0 |
| 4 | 180 | DO_NOT_BEGIN_YET | 180 | 0 | 0 | 0 |
| 5 | 180 | DO_NOT_BEGIN_YET | 180 | 170 | 30 | 170 |
| 7 | 180 | DO_NOT_BEGIN_YET | 180 | 170 | 30 | 170 |
| 8 | 180 | DO_NOT_BEGIN_YET | 180 | 170 | 30 | 170 |
| 9 | 180 | DO_NOT_BEGIN_YET | 180 | 0 | 0 | 80 |
| 10 | 180 | DO_NOT_BEGIN_YET | 180 | 0 | 0 | 80 |
| 11 | 180 | DO_NOT_BEGIN_YET | 180 | 0 | 0 | 80 |
| 12 | 180 | DO_NOT_BEGIN_YET | 180 | 0 | 0 | 80 |

No grade can begin: passage absence and an unsupported response path affect every lesson in every grade.

## Source and copyright readiness

| Grade | Binding says ready | Actual browser reading | Browser source section | No production source ref | Ungated facilitator contract | Misleading original availability |
|---:|---:|---:|---:|---:|---:|---:|
| 3 | 180 | 0 | 0 | 20 | 0 | 160 |
| 4 | 180 | 0 | 0 | 20 | 0 | 160 |
| 5 | 180 | 0 | 180 | 0 | 180 | 0 |
| 7 | 180 | 0 | 180 | 0 | 180 | 0 |
| 8 | 180 | 0 | 180 | 0 | 180 | 0 |
| 9 | 180 | 0 | 0 | 0 | 0 | 108 |
| 10 | 180 | 0 | 0 | 0 | 0 | 108 |
| 11 | 180 | 0 | 0 | 0 | 0 | 90 |
| 12 | 180 | 0 | 0 | 0 | 0 | 126 |

- Grades 3–4: 320 lessons point to Manuel Academy originals whose full bodies exist in the separate authoring worktree, but the admitted binding carries only the student-work JSON and the browser projection drops the structured reference. Another 40 lessons have no source reference at all.
- Grades 5/7/8: all 540 lessons visibly say a facilitator must choose a text. That is an honest selection instruction, but the binding still marks the lesson static-ready and neither requires nor attaches the selected source before launch.
- Grades 9–12: all 720 lessons carry original/public-domain metadata in production, but the browser projector drops the entire structured source-reference object. Original high-school bank entries contain only an opening passage, not the promised full work, and none of those banks is an admitted browser resource.
- 752 lessons claim an original “ships with the course package” although the actual admitted learner package/browser payload contains no such text. This is `COPYRIGHT_SOURCE_PROBLEM`; no rights-required assigned references were observed.

## Task, question, writing, and rubric findings

- **510** Grades 5/7/8 lessons use a central instruction that never supplies the promised “new application” or assessment-preparation item; these are `ZERO_ACTIONABLE_WORK`/`PLACEHOLDER`. The remaining 30 lessons in those grades are unit-assessment days with real prompt prose.
- **90** Grades 5/7/8 performance-task planning/build/publication days do not name the daily product or unit deliverable in the learner task and are `EMPTY_WRITING_TASK`.
- **20** Grades 3–4 unit assessments promise a fixed-answer item “delivered separately,” but the production README confirms no item/options/key bank exists. They are additional `PLACEHOLDER` findings.
- **830** lessons reuse an identical independent task across multiple grades. The exact copied groups and SHA-256 identities are in `browser-loss.json`; Grades 5/7/8 account for 510 and Grades 9–12 for 320.
- **1,620** scoring guides contain a nonempty rubric and acceptable-answer criteria; **0** adult answer/scoring fields enter browser learner material. Learner-visible success criteria are nevertheless absent in all 1,620 browser lessons.

## Browser and Lesson Player loss

Result: **FAIL — TASK_STRUCTURE_NOT_PRESERVED / RESPONSE_UNSUPPORTED**.

- 1,040 structured source-reference objects are discarded because the browser build accepts only an object's scalar `text` member.
- Every independent task remains visible only as body prose; prompt arrays are empty in all 1,620 projected ELA materials.
- The mounted host selects only the first prompt even for formats capable of multiple prompts.
- The mounted host hard-codes no-response mode and a no-op submit callback. Learners can press Continue/complete segments without entering, uploading, selecting, or persisting the requested work.

## Manual stratified inspection (54 lessons)

| Grade | Stratum | Lesson | Phase | Result | Close-read observation |
|---:|---|---|---|---|---|
| 3 | first | `ma-g3-english-language-arts-u01-l01` | Launch and baseline | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 3 | concept-build | `ma-g3-english-language-arts-u01-l02` | Word work and decoding focus | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 3 | analysis | `ma-g3-english-language-arts-u01-l09` | Shared close reading | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 3 | writing | `ma-g3-english-language-arts-u01-l12` | Writing plan and draft | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 3 | assessment/performance | `ma-g3-english-language-arts-u01-l17` | Unit assessment | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 3 | final | `ma-g3-english-language-arts-u10-l18` | Correction, publication, and reflection | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 4 | first | `ma-g4-english-language-arts-u01-l01` | Launch and diagnostic | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 4 | concept-build | `ma-g4-english-language-arts-u01-l02` | Word study and morphology | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 4 | analysis | `ma-g4-english-language-arts-u01-l10` | Craft or structure analysis | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 4 | writing | `ma-g4-english-language-arts-u01-l12` | Writing plan and draft | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 4 | assessment/performance | `ma-g4-english-language-arts-u01-l17` | Unit assessment | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 4 | final | `ma-g4-english-language-arts-u10-l18` | Targeted correction, publication, and reflection | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 5 | first | `ma-g5-english-language-arts-u01-l01` | Launch and diagnostic | BLOCKER | assigned source absent from browser; central application/item unspecified; deliverable stated or not a writing-build day; player response disabled |
| 5 | concept-build | `ma-g5-english-language-arts-u01-l02` | Concept model A | BLOCKER | assigned source absent from browser; central application/item unspecified; deliverable stated or not a writing-build day; player response disabled |
| 5 | analysis | `ma-g5-english-language-arts-u01-l07` | Investigation or close reading | BLOCKER | assigned source absent from browser; central application/item unspecified; deliverable stated or not a writing-build day; player response disabled |
| 5 | writing | `ma-g5-english-language-arts-u01-l12` | Performance task build | BLOCKER | assigned source absent from browser; central application/item unspecified; writing/performance deliverable unspecified; player response disabled |
| 5 | assessment/performance | `ma-g5-english-language-arts-u01-l16` | Unit assessment | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 5 | final | `ma-g5-english-language-arts-u10-l18` | Publication, presentation, or reflection | BLOCKER | assigned source absent from browser; central application/item unspecified; writing/performance deliverable unspecified; player response disabled |
| 7 | first | `ma-g7-english-language-arts-u01-l01` | Launch and diagnostic | BLOCKER | assigned source absent from browser; central application/item unspecified; deliverable stated or not a writing-build day; player response disabled |
| 7 | concept-build | `ma-g7-english-language-arts-u01-l02` | Concept model A | BLOCKER | assigned source absent from browser; central application/item unspecified; deliverable stated or not a writing-build day; player response disabled |
| 7 | analysis | `ma-g7-english-language-arts-u01-l07` | Investigation or close reading | BLOCKER | assigned source absent from browser; central application/item unspecified; deliverable stated or not a writing-build day; player response disabled |
| 7 | writing | `ma-g7-english-language-arts-u01-l12` | Performance task build | BLOCKER | assigned source absent from browser; central application/item unspecified; writing/performance deliverable unspecified; player response disabled |
| 7 | assessment/performance | `ma-g7-english-language-arts-u01-l16` | Unit assessment | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 7 | final | `ma-g7-english-language-arts-u10-l18` | Publication, presentation, or reflection | BLOCKER | assigned source absent from browser; central application/item unspecified; writing/performance deliverable unspecified; player response disabled |
| 8 | first | `ma-g8-english-language-arts-u01-l01` | Launch and diagnostic | BLOCKER | assigned source absent from browser; central application/item unspecified; deliverable stated or not a writing-build day; player response disabled |
| 8 | concept-build | `ma-g8-english-language-arts-u01-l02` | Concept model A | BLOCKER | assigned source absent from browser; central application/item unspecified; deliverable stated or not a writing-build day; player response disabled |
| 8 | analysis | `ma-g8-english-language-arts-u01-l07` | Investigation or close reading | BLOCKER | assigned source absent from browser; central application/item unspecified; deliverable stated or not a writing-build day; player response disabled |
| 8 | writing | `ma-g8-english-language-arts-u01-l12` | Performance task build | BLOCKER | assigned source absent from browser; central application/item unspecified; writing/performance deliverable unspecified; player response disabled |
| 8 | assessment/performance | `ma-g8-english-language-arts-u01-l16` | Unit assessment | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 8 | final | `ma-g8-english-language-arts-u10-l18` | Publication, presentation, or reflection | BLOCKER | assigned source absent from browser; central application/item unspecified; writing/performance deliverable unspecified; player response disabled |
| 9 | first | `ma-g9-english-language-arts-u01-l01` | Launch and diagnostic | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 9 | concept-build | `ma-g9-english-language-arts-u01-l02` | Concept model A | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 9 | analysis | `ma-g9-english-language-arts-u01-l07` | Investigation or close reading | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 9 | writing | `ma-g9-english-language-arts-u01-l12` | Performance task build | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 9 | assessment/performance | `ma-g9-english-language-arts-u01-l16` | Unit assessment | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 9 | final | `ma-g9-english-language-arts-u10-l18` | Publication, presentation, or reflection | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 10 | first | `ma-g10-english-language-arts-u01-l01` | Launch and diagnostic | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 10 | concept-build | `ma-g10-english-language-arts-u01-l02` | Concept model A | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 10 | analysis | `ma-g10-english-language-arts-u01-l07` | Investigation or close reading | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 10 | writing | `ma-g10-english-language-arts-u01-l12` | Performance task build | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 10 | assessment/performance | `ma-g10-english-language-arts-u01-l16` | Unit assessment | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 10 | final | `ma-g10-english-language-arts-u10-l18` | Publication, presentation, or reflection | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 11 | first | `ma-g11-english-language-arts-u01-l01` | Launch and diagnostic | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 11 | concept-build | `ma-g11-english-language-arts-u01-l02` | Concept model A | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 11 | analysis | `ma-g11-english-language-arts-u01-l07` | Investigation or close reading | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 11 | writing | `ma-g11-english-language-arts-u01-l12` | Performance task build | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 11 | assessment/performance | `ma-g11-english-language-arts-u01-l16` | Unit assessment | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 11 | final | `ma-g11-english-language-arts-u10-l18` | Publication, presentation, or reflection | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 12 | first | `ma-g12-english-language-arts-u01-l01` | Launch and diagnostic | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 12 | concept-build | `ma-g12-english-language-arts-u01-l02` | Concept model A | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 12 | analysis | `ma-g12-english-language-arts-u01-l07` | Investigation or close reading | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 12 | writing | `ma-g12-english-language-arts-u01-l12` | Performance task build | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 12 | assessment/performance | `ma-g12-english-language-arts-u01-l16` | Unit assessment | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |
| 12 | final | `ma-g12-english-language-arts-u10-l18` | Publication, presentation, or reflection | BLOCKER | assigned source absent from browser; task prose present; deliverable stated or not a writing-build day; player response disabled |

## Negative controls

| Injected defect | Detection |
|---|---|
| missingReading | PASS |
| emptyWritingPrompt | PASS |
| missingRubric | PASS |
| answerLeak | PASS |
| sourceBrowserPromptLoss | PASS |
| copiedCrossGradeTask | PASS |

Overall negative-control result: **PASS**.

## Trace and limitations

- The current ELA production tree is byte-identical to the admitted binding's pinned commit `00374a8dc26eddfac2cf52aec5661deff760ddbb`.
- All 1,620 final slots, admitted bindings, runtime rows, production packages, scoring guides, and in-memory browser materials matched lesson/grade identities.
- No production, course, release, public, app, or source-worktree file was changed. The browser payload was reconstructed in memory from the checked-in production builder because the generated public payload is not committed in this worktree.
- This audit proves repository/browser readiness only. It does not claim that a family independently owns, borrows, or licenses a referenced work outside the admitted app.
