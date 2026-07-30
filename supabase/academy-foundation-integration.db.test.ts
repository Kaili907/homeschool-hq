import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const migrations = [
  {
    timestamp: '20260724074106',
    path: 'supabase/migrations/20260724074106_academy_profiles_base.sql',
    blob: '0d0c03a6d6d8b78221dffc90994cc242ee94a778',
  },
  {
    timestamp: '20260724230000',
    path:
      'supabase/migrations/' +
      '20260724230000_academy_student_identity_foundation.sql',
    blob: 'df4cc097ba72561d4182a138760e82c2730a5fac',
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

      await database.exec(base)
      const profilesOid = await relationOid(database, 'public.profiles')
      await database.exec(base)
      expect(await relationOid(database, 'public.profiles')).toBe(profilesOid)

      await database.exec(identity)
      const identityBeforeRerun = await identityState(database)
      await database.exec(identity)
      const identityBeforeCas = await identityState(database)
      expect(identityDefinitionState(identityBeforeCas)).toEqual(
        identityDefinitionState(identityBeforeRerun),
      )

      await database.exec(cas)
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
    },
    120_000,
  )

  it(
    'rolls back a late CAS failure without changing approved base or identity state',
    async () => {
      const database = await createDatabase()
      const [base, identity, cas] = await integratedSql()
      await database.exec(base)
      await database.exec(identity)
      const profilesOid = await relationOid(database, 'public.profiles')
      const identityBefore = await identityState(database)
      const aclBefore = await schemaAcl(database)

      let rejection: unknown
      try {
        await database.exec(`
          begin;
          ${cas}
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
})
