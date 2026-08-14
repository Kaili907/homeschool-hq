# Study ↔ Tutor V2 bridge

This additive bridge has one supported end-to-end entrypoint:
`orchestrateTutorV2Bridge`. It accepts a Study-owned V2 invocation, validates
the exact canonical request and Study permits, resolves explicit age policy and
bounded ephemeral memory, validates the minimized W1-06 provider projection,
calls the W1-03 provider-independent port once, and applies the W1-04 policy
chain before producing a learner-safe action proposal and W1-06 evidence.

The bridge exposes no Study mutation port. All Tutor actions—including break,
adult-review, prerequisite, and return-to-lesson actions—remain proposals that
require Study validation. Static fallback content is Study-supplied, reviewed,
contract-exact, grounded, age-checked, and deterministic. Provider failures are
mapped to W1-02's canonical fallback vocabulary while minimized provider status
detail remains available for operational classification.

The accepted-event ledger uses `(sessionRef, requestRef, eventVersion)` plus a
SHA-256 fingerprint of the minimized Study-facing result. Identical replay
returns no proposal or evidence; conflicting content under the accepted
identity is quarantined. Memory is updated only after the ledger accepts the
effect and stores no raw prose or transcript.

Production callers must supply authoritative Study permission and safety
ports. Missing, throwing, or rejecting safety classification fails closed.
