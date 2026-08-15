# W2-B3 — Mastery assistance opportunity binding repair

## Root cause

W2-06 accepted an item-level `assistanceLevel` but had no Study-issued session,
instructional-context, or opportunity identity and no trusted current
opportunity assistance binding. Tutor/provider-originated metadata could
therefore describe a currently assisted demonstration as `independent`, and
the mastery summarizer had no shared identity on which to detect the conflict.
Replay handling also deduplicated only `evidenceRef`, allowing distinct evidence
references for one opportunity to inflate attempt counts.

## Repair contract

Each evidence item now requires these opaque Study-issued references:

- `sessionRef`
- `instructionalContextRef`
- `opportunityRef`

The input now requires the trusted current evaluation binding:

- `currentSessionRef`
- `currentInstructionalContextRef`
- `currentOpportunityRef`
- `currentOpportunityAssistanceLevel`

These fields are required by the exact runtime schema. A temporary optional
TypeScript projection permits the unchanged R1 adaptive composition to compile
without modifying the out-of-scope orchestrator. The composition still cannot
submit its old unbound payload successfully at runtime.

## Binding policy

The canonical assistance severity order is:

```text
independent < light-hint < guided < reteach-required
```

For evidence whose `opportunityRef` equals `currentOpportunityRef`:

1. learner and concept must match the input scope;
2. session must equal `currentSessionRef`;
3. instructional context must equal `currentInstructionalContextRef`; and
4. claimed assistance must be greater than or equal to Study's bound actual
   assistance.

An understated assistance claim rejects the complete evaluation with
`assistance-binding-conflict`. Rejected results contain no sample or assistance
counts, so the false claim cannot be quietly downgraded or counted.

Historical evidence is not required to share the current session or
instructional context. Correctly scoped, distinct older opportunities remain
available to the existing recency/spacing policy.

## W2-10 reproduction and safe behavior

The permanent reproduction binds the current opportunity to `light-hint`, the
canonical classification produced for a `concept-cue`, then submits a
`demonstrated + independent` item for that same opportunity. The result is a
rejected `insufficient-evidence` evaluation with only
`assistance-binding-conflict`; no independent count is emitted.

When a current opportunity is bound to `guided` and reported as `guided`, it is
accepted as assisted evidence and produces `emerging-evidence` when alone.

When that same guided current sample accompanies two recent, distinct,
correctly scoped historical independent demonstrations, including one spaced
sample from an older session, all three samples are preserved. The historical
pair may still produce `supported-evidence`; the current sample remains counted
only in the guided assistance profile and never as independent.

## Duplicate opportunity ruling

Exact replays of the same evidence identity are deterministically deduplicated
as before. After replay resolution, two distinct evidence identities with the
same `opportunityRef` reject the evaluation with
`duplicate-opportunity-evidence`. Distinct opportunity references are not
collapsed.

## Authority and privacy

Every summarized or rejected result preserves:

```text
studyDecisionRequired = true
studyMutationAllowed = false
authoritative = false
```

The contract still rejects mastery/grade/working-level mutation fields, answer
keys, correct answers or indexes, raw learner responses, and transcripts.
Tutor produces only a bounded recommendation; Study remains the sole mastery
authority.

## Expected convergence work

`EXPECTED_R2_CONVERGENCE_ASSISTANCE_BINDING_UPDATE_REQUIRED`

W2-09R2 must derive the current opportunity identity and actual assistance from
trusted Study state, connect B2 hint/intervention history provenance, populate
the new runtime-required fields, and then remove the temporary optional static
composition projection. Raw Tutor/provider claims must not populate the actual
assistance field.
