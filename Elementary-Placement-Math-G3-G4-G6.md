# Elementary Mathematics Placement — Grades 3, 4 and 6

Source document for the three elementary mathematics placement instruments built
in session CURRICULUM-CE3. Follows the same root-document pattern as
`HS-Math-Full-Diagnostic.md`.

Code: `src/assessment/banks/eleMathG3.ts`, `eleMathG4.ts`, `eleMathG6.ts`
Scoring model: `src/assessment/banks/placementModel.ts`
Rules, rubrics and parent guidance: `Elementary-Placement-Scoring-Guide.md`

## What these instruments are

Beginning-of-year placement instruments. Each one answers a single question:
**where should this subject start for this learner this year?** They recommend a
starting point and a short list of skill priorities. They are not graded, they
produce no report-card mark, and they diagnose nothing about a child beyond
which mathematics they can currently do.

## What they are not

- They are **not** a working-level change. Nothing in this system writes
  `Profile.workingLevels`. Stephen is the only person who applies a level.
- They are **not** a diagnosis. No item, key, rubric or report in this bank
  refers to attention, disability, or any condition, and none should be
  inferred from a low score.
- They are **not** precise. One assessment on one morning cannot separate "has
  not been taught this" from "knew it and had a bad morning." The scoring model
  reports that uncertainty rather than hiding it.

## Administering

- Untimed. No instrument in this bank carries a timer.
- Paper and pencil are expected; each test sets `scratchReminder`.
- SKIP is a first-class button on every item and the intro tells the child so in
  plain words. A skip is scored as *not demonstrated*, which is the honest
  reading — but a paper with many skips also lowers reported confidence.
- One sitting is fine; the runner also resumes an interrupted attempt.
- Expect roughly 35 minutes (G3), 40 minutes (G4), 45 minutes (G6).

## Reading the tier column

Every item is tagged with the readiness question it answers:

| Tier | Column | Meaning |
| --- | --- | --- |
| foundation | **F** | prerequisite skill from the PRIOR grade |
| current | **C** | beginning-of-nominal-year readiness |
| stretch | **S** | NEXT-grade signal; the only evidence that can recommend advanced material |

For Grade 6 these tiers are exactly the Grade 5 / Grade 6 / Grade 7 readiness
question the session asked for. A child is **not** expected to answer the
stretch items; several intros say so directly.

## Answer authority

Every scored item resolves one of two ways, never neither:

- **auto** — the item carries a machine key, judged by the shared normalizer in
  `src/assessment/normalizer.ts`. Equivalent forms score: `1 7/12` = `19/12`,
  `3 1/2` = `3.5`, `2/6` = `1/3`, `$20` = `20`, commas in `1,305` are ignored.
- **rubric** — an open response a human scores 0..max against the rubric in the
  scoring guide. Until a human supplies that score, the item is *pending*: never
  guessed at, never counted wrong.

An answer the normalizer cannot confidently judge is queued for a human, not
marked wrong. This is inherited from the original assessment addendum and is
load-bearing for the placement rules.

`elementaryPlacement.test.ts` asserts that every one of these keys actually
scores `correct` when fed back through the real scorer, so the tables below are
verified against the engine rather than transcribed by hand — they are emitted
from the source files themselves.

---

## Item tables

### Grade 3 Mathematics — Beginning-of-Year Placement

Test id `ele-math-g3` · nominal grade 3 · 27 items · 4 sections · untimed

Tier counts — foundation: 7 (7 auto, 0 rubric) · current: 15 (14 auto, 1 rubric) · stretch: 5 (5 auto, 0 rubric)

#### Section 1 — Numbers and Place Value

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e3m01` | F | Place value | 2.NBT.A.1 — value of a digit | numeric | 1 | `70` |
| `e3m02` | F | Place value | 2.NBT.A.3 — read and write numbers to 1000 | numeric | 1 | `305` |
| `e3m03` | F | Place value | 2.NBT.A.4 — compare three-digit numbers | choice | 1 | `<` |
| `e3m04` | C | Place value | 3.NBT.A.1 — round to the nearest 10 | numeric | 1 | `70` |
| `e3m05` | C | Place value | 3.NBT.A.1 — round to the nearest 100 | numeric | 1 | `300` |
| `e3m06` | S | Place value | 4.NBT.A.2 — four-digit place value | numeric | 1 | `1305` |

#### Section 2 — Adding and Subtracting

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e3m07` | F | Addition and subtraction | 2.NBT.B.5 — add within 100 | numeric | 1 | `82` |
| `e3m08` | F | Addition and subtraction | 2.NBT.B.5 — subtract within 100 | numeric | 1 | `34` |
| `e3m09` | C | Addition and subtraction | 3.NBT.A.2 — add within 1000 | numeric | 1 | `543` |
| `e3m10` | C | Addition and subtraction | 3.NBT.A.2 — subtract across zeros | numeric | 1 | `254` |
| `e3m11` | S | Addition and subtraction | 4.NBT.B.4 — add multi-digit numbers | numeric | 1 | `4143` |

#### Section 3 — Multiplication and Division

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e3m12` | F | Equal groups and arrays | 2.OA.C.4 — rows and columns as repeated addition | numeric | 1 | `20` |
| `e3m13` | C | Equal groups and arrays | 3.OA.A.1 — interpret products of whole numbers | choice | 1 | `6 × 3` |
| `e3m14` | C | Equal groups and arrays | 3.OA.A.3 — arrays in problem situations | numeric | 1 | `21` |
| `e3m15` | C | Multiplication and division facts | 3.OA.C.7 — fluently multiply within 100 | numeric | 1 | `32` |
| `e3m16` | C | Multiplication and division facts | 3.OA.C.7 — fluently multiply within 100 | numeric | 1 | `42` |
| `e3m17` | C | Multiplication and division facts | 3.OA.A.2 — division as equal sharing | numeric | 1 | `6` |
| `e3m18` | S | Multiplication and division facts | 4.NBT.B.5 — multiply two-digit by one-digit | numeric | 1 | `92` |

#### Section 4 — Fractions, Measuring and Word Problems

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e3m19` | F | Fractions | 2.G.A.3 — equal shares of a shape | text | 1 | `1/4` |
| `e3m20` | C | Fractions | 3.NF.A.1 — a fraction as parts of a whole | text | 1 | `2/6` |
| `e3m21` | C | Fractions | 3.NF.A.3d — compare unit fractions | choice | 1 | `1/2` |
| `e3m22` | C | Measurement | 3.MD.A.1 — elapsed time to the minute | choice | 1 | `9:45` |
| `e3m23` | C | Measurement | 3.MD.D.8 — perimeter of a rectangle | numeric | 1 | `16` |
| `e3m24` | C | Word problems and reasoning | 3.OA.D.8 — two-step word problems | numeric | 1 | `53` |
| `e3m25` | S | Fractions | 4.NF.A.1 — equivalent fractions | choice | 1 | `2/4` |
| `e3m26` | S | Measurement | 4.MD.A.1 — convert larger units to smaller | numeric | 1 | `15` |
| `e3m27` | C | Word problems and reasoning | 3.OA.B.5 — commutative property, explained | longtext | 1 | _rubric 0–3_ |

### Grade 4 Mathematics — Beginning-of-Year Placement

Test id `ele-math-g4` · nominal grade 4 · 33 items · 4 sections · untimed

Tier counts — foundation: 7 (7 auto, 0 rubric) · current: 21 (20 auto, 1 rubric) · stretch: 5 (5 auto, 0 rubric)

#### Section 1 — Place Value and Whole Numbers

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e4m01` | F | Place value and whole numbers | 3.NBT.A.1 — round to the nearest 10 | numeric | 1 | `470` |
| `e4m02` | F | Place value and whole numbers | 3.NBT.A.2 — subtract within 1000 | numeric | 1 | `345` |
| `e4m03` | C | Place value and whole numbers | 4.NBT.A.2 — multi-digit place value | numeric | 1 | `6000` |
| `e4m04` | C | Place value and whole numbers | 4.NBT.A.1 — a digit is ten times the place to its right | numeric | 1 | `10` |
| `e4m05` | C | Place value and whole numbers | 4.NBT.A.3 — round multi-digit numbers | numeric | 1 | `27000` |
| `e4m06` | C | Place value and whole numbers | 4.NBT.B.4 — add multi-digit numbers | numeric | 1 | `25701` |
| `e4m07` | S | Place value and whole numbers | 5.NBT.A.3b — compare decimals | choice | 1 | `0.4` |

#### Section 2 — Multiplication and Division

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e4m08` | F | Multiplication and division | 3.OA.C.7 — multiplication facts | numeric | 1 | `63` |
| `e4m09` | F | Multiplication and division | 3.OA.C.7 — division facts | numeric | 1 | `7` |
| `e4m10` | F | Multi-step problems | 3.OA.D.8 — two-step word problems | numeric | 1 | `38` |
| `e4m11` | C | Multiplication and division | 4.NBT.B.5 — two-digit by one-digit | numeric | 1 | `204` |
| `e4m12` | C | Multiplication and division | 4.NBT.B.5 — two-digit by two-digit | numeric | 1 | `345` |
| `e4m13` | C | Multiplication and division | 4.NBT.B.6 — divide within 100 | numeric | 1 | `24` |
| `e4m14` | C | Multiplication and division | 4.NBT.B.6 — quotient with a remainder | numeric | 1 | `17` |
| `e4m15` | C | Multiplication and division | 4.OA.A.3 — interpret the remainder | numeric | 1 | `2` |
| `e4m16` | S | Multiplication and division | 5.NBT.B.5 — three-digit by two-digit | numeric | 1 | `7344` |

#### Section 3 — Fractions and Decimals

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e4m17` | F | Fraction equivalence and comparison | 3.NF.A.3d — compare fractions | choice | 1 | `3/4` |
| `e4m18` | C | Fraction equivalence and comparison | 4.NF.A.1 — equivalent fractions | numeric | 1 | `8` |
| `e4m19` | C | Fraction equivalence and comparison | 4.NF.A.2 — compare unlike fractions | choice | 1 | `<` |
| `e4m20` | C | Fraction and decimal operations | 4.NF.B.3a — add like denominators | text | 1 | `5/8` |
| `e4m21` | C | Fraction and decimal operations | 4.NF.B.3c — add mixed numbers | text | 1 | `3 1/2` |
| `e4m22` | C | Fraction and decimal operations | 4.NF.B.4b — multiply a fraction by a whole number | text | 1 | `10/3` |
| `e4m23` | C | Fraction equivalence and comparison | 4.NF.C.6 — fractions as decimals | text | 1 | `0.3` |
| `e4m24` | S | Fraction and decimal operations | 5.NF.A.1 — add unlike denominators | text | 1 | `3/4` |
| `e4m25` | S | Fraction and decimal operations | 5.NBT.B.7 — add decimals | numeric | 1 | `0.85` |

#### Section 4 — Measurement, Geometry and Multi-Step Problems

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e4m26` | F | Measurement | 3.MD.C.7 — area of a rectangle | numeric | 1 | `24` |
| `e4m27` | C | Measurement | 4.MD.A.1 — convert measurement units | numeric | 1 | `400` |
| `e4m28` | C | Measurement | 4.MD.A.3 — apply the area formula backwards | numeric | 1 | `6` |
| `e4m29` | C | Geometry | 4.G.A.1 — parallel and perpendicular lines | choice | 1 | `parallel` |
| `e4m30` | C | Geometry | 4.MD.C.5 — classify angles | choice | 1 | `right` |
| `e4m31` | C | Multi-step problems | 4.OA.A.3 — multi-step word problems | numeric | 1 | `283` |
| `e4m32` | S | Multi-step problems | 5.NBT.B.7 — multiply decimals in context | numeric | 1 | `50` |
| `e4m33` | C | Multi-step problems | 4.OA.A.3 — assess reasonableness, explained | longtext | 1 | _rubric 0–3_ |

### Grade 6 Mathematics — Beginning-of-Year Placement

Test id `ele-math-g6` · nominal grade 6 · 34 items · 4 sections · untimed

Tier counts — foundation: 7 (7 auto, 0 rubric) · current: 22 (21 auto, 1 rubric) · stretch: 5 (5 auto, 0 rubric)

#### Section 1 — Whole Numbers, Fractions and Decimals

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e6m01` | F | Whole-number operations | 5.NBT.B.5 — multiply multi-digit numbers | numeric | 1 | `8748` |
| `e6m02` | F | Whole-number operations | 5.NBT.B.6 — divide by a one-digit divisor | numeric | 1 | `114` |
| `e6m03` | F | Fractions and decimals | 5.NF.A.1 — add unlike denominators | text | 1 | `11/12` |
| `e6m04` | F | Fractions and decimals | 5.NBT.B.7 — subtract decimals | numeric | 1 | `2.85` |
| `e6m05` | C | Fractions and decimals | 6.NS.A.1 — divide a fraction by a fraction | text | 1 | `3/2` |
| `e6m06` | C | Whole-number operations | 6.NS.B.2 — divide by a two-digit divisor | numeric | 1 | `159` |
| `e6m07` | C | Fractions and decimals | 6.NS.B.3 — multiply decimals | numeric | 1 | `3.6` |
| `e6m08` | C | Fractions and decimals | 6.NS.B.3 — divide decimals | numeric | 1 | `23.4` |
| `e6m09` | C | Whole-number operations | 6.NS.B.4 — greatest common factor | numeric | 1 | `12` |
| `e6m10` | S | Fractions and decimals | 7.NS.A.1 — add signed rational numbers | text | 1 | `-1/4` |

#### Section 2 — Ratios, Rates and Percent

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e6m11` | F | Fractions and decimals | 5.NF.B.4 — multiply fractions | text | 1 | `2/5` |
| `e6m12` | C | Ratios, rates and percent | 6.RP.A.1 — ratio language | choice | 1 | `2:3` |
| `e6m13` | C | Ratios, rates and percent | 6.RP.A.2 — unit rate | numeric | 1 | `60` |
| `e6m14` | C | Ratios, rates and percent | 6.RP.A.3a — equivalent ratios | numeric | 1 | `25` |
| `e6m15` | C | Ratios, rates and percent | 6.RP.A.3c — percent of a quantity | numeric | 1 | `20` |
| `e6m16` | C | Ratios, rates and percent | 6.RP.A.3c — find the percent | numeric | 1 | `25` |
| `e6m17` | S | Ratios, rates and percent | 7.RP.A.2 — proportional relationships | numeric | 1 | `13.5` |
| `e6m18` | S | Ratios, rates and percent | 7.RP.A.3 — percent increase and decrease | numeric | 1 | `34` |

#### Section 3 — Integers and the Coordinate Plane

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e6m19` | F | Coordinate plane | 5.G.A.1 — plot in the first quadrant | text | 1 | `(4,-2)` |
| `e6m20` | C | Integers | 6.NS.C.7a — order negative numbers | choice | 1 | `<` |
| `e6m21` | C | Integers | 6.NS.C.7c — absolute value | numeric | 1 | `12` |
| `e6m22` | C | Integers | 6.NS.C.7c — magnitude versus order | choice | 1 | `−7` |
| `e6m23` | C | Coordinate plane | 6.NS.C.6b — signed coordinates and quadrants | choice | 1 | `II` |
| `e6m24` | C | Coordinate plane | 6.NS.C.8 — distance on a coordinate grid | numeric | 1 | `10` |
| `e6m25` | S | Integers | 7.NS.A.1c — subtract signed numbers | numeric | 1 | `3` |

#### Section 4 — Expressions, Equations and Statistics

| Item | Tier | Domain | Standard / skill | Kind | Wt | Answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| `e6m26` | F | Expressions and equations | 5.OA.A.1 — order of operations | numeric | 1 | `23` |
| `e6m27` | C | Expressions and equations | 6.EE.A.1 — whole-number exponents | numeric | 1 | `8` |
| `e6m28` | C | Expressions and equations | 6.EE.A.2c — evaluate an expression | numeric | 1 | `27` |
| `e6m29` | C | Expressions and equations | 6.EE.B.7 — solve x + p = q | numeric | 1 | `17` |
| `e6m30` | C | Expressions and equations | 6.EE.B.7 — solve px = q | numeric | 1 | `9` |
| `e6m31` | C | Statistics | 6.SP.B.5c — mean | numeric | 1 | `9` |
| `e6m32` | C | Statistics | 6.SP.B.5c — median | numeric | 1 | `5` |
| `e6m33` | S | Expressions and equations | 7.EE.B.4a — solve a two-step equation | numeric | 1 | `7` |
| `e6m34` | C | Statistics | 6.SP.A.2 — centre versus spread, explained | longtext | 1 | _rubric 0–4_ |
