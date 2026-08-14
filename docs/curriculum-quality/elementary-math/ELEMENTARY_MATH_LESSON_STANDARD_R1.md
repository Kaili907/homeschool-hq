# Manuel Academy Elementary Math Lesson Standard R1

Status: **DRAFT FOR DIRECTOR REVIEW**

Applies to: mathematics, Grades 3–5

Contract artifact: `ELEMENTARY_MATH_LESSON_CONTRACT_R1.schema.json`

Authoritative base for this draft: `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

## 1. Purpose and authority

This standard defines the curriculum supply required for a strong elementary
mathematics lesson. It does not define how many supplied items every learner
must complete.

This R1 document is a proposed authoring and review standard. It is not yet a
global release gate. Before mass application, one complete Grade 3 normal
concept lesson must be authored against this standard and approved by the
Director.

The words **must**, **should**, and **may** have these meanings:

- **Must** is required for R1 conformance unless a phase contract explicitly
  says otherwise.
- **Should** is the expected default. A reviewer may accept a documented,
  mathematically sound exception.
- **May** is optional.

## 2. Boundaries

This standard owns curriculum content and curriculum metadata only. It does
not change Study Engine, Tutor V2 runtime, provider selection, Tutor memory,
hint execution, misconception routing, scoring runtime, dashboard, Jarvis, or
learner UI.

The curriculum supplies content. Study and Tutor runtimes decide what to
present, when to present it, and what evidence is sufficient under their own
approved policies. Curriculum metadata may name content, prerequisites,
misconceptions, supports, and policy references. It must not grant answer
authority or prescribe an AI decision.

## 3. Authored supply and learner path

The authored package and the learner path are deliberately different.

| Layer | Owns | Does not own |
| --- | --- | --- |
| Curriculum | Explanations, examples, item banks, protected adult key, content relationships, and policy references | Adaptive selection, session length, mastery state, or Tutor decisions |
| Study/Tutor runtime | Selection, ordering within allowed policy, pacing, retries, help use, and evidence collection | Inventing missing curriculum depth or changing protected answers |

A normal lesson therefore contains 10–12 independent items even when Study
initially presents, for example, six. Strong independent performance may lead
the runtime to mastery evidence. Repeated errors or heavy help may lead the
runtime to unused bank items or remediation. Those are examples of possible
adaptive use, not curriculum-authored routing commands.

Changing the learner quantity must not remove the lesson's concept coverage.
An adaptive subset should preserve the intended mix of skill, application, and
reasoning evidence.

## 4. Shared lesson package contract

Every lesson package has four layers.

### 4.1 Identity and intent

The package must declare:

- one stable `lesson_id`;
- `grade`, `subject`, and `lesson_kind`;
- one clear learning goal, or one clear evidence purpose for a diagnostic;
- standards references;
- target `concept_ids` and any `prerequisite_concept_ids`;
- the R1 contract version.

The learning goal describes what the learner will understand or do. It is not
a list of curriculum-production tasks.

### 4.2 Learner content

Learner content contains teaching blocks, worked examples, unscored or scored
item prompts, and the presentation order. It uses child-facing titles such as:

- Learn
- Example
- Let's Try One
- Your Turn
- Check What You Know
- Need Help?
- Take a Break
- Save for Later

These titles are presentation guidance. Internal authoring names such as
`independent_item_refs` must not be shown to a child.

### 4.3 Protected adult content

Every scored item must have one protected adult-key entry. The entry includes
an acceptable answer, reasoning or solution path, scoring guidance when a
judgment is required, and relevant misconception identifiers.

Protected answers must not enter the learner projection. A worked example is
the exception by design: its steps and final answer are learner-facing because
the purpose is to teach, not to collect independent evidence.

### 4.4 Curriculum-side Tutor readiness

The package may expose the data-only manifest defined in Section 12. That
manifest identifies available content and registered policy references. It
does not implement a Tutor Action API, a decision engine, memory, hint logic,
misconception logic, an AI provider, or scoring.

## 5. Lesson phase contract

Lesson kind is an explicit contract, not a title inferred by the runtime.

| Lesson kind | Primary purpose | Teaching before target evidence |
| --- | --- | --- |
| `NORMAL_CONCEPT_LESSON` | Teach a new or substantially new concept, then gather practice evidence | Required and substantial |
| `DIAGNOSTIC` | Find what the learner already knows and where support may begin | Prohibited for the exact measured skill |
| `REVIEW` | Reconnect and interleave previously taught learning | Brief refresh is allowed |
| `REMEDIATION` | Repair one identified prerequisite gap or misconception | Explicit, narrow reteaching is required |
| `MASTERY` | Gather fresh independent evidence for a focused concept | No new teaching of the measured target before evidence |
| `ASSESSMENT` | Gather protected evidence across an approved blueprint | No preteaching of assessed answers or exact items |

### 5.1 Normal concept lesson

A conforming `NORMAL_CONCEPT_LESSON` must supply:

- one clear learning goal;
- 2–3 short teaching blocks;
- at least three fully worked examples;
- 4–6 guided-practice items;
- 10–12 independent-practice items;
- 4–5 mastery-check items;
- 4–6 remediation items;
- 1–2 optional challenge items; and
- a complete protected adult key for every scored item.

The normal order is goal, teaching, worked examples, guided practice,
independent practice, and mastery check. Remediation and challenge are
available branches, not required detours in every learner path. Teaching and
worked examples must appear before independent evidence.

At least one teaching block must explain the meaning of the concept. A lesson
cannot consist only of a procedure. At least one block or example must connect
the procedure to a representation or explain why it works when such a
representation is instructionally useful.

### 5.2 Diagnostic

A conforming `DIAGNOSTIC` must:

- state a neutral evidence purpose, such as “Show what you already know”;
- supply 5–8 diagnostic items for a focused concept or entry decision;
- sample prerequisites separately from the target when prerequisites matter;
- use enough variety to distinguish a slip from a stable misunderstanding;
- contain no worked example, hint, vocabulary explanation, formula reminder,
  or procedure that teaches the exact target before its evidence is collected;
- avoid marking a learner as mastered from one correct response; and
- include protected answers and misconception mappings.

Directions may explain how to respond. They must not explain how to solve the
measured mathematics. Teaching or remediation may be linked after the
diagnostic, but it is not part of the pre-evidence diagnostic package.

### 5.3 Review

A conforming `REVIEW` must:

- name one review goal;
- use 1–2 brief teaching or retrieval blocks;
- include 1–2 worked examples only where a reconnect is needed;
- supply 3–5 guided or collaborative items;
- supply 6–10 independent, interleaved items;
- supply 3–5 fresh check items;
- make 2–4 targeted support items available; and
- optionally supply up to two challenge items.

Review must combine previously taught ideas in a purposeful way. A set of
unrelated questions or ten number swaps is not a review lesson. The review
should include retrieval plus at least one connection, comparison, or mixed
application.

### 5.4 Remediation

A conforming `REMEDIATION` must focus on one named prerequisite gap or one
observable misconception. It must:

- state one small, attainable goal;
- use 2–3 short reteaching blocks;
- include 2–3 fully worked examples, with a correct/incorrect contrast when it
  clarifies the misconception;
- supply 4–6 supported remediation items;
- supply 4–6 fresh independent retry items;
- supply 3–4 fresh mastery-check items; and
- optionally supply one challenge or transfer item.

Remediation is different instruction, not merely more of the item that failed.
It should reduce the conceptual step, change representation, contrast the
error with the correct idea, and then rebuild independence. Language must be
neutral and non-shaming.

### 5.5 Mastery

A conforming `MASTERY` lesson is a focused evidence event. It must:

- name the concept being checked;
- supply 4–5 fresh, independently answerable mastery items;
- include more than one item form and at least one reasoning, representation,
  or application item when appropriate;
- use numbers or contexts not copied from teaching examples;
- keep answers, solution cues, and correctness markers out of the attempt;
- include a complete protected adult key; and
- defer any worked teaching of the target until after the evidence event.

Mastery content supplies evidence. The mastery runtime and applicable Academy
policy decide whether that evidence changes mastery state.

### 5.6 Assessment

A conforming `ASSESSMENT` must follow an approved blueprint. It must:

- identify the standards and concepts sampled by each item;
- state the response and scoring expectations without giving solution cues;
- contain enough items for each reported claim to have more than one evidence
  point, unless the approved blueprint explicitly documents a performance task
  exception;
- include direct, application, and reasoning evidence across the assessment
  when the assessed standards support those forms;
- keep scoring interpretation and answers in the protected projection;
- use fresh prompts rather than copies of practice; and
- provide accommodations that preserve the assessed construct.

The draft schema allows 8–30 assessment items, but the approved blueprint—not
that broad technical range—determines the right assessment length. Assessment
results must not be inferred from worked examples or supported practice.

## 6. Language standard for Grades 3–5

### 6.1 Rules for every grade

Learner-facing prose must:

- use concrete, direct language;
- give one direction at a time unless two actions are inseparable;
- explain new math vocabulary immediately;
- put the important number, digit, sign, unit, or relationship near the
  sentence that explains it;
- use step-by-step explanations;
- use short paragraphs and useful white space;
- distinguish a relevant digit or symbol with text as well as visual emphasis;
- use respectful, non-shaming feedback; and
- keep internal production and engineering language out of learner content.

Learner content must not use these as internal labels: “instructional
material,” “diagnostic evidence,” “segment,” “status: active,” “response kind,”
“mastery state,” “advisory only,” “authority,” or “scoring mode.” A term may
appear only when it has a legitimate child-facing meaning in context.

The learner should see “Look at the **4** in 647. It is in the tens place,” not
“Attend to the relevant place-value feature.” Emphasis must not rely on color
alone.

### 6.2 Grade 3

Grade 3 prose must use short sentences and familiar, concrete contexts. Most
sentences should express one idea. Directions should usually contain one
action. New vocabulary should be defined in the next phrase or sentence.

Preferred pattern:

1. Name what to notice.
2. Show one step.
3. Explain why that step works.
4. Show the answer and its unit.

As advisory review signals, aim for an average of about 12 words per sentence
and investigate sentences longer than 20 words. These numbers are not a sole
gate. Necessary math words, numerals, equations, and units distort mechanical
readability measures.

### 6.3 Grade 4

Grade 4 prose may connect two closely related steps, but directions should
remain easy to scan. Define new vocabulary when it first appears. Paragraphs
should usually contain no more than three short sentences. Ask the learner to
name a relationship, compare strategies, or justify one step without requiring
unnecessarily formal prose.

As advisory review signals, aim for an average of about 14 words per sentence
and investigate sentences longer than 24 words. Human review decides whether
the mathematics remains clear.

### 6.4 Grade 5

Grade 5 prose may use longer multi-step explanations and established math
vocabulary. It must still chunk the work, define genuinely new terms, and make
the relationship between steps explicit. A learner may be asked to compare,
generalize, or defend a method, but the prompt should say exactly what evidence
to give.

As advisory review signals, aim for an average of about 16 words per sentence
and investigate sentences longer than 28 words. A readability score never
overrides mathematical accuracy or a successful child-facing review.

## 7. Teaching-block standard

A teaching block is a short explanation of one connected idea. It should have
a child-facing title, 1–4 short explanation steps, and an optional accessible
representation. A block must do at least one of these jobs:

- build meaning;
- connect a representation to notation;
- explain a procedure and why it works; or
- contrast a common error with the target idea.

Repeating the learning goal does not count as teaching. Directions to “solve”
or “try” do not count as an explanation.

## 8. Worked-example standard

Every worked example must include:

- a clear problem;
- the concept, feature, or relationship to notice;
- ordered work steps;
- an explanation of why each material step is valid;
- a final answer, including the unit when needed; and
- a reasonableness check when useful.

The normal concept lesson's examples must cover at least these roles:

1. **Basic/easy:** isolates the new idea with simple numbers.
2. **Normal grade-level:** uses the expected grade-level demand.
3. **Application or contrasting case:** uses a word problem, a representation,
   an error comparison, or a case where a tempting method does not work.

For example, “Round 647 to 600” is answer-only and fails this standard. A
conforming example identifies the hundreds being rounded to, points to the
tens digit, explains the 0–4 or 5–9 decision, shows the changed digits, and
states why 600 is the nearest hundred.

Use a number line, place-value decomposition, diagram, table, model, or other
representation when it makes the mathematics clearer. No single
representation is required in every lesson.

## 9. Practice standard

### 9.1 Guided practice

Guided items must invite learner work, not merely repeat another example. The
support may identify what to notice, split a problem into steps, offer a
representation, or ask a focused question. Across the set, prompts should fade
toward independence.

The protected key records the intended support and the full solution. Learner
content must not reveal the response before an attempt when the item is being
used as evidence.

### 9.2 Independent practice

The normal 10–12 item bank must contain purposeful variety where the concept
supports it. It should include at least four applicable forms from this list:

- direct skill;
- word or real-world application;
- reasoning;
- error analysis;
- mixed review;
- representation; and
- explain-your-thinking.

Direct skill, an application, and reasoning or error analysis are required for
a normal concept lesson. A representation or explanation item is required
when it can validly measure the target.

Items that differ only by superficial number substitution do not establish
variety. Exact duplicates, equivalent prompts with renamed objects, or repeated
templates with no new reasoning demand count once for depth review.

### 9.3 Remediation and challenge banks

Remediation items must address declared `misconception_ids` or
`prerequisite_concept_ids`. They should use smaller steps, a different
representation, a contrast, or a clearer context. They are not simply easier
copies of independent items.

Challenge items are optional for the learner. They extend reasoning,
representation, constraint, or application. They must not be required to prove
on-grade-level mastery.

## 10. Mastery-check detail

The normal mastery bank contains 4–5 fresh items. Together they must:

- cover the stated learning goal;
- sample the core procedure or concept at least twice without duplicating a
  template;
- include at least one application, representation, reasoning, or error-analysis
  item when appropriate;
- be independently answerable without a preceding solution cue;
- avoid answers or near-answers in titles, hints, feedback, filenames, or
  metadata projected to the learner; and
- map every item to protected answer and reasoning material.

The check is not valid independent evidence if the learner is shown the same
worked solution, receives step-completing help, or copies an answer during the
attempt. Runtimes may record help use; this document does not implement that
recording or decide the resulting mastery state.

## 11. Adult-key and answer-separation standard

The protected adult key must cover every diagnostic, guided, independent,
mastery, remediation, challenge, and assessment item that can be scored or
reviewed. Each entry contains:

- `item_ref`;
- one exact answer or a bounded set of acceptable answers;
- reasoning or a solution path;
- scoring guidance for constructed responses; and
- applicable `misconception_ids`.

An adult key may accept multiple methods. It must state what mathematical
evidence makes a response acceptable. “Answers will vary” without criteria is
not a complete key.

Answer-leakage review compares protected answers with learner prompts,
directions, feedback, metadata, and choices. The check must distinguish a
legitimate unmarked multiple-choice option and a learner-facing worked example
from a leaked marked answer.

## 12. Curriculum-side Tutor manifest draft

R1 follows the repository's current authoring conventions: snake_case names,
stable IDs, `_ref`/`_refs` relationships, protected scoring content, and
controlled data-only Tutor routes.

The draft manifest fields are:

| Field | Meaning |
| --- | --- |
| `lesson_id` | Stable lesson identity |
| `lesson_kind` | One of the six phase contracts |
| `standard_refs` | Existing curriculum standard-reference objects |
| `concept_ids` | Concepts directly taught or measured |
| `prerequisite_concept_ids` | Smallest concepts needed before the target |
| `misconception_ids` | Registered observable error patterns relevant to this content |
| `worked_example_refs` | Available teaching examples |
| `diagnostic_item_refs` | Pre-instruction evidence items |
| `guided_item_refs` | Supported practice items |
| `independent_item_refs` | Independent practice supply |
| `mastery_item_refs` | Fresh focused evidence items |
| `remediation_item_refs` | Targeted support items |
| `assessment_item_refs` | Blueprint-owned assessment items |
| `challenge_item_refs` | Optional extension items |
| `hint_policy_ref` | Reference to an approved hint policy; not executable hint logic |
| `answer_policy_ref` | Reference to approved answer-handling policy; not answer authority |
| `age_policy_ref` | Reference to an approved age/language policy |
| `allowed_instructional_supports` | Supports for which the curriculum has usable content |
| `tutor_routes` | Optional existing controlled `signal`, `strategy`, and data-only `parameters` records |

All refs must resolve within the authoring set or an approved registry. Every
ref array must be unique. The manifest lists supply; it does not require the
runtime to present every ref.

`answer_policy_ref` cannot override the schema-set policy invariant that
curriculum does not reveal answers, give final graded answers, or control
graded-work policy. Any future Tutor V2 adapter must retain that authority
boundary.

## 13. Machine-readable draft contract

`ELEMENTARY_MATH_LESSON_CONTRACT_R1.schema.json` is a Draft 2020-12 JSON Schema
for a future lesson package. It encodes phase values, structural separation,
normal-lesson counts, phase-specific draft ranges, worked-example structure,
item kinds, protected adult-key entries, and the Tutor manifest shape.

The schema is a design artifact. It is not wired into Curriculum Studio,
release admission, Study Engine, or Tutor V2. It also cannot by itself prove
semantic properties such as “this explanation is mathematically correct” or
“this diagnostic preteaches the exact target.” Those require the semantic
checks and human review below.

## 14. Quality gate draft

Gate mode for R1 is `ADVISORY_DRAFT`. Findings appear in a lesson review
report. They do not block the global release until the Director approves the
standard, the Grade 3 sample, thresholds, exceptions, and rollout plan.

Proposed severities:

- `DRAFT_ERROR`: the package cannot claim R1 conformance.
- `REVIEW_WARNING`: a human must accept or correct the finding.
- `ADVISORY_METRIC`: evidence only; never the sole accept/reject rule.

| Check ID | Detection | Draft severity |
| --- | --- | --- |
| `EM-STRUCT-001` | Phase-specific teaching, example, or bank counts outside the R1 range | `DRAFT_ERROR` |
| `EM-EXAMPLE-001` | Too few worked examples or missing basic/grade-level/application-or-contrast roles in a normal lesson | `DRAFT_ERROR` |
| `EM-EXAMPLE-002` | Worked example lacks concept notice, ordered work, why explanations, or final answer | `DRAFT_ERROR` |
| `EM-GUIDED-001` | Too little guided work or no support fading | `DRAFT_ERROR` for count; `REVIEW_WARNING` for fading |
| `EM-INDEPENDENT-001` | Thin independent bank or missing required item-form variety | `DRAFT_ERROR` |
| `EM-MASTERY-001` | Thin mastery check, duplicate template, copied teaching item, or missing independent form | `DRAFT_ERROR` |
| `EM-REMEDIATION-001` | Missing remediation supply or no link to a prerequisite/misconception | `DRAFT_ERROR` |
| `EM-EXPLAIN-001` | Learning goal is followed by directions/practice but no substantive explanation | `DRAFT_ERROR` |
| `EM-LANGUAGE-001` | Learner content contains internal/developer labels without legitimate child-facing meaning | `DRAFT_ERROR` |
| `EM-LANGUAGE-002` | Dense paragraphs, stacked directions, undefined first-use vocabulary, or unclear referents | `REVIEW_WARNING` |
| `EM-READABILITY-001` | Grade-specific sentence/paragraph metrics | `ADVISORY_METRIC` |
| `EM-DUPLICATE-001` | Exact normalized duplicate or high-similarity prompt/template with no changed reasoning demand | `DRAFT_ERROR` for exact; `REVIEW_WARNING` for fuzzy |
| `EM-ANSWER-001` | Protected answer, correctness marker, or solution cue leaked into a scored learner attempt | `DRAFT_ERROR` |
| `EM-KEY-001` | Scored item missing adult key, acceptable answer, reasoning, or constructed-response criteria | `DRAFT_ERROR` |
| `EM-REF-001` | Missing, duplicate, wrong-kind, or unresolved item/content/policy ref | `DRAFT_ERROR` |
| `EM-DIAGNOSTIC-001` | Exact measured skill is taught or its answer is cued before diagnostic evidence | `DRAFT_ERROR` |
| `EM-ORDER-001` | Normal lesson requests independent evidence before substantive teaching | `DRAFT_ERROR` |
| `EM-VARIETY-001` | Nominal variety is only superficial number/object substitution | `REVIEW_WARNING` |
| `EM-MATH-001` | Prompt, worked solution, answer, unit, or rationale is mathematically inconsistent | `DRAFT_ERROR` |

### 14.1 Automated implementation outline

The future checker should:

1. Validate the package against the JSON Schema.
2. Build typed maps of examples, items, policies, and adult-key entries.
3. Resolve every ref and compare manifest refs with bank refs.
4. Check phase counts, roles, required fields, and presentation order.
5. Normalize prompts for exact duplicates, then run token/template similarity
   as a warning that requires human confirmation.
6. Compare protected answers and rationale phrases with learner attempt text,
   excluding declared worked examples and unmarked choice membership.
7. Scan learner prose for internal labels, stacked imperatives, undefined
   vocabulary candidates, dense paragraphs, and grade-level advisory metrics.
8. Produce a per-finding path, check ID, severity, evidence snippet, and
   suggested review action.

Automated language heuristics must never be the sole gate. Human reviewers
must examine mathematical vocabulary, equations, representations,
accessibility, cultural/context clarity, and child comprehension.

### 14.2 Human review required

Automation cannot finally decide whether:

- an explanation builds the right mental model;
- a “why” statement is mathematically sufficient;
- an item set has genuine cognitive variety;
- a representation is helpful and accessible;
- a diagnostic preteaches the exact construct;
- remediation matches the observed misconception; or
- prose is truly understandable to children in the intended grade.

Those are required review questions, not reasons to omit automated evidence.

## 15. Director approval and rollout

R1 remains a draft until all of these occur:

1. Author one complete Grade 3 `NORMAL_CONCEPT_LESSON` against this contract.
2. Run the draft structural and semantic checks on that sample.
3. Conduct mathematical, language, accessibility, adult-key, and learner-path
   review.
4. Obtain Director approval or record revisions.
5. Version the approved contract and gate policy.
6. Plan a bounded curriculum migration with diff review and rollback.

No bulk rewrite should begin from this draft. Existing curriculum and runtimes
remain unchanged.

## 16. R1 conformance checklist

A reviewer may classify a lesson `R1_CONFORMING_DRAFT` only when:

- the declared phase contract is satisfied;
- learner language follows the applicable grade rules;
- examples show thinking and why, not answers only;
- practice and mastery banks have adequate depth and variety;
- remediation and optional challenge supply are appropriate to the phase;
- all refs resolve;
- every scored item has a complete protected adult key;
- no protected answer leaks into an evidence attempt;
- curriculum-side Tutor metadata remains data-only; and
- human mathematical and child-facing review is complete.
