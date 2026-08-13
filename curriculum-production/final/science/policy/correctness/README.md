# Lesson-level scientific correctness authority

Hand-authored, adult-facing content keys — one per `(course, unit, focus)` topic, 54 per course,
486 in total, covering all 972 lessons. These files are **build inputs, not build outputs**: the
build reads them, it never writes them. `tools/build_student_work.py` fails if a lesson has no
matching topic key, so a lesson can never ship without one.

## Why this exists

The rubric already carries a `Scientific correctness` criterion, but a criterion is not a key: a
parent scoring "ionic bonds form when atoms share electrons equally" still has to know that is wrong.
These files supply what the parent needs to know, per lesson, in the adult copy only.

## What a topic key may and may not contain

A key states **what the curriculum teaches**. It never states what the learner measured.

| Field | Meaning | Rule |
| --- | --- | --- |
| `fixed_facts` | Answers that are genuinely fixed — a pairing, a name, a definition, a conserved quantity | Present only where the answer really is fixed. Empty is a valid and common value. |
| `relationships` | The accepted relationships or models the lesson's learning target asserts | 2–4. The core of the key. |
| `accepted_alternative_framings` | Different correct ways to express the same science, all of which must be accepted | Use wherever more than one correct model or wording exists. |
| `disqualifying_errors` | Specific false claims that are `Not yet` on `Scientific correctness` however well evidenced | 2–4. Written as the error, so an adult can match it. |
| `out_of_scope` | What is beyond this grade band | Must not be required, and correct work beyond it is never marked wrong. |

**Prohibited in every field**, enforced by `validation/checks.mjs`:

- any measurement, reading, result, or observation attributed to a learner;
- any expected value for a quantity the learner is asked to measure;
- any numeric "should get" for an investigation.

A defined constant (the freezing point of water at 1 atm, the speed of light, a molar mass) is a
published property of the world, not an observation, and is allowed — as a `fixed_fact`, never as an
expected reading.

## Authority forms

`tools/correctness.py` selects the forms that apply to each lesson from its work type and its
supplied-data status. A lesson carries between two and five:

| Form | Applies when |
| --- | --- |
| `FIXED_FACTUAL` | the topic key has at least one `fixed_facts` entry |
| `ACCEPTED_RELATIONSHIPS` | always |
| `EXPECTED_REASONING_CRITERIA` | always — claim-and-evidence criteria, per analysis question |
| `RUBRIC_CORRECTNESS_CONSTRAINT` | always — the `disqualifying_errors` bound the rubric |
| `SUPPLIED_DATA_ANSWER_AUTHORITY` | the source names published data for the lesson; the named source and its provenance line are the authority, and the pinned resource id is printed |
| `INVESTIGATION_CRITERIA` | the lesson is an `INVESTIGATION_DATA_SHEET` — method and reasoning criteria only, with an explicit instruction that a recorded observation is never scored against this key |

## Provenance

Every file records the course, the source commit its lesson set was read at, and the reference basis
each topic was authored against. The keys are authored from established science at the grade band
named in the source's own standards line — they are not extracted from the source text, which states
only a focus and generic objectives. That is why they are authored files under review rather than
derived ones.
