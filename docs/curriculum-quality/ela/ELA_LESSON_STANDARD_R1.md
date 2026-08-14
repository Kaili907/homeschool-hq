# Manuel Academy ELA Lesson Standard R1

Status: **DRAFT FOR DIRECTOR REVIEW**

Applies to: English Language Arts, Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12

Advisory contract artifact: `ELA_LESSON_CONTRACT_R1.schema.json`

Authoritative base for this draft:
`56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

Audit input: the ELA depth audit found 0 of 1,620 active lessons depth-ready.
This standard does not repair or reclassify those lessons.

## 1. Purpose and authority

This document defines the curriculum content and curriculum metadata required
for a strong Manuel Academy ELA lesson. It is intentionally subject-specific.
ELA depth is not a Mathematics item-count problem: text quality, interpretation,
language, evidence, authorship, and revision require different contracts.

R1 is a proposed authoring and review standard. It is not a production release
gate and does not authorize a bulk rewrite. Before any corpus-scale repair, the
Director must review one complete lesson authored against the approved successor
to this draft.

The proposed first Director sample is:
`ma-g7-english-language-arts-u05-l03` — “Guided practice A: reasoning and
warrants.” This session does not rewrite that lesson.

The words **must**, **should**, and **may** have these meanings:

- **Must** is required for draft conformance unless a profile explicitly says
  otherwise.
- **Should** is the expected default; a reviewer may approve a documented,
  instructionally sound exception.
- **May** is optional.

## 2. Boundaries

This standard owns curriculum-side content and future curriculum metadata only.
It does not implement or change Tutor V2, Study Engine, learner UI, provider
selection, memory, scoring runtime, mastery state, hint execution, dashboards,
or release admission.

Curriculum supplies texts, explanations, models, tasks, supports, protected
scoring authority, and stable relationships among them. A future runtime may
select and pace approved supply under separately approved policies. It may not
invent missing instructional depth, weaken the assessed construct, expose
protected answers, or write a learner's graded response.

This draft also does not:

- rewrite any of the 1,620 active ELA lessons;
- change lesson identities, schedules, bindings, packages, or scoring guides;
- lower a required grade-level text merely because a learner needs access
  support;
- make a readability formula the judge of text appropriateness; or
- treat length, number of questions, or presence of a passage as sufficient
  evidence of ELA depth.

## 3. Core terms

**Lesson profile** is the lesson's dominant instructional contract. Every lesson
declares exactly one profile even when it integrates multiple ELA strands.

**Target text** is a text the learner is expected to read, hear, view, analyze,
or use as evidence. A text may be literary, informational, visual, audio, or
multimodal when the standard permits it.

**Protected question** is a scored, graded, mastery, diagnostic, or assessment
prompt whose answer, evidence selection, reasoning, or final composition must
remain the learner's own work.

**Model text/task** is a separate example used to reveal expert thinking. It may
show a complete answer because it is not the protected attempt.

**Guided task** requires a learner attempt plus support and feedback. It is not a
model disguised as practice.

**Independent evidence** is a fresh response completed without supplied claim,
interpretation, evidence choice, reasoning, wording, or revision. Help use and
response conditions belong to runtime evidence records; curriculum only declares
what independence requires.

**Source anchor** is a protected, precise location or feature that supports a
scoring judgment. An anchor supports adult consistency without requiring one
identical learner interpretation when the text permits several.

## 4. Shared ELA lesson package

Every conforming lesson package must supply six coherent layers.

| Layer | Required curriculum supply |
| --- | --- |
| Identity and intent | Stable identity, grade, profile, standards, target skills, learning goal, and evidence purpose |
| Text set | Texts or resolvable text references, rights/provenance, instructional roles, accessibility, and complexity/burden review |
| Teaching and access | Explicit teaching, model/think-aloud where the profile calls for instruction, vocabulary, directions, and allowed scaffolds |
| Learner work | Comprehension checks, guided tasks, independent tasks, writing/revision work, and presentation order as applicable |
| Protected authority | Question keys, source anchors, rubrics, acceptable variation, misconception boundaries, and scoring notes |
| Future Tutor manifest | Stable data-only references to available skills, texts, tasks, supports, policies, and evidence definitions |

An author may omit a content type only when the declared profile makes it
inapplicable. For example, an assessment must not preteach its measured target,
and a vocabulary lesson may not require an extended essay. The omission must be
clear from the profile rather than caused by a generic generator shell.

## 5. Three distinct language and complexity decisions

These three concepts must never be collapsed into one “reading level.”

### 5.1 Student reading level

Student reading level is a current, learner-specific access signal. It may help a
future runtime select chunking, audio, fluency support, preview vocabulary, or
additional guided practice. It is not stored in the curriculum lesson package,
does not redefine the grade-level standard, and must not be inferred from one
wrong answer.

### 5.2 Grade-level text complexity

Grade-level text complexity is a property of the text-task-standard combination.
It includes quantitative evidence, qualitative demands, background knowledge,
and the work the learner must do with the text. When a standard requires
grade-level reading, the primary evidence text must remain at the required
complexity unless an approved accommodation changes what claim can be made.

Text complexity review must document:

- quantitative signals such as word count and one or more readability measures,
  used only as advisory evidence;
- meaning or purpose;
- text structure;
- language conventionality, vocabulary, and syntax;
- knowledge and cultural/context demands;
- visual, audio, or multimodal demands when present;
- the task's rereading, comparison, evidence, and writing demands; and
- a human judgment with reviewer identity or approval reference.

### 5.3 Teacher/Tutor explanation language

Teacher/Tutor explanation language is the language used to explain a direction,
skill, term, or strategy. It should usually be clearer and less syntactically
dense than the target text. It may define, chunk, demonstrate, paraphrase a
direction, or model thinking on a separate example. It must preserve essential
ELA terminology and may not paraphrase away the evidence the learner is meant to
find, the inference the learner is meant to make, or the prose the learner is
meant to compose.

### 5.4 Scaffolding without construct loss

For a learner who needs access to grade-level text, prefer this sequence:

1. Clarify the purpose and response directions.
2. Preview only vocabulary or knowledge that is not itself being assessed.
3. Chunk at meaningful boundaries and provide navigation markers.
4. Offer audio/read-aloud, enlarged or reflowed text, or multimodal access when
   the assessed construct permits it.
5. Model the strategy on a different text.
6. Guide one separate example, then fade support.
7. Ask the learner to reread a bounded location and explain what is confusing.
8. If an alternate-complexity text is used, label it as an adaptation and do not
   claim grade-level reading evidence when text complexity is part of the
   construct.

Scaffolding may reduce extraneous burden. It must not silently lower the target,
preselect protected evidence, or turn independent reading into listening when
decoding or independent reading is the measured construct.

## 6. Age, grade, and reading burden

There is no universal word-count quota or cap for an ELA lesson. A poem, scene,
article, chapter, and research set carry different kinds of load. Authors must
instead declare a `reading_burden` plan that considers:

- estimated first-read and reread time;
- uninterrupted text length and natural chunk boundaries;
- number of texts and source-switching demands;
- density of unfamiliar vocabulary, syntax, ideas, and references;
- navigation demands such as footnotes, charts, hyperlinks, or line numbers;
- amount and complexity of writing expected in the same lesson; and
- which access modes preserve the construct.

Grade-band defaults guide human review:

| Grade band | Direction and explanation burden | Text access default |
| --- | --- | --- |
| 3–4 | Usually one action per direction; brief explanations followed by a check or example | Chunk longer texts at meaningful boundaries, make location markers visible, and avoid stacking a new text, several new terms, and extended writing without support |
| 5–8 | One or two connected actions; established ELA terms may be used with immediate support for new terms | Build purposeful stamina while providing sections, rereading targets, and support that fades before independent evidence |
| 9–12 | Multi-step directions are acceptable when clearly ordered; discipline-specific language should be retained and explained | Preserve authentic syntax and sustained reading, adding navigation and knowledge support without rewriting the author's reasoning for the learner |

Mechanical sentence-length and readability metrics are `ADVISORY_METRIC` only.
A human reviewer must decide whether the combined reading, listening, navigating,
and writing burden is feasible in the planned time without weakening the target.

## 7. Passage and source quality

Every target text must be worth the instructional attention it receives. A
conforming text set must have:

- a legitimate instructional purpose and connection to the standards;
- complete learner availability for the assigned use, or an exact resolvable
  source and access plan;
- verified rights/provenance and accurate author/title/source metadata;
- genre-appropriate coherence, craft, organization, and factual integrity;
- authentic grade/discipline differentiation, not extra paragraphs appended to
  a shared shell;
- sufficient substance for the questions asked;
- no fabricated quotation, citation, source, author, statistic, or event;
- no paragraph that announces the target answer or explains the precise
  relationship a protected question asks the learner to discover;
- accessibility information and a text-only equivalent for required non-text
  content where possible; and
- human review for complexity, quality, sensitivity, representation, and fit.

Original Academy text is allowed, but “Academy original” is provenance, not a
quality finding. Public-domain, licensed, contemporary, and original texts may
all be appropriate when rights and integrity are clear. Reuse is acceptable
when purposeful rereading produces a new demand; repetitive assignment of one
text or template because a generator lacks source depth is not.

Texts must declare an instructional role such as `model`, `guided`,
`independent`, `transfer`, `research_source`, or `assessment`. The model text
should normally differ from the protected independent text. Transfer and
assessment texts must be fresh enough that prior modeling does not supply the
answer.

## 8. Explicit teaching and modeling

Instruction-bearing profiles must contain lesson-specific explicit teaching.
Repeating the goal, naming a strategy, or telling the learner to “use evidence”
does not count.

An explicit teaching block must:

- name the ELA idea in learner-facing language;
- explain what readers or writers notice and why it matters;
- distinguish the target from a plausible confusion;
- connect the idea to a text feature, sentence, word, source, or writing move;
  and
- end with a usable decision, question, or process the learner can try.

A model or think-aloud must use a declared model text/task and make expert
decision-making visible. It must show what is noticed, what possibilities are
considered, why evidence is selected or rejected, and how the conclusion or
revision follows. A summary of completed work is not a think-aloud.

For reading, the model may reveal the answer to the model question only. For
writing, it may show a complete model response to a separate prompt, or model a
bounded process step. It must not create reusable prose that completes the
protected graded prompt.

## 9. Comprehension checks and protected questions

Instruction-bearing reading lessons must check comprehension before the final
submission. Checks should occur at purposeful points: after directions, after a
meaningful text segment, after a model, or before a learner commits to a longer
response.

A useful comprehension check requires an observable learner response and has a
defined feedback move. “Do you understand?” is not sufficient. Checks may ask a
learner to locate, paraphrase, sequence, distinguish, predict, explain a
relationship, or identify what remains confusing.

Support must provide enough context to begin without answering a protected
question. A lesson may:

- identify the relevant text span when navigation is not the construct;
- define non-assessed background or vocabulary;
- restate the task in simpler language;
- ask the learner to compare two self-generated possibilities; or
- point to a rubric dimension that is missing.

It may not:

- state the protected inference, theme, central idea, claim, or evaluation;
- select the best evidence for the learner;
- eliminate alternatives in a way that reveals the answer;
- supply a thesis, outline, sentence, paragraph, or revision for graded work; or
- embed the target reasoning in the passage, directions, hint, metadata, or
  feedback.

## 10. Vocabulary support

Vocabulary support is selective, not a glossary dump. Authors must identify the
words that materially affect access to the text or target skill and record why
each is supported.

Support may include learner-friendly meaning, context, morphology, pronunciation
or decoding, cognates, syntax, multiple meanings, examples/non-examples, and a
quick use or meaning check. It must preserve productive struggle when word
meaning or word-solving is the assessed target. In that case, instruction uses
separate words before independent evidence.

A vocabulary profile must move beyond copying definitions. Learners should
encounter words in meaningful context, analyze form and meaning when relevant,
make distinctions among related words, and independently interpret or use fresh
instances.

## 11. Guided comprehension and independent evidence

Every guided task must contain:

- a learner-visible prompt;
- a required learner attempt;
- the allowed support before and after that attempt;
- a feedback move tied to an observable response; and
- a declared fade level leading toward independence.

Guided work must not be a completed example followed by “now copy this pattern.”
At least one meaningful decision—interpretation, evidence choice, language
choice, organization, or source judgment—must remain with the learner.

Independent evidence must use a fresh prompt and, when necessary, a fresh text
or text location. It must declare the expected evidence type, permitted supports,
response mode, and independence boundary. Independent evidence cannot be
claimed when a model, hint, organizer, feedback message, or adult has supplied
the material answer.

## 12. Writing, rubric use, and revision

Writing support must match the actual stage and genre. A product label plus a
word count is not a writing scaffold.

The package's writing classification must agree with the learner deliverable.
A paragraph, explanation, analysis, response, note set, plan, revision, or other
learner-authored text cannot be marked as “writing not required” merely because
writing is not the lesson's dominant profile.

A writing lesson must declare one or more process stages:
`planning`, `drafting`, `revising`, `editing`, `publishing`, or `reflection`.
Applicable supply includes:

- mentor text or model on a separate topic/prompt;
- genre and audience/purpose analysis;
- planning questions or a neutral organizer;
- paragraph/function guidance rather than prewritten content;
- transition, syntax, elaboration, evidence-integration, or citation support;
- a learner-facing rubric or checklist;
- a feedback cycle; and
- a revision task that identifies what kind of improvement to make.

The Tutor/lesson may model the writing process but must not supply the graded
final response. For protected work it must not write, dictate, outline, complete,
rewrite, or provide paste-ready claims, evidence choices, sentences, paragraphs,
or revisions. It may clarify the prompt, explain a rubric dimension, ask
diagnostic questions, model on a different prompt, identify a gap, or offer a
content-neutral organizer.

Rubrics must be available before the relevant work and written so a learner can
use them. A strong lesson uses the rubric at least once to analyze a model,
plan/check work, interpret feedback, or justify a revision. The protected adult
rubric must identify observable evidence, performance distinctions, and
source/task-specific anchors where applicable. “Answers will vary” is not
sufficient scoring authority.

Revision is meaning-level improvement before proofreading. When revision is a
target, the learner must make and explain a substantive change to idea,
organization, evidence, reasoning, elaboration, voice, or sentence effectiveness.
Editing conventions alone do not satisfy revision. The package should preserve
or reference enough before/after evidence to review the change without storing
private content beyond approved runtime policy.

## 13. Question variety

Question variety means different reading or language decisions, not cosmetic
changes to names, paragraph numbers, or response length. Across an
instruction-bearing lesson, text set, or deliberately linked sequence, authors
must use a purposeful mix drawn from applicable families:

- locate or recall explicit information;
- sequence, paraphrase, or summarize;
- infer and support an interpretation;
- determine central idea, theme, or development;
- analyze character, setting, point of view, perspective, or purpose;
- analyze structure, genre, craft, syntax, or author's choices;
- interpret words, phrases, figurative language, or morphology in context;
- select, compare, and explain evidence;
- compare texts, accounts, media, or perspectives;
- evaluate an argument, source, claim, or sufficiency of evidence;
- synthesize across ideas or sources; and
- transfer the skill to a fresh text, sentence, source, or writing situation.

Not every lesson needs every family. The selected set must match the profile and
goal. Reading profiles should normally include at least one meaning question,
one evidence/reasoning question, and one analysis or transfer question across
guided and independent work. A single extended task may satisfy more than one
family only when each demand is visible and scorable.

Question review must examine cognitive demand, dependency, ambiguity, cultural
and background assumptions, answerability from the supplied text, and whether
earlier questions reveal later protected answers.

## 14. ELA lesson profiles

Every lesson declares exactly one dominant profile from this section. Secondary
`skill_strand_ids` may record integration. Profile selection follows the lesson's
primary learner outcome, not its title or generator family.

`ASSESSMENT` includes diagnostic evidence through its `assessment_purpose`.
“Project” is not a twelfth profile: a project declares `WRITING`,
`RESEARCH_SOURCE_USE`, or another profile according to its primary assessed
outcome, with secondary skill strands recording the integration.

### 14.1 `READING_COMPREHENSION`

Use for transferable meaning-making such as monitoring, summarizing, inference,
evidence, or integration that is not primarily literature- or information-form
specific. It must supply a quality target text, explicit strategy teaching, a
think-aloud on a separate example, at least one embedded comprehension check,
guided practice with fading, and fresh independent evidence. The learner must do
more than state a response: location, paraphrase, evidence, or reasoning makes
comprehension observable.

### 14.2 `LITERATURE`

Use when interpretation or analysis of literary form is primary. The lesson must
respect the integrity of the work, teach relevant genre/craft knowledge, support
necessary cultural or historical context without dictating interpretation, and
allow multiple readings when the text supports them. Independent evidence should
connect an interpretation to precise textual features. Plot recall alone is not
literary depth; theme labels, character judgments, and symbol meanings must not
be supplied before protected questions.

### 14.3 `INFORMATIONAL_TEXT`

Use when understanding or analyzing exposition, explanation, argument, or
disciplinary information is primary. The lesson must establish source identity
and factual integrity, teach applicable structure or reasoning, distinguish what
the source states from what the reader infers, and require evidence-based
independent work. When claims or data matter, learners should consider relevance,
sufficiency, limitations, and source perspective rather than merely extracting a
fact.

### 14.4 `VOCABULARY`

Use when word meaning, word solving, morphology, nuance, or word use is primary.
The lesson must use meaningful context, explicit word-learning instruction, a
model with non-protected examples, guided discrimination or analysis, and fresh
independent instances. It should connect receptive meaning to productive use
when the standard calls for both. Memorizing a copied definition is not enough.

### 14.5 `GRAMMAR_LANGUAGE`

Use when conventions, grammar, usage, syntax, style, or language choices are
primary. The lesson must explain both form and function, model in authentic
sentences or passages, contrast relevant cases, guide analysis or revision, and
require independent application in fresh language. It must distinguish formal
or task-appropriate conventions from claims that a home dialect or language
variety is inherently deficient. Practice sentences must not supply prose for a
protected composition.

### 14.6 `WRITING`

Use when composing or improving a text is primary. The lesson must declare genre,
audience, purpose, process stage, rubric, model/mentor relationship, scaffold,
feedback opportunity, and independent authorship boundary. A planning lesson
needs an actual plan artifact; a revising lesson needs a before/after change; an
editing lesson needs focused convention work; a publication lesson needs a
defined audience and safe sharing choice. The graded final response always
remains learner-authored.

### 14.7 `RESEARCH_SOURCE_USE`

Use when inquiry, source evaluation, note-taking, synthesis, attribution, or
citation is primary. The lesson must provide an answerable inquiry purpose, a
rights-cleared and traceable source set, explicit source-use teaching, a model on
separate material, note-taking or evidence-capture structure, and independent
source decisions. It must distinguish quotation, paraphrase, summary, and the
learner's own reasoning; prevent fabricated sources/citations; and require
synthesis rather than a string of copied facts when more than one source is used.

### 14.8 `REVIEW`

Use to reconnect and interleave previously taught ELA learning. It must name the
skills being retrieved, provide only the refresh needed, use purposeful variety,
and include fresh text or language applications. Review is not a generic routine
or a repeated prompt with a different title. It should reveal which skill needs
follow-up without turning supported recall into mastery evidence.

### 14.9 `REMEDIATION`

Use to address one diagnosed prerequisite gap or observable misconception. It
must name the gap neutrally, reteach it differently, model the repaired thinking,
guide a new attempt, and provide a fresh independent recheck. Appropriate moves
include reducing navigation burden, using a shorter companion text, supplying
background knowledge, contrasting interpretations, or isolating a sentence or
paragraph. Do not automatically replace required grade-level text with a lower
text. Return to grade-level transfer before claiming grade-level success.

### 14.10 `MASTERY`

Use for focused, fresh, independent evidence of a previously taught skill. It
must identify the target skills and evidence occasions, use a fresh text/task,
contain more than one evidence point or a documented performance-task exception,
exclude preteaching and answer-bearing help before submission, and include
complete protected scoring authority. Support may occur after the evidence
event. Curriculum declares evidence requirements; runtime policy decides mastery
state.

### 14.11 `ASSESSMENT`

Use for diagnostic, interim, unit, or summative evidence under an approved
blueprint. The lesson must declare `assessment_purpose`, blueprint and standard
coverage, text/task dependencies, response modes, scoring method, and
construct-preserving accommodations. Assessment texts and prompts must be fresh and must
not be telegraphed by directions, prior items, or source commentary. Every
reported claim needs sufficient evidence or a documented performance-task
exception. No exact measured target is taught before a diagnostic or assessment
attempt.

## 15. Protected adult authority

Every scored or reviewable protected question must resolve to one protected-key
entry. The entry must contain:

- the question reference and measured skill/standard references;
- one bounded answer or rubric reference;
- source anchors and the reasoning that makes them relevant;
- acceptable variations or alternate interpretations;
- boundaries for unsupported, partial, or contradictory responses;
- relevant misconception identifiers; and
- scoring notes that do not infer effort, motivation, diagnosis, or character.

Constructed ELA responses often permit variation. The key should describe what
evidence and reasoning make an answer defensible, not force one sentence. For a
writing task, the key uses an analytic or task-appropriate rubric and anchor
evidence; it must not contain a “model answer” that a Tutor can hand to the
learner as the final response.

Protected content must not enter learner text, hints, titles, feedback, metadata,
filenames, or previews. Deliberate learner-facing model answers must be clearly
typed as models and use non-protected prompts.

## 16. Accessibility, safety, and dignity

Every lesson must offer access without unnecessary disclosure or shame. It must:

- use respectful language and observable descriptions of errors;
- permit a pause or alternate response mode when the standard allows it;
- avoid requiring autobiographical disclosure for sensitive writing;
- offer a fictional, analytical, or private alternative when personal response
  is not the construct;
- provide audio, transcript, captions, alt text, readable layout, keyboard
  access, or text-only fallback as applicable;
- distinguish an accommodation that preserves the construct from an adaptation
  that changes the claim; and
- document sensitive content and the instructional reason for including it.

Read-aloud is an access support only when it preserves the measured construct.
Speech-to-text may preserve a composition construct while not preserving a
spelling or handwriting construct. The curriculum must declare those boundaries;
the runtime applies approved learner accommodations.

## 17. Curriculum-side future Tutor metadata

The future `tutor_manifest` is a data-only inventory. It may name available
content and approved policy references; it does not implement Tutor V2 behavior.

| Field | Curriculum meaning |
| --- | --- |
| `lesson_id` / `lesson_profile` | Stable identity and dominant ELA contract |
| `skill_ids` | Skills taught or measured |
| `prerequisite_skill_ids` | Smallest relevant prerequisite skills |
| `misconception_ids` | Registered observable reading/language/writing patterns |
| `text_refs_by_role` | Model, guided, independent, transfer, research, and assessment supply |
| `teaching_block_refs` | Available explicit instruction |
| `model_refs` | Available non-protected models/think-alouds |
| `check_refs` | Observable comprehension checks |
| `guided_task_refs` | Supported learner attempts |
| `independent_task_refs` | Protected or independent evidence supply |
| `remediation_route_refs` | Data-only links from a misconception/prerequisite to approved content |
| `rubric_refs` | Learner-facing and protected scoring criteria |
| `hint_ladder_refs` | Authored graduated hints with answer-protection limits |
| `evidence_definitions` | Evidence type, skill, text/task, support condition, and independence requirement |
| `reading_access_policy_ref` | Approved relationship among reading level, text complexity, and access |
| `answer_policy_ref` | Approved answer/authorship boundary |
| `writing_authorship_policy_ref` | Approved graded-writing boundary |

All references must be stable, unique within a list, and resolvable in the
authoring set or approved registry. Tutor routes may identify a neutral signal,
an approved content strategy, and refs/parameters. They must not contain
free-form executable instructions, final answers, scoring authority, diagnoses,
provider prompts, or state-changing commands.

An evidence definition must distinguish at least `modeled`, `guided`,
`independent`, and `assessment` conditions. Curriculum may require independent
evidence and a fresh transfer. A future runtime records the actual conditions
and applies mastery policy.

## 18. Advisory machine-readable contract

`ELA_LESSON_CONTRACT_R1.schema.json` is a JSON Schema Draft 2020-12 design
artifact. It encodes the eleven profiles, text roles and complexity evidence,
burden plan, teaching/model/check/task structures, writing and revision
scaffolds, protected scoring entries, and future Tutor manifest.

The schema is deliberately advisory. It is not wired into Curriculum Studio,
release admission, Study Engine, or Tutor V2. It cannot decide whether a passage
is excellent, an interpretation is defensible, a scaffold reveals an answer, a
question is genuinely varied, or a rubric supports consistent human judgment.
Those require semantic checks and human review.

## 19. Draft quality gate

Gate mode for R1 is `ADVISORY_DRAFT`.

- `DRAFT_ERROR`: the lesson cannot claim draft conformance.
- `REVIEW_WARNING`: a human reviewer must accept or correct the finding.
- `ADVISORY_METRIC`: evidence only; never a sole accept/reject rule.

| Check ID | Detection | Draft severity |
| --- | --- | --- |
| `ELA-STRUCT-001` | Missing profile-required teaching, model, text, guided task, independent task, rubric, or assessment blueprint | `DRAFT_ERROR` |
| `ELA-TEXT-001` | Missing/unresolvable text, rights/provenance, learner access, or human complexity review | `DRAFT_ERROR` |
| `ELA-TEXT-002` | Formulaic shell, incoherent/low-quality text, factual integrity concern, or non-purposeful source reuse | `REVIEW_WARNING`; `DRAFT_ERROR` for fabricated or unusable source |
| `ELA-COMPLEXITY-001` | Grade-level reading claim lacks qualitative, quantitative, task, and human evidence | `DRAFT_ERROR` |
| `ELA-COMPLEXITY-002` | Alternate-complexity text is treated as equivalent grade-level reading evidence | `DRAFT_ERROR` |
| `ELA-BURDEN-001` | Missing burden plan or implausible combined reading/writing load | `DRAFT_ERROR` for missing; `REVIEW_WARNING` for fit |
| `ELA-TEACH-001` | Goal/directions are present but no lesson-specific explanation | `DRAFT_ERROR` for instruction-bearing profiles |
| `ELA-MODEL-001` | Required model lacks visible decision reasoning or uses the protected attempt | `DRAFT_ERROR` |
| `ELA-VOCAB-001` | Essential access vocabulary is unsupported, or an assessed word's answer is pre-taught | `DRAFT_ERROR` |
| `ELA-CHECK-001` | No embedded observable comprehension check or no defined feedback move | `DRAFT_ERROR` for instruction-bearing reading profiles |
| `ELA-GUIDED-001` | Guided work has no learner attempt, response-linked feedback, or support fading | `DRAFT_ERROR` |
| `ELA-INDEPENDENT-001` | “Independent” evidence is answer-bearing, copied, or missing an independence boundary | `DRAFT_ERROR` |
| `ELA-WRITING-001` | Writing scaffold is not stage/genre-specific or supplies graded final-response content | `DRAFT_ERROR` |
| `ELA-WRITING-002` | Writing classification contradicts the actual learner deliverable | `DRAFT_ERROR` |
| `ELA-RUBRIC-001` | Rubric is absent, generic, unavailable for learner use, or lacks observable scoring distinctions | `DRAFT_ERROR` when required |
| `ELA-REVISION-001` | Revision target is satisfied only by editing/proofreading or has no before/after evidence | `DRAFT_ERROR` |
| `ELA-QUESTION-001` | Question set is template-bound, cosmetically varied, unanswerable, or mismatched to the profile | `DRAFT_ERROR` for unanswerable/mismatched; otherwise `REVIEW_WARNING` |
| `ELA-LEAK-001` | Text, directions, question sequence, hint, feedback, or metadata reveals a protected answer/reasoning path | `DRAFT_ERROR` |
| `ELA-KEY-001` | Protected question lacks source/task-specific scoring authority | `DRAFT_ERROR` |
| `ELA-REMEDIATION-001` | Reteach is generic repetition, not tied to a diagnosed pattern, or never returns to grade-level transfer | `DRAFT_ERROR` |
| `ELA-MASTERY-001` | Mastery/assessment is pre-taught, not fresh, or supported evidence is represented as independent | `DRAFT_ERROR` |
| `ELA-REF-001` | Missing, duplicate, wrong-kind, or unresolved content/policy reference | `DRAFT_ERROR` |
| `ELA-LANGUAGE-001` | Learner prose contains production/engineering language or unclear, age-inappropriate directions | `DRAFT_ERROR` for internal language; otherwise `REVIEW_WARNING` |
| `ELA-READABILITY-001` | Readability, sentence, chunk, and time signals | `ADVISORY_METRIC` |

### 19.1 Future automated review outline

A future checker should:

1. Validate structure against the draft schema.
2. Resolve and type-check every text, task, model, rubric, key, policy, and Tutor
   reference.
3. Check profile-required supply and presentation order.
4. Confirm model/guided/independent text and task separation.
5. Compare protected anchors and answer phrases with learner text, directions,
   questions, hints, and feedback while excluding declared non-protected models.
6. Normalize passages and prompts for exact reuse and template similarity, then
   require human review of flagged purpose and cognitive demand.
7. Inspect question-family distribution, dependency, and whether an earlier item
   answers a later one.
8. Check vocabulary, burden, complexity, authorship, revision, and accommodation
   declarations.
9. Emit findings with check ID, severity, JSON path, evidence snippet, and review
   action.

Automation must not turn readability scores, word counts, lexical lists, or
similarity thresholds into sole quality judgments.

### 19.2 Human review required

Human reviewers must finally decide whether:

- the text is coherent, accurate, worthwhile, inclusive, and grade-appropriate;
- the combined text-task demand meets the standard;
- explicit teaching builds transferable understanding;
- the think-aloud reveals authentic reading/writing decisions;
- supports enable access without answering protected work;
- questions are answerable, varied, and cognitively meaningful;
- alternate interpretations are handled fairly;
- writing scaffolds protect authorship;
- rubrics and source anchors support consistent scoring; and
- remediation addresses the actual difficulty and returns to grade-level work.

## 20. Director sample and rollout boundary

The proposed future Director sample is
`ma-g7-english-language-arts-u05-l03`. It should be authored only in a later,
separately authorized session. The sample should demonstrate, at minimum:

- explicit teaching of reasoning and warrants;
- a model/think-aloud using a separate short argument;
- vocabulary support for relevant ELA and source terms;
- a guided claim-evidence-warrant attempt with feedback and fading;
- a quality independent source that does not announce the target reasoning;
- embedded comprehension checks that do not answer protected questions;
- an independently authored evidence-based response with a usable rubric;
- a substantive check/revision step;
- source-specific protected anchors and acceptable variation; and
- curriculum-side Tutor metadata with answer and writing boundaries.

No bulk ELA repair should begin until the Director approves or revises the
standard, the sample, the advisory contract, and the rollout/gate policy.

## 21. R1 draft conformance checklist

A reviewer may classify a lesson `ELA_R1_CONFORMING_DRAFT` only when:

- exactly one dominant ELA profile is declared and satisfied;
- every assigned text is available, rights-cleared, purposeful, and reviewed by
  a human for quality and complexity;
- student reading level, grade-level text complexity, and explanation language
  remain distinct;
- the reading/writing burden is documented and feasible;
- instruction-bearing profiles include substantive teaching and a valid model;
- vocabulary and comprehension support are present where needed;
- guided work includes attempt, feedback, and fading;
- independent evidence is fresh and answer-protected;
- writing scaffolds, rubric use, and revision match the task and preserve learner
  authorship;
- questions show purposeful ELA variety and do not telegraph later answers;
- remediation is diagnosis-specific and mastery/assessment evidence is fresh;
- every protected question has complete, source/task-specific adult authority;
- all references resolve and future Tutor metadata remains data-only; and
- human ELA, accessibility, authorship, source-integrity, and child-facing review
  is complete.
