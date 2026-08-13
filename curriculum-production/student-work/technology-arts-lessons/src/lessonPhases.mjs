/**
 * Phase archetypes: the reason a lesson-level task is not the unit task
 * repeated 6 or 12 times.
 *
 * Every authored lesson carries a `phase` (where it sits in the unit's
 * instructional arc) and a `focus` (the specific idea that day). The phase
 * decides the SHAPE of the student's work — probing prior knowledge, tracing
 * a model, scaffolded practice, independent build, close analysis, revision
 * after error — and the focus decides its CONTENT. Two lessons in the same
 * unit therefore produce structurally different tasks, not the same task with
 * a different noun swapped in.
 *
 * Each archetype supplies, per subject, the primary task text, the
 * deliverable, and the concrete checks that task is scored against.
 *
 * Text here is deliberately written in direct second person and avoids the
 * templated-scaffold phrasings the shared production-quality specificity
 * heuristic flags ("in this lesson students will", "review the concepts from
 * this unit", "practice the skills learned in this unit", etc.).
 */

/** Modes, in the order a unit normally moves through them. */
export const PHASE_ARCHETYPES = {
  'Launch and diagnostic': 'PROBE',
  'Explicit model': 'MODEL',
  'Concept model A': 'MODEL_A',
  'Concept model B': 'MODEL_B',
  'Guided practice': 'GUIDED',
  'Guided practice A': 'GUIDED_A',
  'Guided practice B': 'GUIDED_B',
  'Independent application A': 'APPLY',
  'Application or project': 'BUILD',
  'Investigation or close reading': 'INVESTIGATE',
  'Reteach and varied practice': 'RETEACH',
  'Performance task build': 'INCREMENT',
  'Mastery check': 'DEMONSTRATE',
  'Synthesis and review': 'SYNTHESIZE',
  'Unit assessment': 'ASSESS',
  'Correction and reflection': 'CORRECT',
}

/** Short human label for the kind of work, used in the task label. */
export const MODE_WORK_LABEL = {
  PROBE: 'Diagnostic probe',
  MODEL: 'Worked-model trace',
  MODEL_A: 'First concept model',
  MODEL_B: 'Second concept model',
  GUIDED: 'Guided practice',
  GUIDED_A: 'Guided practice (first pass)',
  GUIDED_B: 'Guided practice (second pass)',
  APPLY: 'Independent application',
  BUILD: 'Build and test',
  INVESTIGATE: 'Investigation',
  RETEACH: 'Varied re-practice',
  INCREMENT: 'Performance-task increment',
  DEMONSTRATE: 'Mastery demonstration',
  SYNTHESIZE: 'Synthesis',
  ASSESS: 'Unit assessment',
  CORRECT: 'Correction and reflection',
}

/** Which modes are graded-of-record vs. formative/no-penalty. */
export const NON_PENALTY_MODES = new Set(['PROBE', 'MODEL', 'MODEL_A', 'MODEL_B', 'RETEACH'])
export const SUMMATIVE_MODES = new Set(['DEMONSTRATE', 'ASSESS'])

const t = (ctx) => ({
  focus: ctx.focus,
  topic: ctx.unitTopics[0] ?? ctx.focus,
  topic2: ctx.unitTopics[1] ?? ctx.unitTopics[0] ?? ctx.focus,
  unit: ctx.unitTitle,
  day: ctx.dayInUnit,
  mins: ctx.estimatedMinutes,
})

/* ------------------------------------------------------------------ *
 * TECHNOLOGY / CS — every mode is a logic, code, debugging, or design
 * task with an explicit pass/fail check path. Nothing here touches a
 * real account, a real credential, or a live external system.
 * ------------------------------------------------------------------ */

export const TECH_TASK = {
  PROBE: (c) => `Before any explanation of ${t(c).focus}, record what you already think. Write your current best answer to how ${t(c).focus} works, then sketch — in words, boxes, or pseudocode — the steps you believe are involved. Predict one input that would make your sketch fail. Then run or hand-trace your own sketch against two inputs you invent and mark where the prediction held and where it broke. Wrong predictions are the point of this task and cost you nothing; an unrecorded prediction is the only way to lose credit.`,
  MODEL: (c) => `Work through the provided worked model of ${t(c).focus} one step at a time rather than reading it straight through. For each step, write what changed and why that step is legal. Build a trace table with one row per step showing the values or states before and after. Then change exactly one line, value, or condition in the model, predict the new result before running or re-tracing it, and record whether your prediction was right. Explain in your own words the rule that makes ${t(c).focus} behave the way the model shows.`,
  MODEL_A: (c) => `Study the first model of ${t(c).focus} and reduce it to a rule you could hand to someone else. Annotate the model to mark where the rule is applied and where it is only set up. Restate the rule in one sentence with no example in it, then write one fresh example of your own that obeys the rule and one near-miss that violates it. Hand-trace both and record which of your two cases the rule accepts, so the boundary of ${t(c).focus} is written down rather than assumed.`,
  MODEL_B: (c) => `Study the second model of ${t(c).focus} alongside the first one you traced earlier in this unit. Build a two-column comparison: what the two models do the same way, and where they diverge. Name the specific condition that decides which approach applies. Then take one input the first model handles well and hand-trace it through the second model, and explain in writing why the result matches or differs. Your comparison must cite a concrete step from each model, not a general impression of ${t(c).focus}.`,
  GUIDED: (c) => `Complete two supported problems on ${t(c).focus}. On the first, work step by step with prompts available, and after each step write the one-line reason that step is correct. On the second, work without prompts and only check the reference after you commit to an answer. Both problems must show the intermediate states — a trace table, printed values, or a labelled diagram — not just a final result. Then state which of the two felt less certain and name the specific step where your confidence dropped.`,
  GUIDED_A: (c) => `Work the first supported pass on ${t(c).focus}. Take two prepared cases and solve each with the scaffold visible, writing after every step the reason that step is legal and what would have gone wrong without it. Record intermediate values or states for both cases. Then mark, on your own work, the single step you would most likely get wrong if the scaffold were removed — that mark is what the second pass will test.`,
  GUIDED_B: (c) => `Work the second supported pass on ${t(c).focus} with the scaffold removed. Solve two fresh cases without prompts, then compare your steps against the first pass you completed earlier in this unit. Where your unscaffolded work diverges from the scaffolded version, decide which one is actually correct and write the reason. Specifically revisit the step you flagged as fragile in the first pass and report whether it held this time and what evidence shows it.`,
  APPLY: (c) => `Work independently on ${t(c).focus} in a situation nobody has worked for you. Define the inputs and the expected result before you build anything. Then produce the working artifact — code, an algorithm, a configuration, a labelled design, or a documented procedure — and demonstrate it on at least two inputs you chose, one ordinary and one edge case. Record the actual result beside the expected result for each. Where they differ, fix the artifact and note what the difference revealed about ${t(c).focus}.`,
  BUILD: (c) => `Build a working artifact for a stated need arising in the unit "${t(c).unit}", built around what this session covers: ${t(c).focus}. Write the requirements and the success conditions first, in testable form, before writing the artifact. Then implement it, run it against at least three cases — a normal case, a boundary case, and a case designed to break it — and log actual versus expected for each. Fix every failing case and re-run. Submit the artifact, the test log, and a short design note explaining one alternative you rejected and why.`,
  INVESTIGATE: (c) => `Investigate a prepared artifact, dataset, or system description involving ${t(c).focus} that you did not build. Work out what it does before deciding whether it is any good: trace its behaviour on two inputs, document the actual outputs, and write a plain-language description of its logic. Then evaluate it — name one specific strength and one specific weakness, each tied to a step you traced, and propose one concrete change with the reason it would help. Evaluate only artifacts provided for this purpose; do not probe, scan, or attempt access to any live or third-party system.`,
  RETEACH: (c) => `Re-approach ${t(c).focus} using a different representation than the one you used before — if you worked in code, work it as a diagram or a trace table; if you worked on paper, work it as a runnable artifact. Solve three short varied cases in the new representation, spacing them rather than doing them in one block. After each, write one line on what the new representation made visible that the old one hid. This work is not scored for a grade; it is scored for whether the reasoning about ${t(c).focus} is now stable across two representations.`,
  INCREMENT: (c) => `Advance the unit performance task by exactly one reviewable increment, drawing on ${t(c).focus}. Before you start, write what state the work is in now and what "done for today" means in checkable terms. Build only that increment, then verify it against the condition you wrote and record the result. Update a running build log with the date, what changed, what you tested, and what broke. Finish by naming the single next increment and the risk most likely to block it.`,
  DEMONSTRATE: (c) => `Demonstrate ${t(c).focus} independently, with no scaffold, prompts, or worked example in view. Produce a complete correct solution to a new problem, then prove it works: state the expected result first, run or hand-trace at least two cases including one boundary case, and show actual against expected. Then explain the reasoning in your own words well enough that a reader who has not seen ${t(c).focus} could follow why each decision was made. Both the working result and the explanation are required — either one alone is incomplete.`,
  SYNTHESIZE: (c) => `Connect ${t(c).focus} to the other ideas this unit has built, including ${t(c).topic2}. Produce a one-page map — concept map, comparison table, or annotated diagram — showing how at least three ideas from the unit relate, with each link labelled by the relationship rather than just drawn. Then work one problem that requires two of those ideas together and show which part of your solution came from which. Name the idea you are least sure of and the specific question you would need answered to be sure.`,
  ASSESS: (c) => `Complete the unit assessment task for ${t(c).focus} independently and under the unit's stated conditions. Produce the required artifact or solution, show the reasoning or process that produced it, and verify it against the success conditions before submitting. Include your own check: state what result you expected, what you actually got on at least two cases, and what you did about any difference. Use only your own work; a tutor may clarify the instructions but must not supply, debug, or write any part of the graded submission.`,
  CORRECT: (c) => `Correct and reflect on your own earlier work involving ${t(c).focus}. Build a defect log: one row per error, giving the symptom you or the check observed, the root cause you diagnosed, the specific change that fixed it, and the check that now passes. Include at least one case that failed before the fix and passes after it. Then write what pattern connects your errors — a misread condition, a skipped verification, an assumption about ${t(c).focus} — and name one habit that would catch that pattern earlier next time.`,
}

export const TECH_CHECKS = {
  PROBE: (c) => [
    `A written prediction about ${t(c).focus} exists and is dated before any instruction or reference was consulted.`,
    'At least two self-chosen inputs were traced against the initial sketch, with the outcome of each recorded.',
    'Each place the prediction held and each place it broke is marked explicitly rather than silently corrected.',
    'No real account, password, API key, or live system was used — all inputs are invented or sandboxed.',
  ],
  MODEL: (c) => [
    'The trace table has one row per step and shows values or states both before and after that step.',
    'Every step carries a written reason that step is legal, not just a restatement of what happened.',
    'Exactly one deliberate change was made to the model, with a prediction recorded before the re-run and the outcome after.',
    `The rule governing ${t(c).focus} is restated in the student's own words rather than copied from the model.`,
  ],
  MODEL_A: (c) => [
    `The rule for ${t(c).focus} is stated in one sentence that contains no example.`,
    'One original conforming example and one original near-miss are supplied, both hand-traced.',
    'The written boundary correctly separates the conforming case from the violating case.',
    'No real credentials or live external systems appear anywhere in the examples.',
  ],
  MODEL_B: (c) => [
    'A two-column comparison names at least one concrete shared step and one concrete point of divergence.',
    'The condition that selects between the two approaches is stated explicitly.',
    'One input is traced through both models with the matching or differing result explained.',
    'Comparisons cite specific steps from each model rather than general impressions.',
  ],
  GUIDED: (c) => [
    'Both problems show intermediate states — trace table, printed values, or labelled diagram — not only final answers.',
    'The first problem carries a per-step reason; the second was attempted before any reference was checked.',
    'The step where confidence dropped is named specifically, not described as general uncertainty.',
    `Every result is traceable to ${t(c).focus} or another named topic from this unit.`,
  ],
  GUIDED_A: (c) => [
    'Two prepared cases are solved with per-step reasons recorded while the scaffold was visible.',
    'Intermediate values or states are shown for both cases.',
    'Exactly one step is flagged as the one most likely to fail without the scaffold.',
    'No real personal data, credential, or production system is referenced in either case.',
  ],
  GUIDED_B: (c) => [
    'Two fresh cases are solved without prompts, with work shown.',
    'The unscaffolded work is explicitly compared against the earlier scaffolded pass.',
    'Each divergence is resolved with a stated reason for which version is correct.',
    'The step flagged as fragile in the first pass is revisited with evidence of whether it held.',
  ],
  APPLY: (c) => [
    'Inputs and expected results were written down before the artifact was built.',
    'The artifact runs, displays, or demonstrates correctly on at least two self-chosen inputs including one edge case.',
    'Actual result is recorded beside expected result for every case, with differences resolved rather than ignored.',
    'All data is invented or sandboxed — no real password, API key, precise location, or real person\'s information appears.',
  ],
  BUILD: (c) => [
    'Requirements and success conditions were written in testable form before implementation began.',
    'A test log shows at least three cases — normal, boundary, and a deliberate break case — with actual against expected.',
    'Every failing case was fixed and re-run, with the re-run result recorded.',
    'A design note names one rejected alternative and the reason for rejecting it.',
    'Nothing in the artifact uses a real credential, real personal data, or a live external system.',
  ],
  INVESTIGATE: (c) => [
    'The artifact\'s behaviour is traced on two inputs with actual outputs documented.',
    'A plain-language description of the logic is written before any judgement of quality.',
    'One specific strength and one specific weakness are each tied to a traced step.',
    'A proposed change is concrete and carries a stated reason it would help.',
    'Only artifacts supplied for this task were examined; no live, third-party, or production system was probed, scanned, or accessed.',
  ],
  RETEACH: (c) => [
    'The representation used differs from the one used in the earlier attempt.',
    'Three varied cases are completed and spaced rather than worked as one block.',
    'Each case carries a line on what the new representation made visible.',
    `Reasoning about ${t(c).focus} is consistent across both representations.`,
  ],
  INCREMENT: (c) => [
    'The starting state and a checkable definition of "done for today" were written before work began.',
    'Exactly one increment was built and verified against the stated condition, with the result recorded.',
    'The build log is updated with date, what changed, what was tested, and what broke.',
    'The next increment and its most likely blocking risk are both named.',
  ],
  DEMONSTRATE: (c) => [
    'The solution is complete and correct with no scaffold, prompt, or worked example in view.',
    'Expected results were stated first, then at least two cases including a boundary case were run with actual against expected shown.',
    'The written explanation is self-contained enough for a reader unfamiliar with the topic to follow each decision.',
    'The submission is the student\'s own work; assistance did not produce any graded part of it.',
    'No real credential, real personal data, or live external system appears anywhere.',
  ],
  SYNTHESIZE: (c) => [
    'The map connects at least three ideas from this unit with each link labelled by relationship, not merely drawn.',
    'One worked problem genuinely requires two of the mapped ideas together.',
    'The solution identifies which part came from which idea.',
    'The least-certain idea is named along with the specific question that would resolve it.',
  ],
  ASSESS: (c) => [
    'The required artifact or solution is complete and produced under the unit\'s stated conditions.',
    'Reasoning or process is shown, not only a final result.',
    'A self-check records expected against actual for at least two cases and what was done about any difference.',
    'The work is entirely the student\'s own; any tutor involvement was limited to clarifying instructions.',
    'No real accounts, credentials, or live systems were used at any point.',
  ],
  CORRECT: (c) => [
    'The defect log has one row per error with symptom, root cause, the specific fix, and the check that now passes.',
    'At least one case demonstrably failed before the fix and passes after it.',
    'A pattern connecting the errors is named rather than each error treated as isolated.',
    'One concrete habit that would catch the pattern earlier is stated.',
  ],
}

export const TECH_DELIVERABLE = {
  PROBE: 'Dated prediction sheet, first-attempt sketch or pseudocode, and a two-input trace showing where the prediction held and broke.',
  MODEL: 'Completed step-by-step trace table with per-step reasons, plus the one-change experiment with prediction and outcome.',
  MODEL_A: 'One-sentence rule statement, one conforming example, one near-miss, and hand-traces of both.',
  MODEL_B: 'Two-column model comparison, the stated selection condition, and one input traced through both models.',
  GUIDED: 'Two solved problems with intermediate states shown, per-step reasons on the first, and a named low-confidence step.',
  GUIDED_A: 'Two scaffolded solutions with per-step reasons, intermediate states, and one flagged fragile step.',
  GUIDED_B: 'Two unscaffolded solutions, a divergence comparison against the first pass, and a verdict on the previously flagged step.',
  APPLY: 'Working artifact, a written expected-result specification, and a two-case run log including one edge case.',
  BUILD: 'Working artifact, testable requirements written up front, a three-case test log with re-runs, and a design note naming a rejected alternative.',
  INVESTIGATE: 'Two-input behaviour trace, plain-language logic description, a strength/weakness pair tied to traced steps, and one proposed change.',
  RETEACH: 'Three spaced varied cases worked in a second representation, each with a note on what that representation revealed.',
  INCREMENT: 'One verified increment, the updated build log, and a named next increment with its blocking risk.',
  DEMONSTRATE: 'Independent complete solution, a two-case verification with expected against actual, and a self-contained written explanation.',
  SYNTHESIZE: 'One-page labelled concept map across at least three unit ideas, plus one two-idea problem with attribution of each part.',
  ASSESS: 'Completed assessment artifact, visible reasoning or process, and a two-case self-check with resolution of any difference.',
  CORRECT: 'Defect log with symptom/root cause/fix/passing check per error, one before-and-after failing case, and a named error pattern with a countermeasure habit.',
}

/* ------------------------------------------------------------------ *
 * ARTS / MUSIC — creation, analysis, and portfolio work. Nothing here
 * requires a camera, a voice recording, a public performance, or an
 * audience beyond one trusted person. Sources must be public domain,
 * properly licensed and cited, or the student's own.
 * ------------------------------------------------------------------ */

export const ARTS_TASK = {
  PROBE: (c) => `Before any instruction on ${t(c).focus}, make a short baseline response so you can see your own starting point later. Spend a few minutes producing something — a quick sketch, a short pattern, a few bars, a rough plan, or a written description if you prefer not to produce a piece today. Then write three things you already notice about ${t(c).focus} and one question you cannot yet answer. Keep this baseline; you will compare later work against it. Nothing here is judged for quality, only for being honest and complete.`,
  MODEL_A: (c) => `Study the first model work for ${t(c).focus} closely before making anything of your own. Write what you notice in three passes: first what is literally there, then how it is put together, then what effect that has on a viewer or listener. Name the specific choice the maker used to create ${t(c).focus}. Then reproduce that one element — not the whole work — in your own short study, and write one sentence on what was harder than it looked. Use only public-domain, openly licensed, or supplied model works, and cite whatever you studied.`,
  MODEL_B: (c) => `Study a second, contrasting model work for ${t(c).focus} and set it beside the first one you examined earlier in this unit. Build a comparison naming one choice the two makers share and one place they clearly diverge, with the effect of each difference described in terms a listener or viewer could verify. Then make one short study of your own that borrows the second maker's approach to ${t(c).focus}. Cite both works. Anything you did not make yourself must be public domain, openly licensed, or properly attributed.`,
  MODEL: (c) => `Work through the demonstrated model of ${t(c).focus} step by step rather than judging the finished result. Record the order the maker worked in, the decision made at each stage, and the point where the piece could have gone a different way. Then reproduce the single stage you found least obvious, in your own short study, and write what changed in your hands versus in the model. Cite the model work; use only public-domain, openly licensed, or supplied material.`,
  GUIDED_A: (c) => `Complete a first supported pass on ${t(c).focus}: two short studies with the reference or scaffold available. After each, write the specific choice you made and the effect you were reaching for. Keep both studies even if you dislike them — they are evidence of the process, not a portfolio piece. Mark the one move you think you could not repeat without the reference; the second pass will test exactly that. Work stays private to you and one trusted adult unless you choose otherwise.`,
  GUIDED_B: (c) => `Complete a second supported pass on ${t(c).focus} with the reference put away. Make two fresh short studies from memory and judgement, then set them beside the first pass. Where the unassisted work differs, decide which version better achieves the effect and write the reason in terms of the actual work, not preference alone. Revisit the move you flagged as unrepeatable and report honestly whether it held. Sharing remains private; no recording, photograph, or performance for an audience is required.`,
  GUIDED: (c) => `Complete two supported studies on ${t(c).focus}, the first with the reference in view and the second without it. After each, name the specific choice you made and the effect you intended, then note whether the effect actually landed when you looked or listened again. Identify the step where your confidence dropped. Both studies stay private unless you choose to share; describing your work in writing is always an acceptable substitute for presenting it aloud.`,
  APPLY: (c) => `Independently make one short original piece built around ${t(c).focus}, aiming at an effect you choose in advance. Write the intended effect first, in one sentence, before you begin. Make the piece, then step back and judge honestly whether the effect landed, citing the specific element that carries it and one element that works against it. Revise that second element and keep both versions. The work must be your own; a tutor may demonstrate technique or give feedback but must not make any part of the graded piece.`,
  BUILD: (c) => `Create a complete short work built around ${t(c).focus} for the unit "${t(c).unit}". State your intent and your own success conditions before starting. Make the piece, then critique it against those conditions: which choice carries the intent, which choice undercuts it, and what a revision would change. Revise at least once and keep both versions so the change is visible. Present it privately — to yourself, a parent, or one trusted adult — or submit a written description instead; no public performance, photograph, recording, or camera is required at any point.`,
  INVESTIGATE: (c) => `Closely examine a work you did not make that demonstrates ${t(c).focus}. Describe before you judge: what is present, how it is organised, and what happens over time or across the surface. Then interpret — what effect is created, and which specific element creates it. Support every claim with something a reader could check in the work itself. Finish with one question the work raises that you cannot answer from it alone. Use only public-domain, openly licensed, or properly cited works, and quote or excerpt no more than you need to make the point.`,
  RETEACH: (c) => `Return to ${t(c).focus} using a different medium or approach than your last attempt — if you worked visually, try it structurally or in writing; if you worked by ear, try it on paper. Make three short varied studies, spaced rather than all at once, and write after each what this approach made clear that the previous one did not. This work is not graded for quality; it is checked for whether your understanding of ${t(c).focus} now holds up in more than one form. Keep it private.`,
  INCREMENT: (c) => `Advance your unit performance piece by one reviewable increment, drawing on ${t(c).focus}. Before you begin, write where the work stands and what finishing today's increment would concretely look like. Make only that increment, then check it against what you wrote. Update a working log with the date, what you changed, what you tried that did not work, and what you kept. Name the next increment and the part you are most worried about. No audience, recording, or photograph is required — the log and the work itself are the evidence.`,
  DEMONSTRATE: (c) => `Demonstrate ${t(c).focus} independently, without the reference, scaffold, or model in view. Produce one complete short piece or analysis, then explain the reasoning: what you intended, which specific choices deliver it, and how you checked. Your explanation must be specific enough that someone who has not seen your work could tell what you did and why. Written explanation is fully acceptable in place of speaking or performing. The piece must be entirely your own authorship.`,
  SYNTHESIZE: (c) => `Draw ${t(c).focus} together with the other ideas built across this unit, including ${t(c).topic2}. Produce a single organised artifact — an annotated portfolio page, a comparison chart, or a mapped set of your own studies — showing how at least three of the unit's ideas relate and where each one shows up in work you actually made. Then make or analyse one short example that needs two of them at once and label which is doing what. Name the idea you are least confident about and what would settle it.`,
  ASSESS: (c) => `Complete the unit assessment task for ${t(c).focus} independently and under the unit's stated conditions. Produce the required piece or analysis, show the process or reasoning behind it, and check it against the stated criteria before submitting. Include your own judgement: what you intended, what the work actually achieves, and where the gap is. Everything submitted must be your own authorship. Presentation stays private or written; no public performance, camera, voice recording, or photograph is required to complete or pass this task.`,
  CORRECT: (c) => `Revise your earlier work on ${t(c).focus} and document the revision rather than quietly replacing it. Build a revision log: what specifically was not working, what you now believe caused it, the change you made, and how you can tell the change helped. Keep the before and after side by side. Then write what pattern connects the problems you found — a habit of rushing one stage, a technique not yet secure, an intent never stated clearly — and one thing you will do differently that would catch it sooner. Honest documentation of a weak result scores fully here.`,
}

export const ARTS_CHECKS = {
  PROBE: (c) => [
    `A dated baseline response to ${t(c).focus} exists and was made before any instruction.`,
    'Three specific noticings and one open question are recorded in writing.',
    'The baseline is preserved for later comparison rather than discarded or overwritten.',
    'A written description was accepted in place of a made piece if the student preferred; nothing required a camera, recording, or audience.',
  ],
  MODEL_A: (c) => [
    'Observation is recorded in three distinct passes: literal content, construction, and effect.',
    `The specific maker's choice that creates ${t(c).focus} is named, not described in general praise.`,
    'One element — not the whole work — is reproduced as a short study, with a note on what proved harder than expected.',
    'Every studied work is public domain, openly licensed, or supplied for this task, and is cited.',
  ],
  MODEL_B: (c) => [
    'One shared choice and one clear divergence between the two model works are both named.',
    'The effect of each difference is described in verifiable terms rather than as preference.',
    'A short original study borrows the second work\'s approach.',
    'Both works are cited; nothing uncredited and nothing outside public-domain or licensed use appears.',
  ],
  MODEL: (c) => [
    'The maker\'s working order and stage-by-stage decisions are recorded.',
    'At least one point where the work could have gone differently is identified.',
    'The least obvious stage is reproduced as a short study with a written comparison to the model.',
    'The model work is cited and is public domain, openly licensed, or supplied.',
  ],
  GUIDED_A: (c) => [
    'Two short studies were completed with the reference available and both were kept.',
    'Each study names the specific choice made and the intended effect.',
    'One move is flagged as not yet repeatable without the reference.',
    'Work remained private to the student and at most one trusted adult.',
  ],
  GUIDED_B: (c) => [
    'Two fresh studies were made without the reference in view.',
    'The unassisted work is compared against the first pass with a reasoned verdict on which better achieves the effect.',
    'The previously flagged move is revisited with an honest report of whether it held.',
    'No recording, photograph, performance, or audience was required.',
  ],
  GUIDED: (c) => [
    'Two studies were completed, the second without the reference in view.',
    'Each names the specific choice made and the intended effect, plus whether the effect actually landed on review.',
    'The step where confidence dropped is identified specifically.',
    'A written description was available as a full substitute for presenting aloud.',
  ],
  APPLY: (c) => [
    'The intended effect was written in one sentence before work began.',
    'The finished piece is original and uses the lesson\'s focus to pursue that effect.',
    'The self-critique cites one element that carries the intent and one that works against it.',
    'A revision of the weaker element exists and both versions are kept.',
    'The graded piece is the student\'s own authorship; assistance did not make any part of it.',
  ],
  BUILD: (c) => [
    'Intent and student-set success conditions were written before the work began.',
    'The finished work is complete and addresses the stated intent.',
    'The critique names the choice carrying the intent and the choice undercutting it.',
    'At least one revision exists with both versions kept so the change is visible.',
    'Presentation was private or written; no public performance, camera, recording, or photograph was required.',
  ],
  INVESTIGATE: (c) => [
    'Description precedes judgement, covering what is present and how it is organised.',
    'Every interpretive claim points to something checkable in the work itself.',
    'The specific element creating the effect is identified rather than the effect only named.',
    'One unanswerable question raised by the work is stated.',
    'Sources are public domain, openly licensed, or properly cited, and excerpts are no longer than the point requires.',
  ],
  RETEACH: (c) => [
    'The medium or approach differs from the previous attempt.',
    'Three short studies were completed and spaced rather than worked in one block.',
    'Each carries a note on what this approach clarified that the previous one did not.',
    `Understanding of ${t(c).focus} is consistent across both forms. Work stayed private.`,
  ],
  INCREMENT: (c) => [
    'The starting state and a concrete definition of the day\'s increment were written first.',
    'One increment was completed and checked against that definition.',
    'The working log records date, what changed, what was tried and abandoned, and what was kept.',
    'The next increment and the most worrying part are both named.',
    'No audience, recording, or photograph was required as evidence.',
  ],
  DEMONSTRATE: (c) => [
    'The piece or analysis was completed without reference, scaffold, or model in view.',
    'The explanation states intent, the specific choices delivering it, and the check performed.',
    'The explanation is specific enough to stand on its own for a reader who has not seen the work.',
    'Written explanation was fully accepted in place of speaking or performing.',
    'The work is entirely the student\'s own authorship.',
  ],
  SYNTHESIZE: (c) => [
    'At least three unit ideas are related in one organised artifact, each located in work the student actually made.',
    'One short example genuinely requires two ideas at once, with each labelled.',
    'The least-confident idea is named along with what would settle it.',
    'All included work is the student\'s own or properly cited.',
  ],
  ASSESS: (c) => [
    'The required piece or analysis is complete and produced under the unit\'s stated conditions.',
    'Process or reasoning is shown alongside the result.',
    'A self-judgement states intent, actual achievement, and the gap between them.',
    'The submission is entirely the student\'s own authorship.',
    'No public performance, camera, voice recording, or photograph was required to complete or pass.',
  ],
  CORRECT: (c) => [
    'The revision log records what was not working, the diagnosed cause, the change made, and how improvement can be told.',
    'Before and after versions are both kept and comparable.',
    'A pattern connecting the problems is named rather than each treated in isolation.',
    'One concrete change of practice is stated.',
    'Honest documentation of a weak result is scored on the documentation, not on the strength of the original piece.',
  ],
}

export const ARTS_DELIVERABLE = {
  PROBE: 'Dated baseline response (made or described in writing), three noticings, and one open question, preserved for later comparison.',
  MODEL_A: 'Three-pass observation notes, the named maker\'s choice, one single-element study, and a citation for the model work.',
  MODEL_B: 'Two-work comparison naming a shared choice and a divergence, one short study in the second approach, and citations for both works.',
  MODEL: 'Stage-by-stage record of the maker\'s process, one reproduced stage as a study, and a written comparison plus citation.',
  GUIDED_A: 'Two referenced studies with stated choices and intended effects, plus one flagged not-yet-repeatable move.',
  GUIDED_B: 'Two unassisted studies, a reasoned comparison against the first pass, and a verdict on the previously flagged move.',
  GUIDED: 'Two studies (second unreferenced) with stated choices, intended effects, landed-or-not judgements, and a named low-confidence step.',
  APPLY: 'One original short piece, a pre-written intent statement, a two-element self-critique, and a revision with both versions kept.',
  BUILD: 'Complete short work, pre-written intent and success conditions, a targeted critique, and at least one visible revision with both versions kept.',
  INVESTIGATE: 'Description-before-judgement analysis with every claim tied to checkable evidence, plus one open question and full source citations.',
  RETEACH: 'Three spaced studies in a second medium or approach, each with a note on what it clarified.',
  INCREMENT: 'One completed increment, the updated working log, and a named next increment with its main worry.',
  DEMONSTRATE: 'Independent complete piece or analysis plus a self-contained written explanation of intent, choices, and checks.',
  SYNTHESIZE: 'One organised artifact relating at least three unit ideas to work actually made, plus a two-idea example with each part labelled.',
  ASSESS: 'Completed assessment piece or analysis, visible process, and a self-judgement naming intent, achievement, and gap.',
  CORRECT: 'Revision log with cause/change/evidence per problem, before-and-after versions kept, a named pattern, and one practice change.',
}

export function modeForPhase(phase) {
  const mode = PHASE_ARCHETYPES[phase]
  if (!mode) throw new Error(`unmapped lesson phase: ${JSON.stringify(phase)}`)
  return mode
}
