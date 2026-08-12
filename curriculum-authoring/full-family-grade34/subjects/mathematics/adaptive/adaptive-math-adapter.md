# Adaptive Math Compatibility - Adapter and Capability Marker

## What this is

The Manuel Academy Adaptive Math package (`adaptive-tutor/subjects/math`) is frozen. It declares a grade band of 4 to 6 and ships exactly four intervention sequences. This document defines the only way the Grade 3 and Grade 4 mathematics courses may touch it: a **capability marker** plus a **declarative alignment map**. Nothing is copied, rewritten, vendored, or modified.

## The four frozen sequences

| Sequence ID | Title |
| --- | --- |
| `math-seq-pv-regroup-v1` | Place Value and Regrouping |
| `math-seq-mult-div-rel-v1` | Multiplication and Division Relationships |
| `math-seq-equivalent-fractions-v1` | Equivalent Fractions and Common Denominators |
| `math-seq-multistep-word-problems-v1` | Multistep Word-Problem Reasoning |

## Grade 4 alignment

Alignment is asserted only where the skills actually match.

| Unit | Title | Aligned sequence |
| --- | --- | --- |
| 1 | Mathematical Habits and Place Value to One Million | `math-seq-pv-regroup-v1` |
| 2 | Multi-Digit Addition and Subtraction | `math-seq-pv-regroup-v1`, `math-seq-multistep-word-problems-v1` |
| 3 | Multiplicative Comparison, Factors, Multiples, and Patterns | `math-seq-mult-div-rel-v1` |
| 4 | Multi-Digit Multiplication with Area Models and Partial Products | `math-seq-mult-div-rel-v1`, `math-seq-multistep-word-problems-v1` |
| 5 | Division with Remainders | `math-seq-mult-div-rel-v1`, `math-seq-multistep-word-problems-v1` |
| 6 | Fraction Equivalence and Comparison | `math-seq-equivalent-fractions-v1` |
| 7 | Adding, Subtracting, and Multiplying Fractions | `math-seq-equivalent-fractions-v1` |
| 8 | Decimal Notation and Fraction-Decimal Connections | none |
| 9 | Measurement, Conversion, and Data | none |
| 10 | Angles, Geometry, and Integrated Capstone | none |

Units 8, 9, and 10 cover decimal notation, measurement and conversion, and angles and geometry. The frozen package contains no sequence for any of those, so they assert no alignment. Force-fitting them would be a false claim about the intervention's coverage.

## Grade 3

**Grade 3 asserts no alignment whatsoever.** The frozen manifest lists grade 3 under `prerequisiteSupport`, which means some Grade 4-6 sequences may reach back to a Grade 3 idea. That is not a claim that the package teaches the Grade 3 curriculum, and this course does not treat it as one. Every Grade 3 adaptive route resolves to the static fallback. See `grade3-static-fallback.md`.

## Resolution order

- 1. Static in-lesson support: the lesson's own support text and target misconception repair.
- 2. Static unit fallback: the unit's prerequisite list and known-misconception table.
- 3. Optional: if capability 'adaptive-math.v1' is present AND the unit declares an aligned sequence, an adult may route the learner to that frozen sequence.
- 4. If the capability is absent or no sequence is aligned, stop at step 2. This is a supported terminal state, not a degraded one.

## Contract

- This map is the ONLY coupling between the Grade 3/4 mathematics courses and the frozen Adaptive Math package.
- The frozen package is never imported, vendored, edited, or re-published by this course.
- A capability marker is advisory. When the capability is absent, every route falls back to the static lesson and help path and the course remains complete.
- Alignment is asserted only where the unit's skills genuinely match a frozen sequence. Units with no genuine match are marked 'none' rather than force-fitted.
- Grade 3 asserts no alignment at all. The frozen package lists grade 3 only as prerequisite support, which is not a Grade 3 curriculum claim.

## Why a marker rather than an import

An import would couple a 180-lesson course to a frozen artifact's internal shape, and would break the course if that artifact were absent. A marker is advisory: the runtime asks whether the capability exists, and if the answer is no, nothing about the lesson changes. That is what makes the Grade 3 guarantee possible.

