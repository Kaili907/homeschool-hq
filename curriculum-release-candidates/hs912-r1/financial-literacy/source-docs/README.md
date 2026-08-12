# Manuel Academy — High School Financial Literacy, Grades 9-12

Four continuous courses extending the published Grade 8 financial-literacy course into a
complete high-school sequence:

`ma-g8-financial-literacy` (published, untouched)
→ **Financial Literacy 9** → **10** → **11** → **12**

## Why this lane sits outside `curriculum-content/`

`curriculum-content/manuel-academy/1.0.0/` is an immutable published release, pinned by
`scripts/build-curriculum.mjs` and `tests/curriculum-content.test.js` to exactly
`grades: ['5','7','8']`. Adding grades 9-12 there would break the published release
invariants and the production build.

This lane is authoring-stage content held separately, written to the same lesson shape as the
published release so a later release cycle can promote it through the existing authoring,
validation, approval, staging, and publishing pipeline without reshaping a lesson.

**Nothing in this lane modifies the Study Engine, the Family Pilot integration, the app or
router, other high-school subject lanes, the Grade 8 canonical curriculum, or the
Grades 5/7/8 canonical release.**

## Layout

```
standards/
  michigan-personal-finance-9-12-expectations.json   PF1-PF7 + PF4.1, verbatim
  standards-custody.md                               retrieval chain, hash, and limits
progression/
  grade-8-to-financial-literacy-9-handoff.md         what G8 leaves; what G9 picks up
  rigor-progression-9-12.md                          why each year sweeps all seven
courses/<slug>/
  course-guide.md        description, expectation coverage, scope and sequence, policies
  units.json             7 units, one per expectation
  lessons.jsonl          72 lesson blueprints, one JSON object per line
  assessments.json       7 unit assessments with rubrics and mastery rules
  daily-schedule.csv     72-day schedule (36 weeks x 2)
  lesson-sequence.md     human-readable sequence
authoring/               deterministic generators for the above
validation/
  validate.mjs           159 mechanical checks
  validation-report.md   latest run
```

## Totals

| | Count |
| --- | --- |
| Courses | 4 |
| Units | 28 (7 per course) |
| Lessons | 288 (72 per course) |
| Unit assessments | 28 |
| Expectations in corpus | 8 (PF1-PF7 plus sub-expectation PF4.1) |

## Standards

Verified against the official Michigan Department of Education publication *Michigan Merit
Curriculum: Personal Finance 9-12 Content Expectations* (`Personal Finance v5/2023`),
retrieved in-session and hashed (`sha256:ff976405…2735`). No expectation was reconstructed
from memory. See `standards/standards-custody.md` for the retrieval chain and an explicit
statement of what is verbatim versus what is local repository convention.

**A note worth reading.** A secondary web summary encountered during retrieval described "the
6 recognized personal finance standards." The retrieved document prints **seven**, the seventh
being PF7 Paying Taxes. This lane follows the document. The repository's own published
Grade 8 course independently organises its units as PF1-PF7, which corroborates it. Authoring
from the summary would have silently dropped an entire required expectation.

## Coverage decision

Michigan publishes one 9-12 expectation set, not four grade-level sets. **Each high-school
year sweeps all seven expectations at increasing sophistication** rather than dividing them
between years — so any single year can serve as the ½ credit the Michigan Merit Curriculum
requires, and no year teaches credit before income. The reasoning, and the year-by-year
escalation, is in `progression/rigor-progression-9-12.md`.

## Safety boundary — simulated finances only

Enforced by the validator on all 288 lessons:

- Every figure, employer, institution, offer, account, and document is **fictional**.
- **No real transaction** is ever required: no purchase, transfer, deposit, withdrawal, trade,
  application, or account opening.
- **Never requested:** real bank credentials, card numbers, SSN or tax ID, brokerage
  credentials, passwords, or real balances. No learner-facing field mentions them at all, and
  every lesson carries a tutor route that refuses and redirects if a learner offers one.
- **No individualized financial advice.** When a learner asks what they personally should do
  with real money, the tutor declines to individualize, gives the general principle, and
  points to a trusted adult or a qualified licensed professional.
- **No shame.** Financial hardship is never framed as a personal or family failing, and a
  learner is never asked to disclose real household finances.

## Grade 12 capstone

Grade 12 unit 7 is the **simulated adult-finance capstone**: one fictional adult financial
year operated end to end — income and onboarding, spending, budget, credit and financing,
investing, protection, and a simulated tax filing — presented and defended, including what it
sacrificed and what would break it. No real transaction is required.

## Study Engine compatibility

Authored **for the existing Study Engine**. No session state machine, checkpoint system,
mastery engine, Tutor Core, or Family Pilot progress store is introduced or duplicated.
Every lesson carries at least five `lesson_flow` segments so segment-level resume works
unchanged, and uses the same adult-only fields (`answer_or_scoring_guidance`,
`adaptive_tutor_routes`, `mastery_rule` / `mastery_interpretation`) that the existing content
boundary already withholds from student chunks.

**Practice generation never directly awards mastery.** Mastery requires accurate independent
application plus explanation on at least two separate occasions, at least one on a scenario the
learner has not previously worked.

**Parent-visible evidence is minimized:** target, completion state, evidence type, next step.
No raw responses, no volunteered financial detail, no diagnosis-like language.

As in the sibling ELA lane, `lesson.schema.json` in the frozen release pins `grade` to
`[5,7,8]` and `lesson_id` to `^ma-g(5|7|8)-`. That schema belongs to the frozen release and is
**not** edited here; promoting this lane will require widening those two constraints in a
release-owned change. Recorded as a pilot blocker rather than silently patched.

## Validate

```
node validation/validate.mjs
```

## Regenerate

```
python3 authoring/generate_courses.py
```

Generation is deterministic: the same blueprints produce byte-identical output.
