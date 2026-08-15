# W2-B15 Parent Why pending-state truthfulness repair

## Repaired boundary

A valid prerequisite-repair dependency outage can still produce a complete
Wave 2 proposal packet. The selected primary action remains
`check-prerequisite`, the repair source is `reviewed-static-fallback`, the
packet remains `pending-study-decision`, and `studyMutationAllowed` remains
`false`.

Before this repair, Parent Why mapped that pending proposal to the serialized
reason `tutor-unavailable-static-fallback-used` and the reviewed sentence
"Tutor was unavailable, so Study used reviewed static guidance for this
step." Both claimed that Study had already applied a decision.

The closed reason is now
`tutor-unavailable-static-fallback-proposed`. Its exact reviewed copy is:

- title: "Reviewed fallback proposed";
- explanation: "Tutor was unavailable, so reviewed static guidance was
  proposed for Study to consider for this step."

The legacy `used` reason is absent from the closed union and is rejected as an
unknown reason. The existing disclaimer is unchanged:

> This explains an existing recommendation. It does not make or change a
> learning decision.

## Reviewed-copy audit

All eight Parent Why branches were audited for applied-state language. The
prerequisite, reteach, break, adult-review, evidence, and independent-practice
branches already describe a suggestion, request, or evidence state.

The audit found one additional pending-path completion claim:
`hint-level-changed` said that Tutor had changed the amount of help even though
the enclosing Study decision remained pending and Tutor could not execute it.
That closed reason is now `hint-level-change-proposed`, with title "Hint level
change proposed" and explanation "Tutor proposed changing the amount of help
available for this part of the activity." The legacy `changed` reason is also
rejected as unknown.

No arbitrary Parent Why strings were introduced. Every accepted reason still
binds to exact reviewed title, explanation, disclaimer, and provenance
literals. Household, learner, session, instructional-context, opportunity,
and guardian-visibility bindings are unchanged.

## Authority

Parent Why remains explanatory and proposal-only. The attack regression
asserts that the fallback composition remains pending, preserves the selected
primary action, carries `studyMutationAllowed: false` at the packet and Parent
Why projection, and carries `authoritative: false`. The repair performs no
Study mutation, mastery declaration, grade or working-level change, curriculum
assignment, or production operation.

## Required R5 reconvergence work

This repair lane intentionally does not edit convergence gates, mutation
proof, generated schemas, or release artifacts. R5 must:

1. import this repair commit and record its source SHA, parent, cherry-pick
   SHA, stable patch ID, and exact ownership in the convergence hard gate;
2. promote the dependency-outage attack regression to a non-compensable
   Parent Why pending-truthfulness hard-gate family and refresh the focused,
   lane, and full-suite counts;
3. extend mutation proof so restoring either legacy applied-state reason/copy
   makes the focused attack test fail;
4. regenerate
   `json-schema/v2/wave2/wave2-study-decision-packet.schema.json` and
   `json-schema/v2/wave2/SCHEMA-INVENTORY.json`, proving the two legacy reason
   enums and their old copy no longer validate at the serialized boundary;
5. refresh the Wave 2 gate result and release package, including schema
   inventory hashes, manifest, checksums, provenance, status, and any gate
   summary/count artifacts affected by the new repair;
6. update the superseded W2-07 reason table and any old expected literals,
   snapshots, or fixtures found during reconvergence; and
7. run the complete Wave 2 gate, mutation proof, generated-schema checks,
   release checks, and independent rereview from the reconverged candidate.

`EXPECTED_R5_CONVERGENCE_PARENT_WHY_PENDING_TRUTHFULNESS_UPDATE_REQUIRED`

## Ownership

This repair is confined to Parent Why implementation/tests, the single Parent
Why reason-selection seam in the adaptive orchestrator, one narrowly related
composition attack test, and this repair evidence directory. It does not edit
`src/**`, generated schemas, convergence gates, mutation proof, release
artifacts, or other adaptive semantics.
