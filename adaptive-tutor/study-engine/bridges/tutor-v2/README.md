# Study ↔ Tutor V2 bridge

This additive bridge has one supported end-to-end entrypoint:
`orchestrateTutorV2Bridge`. It accepts a Study-owned V2 invocation, validates
the exact canonical request and Study permits, resolves explicit age policy and
bounded ephemeral memory, validates the minimized W1-06 provider projection,
admits exact reviewed content through a Study-owned provenance authority, calls
the W1-03 provider-independent port once, and applies the W1-04 policy chain
before producing a learner-safe action proposal and W1-06 evidence.

## Wave 1 structural privacy boundary

Free-form text is not considered safe because a lexical scanner fails to find
a suspicious phrase. Before provider execution, each learner-safe item and
each non-null grounding text is hashed over its exact UTF-8 bytes with SHA-256.
The bridge asks `ReviewedTutorContentAuthorityPort` whether that exact
purpose/ref/digest is admitted for the opaque household, learner, session,
interaction, and lesson scope. Grounding text must also match its declared
digest. Missing, rejected, throwing, unavailable, or malformed approval fails
closed before the provider is called.

After canonical response and policy validation, `explain`, `hint`, `ask-check`,
`show-example`, and `reteach` text requires a second exact approval bound to
the proposal ref, action kind, scope, digest, and grounding refs. Provider-
authored reason codes for `check-prerequisite`, `suggest-break`, `escalate`,
and `return-to-lesson` require the same structural admission. The approval port
and its decisions are never included in `provider.execute()`. Existing lexical
rules remain defense in depth only; unapproved benign prose fails identically
to unapproved suspicious prose.

Raw free-form learner attempts are not disclosed to providers in Wave 1. Wave
1 also does not permit unrestricted novel provider-generated learner-facing
academic prose: the provider can only select exact content already admitted by
trusted Study infrastructure. Richer generative dialogue requires a separately
reviewed later-wave privacy and safety architecture. The included in-memory
authority is deterministic foundation/test infrastructure, not production
content-registry wiring.

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
