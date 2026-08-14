# ELA learner depth audit R1

**Status:** COMPLETE

**Authoritative base:** `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

**Active production release:** `family-pilot-r1` (ELA production source `d161efc876ad7563505897323f80fdb2cb11d5a4`)

**Scope:** 1,620 active English Language Arts lessons across Grades 3, 4, 5, 7, 8, 9, 10, 11, 12. Grade 6 is unsupported by the admitted release. Production curriculum was read only; this branch contains audit evidence only.

## Executive finding

The active ELA inventory reconciles exactly, but **0 of 1,620 lessons are learner-depth ready** under an ELA-specific, type-aware review. This is not a lesson-count finding and does not apply Mathematics item-count expectations to ELA. The core problem is composition collapse: all lessons are projected by one repair family into an orientation paragraph, one of 18 single-response prompts, one normalized guided routine, and one normalized reteach routine. No learner package contains a worked reading/writing model, an embedded comprehension checkpoint, or runtime-addressable Tutor metadata.

The present structural H3 gate remains useful evidence for package presence, source delivery, and adult-key separation. It does not test instructional depth, authentic grade progression, passage diversity, or Tutor enactability, so its 1,620 READY result does not contradict this audit.

## Reconciled active inventory

| Grade | Scheduled/admitted lessons | Learner packages | Adult guides | Production bindings | Depth ready |
| --- | ---: | ---: | ---: | ---: | ---: |
| 3 | 180 | 180 | 180 | 180 | 0 |
| 4 | 180 | 180 | 180 | 180 | 0 |
| 5 | 180 | 180 | 180 | 180 | 0 |
| 7 | 180 | 180 | 180 | 180 | 0 |
| 8 | 180 | 180 | 180 | 180 | 0 |
| 9 | 180 | 180 | 180 | 180 | 0 |
| 10 | 180 | 180 | 180 | 180 | 0 |
| 11 | 180 | 180 | 180 | 180 | 0 |
| 12 | 180 | 180 | 180 | 180 | 0 |

Total: **1,620** lessons, **1,620** packages, **1,620** adult guides, and **1,620** admitted ELA bindings. The release manifest independently declares **1,620** ELA bindings. Reconciliation: **exact**.

Assessments are counted only when they occupy one of the 180 scheduled ELA lesson rows. Separate assessment artifacts are authority/supporting material, not additional lessons. Reserve material is excluded.

## ELA lesson types

Every lesson receives one deterministic dominant type so counts do not overlap. Phase labels control diagnostic, assessment, remediation, review, mastery, project, and writing classifications; grammar/language and reading use phase plus unit/focus evidence; the remainder is concept/skill. These are audit groupings, not a proposed schedule.

| Dominant lesson type | Lessons |
| --- | ---: |
| assessment | 90 |
| concept/skill | 178 |
| diagnostic | 90 |
| grammar/language | 159 |
| mastery | 90 |
| project | 220 |
| reading | 413 |
| remediation | 180 |
| review | 160 |
| writing | 40 |

Type-aware review means, for example, that an assessment is not rejected for lacking a mini-lesson and a diagnostic is not required to look like a concept lesson. The corpus-wide blocking findings instead come from the shared projection: even where a lesson type calls for modeling, guided feedback, source transfer, or assessment prompts, the emitted package supplies the same shallow shell.

## Exact defect counts

Counts are lesson incidence, not unique-error totals; one lesson can carry multiple codes.

| Defect code | Lessons affected |
| --- | ---: |
| `ADULT_AUTHORITY_NOT_SOURCE_ANCHORED` | 1620 |
| `GENERIC_REMEDIATION` | 1620 |
| `LEARNER_FACING_ENGINEERING_LANGUAGE` | 1620 |
| `MASTERY_EVIDENCE_NOT_RUNTIME_ADDRESSABLE` | 1620 |
| `NEAR_DUPLICATE_STRUCTURE` | 1620 |
| `QUESTION_VARIETY_TEMPLATE_BOUND` | 1620 |
| `READING_LEVEL_EVIDENCE_MISSING` | 1620 |
| `SOURCE_QUALITY_TEMPLATE_OR_REUSE` | 1620 |
| `TUTOR_READINESS_METADATA_MISSING` | 1620 |
| `NO_EMBEDDED_COMPREHENSION_CHECKS` | 1440 |
| `GENERATED_PASSAGE_NOT_AUTHENTICALLY_GRADE_DIFFERENTIATED` | 1300 |
| `SOURCE_TELEGRAPHS_TARGET_REASONING` | 1300 |
| `WRITING_REQUIRED_FLAG_CONTRADICTS_WRITTEN_DELIVERABLE` | 1110 |
| `GENERIC_GUIDED_ROUTINE` | 970 |
| `NO_EXPLICIT_VOCABULARY_SUPPORT` | 970 |
| `NO_MODELED_READING_OR_WRITING_EXAMPLE` | 970 |
| `SHALLOW_TEACHING_EXPLANATION` | 970 |
| `WRITING_SCAFFOLD_NOT_PHASE_SPECIFIC` | 510 |
| `MODEL_LABELED_LESSON_HAS_NO_MODEL` | 250 |
| `GUIDED_LABELED_LESSON_HAS_NO_GUIDED_TRY_FEEDBACK_LOOP` | 180 |
| `TRANSFER_LABELED_LESSON_HAS_NO_NEW_TEXT` | 90 |
| `UNIT_ASSESSMENT_PROMPTS_NOT_PROJECTED` | 90 |

Important negative controls:

- Missing independent reading/writing task: **0**. Every package has a complete inline source and one constructed-response task.
- Missing adult guide or admitted production binding: **0**.
- Learner exposure of adult rubric/key fields: **0**.
- Exact duplicate independent-task strings: **0**; focus/title interpolation makes strings unique even though their normalized shapes repeat.

## Dimension findings

### Teaching, modeling, vocabulary, and guided work

All 1,620 learner packages use one short orientation pattern: identify explicit text versus inference, select relevant evidence, and explain the connection. That is a useful reminder, not a lesson-specific explanation of the named skill. The type-aware defect applies to **970** concept/skill, reading, writing, grammar/language, and remediation lessons; diagnostic, review, mastery, assessment, and project lessons are not assigned this code merely for lacking a mini-lesson. Worked or annotated examples physically present: **0**; the modeled-example defect is likewise limited to the same **970** instruction-bearing lessons. This includes **250** lessons explicitly labeled `Concept model` or `Explicit model`, which contain no model, and **180** lessons labeled `Guided practice`, which contain no guided try/check/feedback loop.

Vocabulary support is physically absent in all 1,620 packages: there are no selected terms with learner-friendly meanings, morphology/word-part support, pronunciation/decoding help, contextual examples, or vocabulary checks. The defect count is limited to the **970** instruction-bearing lessons. Even word-study, morphology, decoding, fluency, grammar, and language lessons receive the same inference/evidence routine.

After replacing the inserted source title and focus, guided support has **1** unique routine across the whole corpus. It tells the learner to preview, mark an explicit statement and inference, test evidence, and draft, but it never presents a partial example or records a learner response before independent work.

### Independent work, comprehension, mastery, and reteach

Independent work is present in all lessons, but it is always a single constructed response from one of **18** day-position families (**90 uses of each family**). There are no embedded comprehension checks or feedback opportunities before submission in any lesson; the type-aware defect applies to **1440** lessons and excludes assessment and mastery lessons from that expectation.

Adult guides carry a mastery statement for every lesson, usually requiring evidence on multiple occasions. Learner packages and Tutor metadata provide no stable occasion ID, evidence type, independence state, misconception code, or transfer record, so the rule cannot be enacted from the package. The normalized remediation routine count is **1**: evidence gap, reasoning gap, overclaim, and completion gap are repeated in all 1,620 lessons without diagnosis-specific examples or a new check.

All **90** transfer-labeled lessons tell the learner to use a different paragraph or perspective in the same delivered source, despite claiming transfer to a new text. All **90** unit-assessment lessons use the generic independent-claim phase prompt; the source unit-assessment prompts adapted by `curriculum-production/student-work/english-language-arts/src/lib.mjs` are not emitted into the learner package.

### Writing scaffolds

The generator marks **510** lessons as writing-required. Their scaffold is only a product label, response length, three generic task steps, and general success criteria; none includes phase-specific planning organizers, paragraph/function guidance, transition or syntax support, revision lenses, exemplar/non-exemplar analysis, or a feedback cycle. The other **1110** lessons set `writingTask.required: false` while still directing the learner to write a paragraph or multi-paragraph response, a semantic contradiction for UI/Tutor consumers.

### Reading level and source/passage quality

No package records a grade-band complexity judgment, readability provenance, qualitative complexity review, knowledge-demand note, accessibility adaptation, or human approval. Word count alone is present. Therefore reading-level appropriateness is **not evidenced for all 1,620 lessons**; the Flesch–Kincaid values below are advisory machine evidence only and do not decide the defect classification.

| Grade | Source words min / median / max | Advisory FK min / median / max | Source origin counts |
| --- | --- | --- | --- |
| 3 | 101 / 234 / 292 | 1.48 / 5.08 / 10.38 | {"academy_original_bank":160,"academy_original_generated":20} |
| 4 | 131 / 303 / 341 | 2.87 / 6.88 / 11.12 | {"academy_original_bank":160,"academy_original_generated":20} |
| 5 | 254 / 279 / 304 | 9.05 / 10.02 / 10.8 | {"academy_original_generated":180} |
| 7 | 255 / 290 / 301 | 9.08 / 9.99 / 10.93 | {"academy_original_generated":180} |
| 8 | 257 / 278 / 301 | 9.05 / 10.16 / 11.01 | {"academy_original_generated":180} |
| 9 | 313 / 341 / 363 | 9.99 / 10.92 / 11.73 | {"academy_original_generated":180} |
| 10 | 317 / 352 / 366 | 10.01 / 10.8 / 11.89 | {"academy_original_generated":180} |
| 11 | 367 / 407 / 420 | 9.76 / 10.59 / 11.2 | {"academy_original_generated":180} |
| 12 | 374 / 407 / 418 | 9.81 / 10.48 / 11.25 | {"academy_original_generated":180} |

The source corpus has **1,333 unique bodies for 1,620 lessons**. The 320 bank-backed assignments collapse to **33 exact-body groups** (all 320 lessons affected; up to 24 lessons share one body). The remaining 1,300 readings are composed from only five paragraph shells:

| Generated passage family | Lessons |
| --- | ---: |
| contentRepair:argument case | 236 |
| contentRepair:editorial case | 242 |
| contentRepair:information case | 286 |
| contentRepair:literary case | 442 |
| contentRepair:reflection case | 94 |

Grade progression in those 1,300 readings is implemented chiefly by appending the same paragraph 5 for Grades 5+, paragraph 6 for Grades 9+, and paragraph 7 for Grades 11+, while the four-paragraph case remains structurally shared. That is not authentic differentiation of syntax, vocabulary, background knowledge, genre, text structure, or disciplinary demand.

### Question variety and near duplication

Every unit repeats the same 18 question positions. Focus interpolation prevents exact task duplicates but does not create a new reasoning design. All 1,620 lessons are therefore affected by normalized question-template reuse. Near-duplication affects all lessons through one of two mechanisms: **320** use exact repeated bank bodies and **1,300** use the five generated passage shells. The single normalized guided and remediation routines amplify the repetition.

### Learner-facing engineering language and answer leakage

All learner packages use production/compliance language such as “delivered Academy-original source,” “named deliverable,” “evidence requirement,” and “learner success criterion.” These labels make the generator visible to the learner and are especially unsuitable in elementary grades.

There are **0 adult-field leaks** into learner JSON. However, all **1,300 generated passages** have instructional answer leakage of a different kind: paragraph 4 explicitly inserts the lesson focus and explains how the case demonstrates it; Grades 5+ also receive a paragraph that names the workshop goal and describes the evidence move. The independent prompt then asks the learner to explain or apply that same relationship. This is source-to-question telegraphing, not an exposed adult key.

### Adult-key authority

Pairing and separation are complete: 1,620 of 1,620 lessons have an external `RUBRIC` guide, mastery criteria, and an authorship boundary, with no guide fields copied into learner packages. Authority depth is still weak in all lessons. Rubric dimensions are inherited generic criteria, while acceptable-answer text concatenates criteria and the generic generated success statements; no guide contains source-specific evidence anchors, misconception boundaries, or annotated examples that would let two adults or a Tutor score the named task consistently without inventing content.

### Tutor readiness

| Metadata | Lessons present | Audit result |
| --- | ---: | --- |
| grade and phase | 1620 | present/derivable |
| adult authorship boundary | 1620 | present in separate guide |
| stable concept IDs | 0 | gap |
| prerequisites | 0 | gap |
| misconception IDs/triggers | 0 | gap |
| Tutor routes | 0 | gap; source adapter reads routes but package projection drops them |
| graduated hints | 0 | gap |
| retry/reteach policy | 0 | gap |
| evidence-capture schema | 0 | gap |
| age/reading-language policy | 0 | gap |
| answer-reveal policy | 0 | gap |

## Generator and composition responsibility

The corpus is not 1,620 independently authored learner lessons. Three source adapters normalize upstream records—Grades 3/4 (**360**), Grades 5/7/8 (**540**), and Grades 9–12 (**720**)—then `curriculum-production/student-work/english-language-arts/src/contentRepair.mjs` and `curriculum-production/student-work/english-language-arts/src/lib.mjs` overwrite the learner experience with shared source/work shells.

- `ela-content-repair-v2` affects all **1,620** lessons and owns the teaching paragraph, 18 prompt families, guided routine, remediation routine, writing-required inference, learner projection, and adult-guide projection.
- `academy-original-generated-five-shells` affects **1,300** lessons and owns passage templating, weak grade differentiation, source-quality repetition, and source-to-question telegraphing.
- `academy-original-bank-reuse` affects **320** lessons; 33 bodies are repeatedly assigned across those lesson slots.

Exact family membership is recorded on every row in `lesson-findings.jsonl` and summarized in `generator-families.json`.

## Representative Stephen-reviewed sample

Recommend exactly one lesson: **`ma-g7-english-language-arts-u05-l03` — “Guided practice A: reasoning and warrants.”**

It is the best first sample because it sits in a high-value middle-grade argument unit and should exercise nearly every required ELA capability in a compact review: explicit teaching of claim/evidence/warrant, a modeled annotation on a separate example, vocabulary, guided reasoning with feedback, independent source use, writing support, comprehension checks, reteach, an adult rubric, authorship boundaries, and Tutor routes. Its current form also cleanly demonstrates the systemic defect: it is labeled guided practice but emits the same generic routine and a fully independent two-paragraph response.

## Repair plan

`repair-plan.json` begins with the single Stephen-reviewed lesson, then repairs the shared contract, separates source work into non-overlapping G3–4, G5/7/8, and G9–12 families, and finally regenerates/integrates authority and Tutor metadata. No repair was performed in this audit.

## Evidence files

- `lesson-findings.jsonl`: one record per active ELA lesson (1,620 lines).
- `summary.json`: reconciled inventory, exact defect counts, type counts, grade metrics, and corpus mechanics.
- `generator-families.json`: composition ownership and family counts.
- `repair-plan.json`: future staged repair ownership and acceptance criteria.
- `build-audit.mjs`: deterministic evidence builder; it reads production files and writes only this audit directory.

## Audit limits

- The audit judges emitted learner packages and paired adult guides, not the quality of inaccessible prior branch history.
- Machine readability is advisory; missing human complexity evidence is the defect, not a numeric score by itself.
- Structural repetition is not automatically bad in a routine. It becomes a defect here because the same routine replaces lesson-specific explanation, modeling, guided feedback, source variety, and reteach across a full-year ELA program.
- The audit does not run a Tutor runtime; it inventories whether the lesson metadata could support one.

**Final classification: ELA_DEPTH_AUDIT_COMPLETE**
