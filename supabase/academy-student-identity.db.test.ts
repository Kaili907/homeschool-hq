import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, describe, expect, it } from 'vitest'

const schemaSqlPromise = readFile(
  new URL('./schema.sql', import.meta.url),
  'utf8',
)
const migrationSqlPromise = readFile(
  new URL(
    './migrations/20260724230000_academy_student_identity_foundation.sql',
    import.meta.url,
  ),
  'utf8',
)
const probeSqlPromise = readFile(
  new URL(
    './tests/academy_student_identity_rls_probes.sql',
    import.meta.url,
  ),
  'utf8',
)

const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth authorization postgres;
  create table auth.users (
    id uuid primary key,
    instance_id uuid,
    aud text,
    role text,
    email text,
    encrypted_password text,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    created_at timestamptz,
    updated_at timestamptz
  );

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  set search_path = pg_catalog
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif(
        (
          nullif(current_setting('request.jwt.claims', true), '')::jsonb
        ) ->> 'sub',
        ''
      )::uuid
    )
  $$;

  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

const databases: PGlite[] = []

function sectionBetween(
  source: string,
  beginMarker: string,
  endMarker: string,
) {
  const begin = source.indexOf(beginMarker)
  const end = source.indexOf(endMarker)
  if (begin < 0 || end < 0 || end <= begin) {
    throw new Error(`SQL section was not found: ${beginMarker}`)
  }
  return source.slice(begin + beginMarker.length, end)
}

function allRows(
  results: Awaited<ReturnType<PGlite['exec']>>,
): Record<string, unknown>[] {
  return results.flatMap((result) => result.rows ?? [])
}

function probeSummary(results: Awaited<ReturnType<PGlite['exec']>>) {
  const rows = allRows(results)
  const probes = rows.filter(
    (row) =>
      typeof row.probe_id === 'string' &&
      (row.result === 'PASS' || row.result === 'FAIL'),
  )
  const summary = rows.findLast(
    (row) =>
      Object.hasOwn(row, 'pass_count') &&
      Object.hasOwn(row, 'fail_count') &&
      Object.hasOwn(row, 'total_count'),
  )
  if (!summary) {
    throw new Error('Identity probe summary was not returned')
  }
  return {
    pass: Number(summary.pass_count),
    fail: Number(summary.fail_count),
    total: Number(summary.total_count),
    probes,
  }
}

async function createDatabase() {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrapSql)
  await database.exec(await schemaSqlPromise)
  return database
}

async function catalogSnapshot(database: PGlite) {
  const result = await database.query<{
    manifest: string
    verification_count: number
    object_counts: string
  }>(`
    with managed_relations as (
      select relation.oid
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where (
        namespace.nspname = 'public'
        and relation.relname like 'academy_%'
      ) or (
        namespace.nspname = 'academy_private'
        and relation.relname in (
          'student_access_credentials',
          'student_session_grants',
          'identity_foundation_metadata'
        )
      )
    )
    select
      metadata.security_manifest::text as manifest,
      metadata.verification_count::integer,
      jsonb_build_object(
        'tables', (
          select count(*)
          from pg_catalog.pg_class as relation
          join pg_catalog.pg_namespace as namespace
            on namespace.oid = relation.relnamespace
          where relation.relkind = 'r'
            and (
              (
                namespace.nspname = 'public'
                and relation.relname like 'academy_%'
              ) or (
                namespace.nspname = 'academy_private'
                and relation.relname in (
                  'student_access_credentials',
                  'student_session_grants',
                  'identity_foundation_metadata'
                )
              )
            )
        ),
        'policies', (
          select count(*) from pg_catalog.pg_policy
          where polrelid in (select oid from managed_relations)
        ),
        'triggers', (
          select count(*) from pg_catalog.pg_trigger
          where tgrelid in (select oid from managed_relations)
            and not tgisinternal
        ),
        'indexes', (
          select count(*) from pg_catalog.pg_index
          where indrelid in (select oid from managed_relations)
        ),
        'functions', (
          select count(*)
          from pg_catalog.pg_proc as procedure
          join pg_catalog.pg_namespace as namespace
            on namespace.oid = procedure.pronamespace
          where (
            namespace.nspname = 'public'
            and procedure.proname in (
              'academy_is_active_household_guardian',
              'academy_is_current_guardian_membership',
              'academy_has_student_permission'
            )
          ) or (
            namespace.nspname = 'academy_private'
            and procedure.proname not like 'academy_probe_%'
          )
        )
      )::text as object_counts
    from academy_private.identity_foundation_metadata as metadata
    where metadata.singleton
  `)
  return result.rows[0]
}

async function sentinelSnapshot(database: PGlite) {
  const result = await database.query<{ snapshot: string }>(`
    select jsonb_build_object(
      'sentinel_owner', pg_catalog.pg_get_userbyid(sentinel.relowner),
      'function_owner', pg_catalog.pg_get_userbyid(function_row.proowner),
      'schema_acl', coalesce(namespace.nspacl::text, ''),
      'table_acl', coalesce(sentinel.relacl::text, ''),
      'function_acl', coalesce(function_row.proacl::text, ''),
      'baseline_owner', baseline.sentinel_owner,
      'baseline_function_owner', baseline.function_owner,
      'baseline_schema_acl', baseline.schema_acl,
      'baseline_table_acl', baseline.table_acl,
      'baseline_function_acl', baseline.function_acl
    )::text as snapshot
    from academy_private.academy_probe_acl_baseline as baseline
    join pg_catalog.pg_namespace as namespace
      on namespace.nspname = 'academy_private'
    join pg_catalog.pg_class as sentinel
      on sentinel.relnamespace = namespace.oid
     and sentinel.relname = 'academy_probe_unrelated_grant_sentinel'
    join pg_catalog.pg_proc as function_row
      on function_row.pronamespace = namespace.oid
     and function_row.proname = 'academy_probe_unrelated_acl_function'
    where baseline.singleton
  `)
  return result.rows[0].snapshot
}

async function residualIdentityRows(database: PGlite) {
  const result = await database.query<{ count: number }>(`
    select (
      (select count(*) from public.academy_households)
      + (select count(*) from public.academy_household_memberships)
      + (select count(*) from public.academy_students)
      + (select count(*) from public.academy_guardian_student_access)
      + (select count(*) from public.academy_subject_enrollments)
      + (select count(*) from public.academy_audit_events)
      + (select count(*) from academy_private.student_access_credentials)
      + (select count(*) from academy_private.student_session_grants)
    )::integer as count
  `)
  return result.rows[0].count
}

const incompatibleCases = [
  {
    name: 'markerless incompatible table',
    beforeFirst:
      'create schema if not exists academy_private; ' +
      'create table public.academy_households (id text);',
  },
  {
    name: 'wrong column nullability',
    mutation:
      'alter table public.academy_students ' +
      'alter column display_name drop not null',
  },
  {
    name: 'wrong column default',
    mutation:
      'alter table public.academy_students ' +
      'alter column session_version set default 99',
  },
  {
    name: 'wrong foreign-key action',
    mutation: `
      alter table public.academy_students
        drop constraint academy_students_household_id_fkey;
      alter table public.academy_students
        add constraint academy_students_household_id_fkey
        foreign key (household_id)
        references public.academy_households(id)
        on delete cascade;
    `,
  },
  {
    name: 'wrong check constraint',
    mutation: `
      alter table public.academy_students
        drop constraint academy_students_lifecycle_reason_check;
      alter table public.academy_students
        add constraint academy_students_lifecycle_reason_check check (true);
    `,
  },
  {
    name: 'missing forced RLS',
    mutation:
      'alter table academy_private.student_session_grants ' +
      'no force row level security',
  },
  {
    name: 'wrong function owner',
    mutation: `
      create role academy_wrong_owner nologin;
      alter function public.academy_has_student_permission(uuid, text)
        owner to academy_wrong_owner;
    `,
  },
  {
    name: 'wrong function security mode',
    mutation:
      'alter function public.academy_is_active_household_guardian(uuid) ' +
      'security invoker',
  },
  {
    name: 'unsafe function search_path',
    mutation:
      'alter function public.academy_is_current_guardian_membership(uuid) ' +
      'set search_path = public',
  },
  {
    name: 'wrong policy expression',
    mutation: `
      drop policy academy_students_guardian_select
        on public.academy_students;
      create policy academy_students_guardian_select
        on public.academy_students
        for select to authenticated using (true);
    `,
  },
  {
    name: 'wrong trigger function',
    mutation: `
      drop trigger academy_students_prepare_update
        on public.academy_students;
      create trigger academy_students_prepare_update
        before update on public.academy_students
        for each row execute function academy_private.touch_updated_at();
    `,
  },
  {
    name: 'wrong private-table ACL',
    mutation:
      'grant select on academy_private.student_access_credentials ' +
      'to authenticated',
  },
] as const

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()))
})

describe('Academy student identity migration', () => {
  it(
    'runs twice with zero-failure real-role probes and no residual fixtures',
    async () => {
      const database = await createDatabase()
      const migrationSql = await migrationSqlPromise
      const probeSql = await probeSqlPromise
      const sentinelSql = sectionBetween(
        probeSql,
        '-- ACADEMY SENTINEL PREFLIGHT BEGIN',
        '-- ACADEMY SENTINEL PREFLIGHT END',
      )
      const roleProbeSql = sectionBetween(
        probeSql,
        '-- ACADEMY ROLE PROBES BEGIN',
        '-- ACADEMY ROLE PROBES END',
      )

      await database.exec(sentinelSql)
      await database.exec(migrationSql)
      const firstCatalog = await catalogSnapshot(database)
      const firstSentinel = await sentinelSnapshot(database)
      const firstProbe = probeSummary(await database.exec(roleProbeSql))

      console.info(
        `Academy identity Probe Run 1: ${firstProbe.pass} PASS, ` +
          `${firstProbe.fail} FAIL, ${firstProbe.total} total`,
      )
      expect(firstProbe.fail).toBe(0)
      expect(firstProbe.pass).toBe(firstProbe.total)
      expect(firstProbe.probes).toHaveLength(firstProbe.total)
      expect(firstProbe.total).toBeGreaterThan(110)
      expect(await residualIdentityRows(database)).toBe(0)

      await database.exec(migrationSql)
      const secondCatalog = await catalogSnapshot(database)
      const secondSentinel = await sentinelSnapshot(database)
      const secondProbe = probeSummary(await database.exec(roleProbeSql))

      console.info(
        `Academy identity Probe Run 2: ${secondProbe.pass} PASS, ` +
          `${secondProbe.fail} FAIL, ${secondProbe.total} total`,
      )
      console.info(
        `Academy identity catalog totals: ${secondCatalog.object_counts}`,
      )
      expect(secondCatalog.manifest).toBe(firstCatalog.manifest)
      expect(secondCatalog.object_counts).toBe(firstCatalog.object_counts)
      expect(secondCatalog.verification_count).toBe(2)
      expect(firstCatalog.verification_count).toBe(1)
      expect(secondSentinel).toBe(firstSentinel)
      expect(secondProbe.fail).toBe(0)
      expect(secondProbe.pass).toBe(secondProbe.total)
      expect(secondProbe.probes).toHaveLength(secondProbe.total)
      expect(secondProbe.total).toBe(firstProbe.total)
      expect(await residualIdentityRows(database)).toBe(0)

      const rawToken =
        'aca_stu_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      expect(rawToken).not.toMatch(/^[0-9a-f]{64}$/)
      expect(createHash('sha256').update(rawToken).digest('hex')).toBe(
        '7622985c70518971754832bfecbce888cd460c0189152e431e6045957e10fb1c',
      )
    },
    120_000,
  )

  it.each(incompatibleCases)(
    'rejects incompatible object state: $name',
    async (testCase) => {
      const database = await createDatabase()
      const migrationSql = await migrationSqlPromise

      if ('beforeFirst' in testCase) {
        await database.exec(testCase.beforeFirst)
      } else {
        await database.exec(migrationSql)
        await database.exec(testCase.mutation)
      }

      await expect(database.exec(migrationSql)).rejects.toThrow(
        /security manifest mismatch|unsafe owner, security mode, or search_path|Unmarked Academy identity object collision/,
      )
    },
    120_000,
  )
})
