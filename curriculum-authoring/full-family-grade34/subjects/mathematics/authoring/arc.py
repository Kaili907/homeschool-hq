"""The fixed 18-day instructional arc used by every Grade 3 and Grade 4 unit.

The arc is what makes Manuel Academy's mastery rule enforceable at the data
level. Every unit distinguishes four different things:

  instruction          - the idea is being taught; no mastery claim is possible
  guided-practice      - success is supported; it is NOT weighted as independent
  independent-evidence - unsupported evidence, usable toward a mastery claim
  assessment           - one evidence source among several, never the sole basis
  reassessment         - fresh evidence after targeted correction

Each unit yields FOUR independent-evidence occasions on four separate days
(days 5, 10, 11, 18), plus a unit assessment (day 16) and a reassessment
occasion (day 17). One correct response can therefore never establish mastery.
"""

INSTRUCTION = "instruction"
GUIDED = "guided-practice"
INDEPENDENT = "independent-evidence"
RETRIEVAL = "retrieval"
PROJECT = "project"
ASSESSMENT = "assessment"
REASSESSMENT = "reassessment"

# (day_in_unit, phase label, evidence type)
ARC = [
    (1,  "Launch and diagnostic",               INSTRUCTION),
    (2,  "Concept build A",                     INSTRUCTION),
    (3,  "Concept build B",                     INSTRUCTION),
    (4,  "Guided practice A",                   GUIDED),
    (5,  "Independent evidence A",              INDEPENDENT),
    (6,  "Concept build C",                     INSTRUCTION),
    (7,  "Guided practice B",                   GUIDED),
    (8,  "Error analysis and repair",           GUIDED),
    (9,  "Retrieval and fluency",               RETRIEVAL),
    (10, "Independent evidence B",              INDEPENDENT),
    (11, "Applied problem solving",             INDEPENDENT),
    (12, "Concept extension",                   INSTRUCTION),
    (13, "Performance task: plan",              PROJECT),
    (14, "Performance task: build",             PROJECT),
    (15, "Synthesis and review",                RETRIEVAL),
    (16, "Unit assessment",                     ASSESSMENT),
    (17, "Targeted correction and reassessment", REASSESSMENT),
    (18, "Transfer, reflection, and publication", INDEPENDENT),
]

INDEPENDENT_EVIDENCE_DAYS = [d for d, _, e in ARC if e == INDEPENDENT]
ASSESSMENT_DAY = 16
REASSESSMENT_DAY = 17

OBJECTIVE = {
    INSTRUCTION: [
        "Build an accurate mental model of {focus} using a concrete or visual representation before any symbol work.",
        "Explain {focus} in the learner's own words and connect the representation to the notation.",
        "Identify what would count as a correct and a mistaken use of {focus}.",
    ],
    GUIDED: [
        "Practice {focus} with worked support, immediate feedback, and prompts that fade across the set.",
        "Say or write the reasoning for each step of {focus} rather than only the answer.",
        "Catch and repair an error in {focus} while support is still available.",
    ],
    INDEPENDENT: [
        "Apply {focus} accurately without prompting, on a task not yet worked together.",
        "Record the reasoning, model, or process that produced the result for {focus}.",
        "Check the work on {focus} against the success criteria and state one next step.",
    ],
    RETRIEVAL: [
        "Retrieve {focus} from memory after a delay, without speed pressure or public comparison.",
        "Name the strategy used for {focus} and explain when that strategy is a good choice.",
        "Distinguish items involving {focus} that are secure from those that still need work.",
    ],
    PROJECT: [
        "Apply {focus} inside an extended task with a real purpose and stated success criteria.",
        "Justify each mathematical decision about {focus} with a model, calculation, or check.",
        "Revise the work on {focus} in response to feedback and the success criteria.",
    ],
    ASSESSMENT: [
        "Demonstrate independent understanding of {focus} across concept, representation, and application.",
        "Analyze a plausible error involving {focus}, correct it, and explain why the correction works.",
        "Present evidence and reasoning for {focus} rather than an unsupported answer.",
    ],
    REASSESSMENT: [
        "Rebuild the smallest missing prerequisite for {focus} with explicit reteaching.",
        "Produce fresh, independent evidence on {focus} using items not seen in the assessment.",
        "Explain what changed in the learner's thinking about {focus} since the first attempt.",
    ],
}

FLOW = {
    INSTRUCTION: [
        ("Retrieval warm-up", "3-5", "Ask for two or three items from earlier units that this lesson depends on. Do not grade this; use it to decide how much modeling {focus} will need."),
        ("Concrete or visual model", "8-12", "Model {focus} with materials, a drawing, or a diagram before any symbols appear. Think aloud so the reasoning is audible, and name each step."),
        ("Representation to notation", "6-10", "Connect the model of {focus} to the written notation, pointing at each part of the model as the matching symbol is written."),
        ("Guided try with feedback", "8-12", "The learner tries one item involving {focus} while the adult or tutor watches and gives immediate, specific feedback on the reasoning, not just the answer."),
        ("Exit check and next step", "3-5", "The learner shows or explains the key idea of {focus} in one response and names the part that still feels unsteady."),
    ],
    GUIDED: [
        ("Retrieval warm-up", "3-5", "Retrieve two or three prerequisite items for {focus} without penalty."),
        ("Worked example review", "6-9", "Walk through one complete worked example of {focus}, naming the success criteria the work has to meet."),
        ("Guided set with fading prompts", "10-15", "Work three to five items on {focus}. Prompt fully on the first, partially on the next, and not at all on the last. Ask for the reason behind each move."),
        ("Self-check against criteria", "5-8", "The learner checks the completed items on {focus} against the criteria and marks anything to revisit. Guided success is recorded as supported, not as independent evidence."),
        ("Exit check and next step", "3-5", "The learner states which item on {focus} was hardest and what made it hard."),
    ],
    INDEPENDENT: [
        ("Retrieval warm-up", "3-5", "Retrieve the prerequisites for {focus} briefly, without help."),
        ("Success-criteria review", "3-5", "Read the criteria for {focus} aloud together so the learner knows what the work must show. Then withdraw prompting."),
        ("Independent task", "12-18", "The learner works on {focus} without step prompts. The adult or tutor may restate the directions or provide access supports, but does not supply mathematical steps."),
        ("Reasoning record", "5-8", "The learner records the model, calculation, or process that produced the result for {focus}, in whichever response mode is accessible to them."),
        ("Exit check and next step", "3-5", "The learner checks the work on {focus} against the criteria and names one next step. This day contributes one independent-evidence occasion."),
    ],
    RETRIEVAL: [
        ("Mixed retrieval", "5-8", "Pull items on {focus} and on two earlier units. Spacing matters more than volume here."),
        ("Strategy naming", "5-8", "For each item, the learner names the strategy used for {focus} and why it fit."),
        ("Fluency set without speed pressure", "10-14", "Work a short fluency set on {focus}. Timers stay hidden or off. Accuracy and strategy are the targets; speed is not scored."),
        ("Error scan", "5-8", "The learner scans their own work on {focus} for a pattern and describes it neutrally."),
        ("Exit check and next step", "3-5", "The learner sorts {focus} items into secure and not-yet-secure and picks one to revisit."),
    ],
    PROJECT: [
        ("Retrieval warm-up", "3-5", "Recall the mathematics the project needs, including {focus}."),
        ("Criteria and plan review", "6-9", "Review the task criteria and what {focus} contributes to the product. Confirm the accessible format the learner has chosen."),
        ("Build or revise", "15-22", "The learner builds or revises the product, applying {focus} and recording each mathematical decision."),
        ("Feedback and revision", "6-10", "Give feedback against the criteria only. The adult or tutor does not complete any part of the graded product."),
        ("Exit check and next step", "3-5", "The learner names the next build step and any material or support needed."),
    ],
    ASSESSMENT: [
        ("Access setup and criteria", "4-6", "Confirm accommodations, response mode, and extended time before starting. Read the criteria for {focus} aloud if helpful. None of this changes the standard being assessed."),
        ("Concept and representation section", "8-12", "The learner explains {focus} and shows it with a model or representation."),
        ("Application section", "10-15", "The learner applies {focus} to a situation not worked in class and shows the process."),
        ("Error analysis and connection section", "8-12", "The learner diagnoses a plausible error involving {focus}, corrects it, and connects the idea to another idea from the unit."),
        ("Reflection and submission", "4-6", "The learner names one secure skill and one next question. The score is recorded as one evidence source among several."),
    ],
    REASSESSMENT: [
        ("Evidence review", "4-6", "Review the specific items on {focus} that were not yet secure. Describe the pattern neutrally, without character or effort language."),
        ("Targeted reteach of the smallest gap", "8-12", "Reteach only the smallest missing prerequisite for {focus}, using a different representation than the first time."),
        ("Fresh items", "10-15", "The learner works items on {focus} that did not appear on the assessment. Reused items cannot establish new evidence."),
        ("Explanation check", "5-8", "The learner explains why the corrected approach to {focus} works, not merely what to do."),
        ("Exit check and next step", "3-5", "Record the reassessment outcome as a second occasion of evidence, separated in time from the first."),
    ],
}

ACTIVITY = {
    INSTRUCTION: "The learner works alongside the adult or tutor to build and label a model of {focus}, then writes the matching notation and explains how the two match.",
    GUIDED: "The learner completes a short set on {focus} with prompts that fade item by item, stating the reason for each step.",
    INDEPENDENT: "The learner independently completes a task on {focus} that was not worked together, and records the reasoning, model, or process that produced the result.",
    RETRIEVAL: "The learner completes a mixed, untimed retrieval set covering {focus} and two earlier units, naming the strategy used for each item.",
    PROJECT: "The learner advances the unit performance task, applying {focus} and recording the mathematical justification for each decision.",
    ASSESSMENT: "The learner completes the unit assessment independently, showing concept, representation, application, error analysis, connection, and reflection evidence for {focus}.",
    REASSESSMENT: "The learner works fresh items on {focus} after targeted reteaching and explains why the corrected approach works.",
}

EXIT = {
    INSTRUCTION: "Show or explain the main idea of {focus} in one response, and name the part that still feels unsteady.",
    GUIDED: "Show one step of {focus} and explain why that step is correct. Name the item that was hardest.",
    INDEPENDENT: "Complete one item on {focus} without help and record the reasoning that produced it.",
    RETRIEVAL: "Sort today's {focus} items into secure and not-yet-secure, and name the strategy that helped most.",
    PROJECT: "State the next build step for the performance task and the mathematics from {focus} it will require.",
    ASSESSMENT: "Submit the assessment with reasoning shown, then name one secure skill and one next question.",
    REASSESSMENT: "Complete one fresh item on {focus} and explain what changed in your thinking since the first attempt.",
}
