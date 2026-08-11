# Study production local smoke harness

Run the operator smoke from the repository root:

```text
npm run smoke:study-production-local
```

The command exits non-zero unless the local production authority scenario
finishes with `STUDY_LOCAL_PRODUCTION_SMOKE_READY`. It prints one compact
machine-readable line prefixed with `STUDY_PRODUCTION_LOCAL_SMOKE_JSON=`, then
an operator checklist such as `settings PASS`, `release authority PASS`,
`session begin PASS`, `bound content PASS`, `checkpoint PASS`, and `resume
PASS`.

## What it exercises

The harness composes repository production seams rather than a second Study
implementation:

1. It creates a fresh in-memory PGlite database and applies the checked-in
   Study schema, production migrations, and synthetic SQL fixtures.
2. The real session-issue handler delegates to the local authenticated
   guardian RPC seam.
3. The real academic-runtime gateway digests the opaque learner bearer and
   delegates to `academy_study_execute_session_lifecycle_v2` as the local
   service role.
4. The real bound-content handler combines the database authority projection
   with the immutable filesystem curriculum source, including exact manifest
   hashing and scheduled lesson/course membership.
5. The scenario verifies ready Effective Settings V2, the published Admin
   registry pointer, one valid enrollment, immutable release binding, begin,
   content, transitions, checkpoint, resume, and completed terminal state.

The negative probes cover unavailable settings, an unpublished/unsupported
release, wrong enrollment and learner selection, manifest mismatch, content
membership mismatch, stale revision, duplicate replay and idempotency
collision, malformed DTO, an ambiguous legacy session, and caller-forged
learner/role authority.

## Isolation and determinism

Only synthetic fixed fixture identifiers, dates, and logical evidence codes
are reported. Server-generated opaque references, session identifiers, and
timestamps are deliberately excluded from output. A new in-memory database is
created for each run and closed in `finally`; no smoke state is written outside
the harness.

All HTTP-style handlers are invoked in process. Their fetch dependency is a
deny-only canary, and all Supabase RPC traffic is injected into PGlite. The
harness does not import or call Anthropic, ElevenLabs, Netlify APIs, hosted
Supabase, or another external provider. `externalContact.attempts` must remain
zero for a passing result.

The ordinary root test suite includes a self-test that runs isolated scenarios
repeatedly, compares the complete logical JSON result, checks required probe
coverage, and scans rendered output for private authority values.
