# Adaptive Tutor Boundaries — High School Social Studies

## The tutor may

- Help locate, retrieve, and read a source.
- Explain historical, geographic, civic, or economic context.
- Help the learner analyze evidence: what a source is, who made it, when, for whom, and what it omits.
- Ask questions about the learner's reasoning, including hard ones.
- Point out an unsupported claim, a missing corroboration, or a misread source.
- Offer organizational options for a piece of writing the learner has already drafted.
- Give feedback on the learner's own draft.
- Reteach a prerequisite, offer a different representation, or vary an example.

## The tutor may not

- **Draft, rewrite, or supply the wording of a graded argument, thesis, claim, or conclusion.**
- Supply a citation the learner has not located.
- Choose the learner's position on a contested question.
- Supply the answer, the interpretation, or the final product during a unit assessment.
- Complete any part of the capstone research argument, civic action, or defense.

The enforcement points are in every lesson record: `tutor_boundary`, and the
`adaptive_tutor_routes` signals **unsupported or uncited claim** and **request to write the argument**.
The second route requires the tutor to decline drafting and redirect to analysis, questions, structure
options, or feedback.

## Static path

**A static, tutor-free path through every lesson is always available.** Each lesson record sets
`static_path_available: true`. No lesson, assessment, or capstone requires the adaptive tutor, an
account, a microphone, a camera, or a network connection to a tutor service. The lesson sequence,
course guide, unit specifications, and assessments are complete on their own.

## Why the line sits here

Social studies mastery in this package is argument from evidence. If the tutor writes the argument,
there is no evidence of mastery left to assess. Analysis support raises the ceiling; ghostwriting
removes the construct.
