# Academic Integrity — Authorship, Answer Protection, and Persistence

Three commitments hold across every lesson and every assessment in both courses. All three are structured lesson fields, so `tools/validate.py` fails the package if any lesson or assessment omits one.

## 1. The learner writes the assessed response

**The tutor may:** ask a question, name a criterion, restate directions, model on a separate example, point to a place where an idea is unclear, read the prompt aloud, or confirm that the learner can restate the task.

**The tutor must not:** draft, dictate, outline, complete, reword, or supply sentences for the learner's assessed essay or extended response.

This distinction is what makes an assessed writing sample evidence of anything. It is stated on every lesson in the `student_authorship` field and repeated on every assessment. The three writing phases carry it explicitly: the tutor demonstrates revision and editing on a sample, **never on the learner's assessed draft**.

The instructional model is built so this rule does not starve the learner of help. Modeling happens on a parallel example. Guided practice happens on non-assessed items. By the assessed day, support has already been given where it belongs.

## 2. Fixed answers are protected

Fixed-answer items and their keys are **scorer-visible only**.

The tutor surface, the learner surface, and any hint or scaffold path must not expose, restate, or narrow toward a fixed answer before the learner responds. Feedback after the response addresses the learner's reasoning, not the key.

This is why the adaptive tutor routes in every lesson are written as instructional moves — return to the prerequisite, require textual support, contrast with a worked example — and never as answer disclosure. The route for "answer without textual support" requires the learner to go find the words in the text; it does not tell them which words.

## 3. No raw response persistence is required

Nothing in either course requires storing a learner's raw essay text.

**Stored:** lesson target, completion state, evidence type, whether the evidence was guided or independent, criteria met, and the next instructional step.

**Not required to be stored:** the learner's raw essay or extended written response text, raw voice or video, and private reflections.

A runtime may evaluate an extended response in session and persist only the evidence descriptors. Parent-facing summaries follow the same boundary: they show target, completion, evidence type, and next step, never raw responses, private reflections, or diagnosis language.

## Guided evidence is not independent evidence

Every lesson is tagged `guided` or `independent`, and every assessment lists which unit days produced each kind.

Guided evidence documents progress and drives the next instructional move. It is never sufficient on its own for a mastery decision. Mastery requires accurate independent evidence on at least two occasions separated by time, text, or representation. A unit assessment is one occasion, not two.

This is the mechanism that keeps a tutor-supported course honest: help is available throughout, and the mastery record still reflects what the learner did alone.

## Disclosure of assistance

Consistent with the shared technology and AI policy, learners disclose meaningful assistance, cite sources, preserve their own reasoning, and never submit work completed by a tutor or an AI as their own. At these grades that is taught concretely: in Grade 3 as "notes in your own words," and in Grade 4 as a checked paraphrase plus a source list.
