# Grade 9 Handoff Update Note

**Applies to:**
`curriculum-authoring/full-family-highschool-9-12/subjects/mathematics/sequence-derivation.md`
**Trigger:** applies only once this integration is applied and `1.0.1` is sealed. Until then the
upstream text is correct as written and must not be changed.
**Scope:** two sections. No other part of the Grade 9–12 architecture is affected.

> **Note on a pre-existing error.** Upstream §3 currently says the bridge topic sits in
> "Grade 9 Unit 2". It does not. Verified against
> `…/courses/grade-9/units.json` and `lessons.jsonl`: the topic *"square and cube roots as
> solutions to x squared and x cubed equations"* is a **Unit 1** topic
> ("Quantitative Reasoning, Units, and Rational Exponents", `N-Q`/`N-RN`), delivered at
> `ma-g9-mathematics-u01-l03`, `-l09`, `-l15`. Grade 9 Unit 2 is "Expression Structure and
> Equivalence" (`A-SSE.1/2`) and contains no root content. Upstream §7 already says `G9 U01`
> correctly, so the document contradicts itself. The replacement text below fixes that as well,
> and `validate.py` asserts the unit number rather than trusting either source.

## 1. What changes and what does not

| | Before integration | After integration |
| --- | --- | --- |
| Grade 8 coverage of `8.EE.2` | absent | delivered on days 19–21, assessed day 22 |
| Grade 9 **Unit 1** root-and-cube-root topic | **gap repair** — carrying a standard Grade 8 never taught | **review and escalation** — revisiting a standard Grade 8 now delivers |
| Grade 9 unit structure, ordering, standards | — | **unchanged** |
| The inequality handoff | Grade 9 adds inequality work Grade 8 never covers | **unchanged and still correct** — Michigan Grade 8 has no inequality standard |

The Grade 9 bridge topic should be **retained, not removed**. `N-RN` and `A-REI.4` still need
root fluency, and a review pass over a standard the prior year now teaches is normal vertical
design. What changes is only its *status*: it stops being a documented repair for a missing
prerequisite.

## 2. Replacement text — §3 "Where Grade 8 actually ends"

Replace the standards line and the closing paragraph.

**Current standards line:**

> `8.NS.1, 8.NS.2` · `8.EE.1, 8.EE.3, 8.EE.4, 8.EE.5, 8.EE.6, 8.EE.7, 8.EE.8` ·
> `8.F.1–8.F.5` · `8.G.1–8.G.9` · `8.SP.1–8.SP.4`

**Replacement:**

> `8.NS.1, 8.NS.2` · `8.EE.1–8.EE.8` · `8.F.1–8.F.5` · `8.G.1–8.G.9` · `8.SP.1–8.SP.4`
>
> That is all 28 official Michigan Grade 8 content standards.

**Current closing paragraph:**

> **Identified gap: `8.EE.2` is not covered by the Grade 8 course.** That standard introduces
> square root and cube root symbols and the solutions of `x² = p` and `x³ = p`. It is a
> prerequisite for `N-RN` and for `A-REI.4`. Grade 9 Unit 2 therefore explicitly carries
> "square and cube roots as equation solutions" as a bridge topic. This is a deliberate,
> documented handoff repair, not an assumed prerequisite.

**Replacement:**

> **Resolved: `8.EE.2` was absent from release `1.0.0` and is delivered from `1.0.1`.** An
> independent standards review found the gap (correction `g8-math-8ee2-2026-08-12`, commit
> `e9ead0c`); release `1.0.1` schedules three lessons on course days 19–21 and a 30-point
> correction assessment on day 22, inside the same 180-day calendar. Grade 8 now exits with
> square root and cube root symbols, the solutions of `x² = p` and `x³ = p`, exact evaluation
> of small perfect squares and cubes, and the irrationality of `√2`.
>
> Grade 9 **Unit 1** continues to carry "square and cube roots as solutions to x squared and x
> cubed equations" — at `ma-g9-mathematics-u01-l03`, `-l09` and `-l15` — now as **review and
> escalation into `N-RN` and `A-REI.4`** rather than as a handoff repair. (The earlier text
> located this topic in Unit 2; it has always been a Unit 1 topic, and §7 below already said so.)
> The prerequisite is no longer assumed and no longer repaired: it is taught in the grade that
> owns it.

## 3. Replacement text — §7 "Prerequisite handoff chain", row `8 → 9`

**Current row:**

> | 8 → 9 | G9 U01 extends `8.NS.1–2` and `8.EE.1` into `N-Q`/`N-RN` and bridges the missing `8.EE.2`; U02–U04 formalize `8.EE.7–8` into `A-SSE`/`A-REI` and add the inequality work Grade 8 never covers; U05–U06 add quadratics and equation creation; U07–U09 extend `8.F.1–5` into `F-IF`/`F-BF`/`F-LE`; U10 extends `8.SP.1–4` into `S-ID`. |

**Replacement row:**

> | 8 → 9 | G9 U01 extends `8.NS.1–2`, `8.EE.1` and `8.EE.2` into `N-Q`/`N-RN` — `8.EE.2` is delivered in Grade 8 from release `1.0.1`, so U01 revisits it as review rather than repairing it; U02–U04 formalize `8.EE.7–8` into `A-SSE`/`A-REI` and add the inequality work Grade 8 never covers; U05–U06 add quadratics and equation creation; U07–U09 extend `8.F.1–5` into `F-IF`/`F-BF`/`F-LE`; U10 extends `8.SP.1–4` into `S-ID`. |

Every other row of the chain is unchanged.

## 4. What must not be changed

- **The inequality clause stays.** Michigan Grade 8 contains no inequality standard — zero
  occurrences of "inequalit" in the Grade 8 section of the source document. The upstream
  sentence is conformance, not a defect, and the earlier review already refuted the reported
  inequality gap (`../grade8-mathematics/standards-custody.md` §4).
- **§8 "Standards review and corrections" stays.** Its four findings concern Grades 9–12 and are
  untouched by this integration.
- **The custody digest stays.** Both documents record
  `sha256 dbbd4e341a046f22fa4df1dec4af2fd06b35249ad3e3ff9734a3f03bcd6b1a54` for the Michigan
  mathematics standards; the bit-identical match across two independent retrievals is the
  evidence that both reviews read the same authentic document.

## 5. Ownership boundary

`curriculum-authoring/full-family-highschool-9-12/` is outside this session's ownership, so this
note is written but **not applied**. Applying it is step 9 of `INTEGRATION-PLAN.md` §8, gated on
`1.0.1` being sealed. Applying it earlier would make the Grade 9 document describe a Grade 8
course that does not yet exist.

`validate.py` asserts that every block quoted above as "Current" appears verbatim in the upstream
file (`grade9-note-quotes-upstream-verbatim`), so this note cannot silently drift from its target.
