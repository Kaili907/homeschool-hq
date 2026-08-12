# Standards Reference — Manuel Academy High School 9–12

**Contract:** `manuel-academy-high-school-9-12-release-contract`
**Verification date:** 2026-08-12
**Jurisdictional focus:** Michigan
**Status:** Locally authored curriculum aligned to published standards. This is not
a claim of state approval, accreditation, licensure, or automatic credit.

## How these sources were verified

Every statute and standards document below was retrieved from
`legislature.mi.gov` or `michigan.gov/mde` and read directly. Blogs, curriculum
vendors, and third-party alignment charts were not used as authority for any
claim.

**Retrieval note, recorded for reproducibility.** `michigan.gov` returned HTTP 403
to the default fetcher and `legislature.mi.gov` returned a TLS error; documents
were retrieved with `curl` using a browser user-agent and PDFs were parsed
locally. The documents are the official ones at the official URLs; only the
transport differed.

**Legacy-URL hazard — read before citing any `michigan.gov/documents/mde/` link.**
At least one legacy MDE document URL returns **HTTP 200 while serving an unrelated
agency document**. A 200 response on that path is *not* evidence the link resolves
to the document you named. Verify the document's own title page before citing it.

## Statutory authority — Michigan Merit Curriculum

| Statute | URL | Version read |
| --- | --- | --- |
| MCL 380.1278a — Requirements for high school diploma | `legislature.mi.gov/documents/mcl/pdf/mcl-380-1278a.pdf` | Rendered 2026-07-30, "Complete Through PA 20 of 2026"; last amended 2022 PA 105, eff. 2023-03-29 |
| MCL 380.1278b — Credit requirements; personal curriculum | `legislature.mi.gov/documents/mcl/pdf/mcl-380-1278b.pdf` | Same rendering |

Supporting MDE publications: the *Michigan Merit Curriculum Overview* (18-credit
summary), the *MMC FAQ — Earning Credit* pages, and
`Personal_Finance_Course_Credit.pdf`.

## Standards documents by subject family

Every subject session must cite from **its own row's document**, copying codes
verbatim. The code formats below were read out of the documents themselves.

| Family | Official document | Version | Code format | Verbatim examples |
| --- | --- | --- | --- | --- |
| Mathematics | Michigan K-12 Standards — Mathematics (CCSS-derived) | Adoption year not printed | `<Category>-<Domain>.<n>` | `N-RN.2`, `A-SSE.3a`, `A-APR.1`, `A-REI.4a` |
| English Language Arts | Michigan K-12 Standards — English Language Arts | Adoption year not printed | Strand + grade + number | `R.CCR.6`, `RI.4.3`, `W.5.1a` — **see the HS caveat below** |
| Science | Michigan K-12 Standards — Science | November 2015, `v. 11/2015` | NGSS performance-expectation codes, used directly | `HS-PS1-1`, `HS-LS1-1`, `HS-PS2-6` |
| Social Studies | Michigan K-12 Standards for Social Studies | `v 6/19` (June 2019) | grade · category · standard · expectation; HS drops the grade prefix | `C – 1.1.1`, `E2` → `2.1.1`, `HS-WHG 7.2.3` |
| Health | Michigan Health Education Standards Guidelines | 2025 (file stamped 12-19-25) | grade span · practice · topic | `12.3.BEPA`, `12.3.SU`, `12.4.HR`, `12.3.CEH` |
| Physical Education | K-12 Physical Education Standards | May 2017 (ADA republish 2019) | `S<standard>.<outcome>.<level>`; HS uses `L1`/`L2`, not a grade number | `S1.1.L1`, `S3.7.L1`, `S4.2.L2` |
| Technology and Computer Science | Michigan K-12 Standards: Computer Science | Adopted May 2019; CSTA 2017-derived | `<Level>-<Concept>-<NN>`; **3A = grades 9–10, 3B = grades 11–12** | `3A-CS-01`, `3A-AP-17`, `3A-IC-28`, `3B-AP-10` |
| Arts and Music | MMC Standards, Benchmarks and GLCE: Visual Arts, Music, Dance, Theatre | `v. 06.2011` | `ART.<discipline>.<strand>.<grade or HS>.<n>` | `ART.D.I.HS.1`, `ART.M.I.HS.1`, `ART.M.II.HS.3` |
| Financial Literacy | Personal Finance Course/Credit Requirements, Appendix A | Post-June-2022 | `PF1`–`PF7`; also `E4` personal finance in Social Studies | `PF1`, `PF4`, `E4` → `4.1.4` |
| Ready for Life | **No coded MDE standards set exists** | — | — | — see the Ready for Life caveat below |
| *(World Language — no family)* | MMC World Languages: Standards and Benchmarks | Date not printed | `<strand>.<standard>.<proficiency>.<domain>.<benchmark>` | `1.1.N.SL.a`, `1.1.M.SL.d`, `1.1.A.SL.c` |

Supplementary: **MITECS** (Michigan Integrated Technology Competencies for
Students, 2017, ISTE-derived, coded `1.a`, `2.b`) is available to the Technology
family alongside the Computer Science standards.

## Caveats that bind the subject sessions

### ELA — do not hard-code `RL.9-10.x`

**UNVERIFIED.** The familiar dotted high-school ELA codes (`RL.9-10.1`,
`W.11-12.2`) were **not found verbatim** in any MDE document. Michigan's ELA
standards render high school as grade-band *columns* — "Grades 9–10 students",
"Grades 11–12 students" — under a strand header, not as printed dotted codes. The
document states the naming rule but illustrates it only with K-8 examples. MDE's
own high-school ELA crosswalk uses a different, band-less shorthand (`W3a`, `W9`).

The ELA session must either cite the strand-and-band form as it actually appears
in the document, or mark constructed dotted codes `UNVERIFIED`. Constructing
`RL.9-10.1` and presenting it as an MDE-verbatim code is a contract violation
under `authoring-boundaries.md` §7.

### Science — Michigan defines no Grade 8 checkpoint

Michigan deliberately abandoned grade-level science standards above Grade 5,
stating that grade-level designations in Grades 6–8 would be "overly inhibiting"
to apply statewide, and recommending assessment-oriented bands (K-2, 3-5, 6-8,
9-12). Grade 8 therefore sits *inside* the `MS-` band with **no state-defined
end-of-Grade-8 mastery point**, and the `HS-` expectations assume the entire 6–8
band.

Consequence for a continuous 8–12 programme: the Grade 8 → 9 science seam has no
state-defined checkpoint to audit against. Manuel Academy must define its own and
say so plainly rather than implying state alignment. This is recorded as a named
discontinuity in `grade8-to-grade9-handoff.md`.

### Ready for Life — no verified standards anchor

**UNVERIFIED.** No MDE document with coded employability standards could be
located. Michigan's *High School CTE Standards and Expectations* (March 2017)
*names* "the Michigan Career and Employability Skills" and "the Michigan
Technology Education Standards" but does not reproduce or link them. The Michigan
Career Development Model and its Educational Development Plan guidance are a
framework, not a coded standards set.

The Ready for Life family therefore cannot be standards-audited the way the other
nine can. It must be audited against the MMC outcomes it enables, and its
`subject-overview.md` must state that the family is locally defined and carries no
state standards claim.

### Physical Education — the coding legend is inferred

**PARTIALLY VERIFIED.** The May 2017 PE document contains no explicit coding
legend. The `S<standard>.<outcome>.L1|L2` pattern was inferred from consistent
usage throughout the document, not read from a stated rule. Individual codes are
verbatim; the *rule* generating them is not. The PE session must copy codes
observed in the document rather than generating new ones from the inferred
pattern.

### Arts — the standards are dated 2011

The VPAA standards carry `v. 06.2011`. No newer Michigan arts standards revision
was located, but the search was not exhaustive. The Arts session should re-check
for a revision before authoring.

### Civics credit value

**PARTIALLY VERIFIED.** MCL 380.1278a(1)(a)(ii) names economics at ½ credit and
then cross-references the civics course in §1166(2) **without stating a credit
value**. The ½-credit figure for civics comes from MDE's MMC FAQ, not from the
statute. MCL 380.1166 itself was not read. Treat the ½ as MDE guidance, not
statutory text.

### High-school credit earned before Grade 9

MCL 380.1278b(2) provides that where a pupil completes a required high-school
credit before entering high school, the pupil "must be given high school credit"
for it. MDE's guidance is that the determination rests on demonstrated mastery of
the subject-area content expectations, assessed at least in part on assessments
measuring those expectations — not on seat time, and not on teacher
certification. MDE also states a course may count toward more than one credit area
when proficiency is demonstrated in both, with an evidence trail for each.

This matters twice in this programme: the published Grade 8 Financial Literacy
course covers PF1–PF7, and a Grade 8 Algebra I placement would be creditable. Both
are addressed in `credit-coverage-map.md`.

### Applicability to home schools — reported, not concluded

Two MDE documents address this directly and **are not fully consistent with each
other**. Both are reported as written. No legal conclusion is drawn here, and none
should be read into this contract.

- MDE, *Nonpublic and Home School Information 2025-2026*, under Graduation
  Requirements, states MMC graduation requirements are "specific to public school
  districts" and that home school environments "are not required to meet the MMC
  credit requirements". Its separate Course of Study section states nonpublic
  schools shall provide curricula "comparable to those provided in local school
  districts" and requires U.S. and Michigan constitution and civil-government
  content in high school.
- MDE, *Michigan Merit Curriculum FAQ*, states non-public and home schools "can
  set their own graduation criteria" — but opens that answer with a carve-out,
  "Except for the one-semester credit requirement in Civics/Government".

The FAQ's provenance is also worth recording: the file is dated July 2023 but its
internal header still reads "Updated September 2017", so it predates the 2022
personal finance amendment.

How these two documents interact is a legal question outside the scope of a
curriculum and coverage design audit. It belongs to the family's own counsel or to
MDE directly.

## Stale source flagged

MDE's World Language FAQ (`WL_FAQ.pdf`, dated 9/12/14) states the CTE and arts
substitution applies to pupils graduating "in 2016, 2017, 2018, 2019, or 2020
only" and adds that there is no guidance beyond 2020. **That sunset does not
appear in the current statute.** MCL 380.1278a(2) as rendered 2026-07-30, complete
through PA 20 of 2026, carries the substitution with no cohort limitation. Treat
the FAQ as superseded by the statute on this point and do not design around a 2020
cutoff.

## Standards claims not verified

Recorded so that no downstream reader mistakes silence for confirmation.

1. Literal high-school ELA dotted codes — not found verbatim in any MDE PDF.
2. Michigan ELA and Mathematics standards adoption/revision year — not printed in
   either document.
3. Civics ½-credit value — MDE FAQ only; MCL 380.1166 not read.
4. An explicit MDE statement that the older High School Content Expectations
   (HSCE) are superseded — no such statement found. Current MDE pages link only to
   the Michigan K-12 Standards, and the surviving HSCE files are orphaned (the
   Social Studies HSCE still carries a draft watermark), but absence of a link is
   not a declaration of supersession.
5. A coded MDE employability standards set — not located.
6. State Board approval memo/date for the Personal Finance content expectations —
   not located, though the expectations themselves were verified.
7. Whether a Michigan arts standards revision newer than v.06.2011 exists — not
   exhaustively searched.
