# -*- coding: utf-8 -*-
"""Per-course rigor profiles.

These are what make English 12 different from English 10 rather than the same
course with harder passages: the amount of scaffolding withdrawn, who designs
the approach, how many independent occasions mastery requires, and whether the
work is defended to an audience outside the household.
"""

RIGOR = {
  9: {
    "support": "supported",
    "band_clause": "in the grades 9-10 text complexity band, with scaffolding available at the high end of the range",
    "model": "Name the move, show a worked example on a short passage, and make the success criteria explicit before practice begins.",
    "guided": "Work two supported examples together. After each step ask, \"What in the text licenses that move?\" Fade prompts on the second example.",
    "independent": "The learner completes a new application with the criteria checklist still available, recording the result and the reasoning that produced it.",
    "mastery": "Do not mark mastery from one answer. Require accurate independent application plus explanation on at least two separate occasions, at least one of them on a text the learner has not seen before.",
    "transfer": "Apply the move to an unfamiliar passage of comparable complexity with the checklist available.",
    "seminar": "Discuss with prepared evidence and agreed collegial rules; the facilitator may still moderate turn-taking.",
    "assessment_note": "Scaffolds permitted during instruction (checklists, sentence frames, exemplars) remain available on the unit assessment unless the standard being measured is the scaffold itself.",
  },
  10: {
    "support": "independent within the 9-10 band",
    "band_clause": "at the high end of the grades 9-10 text complexity band, independently and proficiently",
    "model": "Name the move and show one compressed example. The learner reconstructs the success criteria before practice rather than receiving them.",
    "guided": "Work one supported example, then withdraw. The learner attempts the second unaided and explains the choice afterward.",
    "independent": "The learner completes a new application without the criteria checklist, then self-checks against criteria they state from memory.",
    "mastery": "Do not mark mastery from one answer. Require accurate unaided application plus explanation on at least two separate occasions, at least one at the high end of the 9-10 band with no exemplar available.",
    "transfer": "Apply the move to an unfamiliar text at the high end of the band with no exemplar and no checklist.",
    "seminar": "The learner sets discussion rules and roles with peers and leads at least one exchange without facilitator moderation.",
    "assessment_note": "Instructional scaffolds are withdrawn for the unit assessment. Access accommodations remain fully available; they are not scaffolds.",
  },
  11: {
    "support": "supported entry to the 11-CCR band",
    "band_clause": "in the grades 11-CCR text complexity band, with scaffolding available at the high end of the range",
    "model": "Model the move on a text that resists a first reading. Show where a competent reader slows down, backtracks, or suspends judgment.",
    "guided": "Work one example together on genuinely difficult material, with an annotated exemplar available for reference. Require the learner to state what the exemplar does not settle.",
    "independent": "The learner completes a new application on 11-CCR material, may consult the annotated exemplar, and must record where the text left matters uncertain.",
    "mastery": "Do not mark mastery from one answer. Require accurate independent application plus explanation on at least two separate occasions, at least one on 11-CCR material, including an account of what remains uncertain.",
    "transfer": "Apply the move to an unfamiliar 11-CCR text and state explicitly which conclusions the evidence does not support.",
    "seminar": "Run a civil, democratic discussion in which the learner must represent a position they do not hold before arguing their own.",
    "assessment_note": "Reference works and style manuals remain available on assessment; annotated exemplars do not. Sources must be cited as they would be outside the course.",
  },
  12: {
    "support": "independent and self-directed",
    "band_clause": "at the high end of the grades 11-CCR text complexity band, independently and proficiently",
    "model": "No worked exemplar is supplied. The facilitator states the standard and the audience, then asks the learner to propose an approach and justify it before beginning.",
    "guided": "The learner designs the approach, names its known weakness, and revises the plan after a single round of critique. The facilitator questions and critiques but does not supply the method.",
    "independent": "The learner executes their own method on self-selected material, documents decisions as a scholar would, and reports the limits of the resulting claim.",
    "mastery": "Do not mark mastery from one answer. Require self-directed application on at least two separate occasions with no supplied method, including one piece defended against prepared objections from a reader outside the household when the family chooses.",
    "transfer": "Transfer the method to a different discipline or genre and account for what changes about evidence, audience, and convention.",
    "seminar": "Defend a position against prepared objections, concede what should be conceded, and identify what further evidence would change the conclusion.",
    "assessment_note": "Assessment mirrors postsecondary conditions: open reference works, closed method supply, full citation expected, and an explicit statement of the limits of the claim.",
  },
}

# 18-day unit arc, mirroring the published Grade 8 release so Study segmentation
# and the family schedule stay identical in shape.
PHASES = [
  "Launch and diagnostic", "Concept model A", "Guided practice A",
  "Independent application A", "Concept model B", "Guided practice B",
  "Investigation or close reading", "Reteach and varied practice", "Concept model C",
  "Discussion or problem seminar", "Performance task planning", "Performance task build",
  "Skill consolidation", "Transfer challenge", "Assessment preparation",
  "Unit assessment", "Targeted correction", "Publication, presentation, or reflection",
]


# ---------------------------------------------------------------------------
# Per-grade learning objectives and success criteria.
#
# These are what a learner is actually judged against, so they must differ by
# course. A shared template here is what makes a senior course indistinguishable
# from a freshman one regardless of how the unit headers read.
# ---------------------------------------------------------------------------

OBJECTIVES = {
  9: [
    "Explain what {focus} means and name the textual signal that tells you it is in play.",
    "Apply {focus} to an assigned text using the stated criteria, working {band}.",
    "Check the work against the criteria checklist and name one revision it calls for.",
  ],
  10: [
    "Explain what {focus} means and reconstruct, unprompted, the criteria a strong response must meet.",
    "Apply {focus} to an unfamiliar text without an exemplar, working {band}.",
    "Judge whether the learner's own evidence is sufficient, and revise where it is not.",
  ],
  11: [
    "Explain what {focus} means on material that resists a first reading, and say where a competent reader would slow down.",
    "Apply {focus} to 11-CCR material, working {band}, and distinguish what the text settles from what it leaves open.",
    "State what the evidence does not establish, and what further evidence would settle it.",
  ],
  12: [
    "Propose an approach to {focus} on self-selected material and justify it before beginning.",
    "Execute that approach independently, working {band}, documenting decisions as a scholar would.",
    "Bound the resulting claim: state its limits, its strongest counter-case, and what would overturn it.",
  ],
}

CRITERIA = {
  9: [
    "The response uses the criteria checklist and meets each item on it.",
    "Every claim is tied to a specific, quoted or located piece of text.",
    "The learner names one revision the checklist calls for and makes it.",
  ],
  10: [
    "The response meets criteria the learner stated from memory, with no exemplar consulted.",
    "The evidence offered is sufficient for the claim, not merely consistent with it.",
    "The learner identifies and repairs the weakest link in their own reasoning.",
  ],
  11: [
    "The response distinguishes what the text establishes from what it leaves uncertain.",
    "Evidence is drawn from 11-CCR material and is quoted or located precisely enough to check.",
    "The learner states what additional evidence would settle the open question.",
  ],
  12: [
    "The learner states the method they chose and the known weakness of that method.",
    "Every claim is traceable to a source the learner assessed for strengths and limitations relative to this task.",
    "The learner reports what the evidence does not establish and what would overturn the claim.",
  ],
}

# ---------------------------------------------------------------------------
# Phase-specific lesson shapes.
#
# The 18-day arc is only real if the phases produce different days. A phase key
# maps to (segments, activity, check), where each segment is
# (name, minutes, action-template). Templates may use {focus}, {ptask}, {unit},
# and the rigor-profile keys {model} {guided} {independent} {seminar} {transfer}
# {mastery}.
# ---------------------------------------------------------------------------

_OPEN = ("Welcome and retrieval", "5-8",
         "Open with a short retrieval prompt on {focus}. Ask the learner to predict, recall, or pose a question before any instruction.")
_EXIT = ("Exit ticket and next step", "3-7",
         "In one concise response, state the most important claim about {focus} and one check that would expose a weak or unsupported reading.")

def _standard(model_min, guided_min, indep_min):
    return [
      _OPEN,
      ("Model or mini-lesson", model_min, "{model} Keep the explanation centered on {focus}."),
      ("Guided practice", guided_min, "{guided} The object of practice is {focus}."),
      ("Independent application", indep_min, "{independent} The learner writes this response; the tutor may question or critique but may not draft it."),
      _EXIT,
    ]

PHASE_SPECS = {
  "Launch and diagnostic": {
    "segments": [
      _OPEN,
      ("Ungraded diagnostic", "10-15",
       "Ask the learner to attempt {focus} cold, before any instruction. Record what they already do well. Nothing here is scored, and errors here are data, not failure."),
      ("Surface and name", "10-15",
       "Name what the diagnostic revealed in neutral, non-character language. State the unit question and what will count as evidence by the end of it."),
      ("Orientation to the unit", "12-20",
       "Walk the unit's destination: {ptask}. The learner writes down what they think will be hardest about it and why. The tutor may question this prediction but may not write it."),
      ("Goal setting", "3-7",
       "The learner records one specific thing about {focus} they intend to be able to do by the end of the unit."),
    ],
    "activity": "Attempt {focus} without instruction, then record a personal goal for the unit.",
    "check": "Name one thing about {focus} you can already do and one you cannot do yet.",
  },
  "Concept model A": {"segments": _standard("12-18", "10-15", "12-22")},
  "Concept model B": {"segments": _standard("12-18", "10-15", "12-22")},
  "Concept model C": {"segments": _standard("10-15", "10-15", "15-25")},
  "Guided practice A": {"segments": _standard("6-10", "18-26", "12-20")},
  "Guided practice B": {"segments": _standard("6-10", "18-26", "12-20")},
  "Independent application A": {"segments": _standard("5-8", "6-10", "25-38")},
  "Investigation or close reading": {
    "segments": [
      _OPEN,
      ("Set the reading purpose", "5-10",
       "State one question about {focus} the reading must answer. The learner writes the question in their own words before reading."),
      ("Sustained close reading", "25-35",
       "Uninterrupted reading and annotation of the assigned text, working {band}. No instruction interrupts this block. An accessible reading representation is used if preferred."),
      ("Evidence harvest", "12-18",
       "The learner extracts the passages bearing on {focus}, records why each was selected, and marks the one they are least sure about."),
      _EXIT,
    ],
    "activity": "Read the assigned text sustained and uninterrupted, then harvest and justify the evidence bearing on {focus}.",
    "check": "Quote the single passage that most changes your reading of {focus}, and say what it changes.",
  },
  "Reteach and varied practice": {
    "segments": [
      ("Error review", "8-12",
       "Review the specific errors the learner made about {focus}. Describe the pattern neutrally. Do not infer effort, motivation, or character from an error."),
      ("Reteach the smallest gap", "10-15",
       "Re-teach only the smallest prerequisite the errors point to, using a different representation than the first time."),
      ("Varied practice", "18-26",
       "Three short items on {focus} in deliberately different forms, so the learner cannot pattern-match a single surface."),
      ("Fresh check", "10-15",
       "One new item on {focus} with no support, to test whether the reteach took."),
      ("Next step", "3-7",
       "Name what changed between the first attempt and this one. Record whether the gap is closed or still open."),
    ],
    "activity": "Re-attempt {focus} after targeted reteaching, in three varied forms plus one unsupported check.",
    "check": "Explain what you were doing wrong about {focus} before, and what you are doing differently now.",
  },
  "Discussion or problem seminar": {
    "segments": [
      ("Preparation check", "5-10",
       "Confirm the learner has read and researched the material and arrives with located evidence. Unprepared participation is rescheduled, not penalised."),
      ("Seminar", "30-40",
       "{seminar} The discussion is about {focus}. The tutor may pose questions and challenge reasoning but does not supply positions."),
      ("Disagreement log", "10-15",
       "Record the strongest point made against the learner's own position and what it would take to answer it."),
      ("Private option", "0-5",
       "A private route is always available: at the learner's preference this seminar is held privately one-to-one with the facilitator, or submitted in writing. No group, public, or recorded participation is ever required."),
      ("Reflection", "3-7",
       "Name one view you changed, qualified, or held with better reasons than before."),
    ],
    "activity": "Participate in or write out a seminar on {focus} with prepared, located evidence.",
    "check": "State the strongest point made against your position and your best answer to it.",
  },
  "Performance task planning": {
    "segments": [
      ("Restate the task", "5-10",
       "The learner restates the performance task in their own words: {ptask}"),
      ("Criteria and evidence plan", "12-18",
       "Identify what will count as success and which evidence about {focus} the task will require. The tutor may critique the plan but may not write it."),
      ("Scope and constraint", "12-18",
       "Narrow or broaden the plan until it is genuinely completable in the days remaining. Name what is being left out."),
      ("Source and access check", "8-12",
       "Confirm every text or source the plan depends on is available in an accessible representation, and that nothing required is behind a rights barrier."),
      ("Plan of record", "5-8",
       "The learner writes the plan they will actually follow, including the first concrete step."),
    ],
    "activity": "Produce a written plan of record for the unit performance task, scoped to the time available.",
    "check": "State your plan's single greatest risk of failure and how you will detect it early.",
  },
  "Performance task build": {
    "segments": [
      ("Plan check", "5-8", "Re-read the plan of record. Name what changed since planning and why."),
      ("Sustained production", "35-45",
       "Uninterrupted work on {ptask}. The learner produces; the tutor is available for questions and critique but writes nothing that will be assessed."),
      ("Self-critique against criteria", "10-15",
       "Compare the work in progress against the success criteria and mark the weakest section."),
      ("Access and source check", "3-6",
       "Confirm every text the build depends on is still available in an accessible representation and that nothing required sits behind a rights barrier."),
      ("Next-session commitment", "3-7", "Record exactly where work will resume."),
    ],
    "activity": "Sustained independent production on the unit performance task.",
    "check": "Identify the weakest section of what you built today and what it needs.",
  },
  "Skill consolidation": {
    "segments": [
      _OPEN,
      ("Cumulative retrieval", "10-15",
       "Retrieve across the whole unit, not just today: the learner recalls the moves from earlier phases without notes first, then checks."),
      ("Mixed practice", "20-28",
       "Interleave items drawn from several of the unit's topics so the learner must decide which move applies before applying it, including {focus}."),
      ("Discrimination check", "12-18",
       "Present two superficially similar cases where different moves are correct. The learner must justify the choice, not just the answer."),
      _EXIT,
    ],
    "activity": "Interleaved practice across the unit's topics, deciding which move applies before applying it.",
    "check": "Given two similar cases, say which move each needs and why they differ.",
  },
  "Transfer challenge": {
    "segments": [
      _OPEN,
      ("Framing", "5-8", "State that today's material is deliberately outside the unit's practised range."),
      ("Transfer task", "30-40",
       "{transfer} The task concerns {focus} but the context is new. No worked example for this context is supplied to any course."),
      ("Account of the transfer", "12-18",
       "The learner explains what carried over from the unit and what had to be adapted, and why."),
      _EXIT,
    ],
    "activity": "{transfer}",
    "check": "Name what transferred unchanged from this unit, and what you had to adapt.",
  },
  "Assessment preparation": {
    "segments": [
      ("Criteria walkthrough", "10-15",
       "Walk the assessment's rubric dimensions and what each one is looking for. No new content is introduced today."),
      ("Gap self-audit", "15-20",
       "The learner identifies which of the unit's topics they are least secure in, including whether {focus} is among them."),
      ("Targeted closing practice", "18-25",
       "Practice only on the topics the self-audit flagged. Time is not spent on what is already secure."),
      ("Conditions briefing", "5-8",
       "State plainly what support will and will not be available during the assessment, and confirm access accommodations, which are never withdrawn."),
      ("Readiness statement", "3-6",
       "The learner records, in one sentence, what they expect to find hardest tomorrow. This is not scored and is not shared beyond the facilitator."),
    ],
    "activity": "Self-audit the unit's topics, then practise only the flagged gaps.",
    "check": "Name the topic you are least secure in and the specific practice that would close it.",
  },
  "Unit assessment": {
    "segments": [
      ("Conditions and access", "3-5",
       "Confirm access accommodations are in place. Confirm the support conditions for this course. No new instruction occurs today and no exemplar is available."),
      ("Assessment, part one", "25-35",
       "The learner completes the concept, evidence, and application prompts independently. The tutor does not model, prompt, or critique during the assessment."),
      ("Break", "0-10",
       "An approved break is available on request and is not recorded as an interruption or a failure."),
      ("Assessment, part two", "25-35",
       "The learner completes the analysis, connection, performance-evidence, and reflection prompts independently."),
      ("Submission", "3-5",
       "The learner submits. Scoring guidance is adult-only and is not shown to the learner at submission."),
    ],
    "activity": "Complete the unit assessment independently under this course's stated support conditions.",
    "check": "Submitted assessment. This is a summative occasion, not a formative check.",
  },
  "Targeted correction": {
    "segments": [
      ("Return with evidence", "8-12",
       "Return the assessment described by evidence and next step, not by a single percentage or a character judgment."),
      ("Error analysis by the learner", "15-22",
       "The learner categorises their own errors about {focus} and the unit's other topics: not-known, known-but-misapplied, or careless. The tutor questions the categorisation but does not assign it."),
      ("Reteach the largest gap", "15-20",
       "Re-teach only the gap the analysis identified as not-known, using a representation different from the original instruction."),
      ("Reassessment path", "8-12",
       "Agree what fresh evidence will be produced and when. Reassessment uses new items or a new text; the higher demonstration stands and the earlier attempt is not averaged in."),
      ("Close without judgment", "3-6",
       "Restate the gap as a gap, not as a trait. Record the next step only; no effort, motivation, diagnosis, or character language enters the record."),
    ],
    "activity": "Categorise your own errors, then re-learn the largest genuine gap.",
    "check": "For one error, say whether it was not-known, misapplied, or careless, and what that implies about the fix.",
  },
  "Publication, presentation, or reflection": {
    "segments": [
      ("Final revision pass", "12-18",
       "One last revision of the unit's product against the success criteria, focused on what is most significant for the audience."),
      ("Publication or presentation", "20-30",
       "Publish or present the work. This may be delivered publicly, privately to the facilitator, in writing, orally, or in another accessible format. No public or recorded performance is ever required, and media carries captions, transcripts, and alt text."),
      ("Evidence of growth", "10-15",
       "Place the piece beside earlier work and identify, with evidence, what changed about the learner's handling of {focus} and the unit's other topics."),
      ("Forward link", "5-8",
       "Name what from this unit the next unit will assume you can already do."),
      ("Portfolio filing", "3-6",
       "File the piece with its target, evidence type, and revision history. Raw drafts and private reflections stay out of the guardian-visible record."),
    ],
    "activity": "Publish or present the unit's work in a chosen format, then evidence the growth it shows.",
    "check": "Point to one concrete difference between this piece and your earlier work, and name what caused it.",
  },
}
