-- Academy profile-sync base schema.
--
-- This timestamp is the UTC creation time of the original reviewed
-- supabase/schema.sql contract. This migration is the deployment source of
-- truth; supabase/schema.sql is a human-readable reference snapshot.
--
-- The migration is deliberately bounded to public.profiles. An exact existing
-- definition is accepted without replacement so valid rows and unrelated
-- catalog state remain untouched. Any incompatible first-run collision or
-- later drift aborts the transaction.

do $academy_profiles_base$
declare
  profiles_oid oid;
  profiles_owner oid;
  authenticated_oid oid;
  anon_oid oid;
  service_role_oid oid;
  postgres_oid oid;
  household_attnum smallint;
  profile_attnum smallint;
  matching_count integer;
  total_count integer;
  authenticated_privileges text[];
  authenticated_has_grant_option boolean;
  actual_schema_privileges jsonb;
  expected_schema_privileges jsonb;
  unexpected_schema_grant_options jsonb;
begin
  perform pg_catalog.set_config('search_path', 'pg_catalog', true);

  if current_user <> 'postgres' then
    raise exception
      'Academy profiles base migration must run as postgres; current owner is %',
      current_user;
  end if;

  select role.oid into authenticated_oid
  from pg_catalog.pg_roles as role
  where role.rolname = 'authenticated';

  select role.oid into anon_oid
  from pg_catalog.pg_roles as role
  where role.rolname = 'anon';

  select role.oid into service_role_oid
  from pg_catalog.pg_roles as role
  where role.rolname = 'service_role';

  select role.oid into postgres_oid
  from pg_catalog.pg_roles as role
  where role.rolname = 'postgres';

  if authenticated_oid is null
     or anon_oid is null
     or service_role_oid is null
     or postgres_oid is null then
    raise exception
      'Academy profiles base migration requires postgres, anon, authenticated, and service_role';
  end if;

  if to_regclass('auth.users') is null then
    raise exception 'Academy profiles base migration requires auth.users';
  end if;

  if to_regprocedure('auth.uid()') is null then
    raise exception 'Academy profiles base migration requires auth.uid()';
  end if;

  -- Schemas expose only CREATE and USAGE. Compare the complete effective
  -- privilege set for every application/platform role rather than checking
  -- only that one required grant is present. has_schema_privilege accounts
  -- for direct grants, role inheritance, ownership/superuser rights, and
  -- privileges inherited through PUBLIC. PUBLIC itself is read directly from
  -- the ACL because it is not a pg_roles row.
  with schema_targets(schema_name, schema_oid) as (
    values
      ('auth'::text, to_regnamespace('auth')),
      ('public'::text, to_regnamespace('public'))
  ),
  role_targets(role_name, role_oid) as (
    values
      ('anon'::text, anon_oid),
      ('authenticated'::text, authenticated_oid),
      ('postgres'::text, postgres_oid),
      ('service_role'::text, service_role_oid)
  ),
  privilege_types(privilege_name) as (
    values ('CREATE'::text), ('USAGE'::text)
  ),
  effective_role_privileges as (
    select
      schema_targets.schema_name,
      role_targets.role_name,
      coalesce(
        pg_catalog.jsonb_agg(
          privilege_types.privilege_name
          order by privilege_types.privilege_name
        ) filter (
          where pg_catalog.has_schema_privilege(
            role_targets.role_oid,
            schema_targets.schema_oid,
            privilege_types.privilege_name
          )
        ),
        '[]'::jsonb
      ) as privileges
    from schema_targets
    cross join role_targets
    cross join privilege_types
    group by schema_targets.schema_name, role_targets.role_name
  ),
  public_privileges as (
    select
      schema_targets.schema_name,
      'PUBLIC'::text as role_name,
      coalesce(
        pg_catalog.jsonb_agg(
          distinct acl.privilege_type
          order by acl.privilege_type
        ) filter (where acl.grantee = 0),
        '[]'::jsonb
      ) as privileges
    from schema_targets
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = schema_targets.schema_oid
    left join lateral pg_catalog.aclexplode(
      coalesce(
        namespace.nspacl,
        pg_catalog.acldefault('n', namespace.nspowner)
      )
    ) as acl on true
    group by schema_targets.schema_name
  ),
  all_privileges as (
    select * from effective_role_privileges
    union all
    select * from public_privileges
  ),
  privileges_by_schema as (
    select
      all_privileges.schema_name,
      pg_catalog.jsonb_object_agg(
        all_privileges.role_name,
        all_privileges.privileges
        order by all_privileges.role_name
      ) as roles
    from all_privileges
    group by all_privileges.schema_name
  )
  select pg_catalog.jsonb_object_agg(
    privileges_by_schema.schema_name,
    privileges_by_schema.roles
    order by privileges_by_schema.schema_name
  )
  into actual_schema_privileges
  from privileges_by_schema;

  -- A grant option is broader authority even when the privilege type remains
  -- USAGE. Reject grantable schema privileges available to application roles,
  -- whether direct or reached through an inherited role. postgres retains its
  -- normal owner/superuser authority.
  with schema_targets(schema_name, schema_oid) as (
    values
      ('auth'::text, to_regnamespace('auth')),
      ('public'::text, to_regnamespace('public'))
  ),
  role_targets(role_name, role_oid) as (
    values
      ('anon'::text, anon_oid),
      ('authenticated'::text, authenticated_oid),
      ('service_role'::text, service_role_oid)
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schema', schema_targets.schema_name,
        'role', role_targets.role_name,
        'privilege', acl.privilege_type
      )
      order by
        schema_targets.schema_name,
        role_targets.role_name,
        acl.privilege_type
    ),
    '[]'::jsonb
  )
  into unexpected_schema_grant_options
  from schema_targets
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = schema_targets.schema_oid
  cross join role_targets
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      namespace.nspacl,
      pg_catalog.acldefault('n', namespace.nspowner)
    )
  ) as acl
  where acl.is_grantable
    and case
      when acl.grantee = 0 then true
      else pg_catalog.pg_has_role(
        role_targets.role_oid,
        acl.grantee,
        'USAGE'
      )
    end;

  expected_schema_privileges := jsonb_build_object(
    'auth',
    jsonb_build_object(
      'PUBLIC', '[]'::jsonb,
      'anon', '["USAGE"]'::jsonb,
      'authenticated', '["USAGE"]'::jsonb,
      'postgres', '["USAGE"]'::jsonb,
      'service_role', '["USAGE"]'::jsonb
    ),
    'public',
    jsonb_build_object(
      'PUBLIC', '["USAGE"]'::jsonb,
      'anon', '["USAGE"]'::jsonb,
      'authenticated', '["USAGE"]'::jsonb,
      'postgres', '["CREATE", "USAGE"]'::jsonb,
      'service_role', '["USAGE"]'::jsonb
    )
  );

  if actual_schema_privileges is distinct from expected_schema_privileges then
    raise exception
      'Academy profiles base schema ACL drift: expected %, found %',
      expected_schema_privileges,
      actual_schema_privileges;
  end if;

  if unexpected_schema_grant_options <> '[]'::jsonb then
    raise exception
      'Academy profiles base schema ACL drift: unexpected grant options %',
      unexpected_schema_grant_options;
  end if;

  if not pg_catalog.has_function_privilege(
    'authenticated',
    'auth.uid()',
    'EXECUTE'
  ) then
    raise exception
      'Academy profiles base migration requires authenticated auth.uid() EXECUTE';
  end if;

  if not pg_catalog.has_function_privilege(
    'anon',
    'auth.uid()',
    'EXECUTE'
  ) then
    raise exception
      'Academy profiles base migration requires anon auth.uid() EXECUTE';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'auth.uid()',
    'EXECUTE'
  ) then
    raise exception
      'Academy profiles base migration requires service_role auth.uid() EXECUTE';
  end if;

  profiles_oid := to_regclass('public.profiles');

  if profiles_oid is null then
    if to_regtype('public.profiles') is not null then
      raise exception
        'Academy profiles base collision: public.profiles type exists without the table';
    end if;

    if exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'profiles_pkey'
    ) then
      raise exception
        'Academy profiles base collision: public.profiles_pkey already exists';
    end if;

    execute $ddl$
      create table public.profiles (
        household_id uuid not null default auth.uid()
          references auth.users (id) on delete cascade,
        profile_id text not null,
        data jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (household_id, profile_id)
      )
    $ddl$;

    execute 'alter table public.profiles owner to postgres';
    execute 'alter table public.profiles enable row level security';

    execute $policy$
      create policy profiles_select_own on public.profiles
        for select to public
        using (household_id = auth.uid())
    $policy$;
    execute $policy$
      create policy profiles_insert_own on public.profiles
        for insert to public
        with check (household_id = auth.uid())
    $policy$;
    execute $policy$
      create policy profiles_update_own on public.profiles
        for update to public
        using (household_id = auth.uid())
        with check (household_id = auth.uid())
    $policy$;
    execute $policy$
      create policy profiles_delete_own on public.profiles
        for delete to public
        using (household_id = auth.uid())
    $policy$;

    execute
      'revoke all privileges on table public.profiles '
      || 'from public, anon, authenticated, service_role';
    execute
      'grant select, insert, update, delete on table public.profiles '
      || 'to authenticated';

    profiles_oid := to_regclass('public.profiles');
  end if;

  select relation.relowner
  into profiles_owner
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where relation.oid = profiles_oid
    and namespace.nspname = 'public'
    and relation.relname = 'profiles'
    and relation.relkind = 'r'
    and relation.relpersistence = 'p'
    and relation.relrowsecurity
    and not relation.relforcerowsecurity;

  if profiles_owner is null
     or pg_catalog.pg_get_userbyid(profiles_owner) <> 'postgres' then
    raise exception
      'Academy profiles base drift: table kind, persistence, owner, or RLS is incompatible';
  end if;

  select count(*) into total_count
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = profiles_oid
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if total_count <> 4 then
    raise exception
      'Academy profiles base drift: expected exactly four columns, found %',
      total_count;
  end if;

  select count(*) into matching_count
  from pg_catalog.pg_attribute as attribute
  left join pg_catalog.pg_attrdef as default_value
    on default_value.adrelid = attribute.attrelid
   and default_value.adnum = attribute.attnum
  where attribute.attrelid = profiles_oid
    and attribute.attnum > 0
    and not attribute.attisdropped
    and (
      (
        attribute.attnum = 1
        and attribute.attname = 'household_id'
        and pg_catalog.format_type(
          attribute.atttypid,
          attribute.atttypmod
        ) = 'uuid'
        and attribute.attnotnull
        and attribute.attidentity = ''
        and attribute.attgenerated = ''
        and pg_catalog.pg_get_expr(
          default_value.adbin,
          default_value.adrelid
        ) = 'auth.uid()'
      )
      or (
        attribute.attnum = 2
        and attribute.attname = 'profile_id'
        and pg_catalog.format_type(
          attribute.atttypid,
          attribute.atttypmod
        ) = 'text'
        and attribute.attnotnull
        and attribute.attidentity = ''
        and attribute.attgenerated = ''
        and default_value.oid is null
      )
      or (
        attribute.attnum = 3
        and attribute.attname = 'data'
        and pg_catalog.format_type(
          attribute.atttypid,
          attribute.atttypmod
        ) = 'jsonb'
        and attribute.attnotnull
        and attribute.attidentity = ''
        and attribute.attgenerated = ''
        and default_value.oid is null
      )
      or (
        attribute.attnum = 4
        and attribute.attname = 'updated_at'
        and pg_catalog.format_type(
          attribute.atttypid,
          attribute.atttypmod
        ) = 'timestamp with time zone'
        and attribute.attnotnull
        and attribute.attidentity = ''
        and attribute.attgenerated = ''
        and pg_catalog.pg_get_expr(
          default_value.adbin,
          default_value.adrelid
        ) = 'now()'
      )
    );

  if matching_count <> 4 then
    raise exception
      'Academy profiles base drift: column type, order, nullability, or default is incompatible';
  end if;

  select attribute.attnum
  into household_attnum
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = profiles_oid
    and attribute.attname = 'household_id'
    and not attribute.attisdropped;

  select attribute.attnum
  into profile_attnum
  from pg_catalog.pg_attribute as attribute
  where attribute.attrelid = profiles_oid
    and attribute.attname = 'profile_id'
    and not attribute.attisdropped;

  select count(*) into total_count
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conrelid = profiles_oid
    and constraint_row.contype in ('p', 'f', 'u', 'c', 'x');

  select count(*) into matching_count
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conrelid = profiles_oid
    and constraint_row.conname = 'profiles_pkey'
    and constraint_row.contype = 'p'
    and constraint_row.conkey =
      array[household_attnum, profile_attnum]::smallint[]
    and not constraint_row.condeferrable
    and not constraint_row.condeferred
    and constraint_row.convalidated;

  if total_count <> 2 or matching_count <> 1 then
    raise exception
      'Academy profiles base drift: primary key or extra constraint is incompatible';
  end if;

  select count(*) into matching_count
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_attribute as referenced_attribute
    on referenced_attribute.attrelid = constraint_row.confrelid
   and referenced_attribute.attnum = constraint_row.confkey[1]
  where constraint_row.conrelid = profiles_oid
    and constraint_row.conname = 'profiles_household_id_fkey'
    and constraint_row.contype = 'f'
    and constraint_row.conkey = array[household_attnum]::smallint[]
    and constraint_row.confrelid = to_regclass('auth.users')
    and referenced_attribute.attname = 'id'
    and constraint_row.confupdtype = 'a'
    and constraint_row.confdeltype = 'c'
    and constraint_row.confmatchtype = 's'
    and not constraint_row.condeferrable
    and not constraint_row.condeferred
    and constraint_row.convalidated;

  if matching_count <> 1 then
    raise exception
      'Academy profiles base drift: auth.users foreign key or delete action is incompatible';
  end if;

  select count(*) into total_count
  from pg_catalog.pg_index as index_row
  where index_row.indrelid = profiles_oid;

  select count(*) into matching_count
  from pg_catalog.pg_index as index_row
  join pg_catalog.pg_class as index_relation
    on index_relation.oid = index_row.indexrelid
  join pg_catalog.pg_namespace as index_namespace
    on index_namespace.oid = index_relation.relnamespace
  join pg_catalog.pg_am as access_method
    on access_method.oid = index_relation.relam
  where index_row.indrelid = profiles_oid
    and index_namespace.nspname = 'public'
    and index_relation.relname = 'profiles_pkey'
    and access_method.amname = 'btree'
    and index_row.indisunique
    and index_row.indisprimary
    and index_row.indisvalid
    and index_row.indisready
    and index_row.indislive
    and index_row.indnkeyatts = 2
    and index_row.indnatts = 2
    and index_row.indkey::text =
      household_attnum::text || ' ' || profile_attnum::text
    and index_row.indexprs is null
    and index_row.indpred is null;

  if total_count <> 1 or matching_count <> 1 then
    raise exception
      'Academy profiles base drift: primary-key index or extra index is incompatible';
  end if;

  select count(*) into total_count
  from pg_catalog.pg_policy as policy
  where policy.polrelid = profiles_oid;

  select count(*) into matching_count
  from pg_catalog.pg_policy as policy
  where policy.polrelid = profiles_oid
    and policy.polpermissive
    and policy.polroles = array[0]::oid[]
    and (
      (
        policy.polname = 'profiles_select_own'
        and policy.polcmd = 'r'
        and pg_catalog.regexp_replace(
          pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false),
          '\s+',
          '',
          'g'
        ) = '(household_id=auth.uid())'
        and policy.polwithcheck is null
      )
      or (
        policy.polname = 'profiles_insert_own'
        and policy.polcmd = 'a'
        and policy.polqual is null
        and pg_catalog.regexp_replace(
          pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, false),
          '\s+',
          '',
          'g'
        ) = '(household_id=auth.uid())'
      )
      or (
        policy.polname = 'profiles_update_own'
        and policy.polcmd = 'w'
        and pg_catalog.regexp_replace(
          pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false),
          '\s+',
          '',
          'g'
        ) = '(household_id=auth.uid())'
        and pg_catalog.regexp_replace(
          pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid, false),
          '\s+',
          '',
          'g'
        ) = '(household_id=auth.uid())'
      )
      or (
        policy.polname = 'profiles_delete_own'
        and policy.polcmd = 'd'
        and pg_catalog.regexp_replace(
          pg_catalog.pg_get_expr(policy.polqual, policy.polrelid, false),
          '\s+',
          '',
          'g'
        ) = '(household_id=auth.uid())'
        and policy.polwithcheck is null
      )
    );

  if total_count <> 4 or matching_count <> 4 then
    raise exception
      'Academy profiles base drift: policy names, roles, commands, or expressions are incompatible';
  end if;

  select
    pg_catalog.array_agg(
      acl.privilege_type::text
      order by acl.privilege_type::text
    ),
    pg_catalog.bool_or(acl.is_grantable)
  into authenticated_privileges, authenticated_has_grant_option
  from pg_catalog.pg_class as relation
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      relation.relacl,
      pg_catalog.acldefault('r', relation.relowner)
    )
  ) as acl
  where relation.oid = profiles_oid
    and acl.grantee = authenticated_oid;

  if authenticated_privileges is distinct from
       array['DELETE', 'INSERT', 'SELECT', 'UPDATE']::text[]
     or coalesce(authenticated_has_grant_option, false) then
    raise exception
      'Academy profiles base drift: authenticated table ACL is incompatible';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    cross join lateral pg_catalog.aclexplode(
      coalesce(
        relation.relacl,
        pg_catalog.acldefault('r', relation.relowner)
      )
    ) as acl
    where relation.oid = profiles_oid
      and acl.grantee not in (profiles_owner, authenticated_oid)
  ) or pg_catalog.has_table_privilege(
    anon_oid,
    profiles_oid,
    'SELECT, INSERT, UPDATE, DELETE'
  ) or pg_catalog.has_table_privilege(
    service_role_oid,
    profiles_oid,
    'SELECT, INSERT, UPDATE, DELETE'
  ) then
    raise exception
      'Academy profiles base drift: anonymous, service, or unexpected table ACL exists';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = profiles_oid
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'Academy profiles base drift: unexpected user trigger exists';
  end if;
end;
$academy_profiles_base$;
