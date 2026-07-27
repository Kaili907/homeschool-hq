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

const databases: PGlite[] = []

async function createDatabase() {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;

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
    grant usage on schema public to anon, authenticated, service_role;

    insert into auth.users (id) values
      ('${HOUSEHOLD_A}'::uuid),
      ('${HOUSEHOLD_B}'::uuid);
  `)
  return database
}

async function migrationSql() {
  return readFile(migrationPath, 'utf8')
}

async function applyMigration(database: PGlite) {
  await database.exec(await migrationSql())
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

  const incompatibleDefinitions: Array<{
    name: string
    mutate: string
    error: RegExp
  }> = [
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
      name: 'wrong primary key',
      mutate: `
        alter table public.profiles drop constraint profiles_pkey;
        alter table public.profiles
          add constraint profiles_pkey primary key (profile_id, household_id);
      `,
      error: /primary key or extra constraint/,
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
      name: 'changed policy expression',
      mutate: `
        drop policy profiles_select_own on public.profiles;
        create policy profiles_select_own on public.profiles
          for select using (true);
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
})
