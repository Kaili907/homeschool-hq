# Adaptive Tutor Frozen Artifact Custody Requirements

This correction session does not establish artifact custody. Current local ZIP
copies are temporary read-only inputs and are not authoritative locations.

## Required identities

| Artifact | Required filename | Required SHA-256 |
|---|---|---|
| Tutor Core v0.2 | `manuel-academy-adaptive-tutor-core-v0.2.zip` | `38205667d56cb4fcc5a8360f1f94098b5fa1d35ae71d22334aa1bc8d43ecc276` |
| Tutor Math R1 | `manuel-academy-adaptive-tutor-math-v1-core-v0.2-aligned-r1.zip` | `ee9d15cdf1184380add17ebdd8f93f01fde3f0915f491d0a4df96798b4f52351` |

## Approved-custody characteristics

Any later custody system must be separately approved and must provide:

- byte-immutable or version-addressed storage, with replacement under the same
  identity prohibited;
- access control, protected retention/deletion, and auditable retrieval and
  publication events;
- retention of the exact filename, SHA-256, and internal package
  manifest/checksum evidence; and
- a documented recovery procedure that returns the exact stored ZIP bytes.

## Retrieval and re-verification

For every later release-evidence run:

1. Retrieve each exact ZIP into a new temporary location.
2. Verify required filename and SHA-256 before extraction or execution.
3. Inspect ZIP paths, duplicates, links, compression, and bounds for safety.
4. Extract only into a new verifier-owned temporary directory.
5. Reconcile Core `MANIFEST.json` and Math `SHA256SUMS.txt` against the newly
   extracted files.
6. Execute validators, schemas, adapters, programs, and probes only from those
   derived roots.
7. Record derived paths, canonical tree fingerprints, inventory results, and
   exact compatibility counts.
8. Re-fingerprint the executed trees and rehash both source ZIPs afterward.
9. Dispose of or retain the temporary evidence only according to the approved
   custody/evidence policy.

An extracted directory must never substitute for either ZIP. Neither ZIP may be
committed to the host repository unless a separately Director-approved
repository policy explicitly requires it.

## Actions requiring separate Director authorization

- Push the local correction branch, create an authoritative remote ref, or open
  a pull request.
- Copy or upload either ZIP into an approved custody system.
- Publish custody coordinates or checksum evidence, or change custody access or
  retention settings.
- Commit a ZIP under a newly approved repository policy.
- Merge, deploy, register a production subject, add a production route, or
  change identity, authentication, database, storage, synchronization, AI, or
  voice systems.
