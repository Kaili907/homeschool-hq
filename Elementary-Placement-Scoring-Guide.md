# Elementary Placement — Scoring Guide and Placement Rules

Scoring authority for the six elementary placement instruments built in session
CURRICULUM-CE3. This is the document an independent reviewer audits.

Items and keys: `Elementary-Placement-Math-G3-G4-G6.md`,
`Elementary-Placement-ELA-G3-G4-G6.md`
Code: `src/assessment/banks/placementModel.ts`
Tests: `src/assessment/elementaryPlacement.test.ts`

## The one rule that outranks everything here

**A placement result is a recommendation. It is never applied by software.**

`computePlacement()` takes an instrument and an attempt. It does not take a
profile, so it has no way to read or write `Profile.workingLevels` even by
mistake. `buildPlacementSummary()` takes only the computed result. Neither
function, and no other export of the placement module, writes anything. Stephen
is the only person who changes a working level, and he owes this document no
justification for overriding it.

Tests enforce this structurally: a full run through the real attempt pipeline
against a profile-shaped object asserts the object is byte-identical afterward,
and a test asserts the module exports no function whose name begins with
`set`/`apply`/`write`/`save`/`persist`/`assign`.

## Scoring weights

**Every item weighs exactly 1.** The `weight` column exists in the blueprint so a
reviewer can confirm at a glance that no item is silently double-counted; a test
asserts every weight is 1 across all six instruments. There is no other
weighting, no scaling, and no normalisation curve anywhere in the model.

## How an item's weight is disposed of

| Scorer verdict | Counts toward `possible` | Counts toward `earned` | Notes |
| --- | --- | --- | --- |
| `correct` | yes | yes | |
| `incorrect` | yes | no | only for confidently-wrong objective answers |
| `skip` | yes | no | a skip is *not demonstrated*, which is honest information |
| `unmatched` | **no** | no | scorer not confident → **pending**, waits for a human |
| `ungraded` | **no** | no | pending |
| rubric, human score supplied | yes | `weight × score / maxPoints` | |
| rubric, no score supplied | **no** | no | pending |
| rubric, skipped by the child | yes | no | declined in front of the parent |

Pending weight leaves the denominator entirely. **An answer the machine cannot
judge is never counted wrong.** This is inherited from the original assessment
addendum and it is what makes the "insufficient evidence" outcome meaningful
rather than decorative.

## Thresholds

Every number the placement decision depends on, all declared in
`PLACEMENT_THRESHOLDS`:

| Constant | Value | Used for |
| --- | --- | --- |
| `maxPendingShare` | 0.25 | above this share of pending weight, no band is claimed |
| `foundationShaky` | 0.60 | prerequisite floor |
| `foundationSecure` | 0.85 | prerequisites count as held |
| `currentSecure` | 0.85 | this year's skills count as already held |
| `stretchReady` | 0.70 | next-grade evidence counts as genuine |
| `lowConfidencePendingShare` | 0.10 | above this, confidence drops to low |
| `lowConfidenceSkipShare` | 0.20 | above this, confidence drops to low |
| `lowConfidenceMargin` | 0.05 | landing this close to a band edge drops confidence |
| `domainSecure` | 0.80 | domain reads as secure |
| `domainDeveloping` | 0.50 | domain reads as developing |

## The placement-rule table

Percentages are per tier: `earned ÷ possible` within that tier.

| Rule | Predicate | Outcome |
| --- | --- | --- |
| **R0** | any tier scored no item definitively, **OR** pendingShare > 0.25 | insufficient evidence — parent review required |
| **R1** | gate open **AND** foundation < 0.60 | begin one level below for this subject |
| **R2** | gate open **AND** 0.60 ≤ foundation < 0.85 | begin at nominal grade **with prerequisite intervention** |
| **R3** | gate open **AND** foundation ≥ 0.85 **AND** current ≥ 0.85 **AND** stretch ≥ 0.70 | ready for advanced material |
| **R4** | gate open **AND** foundation ≥ 0.85 **AND NOT** (current ≥ 0.85 **AND** stretch ≥ 0.70) | begin at nominal grade with targeted review |

### Why there are no gaps and no contradictory overlaps

Each predicate is written **fully bounded** in the source rather than relying on
evaluation order. That makes R0–R4 pairwise disjoint *and* exhaustive on their
own terms, so the property can be asserted directly instead of argued:

- `elementaryPlacement.test.ts` sweeps a dense grid — foundation × current ×
  stretch over 0.00…1.00 in steps of 0.05, crossed with five pendingShare
  values, 46,305 combinations — and asserts **exactly one** rule matches every
  time.
- A second sweep covers every combination of null (no-evidence) tiers and
  asserts exactly one rule matches, always R0.
- Band edges are pinned explicitly: 0.599 → R1 but 0.600 → R2; 0.849 → R2 but
  0.850 → R3/R4; current 0.849 → R4 but 0.850 → R3; stretch 0.699 → R4 but
  0.700 → R3.

`ruleFor()` falls back to **R0** if no rule matched. That branch is unreachable
while the table is total, and it points at "ask the parent" rather than at a
placement, so any future edit that punched a hole would fail safe.

### Every band is reachable

A test constructs a real attempt on each of the six instruments for each of the
five outcomes and asserts the outcome is produced. The fixtures answer chosen
items with their canonical keys and skip the rest, so each tier percentage is
exactly (correct ÷ items in tier) — no hidden arithmetic in the fixture either.

## Confidence

Two values exist: `low` and `moderate`. **There is no `high`.** One assessment on
one morning does not earn it, and a value that cannot be produced would be worse
than no value at all, so it is not defined.

Confidence is `low` when any of these hold, and each reason is listed in plain
words in the parent summary:

- the outcome is R0 (insufficient evidence)
- pendingShare > 0.10 — a human still has reading to do
- skipShare > 0.20 — a large part of the paper was skipped
- the foundation score landed within 0.05 of 0.60 or 0.85
- prerequisites are secure and the current or stretch score landed within 0.05
  of its edge

Otherwise `moderate`. A perfect paper with every rubric graded returns
`moderate`, and a test asserts exactly that.

## Domain bands (the skill-priority list)

| Band | Range | Reading |
| --- | --- | --- |
| priority for teaching | [0.00, 0.50) | |
| developing | [0.50, 0.80) | |
| secure | [0.80, 1.00] | |
| not enough evidence | `possible = 0` | every item in the domain is pending |

The three numeric bands partition [0,1] exactly; a test walks 0.00–1.00 in
hundredths and asserts every value lands in exactly one. Priorities are reported
weakest-first.

Small domains report coarsely on purpose — a two-item domain can only read 0%,
50% or 100%. That is a sampler, not a mastery measure, and the parent summary's
uncertainty language covers it.

---

## Rubrics

Every open response has a rubric. No open response is machine-scored; a test
asserts every `longtext` item in the bank is `mode: 'rubric'`.

### Read-aloud accuracy (0–3) — UNTIMED, parent-observed

The parent listens once while the child reads the on-screen passage aloud.
**Do not time it. Do not count words per minute. Do not ask for a re-read.**

| Score | What it looks like |
| --- | --- |
| 3 | Reads the passage accurately. Occasional self-correction is fine and counts as accurate. |
| 2 | A few words misread or needing help, but meaning is carried throughout. |
| 1 | Frequent misreads; the parent supplies several words; meaning breaks in places. |
| 0 | Cannot read the passage independently, or declines. |

A 0 or 1 here is a signal to look at decoding directly with a proper reading
inventory. It is not a diagnosis of anything.

### Short constructed response (0–3) — comprehension, inference, theme

| Score | What it looks like |
| --- | --- |
| 3 | Answers the question AND supports it with an accurate detail from the text. |
| 2 | Answers the question correctly but the support is thin, vague, or missing. |
| 1 | Retells or copies from the text without answering the question asked. |
| 0 | No response, or unrelated to the text. |

Score the reasoning and the evidence, never the wording. Plain language earns
full marks.

### Extended constructed response (0–4) — main/central idea with two details

| Score | What it looks like |
| --- | --- |
| 4 | States the idea as an idea (not a plot summary) AND cites two accurate supporting details. |
| 3 | States the idea correctly with one supporting detail, or two details with a slightly narrow idea. |
| 2 | States the idea correctly with no support, or gives details without stating the idea. |
| 1 | Copies or retells only. |
| 0 | No response, or unrelated. |

### Paragraph writing (0–4)

| Score | Grade 3 (`e3e30`) | Grade 4 (`e4e31`) | Grade 6 (`e6e30`) |
| --- | --- | --- | --- |
| 4 | Topic sentence, two clear details, closing sentence; sentences are complete and mostly punctuated. | Topic sentence, three steps in correct order, closing; sentences are controlled and varied. | Topic sentence, three specific details, conclusion; written in connected prose, not a list. |
| 3 | One element weak or missing. | One element weak or missing. | One element weak or missing. |
| 2 | Two elements missing, or the paragraph is off-topic in part. | Two elements missing, or steps out of order. | Two elements missing, or reverts to a list. |
| 1 | A few related sentences with no structure. | A few steps with no structure. | Related sentences with no structure. |
| 0 | No response. | No response. | No response. |

Do not deduct for handwriting. Deduct for spelling **only where it blocks
meaning** — this is a placement instrument, not a spelling test.

### Opinion and argument writing

| Score | Grades 3–4 (`e3e31`, `e4e32`, max 3) | Grade 6 (`e6e31`, max 4) |
| --- | --- | --- |
| 4 | — | Clear claim, two reasons each with support, and a genuine response to a counter-reason. |
| 3 | Opinion stated with a real reason (G3), or opinion + two reasons + a response to a counter-reason (G4). | One element weak or missing. |
| 2 | Opinion stated with a weak or circular reason. | Claim with reasons but no counter-reason, or counter-reason acknowledged and not answered. |
| 1 | Opinion stated with no reason. | Claim only. |
| 0 | No response. | No response. |

**Score the reasoning, never whether the position is agreeable.** A well-argued
position the adult disagrees with earns full marks.

### Mathematical explanation

| Score | `e3m27` (max 3) | `e4m33` (max 3) | `e6m34` (max 4) |
| --- | --- | --- | --- |
| 4 | — | — | Explains that a mean hides the spread AND names what else is needed (range, individual scores, how spread out they are). |
| 3 | Explains that turning the array does not change the number of dots, in any words or via a described picture. | Names a real checking method (estimation, working backwards, re-reading the question) AND gives a worked example. | One of the two parts is thin. |
| 2 | States that both equal 20 and gestures at why, without the idea. | Names a method with no example, or an example with no method. | Says the average is not enough without saying why or what else. |
| 1 | Restates the two facts with no explanation. | Says only "check your work". | Restates the student's claim. |
| 0 | No response. | No response. | No response. |

### Item-specific grading notes

Each rubric item also carries a `keyNote` in the source, shown to the parent on
the results screen. These are emitted from the code below.

| Instrument | Item | Tier | Domain | Max points | What the grader is scoring |
| --- | --- | --- | --- | --- | --- |
| `ele-math-g3` | `e3m27` | C | Word problems and reasoning | 3 | Scored by a grown-up against the Grade 3 rubric in the scoring guide. Look for the idea that turning an array does not change how many dots it has. |
| `ele-ela-g3` | `e3e08` | C | Reading accuracy (read-aloud) | 3 | The grown-up listens once and scores ACCURACY ONLY against the read-aloud rubric in the scoring guide. Do not time the reading and do not record a words-per-minute figure. |
| `ele-ela-g3` | `e3e12` | C | Inference | 3 | Any reasonable feeling counts (happy, proud, surprised, relieved) as long as a story detail supports it — the grin, her hurting cheeks, or her reply to Sam. Score the evidence, not the adjective. |
| `ele-ela-g3` | `e3e18` | C | Main idea and evidence | 3 | Main idea: bees use a dance to tell each other where food is. Any detail from the text that supports it counts. A single copied sentence with no main idea scores 1. |
| `ele-ela-g3` | `e3e14` | S | Main idea and evidence | 3 | Grade 4 signal. Accept any defensible theme drawn from the text — there is more than one way to solve a problem; patience works; you do not have to do it someone else’s way. A retelling with no idea in it scores 1. |
| `ele-ela-g3` | `e3e30` | C | Writing | 4 | Score against the Grade 3 paragraph rubric in the scoring guide: topic sentence, two details, closing, and sentence mechanics. Do not deduct for handwriting or for spelling that does not block meaning. |
| `ele-ela-g3` | `e3e31` | S | Writing | 3 | Grade 4 signal. Score whether an opinion is stated and supported by a reason, not whether the opinion is agreeable. |
| `ele-math-g4` | `e4m33` | C | Multi-step problems | 3 | Scored by a grown-up against the Grade 4 rubric in the scoring guide. Look for estimation, re-reading the question, or working backwards — not for the phrase "check your work". |
| `ele-ela-g4` | `e4e09` | C | Reading accuracy (read-aloud) | 3 | Score ACCURACY ONLY against the read-aloud rubric in the scoring guide. Do not time the reading and do not record a words-per-minute figure. |
| `ele-ela-g4` | `e4e13` | C | Inference | 3 | Look for the contrast: nobody wanted the seat / he took it because he had to → he decided it was not so bad / he saved it. Two accurate details earn full marks even if the wording is plain. |
| `ele-ela-g4` | `e4e16` | S | Inference | 3 | Grade 5 signal. Full marks recognise the contrast between being alone and being companionably silent with somebody, and connect it to Dev changing his mind about the seat. |
| `ele-ela-g4` | `e4e20` | C | Main idea and evidence | 4 | Main idea: museums cannot undo light damage, so they now manage light carefully to slow it down. Accept any two accurate supporting details. |
| `ele-ela-g4` | `e4e31` | C | Writing | 4 | Score against the Grade 4 explanatory rubric in the scoring guide: topic sentence, three ordered steps, closing, and sentence control. Spelling counts only where it blocks meaning. |
| `ele-ela-g4` | `e4e32` | S | Writing | 3 | Grade 5 signal. Full marks require a stated opinion, two reasons, AND a response to a counter-reason. Score the structure, not the position taken. |
| `ele-math-g6` | `e6m34` | C | Statistics | 4 | Scored by a grown-up against the Grade 6 rubric in the scoring guide. Look for the idea that a mean hides spread, plus a request for the range, the individual scores, or how spread out they are. |
| `ele-ela-g6` | `e6e08` | C | Reading accuracy (read-aloud) | 3 | Score ACCURACY ONLY against the read-aloud rubric in the scoring guide. Do not time the reading and do not record a words-per-minute figure. |
| `ele-ela-g6` | `e6e14` | C | Inference | 3 | Full marks recognise the deliberate withholding — that Nadia is being left to judge her own work, or that there is no single right reading. A restatement of the plot with no interpretation scores 1. |
| `ele-ela-g6` | `e6e23` | S | Inference | 3 | Grade 7 signal. Full marks connect the metaphor to the specific trade-offs the passage lists — grade, rock, wetland, bridges, unwilling sellers — and recognise that each curve records a decision that was argued and settled. |
| `ele-ela-g6` | `e6e12` | C | Main idea and evidence | 4 | Accept any defensible theme (watching is not the same as doing; meaning is a choice the performer makes; recognition can arrive without approval). Full marks require a theme stated as an idea, not a plot summary, PLUS two accurate textual details. |
| `ele-ela-g6` | `e6e19` | C | Main idea and evidence | 4 | Central idea: a road’s curves come from real costs — grade, ground, water and land ownership — that a map hides. Full marks require the idea plus two accurate supporting details. |
| `ele-ela-g6` | `e6e30` | C | Writing | 4 | Score against the Grade 6 explanatory rubric in the scoring guide: topic sentence, three specific details, conclusion, and sentence control. Score the writing, not how impressive the topic is. |
| `ele-ela-g6` | `e6e31` | C | Writing | 4 | Score against the Grade 6 argument rubric: clear claim, two supported reasons, and a genuine response to a counter-reason. Score the reasoning, never whether the position is agreeable to the reader. |
---

## Skill-domain coverage matrix

Item counts per instrument, domain and tier (F = foundation / prior grade,
C = current / nominal year, S = stretch / next grade). Emitted from the
blueprints, so it cannot drift from the code.

| Instrument | Domain | F | C | S | Total |
| --- | --- | --- | --- | --- | --- |
| `ele-math-g3` | Place value | 3 | 2 | 1 | 6 |
| `ele-math-g3` | Addition and subtraction | 2 | 2 | 1 | 5 |
| `ele-math-g3` | Equal groups and arrays | 1 | 2 | 0 | 3 |
| `ele-math-g3` | Multiplication and division facts | 0 | 3 | 1 | 4 |
| `ele-math-g3` | Fractions | 1 | 2 | 1 | 4 |
| `ele-math-g3` | Measurement | 0 | 2 | 1 | 3 |
| `ele-math-g3` | Word problems and reasoning | 0 | 2 | 0 | 2 |
| `ele-ela-g3` | Word analysis and decoding | 3 | 3 | 1 | 7 |
| `ele-ela-g3` | Reading accuracy (read-aloud) | 0 | 1 | 0 | 1 |
| `ele-ela-g3` | Vocabulary in context | 0 | 2 | 1 | 3 |
| `ele-ela-g3` | Literal comprehension | 3 | 2 | 0 | 5 |
| `ele-ela-g3` | Inference | 0 | 3 | 0 | 3 |
| `ele-ela-g3` | Main idea and evidence | 0 | 1 | 2 | 3 |
| `ele-ela-g3` | Grammar and conventions | 2 | 4 | 1 | 7 |
| `ele-ela-g3` | Writing | 0 | 1 | 1 | 2 |
| `ele-math-g4` | Place value and whole numbers | 2 | 4 | 1 | 7 |
| `ele-math-g4` | Multiplication and division | 2 | 5 | 1 | 8 |
| `ele-math-g4` | Fraction equivalence and comparison | 1 | 3 | 0 | 4 |
| `ele-math-g4` | Fraction and decimal operations | 0 | 3 | 2 | 5 |
| `ele-math-g4` | Measurement | 1 | 2 | 0 | 3 |
| `ele-math-g4` | Geometry | 0 | 2 | 0 | 2 |
| `ele-math-g4` | Multi-step problems | 1 | 2 | 1 | 4 |
| `ele-ela-g4` | Word analysis and decoding | 2 | 1 | 1 | 4 |
| `ele-ela-g4` | Reading accuracy (read-aloud) | 0 | 1 | 0 | 1 |
| `ele-ela-g4` | Vocabulary in context | 1 | 4 | 1 | 6 |
| `ele-ela-g4` | Literal comprehension | 2 | 3 | 0 | 5 |
| `ele-ela-g4` | Inference | 0 | 3 | 2 | 5 |
| `ele-ela-g4` | Main idea and evidence | 0 | 3 | 0 | 3 |
| `ele-ela-g4` | Grammar and conventions | 2 | 3 | 1 | 6 |
| `ele-ela-g4` | Writing | 0 | 1 | 1 | 2 |
| `ele-math-g6` | Whole-number operations | 2 | 2 | 0 | 4 |
| `ele-math-g6` | Fractions and decimals | 3 | 3 | 1 | 7 |
| `ele-math-g6` | Ratios, rates and percent | 0 | 5 | 2 | 7 |
| `ele-math-g6` | Integers | 0 | 3 | 1 | 4 |
| `ele-math-g6` | Coordinate plane | 1 | 2 | 0 | 3 |
| `ele-math-g6` | Expressions and equations | 1 | 4 | 1 | 6 |
| `ele-math-g6` | Statistics | 0 | 3 | 0 | 3 |
| `ele-ela-g6` | Word analysis and decoding | 1 | 1 | 1 | 3 |
| `ele-ela-g6` | Reading accuracy (read-aloud) | 0 | 1 | 0 | 1 |
| `ele-ela-g6` | Vocabulary in context | 2 | 4 | 0 | 6 |
| `ele-ela-g6` | Literal comprehension | 2 | 1 | 0 | 3 |
| `ele-ela-g6` | Inference | 0 | 4 | 1 | 5 |
| `ele-ela-g6` | Main idea and evidence | 0 | 4 | 1 | 5 |
| `ele-ela-g6` | Grammar and conventions | 2 | 3 | 2 | 7 |
| `ele-ela-g6` | Writing | 0 | 2 | 0 | 2 |

Every declared domain carries at least one item, every tier of every instrument
carries at least four **auto** items (so both the 0.85 foundation edge and the
0.70 stretch edge are reachable without any rubric being graded first), and
rubric weight never exceeds 25% of an instrument — all asserted by tests.

---

## Academy availability — the honest limitation

The Manuel Academy publishes content for **levels 5, 7 and 8 only**
(`AcademyGrade` in `src/types.ts`). Most of what these instruments can recommend
therefore has **no Academy equivalent** and must be delivered through curriculum
the parent selects.

The placement module derives this rather than asserting it per grade, and a test
asserts the module's level list agrees with the app's own `academyGradeOf()` for
every `Grade` value.

| Nominal grade | Outcome | Level named | Academy publishes it? |
| --- | --- | --- | --- |
| 3 | one level below | 2 | **No** |
| 3 | prerequisite intervention | 3 | **No** |
| 3 | nominal with review | 3 | **No** |
| 3 | ready for advanced material | 4 | **No** |
| 4 | one level below | 3 | **No** |
| 4 | prerequisite intervention | 4 | **No** |
| 4 | nominal with review | 4 | **No** |
| 4 | ready for advanced material | 5 | Yes |
| 6 | one level below | 5 | Yes |
| 6 | prerequisite intervention | 6 | **No** |
| 6 | nominal with review | 6 | **No** |
| 6 | ready for advanced material | 7 | Yes |
| any | insufficient evidence | — | n/a |

Read plainly: **for a Grade 3 learner, no placement this instrument can produce
maps onto Academy content at all.** For Grade 4 only "ready for advanced
material" does. For Grade 6, "one level below" and "ready for advanced material"
do, and the nominal grade itself does not.

The instrument says so in the parent summary rather than rounding a
recommendation to the nearest published level. A test asserts Grade 3 is never
told an Academy level is available, and that where a level *is* available the
note still states that assigning it is a parent's decision.

---

## The parent-readable summary

`buildPlacementSummary(result)` renders markdown containing:

1. the recommendation and the rule id that produced it
2. an explicit "what this is and is not" section
3. the reasons confidence is low, when it is
4. score by readiness band (earned / possible / skipped / pending)
5. skill domains with their band reading
6. suggested teaching priorities, weakest first
7. the Academy availability statement for this exact recommendation
8. the list of items still awaiting a human reader
9. a parent-override section

**The summary is identity-free by construction.** It names no child, carries no
profile id, and `PlacementResult` has no `profileId` or `studentName` field —
`Attempt.profileId` is read for nothing and copied nowhere. Tests assert that a
deliberately-planted profile id appears in neither the serialised result nor the
rendered summary, for all six instruments. The artifact can be handed to a
reviewer or filed as-is.

---

## What a human still has to do

This build produces recommendations. A person is required for all of the
following, and none of it is automated:

1. **Grade every rubric item.** Until then those items are pending, confidence
   is low, and enough of them can trip the insufficient-evidence gate.
2. **Administer the read-aloud** and score it. The app cannot hear the child.
3. **Read the pending item list.** Anything the normalizer could not confidently
   judge is waiting there and was not counted against the child.
4. **Decide the placement.** The recommendation is input to that decision, not
   the decision.
5. **Apply any level change by hand.** Nothing in this bank writes
   `Profile.workingLevels`, and nothing in it should be wired to.
6. **Re-check after a few weeks of real work.** Evidence from actual lessons is
   worth more than this instrument, and where the two disagree, the lessons win.
