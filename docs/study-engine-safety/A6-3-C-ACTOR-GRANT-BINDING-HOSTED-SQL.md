# A6-3-C prepared actor-to-grant binding SQL — unexecuted

Status: prepared only. This document is not a migration, has not been applied,
and authorizes no hosted action.

## Why a hosted change is required

`academy_study_verify_session_v1(text,text)` currently verifies the opaque
reference and required capability under the trusted server role, but it accepts
no authenticated gateway actor. The server can send the verified actor ID only
as a new RPC parameter; only the database can compare it with the durable
grant owner (`student_session_grants.issued_by`) without trusting a client
claim. The checked-in safety server now calls the three-argument overload and
fails closed with `503 authorization_unavailable` until the overload exists.

## Explicit authorization block

Do not run this SQL from this branch. Before any hosted execution, a dispatcher
must separately authorize the exact project, existing function definition,
role/ACL state, change window, deployment order, and post-apply probes. Do not
change `ACADEMY_STUDY_ENABLED`, deploy, merge, or alter any other grant as part
of this document.

## Exact prepared SQL

```sql
begin;

create function public.academy_study_verify_session_v1(
  p_token_digest text,
  p_required_capability text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  verified record;
begin
  -- Preserve the existing trusted-server-only boundary. The gateway actor is
  -- data verified by Netlify's Auth call, never the SQL caller identity.
  if auth.uid() is not null
     or not academy_private.study_is_trusted_server() then
    raise exception 'STUDY_TRUSTED_SERVER_REQUIRED' using errcode = '42501';
  end if;
  if p_token_digest is null
     or p_token_digest !~ '^[0-9a-f]{64}$'
     or p_actor_user_id is null
     or p_required_capability not in (
       'student:assignments:read',
       'student:attempts:create',
       'student:progress:read'
     ) then
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'code', 'student-session-invalid'
    );
  end if;

  select
    grant_row.id,
    grant_row.household_id,
    grant_row.student_id,
    grant_row.session_version,
    grant_row.capabilities,
    grant_row.session_epoch,
    grant_row.authorization_revision,
    grant_row.issued_at,
    grant_row.expires_at,
    grant_row.contract_version
  into verified
  from academy_private.student_session_grants as grant_row
  where grant_row.token_digest = p_token_digest
    and grant_row.grant_purpose = 'study'
    and grant_row.contract_version = 1
    and grant_row.issued_by = p_actor_user_id
    and grant_row.capabilities @> array[p_required_capability]::text[]
    and academy_private.is_student_session_grant_current(grant_row.id);

  if verified.id is null then
    -- Forged, expired, revoked, wrong-capability, and wrong-actor cases remain
    -- deliberately indistinguishable to the gateway caller.
    return jsonb_build_object(
      'schemaVersion', 1,
      'status', 'denied',
      'code', 'student-session-invalid'
    );
  end if;

  return jsonb_build_object(
    'schemaVersion', 1,
    'status', 'verified',
    'grantId', verified.id,
    'householdId', verified.household_id,
    'studentId', verified.student_id,
    'learnerSessionId', verified.session_epoch,
    'sessionEpoch', verified.session_epoch,
    'sessionVersion', verified.session_version,
    'authorizationRevision', verified.authorization_revision,
    'issuedAt', verified.issued_at,
    'expiresAt', verified.expires_at,
    'contractVersion', verified.contract_version,
    'issuerVersion', 'academy-student-session-issuer.v1',
    'scope', to_jsonb(verified.capabilities)
  );
end;
$$;

alter function public.academy_study_verify_session_v1(text, text, uuid)
  owner to postgres;
revoke all on function public.academy_study_verify_session_v1(text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.academy_study_verify_session_v1(text, text, uuid)
  to service_role;

commit;
```

## Remaining gap until separately authorized execution

The local server change makes the old two-argument hosted function unavailable
to the safety route rather than silently falling back. Actor-to-grant binding
becomes effective only after the prepared overload is independently reviewed,
explicitly authorized, and applied by the dispatcher. Feature enablement stays
blocked until then.
