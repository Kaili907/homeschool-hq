# Manuel Academy Arts + Music Lesson Standard R1

Status: **DRAFT FOR DIRECTOR REVIEW**

Applies to: Arts + Music, Grades 3, 4, 5, 7, 8, 9, 10, 11, and 12

Authoritative base for this draft:
`56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

Audit input: the completed 648-lesson Arts / Music Learner Depth Audit R1
classified the admitted corpus as structurally complete but requiring
instructional-depth and Tutor-readiness correction. This standard does not
repair or reclassify those lessons.

## 1. Purpose and authority

This document defines the curriculum content and curriculum metadata required
for a strong Manuel Academy Arts + Music lesson. Arts learning requires
perception, making, performance, analysis, choice, revision, and reflection;
the presence of directions, materials, a rubric, or an activity does not by
itself establish instructional depth.

R1 is a proposed authoring and review standard. It is not a production release
gate and does not authorize a bulk rewrite of the 648 admitted lessons. Before
any corpus-scale correction, the Director must review one complete sample
authored against the approved successor to this draft.

The proposed future Director sample is
`ma-g9-arts-and-music-u01-l02` — “Concept model A: advanced composition and
visual hierarchy.” This session does not rewrite that lesson.

The words **must**, **should**, and **may** have these meanings:

- **Must** is required for draft conformance unless a lesson-type contract
  explicitly makes it inapplicable.
- **Should** is the expected default; a reviewer may approve a documented,
  instructionally sound exception.
- **May** is optional.

## 2. Boundaries

This standard owns curriculum-side content and curriculum metadata only. It
does not implement or change Tutor V2, Study Engine, learner UI, provider
selection, memory, scoring runtime, mastery state, adaptive routing, dashboard,
release admission, or any other runtime.

Curriculum supplies explanations, demonstrations, references, practice,
creative constraints, alternatives, rubrics, and stable relationships among
them. A future approved runtime may select and pace that supply. It may not
invent missing instruction, turn a preference into a correctness rule, expose
protected assessment authority, or replace the child's creative product.

This draft also does not:

- rewrite any of the 648 admitted Arts + Music lessons;
- change their identities, schedules, bindings, packages, or scoring guides;
- require an instrument, camera, microphone, paid application, public post, or
  public performance;
- make visual, audio, or motion media mandatory when the target does not depend
  on that modality;
- treat a text description as a sufficient perceptual model when seeing,
  hearing, or observing the target is essential; or
- create one fixed answer for legitimate artistic or interpretive variation.

## 3. Core principles

Every conforming lesson follows these principles.

1. **Teach before demanding transfer.** A new concept or technique must be
   explained and demonstrated before independent use, except in a diagnostic,
   mastery, or protected assessment phase.
2. **Arts learning requires arts work.** When the target calls for making,
   performing, listening, observing, designing, composing, or analyzing, the
   learner must do that work. Passive reading cannot substitute for it.
3. **Models reveal decisions.** A model must show or make perceptible the
   relevant process, feature, or relationship, not merely name a finished
   outcome.
4. **Creative authority remains with the learner.** Models may be adapted;
   they are not templates the learner must copy. Legitimate variation is not
   an error.
5. **Criteria precede critique.** A Tutor, adult, or peer may critique observable
   evidence against stated criteria. Personal taste is not scoring authority.
6. **Access is planned, not improvised.** Required references and reasonable
   materials alternatives must be available when the lesson begins.
7. **Curriculum metadata describes supply.** It may identify concepts,
   techniques, common errors, models, rubrics, phases, supports, and age policy.
   It does not implement Tutor behavior.

## 4. Canonical lesson identity

Every lesson must declare one primary `lesson_type`. Integrated lessons may
declare secondary discipline tags, but one type owns the principal learning
goal and evidence contract. The type must be selected from the lesson focus,
not inferred from an unrelated unit topic, generic title, or first keyword
match.

The slash forms below are reader-facing labels. Their snake-case values are the
canonical authoring values.

| Canonical value | Reader-facing type | Primary purpose |
| --- | --- | --- |
| `VISUAL_ART_CONCEPT` | VISUAL_ART_CONCEPT | Build understanding of a visual element, principle, relationship, or visual-language concept. |
| `TECHNIQUE` | TECHNIQUE | Teach controlled use of a medium, tool, voice, body, notation system, or artistic process. |
| `ART_ANALYSIS` | ART_ANALYSIS | Observe, cite, interpret, compare, or evaluate artistic evidence. |
| `ART_HISTORY_CONTEXT` | ART_HISTORY / CONTEXT | Connect works, practices, people, places, purposes, and time periods using substantive sources. |
| `DESIGN` | DESIGN | Define a purpose or audience, generate choices, test constraints, and revise a solution. |
| `CREATION_STUDIO` | CREATION / STUDIO | Develop original visual, dramatic, movement, or cross-modal work through a studio process. |
| `MUSIC_CONCEPT` | MUSIC_CONCEPT | Build understanding of musical structure, notation, expression, form, texture, timbre, or related concepts. |
| `RHYTHM` | RHYTHM | Hear, represent, create, or perform pulse, meter, duration, subdivision, or rhythmic pattern. |
| `MELODY` | MELODY | Hear, represent, create, or perform pitch direction, interval, phrase, tonal center, or melodic contour. |
| `LISTENING` | LISTENING | Attend to an available sound example and make evidence-based identifications, comparisons, or interpretations. |
| `PERFORMANCE` | PERFORMANCE | Rehearse, interpret, and present music, theatre, movement, or another time-based work. |
| `COMPOSITION` | COMPOSITION | Generate, organize, notate or otherwise preserve, test, and revise original musical material. |
| `CRITIQUE_REFLECTION` | CRITIQUE / REFLECTION | Use evidence and criteria to examine work, process, intent, effect, or revision. |
| `REVIEW` | REVIEW | Reconnect and apply previously taught concepts or techniques in a purposeful combination. |
| `REMEDIATION` | REMEDIATION | Repair one named prerequisite gap or observable technique error through different instruction and a fresh attempt. |
| `MASTERY` | MASTERY | Gather fresh, appropriately independent evidence for one or more previously taught targets. |
| `PROJECT` | PROJECT | Plan, develop, revise, and present or privately submit a sustained product or performance across checkpoints. |

`ART_HISTORY_CONTEXT`, `REVIEW`, or another knowledge-centered type may include
brief making when it improves understanding. `CREATION_STUDIO`, `PERFORMANCE`,
`COMPOSITION`, and `PROJECT` may include reading or listening. In neither case
may a minor supporting activity replace the primary evidence named by the type.

### 4.1 Lesson type and phase are different

`lesson_type` identifies the dominant disciplinary demand. `phase` identifies
the lesson's place in an instructional arc. The existing phases may remain:

`PROBE`, `MODEL_A`, `GUIDED_A`, `APPLY`, `MODEL_B`, `GUIDED_B`, `INVESTIGATE`,
`RETEACH`, `INCREMENT`, `SYNTHESIZE`, `ASSESS`, and `CORRECT`.

A `TECHNIQUE` lesson may therefore occur in `MODEL_A`, `GUIDED_A`, `APPLY`, or
another phase. A lesson may use `REMEDIATION` as its primary lesson type when
repair is the entire purpose; a `RETEACH` phase alone does not prove that the
lesson supplies valid remediation. Neither field may be guessed by a runtime.

## 5. Shared lesson package contract

Every conforming lesson package must supply these coherent layers.

| Layer | Required curriculum supply |
| --- | --- |
| Identity and intent | Stable identity, grade, subject, canonical lesson type, phase, standards, target concepts or techniques, prerequisites, and a clear learning goal |
| Explicit teaching | Focus-specific definitions, mechanism or artistic relationship, vocabulary, uses and tradeoffs, and examples/non-examples where useful |
| Models and references | Delivered, rights-cleared model/reference content with instructional role, modality, accessibility route, and stable refs |
| Learner work | Clearly separated guided practice, independent making/performance/analysis, reflection, critique, and knowledge checks as applicable |
| Materials and access | Required materials, reasonable alternatives, optional enhancements, safety limits, and response/privacy alternatives |
| Protected authority | Objective constraints, judgment-based rubric anchors, acceptable variation, common technique-error definitions, and scoring notes |
| Tutor-readiness data | The closed, data-only curriculum manifest defined in Section 14 |

An author may omit a layer only when the lesson type or phase makes it
instructionally inappropriate. A `MASTERY` lesson, for example, must not teach
the exact target before evidence. A `LISTENING` lesson cannot omit its listening
reference. A creation lesson cannot replace independent work with a knowledge
check.

## 6. Explicit teaching standard

For a new or substantially new target, learner content must do more than insert
the focus name into a reusable process shell. It must:

- define the concept or technique in child-facing language;
- direct attention to the features the learner should see, hear, feel, or
  notice;
- explain how relevant choices or actions change the artistic effect;
- show when, why, or for what purpose the concept or technique may be used;
- explain at least one meaningful tradeoff, limitation, or contrasting choice
  when the target supports one;
- distinguish a successful example from a non-example or common misapplication
  when that distinction is useful;
- use the exact discipline vocabulary the learner needs and define it on first
  use; and
- connect the instruction directly to the upcoming guided work.

“Use contrast,” “practice rhythm,” “study the model,” or “create an original
piece” are directions, not explanations. A historical date list without source
context is not context teaching. A definition alone is insufficient when the
target is a perceptual or physical technique.

Teaching should be brief enough to use while making, but deep enough that a
learner can make a reasoned next choice. It must be specific to the named focus
and grade; substituting a new focus noun into unchanged prose does not conform.

## 7. Modeling and reference standard

### 7.1 Distinct instructional roles

A package must label each supplied artifact by role:

- **Technique model:** demonstrates how to perform a process, including material
  actions, sequence, decision points, and common trouble spots.
- **Worked artistic or musical example:** starts from a defined prompt and makes
  the creator's or performer's choices, intermediate states, and criteria-based
  reasoning visible or audible.
- **Finished exemplar:** shows one possible completed outcome and identifies the
  criteria it illustrates without implying that its style or solution is the
  required answer.
- **Partial exemplar:** shows an intermediate state so the learner can see what
  is established, what remains undecided, and what a next revision could test.
- **Reference work:** is observed, heard, read, or otherwise examined for
  analysis, context, inspiration, or comparison; it is not automatically a
  technique demonstration.

One artifact may serve more than one role only when each use is explicitly
authored. A generic resource description or media suggestion is not a delivered
model or reference.

### 7.2 Technique model

When the goal includes a technique, the model must:

1. show or make perceptible the starting state and setup;
2. divide the process into ordered, usable steps;
3. identify the action, feature, or sound to notice at each material step;
4. explain why the action supports the intended result;
5. include at least one intermediate state, short rehearsal loop, or partial
   attempt;
6. identify one or more observable common technique errors without labeling a
   stylistic preference as an error;
7. demonstrate a correction or recovery where safe and useful; and
8. end with criteria the learner can use in guided practice.

For a physical or material process, directions must include safe handling and
setup. For a vocal, instrumental, or movement process, directions must avoid
pain-based coaching and must say to stop or adjust if discomfort occurs.

### 7.3 Finished and partial exemplars

A finished exemplar is required when the learner needs to understand the scale,
integration, format, or quality of the expected work and those expectations
cannot be made clear with a partial example. A partial exemplar is preferred
when showing process will teach more than showing polish or when a finished work
would invite copying.

Where artistic choice is central, the package should provide two materially
different examples or explicitly identify plausible variations. Exemplars must
label which features are required, which demonstrate technique, and which are
the exemplar creator's optional choices.

Learners may borrow a demonstrated principle or process. They must not be
required to reproduce the exemplar's subject, melody, wording, composition,
style, interpretation, or aesthetic.

### 7.4 Step sequencing

All process-heavy lessons must provide an ordered learner sequence. Grades 3–5
must receive explicit chunked steps. Grades 7–12 may use connected prose only
when the steps remain individually identifiable, scannable, and resumable;
dense paragraph instructions are not a substitute for sequencing.

The sequence must identify:

- preparation and material setup;
- the first safe, achievable action;
- decision points that belong to the learner;
- practice or rehearsal loops;
- checkpoints for noticing against criteria;
- when support should fade;
- independent transfer; and
- cleanup, preservation, submission, or private presentation when applicable.

The sequence must not use adult-facing “The learner will” language in the child
projection. It must speak directly and respectfully to the learner.

### 7.5 Visual, audio, and motion references

The required modality follows the target, not the subject label.

- A visual target that depends on perceiving placement, value, color, texture,
  spatial relationship, tool angle, or motion must include a delivered visual
  or observable demonstration.
- A music or sound target that depends on hearing pulse, pitch, timbre, balance,
  articulation, phrasing, or form must include playable audio or a live/locally
  performable model.
- A theatre, movement, conducting, or performance target that depends on
  gesture, timing, blocking, breath, or bodily coordination must include an
  observable demonstration when text and notation cannot carry the target.
- A notation, history, context, planning, portfolio, or reflection target may
  be text-centered when its evidence does not depend on unavailable perception.

Required media must be attached or available through a tested, resolvable,
rights-cleared locator. “Find an example,” “teacher supplies,” or a suggestion
without an asset does not conform.

Every required visual must have useful alternative text or a tactile/verbal
parallel where appropriate. Every required audio or motion model must have a
transcript, notation, beat map, cue list, or other meaningful parallel. The
parallel route supports access; it does not excuse omission of a perceptual
model for learners whose target depends on that perception.

### 7.6 Worked musical or artistic example

A worked example must contain:

- a clear prompt, intention, or problem;
- the starting material or initial observation;
- ordered artistic decisions or performance actions;
- a perceptible intermediate state;
- an explanation of how each material decision serves the stated intent or
  criterion;
- the finished or intentionally partial result;
- a short criteria-based self-check; and
- one note about legitimate ways another learner's result could differ.

For music, the result may combine playable sound, notation, counting, solfege,
gesture, or another valid representation. For visual work, it may combine
rendered/photographed stages, annotations, diagrams, or a live local
demonstration. A prose description of an imagined result is not sufficient when
the target depends on hearing or seeing it.

## 8. Practice and learner-work standard

Lesson packages must label different kinds of learner work separately. One
generic “activity” field cannot stand in for all of them.

### 8.1 Guided technique practice

Guided practice must require the learner to act, make, perform, listen, mark,
compare, or analyze. It must not be another demonstration that the learner only
reads.

Guided practice should use short, low-stakes studies or rehearsal loops. It must:

- target the named concept or technique rather than generic participation;
- state the immediately observable criterion;
- provide a prompt, cue, scaffold, or bounded choice;
- include a learner attempt before showing a correction;
- support noticing and self-correction; and
- fade at least one support before independent transfer.

When a technique is physical or perceptual, the practice must use the relevant
mode or an explicitly equivalent accessible route. A vocabulary question alone
is not guided technique practice.

### 8.2 Independent creation, performance, or analysis

Independent work must be a fresh task, excerpt, reference, prompt, constraint
set, or artistic problem. It must require the learner to make meaningful
decisions rather than copy a model or fill blanks in a supplied product.

Depending on type, independent work must require genuine:

- creation or design;
- rehearsal and performance;
- composition or arrangement;
- listening and evidence-based response;
- visual or contextual analysis; or
- application of a technique in a new case.

The scale must be sufficient to reveal the target but need not force a large
finished product when a focused study is better evidence. The package must say
which supports are still permitted and which decisions must remain the
learner's own.

### 8.3 Reflection

Reflection asks the learner to examine their own intent, decisions, evidence,
process, effect, or revision. A substantive prompt must name what evidence to
use. Useful forms include:

- identify one decision and explain its intended effect;
- compare an earlier and later state;
- cite where the named technique is visible or audible;
- explain a tradeoff or constraint;
- name what was tested and what the evidence suggests; or
- choose a next revision and explain why.

“How did it go?” or “Reflect on your work” alone is not substantive reflection.
Reflection quality is judged by specificity and reasoning, not by whether the
learner praises or criticizes the work.

### 8.4 Critique

Critique must use a stated criterion and observable evidence. A useful critique
sequence is:

1. describe what is seen, heard, or experienced without judgment;
2. cite the relevant location, moment, feature, or process evidence;
3. connect that evidence to the creator's stated intent or rubric criterion;
4. ask a genuine question or name an effect; and
5. offer an option for revision without taking authorship.

Critique must remain respectful, private by default, and non-comparative among
children. A learner may critique their own work or an Academy-supplied work when
peer review is unavailable or unwanted. Public posting and public performance
must never be conditions of credit.

### 8.5 Knowledge checks

Knowledge checks may assess vocabulary, notation, factual context, sequence,
safety, perceptual identification, or conceptual relationships. They must use
fresh prompts and protect answers when used as evidence.

A knowledge check may be primary evidence for a knowledge-centered concept or
history lesson. It may support a technique, creation, performance, composition,
or project lesson, but it cannot replace the required artistic work.

### 8.6 Separation and projection

Guided practice, independent work, reflection, critique, and knowledge checks
must have separate identifiers or clearly typed blocks. Learner projection must
preserve their order, criteria, materials, references, and support conditions.
Scoring must not silently treat supported practice as independent mastery.

## 9. Lesson-type evidence requirements

The matrix defines the minimum evidence shape. It does not require every lesson
to contain every possible activity.

| Lesson type | Required instructional supply | Required primary learner evidence |
| --- | --- | --- |
| `VISUAL_ART_CONCEPT` | Definition, perceptible examples/contrasts, visual relationship and effect | Noticing plus application in a study, analysis, or original choice |
| `TECHNIQUE` | Stepwise technique model, safety where relevant, common-error contrast, guided attempt | Observable use of the technique in a fresh study or performance |
| `ART_ANALYSIS` | Substantive available work, observation method, vocabulary, model analysis on a separate feature/work | Evidence-cited description, interpretation, comparison, or evaluation |
| `ART_HISTORY_CONTEXT` | Rights-cleared substantive sources, context, source/provenance guidance, distinction between evidence and inference | Evidence-based connection, analysis, comparison, or contextual response |
| `DESIGN` | Purpose/audience, constraints, examples, ideation and testing method | Original options, selected solution, test evidence, and revision rationale |
| `CREATION_STUDIO` | Relevant concept/technique teaching, process model, criteria, and choice boundaries | Original making with process evidence and criteria-based reflection/revision |
| `MUSIC_CONCEPT` | Definition, audible/visible representation, contrast, and worked musical example | Identification plus application in notation, listening, creation, or performance |
| `RHYTHM` | Audible or performable model, count/notation/gesture parallel, guided loop | Fresh rhythmic creation, representation, analysis, or performance |
| `MELODY` | Audible or performable phrase model, contour/pitch representation, guided loop | Fresh melodic creation, representation, analysis, or performance |
| `LISTENING` | Delivered audio/live model, replayable excerpt/cues, listening focus and comparison method | Time- or feature-anchored identification, comparison, or interpretation |
| `PERFORMANCE` | Technique/interpretation model, rehearsal plan, safety, and performance criteria | Rehearsal evidence plus live, private, or equivalent performance evidence |
| `COMPOSITION` | Worked compositional example, constraints, preservation method, and revision model | Original musical choices, preserved draft/result, and criteria-based revision |
| `CRITIQUE_REFLECTION` | Criteria, critique protocol, and a modeled evidence-based comment | Specific evidence, reasoning, and a learner-owned revision decision where applicable |
| `REVIEW` | Brief reconnect to previously taught targets and purposeful interleaving | Fresh combined application, not isolated recall only |
| `REMEDIATION` | Named gap/error, different explanation/model, smaller guided attempt | Fresh retry followed by independent transfer when appropriate |
| `MASTERY` | Evidence purpose and response conditions; no preteaching of exact target | Fresh independent evidence across the target's required modes |
| `PROJECT` | Milestones, models as needed, criteria, material plan, and revision checkpoints | Sustained original product/performance, process evidence, and reflection |

## 10. Creative authority and scoring

### 10.1 The learner owns the creative product

The learner retains authority over subject, style, interpretation, expressive
choice, revision choice, and final product except where the lesson states a
necessary, instructionally valid constraint. A model demonstrates possibility,
not the one correct outcome.

A Tutor, adult, or peer may:

- restate a criterion;
- direct attention to observable evidence;
- identify whether an objective constraint is present;
- model a technique on a parallel example;
- ask what effect the learner intends;
- describe a mismatch between stated intent and observable evidence;
- offer two or more revision strategies; and
- invite the learner to choose, test, keep, or reject a revision.

They must not:

- redraw, rewrite, recombine, compose, perform, or finish the child's product;
- dictate a preferred aesthetic, interpretation, theme, or style;
- replace the learner's idea with a “better” idea;
- treat difference from an exemplar as error;
- require revision solely because the reviewer dislikes the result; or
- present a complete graded solution for the learner to copy.

### 10.2 Objective criteria

Objective criteria are binary, countable, directly observable, or bounded by an
explicit technical convention. Examples include:

- required duration, beat count, number of studies, cited sources, or submitted
  process stages;
- use of a named element, compositional device, notation feature, safe setup, or
  required format;
- rhythmic alignment, specified pitch sequence, entrance, cutoff, or technical
  action when exactness is part of the stated target;
- presence of evidence at a cited moment or location; and
- compliance with rights, privacy, material, or safety constraints.

An objective criterion must state its boundary before the attempt. “Accuracy”
or “fidelity” without naming what must be accurate does not conform.

### 10.3 Judgment-based and subjective criteria

Some arts criteria require informed judgment rather than one fixed answer.
Examples include:

- clarity of visual hierarchy relative to the learner's stated intent;
- control and consistency of a technique across a passage or study;
- effectiveness of contrast, pacing, phrasing, balance, or emphasis;
- strength of evidence used in an interpretation;
- coherence of artistic decisions;
- responsiveness of a revision to observed evidence; and
- quality of reflection or critique reasoning.

These criteria must use observable anchors and performance-level descriptors.
They may accept multiple defensible outcomes. The reviewer judges the evidence
against the criterion, not whether the work matches the reviewer's taste.

Pure preference—favorite color, genre, subject, medium, style, mood, or
interpretation—is not a scored criterion unless the learner is explaining and
supporting their own preference as the task.

### 10.4 Rubric structure

A conforming rubric must separate, where applicable:

1. **Objective constraints** — what is present, complete, safe, or conventionally
   correct.
2. **Technique evidence** — what observable control or application demonstrates
   the named technique, while allowing valid forms.
3. **Intent and interpretation** — how evidence supports the learner's stated
   purpose or defensible reading.
4. **Process and revision** — what was tried, noticed, reasoned about, and
   revised.

Each dimension must be focus-specific. A generic completion/evidence/revision
rubric or generic “accuracy/fidelity” dimension cannot establish R1 depth.
“Answers will vary” must be followed by acceptable-evidence boundaries.

Knowledge-check keys may contain exact or bounded answers. Analysis keys must
name evidence anchors and acceptable reasoning without requiring one
interpretation when the source supports several. Creative tasks require rubric
authority, not a fixed-answer key.

## 11. Materials, equipment, and alternatives

Every package must divide its material plan into:

- **Required:** the minimum available materials or equipment needed to access
  the target;
- **Approved alternatives:** realistic substitutions that preserve the learning
  goal and credit;
- **Optional enhancements:** specialized tools, instruments, media, software,
  or materials that may enrich the work but cannot affect credit; and
- **Safety/access notes:** setup, handling, cleanup, volume, movement, privacy,
  sensory, motor, or other relevant limits.

Materials named as required must be common household/classroom materials,
included in the supplied kit, or confirmed available before assignment. A
lesson cannot direct a learner to begin and then depend on an uncommon paint,
instrument, cutting tool, kiln, press, paid application, or recording device
with no valid route forward.

Reasonable alternatives should be named concretely, for example:

- artist pencil / ordinary pencil / pen / accessible digital mark-making tool;
- art paper / printer paper / scrap paper / reusable drawing surface;
- percussion instrument / body percussion / found safe sound source / accessible
  digital instrument;
- staff paper / plain-paper grid / manipulatives / approved notation tool;
- live presentation / private adult observation / written or notated process
  evidence when the target permits it; and
- physical collage pieces / drawn arrangement / accessible drag-and-drop layout.

An alternative must preserve the target, not merely preserve activity. If the
lesson specifically teaches watercolor wash, bow hold, pottery wheel control,
ensemble balance, or another material-dependent technique, the package must
either supply access to that material/equipment or be labeled unavailable until
access exists. It must not award the same technique claim for unrelated pencil
or written work.

When the target allows choice of medium, alternatives receive equal credit.
When an accommodation changes the measured construct, the package must state
what evidence can and cannot be claimed.

No lesson may require public posting, public performance, photographic proof,
audio/video recording, a personal account, or identifiable learner media for
credit. A private, no-recording route must exist. Silence, notation, text,
gesture, or another access route may be equal-credit when it preserves the
target; it must not be used to claim listening or performance evidence that was
not actually demonstrated.

## 12. Age, language, and dignity

All learner-facing content must:

- speak directly to the learner using concrete, respectful language;
- define new arts vocabulary at first use while retaining correct discipline
  terms;
- separate directions from criteria and scoring notes;
- give one action at a time when sequence matters;
- keep internal generator, engineering, automation, and runtime language out of
  learner content;
- avoid shaming language about talent, taste, error, skill, body, voice, culture,
  or prior access;
- represent artistic traditions and creators with contextual accuracy and
  respect; and
- avoid assuming that the learner has a particular home, culture, instrument,
  performance background, or adult arts expertise.

Terms such as “signal,” “fresh item,” “defect,” “solution code,” “break your
result,” “accurate independent application,” and “error pattern” are not
child-facing Arts coaching. A learner should see a concrete artistic cue such as
“Try the four-beat pattern once more and listen for the rest in beat 3.”

### 12.1 Grades 3–5

Grades 3–5 must receive short sections, explicit chunked steps, concrete examples,
and visible or audible cues close to the action they explain. Abstract terms
such as evidence, composition, fidelity, public domain, interpretation, or
documented process must be defined in immediate context or replaced with a
clearer phrase when the technical term is not needed.

Directions should ordinarily use one action per step. Reflection prompts must
name the feature to notice. Scoring language belongs in child-facing success
criteria only when it helps the child self-check.

### 12.2 Grades 7–8

Grades 7–8 may use longer artistic processes and established vocabulary, but
must still make steps, criteria, choices, and stopping points scannable.
Assignments should distinguish independent choice from non-negotiable
constraints. Engineering metaphors must not replace discipline-specific Arts
language.

### 12.3 Grades 9–12

Grades 9–12 may use discipline-specific analysis, historical context, critique,
and sustained studio or rehearsal plans. Advanced terminology must still be
defined when new, and an “advanced” title must correspond to more demanding
perception, technique, decision-making, integration, or transfer—not merely
longer prose or an adult register.

## 13. Review, remediation, mastery, and project detail

### 13.1 Review

A `REVIEW` lesson must name the previously taught concepts or techniques,
provide only the reconnect needed, and ask the learner to combine or distinguish
them in fresh work. Unrelated recall questions or repetition of the same generic
activity shell do not constitute review.

### 13.2 Remediation

A `REMEDIATION` lesson must focus on one prerequisite gap or one registered
`common_technique_error_id`. It must provide:

- a neutral description of the observable mismatch;
- a different explanation, representation, demonstration, material route, or
  reduced step;
- one or more supported attempts;
- a self-noticing cue tied to the criterion; and
- a fresh retry or transfer task when appropriate.

Remediation is different instruction, not “try again,” “correct the error,” or
more of the same prompt. It must not diagnose intent, talent, care, motivation,
or taste from an artistic result.

### 13.3 Mastery

A `MASTERY` lesson gathers fresh independent evidence after instruction. It must
not show the exact solution, continuation, interpretation, or product before the
attempt. Evidence quantity follows the target:

- a factual or notation claim needs more than one evidence point unless a
  protected blueprint documents an exception;
- a technique claim should include repeated control or transfer, not one lucky
  moment;
- an analysis claim requires observation plus evidence-based reasoning;
- a creation, composition, or performance claim may use one substantive work
  when its rubric contains enough independent evidence dimensions and process
  checkpoints; and
- a reflection alone cannot establish mastery of a making or performance target.

Curriculum states the evidence contract and rubric. A separately approved
runtime decides mastery state.

### 13.4 Project

A `PROJECT` must have a bounded purpose, milestones, materials plan, criteria,
and at least one revision checkpoint. It must protect learner choice while
naming non-negotiable constraints. Process evidence should be lightweight and
useful, not a demand for continuous surveillance or media proof.

A project cannot be a title followed by “make something.” It also cannot become
passive because all instructional time is spent reading about what could be
made. The learner must plan, produce or perform, inspect against criteria, and
revise or justify a deliberate decision.

## 14. Curriculum-side Tutor-readiness manifest

R1 permits a closed, curriculum-data-only manifest. It describes authored
supply and approved support boundaries; it does not implement Tutor V2 or any
runtime.

The allowed fields are:

| Field | Curriculum meaning |
| --- | --- |
| `concept_ids` | Stable identifiers for the concepts directly taught, practiced, or measured |
| `technique_ids` | Stable identifiers for the artistic or musical techniques directly taught, practiced, or measured |
| `prerequisite_concept_ids` | Smallest concepts needed before the target |
| `prerequisite_technique_ids` | Smallest techniques needed before the target |
| `common_technique_error_ids` | Registered observable technique mismatches relevant to this lesson; never taste, intent, style, or preference labels |
| `reference_refs` | Resolvable references to works, excerpts, sources, listening selections, or context materials |
| `model_refs` | Resolvable references to technique models, worked examples, and finished/partial exemplars |
| `rubric_refs` | Resolvable focus-specific rubric or criterion-set references |
| `phase` | The authored instructional phase; not a runtime state |
| `allowed_support` | Closed identifiers for supports for which usable curriculum content exists |
| `age_policy_ref` | Reference to the approved learner-language, safety, and age policy |

All IDs and refs must be stable, unique within their arrays, type-correct, and
resolvable in the authoring set or an approved registry. Every model and
reference ref must resolve to content actually available to the learner, adult,
or approved future runtime under its declared role and access rules.

`common_technique_error_ids` must describe visible, audible, notated, or
otherwise observable evidence against a stated objective or technique boundary.
Examples may include an unintended break in a required steady pulse, unsafe tool
angle, missing breath release, or omission of a required citation. “Uncreative,”
“bad style,” “wrong mood,” “poor taste,” or difference from a model can never be
registered technique errors.

`allowed_support` may identify curriculum supply such as:

- `DEFINE_TERM`;
- `DIRECT_ATTENTION`;
- `REPLAY_OR_REVIEW_MODEL`;
- `BREAK_PROCESS_INTO_STEPS`;
- `OFFER_PARALLEL_EXAMPLE`;
- `ASK_NOTICING_QUESTION`;
- `RESTATE_CRITERION`;
- `PROMPT_SELF_EVALUATION`;
- `SUGGEST_APPROVED_MATERIAL_ALTERNATIVE`;
- `GUIDE_SAFE_TECHNIQUE`; and
- `INVITE_LEARNER_CHOSEN_REVISION`.

The field lists available support content. It does not decide when a support is
used, execute a support, record learner state, score work, or authorize an AI.
It cannot authorize completing work, replacing a product, choosing the child's
artistic intent, exposing a protected answer, or declaring taste incorrect.

No Tutor routes, signals, strategies, actions, provider instructions, memory,
mastery decisions, scoring commands, runtime parameters, or answer-delivery
logic belong in this manifest. Any future Tutor V2 work requires a separate
approved runtime contract.

## 15. Reference integrity, rights, and cultural context

Every supplied model, artwork, score, recording, excerpt, script, image, video,
or source must declare provenance, rights or permitted use, creator attribution
where applicable, and an instructional role. Academy-created material must be
labeled as such; it must not be presented as a historical or culturally
authentic work when it is invented for instruction.

Context lessons must use substantive, accurate sources appropriate to the claim.
A generic invented description may demonstrate an analysis process, but it
cannot stand in for learning about a real creator, tradition, community, event,
or historical context.

Adaptations, excerpts, transcriptions, translations, and reconstructions must be
labeled. Critique must distinguish evidence in a work from claims about a
creator or culture. Cultural practice must not be reduced to a decorative style
prompt or imitation exercise without context and respect.

## 16. Draft quality gate

Gate mode for R1 is `ADVISORY_DRAFT`. Findings belong in a lesson review report
and do not block the global release until the Director approves the standard,
sample, thresholds, exceptions, and rollout plan.

Proposed severities:

- `DRAFT_ERROR`: the package cannot claim R1 draft conformance.
- `REVIEW_WARNING`: a qualified human must accept or correct the finding.
- `ADVISORY_METRIC`: evidence only; never the sole accept/reject rule.

| Check ID | Detection | Draft severity |
| --- | --- | --- |
| `AM-TYPE-001` | Missing/noncanonical primary lesson type or type inferred from an unrelated topic | `DRAFT_ERROR` |
| `AM-DEPTH-001` | New target is named but not defined, explained, contrasted, or connected to learner action | `DRAFT_ERROR` |
| `AM-MODEL-001` | Required model is absent, profile-generic, answer-only, or lacks focus-specific process/decision evidence | `DRAFT_ERROR` |
| `AM-MODEL-002` | Technique model lacks sequence, intermediate state, noticing cue, rationale, or applicable safety | `DRAFT_ERROR` |
| `AM-PERCEPTUAL-001` | Seeing, hearing, or observing is essential but only text or a media suggestion is supplied | `DRAFT_ERROR` |
| `AM-REF-001` | Required model/reference is missing, unresolved, wrong-role, rights-unclear, or inaccessible | `DRAFT_ERROR` |
| `AM-SEQUENCE-001` | Process-heavy task lacks usable ordered, resumable learner steps | `DRAFT_ERROR` |
| `AM-PRACTICE-001` | Guided practice is passive, does not target the named skill, or never fades support | `DRAFT_ERROR` for passive/mistargeted; `REVIEW_WARNING` for fading |
| `AM-INDEPENDENT-001` | Making/performance/analysis target lacks genuine fresh independent work | `DRAFT_ERROR` |
| `AM-WORKTYPE-001` | Guided, independent, reflection, critique, or knowledge-check work is conflated or scored under the wrong evidence condition | `DRAFT_ERROR` |
| `AM-REFLECT-001` | Reflection or critique is generic and provides no criterion or evidence anchor | `REVIEW_WARNING` |
| `AM-AUTHORITY-001` | Legitimate creative variation is treated as incorrect or difference from a model is penalized | `DRAFT_ERROR` |
| `AM-AUTHORITY-002` | Tutor/adult support would replace, finish, or dictate the child's creative product | `DRAFT_ERROR` |
| `AM-RUBRIC-001` | Objective constraints and judgment-based criteria are not distinguished | `DRAFT_ERROR` |
| `AM-RUBRIC-002` | Generic accuracy/fidelity, completion, or “answers vary” language lacks focus-specific anchors | `DRAFT_ERROR` |
| `AM-MATERIAL-001` | Required uncommon material/equipment is unavailable and no goal-preserving alternative exists | `DRAFT_ERROR` |
| `AM-MATERIAL-002` | Alternative changes the measured construct but claims equal evidence without disclosure | `DRAFT_ERROR` |
| `AM-PRIVACY-001` | Credit requires public posting/performance, personal account, or media proof | `DRAFT_ERROR` |
| `AM-AGE-001` | Learner content uses adult/meta/engineering language, malformed generator prose, undefined terminology, or unchunked directions | `DRAFT_ERROR` for exposed internal language/malformed prose; `REVIEW_WARNING` for density |
| `AM-REMEDIATE-001` | Remediation is generic retry language or lacks a named prerequisite/error and alternate instruction | `DRAFT_ERROR` |
| `AM-MASTERY-001` | Mastery evidence is cued, copied, single-form when repeat/transfer is needed, or substitutes reflection for the target art work | `DRAFT_ERROR` |
| `AM-TUTOR-001` | Tutor-readiness manifest includes fields outside the Section 14 allowlist or contains runtime behavior | `DRAFT_ERROR` |
| `AM-METADATA-001` | Concept, technique, error, model, reference, rubric, phase, support, or policy ref is missing, duplicate, wrong-kind, or unresolved | `DRAFT_ERROR` |
| `AM-CULTURE-001` | Context claim lacks substantive source support or invented material is presented as authentic history/culture | `DRAFT_ERROR` |
| `AM-DUPLICATE-001` | Focus substitution leaves the teaching/model/rubric materially unchanged across different targets or grades | `REVIEW_WARNING`; `DRAFT_ERROR` when required focus-specific content is absent |

### 16.1 Automated implementation outline

A future checker should:

1. Validate identity, canonical type, phase, required blocks, and allowed Tutor
   manifest fields.
2. Resolve and type-check all concept, technique, error, model, reference,
   rubric, support, and policy identifiers.
3. Verify that required resources are delivered, rights-declared, role-labeled,
   and paired with appropriate accessibility routes.
4. Check that process tasks contain ordered steps and that work blocks are typed
   as guided, independent, reflection, critique, or knowledge check.
5. Compare objective rubric constraints with prompts and common-technique-error
   definitions.
6. Scan for generic focus substitution, duplicate model/rubric cores, adult
   voice, malformed joins, engineering language, public/media requirements, and
   unavailable materials.
7. Check projection integrity so models, references, materials, work types,
   criteria, and alternatives reach the learner in the authored order.
8. Produce a per-finding path, check ID, severity, evidence snippet, and review
   action.

Automation may flag likely semantic problems; it cannot decide artistic quality,
cultural authenticity, pedagogical value, legitimate variation, or whether a
demonstration makes a technique perceptible.

### 16.2 Human review required

Qualified human review must decide whether:

- the explanation builds accurate disciplinary understanding;
- the model is perceptible, grade-appropriate, and specific to the target;
- the practice genuinely prepares independent artistic work;
- the reference is substantive and culturally/contextually responsible;
- the rubric makes objective constraints and open choices clear;
- critique preserves the learner's authorship;
- the materials route preserves the intended construct;
- the common technique errors are observable and not disguised preferences;
- the evidence is sufficient for the lesson type; and
- the language, workload, safety, and access plan fit the intended age.

Those are required review questions, not reasons to omit automated evidence.

## 17. Future Director sample and rollout boundary

The proposed Director sample is
`ma-g9-arts-and-music-u01-l02` — “Concept model A: advanced composition and
visual hierarchy.” It must not be rewritten as part of this standards session.

A future sample authored in its own bounded session should demonstrate:

- correct `VISUAL_ART_CONCEPT` or other Director-approved canonical type
  classification based on the actual target;
- focus-specific concept and technique identifiers with real prerequisites;
- a grade-appropriate explanation of visual hierarchy, mechanism, choices, and
  tradeoffs;
- an annotated, rendered visual model plus a meaningful accessible parallel;
- a worked decision sequence with an intermediate state;
- brief guided noticing/manipulation before independent transfer;
- separate independent creation, reflection, critique, and any knowledge check;
- a focus-specific rubric separating objective constraints, technique evidence,
  intent, interpretation, and legitimate variation;
- observable common-technique-error IDs and data-only allowed support;
- practical materials alternatives and Grade 9 language; and
- no Tutor V2 runtime implementation.

After Director review, any propagation must be generator-aware and separately
authorized. The recommended order is one secondary visual `MODEL_A` family,
then age-adjusted visual model/guided families, then discipline-appropriate
music, theatre/movement, context, portfolio, and cross-modal families, followed
by the remaining phases. A noun-substitution rewrite is not acceptable.

No bulk lesson correction should begin until the Director approves or revises
the sample, standard, metadata vocabulary, rubric authority, gate policy, and
rollout plan.

## 18. R1 draft conformance checklist

A reviewer may classify a lesson `ARTS_MUSIC_R1_CONFORMING_DRAFT` only when:

- the primary canonical lesson type and authored phase are correct;
- the learning goal names substantive artistic knowledge or action;
- new concepts and techniques receive focus-specific explanation;
- appropriate technique models, worked examples, exemplars, and references are
  delivered and accessible;
- process steps are ordered, child-facing, and usable;
- guided practice requires genuine learner action and fades support;
- independent making, performance, listening, analysis, or transfer matches the
  declared type;
- reflection, critique, and knowledge checks are separated and substantive when
  applicable;
- objective rubric criteria and judgment-based criteria are explicitly
  distinguished;
- legitimate creative variation and learner product authority are protected;
- materials are available or have goal-preserving alternatives, with safety and
  privacy routes;
- age and discipline language are appropriate and free of generator/engineering
  residue;
- review, remediation, mastery, or project requirements are satisfied when that
  type is declared;
- references, rights, provenance, and cultural context are sound;
- all Tutor-readiness IDs and refs resolve, the manifest uses only the closed
  Section 14 allowlist, and no Tutor V2 behavior is present; and
- qualified human artistic, instructional, cultural, accessibility, and
  child-facing review is complete.
