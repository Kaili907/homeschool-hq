# Decision Record — World Language, Grades 8–12

**Status:** OPEN. Awaiting Director.
**Owner:** Director. This lane cannot make this decision and does not.
**Prepared by:** `mac/world-language-decision-r1`, 2026-08-12

## 0. The three layers, kept separate

This lane was chartered to keep these apart, and every claim below is tagged to one.

| Layer | What it means | Who decides |
| --- | --- | --- |
| 🟥 **STATE REQUIREMENT** | What Michigan law says, for the students it binds | Legislature / MDE |
| 🟨 **PERMITTED SUBSTITUTION** | Doors the statute itself opens | Statute, elected by the board/Director |
| 🟦 **MANUEL ACADEMY DECISION** | A design choice this programme makes | Director |

Mixing these is the failure mode this lane exists to prevent. A programme decision
dressed as a legal requirement cannot be revisited; a legal requirement dressed as a
preference gets dropped.

## 1. The finding

🟦 **Existing Japanese content cannot responsibly become the Grades 8–12 World
Language lane.** The corpus is two renderings of one document: ~11.7 KB, 8 week
anchors of 36, zero lessons, zero units, zero assessments, zero standards
citations, ~40 contact hours, declared `grades: 3,4` and written for 8–9 year olds.
The running product excludes it from Grade 10, with a test asserting that exclusion. Full detail: `existing-japanese-inventory.md`.

The existing content's own closing section already says a high-schooler "needs a
genuine high-school-level course (online provider or community college dual
enrollment)." **This lane confirms the design intent already recorded in the
source; it does not overturn it.**

## 2. The decision required

The Director must choose one and record it. These are the same three options
`credit-coverage-map.md` §E identified; this lane has priced them.

### Option 1 — Build a World Language family in-house

🟦 Manuel Academy decision.

Creates an eleventh subject family. Minimum honest build is **0.5 credit / 6 units
/ 36 lessons / 6 assessments** (`minimum-build.md` Build A), and only if both
substitutions are elected.

- **Requires a runtime contract change.** `ACADEMY_SUBJECTS` (`src/types.ts:47`)
  is a closed ten-element tuple, and `authoring-boundaries.md` §5 lists it as
  changing "only if a World Language family is approved." **No session in the
  9–12 wave owns that file.**
- Requires standards custody, a proficiency instrument, and an instructor who can
  give feedback on register — the elementary plan explicitly assumes an instructor
  who does not speak Japanese.
- Cost is real: 36–216 lessons plus five normalized artifacts per course.

### Option 2 — Source externally, carry on the transcript ✅ recommended

🟦 Manuel Academy decision.

Online provider or community-college dual enrolment. **This is what the family's own
Japanese document already anticipated.**

**Buy 2 credits, not 0.5.** The standards review establishes that ~360 hours of Japanese
reaches **Novice High** — Michigan's stated target — while the fully-substituted 0.5-credit
route reaches only Novice Low–Mid. Two credits is also exactly the U-M/MSU floor. Buying
less than 2 saves money and satisfies neither target.

- No runtime change. No eleventh family. No authoring.
- Dual enrolment yields a transcripted college course — the strongest evidence
  available for both the MMC and a college transcript, and it satisfies the
  "2 years of the same language" college norm that no MMC substitution touches.
- Solves the instructor-capacity and proficiency-instrument problems by purchase
  rather than by build.
- Cost is money and schedule, not authoring.
- Continuity argument for Japanese specifically: it is already the house language.

**Recommended.** It is the only option that closes the gap without either a runtime
contract change or a false proficiency claim, it is the option the source content itself
points to, and — uniquely — it satisfies the college requirement that survives Option 3.

### Option 3 — Accept the gap explicitly

🟦 Manuel Academy decision, resting on 🟥 a legal question this lane does not answer.

The documentary evidence is now clear and one-directional (`standards-and-proficiency-gap.md` §2):

- MCL 380.1278a(2) binds "the **board** of a school district or board of directors of a
  public school academy" — it governs issuance of a *public* diploma, not a family.
- MDE's *Nonpublic and Home School Information 2025–2026* states that home-school students
  "**are not required to meet the MMC credit requirements**," and that "the state does not
  require specific content in the basic courses."
- MCL 380.1561(3)(f) lists the nine subjects Michigan actually requires of a homeschool —
  reading, spelling, mathematics, science, history, civics, literature, writing, English
  grammar. **World language is not among them.**

**There is no state world-language requirement binding this family to close.**

- Legitimate, and on this evidence probably correct **as to the state**. It is **not** a
  null option: U-M (LSA) requires 2 years of the same language *for admission* and MSU
  names 2 years in its college-prep curriculum. Those apply regardless of what Michigan
  requires of homeschools, and **no MMC substitution touches them.**
- Must be recorded explicitly. `credit-coverage-map.md` §E is emphatic that this
  contract "may not make [it] silently."

**Options 2 and 3 are not exclusive.** Accepting that the MMC does not bind, while
still buying two years of Japanese for the transcript, is coherent — and is
probably the strongest position available.

## 3. What is already paid for

🟨 Permitted substitution, already funded by prior design.

The matrix allocates 2.0 arts credits across Grades 9–12. The first 1.0 carries
VPAA; **the second 1.0 is additional arts instruction and is available now as the
one substitutable world-language credit** under MCL 380.1278a(2). The four-year
arts sequence exists for this reason.

This costs no new authoring. It requires the Director to **elect** it — an
unelected substitution closes nothing.

## 4. The coupled decision

🟨 Permitted substitution. Flagged because it is easy to spend wrongly.

The personal-finance half-credit displaces 0.5 of mathematics, VPAA, **or** world
language — the total stays 18 either way. The programme already exceeds
mathematics (4.0) and VPAA (1.0), so those elections **buy nothing**. Directing it
at world language is the only election that reduces a real gap, taking the
remainder from 1.0 to 0.5.

**It can be spent in exactly one place.** Decide it together with §2, not separately.

## 4a. The substitution trap — read before electing §3 and §4

🟦 Manuel Academy decision, informed by 🟥 the proficiency target.

Michigan states the requirement as "two credits **based on students meeting a 'Novice
High' proficiency level**." The substitutions reduce the *credits*. They do not reduce
the *proficiency*.

| Route | Actual Japanese study | Proficiency reached | Novice High? |
| --- | ---: | --- | --- |
| Both substitutions elected | 0.5 cr (~90 hrs) | Novice Low–Mid | ❌ |
| Arts substitution only | 1.0 cr (~180 hrs) | Novice Mid | ❌ |
| No substitution | 2.0 cr (~360 hrs) | **Novice High** | ✅ |

**Fully substituting is credit-compliant and proficiency-non-compliant** for a logographic
language. The substitutions are still worth electing — they cost nothing and they are the
statute's own doors — but they must not be mistaken for reaching the target. **Do not label
a substituted pathway "Novice High" on a transcript.**

🟨 **Computer science is not a door.** Coding is not a permitted substitute under current
law. HB 4156 of 2025 would add it; it passed the House, was referred to Senate Education
on 2025-04-22, and has no recorded action since. It is not law. The programme's four
technology courses cannot be pointed here.

## 5. Recorded, not decided

| Item | Layer | Status |
| --- | --- | --- |
| Whether the MMC binds this homeschool at all | 🟥 | **Documentary evidence says no** (MDE manual + §1561(3)(f)). Whether to *rely* on it is the Director's call with counsel — this lane gives no legal opinion |
| Whether to buy 2 credits for the college floor | 🟦 | **Open — survives even if Option 3 is taken** |
| Which credit personal finance displaces | 🟨 | Open — Director, coupled to §2 |
| Whether to elect the additional-arts substitution | 🟨 | Open — Director, costs nothing to elect |
| Build / buy / accept | 🟦 | **Open — this decision** |
| Whether Japanese remains the house language | 🟦 | Settled in practice; unaffected by this decision |

## 6. Graduation completeness

**Unchanged: `NOT_GRADUATION_COMPLETE`.**

This lane closes no credit and claims none. `MMC_WORLD_LANGUAGE` remains
`NOT_COVERED` with a 0.5-credit irreducible remainder. Nothing here should be read
as advancing the programme toward graduation completeness — it converts an
undocumented gap into a priced decision, which is a different thing.
