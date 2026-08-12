# Grade 8 Mathematics — Standards Custody and Coverage Reconciliation

**Retrieved:** 2026-08-12
**Jurisdiction:** Michigan
**Scope of this document:** independent verification of the official Michigan Grade 8
mathematics content standards, and reconciliation of those standards against the published
Manuel Academy Grade 8 Mathematics course in curriculum release `1.0.0`.

**Status:** Locally authored curriculum aligned to published Michigan standards. This
document is not a claim of state approval, accreditation, licensure, or automatic credit.

## 1. Primary source

| Document | URL | SHA-256 |
| --- | --- | --- |
| Michigan K-12 Standards — Mathematics (94 pp.) | https://www.michigan.gov/-/media/Project/Websites/mde/Literacy/Content-Standards/Math_Standards.pdf | `dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54` |

Grade 8 occupies document pages 52–56.

**Independent-retrieval corroboration.** This SHA-256 was produced by retrieving the PDF
fresh on 2026-08-12 for this review. It is **bit-identical** to the SHA-256 recorded
independently for the same document in
`curriculum-authoring/full-family-highschool-9-12/subjects/mathematics/standards/standards-custody.md`.
Two separate retrievals yielding the same digest establish that both reviews read the same
authentic MDE document.

**Retrieval note.** `michigan.gov` returns HTTP 403 to default fetchers. The document was
retrieved by direct download with a browser user-agent (HTTP 200). No secondary source,
mirror, or recalled-from-memory text was used for any claim in this document.
`corestandards.org` returned HTTP 404 and was not relied upon.

**Notation.** The Michigan document prints domain headers (`8.NS`, `8.EE`, `8.F`, `8.G`,
`8.SP`) with plain numbered items beneath. It does not use the cluster-letter form
(`8.EE.A.1`). Codes below use the `8.EE.2` form, matching both the source document and the
existing `1.0.0` course data.

## 2. Complete official Grade 8 content standards — 28 total

| Domain | Count | Codes |
| --- | --- | --- |
| 8.NS — The Number System | 2 | 8.NS.1–2 |
| 8.EE — Expressions and Equations | 8 | 8.EE.1–8 |
| 8.F — Functions | 5 | 8.F.1–5 |
| 8.G — Geometry | 9 | 8.G.1–9 |
| 8.SP — Statistics and Probability | 4 | 8.SP.1–4 |
| **Total** | **28** | |

The eight Standards for Mathematical Practice (`MP.1`–`MP.8`) are published separately and
are not Grade 8 content standards.

## 3. Coverage reconciliation against release 1.0.0

Source of course coverage: every `standards` array in
`curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/mathematics/`
(`units.json`, `lessons.jsonl` — 180 lessons, `assessments.json` — 10 assessments).

| Official standard | Covered in 1.0.0 | Evidence |
| --- | --- | --- |
| 8.NS.1, 8.NS.2 | yes | Unit 1 |
| 8.EE.1 | yes | Unit 2 |
| **8.EE.2** | **NO — absent at every level** | **zero occurrences in units, lessons, assessments** |
| 8.EE.3, 8.EE.4 | yes | Unit 2 |
| 8.EE.5, 8.EE.6 | yes | Unit 4 |
| 8.EE.7 | yes | Units 3, 10 |
| 8.EE.8 | yes | Units 6, 10 |
| 8.F.1–8.F.5 | yes | Unit 5 (8.F.4 also Unit 10) |
| 8.G.1–8.G.5 | yes | Unit 7 |
| 8.G.6, 8.G.8 | yes | Unit 8 |
| 8.G.7 | yes | Units 8, 10 |
| 8.G.9 | yes | Unit 9 |
| 8.SP.1, 8.SP.2, 8.SP.4 | yes | Unit 9 |
| 8.SP.3 | yes | Units 9, 10 |

**Result: 27 of 28 covered. Exactly one gap — `8.EE.2`.**

### 8.EE.2, verbatim from the primary source

> "Use square root and cube root symbols to represent solutions to equations of the form
> x² = p and x³ = p, where p is a positive rational number. Evaluate square roots of small
> perfect squares and cube roots of small perfect cubes. Know that √2 is irrational."

The standard has no lettered sub-parts. It carries three requirements:

1. use radical symbols to represent solutions to `x² = p` and `x³ = p` for positive rational `p`;
2. evaluate square roots of small perfect squares and cube roots of small perfect cubes;
3. know that `√2` is irrational.

### Why the gap is genuine and not a labelling artifact

The course's only root-related content is the Unit 1 topic **"approximating square roots"**,
which serves `8.NS.2` (rational approximation of irrationals to compare and locate on a number
line). Text search across the whole Grade 8 mathematics course returns:

- `cube root` — **0 occurrences**
- `perfect square` / `perfect cube` — **0 occurrences**
- `radical` — **0 occurrences**
- root symbols used to express the solution of `x² = p` or `x³ = p` — **0 occurrences**

Approximation (`8.NS.2`) and exact evaluation plus root-symbol notation (`8.EE.2`) are
distinct competencies. The content is missing, not merely uncoded.

## 4. The reported inequality concern — REFUTED

An upstream High School Mathematics handoff note was read as reporting an
"inequality-related prerequisite" gap in Grade 8. Verified against the primary source:

- A case-insensitive search for `inequalit` across the **entire Grade 8 section** of the
  official document returns **zero matches**. Searches for "greater than" and "less than"
  in Grade 8 also return zero matches.
- The three `8.EE` cluster headings are "Work with radicals and integer exponents",
  "Understand the connections between proportional relationships, lines, and linear
  equations", and "Analyze and solve linear equations and pairs of simultaneous linear
  equations". There is no inequality cluster.

**Michigan Grade 8 contains no inequality standard.** Inequalities are owned by:

| Grade | Standards | Content |
| --- | --- | --- |
| 6 | 6.NS.7a, 6.EE.5, **6.EE.8** | interpret inequality statements; solve; write and graph `x > c` / `x < c` |
| 7 | 7.EE.4, **7.EE.4b** | word problems leading to `px + q > r`; graph and interpret the solution set |
| High school | A-CED.1, A-CED.3, A-REI.3, A-REI.12 | formal solving and graphing |

The upstream note's own wording — Grade 9 "add[s] the inequality work Grade 8 never covers"
— is **factually correct and correctly by design**. Grade 8 not covering inequalities is
conformance to the standards, not a defect.

Manuel Academy Grade 7 Mathematics already covers `7.EE.4` with a dedicated inequalities
unit (156 inequality references across `units.json`, `lessons.jsonl`, and
`assessments.json`), so the prerequisite is delivered in the grade that owns it.

**No inequality remediation is warranted in Grade 8. Authoring Grade 8 inequality lessons
would attach instruction to a standard that does not exist at this grade.**

## 5. Root cause

Release `1.0.0` ran 18 validation checks (`validation/validation.json`, all PASS). Those
checks verify structure, counts, identifiers, schedule coverage, and required lesson fields
— including that a `standards` array is present and non-empty — and they verify
domain completeness for exactly one course: Grade 8 Financial Literacy (`grade8-finance-pf1-pf7`).

**No check verifies mathematics standards-domain completeness.** A missing code inside an
otherwise well-formed course is invisible to the 1.0.0 suite. The release's own validation
report states that a PASS "does not claim" standards-coverage completeness, so `1.0.0` is
not self-contradictory — the gap sits in a space the suite never asserted.

Recommended durable fix (out of scope for this correction, listed for the backlog): add a
per-course standards-domain completeness check to the validation suite, seeded from a
custody-verified standards list per grade and subject.
