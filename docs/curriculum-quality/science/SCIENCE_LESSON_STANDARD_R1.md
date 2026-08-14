# Manuel Academy Science Lesson Standard R1

Status: **DRAFT — ADVISORY, NOT YET AN ENFORCED PRODUCTION GATE**

Evidence base: `docs/curriculum-quality/science/audit-r1/`

Audit disposition: **NOT READY FOR DEPTH ACCEPTANCE**

Companion contract: `SCIENCE_LESSON_ADVISORY_CONTRACT_R1.schema.json`

## 1. Purpose and boundary

This standard defines what a learner-ready Manuel Academy Science lesson must
teach, ask the learner to do, and expose as curriculum-side metadata. It is a
Science standard: adequacy is judged by the scientific work the lesson enables,
not by importing Mathematics item counts or enforcing a universal word, prompt,
or page quota.

R1 is a draft for review and a specification for a later repair effort. It does
not itself accept the current corpus. The completed audit found the 972 admitted
Science lessons structurally complete but not ready for instructional-depth
acceptance. In particular, the corpus has no worked-example payloads, repeats
the brief as its evidence table in every lesson, leaves answer-bearing material
visible during purported mastery, and lacks structured tutor metadata.

This document and its companion schema:

- do not rewrite any of the 972 lessons;
- do not change any of the 81 bound assessments;
- do not change Study Engine, Tutor V2, Dashboard, scoring, release bindings, or
  runtime behavior;
- do not replace the existing Science correctness and safety authorities; and
- define advisory curriculum checks only. A future acceptance session must
  review repaired artifacts and decide whether to promote any check to an
  enforced gate.

## 2. Normative language and Science stance

`MUST` identifies a condition for a lesson to be recommended for depth
acceptance. `SHOULD` identifies a normal expectation that may be waived with a
documented scientific or accessibility reason. `MAY` identifies a valid option.
Because R1 is advisory, a failed `MUST` produces a finding; it does not alter a
production package or release state.

Four principles govern interpretation:

1. **Teach before inference.** A learner must receive an explanation,
   phenomenon, worked model, or demonstration adequate to the concept before
   being asked to infer the science independently.
2. **Evidence must be honest.** Observed, measured, calculated, simulated,
   supplied, and expected values are different evidence states and must never
   be blurred.
3. **Independence must be real.** Practice can be supported. Mastery and
   assessment require fresh, answer-protected evidence.
4. **Vocabulary carries meaning.** Legitimate scientific terms remain in the
   curriculum and are defined; meaning is not weakened merely to reduce a
   readability score.

## 3. Repository-grounded lesson taxonomy

Every lesson contract MUST declare exactly one `primaryLessonType` and MAY
declare additional `instructionalModes`. The primary type names the lesson's
main evidentiary purpose. Modes name substantial scientific work within it. A
lab that ends in a CER is therefore primarily `LAB_HANDS_ON` and may also name
`DATA_ANALYSIS` and `CLAIM_EVIDENCE_REASONING`.

### 3.1 Canonical R1 types

| Type | Required distinguishing purpose |
| --- | --- |
| `CONCEPT_BUILD` | Develop a scientific idea through a clear explanation plus a worked example, model, demonstration, or contrasted cases. It is not a brief followed immediately by independent questions. |
| `PHENOMENON_OBSERVATION` | Establish a real, recorded, pictured, described, or safely demonstrated event to notice and explain. Observation and explanation are labeled separately. |
| `GUIDED_PRACTICE` | Rehearse scientific reasoning with visible scaffolds, feedback criteria, and a planned fade of support. |
| `INVESTIGATION` | Answer a question through an ordered evidence-gathering process. This may be empirical, documentary, field-based, or simulation-based, but the route is named honestly. |
| `LAB_HANDS_ON` | Carry out a physical procedure with materials, hazard-specific safety, recording space, analysis, and cleanup or disposal where applicable. |
| `DATA_ANALYSIS` | Interpret a supplied or learner-generated table, graph, dataset, image set, measurement series, or categorical record. Prose assertions in table cells alone do not qualify as data analysis. |
| `MODEL_BUILDING` | Construct, use, test, compare, or revise a scientific model and state what the model represents, predicts, and leaves out. Copying accepted relationships into a diagram is not sufficient by itself. |
| `CLAIM_EVIDENCE_REASONING` | Make or evaluate a claim, select relevant evidence, and explain why the evidence supports, challenges, or cannot decide the claim. |
| `ENGINEERING_DESIGN` | Define a need or problem, use criteria and constraints, develop alternatives, build or represent a solution, test against evidence, and improve it. Use only where the canonical objective is engineering or design. |
| `REVIEW` | Retrieve, connect, compare, and organize previously taught ideas without introducing mastery claims from supported work. |
| `REMEDIATION` | Respond to a diagnosed prerequisite or misconception with a different explanation or model, followed by fresh evidence. |
| `MASTERY` | Elicit independent, answer-protected evidence on a fresh case, phenomenon, dataset, model, or application. |
| `ASSESSMENT` | Collect protected evidence against stated objectives under a defined answer and adult-authority policy. |
| `PROJECT` | Develop a sustained scientific product, investigation, explanation, communication, or design with milestones and checkable evidence. A worksheet labeled “performance task” is not automatically a project. |

### 3.2 Mapping the current repository phases

The repository currently supplies the following phases and work types. This
mapping preserves them as source evidence; it does not assume that a phase name
proves the required lesson substance.

| Current phase | Current route evidence | Candidate R1 classification, decided from payload |
| --- | --- | --- |
| `Launch and diagnostic` | `STUDENT_WORK_SHEET` / bound reference evidence | `PHENOMENON_OBSERVATION` when a phenomenon is actually supplied; otherwise `CONCEPT_BUILD` or `REVIEW` as warranted |
| `Concept model A/B` | `STUDENT_WORK_SHEET` / bound reference evidence | `CONCEPT_BUILD`, with `MODEL_BUILDING` only when a model is taught, used, and evaluated |
| `Guided practice A/B` | `STUDENT_WORK_SHEET` / bound reference evidence | `GUIDED_PRACTICE`, plus the scientific reasoning mode actually practiced |
| `Independent application A` | `STUDENT_WORK_SHEET` / bound reference evidence | `MASTERY` only when the input is fresh and answer-protected; otherwise `GUIDED_PRACTICE` or `REVIEW` |
| `Investigation or close reading` | `INVESTIGATION_DATA_SHEET` / document investigation | `INVESTIGATION`, `DATA_ANALYSIS`, or both; it must not be described as a physical lab |
| `Investigation` | `INVESTIGATION_DATA_SHEET` / H4 physical route plus model-data alternative | `LAB_HANDS_ON` with `INVESTIGATION` and usually `DATA_ANALYSIS` |
| `Reteach and varied practice` | `STUDENT_WORK_SHEET` | `REMEDIATION` only when the teaching representation changes and evidence is fresh |
| `Correction and reflection` | `STUDENT_WORK_SHEET` | `REMEDIATION` or `REVIEW`, according to the actual learner action |
| `Synthesis and review` | `STUDENT_WORK_SHEET` | `REVIEW`, often with `MODEL_BUILDING` or `CLAIM_EVIDENCE_REASONING` |
| `Performance task build` | K–8 document investigation or H4 physical/model-data route | `PROJECT`; add `ENGINEERING_DESIGN` only for canonical design objectives and complete design cycles |
| `Unit assessment` | `STUDENT_WORK_SHEET` / bound reference evidence | `ASSESSMENT`, subject to fresh-input and authority requirements |

A generator or reviewer MUST classify from the learner experience, not from the
title. The same prompt may not satisfy multiple phase purposes merely because
its heading changes.

## 4. Universal lesson-depth contract

Every lesson recommended for acceptance MUST make the following available in
the learner artifact or through a clearly resolved learner-facing reference:

### 4.1 Intent and prior knowledge

- State what the learner will understand or be able to explain, model,
  investigate, analyze, or design.
- Activate only the prior knowledge needed today, using a concrete recall,
  observation, comparison, or prediction rather than a generic “what do you
  know?” prompt.
- Connect every prerequisite named in metadata to an actual place in the
  lesson, remediation route, or allowed-support plan.
- Do not treat a diagnostic response as taught content or mastery evidence.

### 4.2 Clear concept explanation

A concept explanation MUST do more than list accepted statements. It MUST:

- name the concept and explain the relationship, process, structure, mechanism,
  pattern, or conservation principle at the level appropriate to the course;
- connect cause, condition, process, and outcome without implying causation
  when the evidence supports only association;
- show where the idea applies and at least one boundary, counterexample, or
  limitation when scientifically relevant;
- connect the explanation to the phenomenon, case, model, data, or observation
  the learner is using; and
- distinguish established scientific knowledge from the evidence collected in
  today's activity.

A short paragraph can be part of the explanation. A paragraph that simply
states the target relationships and then asks the learner to infer, model, or
defend those same relationships is not a sufficient teaching object.

### 4.3 Vocabulary

Every new or newly specialized scientific term MUST be identified and defined
in learner-facing language without removing the disciplinary term. Definitions
SHOULD include a relevant example, representation, word-part cue, pronunciation
cue, or contrast when that support materially improves access.

The lesson MUST disambiguate familiar words with scientific meanings, such as
`work`, `force`, `theory`, `adaptation`, `solution`, or `significant`, when they
occur. Vocabulary checks SHOULD ask learners to use the term in scientific
reasoning, not only copy a definition.

### 4.4 Worked or modeled example

`CONCEPT_BUILD`, `GUIDED_PRACTICE`, `MODEL_BUILDING`, `DATA_ANALYSIS`, and
introductory `CLAIM_EVIDENCE_REASONING` lessons MUST include or resolve at least
one worked teaching object appropriate to the intended work. A worked object
MUST show:

1. the question or goal;
2. the relevant input, observation, model, or data;
3. how a scientist selects and uses that information;
4. the reasoning between evidence and conclusion;
5. a check for scientific sense, limitation, uncertainty, or model fit; and
6. the completed representation or explanation.

The object MAY be a narrated demonstration, annotated diagram, partially
completed table, graph think-aloud, model comparison, sample CER, or worked
design decision. It must not be merely a final answer. Guided work MUST refer to
the object and then fade support before independent evidence is requested.

### 4.5 Visual and model guidance

When spatial, temporal, systems, scale, particulate, field, cycle, or data
relationships matter, the lesson SHOULD provide a fit-for-purpose
representation. The learner is told:

- what each symbol, arrow, boundary, axis, color, scale, or layer means;
- which features correspond to observable evidence and which are model
  assumptions;
- what the representation omits or simplifies; and
- how to read, use, compare, or revise it.

Images, diagrams, graphs, and animations require accessible text or tactile/
verbal alternatives that preserve the scientific target. Decorative visuals do
not satisfy this requirement.

### 4.6 Observation-to-explanation bridge

Lessons built around a phenomenon or investigation MUST keep these moves
visible:

`notice/measure -> record -> identify pattern -> use scientific idea -> explain`

The learner MUST be able to tell which statements are direct observations,
which are measurements or calculations, and which are interpretations or
explanations. A prompt that jumps from “look” to “explain why” without teaching
or scaffolding the relevant concept is thin.

### 4.7 Misconception handling

Common misconceptions MUST be represented by stable curriculum IDs and
topic-specific descriptions. The lesson or its remediation reference SHOULD:

- elicit the misconception without teaching it as fact;
- contrast it with a worked example, model, observation, or counterexample;
- explain why the incorrect reasoning can seem plausible;
- identify the discriminating evidence; and
- avoid shaming or inferring motivation, diagnosis, or character.

Printing a deliberately false candidate claim next to its answer-bearing
disqualifying relationship may support teaching, but it does not supply clean
mastery or assessment evidence.

## 5. Phenomena, observations, investigations, and labs

### 5.1 Phenomenon or observation route

A `PHENOMENON_OBSERVATION` lesson MUST identify the phenomenon, how the learner
encounters it, what to notice or record, and the scientific question it makes
available. A photograph, video, text description, live demonstration, specimen,
map, dataset, or repeated everyday event can be valid when its provenance and
limitations are clear.

If the phenomenon is described rather than directly observed, label it
`DESCRIBED_OBSERVATION` or `SUPPLIED_RECORD`; do not imply that the learner saw
or measured it. If a source is external, the curriculum reference MUST identify
the source and any required attribution or access fallback.

### 5.2 Investigation and lab completeness

Every empirical `INVESTIGATION` or `LAB_HANDS_ON` route MUST provide:

- a question or purpose that the evidence can address;
- a complete materials list, including quantities or ranges where they matter,
  permitted substitutions, and materials that an adult must supply or handle;
- a setup description or diagram sufficient to reproduce the arrangement;
- hazard-specific safety controls, required supervision, stop conditions, and
  any necessary protective equipment before materials are touched;
- ordered, feasible steps that do not hide a measurement or decision;
- blank or clearly learner-owned space for observations and measurements;
- units, categories, repeat-trial expectations, or precision guidance where
  scientifically appropriate;
- prompts for organizing and analyzing the evidence;
- cleanup, disposal, handwashing, storage, or shutdown instructions when
  applicable; and
- an accessible, equal-credit alternative for unavailable materials, unsafe
  conditions, disability access, or a guardian choice.

Materials, steps, observations, and analysis must describe one coherent route.
A data table must have enough context to know what each row and column records.
The procedure must not require equipment, an external account, a camera,
private disclosure, or an unseen source unless that dependency is explicitly
provided and a complete alternative is available.

### 5.3 Variables and fair comparisons

Where the question involves comparison, the lesson MUST identify or help the
learner identify what is changed, what is measured or observed, and what is
kept comparable at the course-appropriate level. It MUST not teach that all
scientific investigations have exactly one independent and one dependent
variable; descriptive, observational, field, model-based, and multivariable
investigations are named honestly.

Repeated trials, sample size, uncertainty, controls, and confounding variables
are introduced when they are relevant to the claim and appropriate to the
course. They are not added as ceremonial vocabulary.

### 5.4 Observation integrity and tutor prohibition

Every value or observation exposed to a learner or tutor SHOULD carry one of
these origins:

- `LEARNER_OBSERVED`
- `LEARNER_MEASURED`
- `LEARNER_CALCULATED`
- `SUPPLIED_SOURCE_DATA`
- `MODEL_OUTPUT`
- `SIMULATION_OUTPUT`
- `DESCRIBED_DEMONSTRATION`
- `PREDICTION`
- `EXPECTED_RANGE_ADULT_ONLY`

Expected observations and expected ranges are adult correctness authority, not
learner observations. They MUST remain separate until the learner records or
receives the relevant evidence under the declared route.

**Tutor must NEVER invent experiment results for a learner or complete, smooth,
or “typicalize” them.** If no result exists, the curriculum allows the tutor
only to help the learner record what actually happened, identify a procedural
issue safely, use a clearly labeled supplied-data alternative, or state that
the evidence is unavailable. The tutor may not imply that a predicted or
expected result was observed.

### 5.5 Safety and adult authority

Safety presentation is layered:

1. show today's hazards, controls, supervision, stop conditions, and cleanup in
   the immediate learner route;
2. resolve universal emergency or prohibition policy through the declared
   `safetyPolicyRef`; and
3. preserve an accessible no-penalty alternative.

Desk lessons SHOULD not bury the teaching object under lab policy unrelated to
the day's activity. Physical routes MUST declare one of `NONE`,
`ADULT_APPROVAL`, `ADULT_PRESENT`, `DIRECT_ADULT_SUPERVISION`, or
`QUALIFIED_INSTRUCTOR`. The declared level must match the materials and steps.
Where approval or supervision is required, the lesson MUST say what the adult
reviews or controls; “ask an adult” alone is not an authority contract.

## 6. Scientific reasoning standard

Scientific reasoning is taught, modeled, practiced, and then elicited with
fresh evidence. Merely appending “cite evidence,” “state a limitation,” and
“name provenance” to every lesson does not create varied reasoning.

### 6.1 Required reasoning moves when relevant

| Reasoning move | Minimum instructional support |
| --- | --- |
| Read a table | Identify title/question, row and column meaning, units or categories, then locate and compare relevant cells. |
| Read a graph | Identify variables and axes, units, scale and interval, describe the pattern, cite data features, and avoid claiming beyond the displayed domain. |
| Compare evidence | Decide relevance, directness, consistency, source/measurement quality, and whether evidence supports, challenges, or cannot decide a claim. |
| Identify variables | Name what changes or differs, what is observed/measured, and what must be comparable; treat nonexperimental studies accurately. |
| Reason about cause and effect | State the proposed mechanism or causal chain and examine temporal order, comparison/control, alternatives, and evidence limits. Correlation alone is not labeled cause. |
| Interpret results | Describe the result before explaining it, connect it to the question, acknowledge variation or uncertainty, and state the warranted conclusion. |
| Build or use a model | Define the system and purpose, map components and relationships, compare predictions with evidence, name limitations, and revise a feature for a reason. |
| Construct a CER | Make a claim responsive to the question, select relevant evidence, and explain with scientific principles how that evidence bears on the claim. |

### 6.2 Grade-aware progression

These are progressions, not ceilings. The scientific content and standards for
the course remain authoritative.

| Band | Typical support and expectation |
| --- | --- |
| Grades 3–5 | Use concrete phenomena and clearly labeled representations. Model the difference between noticing and explaining. Read simple tables, picture graphs, bar graphs, ordered observations, and repeated measures. Identify what is changed/noticed in a fair comparison with support. Build short evidence-linked explanations and revise models by adding, removing, or relabeling a meaningful feature. |
| Grades 6–8 | Read varied scales and multiseries displays, compare datasets, notice outliers and variation, identify variables and controls where applicable, distinguish correlation from a supported causal account, evaluate evidence relevance and limitations, construct CERs, and revise models when evidence conflicts. |
| Grades 9–12 | Select and transform representations, reason with domain-appropriate quantitative relationships, uncertainty, sample and measurement limits, competing explanations, controls/confounders, and model assumptions. Evaluate whether evidence warrants causal or mechanistic claims and revise models or designs using explicit criteria. |

### 6.3 Data-analysis payload

A `DATA_ANALYSIS` lesson MUST provide an authentic learner-generated or supplied
data object, not only prose statements arranged in a table. It MUST identify
provenance and units/categories, teach any unfamiliar representation, and ask
questions whose answers require reading or transforming the data. When a graph
is required, the lesson provides graphing conventions, an accessible
alternative, and guidance matched to the learner's prior experience.

Prompts SHOULD vary across locating, comparing, calculating, pattern finding,
prediction, anomaly/error analysis, interpretation, and evidence-based
explanation as the data and grade warrant. Not every lesson needs every move.

### 6.4 Model building and revision

A scientific model is a purposeful representation, not a decorated answer.
Model tasks MUST state the system or process, purpose, evidence base, expected
relationships, and success criteria. Learners SHOULD compare the model with a
phenomenon or dataset, identify what it cannot show, and revise a feature in
response to evidence or a new constraint. A second representation counts as
revision only when the learner explains what changed and why.

### 6.5 Claim-evidence-reasoning

CER instruction MUST explicitly separate:

- **claim:** the answer or position responsive to the question;
- **evidence:** selected observations, measurements, data, or credible source
  information; and
- **reasoning:** the scientific principle or mechanism explaining why that
  evidence bears on the claim.

Rubrics must not reward the presence of labels alone. They assess scientific
accuracy, evidence relevance and sufficiency, the reasoning link, treatment of
limits or alternatives when appropriate, and revision. Valid claims may differ
when evidence is incomplete; the authority must identify the warranted range.

## 7. Practice, review, and mastery

### 7.1 Varied practice evidence

A lesson or short sequence SHOULD use evidence forms selected for the target,
including:

- concept retrieval;
- application to a new situation;
- diagram or model construction, use, comparison, or revision;
- table or graph interpretation;
- prediction with a scientific reason;
- explanation of a mechanism, pattern, or result;
- claim-evidence-reasoning;
- investigation or design decisions; and
- error analysis and correction.

Variation means a change in scientific thinking, representation, context, or
evidence demand. Repeating the same four generic evidence-quality questions or
changing nouns in one template is not varied practice. Recall is valid when
retrieval is the intended evidence; it cannot be the only evidence for an
application, analysis, investigation, model, or explanation target.

### 7.2 Guided-to-independent release

Guided practice MAY expose definitions, examples, partial models, question
prompts, evidence labels, and feedback. The lesson MUST identify which supports
will be reduced or removed. Independent practice removes the worked solution
but retains accessibility supports that do not supply the science answer.

Allowed accessibility modes—typed, handwritten, spoken, drawn, tactile, or
demonstrated—do not reduce the scientific target or scoring ceiling.

### 7.3 Fresh mastery evidence

`MASTERY` requires a new phenomenon, case, dataset, observation record, model,
or application that preserves the target but does not preserve the answer.
Freshness fails when:

- the accepted relationship is printed beside the task;
- the evidence table repeats the teaching brief verbatim;
- the false claim is mechanically derived from a visible disqualifying rule;
- only names, numbers, colors, or surface wording change; or
- the learner can succeed by copying the worked model's structure without
  applying the scientific idea.

The curriculum contract MUST declare the target concept IDs, the evidence form
to be elicited, the fresh-input reference, success criteria, answer policy, and
adult correctness authority. Mastery SHOULD be supported by accurate
independent evidence in more than one context or occasion, but this R1 contract
does not store learner attempts or implement runtime mastery state.

### 7.4 Review is not mastery

Review may reopen notes, examples, vocabulary, and prior models. It SHOULD make
connections, compare cases, retrieve ideas, and reveal what needs more teaching.
Supported review work is not labeled independent mastery evidence.

## 8. Remediation standard

Every lesson MUST resolve a remediation route appropriate to its concept and
reasoning demand. Each route MUST identify a stable prerequisite concept ID or
misconception ID rather than only a generic signal such as “prerequisite gap.”

Remediation follows this order:

1. identify the observable error or missing prerequisite without diagnosing the
   learner;
2. select a **different** explanation, representation, example, phenomenon, or
   model that directly addresses it;
3. work or discuss one contrast that makes the scientific distinction visible;
4. ask for fresh, small evidence aligned to the same target; and
5. return to independent application only after that evidence is accurate.

The same question with more encouragement, the same evidence rows in a new
order, or another copy of the original template is not remediation. Correct but
low-confidence work receives confirmation and a varied example, not unnecessary
reteaching. Safety-related errors receive the required adult intervention and
do not become ordinary retry prompts.

## 9. Grade-aware language and document surface

The language policy protects both access and scientific meaning.

### Grades 3–5

- Use short action chunks, concrete referents, explicit pronouns, and one clear
  route through the page.
- Define each new scientific term at first meaningful use and reinforce it with
  a phenomenon, example, gesture, image, or model.
- Put today's scientific task before recurring policy detail; reveal longer
  references when needed.
- Use sentence frames as optional support, not as answer-bearing fill-ins.

### Grades 6–8

- Use increasingly compact disciplinary sentences while unpacking new causal,
  systems, scale, and data relationships.
- Teach how diagrams, graphs, tables, and source evidence carry meaning.
- Explain ambiguous everyday/scientific terms and introduce qualifiers such as
  `may`, `under these conditions`, and `the evidence suggests`.

### Grades 9–12

- Preserve precise disciplinary vocabulary, symbolic relationships, units,
  qualifications, and uncertainty.
- Define unfamiliar terms and notation; do not assume dense prose is rigorous.
- Break complex procedures and arguments into inspectable stages while keeping
  the full scientific meaning and course demand.

Across bands, readability metrics MAY flag a surface for review but MUST NOT be
used to delete necessary scientific vocabulary, turn causal explanations into
vague statements, or hide safety distinctions. Relative document volume is a
usability signal, not a Science depth quota.

## 10. Engineering design and projects

`ENGINEERING_DESIGN` is permitted only when the canonical standard, unit goal,
or project genuinely asks learners to solve a problem through design. The
lesson MUST include:

- a defined need, user, or context;
- testable criteria and relevant constraints;
- more than one possible solution or design decision;
- a model, plan, prototype, process, or system;
- a test or evidence source tied to criteria;
- analysis of performance and trade-offs; and
- an evidence-based improvement or justified next iteration.

Words such as `design`, `criteria`, `constraints`, `optimize`, `solution`, or
`trade-off` do not make a generic claim-evidence worksheet an engineering task.
Conversely, a valid age-appropriate design may use paper models, drawings,
simulations, or reasoned plans when physical construction is unsafe or
unnecessary.

A `PROJECT` MUST identify its scientific purpose, inputs, milestones, final
evidence/product, individual evidence of understanding, rubric, source and
safety requirements, and accessible route. A build day may reuse an ongoing
project context but MUST advance the product or reasoning rather than replay an
identical investigation payload.

## 11. Assessment and answer authority

An `ASSESSMENT` lesson MUST be self-contained or have a tested, unambiguous
reference to every required learner input. It MUST declare:

- assessed concept IDs and evidence forms;
- fresh phenomenon, case, dataset, model, or design brief;
- permitted and prohibited supports;
- an `ASSESSMENT_PROTECTED` answer policy;
- adult-only scientific correctness and scoring authority;
- the authority that decides completion or mastery; and
- an accessible response route with the same construct and scoring ceiling.

Learner materials MUST NOT reveal accepted relationships, worked solutions,
answer-bearing evidence labels, deliberately false claims mechanically paired
with their correction, or adult reasoning criteria that disclose the answer.
Adult authority must remain physically or access-control separated from the
learner surface. A lesson/package `READY` label does not substitute for a
completion authority.

## 12. Curriculum-side tutor-readiness metadata

R1 defines metadata that curriculum authors and validators may emit. It does
not define Tutor V2 behavior, prompt orchestration, learner-state storage,
scoring execution, attempt history, or Study Engine routing.

Every lesson contract MUST provide these fields:

| Field | Curriculum meaning |
| --- | --- |
| `conceptIds` | Stable IDs for the scientific ideas or practices taught or evidenced. |
| `prerequisiteConceptIds` | Stable IDs for knowledge needed to enter the lesson. Empty is allowed only with an applicability note. |
| `misconceptionIds` | Stable IDs that resolve to topic-specific misconception descriptions and remediation references. |
| `phenomenonSourceRefs` | References for phenomena, observation records, source datasets, media, demonstrations, or cases. An empty list requires an applicability note. |
| `representationRefs` | References to diagrams, models, tables, graphs, simulations, samples, or worked teaching objects. |
| `phase` | One of `TEACH`, `GUIDED`, `INDEPENDENT`, `REMEDIATE`, `REVIEW`, `ASSESS`, or `PROJECT`. |
| `allowedSupport` | Curriculum-declared supports that preserve the phase and answer boundary. |
| `answerPolicy` | One of `TEACHING_VISIBLE`, `GUIDED_PARTIAL`, `INDEPENDENT_WITHHOLD`, or `ASSESSMENT_PROTECTED`. |
| `safetyPolicyRef` | Reference to the applicable safety authority, plus lesson-specific hazard/supervision data where relevant. |
| `ageLanguagePolicyRef` | Reference to the applicable grade-band language and accessibility policy. |

`allowedSupport` uses explicit curriculum values such as
`READ_ALOUD`, `TERM_DEFINITION`, `VOCABULARY_GLOSSARY`,
`REPRESENTATION_DESCRIPTION`, `PARTIALLY_WORKED_MODEL`, `PROCEDURE_CHUNKING`,
`QUESTION_REPHRASE`, `EVIDENCE_LOCATION_PROMPT`, `SELF_CHECK_CRITERIA`, and
`ALTERNATE_RESPONSE_MODE`. A lesson must not declare a worked model or evidence
location prompt during protected mastery if it supplies the target answer.

References MUST resolve deterministically inside the curriculum/release
boundary or name a complete fallback. IDs are metadata, not proof of substance:
a validator and Director still inspect the referenced teaching object,
scientific correctness, freshness, safety, and age-language fit.

The companion schema encodes this minimum advisory envelope. It intentionally
contains no learner profile, score, diagnosis, attempt history, next-session
decision, tutor prompt, or runtime route.

## 13. Advisory quality checks

An advisory runner SHOULD emit a stable check ID, lesson ID, evidence location,
short reason, and disposition of `PASS`, `ADVISORY_FINDING`, or
`DIRECTOR_REVIEW`. Checks may use deterministic structure/text analysis to
surface candidates, but scientific and instructional depth requires Director
review. No R1 advisory finding changes production state.

| Check ID | Finding | Advisory trigger |
| --- | --- | --- |
| `SCI-DEPTH-001` | Thin explanation | Explanation is absent, only restates accepted facts, lacks the relevant mechanism/relationship, or never connects to the lesson phenomenon/case/model. |
| `SCI-DEPTH-002` | Missing worked model/example | A teaching or guided type requires scientific reasoning but resolves no worked teaching object showing intermediate reasoning and a check. |
| `SCI-DEPTH-003` | Missing visual/model guidance | A representation is required or supplied but symbols, axes, scale, relationships, assumptions, limitations, or accessible description are not taught. |
| `SCI-DEPTH-004` | Missing investigation details | An investigation/lab lacks a coherent question, materials, setup, steps, recording structure, collection guidance, analysis, cleanup where applicable, or complete unavailable-materials route. |
| `SCI-DEPTH-005` | Missing or mismatched safety | Hazards, controls, stop conditions, PPE, cleanup, supervision, or adult responsibility are absent or inconsistent with the physical route. |
| `SCI-DEPTH-006` | Missing data-analysis support | A data task lacks an authentic data object, labels/units/provenance, representation guidance, or prompts that require interpreting the data. |
| `SCI-DEPTH-007` | Thin practice | Practice consists only of recall, paraphrase, or repeated generic question roles despite an application, modeling, analysis, explanation, investigation, or design target. |
| `SCI-DEPTH-008` | Missing remediation | No stable prerequisite/misconception route exists, or the route merely repeats the original explanation, evidence, or question form. |
| `SCI-DEPTH-009` | Template repetition | Exact or near-duplicate briefs, cases, datasets, procedures, question sequences, or phase payloads recur where a new teaching or evidence purpose is claimed. Shared safety and accessibility policy references alone do not trigger this finding. |
| `SCI-DEPTH-010` | Engineering-language leakage | Engineering vocabulary appears without a canonical design objective or without a need, criteria/constraints, alternatives, test evidence, trade-off analysis, and improvement. |
| `SCI-DEPTH-011` | Answer leakage | Independent/mastery/assessment surfaces expose accepted relationships, worked solution structure, mechanically revealing false-claim corrections, answer-bearing metadata, or adult criteria. |
| `SCI-DEPTH-012` | Missing adult authority | A safety-critical physical route lacks the responsible adult level/action, or assessment lacks separated correctness/scoring/completion authority. |
| `SCI-DEPTH-013` | Observation fabrication risk | Expected, predicted, supplied, model, simulation, and learner-observed results are unlabeled or combined; recording fields are prefilled as if observed. |
| `SCI-DEPTH-014` | Vocabulary gap | New or specialized terms lack learner-facing definitions or a familiar word's scientific meaning is left ambiguous. |
| `SCI-DEPTH-015` | Missing observation-explanation bridge | A phenomenon/investigation jumps from noticing to explanation without recording, pattern finding, or concept support. |
| `SCI-DEPTH-016` | Age-language mismatch | Document organization, policy load, sentence structure, assumed background, or representation guidance obstructs the declared band, independent of raw readability score. |
| `SCI-DEPTH-017` | Tutor metadata incomplete | Any required curriculum-side field is missing, unresolved, internally inconsistent, or violates the phase's support/answer boundary. |
| `SCI-DEPTH-018` | Mastery evidence not fresh | The purported mastery input duplicates teaching/practice content or can be answered from material visible on the learner surface. |

### 13.1 Advisory implementation rules

- Do not enforce a universal number of paragraphs, examples, questions,
  vocabulary terms, graphs, labs, or CERs.
- Use structure checks to find missing objects and semantic/corpus comparisons
  to find duplication or leakage; report the evidence rather than assigning
  quality from a word count alone.
- Compare within concept, phase, unit, generator family, and corpus so legitimate
  shared policy text is not confused with repeated instructional payload.
- Keep answer leakage checks access-aware: adult-only correctness authority is a
  strength; answer-bearing content on a protected learner surface is a finding.
- Keep investigation checks route-aware: a documentary inquiry is valid when
  labeled and complete, but it does not satisfy a canonical empirical objective
  merely by being called an investigation.
- Never auto-rewrite scientific, safety, assessment, or adult-authority content
  in response to a finding.

## 14. Depth acceptance evidence

A future lesson can be recommended for `DEPTH_ACCEPTABLE` only when a Director
can inspect evidence that:

1. its declared type matches what the learner actually does;
2. teaching is conceptually clear and includes the needed worked or modeled
   support;
3. new vocabulary is defined without loss of scientific meaning;
4. the phenomenon, data, model, investigation, or design route is complete and
   scientifically honest;
5. practice elicits varied evidence appropriate to the target;
6. independent/mastery evidence is fresh and answer-protected;
7. remediation changes the explanation or representation before a fresh check;
8. safety and adult authority match the actual activity;
9. curriculum-side tutor metadata resolves and respects support/answer policy;
   and
10. all advisory findings are resolved, explicitly accepted with evidence, or
    documented as not applicable.

Corpus acceptance additionally requires evidence that generator families do
not reproduce a thin or answer-cued payload at scale. Passing the existing
structural production gate remains necessary integrity evidence, but it does
not establish instructional depth.

## 15. Representative Director sample

Use **`ma-g3-science-u01-l02` — “Concept model A: testable questions”** for the
later Director sample.

The completed audit already identifies this lesson as the highest-leverage
representative. It sits in the youngest admitted band and exposes the shared
failure clearly: the objective promises an explicit worked example or model,
but neither is present; the three-row science brief is repeated verbatim as the
evidence table; the model prompt asks the learner to include every accepted
relationship before any modeled reasoning is shown; and the 2,851-word learner
sheet includes about 1,008 words of safety content despite being a desk-based
reference-evidence task.

A repaired sample should demonstrate all of the following without weakening
correctness, safety, accessibility, or authority separation:

- a Grade 3 phenomenon or concrete contrasted case for testable questions;
- a concise explanation of what makes a question testable;
- defined vocabulary and a worked think-aloud/model;
- a guided example followed by a genuinely fresh independent question;
- a visual or sorting representation with explicit guidance;
- a misconception-specific alternate explanation and fresh retry;
- a layered, activity-matched safety surface; and
- the curriculum-side metadata in section 12.

The sample is for Director review, not permission to repair this lesson on the
standard branch.

## 16. R1 adoption path

Before this draft can become an enforced standard:

1. review the companion metadata schema with curriculum, Science, safety,
   accessibility, assessment, and tutor-contract owners;
2. repair and Director-review the representative sample;
3. test advisory checks against the sample and a scientifically different lab/
   data lesson to measure false positives;
4. define which findings, if any, become blocking and which remain review-only;
5. document migration and versioning without changing learner artifacts on this
   branch; and
6. rerun structural, safety, checksum, release, and depth evidence before any
   acceptance claim.

Until those steps occur, the correct status of this document is **DRAFT**, and
the correct corpus disposition remains **NOT READY FOR DEPTH ACCEPTANCE**.
