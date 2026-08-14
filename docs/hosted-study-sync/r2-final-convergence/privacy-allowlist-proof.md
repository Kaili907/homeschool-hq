# Privacy allowlist proof

Every `firstLink` import and `write` payload now passes the production R2
allowlist synchronously while the adapter is building RPC arguments. Unknown,
forbidden, cyclic, accessor-bearing, non-JSON, oversized, or malformed
authority-checkpoint data returns `PERMANENT_REFUSAL` before authorization or
provider contact. Validated data is JSON round-tripped and deeply frozen before
dispatch, preventing post-validation mutation.

Authority checkpoints additionally pass the exact canonical parser and the
opaque sealed serializer. The DB repeats exact-key and literal-false privacy
validation. Web R3 dynamic Social metadata is accepted only through its exact
36-field adult-attested metadata validator; `quotedTextStored`, learner personal
data, and other-minor personal data must all be false. Source bodies are absent.

Refused families include raw PIN and all local access verifiers; bearer/token/
grant material; Tutor or assistant transcripts; audio; raw learner-response
bodies; answer indices/keys/correct or expected answers; scoring guides and
adult rubric authority; private notes; personality/emotional/diagnostic
inference; and service credentials.

Proofs:

- 37-scenario harness refuses an unknown write field without provider contact;
- client test refuses unknown and transcript fields before authorization;
- checkpoint privacy tests refuse unknown and PIN-digest fields and reject an
  unsealed object at the network gate;
- 20/20 security-boundary tests pass;
- raw learner-response bodies remain IndexedDB-only and are absent from the
  hosted contract and portable backup.

