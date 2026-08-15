# W2-B15 validation

Validation date: 2026-08-15

Branch: `mac/tutor-v2-w2-parent-truthfulness-repair-r4`

Starting SHA: `2e846e33dffe493ab5cc05fc4fd1d5618ee4a311`

## RED and truth proof

An exact-parent disposable snapshot constructed the required composition:

- valid Wave 2 request;
- selected action `check-prerequisite`;
- prerequisite-repair graph dependency throws;
- repair source `reviewed-static-fallback`;
- final status `pending-study-decision`; and
- `studyMutationAllowed: false`.

At the starting SHA, the historical assertion passed 1/1 and reproduced:

> Tutor was unavailable, so Study used reviewed static guidance for this step.

After applying this repair to that disposable snapshot, the unchanged
historical assertion failed 0/1. Its actual value was:

> Tutor was unavailable, so reviewed static guidance was proposed for Study to
> consider for this step.

The permanent attack test passes with the new value and also asserts the
pending status, selected action, repair source, packet authority flags, Parent
Why authority flags, new reason code, exact reviewed copy, and absence of
Study-used/applied/changed/assigned/performed/completed language.

## Validation results

| Check | Result |
| --- | --- |
| Parent Why strict TypeScript | PASS |
| Complete Tutor V2 strict TypeScript | PASS |
| Parent Why owned suite | 25/25 PASS |
| Adaptive orchestrator and composition suites | 21/21 PASS |
| Required dependency-outage truth attack | 1/1 PASS |
| Guardian visibility authorization focus | 1/1 PASS |
| Wave 2 composition regressions | 25/25 PASS |
| Complete relevant Wave 2 lane regression | 291/291 PASS |
| Full Tutor V2 convergence regression | 288/288 PASS |
| Wave 1 reviewed-content privacy/provenance regression | 78/78 PASS |
| Wave 1 generated schema inventory | 23 schemas plus inventory PASS |
| Wave 2 generated schema check | EXPECTED R5 DRIFT: `wave2-study-decision-packet.schema.json` |
| Whitespace validation | PASS |

The Wave 2 generated schema failure is expected and required by ownership. The
serialized decision schema still contains the two superseded reason/copy
branches; this repair session was explicitly forbidden from editing generated
schemas. R5 must regenerate the schema and inventory, then update convergence
and release evidence as detailed in `README.md`.

## Closure, scope, guardian, and authority regressions

The 25-test Parent Why suite proves that arbitrary transcripts, learner
answers, answer keys, credentials, private notes, diagnostic prose,
personality judgments, arbitrary titles, arbitrary explanations, and
reason/copy mismatches remain invalid.

Household, learner, session, instructional-context, and current-opportunity
provenance mismatches still fail closed. Selected and authorized learner
references must still agree. The focused convergence check proves that the
Study-issued guardian visibility authorization remains learner-bound and that
foreign visibility scope is rejected.

The exact disclaimer remains unchanged. Parent Why still rejects added
authority, Study-mutation, and mastery-declaration fields. The pending outage
case returns `authoritative: false`, Parent Why `studyMutationAllowed: false`,
packet `studyMutationAllowed: false`, `studyDecisionRequired: true`, and
`studyEngineRemainsAuthority: true`.

## Reviewed-copy audit

All eight closed reason branches were inspected and exercised. Six were
already proposal/evidence safe. Static fallback was repaired as the reported
blocker. Hint-level copy was the only additional completed-state claim and was
also replaced by a proposal-safe closed reason and exact copy. Both legacy
applied-state reason codes now return `PARENT_EXPLANATION_UNKNOWN_REASON` at
the runtime boundary.

## Ownership

Tracked changes remain confined to:

- `adaptive-tutor/study-engine/tutor-v2/parent-explanations/**`;
- the Parent Why reason selector in
  `adaptive-tutor/study-engine/tutor-v2/adaptive/orchestrator.ts`;
- the narrowly related Parent Why dependency-outage case in
  `adaptive-tutor/study-engine/tutor-v2/adaptive/composition-repair.test.ts`;
  and
- `docs/study-tutor-v2/wave2/repairs/w2-b15-parent-truthfulness/**`.

No `src/**`, generated schema, convergence gate, mutation proof, release
artifact, hosted service, production configuration, or unrelated adaptive
semantics were changed.

`W2_PARENT_TRUTHFULNESS_REPAIR_READY_FOR_RECONVERGENCE`
