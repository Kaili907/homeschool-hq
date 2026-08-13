# Grade 3/4 Core Standards Evidence Resolution (r3)

Independent resolution of every standards citation on the four **core** courses of each
grade — mathematics, English language arts, science, social studies — against the primary
Michigan Department of Education documents, retrieved directly from michigan.gov.

Scope: 8 courses, **276 distinct (course, code) pairs, 2903 citations**. The union of
distinct code strings is 267 — the three 3-5 engineering-design expectations and six MP.n
practices are cited by both grades. The release under review is
[`curriculum-release-normalization/g34-r2`](../../curriculum-release-normalization/g34-r2).
Nothing outside `curriculum-release-evidence/g34-core-r3/` is written, and **no lesson is
edited**. The release's own artifacts are read-only inputs.

## Headline

| | citations | distinct (course, code) pairs |
| --- | --- | --- |
| `VERBATIM_VERIFIED` | 1560 | 124 |
| `ALIAS_RESOLVED_VERBATIM` | 0 | 0 |
| `COMPOSITE_VERIFIED` | 1331 | 151 |
| `LOCAL_COMPOSITION` | 0 | 0 |
| `UNVERIFIED` | 0 | 0 |
| `HUMAN_REVIEW_REQUIRED` | 12 | 1 |

Before (release rollup, core subset): **1210 canonical, 1572 unverified, 121 human-review**.
After: **2891 resolved against a primary source, 12 left for a human** — the unverified /
human-review citation set for core drops from 1693 to 12, a reduction of 1681.

Exact counts, including the delta, are in [`counts/before-after.json`](counts/before-after.json).

## What each classification means here

| Classification | Meaning | Where it landed |
| --- | --- | --- |
| `VERBATIM_VERIFIED` | the cited string occurs in the primary source, character for character | all science, all social studies but one |
| `ALIAS_RESOLVED_VERBATIM` | cited string differs from the source's, a reversible alias maps it to a string that **is** printed verbatim | nothing — see below |
| `COMPOSITE_VERIFIED` | no single printed string equals the code; every component is printed and the source states the composition rule | all mathematics, all ELA |
| `LOCAL_COMPOSITION` | a house label with no official referent | nothing |
| `UNVERIFIED` | a source is named, the code is not confirmed | nothing |
| `HUMAN_REVIEW_REQUIRED` | resolving it needs a ruling a machine should not make | `4 – E1.0.1` |

`ALIAS_RESOLVED_VERBATIM` is empty and that is a finding, not an omission. Two alias maps
were needed and both were built (ELA ordering, MP.n practices), but in neither case is the
**target** of the alias a string the MDE document prints. Recording those citations as
alias-resolved-verbatim would have claimed a verbatim match that does not exist, so they
are carried as composite instead, with the alias recorded on each entry.

## The ELA code-format issue, handled explicitly

This release prints `3.RL.1`. The MDE ELA document states its own ordering in
"How to read this document": standards are *identified by their strand, grade, and number*,
and it gives `RI.4.3` as the worked example. So the official ordering is
`<strand>.<grade>.<number>` — `RL.3.1` — and the two strings are **not** the same string.

[`alias-maps/ela-code-order.alias.json`](alias-maps/ela-code-order.alias.json) carries a
reversible transform in both directions plus all 86 exercised pairs. Nothing anywhere in
this evidence set treats `3.RL.1` and `RL.3.1` as equal.

The second half of the finding matters as much: **the MDE ELA document prints no full ELA
code at all**, apart from the two legend examples `RI.4.3` and `W.5.1a`, and the 17 sub-codes in the
Language Progressive Skills table — of which six are grade 3 or 4 (`L.3.1f`, `L.3.3a`,
`L.4.1f`, `L.4.1g`, `L.4.3a`, `L.4.3b`), and none is a code this release cites. Every ELA citation is therefore verified compositely — strand
designator printed beside the strand title, the grade column header, and the numbered
standard in that column — never by string equality.

Attributing a numbered standard to a grade column is the load-bearing step, because the
grade 3/4/5 tables extract as interleaved text. Cells are located by cell start, not by line
start: where a cell holds a short stub such as `(Begins in grade 4)` the next cell stays on
the same line, and a line-start scan would silently shift every later column by one grade.
Any row that does not resolve to exactly three cells is refused as
`HUMAN_REVIEW_REQUIRED` rather than indexed positionally; the
`ela-grade-column-attribution-unambiguous` check reports how many were refused (currently
none).

## Mathematics

The MDE mathematics document prints the domain as a section header (`3.OA`) and the
standards as a numbered list under it. The joined form `3.OA.1` never appears. Verification
is composite: header plus numbered item, per
[`alias-maps/math-domain-composition.alias.json`](alias-maps/math-domain-composition.alias.json).
Worth noting for any downstream join: Common Core inserts a cluster letter (`3.OA.A.1`);
this release and the MDE document both omit it, and they agree with each other.

`MP.n` is a house label — the string `MP` occurs nowhere in the MDE document, which prints
the eight practices as a numbered list with titles. The referent is verified (number and
title), the label is not, so all 121 MP citations are `COMPOSITE_VERIFIED` carrying
`label_printed_by_source: false`. The r2 release put them at `human-review` on the strength
of the lane's assertion; this pass checked the document and found the referent unambiguous.

## Where this disagrees with the r2 rollup

r2 recorded 1210 core citations as `canonical` under rule R1, on the grounds that "the lane
catalog names the published MDE document as source of record for those exact codes". Read
against the documents, that is right about the referents and wrong about the form: **not one
of those 1210 code strings is printed by the MDE document**. They are all composed. The
codes are sound; the word `canonical` was carrying more than the sources support.

The reverse holds for science and social studies. r2 marked all 1572 of those citations
`unverified` because no lane document existed. Every one of them is printed verbatim in the
MDE document for the right grade — 1560 of 1572 confirmed here, the remaining 12 being one
code the MDE document itself misprints.

## Layout

- `sources/` — the four MDE PDFs, their response headers, and
  [`source-custody.json`](sources/source-custody.json): URL, retrieval time, HTTP status,
  server `Last-Modified` and `ETag`, byte count, page count, SHA-256 of both the PDF and its
  text extraction. Registry snippets are whitespace-collapsed for legibility, so a snippet can
  differ from the bytes at its `char_offset` by whitespace alone; `char_offset` and the cited
  code itself are never normalised.
- `sources/source-observations.md` — defects found in the MDE documents themselves.
- `extract/` — per-page text extractions, `<<<PAGE n>>>`-delimited.
- `alias-maps/` — four maps, each with transform, inverse, reversibility, caveat, and the
  pairs actually exercised.
- `registry/evidence-registry.json` / `.csv` — one row per distinct code per course:
  classification, resolved code, alias applied, prior status, citation count, and the source
  locators (page and character offset) that carry it.
- `coverage/per-course-coverage.json` / `.md` — before/after per course, plus a reverse check
  of the official inventory for that grade against what the course cites.
- `coverage/unresolved.json` — everything still needing a human.
- `counts/before-after.json` — exact before/after counts and delta.
- `validation/review-record.md` — the independent review this set went through before commit,
  its findings, and what each one changed.
- `validation/validation.json` — 13 checks, all passing. Each one reads or recomputes
  something: the release's own SHA256SUMS is re-hashed in full (239 files) to prove no lesson
  was touched, before/after counts are recomputed from the release's rollup and index rather
  than asserted, every verbatim locator is sliced back out of the source and compared, every
  evidence locator is checked for a non-empty snippet and page/offset agreement, and both
  alias maps are round-tripped through their own recorded transform and inverse.
- `tools/` — `verify_core_standards.py` (the resolver) and `build_evidence.py` (writes every
  artifact). Rebuild with `python3 tools/build_evidence.py`.

## What this does not establish

Verification here is code-level and formal: the cited code identifies a real standard in the
right grade of the right MDE document. It says nothing about whether a lesson teaches that
standard. **No licensed educator has reviewed any of this**, and the r2 custody addendum's
statement on that point stands unchanged.
