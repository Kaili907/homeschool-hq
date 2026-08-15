# Director-Approved Lesson Models R1

## Freeze status

`DIRECTOR_APPROVED_LESSON_MODELS_R1_FROZEN`

| Field | Frozen value |
| --- | --- |
| Approval date | `2026-08-14` |
| Approval status | `DIRECTOR_APPROVED_FOR_PRODUCTION` |
| Production status | `DIRECTOR_APPROVED_FOR_PRODUCTION` |
| Session base | `8f05262563ce6d9e5c5d1687d46cd9cc25094830` |
| Production branch | `mac/approved-lesson-models-r1` |
| Machine-readable authority | `DIRECTOR_APPROVED_LESSON_MODELS_R1.manifest.json` |

The Director personally reviewed and approved all six lesson samples named in
this freeze. This record is the written production authority for this
curriculum wave. The approved sample is a quality target interpreted together
with its subject standard, not a page template, item-count template, or generic
lesson shell.

Historical `READY_FOR_REVIEW` language inside the pinned sample records describes
their pre-decision state. This freeze supersedes that language for the six exact
sample SHAs below. It does not silently approve a different commit, regenerate a
corpus, declare every existing lesson conforming, or authorize application,
Tutor-runtime, release, or deployment changes.

## Immutable approved authority

| Subject | Approved sample SHA | Approved lesson ref | Approved title | Grade / approved sample type | Governing R1 standard reference |
| --- | --- | --- | --- | --- | --- |
| Arts/Music | `2a18b6007868f4bf55258ad3fd087c901ed47413` | `ma-g9-arts-and-music-u01-l02` | Concept model A: advanced composition and visual hierarchy | Grade 9 / `VISUAL_ART_CONCEPT`, phase `MODEL_A` | `679847806592762da8f956d7a272dc3b352da92d:docs/curriculum-quality/arts/ARTS_MUSIC_LESSON_STANDARD_R1.md` |
| Technology | `e9c83f72d366bfad10794f559b27fd119d732cd6` | `ma-g10-technology-u02-l05` | Mastery check: algorithms, efficiency, and correctness | Grade 10 / mastery with algorithm, code-writing, and debugging demands | `9365bc2642e9e575080387434c4af4c8c3375500:docs/curriculum-quality/technology/TECHNOLOGY_LESSON_STANDARD_R1.md` |
| Ready for Life | `8c22d82a249b1ca5c331b82c761c9cd1abb7b3a9` | `ma-g3-ready-for-life-u01-l04` | Spot, Stop, Ask: A Safe-Space Check | Grade 3 / `SAFETY` with `PRACTICAL_TASK` and `PERSONAL_RESPONSIBILITY` | `fe0f0139760edca0138b8da122a982f05e79e8ef:docs/curriculum-quality/ready-for-life/READY_FOR_LIFE_LESSON_STANDARD_R1.md` |
| Financial Literacy | `dbcc62cc1589e8fe4ef3feef1a8730b2eaccb82c` | `ma-g8-financial-literacy-u04-l03` | Guided practice A: credit cards and minimum payments | Grade 8 / `GUIDED_APPLICATION`; primary focus `CREDIT_BORROWING` | `71d9e124e95b1f2f4d83bc1473d46ff80c3c316d:docs/curriculum-quality/financial-literacy/FINANCIAL_LITERACY_LESSON_STANDARD_R1.md` |
| Health | `61f447082bc3102cab6eb7514a0c443c1bacbc17` | `ma-g5-health-u01-l01` | Launch and diagnostic: dimensions of health | Grade 5 / `CONCEPT_VOCABULARY` with `DECISION_REASONING` | `0518b817bae286707c28e800b3387d214ffbf61f:docs/curriculum-quality/health/HEALTH_LESSON_STANDARD_R1.md` |
| Physical Education | `c190f45107dd15f9a6acccac9db1f321bfe66a41` | `ma-g12-physical-education-u08-l07` | The Stop Rule: Act Without Waiting for a Coach | Grade 12 / `SAFETY_STOP_DECISION` with `FITNESS_SELF_MANAGEMENT` | `0518b817bae286707c28e800b3387d214ffbf61f:docs/curriculum-quality/physical-education/PHYSICAL_EDUCATION_LESSON_STANDARD_R1.md` |

Each standard reference above is an immutable Git object reference. The
Technology and Ready for Life standard documents need not be copied into this
tree to remain authoritative: the referenced blobs exist at their exact commits.

## Production interpretation rules

1. Preserve the lesson's subject, target, grade, primary type, secondary modes,
   evidence purpose, and safety/authority posture.
2. Match the approved depth, coherence, usability, accessibility, answer
   protection, and evidence quality. Do not copy the sample's topic, names,
   numbers, scenario, media, activity count, or page sequence by default.
3. Classify from the learner demand, not from the title or corpus phase. A
   phase such as model, guided practice, project, mastery, or correction does
   not prove that its required teaching and evidence are present.
4. Apply the governing subject standard by lesson type. Omit a block only when
   the type makes it instructionally inappropriate and the standard permits the
   omission. A protected diagnostic, mastery check, or assessment must not
   preteach its answer.
5. Keep worked/model material distinct from protected independent evidence.
   Supports must fade before independent transfer, and answer-bearing support
   must remain outside protected attempts.
6. Preserve learner choice where the discipline requires it: artistic intent,
   defensible financial decisions, response mode, accessible route, and safe
   stop/rest choices cannot be replaced by an adult or Tutor preference.
7. Use only the evidence quantity and form warranted by the lesson type and
   target. This freeze creates no cross-subject minimum item count.
8. Treat remediation as different, targeted teaching followed by a fresh
   retry. Repeating the prompt, adding encouragement, or exposing the answer is
   not remediation.
9. Keep scoring, mastery decisions, guardian certification, professional
   authority, and physical completion distinct.
10. Tutor fields are curriculum metadata only. They do not authorize Tutor V2,
    provider calls, orchestration, memory, scoring, adaptive routing, answer
    release, or completion/mastery decisions.

## Shared production teaching standard

### Age and language

- Speak directly and respectfully to the learner. Define necessary subject
  vocabulary at first use instead of removing precise terms.
- Grades 3–5 receive concrete examples, short sections, visible transitions,
  one main action at a time, and nearby stop/ask cues.
- Grades 7–8 may handle longer processes and multiple stated constraints, but
  steps, choices, units, criteria, and stopping points remain scannable.
- Grades 9–12 may use advanced discipline language, sustained work, uncertainty,
  systems, critique, invariants, or tradeoffs. Increased age does not remove
  definitions, accessibility, privacy, guardian, professional, or safety
  boundaries.
- Difficulty grows through concept depth, decision quality, integration, and
  transfer—not merely longer prose, larger dollar amounts, more repetitions,
  or an adult-sounding register.

### Worked and model examples

A required model is delivered or deterministically resolvable, complete enough
to teach from, accessible in the target mode, and visibly separate from the
protected task. It shows the starting condition, ordered actions or reasoning,
meaningful intermediate states, why decisions follow, the completed or
intentionally partial result, and a criteria/safety check. A final answer,
finished artifact, directions-only checklist, or promised but missing resource
is not a worked model.

### Guided practice

Guided work includes a bounded learner action before correction, support tied to
the target, feedback based on observable evidence, a correction or second turn
when needed, a declared fade, and a later task with materially less support.
Watching another example or changing only surface values does not establish
guided transfer.

### Independent evidence

Independent work uses a fresh task, case, prompt, artifact, performance,
scenario, or constraint set. It states permitted supports and preserves the
target decision or construction for the learner. Accessibility may change
presentation, response mode, pace, copying load, body position, equipment, or
route while preserving the construct and equal-credit evidence.

### Mastery

Mastery requires protected, accurate, independent evidence appropriate to the
target plus the retrieval, transfer, variation, dimensions, or occasions named
by the subject standard. Supported practice, attendance, completion, private
reflection, one self-rating, Tutor confidence, body data, or resemblance to a
model cannot establish mastery. Curriculum defines the evidence contract and
protected authority; only a separately approved human/runtime policy may make
the mastery-state decision.

### Remediation

Remediation begins from a neutral observable signal, identifies the smallest
gap, supplies a materially different explanation/model/representation or safer
reduced step, gives bounded supported practice, and ends with a fresh parallel
retry plus an exit/return rule. A privacy choice, accessible route, safety stop,
request for adult help, or defensible subject-specific variation is not failure.

### Safety and privacy

Use the least-sensitive evidence capable of showing the learning. Do not
require credentials, precise location, account data, household finances,
diagnoses, symptoms, treatment, body/fitness data, identifiable media, private
family details, or real-world proof unless a separately approved authority and
purpose explicitly permits it. Fictional, generalized, local, described, or
complete equal-credit simulation routes must be provided where the standard
requires them. Adults, guardians, qualified professionals, and emergency
services retain the authority assigned to their roles.

## Subject-specific teaching models

### Arts/Music

**Approved teaching qualities.** Teach the artistic concept or technique as a
perceptible relationship: define it, direct attention, explain effect and
tradeoff, distinguish a useful contrast/non-example, and connect teaching to
making, performing, listening, or analysis. Deliver rights-cleared visual,
audio, motion, tactile, notated, or described references. Preserve creative
authority; difference from the Academy example is not an error and similarity
earns no extra credit.

**Expected type variation.** `VISUAL_ART_CONCEPT` centers noticing plus
application; `TECHNIQUE` needs a stepwise model and observable fresh use;
analysis and history need substantive sources and evidence-cited reasoning;
design and studio work need original choices, tests/process evidence, and
revision; music concept, rhythm, melody, listening, performance, and composition
need audible/performable or equivalent disciplinary evidence; review,
remediation, mastery, and projects use their own evidence contracts. A creation
or performance lesson cannot be replaced by a quiz, and a project must not be
forced into fixed-answer items.

**Approved sample expression.** The Grade 9 sample teaches visual hierarchy
through the Academy-original `Three Stops` perceptual model, a partial
non-example, intermediate and finished states, a materially different
variation, an adjacent verbal description, and a tactile route. Guided work
isolates placement in two thumbnails; independent work is a fresh learner-owned
composition using multiple hierarchy variables, an intermediate state, a path
check, and an evidence-based learner-chosen revision. Reflection, private
critique, knowledge check, and rubric review remain distinct. This sample's
counts and 60–70 minute scale belong to this sample, not every Arts/Music
lesson.

**Mastery, remediation, safety, and Tutor boundary.** Arts mastery evidence is
type-dependent: repeated technique control, evidence-based analysis, or a
substantive creation/performance with enough independent rubric dimensions may
be appropriate. Reflection alone is insufficient. The approved retry routes
separately address competing visual areas and an unintended first stop without
penalizing an intentional distributed or model-different route. Private work
and self-critique earn full credit; no public display, identifiable media,
specialized paid material, pain-based coaching, or learner-authorship takeover
is required. Tutor metadata may reference concepts, techniques, errors, models,
rubrics, phase, age policy, and allowed support; it may not choose intent,
revise/finish the work, score taste, or declare mastery.

### Technology

**Approved teaching qualities.** Teach computing mechanisms, state, control or
data flow, specifications, tests, correctness, limitations, and tradeoffs with
inspectable representations. A debugging lesson records the evidence cycle
`observe -> hypothesize -> inspect -> test -> interpret -> iterate`. Worked
code may disclose a complete repair only on a structurally distinct teaching
fixture. Protected code, decisive repairs, accepted traces, hidden outputs, and
answer-bearing rubric reasoning remain restricted.

**Expected type variation.** Computing concept, code reading, code writing,
algorithm/logic, debugging, data representation, cyber/digital safety, design,
tool workflow, analysis, project, review, remediation, mastery, and assessment
each require their own central input and evidence. Paper/pseudocode, diagram,
block, tactile, or tool-neutral routes are valid when they preserve the
computing construct. Projects require milestones, reviewable increments,
testing, individual understanding, and a defined artifact; they are not
one-session worksheets. Mastery and assessment prohibit exact-target teaching
during the protected attempt.

**Approved sample expression.** The Grade 10 sample explicitly teaches
algorithm specification, invariants, debugging evidence, correctness, and
time/space tradeoffs. It fully works a `containsZero` early-return defect, guides
a distinct `countEven` state-update case, then closes teaching fixtures. The
learner independently constructs `firstDrop` and debugs a structurally distinct
`hasDuplicate` case using public tests, traces, invariants, complexity, and a
defect log. The exact independent, mastery, and fresh-check solutions remain in
restricted authority. The two protected tasks and 60–75 minute scale are
sample-specific, not a universal Technology count.

**Mastery, remediation, safety, and Tutor boundary.** Freshness is structural,
not a rename or number swap. Trusted adult review applies the protected
authority; the learner browser stores `PENDING_ASSESSMENT`, not correctness or
mastery. Remediation selects the observed gap, uses either a card-pair coverage
map or six-box evidence ladder, and ends with a fresh Set-based debugging case
without exposing either protected repair. Work uses fictional/local inputs and
must not request credentials, secrets, private messages, personal data, live
targets, access-control bypass, or third-party sign-in. Tutor metadata may
declare concept/skill IDs, refs, hint ceiling, answer policy, age/safety policy,
and adult authority; it contains no prompt, learner model, attempt history,
score, route, or answer-release logic.

### Ready for Life

**Approved teaching qualities.** Teach a runnable life skill with a clear goal,
honest access/readiness assumptions, all embedded/versioned/adult-local
materials identified, a complete model, an observable coached attempt, a real
task or complete equal-credit simulation, minimally disclosive evidence, honest
active/elapsed/adult time, and explicit completion authority. Missing named
resources block the route; neither author nor Tutor invents them.

**Expected type variation.** Home skill, organization, communication, personal
responsibility, community/service, practical task, decision making, planning,
safety, project, review, remediation/retry, and evidence/signoff differ in
purpose, task shape, evaluator, duration, and authority. A project may span
sessions; a practical procedure may use short observation evidence; a decision
needs constraints and reasoning; a real household action may require guardian
certification; a fictional simulation may remain learner-authority. Reflection
burden varies and need not use a repeated essay shell.

**Approved sample expression.** The Grade 3 sample teaches
`Spot–Stop–Name–Ask` through a complete lamp-cord model, an unknown-bottle
guided decision, feedback, and a fresh book-on-shelf correction turn. The
learner then chooses a guardian-authorized five-check Home Check or a fully
delivered six-scene equal-credit simulation. Finding no hazard is valid when
the learner gives risk-based reasons. Route-specific evidence and duration are
explicit. These five/six counts and timings are specific to this safety lesson.

**Mastery, remediation, safety, and Tutor boundary.** Evidence distinguishes
knowledge, procedure, completion, reflection, adult signoff, and artifact
claims. A guardian alone certifies the physical Home Check; learner evidence
completes the fictional route, and neither certification automatically decides
academic mastery. Retry contrasts risk mechanism with ordinary untidiness,
uses supported and fresh parallel cards, and returns safely to unfinished work.
The learner never touches or moves unknown/adult-only hazards, and the lesson
does not collect room, location, product, medicine, family, photo, audio, or
video details. Tutor metadata may coach the authored risk routine and retry,
but cannot grant permission, observe a home, certify an event, create guardian
attestation, request household detail, or fabricate a missing resource.

### Financial Literacy

**Approved teaching qualities.** Declare a precise financial focus and a
separate instructional profile. Teach meaning, conditions, units, calculations,
constraints, uncertainty, and tradeoffs—not arithmetic alone. Worked financial
examples use a separate fictional case and expose all material steps,
assumptions, rate/timing/rounding conditions, interpretation, reasonableness,
and limitation. Fixed money authority uses exact integer minor units and exact
rates; binary floating point is never sole final authority.

**Expected type variation.** Diagnostic, concept instruction, guided
application, application/transfer, decision scenario, review, remediation,
mastery, assessment, and project have different model and answer-protection
rules. Decision work may accept multiple defensible choices supported by the
scenario. Projects require a sustained learner-owned plan/product and rubric.
Assessment does not teach the measured target. The financial focus—budgeting,
saving, credit, tax, investing, consumer protection, or another approved
focus—determines the calculations, sources, risks, and reasoning that must be
supplied.

**Approved sample expression.** The Grade 8 sample teaches interest, principal
reduction, ending balance, and a payment tradeoff using invented cases. Jordan
is the worked case, Mika the guided calculation, Ari the fresh independent
calculation/decision, and Taylor the protected mastery case. Rates, statement
timing, one-point half-up rounding, units, permitted tools, and exact-cent
verification are explicit. The package's 20 prompts—17 fixed and three open—are
approved for this lesson only and must not become a production-wide quota.

**Mastery, remediation, safety, and Tutor boundary.** Protected mastery needs
aligned calculations plus explanation and tradeoff reasoning under the declared
support ceiling; one guided response is not mastery. The alternate balance-box
explanation uses different fictional cases, a supported retry, faded boxes,
and a fresh retry. No learner work may request real household income, debt,
balances, payment history, account/card identifiers, credentials, credit score,
tax data, hardship, or individualized advice, and no task directs a real
financial action. Tutor metadata may carry concept/prerequisite/misconception
IDs, calculation and scenario refs, hint, age, and answer policies; it cannot
personalize from real finances, reveal protected values or decisions, score, or
run mastery.

### Health

**Approved teaching qualities.** Teach an accurate health concept, vocabulary,
observable facts versus assumptions, safe decision/process, uncertainty or
individual variation where relevant, and a trusted-adult/professional route.
Use complete fictional/public/generalized cases and minimally disclosive
evidence. Health teaching is educational and non-diagnostic; subjective
preference or personal meaning is not a fixed-answer item.

**Expected type variation.** Concept/vocabulary, information evaluation,
decision reasoning, communication/help-seeking, bounded health procedures,
review, remediation, mastery evidence, and projects require distinct models and
evidence. New or safety-sensitive instruction needs a separate model and guided
reasoning; information evaluation needs source criteria; communication needs
low-disclosure practice; procedures need safe steps; mastery needs protected
fresh evidence; projects use fictional/public briefs and do not require a
personal health plan.

**Approved sample expression.** The Grade 5 sample teaches five connected
dimensions of health, distinguishes a dimension from a score/label, and uses
`Facts, Connect, Choose, Ask`. A complete library model is followed by a
different guided case with learner turn and correction, then fresh community-
center and park independent/later-transfer cases. The learner may respond by
supported reading, writing, speaking, signing, drawing, or equivalent modes
without surrendering the target concept.

**Mastery, remediation, safety, and Tutor boundary.** This Health standard
requires at least two independent evidence occasions, including later or
meaningfully different transfer; optional private reflection is learner-kept,
unscored, and excluded from completion and mastery. Remediation uses the
materially different `five windows` and `camera test` representations and ends
with a fresh water-fountain case. No required work asks for real health,
diagnosis, symptoms, treatment, body/fitness/food logs, family circumstances,
identifiable media, or private reflection. Tutor metadata may reference
approved explanations, vocabulary, models, scenarios, adaptations, evidence,
retry, privacy, and authority. It may not diagnose, solicit disclosure,
prescribe, expose private reflection, write protected work, certify a physical
event, override human authority, or invent missing curriculum.

### Physical Education

**Approved teaching qualities.** Match the model to the actual movement,
tactic, safety decision, or self-management target. State setup, critical cues,
safe bounds, common error/correction, adaptation, rest/stop/tell/no-resume
rules, progression/regression, and equal-credit evidence. Adaptations are
first-class routes, not lesser exceptions; learner-controlled rest or a safety
stop never reduces credit.

**Expected type variation.** Movement concepts, skill development, tactics,
fitness self-management, safety-stop decisions, cooperative/creative activity,
review, remediation, mastery performance, and lifetime-activity projects
require different models and evidence. Movement-bearing work needs matched
preparation and finish; non-movement safety/decision work may mark them
`NOT_APPLICABLE` with a real rationale. Projects may span sessions and require
honest duration, access, permission, and a complete described/simulation route.
A quiz cannot replace required movement evidence, while a safety-decision
lesson must not induce movement or a real symptom merely to look like PE.

**Approved sample expression.** The Grade 12 sample is intentionally
non-movement decision work. It teaches `REST / ADJUST`, `STOP AND TELL`, and
`DO NOT RESUME` through `NOTICE–PAUSE–ACT–HOLD`, a complete environmental-stop
model, three coached contrasts, four fresh fictional cards, and a five-line
protocol. Warm-up/cool-down are not applicable. Seated, solo, low-space,
no-equipment, mobility-aid, spoken, signed, drawn, eye-gaze, sorted-card,
object-modeled, and described routes earn equal credit. These counts belong to
this lesson, not every PE lesson.

**Mastery, remediation, safety, and Tutor boundary.** PE mastery uses fresh
independent target evidence on at least two occasions separated by time,
setting, or meaningful variation when feasible, while keeping academic quality
separate from physical occurrence. The retry isolates the decision gap, uses
visible lane labels and a different two-question cue, provides bounded practice,
and ends with a fresh loose-equipment case. The learner never induces a symptom,
injury, head impact, collision, equipment failure, or real stop event. No body
or fitness norms, wearable data, media proof, standard-body route, speed, pain,
or Tutor confidence establishes credit/mastery. Tutor metadata may cue approved
models, actions, adaptations, and stop/handoff rules; it cannot diagnose,
prescribe, observe, clear return, certify movement/permission, pressure
continuation, or override learner, guardian, professional, or safety authority.

## Production acceptance boundary

A production lesson in this wave is acceptable only when a human curriculum
review confirms that its subject/type-specific teaching and evidence meet the
governing standard at the quality level demonstrated by the approved sample.
Automated validation may confirm schemas, refs, protected-answer separation,
arithmetic, required fields, and privacy markers. It cannot establish pedagogy,
age fit, cultural or body dignity, creative authority, meaningful transfer, or
the adequacy of a worked example by count alone.

This freeze authorizes the six lesson-model references for production use. It
does not authorize curriculum regeneration, application changes, Tutor runtime,
deployment, or mechanical propagation.

`DIRECTOR_APPROVED_LESSON_MODELS_R1_FROZEN`
