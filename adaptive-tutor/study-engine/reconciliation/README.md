# Manuel Academy Study Reconciliation

Package ID: `manuel-academy.study-reconciliation`  
Package version: `0.5.0-blocked.1`  
Manifest schema: `manuel-academy.study-reconciliation.manifest` version `1`

This directory is the machine-readable output for Session 5. It reconciles the
four verified Wave 1 packages without editing or integrating them.

The package is deliberately marked `blocked`: the actual Manuel Academy
Adaptive Tutor Core v0.2 artifact was not mounted on the accessible filesystem
and the signed-in Manuel Academy Project was not available at generation time.
No Tutor Core enum or payload has been reconstructed from a handoff summary.

Authoritative machine-readable files:

- `artifact-verification.v1.json`
- `canonical-decisions.v1.json`
- `field-diff-matrix.v1.json`
- `enum-event-mappings.v1.json`
- `flow-traces.v1.json`
- `issues.v1.json`
- `core-change-requests.v1.json`
- `tutor-core-compatibility.v1.json`
- `schema-registry-plan.v1.json`
- `validation-result.v1.json`
- `reconciliation-manifest.v1.json`

Executable, dependency-free compatibility probes live in `probes/`. Automated
tests live only in `tests/reconciliation/`.
