# DRAFT — Manuel Academy Ready for Life Lesson Standard R1

Status: **DRAFT FOR DIRECTOR REVIEW**

Authority: **Manuel Academy local composition**

Applies to: Ready for Life learner lessons, supporting materials, adult-only scoring records, and curriculum-side Tutor metadata

Does not authorize: curriculum rewrites, Tutor V2 implementation, or any Michigan/state standards claim

## 1. Purpose and authority

This standard defines the minimum content contract for a Ready for Life lesson that is teachable, runnable, safe, assessable, and honest about who may certify completion. Ready for Life is Manuel Academy local composition. A local Ready for Life label is not a Michigan academic standard, state code, legal rule, health code, or other external authority.

No author, reviewer, Tutor, or runtime may infer a Michigan/state alignment from the subject name or from an unsupported label. The current corpus label `Michigan Health/SEL connections` is unverified because it has no cited code, source, version, or mapping. A later curriculum repair must either relabel it as a Manuel Academy local cross-curricular connection or submit a separately verified source mapping for provenance review. This standard does not invent that mapping.

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative. A documented exception may satisfy a **SHOULD**. It may not waive a **MUST**.

## 2. Evidence basis and limits

This draft is derived from the completed Ready for Life depth audit at base `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`. The audit covered all 324 active lessons: 36 lessons in each of grades 3, 4, 5, 7, 8, 9, 10, 11, and 12.

The audit established the following baseline:

- all 324 lessons contain an independent or performance task, reflection, remediation, and extension;
- 133 lessons contain real-world action and all 133 declare a simulation alternative;
- 243 lessons use learner completion authority and 81 use guardian completion authority;
- a conservative review queue found 132 lessons with a provided/sample/reference-material signal;
- 54 lessons are labeled as a model phase, but only 13 contain a conservative explicit-model marker, and some of those still refer to an unembedded model;
- all 324 lessons contain lesson-specific reteach language, but only 111 contain a conservative explicit retry/revision marker;
- all 324 admitted runtime rows say `45–60` minutes, while at least 54 lessons name an overnight, next-day, multi-day, full-week, or check-in-period window;
- specific Grade 7 food, appliance, subscription, and account-security lessons require tighter safety, privacy, and authority boundaries; and
- the existing structural reconciliation command passed with `324/324 READY`, including 81 guardian-authority and 243 learner-authority lessons.

The `324/324 READY` result is a structural H3 reconciliation result. It does not establish instructional depth, resource completeness, safe Tutor autonomy, or conformance to this draft standard.

The configured Vitest command could not start in the audit worktree because the `vitest` package was not installed or resolvable. That limitation is recorded here. It was not repaired during the read-only audit and does not negate the content findings.

## 3. Scope and non-goals

This standard governs what a Ready for Life lesson and its attached curriculum records must express. It does not prescribe a user interface or database schema.

This draft does not:

- rewrite any of the 324 lessons;
- change an existing completion-authority decision;
- implement Tutor V2, Tutor runtime policy, model prompts, or application behavior;
- certify that a particular local law, civic process, health recommendation, workplace rule, or consumer term is current;
- turn household preference, family custom, food choice, identity, or life direction into a correct answer; or
- replace full-corpus review with a representative sample.

## 4. Lesson-purpose taxonomy

Every lesson MUST declare exactly one primary purpose and MAY declare up to two secondary purposes. Purpose describes why the lesson exists. It is separate from the lesson phase, task kind, evidence type, and completion authority.

Use the most specific purpose that matches the intended learner outcome. `PRACTICAL_TASK` is not a default label for every Ready for Life lesson, and `EVIDENCE_SIGNOFF` does not by itself grant guardian authority.

| Purpose key | Display label | Use when the central outcome is... | Common corpus examples |
|---|---|---|---|
| `HOME_SKILL` | Home Skill | caring for a living space, clothing, food, tools, or household systems | laundry, surface care, food storage, simple meal preparation |
| `ORGANIZATION` | Organization | creating or maintaining an orderly routine, record, inventory, schedule, or personal system | packing, tracking belongings, document systems, recurring routines |
| `COMMUNICATION` | Communication | preparing, delivering, receiving, or repairing a practical message | asking for help, setting a boundary, workplace communication, interview practice |
| `PERSONAL_RESPONSIBILITY` | Personal Responsibility | following through on an assigned or chosen responsibility and repairing a missed step without character judgment | finishing a household contribution, checking work, recovering from a forgotten task |
| `COMMUNITY_SERVICE` | Community / Service | contributing to a household or community need through a bounded, safe act | family contribution, community navigation, civic participation practice |
| `PRACTICAL_TASK` | Practical Task | accurately carrying out a bounded real-life procedure when performance itself is the main learning outcome | operating a permitted tool, completing a consumer-process simulation, making an appointment script |
| `DECISION_MAKING` | Decision Making | comparing evidence, constraints, risks, costs, or tradeoffs to make and explain a choice | consumer comparisons, pathway choices, response under constraint |
| `PLANNING` | Planning | sequencing actions, resources, deadlines, dependencies, or contingencies before execution | backward planning, transition plans, meal plans, transportation plans |
| `SAFETY` | Safety | recognizing hazards and applying a safe boundary, stop rule, or escalation path | kitchen hazards, unsafe items, privacy boundaries, safe tool use |
| `PROJECT` | Project | integrating several skills into a multi-step outcome, usually across more than one session | unit capstone, independent-living simulation, service project |
| `REVIEW` | Review | retrieving, checking, consolidating, or transferring previously taught learning | mastery check, cumulative reflection, application to a new context |
| `REMEDIATION_RETRY` | Remediation / Retry | correcting a named misconception or process error and demonstrating the correction in a new attempt | correction lesson, revised plan, parallel practice |
| `EVIDENCE_SIGNOFF` | Evidence / Signoff | producing, reconciling, or obtaining the authorized evidence needed to close a task | artifact review, adult observation record, guardian attestation |

### 4.1 Phase is not proof of instruction

The existing six-slot sequences—launch/diagnostic, model, guided practice, application/project, mastery check, and correction/reflection, plus the high-school planning/application/performance variants—remain useful organizational patterns. A phase label does not prove that the phase has been delivered. In particular:

- `Explicit model` or `Skill model` requires an actual accessible model;
- `Guided practice` requires an observable guidance and feedback turn;
- `Mastery check` requires evidence appropriate to the claimed outcome; and
- `Correction and reflection` requires correction and reattempt, not reflection alone.

## 5. Required lesson contract

Every Ready for Life lesson MUST carry or resolve the following curriculum information. The names below are conceptual metadata, not a mandated implementation schema.

| Contract area | Minimum requirement |
|---|---|
| Identity and provenance | Stable lesson ID, grade/course, unit, phase, title, version, and `MANUEL_ACADEMY_LOCAL_COMPOSITION` authority basis |
| Purpose | One primary and zero to two secondary purpose keys from section 4 |
| Goal | A learner-visible, grade-appropriate statement of the skill, context, and successful outcome |
| Readiness | Needed prior knowledge, access assumptions, and any adult availability required before beginning |
| Materials | Complete list of physical materials and every embedded or versioned resource reference |
| Model | Embedded model content or a resolvable model reference whenever a model is named, promised, or required by the phase |
| Teaching sequence | Modeled steps, decision points, and safety boundaries sufficient to perform the task |
| Guided attempt | Coach/adult action, learner turn, feedback or correction, and release condition when guidance is useful |
| Independent transfer | A real-life task or equal-credit simulation that the learner can perform without answer-giving help |
| Evidence and mastery | Evidence type, observable success criteria, evaluator, and separation of scoring from completion certification |
| Reflection | A task-appropriate reflection or evidence interpretation prompt that does not manufacture a right opinion |
| Retry | Trigger, targeted reteach, reattempt, feedback, exit criterion, and return path |
| Completion authority | `learner` or `guardian`, with the certification boundary and sign-off record where required |
| Safety and privacy | Hazards, stop rules, prohibited disclosures, adult handoff, and safe/equal-credit alternative |
| Duration | Active learner time, elapsed window, session pattern, and later check-in when applicable |
| Tutor metadata | Curriculum-side coaching scope, hint ladder, resource/model references, privacy limits, authority handoff, and missing-resource behavior |

No label or metadata field may substitute for the learner-visible content needed to do the work.

## 6. Teaching standard

### 6.1 Clear goal

The learner-visible goal MUST:

- say what the learner will know, decide, plan, make, or do;
- name the setting or constraints that matter;
- state what acceptable success looks like without revealing an adult-only answer key;
- use direct, age-appropriate language; and
- avoid dense authoring language such as “the learner will demonstrate...” when the content is shown to the learner.

A goal MUST NOT imply that one household routine, food preference, career path, family structure, or personal value is universally correct.

### 6.2 Materials and referenced resources

A practical lesson MUST include enough material to actually perform the task.

Every named scenario, worksheet, checklist, guide, form, source sheet, agreement, posting, script, sample page, picture set, model, or other artifact MUST be one of:

1. embedded in the lesson;
2. packaged as a stable, versioned resource that resolves in the learner delivery context; or
3. explicitly identified as an adult/local material, with instructions for selecting it safely and a runnable equal-credit alternative that does not depend on it.

The lesson MUST identify which task uses each material. A resource reference MUST resolve to the intended version and be accessible to the learner or authorized adult at the point of use. A title, filename, or “provided” label without a delivered object does not satisfy this requirement.

If the lesson says “see the model,” “use the worksheet,” “read the provided page,” or equivalent, that object MUST exist. If it does not resolve, the lesson is blocked. The Tutor MUST NOT invent a replacement.

### 6.3 Model standard

When a model is named or the phase is `Explicit model` or `Skill model`, the model MUST include:

- a concrete sample input or starting condition;
- visible expert actions or a completed sample output;
- the reasoning at meaningful decision points;
- at least one check against the success criteria; and
- enough distinction between the sample and the independent task to require transfer rather than copying.

For a physical skill, a live adult demonstration MAY be the model only when the lesson names the adult role, provides observation cues, and supplies an accessible simulation or equivalent when that adult/model is unavailable. A model label, directions-only checklist, or reference to a hidden example is not a model.

### 6.4 Guided first attempt

Guided practice is useful—and therefore required—when a skill is new, multi-step, safety-sensitive, easily misunderstood, or dependent on feedback before independent action. The lesson MUST make guidance observable through:

1. a model or coach cue;
2. a bounded learner attempt;
3. feedback tied to the process or success criteria;
4. a learner correction or second turn; and
5. a clear release to independent work.

A self-checklist completed alone is not automatically guided practice. A lesson MAY omit guided practice only when the learner is reviewing an already established skill or the task is low-risk and self-correcting; the authoring record SHOULD state that rationale.

### 6.5 Independent real-life task

Every lesson MUST contain an independent or performance task that applies the target skill. It MUST be runnable using only the delivered lesson, its resolved materials, and the permitted support named in the lesson.

For a real-world action, the lesson MUST also provide an equal-credit simulation when safe access, household permission, transportation, equipment, cost, food, accounts, or adult availability may be absent. The simulation MUST include its own complete inputs. It may not point to a missing “sample” artifact.

Independent means the learner makes the target decisions or performs the target steps. It does not mean the learner must work without a needed safety observer or authorized adult.

### 6.6 Reflection and evidence

Reflection MUST fit the task. It may ask the learner to identify a decision, observed result, tradeoff, correction, uncertainty, or transfer. It SHOULD vary in form and burden; every practical task does not need the same four-part written shell.

For a physical procedure, a short process check plus authorized observation may be better evidence than a long essay. For a decision, comparison or reasoning may be appropriate. For a personal preference, the response may be complete and supported without matching a preferred choice.

The lesson MUST NOT require disclosure of sensitive household or personal information to make a reflection seem authentic.

## 7. Duration semantics

Ready for Life duration MUST describe the task learners actually perform. A single generic `45–60` label MUST NOT be used when the task contains waiting, repetition, adult scheduling, next-day observation, or multi-day work that materially changes completion.

Each lesson MUST distinguish, where applicable:

| Duration element | Meaning |
|---|---|
| `activeLearnerTime` | Estimated minutes the learner is actively reading, planning, practicing, performing, recording, or reflecting |
| `elapsedWindow` | Real clock/calendar span from start to final evidence, including overnight or multi-day observation |
| `sessionPattern` | One sitting, split session, repeated practice, observation window, or project |
| `checkInPlan` | Timing and purpose of a later observation, comparison, feedback, or sign-off |
| `adultTime` | Approximate adult/model/supervision/sign-off time when adult availability is required |
| `simulationDuration` | Active and elapsed time for the equal-credit alternative when it differs materially |

Meaningful examples include:

- `20–30 active minutes in one session`;
- `15–20 active minutes, one overnight observation, then a 5–10 minute next-morning check-in`;
- `three 10-minute practices across 5–7 days, plus a 10-minute review`; and
- `40–60 active minutes across two sessions; adult sign-off after the second session`.

An estimate MAY be a range and MAY acknowledge household variation. It still MUST identify the session/elapsed shape. The duration gate is about semantic honesty, not forcing false precision.

## 8. Completion authority and guardian sign-off

Scoring, learner self-report, physical completion, and certification are separate facts.

### 8.1 Learner authority

Learner completion authority is appropriate when the learner can complete and evidence the outcome without claiming an adult-observed or adult-permitted event occurred. Examples include knowledge checks, fictional simulations, plans, scripts, comparisons, and non-sensitive artifacts.

Adult help may be allowed in a learner-authority lesson, but the lesson MUST distinguish support from certification. If the task depends on an adult model or feedback but not adult certification, say so explicitly.

### 8.2 Guardian authority

Guardian completion authority is required when the claimed completion depends on:

- household permission;
- adult-required supervision or a safety-sensitive physical action;
- a purchase, cancellation, signature, account change, service agreement, or other consequential household decision;
- adult-only access or evidence; or
- confirmation that a real-world action occurred when learner self-report is not sufficient.

A guardian-authority lesson MUST:

- require permission before the learner begins;
- name the household-authorized guardian as the certifying actor;
- state whether trusted-adult supervision is required;
- specify the minimum non-sensitive evidence the guardian considers;
- record learner self-report as non-certifying; and
- provide an equal-credit alternative when the real task cannot be authorized or accessed.

AI/Tutor MUST NOT self-certify physical completion, household permission, safety-sensitive completion, or adult-required evidence. It MUST NOT convert a learner’s statement into guardian attestation or impersonate a guardian. A guardian’s certification records that the authorized event occurred; it does not automatically determine the academic quality of the learner’s knowledge, process, reflection, or artifact.

Identifiable photos, recordings, account screens, documents, and location proof MUST NOT be required for guardian sign-off.

## 9. Safety, privacy, and dignity

### 9.1 Universal boundaries

Every practical lesson MUST identify foreseeable hazards, the learner’s stop rule, tasks reserved for an adult, and what to do when safe materials or supervision are unavailable.

Prompts MUST use the least-sensitive information that can teach the skill. Unless a separately approved purpose makes it essential, lessons MUST NOT request or store:

- a home address, exact location, route history, or live location;
- passwords, password patterns, password length/uniqueness data tied to a real account, security answers, recovery information, or account identifiers;
- real account/service inventories, billing identifiers, payment details, or screenshots of account settings;
- private household income, debt, purchases, legal documents, leases, health records, medicines, diagnoses, or insurance details;
- family conflict narratives, allegations, or disclosures about another household member;
- names, contact details, schedules, signatures, or other information that identifies the learner or household; or
- identifiable image, audio, or video proof.

Use invented, redacted, generalized, or learner-kept-offline information instead. A learner MUST be able to decline a private real-life path and receive equal credit through a complete simulation.

Evaluation MUST be neutral and non-diagnostic. It MUST NOT shame mess, food access, household routines, finances, missed steps, disability, family structure, or need for adult help. It MUST NOT infer effort, motivation, honesty, diagnosis, maturity, or character from an error.

### 9.2 Age-sensitive boundaries

These are minimum curriculum boundaries, not claims about law or universal household readiness.

#### Grades 3–5

- Household action requires clear adult permission when the lesson enters shared spaces, changes household property, or uses household products.
- An adult handles blades, heat, medicines, concentrated cleaners, chemical containers, electrical hazards, and other adult-only tools.
- Directions use short learner-facing sentences, concrete examples, and visible stop/ask-an-adult cues.
- Lack of access to a household routine or material is not treated as a learner deficit.

#### Grade 7 targeted boundary

Grade 7 is not a blanket independence threshold. The following families require explicit treatment:

- **Washer/dryer and stain products:** require household permission, instructions specific to the permitted machine/product, a stop rule for unfamiliar settings or products, and simulation when permission or access is absent. Do not imply that reading a garment label alone authorizes machine or chemical use.
- **Real food and minimal heat:** require permission, allergy/diet boundary language, spoilage and hand/surface safety, an adult-only rule for unapproved heat or tools, and a no-real-food simulation when needed.
- **Perishable storage and cleaning:** define the relevant time window; name safe, already-approved supplies; prohibit mixing products; and require an adult check when food condition or product use is uncertain.
- **Account security:** use invented accounts and invented credentials only. Do not collect real account names, account inventories, password length/uniqueness metadata, security settings, or crack-time evidence tied to real credentials.
- **Subscriptions and in-app purchases:** use a complete fictional sample by default. A guardian-approved, view-only real screen MAY be a local option, but the lesson must not record the service name, billing details, identifiers, or screenshot. The learner must not purchase, cancel, subscribe, or change account settings in a learner-authority task.

Any live Grade 7 variant that crosses a permission, safety, purchase, cancellation, or account-change boundary requires guardian authority. Tutor coaching cannot supply that authority.

#### Grades 8–9

- Increased procedural independence does not remove household permission, privacy, transportation, unfamiliar-adult, food, tool, or account boundaries.
- Community navigation and transportation work uses fictionalized or generalized routes unless a guardian approves a private, offline real route; exact locations are not submitted.
- Workplace and interview practice uses fictional postings/scripts unless a complete, safe, non-identifying alternative is supplied.

#### Grades 10–12

- Do not assume the learner is a legal adult.
- Contract, lease, civic, workplace, housing, and health-process instruction uses complete fictional documents by default.
- When current external information is instructionally necessary, the curriculum must identify a current official source, jurisdiction/scope, access date, and verification task. It must not turn the Tutor’s memory into authority.
- Lessons do not provide legal, medical, financial, or civic eligibility advice and do not ask the learner to disclose a real case.
- A real signature, application submission, purchase, cancellation, account change, appointment, or release of personal data requires the appropriate adult/guardian boundary and cannot be a required learner-authority action.

## 10. Mastery and evidence standard

Every lesson MUST identify the claimed mastery kind or kinds. Different kinds may use different evaluators and evidence.

| Mastery kind | What it establishes | Appropriate evidence | What it does not establish by itself |
|---|---|---|---|
| `KNOWLEDGE` | The learner understands a concept, rule, cue, or distinction | explanation, classification, source-traceable answer, scenario response | physical completion |
| `PROCEDURE` | The learner can carry out ordered steps and checks | observed or simulated performance, process record, corrected attempt | household permission or character |
| `COMPLETION` | The assigned bounded task or simulation reached its defined end state | required outputs plus authorized completion record | quality of reflection or general mastery |
| `REFLECTION` | The learner can interpret experience, evidence, tradeoffs, or transfer | specific, relevant response grounded in the task | a preferred opinion or objective truth about personal values |
| `ADULT_SIGNOFF` | The authorized adult confirms the defined real-world event or boundary | minimal guardian attestation | academic correctness, effort, motivation, or Tutor authority |
| `ARTIFACT_EVIDENCE` | A plan, checklist, script, comparison, record, or product exists and meets named observable criteria | submitted or locally reviewed non-sensitive artifact | that an unobserved physical action occurred |

The lesson and adult scoring record MUST state:

- which mastery kinds are claimed;
- which prompt, performance, artifact, or attestation supplies each kind of evidence;
- who may evaluate or certify it;
- observable success and retry criteria; and
- what information must not be collected.

Objective scoring is appropriate for source-traceable knowledge, fixed safety distinctions, calculations, or observable procedural criteria. Subjective reflection MUST NOT be scored as a simplistic right/wrong answer. It may be reviewed for completion, relevance, specificity, evidence use, or reasoning without requiring a particular preference, emotion, household custom, or life direction.

Rubric language MUST name the observable construct. Labels such as `honesty`, `maturity`, `responsibility`, or `good choices` are prohibited when they function as character judgments. Prefer terms such as `evidence-balanced comparison`, `acknowledged tradeoff`, `complete process`, or `accurate self-report`.

Adult-only scoring content remains adult-only and MUST NOT be exposed as a learner answer key. Every scoring record MUST preserve the non-diagnostic guard: do not infer effort, motivation, diagnosis, or character from an error.

## 11. Reteach and retry loop

A remediation note is not a complete retry path. Every lesson MUST define a closed loop:

1. **Trigger:** the specific misconception, unsafe step, missing evidence, or procedural breakdown that starts remediation;
2. **Targeted reteach:** a smaller explanation, contrast, model, or cue addressing that trigger;
3. **Supported reattempt:** a bounded attempt on the corrected step;
4. **Feedback:** evidence-based confirmation or correction;
5. **Parallel reattempt:** a fresh but equivalent item, scenario, or performance turn so success is not simple copying;
6. **Exit criterion:** the observable condition for leaving remediation; and
7. **Return path:** where the learner resumes or repeats the independent task.

For a safety error, the learner stops the live task before reteach. The reattempt occurs in simulation or with the required adult boundary. A Tutor may coach the loop but may not waive a guardian requirement or certify a physical reattempt.

Retry evidence MUST match the mastery kind. A revised explanation cannot prove a physical procedure occurred, and guardian sign-off cannot replace correction of a knowledge error.

## 12. Curriculum-side Tutor metadata

This section defines content metadata only. It does not implement Tutor V2.

Each lesson MUST provide the following Tutor-facing curriculum fields:

| Field | Required content behavior |
|---|---|
| `coachScope` | Steps and concepts the Tutor may explain, chunk, rehearse, or question |
| `hintLadder` | Ordered hints from a prompt/cue to a partial model, without disclosing adult-only scoring as an answer key |
| `modelRef` | Exact embedded model or resolvable resource reference |
| `resourceRefs` | Exact learner-visible resources and access expectations |
| `evidenceExpected` | Learner-visible evidence types and boundaries |
| `retryPlan` | Trigger, reteach, attempts, feedback cues, and exit criterion |
| `completionAuthority` | Learner or guardian, plus what the Tutor must hand off |
| `guardianHandoff` | Neutral language for pausing until permission, supervision, or sign-off is available |
| `privacyDoNotAsk` | Lesson-specific sensitive facts the Tutor must not request or retain |
| `currentSourcePolicy` | Whether a current official source is required, with source/scope/date rules |
| `missingResourceAction` | Stop, identify the missing item, and route to the supplied alternative; never fabricate it |

The Tutor MAY explain vocabulary, model reasoning already supplied by the curriculum, break steps into smaller turns, ask the learner to reason aloud, provide process feedback, and coach an authorized retry.

The Tutor MUST NOT:

- fabricate a missing scenario, model, source sheet, agreement, lease, posting, script, process page, checklist, or answer-bearing document;
- state current local legal, civic, workplace, health, food-safety, or consumer rules from memory when the lesson requires a verified current source;
- request sensitive household, credential, account, location, financial, health, legal, or conflict information;
- access or direct changes to real accounts, purchases, subscriptions, signatures, or applications;
- replace guardian permission, supervision, observation, or sign-off;
- claim that a physical task occurred; or
- convert a personal reflection, preference, household custom, or life direction into a right/wrong judgment.

## 13. Ready for Life quality gate

The gate combines deterministic checks with Director review. Text scans produce reconciliation queues; they do not convert an unresolved candidate into a silent pass. A confirmed blocker prevents release as conforming to R1.

| Gate defect | Detection rule | Passing evidence | Result if confirmed |
|---|---|---|---|
| Missing referenced material | Learner-visible text or materials name a provided/sample/reference artifact | Embedded content, valid packaged resource, or explicit adult/local-material contract plus complete alternative | **BLOCK** |
| Missing model | Phase/title or directions promise a model, demonstration, example, exemplar, or “see the model” action | Model meeting section 6.3 is visible or resolves at point of use | **BLOCK** |
| Broken material link/ref | Resource identifier, path, link, version, or package entry does not resolve in the intended delivery context | Resolver check succeeds and target is accessible to the intended actor | **BLOCK** |
| No retry path | Remediation contains advice but lacks a reattempt, feedback, exit criterion, or return path | Closed loop meeting section 11 | **BLOCK** |
| Generic duration misuse | A single-session estimate conflicts with overnight, next-day, repeated, multi-day, project, adult-scheduled, or delayed-evidence work | Active time, elapsed window, session pattern, and check-in semantics agree with the task | **BLOCK** |
| Unsafe or private prompt | Prompt requests prohibited data, lacks a foreseeable hazard/stop rule, or requires unsafe access | Minimum-data prompt, explicit boundaries, and complete equal-credit alternative | **BLOCK — SAFETY/PRIVACY** |
| Missing guardian boundary | Task requires permission, adult-only evidence, safety-sensitive completion, or a consequential real action while authority/handoff remains learner-only or ambiguous | Explicit authority decision and, when triggered, guardian permission/sign-off contract | **BLOCK — AUTHORITY** |
| Fake objective scoring of reflection | A personal preference, feeling, household custom, family circumstance, food choice, or life direction is keyed or scored as correct/incorrect | Evidence/reasoning/completion criterion that accepts multiple safe, supported responses | **BLOCK — ASSESSMENT** |
| Thin instructions | Target learner cannot perform the practical task from the delivered steps, decision cues, materials, safety limits, and completion condition | Runnable task with enough ordered action and checks to produce the intended outcome | **BLOCK** |
| Unsupported external authority | Lesson presents an uncited state/local/legal/health/process label or claim as authoritative | Manuel Academy local label or separately verified source, version, scope, and mapping | **BLOCK — PROVENANCE** |

### 13.1 Deterministic checks

Automated validation SHOULD:

- reconcile all named resources against package entries and verify that targets are readable;
- flag model-phase lessons and model-language without an embedded/resolvable model;
- verify required fields for purpose, evidence, authority, safety/privacy, duration, retry, and Tutor metadata;
- compare extended-window phrases and task structure to duration metadata;
- flag prohibited-data patterns and consequential-action verbs for Director review;
- confirm that real-world actions include a complete, runnable equal-credit alternative;
- confirm that guardian authority and scoring records agree; and
- preserve corpus reconciliation, integrity, and learner/adult projection separation.

Deterministic checks MUST NOT claim that minimum word count proves instructional depth. Thin-instruction and subjective-scoring decisions require content review.

### 13.2 Director review questions

For each reviewed lesson, the Director should be able to answer yes to all of the following:

1. Can the target learner begin and finish using only delivered content and permitted support?
2. Is the model visible and does it show reasoning rather than only assign steps?
3. Does guided work include a correction opportunity before independence where guidance is useful?
4. Is the independent task authentic or an equal-credit complete simulation?
5. Are safety, privacy, and adult boundaries proportionate to the learner’s grade and the task?
6. Do duration semantics describe active time and real elapsed time honestly?
7. Does each mastery claim have matching evidence and the correct evaluator/certifier?
8. Does remediation end in observable reattempt evidence?
9. Could the Tutor coach without inventing materials, authority, current rules, or completion?
10. Does the lesson avoid shame, character inference, and a fake correct answer for subjective reflection?

## 14. Recommended representative Director sample

Director acceptance SHOULD use the following 12-lesson slice identified by the audit. It spans all nine grade/source families and every priority defect class. Passing this slice does not replace full-corpus checks.

| Review role | Lessons | Primary reason |
|---|---|---|
| Modeling positive controls | `ma-g3-ready-for-life-u06-l02`; `ma-g8-ready-for-life-u01-l02`; `ma-g8-ready-for-life-u02-l02` | Visible worked examples, reasoning, and transfer |
| Guardian/safety positive controls | `ma-g3-ready-for-life-u01-l04`; `ma-g8-ready-for-life-u03-l04`; `ma-g9-ready-for-life-u02-l04` | Permission, supervision, evidence, alternatives, and safe real action |
| Material-blocked negative controls | `ma-g4-ready-for-life-u03-l03`; `ma-g10-ready-for-life-u04-l01`; `ma-g11-ready-for-life-u04-l02`; `ma-g12-ready-for-life-u04-l02` | Missing scenario/agreement/lease/process-page dependencies across age bands |
| Privacy/authority red-team controls | `ma-g7-ready-for-life-u05-l01`; `ma-g7-ready-for-life-u03-l06` | Credential-adjacent data, food/cleaning safety, and learner-versus-guardian authority |

The Director SHOULD also review the vertical official-information slice `ma-g10-ready-for-life-u05-l04`, `ma-g11-ready-for-life-u04-l06`, `ma-g12-ready-for-life-u04-l02`, and `ma-g12-ready-for-life-u04-l06` before approving any current-source/Tutor metadata pattern. That slice tests neutral civic framing, jurisdiction-sensitive information, fictional materials, guardian review, and Tutor non-invention.

## 15. R1 conformance decision

A lesson conforms to this draft only when:

- its purpose, phase, evidence kind, completion authority, and duration are separately and correctly expressed;
- every promised material and model is present and accessible;
- its teaching sequence is sufficient to perform the practical task;
- guided practice is genuine where useful;
- independent work and any equal-credit alternative are runnable;
- evidence matches knowledge, procedure, completion, reflection, artifact, and sign-off claims;
- guardian authority cannot be replaced by learner self-report or AI/Tutor action;
- safety, privacy, and dignity boundaries pass age-sensitive review;
- duration reflects both active work and authentic elapsed time;
- remediation closes through a real retry and exit criterion; and
- the Tutor can coach from curriculum-side metadata without inventing content, authority, current rules, or completion.

Later curriculum repair must run the full Ready for Life gate, preserve `324/324` structural reconciliation, and run the corpus Vitest suite once its dependency is available. Neither the prior structural pass nor the representative sample alone is an R1 depth acceptance.
