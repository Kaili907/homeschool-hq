# Transcript Model — external coursework

How an external world-language course appears on a Manuel Academy transcript, and what
the transcript is not allowed to say about it.

## 1. The governing principle

**A Manuel Academy transcript may carry an external course. It may not carry it silently.**

Every authored Manuel Academy course on the transcript is one Manuel Academy designed,
taught, and assessed. An external course is none of those. The transcript must therefore
distinguish them, and the distinction must survive every derived surface — an attribution
that only exists in a JSON field and never reaches the printed page is not attribution.

## 2. Placement

External coursework goes in **its own transcript section**, not interleaved with authored
courses:

```
MANUEL ACADEMY COURSEWORK
  Grade 9   English 9: Foundations of Literary Analysis and Argument   1.0   A
  ...

EXTERNAL COURSEWORK — verified by Manuel Academy, taught by the provider named
  Grade 9   Japanese I, sem 1   <provider legal name>   0.5   <provider grade>
  Grade 9   Japanese I, sem 2   <provider legal name>   0.5   <provider grade>
  Grade 10  Japanese II, sem 1  <provider legal name>   0.5   <provider grade>
  Grade 10  Japanese II, sem 2  <provider legal name>   0.5   <provider grade>
                                        World Language: Japanese  2.0 credits

PROFICIENCY (external instrument)
  <framework> <level>   assessed <date>   <issuing organisation>
```

The provider's legal name is a **column, not a footnote**. A reader scanning the credit
column must be able to see who taught the course without reading further.

## 3. What each transcript line derives from

| Transcript element | Source field | Gate |
| --- | --- | --- |
| Course title | `course.title` | must be the title the provider prints, not a Manuel Academy paraphrase |
| Source | `provider.legal_name` | R3 — required at `enrolled` and beyond |
| Grade placement | `placement.grade` | — |
| Term | `term.semester_label`, `term.school_year` | — |
| Credit | `credit.awarded` | **R4** — a parent-verified `provider-transcript` or `report-card` (a receipt does not count), plus a final grade with a source; **R11 / P7** cap it at what was requested |
| Letter grade | `final_grade.reported` + `.scale` | the scale prints alongside the grade; an unlabelled "B" from an unknown scale is not information |
| Proficiency | `proficiency.*` | **R5** artifact required; **R12** (record) and **P4** (pathway) additionally require 2.0 awarded credits for Novice High or above; **R15 / P8** stop the same claim being made in free text |
| Attribution line | `authorship.statement` | R1 — may never claim Manuel Academy authorship |

Anything with a null source field does not print. A blank is honest; a plausible-looking
default is not.

## 4. The three claims the transcript must never make

1. **That Manuel Academy taught it.** Rule R1 guards `authorship.statement` — the line that
   actually prints — in both word orders, and `authorship.authored_by` is a const. R1 is a
   phrase matcher, not a comprehension engine: it is the last automated defence, not the only
   one that should exist. Read the attribution line before publishing a transcript.
2. **That credit was earned before the provider said so.** Rule R4. `credit.requested` is
   a plan and never prints; only `credit.awarded` reaches the transcript.
3. **That a proficiency level was reached without an instrument measuring it.** Rules R5, R12,
   P4 — and R15 / P8, which close the free-text route that reasons from contact hours to a band. This is the substitution trap from `decision-record.md` §4a: ~90 hours of a
   Category IV language reaches Novice Low–Mid, and no arrangement of credits changes
   that. **Do not label a substituted or short pathway "Novice High."**

## 5. GPA treatment — open

`transcript.gpa_treatment` is `undecided` in the planned pathway, and the schema keeps
three options rather than picking one:

| Option | Argument |
| --- | --- |
| `excluded` | The provider's grading standard is not Manuel Academy's; mixing them makes the GPA mean less than it appears to. |
| `included-on-provider-grade` | A course the student genuinely took, graded by an independent party, is arguably the *most* defensible GPA input on the transcript. |
| `undecided` | Current state. Prints the grade, excludes it from the computed GPA, and says so. |

**This is a Director decision, not a contract decision.** It is recorded here so that
whichever is chosen is chosen deliberately — and the honest default while it is open is to
show the grade and state that the GPA excludes it.

## 6. Dual enrolment

A dual-enrolment record carries `credit.basis: dual-enrollment-semester-hours` and
`provider.kind: dual-enrollment`. Two consequences:

- The **college transcript is the primary document**, and the Manuel Academy transcript
  line is a secondary reference to it. `evidence.transcript[].location` must point at the
  issuing institution's record, not at a family copy.
- `credit.provider_credit_value` carries the college's own figure (e.g. semester hours)
  **verbatim**, and the Manuel Academy high-school credit conversion is recorded in
  `credit.awarded` separately. Converting silently, and printing only the converted
  number, loses the fact that a college said something specific.

## 7. Withdrawal

`withdrawn` and `not-completed` award no credit and print nothing in the credit column —
but the pathway still shows the sequence gap, because `target.semesters` and rule P2 mean
a missing semester cannot be papered over by renumbering the remaining records.
