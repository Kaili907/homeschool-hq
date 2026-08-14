# Manuel Academy Physical Education Lesson Standard R1

Status: **DRAFT FOR DIRECTOR REVIEW**

Applies to: Physical Education lessons, Grades 3–5 and 7–12

Advisory metadata contract:
`PHYSICAL_EDUCATION_LESSON_ADVISORY_CONTRACT_R1.schema.json`

Base for this draft: `a7c6edee867e0d3f546aaa6e0442fac434b75c84`

Audit input: **Health + PE Learner Depth Audit R1**, pinned to
`56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`

## 1. Purpose and authority

This standard defines what a teaching-quality Manuel Academy Physical
Education lesson must supply. A strong PE lesson gives the learner a clear
movement or activity goal, an observable model, an executable practice
progression, equal-credit adaptations, explicit stop/rest rules, appropriate
evidence, retry, and reflection.

The standard applies whether the learner performs movement, uses an adapted
movement path, or completes a description/decision route because movement is
not appropriate. It values safe learning, skill, decisions, self-management,
and understanding. It does not rank bodies or reward risk-taking.

The words **MUST**, **MUST NOT**, **SHOULD**, and **MAY** are normative. A
documented, instructionally sound exception may satisfy a **SHOULD**. It cannot
waive a **MUST** or **MUST NOT**.

R1 is a draft authoring and human-review standard. It is not a production gate,
a fitness prescription, a medical clearance, or authority to rewrite the
current PE corpus.

## 2. Audit basis

The audit inspected all 972 active PE lesson packages and paired scoring guides
across grades 3, 4, 5, and 7–12. Grade 6 had no authored PE course in the
audited corpus.

Strengths to preserve include:

- 972/972 lessons contain a setup-to-finish progression;
- 972/972 contain warm-up and cool-down, cleared-space and equipment
  directions, explicit stop conditions, and learner reporting;
- 972/972 provide seated, supported, reduced-range, reduced-pace, solo, and
  no-equipment routes that promise equal credit; and
- 972/972 prohibit body data, fitness scores, recorded-media proof, learner
  comparison, maximal effort, exercise as punishment, and movement through
  pain.

The standard directly answers these audit findings:

- 756 lessons lacked a lesson-specific demonstration or common-error model;
- all 972 lessons contained at least one composite, multi-action step even
  though the curriculum promised one-action chunking;
- 297 grades 5, 7, and 8 tasks used focus-interpolated application shells;
- 679 lessons exceeded the audit's advisory reading screen;
- two Grade 12 stop-decision lessons received mismatched locomotor cues; and
- 216 high-school transfer task/rubric authorities conflicted with their own
  equal-credit safe alternative.

The user-directed scope for this standard is lesson-quality design. It does
**not** continue PE transfer-authority validator hardening. The conflict is an
audit basis for clear precedence and authoring rules only.

## 3. Scope and non-goals

This standard governs learner-facing curriculum, protected adult authority,
and future curriculum metadata. It does not implement or change Tutor V2,
Study Engine, learner UI, device sensing, camera use, wearable integration,
completion runtime, scoring runtime, guardian workflow, or release gates.

This standard does not authorize a lesson, author, reviewer, or future Tutor to:

- prescribe individualized exercise, rehabilitation, treatment, or medical
  clearance;
- diagnose a condition or infer health, disability, effort, motivation, or
  character from performance;
- certify that a learner physically completed an activity;
- override a learner's stop/rest decision or a guardian/professional safety
  boundary;
- require movement through pain, unsafe conditions, excessive fatigue, or
  distress;
- score body size, weight, body composition, appearance, calorie expenditure,
  fitness norms, percentile rank, speed alone, or comparison with another
  person; or
- punish, lower credit, or label a learner for disability, adaptation, assistive
  technology, rest, reduced intensity/range, described evidence, or declining
  an unsafe path.

## 4. Core terms

**PE lesson type** is the lesson's dominant instructional purpose. Every lesson
declares exactly one primary type and may declare up to two secondary types.

**Movement/activity goal** states what movement, tactic, safety decision,
self-management process, or activity understanding the learner will develop
and what successful evidence looks like.

**Movement model/demonstration** is an accessible visual, live, illustrated,
video, tactile, or precisely described example that shows the target sequence,
critical cues, safe range, common error, and stop/rest boundary. Directions
alone are not a model.

**Practice progression** is an ordered change from simple/familiar/low-demand
practice toward the independent target. It changes one meaningful variable at
a time where practical.

**Adaptation** changes presentation, body position, range, pace, space,
equipment, partner structure, or response form while preserving the target
skill, decision, or concept.

**Alternative route** is a complete equal-credit way to demonstrate the target
when the standard movement path, space, equipment, group, supervision, or real
activity is unavailable or inappropriate.

**Independent performance/activity** is a fresh learner attempt in which the
learner applies the target cues or decisions without answer-bearing coaching.
It may still include required observation, permission, safety support, mobility
support, or an approved described route.

**Physical completion** means the real activity occurred. Learner self-report
or Tutor conversation does not certify physical completion when authorized
adult observation or confirmation is required.

## 5. PE lesson types

Every lesson MUST select the type matching the central learner outcome, not a
word in the title or focus field.

| Type key | Use when the central outcome is... | Required distinguishing supply |
| --- | --- | --- |
| `MOVEMENT_CONCEPT_CUES` | understanding movement principles, vocabulary, body/space relationships, or critical cues | concept explanation, cue model, examples/non-examples, understanding check, and a movement, gesture, sorting, or described application |
| `SKILL_DEVELOPMENT` | learning or refining a locomotor, non-locomotor, manipulative, rhythmic, aquatic, outdoor, or other movement skill | lesson-specific demonstration, critical cues, common/safety-critical errors, warm-up when applicable, progressive practice, independent attempt, and equal-credit adaptations |
| `TACTICS_DECISION_MAKING` | reading a situation and selecting position, timing, spacing, cooperation, or strategy | situation model, options and constraints, guided decision practice, fresh application, and a solo/described route if opponents or groups are unavailable |
| `FITNESS_SELF_MANAGEMENT` | planning, monitoring, pacing, recovering, or making safe activity choices | non-prescriptive activity goal, self-selected intensity/range, talk/comfort or approved non-body-data cues, rest/stop plan, progression, and no norm/body scoring |
| `SAFETY_STOP_DECISION` | identifying hazards, warning signs, stop/rest/escalation decisions, or safe return boundaries | decision model rather than generic movement cues, fictional/supplied situations, no induced symptom/event, stop and escalation authority, and described evidence route |
| `COOPERATIVE_CREATIVE_ACTIVITY` | communicating, collaborating, creating movement, officiating, leading, or participating responsibly | role/interaction model, consent and space rules, solo/non-public alternative, contribution criteria, and no audience or real-group requirement unless separately authorized |
| `REVIEW_RETRIEVAL` | retrieving, combining, or transferring already taught PE learning | named prior targets, brief re-model where needed, varied practice, feedback, and a fresh application; untaught movement may not be presented as review |
| `REMEDIATION_RETRY` | rebuilding a named cue, decision, sequence, or safety understanding | neutral observable signal, simpler safe version, alternate model/cue, bounded practice, fresh retry, and exit criterion |
| `MASTERY_PERFORMANCE` | collecting independent evidence for a previously taught target | fresh performance/activity or described equivalent, permitted support, authorized evidence observer, later retrieval/transfer, and no body/norm scoring |
| `PROJECT_LIFETIME_ACTIVITY` | integrating planning, participation, safety, self-management, or advocacy across sessions/settings | staged plan, access/equipment/permission check, complete simulation or described alternative, bounded evidence, honest duration, and guardian authority where required |

A lesson may include a concept check inside a movement session or a safety
decision inside skill practice. The primary type determines the central
independent evidence and the model that must be supplied. A category label does
not prove instructional fit.

## 6. Universal PE lesson package

Every conforming PE lesson MUST contain or resolve the following supply.

| Contract area | Minimum curriculum supply |
| --- | --- |
| Identity and intent | Stable lesson ID, grade/band, course/unit, primary type, standards, concept/skill IDs, target cues/decisions, and evidence purpose |
| Activity goal | Learner-visible movement/activity goal and observable success criteria that do not rank bodies or peers |
| Readiness | Prior skill/concept check, learner choice among routes, and adult/guardian availability required before beginning |
| Model | Lesson-specific accessible demonstration or decision model, critical cues, common error, safe boundary, and observation focus |
| Warm-up/cool-down applicability | Required sequence for movement-bearing work or an explicit `NOT_APPLICABLE` rationale for non-movement analysis/description |
| Equipment and space | Required/optional equipment, approved substitutes, dimensions or functional clearance, surface/environment check, setup, cleanup, and no-equipment/low-space route |
| Activity sequence | One visible action/decision at a time, ordered from setup through finish, with rest/stop cues at point of use |
| Practice progression | Starting level, changed variable, success condition, progression choice, regression choice, and learner-controlled challenge |
| Adaptations/alternatives | Seated, supported, reduced-range/pace, mobility-aid, solo, low-space, no-equipment, and described/decision routes as applicable, with equal-credit criteria |
| Stop/rest rules | Learner-controlled rest, symptoms/events/conditions requiring stop, adult escalation, no-resume boundary, and non-punitive evidence treatment |
| Independent work | Fresh performance/activity or described application, independence boundary, authorized observer if needed, and no unsafe transfer demand |
| Protected authority | Skill/decision criteria, acceptable variation, adaptation parity, safety-critical errors, evidence limits, and completion authority |
| Retry | Observable signal, simpler/alternate model, safe re-practice, fresh retry, and exit/return rule |
| Reflection | Short task-matched prompt about cue, decision, safety, adaptation, strategy, or next step; privacy and scoring treatment |
| Future Tutor manifest | Data-only references for approved explanations, cues, presentation adaptations, coaching, evidence, stop rules, guardian authority, and handoff |

No generic cue array, execution category, phase label, or readiness status
substitutes for lesson-specific movement teaching.

## 7. Movement/activity goal and model

### 7.1 Goal

The learner-visible goal MUST:

- name the movement, tactic, decision, self-management process, or concept;
- identify the conditions that matter, such as space, equipment, partner, pace,
  or safety;
- state observable success using control, sequence, cue use, decision quality,
  communication, or self-management;
- identify an equal-credit adaptation or alternative family; and
- avoid body change, calorie burn, appearance, norm, rank, or speed-only goals.

“Complete the activity” is not a sufficient goal. For a stop-decision lesson,
the goal should concern recognizing, stopping, resting, telling, escalating, or
planning—not generic travel mechanics selected because the title contains the
word “stop.”

### 7.2 Clear movement model/demonstration

New, easily confused, safety-sensitive, or assessed movement MUST include a
lesson-specific model. The model MUST show or describe:

1. safe setup and starting position;
2. the movement or decision sequence in observable parts;
3. two to five critical cues appropriate to the target;
4. pace, range, force, space, contact, and equipment limits that matter;
5. at least one common error or contrast and how to correct it;
6. what the learner should notice rather than copy cosmetically;
7. the adapted/alternative path and why it reaches the same target; and
8. when to rest, stop, tell an adult, or not resume.

The model MAY be a safe live demonstration, approved video, illustration
sequence, animation, tactile model, or precise text/audio description. It MUST
be accessible at the point of use and MUST NOT depend on a learner recording or
sharing their body.

A future Tutor may narrate or cue an approved model. It cannot claim to see or
verify movement unless a separately approved capability and policy establishes
that authority; this draft establishes neither.

## 8. Warm-up, equipment, space, and environment

### 8.1 Warm-up and finish

Movement-bearing lessons MUST include an activity-matched preparation and a
safe finish/recovery transition. Preparation SHOULD:

- begin at a learner-selected comfortable level;
- rehearse movements, joints, ranges, pace, balance, or equipment handling
  relevant to the activity;
- avoid ballistic, maximal, punitive, or one-size-fits-all demands; and
- include the same accessibility routes as the central practice.

The finish SHOULD reduce demand, restore equipment/space safely, and prompt a
brief comfort/safety check. It MUST NOT require heart-rate, calorie, body,
wearable, or fitness-score reporting.

A lesson whose evidence is entirely non-movement analysis, planning, or safety
decision work MAY mark warm-up/cool-down `NOT_APPLICABLE`. It MUST give a
specific rationale. A title or generic “desk lesson” label is insufficient.

### 8.2 Equipment and space

Before movement, the lesson MUST state:

- what is required, optional, prohibited, and replaceable;
- approved household or imaginary substitutes;
- the functional clear-space requirement and low-space route;
- surface, ceiling, weather, people/pets, breakable, cord, footwear, mobility-
  support, and equipment checks that apply;
- setup and cleanup actions;
- whether permission or adult supervision is required; and
- what to do when the environment cannot be made safe.

No purchase, gym, specialized equipment, wearable, camera, account, public
facility, partner, opponent, audience, or group may be required unless the
lesson has explicit authority and a complete equal-credit alternative that
does not require it.

Equipment and space text SHOULD be activity-matched. Universal safety language
may be reused; it should not bury the two or three checks that matter most for
the current activity.

## 9. Step sequence and practice progression

### 9.1 One-action sequence

Learner-facing steps MUST present one primary action or decision at a time.
Related cautions may appear with the action, but a single step must not require
the learner to set up, choose a route, remember several cues, perform, judge,
record, and clean up at once.

A movement-bearing lesson SHOULD make these stages visible:

1. **Choose and check** — choose a standard/adapted route, obtain required
   permission, and check space/equipment.
2. **Prepare** — complete the activity-matched warm-up or starting rehearsal.
3. **Watch/notice** — observe the model and name the critical cue or decision.
4. **Try** — practice one simple or slow version.
5. **Adjust** — use feedback or self-check to change one element.
6. **Build** — add one approved variable such as range, pathway, timing,
   sequence, choice, or duration.
7. **Apply independently** — complete a fresh bounded activity/performance or
   equal-credit alternative.
8. **Finish safely** — reduce demand or rest, clear equipment, and report one
   safety/cue decision or next step.

The sequence MAY use more/fewer display steps when the same actions and safety
boundaries remain clear.

### 9.2 Progression

Progression MUST be earned by control and understanding, not demanded by age,
speed, repetitions, competition, or willingness to tolerate discomfort.

Each practice plan MUST identify:

- the simplest safe entry version;
- the target cue or decision for that round;
- an observable success check;
- one variable that may change next;
- a learner-controlled option to remain, progress, regress, rest, or switch
  routes; and
- the maximum boundary the lesson will not exceed.

Progressions may change space, direction, sequence, timing, object, partner
information, tactical choice, duration, or complexity. Intensity and range are
always learner-selected within approved safety bounds. A progression MUST NOT
require pain, dizziness, unusual breathing difficulty, symptom induction,
maximal effort, unsafe fatigue, collision, unapproved contact, or a real injury/
stop event.

## 10. Adaptations and equal-credit alternatives

Adaptation is part of lesson design, not a lesser exception. Every movement
lesson MUST offer the applicable routes below or document why a route does not
fit the target:

- seated;
- supported by a stable surface or approved support;
- reduced range;
- reduced pace or demand;
- mobility-aid compatible;
- solo/non-contact;
- low-space;
- no-equipment or approved substitute;
- reduced sensory/communication burden; and
- described, gestured, modeled with an object, planned, or decision-based when
  physical movement is not appropriate.

An adaptation/alternative MUST:

1. be complete enough to run without invention;
2. preserve the target cue, decision, sequence, tactic, or safety understanding;
3. state equivalent observable evidence;
4. earn equal credit when that evidence is present;
5. avoid requiring the learner to disclose a disability or health reason; and
6. remain available before and during the activity without being logged as
   refusal, noncompliance, low effort, or failure.

Authors MUST review whether the same cue actually works for each route. A
seated, mobility-aid, described, or no-equipment path may require different
surface wording while preserving the same construct.

No rubric, task, transfer condition, hint, extension, or mastery rule may
silently restore an opponent, real group, outing, equipment, standard body
position, unsupervised activity, full block, scored contest, or real safety
event that an equal-credit route removes. If learner-facing and protected
authority conflict on this point, the lesson is `BLOCKED_AUTHORITY_CONFLICT`.

## 11. Stop, rest, and safety authority

### 11.1 Learner-controlled rest

The learner may pause, rest, reduce pace/range/demand, use support, or switch to
an approved alternative at any time. Doing so MUST NOT reduce credit or be
recorded as failure, refusal, weakness, low effort, or lack of mastery.

The lesson MUST distinguish:

- **rest/adjust** — learner chooses a break or lower demand and may resume when
  comfortable and the environment is safe;
- **stop and tell** — pain, dizziness, unusual breathing difficulty, head
  impact, acute injury concern, unsafe equipment/environment, or another named
  concern requires immediate stop and trusted-adult notification; and
- **do not resume** — after a head impact, injury, persistent/worsening symptom,
  or other stated condition, the learner does not resume until the authorized
  guardian or qualified professional says it is safe.

The lesson MUST NOT ask a learner or Tutor to determine a diagnosis or test
whether a symptom is serious by continuing activity.

### 11.2 Guardian and adult authority

Curriculum MUST declare one authority level:

| Level | Meaning |
| --- | --- |
| `NONE` | No real-world permission, observation, or supervision is required; learner evidence is knowledge/decision/description based |
| `GUARDIAN_PERMISSION` | Guardian approval is required before the real activity, location, equipment, partner/group, or progression is used |
| `ADULT_OBSERVATION` | An authorized adult must observe the bounded evidence but need not continuously supervise the whole activity |
| `DIRECT_ADULT_SUPERVISION` | The authorized adult must be present and attentive throughout the safety-sensitive portion |
| `QUALIFIED_INSTRUCTOR_OR_PROFESSIONAL` | The activity or claimed clearance requires a separately qualified role; the lesson/Tutor cannot substitute |

When an authority above `NONE` applies, the lesson MUST name:

- the action or condition requiring authority;
- when permission/observation/supervision occurs;
- the minimum non-sensitive record;
- an equal-credit alternative when authorization or access is unavailable; and
- whether the adult confirms occurrence, safety conditions, academic quality,
  or a separately defined subset.

Guardian confirmation MUST NOT require photographs, video, audio, wearable
data, location proof, body data, medical details, or a diagnosis. A guardian's
confirmation that an activity occurred does not automatically establish skill
mastery. A Tutor or learner self-report cannot impersonate or replace guardian
authority.

### 11.3 General safety boundaries

PE lessons MUST NOT require:

- maximal effort, punishment exercise, unsafe fatigue, movement through pain,
  or an induced symptom/injury;
- unapproved contact, spotting, climbing, lifting, water activity, road use,
  unsupervised location, tool, environment, or equipment;
- a learner to coach, physically assist, diagnose, clear, or treat another
  person beyond the explicitly taught safe role; or
- participation that conflicts with guardian/professional restrictions or an
  approved accommodation.

Safety language must be visible at the point of decision, not buried only in an
adult guide or repeated boilerplate.

## 12. Independent performance/activity and evidence

Independent evidence MUST be lesson-specific and use a fresh, bounded
application. It MUST identify:

- target cues, decisions, sequence, tactic, communication, or self-management;
- standard and equal-credit evidence routes;
- permitted cues/support and what makes the attempt guided rather than
  independent;
- activity duration/range expressed as a safe bounded choice, not a fitness
  norm;
- authorized evidence observer or confirmation, if any;
- learner-visible success criteria; and
- protected authority for acceptable variation, adaptation parity, and
  safety-critical boundaries.

Appropriate evidence may include:

- direct performance observed by the learner or authorized adult;
- a sequence demonstration using an accessible route;
- a cue/decision explanation paired with a bounded attempt;
- tactical response to a supplied diagram or fictional situation;
- safe setup/equipment selection;
- error analysis or comparison of two movement examples;
- a described, gestured, drawn, or object-modeled sequence when movement is not
  appropriate; or
- a plan/protocol for a supplied fictional situation when planning is the
  target.

Evidence MUST NOT require body measurements, fitness test norms, biometric or
wearable data, calorie estimates, photographs, video, voice recordings, public
performance, peer ranking, or disclosure of disability/health status.

Protected scoring authority MUST prioritize the lesson's taught construct. It
SHOULD define critical cues/decisions, acceptable variations, safety-critical
errors, adaptation equivalence, feedback, and sufficient evidence. Speed,
distance, repetitions, or time MAY be task conditions only when educationally
necessary, safely bounded, adaptable, and not used as body or peer value.

## 13. Retry, mastery, and reflection

### 13.1 Retry

When evidence is not yet sufficient, the lesson MUST:

1. name the observable cue, decision, sequence, or safety gap neutrally;
2. return to a simpler safe version;
3. re-model or use a different cue/representation;
4. let the learner practice one bounded change;
5. offer rest or another adaptation without penalty;
6. provide a fresh retry; and
7. state the exit or return rule.

A safety stop is not a failed attempt. The learning retry may occur through a
described/decision route or in a later authorized session; physical repetition
is not always appropriate.

### 13.2 Mastery

Mastery MUST require independent evidence of the target cue, decision,
sequence, tactic, or self-management on at least two occasions separated by
time, setting, or meaningful variation when feasible. It MUST use protected
authority and MUST distinguish academic/skill quality from physical occurrence.

Mastery MUST NOT be based on body size, appearance, fitness norm, percentile,
speed alone, ability to use the standard route, tolerance of discomfort,
attendance alone, Tutor confidence, learner self-report alone when adult
confirmation is required, or subjective reflection alone.

### 13.3 Reflection

Reflection SHOULD be brief and matched to the activity. It may ask the learner
to name:

- the cue or decision that improved control;
- a safety or space check;
- an adaptation that preserved the target;
- a tactical choice and its effect;
- a moment when rest/stop was the responsible choice;
- what to try in the next safe attempt; or
- what remains confusing.

Reflection MUST NOT ask the learner to praise or criticize their body, compare
with another person, disclose a disability/diagnosis, report body/fitness data,
or justify an adaptation. A learner's enjoyment, comfort, preference, or sense
of challenge is subjective and is not automatically right or wrong. Factual
claims and taught safety decisions may be checked separately.

## 14. Age and language policy

Age appropriateness includes direction length, motor/cognitive load, equipment,
space, choice count, tactical abstraction, independence, safety authority, and
emotional/social burden. Readability formulas are advisory only.

| Dimension | Grades 3–5 | Older learners, Grades 7–12 |
| --- | --- | --- |
| Goal language | Name one movement/decision target and how the learner can notice success | May connect technique, tactics, self-management, planning, transfer, or lifetime activity, while keeping the target observable |
| Directions | One action at a time; demonstrate before multi-step practice; repeat the critical cue near the action | Ordered multi-step sequences are acceptable, but setup, stop/rest, adaptation, and evidence actions stay visibly separate |
| Model | Concrete whole-part-whole demonstration or picture/description; one common error and correction | Include decision/tactical reasoning, variable change, self-monitoring, and multiple valid adaptations where relevant |
| Practice | Short rounds, frequent choice/check-ins, limited variables, familiar space/equipment | Longer or more complex rounds may be used with honest duration, learner-controlled demand, and explicit progression/regression |
| Decision load | Few stated choices and a clear trusted-adult route | Multiple constraints, tactics, access planning, leadership, advocacy, or transfer may be included without requiring real groups or unsafe independence |
| Vocabulary | Introduce a small set of concrete movement and safety terms with immediate demonstration | Retain precise technique, training, tactics, and safety terms; define new terms and avoid clinical/prescriptive claims |
| Evidence | One bounded application plus cue/safety explanation; adult observation only when declared | More sustained application, plan, analysis, or transfer is acceptable, but equal-credit routes and authority remain explicit |
| Adult role | State permission/supervision simply and do not make the child manage adult-only risk | Increase learner self-management without implying that age removes guardian, qualified-professional, facility, weather, equipment, or legal/safety authority |

Within the older band, grades 7–8 SHOULD use fewer interacting variables and
more immediate demonstration/feedback than grades 9–12. High-school transfer
may increase authentic planning and decision complexity. It MUST NOT require an
unsupervised session, real opponent/group, public event, full training block,
scored contest, outing, or real safety event when the equal-credit route does
not.

## 15. Body dignity and non-punitive participation

PE curriculum and authority MUST use body-respectful, disability-respectful,
non-shaming language. It MUST NOT:

- score or praise body size, weight, weight change, BMI, body composition,
  shape, appearance, calorie burn, “ideal” form, or a body as better/worse;
- use dieting, weight-loss, weight-cutting, weigh-in, or body-value language;
- infer laziness, effort, discipline, honesty, courage, fitness, health,
  maturity, or character from performance or adaptation;
- assign exercise as punishment or withhold movement/rest as punishment;
- lower credit because a learner uses a seated, supported, mobility-aid,
  reduced-range/pace, solo, low-space, no-equipment, described, or other
  approved route;
- require an explanation of why an adaptation is needed; or
- treat a safety stop, refusal of an unsafe task, or guardian restriction as
  noncompliance.

Evaluation focuses on the taught skill, decision, sequence, strategy,
communication, self-management, safety understanding, and revision visible in
the learner's selected route.

## 16. Accessibility and presentation

The lesson MUST make critical information available without relying only on
vision, hearing, color, spatial diagram, rapid speech, fine-motor interaction,
or physical demonstration. Models SHOULD include accessible descriptions;
videos require captions/transcript; diagrams require meaningful text; and
spoken directions require a readable equivalent when possible.

Presentation support may include chunking, repetition, previewed vocabulary,
visual sequence cards, audio, captions, extended time, breaks, reduced copying,
hidden timers, predictable transitions, low-distraction presentation, choice
of response mode, or an approved support person.

Access support MUST NOT change the target silently. If an adaptation changes
the construct, the lesson must identify the alternate evidence claim honestly
rather than penalizing the learner.

## 17. Future Tutor curriculum metadata and boundaries

This section defines curriculum metadata only. It does not implement Tutor V2,
computer vision, motion sensing, provider behavior, memory, adaptive runtime,
scoring, physical-completion tracking, or guardian workflow.

Every future conforming lesson SHOULD expose a data-only manifest consistent
with the companion advisory schema. It should identify:

- stable concept/skill, prerequisite, cue, and misconception/error-pattern IDs;
- primary/secondary PE lesson types and age-language policy;
- approved activity goal, model, common-error, sequence, progression, warm-up,
  equipment, space, adaptation, and stop/rest refs;
- independent evidence forms, permitted supports, adaptation equivalence, and
  protected scoring authority;
- retry and later mastery refs;
- reflection purpose and privacy/scoring treatment; and
- required guardian/adult authority, confirmation boundary, and handoff.

A future Tutor MAY:

- explain approved movement concepts and directions;
- narrate or cue an approved model;
- present one action at a time;
- ask the learner to identify a cue, decision, hazard, or next step;
- adapt instructional presentation and offer approved activity alternatives;
- coach the learner's own practice decision or reflection; and
- route to an approved retry, rest, stop, or adult handoff.

A future Tutor MUST NOT:

- diagnose, prescribe, clear, or rehabilitate;
- infer disability, health, effort, motivation, body value, or character;
- claim to observe movement without separately approved observation authority;
- certify physical completion, guardian permission, adult observation, or safe
  return;
- pressure a learner to continue, progress, disclose, or use a standard route;
- override learner stop/rest, adaptation, guardian, professional, facility,
  weather, equipment, or other safety authority;
- score body data, fitness norms, appearance, comparison, or unsupported
  sensor/media evidence;
- write a protected explanation or reveal protected scoring authority; or
- invent missing models, cues, equipment rules, adaptations, authority, or
  evidence.

If required curriculum supply is missing or conflicting, the Tutor-ready state
is `BLOCKED_MISSING_CURRICULUM` or `BLOCKED_AUTHORITY_CONFLICT`; the Tutor does
not improvise a repair.

## 18. Draft conformance review

Automated checks MAY verify fields, references, declared authority, adaptation
parity language, stop/rest presence, and prohibited evidence/body-scoring
terms. They cannot establish movement-model quality, safe applicability, or
age fit by themselves.

A human Director/reviewer MUST confirm that:

1. the primary type matches the actual activity and evidence;
2. the goal is observable, lesson-specific, and free of body/norm scoring;
3. the model demonstrates the target cues/decisions, common error, adaptation,
   and safety boundary;
4. warm-up/cool-down is present where appropriate and any omission has a valid
   non-movement rationale;
5. equipment, space, environment, substitutes, and setup/cleanup are complete;
6. directions present one primary action or decision at a time;
7. practice progresses through safe, learner-controlled variables;
8. every relevant adaptation/alternative is runnable and earns equal credit;
9. stop/rest/no-resume rules appear where decisions occur;
10. independent evidence is fresh, bounded, appropriate, and specific;
11. adult/guardian confirmation is required exactly where authority demands it
    and cannot be replaced by Tutor or learner self-report;
12. retry changes the teaching and never treats safety/adaptation as failure;
13. reflection is bounded and not body-, diagnosis-, comparison-, or disclosure-
    based;
14. age, disability, access, and total learner burden receive human review; and
15. future Tutor metadata is curriculum-only and contains no physical-
    completion or authority claim.

Any conflict between a demanded real/high-risk condition and a promised equal-
credit alternative blocks conformance until curriculum and authority agree.
This is an authoring/review rule, not validator hardening in this branch.

## 19. Recommended next-wave PE Director sample

Recommended lesson: **`ma-g12-physical-education-u08-l07` — “The stop rule as
an adult habit rather than a class instruction under transfer.”**

Audit package:
`curriculum-production/final/health-physical-education/packages/physical-education/grade-12/ma-g12-physical-education-u08-l07.json`

Audit authority:
`curriculum-production/final/health-physical-education/scoring-guides/physical-education/grade-12/ma-g12-physical-education-u08-l07.json`

The audit selected this lesson because it concentrates distinct corpus risks
in a safety-critical topic: a stop-decision objective receives generic
locomotor cues; there is no lesson-specific warning-sign/stop/escalation model;
the task and rubric demand an unsupervised full training block and real stop
decision while completion/adaptation text promises a fully described solo
route; and the stages are composite.

The next wave SHOULD build one Director sample that demonstrates a no-symptom,
no-induced-event fictional decision model, one-action presentation, explicit
described-route precedence, appropriate protected authority, and curriculum-
side Tutor cues without physical-completion claims. This branch does **not**
build or rewrite that sample.

## 20. Adoption path

Before this draft becomes an enforced standard:

1. PE, curriculum, accessibility, safety/privacy, assessment, guardian-
   authority, and Tutor-contract owners review this document and schema.
2. The recommended sample is authored in the next wave and reviewed by the
   Director.
3. Advisory checks are tested against that safety-decision sample plus
   meaningfully different skill, tactics, fitness self-management, creative,
   and project lessons.
4. Reviewers decide which rules become release-blocking and which remain human
   review criteria.
5. A versioned migration plan preserves existing universal safety and
   adaptation strengths.
6. Full-corpus structural, checksum, safety, accessibility, authority,
   readability, and depth evidence is rerun before any acceptance claim.

Until those steps occur, the correct status is **DRAFT**, and this document
does not authorize curriculum rewrite, Tutor V2 runtime, PE transfer-authority
validator changes, or production admission changes.

**Draft classification: PHYSICAL_EDUCATION_LESSON_STANDARD_DRAFT_R1**
