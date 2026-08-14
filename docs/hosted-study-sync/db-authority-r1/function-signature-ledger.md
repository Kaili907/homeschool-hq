# Function signature ledger

## Verifiers and runtime executors

| Signature | Role | Status / contract |
|---|---|---|
| `public.academy_study_verify_session_v1(text,text)` | `service_role` | Retained compatibility verifier; current base definition |
| `public.academy_study_verify_session_v1(text,text,uuid)` | `service_role` | New actor-aware overload; UUID must equal the current grant's durable `issued_by` |
| `public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)` | `service_role` | Retained Session 13 runtime executor |
| `public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb,uuid)` | `service_role` | New actor-aware wrapper; verifies actor before delegating to the complete legacy predicate |
| `public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb)` | `service_role` | Retained V2 lifecycle/checkpoint executor |
| `public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb,uuid)` | `service_role` | New actor-aware wrapper for begin/resume/transition/checkpoint operations |

Current runtime call-site result:

- `netlify/functions/_shared/study-safety/session-authorization.js` calls the
  actor-aware verifier with `p_actor_user_id`.
- The current base SQL previously exposed only the two-argument verifier.
- `netlify/functions/_shared/study-identity/supabase.js` calls the retained
  two-argument verifier; its compatibility is preserved.
- Cross-device transports that have an authenticated Supabase actor must use
  the actor-aware overload. The two-argument overload is not the new sync
  authority contract.

## Cross-device browser primitives

| Signature | Security | Role | Contract |
|---|---|---|---|
| `public.academy_study_sync_hydrate_v1(uuid,text,text)` | Invoker | `authenticated` | RLS-filtered minimized initial hydrate for exact student/assignment/session |
| `public.academy_study_sync_write_v1(text,uuid,text,text,bigint,uuid,text,jsonb)` | Definer | `authenticated` | Digest-bound, actor-bound, CAS/idempotent checkpoint or authority transition |
| `academy_private.study_sync_resolve_actor_v1(text,uuid,text)` | Definer | none | Private current-grant/actor resolver used by write RPC |
| `academy_private.study_sync_initialize_session_authority_v1()` | Trigger | none | Creates the one-to-one authority row on Study session insert |
| `academy_private.study_sync_protect_session_authority_v1()` | Trigger | none | Protects session/household/student/assignment identity and deletion |

All definer functions are owned by `postgres` and set
`search_path = pg_catalog`. Public execute privileges are revoked before the
explicit narrow grants.
