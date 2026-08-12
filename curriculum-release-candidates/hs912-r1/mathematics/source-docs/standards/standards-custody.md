# Michigan High School Mathematics — Standards Source Custody

**Retrieved:** 2026-08-12
**Jurisdiction:** Michigan
**Status:** Locally authored curriculum aligned to published Michigan standards. This package
is not a claim of state approval, accreditation, licensure, or automatic credit.

## Primary sources (official michigan.gov)

| # | Document | URL | SHA-256 |
| - | --- | --- | --- |
| 1 | Michigan K-12 Standards — Mathematics | https://www.michigan.gov/mde/-/media/Project/Websites/mde/Literacy/Content-Standards/Math_Standards.pdf | `dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54` |
| 2 | Michigan Merit Curriculum — Mathematics Course/Credit Requirements | https://www.michigan.gov/mde/-/media/Project/Websites/mde/Academic-Standards/Math_Course_Credit.pdf | `34efe108c40b736d43afec3ac0d82cac57451cedd830369861e01b96f821ca1e` |

Both documents were linked from the official Michigan Department of Education Academic
Standards index (`https://www.michigan.gov/mde/services/academic-standards`) and retrieved
directly from `michigan.gov`. Document 1 is 94 pages; document 2 is 2 pages.

## Extraction and verification

High school standards were extracted from document 1 (the "Standards for High School"
section) into `michigan-hs-mathematics-standards.json`.

Extraction was verified by independent per-domain count reconciliation. All 22 high school
domains matched their expected standard counts exactly:

```
N-RN 3   N-Q 3    N-CN 9   N-VM 12
A-SSE 4  A-APR 7  A-CED 4  A-REI 12
F-IF 9   F-BF 5   F-LE 5   F-TF 9
G-CO 13  G-SRT 11 G-C 5    G-GPE 7   G-GMD 4  G-MG 3
S-ID 9   S-IC 6   S-CP 9   S-MD 7
TOTAL 156
```

Each extracted standard retains its verbatim text, its domain, its number, and two flags
taken from the source document:

- `plus` — the `(+)` marker. Document 1 uses `(+)` for standards beyond the college-ready core.
- `star` — the modeling star.

Split: **113 core (non-`(+)`) standards** and **43 `(+)` standards**.

No standard code or text in this package was recalled from memory or inferred. Every code in
every course maps to an entry in `michigan-hs-mathematics-standards.json`, which maps to
document 1.

## Governing credit rule (document 2, verbatim)

> "The Michigan Mathematics Standards for high school represent 3 credits with the additional
> credit determined by the district."

> "These standards constitute the minimum content for earning 3 of the 4 required mathematics
> credits. The 4th credit is district-determined as to content and structure."

Document 2 also states that Michigan does not require end-of-course exams and that "there are
varied pathways" — Michigan does **not** mandate a particular Algebra/Geometry course sequence.
The sequence in this package is therefore derived, not assumed. See `sequence-derivation.md`.
