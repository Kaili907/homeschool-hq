"""Builds one student-work package per Science lesson.

Two hard rules govern every function here.

1. No fabricated observations. Every recording field ships blank. Supplied
reference information and deterministic model outputs are labelled as such;
they are never represented as a learner measurement or as the expected result
of a physical investigation.

2. No unsafe home experimentation. Every lesson carries a student-visible
   safety brief and an equal-credit alternative that needs no special
   equipment, no heat, no chemical, no mains electricity, and no cutting.
   Choosing the alternative never lowers the score ceiling.
"""

from __future__ import annotations

import re

from safety_floor import DATA_BEARING_PHASES, SUPERVISION_PLAIN_WORDS

PACKAGE_VERSION = "2.0.0"

# ---------------------------------------------------------------------------
# Objective classification and question generation
# ---------------------------------------------------------------------------
#
# The three curriculum sources between them state eighteen distinct learning
# objectives, each a fixed sentence with the lesson focus interpolated. Matching
# the sentence exactly — rather than sniffing for verbs — gives every objective
# its own question type, so no lesson ever asks the same question twice, and a
# source wording change surfaces as an unmapped objective instead of silently
# collapsing two objectives into one prompt.

OBJECTIVE_TEMPLATES = {
    "Use subject-appropriate evidence or representation to communicate understanding of {F}.":
        "COMMUNICATE_REPRESENTATION",
    "Check, revise, or improve work about {F} using stated success criteria.":
        "CHECK_REVISE",
    "Explain {F} using evidence, a model, or a documented process rather than an unsupported answer.":
        "EXPLAIN_WITH_EVIDENCE",
    "Apply {F} to a task the learner has not seen before, showing the reasoning that produced the result.":
        "APPLY_NEW_TASK",
    "Check and revise the work on {F} against the stated success criteria and name the next step.":
        "CHECK_REVISE_NEXT_STEP",
    "Build a clear mental model of {F} through an explicit worked example, demonstration, text, or phenomenon.":
        "MODEL_BUILD",
    "Practice {F} with prompts, feedback, and gradually reduced support.":
        "GUIDED_PRACTICE",
    "Use error evidence to choose a different representation or strategy for {F}, then demonstrate corrected understanding.":
        "ERROR_ANALYSIS",
    "Activate prior knowledge about {F}, surface initial thinking without penalty, and establish the unit question.":
        "ACTIVATE_PRIOR",
    "Apply {F} independently in a new representation, text, situation, or design constraint.":
        "APPLY_INDEPENDENT",
    "Gather and analyze evidence related to {F}, then record a defensible interpretation.":
        "ANALYZE_EVIDENCE",
    "Create, test, or revise a meaningful product that applies {F} and the unit standards.":
        "BUILD_PRODUCT",
    "Connect {F} to the unit\u2019s other ideas and select evidence that shows readiness for assessment.":
        "CONNECT_UNIT",
    "Demonstrate current mastery of {F} through selected-response, constructed-response, and applied evidence.":
        "DEMONSTRATE_MASTERY",
    "Observe the anchoring phenomenon, surface initial thinking about {F} without penalty, and pose a testable question.":
        "PHENOMENON_QUESTION",
    "Plan and carry out a safe investigation of {F}, or its stated alternative, and record the learner's own data with its uncertainty.":
        "INVESTIGATE",
    "Produce performance-task evidence for {F} that a reader could check independently.":
        "PERFORMANCE_EVIDENCE",
    "Demonstrate independent mastery evidence for {F} on a fresh task.":
        "MASTERY_FRESH_TASK",
}

# Used only if a source ever restates an objective. Keeps the build running and
# still produces a sensible question, while `unmapped_objective_templates` in
# the build report makes the drift visible.
_FALLBACK_KEYWORDS = (
    ("plan and carry out", "INVESTIGATE"),
    ("anchoring phenomenon", "PHENOMENON_QUESTION"),
    ("activate prior knowledge", "ACTIVATE_PRIOR"),
    ("error evidence", "ERROR_ANALYSIS"),
    ("mental model", "MODEL_BUILD"),
    ("gradually reduced support", "GUIDED_PRACTICE"),
    ("gather and analyze", "ANALYZE_EVIDENCE"),
    ("create, test, or revise", "BUILD_PRODUCT"),
    ("performance-task evidence", "PERFORMANCE_EVIDENCE"),
    ("fresh task", "MASTERY_FRESH_TASK"),
    ("current mastery", "DEMONSTRATE_MASTERY"),
    ("connect", "CONNECT_UNIT"),
    ("name the next step", "CHECK_REVISE_NEXT_STEP"),
    ("check", "CHECK_REVISE"),
    ("independently in a new", "APPLY_INDEPENDENT"),
    ("apply", "APPLY_NEW_TASK"),
    ("explain", "EXPLAIN_WITH_EVIDENCE"),
)


def objective_stem(objective: str, focus: str) -> str:
    return objective.replace(focus, "{F}")


def classify_objective(objective: str, focus: str) -> tuple[str, bool]:
    """Returns (question kind, whether it came from the exact template map)."""
    stem = objective_stem(objective, focus)
    kind = OBJECTIVE_TEMPLATES.get(stem)
    if kind:
        return kind, True
    lowered = objective.lower()
    for marker, fallback in _FALLBACK_KEYWORDS:
        if marker in lowered:
            return fallback, False
    return "EXPLAIN_WITH_EVIDENCE", False


_QUESTION_TEMPLATES = {
    "ACTIVATE_PRIOR": {
        "elementary": (
            "Before anyone taught you anything today, what did you already think about {focus}? "
            "Write that down first. Then mark one place in your record that changed your mind and "
            "one that showed you were right. A first idea is never marked wrong."
        ),
        "secondary": (
            "State what you already believed about {focus} before today's instruction, then point to "
            "one entry in your own record that revised that belief and one that confirmed it. An "
            "initial idea is scored for being stated honestly and revisited, never for correctness."
        ),
    },
    "PHENOMENON_QUESTION": {
        "elementary": (
            "Look at what actually happened in front of you. Write down two things you noticed about "
            "{focus} and one thing that surprised you. Then turn your surprise into a question you "
            "could really test — one where you would know what counts as an answer."
        ),
        "secondary": (
            "Record two specific observations of the anchoring phenomenon for {focus} and one thing "
            "that does not yet fit your explanation. Turn that mismatch into a testable question: "
            "state what you would change, what you would measure, and what result would count "
            "against your own current thinking."
        ),
    },
    "MODEL_BUILD": {
        "elementary": (
            "Draw or write a model that shows how {focus} works. Label the parts. Then say which "
            "part of the worked example or demonstration you got each label from, and name one "
            "thing your model leaves out on purpose."
        ),
        "secondary": (
            "Build a model of {focus} — diagram, written mechanism, or annotated sequence — and "
            "label its parts. For each label, cite the worked example, text, or phenomenon it came "
            "from. Then state one simplification your model makes deliberately and what it would "
            "cost you if the simplification stopped holding."
        ),
    },
    "GUIDED_PRACTICE": {
        "elementary": (
            "Work the practice items on {focus}. On the first one you may use the steps in front of "
            "you. On the last one, cover the steps and do it from memory. Then say what was "
            "different about doing it without help."
        ),
        "secondary": (
            "Work the practice items on {focus}, using the supported steps for the first and none "
            "for the last. Then compare the two: name the step you had to reconstruct without the "
            "prompt, and say what you now know you do not yet have automatic."
        ),
    },
    "APPLY_NEW_TASK": {
        "elementary": (
            "Use what you know about {focus} on a new example from {unit_title} that you have not "
            "done before. Show your thinking step by step, then point to the step where a mistake "
            "would be easiest to make."
        ),
        "secondary": (
            "Apply {focus} to a case in {unit_title} you have not worked before. Show the reasoning "
            "that produced your result, not only the result, and name the single step where that "
            "reasoning is most likely to break down."
        ),
    },
    "APPLY_INDEPENDENT": {
        "elementary": (
            "Do this one on your own, with no help and no example to copy: use {focus} in a new "
            "situation, a new drawing, or under a new rule about what you are allowed to use. Write "
            "down what you did and why it worked."
        ),
        "secondary": (
            "Work independently, without a template: apply {focus} in a different representation, "
            "context, or design constraint from the one you practised in. State what carried over "
            "unchanged and what you had to adapt, because the adaptation is the evidence of "
            "understanding."
        ),
    },
    "EXPLAIN_WITH_EVIDENCE": {
        "elementary": (
            "Explain {focus} in your own words. After each thing you say, point to the part of your "
            "record that shows it — a measurement, a drawing, a labelled model, or a step you wrote "
            "down. An answer with nothing behind it is not finished."
        ),
        "secondary": (
            "Explain {focus} in your own words and tie each claim to a specific item in your record: "
            "a measurement, a feature of your model, a documented step, or a named source. A claim "
            "with no evidence behind it is incomplete regardless of whether it is correct."
        ),
    },
    "COMMUNICATE_REPRESENTATION": {
        "elementary": (
            "Show what you found about {focus} in the clearest way for this task — a labelled "
            "drawing, a table, a written explanation, or the steps you followed. Then say why you "
            "picked that way instead of just writing one sentence."
        ),
        "secondary": (
            "Present your findings on {focus} in the representation the task calls for — a labelled "
            "model, a data display, a written explanation, or a documented process — and justify why "
            "that representation carries the evidence better than a bare statement would."
        ),
    },
    "ANALYZE_EVIDENCE": {
        "elementary": (
            "Look at all the evidence you have about {focus} together. What does it show? Write an "
            "answer someone could argue with, and give the two pieces of evidence that support it "
            "most. Then say what someone who disagreed would point at."
        ),
        "secondary": (
            "Analyse your evidence on {focus} as a set rather than item by item. State an "
            "interpretation you could defend, cite the two strongest pieces supporting it, and then "
            "state the strongest case against it that your own data would allow. An interpretation "
            "with no opposing case considered is not yet defensible."
        ),
    },
    "INVESTIGATE": {
        "elementary": (
            "Describe the investigation you actually did about {focus}: your question, the one thing "
            "you changed, the things you kept the same, and what you measured or watched. Only write "
            "down what you really saw. If a number came from a book, a table, or a website instead "
            "of from you, mark it SUPPLIED and write where it came from."
        ),
        "secondary": (
            "Describe the investigation you actually ran on {focus} — or the alternative path, which "
            "is scored the same: the question, the variable you changed, the variables you held "
            "constant, what you measured, your uncertainty, and how many trials you completed. "
            "Report only values you measured or calculated yourself, or took from a source you name "
            "on the provenance line and mark SUPPLIED."
        ),
    },
    "ERROR_ANALYSIS": {
        "elementary": (
            "Find a mistake in your earlier work on {focus} — yours or one in an example. Say what "
            "the mistake was, then try the same kind of problem a different way: a drawing instead "
            "of numbers, or a model instead of words. Show that the new way gets it right."
        ),
        "secondary": (
            "Take a specific error in your earlier work on {focus} and diagnose it: what the error "
            "assumed, and why that assumption seemed reasonable. Then choose a different "
            "representation or strategy, redo the work, and show that the new approach makes the "
            "original error impossible rather than merely avoided this time."
        ),
    },
    "BUILD_PRODUCT": {
        "elementary": (
            "Build, test, and improve something that uses {focus}. Write what it has to do, test it, "
            "then change one thing to make it better and test again. Record both tests, including "
            "the one that went badly."
        ),
        "secondary": (
            "Create, test, and revise a product that applies {focus} against the unit's stated "
            "criteria and constraints. Record the criteria first, then each test with its result — "
            "including failed iterations — and state which revision produced the largest improvement "
            "and how you know it was that revision and not something else."
        ),
    },
    "PERFORMANCE_EVIDENCE": {
        "elementary": (
            "Put together the work about {focus} that shows what you can do. Make it clear enough "
            "that someone who was not there could follow it without asking you anything."
        ),
        "secondary": (
            "Assemble performance-task evidence for {focus} that an independent reader could check "
            "without asking you a single question: the claim, the data behind it with its "
            "provenance, the reasoning between them, and the limitations. Anything a reader would "
            "have to take on trust is a gap in the evidence, not a detail."
        ),
    },
    "CONNECT_UNIT": {
        "elementary": (
            "Connect {focus} to the other big ideas in {unit_title}. Say what they have in common, "
            "then pick the one piece of your work that best shows you are ready for the unit test "
            "and say why that one."
        ),
        "secondary": (
            "Connect {focus} to the other ideas in {unit_title}: state one principle that holds "
            "across them and one case where treating them as the same would mislead you. Then select "
            "the single piece of your own work that best evidences readiness for assessment, and "
            "justify the selection against the success criteria."
        ),
    },
    "DEMONSTRATE_MASTERY": {
        "elementary": (
            "Show what you know about {focus} three ways: pick the right answer from choices, write "
            "an answer in your own words, and use it on a real task. If the three disagree, say "
            "which one you trust and why."
        ),
        "secondary": (
            "Demonstrate current mastery of {focus} across all three evidence types — selected "
            "response, constructed response, and applied task. Where they disagree, say which you "
            "trust and why. A correct selected response with a weak constructed response is a "
            "signal, not a contradiction to explain away."
        ),
    },
    "MASTERY_FRESH_TASK": {
        "elementary": (
            "Do a task about {focus} you have not seen before, on your own, with nothing to copy "
            "from. Show your working so someone can see how you got there, not just what you got."
        ),
        "secondary": (
            "Produce independent mastery evidence for {focus} on a task you have not seen, with no "
            "worked example available. Show the reasoning, not only the result — mastery is the "
            "reasoning surviving an unfamiliar surface, and an unexplained correct answer does not "
            "evidence it."
        ),
    },
    "CHECK_REVISE": {
        "elementary": (
            "Find one place where you checked your work about {focus} and changed something. Write "
            "what you changed, what made you notice it, and why the new version is better — not just "
            "different."
        ),
        "secondary": (
            "Identify one place where you checked or revised your work on {focus}. State what you "
            "changed, what prompted you to notice it, and why the revision is an improvement against "
            "the stated success criteria rather than merely a difference."
        ),
    },
    "CHECK_REVISE_NEXT_STEP": {
        "elementary": (
            "Check your work about {focus} against the success criteria at the top of this sheet. "
            "Fix one thing. Then write the very next thing you would do if you had another session."
        ),
        "secondary": (
            "Check your work on {focus} against each stated success criterion in turn and name the "
            "one you meet least well. Revise it, then state your next step concretely enough that "
            "someone else could carry it out: what you would do, and what result would tell you it "
            "worked."
        ),
    },
}

_EXTRA_QUESTIONS = {
    "EVIDENCE_QUALITY": {
        "elementary": (
            "Which one piece of evidence in your record best supports what you decided about "
            "{focus}? Say what makes it good evidence, and name one thing that would make it even "
            "stronger."
        ),
        "secondary": (
            "Which single piece of evidence in your record most strongly supports your conclusion "
            "about {focus}? State what makes it strong — precision, repetition, independence, or "
            "directness — and name one specific change that would strengthen it further."
        ),
    },
    "LIMITATION": {
        "elementary": (
            "Name one thing your work on {focus} cannot tell you, even if you did everything "
            "carefully. Then say what someone would have to do differently to find that out."
        ),
        "secondary": (
            "Name one thing your work on {focus} cannot show, however carefully it was carried out, "
            "and explain what a different design or data source would have to do to answer it. State "
            "the limitation as a property of the method, not as an apology."
        ),
    },
    "PROVENANCE": {
        "elementary": (
            "Go through every number and observation in your record. For each one, write where it "
            "came from: you measured it, you worked it out, or it was given to you. Anything given "
            "to you is marked SUPPLIED with the name of the source and the date you looked it up."
        ),
        "secondary": (
            "Audit every quantity in your record and label its origin: measured, calculated, or "
            "supplied. Every supplied quantity carries its source name, publisher, and retrieval "
            "date on the provenance line. An unlabelled quantity earns no credit, because a reader "
            "cannot tell your evidence from someone else's."
        ),
    },
    "ESSENTIAL_QUESTION": {
        "elementary": (
            "Answer the big question for this unit in two or three sentences, using {focus} as your "
            "example: {essential_question}"
        ),
        "secondary": (
            "Answer the unit's essential question in two or three sentences, using {focus} as your "
            "worked example and citing one piece of your own evidence: {essential_question}"
        ),
    },
}

# Which objective each cross-cutting question is credited against, in order of
# preference. The first kind present in the lesson wins; objective 1 otherwise.
_EXTRA_PREFERENCES = {
    "EVIDENCE_QUALITY": (
        "ANALYZE_EVIDENCE", "EXPLAIN_WITH_EVIDENCE", "PERFORMANCE_EVIDENCE",
        "COMMUNICATE_REPRESENTATION", "INVESTIGATE",
    ),
    "LIMITATION": (
        "INVESTIGATE", "ANALYZE_EVIDENCE", "BUILD_PRODUCT", "APPLY_NEW_TASK",
        "APPLY_INDEPENDENT", "MODEL_BUILD",
    ),
    "PROVENANCE": (
        "INVESTIGATE", "ANALYZE_EVIDENCE", "PERFORMANCE_EVIDENCE",
        "COMMUNICATE_REPRESENTATION", "BUILD_PRODUCT",
    ),
    "ESSENTIAL_QUESTION": (
        "CONNECT_UNIT", "APPLY_NEW_TASK", "APPLY_INDEPENDENT",
        "EXPLAIN_WITH_EVIDENCE", "DEMONSTRATE_MASTERY",
    ),
}


def _fill(template: str, lesson: dict) -> str:
    return template.format(
        focus=lesson["focus"],
        unit_title=lesson["unit_title"],
        essential_question=lesson["essential_question"].rstrip("?") + "?",
    )


def build_analysis_questions(lesson: dict, register: str) -> tuple[list[dict], list[str]]:
    """One question per stated learning objective, plus four cross-cutting items.

    Every question is tagged with the objective it serves. The alignment check
    in the gate projection is exactly this: each stated objective must be
    covered by at least one question, and every question must map to a stated
    objective. Returns the questions and any objective stems that fell through
    to the keyword fallback.
    """
    objectives = lesson["learning_objectives"]
    classified = [classify_objective(objective, lesson["focus"]) for objective in objectives]
    kinds = [kind for kind, _ in classified]
    unmapped = [
        objective_stem(objective, lesson["focus"])
        for objective, (_, exact) in zip(objectives, classified)
        if not exact
    ]

    questions: list[dict] = []
    for index, kind in enumerate(kinds):
        questions.append(
            {
                "id": f"q{len(questions) + 1}",
                "kind": kind,
                "objective_index": index,
                "prompt": _fill(_QUESTION_TEMPLATES[kind][register], lesson),
            }
        )

    for kind, preference in sorted(_EXTRA_PREFERENCES.items()):
        index = next((kinds.index(wanted) for wanted in preference if wanted in kinds), 0)
        questions.append(
            {
                "id": f"q{len(questions) + 1}",
                "kind": kind,
                "objective_index": index,
                "prompt": _fill(_EXTRA_QUESTIONS[kind][register], lesson),
            }
        )

    return questions, unmapped


# ---------------------------------------------------------------------------
# Data sheet
# ---------------------------------------------------------------------------


def build_derived_alternative_task(lesson: dict, register: str) -> str:
    """A concrete paper task for grades where the source names no activity.

    Built from this lesson's own focus, unit, and formative check — it asks for
    the plan, the prediction, and the reasoning the hands-on path would have
    produced, so the same analysis questions can be answered and the same rubric
    applied. It invents no result and names no finding.
    """
    if register == "elementary":
        return (
            f"On paper, plan the whole investigation about {lesson['focus']} without doing it: "
            "write your question, the one thing you would change, what you would keep the same, "
            "and what you would measure or watch for. Then write what you think would happen and "
            "why you think that. Answer every analysis question below from your plan and your "
            "reasoning. If an adult can find you a book, a table, or a chart about "
            f"{lesson['focus']}, use it and write down where it came from on the provenance line. "
            "Leave the record table empty — you did not measure anything, and saying so is the "
            "right answer."
        )
    return (
        f"Complete the lesson on paper: write the full investigation plan for {lesson['focus']} — "
        "question, independent variable, controlled variables, the quantity you would measure with "
        "its unit, and how many trials you would run — then state your predicted result and the "
        "reasoning behind it. Answer every analysis question below from the plan, the reasoning, "
        "and any published source an adult retrieves for you, recorded on the provenance line and "
        "marked SUPPLIED. The record table stays empty: you took no measurements, and reporting "
        "none is what honest documentation looks like. "
        f"Close on the lesson's own check — {lesson['formative_check']}"
    )


def build_data_sheet(lesson: dict, work_type: str) -> dict:
    """A recording sheet with every field blank.

    The investigation variant carries a plan the supervising adult approves
    before anything is handled, because neither the curriculum source nor this
    package prescribes a procedure for a family-chosen investigation.
    """
    is_investigation = work_type == "INVESTIGATION_DATA_SHEET"

    plan_fields = [
        {
            "field": "My question",
            "instruction": (
                "Write the question you are testing about "
                + lesson["focus"]
                + ". It has to be a question your evidence could actually answer."
            ),
        },
        {
            "field": "What I will change",
            "instruction": "Name the one thing you will change. Change one thing only.",
        },
        {
            "field": "What I will keep the same",
            "instruction": "List everything you will hold constant so the comparison is fair.",
        },
        {
            "field": "What I will measure or observe",
            "instruction": "Name the quantity or the observation, and the unit if it has one.",
        },
        {
            "field": "Materials I will use",
            "instruction": (
                "List only materials this lesson names. If something is not on the lesson's list, "
                "it does not go on the table."
            ),
        },
        {
            "field": "Adult approval before I start",
            "instruction": (
                "The supervising adult reads the plan and the safety brief and confirms the plan "
                "and the materials before anything is touched. Only the confirmation is recorded."
            ),
        },
    ]

    record_columns = (
        [
            "Trial",
            "What I did (the exact step)",
            "What I measured or observed",
            "Unit",
            "How sure I am / uncertainty",
            "Anything unexpected",
        ]
        if is_investigation
        else ["Step", "My work", "The evidence or reasoning behind it"]
    )

    return {
        "no_supplied_values_rule_ref": "no-supplied-values-rule",
        "lesson_task_verbatim": lesson["student_activity"],
        "prediction_prompt_ref": "prediction-prompt",
        "plan": plan_fields if is_investigation else [],
        "record_table": {
            "columns": record_columns,
            "blank_rows": 4 if is_investigation else 3,
            "rule_ref": "record-rule",
        },
        "provenance_table": {
            "columns": [
                "Quantity",
                "Origin (measured / calculated / SUPPLIED)",
                "Source name",
                "Publisher",
                "Date retrieved",
                "Where found",
            ],
            "blank_rows": 2,
            "rule_ref": "provenance-rule",
        },
        "limitations_prompt_ref": "limitations-prompt",
        "check_and_revise_prompt": (
            "What did you check, what did you change, and what is your next step? "
            + lesson["formative_check"]
        ),
    }


# ---------------------------------------------------------------------------
# Remediation and extension
# ---------------------------------------------------------------------------


def build_remediation(lesson: dict, family: str) -> dict:
    """Reteach routes, taken from the source's own tutor routing."""
    routes: list[dict] = []
    if family == "k8":
        for route in lesson.get("adaptive_tutor_routes", []):
            routes.append(
                {
                    "signal": route["signal"],
                    "adult_action": route["action"],
                    "source": "verbatim",
                }
            )
    else:
        for route in lesson.get("tutor_routes", []):
            parameters = route.get("parameters", {})
            detail = ", ".join(
                f"{key.replace('_', ' ')}: {value}" for key, value in sorted(parameters.items())
            )
            routes.append(
                {
                    "signal": route["signal"],
                    "adult_action": (
                        f"Run the {route['strategy'].replace('-', ' ')} route for "
                        f"{lesson['focus']}" + (f" ({detail})." if detail else ".")
                    ),
                    "source": "rendered from structured tutor_routes",
                }
            )

    return {
        "student_visible_if_stuck_ref": "if-stuck",
        "adult_routes": routes,
        "mastery_rule_verbatim": lesson.get("mastery_rule")
        or _hs_mastery_sentence(lesson.get("mastery", {})),
        "reteach_never_ref": "reteach-never",
    }


def _hs_mastery_sentence(mastery: dict) -> str:
    if not mastery:
        return ""
    return (
        "Do not mark mastery from one answer. This course requires independent evidence on at least "
        f"{mastery.get('minimum_occasions', 2)} occasions across at least "
        f"{mastery.get('minimum_distinct_dates', 2)} distinct dates, using "
        f"{', '.join(mastery.get('evidence_types', []))}, with transfer to a "
        f"{mastery.get('transfer_requirement', 'novel-context').replace('-', ' ')}."
    )


def build_extension(lesson: dict, unit: dict, family: str) -> dict:
    source_text = (
        lesson.get("extension") if family == "k8" else lesson.get("extension_activity")
    ) or ""
    topics = [topic for topic in unit.get("topics", []) if topic != lesson["focus"]]
    bridge = topics[0] if topics else lesson["focus"]
    return {
        "source_verbatim": source_text,
        "options": [
            source_text,
            (
                f"Connect {lesson['focus']} to {bridge} from this unit: state one thing that must be "
                "true of both, and one case where treating them the same would mislead you."
            ),
            (
                "Take the unit's performance task — "
                + unit.get("performance_task", "")
                + " — and write the one measurement or piece of evidence that would most change its "
                "outcome, then say why."
            ),
        ],
        "never_ref": "extension-never",
    }


# ---------------------------------------------------------------------------
# Instruction block (the gate projection needs a real instruction/source block)
# ---------------------------------------------------------------------------


def build_instruction(lesson: dict, unit: dict) -> str:
    parts = [
        f"Focus for today: {lesson['focus']}, inside the unit {lesson['unit_title']}.",
        f"Unit question: {lesson['essential_question']}",
        "What you are aiming at: " + " ".join(lesson["learning_objectives"]),
        "You have met the target when: " + " ".join(lesson["success_criteria"]),
        "The work itself: " + lesson["student_activity"],
    ]
    phenomenon = unit_phenomenon(unit)
    if phenomenon:
        parts.insert(1, phenomenon)
    return "\n".join(parts)


def unit_phenomenon(unit: dict) -> str:
    for extension in unit.get("extensions", []):
        if extension.get("key") == "phenomenon":
            return extension["value"]["value"]
    return ""


_WHITESPACE = re.compile(r"\s+")


def normalise(text: str) -> str:
    return _WHITESPACE.sub(" ", text or "").strip()


def is_data_bearing(phase: str) -> bool:
    return phase in DATA_BEARING_PHASES


def supervision_words(level: str) -> str:
    return SUPERVISION_PLAIN_WORDS.get(level, SUPERVISION_PLAIN_WORDS["nearby-adult"])
