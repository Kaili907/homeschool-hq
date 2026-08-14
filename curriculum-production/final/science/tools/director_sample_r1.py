"""One exact Science depth sample for Director review.

This module is deliberately narrow. It overrides one existing package after the
normal pinned-source build has completed, and leaves every other Science lesson
on the established renderer. The sample remains the real admitted lesson ref;
it is not a fixture and it never supplies learner experimental results.
"""

from __future__ import annotations

from copy import deepcopy


LESSON_ID = "ma-g3-science-u01-l02"
SAMPLE_VERSION = "science-director-sample-r1"


SECTIONS = [
    {
        "id": "phenomenon",
        "title": "1. Start with a phenomenon",
        "stage": "NOTICE",
        "body": """**Origin: DESCRIBED OBSERVATION.** After a rain, Ari notices puddles in sunny places and puddles in shady places. Ari did not measure their starting sizes or how long they lasted. This description is something to think about; it is not a result from an experiment you did.

**Today’s question:** How can Ari turn that notice into a question that observations could answer?

First separate noticing from explaining:

| Move | What Ari can honestly say now |
| --- | --- |
| Notice | There are puddles in sunny and shady places. |
| Record | No sizes or times were recorded yet. |
| Explain | It is too soon to say why one puddle lasts longer. |

Science begins with careful questions. It does not begin by pretending a result is already known.""",
        "questions": [],
    },
    {
        "id": "learn",
        "title": "2. Learn what makes a question testable",
        "stage": "LEARN",
        "body": """A **testable question** is a question that could be answered with observations or measurements. You do not have to run the test today. You do need to be able to describe what someone could compare and what someone could notice or measure.

A strong testable question usually names two parts:

1. **What will differ or be compared?** For the puddles, that could be sun and shade.
2. **What will be observed or measured?** That could be the number of minutes until the water is gone.

Evidence can help answer, challenge, or leave a testable question undecided. Evidence cannot decide a personal preference such as “Which puddle is prettiest?” A preference may matter, but it is not settled by a measurement alone.

### Words scientists use

| Word | Meaning here | Example |
| --- | --- | --- |
| phenomenon | something that happens and can be noticed | puddles changing after rain |
| observation | information noticed and recorded | the puddle is in shade |
| measure | to compare with a unit or count | record minutes |
| evidence | recorded information used to answer a question | the time record for each puddle |
| testable question | a question a possible observation or measurement could answer | Does sun or shade affect how long equal puddles last? |

**Boundary:** Testable does not automatically mean safe, fair, or worth doing. A real investigation also needs a safe plan and a fair comparison.""",
        "questions": [],
    },
    {
        "id": "worked-model",
        "title": "3. Worked model: question to evidence",
        "stage": "MODEL",
        "body": """**Goal:** Decide whether this question is testable: “Does being in sun or shade affect how long equal amounts of water last?”

**Input:** The described puddle phenomenon and a plan—not experimental results.

`QUESTION -> PLAN -> RECORD -> DECIDE`

| Model part | Scientist’s think-aloud |
| --- | --- |
| Question | It names the comparison: sun or shade. |
| Plan | Put equal amounts of water in the same kind of shallow container. Place one in sun and one in shade. An adult would approve any real setup. |
| Record | Record the number of minutes until each container is empty. Leave the result blank until it is actually observed. |
| Decide | Compare the recorded times. The evidence may support a difference, show no difference, or be too limited to decide. |

### Worked scientific reasoning

**Claim:** The sun-or-shade question is testable.

**Evidence:** A possible plan names what to compare and a time measurement that could be recorded for both conditions.

**Reasoning:** Because the time record could change the answer, observations could help decide the question.

**Check and limitation:** The plan must start with equal amounts of water in similar containers. One trial in one place would not prove what always happens everywhere.

The completed model represents how a question connects to evidence. It does not predict which water will disappear first and it does not report a learner result.""",
        "questions": [],
    },
    {
        "id": "guided",
        "title": "4. Guided practice: use the model with less help",
        "stage": "GUIDED",
        "body": """**New context:** Jordan asks, “Does the height of a toy-car ramp change how far the car rolls?” Today you are planning only. Do not build or test a ramp for this lesson.

The first model part is filled in. Complete the rest with the prompts below.

| Model part | Guided start |
| --- | --- |
| Question | Compare two ramp heights. |
| Plan | Keep the car and starting place the same. ___ |
| Record | Measure ___ in ___ units. |
| Decide | Compare ___ to answer the question. |

Support fades across Q1–Q3. Q1 points to a choice, Q2 asks you to complete the plan, and Q3 asks you to connect claim, evidence, and reasoning.""",
        "questions": [
            {
                "id": "q1",
                "kind": "GUIDED_PRACTICE",
                "objective_index": 0,
                "prompt": "Which record could help answer Jordan’s question: the car’s color, the distance it rolls from each ramp height, or which ramp looks best? Explain your choice.",
            },
            {
                "id": "q2",
                "kind": "MODEL_BUILD",
                "objective_index": 1,
                "prompt": "Complete the Plan, Record, and Decide rows. Name what must stay the same so the comparison is fair.",
            },
            {
                "id": "q3",
                "kind": "EXPLAIN_WITH_EVIDENCE",
                "objective_index": 2,
                "prompt": "Write a short CER: claim whether Jordan’s question is testable, give one feature of the plan as evidence, and explain why that feature lets observations bear on the claim. Add one limitation.",
            },
        ],
    },
    {
        "id": "independent",
        "title": "5. Independent evidence: a fresh case",
        "stage": "INDEPENDENT",
        "body": """**Fresh case:** A library club can make paper bridges from one sheet of paper. The club wants a question that could be answered by a record, not by opinion. You are designing the question and evidence plan only. No building or testing is required.

The worked puddle model is no longer filled in for you. Use the four labels **Question, Plan, Record, Decide** only if they help you organize your own thinking.""",
        "questions": [
            {
                "id": "q4",
                "kind": "APPLY_INDEPENDENT",
                "objective_index": 1,
                "prompt": "Write one testable question about two paper-bridge designs. Name what would be compared, what would be counted or measured, one thing to keep the same, and what record could decide the answer.",
            },
            {
                "id": "q5",
                "kind": "LIMITATION",
                "objective_index": 2,
                "prompt": "State one conclusion that the planned record could support and one conclusion it could not support, even if the plan were followed perfectly.",
            },
        ],
    },
    {
        "id": "mastery",
        "title": "6. Fresh mastery: keep the teaching page closed",
        "stage": "MASTERY",
        "body": """Complete this card without reopening the worked example. Definitions and the completed model are intentionally absent here.

**Fresh phenomenon card — SUPPLIED DESCRIPTION:** A school garden has two identical bird feeders. The class is deciding whether changing the kind of seed changes how many bird visits are recorded during the same morning time. No visit counts are supplied, and none should be invented.""",
        "questions": [
            {
                "id": "q6",
                "kind": "MASTERY_FRESH_TASK",
                "objective_index": 0,
                "prompt": "Write the class’s testable question. Then make a small evidence-plan model that shows what would be compared, what would be recorded, and how that record could help decide the question without predicting or inventing any bird visits.",
            },
            {
                "id": "q7",
                "kind": "DEMONSTRATE_MASTERY",
                "objective_index": 2,
                "prompt": "Explain why your question is testable. Use a claim, a relevant feature of your evidence plan, reasoning that links the feature to your claim, and one limit of the planned evidence.",
            },
        ],
    },
    {
        "id": "remediation",
        "title": "7. If the idea is still unclear: use a different picture",
        "stage": "REMEDIATION",
        "body": """**Use the evidence-door test.** Imagine every observation is a key. Ask: “Could a careful record open this question by changing which answer is supported?”

| Question | Can a record open the evidence door? | Why? |
| --- | --- | --- |
| Which paper color is prettiest? | No | A measurement cannot settle everyone’s preference. |
| Which paper color reaches the higher temperature under the same lamp? | Yes | A temperature record could support one answer. |

This explanation uses a deciding-evidence contrast instead of the earlier Question–Plan–Record–Decide model.

**Fresh retry:** “Which towel is best?” is too unclear and may be only an opinion. Rewrite it so a record of water absorbed under the same conditions could help decide it. Name the record you would need. Planning only—do not run a towel test in this lesson.""",
        "questions": [],
    },
]


def _questions() -> list[dict]:
    return [deepcopy(question) for section in SECTIONS for question in section["questions"]]


def apply_sample(package: dict) -> dict:
    """Return the exact one-lesson sample package without changing its identity."""
    if package.get("lesson_id") != LESSON_ID:
        return package

    result = deepcopy(package)
    result["estimated_minutes"] = "40–50"
    result["materials"] = [
        "this learner sheet",
        "course notebook or response space",
        "pencil or accessible response tool",
    ]
    result["learning_objectives"] = [
        "Explain what makes a scientific question testable by naming a possible observation or measurement.",
        "Build and use a Question–Plan–Record–Decide model for a new context.",
        "Use claim, evidence, and reasoning to justify whether a question is testable and state a limitation.",
    ]
    result["success_criteria"] = [
        "I name what would be compared and what would be observed or measured.",
        "My model connects a question to a possible record without inventing a result.",
        "My explanation links evidence to my claim and names one limit.",
    ]
    result["instruction"] = (
        "Begin with the described puddle phenomenon. Teach testability as a connection between a "
        "question and a possible observation or measurement. Work the Question–Plan–Record–Decide "
        "model, fade support in the ramp context, then protect the fresh bridge and bird-feeder tasks."
    )

    questions = _questions()
    result["analysis_questions"] = questions
    result["expected_reasoning"]["per_question"] = [
        {
            "id": question["id"],
            "kind": question["kind"],
            "objective_index": question["objective_index"],
            "complete_response_contains_ref": question["kind"],
        }
        for question in questions
    ]
    result["expected_reasoning"]["success_criteria_verbatim"] = list(result["success_criteria"])
    result["rubric"]["success_criteria_verbatim"] = list(result["success_criteria"])

    content = result["executable_content"]
    content["science_brief"] = [
        "A testable question could be answered with an observation or measurement.",
        "A useful evidence plan names what will differ or be compared and what will be observed or measured.",
        "Evidence can help decide a factual question, but a measurement alone cannot settle a personal preference.",
    ]
    content["case"] = {
        "title": "Described phenomenon: puddles after rain",
        "claim_status": "question to model; no experimental result is supplied",
        "claim_to_test": "How can Ari turn a notice about sunny and shady puddles into a question that observations could answer?",
    }
    content["supplied_evidence"] = {
        "title": "Supplied observation-and-plan record",
        "columns": ["Evidence ID", "Origin", "Information"],
        "provenance": (
            "Manuel Academy Science Director sample R1. E1 is a described observation; E2 and E3 "
            "are proposed plan features, not learner measurements or experimental results."
        ),
        "rows": [
            {
                "evidence_id": "E1",
                "origin": "DESCRIBED_OBSERVATION",
                "information": "Puddles are noticed in sunny and shady places; no starting sizes or times were recorded.",
            },
            {
                "evidence_id": "E2",
                "origin": "PROPOSED_PLAN",
                "information": "Compare equal amounts of water in the same kind of shallow container in sun and shade.",
            },
            {
                "evidence_id": "E3",
                "origin": "PROPOSED_RECORD",
                "information": "Record minutes until each container is empty; leave all results blank until observed.",
            },
        ],
    }
    content["bound_task"] = {
        "phase_directions": "Use the phenomenon, worked model, guided fade, and fresh cases without inventing any observation.",
        "question": "What makes a question answerable with scientific evidence, and how can a model show the evidence needed?",
        "steps": [
            "Notice what is described and what has not been recorded.",
            "Name what would differ or be compared.",
            "Name an observation or measurement that could bear on the question.",
            "Connect the question, plan, record, and decision in a model or explanation.",
            "Check for fairness, safety, and a limitation; never predict or invent a result.",
        ],
    }
    content["primary_route"] = {
        "complete": True,
        "kind": "DESK_BASED_MODEL_AND_REASONING",
        "materials": list(result["materials"]),
    }
    content["equal_credit_route"] = {
        "complete": True,
        "kind": "ACCESSIBLE_RESPONSE_ROUTE",
        "materials": ["the supplied phenomenon cards", "a spoken, typed, drawn, handwritten, or tactile response mode"],
        "procedure": [
            "Use the same described phenomenon and the same Question–Plan–Record–Decide target.",
            "Respond in an accessible mode without changing the scientific success criteria.",
        ],
        "same_scoring_ceiling": True,
    }
    content["materials_complete"] = True
    content["physical_result_disclosed_before_collection"] = False

    result["data_sheet"]["lesson_task_verbatim"] = content["bound_task"]["question"] + " Follow the five printed steps and label all supplied descriptions honestly."
    result["data_sheet"]["check_and_revise_prompt"] = (
        "Check that your question names a possible record, that your reasoning explains how the "
        "record could matter, and that no predicted or invented result appears as an observation."
    )

    result["remediation"]["adult_routes"] = [
        {
            "signal": "SCI-PREREQ-OBSERVATION-VS-OPINION",
            "adult_action": "Sort one observable statement and one preference statement before returning to testable questions.",
            "source": SAMPLE_VERSION,
        },
        {
            "signal": "SCI-MISCONCEPTION-TESTABLE-MEANS-ALREADY-TESTED",
            "adult_action": "Use the evidence-door contrast: a question is testable when a possible record could decide it; no result needs to exist yet.",
            "source": SAMPLE_VERSION,
        },
        {
            "signal": "SCI-MISCONCEPTION-ANY-SCIENCE-QUESTION-IS-TESTABLE",
            "adult_action": "Contrast a preference question with a measurement question, then ask for a fresh towel-absorption rewrite.",
            "source": SAMPLE_VERSION,
        },
        {
            "signal": "SCI-REASONING-CLAIM-WITHOUT-LINK",
            "adult_action": "Ask which possible record could change the answer, then have the learner state why that record bears on the claim.",
            "source": SAMPLE_VERSION,
        },
        {
            "signal": "SCI-MASTERY-FRESH-EVIDENCE",
            "adult_action": "Use the protected bird-feeder card on a different occasion; do not reopen the worked model or mark mastery from one response.",
            "source": SAMPLE_VERSION,
        },
    ]
    result["extension"]["options"] = [
        "Write one testable question and one preference question about the same safe everyday phenomenon. Explain the difference without carrying out a test.",
        "Revise a question by changing the record it would require, then explain how that changes what the evidence could decide.",
    ]

    result["assurances"]["objective_alignment_verified"] = True
    result["assurances"]["unmapped_objective_templates"] = []
    result["assurances"]["supplies_no_observations"] = True
    result["assurances"]["supplies_no_expected_values"] = True
    result["assurances"]["supplies_no_expected_measurement"] = True
    result["assurances"]["physical_result_disclosed_before_collection"] = False

    result["director_sample_r1"] = {
        "sample_version": SAMPLE_VERSION,
        "status": "DIRECTOR_REVIEW_CANDIDATE",
        "audit_designation": "docs/curriculum-quality/science/audit-r1/README.md#recommended-representative-sample-lesson",
        "standard_ref": "docs/curriculum-quality/science/SCIENCE_LESSON_STANDARD_R1.md#15-representative-director-sample",
        "hands_on": False,
        "observation_integrity": (
            "No learner measurement or experimental result is supplied. Described observations, "
            "proposed plans, and proposed records are labeled separately."
        ),
        "sections": deepcopy(SECTIONS),
        "phase_sequence": [
            {"phase": "TEACH", "answer_policy": "TEACHING_VISIBLE", "section_refs": ["phenomenon", "learn", "worked-model"]},
            {"phase": "GUIDED", "answer_policy": "GUIDED_PARTIAL", "section_refs": ["guided"]},
            {"phase": "INDEPENDENT", "answer_policy": "INDEPENDENT_WITHHOLD", "section_refs": ["independent", "mastery"]},
            {"phase": "REMEDIATE", "answer_policy": "GUIDED_PARTIAL", "section_refs": ["remediation"]},
        ],
    }
    return result


def student_sheet(package: dict, safety_reference: str, equal_credit_rule: str) -> str:
    """Render the one sample with teaching first and full policy as a reference."""
    sample = package["director_sample_r1"]
    lines = [
        f"# {package['title']}",
        "",
        f"**{package['course_title']}** · Unit {package['unit_number']}: {package['unit_title']} · "
        f"Day {package['day_in_unit']} · about {package['estimated_minutes']} minutes",
        "",
        "**Science Director sample R1** · exact lesson `ma-g3-science-u01-l02`",
        "",
        f"**Unit question:** {package['essential_question']}",
        "",
        "**Today’s goal:** Turn a notice into a testable question, show the evidence plan in a model, "
        "and explain the reasoning without inventing a result.",
        "",
        "**Materials:** this learner sheet; course notebook or response space; pencil or accessible response tool.",
        "",
        "**Today’s safety:** This is a desk lesson. Do not collect puddle, ramp, bridge, towel, or bird-feeder data. "
        "No protective equipment is needed. If you want to carry out any investigation later, stop and use a "
        "separately approved lesson with its own materials, adult role, safety steps, and equal-credit alternative.",
        "",
        "You may read, listen, speak, type, draw, handwrite, or use a tactile model. The scientific target and scoring ceiling stay the same.",
        "",
        "## The science information and exact work for this lesson",
        "",
        "Everything needed for this desk lesson is printed here. No outside source or physical result is required.",
        "",
        f"**{package['executable_content']['case']['claim_to_test']}**",
        "",
        f"**Bound question:** {package['executable_content']['bound_task']['question']}",
        "",
        "**Observation honesty:** DESCRIBED OBSERVATION, PROPOSED PLAN, and PROPOSED RECORD are not learner results. "
        "Leave results unknown unless they are actually collected in an approved investigation.",
        "",
    ]

    for section in sample["sections"]:
        lines += [f"## {section['title']}", "", section["body"], ""]
        for question in section["questions"]:
            lines += [f"**{question['id'].upper()}.** {question['prompt']}", "", ">", ""]

    lines += [
        "## Check your work",
        "",
        "| Success criterion | Ready when… |",
        "| --- | --- |",
        "| Question and evidence | You name what would be compared and what would be observed or measured. |",
        "| Model and honesty | Your model connects the question to a possible record without predicting or inventing a result. |",
        "| Scientific reasoning | Your explanation links evidence to the claim and states one limitation. |",
        "",
        "**Freshness rule:** Q6–Q7 use a new phenomenon card. The card does not repeat the definition, completed model, or worked reasoning. "
        "Use it on a different occasion before any mastery decision when feasible.",
        "",
        "### Equal-credit route — complete and delivered here",
        "",
        "Use the same phenomenon cards and Question–Plan–Record–Decide target. Respond by speaking, typing, drawing, handwriting, "
        "or using a tactile representation. No camera, account, purchase, physical investigation, or private disclosure is required.",
        "",
        equal_credit_rule,
        "",
        "## Science safety policy reference — not part of today’s desk task",
        "",
        "The complete course safety floor remains available below for later planning. Today’s route uses no materials beyond paper and an accessible response tool.",
        "",
        safety_reference.replace("## Safety — read this before you touch anything", "### Full course safety floor"),
        "",
        "---",
        "",
        f"_Package `{package['package_id']}` · sample `{SAMPLE_VERSION}` · exact lesson `{LESSON_ID}`. "
        "No learner experimental result is supplied or implied. Supplied reference and model inputs "
        "are labelled; physical-investigation observations and expected results are never supplied "
        "before collection._",
        "",
    ]
    return "\n".join(lines)
