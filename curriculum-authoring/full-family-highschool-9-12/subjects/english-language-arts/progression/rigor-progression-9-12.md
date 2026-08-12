# Rigor Progression: English 9 → 10 → 11 → 12

## The problem this document solves

Michigan publishes high-school ELA in two grade bands, 9-10 and 11-12, not as four
grade-level standard sets. A curriculum that aligns naively to bands produces two pairs of
near-identical courses: English 10 becomes English 9 with longer texts, and English 12
becomes English 11 with longer texts. That is the failure mode this sequence is designed
against.

## What the state does and does not prescribe

**Prescribed by Michigan.** Two bands (9-10, 11-12), five strands, and — critically —
*within-band* differentiation in standard 10 of both reading strands. The state itself
distinguishes:

- 9-10.RL.10 / 9-10.RI.10: "By the end of **grade 9** … proficiently, **with scaffolding as
  needed** at the high end of the range." / "By the end of **grade 10** … at the high end
  … **independently and proficiently**."
- 11-12.RL.10 / 11-12.RI.10: "By the end of **grade 11** … **with scaffolding as needed**."
  / "By the end of **grade 12** … **independently and proficiently**."

**Not prescribed by Michigan.** The distribution of standards 1-9 between the two years of
a band. That split is a Manuel Academy curricular decision. This mirrors how the published
Manuel Academy release already handles Michigan's grades 6-8 science band, where
`standards/standards-reference.md` states plainly that "the state band does not itself
prescribe this exact Grade 7/Grade 8 split."

## The organizing principle

The four courses are not four difficulty settings. They are **two bands crossed with two
levels of withdrawn support**, with the support axis taken directly from standard 10:

|  | Supported entry to band | Independent at band's high end |
| --- | --- | --- |
| **Band 9-10** | English 9 | English 10 |
| **Band 11-12** | English 11 | English 12 |

Escalation therefore happens twice on each axis, and the two axes are independent. English
11 is harder than English 10 on the *band* axis while resetting on the *support* axis —
which is correct, because entering the 11-CCR band is genuinely a new difficulty that
warrants renewed scaffolding.

## What actually changes, course by course

These are the mechanisms encoded in `authoring/rigor.py` and rendered into every one of the
720 lesson objects — not adjectives in a course description.

### Who supplies the method

| | Modeling | Guided practice | Independent application |
| --- | --- | --- | --- |
| **English 9** | Worked example on a short passage; success criteria stated explicitly before practice | Two supported examples; prompts fade on the second | New application **with the criteria checklist still available** |
| **English 10** | One compressed example; learner **reconstructs** the success criteria | One supported example, then withdrawal; second attempt unaided | New application **without the checklist**; self-check against criteria stated from memory |
| **English 11** | Modeled on text that resists a first reading; shows where a competent reader slows, backtracks, suspends judgment | One example on genuinely difficult material with an **annotated exemplar**; learner must state what the exemplar does not settle | New application on 11-CCR material; may consult exemplar; **must record where the text left matters uncertain** |
| **English 12** | **No worked exemplar exists.** Facilitator states standard and audience; learner proposes and justifies an approach | Learner **designs the method**, names its known weakness, revises after one round of critique; facilitator questions but does not supply method | Learner executes **their own method on self-selected material** and reports the limits of the resulting claim |

### What mastery requires

- **English 9** — two occasions, at least one on an unseen text.
- **English 10** — two occasions, at least one at the **high end** of the 9-10 band with **no exemplar**.
- **English 11** — two occasions, at least one on **11-CCR material**, including an account of **what remains uncertain**.
- **English 12** — two occasions with **no supplied method**, including one piece **defended against prepared objections from a reader outside the household** when the family chooses.

### What assessment conditions allow

- **English 9** — instructional scaffolds remain available on the unit assessment.
- **English 10** — instructional scaffolds are withdrawn; access accommodations remain.
- **English 11** — reference works and style manuals remain; annotated exemplars do not.
- **English 12** — postsecondary conditions: open reference works, **closed method supply**, full citation, and an explicit statement of the limits of the claim.

### What the assessment instrument itself contains

| | Prompts | Points | Added dimension |
| --- | --- | --- | --- |
| English 9 | 7 | 38 | — |
| English 10 | 7 | 38 | — |
| English 11 | 8 | 44 | **Uncertainty and limits**: where the sources leave the question unsettled, and what would settle it |
| English 12 | 9 | 52 | Uncertainty and limits **plus a source-trail audit**: every claim traced to a source, every source assessed for strengths and limitations relative to *this* task |

### What discussion demands

- **English 9** — prepared evidence, agreed collegial rules; facilitator may still moderate turn-taking.
- **English 10** — learner sets rules and roles with peers and leads at least one exchange unmoderated.
- **English 11** — learner must represent a position they do not hold before arguing their own.
- **English 12** — learner defends against prepared objections, concedes what should be conceded, and identifies what further evidence would change the conclusion.

## Why English 12 is not English 10 with harder passages

Four differences are structural rather than cosmetic:

1. **The method is not supplied.** In English 10 the learner performs a taught move
   unaided. In English 12 there is no taught move: the learner proposes an approach and
   justifies it before beginning. This is the difference between unaided execution and
   independent design, and it is the actual gate to postsecondary work.

2. **The object of study is the learner's own research question.** English 12 Units 2, 3,
   8, and 10 are built on a self-generated question, an annotated source landscape, a
   credibility ranking, and adjudication of a genuine disagreement. English 10's research
   unit answers a question about assigned material.

3. **Claims must be bounded.** English 12 requires a statement of what the evidence does
   *not* establish in every assessment and in the independent application segment of every
   lesson. English 9 and 10 require evidence; English 11 introduces uncertainty; English 12
   makes bounding the claim a scored dimension.

4. **The source trail must survive audit.** English 12's ninth assessment prompt requires a
   trail a reader could re-walk, with each source assessed for strengths and limitations
   *relative to the specific task* (11-12.W.8). No earlier course scores this.

## Standards distribution across the sequence

Every applicable code in both bands is covered, and the union is verified mechanically.

| Band | Applicable codes | Covered | Course A | Course B |
| --- | --- | --- | --- | --- |
| 9-10 | 41 (RL.8 not applicable) | 41 | English 9: 40 | English 10: 38 |
| 11-12 | 41 (RL.8 not applicable) | 41 | English 11: 41 | English 12: 39 |

Deliberate distribution choices:

- **9-10.RI.9** (seminal U.S. documents) sits in English 10, not English 9, so it can be
  taught alongside rhetorical evaluation rather than as a reading exercise.
- **11-12.RL.9** (foundational American literature) is weighted to English 11, which is the
  American literature year; English 12 turns to independent scholarship rather than
  re-covering the period survey.
- **11-12.W.3** (narrative) sits in English 11 Unit 4. English 12 has no narrative unit;
  its writing load is argument, synthesis, disciplinary explanation, and research. This is
  a deliberate senior-year decision, and it is the one place the sequence chooses depth in
  academic writing over breadth of genre.

## Verification

`validation/validate.mjs` asserts the progression mechanically: distinct rigor profile
strings per course, monotonically non-decreasing assessment weight, band assignment
correctness, and full band coverage across each pair. See the validation report.
