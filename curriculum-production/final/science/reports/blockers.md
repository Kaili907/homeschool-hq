# Blockers — final Science production corpus

Status: **NONE**.

The prior H3 final-production findings B1, B2, and B3 are closed by the pinned High School H4
source `a86780a315b5a6ba4f134f35b7033f35707b0e52` and verified on the actual package data,
learner sheets, and adult scoring sheets.

## B1 — declared materials and protective equipment: closed

Lessons `ma-hs12-earth-space-environmental-u05-l07` and `-u05-l09` now declare the washable work
tray, apron or old clothing, and dropper. The learner materials list, learner safe order, adult
required-PPE record, and adult safe order all render the applicable items. H4's source check
`handled-equipment-is-declared-on-the-materials-list` also reads the full structured safe order,
mitigations, and disposal rather than a fixed PPE vocabulary.

## B2 — expected-result fabrication: closed

Lessons `ma-hs10-chemistry-u06-l07` and `-u06-l09` no longer promise cooling or warming. The
alternative tells the learner to measure and record temperature change while supplying neither
direction nor size, states that the calcium-chloride route is excluded, and uses a named published
table to cover the excluded processes. The wording appears on both learner and adult sheets.

## B3 — reserved-vessel ambiguity: closed

The same Chemistry lessons now say that calcium chloride goes only in the disposable double cup
and that the insulated drinking cup holds only the Epsom-salt, baking-soda, and vinegar trials.
The distinction appears in the materials, hazard mitigation, safe order, learner sheet, and adult
guardian record.

## Enforced proof

- H4 source validation: 63/63 mission checks pass.
- H4 source mutation validation: 44/44 mutants are killed.
- Final corpus safety/correctness validation includes
  `h4-b1-b2-b3-closed-on-rendered-sheets` and `no-path-states-what-will-be-observed`.
- Production Gate H3 evaluates all 972 lessons.
