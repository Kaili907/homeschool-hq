# High-School PE Transfer Authority Semantic Binding R3

R3 closes the semantic-integrity gap left by R2 without changing the repaired
learner or adult curriculum wording.

## Root cause

R2 projected the same `transferAuthority` object into the canonical source,
learner task card, and adult scoring guide, then compared those copies. The
runtime never derived meaning from the actual learner task/completion fields or
adult rubric/success fields. Visible contradictions and several missing nested
fields could therefore pass.

## R3 binding

The three channels now use different executable schemas:

- canonical: `manuel-academy.pe-transfer-authority.v3`;
- learner: `manuel-academy.pe-learner-transfer-semantics.v1`;
- adult: `manuel-academy.pe-adult-transfer-semantics.v1`.

Learner artifacts no longer contain a copied `transferAuthority`; the generator
derives `transferTask` from the task/completion/evidence contract. Adult guides
derive `transferRubric` independently from rubric/success/evidence authority.
The validator normalizes each record and requires canonical = learner = adult
for their shared semantics.

Every actual semantic-bearing learner and adult field also has an individual
SHA-256 binding. A visible wording change therefore fails while all semantic
metadata remains untouched, regardless of vocabulary or paraphrase. This is a
content binding, not a finite phrase dictionary.

The committed authority, learner, and adult JSON Schemas are loaded and
executed directly by `src/lib/transferConsistency.mjs`. Missing required nested
fields, wrong types, unknown enum values, extra properties, missing learner or
adult derivations, semantic differences, and visible-field drift fail closed.

## Controls

Permanent external-copy tests cover:

- learner uninterrupted / adult rest credit;
- learner rest / adult uninterrupted;
- seven-day learner execution / one-day adult hypothetical;
- hypothetical learner plan / seven-day adult execution;
- mutations of every one of the 16 bound learner/adult visible fields;
- removal of the five R2 acceptance fields and six derived required fields;
- duration, continuity, rest, evidence, completion-kind, equal-credit-route,
  and adult-required-evidence mutations;
- wrong types, unknown enums, and unknown fields;
- valid equal-credit and transfer routes;
- the historical false-positive pattern;
- lesson number/location changes.

The attack tests do not mutate canonical authority or learner/adult semantic
metadata when testing visible contradictions.

## Reconciliation

`run-r3-validation.mjs` re-evaluates all 216 reviewed cases and requires:

- 60 historical scoring-authority conflicts → 0;
- 36 historical content-transfer conflicts → 0;
- 120 historical false positives preserved;
- 0 unexplained cases;
- 216 canonical records, learner derivations, adult derivations, preserved
  safety snapshots, and `LEARNER_AUTHORITY` bindings;
- zero copied canonical authority objects in learner or adult artifacts;
- no visible learner/adult curriculum semantic change from R2.

Generated evidence is in `summary.json` and `findings.jsonl`.

## Boundaries

No Study Engine, scorer, Tutor V2, or completion-authority behavior changed.
Stop/rest rules, adaptations, guardian boundaries, privacy, no-body-scoring,
and all repaired PE wording are unchanged.
