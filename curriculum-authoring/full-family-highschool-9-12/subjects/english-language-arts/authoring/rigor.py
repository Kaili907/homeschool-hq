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
