# Manuel Academy Health Lesson Standard R1

Status: **DRAFT FOR DIRECTOR REVIEW**

Applies to: Health lessons, Grades 3–5 and 7–12

Advisory metadata contract:
`HEALTH_LESSON_ADVISORY_CONTRACT_R1.schema.json`

Base for this draft: `a7c6edee867e0d3f546aaa6e0442fac434b75c84`

Audit input: **Health + PE Learner Depth Audit R1**, pinned to
`56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

## 1. Purpose and authority

This standard defines what a teaching-quality Manuel Academy Health lesson
must supply. It is a curriculum authoring and human-review standard. It is not
a clinical standard, a diagnosis tool, a production release gate, or authority
to rewrite the current Health corpus.

Health lessons should help learners understand accurate information, use
health vocabulary, reason through safe fictional or public situations, practice
communication and help-seeking, and produce bounded evidence of learning. They
must protect privacy and dignity while doing so.

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative. A
documented, instructionally sound exception may satisfy a **SHOULD**. It cannot
waive a **MUST** or **MUST NOT**.

R1 remains a draft until the Director reviews a complete sample authored
against an approved successor to this standard. It does not approve bulk
repair, reclassification, migration, or release admission.

## 2. Audit basis

The audit inspected all 324 active Health lesson packages and their paired
scoring guides across grades 3, 4, 5, and 7–12. Grade 6 had no authored Health
course in the audited corpus.

Strengths to preserve include:

- 324/324 lessons contain unique, objective-bearing teaching points;
- 324/324 contain topic vocabulary, a scenario/application, remediation, and
  trusted-adult or qualified-professional safety routing;
- 324/324 prohibit diagnosis inference, private disclosure, shame, dieting,
  calorie targets, body measurement, appearance scoring, and recorded-media
  proof; and
- 324/324 require more than one response for mastery.

The standard directly answers these audit findings:

- 287 lessons exceeded the audit's advisory reading screen;
- 252 scoring guides ambiguously allowed private reflection as mastery
  evidence even though the lesson marked that reflection private, optional,
  and ungraded;
- 72 Grade 3–4 independent tasks used a generic shell rather than naming the
  lesson-specific reasoning actions;
- six Grade 12 capstone prompts mixed personal-plan and fictional-case frames;
- all 324 adult guides lacked fact-specific acceptable-answer and
  misconception boundaries; and
- repeated engineering language made otherwise substantive content harder to
  present naturally.

Readability metrics are triage evidence, not automatic rejection criteria.
Conformance requires human judgment of clarity, topic sensitivity, accuracy,
and total learner burden.

## 3. Scope and non-goals

This standard governs learner-facing curriculum, protected adult authority,
and future curriculum metadata. It does not implement or change Tutor V2,
Study Engine, learner UI, memory, provider behavior, scoring runtime, mastery
state, guardian workflow, or release gates.

This standard does not authorize a lesson, author, reviewer, or future Tutor to:

- diagnose a learner or another person;
- infer a condition, motivation, character, family situation, or health status
  from a response;
- provide individualized medical, mental-health, nutrition, medication,
  supplement, exercise, or treatment advice;
- require a learner to disclose sensitive personal or family information;
- treat a subjective reflection as automatically correct or incorrect;
- rank bodies, body sizes, appearance, food choices, disability, health status,
  or access to care as measures of personal value; or
- replace a guardian, trusted adult, clinician, emergency service, or other
  qualified authority when that authority is required.

## 4. Core terms

**Health lesson type** is the lesson's dominant instructional purpose. Every
lesson declares exactly one primary type and may declare up to two secondary
types.

**Clear explanation** is accurate, learner-facing teaching that names the idea,
explains how it works or why it matters, distinguishes it from a plausible
confusion, and gives the learner a usable decision rule or next step.

**Model example** is a complete, separate example that makes safe reasoning or
communication visible. It may reveal the answer to the model case because it
is not the learner's protected attempt.

**Decision scenario** is a bounded fictional, public, or generalized situation
with enough facts, choices, constraints, and safety context for a learner to
make and explain a decision without supplying private information.

**Guided reasoning** includes a learner attempt, a cue or question, feedback
tied to observable reasoning, and a corrected or extended learner turn. A
completed example followed by copying is not guided reasoning.

**Independent evidence** is a fresh response in which the learner supplies the
target factual distinction, decision, reason, communication move, or support
route without answer-bearing help.

**Private reflection** is an optional learner-kept reflection that is not
needed for scoring, completion, mastery, or Tutor/guardian visibility.

**Minimally disclosive evidence** uses fictional, public, generalized, or
learner-selected non-sensitive content. It is not the same thing as private
reflection.

**Mastery** is a curriculum claim supported by accurate independent evidence
and later retrieval or transfer. One answer, one self-rating, or one subjective
reflection cannot establish mastery.

## 5. Health lesson types

Every lesson MUST select the type that matches its central learner outcome, not
its title, unit slot, or generator family.

| Type key | Use when the central outcome is... | Required distinguishing supply |
| --- | --- | --- |
| `CONCEPT_VOCABULARY` | understanding a health concept and using its vocabulary accurately | clear explanation, term meanings in context, examples/non-examples, misconception boundary, and a fresh concept check |
| `INFORMATION_EVALUATION` | judging the reliability, limits, relevance, or safety of health information | source/features model, reliability criteria, uncertainty or limit, guided comparison, and independent evaluation |
| `DECISION_REASONING` | choosing and explaining a safe action in a health-related situation | fictional/public scenario, options and constraints, modeled decision, guided case, fresh independent case, and support/escalation route |
| `COMMUNICATION_HELP_SEEKING` | asking for help, setting a boundary, listening, refusing, reporting, or responding supportively | model language, role boundaries, low-disclosure practice, alternate response mode, and an independent communication decision |
| `HEALTH_SKILL_PROCEDURE` | applying a bounded non-clinical health or safety process | sequenced steps, materials if any, model, safety/stop points, guided attempt, independent application or description, and no diagnosis/treatment claim |
| `REVIEW_RETRIEVAL` | retrieving, connecting, or transferring already taught Health learning | named prior targets, varied retrieval, feedback, and at least one fresh application; it may not introduce untaught content as if it were review |
| `REMEDIATION_RETRY` | correcting a named factual, reasoning, vocabulary, or process gap | neutral observable signal, smallest prerequisite, alternate explanation/model, guided correction, fresh retry, and exit criterion |
| `MASTERY_EVIDENCE` | collecting independent evidence for a previously taught target | fresh bounded task, permitted supports, protected authority, later retrieval/transfer plan, and explicit exclusion of private reflection |
| `PROJECT_CAPSTONE` | integrating several taught Health concepts in a product, plan, campaign, or analysis | bounded fictional/public brief, staged milestones, source and safety limits, criteria, independent contribution, and no required personal health plan |

A lesson may combine modes, such as vocabulary within decision reasoning. The
primary type determines the central independent evidence. A type label does not
prove the required teaching is present.

## 6. Universal Health lesson package

Every conforming Health lesson MUST contain or resolve the following supply.
References must be stable and available where the lesson is delivered.

| Contract area | Minimum curriculum supply |
| --- | --- |
| Identity and intent | Stable lesson ID, grade/band, course/unit, primary type, standards, concept IDs, learning goal, and evidence purpose |
| Entry | Required prior concepts, a brief low-stakes entry check, and approved support for a prerequisite gap |
| Explanation | Accurate learner-facing explanation, important distinction, why it matters, and a usable decision/process |
| Vocabulary | Lesson-critical terms, meanings in context, examples/non-examples where useful, and a short meaning/use check |
| Models | At least one separate model or contrast set for new, easily confused, safety-sensitive, or decision-bearing learning |
| Scenarios | Complete fictional/public facts, choices, constraints, privacy cue, and safety/support context where decisions are taught or assessed |
| Guided work | Learner attempt, bounded support, feedback move, correction/second turn, and release condition |
| Independent work | Fresh prompt, required evidence, permitted supports, independence boundary, and response alternatives |
| Protected authority | Accurate answers or criteria, acceptable variation, required facts/terms, misconception boundaries, safety-critical errors, and scoring notes |
| Remediation | Observable trigger, prerequisite, alternate explanation/model, guided retry, fresh independent retry, and return/exit rule |
| Mastery | Evidence forms, independence rule, later retrieval/transfer, minimum occasions, and protected decision authority |
| Reflection | Purpose, optionality, privacy classification, visibility, and scoring treatment |
| Safety and privacy | No-diagnosis boundary, no-disclosure route, escalation language, dignity rules, prohibited demands, and guardian/adult authority where applicable |
| Future Tutor manifest | Data-only references for approved explanations, cues, adaptations, coaching, evidence, privacy, safety, and authority handoff |

No metadata field, generic shell, or readiness label substitutes for the actual
learner-facing teaching object.

## 7. Teaching sequence

An instruction-bearing lesson SHOULD present the following sequence. Review,
remediation, mastery, and project lessons may reuse earlier approved teaching
by stable reference, but they MUST include the portions needed for their own
purpose.

1. State the goal and privacy/safety boundary.
2. Activate a relevant prior idea without requesting personal disclosure.
3. Explain the concept and essential vocabulary.
4. Model the target thinking, decision, communication, or procedure on a
   separate example.
5. Ask the learner to reason through a guided example and respond to feedback.
6. Fade support before a fresh independent task.
7. Check the evidence against learner-visible success criteria.
8. Remediate a named gap and provide a fresh retry when needed.
9. Use later retrieval or transfer before a mastery claim.
10. Offer reflection only under the boundaries in section 12.

The lesson MAY split this sequence across sessions when the relationship and
evidence timing are explicit.

## 8. Explanation and vocabulary standard

### 8.1 Clear explanation

A clear Health explanation MUST:

- state the health idea in direct learner-facing language;
- explain a cause, relationship, distinction, process, protective factor, or
  decision principle rather than merely restating the objective;
- separate observable facts from assumptions and value judgments;
- distinguish the target from at least one plausible confusion when confusion
  could affect safety, dignity, or factual accuracy;
- acknowledge uncertainty and individual variation when scientifically or
  contextually appropriate;
- identify a safe next step or support route when the topic can raise a real
  concern; and
- avoid implying that lesson content can determine whether a person has a
  diagnosis or should change treatment.

An explanation is not sufficient when it consists only of key-point fragments,
a command to research the topic, a scenario prompt, or a list of rules without
the reasoning that connects them.

### 8.2 Age-appropriate health vocabulary

Vocabulary MUST preserve accurate terms while making them usable. Each
lesson-critical term SHOULD include:

- a learner-friendly meaning in the current context;
- pronunciation or word-part support when useful;
- an example and non-example or contrast when the boundary matters;
- a statement of what the term does **not** allow the learner to infer; and
- a brief, observable meaning or use check before independent evidence.

Terms such as *diagnosis*, *consent*, *stress response*, *substance use*,
*infection*, *nutrition*, *mental health*, *risk*, and *protective factor* may
be appropriate when the lesson teaches them accurately. Replacing precise
terms with vague euphemisms can be as harmful as unexplained technical
language.

Learner-facing copy SHOULD avoid curriculum-engineering phrases such as
“central task,” “response mode,” “under a new constraint,” “representation,”
or “when the standard permits.” Put such terms in authoring metadata, not in
the learner's directions.

## 9. Model examples and decision scenarios

### 9.1 Model example

A required model MUST be present or resolvable and MUST show:

1. the complete fictional/public starting situation;
2. what facts are relevant and which details are assumptions or distractions;
3. the health concept or vocabulary being used;
4. at least two possible actions or interpretations when a decision is
   involved;
5. the reason one response is safe, accurate, respectful, or appropriately
   bounded;
6. the support or escalation route, when applicable; and
7. a check against the success criteria.

The model MUST use a different case from the protected independent task. A
model may demonstrate respectful uncertainty; it need not pretend every Health
decision has one universal answer.

### 9.2 Decision scenario

A decision scenario MUST:

- be fictional, public, historical, generalized, or otherwise non-sensitive;
- contain all facts needed for the expected reasoning;
- distinguish fixed safety facts from preferences or contextual judgments;
- state realistic choices, constraints, and available support;
- avoid requiring symptoms, diagnoses, trauma, sexual history, family conflict,
  substance use, eating behavior, body data, or treatment history from the
  learner;
- avoid manufacturing a crisis or asking a learner to induce or simulate
  symptoms; and
- define acceptable reasoning variation and any unsafe or factually incorrect
  boundaries in protected authority.

If learner-facing fields conflict between a personal and a fictional frame,
the lesson is not conforming. An authoring or runtime layer MUST NOT guess which
frame controls.

### 9.3 Guided reasoning

Guided reasoning MUST preserve a meaningful learner decision. The lesson MAY
name the relevant facts, ask the learner to compare options, restate the goal,
or model a parallel case. It MUST NOT tell the learner which protected option
to choose or supply the decisive reason.

Feedback MUST distinguish at least these cases where applicable:

- missing or inaccurate fact;
- assumption presented as fact;
- health vocabulary used imprecisely;
- safe choice with incomplete reasoning;
- reasonable alternate choice supported by the scenario;
- unsafe, shaming, diagnostic, or disclosure-seeking response; and
- correct reasoning expressed through an alternate response mode.

## 10. Independent evidence and answer authority

Independent evidence MUST use a fresh prompt or case and identify:

- the concept, decision, communication move, or procedure being evidenced;
- the response form or equal alternatives;
- supports allowed before and during the attempt;
- which supports would make the attempt guided rather than independent;
- learner-visible success criteria; and
- protected adult authority for judging factual accuracy, reasoning,
  acceptable variation, and safety boundaries.

Valid evidence may include a fictional scenario response, source comparison,
communication script, concept map, ordered procedure, error analysis, safe
decision plan for a fictional person, or oral/signed/drawn equivalent. It MUST
NOT depend on a learner's private health history, body data, real diagnosis,
real treatment, family circumstances, photograph, recording, or public
performance.

Protected authority MUST be lesson-specific. “Answers will vary” or “uses
reasoning” is insufficient by itself. Authority SHOULD enumerate:

- facts and vocabulary needed for a complete response;
- acceptable conclusions or a rule for acceptable variation;
- evidence-to-reasoning connections;
- common misconceptions and insufficient responses;
- unsafe, diagnostic, stigmatizing, or privacy-invasive boundaries; and
- what revision would make a partial response sufficient.

Subjective preferences and personal meanings are not fixed-answer items. When
a response includes factual claims, those claims may be checked for accuracy;
the learner's feeling, preference, or personal meaning is not scored as the
right or wrong one.

## 11. Remediation, retry, and mastery

### 11.1 Remediation

Remediation MUST respond to an observable learning signal, not a label about
the learner. It MUST:

1. name the smallest factual, vocabulary, reasoning, or process gap;
2. return to an approved prerequisite when needed;
3. provide a materially different explanation, contrast, representation, or
   model;
4. invite a bounded guided correction;
5. provide a fresh independent retry; and
6. state the exit criterion and next instructional route.

Repeating the same paragraph, asking for a longer reflection, or restating the
answer is not remediation. A pause, privacy choice, alternate response mode,
or request for adult help is not evidence of failure.

### 11.2 Mastery

Mastery MUST require:

- accurate independent evidence aligned to the target;
- successful retrieval or transfer on at least one later or meaningfully
  different occasion;
- at least two evidence occasions unless a separately approved assessment
  contract requires more;
- enough variation to prevent copying a model or memorized scenario answer;
- protected authority that identifies acceptable variation and misconceptions;
  and
- an authorized human/runtime decision under a separately approved policy.

Private reflection, optional reflection, learner comfort, disclosure, one
self-rating, one answer, or Tutor confidence MUST NOT establish mastery.
Minimally disclosive **scored evidence** may contribute only when it is clearly
separate from private reflection, uses a non-sensitive frame, and meets the
same independent evidence rules.

## 12. Reflection standard

Reflection may help a learner notice understanding, uncertainty, strategy,
support, or transfer. It is not required to make every Health lesson authentic.

Every reflection MUST declare:

- whether it is `PRIVATE_OPTIONAL`, `SHAREABLE_OPTIONAL`, or
  `BOUNDED_LEARNING_EVIDENCE`;
- who may see it;
- whether it is scored;
- what, if anything, may be retained; and
- an equal-credit non-personal alternative when it contributes to evidence.

`PRIVATE_OPTIONAL` reflection MUST be optional, ungraded, excluded from
completion and mastery, and unavailable to Tutor/guardian/adult scoring views.
The lesson may invite the learner to keep it privately, but may not request a
summary to prove it occurred.

`BOUNDED_LEARNING_EVIDENCE` may ask what fact, reasoning step, source check, or
support route the learner used. It MUST NOT require a personal health story or
treat a subjective opinion as automatically right or wrong.

No reflection may pressure disclosure by saying “be honest,” “tell what really
happened,” “share if comfortable,” or equivalent when the lesson can use a
fictional or generalized response.

## 13. Age and language policy

Age appropriateness is a combined judgment about language, topic framing,
concept demand, emotional burden, number of decisions, independence, and adult
context. A readability formula is advisory only.

| Dimension | Grades 3–5 | Older learners, Grades 7–12 |
| --- | --- | --- |
| Directions | One visible action at a time; usually one short sentence per step | Ordered multi-step directions are acceptable, but safety and privacy actions remain separate and visible |
| Explanation | Concrete examples, literal language, short cause/effect chains, and an immediate check | Increasingly layered systems, uncertainty, source quality, tradeoffs, and long-term consequences may be taught explicitly |
| Vocabulary | Introduce a small set of essential terms; define immediately and revisit through examples/non-examples | Retain accurate disciplinary terms; define new or easily confused terms and distinguish public meaning from clinical meaning |
| Scenarios | Short fictional cases with few people, stated choices, and an obvious trusted-adult route | More complex fictional/public cases may include competing constraints, media/source evaluation, systems, consent, advocacy, and conditional decisions |
| Guided reasoning | Offer concrete choices or sorting before open explanation; use frequent checks | Ask learners to identify assumptions, compare evidence, explain uncertainty, and defend a conditional response |
| Independent evidence | One bounded decision or concept application plus one reason and safe/support step | Multi-part analysis, communication, source evaluation, or plan is acceptable when chunked and privacy-safe |
| Sensitive context | Trusted adult is named plainly; avoid asking learners to imagine responsibility beyond their role | Teach increasing self-advocacy while preserving guardian, clinician, emergency, and legal/school authority boundaries |
| Learner load | Avoid stacking several new terms, long prose, emotionally intense context, and extended writing in one turn | Longer authentic sources may be used with navigation, chunking, and burden review; maturity is not a license for forced disclosure |

Within the older band, grades 7–8 SHOULD receive more concrete scaffolding and
fewer interacting constraints than grades 9–12. High-school lessons MAY address
more complex systems and adult-transition decisions, but they MUST remain
educational and non-diagnostic and MUST NOT require real personal health plans.

## 14. Health safety, privacy, and dignity

### 14.1 Universal boundaries

Every Health lesson MUST:

- use respectful, neutral, non-shaming language;
- give a fictional, public, or generalized route for every sensitive prompt;
- identify when to pause and seek a trusted adult or qualified professional;
- distinguish education and communication practice from diagnosis or treatment;
- allow a learner to decline or change a sensitive response without academic
  penalty; and
- collect the least-sensitive evidence capable of establishing the learning.

No lesson, hint, feedback, reflection, project, or future Tutor route may
require or reward disclosure of:

- diagnoses, symptoms, treatment, medication, therapy, trauma, abuse, sexual
  history, substance use, eating behavior, self-harm, or family medical history;
- body weight, height, BMI, body-fat percentage, measurements, appearance,
  photographs, recordings, wearable exports, sleep logs, food logs, calorie
  counts, or fitness scores;
- family conflict, access to care, insurance, finances, immigration status,
  identity details, or other sensitive household circumstances; or
- another person's private health information.

If a learner independently raises a possible urgent safety concern, curriculum
must route the interaction to the approved trusted-adult/emergency policy. The
lesson and Tutor MUST NOT investigate, diagnose, promise confidentiality, or
conduct a clinical risk assessment beyond separately authorized safety policy.

### 14.2 Body, food, and disability dignity

Health content MUST NOT:

- use dieting, weight-loss, “ideal body,” calorie-target, weigh-in, body-shape,
  body-composition, appearance, or body-value language as a lesson goal or
  scoring criterion;
- label a learner, body, disability, food, household, or culture as good, bad,
  lazy, disciplined, clean, unhealthy, or worthy based on one trait or choice;
- prescribe movement, food, supplements, restriction, or body change to an
  individual learner; or
- infer health, effort, morality, or character from body size, ability,
  performance, access, or a response.

Lessons may teach nutrition concepts, access, patterns, media claims, or public
health recommendations when they use accurate, neutral, non-prescriptive
language and acknowledge context and variation. Scoring must assess the taught
concept and reasoning, never conformity to a body, food, or lifestyle ideal.

### 14.3 Adult and professional authority

Curriculum MUST identify the authority needed for safety-sensitive action. A
learner or Tutor may practice questions, interpret an approved fictional case,
or identify a support route. Only the appropriate guardian, trusted adult,
licensed/qualified professional, school authority, or emergency service may
make decisions reserved for that role.

The lesson MUST NOT direct a learner to start, stop, change, share, or recommend
medication or treatment; diagnose a condition; manage an emergency alone; or
override an existing guardian/professional safety plan.

## 15. Accessibility and response alternatives

Access support MUST preserve the Health concept while reducing incidental
reading, writing, sensory, motor, attention, language, or communication burden.
Permitted support may include read-aloud, audio, captions, visual structure,
plain-language restatement, vocabulary preview, chunking, extended time,
breaks, low-distraction presentation, text-to-speech, speech-to-text, typing,
handwriting, drawing, signing, selecting, or spoken response.

An alternate response earns equal credit when it demonstrates the same target
evidence. Needing an adaptation, translator, communication support, trusted
adult, or more time MUST NOT be scored as lower knowledge, effort, maturity, or
character.

Support MUST NOT reveal a protected conclusion, decisive reason, required
vocabulary use, or safety judgment the learner is meant to supply.

## 16. Future Tutor curriculum metadata and boundaries

This section defines curriculum metadata only. It does not implement Tutor V2,
model prompts, adaptive runtime, memory, scoring, or learner-state behavior.

Every future conforming lesson SHOULD expose a data-only manifest consistent
with the companion advisory schema. It should identify:

- stable concept, prerequisite, and misconception IDs;
- the primary and secondary Health lesson types;
- age-language policy and reading/response burden;
- approved explanation, vocabulary, model, scenario, and guided-work refs;
- independent evidence, protected authority, acceptable variation, and support
  effects on independence;
- remediation and fresh retry refs;
- mastery evidence forms and later retrieval/transfer refs;
- reflection classification and visibility;
- privacy, dignity, no-diagnosis, and safety/escalation policy refs; and
- guardian, trusted-adult, professional, or emergency authority boundaries.

A future Tutor MAY:

- explain approved Health content in clearer language;
- define approved vocabulary and check its use;
- cue attention to relevant fictional/public facts;
- model approved reasoning on a separate case;
- ask bounded questions and coach a learner's own reasoning;
- adapt instructional presentation or response mode without changing the
  construct; and
- route to an approved remediation, retry, pause, or adult handoff.

A future Tutor MUST NOT:

- diagnose, screen for, confirm, rule out, or imply a medical or mental-health
  condition;
- solicit sensitive personal disclosure to personalize teaching;
- provide individualized treatment, medication, diet, supplement, or exercise
  advice;
- write the protected response or reveal protected authority;
- treat private reflection as evidence or expose it to an adult view;
- certify a real-world action or physical completion;
- override guardian, trusted-adult, professional, emergency, safety, privacy,
  or accommodation authority; or
- invent missing instructional content, sources, models, scenarios, safety
  rules, or answer authority.

If required curriculum supply is missing or conflicting, the Tutor-ready state
is `BLOCKED_MISSING_CURRICULUM` or `BLOCKED_AUTHORITY_CONFLICT`; the Tutor does
not improvise a repair.

## 17. Draft conformance review

Automated checks MAY verify required fields, stable references, declared
reflection classes, forbidden-demand language, and separation of learner and
protected authority. They cannot establish teaching quality by themselves.

A human Director/reviewer MUST confirm that:

1. the primary type matches the central outcome;
2. the explanation is accurate, clear, and age-appropriate;
3. lesson-critical vocabulary is taught and checked;
4. a separate model makes the target reasoning visible;
5. decision scenarios are complete, fictional/public, safe, and non-diagnostic;
6. guided reasoning preserves a meaningful learner turn;
7. independent evidence is fresh, specific, minimally disclosive, and
   gradeable from lesson-specific authority;
8. remediation changes the teaching and ends in a fresh retry;
9. mastery excludes private reflection and uses later independent evidence;
10. reflection respects subjectivity, optionality, privacy, and visibility;
11. language, learner burden, and response modes fit the age band;
12. no shame, dieting/body-value language, diagnosis, or forced sensitive
    disclosure appears on any learner, Tutor, hint, project, or scoring path;
13. safety and adult/professional authority are explicit; and
14. future Tutor metadata is curriculum-only and contains no runtime claim.

A generic template can satisfy structural presence while failing this review.
Conformance therefore requires both deterministic validation and human
teaching-quality judgment.

## 18. Recommended next-wave Health Director sample

Recommended lesson: **`ma-g5-health-u01-l01` — “Launch and diagnostic:
dimensions of health.”**

Audit package:
`curriculum-production/final/health-physical-education/packages/health/grade-05/ma-g5-health-u01-l01.json`

Audit authority:
`curriculum-production/final/health-physical-education/scoring-guides/health/grade-05/ma-g5-health-u01-l01.json`

The audit selected this lesson because it represents the 252-lesson repair
cohort without depending on an edge-case topic. It contains substantive
teaching points, vocabulary, safe fictional reasoning, and remediation while
also exposing the cohort's main weaknesses: Grade 5 reading burden, generic
materials/task shells, ambiguous private-reflection mastery language, and no
fact-specific acceptable-answer or misconception authority.

The next wave SHOULD build one Director sample that demonstrates a simpler
explanation, explicit vocabulary check, separate model, guided-to-independent
reasoning, clean private-reflection boundary, fresh mastery evidence, and
Tutor-gradeable protected authority. This branch does **not** build or rewrite
that sample.

## 19. Adoption path

Before this draft becomes an enforced standard:

1. Health, curriculum, accessibility, safety/privacy, assessment, guardian-
   authority, and Tutor-contract owners review this document and schema.
2. The recommended sample is authored in the next wave and reviewed by the
   Director.
3. Advisory checks are tested against the sample plus meaningfully different
   Health lesson types to measure false positives and omissions.
4. Reviewers decide which rules become release-blocking and which remain human
   review criteria.
5. A versioned migration plan preserves existing safety and privacy strengths.
6. Full-corpus structural, checksum, safety, privacy, authority, readability,
   and depth evidence is rerun before any acceptance claim.

Until those steps occur, the correct status is **DRAFT**, and this document
does not authorize a curriculum rewrite or production admission change.

**Draft classification: HEALTH_LESSON_STANDARD_DRAFT_R1**
