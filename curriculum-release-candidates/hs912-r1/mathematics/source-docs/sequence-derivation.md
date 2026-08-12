# Deriving the Grade 9–12 Mathematics Sequence

This document derives the Manuel Academy high school mathematics sequence from (a) the official
Michigan mathematics standards, (b) Michigan's official credit rule, and (c) the actual Grade 8
exit curriculum. It does not assume a conventional Algebra I / Geometry / Algebra II ordering.
Where convention and derivation agree, that agreement is a result, not an input.

Source custody for every standard cited: `standards/standards-custody.md`.

## 1. What Michigan actually mandates

From the official *Michigan Merit Curriculum Mathematics Course/Credit Requirements*:

- Section 1278(1)(a) requires **at least 4 credits in mathematics**.
- "The Michigan Mathematics Standards for high school represent **3 credits** with the additional
  credit determined by the district."
- "These standards constitute the minimum content for earning 3 of the 4 required mathematics
  credits. **The 4th credit is district-determined as to content and structure.**"
- "The State of Michigan doesn't require end-of-course exams."
- "There are varied pathways to help students successfully demonstrate proficiency."

**Consequence.** Michigan mandates a credit *quantity* and a standards *corpus*. It does not
mandate course titles, a course order, or an Algebra/Geometry split. Any claim that Michigan
requires "Algebra I then Geometry then Algebra II" is unsupported by the source. The sequence
below is therefore derived from standards structure and prerequisite dependency.

## 2. The corpus, and the split Michigan itself draws

Extraction of the official standards yields **156 high school standards** across 22 domains,
count-verified per domain (see `standards-custody.md`). The source document marks certain
standards with `(+)`, denoting content beyond the college-ready core.

| Class | Count |
| --- | --- |
| Core (no `(+)` marker) | 113 |
| Advanced (`(+)`) | 43 |
| **Total** | **156** |

This is the decisive structural fact. Michigan says the HS standards represent **3 credits**, and
Michigan's own document distinguishes a core corpus from a `(+)` corpus. Mapping the 113 core
standards onto the 3 standards-defined credits, and the 43 `(+)` standards onto the
district-determined 4th credit, is a derivation from the source — not a convention.

- **Grades 9, 10, 11** carry the 113 core standards (41 + 37 + 35) = Michigan's 3 standards-defined credits.
- **Grade 12** carries the 43 `(+)` standards = the district-determined 4th credit.

Verified partition: all 156 standards appear exactly once across the four courses. No standard is
duplicated; none is unmapped. See `standards/standards-map.md` and `validation-report.md`.

## 3. Where Grade 8 actually ends

From `curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/mathematics/units.json`, the
Grade 8 course covers:

`8.NS.1, 8.NS.2` · `8.EE.1, 8.EE.3, 8.EE.4, 8.EE.5, 8.EE.6, 8.EE.7, 8.EE.8` ·
`8.F.1–8.F.5` · `8.G.1–8.G.9` · `8.SP.1–8.SP.4`

Grade 8 therefore exits with: irrational numbers introduced; integer exponents and scientific
notation; linear equations in one variable; slope and slope-intercept form; the function concept
and linear vs. nonlinear comparison; systems of linear equations; transformations, congruence and
similarity treated **informally**; the Pythagorean theorem; volume of curved solids; and bivariate
data with informal lines of fit.

**Identified gap: `8.EE.2` is not covered by the Grade 8 course.** That standard introduces square
root and cube root symbols and the solutions of `x² = p` and `x³ = p`. It is a prerequisite for
`N-RN` and for `A-REI.4`. Grade 9 Unit 2 therefore explicitly carries "square and cube roots as
equation solutions" as a bridge topic. This is a deliberate, documented handoff repair, not an
assumed prerequisite.

## 4. Deriving the order

The order follows from prerequisite dependency among the standards themselves. Twenty dependency
pairs were read directly from the verbatim standard text and are enforced mechanically by check 19
in `validation-report.md`.

**Grade 9 is fixed by the Grade 8 exit.** The standards whose prerequisites are *exactly* Grade 8's
linear, exponent, and function work are `N-Q`, `N-RN`, `A-SSE`, `A-CED`, `A-REI.1,3,4,5,6,10,11,12`,
`F-IF.1–6`, `F-BF.1–2`, `F-LE.1,2,3,5`, and `S-ID`. Each formalizes something Grade 8 left informal:
Grade 8 solved linear equations, Grade 9 justifies the steps (`A-REI.1`); Grade 8 used integer
exponents, Grade 9 extends to rational (`N-RN.1`); Grade 8 fit lines by eye, Grade 9 uses residuals,
standard deviation, and the correlation coefficient (`S-ID.2,6,8`). This is the non-duplication test,
and it passes: no Grade 9 unit repeats a Grade 8 unit with larger numbers.

**Quadratic algebra belongs in Grade 9, and this is forced, not chosen.** Three Grade 9 standards
name quadratics in their own text — `A-CED.1` ("Include equations arising from linear and quadratic
functions"), `F-LE.3` ("exceeds a quantity increasing linearly, quadratically"), and `S-ID.6a`
("Emphasize linear, quadratic, and exponential models"). A fourth dependency runs forward into
Grade 10: `G-GPE.1` says "complete the square to find the center and radius of a circle given by an
equation." `A-SSE.3` and `A-REI.4` therefore sit in Grade 9 Unit 5, before all four dependents.

**Geometry must precede the Grade 11 trigonometric strand.** `F-TF.1–2` define radian measure and
the unit circle. Radian measure depends on arc length and circle similarity (`G-C.1`, `G-C.5`), and
the trigonometric ratios themselves are *defined by similarity* (`G-SRT.6`). Grade 10 must therefore
come before the trigonometric functions in Grade 11.

**Geometry must follow the Grade 9 algebraic strand.** `G-GPE.1` requires completing the square,
`G-GPE.5` requires slope criteria for parallel and perpendicular lines, and `G-GPE.4` requires
algebraic manipulation of coordinates. All depend on Grade 9.

Grade 10 is therefore pinned between Grade 9 and Grade 11 by dependencies running in both
directions. Its content — the formalization of the informal congruence, similarity, and Pythagorean
work Grade 8 left open — is exactly the remaining `G-*` core corpus.

**Grade 11 is the remaining core.** What is left after Grades 9 and 10 is the polynomial, rational,
complex, advanced-function, logarithmic, trigonometric, probability, and inference corpus. Its
prerequisites are Grade 9 algebra and Grade 10 geometry, and nothing in it is required by either.
It is therefore third by elimination, not by convention. Within Grade 11, logarithms (`F-LE.4`, U04)
and trigonometric functions (`F-TF`, U05) precede advanced function graphing (`F-IF.7`, U06), because
`F-IF.7e` requires graphing "logarithmic ... and trigonometric functions."

**Grade 12 is what Michigan leaves to the district.** The 43 `(+)` standards are the only corpus not
required for the three standards-defined credits, and Michigan explicitly assigns the 4th credit's
content to the district. Within Grade 12, trigonometric identities (`F-TF.9`, U01) precede the
complex plane (`N-CN.5`, U04) because complex multiplication as rotation uses the angle addition
formulas; and the triangle laws (`G-SRT.10/11`, U03) precede vectors (`N-VM.4`, U06) because the
resultant of two non-perpendicular vectors is a Law of Cosines computation.

## 5. Alternative sequences considered

**Integrated Mathematics I/II/III.** Michigan permits it — the source states there are "varied
pathways" and does not require course-based organization. It was not selected because the existing
Manuel Academy corpus (Grades 5, 7, 8) is organized into domain-coherent 18-day units, and an
integrated pathway would either break that unit structure or interleave domains inside units in a
way the Study Engine's unit-level mastery evidence does not currently model. This is an
architectural fit decision, and it is recorded here rather than presented as a Michigan requirement.

**Geometry first (Grade 9).** Rejected on evidence: `G-GPE.4–7` require the coordinate and linear
equation fluency that Grade 9 establishes, and Grade 8 closes on a linear/functional note that
Grade 9 continues directly. Placing geometry first would create a year-long gap in the algebraic
strand between Grade 8 and Grade 10.

**Statistics as the senior course.** Rejected as the *primary* senior path because `S-MD` is only 7
standards and could not alone constitute a credit; it is included within the Grade 12 course. See
the alternate-pathway note below.

## 6. Senior year

Grade 12 (`Precalculus and Decision Mathematics`) carries all 43 `(+)` standards: the complex plane,
the fundamental theorem of algebra and the binomial theorem, vectors, matrices and matrix methods
for systems, advanced trigonometric identities and inverse trigonometric functions, the Laws of
Sines and Cosines, conics, Cavalieri's principle, and probability distributions with expected-value
decision analysis. This is substantive mathematics, not a review year.

**Alternate senior pathway.** Michigan assigns the 4th credit's content and structure to the
district, which permits more than one senior option. For a learner not continuing on a
calculus-bound track, an applied alternative may be substituted, built from the `S-MD` decision
strand (Grade 12 Units 9–10), the `N-Q` and `G-MG` modeling standards, and the existing Grade 8
Financial Literacy PF1–PF7 material at high-school depth. That pathway is **noted, not authored**
in this package; it would require its own unit architecture and assessment set before use.

## 7. Prerequisite handoff chain

| Handoff | Basis |
| --- | --- |
| 8 → 9 | G9 U01 extends `8.NS.1–2` and `8.EE.1` into `N-Q`/`N-RN` and bridges the missing `8.EE.2`; U02–U04 formalize `8.EE.7–8` into `A-SSE`/`A-REI` and add the inequality work Grade 8 never covers; U05–U06 add quadratics and equation creation; U07–U09 extend `8.F.1–5` into `F-IF`/`F-BF`/`F-LE`; U10 extends `8.SP.1–4` into `S-ID`. |
| 9 → 10 | `G-GPE.1` (G10 U09) requires completing the square from G9 U05. `G-GPE.4/5` require the coordinate and linear work of G9 U03–U04. `G-SRT.4` (G10 U06) re-proves the Grade 8 Pythagorean result via similarity. |
| 10 → 11 | `F-TF.1` (G11 U05) requires arc length and radian measure from `G-C.5` (G10 U08); `F-TF.5` requires the similarity-defined ratios of `G-SRT.6` (G10 U07). |
| 11 → 12 | Every G12 unit extends a G11 strand into its `(+)` standards: trigonometry (G11 U05 → G12 U01–U02), triangle geometry (G10 U07 → G12 U03), complex numbers (G11 U03 → G12 U04–U05), polynomial algebra (G11 U01 → G12 U05), systems (G11 U03 → G12 U07), probability (G11 U08–U09 → G12 U09–U10). |

## 8. Standards review and corrections

This architecture was reviewed against the verbatim standard text by an independent
standards/content reviewer before the courses were finalized. The review found one blocking defect
and several ordering and balance defects in the first draft. All were corrected, and the blocking
class of defect is now caught mechanically by check 19 in `validation-report.md`:

1. **Blocker — quadratic algebra was scheduled a year too late.** `A-SSE.3` and `A-REI.4` sat in
   Grade 11 while `G-GPE.1` (Grade 10) requires completing the square, and three Grade 9 standards
   name quadratics in their own text. Both standards were moved to Grade 9 Unit 5. Grade 9 was
   reordered so that linear reasoning precedes quadratics, which precedes equation creation.
2. **Grade 11 graphed functions it had not yet taught.** `F-IF.7e` graphs logarithmic and
   trigonometric functions but sat before the logarithm and trigonometry units. Grade 11 was
   reordered to logs → trigonometry → advanced function analysis.
3. **Grade 12 ordering.** The complex plane preceded the angle addition formulas it uses, and
   vectors preceded the triangle laws needed for non-perpendicular resultants. Grade 12 was
   reordered to trigonometry → triangle laws → complex numbers → vectors → matrices.
4. **Balance and coverage.** Thin and overloaded units were rebalanced; uncovered clauses were given
   explicit topics, including the cyclic-quadrilateral proof in `G-C.3`, function composition in
   `F-BF.1c`, quadrant sign reasoning in `F-TF.8`, and the sign-reversal rule for inequalities.
   Grade 9 unit topics were rewritten to name the escalation over Grade 8 rather than restate it.

**Known accepted exception.** `F-BF.4c` and `F-BF.4d` are `(+)`-marked sub-items of an otherwise core
standard, and they sit in Grade 11 U07 rather than Grade 12. `F-BF.4` cannot be split across courses
without breaking the exactly-once partition. This is recorded here so it is not read as an error.
