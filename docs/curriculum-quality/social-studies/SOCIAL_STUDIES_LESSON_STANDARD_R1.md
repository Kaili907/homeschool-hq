# Manuel Academy Social Studies Lesson Standard R1

Status: **DRAFT FOR DIRECTOR REVIEW**

Applies to: Social Studies lesson authoring for the active Manuel Academy
Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12 population

Contract artifact: `SOCIAL_STUDIES_LESSON_CONTRACT_R1.schema.json`

Authoritative base for this draft:
`56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

Proposed first Director sample: `ma-g5-social-studies-u08-l03`

## 1. Purpose and authority

This standard defines the curriculum supply required for a strong,
learner-ready Social Studies lesson. It is type-aware: the background,
explanation, modeling, sources, practice, evidence, and reteaching must fit the
lesson's actual instructional and disciplinary purpose.

This R1 document is a proposed authoring and review standard. It is not a
global release gate, and it does not make any existing lesson conforming. The
mission input reports that 972 of 972 active Social Studies lessons fail the
proposed full learner-depth standard. No bulk rewrite is authorized by this
document.

The words **must**, **should**, and **may** have these meanings:

- **Must** is required for R1 draft conformance unless a type contract says it
  is not applicable and the author records why.
- **Should** is the expected default. A reviewer may accept a documented,
  instructionally sound exception.
- **May** is optional.

This standard does not create, interpret, or replace Michigan standards. A
lesson may carry only standards references already held in canonical Academy
custody or references verified and accepted through the curriculum standards
workflow. A legacy label stays labeled as legacy or unverified until a human
authority resolves it.

## 2. Boundaries

This standard owns curriculum content and curriculum-side metadata only. It
does not modify or define Study Engine, Tutor V2 runtime, provider behavior,
Tutor memory, scoring runtime, Dashboard, learner UI, or release activation.

| Layer | Owns | Does not own |
| --- | --- | --- |
| Curriculum | Accurate explanations, source bindings, models, task supply, protected adult authority, prerequisite and error metadata, policy references | Adaptive selection, session state, runtime mastery decisions, or fabricated instructional content |
| Study/Tutor runtime | Presentation and support decisions within approved policy, evidence collection, and runtime state | Inventing historical facts or sources, filling curriculum gaps, changing protected answers, or writing graded learner work |
| Adult authority | Source approval where required, protected scoring judgment, and approved exceptions | Silent replacement of canonical standards, invented provenance, or completion of the learner's argument |

Curriculum metadata may describe what help is available. It must not grant an
AI permission to reveal protected answers, fabricate context, invent a source,
or complete a graded claim.

## 3. Repository-derived baseline

The R1 taxonomy is grounded in the repository rather than in mathematics
lesson counts.

- The production Social Studies tree contains 972 lesson packages: 108 each
  for Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12.
- The packages repeat 12 authored phases, 81 lessons per phase: Launch and
  diagnostic; Concept model A; Guided practice A; Independent application A;
  Concept model B; Guided practice B; Investigation or close reading; Reteach
  and varied practice; Performance task build; Synthesis and review; Unit
  assessment; and Correction and reflection.
- Every inspected production package uses the same eight numbered section
  headings. A recurring shell can help custody, but the shell is not evidence
  of type-appropriate teaching depth.
- Repository topics span historical chronology, geography and map use,
  government and citizenship, economics, primary and secondary sources,
  comparison and perspective, claims and evidence, quantitative analysis,
  historiography, research, deliberation, and civic action.
- Current source-readiness artifacts distinguish pinned static sources from
  dynamically attached sources and prohibit invented source metadata. R1
  preserves that custody model.

The recurring phase remains useful authoring metadata, but it is not a Social
Studies lesson type by itself. “Guided practice A” does not say whether the
learner is reading a map, building historical context, comparing accounts, or
reasoning from a primary source.

## 4. Type system

R1 represents lesson type as a tuple:

`instructional_purpose + one or more disciplinary_modes + authored_phase`

This avoids forcing unlike dimensions into one enum. A lesson has exactly one
primary instructional purpose and one or more disciplinary modes. A secondary
purpose may be declared only when it materially changes the contract.

### 4.1 Instructional purpose

| Value | Primary purpose |
| --- | --- |
| `DIAGNOSTIC` | Collect neutral entry evidence before teaching the exact measured target |
| `BACKGROUND_CONTENT_BUILD` | Build the knowledge, language, chronology, and setting needed for later reasoning |
| `GUIDED_PRACTICE` | Practice a taught skill with visible support that fades |
| `INDEPENDENT_APPLICATION` | Apply prior instruction without answer-producing support |
| `REVIEW` | Retrieve, reconnect, and interleave previously taught knowledge and skills |
| `REMEDIATION` | Repair a named prerequisite gap or observable error with different instruction |
| `MASTERY` | Collect fresh, focused, independent evidence after instruction |
| `ASSESSMENT` | Collect protected evidence against an approved blueprint |
| `PROJECT_INQUIRY` | Sustain a question, investigation, product, deliberation, or civic action through checkpoints |

### 4.2 Disciplinary mode

| Value | What it distinguishes |
| --- | --- |
| `GEOGRAPHY_MAP_SKILL` | Location, region, movement, spatial pattern, scale, map, or geospatial reasoning |
| `HISTORY_CHRONOLOGY` | Sequence, periodization, context, continuity/change, cause/effect, and historical significance |
| `CIVICS_GOVERNMENT` | Institutions, authority, rights, responsibilities, policy, public issues, and civic participation |
| `ECONOMICS` | Scarcity, choice, incentives, markets, tradeoffs, indicators, systems, and policy consequences |
| `PRIMARY_SOURCE_ANALYSIS` | Evidence created at or near the time, or by a direct participant, analyzed in context |
| `SECONDARY_SOURCE_ANALYSIS` | Later interpretation, synthesis, reporting, scholarship, or reference material analyzed as such |
| `COMPARE_PERSPECTIVE` | Comparison across defined dimensions and historically grounded perspectives |
| `CLAIM_EVIDENCE_REASONING` | A defensible claim connected to specific evidence by explicit reasoning |
| `QUANTITATIVE_DATA_ANALYSIS` | Tables, graphs, statistics, datasets, uncertainty, and honest representation |
| `RESEARCH_SOURCE_CRITICISM` | Research design, provenance, corroboration, historiography, verification, and citation |
| `DELIBERATION_CIVIC_ACTION` | Public discourse, counterargument, lawful action, reflection, and evidence of outcomes |

`BACKGROUND_CONTENT_BUILD`, `REVIEW`, `REMEDIATION`, `MASTERY`,
`ASSESSMENT`, and `PROJECT_INQUIRY` are distinguished by instructional
purpose. Geography, history, civics, economics, source type, comparison, and
claim-evidence reasoning are distinguished by disciplinary mode. A source
comparison lesson can therefore be typed accurately as, for example,
`GUIDED_PRACTICE + PRIMARY_SOURCE_ANALYSIS + SECONDARY_SOURCE_ANALYSIS +
COMPARE_PERSPECTIVE + CLAIM_EVIDENCE_REASONING`.

### 4.3 Type declaration rules

- Type is declared by the author and confirmed by human review. A runtime must
  not infer it from the title alone.
- Each declared mode creates obligations in Sections 7–11. Unused modes must
  not be added merely to look comprehensive.
- A source can be a teaching support without making source analysis the target.
  Declare a source-analysis mode only when the learner must reason about or
  from the source.
- “Integrated” is not a substitute for specific modes. Declare each material
  mode in an integrated lesson.
- The authored repository phase is retained separately so future migration
  can map the current 12-phase sequence without pretending phase and type are
  synonymous.

## 5. Shared learner-ready package

Every lesson package must provide the following, with depth adjusted by type:

1. Stable identity, grade, subject, type tuple, authored phase, learning goal,
   and canonical or honestly unresolved standards references.
2. Stable topic and skill identifiers plus the prerequisite knowledge the
   learner actually needs.
3. Background knowledge sufficient to begin the work without guessing major
   historical, geographic, civic, or economic context.
4. Learner-facing vocabulary support for necessary unfamiliar terms.
5. A context frame that answers the applicable questions: who, where, when,
   under what conditions, and why this matters.
6. Chronology, maps, timelines, diagrams, tables, data displays, or other
   representations when they materially improve understanding, with an
   accessible text alternative.
7. A modeled analysis when the target asks the learner to perform unfamiliar
   disciplinary thinking.
8. Guided practice where the purpose calls for instruction with support.
9. Independent work that requires the learner—not the prompt—to supply the
   central evidence or reasoning.
10. Fresh mastery evidence appropriate to the target, except before-instruction
    diagnostics. Assessment evidence follows its approved blueprint.
11. A remediation path that names an observable error, provides different
    instruction or a different model, and ends in fresh evidence. A diagnostic
    or assessment instead identifies the approved follow-up content or policy;
    it does not embed reteaching inside the protected evidence event.
12. A complete protected adult authority for every scored or judged task.
13. Curriculum-side Tutor metadata that resolves to accepted content and
    policies and grants no runtime or answer authority.

A paragraph followed by questions is not automatically a lesson. Directions,
learning objectives, rubrics, and generic source-record fields do not count as
background teaching or modeling.

## 6. Background, vocabulary, and context standard

### 6.1 Background knowledge

The lesson must explicitly teach or retrieve the smallest body of knowledge
needed for the target. Background must be accurate, coherent, age-appropriate,
and traceable to accepted lesson or source material.

For a historical topic, background normally includes the setting, the actors
or groups, the relevant earlier conditions, and the event or problem under
study. For civics and economics, it normally includes the institution,
process, authority, incentives, constraints, or system needed to understand
the question. The learner must not be expected to infer this context from a
thin paragraph and then produce an evidence-based answer.

Each background block must declare why the knowledge is needed and which
accepted source references support factual claims. Common knowledge still
requires editorial accuracy; “common” is not permission for Tutor fabrication.

### 6.2 Vocabulary

Vocabulary support must:

- identify the terms that are necessary to understand the teaching, source,
  map, data display, or task;
- give a clear learner-facing definition at first meaningful use;
- distinguish everyday and disciplinary meanings when they differ;
- provide an example, non-example, word part, pronunciation, or visual only
  when it improves understanding; and
- avoid a detached glossary that the learner must search while reading.

Names, dates, and every familiar word do not need glossary entries. Technical
terms cannot be removed when the standard requires them; they must be taught.

### 6.3 Chronology and context

When time is material, the lesson must locate the topic on an age-appropriate
chronology and explain relationships such as before/after, duration,
overlap, cause/effect, continuity/change, or periodization. A timeline is
instructional only if the learner is shown how its entries relate to the
question; decorative dates do not satisfy the requirement.

When place or spatial pattern is material, the lesson must orient the learner
with a map or accessible spatial explanation. Maps must identify their title,
creator or responsible organization, date or represented period, legend or
key where needed, scale where needed, and source. The lesson must teach how to
read the relevant feature rather than merely display the map.

If chronology or geography is not applicable, the author records a short
reviewer-facing reason. “No media available” is not an instructional reason.

## 7. Type-specific teaching standard

### 7.1 Background/content build

A `BACKGROUND_CONTENT_BUILD` lesson must:

- organize knowledge around a clear question or explanatory problem;
- teach enough connected content to make later analysis possible;
- define necessary vocabulary in context;
- establish chronology and place when applicable;
- distinguish fact, supported inference, and interpretation;
- model at least one way historians or social scientists organize or explain
  the content; and
- end with independent evidence that asks the learner to explain a
  relationship, sequence, cause, significance, or example—not only repeat a
  sentence.

Content coverage is not measured by paragraph count. A short, well-chunked
set of connected explanations may be stronger than a long survey passage.

### 7.2 Geography/map skill

A lesson declaring `GEOGRAPHY_MAP_SKILL` must:

- supply a real, attributable map, dataset, or Academy-authored representation;
- identify which map elements matter for the task, such as title, legend,
  symbols, direction, scale, projection, boundary, date, or data class;
- model how to move from a map feature to a spatial observation and then to a
  supported conclusion;
- include guided interpretation of a feature not already solved by the model;
- include independent work using a fresh map, layer, location, or spatial
  relationship; and
- provide alt text or a long description that preserves the evidence needed
  for the target.

A text-only equivalent may replace a visual when it preserves the construct.
If interpreting the visual is itself the standard, an accommodation must
preserve that skill rather than silently replacing it.

### 7.3 History/chronology

A lesson declaring `HISTORY_CHRONOLOGY` must:

- anchor the learner in time and place before analysis;
- identify relevant actors and conditions without treating a group as a single
  undifferentiated viewpoint;
- distinguish sequence from causation;
- model one applicable move such as sequencing, contextualizing, tracing
  continuity/change, weighing causes, or evaluating historical significance;
- require independent reasoning from chronology or evidence; and
- avoid presentism by helping the learner understand the historical context
  without excusing injustice or denying human dignity.

### 7.4 Civics/government

A lesson declaring `CIVICS_GOVERNMENT` must:

- accurately name the institution, level, jurisdiction, role, process, or
  authority being studied;
- distinguish a legal rule, institutional practice, historical claim, policy
  proposal, and personal opinion;
- use current claims only from accepted, reviewable authority and identify
  historical claims as historical;
- model how to trace a decision, compare institutional roles, interpret a
  civic source, or evaluate a public claim; and
- use safe, lawful, optional civic participation. A learner must not disclose
  private information, contact strangers, create an account, or publicly
  advocate a position as a condition of completion.

### 7.5 Economics

A lesson declaring `ECONOMICS` must:

- define the applicable economic concepts and units;
- make assumptions, constraints, time period, and data source visible;
- distinguish description or prediction from a value judgment;
- model the causal or decision pathway rather than only state a result;
- identify tradeoffs, distributional effects, uncertainty, or limitations when
  relevant; and
- include independent application using a new scenario, dataset, graph, policy,
  or decision.

### 7.6 Primary-source analysis

A lesson declaring `PRIMARY_SOURCE_ANALYSIS` must:

- bind the task to a verified source record and label it primary in the adult
  record, with a reason tied to the inquiry;
- present source context before asking for interpretation;
- identify creator, date or period, source form, original setting, repository,
  and whether the learner sees the original, a transcript, translation,
  excerpt, adaptation, or repost;
- use an age-appropriate excerpt while preserving the evidence needed for the
  question;
- model how to use creator, audience, purpose, context, content, and limitations
  at the grade-appropriate level;
- require the learner to point to a specific part of the source; and
- avoid treating one source as a complete or neutral account of an event.

If classifying the source as primary or secondary is itself assessed, the
learner view may withhold the label during the attempt, but the protected adult
record must contain the classification and rationale. Withholding for an
assessment is not the same as leaving provenance unresolved.

### 7.7 Secondary-source analysis

A lesson declaring `SECONDARY_SOURCE_ANALYSIS` must:

- bind the task to a verified source record and label it secondary in the adult
  record, with a reason tied to the inquiry;
- identify author or organization, title, publication, date, locator, and the
  evidence base when the source states it;
- provide enough background to understand the account's scope and argument;
- model how to distinguish the author's claim, evidence, reasoning,
  interpretation, and limits; and
- require the learner to cite a specific passage, claim, data point, or feature.

An archive's modern description of a historical document and the historical
document itself are different source layers and must not be silently merged.

### 7.8 Compare/perspective

A lesson declaring `COMPARE_PERSPECTIVE` must:

- name the comparison question and use consistent comparison dimensions;
- establish the context and evidence for each account or perspective;
- distinguish an evidence-based perspective from a stereotype, imagined
  monologue, or unsupported opinion;
- model agreement, difference, omission, corroboration, or conflict across
  sources;
- explain why the perspectives differ when evidence permits; and
- avoid false balance. Multiple perspectives do not require equal weight for
  claims that do not have equal evidence.

Do not require a learner to impersonate an identity, defend an injustice, or
simulate trauma. Perspective-taking should analyze evidence and context, not
perform identity.

### 7.9 Claim-evidence-reasoning

A lesson declaring `CLAIM_EVIDENCE_REASONING` must:

- pose a question that can be answered from the accepted material;
- distinguish claim, evidence, and reasoning explicitly;
- model how a specific piece of evidence supports, limits, or fails to support
  a claim;
- require source-identifiable evidence, not “the text says”;
- make the reasoning step visible rather than treating evidence as
  self-explanatory;
- address counterevidence, uncertainty, or limitations when grade-appropriate;
  and
- protect the learner's graded claim. The model must use a different question,
  evidence set, or non-scored example.

### 7.10 Quantitative data and research/source criticism

When `QUANTITATIVE_DATA_ANALYSIS` is declared, the lesson must identify the
measure, population, unit, time span, source, scale, missing data, and relevant
uncertainty. It must model an honest reading and warn against causal claims
that the data cannot support.

When `RESEARCH_SOURCE_CRITICISM` is declared, the lesson must teach the
applicable research move: question design, search and selection, provenance,
chain of custody, corroboration, triangulation, historiography, digital-media
verification, citation, or research ethics. “Find sources online” is not a
research method.

### 7.11 Project/inquiry and civic action

A `PROJECT_INQUIRY` lesson must provide:

- a compelling or researchable question with bounded scope;
- the knowledge and skills needed for the current project stage;
- accepted source requirements and a visible no-invention rule;
- manageable checkpoints for question, evidence, analysis, draft/product,
  revision, and presentation or reflection as applicable;
- models or exemplars that do not supply the learner's graded answer;
- a protected rubric with criteria for accuracy, evidence, reasoning,
  application, revision, and source integrity;
- individual evidence of learning even when collaboration is allowed; and
- a safe, private alternative to public presentation or civic action.

Project time is not automatically inquiry depth. Each checkpoint must advance
the investigation or improve the quality of evidence and reasoning.

## 8. Source standard

### 8.1 Provenance and custody

Every source used for factual teaching, analysis, or evidence must resolve to
an accepted source record. The source record must hold, as applicable:

- stable `source_ref`;
- creator or responsible organization;
- title;
- date or represented period;
- repository, publisher, or collection;
- retrievable locator and retrieval/version evidence;
- source form and primary/secondary relationship to the inquiry;
- original, transcript, translation, excerpt, adaptation, or repost status;
- rights and access metadata; and
- verification or human-review status.

The lesson must not invent, autocomplete, or reconstruct a title, author, date,
URL, quotation, map, dataset, or historical detail. A missing required source
keeps the source-dependent activity unavailable; a plausible substitute is not
acceptable.

Dynamic current-issue sources remain pending until the approved adult
attachment contract is satisfied. The existence of an attachment template is
not source readiness.

### 8.2 Excerpts, adaptations, and source complexity

An excerpt must be long enough to preserve the evidence and context needed for
the question but short enough for the grade and lesson purpose. Ellipses,
translations, modernized spelling, abridgment, redaction, and Academy-authored
summaries must be disclosed. An Academy explanation must never be formatted as
if it were a quotation from the source.

Sensitive material must be accurate, purposeful, age-appropriate, and handled
with human dignity. The lesson may use a shorter or safer excerpt without
erasing the historical reality needed to meet the standard.

### 8.3 Context before analysis

Before source analysis, the learner must know enough to answer the applicable
questions:

- Who created this and what was their position or relationship to the event?
- When and where was it created?
- What was happening at the time?
- What kind of source is this?
- Who was the intended or likely audience, when knowable?
- For what purpose was it created, when evidence supports an answer?
- What can this source help show, and what can it not show by itself?

Grades 3–5 may use a smaller subset in short, direct language. Older grades may
analyze ambiguity and contested purpose. Authors must not invent an audience or
purpose when the source record does not establish it.

### 8.4 Evidence citation

Learner directions must define the expected citation precision. Depending on
grade and source form, this may be a source title plus quoted phrase, paragraph
or line, page, map feature, table cell, data point, image region, timestamp, or
artifact detail. The expected evidence locator must be possible with the
provided material.

### 8.5 Multiple perspectives

Use multiple perspectives when the question concerns contested experience,
interpretation, policy, consequence, or public decision and when educationally
appropriate sources exist. Selection must be historically grounded and must
not present a powerful institution's record as the only account of people
affected by it. Authors should identify meaningful absences and evidence gaps.

Multiple perspectives are not a mechanical quota. A lesson may use one source
when modeling a narrow skill, provided it does not generalize beyond what that
source supports and later instruction supplies the necessary breadth.

## 9. Modeling standard

Modeled thinking is required whenever the lesson introduces or reteaches an
unfamiliar disciplinary move. A model must include:

1. A clear question or task.
2. The information, map feature, timeline entry, passage, source detail, or data
   point being noticed.
3. Ordered reasoning steps in learner-facing language.
4. A distinction among fact/observation, inference, and interpretation when
   applicable.
5. A supported conclusion and at least one limit or check when useful.
6. A transfer cue: what the learner should notice in the next, different task.

Examples of required modeled moves include:

- reading a title, legend, scale, symbol, or spatial pattern on a map;
- using a timeline to establish sequence without assuming causation;
- sourcing and contextualizing a primary source;
- identifying a secondary author's claim and evidence;
- comparing two sources on consistent dimensions;
- separating claim, evidence, and reasoning;
- tracing a cause/effect chain and checking alternative causes;
- distinguishing fact, inference, and interpretation; and
- reading a graph without overstating what it proves.

“Think about the source” or a completed answer without visible reasoning is not
a model. The model may reveal its own instructional conclusion by design. It
must not use the protected assessment prompt, the same mastery evidence, or a
near-copy that reveals the learner's graded answer.

## 10. Practice standard

### 10.1 Guided practice

Guided practice must let the learner perform the disciplinary move. Support may
focus attention, chunk a sequence, provide a partially completed organizer,
offer sentence starters that do not dictate the claim, or ask a targeted
question. Across the set, support should fade.

For a guided-analysis lesson, at least two meaningful guided turns are normally
needed to show fading: one with visible support and one with reduced support.
A single “do you understand?” question is not guided practice.

### 10.2 Independent practice

Independent work must be answerable from the accepted instruction and sources
without Tutor invention. It must not depend on the learner guessing missing
context or locating an unspecified source.

A non-diagnostic teaching lesson should ordinarily provide at least two fresh
independent evidence opportunities and more than one response demand. The
appropriate amount depends on reading burden and task depth: one sustained
source comparison can carry more evidence than several recall questions. A
human reviewer decides semantic sufficiency.

Across a lesson or tightly connected sequence, use a purposeful mixture of the
following where the target supports them:

- recall or vocabulary in context;
- sequence or chronology;
- map or spatial interpretation;
- source-specific evidence;
- cause/effect or continuity/change;
- compare/contrast;
- perspective and limitation;
- claim/evidence/reasoning;
- quantitative or data interpretation; and
- short constructed response or inquiry product.

A bank made only of repeated recall questions fails R1 when the target includes
analysis. Prompts that change only a name, date, or surface object count as one
template for depth review.

### 10.3 Independence and help

An evidence task is independent only when the learner supplies the central
answer, evidence selection, and reasoning. Read-aloud, directions, access
support, vocabulary already taught, and neutral encouragement can preserve
independence. Step-completing hints, supplied evidence sentences, dictated
claims, correctness cues, and rewritten responses do not.

The curriculum declares allowed support and the protected answer/help policy.
The runtime records or acts on help under its own approved policy.

## 11. Mastery, assessment, review, and remediation

### 11.1 Fresh mastery evidence

Mastery supply must:

- use content, sources, examples, contexts, or representations not copied from
  the model or guided practice;
- include more than one independent evidence point;
- sample at least two applicable forms, such as accurate content plus source
  reasoning, chronology plus cause/effect, map reading plus explanation, or
  claim plus evidence connection;
- cover the stated learning goal without irrelevant reading burden;
- contain no answer, near-answer, correctness marker, or solution cue in the
  learner projection; and
- map every judged task to protected acceptable-evidence criteria.

Curriculum supplies fresh evidence. It does not mark the learner mastered.
Mastery state remains runtime/policy authority and must not be inferred from
one response.

A `MASTERY` lesson collects evidence before any reteaching of the measured
target. Support and remediation may follow the evidence event, but they must
not be represented as independent mastery evidence.

### 11.2 Assessment

An `ASSESSMENT` lesson must follow an approved blueprint and must:

- map each task to canonical or honestly unresolved standards references,
  topic IDs, and skill IDs;
- use verified sources and provide every source needed during the attempt;
- collect more than one evidence point for each reported claim unless an
  approved performance-task blueprint documents another basis;
- use fresh prompts and an appropriate mixture of content, application,
  source/map/data reasoning, and constructed response;
- keep keys, rubrics, acceptable evidence, and interpretation in the protected
  adult projection;
- avoid preteaching or cueing the assessed answer; and
- provide accommodations that preserve the assessed construct.

### 11.3 Review

A `REVIEW` lesson must reconnect previously taught ideas rather than present a
random question bank. It must identify prior lesson, topic, or skill refs; use
brief retrieval or refreshers; interleave at least two meaningful knowledge or
reasoning demands; and end with fresh independent evidence.

### 11.4 Remediation and correction/reflection

Remediation begins with an observable evidence pattern, not a trait judgment.
Each path must:

1. Name the prerequisite gap, misconception, or error ID.
2. Explain the idea differently from the failed instruction.
3. Model the smallest missing move with a different example,
   representation, source chunk, map, timeline, or comparison.
4. Provide supported practice with feedback that identifies the evidence gap.
5. Provide a fresh independent retry.
6. Provide fresh mastery evidence after support is withdrawn.

If a learner misses source analysis, more identical source questions are not
reteaching. A valid route might shorten and contextualize a different excerpt,
model creator/audience/purpose, contrast evidence with inference, then ask the
learner to analyze a fresh excerpt.

Correction/reflection must help the learner locate and revise a specific gap.
It must not expose the full protected answer before the learner has a chance to
reason again, and the corrected response must not be relabeled as independent
mastery evidence.

## 12. Grade-language and reading-burden standard

R1 distinguishes two independent variables:

| Variable | Meaning | Rule |
| --- | --- | --- |
| **Source text complexity** | The authentic language, syntax, structure, concepts, and background demand of a source | Preserve authentic complexity when the standard requires it; excerpt and label changes honestly |
| **Manuel Academy instructional explanation complexity** | The Academy's directions, context, vocabulary teaching, modeling, questions, and feedback | Write at the learner's grade and scaffold the source; never copy source difficulty into the instructions |

A complex founding document can be appropriate for an older learner while the
directions remain direct and the source is chunked, contextualized, and
annotated. Lowering source complexity and lowering instructional complexity
are different decisions.

### 12.1 Rules for all grades

Learner-facing Academy prose must:

- use direct, respectful language and concrete referents;
- give one clear direction at a time unless actions are inseparable;
- define unfamiliar historical, civic, geographic, economic, and source terms
  at first meaningful use;
- chunk long reading around meaningful ideas rather than arbitrary screen size;
- keep the question and relevant source or representation close together;
- distinguish Academy context, source text, quotation, adaptation, and
  learner task visually and in text;
- provide useful headings and white space;
- avoid shaming, diagnosis language, false certainty, and unsupported
  generalizations about groups; and
- keep engineering and production language out of the learner projection.

Learners should see “First, read the map title. It tells you the place and time
shown,” not “Execute the map-analysis phase.” Terms such as `source_ref`,
`phase`, `projection`, `authority state`, `response kind`, `gate`, `manifest`,
and `runtime` are internal unless they have a legitimate disciplinary meaning
in context.

### 12.2 Grades 3–5

For Grades 3–5:

- keep explanations and paragraphs short;
- make most sentences carry one main idea;
- define new disciplinary vocabulary immediately;
- introduce people, places, and time before asking for analysis;
- split multi-step source or map analysis into visible steps;
- give one direction, allow the learner to act, then give the next direction;
- prefer a short, purposeful excerpt over a long unscaffolded page;
- pair dates with sequence language such as before, after, during, or how long;
  and
- use read-aloud, audio, visual, or text alternatives without changing the
  learning target.

Grade 3 should rely most heavily on concrete examples and short directions.
Grade 4 may connect two closely related ideas. Grade 5 may ask for a short
evidence-based explanation or comparison, but the prompt must state exactly
what evidence to use.

Mechanical sentence and paragraph metrics are advisory signals only. Human
review must account for names, quotations, source titles, dates, and necessary
disciplinary vocabulary.

### 12.3 Grades 7–8

Grades 7–8 may use longer explanations and more source context, but unfamiliar
syntax and vocabulary still require support. Directions should separate
sourcing, evidence selection, and reasoning. Learners may compare accounts,
weigh causes, and address limitations with explicit criteria.

### 12.4 Grades 9–12

Grades 9–12 may use authentic complex texts, scholarly interpretations,
statutes, cases, economic data, and sustained research when the course target
requires them. The Academy must scaffold access through context, chunking,
vocabulary, annotations, models, guiding questions, and accessible formats.
“High school” is not a reason to assign an unexplained document dump.

Scaffolds should decrease as the skill becomes established, but source
complexity must not be confused with vague or needlessly complex Academy
instructions.

### 12.5 Reading-burden declaration

Each lesson must declare the source-reading load, Academy-explanation load,
expected response load, and the supports supplied. Reviewers should investigate
long or numerous sources, dense uninterrupted text, stacked directions,
unexplained background assumptions, and a mismatch between reading burden and
the Social Studies target. Reading may be part of the target; unexplained
reading burden may not be the accidental gatekeeper.

## 13. Protected adult authority and answer separation

Every scored or reviewed task must resolve to a protected adult-authority
entry containing:

- task reference and target skill references;
- accurate acceptable answer or bounded acceptable-evidence criteria;
- source, map, timeline, or data evidence expected where applicable;
- reasoning or rationale;
- scoring guidance and rubric criteria for constructed responses;
- relevant misconception or error IDs; and
- support conditions that would make the result no longer independent.

“Answers will vary” is insufficient unless the entry defines what evidence,
accuracy, reasoning, and limitations make an answer acceptable. Multiple
historically defensible answers may be accepted; the authority must bound them
with evidence, not preferred phrasing.

Protected answers, rubric annotations, and correctness markers must not enter
the learner attempt. Learner-facing modeled examples are intentionally solved,
but they must not use the protected assessment or mastery answer.

Where a lesson depends on dynamically attached sources, adult source approval
and adult scoring authority are separate responsibilities. A valid attachment
does not create an answer key, and a rubric does not prove source readiness.

## 14. Curriculum-side Tutor manifest draft

The draft Tutor manifest is data only. It identifies the accepted curriculum
supply available to a future Tutor V2 adapter.

| Field | Meaning |
| --- | --- |
| `lesson_id` | Stable lesson identity |
| `instructional_purpose` | Primary R1 purpose contract |
| `disciplinary_modes` | Applicable Social Studies thinking modes |
| `authored_phase` | Current curriculum phase, separate from type |
| `topic_ids` | Stable content/topic identifiers |
| `skill_ids` | Stable disciplinary skill identifiers |
| `prerequisite_knowledge_ids` | Smallest accepted knowledge needed before the target |
| `source_refs` | Accepted source records available to the lesson |
| `misconception_ids` | Registered misunderstandings relevant to content |
| `error_ids` | Registered observable errors in reasoning or source use |
| `model_refs` | Available modeled analyses |
| `guided_task_refs` | Available supported tasks |
| `independent_task_refs` | Available independent tasks |
| `mastery_task_refs` | Fresh evidence supply |
| `remediation_path_refs` | Different-instruction routes and fresh retries |
| `assessment_task_refs` | Blueprint-owned protected assessment tasks |
| `project_checkpoint_refs` | Inquiry/project stages available |
| `allowed_instructional_supports` | Supports for which authored content exists |
| `help_policy_ref` | Approved help boundary, not executable hint logic |
| `answer_policy_ref` | Approved answer-handling boundary, not answer authority |
| `grade_language_policy_ref` | Approved grade-language policy |
| `phase_content_refs` | Content available by teach/model/guided/independent/mastery/remediation/assessment/project phase |

Every ref must resolve within the accepted authoring set or an approved
registry. The manifest must state these invariants:

- grounding in accepted lesson and source material is required;
- historical facts and sources may not be fabricated;
- the Tutor may not write or rewrite a graded learner claim, argument, source
  classification, citation, or conclusion;
- the Tutor may not reveal a protected final answer; and
- runtime decisions and mastery state remain outside the manifest.

Allowed support may include read-aloud, vocabulary reminder, context recap,
source chunking, map orientation, timeline orientation, evidence-location
prompt, question decomposition, organizer, neutral sentence frame,
worked-example reference, alternate response mode, or accessibility support.
An allowed support must point to authored material; a label alone does not give
the Tutor content to invent.

## 15. Machine-readable draft contract

`SOCIAL_STUDIES_LESSON_CONTRACT_R1.schema.json` is a Draft 2020-12 JSON Schema
for a future lesson package. It encodes the two-axis type system, canonical
standards-reference custody, prerequisite/background and vocabulary records,
context and reading-burden declarations, source-use records, instruction and
modeled analysis, task shapes, fresh mastery evidence, remediation paths,
protected adult authority, and the data-only Tutor manifest.

The schema is a design artifact. It is not wired into Curriculum Studio,
release admission, Study Engine, Tutor V2, or Dashboard. Structural validity
cannot prove historical accuracy, sufficient context, a trustworthy
perspective set, genuine task variety, or learner comprehension. Those require
semantic checks and human review.

Canonical repository identifiers may contain underscores (for example,
`avalon-stamp_act`). The contract identifier pattern accepts underscores so an
author must preserve a canonical source key rather than rename it to satisfy
the draft schema.

## 16. Advisory quality gate draft

Gate mode for R1 is `ADVISORY_DRAFT`. Findings belong in a lesson review report
and do not block the global release until Director approval, sample review,
threshold calibration, exceptions, and a bounded rollout plan are complete.

Proposed severities:

- `DRAFT_ERROR`: the artifact cannot claim R1 draft conformance.
- `REVIEW_WARNING`: a qualified human must accept or correct the finding.
- `ADVISORY_METRIC`: evidence only; never a sole accept/reject rule.

| Check ID | Detection | Draft severity |
| --- | --- | --- |
| `SS-TYPE-001` | Missing purpose/mode declaration, incompatible type obligations, or phase used as the only type | `DRAFT_ERROR` |
| `SS-STANDARD-001` | Invented standard, silently canonicalized legacy label, or unresolved authority represented as verified | `DRAFT_ERROR` |
| `SS-CONTEXT-001` | Target task requires major historical/civic/economic/geographic context that the package does not teach or retrieve | `DRAFT_ERROR` |
| `SS-VOCAB-001` | Necessary unfamiliar disciplinary vocabulary lacks first-use learner support | `REVIEW_WARNING`; `DRAFT_ERROR` when the task is not understandable |
| `SS-CHRONOLOGY-001` | Time is material but sequence/context is absent, misleading, or only decorative | `DRAFT_ERROR` |
| `SS-MAP-001` | Map/geospatial target lacks attributable usable representation, relevant map-reading model, or accessible evidence equivalent | `DRAFT_ERROR` |
| `SS-SOURCE-001` | Source ref/provenance is missing, unresolved, invented, or insufficient for the task | `DRAFT_ERROR` |
| `SS-SOURCE-002` | Primary/secondary classification or rationale is absent, misleading, or exposed when classification is protected evidence | `DRAFT_ERROR` |
| `SS-SOURCE-003` | Source analysis begins without sufficient creator/date/place/event/source-form context | `DRAFT_ERROR` |
| `SS-EXCERPT-001` | Excerpt/adaptation/translation status is undisclosed, necessary context is removed, or burden is not grade-appropriate | `DRAFT_ERROR` for misrepresentation; otherwise `REVIEW_WARNING` |
| `SS-CITATION-001` | Evidence is required but the learner lacks a usable source locator or citation expectation | `DRAFT_ERROR` |
| `SS-PERSPECTIVE-001` | Perspective task uses imagined/unsupported voices, false balance, or omits a materially necessary perspective without rationale | `DRAFT_ERROR` or `REVIEW_WARNING` by impact |
| `SS-MODEL-001` | New/reteach disciplinary skill has no modeled reasoning, or model is answer-only | `DRAFT_ERROR` |
| `SS-GUIDED-001` | Guided lesson lacks meaningful learner turns or support fading | `DRAFT_ERROR` |
| `SS-INDEPENDENT-001` | Independent work is thin, source-unanswerable, wholly recall-based for an analysis target, or Tutor-dependent | `DRAFT_ERROR` |
| `SS-VARIETY-001` | Required mixture is superficial variation with no changed reasoning demand | `REVIEW_WARNING` |
| `SS-MASTERY-001` | Mastery supply is copied/cued, has only one evidence point, lacks applicable form variety, or is not independent | `DRAFT_ERROR` |
| `SS-REMEDIATION-001` | Missing reteach path, identical repetition, no error/prerequisite binding, or no fresh retry/evidence | `DRAFT_ERROR` |
| `SS-READING-001` | Reading burden is undeclared, unexplained, unchunked, or mismatched to grade/target | `REVIEW_WARNING`; `DRAFT_ERROR` when it blocks access |
| `SS-LANGUAGE-001` | Learner projection contains engineering/production language or stacked unclear directions | `DRAFT_ERROR` for engineering leakage; otherwise `REVIEW_WARNING` |
| `SS-TEMPLATE-001` | Exact normalized duplicate or high-similarity shell/prompt with no topic-specific teaching or reasoning change | `DRAFT_ERROR` for exact substantive duplication; fuzzy match is `REVIEW_WARNING` |
| `SS-CLAIM-001` | Factual or source claim lacks accepted grounding, exceeds the cited evidence, or presents interpretation as fact | `DRAFT_ERROR` |
| `SS-ANSWER-001` | Protected answer, dictated claim, correctness marker, or solution cue leaks into an evidence attempt | `DRAFT_ERROR` |
| `SS-AUTHORITY-001` | Scored/judged task lacks complete protected adult authority or uses unbounded “answers vary” guidance | `DRAFT_ERROR` |
| `SS-TUTOR-001` | Tutor manifest has unresolved refs, permits fabrication/graded writing, or contains executable runtime decisions | `DRAFT_ERROR` |
| `SS-ACCESS-001` | Required visual/audio/source evidence lacks an accessible alternative or construct-preserving accommodation | `DRAFT_ERROR` |

### 16.1 Future automated checker outline

The future checker should:

1. Validate the package against the JSON Schema.
2. Resolve lesson, topic, skill, prerequisite, source, policy, task, model,
   remediation, and adult-authority refs.
3. Confirm that standards mapping status matches canonical custody and that no
   legacy label was silently promoted.
4. Apply purpose- and mode-specific structural obligations.
5. Check that every factual/source analysis task has accepted grounding and
   that every evidence demand has a usable locator.
6. Compare source classifications, learner visibility, excerpt treatment,
   rights/access, and provenance records.
7. Trace teach → model → guided → independent → fresh mastery and confirm that
   remediation uses a different model plus fresh retry.
8. Normalize prompts and explanatory blocks for exact duplication, then use
   similarity and template-family analysis only as human-review signals.
9. Compare protected answers, evidence phrases, and rubric annotations with
   learner attempt content while excluding declared worked models and
   unmarked choice membership.
10. Scan Academy prose separately from quoted source text for grade-language,
    engineering-language, density, stacked directions, and undefined-term
    signals.
11. Report check ID, severity, JSON path/content ref, evidence snippet, affected
    type obligation, and suggested human review action.

The checker must keep source text out of Academy-prose readability metrics and
must never treat a readability score, word count, or similarity score as a
final semantic judgment.

### 16.2 Human review required

Qualified human review must decide whether:

- background is accurate and sufficient;
- a source classification fits the inquiry;
- excerpts preserve meaning and dignity;
- author, audience, purpose, perspective, and limits are taught accurately;
- chronology, map, or data representations support the intended reasoning;
- a model makes disciplinary thinking visible;
- practice and mastery evidence are genuinely varied and independent;
- multiple perspectives are educationally appropriate and fairly framed;
- remediation addresses the observed gap with different instruction;
- protected criteria admit the defensible range of answers; and
- learner language is understandable at the intended grade.

## 17. Proposed Director sample

Use `ma-g5-social-studies-u08-l03`, “Guided practice A: protest and loyalism,”
as the first future sample. Do not rewrite it as part of this standard task.

It is representative because it sits at the intersection of the most important
R1 obligations:

- Grade 5 requires the strongest elementary language and chunking discipline.
- Its repository phase is guided practice, so modeling, supported learner
  turns, and fading support can be inspected directly.
- The topic needs historical background and chronology before a learner can
  reason about protest and loyalism.
- The accepted source set includes primary and secondary source possibilities,
  creating a real provenance and source-labeling test.
- The task naturally supports perspective comparison and
  claim-evidence-reasoning without identity role-play.
- It requires specific evidence, an independent response, protected scoring
  criteria, and misconception-specific remediation.
- It uses the recurring production-package shell, making it useful for testing
  whether R1 produces topic-specific teaching rather than another template
  rewrite.

The current package is evidence of why the sample is useful, not a model to
copy: it names generic source activity and scoring structures but does not yet
supply the full learner-facing background, vocabulary, contextualized excerpt,
worked source reasoning, sufficiently specified independent task, or
misconception-specific alternate reteaching required by R1. Future sample work
must preserve canonical standards and source custody and must not fabricate
source text.

## 18. Director approval and rollout

R1 remains a draft until all of these occur:

1. Author the one proposed Grade 5 sample against this contract.
2. Run draft structural and semantic checks on that sample.
3. Conduct historical-content, source/provenance, grade-language,
   accessibility, answer-separation, and learner-path review.
4. Obtain Director approval or record requested revisions.
5. Calibrate type obligations and advisory findings against a bounded set of
   additional lesson types and grades.
6. Version the approved contract and gate policy.
7. Plan a bounded migration with reviewable diffs, source verification,
   rollback, and no global release blocking until explicitly authorized.

No bulk rewrite of the 972 lessons should begin from this draft. Existing
lessons and runtimes remain unchanged.

## 19. R1 draft conformance checklist

A reviewer may classify a lesson `R1_CONFORMING_DRAFT` only when:

- the declared purpose and modes are accurate and every applicable type
  obligation is met;
- canonical standards custody is preserved;
- sufficient background, vocabulary, chronology, and spatial context are
  supplied;
- every source is real, attributable, appropriately excerpted, and contextualized;
- primary/secondary labeling and evidence citation are correct;
- learner-facing explanations fit the grade even when source text is complex;
- disciplinary thinking is modeled without protected-answer leakage;
- guided and independent tasks provide appropriate depth and variety;
- fresh independent mastery evidence is available;
- remediation uses different instruction and ends in fresh evidence;
- every judged task has complete protected adult authority;
- Tutor metadata is grounded, data-only, and non-fabricating;
- accessibility and dignity requirements are met; and
- qualified human content and learner-readiness review is complete.
