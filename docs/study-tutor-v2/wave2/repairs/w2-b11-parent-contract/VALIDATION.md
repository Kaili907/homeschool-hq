# W2-B11 validation

Validation date: 2026-08-15

Branch: `mac/tutor-v2-w2-parent-contract-repair-r3`

Starting SHA: `22c3734bd436c41ba8d24409dcaa146d35914e2f`

## Focused repair checks

| Check | Result |
| --- | --- |
| Parent Why strict TypeScript | PASS |
| Complete Tutor V2 strict TypeScript | PASS |
| Root strict TypeScript | PASS |
| Complete Tutor V2 compilation | PASS |
| Parent Why owned suite | 23/23 PASS |
| All eight reviewed reason branches | PASS and result-schema valid |
| Cross-child recommendation provenance | PASS: rejected |
| Cross-household recommendation provenance | PASS: rejected |
| Wrong session provenance | PASS: rejected |
| Wrong instructional-context provenance | PASS: rejected |
| Wrong opportunity provenance | PASS: rejected |
| Legacy unbound producer request | PASS: rejected |
| Arbitrary private explanation string | PASS: result-schema rejected |
| Arbitrary answer/transcript strings | PASS: result-schema rejected |
| Arbitrary credential string | PASS: result-schema rejected |
| Arbitrary diagnosis/personality/private-note strings | PASS: result-schema rejected |
| Reason/copy mismatch | PASS: result-schema rejected |
| Authority, Study mutation, and mastery fields | PASS: result-schema rejected |
| Wave 2 global schema check | PASS: existing 2 schemas plus inventory exact |
| Whitespace validation | PASS |

No global schema was generated or changed.

## Expected convergence state

The full compiled Wave 2 lane command reported 197/201 passing. Its four
failures are the unchanged adaptive orchestrator tests that expect a
`pending-study-decision` from the legacy Parent Why producer. That producer
does not supply the new runtime-required household, session,
instructional-context, or opportunity bindings, so Parent Why rejects it and
the orchestrator safely returns `reviewed-static-fallback`.

A separate adaptive subsystem-fallback run reported 50/57 passing. It contains
the same four orchestrator expectations plus three disabled-subsystem tests
whose otherwise successful composition also reaches the unchanged unbound
Parent Why producer and therefore returns the same safe fallback. Safety-hold,
invalid-request, null-Parent-Why, and explicit subsystem-failure behavior
continued to pass.

The producer and its fixtures are outside W2-B11 ownership and were not edited.
R4 convergence must derive the complete tuple from trusted Study authority and
populate both request scope and recommendation/policy provenance.

`EXPECTED_R4_CONVERGENCE_PARENT_WHY_SCOPE_BINDING_UPDATE_REQUIRED`

## Ownership

Only these assigned roots contain tracked changes:

- `adaptive-tutor/study-engine/tutor-v2/parent-explanations/**`
- `docs/study-tutor-v2/wave2/repairs/w2-b11-parent-contract/**`

No Study mutation, mastery declaration, production operation, hosted service,
Netlify command, or Supabase command was performed.
