# Manuel Academy Technology / Computing Lesson Standard R1

Status: **DRAFT — ADVISORY, NOT YET AN ENFORCED PRODUCTION GATE**

Evidence base:

- the completed Technology instructional-depth audit summarized for this R1
  session; and
- `docs/curriculum-quality/technology/solution-exposure-review-r1/`.

Audit disposition: **NOT READY FOR DEPTH ACCEPTANCE**

Companion contract: `TECHNOLOGY_LESSON_ADVISORY_CONTRACT_R1.schema.json`

## 1. Purpose and boundary

This standard defines what a learner-ready Manuel Academy Technology /
Computing lesson must teach, ask the learner to do, and declare as
curriculum-side metadata. It covers computing concepts, programming, digital
tools, data and representation, systems, design, accessibility, cybersecurity,
digital citizenship, analysis, projects, review, remediation, mastery, and
assessment.

R1 is a draft specification for Director review and a later curriculum-repair
effort. It does not accept the current corpus. The audit found instructional-
depth gaps in all 336 lessons: under its heuristic, no lesson contained an
explicit concept explanation or a completed worked demonstration. The corpus
contains 87 code tasks and 249 paper-first analysis/design activities, but only
10 normalized central activity templates serve it. The independent solution-
exposure review additionally confirmed 68 pre-evidence answer-authority
violations. Those violations are being repaired in a separate correction
session.

This document and its companion schema:

- do not rewrite any of the 336 lessons;
- do not repair or regenerate exposed solutions;
- do not change assessments, scoring guides, release bindings, or admitted
  packages;
- do not change Study Engine, Tutor V2, Dashboard, or any runtime behavior;
- preserve the existing safety, privacy, accessibility, authorship, and
  restricted-adult-authority boundaries; and
- define advisory curriculum findings only. A future session must review
  repaired artifacts before any check can become an enforced gate.

## 2. Normative language and Technology stance

`MUST` identifies a condition for recommending a lesson for depth acceptance.
`SHOULD` identifies the normal expectation and may be waived only for a
documented instructional, accessibility, safety, or applicability reason.
`MAY` identifies a valid option. Because R1 is advisory, a failed `MUST`
produces a finding; it does not alter a production or release state.

Six principles govern interpretation:

1. **Teach enough to act.** A learner receives the explanation, model,
   demonstration, tool sequence, or annotated example needed to begin the
   requested work without guessing the underlying method.
2. **Protect evidence.** Worked teaching material is visible when teaching;
   the exact protected-task solution is withheld until the declared evidence
   boundary permits review.
3. **Make computing observable.** Learners predict, trace, run, inspect,
   compare, test, debug, design, or create. Merely naming a computing idea is
   not computing instruction.
4. **Debug by reasoning.** Debugging proceeds from symptom and evidence to a
   tested hypothesis, not from a supplied passing change to copying.
5. **Choose the right medium.** Code is required when code execution or
   construction is the target. Paper, diagrams, tables, models, prototypes,
   and local tools are legitimate when they preserve the intended computing
   work.
6. **Safety outranks realism.** Cybersecurity and digital-safety instruction
   stays fictional, local, sandboxed, permissioned, and privacy-preserving. A
   realistic task never requires a live target, real credential, private
   disclosure, or bypass of access controls.

## 3. Repository-grounded taxonomy

The repository already carries three useful, separate axes. R1 preserves them
and adds a fourth axis for the lesson's primary instructional purpose. A lesson
MUST not use one label as a substitute for the others.

### 3.1 Existing axes to preserve

| Axis | Current values or families | R1 interpretation |
| --- | --- | --- |
| `activity_kind` | `CODE_OR_DEBUG`, `ANALYSIS_OR_DESIGN` | The medium of the central learner activity. It does not prove instructional depth or identify whether code is read, written, or debugged. |
| `task_type` | `programming_and_logic`, `debugging_and_testing`, `interface_and_accessibility`, `data_and_evidence`, `digital_citizenship_and_safety`, `systems_and_hardware`, `design_and_prototyping`, fallback `applied_project` | The content/work family. R1 retains these repository names where present. A keyword classification is a candidate, not proof that the payload teaches that family. |
| `phase` / `work_mode` | `Launch and diagnostic`/`PROBE`; model modes; guided modes; independent/application/build modes; investigation; reteach; performance build; mastery; synthesis; assessment; correction | The position and support posture in the instructional arc. Phase names do not prove that the corresponding teaching, independence, freshness, or authority boundary exists. |
| `scoring_stance` | `FORMATIVE_NO_PENALTY`, `PROGRESS_EVIDENCE`, `SUMMATIVE` | The declared evidence consequence. It constrains answer policy but does not itself establish valid evidence. |

The current corpus distribution is evidence for review, not a target quota: 87
packages declare `CODE_OR_DEBUG` and 249 declare `ANALYSIS_OR_DESIGN`. R1 does
not require every Technology lesson to execute code or require these counts to
remain fixed.

### 3.2 Canonical R1 lesson-purpose types

Every advisory contract MUST declare exactly one `primaryLessonType` and MAY
declare additional `instructionalModes`. The primary type names the main
instructional/evidentiary purpose; modes name substantial work inside it. A
debugging mastery lesson can therefore be primarily `MASTERY` with `DEBUGGING`
and `CODE_READING` modes.

| Type | Required distinguishing purpose |
| --- | --- |
| `COMPUTING_CONCEPT` | Explicitly teach how a computing idea, system, abstraction, rule, or trade-off works, using an explanation and a concrete representation or completed demonstration. |
| `CODE_READING` | Teach learners to trace, annotate, predict, explain, or compare supplied code, including relevant control flow and state. It does not silently become code writing. |
| `CODE_WRITING` | Teach and then require learners to construct or extend code that meets a specification and is checked with meaningful cases. |
| `DEBUGGING` | Teach and use an evidence-based observe-hypothesize-inspect-test-interpret-iterate cycle. Copying a disclosed fix does not qualify. |
| `ALGORITHM_LOGIC` | Develop, represent, trace, compare, justify, or create algorithms and logical processes, including correctness, boundary cases, and efficiency where appropriate. |
| `DATA_REPRESENTATION` | Encode, organize, transform, query, visualize, interpret, or critique data and representations while naming structure, provenance, limits, and relevant privacy constraints. |
| `CYBER_DIGITAL_SAFETY` | Teach recognition, prevention, response, ethics, privacy, access, attribution, or digital citizenship using defensive, fictional, local, sandboxed, or paper routes. |
| `DESIGN` | Define a user/context and requirements, develop alternatives, represent a solution, test it against criteria, account for accessibility/privacy, and improve or justify it. |
| `PRODUCTIVITY_DIGITAL_TOOL` | Teach a complete, reusable workflow in an approved digital tool or tool-neutral equivalent through a step-by-step demonstration and a fresh learner task. |
| `ANALYSIS` | Examine a supplied artifact, interface, system, case, dataset, policy, or claim and produce evidence-linked findings, comparisons, decisions, or revisions. |
| `PROJECT` | Develop a sustained computing/design product through milestones, reviewable increments, testing, individual evidence, and a defined final deliverable. |
| `REVIEW` | Retrieve, connect, compare, and organize previously taught ideas. Open-note or supported review is not independent mastery evidence. |
| `REMEDIATION` | Respond to a diagnosed prerequisite, error, or misconception with a different explanation or analogous task, followed by fresh evidence. |
| `MASTERY` | Elicit independent, answer-protected evidence on a fresh task aligned to already taught concepts and skills. |
| `ASSESSMENT` | Collect protected evidence against declared concepts/skills under explicit support, answer, scoring, completion, and adult-authority policies. |

These types are not mutually exclusive as modes. For example:

- a `COMPUTING_CONCEPT` lesson may use `CODE_READING` and
  `ALGORITHM_LOGIC` modes;
- a `PROJECT` may use `DESIGN`, `CODE_WRITING`, and `DEBUGGING` modes; and
- an `ASSESSMENT` may assess `DATA_REPRESENTATION` without requiring code.

### 3.3 Mapping current phase/work modes

| Current phase/work mode | Candidate R1 classification, decided from payload |
| --- | --- |
| `Launch and diagnostic` / `PROBE` | Diagnostic component of `COMPUTING_CONCEPT`, `REVIEW`, or another content type. A pre-instruction prediction is not the teaching and is not mastery. |
| `Explicit model` / `MODEL`; `Concept model A/B` / `MODEL_A/B` | Usually `COMPUTING_CONCEPT` plus the relevant content mode. Must include a complete, visibly labeled worked teaching object. |
| `Guided practice` / `GUIDED`; `GUIDED_A/B` | The relevant content type with a guided phase. Must provide actionable supports, learner action, feedback/checking, and an explicit fade. |
| `Independent application A` / `APPLY` | Relevant content type; `MASTERY` only if the task is fresh, independent, and answer-protected. |
| `Application or project` / `BUILD` | `CODE_WRITING`, `DESIGN`, `PROJECT`, or another applicable type only when the learner creates and tests meaningful work. |
| `Investigation or close reading` / `INVESTIGATE` | Usually `CODE_READING`, `ANALYSIS`, `DATA_REPRESENTATION`, or `CYBER_DIGITAL_SAFETY`, based on the actual object and reasoning. |
| `Reteach and varied practice` / `RETEACH` | `REMEDIATION` only when it targets an observed need with different teaching and fresh small evidence. |
| `Performance task build` / `INCREMENT` | `PROJECT` when it advances a defined artifact or reasoning milestone. |
| `Mastery check` / `DEMONSTRATE` | `MASTERY`, subject to fresh-input, independence, and answer-protection requirements. |
| `Synthesis and review` / `SYNTHESIZE` | `REVIEW`, with substantive content modes as applicable. |
| `Unit assessment` / `ASSESS` | `ASSESSMENT`, subject to protected-task and adult-authority requirements. |
| `Correction and reflection` / `CORRECT` | `DEBUGGING`, `REMEDIATION`, or `REVIEW`. If the exact task is still evidence-bearing, its solution remains withheld until evidence is durably committed. |

A generator or reviewer MUST classify the learner experience, not the title.
Changing `phase`, focus nouns, or a task label does not make repeated central
material serve a new purpose.

## 4. Universal instructional-depth contract

Every lesson recommended for depth acceptance MUST provide or deterministically
resolve the objects needed for its declared purpose.

### 4.1 Target, prerequisites, and entry

- State what the learner will understand and what the learner will do to show
  it, using the appropriate computing verb: explain, trace, predict, run,
  classify, model, design, build, test, debug, compare, or justify.
- Name only prerequisites needed for today's work and connect each prerequisite
  ID to an entry check, teaching object, or remediation route.
- Activate prior knowledge with a concrete input, trace, comparison, tool
  action, design decision, or safety scenario—not a generic “what do you
  know?” shell.
- Label diagnostics as no-penalty entry evidence. Do not present an uncorrected
  diagnostic response as taught knowledge.

### 4.2 Explicit concept explanation

When a lesson introduces, reteaches, or depends on a concept not already
secured as a prerequisite, it MUST explain that concept before independent use.
The explanation MUST:

- name the concept and define specialized terms in learner-facing language;
- explain the relevant components, relationships, control/data flow, rules,
  process, or trade-offs—not only state a fact or objective;
- connect the explanation to the day's code, tool, dataset, representation,
  system, case, or design brief;
- show at least one boundary, non-example, failure mode, limitation, or
  competing choice when relevant; and
- give the learner a check for deciding whether the concept has been applied
  correctly.

A title, objective, task brief, vocabulary list, specification, safety policy,
or list of success criteria is not by itself a concept explanation. A learner
must not be asked to discover the entire underlying method from the protected
task that will later be scored.

### 4.3 Worked demonstration

Teaching, model, guided, and remediation phases MUST include or resolve a
completed worked demonstration whenever the learner is expected to use an
unfamiliar concept, code pattern, debugging move, representation, or tool
workflow. A demonstration MUST show:

1. the goal or question;
2. the complete starting input or state;
3. the ordered actions or reasoning, including intermediate states;
4. why each important action follows from the concept, specification, or
   evidence;
5. the completed result;
6. a check against expected behavior, criteria, or limitations; and
7. one prompt that helps the learner transfer the pattern to a different case.

The demonstration MAY be annotated code, a narrated trace, a step-by-step tool
sequence, a completed table/representation, a debugging think-aloud, a design
comparison, or a worked analysis. A final artifact without the intermediate
reasoning is an exemplar, not a worked demonstration. An unfinished setup is
not a completed demonstration.

### 4.4 Guided work

Guided work MUST require the learner to act. It MUST provide:

- a case distinct from the completed demonstration;
- prompts or partial steps tied to the concept rather than answer-shaped
  fill-ins;
- at least one intermediate prediction, trace, edit, classification, test,
  design choice, or explanation from the learner;
- an immediate check or feedback path that shows what to inspect, without
  simply disclosing the target result;
- a stated support-fade point; and
- a subsequent task with materially less support.

Watching a second example, recopying a model, or answering generic reflection
questions does not satisfy guided practice.

### 4.5 Independent creation and transfer

Independent work MUST ask the learner to produce evidence that cannot be
completed by copying visible teaching material. According to the target, this
may be original code, an algorithm, a trace/explanation on fresh code, a tested
tool workflow, a data representation, a defensible analysis, a safety decision,
a prototype, or a project increment.

The task MUST provide a complete input/specification and require appropriate
verification. Accessibility supports MAY change representation, response mode,
copying load, pace, or interface. They MUST not supply the protected concept
application, exact repair, completed design, or final response.

For `CODE_WRITING`, `DESIGN`, and `PROJECT`, independent evidence normally
includes a learner-owned decision or construction plus a test, critique, or
revision. Completing only a pre-shaped worksheet about what one might build is
insufficient unless analysis rather than creation is the declared target.

### 4.6 Age, language, and accessibility

Grades 3–5 receive short, ordered action chunks, concrete examples, explicit
definitions, and visible transitions between demonstration, guided work, and
“your turn.” Grades 6–8 receive increasingly compact disciplinary language but
still see state, control flow, representation conventions, and tool steps
unpacked. Grades 9–12 retain precise technical vocabulary, syntax, invariants,
complexity, data structure, architecture, accessibility, security, and trade-
off language while keeping the work inspectable and resumable.

Readability heuristics MAY prompt review but MUST NOT delete necessary
computing vocabulary or turn a precise safety/authority distinction into vague
language. Typed, spoken, handwritten, block-based, pseudocode, diagram, tactile,
keyboard-only, and paper-trace routes MAY be equal-credit when they preserve
the declared construct. If executable code itself is the target, an alternative
must still evidence code semantics and construction rather than replace the
target with topic recall.

## 5. Code teaching and answer separation

### 5.1 Worked example code

`WORKED_EXAMPLE_CODE` is learner-visible teaching code. It MUST be labeled as
an example and MUST:

- use a different fixture, identifiers, input values, context, and protected
  output/repair from the independent or summative task;
- demonstrate an analogous concept or pattern, not the exact task solution;
- include annotations or a trace explaining relevant state, control flow,
  syntax, data flow, or tests;
- show the completed result and how it is checked; and
- be excluded from evidence scoring on that exact fixture.

It is legitimate for learners to study a fully worked loop, query, state update,
test, accessible form pattern, or algorithm when the subsequent transfer task
requires the same idea in a genuinely new case.

### 5.2 Learner protected task solution

`PROTECTED_TASK_SOLUTION` is any content that would let a learner reproduce the
accepted code, exact repair, decisive condition/operator/index/initialization,
completed algorithm, answer-bearing output, or scored design/analysis without
independent application. It includes semantic answer authority even when the
field name does not contain `answer` or `solution`.

For an independent, mastery, or assessment task:

- starter code, specifications, public tests, input data, execution methods,
  constraints, and non-answer-bearing self-check criteria MAY be visible;
- the exact repair, complete reference implementation, hidden test outputs,
  accepted trace, completed response, and answer-bearing rubric reasoning MUST
  remain in restricted authority;
- hints MUST stop at or below the declared `hintCeiling` and MUST not compose
  into the exact solution;
- an exact review MAY become visible only after the response required by the
  declared evidence policy has been durably committed and the task's review
  policy permits it; and
- assessment solutions remain protected according to assessment policy, even
  after one item response, when later items or retakes could be compromised.

Surface separation is necessary: placing the answer below the task, in a
collapsed panel, in learner metadata, or beside the response control is still
pre-evidence exposure unless access is genuinely gated.

### 5.3 Analogousness and freshness

An example/task pair is acceptably analogous when it shares the target concept
or reasoning move but requires the learner to re-identify and apply it. Freshness
fails when only names, numbers, strings, colors, or prose context change while
the same decisive line, defect, answer structure, expected outputs, or design
layout remains available.

A lesson contract MUST identify example and task references separately and
declare their relationship. Director review considers code structure,
algorithmic decisions, defect family, data shape, test logic, UI flow, and
answer-bearing wording—not just text similarity.

## 6. Coding lesson standards

### 6.1 Code reading

A `CODE_READING` lesson MUST provide runnable or fully traceable code and teach
how to inspect it. Relevant supports include:

- identifying inputs, outputs, state, and named responsibilities;
- tracing expressions, branches, loops, calls, events, object state, or data
  transformations in execution order;
- distinguishing what the code actually does from what its name or comment
  claims;
- predicting before running and comparing actual with expected;
- annotating a meaningful line/block rather than paraphrasing every token; and
- explaining a boundary case, side effect, limitation, accessibility behavior,
  or complexity implication when appropriate.

The independent case MUST be fresh. Asking learners only to copy an output
already printed in the teaching object is not code reading evidence.

### 6.2 Code writing

A `CODE_WRITING` lesson MUST provide:

- the problem or user need;
- an explicit input/output or behavior specification;
- language/tool references or a complete tool-neutral route;
- taught syntax and patterns sufficient for the requested construction;
- starter code only where it reduces irrelevant setup rather than supplying the
  solution architecture;
- normal, boundary, and failure-oriented checks as appropriate;
- a learner-authored implementation or meaningful extension;
- a record of test results and revision; and
- a short explanation of a significant decision.

Public examples and tests MUST not collapse the task into filling one revealed
token. Hidden/restricted tests MAY provide stronger assessment authority, but a
lesson is not adequate merely because hidden tests exist.

### 6.3 Algorithm and logic

An `ALGORITHM_LOGIC` lesson MUST teach the representation being used—natural
language steps, diagram, flowchart, pseudocode, block code, or text code—and
connect that representation to execution. As appropriate, it MUST address:

- preconditions and expected outputs;
- sequence, selection, iteration, decomposition, recursion, or data-structure
  operations;
- intermediate state and invariants;
- ordinary and boundary cases;
- correctness reasoning;
- termination; and
- efficiency or trade-offs without using complexity vocabulary ceremonially.

Comparison tasks require at least two real approaches and a criterion that can
distinguish them. “Better” must name the relevant dimension: correctness,
runtime growth, memory, clarity, maintainability, accessibility, or another
declared constraint.

## 7. Debugging standard

A strong `DEBUGGING` lesson teaches and records this cycle:

`observe symptom -> form hypothesis -> inspect code/data -> test a change -> interpret result -> iterate`

The lesson MUST make each move actionable:

1. **Observe symptom:** record the actual output, error, failing test, incorrect
   state, inaccessible behavior, or mismatch with the specification.
2. **Form hypothesis:** state a falsifiable idea about the cause before seeing
   the accepted repair.
3. **Inspect code/data:** use a trace, log, breakpoint, print, state table,
   minimal example, data check, or source inspection to locate relevant
   evidence.
4. **Test a change:** change one justified variable where feasible and predict
   what the change should affect.
5. **Interpret result:** compare expected and actual results, including whether
   the hypothesis was supported, rejected, or only partly tested.
6. **Iterate:** revise the hypothesis or change, rerun relevant tests, and record
   the final verification and any remaining limitation.

Worked debugging may reveal the complete repair for an analogous non-evidence
fixture while narrating the cycle. Guided debugging may offer a symptom, region,
variable, concept, or tool cue within the hint ceiling. Independent debugging
MUST withhold the exact protected repair until evidence policy allows review.

The following do not satisfy debugging instruction:

- “Here is the passing change. Copy it.”
- presenting the exact operator, field, index, initialization, condition, or
  completed output before the learner's committed attempt;
- changing code without a recorded hypothesis or interpretation;
- declaring success after only the originally failing case passes; or
- treating syntax correction, fault localization, root-cause reasoning, and
  verification as interchangeable when the target requires one specifically.

A debugging deliverable SHOULD include a compact defect log with symptom,
hypothesis, evidence inspected, change, result, and next step.

## 8. Data, representation, systems, tools, and analysis

### 8.1 Data and representation

A `DATA_REPRESENTATION` lesson MUST provide a real learner-generated or supplied
data/representation object rather than generic claims placed in cells. It MUST
identify fields, categories, units or encodings, provenance, missing/uncertain
values, and privacy/sensitivity where relevant. It teaches how to read or
transform the representation before independent use.

Learner work may include classification, encoding/decoding, sorting/filtering,
aggregation, query construction, table/graph creation, comparison, anomaly
analysis, or critique of a representation. The task MUST require the declared
data reasoning, not only topic vocabulary.

### 8.2 Systems and hardware

Systems lessons MUST identify the system boundary, components, interfaces,
inputs/outputs, state or data movement, and the level of abstraction under
discussion. A paper model is valid when it permits meaningful tracing,
troubleshooting, comparison, or design. A labeled-parts worksheet alone is
insufficient if the target is interaction or system behavior.

### 8.3 Productivity and digital tools

A `PRODUCTIVITY_DIGITAL_TOOL` lesson MUST teach a useful workflow, not merely
name menu commands. It provides:

- the goal and starting file/state;
- ordered steps with interface labels or a tool-neutral equivalent;
- a demonstration that includes at least one decision, check, save/export, or
  recovery action;
- accessibility-relevant keyboard or alternative interaction when applicable;
- a fresh task requiring the learner to reproduce and adapt the workflow; and
- a local, paper, or approved-equivalent route when a branded account or paid
  service is not required by the target.

Directions MUST not assume an unprovided account, undisclosed version, paid
feature, or interface location. Language/tool references identify known
versions or tested compatibility without turning a product brand into the
learning target.

### 8.4 Analysis

An `ANALYSIS` lesson MUST supply the artifact, case, interface, representation,
policy, or dataset to analyze. It teaches the criteria and how evidence bears
on them. The learner then makes evidence-linked observations, comparisons,
decisions, or revisions and identifies a limitation or missing fact when
appropriate.

The same four prompts—cite details, propose a revision, name a pass condition,
name a limitation—do not become meaningful variety merely by receiving a new
topic noun. The central input and reasoning demand must be specific to the
lesson's concept.

## 9. Paper-first, design, and project lessons

### 9.1 Legitimate paper-first work

Paper/design activity is legitimate when code execution is not the construct
or when an equal-credit offline representation preserves it. A conforming
paper-first task asks the learner to do meaningful computing work such as:

- trace an algorithm or system state;
- model data movement, network routing, or a user flow;
- encode, organize, transform, or interpret data;
- compare algorithms, interfaces, sources, policies, or tool workflows using
  taught criteria;
- design an accessible interface, data structure, procedure, or system;
- create pseudocode, a state diagram, test plan, threat model, wireframe, or
  decision record;
- diagnose a defect from supplied evidence; or
- justify and revise a concrete decision.

A generic worksheet shell with interchangeable topic labels, no taught
criteria, no specific central input, and no meaningful artifact or reasoning
does not conform. R1 does not force such a lesson to run code; it requires the
paper route to carry the intellectual work promised by the objective.

### 9.2 Design

A `DESIGN` lesson MUST identify:

- a user, need, purpose, or system context;
- testable requirements and relevant constraints;
- accessibility, safety, privacy, and data-minimization implications where
  applicable;
- at least two plausible approaches or meaningful design decisions;
- a sketch, model, prototype, plan, flow, or architecture;
- a check/test tied to requirements;
- a trade-off or limitation; and
- an evidence-based revision or justified next iteration.

Engineering/design terms such as `solution`, `criteria`, `constraint`,
`prototype`, `optimize`, and `trade-off` MUST refer to genuine design work.
They MUST not be confused with an answer-key “solution” or appended to a
generic analysis shell to make it appear like engineering.

### 9.3 Project

A `PROJECT` MUST identify the computing purpose, inputs, milestones, reviewable
increments, final artifact/evidence, individual understanding, test/critique
plan, source/license expectations, safety/privacy constraints, rubric, and
accessible route. Each build day advances a distinct part of the artifact or
reasoning and records current state, change, verification, and next step.

A one-session worksheet, a list of hypothetical features, or the same central
case repeated across milestones is not a project merely because it carries a
project label.

## 10. Cybersecurity, digital citizenship, privacy, and adult authority

The existing corpus's strong safety/privacy boundaries MUST be preserved. In
particular, lessons MUST continue to prohibit real passwords, passphrases, API
keys, access tokens, account credentials, precise locations, private messages,
and identifiable personal data. They MUST not ask learners to scan, probe,
stress, exploit, access, or bypass controls on a live school, family,
production, or third-party system.

`CYBER_DIGITAL_SAFETY` work MUST use one or more of:

- fictional scenarios and invented identities/data;
- local or isolated sandbox fixtures;
- paper threat models, classification, or incident-response exercises;
- defensive code on supplied local examples;
- approved simulations with defined scope and stop conditions; or
- analysis of supplied, rights-cleared artifacts that requires no learner
  contact with a target.

Safety instruction distinguishes recognition, prevention, response, recovery,
ethics, privacy, and authorization. It does not teach operational misuse under
the label of awareness. Security code examples minimize capability, omit live
targets and deployable secrets, and foreground permission and defense.

When a child may face coercion, suspected compromise, unsafe contact, privacy
risk, or a decision requiring authority, the lesson MUST name the adult role
and action: for example, stop, disclose no information, preserve a safe
description, and contact a parent/guardian or designated school adult. “Be
careful” is not an adult-authority contract.

Assessment/scoring also requires adult authority. The contract MUST resolve a
restricted correctness/scoring authority and identify who decides completion
or mastery. Learner-facing rubrics may state criteria but MUST not disclose the
protected answer.

## 11. Practice, mastery, and assessment

### 11.1 Varied practice

A lesson or sequence SHOULD vary computing thinking through appropriate
combinations of retrieval, prediction, trace, code reading, code construction,
test design, debugging, data transformation, tool use, comparison, design,
analysis, explanation, and revision. Variety means a material change in the
reasoning, representation, context, or evidence demand. Swapping nouns in one
central activity template is not varied practice.

### 11.2 Fresh mastery

`MASTERY` MUST use a fresh task that preserves the target concept/skill but not
the answer. Freshness fails when:

- the exact repair or completed solution is visible;
- worked example and task share the decisive code/algorithm/design structure;
- expected outputs plus a named change mechanically reveal the repair;
- only identifiers, values, colors, labels, or story context change;
- the learner can copy the model's sequence without making the target decision;
  or
- a prior correction/review surface remains available and reveals the task.

The contract declares concept IDs, skill IDs, the protected task reference,
evidence role, freshness relationship, allowed support, hint ceiling, answer
policy, and restricted authority. R1 does not implement learner state or decide
runtime mastery.

### 11.3 Assessment

`ASSESSMENT` MUST be self-contained or resolve every learner input. It MUST
declare assessed concept/skill IDs, fresh task references, permitted supports,
`ASSESSMENT_PROTECTED` answer policy, restricted correctness/scoring authority,
completion/mastery authority, and an accessible route preserving the construct
and ceiling.

Summative learner surfaces MUST never expose the exact solution before required
evidence is durably committed. A clean canonical assessment projection does not
make an admitted source/mastery lesson safe if the learner can open that lesson
and see the solution. Protection review therefore follows all reachable learner
surfaces and references, not only the final assessment JSON shape.

## 12. Remediation standard

Every lesson MUST resolve remediation routes for the topic-specific errors or
misconceptions it anticipates. Each route follows this order:

1. identify the observable error, misconception, or smallest missing
   prerequisite without diagnosing character, effort, or ability;
2. use a **different** explanation, representation, worked analogous example,
   tool demonstration, or debugging lens;
3. contrast the incorrect and correct reasoning on a non-protected case;
4. ask for small, fresh evidence on an analogous task; and
5. return to independent evidence only after the fresh check succeeds.

If the original task is still being used as evidence, remediation MUST NOT
reveal its exact protected solution. The same prompt with encouragement, the
same fixture with the passing change exposed, or the same worksheet reordered
is not remediation. Correct but low-confidence work receives specific
confirmation and a varied example rather than unnecessary reteaching.

A completed protected solution MAY be reviewed only after the relevant
evidence boundary allows it. If future evidence will reuse the original task,
the review instead uses an analogous task or retires the original from evidence
use.

## 13. Curriculum-side tutor-readiness metadata

R1 defines curriculum metadata only. It does not define Tutor V2 prompts,
orchestration, routing, learner models, scoring, attempt storage, hint delivery,
or runtime answer release. It does not change Study Engine or Dashboard.

Every lesson advisory contract MUST provide:

| Field | Curriculum meaning |
| --- | --- |
| `conceptIds` | Stable IDs for ideas taught or evidenced. |
| `skillIds` | Stable IDs for computing practices/actions taught or evidenced. |
| `prerequisiteConceptIds` / `prerequisiteSkillIds` | Stable IDs required to enter the lesson; empty lists require an applicability note. |
| `errorMisconceptionIds` | Stable IDs resolving to topic-specific observable errors/misconceptions and remediation references. |
| `languageToolRefs` | Deterministic references to languages, versions, editors, tools, formats, platforms, or complete tool-neutral alternatives. |
| `exampleRefs` | Teaching example references, each labeled by kind and its relationship to protected tasks. |
| `taskRefs` | Guided/independent/mastery/assessment task references with evidence role and freshness relationship. |
| `phase` | `DIAGNOSTIC`, `TEACH`, `GUIDED`, `INDEPENDENT`, `REMEDIATE`, `REVIEW`, `PROJECT`, or `ASSESS`. |
| `hintCeiling` | Highest curriculum support permitted for this lesson/task. |
| `answerPolicy` | `TEACHING_VISIBLE`, `GUIDED_PARTIAL`, `INDEPENDENT_WITHHOLD`, `POST_EVIDENCE_REVIEW`, or `ASSESSMENT_PROTECTED`. |
| `ageLanguagePolicyRef` | Grade-band language/accessibility authority. |
| `safetyPolicyRef` | Digital/physical safety, privacy, authorization, and sandbox authority. |
| `adultAuthorityRef` | Restricted correctness/scoring/completion or safety escalation authority when required. |

`hintCeiling` is ordered from least to most revealing:

1. `NONE`
2. `TERM_OR_INSTRUCTION_CLARIFICATION`
3. `CONCEPT_CUE`
4. `LOCATION_OR_EVIDENCE_CUE`
5. `PARTIAL_PROCESS`
6. `WORKED_ANALOGUE`
7. `FULL_WORKED_EXAMPLE`

The ceiling applies to the current target, not merely each individual hint.
Multiple hints MUST be considered cumulatively. `FULL_WORKED_EXAMPLE` is
permitted only for an explicitly non-evidence teaching fixture. Independent,
mastery, and assessment tasks cannot allow an exact-target worked solution at
any ceiling.

References MUST resolve deterministically inside the curriculum/release
boundary or provide a complete fallback. IDs and references are routing data,
not proof that the underlying explanation, demonstration, task, safety policy,
freshness, or authority is adequate. The Director still inspects the payload.

The companion schema encodes this advisory envelope. It intentionally contains
no learner ID/profile, score, attempt history, diagnosis, mastery state, tutor
prompt, runtime route, or next-session decision.

## 14. Advisory quality gates

An advisory runner SHOULD emit `checkId`, `lessonId`, evidence locator, concise
reason, and one disposition: `PASS`, `ADVISORY_FINDING`, or `DIRECTOR_REVIEW`.
No R1 result changes production state.

| Check ID | Required finding | Advisory trigger |
| --- | --- | --- |
| `TECH-DEPTH-001` | Missing concept explanation | A lesson introduces/depends on a concept but provides no explicit explanation of the relevant components, relationships, process, rule, or trade-off connected to the day's object. |
| `TECH-DEPTH-002` | Missing demonstration | A teach/guided/remediation phase requires an unfamiliar method, code pattern, debugging move, representation, or tool workflow but resolves no completed demonstration with intermediate reasoning and a check. |
| `TECH-DEPTH-003` | Generic task shell | The central task can accept interchangeable topic nouns; it lacks a concept-specific input, learner action, artifact/reasoning demand, or check. |
| `TECH-DEPTH-004` | Insufficient guided work | Guided work contains no learner action, concept-aligned prompts, feedback/check path, support fade, or less-supported follow-up. |
| `TECH-DEPTH-005` | Insufficient independent creation | A build/design/project/writing target asks only for recall, generic analysis, recopying, or hypothetical description rather than a learner-owned construction/decision plus verification. |
| `TECH-DEPTH-006` | Thin debugging reasoning | Debugging omits any required cycle move—symptom, hypothesis, inspection evidence, predicted/tested change, interpretation, iteration—or reduces the work to applying a disclosed fix. |
| `TECH-DEPTH-007` | Duplicate central templates | Exact or near-duplicate code fixtures, data tables, scenarios, system cards, design briefs, task sequences, defect families, or reasoning prompts recur where distinct teaching/evidence purposes are claimed. Shared safety/accessibility policy references alone do not trigger. |
| `TECH-DEPTH-008` | Pre-evidence exact-solution exposure | Any reachable learner surface or metadata discloses the exact repair, implementation, decisive operation/condition/index/initialization, completed answer, or answer-bearing output before required independent evidence is committed. |
| `TECH-DEPTH-009` | Summative solution exposure | A mastery/assessment task or another learner-reachable admitted source reveals its exact solution or answer-bearing authority before the complete summative boundary permits review. |
| `TECH-DEPTH-010` | Engineering-language confusion | `design`, `engineering`, `solution`, `criteria`, `constraint`, `prototype`, `optimize`, or `trade-off` language appears without the corresponding user/need, alternatives, test evidence, trade-off, and improvement—or answer-key “solution” is confused with a designed solution. |
| `TECH-DEPTH-011` | Answer leakage | Learner content exposes restricted tests, accepted traces, hidden outputs, scoring reasoning, adult keys, target-equivalent worked structure, or cumulative hints that supply a protected response even if no field is named `answer`. |
| `TECH-DEPTH-012` | Missing adult authority | A safety/privacy escalation lacks the responsible adult and action, or protected evidence lacks separated correctness/scoring/completion authority. |

Advisory implementations SHOULD also report curriculum-contract problems such
as incomplete tutor metadata, missing remediation, unresolved tool/language
references, age-language mismatch, missing accessibility route, or a declared
type/phase that does not match the payload. These may receive additional stable
IDs in a later revision; the twelve named gates above are the R1 mission floor.

### 14.1 Advisory implementation rules

- Do not impose universal word, paragraph, code-line, question, screenshot, or
  execution-count quotas. Inspect whether the learner can perform the declared
  work.
- Use structure checks to locate missing objects; use semantic and corpus-level
  comparison to detect template repetition, target-equivalent examples, and
  answer leakage.
- Compare within concept, task type, phase, unit, code/defect family, and the
  whole corpus. Cosmetic identifier/value changes must not defeat comparison.
- Analyze cumulative visible material and all learner-reachable references,
  including admitted source/mastery lessons related to a summative task.
- Treat adult-only correctness/scoring material as a strength when access is
  genuinely restricted. Do not flag it merely for existing.
- Treat public specifications and tests as legitimate unless their combination
  mechanically reveals the protected solution.
- Do not confuse shared safety/accessibility policy with duplicated central
  instruction. Conversely, do not let unique surrounding prose hide a repeated
  central activity.
- Never auto-rewrite code, safety, cybersecurity, assessment, or adult
  authority content in response to a finding.

## 15. Depth acceptance evidence

A future lesson can be recommended for `DEPTH_ACCEPTABLE` only when a Director
can inspect evidence that:

1. its primary type, modes, activity kind, task type, phase, and scoring stance
   match what the learner actually does;
2. the concept explanation is accurate and sufficient to begin the task;
3. the required worked/annotated/tool/debugging demonstration is complete;
4. guided practice makes the learner act and visibly fades support;
5. independent work requires meaningful creation, transfer, analysis, or
   verification rather than template completion;
6. code examples are analogous and separate from protected solutions;
7. debugging teaches the full reasoning cycle;
8. paper-first/design work carries genuine computing analysis, modeling, or
   creation;
9. fresh mastery and assessment are protected across every reachable learner
   surface;
10. remediation changes the explanation/example before fresh evidence;
11. safety, privacy, accessibility, authorship, and adult-authority boundaries
    remain intact; and
12. curriculum-side tutor metadata resolves and respects phase, hint, and
    answer policy.

Corpus acceptance additionally requires evidence that normalized generator
families do not reproduce thin teaching or answer-cued tasks at scale. The
existing structural `READY` gate remains necessary integrity evidence, but it
does not establish instructional depth.

## 16. Proposed future Director sample

Use **`ma-g10-technology-u02-l05` — “Mastery check: algorithms, efficiency,
and correctness”** as the proposed future Director sample.

It is high leverage because it combines a summative `DEMONSTRATE` phase,
`programming_and_logic`, algorithm correctness and invariants, executable and
paper-trace routes, boundary testing, and the independently confirmed
pre-evidence exact-repair exposure. A future repaired sample should let the
Director inspect, in one coherent lesson/sequence:

- a clear explanation of initialization, loop invariant, correctness, and
  relevant efficiency reasoning;
- completed annotated worked code on a genuinely analogous non-target problem;
- guided tracing/testing with support fade;
- an independently solved fresh algorithm case;
- the full debugging cycle without the protected passing change in view;
- explicit example/task references, hint ceiling, and answer policy;
- a fresh remediation analogue; and
- preserved sandbox, privacy, accessibility, authorship, and restricted adult
  authority.

This standard does **not** authorize rewriting that lesson, repairing its
solution exposure, or changing its assessment/runtime surfaces on this branch.

## 17. R1 adoption path

Before this draft can become an enforced standard:

1. review the document and schema with Technology/CS, curriculum, safety,
   accessibility, assessment, and tutor-contract owners;
2. complete the separate solution-exposure correction and retain its evidence;
3. repair and Director-review the proposed sample in an authorized curriculum
   session;
4. test advisory checks against that sample plus materially different
   paper-first safety, data/tool, design/project, and code-writing lessons;
5. measure false positives for template similarity and semantic answer leakage;
6. decide which findings become blocking and which remain Director review;
7. define versioning/migration without changing learner artifacts from this
   standards branch; and
8. rerun structural, safety, checksum, release, solution-authority, and depth
   evidence before any acceptance claim.

Until those steps occur, the correct status is **DRAFT — ADVISORY**, and the
current 336-lesson corpus remains **NOT READY FOR DEPTH ACCEPTANCE**.
