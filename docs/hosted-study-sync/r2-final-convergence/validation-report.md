# Validation report

Final local results:

| Verification | Result |
|---|---:|
| R2 adapter harness | 38/38 tests, including 37 numbered scenarios |
| Client, checkpoint contract, and first-link suites | 35/35 |
| DB/RPC and migration-manifest suites | 23/23 |
| Security boundary | 20/20 |
| Staging preflight | 11/11 |
| TypeScript | clean |
| Migration collision check | 54 files, `READY` |
| Full local migration replay | 54/54 applied |
| Database security audit | no base table without RLS, no unsafe security-definer path, no public/anon security definer |
| Family Pilot runtime isolation | `FAMILY_PILOT_RUNTIME_GRAPH_ISOLATED` |

Assessment coverage includes `PENDING_ASSESSMENT`, scored outcome authority,
adult review, guardian pending, and certified states without response bodies.
RFL covers learner assertion, guardian pending/certification, evidence mode,
attester reference, revision authority, and student refusal. Safety covers hold
identity/category/source/dedupe, authorized clear, logical revision, stale
write refusal, and open-hold absorption.

Activation is `false` with reason
`HOSTED_SYNC_R2_INACTIVE_PENDING_STAGING`. The Web R3 root does not import the
hosted-sync client or legacy Profile sync on the Family Pilot route.

Hosted contact: none. Hosted reads: none. Hosted writes: none. Migration apply:
none. Deployment: none.

Blockers: none for staging readiness. A real, explicit non-production project
reference is still required before a future operator may run the read-only
staging preflight.

