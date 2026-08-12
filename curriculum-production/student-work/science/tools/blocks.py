"""Text that is identical in every Science work package, stored once.

Each package references these by id instead of carrying a copy, and the build
writes them to `policy/shared-blocks.json` so the validators and the gate
runner resolve exactly the same strings the student sheets render.

Rendering still prints them in full — a learner reading a safety brief must see
the prohibitions, not a pointer to them.
"""

from __future__ import annotations

NO_SUPPLIED_VALUES_RULE = (
    "This package prints no measurement, no observation, and no expected result. "
    "Every box below is blank because the record has to be yours. Any number you did not "
    "measure or calculate yourself is SUPPLIED: write the word SUPPLIED beside it and fill "
    "in the provenance line so a reader can tell your evidence from someone else's."
)

EQUAL_CREDIT_RULE = (
    "The alternative path is scored with the same rubric and earns the same credit as the "
    "hands-on path. Choosing it is never treated as failure and never lowers the ceiling."
)

SAFETY_HEADLINE = (
    "Read this before you touch any material. If anything here does not match what is in "
    "front of you, stop and ask the supervising adult."
)

SAFETY_HEADLINE_ELEMENTARY = (
    "Read this before you start. If anything here does not match what is in front of you, "
    "stop and ask the adult who is helping you."
)

PAUSE_RULE = (
    "A pause, a break, or a switch to the alternative path is never treated as failure and "
    "never lowers your score."
)

K8_DESK_PPE = (
    "No protective equipment is needed for desk work. Eye and hand protection are required the "
    "moment heat, sharp tools, or an unknown substance is involved — and this lesson's alternative "
    "path avoids all three."
)

K8_HANDS_ON_PPE = (
    "Wear eye protection and hand protection for any hands-on step. If you do not have them, run "
    "the alternative path instead; it needs no protective equipment and earns the same credit."
)

K8_DISPOSAL = (
    "Put everything back where it came from, wash your hands, and throw away only ordinary "
    "household waste. Nothing in this lesson may be poured into a drain unless it is plain water, "
    "and nothing is left sealed, warm, connected, or unaccounted for."
)

K8_HAZARD_NOTE = (
    "The curriculum source for this lesson declares no typed hazard list, because the hands-on "
    "option is family-chosen rather than prescribed. That is exactly why the adult approves the "
    "plan and the materials before anything is touched, and why the prohibitions below are not "
    "negotiable."
)

K8_SAFE_ORDER_NOTE = (
    "This lesson's curriculum source prescribes no fixed procedure, so this package states no "
    "invented one. Write your plan on the data sheet, have the adult approve it, then follow your "
    "own written order and change one thing at a time."
)

HS_DESK_SAFE_ORDER_NOTE = "This lesson is desk-based and prescribes no handling sequence."

HS_DESK_DISPOSAL = (
    "Nothing in this lesson produces waste beyond ordinary paper. File or recycle it."
)

SUPPLIED_HEADLINE = (
    "You can complete this lesson's analysis without performing the activity, for the same credit."
)

SUPPLIED_HOW = (
    "Use data you did not collect: a published dataset, table, or reference image that the lesson "
    "or its course data-source list names, retrieved by an adult. Then run the same analysis, "
    "answer the same questions, and be held to the same rubric."
)

SUPPLIES_NO_NUMBERS = (
    "No dataset is printed in this package. Nothing here is a record of an observation, and no "
    "expected value is given anywhere, because a printed number would be indistinguishable from a "
    "result and this curriculum never presents invented measurements as real ones."
)

SUPPLIED_SCORING = (
    "Scored with the same rubric as the hands-on path. The Data honesty and provenance criterion is "
    "where a supplied-data submission is checked hardest, not where it is penalised."
)

SUPPLIED_PROVENANCE_FIELDS = (
    "Source name",
    "Publisher or author",
    "Date you retrieved it",
    "Where in the source the value appears",
)

ALTERNATIVE_GUARANTEES = (
    "No special equipment, no purchase, and no account.",
    "No heat, no flame, no chemical, no mains electricity, and no cutting tool.",
    "No camera, photograph, video, or voice recording is required as evidence.",
    "No private disclosure about the learner, the family, the home, or its location.",
)

SUPPLIED_MATERIAL_CLARIFICATION = (
    "About the supplied or provided material named above: this package prints none of it. Supplied "
    "means a published table, data set, diagram, sequence, case study, observation log, or "
    "reference image that an adult retrieves and that you name on the provenance line. Nothing "
    "printed here is a record of an observation, so nothing here can be mistaken for yours."
)

ALTERNATIVE_HOW_TO_CHOOSE = (
    "The learner or the supervising adult may choose this path at any point, including after "
    "starting the other one. Switching is recorded as a path choice, never as an incomplete."
)

K8_DERIVED_PATH_NOTE = (
    "The curriculum source for these grades names one text-only path for every lesson rather than a "
    "lesson-specific activity, so the concrete task above is built from this lesson's own question, "
    "focus, and success criteria. A named, lesson-specific alternative for each elementary and "
    "middle-grade investigation is an open curriculum-authoring gap, recorded in "
    "reports/open-gaps.md."
)

PREDICTION_PROMPT = (
    "Before you start, write what you expect to happen and why. This is not graded and it is not "
    "marked wrong if it turns out differently."
)

RECORD_RULE = (
    "Fill these in as you go, not from memory afterwards. A trial that went wrong is written down "
    "and explained, never erased."
)

PROVENANCE_RULE = (
    "One line for every value you did not measure yourself. Origin is measured, calculated, or "
    "SUPPLIED. A supplied value with no source line earns no credit."
)

LIMITATIONS_PROMPT = (
    "What can this work not show, even done perfectly? Write it as something about the method, not "
    "about you."
)

IF_STUCK = (
    "Go back to the one thing you already know that this builds on, and say it out loud before you "
    "try again.",
    "Redo one supported example with the steps in front of you, then try a fresh one with the "
    "steps covered.",
    "If the hands-on path is the sticking point, switch to the alternative path. It is the same "
    "credit and it is not a retreat.",
    "Say which step you are stuck on, not just that you are stuck. The step is the thing that gets "
    "reteaching.",
)

RETEACH_NEVER = (
    "Reteaching never re-scores the alternative path lower, never requires the hands-on path, and "
    "never infers effort, motivation, diagnosis, or character from an error."
)

EXTENSION_NEVER = (
    "Extension never means completing another learner's graded work, and never means attempting "
    "anything the safety brief excludes."
)

NO_FIXED_ANSWER_KEY = (
    "Science work in this course is scored against criteria, not against a fixed answer. This "
    "package supplies no model answer and no expected value, because the learner's own record is "
    "the evidence and inventing one would license marking a correct record wrong."
)

SCORING_NON_NEGOTIABLES = (
    "Do not award credit for a numerical result the learner did not measure, calculate, or cite to "
    "a named source.",
    "Do not require the hands-on path. The alternative path is scored identically.",
    "Do not infer effort, motivation, diagnosis, or character from an error.",
    "Do not mark mastery from a single answer.",
    "Do not award Meets for reasoning that is well documented but contradicts the lesson's stated "
    "learning target. Well-evidenced and correct are separate criteria and both have to be met.",
)


# Grades 3-5 read the same safety rules, restated for their reading age. Each
# variant is keyed by the exact adult clause it replaces, and every one is
# strictly more restrictive than the adult text — it never permits anything the
# adult text forbids, and it removes conditional permissions a child should not
# be asked to judge. The adult clause stays on the guardian's scoring sheet, so
# nothing is hidden; only the wording the child reads changes.
#
# `safety_floor.build_safety_floor` fails the build if any prohibition or global
# stop condition lacks a variant, so a source change surfaces here rather than
# shipping adult wording to an eight-year-old.
ELEMENTARY_SAFETY_VARIANTS = {
    "Never mix household cleaning products; bleach combined with ammonia or acid releases toxic gas.":
        "Never mix cleaning products together, and never use them in a lesson at all. Cleaning "
        "products are not science materials.",
    "Never connect any investigation to mains electricity; low-voltage cells only.":
        "Never plug anything into a wall socket for a lesson. Small batteries only, and only the "
        "ones the lesson names.",
    "Never fully seal a reacting, fermenting, oxidising, or warm mixture in any container.":
        "Never put a lid, a cap, or a knot on anything that is bubbling, fizzing, rising, or warm. "
        "It has to stay open.",
    "Never have a flammable liquid open in the same room as a flame, hob, pilot light, heater, lamp, charger, or battery.":
        "If a bottle says flammable, it stays shut and you tell an adult. No lesson asks you to "
        "open one.",
    "Never use alcohol, or any other fuel, for a flame demonstration; no open-flame demonstration is used anywhere in this package.":
        "No lesson ever uses fire. If a step looks like it needs a flame, stop and tell an adult, "
        "because it is the wrong step.",
    "Never cut, tear, puncture, or open a sealed commercial product - cold pack, hand warmer, glow stick, or smoke detector.":
        "Never cut or break open a sealed packet - a cold pack, a hand warmer, a glow stick, or a "
        "smoke alarm. What is inside can hurt you.",
    "Never look at the sun directly or through any lens, filter, grating, or camera.":
        "Never look at the sun. Not with your eyes, and not through glass, a lens, a mirror, or a "
        "camera. Not even for a second.",
    "Never require a photograph, video, or voice recording as evidence of completion.":
        "You never have to send a photo, a video, or a recording of your voice to finish a lesson. "
        "Writing it or saying it is always enough.",
    "Never request or record a learner body measurement, health measurement, or medical history.":
        "No lesson asks for your weight, your height, your heartbeat, or anything about your health.",
    "Never present invented measurements as real experimental results.":
        "Never write down a number you did not really measure. If you did not do it, say so - that "
        "is always the right answer.",
    "Stop for any injury, burn, spill, fume, or allergic reaction and tell the supervising adult.":
        "Stop and tell your adult straight away if anyone is hurt or burned, if something spills, "
        "if you smell something strong, or if someone comes out in a rash.",
    "Stop if a material, tool, or step is not the one this lesson specifies.":
        "Stop if anything in front of you is not what the lesson says to use.",
    "Burn: cool it under running cool water for 20 minutes. Do not use ice, butter, or ointment.":
        "A burn: hold it under cool running water for 20 minutes and tell your adult. No ice, no "
        "butter, no cream.",
    "Splash in an eye: rinse with running water for 15 minutes, holding the eyelid open, before anything else.":
        "Something in your eye: rinse it under running water for 15 minutes, keeping the eye open, "
        "and call your adult while you rinse. Do this before anything else.",
    "Fumes or a strong smell: leave the room, open a window from outside the room, and do not go back in to tidy up.":
        "A strong smell: leave the room and tell your adult. Do not go back in to tidy up.",
    "Fire: do not use water. Get everyone out, close the door, and call the emergency number. Smother a very small contained flame with a metal pan lid or a fire blanket only if that is safe to do without reaching over it.":
        "A fire: get everyone out, shut the door behind you, and call the emergency number. Never "
        "try to put a fire out yourself, and never throw water on one.",
    "If anyone may have swallowed a magnet, a battery, or any material from a lesson, treat it as an emergency and seek medical help at once. Do not wait for symptoms.":
        "If anyone swallows a magnet, a battery, or anything from a lesson, tell an adult at once "
        "and get medical help straight away. Do not wait to see if they feel ill.",
    "A pause, break, or switch to the alternative activity is never treated as failure.":
        "Stopping, taking a break, or swapping to the other path is never failing.",
}

RUBRIC_SCALE = ("Not yet", "Approaching", "Meets", "Exceeds")

RUBRIC_CRITERIA = (
    {
        "criterion": "Scientific correctness",
        "not_yet": "A factual statement contradicts the lesson's stated learning target, or is stated as established when the lesson's own materials say otherwise.",
        "approaching": "Mostly consistent with the learning target, but one statement is wrong or is claimed more strongly than the evidence allows.",
        "meets": "Every factual statement is consistent with the lesson's stated learning target and success criteria, in whatever wording the learner chose.",
        "exceeds": "Correct, and the learner separates what this lesson establishes from what it only suggests.",
    },
    {
        "criterion": "Task completion and internal consistency",
        "not_yet": "The central task is unfinished, or the reported result contradicts the learner's own record.",
        "approaching": "The task is finished but part of the result is unsupported or inconsistent.",
        "meets": "The central task is complete and the result follows from the learner's own record.",
        "exceeds": "Complete and accurate, and the learner anticipates a case the task did not ask about.",
    },
    {
        "criterion": "Evidence and reasoning",
        "not_yet": "Claims appear with no evidence, or evidence appears with no claim attached.",
        "approaching": "Some claims are tied to evidence; others are asserted.",
        "meets": "Every claim is tied to a named measurement, model feature, documented step, or source.",
        "exceeds": "Evidence is weighed as well as cited — the learner says which evidence is stronger and why.",
    },
    {
        "criterion": "Data honesty and provenance",
        "not_yet": "Values appear that the learner did not measure and did not attribute, or a result is reported for work that was not done.",
        "approaching": "Most values are attributed; at least one origin is unclear.",
        "meets": "Every value is labelled measured, calculated, or SUPPLIED, and every supplied value names its source and retrieval date.",
        "exceeds": "Provenance is complete and the learner comments on how the source's own limits affect the conclusion.",
    },
    {
        "criterion": "Checking and revision",
        "not_yet": "No check is recorded, or the check is asserted without saying what it would catch.",
        "approaching": "A check is recorded but the revision is not explained.",
        "meets": "A specific check, a specific change, and a reason the change is an improvement are all recorded.",
        "exceeds": "The learner names the next check they would run and what result would make them change their mind.",
    },
)

RUBRIC_THRESHOLD = (
    "A submission meets the lesson target when every criterion is at Meets or above. A single Not "
    "yet routes to the remediation path, not to a lower final mark, until the reteach has run. "
    "Scientific correctness is judged against the lesson's stated learning target, success "
    "criteria, and course guide — not against a fixed answer key, because this package ships none. "
    "Where the learning target names a definite relationship, work that contradicts it is Not yet "
    "however well the reasoning is documented."
)

EXPECTED_REASONING = {
    "ACTIVATE_PRIOR": (
        "A complete response records an initial idea that clearly predates instruction and names at "
        "least one specific entry in the learner's own record that confirmed or revised it. Score "
        "the honesty and the revisiting, never the correctness of the initial idea."
    ),
    "PHENOMENON_QUESTION": (
        "A complete response gives two specific observations — things actually noticed, not things "
        "recalled from the text — plus one genuine mismatch, and converts the mismatch into a "
        "question that names what would change, what would be measured, and what result would count "
        "against the learner's own expectation. A question with no possible disconfirming result is "
        "not yet testable."
    ),
    "MODEL_BUILD": (
        "A complete response produces a labelled model whose labels are each traced to the worked "
        "example, text, or phenomenon they came from, and states one deliberate simplification with "
        "its cost. Score whether the model carries the mechanism, not its neatness. A model that "
        "omits nothing has not been thought about."
    ),
    "GUIDED_PRACTICE": (
        "A complete response shows the supported item and the unsupported item, and names the "
        "specific step the learner had to reconstruct once the prompt was gone. 'It was harder' "
        "without naming the step is incomplete. Errors on the unsupported item are diagnostic, not "
        "penalised twice."
    ),
    "APPLY_NEW_TASK": (
        "A complete response transfers the idea to a case not already worked in the lesson and shows "
        "the intermediate reasoning, not only the result. Accept any valid route. The named "
        "failure-prone step must be a real step in the learner's own reasoning, not a generic "
        "caution."
    ),
    "APPLY_INDEPENDENT": (
        "A complete response works a genuinely new representation or constraint with no template in "
        "front of the learner, and separates what carried over unchanged from what had to be "
        "adapted. The adaptation is the evidence; a response that only reports the answer has not "
        "shown independence."
    ),
    "EXPLAIN_WITH_EVIDENCE": (
        "A complete response states the idea in the learner's own words and attaches each claim to a "
        "named item in the record. Accept any wording and any valid route, but an explanation that "
        "contradicts the lesson's stated learning target is not made acceptable by being well "
        "evidenced — score it correct or not on the Scientific correctness criterion, and "
        "well-evidenced or not on the others."
    ),
    "COMMUNICATE_REPRESENTATION": (
        "A complete response uses a representation that actually carries the evidence — labelled, "
        "scaled, or captioned as that representation requires — and justifies the choice against a "
        "plain sentence. Score the fit between representation and evidence, not artistic quality."
    ),
    "ANALYZE_EVIDENCE": (
        "A complete response treats the evidence as a set, states an interpretation that could be "
        "argued with, cites the two strongest supports, and states the strongest opposing case the "
        "learner's own data would allow. An interpretation with no opposing case considered is not "
        "defensible, however correct it happens to be — and one that argues well from data that "
        "contradicts the lesson's learning target is not correct, however well argued."
    ),
    "INVESTIGATE": (
        "A complete response states the question, the variable changed, the variables held constant, "
        "the measured quantity with its unit and uncertainty, and the number of trials actually run. "
        "Every reported value is either the learner's own or labelled SUPPLIED with a named source. "
        "A messy or failed trial that is written down and explained scores higher than a tidy record "
        "with no account of what went wrong. There is no expected value to compare against — none is "
        "supplied anywhere in this package. The alternative path is scored identically."
    ),
    "ERROR_ANALYSIS": (
        "A complete response diagnoses what the error assumed and why the assumption looked "
        "reasonable, then shows a different representation or strategy that makes that error "
        "structurally impossible rather than merely avoided once. Correcting the answer without "
        "naming the assumption is incomplete."
    ),
    "BUILD_PRODUCT": (
        "A complete response records the criteria before the first test, logs every test including "
        "the failures, and attributes the largest improvement to a specific revision with a reason "
        "for believing it was that revision. A product with only a successful final test has no "
        "evidence of iteration."
    ),
    "PERFORMANCE_EVIDENCE": (
        "A complete response is checkable by a reader who was not present: claim, data with "
        "provenance, reasoning between them, and limitations. Anything the reader must take on the "
        "learner's word is a gap in the evidence. Score reconstructability, not length."
    ),
    "CONNECT_UNIT": (
        "A complete response names a principle that genuinely holds across the unit's ideas and a "
        "case where treating them as identical would mislead — the second is the harder half and "
        "carries most of the credit. The selected readiness evidence must be justified against the "
        "success criteria, not chosen for being the longest piece."
    ),
    "DEMONSTRATE_MASTERY": (
        "A complete response supplies all three evidence types and, where they disagree, says which "
        "is trusted and why. Treat a strong selected response beside a weak constructed response as "
        "a real signal about depth, not as noise to be explained away."
    ),
    "MASTERY_FRESH_TASK": (
        "A complete response works an unfamiliar task independently and shows the reasoning. An "
        "unexplained correct answer does not evidence mastery here, and by the course mastery rule "
        "one occasion never establishes it regardless of quality."
    ),
    "CHECK_REVISE": (
        "A complete response identifies a specific change, what triggered it, and why the revised "
        "version is better against the stated success criteria. 'I checked it and it was fine' is "
        "incomplete unless the learner names what the check would have caught."
    ),
    "CHECK_REVISE_NEXT_STEP": (
        "A complete response walks each success criterion, names the weakest, revises it, and states "
        "a next step concrete enough for someone else to carry out, including what result would show "
        "it worked. 'Practise more' is not a next step."
    ),
    "EVIDENCE_QUALITY": (
        "A complete response names one specific item, gives a property that makes it strong "
        "(precision, repetition, independence, directness), and proposes a concrete improvement. "
        "'All of it' or 'my whole table' is not a selection."
    ),
    "LIMITATION": (
        "A complete response names a limitation of the method or the data, not a limitation of the "
        "learner's effort, and states what a different design or source would need to do. 'I could "
        "have tried harder' is not a limitation."
    ),
    "PROVENANCE": (
        "A complete response labels every quantity measured, calculated, or supplied, and every "
        "supplied quantity carries source, publisher, and retrieval date. An unlabelled quantity "
        "earns no credit for this item. Do not award credit for any numerical result the learner did "
        "not measure, calculate, or cite to a named source."
    ),
    "ESSENTIAL_QUESTION": (
        "A complete response answers the unit question directly, uses this lesson's focus as the "
        "worked example, and cites at least one piece of the learner's own evidence. A restatement "
        "of the question is not an answer."
    ),
}


def shared_blocks() -> dict:
    """Everything referenced by id from the packages, written to policy/."""
    return {
        "blocks_version": "1.0.0",
        "text": {
            "no-supplied-values-rule": NO_SUPPLIED_VALUES_RULE,
            "equal-credit-rule": EQUAL_CREDIT_RULE,
            "safety-headline": SAFETY_HEADLINE,
            "safety-headline-elementary": SAFETY_HEADLINE_ELEMENTARY,
            "pause-rule": PAUSE_RULE,
            "k8-desk-ppe": K8_DESK_PPE,
            "k8-hands-on-ppe": K8_HANDS_ON_PPE,
            "k8-disposal": K8_DISPOSAL,
            "k8-hazard-note": K8_HAZARD_NOTE,
            "k8-safe-order-note": K8_SAFE_ORDER_NOTE,
            "hs-desk-safe-order-note": HS_DESK_SAFE_ORDER_NOTE,
            "hs-desk-disposal": HS_DESK_DISPOSAL,
            "supplied-headline": SUPPLIED_HEADLINE,
            "supplied-how": SUPPLIED_HOW,
            "supplies-no-numbers": SUPPLIES_NO_NUMBERS,
            "supplied-scoring": SUPPLIED_SCORING,
            "alternative-how-to-choose": ALTERNATIVE_HOW_TO_CHOOSE,
            "supplied-material-clarification": SUPPLIED_MATERIAL_CLARIFICATION,
            "prediction-prompt": PREDICTION_PROMPT,
            "record-rule": RECORD_RULE,
            "provenance-rule": PROVENANCE_RULE,
            "limitations-prompt": LIMITATIONS_PROMPT,
            "reteach-never": RETEACH_NEVER,
            "extension-never": EXTENSION_NEVER,
            "no-fixed-answer-key": NO_FIXED_ANSWER_KEY,
            "k8-derived-path-note": K8_DERIVED_PATH_NOTE,
            "rubric-threshold": RUBRIC_THRESHOLD,
        },
        "lists": {
            "supplied-provenance-fields": list(SUPPLIED_PROVENANCE_FIELDS),
            "alternative-guarantees": list(ALTERNATIVE_GUARANTEES),
            "if-stuck": list(IF_STUCK),
            "scoring-non-negotiables": list(SCORING_NON_NEGOTIABLES),
            "rubric-scale": list(RUBRIC_SCALE),
        },
        "elementary_safety_variants": dict(ELEMENTARY_SAFETY_VARIANTS),
        "rubric_criteria": [dict(criterion) for criterion in RUBRIC_CRITERIA],
        "expected_reasoning_by_question_kind": dict(EXPECTED_REASONING),
    }
