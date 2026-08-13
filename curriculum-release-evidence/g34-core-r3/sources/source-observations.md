# Observations about the primary sources

Defects and quirks found in the MDE documents themselves while resolving the Grade 3/4 core
citations. None of these is a defect in the Manuel Academy release; they are recorded so the
reader knows why some resolutions look the way they do.

## 1. Social studies: `4 – E1.01` is misprinted (blocks one citation)

In "SOCIAL STUDIES CONTENT EXPECTATIONS: GRADE FOUR", Economics, cluster E1 Market Economy,
the first expectation is printed as **`4 – E1.01`**. Every sibling in the same cluster reads
`4 – E1.0.2` through `4 – E1.0.8`, and every other expectation in the whole document uses
`<grade> – <cluster>.0.<n>`.

The release cites `4 – E1.0.1`, which is what the pattern requires and almost certainly what
was intended, but that string is not printed. Correcting a primary source is a ruling, not a
verification, so this code is the one `HUMAN_REVIEW_REQUIRED` entry — 12 citations across
Unit 8 of `ma-g4-social-studies`. The ruling needed is narrow: cite MDE's printed string as
printed, or cite the normalised form and record the correction.

Locator: `mde-social-studies`, PDF page 40. Evidence is on the registry entry.

## 2. Social studies: a grade 3 inquiry arc cites grade 3 economics codes that do not exist

The inquiry-arc table preceding the Grade Three content expectations lists, under "Standards
Connection", `3 – E1.0.6`, `3 – E1.0.7` and `3 – E1.0.8`. The Grade Three content
expectations themselves stop at `3 – E1.0.5`. Those three codes exist only at grade 4.

This does not touch the release, which cites `3 – E1.0.1` through `3 – E1.0.5` and no
further. It does mean any inventory built by scraping the whole document overstates grade 3
by three codes, so the coverage inventory here is bounded to the content-expectation
sections.

## 3. Mathematics: no code is printed in joined form, and `MP` is never printed

The document prints domain headers (`3.OA`) and numbered standards separately, and prints
the eight Standards for Mathematical Practice as a numbered list with titles and no code.
Neither `3.OA.1` nor `MP.1` occurs anywhere in it. See the alias maps.

## 4. ELA: full standard codes are essentially absent

The document states the `<strand>.<grade>.<number>` convention in its introduction and gives
two worked examples in that one sentence, `RI.4.3` and `W.5.1a`. Apart from those, the only
full codes it prints are the 17 sub-codes in the Language Progressive Skills table, of which
six fall in grade 3 or 4: `L.3.1f`, `L.3.3a`, `L.4.1f`, `L.4.1g`, `L.4.3a`, `L.4.3b`. None of
those 19 strings is a code this release cites. Elsewhere, strand designators are printed
beside strand titles; grades are column headers; standards are row numbers.

## 5. Extraction quirks (not defects)

- The mathematics and ELA PDFs render several headings in small caps, so extraction yields
  `3.oa` for `3.OA` and `sl` for `SL`. All header matching is case-insensitive.
- ELA grade tables are three-column (grades 3/4/5). Extraction interleaves them row-major, so
  the k-th cell of a row number is the k-th grade column. **Cells are not reliably line-based**:
  where a cell holds a short parenthetical stub — `(Begins in grade 4)` on `W.3.9`, `(Not
  applicable to literature)` on `RL.n.8` — the following cell stays on the same line, and a
  line-start scan loses a column and shifts every later column by one grade. Cell starts are
  therefore matched at line start *or* immediately after a closing parenthesis, and any row
  that does not resolve to exactly three cells is refused rather than indexed. The rule was
  checked against rows that name their own grade in the text ("a grade 3 topic or subject
  area", "Apply grade 4 Reading standards").
- PDF page indices in this evidence set are 1-based positions in the file, which do not
  always equal the printed folio.
