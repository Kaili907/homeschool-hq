-- Red-team hardening: make the configuration head update the authorization
-- linearization point. A role change that wins the assignment lock must make
-- the in-flight Owner mutation fail closed and roll back in full.

begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Academy admin configuration reauthorization migration must run as postgres';
  end if;
end;
$$;

create function academy_private.admin_configuration_reauthorize_head_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  actor_user uuid := auth.uid();
  current_assignment uuid;
  actor_admin_role text;
  revision_actor uuid;
  revision_assignment uuid;
  revision_role text;
begin
  select assignment.id, assignment.role
    into current_assignment, actor_admin_role
  from public.academy_admin_role_assignments as assignment
  where assignment.user_id = actor_user
    and assignment.status = 'active'
    and assignment.revoked_at is null
    and (assignment.expires_at is null
      or assignment.expires_at > statement_timestamp())
  order by assignment.assigned_at desc, assignment.id desc
  limit 1
  for update;

  select revision.actor_user_ref, revision.actor_assignment_ref,
         revision.actor_role
    into revision_actor, revision_assignment, revision_role
  from academy_private.admin_configuration_revisions as revision
  where revision.setting_key = new.setting_key
    and revision.revision = new.current_revision;

  if actor_user is null
     or current_assignment is null
     or actor_admin_role <> 'owner'
     or revision_actor is distinct from actor_user
     or revision_assignment is distinct from current_assignment
     or revision_role <> 'owner' then
    raise exception 'ADMIN_CONFIGURATION_MANAGE_REQUIRED' using errcode = '42501';
  end if;

  return new;
end;
$$;

alter function academy_private.admin_configuration_reauthorize_head_update()
  owner to postgres;
revoke all on function academy_private.admin_configuration_reauthorize_head_update()
  from public, anon, authenticated, service_role;

create trigger admin_configuration_heads_reauthorize_update
  before update on academy_private.admin_configuration_heads
  for each row execute function
    academy_private.admin_configuration_reauthorize_head_update();

comment on function academy_private.admin_configuration_reauthorize_head_update() is
  'Locks and revalidates the current Owner assignment at the configuration head write point, binding it to the new revision audit actor snapshot.';

commit;
