# Validation report

## Local-only results

| Area | Result |
| --- | --- |
| 36 numbered converged-adapter scenarios | 36 passed |
| Harness catalog assertion | 1 passed |
| State contract + exact adapter + first link + gap evidence | 32 passed |
| DB/RPC PGlite replay + migration manifest | 22 passed |
| Security evidence + staging preflight | 31 passed |
| TypeScript | passed |

The 36 scenarios cover A→B, B→A, exact production checkpoint fields,
completion, assessments, RFL, Social, Safety, offline/reconnect, three revision
domains, idempotency, lost response after commit, explicit first link, privacy
activation closure, and legacy Profile exclusion.

PGlite replay applied the required migration chain through
`20260813172000_academy_study_sync_lossless_v2.sql`; the real SQL tests exercised
all four functions, RLS/ACL boundaries, sibling and household isolation,
revocation, CAS, idempotency, assessment, completion, RFL, Social, and Safety.

No hosted preflight read, hosted apply, deployment, or remote mutation ran.
