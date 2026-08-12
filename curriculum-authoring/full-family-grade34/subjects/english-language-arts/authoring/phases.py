"""Per-phase instructional templates for the Grade 3 and Grade 4 unit arcs.

Each entry supplies the objective stem and the three instructional moves that
distinguish one day of a unit from another. `{f}` interpolates the day's focus.
The two grades use different arcs and different wording; neither reuses the
Grade 5 arc.
"""

# --- Grade 3 -----------------------------------------------------------------
G3 = {
"Launch and baseline": dict(
 obj="Surface what you already know and produce a no-penalty baseline.",
 model="Introduce {f} with one short, accessible example. Say plainly that today's work is a starting picture, not a score.",
 guided="Try {f} together on one easy item. Name aloud what the learner already does well.",
 indep="The learner attempts {f} once on their own so today's starting point is on record.",
 exit="Name one thing you already know about {f} and one thing you want help with."),
"Word work and decoding focus": dict(
 ww="Warm up by clapping the syllables in four already-familiar words before any new word appears.",
 obj="Read and spell the words this unit needs by using their parts.",
 model="Show two or three words tied to {f}. Break each into syllables or known parts and read it slowly, then at normal speed.",
 guided="Read a short word list together. For each word, ask which part the learner recognized first.",
 indep="The learner reads six words connected to {f} and writes the part that unlocked each one.",
 exit="Read one long word from today and name the part that helped you."),
"Explicit model A": dict(
 obj="Build a clear picture of {f} from an explicit worked example.",
 model="Demonstrate {f} step by step, thinking aloud. Show the wrong move once and say why it is wrong.",
 guided="Redo the same example together while the learner narrates each step.",
 indep="The learner works one item like the model and labels each step.",
 exit="Show the first two steps of {f} and explain why they come in that order."),
"Guided practice A": dict(
 obj="Practice {f} with support that fades between the first and second try.",
 model="Restate the steps for {f} in one sentence and post them where the learner can see them.",
 guided="Work two items on {f}. Prompt fully on the first; on the second, prompt only when the learner stalls.",
 indep="The learner finishes one item on {f} with the step list visible but no verbal prompting.",
 exit="Do one item of {f} and circle the step you needed most."),
"Fluency and rereading practice": dict(
 ww="Warm up with a thirty-second phrase-reading drill on the single hardest sentence in today's passage.",
 obj="Read a passage accurately, at a workable pace, and with expression on a reread.",
 model="Read a short passage connected to {f} aloud, or model it silently with marked phrasing. Read it a second time and point out what improved.",
 guided="Read the same passage together. Mark the phrases where meaning breaks and reread only those.",
 indep="The learner rereads the passage a third time, silently or aloud, and notes one line that improved.",
 exit="Which line got easier on the reread, and what changed?"),
"Independent application A": dict(
 obj="Apply {f} to new material without prompting and record the reasoning.",
 model="Restate the success criteria for {f}. Answer clarifying questions about the task, not about the answer.",
 guided="Confirm the learner can restate the task in their own words before starting.",
 indep="The learner applies {f} to new material alone and writes the reasoning or evidence behind the result.",
 exit="Give your answer for {f} and the evidence that supports it."),
"Explicit model B": dict(
 obj="Extend {f} to a second, harder case shown explicitly.",
 model="Demonstrate {f} on a case the first model did not cover. Name exactly what is different about it.",
 guided="Compare the first case and the harder case side by side and name the difference aloud.",
 indep="The learner works one harder case of {f} and marks where it differed from the easier one.",
 exit="What made today's case of {f} harder, and what did you do about it?"),
"Guided practice B": dict(
 obj="Practice the harder form of {f} with support that fades.",
 model="Recap the harder form of {f} in one sentence.",
 guided="Work two harder items together, prompting on the first only.",
 indep="The learner completes one harder item of {f} independently.",
 exit="Do one harder item of {f} and name the step that nearly tripped you."),
"Shared close reading": dict(
 obj="Read one passage closely with an adult or partner, focused on {f}.",
 model="Read the assigned passage aloud or silently together. Stop three times and ask what the text has established so far.",
 guided="Reread the section that matters for {f}. Underline or list the exact words that carry it.",
 indep="The learner writes one text-based statement about {f} and copies the words that prove it.",
 exit="Quote the words from the passage that prove your statement about {f}."),
"Reteach and varied practice": dict(
 obj="Repair the most common error in {f} using a different representation.",
 model="Show one plausible wrong answer about {f}. Name the error neutrally and show a different way to picture it.",
 guided="Fix two flawed examples together and say what the fix was each time.",
 indep="The learner fixes one flawed example alone and explains the correction.",
 exit="Describe the mistake people make with {f} and how to catch it."),
"Vocabulary and language study": dict(
 obj="Use the language and vocabulary that {f} depends on.",
 model="Teach the words, spelling patterns, or conventions {f} requires, with two examples and one non-example.",
 guided="Sort or apply the words and conventions together in short sentences.",
 indep="The learner uses the target words or conventions correctly in two sentences of their own.",
 exit="Use one target word or convention correctly in a sentence about this unit."),
"Writing plan and draft": dict(
 obj="Plan and draft writing that carries {f}.",
 model="Show a plan for the writing task, then draft the opening in front of the learner and think aloud while choosing.",
 guided="Build the learner's plan together: what it is about, what goes first, and what the reader needs.",
 indep="The learner drafts from their own plan. The tutor may question and prompt but writes none of the learner's text.",
 exit="What is your writing about in one sentence, and what comes first?"),
"Writing revise and edit": dict(
 obj="Revise the draft for meaning and then edit it for conventions.",
 model="Show revision and editing as two separate passes and demonstrate one of each on a sample, never on the learner's assessed draft.",
 guided="Read the learner's draft aloud together and mark the one place a reader would get lost.",
 indep="The learner revises that place, then makes one editing pass for capitals, end marks, and spelling.",
 exit="Name the one change you made for meaning and the one you made for correctness."),
"Talk and listening practice": dict(
 obj="Say and hear ideas about {f} following agreed discussion rules.",
 model="State the discussion rules and model one full turn, including how to build on someone else.",
 guided="Hold a short exchange about {f}. Every participant may pass; written turns count as turns.",
 indep="The learner contributes one prepared turn about {f}, spoken, written on a card, or typed.",
 exit="Write or say one thing someone else said that changed or confirmed your thinking."),
"Skill consolidation and retrieval": dict(
 obj="Retrieve the unit's moves from memory and connect them.",
 model="List the unit's moves without explanation and ask the learner to recall what each one means.",
 guided="Work a short mixed set that requires choosing which move applies.",
 indep="The learner completes a mixed retrieval set covering {f} and earlier unit skills.",
 exit="Which unit move is strongest for you right now, and which needs one more day?"),
"Transfer to a new text": dict(
 obj="Use the unit's skills on unfamiliar material.",
 model="Present an unfamiliar text or task connected to {f}. Give no content preview beyond genre and purpose.",
 guided="Confirm the learner knows the task. Do not preview the answer.",
 indep="The learner applies {f} to the unfamiliar material independently and records the evidence used.",
 exit="What did you do first with the new text, and did it work?"),
"Unit assessment": dict(
 obj="Show independent evidence of this unit's targets.",
 model="Read the directions aloud if requested and confirm access supports. Provide no content coaching once the assessment begins.",
 guided="No guided phase. Access supports remain available; content help does not.",
 indep="The learner completes the unit assessment independently. The tutor does not write, dictate, or supply any part of an assessed response.",
 exit="Which item are you least sure about, and why?"),
"Correction, publication, and reflection": dict(
 obj="Correct one item with understanding and publish or file the unit product.",
 model="Return the evidence by target rather than by score. Model correcting one item aloud.",
 guided="Work through the learner's chosen correction together until the reasoning is sound.",
 indep="The learner corrects one item, finishes the unit product, and writes one line about what changed.",
 exit="What did you fix, and what will you carry into the next unit?"),
}

# --- Grade 4 -----------------------------------------------------------------
G4 = {
"Launch and diagnostic": dict(
 obj="Establish what you already do and produce an unscored diagnostic.",
 model="Frame {f} against the unit question. State that today's evidence sets a baseline and is not scored.",
 guided="Attempt one accessible item together and name the strategy the learner already used.",
 indep="The learner completes a short diagnostic on {f} without help.",
 exit="What did you already know about {f}, and where did you stop?"),
"Word study and morphology": dict(
 ww="Warm up by listing the roots and affixes already collected this unit, then add today's to the list.",
 obj="Read and use unfamiliar words by combining sound, syllables, and meaningful parts.",
 model="Take two unfamiliar multisyllabic words tied to {f}. Show syllabication and the root or affix, in context and in isolation.",
 guided="Attack four words together, naming the part that carried the meaning each time.",
 indep="The learner decodes and defines four new words and uses two in sentences about {f}.",
 exit="Define one word from today using its parts, then check it against a reference."),
"Concept model A": dict(
 obj="Build an accurate model of {f} from an explicit demonstration.",
 model="Demonstrate {f} with a full worked example and think aloud at each decision point.",
 guided="Rebuild the same example together, with the learner naming each decision.",
 indep="The learner works one parallel item and annotates the decisions made.",
 exit="Explain the reasoning behind the first decision in {f}."),
"Guided practice A": dict(
 obj="Practice {f} with support that is deliberately withdrawn.",
 model="State the criteria for {f} in one sentence and show what a weak response looks like.",
 guided="Work two items on {f}, prompting fully on the first and only on request for the second.",
 indep="The learner completes one item on {f} without prompting.",
 exit="Complete one item of {f} and name the criterion you met most convincingly."),
"Close reading with evidence": dict(
 obj="Read one passage closely and cite the exact evidence for a claim about {f}.",
 model="Read the passage together, stopping to distinguish what is stated from what is implied.",
 guided="Locate two candidate pieces of evidence for {f} and judge which is stronger and why.",
 indep="The learner writes one claim about {f} with quoted or precisely paraphrased support.",
 exit="State your claim and the evidence, and say why that evidence and not the other."),
"Independent application A": dict(
 obj="Apply {f} to new material independently and document the reasoning.",
 model="Restate the task and the audience. Answer questions about the task, not about the content.",
 guided="Confirm the learner can restate the task and criteria before beginning.",
 indep="The learner applies {f} to unfamiliar material alone and records both result and reasoning.",
 exit="Give your result for {f} and the reasoning that produced it."),
"Concept model B": dict(
 obj="Extend {f} to a case the first model did not handle.",
 model="Demonstrate {f} on a harder or contrasting case and name precisely what changed.",
 guided="Compare the two cases and articulate the rule that covers both.",
 indep="The learner handles one harder case and states the rule that covers both cases.",
 exit="What rule covers both versions of {f} you have now seen?"),
"Guided practice B": dict(
 obj="Practice the extended form of {f} with fading support.",
 model="Recap the extended form of {f} and the criterion that distinguishes it.",
 guided="Work two extended items together, fading support on the second.",
 indep="The learner completes one extended item of {f} independently.",
 exit="Complete one extended item of {f} and name what made it harder."),
"Reteach and varied practice": dict(
 obj="Diagnose and repair the characteristic error in {f}.",
 model="Present a plausible but wrong response about {f}. Name the error neutrally and re-represent the idea differently.",
 guided="Diagnose and repair two flawed responses together, naming each error type.",
 indep="The learner repairs one flawed response alone and explains what the writer misunderstood.",
 exit="Name the error pattern in {f} and the check that catches it."),
"Craft or structure analysis": dict(
 obj="Analyze how the text is built and what that construction accomplishes for {f}.",
 model="Walk through a passage naming its structural or craft choices and what each one does for a reader.",
 guided="Analyze a second passage together and argue for the structure or craft label from evidence.",
 indep="The learner analyzes a third passage and justifies the label with two pieces of evidence.",
 exit="Name the structure or craft choice and the evidence that rules out the alternative."),
"Source or research work": dict(
 obj="Gather, record, and attribute information honestly in service of {f}.",
 model="Model locating relevant information, paraphrasing it, and recording where it came from.",
 guided="Take notes from one source together, checking each paraphrase against the original wording.",
 indep="The learner takes notes from a source independently and records the source information.",
 exit="Show one paraphrased note and the source it came from."),
"Writing plan and draft": dict(
 obj="Plan and draft writing appropriate to task, purpose, and audience for {f}.",
 model="Show the plan and draft an opening aloud, narrating the choices made for this audience.",
 guided="Build the learner's plan together: purpose, audience, structure, and evidence to be used.",
 indep="The learner drafts from their own plan. The tutor may question and prompt but supplies none of the learner's text.",
 exit="State your purpose, audience, and the structure you chose."),
"Writing revision workshop": dict(
 obj="Revise for development and organization, then edit to the Grade 4 language standards.",
 model="Demonstrate one substantive revision and one editing pass on a sample, never on the learner's assessed draft.",
 guided="Read the draft together and identify the weakest-developed section and one convention pattern to fix.",
 indep="The learner revises that section, then edits for fragments, run-ons, commas, and confused words.",
 exit="Name the revision you made and the convention you corrected."),
"Discussion or presentation practice": dict(
 obj="Present or discuss ideas about {f} in an organized way, with a private alternative available.",
 model="Model a prepared turn: claim, evidence, and a question for the group. Model formal and informal register.",
 guided="Hold a short structured discussion on {f} with assigned roles. Any participant may pass; written turns count.",
 indep="The learner delivers one prepared contribution about {f}, spoken, written, typed, or recorded, entirely by choice.",
 exit="Identify one reason and one piece of evidence someone else provided."),
"Transfer challenge": dict(
 obj="Apply the unit's skills to unfamiliar material under a new constraint.",
 model="Present unfamiliar material connected to {f} with no content preview.",
 guided="Confirm the task and criteria only. Do not preview the content.",
 indep="The learner completes the transfer task independently and documents the evidence used.",
 exit="What transferred cleanly, and what needed a different approach?"),
"Retrieval and assessment preparation": dict(
 obj="Retrieve the unit's targets from memory and identify the remaining gap.",
 model="Name the unit targets without explanation and ask the learner to reconstruct each one.",
 guided="Work a mixed set that requires selecting the right move rather than repeating one.",
 indep="The learner completes a mixed retrieval set and marks which target is least secure.",
 exit="Which target is least secure, and what would fix it in one session?"),
"Unit assessment": dict(
 obj="Produce independent evidence of the unit's targets.",
 model="Read directions aloud on request and confirm access supports. Provide no content coaching once the assessment begins.",
 guided="No guided phase. Access supports remain available; content help does not.",
 indep="The learner completes the unit assessment independently. The tutor does not write, dictate, outline, or supply any part of an assessed response.",
 exit="Which item are you least confident about, and what would resolve it?"),
"Targeted correction, publication, and reflection": dict(
 obj="Correct with understanding and publish or file the unit product.",
 model="Return evidence by target rather than by score. Model a full correction with reasoning.",
 guided="Work the learner's chosen correction together until the reasoning holds.",
 indep="The learner corrects one item, completes the unit product, and writes a short reflection on what changed.",
 exit="What did you correct, and what will you carry forward?"),
}
