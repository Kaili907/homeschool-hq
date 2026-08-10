# Curriculum release integrity and provenance

Status: repository-only. No hosted migration, publication, activation,
rollback, or pointer change has been performed.

The Admin **Release integrity** view is a read-only verifier for staged
candidates and published registry releases. Its question is deliberately
narrow: do independently observed artifact bytes and canonical identities agree
with the manifests, checksums, and release metadata already trusted by the
release architecture?

## Status model

- `VERIFIED`: every required available artifact, byte count, hash, manifest,
  package identity, metadata field, and provenance link agrees.
- `MISMATCH`: at least one required recorded and observed value disagrees.
- `INCOMPLETE`: some evidence verifies, but required evidence is absent.
- `UNVERIFIED`: the architecture records no evidence for that specific claim.
- `UNAVAILABLE`: evidence could not be safely read or was too malformed to
  support a conclusion.

File existence alone is never verification. Mismatches are bounded to safe
codes, paths, and explanatory messages. Raw curriculum payloads and backend
errors are never returned to the browser.

## Staged algorithm

For each ADMIN-20A candidate, the server reads exact persisted evidence through
the service-only `curriculum:read` projection. It parses and re-canonicalizes
all ten required Schema v2 JSON artifacts, recalculates UTF-8 byte counts and
SHA-256 values, rejects missing/prohibited-extra paths, and recalculates the
sorted content inventory hash. It then canonicalizes the recorded manifest and
recalculates its hash and the package identity:

```text
SHA256("manuel-academy-curriculum-staged-v1\n" + contentHash + "\n" + manifestHash + "\n")
```

Manifest identity, base release, target version, Schema Set, draft revision,
validation identity/result digest, approval identity, entity counts, artifact
count, and byte total must agree with persisted metadata. The database-linked
draft → validation → approval → staging identities must also form one exact
chain. A staged candidate explicitly renders the published link as unavailable,
because `STAGED` is not `PUBLISHED`.

## Published and legacy 1.0.0 ruling

Published verification uses the immutable registry inventory and independently
reads the available repository artifact root named by the commit-pinned release
locator. It recalculates
all file hashes and bytes, the canonical file-inventory digest, the three
recorded manifest digests, package-manifest entries/exclusions,
`SHA256SUMS.txt`, and curriculum-manifest identity/counts.

Release `1.0.0` can verify its 182 artifact records and available manifests,
but remains overall `INCOMPLETE`. Its legacy registry record has no canonical
package hash and no revision-bound draft, validation, approval, or staging
identity. Those fields are rendered as explicit `UNVERIFIED` gaps; no hashes or
provenance are fabricated retroactively.

## Hard boundary

The endpoint is GET-only and requires the existing `curriculum:read`
capability. The verifier has no repair, checksum rewrite, database mutation,
publish, activation, rollback, learner-binding, or pointer-change operation.
Tests assert the evidence RPC leaves staged artifacts, published releases, and
the production pointer byte-for-byte unchanged.
