# Migration ledger

## Collision result

The base contains 50 unique ordered migrations through
`20260810200000_academy_admin_curriculum_performance_bounds.sql`.
Historical Study production branches used leases that are absent from the base
or collide with final Admin migrations. No historical file was renamed and no
contested timestamp was reused.

| Old historical file | Current status | Superseded by / disposition | New lease |
|---|---|---|---|
| `20260806120000_academy_study_in_app_receipt_timestamp.sql` | Not in final base; body already reconciled under a later dependency chain | `20260810152000_academy_study_in_app_receipt_timestamp.sql` | Already leased at `20260810152000` |
| `20260806140000_academy_study_c2_operations_contract.sql` | Not in final base; worker contract already reconciled and renamed descriptively | `20260810152100_academy_study_worker_operations_contract.sql` | Already leased at `20260810152100` |
| `20260808120000_academy_study_actor_bound_session_verification.sql` | Exact version collides with `20260808120000_academy_admin_authorization.sql`; actor overload absent from base | Re-derived additively; compatible pre-existing actor overload accepted only after body proof | `20260813170000` |
| `20260808150000_academy_study_academic_readiness_contract.sql` | Historical predecessor/gate assumptions do not match final Admin-converged chain; current runtime uses specific curriculum/session/effective-settings readiness RPCs | Not imported; no cross-device DB primitive depends on it | None |
| `20260809120000_academy_study_learner_runtime_operations.sql` | Exact version collides with `20260809120000_academy_operational_telemetry_foundation.sql`; it replaces an older verified-runtime body | Not imported. Existing V2 lifecycle/checkpoint primitives plus the new sync write boundary cover this lane; richer event/calendar policy remains external | None |

The actor-binding conclusion differs from the historical branch only in lease
and dependency assumptions. Its core comparison remains valid:
`student_session_grants.issued_by = p_actor_user_id` plus the complete current
grant predicate.

## New executable migrations

| Version | Filename | LF SHA-256 | Marker transition |
|---|---|---|---|
| `20260813170000` | `20260813170000_academy_study_actor_authority_convergence.sql` | `b6ac6d91dc1d9e37335a44fa46f1533e623fff7a2a41f9df98fb3137605b1488` | `actor_binding_version:0->1` |
| `20260813171000` | `20260813171000_academy_study_cross_device_authority.sql` | `49dfe14657fcf48d8bc72c26f77f3c47e3ec610db7ed9d4151c1e295a975edc5` | `cross_device_authority_version:0->1` |

Both entries are classified `executable`, `not-applied-hosted`, `current` in
the canonical migration manifest. The chain now has 52 unique versions.

## Existing hosted Study chain represented in the repository

The canonical Study foundation is:

1. `20260801010000` storage: canonical Study sessions, event ledger,
   checkpoints, reviews, calendar, settings, accommodations, audit and private
   receipts/protected state.
2. `20260801011000` authorization: guardian/student RLS predicates and
   function-only mutations.
3. `20260801012000` safety/adult-review production reconciliation.
4. `20260801160000` opaque verified Study grant issue/verify/revoke.
5. `20260801170000` adult-review operations.
6. `20260801190000` final production wrappers and verified runtime.
7. Later `20260810…` Study leases add effective settings, immutable curriculum
   binding, V2 session/checkpoint semantics, worker contracts, bound-content
   authority, telemetry and timestamp coherence.
8. The two `20260813…` leases close actor binding and cross-device authority.

Repository evidence continues to mark the executable Study chain as not
applied hosted. This session did not attempt to verify or mutate hosted state.
