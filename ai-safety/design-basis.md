# Safety-center design basis

The Manuel Academy design is informed by public Khan Academy guidance current
on 2026-07-28:

- Parents can review a linked child's tutor conversations:
  <https://support.khanacademy.org/hc/en-us/articles/14394854880909-How-do-I-view-my-child-s-Khanmigo-chat-history>
- Moderation flags can notify an associated adult, and automated detection can
  be wrong:
  <https://support.khanacademy.org/hc/en-us/articles/14394569357069-What-happens-if-my-child-or-student-s-Khanmigo-conversation-gets-flagged>
- Learners should be told who can review their history, usage should be
  bounded, and feedback/appeal paths should exist:
  <https://support.khanacademy.org/hc/en-us/articles/14394814244365-What-safety-features-does-Khanmigo-have>

This implementation adapts those ideas rather than copying the product:

- Every query is scoped to an authenticated actor, household, and selected
  student before search or filtering.
- Instructional conversation history and immutable safety/audit events are
  different record types and different interface sections.
- Students can see and report their own sessions, block the tutor, and request
  review of a suspected false positive.
- Parents configure subject, schedule, feature, notification, and retention
  permissions per linked student.
- The system stores transcript text needed for parent review, but safety events
  use bounded excerpts or references. Raw microphone recordings are not part of
  any contract.
- Emergency-language handling pauses tutoring and calls for trusted-adult
  support and human review without diagnosing, promising a response, naming a
  hotline, or fabricating local service information.
