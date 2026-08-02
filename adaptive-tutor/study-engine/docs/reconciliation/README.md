# CARD 5 — Study Reconciliation Audit

This directory contains the Wave 2 reconciliation report for the Manuel Academy Adaptive Study Engine. It is an audit and integration plan only. It does not integrate production code or authorize final assembly.

Status: **BLOCKED**. All four Wave 1 ZIPs pass the required SHA-256 checks and match their on-disk Wave 1 trees byte-for-byte. The actual Manuel Academy Adaptive Tutor Core v0.2 package is not accessible, so its package identity, exports, dependencies, enums, and payload mappings remain unverified.

## Reports

- [Artifact and hash verification](artifact-and-hash-verification-report.md)
- [Ownership boundary](ownership-boundary-report.md)
- [Canonical decision record](canonical-decision-record.md)
- [Field-level diff matrix](field-level-diff-matrix.md)
- [Enum and event mappings](enum-event-mapping-tables.md)
- [Tutor Core compatibility matrix](tutor-core-compatibility-matrix.md)
- [Provisional-adapter retirement plan](provisional-adapter-retirement-plan.md)
- [Consolidated core-change requests](consolidated-core-change-requests.md)
- [Merge-order plan](merge-order-plan.md)
- [Blocking and non-blocking issues](blocking-and-non-blocking-issues.md)
- [Validation report](validation-report.md)
- [Session 5 handoff](SESSION-5-HANDOFF.md)

The machine-readable source of truth is
[`reconciliation-manifest.v1.json`](../../reconciliation/reconciliation-manifest.v1.json), with decisions, issues, mappings, compatibility data, and all fourteen flow traces beside it.

