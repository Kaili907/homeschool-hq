# Minimum Build — What Closing the Gap Actually Costs

**Status:** specification only. **Nothing in this document has been authored.**
No lesson, unit, or assessment exists for any course named here. Counts are
build estimates, not deliveries.

This document answers one question: *if the Director elects to build rather than
buy, what is the smallest honest build?*

## 1. The target is set by the remainder, not by the requirement

From `credit-coverage-map.md` §E, unchanged by this lane:

| Step | Credits remaining |
| --- | ---: |
| MCL 380.1278a(2) requirement | 2.0 |
| − 1.0 substitutable (additional VPAA already allocated, or approved formal CTE) | 1.0 |
| − 0.5 **iff** the Director directs the personal-finance half-credit here | 0.5 |
| **Irreducible remainder** | **0.5** |

**The minimum *credit* build is therefore 0.5 credit, not 2.0.**

⚠️ **For Japanese the credit minimum and the proficiency minimum are not the same
number.** `standards-and-proficiency-gap.md` §7 establishes that 0.5 credit of Japanese
(~90 hours) reaches roughly Novice Low–Mid, while Michigan's stated target is **Novice
High** — which Japanese reaches at about **2 credits / ~360 hours**. A maximally
substituted Japanese pathway is **credit-compliant and proficiency-non-compliant**.

An earlier draft of this document assumed a 0.5-credit course could be built to Novice
High. **That assumption is withdrawn.** Build A below is retained because it is the
correct answer to the credit question, but it must not be labelled Novice High.

Two cautions carried forward:

- The 1.0 arts substitution is **already funded** — the matrix deliberately holds
  Grades 11–12 arts (0.5 + 0.5) as instruction *additional* to the VPAA credit.
  It costs no new authoring. It does require the Director to elect it.
- The personal-finance half-credit **can be spent in exactly one place.** Directing
  it at world language is the only election that reduces a real gap; the other two
  discount requirements the programme already exceeds.

## 2. Three builds, priced

| | Scope | Courses | Units | Lessons | Assessments | Closes gap? |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| **A** | 0.5 cr — Japanese IA | 1 | 6 | 36 | 6 | Yes, **with** both substitutions elected |
| **B** | 1.0 cr — Japanese I | 1 | 9 | 108 | 9 | Yes, with the arts substitution only |
| **C** | 2.0 cr — Japanese I + II | 2 | 18 | 216 | 18 | Yes, no substitution needed |

| | Japanese proficiency reached | Novice High? | U-M / MSU 2-yr floor? |
| --- | --- | --- | --- |
| **A** | ~90 hrs → Novice Low–Mid | ❌ | ❌ |
| **B** | ~180 hrs → Novice Mid | ❌ | ❌ |
| **C** | ~360 hrs → **Novice High** | ✅ | ✅ |

**Only Build C hits every target.** Build A clears the credit arithmetic alone; Build B
clears it without depending on the personal-finance election; neither reaches Novice
High in a logographic language, and neither produces the two years of language that
U-M (LSA) requires for admission and MSU names in its college-prep curriculum.

**No MMC substitution touches the college requirement.** Arts, CTE, and personal finance
reduce the *state* requirement; they put no language on a transcript. 🟦 The binding
constraint here is the **college transcript, not the statute** — because the statute
does not bind this family at all (`standards-and-proficiency-gap.md` §2).

## 3. Shape — Build A, normalized to this repository

A 0.5-credit course in this repo is a settled shape: 6 units × 6 lessons + 6 unit
assessments. `ma-g9-technology` and `ma-g9-health` are both built this way. A
world-language course would match it.

| Artifact | Path (proposed) | Precedent |
| --- | --- | --- |
| `course-guide.md` | `world-language/grade-9/` | `technology/grade-9/course-guide.md` |
| `units.json` | `world-language/grade-9/` | 6 objects, `unit_id`…`assessment_id` |
| `lessons.jsonl` | `world-language/grade-9/` | 36 lines |
| `assessments.json` | `world-language/grade-9/` | 6 objects |
| `lesson-sequence.md` | `world-language/grade-9/` | derived index |
| `standards-coverage.md` | `world-language/` | MDE standards map |
| `source-docs/` | `world-language/` | standards custody + `validate.mjs` |

Identifiers would follow the governing grammar — `ma-g9-world-language`,
`ma-g9-world-language-u01`, `ma-g9-world-language-u01-l01` — which
`validate-high-school.mjs` checks independently.

### Proposed unit spine — Build A

Six units, sequenced so that **every unit produces speech from its first week**.
Titles and scope only; no lesson content is authored.

| Unit | Title | Days | Communicative outcome |
| ---: | --- | ---: | --- |
| 1 | Sound System and the Kana Contract | 6 | Produce and discriminate all mora; read/write hiragana with correct stroke order |
| 2 | Self, Family, and Origin | 6 | Sustain a `jikoshōkai` and answer follow-up questions |
| 3 | Daily Life, Time, and Routine | 6 | State and ask about schedule, time, and habitual action |
| 4 | Preference, Ability, and Opinion | 6 | Express likes, dislikes, ability, and a reason |
| 5 | Transaction and Navigation | 6 | Complete a purchase or direction-asking exchange |
| 6 | Culture, Register, and Interpretive Capstone | 6 | Read authentic short text; choose register appropriately; defend the choice |

Register (`です/ます` vs plain form) is deliberately a named outcome. It is the
axis on which a course built up from an elementary vocabulary plan most often
fails to reach high-school level, because elementary material rarely marks it.

## 4. The seat-time problem — the part that is easy to underestimate

A 0.5 credit is conventionally ~55–90 instructional hours — **a convention, not a
Michigan requirement.** MDE publishes no hours-per-credit figure and awards credit on
demonstrated proficiency rather than seat time. **The existing plan supplies ~40 hours
per year at ~12 minutes per day.** Two consequences:

1. Even at equal hours, the elementary cadence is the wrong instrument. Twelve
   minutes a day cannot carry an interpretive reading task or a sustained
   interpersonal exchange, which are the assessed modes at high-school level.
2. Japanese is an **FSI Category IV language** (2,200 hours to ILR 3, against 690 for
   Spanish and French) — the same nominal credit buys materially less proficiency. The
   ~3.2× ratio must **not** be applied directly to a high-school course: it is
   calibrated to full immersion at ILR 3, and most of the excess is the writing system
   rather than early communicative competence. The Novice-band gap is smaller — but
   real, running about one course level in speaking and nearer two in reading/writing.

Proficiency targets and the hour estimates behind them are recorded in
`standards-and-proficiency-gap.md`. **If those hours do not fit the schedule, that
is an argument for buying the course, not for shortening it.**

### The proficiency route is a genuine lever

Michigan credit is proficiency-based, and **test-out is statutory** — MCL 380.1279b
grants credit on a grade of not less than **C+** on a final exam or on the course's
basic assessment ("a portfolio, performance, paper, project, or presentation"),
recorded as pass and excluded from GPA. MDE separately permits demonstrating one-year
or two-year equivalent world-language proficiency on an approved assessment; two-year
equivalent completes the requirement outright.

**This is the most under-used lever available.** It also relocates the cost: a
proficiency-based credit still needs an instrument capable of certifying it, which the
programme does not own. For Japanese the instruments that also travel to a college
transcript are **JLPT (N5/N4), ACTFL AAPPL or OPI, STAMP, and AP Japanese Language and
Culture** — external, purchasable, and worth more on a homeschool transcript than a
self-issued credit line.

## 5. What must be true before authoring starts

Ordered. Each is a hard blocker on the next.

1. **Director elects to build rather than buy.** §2 of `decision-record.md`.
2. **The eleventh subject family is approved.** `ACADEMY_SUBJECTS` in
   `src/types.ts:47` is a closed ten-element tuple; `authoring-boundaries.md` §5
   lists it as changing "only if a World Language family is approved," and the
   full grade/id-pattern extension list travels with it. **No session in the
   9–12 wave owns this file.** Until it changes there is nowhere for the content
   to live.
3. **Standards custody is obtained.** The MDE *World Languages: Standards and
   Benchmarks* document must be held, with codes copied verbatim per
   `authoring-boundaries.md` §7. The `1.1.N.SL.a` grammar and its N/M/A tiers are
   confirmed; **no newer "MWLS" framework could be found** — see
   `standards-and-proficiency-gap.md` §4 and §9.
4. **An assessment instrument for proficiency is chosen.** A course that claims
   Novice High must be able to demonstrate it.
5. **Instructor capacity is confirmed.** The elementary plan's "you're the coach"
   model does not transfer: it explicitly assumes the instructor does not speak
   Japanese. At Novice High the learner needs a competent interlocutor and
   feedback on register — a real constraint, not a scheduling one.

## 6. What this lane recommends NOT be built

- **Do not extend the Grades 3–4 plan upward.** It is correctly built for ages
  8–9. Re-levelling it is a rewrite wearing the costume of an edit, and it would
  damage a working elementary lane to do it.
- **Do not fabricate 36–216 lessons to clear the checkbox.** A course that claims
  Novice High without an instrument to demonstrate it is a false claim on a
  transcript, and it is the specific failure this lane was chartered to avoid.
- **Do not label a 0.5- or 1.0-credit Japanese course "Novice High."** The proficiency
  research does not support it. Label what the course actually reaches.
- **Do not point a technology course at this requirement.** Computer science and coding
  are **not** permitted substitutes under current law; the bill that would allow it
  (HB 4156 of 2025) is stalled in Senate committee and is not law.
- **Do not re-tag existing courses as world language.** `credit-coverage-map.md`
  §E rules this out, and the arts substitution already occupies the only
  legitimate re-use.
- **Do not ship the hiragana trainer as evidence of a course.** It is an
  elementary support tool and does not exist yet.
