# Migration ledger

| Version | File | Dependency | Hosted status |
|---|---|---|---|
| `20260813170000` | `20260813170000_academy_study_actor_authority_convergence.sql` | accepted Study engine parents | not applied |
| `20260813171000` | `20260813171000_academy_study_cross_device_authority.sql` | `20260813170000` | not applied |
| `20260813172000` | `20260813172000_academy_study_sync_lossless_v2.sql` | `20260813171000` | not applied |
| `20260813173000` | `20260813173000_academy_study_sync_lossless_checkpoint_r1.sql` | `20260813172000` | not applied |

Local verification:

- collision inventory: `READY`, 54 migration files;
- fresh union replay: 54/54 migrations applied in order in local PGlite;
- manifest SHA verification: clean;
- hosted-sync DB/RPC suite: 23/23 tests;
- private checkpoint and mapping ledgers: RLS enabled and forced;
- no `anon` or browser table grant to private checkpoint authority;
- RPC execution remains authenticated-only with actor, household, and student binding.

Canonical RPC surface:

1. `academy_study_sync_first_link_v2`
2. `academy_study_sync_resolve_mapping_v2`
3. `academy_study_sync_hydrate_v2`
4. `academy_study_sync_write_v2`

