# Grade 7 Mathematics Units 1-3 authoring note

Source verified before authoring: `manuel-academy-grades-5-7-8-curriculum-v1.zip`, SHA-256 `3F71F41261B65AC5D13D0B7A0C443E2C7AAEE6B6B0EAA44CFAC6F67BC6436A08`. The archive entries used were `grades/grade-7/courses/mathematics/units.json` and every applicable record in `lessons.jsonl` (U1 days 1-18, U2 days 19-36, U3 days 37-54).

The generators are additive modules using `generatorCore` only. U1 covers the six repeated proportional-reasoning focuses; U2 covers every signed-rational focus; U3 covers every expressions/equivalence focus. Each has one authored worked example per item type. The test suite makes 20 deterministic desk samples per unit and independently parses prompts for 600 generated items per item type (200 at each difficulty), including a constant-RNG distractor gate.

Exactness: U1 ratios/unit rates are numerator-denominator integer pairs reduced by Euclid; U2 signed fractions keep a signed numerator and positive denominator, using integer addition and reduction; U3 uses integer coefficients and substitutions. No derived answer uses floating point. Percent and probability are outside Units 1-3; later Grade 7 units must preserve percent changes and probabilities as integer fractions by cross-multiplication/reduction.
