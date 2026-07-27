import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const HOUSEHOLD_A = '00000000-0000-4000-8000-00000000000a'
const HOUSEHOLD_B = '00000000-0000-4000-8000-00000000000b'
const migrationPath = new URL(
  './migrations/20260724074106_academy_profiles_base.sql',
  import.meta.url,
)
const schemaSnapshotPath = new URL('./schema.sql', import.meta.url)
const IDENTITY_COMMIT = '6138112bda3e395b02ae8d67a1da756f73cd28ed'
const IDENTITY_PATH =
  'supabase/migrations/20260724230000_academy_student_identity_foundation.sql'
const IDENTITY_BLOB = 'df4cc097ba72561d4182a138760e82c2730a5fac'
const CAS_COMMIT = 'e5131729f7866553f6bedfd2ca0ec84f0b343126'
const CAS_PATH =
  'supabase/migrations/20260726120000_academy_household_revision_cas.sql'
const CAS_BLOB = 'c9aa82ddc7e9bd179107b50dfe6d87d9fbfa650f'

const databases: PGlite[] = []

function reviewedMigration(
  commit: string,
  path: string,
  expectedBlob: string,
) {
  const source = `${commit}:${path}`
  expect(
    execFileSync('git', ['rev-parse', source], { encoding: 'utf8' }).trim(),
  ).toBe(expectedBlob)
  return execFileSync('git', ['show', source], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
}

async function createDatabase() {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema auth authorization postgres;
    create table auth.users (id uuid primary key);
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(
        current_setting('request.jwt.claim.sub', true),
        ''
      )::uuid
    $$;

    revoke all on schema auth from public;
    grant usage on schema auth to anon, authenticated, service_role;
    revoke all on function auth.uid() from public;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    revoke all on schema public from public, anon, authenticated, service_role;
    grant usage on schema public
      to public, anon, authenticated, service_role;

    insert into auth.users (id) values
      ('${HOUSEHOLD_A}'::uuid),
      ('${HOUSEHOLD_B}'::uuid);
  `)
  return database
}

async function schemaPrivilegeSnapshot(database: PGlite) {
  const result = await database.query<{ snapshot: string }>(`
    with schema_targets(schema_name, schema_oid) as (
      values
        ('auth'::text, to_regnamespace('auth')),
        ('public'::text, to_regnamespace('public'))
    ),
    role_targets(role_name, role_oid) as (
      select role.rolname::text, role.oid
      from pg_catalog.pg_roles as role
      where role.rolname in (
        'anon',
        'authenticated',
        'postgres',
        'service_role'
      )
    ),
    privilege_types(privilege_name) as (
      values ('CREATE'::text), ('USAGE'::text)
    ),
    role_privileges as (
      select
        schema_targets.schema_name,
        role_targets.role_name,
        coalesce(
          jsonb_agg(
            privilege_types.privilege_name
            order by privilege_types.privilege_name
          ) filter (
            where has_schema_privilege(
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
          jsonb_agg(
            distinct acl.privilege_type
            order by acl.privilege_type
          ) filter (where acl.grantee = 0),
          '[]'::jsonb
        ) as privileges
      from schema_targets
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = schema_targets.schema_oid
      left join lateral aclexplode(
        coalesce(
          namespace.nspacl,
          acldefault('n', namespace.nspowner)
        )
      ) as acl on true
      group by schema_targets.schema_name
    ),
    all_privileges as (
      select * from role_privileges
      union all
      select * from public_privileges
    ),
    privileges_by_schema as (
      select
        all_privileges.schema_name,
        jsonb_object_agg(
          all_privileges.role_name,
          all_privileges.privileges
          order by all_privileges.role_name
        ) as roles
      from all_privileges
      group by all_privileges.schema_name
    )
    select jsonb_object_agg(
      privileges_by_schema.schema_name,
      privileges_by_schema.roles
      order by privileges_by_schema.schema_name
    )::text as snapshot
    from privileges_by_schema
  `)
  return JSON.parse(result.rows[0].snapshot) as Record<
    string,
    Record<string, string[]>
  >
}

async function schemaAclSnapshot(database: PGlite) {
  const result = await database.query<{ snapshot: string }>(`
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'schema', namespace.nspname,
          'grantee',
            case
              when acl.grantee = 0 then 'PUBLIC'
              else pg_get_userbyid(acl.grantee)
            end,
          'grantor', pg_get_userbyid(acl.grantor),
          'privilege', acl.privilege_type,
          'grantable', acl.is_grantable
        )
        order by
          namespace.nspname,
          case
            when acl.grantee = 0 then 'PUBLIC'
            else pg_get_userbyid(acl.grantee)
          end,
          acl.privilege_type,
          pg_get_userbyid(acl.grantor)
      ),
      '[]'::jsonb
    )::text as snapshot
    from pg_namespace as namespace
    cross join lateral aclexplode(
      coalesce(
        namespace.nspacl,
        acldefault('n', namespace.nspowner)
      )
    ) as acl
    where namespace.nspname in ('auth', 'public')
  `)
  return JSON.parse(result.rows[0].snapshot) as Array<{
    schema: string
    grantee: string
    grantor: string
    privilege: string
    grantable: boolean
  }>
}

const expectedSchemaPrivileges = {
  auth: {
    PUBLIC: [],
    anon: ['USAGE'],
    authenticated: ['USAGE'],
    postgres: ['CREATE', 'USAGE'],
    service_role: ['USAGE'],
  },
  public: {
    PUBLIC: ['USAGE'],
    anon: ['USAGE'],
    authenticated: ['USAGE'],
    postgres: ['CREATE', 'USAGE'],
    service_role: ['USAGE'],
  },
}

const schemaPrivilegeRoles = [
  'anon',
  'authenticated',
  'service_role',
] as const

const membershipUsageCases = [
  { role: 'anon', schema: 'public' },
  { role: 'anon', schema: 'auth' },
  { role: 'authenticated', schema: 'public' },
  { role: 'authenticated', schema: 'auth' },
  { role: 'service_role', schema: 'public' },
  { role: 'service_role', schema: 'auth' },
] as const

async function migrationSql() {
  return readFile(migrationPath, 'utf8')
}

async function applyMigration(database: PGlite) {
  await database.exec(await migrationSql())
}

async function authenticatedCrudPrivileges(database: PGlite) {
  const result = await database.query<{
    select_allowed: boolean
    insert_allowed: boolean
    update_allowed: boolean
    delete_allowed: boolean
  }>(`
    select
      has_table_privilege(
        'authenticated',
        'public.profiles',
        'SELECT'
      ) as select_allowed,
      has_table_privilege(
        'authenticated',
        'public.profiles',
        'INSERT'
      ) as insert_allowed,
      has_table_privilege(
        'authenticated',
        'public.profiles',
        'UPDATE'
      ) as update_allowed,
      has_table_privilege(
        'authenticated',
        'public.profiles',
        'DELETE'
      ) as delete_allowed
  `)
  return result.rows[0]
}

async function catalogSnapshot(database: PGlite) {
  const result = await database.query<{ snapshot: string }>(`
    select jsonb_build_object(
      'relation',
      (
        select jsonb_build_object(
          'owner', pg_catalog.pg_get_userbyid(relation.relowner),
          'kind', relation.relkind,
          'persistence', relation.relpersistence,
          'rls', relation.relrowsecurity,
          'force_rls', relation.relforcerowsecurity
        )
        from pg_catalog.pg_class as relation
        where relation.oid = 'public.profiles'::regclass
      ),
      'columns',
      (
        select jsonb_agg(
          jsonb_build_object(
            'position', attribute.attnum,
            'name', attribute.attname,
            'type', pg_catalog.format_type(
              attribute.atttypid,
              attribute.atttypmod
            ),
            'not_null', attribute.attnotnull,
            'default', pg_catalog.pg_get_expr(
              default_value.adbin,
              default_value.adrelid
            )
          )
          order by attribute.attnum
        )
        from pg_catalog.pg_attribute as attribute
        left join pg_catalog.pg_attrdef as default_value
          on default_value.adrelid = attribute.attrelid
         and default_value.adnum = attribute.attnum
        where attribute.attrelid = 'public.profiles'::regclass
          and attribute.attnum > 0
          and not attribute.attisdropped
      ),
      'constraints',
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', constraint_row.conname,
            'type', constraint_row.contype,
            'definition', pg_catalog.pg_get_constraintdef(
              constraint_row.oid,
              true
            )
          )
          order by constraint_row.conname
        )
        from pg_catalog.pg_constraint as constraint_row
        where constraint_row.conrelid = 'public.profiles'::regclass
          and constraint_row.contype in ('p', 'f', 'u', 'c', 'x')
      ),
      'indexes',
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', index_relation.relname,
            'definition', pg_catalog.pg_get_indexdef(index_row.indexrelid)
          )
          order by index_relation.relname
        )
        from pg_catalog.pg_index as index_row
        join pg_catalog.pg_class as index_relation
          on index_relation.oid = index_row.indexrelid
        where index_row.indrelid = 'public.profiles'::regclass
      ),
      'policies',
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', policy.polname,
            'command', policy.polcmd,
            'permissive', policy.polpermissive,
            'roles', policy.polroles,
            'using', pg_catalog.pg_get_expr(
              policy.polqual,
              policy.polrelid,
              false
            ),
            'check', pg_catalog.pg_get_expr(
              policy.polwithcheck,
              policy.polrelid,
              false
            )
          )
          order by policy.polname
        )
        from pg_catalog.pg_policy as policy
        where policy.polrelid = 'public.profiles'::regclass
      ),
      'acl',
      (
        select jsonb_agg(
          jsonb_build_object(
            'grantee',
              case
                when acl.grantee = 0 then 'PUBLIC'
                else pg_catalog.pg_get_userbyid(acl.grantee)
              end,
            'privilege', acl.privilege_type,
            'grantable', acl.is_grantable
          )
          order by
            case
              when acl.grantee = 0 then 'PUBLIC'
              else pg_catalog.pg_get_userbyid(acl.grantee)
            end,
            acl.privilege_type
        )
        from pg_catalog.pg_class as relation
        cross join lateral pg_catalog.aclexplode(
          coalesce(
            relation.relacl,
            pg_catalog.acldefault('r', relation.relowner)
          )
        ) as acl
        where relation.oid = 'public.profiles'::regclass
      ),
      'user_triggers',
      (
        select count(*)
        from pg_catalog.pg_trigger as trigger_row
        where trigger_row.tgrelid = 'public.profiles'::regclass
          and not trigger_row.tgisinternal
      )
    )::text as snapshot
  `)
  return JSON.parse(result.rows[0].snapshot) as {
    relation: Record<string, unknown>
    columns: Array<Record<string, unknown>>
    constraints: Array<Record<string, unknown>>
    indexes: Array<Record<string, unknown>>
    policies: Array<Record<string, unknown>>
    acl: Array<Record<string, unknown>>
    user_triggers: number
  }
}

async function asRole<T>(
  database: PGlite,
  role: 'anon' | 'authenticated',
  householdId: string | null,
  operation: () => Promise<T>,
) {
  await database.exec(
    `select set_config(
       'request.jwt.claim.sub',
       ${householdId ? `'${householdId}'` : `''`},
       false
     ); set role ${role};`,
  )
  try {
    return await operation()
  } finally {
    await database.exec(
      `reset role; select set_config('request.jwt.claim.sub', '', false);`,
    )
  }
}

afterEach(async () => {
  const closing = databases.splice(0).map((database) => database.close())
  await Promise.all(closing)
})

describe('Academy profiles base migration', () => {
  it(
    'creates the exact empty-database contract and enforces household RLS',
    async () => {
      const database = await createDatabase()
      await applyMigration(database)

      expect(await schemaPrivilegeSnapshot(database)).toEqual(
        expectedSchemaPrivileges,
      )
      const catalog = await catalogSnapshot(database)
      expect(catalog.relation).toEqual({
        owner: 'postgres',
        kind: 'r',
        persistence: 'p',
        rls: true,
        force_rls: false,
      })
      expect(catalog.columns).toEqual([
        {
          position: 1,
          name: 'household_id',
          type: 'uuid',
          not_null: true,
          default: 'auth.uid()',
        },
        {
          position: 2,
          name: 'profile_id',
          type: 'text',
          not_null: true,
          default: null,
        },
        {
          position: 3,
          name: 'data',
          type: 'jsonb',
          not_null: true,
          default: null,
        },
        {
          position: 4,
          name: 'updated_at',
          type: 'timestamp with time zone',
          not_null: true,
          default: 'now()',
        },
      ])
      expect(catalog.constraints).toEqual([
        {
          name: 'profiles_household_id_fkey',
          type: 'f',
          definition:
            'FOREIGN KEY (household_id) REFERENCES auth.users(id) ON DELETE CASCADE',
        },
        {
          name: 'profiles_pkey',
          type: 'p',
          definition: 'PRIMARY KEY (household_id, profile_id)',
        },
      ])
      expect(catalog.indexes).toEqual([
        {
          name: 'profiles_pkey',
          definition:
            'CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (household_id, profile_id)',
        },
      ])
      expect(catalog.policies).toEqual([
        {
          name: 'profiles_delete_own',
          command: 'd',
          permissive: true,
          roles: ['0'],
          using: '(household_id = auth.uid())',
          check: null,
        },
        {
          name: 'profiles_insert_own',
          command: 'a',
          permissive: true,
          roles: ['0'],
          using: null,
          check: '(household_id = auth.uid())',
        },
        {
          name: 'profiles_select_own',
          command: 'r',
          permissive: true,
          roles: ['0'],
          using: '(household_id = auth.uid())',
          check: null,
        },
        {
          name: 'profiles_update_own',
          command: 'w',
          permissive: true,
          roles: ['0'],
          using: '(household_id = auth.uid())',
          check: '(household_id = auth.uid())',
        },
      ])
      expect(
        catalog.acl.filter((item) => item.grantee !== 'postgres'),
      ).toEqual([
        {
          grantee: 'authenticated',
          privilege: 'DELETE',
          grantable: false,
        },
        {
          grantee: 'authenticated',
          privilege: 'INSERT',
          grantable: false,
        },
        {
          grantee: 'authenticated',
          privilege: 'SELECT',
          grantable: false,
        },
        {
          grantee: 'authenticated',
          privilege: 'UPDATE',
          grantable: false,
        },
      ])
      expect(catalog.user_triggers).toBe(0)

      await asRole(database, 'authenticated', HOUSEHOLD_A, async () => {
        await database.query(
          `insert into public.profiles (profile_id, data, updated_at)
           values ('p1', '{"id":"p1","name":"Household A"}', $1)`,
          ['2026-07-24T08:00:00Z'],
        )
      })
      await asRole(database, 'authenticated', HOUSEHOLD_B, async () => {
        await database.query(
          `insert into public.profiles (profile_id, data, updated_at)
           values ('p1', '{"id":"p1","name":"Household B"}', $1)`,
          ['2026-07-24T08:01:00Z'],
        )
      })

      await asRole(database, 'authenticated', HOUSEHOLD_A, async () => {
        const rows = await database.query<{
          household_id: string
          name: string
        }>(
          `select household_id::text, data->>'name' as name
           from public.profiles`,
        )
        expect(rows.rows).toEqual([
          { household_id: HOUSEHOLD_A, name: 'Household A' },
        ])

        const crossUpdate = await database.query(
          `update public.profiles
           set data = '{"id":"p1","name":"stolen"}'
           where household_id = $1`,
          [HOUSEHOLD_B],
        )
        expect(crossUpdate.affectedRows).toBe(0)

        await expect(
          database.query(
            `insert into public.profiles (
               household_id,
               profile_id,
               data,
               updated_at
             ) values ($1, 'p2', '{"id":"p2"}', now())`,
            [HOUSEHOLD_B],
          ),
        ).rejects.toThrow()
      })

      await asRole(database, 'anon', null, async () => {
        await expect(
          database.query('select * from public.profiles'),
        ).rejects.toThrow()
        await expect(
          database.query(
            `insert into public.profiles (profile_id, data)
             values ('p2', '{"id":"p2"}')`,
          ),
        ).rejects.toThrow()
      })
    },
    30_000,
  )

  it(
    'accepts an exact rerun without changing catalog state or unrelated ACLs',
    async () => {
      const database = await createDatabase()
      await applyMigration(database)
      await database.exec(`
      create role academy_profiles_acl_sentinel nologin;
      create schema academy_profiles_unrelated authorization postgres;
      create table academy_profiles_unrelated.sentinel (id integer primary key);
      revoke all on schema academy_profiles_unrelated from public;
      grant usage on schema academy_profiles_unrelated
        to academy_profiles_acl_sentinel;
      grant select on table academy_profiles_unrelated.sentinel
        to academy_profiles_acl_sentinel;
      `)
      const beforeCatalog = await catalogSnapshot(database)
      const beforeSchemaPrivileges =
        await schemaPrivilegeSnapshot(database)
      const sentinelSnapshotQuery = `
      select jsonb_build_object(
        'schema_owner',
          pg_catalog.pg_get_userbyid(namespace.nspowner),
        'schema_acl', namespace.nspacl,
        'table_owner',
          pg_catalog.pg_get_userbyid(relation.relowner),
        'table_acl', relation.relacl
      )::text as snapshot
      from pg_catalog.pg_namespace as namespace
      join pg_catalog.pg_class as relation
        on relation.relnamespace = namespace.oid
      where namespace.nspname = 'academy_profiles_unrelated'
        and relation.relname = 'sentinel'
      `
      const beforeSentinel = await database.query<{ snapshot: string }>(
        sentinelSnapshotQuery,
      )

      await applyMigration(database)

      expect(await catalogSnapshot(database)).toEqual(beforeCatalog)
      expect(await schemaPrivilegeSnapshot(database)).toEqual(
        beforeSchemaPrivileges,
      )
      const afterSentinel = await database.query<{ snapshot: string }>(
        sentinelSnapshotQuery,
      )
      expect(afterSentinel.rows[0].snapshot).toBe(
        beforeSentinel.rows[0].snapshot,
      )
    },
    30_000,
  )

  it(
    'accepts the legacy reference snapshot and preserves exact existing rows',
    async () => {
      const database = await createDatabase()
      await database.exec(await readFile(schemaSnapshotPath, 'utf8'))
      await database.query(
      `insert into public.profiles (
         household_id,
         profile_id,
         data,
         updated_at
       ) values ($1, 'p1', $2::jsonb, $3)`,
      [
        HOUSEHOLD_A,
        JSON.stringify({
          id: 'p1',
          name: 'Preserved',
          nested: { exact: ['json', 7, true] },
        }),
        '2026-07-24T07:41:06.123456Z',
      ],
      )
      const rowSnapshotQuery = `
      select
        'public.profiles'::regclass::oid::text as table_oid,
        jsonb_build_object(
          'household_id', household_id,
          'profile_id', profile_id,
          'data', data,
          'updated_at', updated_at
        )::text as row_snapshot
      from public.profiles
      `
      const before = await database.query<{
        table_oid: string
        row_snapshot: string
      }>(rowSnapshotQuery)

      await applyMigration(database)

      const after = await database.query<{
        table_oid: string
        row_snapshot: string
      }>(rowSnapshotQuery)
      expect(after.rows).toEqual(before.rows)
    },
    30_000,
  )

  it.each(schemaPrivilegeRoles)(
    'accepts public-schema USAGE inherited only through PUBLIC for %s without ACL repair',
    async (role) => {
      const database = await createDatabase()
      await database.exec(`revoke usage on schema public from ${role}`)
      const beforeAcl = await schemaAclSnapshot(database)

      expect(beforeAcl).not.toContainEqual(
        expect.objectContaining({
          schema: 'public',
          grantee: role,
          privilege: 'USAGE',
        }),
      )
      expect(beforeAcl).toContainEqual(
        expect.objectContaining({
          schema: 'public',
          grantee: 'PUBLIC',
          privilege: 'USAGE',
          grantable: false,
        }),
      )
      expect(await schemaPrivilegeSnapshot(database)).toEqual(
        expectedSchemaPrivileges,
      )

      await applyMigration(database)

      expect(await schemaPrivilegeSnapshot(database)).toEqual(
        expectedSchemaPrivileges,
      )
      expect(await schemaAclSnapshot(database)).toEqual(beforeAcl)
      expect(
        (
          await database.query<{ present: boolean }>(
            `select to_regclass('public.profiles') is not null as present`,
          )
        ).rows,
      ).toEqual([{ present: true }])
    },
    30_000,
  )

  it.each(membershipUsageCases)(
    'accepts $role $schema-schema USAGE without a direct grant when inherited through role membership',
    async ({ role, schema }) => {
      const database = await createDatabase()
      const parentRole = `academy_${role}_${schema}_usage_parent`
      await database.exec(`
        revoke usage on schema ${schema} from ${role};
        create role ${parentRole} nologin;
        grant usage on schema ${schema} to ${parentRole};
        grant ${parentRole} to ${role};
      `)
      const beforeAcl = await schemaAclSnapshot(database)

      expect(beforeAcl).not.toContainEqual(
        expect.objectContaining({
          schema,
          grantee: role,
          privilege: 'USAGE',
        }),
      )
      expect(beforeAcl).toContainEqual(
        expect.objectContaining({
          schema,
          grantee: parentRole,
          privilege: 'USAGE',
          grantable: false,
        }),
      )
      expect(
        (
          await database.query<{
            inherited: boolean
            effective: boolean
          }>(`
            select
              pg_has_role(
                '${role}',
                '${parentRole}',
                'USAGE'
              ) as inherited,
              has_schema_privilege(
                '${role}',
                '${schema}',
                'USAGE'
              ) as effective
          `)
        ).rows,
      ).toEqual([{ inherited: true, effective: true }])
      expect(await schemaPrivilegeSnapshot(database)).toEqual(
        expectedSchemaPrivileges,
      )

      await applyMigration(database)

      expect(await schemaPrivilegeSnapshot(database)).toEqual(
        expectedSchemaPrivileges,
      )
      expect(await schemaAclSnapshot(database)).toEqual(beforeAcl)
    },
    30_000,
  )

  it.each(schemaPrivilegeRoles)(
    'rejects missing auth-schema USAGE for %s without repairing it or creating profiles',
    async (role) => {
      const database = await createDatabase()
      await database.exec(`
        create schema academy_missing_usage_sentinel
          authorization postgres;
        create table academy_missing_usage_sentinel.state (
          id integer primary key,
          value text not null
        );
        insert into academy_missing_usage_sentinel.state
          values (7, 'preserved');
        revoke all on schema academy_missing_usage_sentinel from public;
        revoke usage on schema auth from ${role};
      `)
      const beforeAcl = await schemaAclSnapshot(database)
      const sentinelSnapshotQuery = `
        select jsonb_build_object(
          'schema_oid', namespace.oid::text,
          'schema_owner', pg_get_userbyid(namespace.nspowner),
          'schema_acl', namespace.nspacl,
          'table_oid', relation.oid::text,
          'table_owner', pg_get_userbyid(relation.relowner),
          'table_acl', relation.relacl,
          'rows', (
            select jsonb_agg(
              jsonb_build_object('id', state.id, 'value', state.value)
              order by state.id
            )
            from academy_missing_usage_sentinel.state as state
          )
        )::text as snapshot
        from pg_namespace as namespace
        join pg_class as relation
          on relation.relnamespace = namespace.oid
        where namespace.nspname = 'academy_missing_usage_sentinel'
          and relation.relname = 'state'
      `
      const beforeSentinel = await database.query<{ snapshot: string }>(
        sentinelSnapshotQuery,
      )

      let rejection: unknown
      try {
        await applyMigration(database)
      } catch (cause) {
        rejection = cause
      }
      await database.exec('rollback')

      expect(rejection).toBeInstanceOf(Error)
      expect((rejection as Error).message).toMatch(/schema ACL drift/)
      expect(await schemaAclSnapshot(database)).toEqual(beforeAcl)
      expect(
        (
          await database.query<{
            usage: boolean
            profiles_absent: boolean
          }>(`
            select
              has_schema_privilege(
                '${role}',
                'auth',
                'USAGE'
              ) as usage,
              to_regclass('public.profiles') is null as profiles_absent
          `)
        ).rows,
      ).toEqual([{ usage: false, profiles_absent: true }])
      const afterSentinel = await database.query<{ snapshot: string }>(
        sentinelSnapshotQuery,
      )
      expect(afterSentinel.rows).toEqual(beforeSentinel.rows)
    },
    30_000,
  )

  const incompatibleDefinitions: Array<{
    name: string
    mutate: string
    error: RegExp
  }> = [
    {
      name: 'missing required PUBLIC USAGE on public',
      mutate: 'revoke usage on schema public from public',
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected anon CREATE on public',
      mutate: 'grant create on schema public to anon',
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected authenticated CREATE on public',
      mutate: 'grant create on schema public to authenticated',
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected anon CREATE on auth',
      mutate: 'grant create on schema auth to anon',
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected authenticated CREATE on auth',
      mutate: 'grant create on schema auth to authenticated',
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected service_role CREATE on public',
      mutate: 'grant create on schema public to service_role',
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected service_role CREATE on auth',
      mutate: 'grant create on schema auth to service_role',
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected public-schema CREATE inherited through PUBLIC',
      mutate: 'grant create on schema public to public',
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected auth-schema CREATE inherited through PUBLIC',
      mutate: 'grant create on schema auth to public',
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected CREATE inherited through role membership',
      mutate: `
        create role academy_schema_acl_parent nologin;
        grant create on schema auth to academy_schema_acl_parent;
        grant academy_schema_acl_parent to authenticated;
      `,
      error: /schema ACL drift/,
    },
    {
      name: 'unexpected direct schema grant option',
      mutate: `
        grant usage on schema auth to anon with grant option
      `,
      error: /schema ACL drift: unexpected grant options/,
    },
    {
      name: 'unexpected service_role schema grant option',
      mutate: `
        grant usage on schema public to service_role with grant option
      `,
      error: /schema ACL drift: unexpected grant options/,
    },
    {
      name: 'unexpected schema grant option through role membership',
      mutate: `
        create role academy_schema_grant_parent nologin;
        grant usage on schema auth to academy_schema_grant_parent
          with grant option;
        grant academy_schema_grant_parent to authenticated;
      `,
      error: /schema ACL drift: unexpected grant options/,
    },
    {
      name: 'wrong column type',
      mutate:
        'alter table public.profiles alter column profile_id type varchar(50)',
      error: /column type, order, nullability, or default/,
    },
    {
      name: 'wrong nullability',
      mutate:
        'alter table public.profiles alter column data drop not null',
      error: /column type, order, nullability, or default/,
    },
    {
      name: 'wrong default',
      mutate:
        'alter table public.profiles alter column updated_at set default clock_timestamp()',
      error: /column type, order, nullability, or default/,
    },
    {
      name: 'missing column',
      mutate: 'alter table public.profiles drop column updated_at',
      error: /expected exactly four columns/,
    },
    {
      name: 'unexpected extra column',
      mutate: 'alter table public.profiles add column unexpected text',
      error: /expected exactly four columns/,
    },
    {
      name: 'wrong column order',
      mutate: `
        drop table public.profiles;
        create table public.profiles (
          profile_id text not null,
          household_id uuid not null default auth.uid()
            references auth.users (id) on delete cascade,
          data jsonb not null,
          updated_at timestamptz not null default now(),
          primary key (household_id, profile_id)
        );
        alter table public.profiles owner to postgres;
        alter table public.profiles enable row level security;
      `,
      error: /column type, order, nullability, or default/,
    },
    {
      name: 'wrong primary key',
      mutate: `
        alter table public.profiles drop constraint profiles_pkey;
        alter table public.profiles
          add constraint profiles_pkey primary key (profile_id, household_id);
      `,
      error: /primary key or extra constraint/,
    },
    {
      name: 'missing primary-key index and constraint',
      mutate: 'alter table public.profiles drop constraint profiles_pkey',
      error: /primary key or extra constraint/,
    },
    {
      name: 'wrong Auth foreign-key target',
      mutate: `
        create table auth.other_users (id uuid primary key);
        insert into auth.other_users select id from auth.users;
        alter table public.profiles
          drop constraint profiles_household_id_fkey;
        alter table public.profiles
          add constraint profiles_household_id_fkey
          foreign key (household_id) references auth.other_users (id)
          on delete cascade;
      `,
      error: /auth\.users foreign key or delete action/,
    },
    {
      name: 'wrong Auth foreign-key delete behavior',
      mutate: `
        alter table public.profiles
          drop constraint profiles_household_id_fkey;
        alter table public.profiles
          add constraint profiles_household_id_fkey
          foreign key (household_id) references auth.users (id)
          on delete restrict;
      `,
      error: /auth\.users foreign key or delete action/,
    },
    {
      name: 'disabled RLS',
      mutate: 'alter table public.profiles disable row level security',
      error: /table kind, persistence, owner, or RLS/,
    },
    {
      name: 'unexpected forced RLS',
      mutate: 'alter table public.profiles force row level security',
      error: /table kind, persistence, owner, or RLS/,
    },
    {
      name: 'unexpected user trigger',
      mutate: `
        create function public.academy_profiles_unexpected_trigger()
        returns trigger
        language plpgsql
        as $$ begin return new; end $$;
        create trigger academy_profiles_unexpected_trigger
          before update on public.profiles
          for each row execute function
            public.academy_profiles_unexpected_trigger();
      `,
      error: /unexpected user trigger/,
    },
    {
      name: 'wrong policy USING expression',
      mutate: `
        drop policy profiles_select_own on public.profiles;
        create policy profiles_select_own on public.profiles
          for select using (true);
      `,
      error: /policy names, roles, commands, or expressions/,
    },
    {
      name: 'restrictive policy mode',
      mutate: `
        drop policy profiles_select_own on public.profiles;
        create policy profiles_select_own on public.profiles
          as restrictive
          for select
          to public
          using (household_id = auth.uid());
      `,
      error: /policy names, roles, commands, or expressions/,
    },
    {
      name: 'wrong policy WITH CHECK expression',
      mutate: `
        drop policy profiles_insert_own on public.profiles;
        create policy profiles_insert_own on public.profiles
          for insert with check (true);
      `,
      error: /policy names, roles, commands, or expressions/,
    },
    {
      name: 'wrong policy command',
      mutate: `
        drop policy profiles_select_own on public.profiles;
        create policy profiles_select_own on public.profiles
          for all
          using (household_id = auth.uid())
          with check (household_id = auth.uid());
      `,
      error: /policy names, roles, commands, or expressions/,
    },
    {
      name: 'wrong policy role',
      mutate: `
        alter policy profiles_select_own on public.profiles
          to authenticated;
      `,
      error: /policy names, roles, commands, or expressions/,
    },
    {
      name: 'missing policy',
      mutate: 'drop policy profiles_delete_own on public.profiles',
      error: /policy names, roles, commands, or expressions/,
    },
    {
      name: 'extra unexpected policy',
      mutate: `
        create policy profiles_unexpected on public.profiles
          for select using (true)
      `,
      error: /policy names, roles, commands, or expressions/,
    },
    {
      name: 'wrong owner',
      mutate: `
        create role academy_profiles_wrong_owner nologin;
        alter table public.profiles owner to academy_profiles_wrong_owner;
      `,
      error: /table kind, persistence, owner, or RLS/,
    },
    {
      name: 'wrong table ACL',
      mutate: 'grant select on public.profiles to anon',
      error: /anonymous, service, or unexpected table ACL/,
    },
    {
      name: 'wrong service_role table ACL',
      mutate: 'grant select on public.profiles to service_role',
      error: /anonymous, service, or unexpected table ACL/,
    },
    {
      name: 'wrong index',
      mutate:
        'create index profiles_updated_at_idx on public.profiles (updated_at)',
      error: /primary-key index or extra index/,
    },
  ]

  it.each(incompatibleDefinitions)(
    'rejects $name without repairing it',
    async ({ mutate, error }) => {
      const database = await createDatabase()
      await applyMigration(database)
      await database.exec(mutate)

      let rejection: unknown
      try {
        await applyMigration(database)
      } catch (cause) {
        rejection = cause
      }
      await database.exec('rollback')

      expect(rejection).toBeInstanceOf(Error)
      expect((rejection as Error).message).toMatch(error)
    },
    30_000,
  )

  it(
    'rejects restrictive policy drift without replacing the table or policy',
    async () => {
      const database = await createDatabase()
      await applyMigration(database)
      const tableOid = await database.query<{ oid: string }>(
        `select 'public.profiles'::regclass::oid::text as oid`,
      )
      await database.exec(`
        drop policy profiles_select_own on public.profiles;
        create policy profiles_select_own on public.profiles
          as restrictive
          for select
          to public
          using (household_id = auth.uid());
      `)
      const policySnapshotQuery = `
        select jsonb_agg(
          jsonb_build_object(
            'oid', policy.oid::text,
            'name', policy.polname,
            'permissive', policy.polpermissive,
            'command', policy.polcmd,
            'roles', policy.polroles,
            'using', pg_get_expr(
              policy.polqual,
              policy.polrelid,
              false
            ),
            'check', pg_get_expr(
              policy.polwithcheck,
              policy.polrelid,
              false
            )
          )
          order by policy.polname
        )::text as snapshot
        from pg_policy as policy
        where policy.polrelid = 'public.profiles'::regclass
      `
      const beforeCatalog = await catalogSnapshot(database)
      const beforePolicies = await database.query<{ snapshot: string }>(
        policySnapshotQuery,
      )
      expect(
        beforeCatalog.policies.find(
          (policy) => policy.name === 'profiles_select_own',
        ),
      ).toMatchObject({ permissive: false })

      let rejection: unknown
      try {
        await applyMigration(database)
      } catch (cause) {
        rejection = cause
      }
      await database.exec('rollback')

      expect(rejection).toBeInstanceOf(Error)
      expect((rejection as Error).message).toMatch(
        /policy names, roles, commands, or expressions/,
      )
      const afterTableOid = await database.query<{ oid: string }>(
        `select 'public.profiles'::regclass::oid::text as oid`,
      )
      expect(afterTableOid.rows).toEqual(tableOid.rows)
      expect(await catalogSnapshot(database)).toEqual(beforeCatalog)
      const afterPolicies = await database.query<{ snapshot: string }>(
        policySnapshotQuery,
      )
      expect(afterPolicies.rows).toEqual(beforePolicies.rows)
    },
    30_000,
  )

  it(
    'rejects excess effective schema privileges before touching profiles or repairing the grant',
    async () => {
      const database = await createDatabase()
      await applyMigration(database)
      const beforeCatalog = await catalogSnapshot(database)
      const beforeOid = await database.query<{ oid: string }>(
        `select 'public.profiles'::regclass::oid::text as oid`,
      )

      await database.exec('grant create on schema public to anon')
      await expect(applyMigration(database)).rejects.toThrow(
        /schema ACL drift/,
      )
      await database.exec('rollback')

      const afterOid = await database.query<{ oid: string }>(
        `select 'public.profiles'::regclass::oid::text as oid`,
      )
      expect(afterOid.rows).toEqual(beforeOid.rows)
      expect(await catalogSnapshot(database)).toEqual(beforeCatalog)
      expect(
        await database.query<{ allowed: boolean }>(
          `select has_schema_privilege(
             'anon',
             'public',
             'CREATE'
           ) as allowed`,
        ),
      ).toMatchObject({ rows: [{ allowed: true }] })
    },
    30_000,
  )

  it(
    'applies the exact reviewed base, identity, and CAS chain with compatible security boundaries',
    async () => {
      const database = await createDatabase()
      const timestamps = [
        '20260724074106',
        '20260724230000',
        '20260726120000',
      ]
      expect([...timestamps].sort()).toEqual(timestamps)

      const identityMigration = reviewedMigration(
        IDENTITY_COMMIT,
        IDENTITY_PATH,
        IDENTITY_BLOB,
      )
      const casMigration = reviewedMigration(
        CAS_COMMIT,
        CAS_PATH,
        CAS_BLOB,
      )

      await applyMigration(database)
      expect(await authenticatedCrudPrivileges(database)).toEqual({
        select_allowed: true,
        insert_allowed: true,
        update_allowed: true,
        delete_allowed: true,
      })

      await database.exec(identityMigration)
      expect(await authenticatedCrudPrivileges(database)).toEqual({
        select_allowed: true,
        insert_allowed: true,
        update_allowed: true,
        delete_allowed: true,
      })

      await database.exec(casMigration)

      const security = await database.query<{ snapshot: string }>(`
        select jsonb_build_object(
          'profile_acl', (
            select jsonb_agg(
              jsonb_build_array(
                case
                  when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee)
                end,
                acl.privilege_type
              )
              order by
                case
                  when acl.grantee = 0 then 'PUBLIC'
                  else pg_get_userbyid(acl.grantee)
                end,
                acl.privilege_type
            )
            from pg_class as relation
            cross join lateral aclexplode(relation.relacl) as acl
            where relation.oid = 'public.profiles'::regclass
              and acl.grantee <> relation.relowner
          ),
          'profile_rls', (
            select jsonb_build_array(
              relation.relrowsecurity,
              relation.relforcerowsecurity
            )
            from pg_class as relation
            where relation.oid = 'public.profiles'::regclass
          ),
          'profile_policies', (
            select count(*)
            from pg_policy
            where polrelid = 'public.profiles'::regclass
          ),
          'private_access', jsonb_build_array(
            has_schema_privilege(
              'anon',
              'academy_private',
              'USAGE'
            ),
            has_schema_privilege(
              'authenticated',
              'academy_private',
              'USAGE'
            ),
            has_schema_privilege(
              'service_role',
              'academy_private',
              'USAGE'
            )
          ),
          'wrong_relation_owners', (
            select count(*)
            from pg_class as relation
            join pg_namespace as namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname in ('public', 'academy_private')
              and (
                relation.relname like 'academy_%'
                or relation.relname = 'profiles'
              )
              and relation.relkind in ('r', 'p')
              and pg_get_userbyid(relation.relowner) <> 'postgres'
          ),
          'wrong_function_owners', (
            select count(*)
            from pg_proc as procedure
            join pg_namespace as namespace
              on namespace.oid = procedure.pronamespace
            where namespace.nspname in ('public', 'academy_private')
              and (
                procedure.proname like 'academy_%'
                or namespace.nspname = 'academy_private'
              )
              and pg_get_userbyid(procedure.proowner) <> 'postgres'
          ),
          'unsafe_identity_definers', (
            select count(*)
            from pg_proc as procedure
            join pg_namespace as namespace
              on namespace.oid = procedure.pronamespace
            where namespace.nspname in ('public', 'academy_private')
              and (
                procedure.proname like 'academy_%'
                or namespace.nspname = 'academy_private'
              )
              and procedure.prosecdef
              and procedure.proname not in (
                'academy_sync_snapshot',
                'academy_apply_profile_mutation',
                'academy_sync_is_text',
                'academy_sync_is_number',
                'academy_sync_is_date',
                'academy_sync_is_timestamp',
                'academy_sync_json_within_limits',
                'academy_sync_profile_is_valid'
              )
              and procedure.proconfig is distinct from
                array['search_path=pg_catalog']::text[]
          ),
          'unsafe_cas_definers', (
            select count(*)
            from pg_proc as procedure
            join pg_namespace as namespace
              on namespace.oid = procedure.pronamespace
            where namespace.nspname = 'public'
              and procedure.proname in (
                'academy_sync_snapshot',
                'academy_apply_profile_mutation',
                'academy_sync_is_text',
                'academy_sync_is_number',
                'academy_sync_is_date',
                'academy_sync_is_timestamp',
                'academy_sync_json_within_limits',
                'academy_sync_profile_is_valid'
              )
              and (
                not procedure.prosecdef
                or procedure.proconfig is distinct from
                  array['search_path=pg_catalog, pg_temp']::text[]
              )
          ),
          'identity_public_rls', (
            select bool_and(relation.relrowsecurity)
            from pg_class as relation
            join pg_namespace as namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname = 'public'
              and relation.relname like 'academy_%'
              and relation.relkind = 'r'
          ),
          'private_forced_rls', (
            select bool_and(
              relation.relrowsecurity
              and relation.relforcerowsecurity
            )
            from pg_class as relation
            join pg_namespace as namespace
              on namespace.oid = relation.relnamespace
            where namespace.nspname = 'academy_private'
              and relation.relkind = 'r'
          ),
          'fixture_rows', (
            select
              (select count(*) from public.profiles)
              + (select count(*) from public.academy_households)
              + (
                select count(*)
                from public.academy_household_memberships
              )
              + (select count(*) from public.academy_students)
              + (
                select count(*)
                from public.academy_guardian_student_access
              )
              + (
                select count(*)
                from public.academy_subject_enrollments
              )
              + (select count(*) from public.academy_audit_events)
              + (
                select count(*)
                from academy_private.student_access_credentials
              )
              + (
                select count(*)
                from academy_private.student_session_grants
              )
              + (
                select count(*)
                from public.academy_household_sync_state
              )
              + (
                select count(*)
                from public.academy_household_sync_mutations
              )
          ),
          'marker_rows', (
            select count(*)
            from academy_private.identity_foundation_metadata
          )
        )::text as snapshot
      `)
      const result = JSON.parse(security.rows[0].snapshot) as {
        profile_acl: string[][]
        profile_rls: boolean[]
        profile_policies: number
        private_access: boolean[]
        wrong_relation_owners: number
        wrong_function_owners: number
        unsafe_identity_definers: number
        unsafe_cas_definers: number
        identity_public_rls: boolean
        private_forced_rls: boolean
        fixture_rows: number
        marker_rows: number
      }
      expect(result.profile_acl).toEqual([
        ['authenticated', 'SELECT'],
      ])
      expect(result.profile_rls).toEqual([true, false])
      expect(result.profile_policies).toBe(4)
      expect(result.private_access).toEqual([false, false, true])
      expect(result.wrong_relation_owners).toBe(0)
      expect(result.wrong_function_owners).toBe(0)
      expect(result.unsafe_identity_definers).toBe(0)
      expect(result.unsafe_cas_definers).toBe(0)
      expect(result.identity_public_rls).toBe(true)
      expect(result.private_forced_rls).toBe(true)
      expect(result.fixture_rows).toBe(0)
      expect(result.marker_rows).toBe(1)
    },
    120_000,
  )
})
