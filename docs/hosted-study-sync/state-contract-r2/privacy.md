# Privacy and response-content decision

## Always excluded

The snapshot has literal-false markers and the parser has deep canary rejection for:

- PINs and PIN-derived digests;
- bearer/access/refresh authorization material;
- raw Tutor conversation or transcript;
- raw audio or audio blobs;
- personality, emotional, or diagnostic inference;
- adult answer authority;
- answer keys, correct/expected answers, worked solutions, restricted rubric dimensions, and scoring guides.

Dangerous browser authority claims (`role`, `permissions`, `claims`, admin flags, adult/guardian authorization flags, and server identity IDs) are also refused anywhere in the document. Adult approval is represented only by the narrow, state-specific `attesterRef`/`clearerRef` evidence after an approved transition.

## Raw learner responses

Raw learner responses do not need durable server persistence in this state contract.

The base Family Pilot keeps full learner-response records in separate IndexedDB attempt documents. Family cross-device data R1 adds only the minimum instructional-input projection required to reopen the same item with saved work: opaque attempt/item bindings, selected choice reference or entered text, assessment state, and minimized trusted receipt. The Study durable document still stores only an opaque response-draft reference. Prompts, answer authority, scoring guides, Tutor content, audio and inference remain forbidden.

R2 therefore synchronizes:

- pending/scored/review/certified state;
- opaque evidence refs where a separately authorized evidence service exists;
- minimized assessment outcome/receipt metadata.

It does not synchronize response values. A future trusted-scoring or adult-review workflow may transmit a response transiently to its separately authorized processor, but that payload is not retained in or replayed from `HostedSyncStateSnapshotR2`. Adding durable review content would require a separate privacy-reviewed contract, retention policy, and version; it must not be smuggled into `evidenceRefs`.

This means “lossless” is scoped to required continuation authority, not to copying local learner-authored content. On another device the learner resumes at the authoritative submitted/pending/review outcome, rather than receiving a server copy of their prose.
