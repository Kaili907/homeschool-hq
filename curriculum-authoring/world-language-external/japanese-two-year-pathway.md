# Recommended Pathway — Japanese, 4 semesters / 2.0 credits

**Machine-readable form:** [`examples/japanese-2yr-pathway.planned.json`](examples/japanese-2yr-pathway.planned.json)
(`status: planned`, provider unselected — it validates today and awaits a Director choice).

## 1. Why two credits and not the irreducible 0.5

`credit-coverage-map.md` §E computes an irreducible remainder of **0.5 credit** after both
permitted substitutions. That figure answers a question this family may not be asked.

| Constraint | Applies here? | Figure |
| --- | --- | --- |
| MMC world language, after substitutions | 🟥 Binds school boards, not this homeschool (`decision-record.md` §2 Option 3) | 0.5 cr |
| U-M (LSA) admission | ✅ Applies regardless of Michigan homeschool law | **2 years, same language** |
| MSU college-prep curriculum | ✅ Applies | **2 years** |
| Michigan's stated proficiency target | Design target adopted by Manuel Academy | **Novice High** (≈ ~360 hrs — extrapolated, see §2) |

**Buying 0.5 credit satisfies a requirement that does not bind, and misses both that do.**
Two credits is the only figure that clears the college floor and lands on Novice High.
This is `decision-record.md` §2 Option 2 verbatim: *buy 2 credits, not 0.5*.

## 2. The four semesters

| Seq | Record | Grade | Term | Credit | Cumulative | Expected band |
| ---: | --- | ---: | --- | ---: | ---: | --- |
| 1 | `wl-ext-ja-s01` | 9 | fall | 0.5 | 0.5 | Novice Low–Mid † |
| 2 | `wl-ext-ja-s02` | 9 | spring | 0.5 | 1.0 | Novice Mid ‡ |
| 3 | `wl-ext-ja-s03` | 10 | fall | 0.5 | 1.5 | between the two † |
| 4 | `wl-ext-ja-s04` | 10 | spring | 0.5 | 2.0 | **Novice High** ‡ |

**Grades 9–10 rather than 11–12, deliberately.** Finishing the sequence by the end of
Grade 10 leaves Grades 11–12 free for a third year if the family wants one, puts the
credits on the transcript before junior-year applications are assembled, and leaves room
to re-sit a proficiency instrument. Nothing in the schema requires this placement —
`placement.grade` accepts 9 through 12 — but a pathway that finishes in Grade 12 has no
recovery room.

The bands are **expectations for planning, not claims.**

- ‡ **Sourced.** `standards-and-proficiency-gap.md` §7 publishes exactly two points: 1 credit
  ≈ Novice Mid, 2 credits ≈ Novice High. `decision-record.md` §4a gives 0.5 cr → Novice Low–Mid.
- † **Interpolated by this lane** between those points. Not in any source, and not an MDE figure.

The hour figures behind them (~180 hrs per credit year) are Carnegie-style extrapolation:
**Michigan publishes no hours-per-credit number** (`standards-and-proficiency-gap.md` §5). The
bands are recorded nowhere in the data, and rules **R5, R12, R15 and P8** together mean no band
reaches a transcript — or even a free-text note — without a score report behind it.

## 3. The proficiency artifact

Sat **separately from the course**, because a provider's own grade is not a proficiency
measure. Candidates that travel on a homeschool transcript
(`standards-and-proficiency-gap.md` §6): **JLPT N5/N4, ACTFL AAPPL or OPI, STAMP,
community-college coursework, or AP Japanese Language and Culture.**

Recommended timing: one sitting after S2 (a baseline, and a cheap early warning if the
provider is not delivering), one after S4 (the artifact that goes on the transcript). The
schema records whichever arrive; none is required for the pathway to validate.

**This is the highest-value line in the whole pathway.** On a homeschool transcript an
externally-scored proficiency result is worth more than a self-issued credit line, because
it is the one number no one has to take the family's word for.

## 4. Choosing a provider — criteria, not a name

This lane names no provider and endorses none. `provider_selection.endorsed_provider` is
structurally `null` (rule P6). The criteria carried in the pathway JSON:

1. **Issues a transcript or report card in its own name**, naming the course and the term.
   Without this, rule R4 can never be satisfied and the credit can never be awarded.
2. **Publishes a syllabus obtainable before enrolment**, so `evidence.syllabus` can be
   filled at `status: enrolled` rather than reconstructed afterwards.
3. **Grades on a stated scale**, with the scale itself documented.
4. **Provides an instructor who gives feedback on produced Japanese.** The elementary plan
   explicitly assumed an instructor who does not speak the language. That capacity gap is
   the main thing being purchased.
5. **States its accreditation status plainly** — including stating that it has none.
6. **For dual enrolment:** confirms transferable college credit appearing on a college
   transcript. `decision-record.md` §2 calls this the strongest evidence available.
7. **Does not require Manuel Academy to represent the coursework as its own.**
8. **Has a stated path to, or compatibility with, an external proficiency artifact.**

Record shortlisted providers in `provider_selection.candidates_considered` (free text,
no endorsement implied) and set `provider_selection.status: selected` when the Director
chooses. Per-record `provider.selection_status` moves `unselected → selected → verified`;
`verified` means the parent has seen a primary document from the provider, not a website.

## 5. What this pathway does not do

- It does not close `MMC_WORLD_LANGUAGE`. `graduation_completeness` stays
  `NOT_GRADUATION_COMPLETE_UNCHANGED`, and `course-matrix.json` `declared_coverage_gaps`
  is untouched by this lane.
- It does not spend the substitutions. The additional-arts credit and the personal-finance
  half-credit remain the Director's to elect, and `decision-record.md` §3–4 is the place
  that decision is recorded. Electing them costs nothing and changes nothing here.
- It does not commit to Japanese. Re-keying to another language is a
  `language` + `record_id` change and no schema change at all. Japanese is the *intended*
  language because it is already the house language — a continuity argument, not a
  pedagogical ruling.
