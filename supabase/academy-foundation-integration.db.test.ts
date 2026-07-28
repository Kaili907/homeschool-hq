import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'
import { defaultAppState } from '../src/migration'

const migrations = [
  {
    timestamp: '20260724074106',
    path: 'supabase/migrations/20260724074106_academy_profiles_base.sql',
    blob: '57f0c1ce0e43a7e5af80c135c0f2a9170145d430',
  },
  {
    timestamp: '20260724230000',
    path:
      'supabase/migrations/' +
      '20260724230000_academy_student_identity_foundation.sql',
    blob: 'aa9074a45a1725301e6b606e84d332248e48539f',
  },
  {
    timestamp: '20260726120000',
    path:
      'supabase/migrations/' +
      '20260726120000_academy_household_revision_cas.sql',
    blob: 'c9aa82ddc7e9bd179107b50dfe6d87d9fbfa650f',
  },
] as const

const databases: PGlite[] = []
const HOUSEHOLD_A = '00000000-0000-4000-8000-00000000000a'
const HOUSEHOLD_B = '00000000-0000-4000-8000-00000000000b'
const STUDENT_A = '00000000-0000-4000-8000-00000000010a'
const STUDENT_B = '00000000-0000-4000-8000-00000000010b'
const MEMBERSHIP_A = '00000000-0000-4000-8000-00000000020a'
const MEMBERSHIP_B = '00000000-0000-4000-8000-00000000020b'

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
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;

    revoke all on schema auth from public;
    grant usage on schema auth to anon, authenticated, service_role;
    revoke all on function auth.uid() from public;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    revoke all on schema public from public, anon, authenticated, service_role;
    grant usage on schema public to public, anon, authenticated, service_role;
  `)
  return database
}

function profileRow(id: string, name: string) {
  const profile = structuredClone(defaultAppState().profiles[id])
  if (!profile) throw new Error(`Missing profile fixture ${id}`)
  profile.name = name
  return {
    profile_id: id,
    data: profile,
    updated_at: '2026-07-28T12:00:00Z',
  }
}

async function asAuthenticated<T>(
  database: PGlite,
  householdId: string,
  operation: () => Promise<T>,
) {
  await database.exec(`
    select set_config(
      'request.jwt.claim.sub',
      '${householdId}',
      false
    );
    set role authenticated;
  `)
  try {
    return await operation()
  } finally {
    await database.exec(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false);
    `)
  }
}

async function mutateProfiles(
  database: PGlite,
  householdId: string,
  expectedRevision: number,
  mutationId: string,
  rows: ReturnType<typeof profileRow>[],
) {
  return asAuthenticated(database, householdId, async () => {
    const result = await database.query<{
      result: {
        status: string
        revision: string
        replayed?: boolean
      }
    }>(
      `select public.academy_apply_profile_mutation(
         $1,
         $2,
         $3::jsonb
       ) as result`,
      [expectedRevision, mutationId, JSON.stringify(rows)],
    )
    return result.rows[0].result
  })
}

async function syncSnapshot(database: PGlite, householdId: string) {
  return asAuthenticated(database, householdId, async () => {
    const result = await database.query<{
      result: {
        revision: string
        rows: ReturnType<typeof profileRow>[]
      }
    }>('select public.academy_sync_snapshot() as result')
    return result.rows[0].result
  })
}

async function operationIsDenied(
  database: PGlite,
  role: 'anon' | 'authenticated',
  householdId: string | null,
  statement: string,
) {
  const result = await database.query<{ denied: boolean }>(
    `select pg_temp.academy_integration_operation_is_denied(
       $1::name,
       $2,
       $3
     ) as denied`,
    [role, householdId, statement],
  )
  return result.rows[0].denied
}

async function createIdentityFixtures(database: PGlite) {
  await database.exec(`
    insert into auth.users (id) values
      ('${HOUSEHOLD_A}'),
      ('${HOUSEHOLD_B}');

    insert into public.academy_households (
      id,
      name,
      status,
      created_by
    ) values
      ('${HOUSEHOLD_A}', 'Integration Household A', 'active', '${HOUSEHOLD_A}'),
      ('${HOUSEHOLD_B}', 'Integration Household B', 'active', '${HOUSEHOLD_B}');

    insert into public.academy_household_memberships (
      id,
      household_id,
      user_id,
      status,
      activated_at
    ) values
      (
        '${MEMBERSHIP_A}',
        '${HOUSEHOLD_A}',
        '${HOUSEHOLD_A}',
        'active',
        now()
      ),
      (
        '${MEMBERSHIP_B}',
        '${HOUSEHOLD_B}',
        '${HOUSEHOLD_B}',
        'active',
        now()
      );

    insert into public.academy_students (
      id,
      household_id,
      legacy_profile_id,
      display_name,
      current_grade_level,
      lifecycle_status,
      created_by
    ) values
      (
        '${STUDENT_A}',
        '${HOUSEHOLD_A}',
        'p1',
        'Integration Student A',
        '4',
        'active',
        '${HOUSEHOLD_A}'
      ),
      (
        '${STUDENT_B}',
        '${HOUSEHOLD_B}',
        'p1',
        'Integration Student B',
        '4',
        'active',
        '${HOUSEHOLD_B}'
      );

    insert into public.academy_guardian_student_access (
      household_id,
      student_id,
      membership_id,
      permission_level,
      status,
      granted_by
    ) values
      (
        '${HOUSEHOLD_A}',
        '${STUDENT_A}',
        '${MEMBERSHIP_A}',
        'identity_manager',
        'active',
        '${HOUSEHOLD_A}'
      ),
      (
        '${HOUSEHOLD_B}',
        '${STUDENT_B}',
        '${MEMBERSHIP_B}',
        'identity_manager',
        'active',
        '${HOUSEHOLD_B}'
      );

    insert into public.academy_subject_enrollments (
      household_id,
      student_id,
      school_year_key,
      subject_key,
      instructional_level,
      course_id,
      curriculum_version,
      enrollment_status,
      placement_source
    ) values
      (
        '${HOUSEHOLD_A}',
        '${STUDENT_A}',
        '2026-2027',
        'mathematics',
        'grade-4',
        'math-grade-4',
        '2026.1',
        'active',
        'parent'
      ),
      (
        '${HOUSEHOLD_B}',
        '${STUDENT_B}',
        '2026-2027',
        'mathematics',
        'grade-4',
        'math-grade-4',
        '2026.1',
        'active',
        'parent'
      );
  `)
}

async function integratedSql() {
  expect(migrations.map(({ timestamp }) => timestamp)).toEqual(
    [...migrations.map(({ timestamp }) => timestamp)].sort(),
  )
  return Promise.all(
    migrations.map(async ({ path, blob }) => {
      expect(
        execFileSync('git', ['rev-parse', `HEAD:${path}`], {
          encoding: 'utf8',
        }).trim(),
      ).toBe(blob)
      return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
    }),
  )
}

async function createMigrationLedger(database: PGlite) {
  await database.exec(`
    create schema supabase_migrations authorization postgres;
    create table supabase_migrations.schema_migrations (
      version text primary key
    );
  `)
}

async function recordMigration(database: PGlite, version: string) {
  await database.query(
    `
      insert into supabase_migrations.schema_migrations (version)
      values ($1)
    `,
    [version],
  )
}

async function migrationLedger(database: PGlite) {
  const result = await database.query<{ version: string }>(`
    select version
    from supabase_migrations.schema_migrations
    order by version
  `)
  return result.rows.map(({ version }) => version)
}

async function relationOid(database: PGlite, name: string) {
  const result = await database.query<{ oid: string | null }>(
    `select to_regclass($1)::oid::text as oid`,
    [name],
  )
  return result.rows[0].oid
}

async function identityState(database: PGlite) {
  const result = await database.query<{ snapshot: string }>(`
    with identity_relations as (
      select relation.oid, namespace.nspname, relation.relname
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where (
        namespace.nspname = 'public'
        and relation.relname in (
          'academy_households',
          'academy_household_memberships',
          'academy_students',
          'academy_guardian_student_access',
          'academy_subject_enrollments',
          'academy_audit_events'
        )
      ) or (
        namespace.nspname = 'academy_private'
        and relation.relname in (
          'student_access_credentials',
          'student_session_grants',
          'identity_foundation_metadata'
        )
      )
    )
    select jsonb_build_object(
      'relations', (
        select jsonb_agg(
          jsonb_build_array(
            identity_relations.nspname,
            identity_relations.relname,
            identity_relations.oid::text,
            relation.relrowsecurity,
            relation.relforcerowsecurity
          )
          order by identity_relations.nspname, identity_relations.relname
        )
        from identity_relations
        join pg_class as relation on relation.oid = identity_relations.oid
      ),
      'policies', (
        select coalesce(
          jsonb_agg(
            jsonb_build_array(
              identity_relations.nspname,
              identity_relations.relname,
              policy.polname,
              policy.oid::text,
              policy.polpermissive,
              policy.polcmd,
              pg_get_expr(policy.polqual, policy.polrelid),
              pg_get_expr(policy.polwithcheck, policy.polrelid)
            )
            order by
              identity_relations.nspname,
              identity_relations.relname,
              policy.polname
          ),
          '[]'::jsonb
        )
        from identity_relations
        join pg_policy as policy on policy.polrelid = identity_relations.oid
      )
    )::text as snapshot
  `)
  return result.rows[0].snapshot
}

function identityDefinitionState(snapshot: string) {
  const state = JSON.parse(snapshot) as {
    relations: unknown[][]
    policies: unknown[][]
  }
  return {
    relations: state.relations,
    policies: state.policies.map((policy) =>
      policy.filter((_value, index) => index !== 3),
    ),
  }
}

async function schemaAcl(database: PGlite) {
  const result = await database.query<{ snapshot: string }>(`
    select coalesce(
      jsonb_agg(
        jsonb_build_array(
          namespace.nspname,
          case
            when acl.grantee = 0 then 'PUBLIC'
            else pg_get_userbyid(acl.grantee)
          end,
          pg_get_userbyid(acl.grantor),
          acl.privilege_type,
          acl.is_grantable
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
      coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))
    ) as acl
    where namespace.nspname in ('auth', 'public', 'academy_private')
  `)
  return result.rows[0].snapshot
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()))
})

describe('Academy integrated foundation migration chain', () => {
  it(
    'preserves the approved blobs, designed reruns, identity, and final security boundaries',
    async () => {
      const database = await createDatabase()
      const [base, identity, cas] = await integratedSql()
      await createMigrationLedger(database)

      await database.exec(base)
      await recordMigration(database, migrations[0].timestamp)
      const profilesOid = await relationOid(database, 'public.profiles')
      await database.exec(base)
      expect(await relationOid(database, 'public.profiles')).toBe(profilesOid)

      await database.exec(identity)
      await recordMigration(database, migrations[1].timestamp)
      const identityBeforeRerun = await identityState(database)
      await database.exec(identity)
      const identityBeforeCas = await identityState(database)
      expect(identityDefinitionState(identityBeforeCas)).toEqual(
        identityDefinitionState(identityBeforeRerun),
      )

      await database.exec(cas)
      await recordMigration(database, migrations[2].timestamp)
      const identityAfterCas = await identityState(database)
      expect(identityAfterCas).toBe(identityBeforeCas)
      const casStateOid = await relationOid(
        database,
        'public.academy_household_sync_state',
      )
      const casReceiptsOid = await relationOid(
        database,
        'public.academy_household_sync_mutations',
      )
      await database.exec(cas)
      expect(
        await relationOid(
          database,
          'public.academy_household_sync_state',
        ),
      ).toBe(casStateOid)
      expect(
        await relationOid(
          database,
          'public.academy_household_sync_mutations',
        ),
      ).toBe(casReceiptsOid)
      expect(await identityState(database)).toBe(identityAfterCas)
      expect(await migrationLedger(database)).toEqual(
        migrations.map(({ timestamp }) => timestamp),
      )

      const security = await database.query<{
        profile_acl: string
        rpc_acl: string
        private_access: string
        fixture_rows: number
      }>(`
        select
          (
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
            )::text
            from pg_class as relation
            cross join lateral aclexplode(relation.relacl) as acl
            where relation.oid = 'public.profiles'::regclass
              and acl.grantee <> relation.relowner
          ) as profile_acl,
          jsonb_build_array(
            has_function_privilege(
              'anon',
              'public.academy_sync_snapshot()',
              'EXECUTE'
            ),
            has_function_privilege(
              'authenticated',
              'public.academy_sync_snapshot()',
              'EXECUTE'
            ),
            has_function_privilege(
              'anon',
              'public.academy_apply_profile_mutation(bigint,text,jsonb)',
              'EXECUTE'
            ),
            has_function_privilege(
              'authenticated',
              'public.academy_apply_profile_mutation(bigint,text,jsonb)',
              'EXECUTE'
            )
          )::text as rpc_acl,
          jsonb_build_array(
            has_schema_privilege('anon', 'academy_private', 'USAGE'),
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
          )::text as private_access,
          (
            (select count(*) from public.profiles)
            + (select count(*) from public.academy_households)
            + (select count(*) from public.academy_household_memberships)
            + (select count(*) from public.academy_students)
            + (select count(*) from public.academy_guardian_student_access)
            + (select count(*) from public.academy_subject_enrollments)
            + (select count(*) from public.academy_audit_events)
            + (select count(*) from academy_private.student_access_credentials)
            + (select count(*) from academy_private.student_session_grants)
            + (select count(*) from public.academy_household_sync_state)
            + (select count(*) from public.academy_household_sync_mutations)
          )::integer as fixture_rows
      `)
      expect(JSON.parse(security.rows[0].profile_acl)).toEqual([
        ['authenticated', 'SELECT'],
      ])
      expect(JSON.parse(security.rows[0].rpc_acl)).toEqual([
        false,
        true,
        false,
        true,
      ])
      expect(JSON.parse(security.rows[0].private_access)).toEqual([
        false,
        false,
        true,
      ])
      expect(security.rows[0].fixture_rows).toBe(0)

      await database.exec(`
        begin;
        create or replace function pg_temp.academy_integration_operation_is_denied(
          test_role name,
          test_household text,
          statement_sql text
        )
        returns boolean
        language plpgsql
        set search_path = pg_catalog, pg_temp
        as $$
        declare
          failure_state text;
        begin
          perform set_config(
            'request.jwt.claim.sub',
            coalesce(test_household, ''),
            true
          );
          execute format('set local role %I', test_role);
          begin
            execute statement_sql;
            execute 'reset role';
            return false;
          exception when others then
            get stacked diagnostics failure_state = returned_sqlstate;
            execute 'reset role';
            return failure_state in (
              '28000',
              '42501',
              '23503',
              '23514'
            );
          end;
        end;
        $$;
      `)
      await createIdentityFixtures(database)

      expect(
        await mutateProfiles(database, HOUSEHOLD_A, 0, 'seed-a', [
          profileRow('p1', 'Household A Profile'),
        ]),
      ).toEqual({ status: 'applied', revision: '1' })
      expect(
        await mutateProfiles(database, HOUSEHOLD_B, 0, 'seed-b', [
          profileRow('p1', 'Household B Profile'),
        ]),
      ).toEqual({ status: 'applied', revision: '1' })

      const householdAProfiles = await asAuthenticated(
        database,
        HOUSEHOLD_A,
        () =>
          database.query<{ household_id: string; name: string }>(`
            select household_id::text, data->>'name' as name
            from public.profiles
            order by profile_id
          `),
      )
      expect(householdAProfiles.rows).toEqual([
        {
          household_id: HOUSEHOLD_A,
          name: 'Household A Profile',
        },
      ])

      const guardianAStudents = await asAuthenticated(
        database,
        HOUSEHOLD_A,
        () =>
          database.query<{ id: string; household_id: string }>(`
            select id::text, household_id::text
            from public.academy_students
            order by id
          `),
      )
      expect(guardianAStudents.rows).toEqual([
        { id: STUDENT_A, household_id: HOUSEHOLD_A },
      ])
      const guardianAHouseholds = await asAuthenticated(
        database,
        HOUSEHOLD_A,
        () =>
          database.query<{ id: string }>(`
            select id::text
            from public.academy_households
            order by id
          `),
      )
      expect(guardianAHouseholds.rows).toEqual([{ id: HOUSEHOLD_A }])

      expect(
        await operationIsDenied(
          database,
          'anon',
          null,
          'select * from public.profiles',
        ),
      ).toBe(true)
      expect(
        await operationIsDenied(
          database,
          'authenticated',
          HOUSEHOLD_A,
          `
            insert into public.profiles (profile_id, data)
            values ('p2', '{"id":"p2"}'::jsonb)
          `,
        ),
      ).toBe(true)
      expect(
        await operationIsDenied(
          database,
          'authenticated',
          HOUSEHOLD_A,
          `
            update public.profiles
            set data = jsonb_set(data, '{name}', '"tampered"')
            where household_id = '${HOUSEHOLD_A}'
          `,
        ),
      ).toBe(true)
      expect(
        await operationIsDenied(
          database,
          'authenticated',
          HOUSEHOLD_A,
          `
            delete from public.profiles
            where household_id = '${HOUSEHOLD_A}'
          `,
        ),
      ).toBe(true)
      expect(
        await operationIsDenied(
          database,
          'authenticated',
          HOUSEHOLD_A,
          `
            update public.profiles
            set data = jsonb_set(data, '{name}', '"cross-household"')
            where household_id = '${HOUSEHOLD_B}'
          `,
        ),
      ).toBe(true)

      expect(
        await mutateProfiles(database, HOUSEHOLD_A, 0, 'stale-a', [
          profileRow('p1', 'Stale Household A Profile'),
        ]),
      ).toEqual({ status: 'conflict', revision: '1' })

      const snapshotA = await syncSnapshot(database, HOUSEHOLD_A)
      const snapshotB = await syncSnapshot(database, HOUSEHOLD_B)
      expect(snapshotA.revision).toBe('1')
      expect(snapshotA.rows).toHaveLength(1)
      expect(snapshotA.rows[0].data.name).toBe('Household A Profile')
      expect(snapshotB.revision).toBe('1')
      expect(snapshotB.rows).toHaveLength(1)
      expect(snapshotB.rows[0].data.name).toBe('Household B Profile')

      const identityFixtureCounts = await database.query<{
        households: number
        students: number
        access_rows: number
        enrollments: number
      }>(`
        select
          (select count(*) from public.academy_households)::integer
            as households,
          (select count(*) from public.academy_students)::integer as students,
          (
            select count(*)
            from public.academy_guardian_student_access
          )::integer as access_rows,
          (
            select count(*)
            from public.academy_subject_enrollments
          )::integer as enrollments
      `)
      expect(identityFixtureCounts.rows[0]).toEqual({
        households: 2,
        students: 2,
        access_rows: 2,
        enrollments: 2,
      })

      await database.exec('rollback')
      const cleaned = await database.query<{ fixture_rows: number }>(`
        select (
          (select count(*) from public.profiles)
          + (select count(*) from public.academy_households)
          + (select count(*) from public.academy_household_memberships)
          + (select count(*) from public.academy_students)
          + (select count(*) from public.academy_guardian_student_access)
          + (select count(*) from public.academy_subject_enrollments)
          + (select count(*) from public.academy_audit_events)
          + (select count(*) from academy_private.student_access_credentials)
          + (select count(*) from academy_private.student_session_grants)
          + (select count(*) from public.academy_household_sync_state)
          + (select count(*) from public.academy_household_sync_mutations)
          + (select count(*) from auth.users)
        )::integer as fixture_rows
      `)
      expect(cleaned.rows[0].fixture_rows).toBe(0)
    },
    120_000,
  )

  it(
    'rolls back a late CAS failure without changing approved base or identity state',
    async () => {
      const database = await createDatabase()
      const [base, identity, cas] = await integratedSql()
      await createMigrationLedger(database)
      await database.exec(base)
      await recordMigration(database, migrations[0].timestamp)
      await database.exec(identity)
      await recordMigration(database, migrations[1].timestamp)
      const profilesOid = await relationOid(database, 'public.profiles')
      const identityBefore = await identityState(database)
      const aclBefore = await schemaAcl(database)

      let rejection: unknown
      try {
        await database.exec(`
          begin;
          ${cas}
          insert into supabase_migrations.schema_migrations (version)
          values ('${migrations[2].timestamp}');
          do $academy_integration_late_failure$
          begin
            raise exception 'Academy integration CAS late failure';
          end;
          $academy_integration_late_failure$;
          commit;
        `)
      } catch (error) {
        rejection = error
        await database.exec('rollback')
      }
      expect(String(rejection)).toContain(
        'Academy integration CAS late failure',
      )

      expect(await relationOid(database, 'public.profiles')).toBe(profilesOid)
      expect(await identityState(database)).toBe(identityBefore)
      expect(await schemaAcl(database)).toBe(aclBefore)
      expect(await migrationLedger(database)).toEqual([
        migrations[0].timestamp,
        migrations[1].timestamp,
      ])
      expect(
        await relationOid(
          database,
          'public.academy_household_sync_state',
        ),
      ).toBeNull()
      expect(
        await relationOid(
          database,
          'public.academy_household_sync_mutations',
        ),
      ).toBeNull()
      const casFunctions = await database.query<{ count: number }>(`
        select count(*)::integer as count
        from pg_proc as procedure
        join pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and (
            procedure.proname like 'academy_sync_%'
            or procedure.proname = 'academy_apply_profile_mutation'
          )
      `)
      expect(casFunctions.rows[0].count).toBe(0)
    },
    120_000,
  )

  it(
    'enforces the complete effective schema, table, function, owner, and RLS surface',
    async () => {
      const database = await createDatabase()
      const [base, identity, cas] = await integratedSql()
      await database.exec(base)
      await database.exec(identity)
      await database.exec(cas)

      const schemaPrivileges = await database.query<{
        role_name: string
        schema_name: string
        privilege_name: string
        allowed: boolean
        grantable: boolean
      }>(`
        with roles(role_name) as (
          values
            ('anon'::text),
            ('authenticated'::text),
            ('service_role'::text),
            ('postgres'::text)
        ),
        schemas(schema_name) as (
          values
            ('public'::text),
            ('auth'::text),
            ('academy_private'::text)
        ),
        privileges(privilege_name) as (
          values ('CREATE'::text), ('USAGE'::text)
        )
        select
          role_name,
          schema_name,
          privilege_name,
          has_schema_privilege(
            role_name,
            schema_name,
            privilege_name
          ) as allowed,
          has_schema_privilege(
            role_name,
            schema_name,
            privilege_name || ' WITH GRANT OPTION'
          ) as grantable
        from roles
        cross join schemas
        cross join privileges
        order by role_name, schema_name, privilege_name
      `)
      const expectedSchema: Record<string, Record<string, string[]>> = {
        anon: {
          public: ['USAGE'],
          auth: ['USAGE'],
          academy_private: [],
        },
        authenticated: {
          public: ['USAGE'],
          auth: ['USAGE'],
          academy_private: [],
        },
        service_role: {
          public: ['USAGE'],
          auth: ['USAGE'],
          academy_private: ['USAGE'],
        },
        postgres: {
          public: ['CREATE', 'USAGE'],
          auth: ['CREATE', 'USAGE'],
          academy_private: ['CREATE', 'USAGE'],
        },
      }
      for (const privilege of schemaPrivileges.rows) {
        const expected = expectedSchema[privilege.role_name][
          privilege.schema_name
        ].includes(privilege.privilege_name)
        expect(privilege.allowed).toBe(expected)
        expect(privilege.grantable).toBe(
          privilege.role_name === 'postgres' && expected,
        )
      }

      const tablePrivileges = await database.query<{
        role_name: string
        table_name: string
        privilege_name: string
        allowed: boolean
        grantable: boolean
      }>(`
        with roles(role_name) as (
          values
            ('anon'::text),
            ('authenticated'::text),
            ('service_role'::text),
            ('postgres'::text)
        ),
        tables(table_name) as (
          values
            ('public.profiles'::text),
            ('public.academy_households'::text),
            ('public.academy_household_memberships'::text),
            ('public.academy_students'::text),
            ('public.academy_guardian_student_access'::text),
            ('public.academy_subject_enrollments'::text),
            ('public.academy_audit_events'::text),
            ('academy_private.student_access_credentials'::text),
            ('academy_private.student_session_grants'::text),
            ('academy_private.identity_foundation_metadata'::text),
            ('public.academy_household_sync_state'::text),
            ('public.academy_household_sync_mutations'::text)
        ),
        privileges(privilege_name) as (
          values
            ('SELECT'::text),
            ('INSERT'::text),
            ('UPDATE'::text),
            ('DELETE'::text),
            ('TRUNCATE'::text),
            ('REFERENCES'::text),
            ('TRIGGER'::text)
        )
        select
          role_name,
          table_name,
          privilege_name,
          has_table_privilege(
            role_name,
            table_name,
            privilege_name
          ) as allowed,
          has_table_privilege(
            role_name,
            table_name,
            privilege_name || ' WITH GRANT OPTION'
          ) as grantable
        from roles
        cross join tables
        cross join privileges
        order by role_name, table_name, privilege_name
      `)
      const authenticatedSelect = new Set([
        'public.profiles',
        'public.academy_households',
        'public.academy_household_memberships',
        'public.academy_students',
        'public.academy_guardian_student_access',
        'public.academy_subject_enrollments',
        'public.academy_audit_events',
      ])
      const serviceReadWrite = new Set([
        'public.academy_households',
        'public.academy_household_memberships',
        'public.academy_students',
        'public.academy_guardian_student_access',
        'public.academy_subject_enrollments',
        'academy_private.student_access_credentials',
        'academy_private.student_session_grants',
      ])
      for (const privilege of tablePrivileges.rows) {
        let expected = privilege.role_name === 'postgres'
        if (
          privilege.role_name === 'authenticated' &&
          privilege.privilege_name === 'SELECT'
        ) {
          expected = authenticatedSelect.has(privilege.table_name)
        }
        if (privilege.role_name === 'service_role') {
          expected =
            (
              serviceReadWrite.has(privilege.table_name) &&
              ['SELECT', 'INSERT', 'UPDATE'].includes(
                privilege.privilege_name,
              )
            ) ||
            (
              privilege.table_name ===
                'public.academy_audit_events' &&
              privilege.privilege_name === 'SELECT'
            )
        }
        expect(privilege.allowed).toBe(expected)
        expect(privilege.grantable).toBe(
          privilege.role_name === 'postgres' && expected,
        )
      }

      const functions = await database.query<{
        signature: string
        owner: string
        security_definer: boolean
        config: string[] | null
        public_execute: boolean
      }>(`
        select
          namespace.nspname || '.' || procedure.proname || '('
            || pg_get_function_identity_arguments(procedure.oid)
            || ')' as signature,
          pg_get_userbyid(procedure.proowner) as owner,
          procedure.prosecdef as security_definer,
          procedure.proconfig as config,
          exists (
            select 1
            from aclexplode(
              coalesce(
                procedure.proacl,
                acldefault('f', procedure.proowner)
              )
            ) as acl
            where acl.grantee = 0
              and acl.privilege_type = 'EXECUTE'
          ) as public_execute
        from pg_proc as procedure
        join pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        where (
          namespace.nspname = 'auth'
          and procedure.proname = 'uid'
        ) or (
          namespace.nspname = 'public'
          and procedure.proname like 'academy_%'
        ) or (
          namespace.nspname = 'academy_private'
          and procedure.proname not like 'academy_probe_%'
        )
        order by signature
      `)
      expect(functions.rows).not.toHaveLength(0)
      for (const procedure of functions.rows) {
        expect(procedure.owner).toBe('postgres')
        expect(procedure.public_execute).toBe(false)
        if (procedure.security_definer) {
          const configuredPath =
            procedure.config?.find((value) =>
              value.startsWith('search_path='),
            ) ?? ''
          expect(configuredPath).toMatch(
            /^search_path=pg_catalog(, pg_temp)?$/,
          )
        }
      }

      const functionPrivileges = await database.query<{
        role_name: string
        signature: string
        allowed: boolean
        grantable: boolean
      }>(`
        with roles(role_name) as (
          values
            ('anon'::text),
            ('authenticated'::text),
            ('service_role'::text),
            ('postgres'::text)
        ),
        functions(function_oid, signature) as (
          select
            procedure.oid,
            namespace.nspname || '.' || procedure.proname || '('
              || pg_get_function_identity_arguments(procedure.oid)
              || ')'
          from pg_proc as procedure
          join pg_namespace as namespace
            on namespace.oid = procedure.pronamespace
          where (
            namespace.nspname = 'auth'
            and procedure.proname = 'uid'
          ) or (
            namespace.nspname = 'public'
            and procedure.proname like 'academy_%'
          ) or (
            namespace.nspname = 'academy_private'
            and procedure.proname not like 'academy_probe_%'
          )
        )
        select
          role_name,
          signature,
          has_function_privilege(
            role_name,
            function_oid,
            'EXECUTE'
          ) as allowed,
          has_function_privilege(
            role_name,
            function_oid,
            'EXECUTE WITH GRANT OPTION'
          ) as grantable
        from roles
        cross join functions
        order by role_name, signature
      `)
      const authenticatedFunctions = new Set([
        'auth.uid()',
        'public.academy_is_active_household_guardian(target_household_id uuid)',
        'public.academy_is_current_guardian_membership(target_membership_id uuid)',
        'public.academy_has_student_permission(target_student_id uuid, required_permission text)',
        'public.academy_sync_snapshot()',
        'public.academy_apply_profile_mutation(p_expected_revision bigint, p_mutation_id text, p_profiles jsonb)',
      ])
      const serviceFunctions = new Set([
        'auth.uid()',
        'academy_private.is_canonical_unpadded_base64(encoded_value text, minimum_decoded_bytes integer, maximum_decoded_bytes integer)',
        'academy_private.is_valid_student_verifier(verifier_scheme text, verifier_digest text)',
        'academy_private.is_valid_raw_student_session_token(raw_token text)',
        'academy_private.security_text_is_safe(candidate text, maximum_bytes integer)',
        'academy_private.audit_reason_is_safe(candidate text, maximum_bytes integer)',
        'academy_private.student_capabilities_are_valid(capability_values text[])',
        'academy_private.is_student_session_grant_current(target_grant_id uuid)',
        'academy_private.reset_student_sessions(target_student_id uuid, reset_reason text, reset_correlation_id uuid)',
      ])
      for (const privilege of functionPrivileges.rows) {
        const expected =
          privilege.role_name === 'postgres' ||
          (
            privilege.role_name === 'anon' &&
            privilege.signature === 'auth.uid()'
          ) ||
          (
            privilege.role_name === 'authenticated' &&
            authenticatedFunctions.has(privilege.signature)
          ) ||
          (
            privilege.role_name === 'service_role' &&
            serviceFunctions.has(privilege.signature)
          )
        expect(
          privilege.allowed,
          `${privilege.role_name} EXECUTE ${privilege.signature}`,
        ).toBe(expected)
        expect(
          privilege.grantable,
          `${privilege.role_name} EXECUTE grant option ${privilege.signature}`,
        ).toBe(privilege.role_name === 'postgres')
      }

      const publicAcl = await database.query<{
        object_kind: string
        object_name: string
        privilege: string
        grantable: boolean
      }>(`
        select
          'schema'::text as object_kind,
          namespace.nspname as object_name,
          acl.privilege_type as privilege,
          acl.is_grantable as grantable
        from pg_namespace as namespace
        cross join lateral aclexplode(
          coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))
        ) as acl
        where namespace.nspname in ('public', 'auth', 'academy_private')
          and acl.grantee = 0
        union all
        select
          'table',
          namespace.nspname || '.' || relation.relname,
          acl.privilege_type,
          acl.is_grantable
        from pg_class as relation
        join pg_namespace as namespace
          on namespace.oid = relation.relnamespace
        cross join lateral aclexplode(
          coalesce(relation.relacl, acldefault('r', relation.relowner))
        ) as acl
        where relation.relkind = 'r'
          and acl.grantee = 0
          and (
            relation.relname = 'profiles'
            or relation.relname like 'academy_%'
            or (
              namespace.nspname = 'academy_private'
              and relation.relname in (
                'student_access_credentials',
                'student_session_grants',
                'identity_foundation_metadata'
              )
            )
          )
        union all
        select
          'function',
          namespace.nspname || '.' || procedure.proname || '('
            || pg_get_function_identity_arguments(procedure.oid)
            || ')',
          acl.privilege_type,
          acl.is_grantable
        from pg_proc as procedure
        join pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        cross join lateral aclexplode(
          coalesce(procedure.proacl, acldefault('f', procedure.proowner))
        ) as acl
        where acl.grantee = 0
          and (
            (
              namespace.nspname = 'auth'
              and procedure.proname = 'uid'
            ) or (
              namespace.nspname = 'public'
              and procedure.proname like 'academy_%'
            ) or (
              namespace.nspname = 'academy_private'
              and procedure.proname not like 'academy_probe_%'
            )
          )
        order by object_kind, object_name, privilege
      `)
      expect(publicAcl.rows).toEqual([
        {
          object_kind: 'schema',
          object_name: 'public',
          privilege: 'USAGE',
          grantable: false,
        },
      ])

      const rls = await database.query<{
        table_name: string
        enabled: boolean
        forced: boolean
        owner: string
      }>(`
        select
          namespace.nspname || '.' || relation.relname as table_name,
          relation.relrowsecurity as enabled,
          relation.relforcerowsecurity as forced,
          pg_get_userbyid(relation.relowner) as owner
        from pg_class as relation
        join pg_namespace as namespace
          on namespace.oid = relation.relnamespace
        where relation.relkind = 'r'
          and (
            relation.relname = 'profiles'
            or relation.relname like 'academy_%'
            or (
              namespace.nspname = 'academy_private'
              and relation.relname in (
                'student_access_credentials',
                'student_session_grants',
                'identity_foundation_metadata'
              )
            )
          )
        order by table_name
      `)
      for (const table of rls.rows) {
        expect(table.owner).toBe('postgres')
        expect(table.enabled).toBe(true)
        expect(table.forced).toBe(
          table.table_name.startsWith('academy_private.'),
        )
      }

      const inheritedApplicationRoles = await database.query<{
        count: number
      }>(`
        select count(*)::integer as count
        from pg_auth_members as membership
        join pg_roles as member_role
          on member_role.oid = membership.member
        where member_role.rolname in (
          'anon',
          'authenticated',
          'service_role'
        )
      `)
      expect(inheritedApplicationRoles.rows[0].count).toBe(0)
    },
    120_000,
  )
})
