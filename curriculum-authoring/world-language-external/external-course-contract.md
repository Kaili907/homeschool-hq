# External World Language Course Contract

**Lane:** `mac/world-language-external-r2`
**Input:** `mac/world-language-decision-r1`, accepted as this lane's premise (Option 2 — source
externally). **Note:** `decision-record.md` §Status still reads `OPEN. Awaiting Director` in
tree, and §5 lists build/buy/accept as open. The acceptance reached this lane out of band. This
contract is written against Option 2 as a working premise; it closes nothing, so if the
Director chooses otherwise the artifacts here become unused rather than wrong.
**Owns:** `curriculum-authoring/world-language-external/**` only.

## 1. What this contract is

A **provider-agnostic record format for a world-language course Manuel Academy did not
author.** It tracks enrolment, evidence, completion, grade, and — where one exists — an
external proficiency artifact, so a genuine external course can appear on a Manuel
Academy transcript with its true source attached.

**What it is not:**

- Not a course. No Japanese lessons, units, or assessments are authored here, and none
  should ever be added under this path.
- Not a provider recommendation. `provider_selection.endorsed_provider` is
  structurally `null` and the validator enforces it (rule P6). Choosing and paying a
  provider is the Director's decision, made against the criteria in
  [`japanese-two-year-pathway.md`](japanese-two-year-pathway.md) §4.
- Not a claim that the MMC binds this family. `mac/world-language-decision-r1` found
  MCL 380.1278a(2) binds school boards and MCL 380.1561(3)(f) omits world language from
  the nine subjects Michigan requires of a homeschool. Every record carries
  `mmc_claim: "none"`.
- Not a graduation-completeness advance. `NOT_GRADUATION_COMPLETE` is unchanged.

## 2. The two documents

| Document | Schema | Unit |
| --- | --- | --- |
| **Course record** | [`schema/external-course.schema.json`](schema/external-course.schema.json) | one term of one course |
| **Pathway** | [`schema/external-pathway.schema.json`](schema/external-pathway.schema.json) | an ordered sequence of records in one language |

The pathway exists because the constraint that actually binds — U-M (LSA) requires two
years of the **same** language for admission, MSU names two in its college-prep
curriculum — is a property of the sequence, not of any one semester. A validator that
only ever saw single records could not catch a student who took a year of Japanese and a
year of Spanish.

## 3. Field map

Every item the lane was chartered to support, and where it lives.

| Required capability | Field |
| --- | --- |
| world-language subject family | `subject_family` (const `world-language`) |
| language name / code | `language.name`, `language.iso_639_1`, `language.iso_639_3` |
| provider | `provider.legal_name`, `provider.kind`, `provider.selection_status`, `provider.accreditation` |
| course title | `course.title`, `course.provider_course_code`, `course.level_label` |
| semester | `term.semester_label`, `term.sequence_position`, `term.term`, `term.school_year` |
| credit | `credit.requested`, `credit.awarded`, `credit.basis`, `credit.provider_credit_value` |
| grade placement | `placement.grade` (9–12) |
| start / end | `term.start_date`, `term.end_date` |
| syllabus / source evidence | `evidence.syllabus[]` |
| assignment / completion tracking | `tracking.*`, `evidence.assignments[]` |
| final grade | `final_grade.reported`, `final_grade.scale`, `final_grade.source` |
| transcript evidence | `evidence.transcript[]` |
| proficiency artifact where available | `proficiency.*`, `evidence.proficiency_artifact[]` |
| parent verification | `parent_verification.*`, and `verified_by_parent` on every evidence item |
| external-provider URL / reference metadata | `provider.reference.url`, `.catalog_id`, `.retrieved_on`, `.contact` |

Two fields exist that were not asked for, because the contract is dishonest without them:
`authorship` (who taught and assessed the course) and `mmc_claim` / `graduation_claim`
(what the record does **not** assert).

### Identifiers

```
record   wl-ext-<lang>-s<NN>        e.g. wl-ext-ja-s01
pathway  wl-ext-path-<slug>         e.g. wl-ext-path-japanese-2yr
```

Deliberately **not** the `ma-g<grade>-<subject>` grammar used by authored Manuel Academy
courses (`release/authoring-boundaries.md` §4). An external record must never be
mistakable for authored content in a log, a filename, or a transcript line.

## 4. The rules JSON Schema cannot express

Twenty-five rules, enforced by [`validate-external-course.mjs`](validate-external-course.mjs).
Every rule has a negative fixture in `--self-test` (36 fixtures — several rules have more than
one failure mode) — a rule with no fixture is a rule nobody has proven. P6 is the one whose
fixture is caught a layer earlier by the schema's `const: null`; the rule stays as a second
line of defence should the schema ever be relaxed.

Structure and rule findings are reported **together**. Returning early on a schema slip would
let an author fix a typo, re-run, and only then meet the honesty findings.

| Code | Rule |
| --- | --- |
| **R1** | `authorship.statement` may not claim Manuel Academy authored, taught, or assessed the course. `authorship.authored_by` is a const. |
| **R2** | An unfilled `<PLACEHOLDER>` may not survive past `status: template`. A half-filled record cannot quietly become a transcript line. |
| **R3** | `status` of `enrolled` / `in-progress` / `completed` requires a **named, selected** provider. |
| **R4** | `credit.awarded` requires `status: completed`, a reported final grade with a source, **parent-verified transcript evidence**, and a parent verification date. Credit follows evidence, never intent. |
| **R5** | `proficiency.claimed_level` requires a parent-verified `proficiency-score-report`, a named framework, and an assessment date. **Proficiency is measured, never inferred from hours.** |
| **R6** | The internal elementary Japanese material may not appear as evidence. It is declared grades 3–4, has zero authored lessons, and is not high-school credit. **Mechanism and its limit:** the two known paths (`Japanese-Year-1-Curriculum.md`, `src/curriculum/plans/japanese-year-1*`), any `ma-g3-`/`ma-g4-` id, and the phrasings that document travels under ("Japanese Year 1", "Year One curriculum"). It is a denylist plus a phrase heuristic, **not semantic** — a determined paraphrase can evade it, and reviewers should not treat a clean R6 as proof of provenance. |
| **R7** | No record may carry graduation-completeness language. |
| **R8** | `term.start_date ≤ term.end_date`; `status: completed` requires an end date. |
| **R9** | `assignments_completed ≤ assignments_reported`. |
| **R10** | Evidence marked `verified_by_parent` must carry `obtained_on`. |
| **R11** | `credit.awarded ≤ credit.requested`. `awarded` is the only credit that prints, so it is the number that must not be free. |
| **R12** | A `claimed_level` at or above Novice High is assessable only inside a pathway showing 2.0 awarded credits. A record validated on its own is not a way around P4. |
| **R13** | `enrolled` and beyond requires syllabus or course-catalog evidence. |
| **R14** | `in-progress` / `completed` requires `tracking.completion_source`. |
| **R15** | A proficiency band may not be asserted in free text. Prose reasoning from contact hours to a band reaches the same false claim by a side door. |
| **R16** | No record may claim the MMC is satisfied — in either word order. |
| **P1** | Every record in a pathway is the **same language**. |
| **P2** | `sequence_position` is 1..n exactly once, and the record count matches `target.semesters`. |
| **P3** | Requested credit sums to `target.credits`. |
| **P4** | A transcript proficiency claim requires an artifact, **and** a claim at or above Novice High requires 2.0 awarded credits. This is `decision-record.md` §4a — the substitution trap — made mechanical. |
| **P5** | Warning, not error: a target below 2.0 credits misses the U-M/MSU floor. |
| **P6** | `provider_selection.endorsed_provider` stays `null`. No lane endorses a paid provider in code. |
| **P7** | Awarded credit across the pathway may not exceed `target.credits`. Without it, R11 alone still lets four half-credit terms award 2.0 each. |
| **P8** | R15 one level up. Only `target.proficiency_target*` and the gated `transcript.proficiency_claim` may name a band. |
| **P9** | R16 one level up. `mmc_note` is the field most likely to drift. |

### Running it

```bash
node curriculum-authoring/world-language-external/validate-external-course.mjs
```

Plain node, no dependencies, no `node_modules` required — a contract that can only be
checked after an install is a contract nobody checks. Exits non-zero on `BLOCKED`.

## 5. Record lifecycle

```
template → planned → enrolled → in-progress → completed
                          ↘ withdrawn / not-completed
```

| Transition | What must become true |
| --- | --- |
| `template → planned` | placeholders filled or nulled; grade placement and requested credit set |
| `planned → enrolled` | provider named and selected (R3); syllabus or catalog evidence captured (R13) |
| `enrolled → in-progress` | `tracking.completion_source` names where progress is read from (R14) |
| `in-progress → completed` | end date, final grade with a source, parent-verified transcript evidence — only then may `credit.awarded` be set (R4) |

The **order** of transitions is convention, not enforcement: the validator is stateless and
sees one document, so `template → completed` in a single edit is caught only by the gates that
apply at `completed` (R4, R8, R13, R14), not by the skip itself.

`withdrawn` and `not-completed` are terminal and award no credit. They are in the enum
because a pathway that quietly drops a semester is exactly the failure the transcript
model is meant to make visible.

## 6. Standing

This is a records contract. It makes no legal claim, decides no provider, and moves no
credit. Its whole purpose is that when a genuine external course *is* taken, what appears
on the transcript is true — including the fact that Manuel Academy did not teach it.
