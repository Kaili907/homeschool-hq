# Grade 8 Mathematics — Release Correction Overlay

**Correction ID:** `g8-math-8ee2-2026-08-12`
**Targets:** curriculum release `1.0.0`, course `ma-g8-mathematics`
**State:** authored and validated — **not integrated**

## Summary

An independent verification of the published Grade 8 Mathematics course against the official
Michigan Grade 8 mathematics standards found **one real gap** and **refuted one reported gap**.

| Reported concern | Verdict | Action |
| --- | --- | --- |
| `8.EE.2` not covered | **CONFIRMED** | 3 lessons + 1 assessment added here |
| Inequality prerequisite gap | **REFUTED** | none — Grade 8 has no inequality standard |

Release `1.0.0` covers **27 of the 28** official Michigan Grade 8 content standards. The
single missing standard is `8.EE.2`:

> "Use square root and cube root symbols to represent solutions to equations of the form
> x² = p and x³ = p, where p is a positive rational number. Evaluate square roots of small
> perfect squares and cube roots of small perfect cubes. Know that √2 is irrational."

It is absent at every level — zero occurrences across `units.json`, all 180 lessons, and all
10 assessments. The course's only root content is Unit 1's "approximating square roots",
which serves `8.NS.2`; approximation and exact-root notation are distinct competencies, so
the content is genuinely missing rather than merely uncoded.

**The inequality concern does not survive verification.** Michigan Grade 8 contains no
inequality standard at all — the word does not appear anywhere in the Grade 8 section of the
official document. Inequalities are owned by `6.EE.5`, `6.EE.8`, and `7.EE.4b`, and Grade 7
of this curriculum already covers `7.EE.4` with a dedicated inequalities unit. Authoring
Grade 8 inequality lessons would attach instruction to a standard that does not exist at this
grade, so none were written.

## Contents

| File | Purpose |
| --- | --- |
| `standards-custody.md` | Primary-source custody, the full 28-standard list, coverage reconciliation, the refuted inequality claim, and root-cause analysis |
| `lessons.jsonl` | 3 additive lessons closing `8.EE.2` |
| `assessment.json` | 1 correction assessment, 30 points, 6 prompts |
| `correction-manifest.json` | Machine-readable overlay descriptor |
| `INTEGRATION.md` | Integration contract, ID-stability guarantee, and the one scheduling decision integration must make |
| `validate.py` | Runnable 14-check validator |

## What was added

| ID | Covers |
| --- | --- |
| `ma-g8-mathematics-u01-l19` | Root symbols as exact solutions to `x² = p` and `x³ = p` |
| `ma-g8-mathematics-u01-l20` | Evaluating small perfect squares and perfect cubes |
| `ma-g8-mathematics-u01-l21` | `√2` is irrational; consolidation and transfer |
| `ma-g8-mathematics-c01-assessment` | Independent mastery evidence for `8.EE.2` |

The three lessons map one-to-one onto the standard's three requirements. Nothing else was added.

## Guarantees

- **`1.0.0` is untouched.** `shasum -a 256 -c SHA256SUMS.txt` reports 181/181 `OK`, and
  `git status` shows no change anywhere under `curriculum-content/`. Both are asserted as
  validator checks, not prose.
- **No existing ID changes.** Unit 1 ends at `l18` in the sealed release; these lessons
  continue at `l19`–`l21`. Zero collisions against all 936 sealed Grade 8 IDs, and the new
  IDs satisfy the sealed `lesson.schema.json` pattern.
- **No invented standards.** Every code traces to the custody-verified source document.
- **Grade 8 Mathematics is not rewritten.** Only the one missing standard is addressed.

## Verification

```bash
python3 validate.py
```

Expect `14/14 checks passed` / `OVERALL: PASS`.

## Standards source

Michigan K-12 Standards — Mathematics (94 pp., Grade 8 on pp. 52–56),
`sha256 dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54`, retrieved
2026-08-12 from `michigan.gov`. The digest is bit-identical to the one recorded
independently by the earlier High School Mathematics work, which establishes that both
reviews read the same authentic document. See `standards-custody.md` for full custody.

## Status boundary

This overlay is authored, validated, and staged. It is not integrated into the release, not
merged into any host application, and is not a claim of state approval, accreditation,
licensure, or automatic credit. Integration requires the decision recorded in
`INTEGRATION.md` §3 and should produce a new release version rather than editing `1.0.0`.
