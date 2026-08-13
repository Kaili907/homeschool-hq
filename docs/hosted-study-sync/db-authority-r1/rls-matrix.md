# RLS matrix

RLS remains the primary browser read boundary. Browser writes are function-only
and re-derive authority server-side.

| Surface | Guardian read | Student read | Browser direct write | Enforcing predicate |
|---|---|---|---|---|
| `academy_households` / identity tables | Own active membership/access only | No household widening | Existing identity contracts only | Existing household/student RLS |
| `academy_study_sessions` | Authorized student only | Exact current grant's student only | Denied | `academy_study_can_view` |
| `academy_study_checkpoints` | Authorized student only | Exact current grant's student only | Denied | `academy_study_can_view` |
| `academy_study_session_authority` | Authorized student only | Exact current grant's student only | Explicit false insert/update/delete policies and no write grants | Forced RLS + `academy_study_can_view` |
| `student_session_grants` | None | None | None | Private schema, forced RLS, no browser ACL |
| `study_mutation_receipts` | None | None | None | Private schema, forced RLS, no browser ACL |
| `academy_study_sync_hydrate_v1` | Authenticated/RLS-filtered | Authenticated/RLS-filtered | Read-only | Security invoker over forced-RLS tables |
| `academy_study_sync_write_v1` | Exact actor-owned current digest and student scope | Exact grant UUID/digest and student scope | Function only | Security definer with explicit actor/grant/session checks |

The authority table grants authenticated users SELECT on minimized columns
only. Guardian actor UUIDs, grant UUIDs and the actors that cleared or attested
are retained for server audit but are not directly selectable by browser roles.

## Negative-case result

| Probe | Result |
|---|---|
| Guardian reads/writes another household | No row / denied |
| Student reads sibling in same household | No row |
| Student reads another household | No row |
| Student clears safety | `actor-not-authorized` |
| Student attests guardian work | `actor-not-authorized` |
| Missing authenticated actor | `STUDY_AUTH_REQUIRED` |
| Wrong verified gateway actor | `student-session-invalid` |
| Wrong student, assignment or session binding | `study-session-invalid` |
| Expired/revoked/stale grant | No RLS row / `study-session-invalid` |
| Browser attempts direct mutation | No privilege; false write policies |
| Browser uses `service_role` | Not required and not granted for new sync RPCs |
