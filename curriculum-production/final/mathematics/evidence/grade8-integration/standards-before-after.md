# Standards Before and After — Proof

Every number in this document is recomputed by `validate.py` from the sealed course data, the
accepted overlay, and `schedule.csv`. Nothing here is asserted by hand.

- **Before** = the 180 lessons of sealed release `1.0.0`.
- **After** = the 180 scheduled days of the integrated plan.
- Counts are **instructional days carrying the code**, not merely presence.

---

## 1. Headline

| | Before | After |
| --- | --- | --- |
| Official Michigan Grade 8 content standards covered | **27 / 28** | **28 / 28** |
| Missing | `8.EE.2` | none |
| Codes present anywhere in the course | 30 | 31 |
| Codes that lose all coverage | — | **none** |
| Units retaining their unit assessment | 10 / 10 | **10 / 10**, plus the 8.EE.2 correction assessment |

Standards source: Michigan K-12 Standards — Mathematics, Grade 8 on pp. 52–56,
`sha256 dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54`, custody recorded in
`../grade8-mathematics/standards-custody.md`. No standard is invented here; the 28-code list is
the one that document verified against the primary source.

## 2. The 28/28 mathematics expectation

Release `1.0.0` ran 18 validation checks and verified standards-domain completeness for exactly
one course — `grade8-finance-pf1-pf7`. There is no equivalent check for mathematics, which is
the root cause recorded in `standards-custody.md` §5: a missing code inside an otherwise
well-formed course was invisible to the suite.

This integration supplies the missing expectation as a runnable check rather than a claim:

```
grade8-math-28-standards   the 28 custody-verified official Grade 8 content standards
                           each appear on at least one scheduled day of ma-g8-mathematics
```

`validate.py` runs it as `after-28-of-28-math-expectation`, and runs the negative control
`before-27-of-28` beside it, so the check is shown to be capable of failing.

## 3. Per-standard proof

Domain totals: 8.NS 2 · 8.EE 8 · 8.F 5 · 8.G 9 · 8.SP 4 = **28**.

| Standard | Days before | Unit(s) before | Days after | Unit(s) after | Δ |
| --- | ---: | --- | ---: | --- | ---: |
| `8.NS.1` | 18 | 1 | 18 | 1 | 0 |
| `8.NS.2` | 18 | 1 | 18 | 1 | 0 |
| `8.EE.1` | 18 | 2 | 18 | 2 | 0 |
| **`8.EE.2`** | **0** | **— (the gap)** | **4** | **1** | **+4** |
| `8.EE.3` | 18 | 2 | 18 | 2 | 0 |
| `8.EE.4` | 18 | 2 | 18 | 2 | 0 |
| `8.EE.5` | 18 | 4 | 18 | 4 | 0 |
| `8.EE.6` | 18 | 4 | 18 | 4 | 0 |
| `8.EE.7` | 36 | 3, 10 | 32 | 3, 10 | −4 |
| `8.EE.8` | 36 | 6, 10 | 32 | 6, 10 | −4 |
| `8.F.1` | 18 | 5 | 18 | 5 | 0 |
| `8.F.2` | 18 | 5 | 18 | 5 | 0 |
| `8.F.3` | 18 | 5 | 18 | 5 | 0 |
| `8.F.4` | 36 | 5, 10 | 32 | 5, 10 | −4 |
| `8.F.5` | 18 | 5 | 18 | 5 | 0 |
| `8.G.1` | 18 | 7 | 18 | 7 | 0 |
| `8.G.2` | 18 | 7 | 18 | 7 | 0 |
| `8.G.3` | 18 | 7 | 18 | 7 | 0 |
| `8.G.4` | 18 | 7 | 18 | 7 | 0 |
| `8.G.5` | 18 | 7 | 18 | 7 | 0 |
| `8.G.6` | 18 | 8 | 18 | 8 | 0 |
| `8.G.7` | 36 | 8, 10 | 32 | 8, 10 | −4 |
| `8.G.8` | 18 | 8 | 18 | 8 | 0 |
| `8.G.9` | 18 | 9 | 18 | 9 | 0 |
| `8.SP.1` | 18 | 9 | 18 | 9 | 0 |
| `8.SP.2` | 18 | 9 | 18 | 9 | 0 |
| `8.SP.3` | 36 | 9, 10 | 32 | 9, 10 | −4 |
| `8.SP.4` | 18 | 9 | 18 | 9 | 0 |

Practice standards, which are published separately and are not Grade 8 content standards:

| Standard | Days before | Days after | Δ | Note |
| --- | ---: | ---: | ---: | --- |
| `MP.2` | 18 | 22 | +4 | Unit 1; the correction block carries it |
| `MP.6` | 18 | 22 | +4 | Unit 1; the correction block carries it |
| `MP.4` | 18 | 14 | −4 | Unit 10; still on every one of its 14 retained days |

### How to read the five −4 rows

`8.EE.7`, `8.EE.8`, `8.F.4`, `8.G.7` and `8.SP.3` are the only content standards Unit 10
carries, and each is a **revisit**. Every one of them:

- keeps **all 18 days** of the dedicated unit that owns it (3, 6, 5, 8, 9 respectively) —
  untouched;
- keeps that unit's own **unit assessment**, which is retained;
- keeps **14 further days** of Unit 10 revisit, down from 18.

So the floor for each is 18 owned days plus 14 revisit days = 32, against a Michigan
requirement of "covered". No standard approaches a coverage risk. `validate.py` asserts this
as `no-standard-falls-below-its-owning-unit`.

`MP.4` has no owning unit — it is a practice standard and appears only in Unit 10. It survives
on all 14 retained days, asserted as `withdrawn-practice-standards-survive-in-unit`.

## 4. Mastery-evidence proof

| Obligation | Before | After |
| --- | --- | --- |
| Unit assessment days | 10 (`u01…u10-l16`) | 10 — none withdrawn |
| Assessment-preparation days | 10 | 10 — none withdrawn |
| Targeted-correction days | 10 | 9 — `u10-l17` withdrawn |
| Reteach-and-varied-practice days | 10 | 10 — Unit 10 keeps `u10-l08` |
| Performance task planning + build | 20 | 20 — none withdrawn |
| Independent mastery evidence for `8.EE.2` | **none** | `ma-g8-mathematics-c01-assessment`, 30 points, 6 prompts, day 22 |
| Multi-occasion mastery rule on every lesson | yes | yes — carried by the 4 new records |

The single reduction is `u10-l17`, the last targeted-correction day of the year. It follows the
final assessment and precedes only the publication day, so no instruction remains for it to
route into; its function is folded into the revision step of `u10-l18`. The nine remaining
correction days — one per earlier unit — are untouched.

`8.EE.2` mastery is not claimed from one occasion. The three lessons supply formative evidence,
day 22 supplies independent evidence, and `u01-l22`'s tutor route schedules the second occasion
in Unit 8, where solving `x² = p` for a side length recurs.

## 5. Validation-suite changes required at 1.0.1

Four of the sealed release's 18 checks are affected — three whose assertion changes and one
whose recorded detail changes. State them explicitly rather than letting them silently drift:

| Check | 1.0.0 | 1.0.1 | Why |
| --- | --- | --- | --- |
| `lesson-count` | 2736 | 2740 | 4 lesson records added |
| `grade-lesson-counts` | `{5: 900, 7: 900, 8: 936}` | `{5: 900, 7: 900, 8: 940}` | same 4 records |
| `schedule-covers-every-lesson-once` | `scheduled=2736, lessons=2736` | `scheduled=2736, required=2736, reserve=4` | the 4 withdrawn records are retained but not scheduled |
| `unique-lesson-ids` | `2736 unique` | `2740 unique` | assertion survives; the recorded number does not |
| **new** `grade8-math-28-standards` | — | `28/28` | the root-cause fix; closes the class of gap that produced this correction |

Unchanged: `three-grades`, `ten-courses-per-grade`, `course-count`, `unique-course-ids`,
`lesson-required-fields`, `optional-media-and-fallback`,
`accessibility-depth`, `safety-depth`, `multi-occasion-mastery`, `original-text-count`,
`frozen-baselines-recorded`, `grade8-finance-pf1-pf7`, `grade8-finance-72-sessions`,
`no-required-photo-or-voice`.

The 180-day and 36-week family calendar is unchanged, so no other Grade 8 course is affected.
